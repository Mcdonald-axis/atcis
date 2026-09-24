/**
 * Tender Intelligence API Client
 * Loads persisted Supabase records through authenticated Next.js routes.
 * Returns strictly actual live scraped data from PRAZ, ZPPA, and multi-source procurement databases.
 */

import {
  type CountryScope,
  type TenderItem,
  type AdvanceProcurementPlan,
} from "@/app/(main)/dashboard/default/_components/tender-data";



export class TenderApiService {
  /**
   * All saved summaries for features that need every deadline or assignment candidate.
   * The directory uses getTenderPage instead of downloading the whole catalogue.
   */
  public static async getLiveTenders(countryScope: CountryScope = "ALL"): Promise<TenderItem[]> {
    const response = await fetch(`/api/tenders?view=all&country=${encodeURIComponent(countryScope)}`);
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || "Could not load tenders");
    return json.data;
  }

  /**
   * A bounded page from the shared, authorised public catalogue.
   */
  public static async getTenderPage(params: URLSearchParams, signal?: AbortSignal): Promise<{
    data: TenderItem[]; total: number; page: number; pageSize: number; updatedAt: string | null; refreshing: boolean;
  }> {
    const response = await fetch(`/api/tenders?${params}`, { signal, cache: "no-store" });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || "Could not load saved tenders");
    return json;
  }

  public static async getTenderDetails(tenderId: string, signal?: AbortSignal): Promise<any | null> {
    const response = await fetch(`/api/tenders?id=${encodeURIComponent(tenderId)}`, {
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Could not load saved tender details");
    const json = await response.json();
    return json.data ? { ...json.data, cacheInfo: json.cache } : null;
  }

  /**
   * 3. Analyze Tender & Documents using Gemini 2.5 Flash
   * Calls: POST /api/Tenders/analyze-document
   */
  public static async analyzeTenderDocument(params: {
    tenderId: string;
    documentUrl?: string;
    fileName?: string;
    customPrompt?: string;
    tender?: any;
    scopeOfWorks?: string;
    isScopeAnalysis?: boolean;
  }): Promise<any | null> {
    try {
      const response = await fetch("/api/tenders/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) return null;
      const json = await response.json();
      return json.data ?? null;
    } catch {
      return null;
    }
  }

  /**
   * 4. Trigger Global Portal Synchronization
   */
  public static async triggerScraperSync(pages = 5): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch("/api/scrape", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pages }) });
      const json = await response.json();
      return { success: response.ok && json.success, message: json.message || "Could not queue scrape" };
    } catch { return { success: false, message: "Could not reach the application server" }; }
  }

  /**
   * 5. Get Live Annual Procurement Plans (Strictly Real Scraped Data from PRAZ / ZPPA)
   * Calls: GET /api/ProcurementPlans/page/1
   */
  public static async getLiveProcurementPlans(countryScope: CountryScope = "ALL"): Promise<AdvanceProcurementPlan[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const endpoint = `/api/procurement-plans?country=${encodeURIComponent(countryScope)}`;
      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
      });

      clearTimeout(timeoutId);

      if (!response.ok) return [];

      const json = await response.json();
      const rawList: any[] = Array.isArray(json.data?.items)
        ? json.data.items
        : Array.isArray(json.data)
        ? json.data
        : Array.isArray(json)
        ? json
        : [];

      if (rawList.length === 0) return [];

      return rawList.map((plan: any, idx: number) => {
        const entity = (plan.procuringEntity || "Procuring Entity").trim();
        const year = plan.year || new Date().getFullYear();
        const viewUrl = plan.viewAppUrl || `https://egp.praz.org.zw/indexes/get-app?url=egp-SW5kZXhlcy9nZXRBcHA%3D`;

        const lower = entity.toLowerCase();
        let category = "General Public Procurement";
        let estimatedBudget = Number(plan.totalEstimatedValue || 0);

        if (lower.includes("hospital") || lower.includes("medical") || lower.includes("health") || lower.includes("clinic")) {
          category = "Healthcare & Medical";
          estimatedBudget = Number(plan.totalEstimatedValue || 0);
        } else if (
          lower.includes("cellular") ||
          lower.includes("tech") ||
          lower.includes("netone") ||
          lower.includes("telecom") ||
          lower.includes("ict") ||
          lower.includes("software") ||
          lower.includes("digital")
        ) {
          category = "ICT & Software";
          estimatedBudget = Number(plan.totalEstimatedValue || 0);
        } else if (lower.includes("college") || lower.includes("school") || lower.includes("training") || lower.includes("university")) {
          category = "Education & Training Services";
          estimatedBudget = Number(plan.totalEstimatedValue || 0);
        } else if (lower.includes("gold") || lower.includes("mining") || lower.includes("energy") || lower.includes("power")) {
          category = "Mining & Energy";
          estimatedBudget = Number(plan.totalEstimatedValue || 0);
        } else if (lower.includes("court") || lower.includes("police") || lower.includes("ministry") || lower.includes("council") || lower.includes("centre")) {
          category = "Government & Municipal Administration";
          estimatedBudget = Number(plan.totalEstimatedValue || 0);
        }

        const quarters: ("Q3 2026" | "Q4 2026" | "Q1 2027" | "Q2 2027")[] = ["Q3 2026", "Q4 2026", "Q1 2027", "Q2 2027"];
        const quarter = "Not published";

        return {
          id: plan.id,
          planRef: `APP-ZW-${year}-${String(idx + 1).padStart(3, "0")}`,
          procuringEntity: entity,
          countryCode: plan.countryCode || "ZW",
          countryName: plan.countryCode === "ZM" ? "Zambia" : "Zimbabwe",
          description: `Gazetted Annual Procurement Plan (${year}) - ${entity}`,
          category,
          estimatedBudget,
          expectedPublication: `Annual Schedule ${year}`,
          quarter,
          procurementMethod: "Open Competitive" as const,
          spocContact: plan.spocContact || "",
          sourcePortal: "PRAZ e-GP Gazette",
          portalUrl: viewUrl,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * 6. Get Detailed Line Items & Activity Schedules for a Procurement Plan
   * Calls: GET /api/ProcurementPlans/detail?url={portalUrl}
   */
  public static async getProcurementPlanDetail(portalUrl: string): Promise<any | null> {
    try {
      if (!portalUrl || !portalUrl.includes("praz.org.zw")) return null;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const endpoint = `/api/procurement-plans?url=${encodeURIComponent(portalUrl)}`;
      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
      });

      clearTimeout(timeoutId);
      if (!response.ok) return null;

      const json = await response.json();
      return json.data ?? null;
    } catch {
      return null;
    }
  }
}
