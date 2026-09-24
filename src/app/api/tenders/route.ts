import { after, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import type { CountryScope } from "@/app/(main)/dashboard/default/_components/tender-data";
import { filterTenderCatalog } from "@/lib/tender-catalog-filter";
import { loadTenderCatalog } from "./catalog-cache";
import { detailCacheState, refreshTenderDetails } from "./detail-cache";
import type { PublicTenderRecord } from "./public-detail-fetch";

export const runtime = "nodejs";
export const maxDuration = 60;
const responseHeaders = { "Cache-Control": "private, no-store" };
const detailColumns = "id,source,source_id,country,payload,details,scraped_at,detail_cache_at,detail_retry_at,detail_refresh_until";

export async function GET(req: Request) {
  let auth: Awaited<ReturnType<typeof requireUser>>;
  try { auth = await requireUser(); }
  catch { return NextResponse.json({ success: false, error: "Sign in to view tenders." }, { status: 401 }); }
  try {
    const { client, profile } = auth;
    const params = new URL(req.url).searchParams;
    const requestedCountry = params.get("country") || "ALL";
    if (!["ALL", "ZW", "ZM"].includes(requestedCountry)) {
      return NextResponse.json({ success: false, error: "Invalid country." }, { status: 400 });
    }
    const country = (profile.country !== "ALL" ? profile.country : requestedCountry) as CountryScope;
    const id = params.get("id");
    if (id) {
      if (id.length > 500) return NextResponse.json({ success: false, error: "Invalid tender ID." }, { status: 400 });
      // Every detail lookup passes through the requester's session and RLS first.
      const exact = await client.from("tenders").select(detailColumns).eq("id", id).maybeSingle();
      if (exact.error) throw exact.error;
      let record = exact.data as PublicTenderRecord | null;
      if (!record) {
        const lastPart = id.split(":").pop() || id;
        let query = client.from("tenders").select(detailColumns)
          .in("source_id", [id, lastPart, `zw-${lastPart}`, `zm-${lastPart}`]);
        const source = id.split(":")[0];
        if (id.includes(":")) query = query.eq("source", source);
        const aliases = await query.limit(2);
        if (aliases.error) throw aliases.error;
        if (aliases.data?.length === 1) record = aliases.data[0] as PublicTenderRecord;
      }
      if (!record) return NextResponse.json({ success: true, data: null }, { headers: responseHeaders });
      const authorizedRecord = record;
      const cache = detailCacheState(authorizedRecord);
      const refreshInFlight = Date.parse(authorizedRecord.detail_refresh_until || "") > Date.now();
      if (cache.refreshing && !refreshInFlight) after(() => refreshTenderDetails(authorizedRecord));
      const payload = record.payload || {}, details = record.details || {};
      return NextResponse.json({ success: true, cache, data: {
        ...payload, ...details, id: record.id,
        documents: details.documents || payload.documents || [],
        lineItems: details.lineItems || payload.lineItems || [],
      } }, { headers: responseHeaders });
    }

    const pageSize = Number(params.get("pageSize") || 50);
    const requestedPage = Number(params.get("page") || 1);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || !Number.isInteger(requestedPage) || requestedPage < 1) {
      return NextResponse.json({ success: false, error: "Invalid pagination." }, { status: 400 });
    }
    const catalogue = await loadTenderCatalog(client, country, profile.country);
    const filtered = filterTenderCatalog(catalogue.items, {
      countryFilter: "ALL", // The shared cache is already restricted by country and RLS.
      categoryFilter: (params.get("category") || "ALL").slice(0, 100),
      statusFilter: params.get("status") || "ALL", portalFilter: (params.get("portal") || "ALL").slice(0, 100),
      aiConfidenceFilter: params.get("confidence") || "ALL", focusModeOnly: params.get("focus") === "true",
      searchTerm: (params.get("q") || "").slice(0, 300), sortOrder: params.get("sort") || "PRIORITY",
    });
    const total = filtered.length;
    const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
    const start = (page - 1) * pageSize;
    // Full summaries remain available for features that need every deadline or
    // assignment candidate. The directory uses bounded pages by default.
    const items = params.get("view") === "all" ? filtered : filtered.slice(start, start + pageSize);
    return NextResponse.json({ success: true, data: items, total, page, pageSize,
      updatedAt: catalogue.sourceUpdatedAt, refreshing: catalogue.refreshing,
    }, { headers: responseHeaders });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load saved tenders. Please retry." }, { status: 503 });
  }
}
