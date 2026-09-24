import "server-only";

import { after } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CountryScope, TenderItem } from "@/app/(main)/dashboard/default/_components/tender-data";
import {
  refreshTenderClassifications,
  resolveSavedTenderClassification,
  type TenderClassificationCandidate,
} from "@/lib/ai/tender-classifier";
import { classifyTenderSector, mapRawTenderToItem } from "@/lib/tender-mapping";

type Snapshot = { items: TenderItem[]; loadedAt: number; sourceUpdatedAt: string | null };
type Entry = { snapshot?: Snapshot; pending?: Promise<Snapshot>; retryAt?: number };
type CatalogRow = {
  id: string;
  country: string;
  source: string;
  source_id: string;
  payload: unknown;
  scraped_at: string | null;
  ai_classification?: unknown;
  ai_classification_hash?: string | null;
  classification_override?: unknown;
};
const cache = new Map<string, Entry>();
const freshFor = 60_000;
const maxStale = 5 * 60_000;

// Only the public tender catalogue is shared. Authenticate before calling this
// function; the key includes the verified database country boundary.
export async function loadTenderCatalog(client: SupabaseClient, country: CountryScope, accessCountry: string) {
  const key = `${accessCountry}:${country}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = {};
    cache.set(key, entry);
  }
  const current = entry;
  const refresh = () => {
    if (current.pending) return current.pending;
    current.pending = (async () => {
      const items: TenderItem[] = [];
      const classificationCandidates: TenderClassificationCandidate[] = [];
      let sourceUpdatedAt: string | null = null;
      for (let offset = 0; ; offset += 1000) {
        let query = client
          .from("tenders")
          .select(
            "id,country,source,source_id,payload,scraped_at,ai_classification,ai_classification_hash,classification_override",
          )
          .eq("status", "live")
          .order("id")
          .range(offset, offset + 999);
        if (country !== "ALL") query = query.in("country", [country, "ALL"]);
        const enhancedResult = await query;
        let data = enhancedResult.data as CatalogRow[] | null;
        let error = enhancedResult.error;
        let classificationPersistenceAvailable = true;
        if (error) {
          // Deployments can continue serving deterministic classifications while
          // the additive classification-cache migration is being rolled out.
          classificationPersistenceAvailable = false;
          let fallback = client
            .from("tenders")
            .select("id,country,source,source_id,payload,scraped_at")
            .eq("status", "live")
            .order("id")
            .range(offset, offset + 999);
          if (country !== "ALL") fallback = fallback.in("country", [country, "ALL"]);
          const fallbackResult = await fallback;
          data = fallbackResult.data as CatalogRow[] | null;
          error = fallbackResult.error;
        }
        if (error) throw new Error("Tender catalogue refresh failed");
        for (const row of data ?? []) {
          const payload =
            row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
              ? (row.payload as Record<string, unknown>)
              : {};
          const { classification, contentHash } = resolveSavedTenderClassification(row.id, payload, row);
          const rules = classifyTenderSector(payload);
          if (!classification && rules.needsClassificationReview) {
            classificationCandidates.push({
              id: row.id,
              payload,
              contentHash,
              persist: classificationPersistenceAvailable,
            });
          }
          const item = mapRawTenderToItem(
            {
              ...payload,
              id: row.id,
              countryCode: row.country,
              source: row.source,
              source_id: row.source_id,
              classificationDecision: classification,
            },
            items.length,
          );
          // Full text, documents and contact metadata are loaded on opening a tender.
          const { documents, lineItems, noticeTextHtml, noticeAtAGlance, contactInfo, contact, ...summary } = item;
          items.push({ ...summary, description: summary.description?.slice(0, 1000) });
          if (row.scraped_at && (!sourceUpdatedAt || row.scraped_at > sourceUpdatedAt))
            sourceUpdatedAt = row.scraped_at;
        }
        if (!data || data.length < 1000) break;
      }
      const snapshot = { items, loadedAt: Date.now(), sourceUpdatedAt };
      current.snapshot = snapshot;
      current.retryAt = undefined;
      if (classificationCandidates.length) {
        after(async () => {
          const saved = await refreshTenderClassifications(classificationCandidates);
          if (saved > 0) cache.clear();
        });
      }
      return snapshot;
    })()
      .catch((error) => {
        current.retryAt = Date.now() + 15_000;
        throw error;
      })
      .finally(() => {
        current.pending = undefined;
      });
    return current.pending;
  };

  const snapshot = current.snapshot;
  if (!snapshot || Date.now() - snapshot.loadedAt > maxStale) return { ...(await refresh()), refreshing: false };
  const stale = Date.now() - snapshot.loadedAt > freshFor;
  if (stale && (!current.retryAt || current.retryAt <= Date.now())) {
    after(async () => {
      try {
        await refresh();
      } catch {
        console.warn("Public tender catalogue refresh failed; retaining saved results.");
      }
    });
  }
  return { ...snapshot, refreshing: stale && (!current.retryAt || current.retryAt <= Date.now()) };
}
