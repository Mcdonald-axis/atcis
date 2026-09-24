import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

export type PublicTenderRecord = {
  id: string; source: string; source_id: string; country: string;
  payload: Record<string, any>; details: Record<string, any> | null;
  scraped_at: string; detail_cache_at: string | null; detail_retry_at: string | null;
  detail_refresh_until: string | null;
};

export function supportsDetailRefresh(data: PublicTenderRecord) {
  return ["praz", "afdb", "worldbank", "zppa"].includes(data.source) || data.id.startsWith("zppa:");
}

export async function fetchPublicTenderDetails(data: PublicTenderRecord): Promise<Record<string, unknown>> {
      let details: Record<string, any> = {};
      let refreshed = false;

      // If details or documents are missing for a PRAZ tender, fetch live details
      if (data.source === "praz" || data.id.startsWith("praz:")) {
        const sourceId = data.source_id || data.id.replace("praz:", "");
        let fetched = false;

        // 1. Try local C# API service if running on port 8096
        try {
          const apiRes = await fetch(`http://localhost:8096/api/Tenders/details/${encodeURIComponent(sourceId)}`, {
            signal: AbortSignal.timeout(3000),
          });
          if (apiRes.ok) {
            const apiJson = await apiRes.json();
            if (apiJson.success && apiJson.data) {
              details = { ...details, ...apiJson.data };
              fetched = true;
              // Persisted by the server cache worker after this fetch succeeds.
              refreshed = true;
            }
          }
        } catch {
          // port 8096 unavailable or timed out
        }

        // 2. Direct fallback: scrape document view from PRAZ e-GP portal
        if (!fetched) {
          try {
            const docRes = await fetch(`https://egp.praz.org.zw/Tenders/tender_doc_view/${encodeURIComponent(sourceId)}/${encodeURIComponent(sourceId)}`, {
              headers: { "X-Requested-With": "XMLHttpRequest" },
              signal: AbortSignal.timeout(4000),
            });
            if (docRes.ok) {
              const html = await docRes.text();
              refreshed = true;
              const docs: any[] = [];
              const seen = new Set<string>();
              const regex = /<a\s+[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
              let match;
              let dId = 1;
              while ((match = regex.exec(html)) !== null) {
                const url = match[1];
                const text = match[2].trim();
                if ((text.endsWith(".pdf") || text.endsWith(".docx") || text.endsWith(".zip") || text.includes(".pdf")) && !seen.has(text)) {
                  seen.add(text);
                  docs.push({
                    documentId: String(dId++),
                    tenderId: sourceId,
                    title: text,
                    fileName: text,
                    downloadUrl: url.startsWith("http") ? url : `https://egp.praz.org.zw${url}`,
                  });
                }
              }
              if (docs.length > 0) {
                details = { ...details, documents: docs };
                refreshed = true;
              }
            }
          } catch {
            // Ignore if live fetch fails; existing payload will be returned
          }
        }
      }

      // If details or documents are missing for an AfDB tender, scrape live detail from AfDB
      if (data.source === "afdb" || data.id.startsWith("afdb:")) {
        const payloadObj = (data.payload as Record<string, any>) || {};
        const targetUrl = payloadObj.detailsUrl || payloadObj.sourceUrl || data.source_id || data.id.replace("afdb:", "");
        try {
          const projectRoot = process.cwd().includes("next-shadcn-admin-dashboard") ? ".." : process.cwd();
          const target = new URL(targetUrl);
          if (target.protocol !== "https:" || !(target.hostname === "afdb.org" || target.hostname.endsWith(".afdb.org"))) {
            throw new Error("Unsupported AfDB detail URL");
          }
          const { stdout: out } = await execFileAsync("python3", ["scripts/scrape_afdb.py", "--detail", target.href], {
            cwd: projectRoot, timeout: 10000, maxBuffer: 2 * 1024 * 1024, encoding: "utf-8",
          });
          const parsed = JSON.parse(out.trim());
          if (parsed.pdf_url) {
            const fileName = parsed.pdf_url.split("/").pop() || "tender_document.pdf";
            const slug = data.source_id || data.id.replace("afdb:", "");
            const docs = [
              {
                documentId: `afdb-doc-${slug}`,
                tenderId: slug,
                title: fileName,
                fileName: fileName,
                downloadUrl: parsed.pdf_url,
              },
            ];
            details = {
              ...details,
              description: parsed.description || details.description || payloadObj.description,
              documents: docs,
            };
            // Persisted by the server cache worker after this fetch succeeds.
            refreshed = true;
          }
        } catch {
          // Continue with existing payload/details
        }
      }

      // If details or full notice metadata are missing for a World Bank tender, fetch live from official World Bank API
      if (data.source === "worldbank" || data.id.startsWith("worldbank:")) {
        const payloadObj = (data.payload as Record<string, any>) || {};
        const wbId = (data.source_id || data.id.replace(/^worldbank:(zw|zm):/i, "").replace(/^worldbank:/i, "")).replace(/^(zw|zm)-/i, "");
        if (wbId) {
          try {
            const wbRes = await fetch(`https://search.worldbank.org/api/v2/procnotices?format=json&id=${encodeURIComponent(wbId)}`, {
              headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
              signal: AbortSignal.timeout(4000),
            });
            if (wbRes.ok) {
              const wbJson = await wbRes.json();
              const notices = Array.isArray(wbJson.procnotices) ? wbJson.procnotices : Object.values(wbJson.procnotices || {});
              if (notices.length > 0) {
                const n: any = notices[0];
                const subDate = n.submission_deadline_date || payloadObj.closingDate || "";
                const subTime = n.submission_deadline_time || "";
                const deadlineStr = `${subDate ? subDate.split("T")[0] : ""} ${subTime}`.trim();
                const contactAddr = n.contact_address || payloadObj.contact?.address || "";
                const entityName = n.contact_organization || payloadObj.contact?.organization || payloadObj.procuringEntity || "Government Implementing Agency";

                const noticeAtAGlance = {
                  projectId: n.project_id || payloadObj.projectId || "",
                  projectTitle: n.project_name || payloadObj.projectTitle || "",
                  country: n.project_ctry_name || payloadObj.countryName || (data.country === "ZM" ? "Zambia" : "Zimbabwe"),
                  noticeNo: n.id || wbId,
                  noticeType: n.notice_type || payloadObj.procurementType || "Request for Expression of Interest",
                  noticeStatus: n.notice_status || "Published",
                  borrowerBidReference: n.bid_reference_no || payloadObj.refNo || "",
                  procurementMethod: n.procurement_method_name || payloadObj.procurementMethod || "",
                  language: n.notice_lang_name || "English",
                  submissionDeadline: deadlineStr,
                  submissionDeadlineDate: subDate,
                  submissionDeadlineTime: subTime,
                  publishedDate: n.noticedate || n.submission_date || payloadObj.publishDate || "",
                };

                const contactInfo = {
                  organization: entityName,
                  name: n.contact_name || payloadObj.contact?.name || "",
                  address: contactAddr,
                  city: contactAddr.toLowerCase().includes("harare") ? "Harare" : (contactAddr.toLowerCase().includes("lusaka") ? "Lusaka" : ""),
                  province: n.contact_ctry_name || payloadObj.countryName || (data.country === "ZM" ? "Zambia" : "Zimbabwe"),
                  postalCode: n.contact_postal_code || "",
                  country: n.contact_ctry_name || payloadObj.countryName || (data.country === "ZM" ? "Zambia" : "Zimbabwe"),
                  phone: n.contact_phone_no || payloadObj.contact?.phone || "",
                  email: n.contact_email || payloadObj.contact?.email || "",
                  website: n.contact_website || "",
                };

                details = {
                  ...details,
                  noticeAtAGlance,
                  contactInfo,
                  noticeTextHtml: n.notice_text || "",
                  noticeStatus: n.notice_status || "Published",
                  noticeLang: n.notice_lang_name || "English",
                  submissionDeadlineTime: subTime,
                };


                // Persisted by the server cache worker after this fetch succeeds.
                refreshed = true;
              }
            }
          } catch {
            // Ignore if live fetch fails; existing payload will be returned
          }
        }
      }

      // If details or documents are missing for a ZPPA tender, scrape live detail from ZPPA
      if (data.source === "zppa" || data.id.startsWith("zppa:")) {
        const payloadObj = (data.payload as Record<string, any>) || {};
        const resourceId = (data.source_id || data.id.replace("zppa:", "")).trim();
        try {
          const projectRoot = process.cwd().includes("next-shadcn-admin-dashboard") ? ".." : process.cwd();
          const { stdout: out } = await execFileAsync("python3", ["scripts/scrape_zppa.py", "--detail", resourceId], {
            cwd: projectRoot, timeout: 15000, maxBuffer: 2 * 1024 * 1024, encoding: "utf-8",
          });
          const parsed = JSON.parse(out.trim());
          if (parsed && (parsed.resourceId || parsed.title)) {
            details = {
              ...details,
              ...parsed,
              title: parsed.title || details.title || payloadObj.title,
              description: parsed.description || details.description || payloadObj.description,
              procuringEntity: parsed.procuringEntity || details.procuringEntity || payloadObj.procuringEntity,
              officialUrl: parsed.officialUrl || `https://eprocure.zppa.org.zm/epps/cft/prepareViewCfTWS.do?resourceId=${encodeURIComponent(resourceId)}`,
              documents: parsed.documents && parsed.documents.length > 0 ? parsed.documents : (details.documents || payloadObj.documents || []),
              lineItems: parsed.lineItems && parsed.lineItems.length > 0 ? parsed.lineItems : (details.lineItems || payloadObj.lineItems || []),
              lots: parsed.lots || details.lots || payloadObj.lots || [],
              rawFields: parsed.rawFields || details.rawFields || payloadObj.rawFields || {},
            };
            refreshed = true;
          }
        } catch {
          // Continue with existing payload/details
        }
      }

  if (!refreshed) throw new Error("Official tender detail source unavailable");
  return details;
}
