import "server-only";
import { createClient } from "@supabase/supabase-js";
import { fetchPublicTenderDetails, supportsDetailRefresh, type PublicTenderRecord } from "./public-detail-fetch";

export function detailCacheState(record: PublicTenderRecord) {
  const now = Date.now();
  const stale = !record.detail_cache_at || now - Date.parse(record.detail_cache_at) >= 60 * 60_000
    || Date.parse(record.scraped_at) > Date.parse(record.detail_cache_at);
  const supported = supportsDetailRefresh(record);
  const retryAllowed = !record.detail_retry_at || Date.parse(record.detail_retry_at) <= now;
  const configured = Boolean(process.env.SUPABASE_SECRET_KEY);
  return {
    updatedAt: record.detail_cache_at || record.scraped_at,
    refreshing: configured && supported && stale && retryAllowed,
    retryAt: record.detail_retry_at,
  };
}

/** Called only after the requesting user's RLS read resolves the real tender ID. */
export async function refreshTenderDetails(record: PublicTenderRecord) {
  if (!supportsDetailRefresh(record)) return;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !url) return;
  // This client is confined to the two cache RPCs. It never reads private user data.
  const cacheWriter = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: token, error } = await cacheWriter.rpc("claim_tender_detail_refresh", { p_id: record.id });
  if (error) { console.warn("Could not claim public tender refresh", record.id); return; }
  if (!token) return; // Another server/request owns the lease, or the cache is fresh.
  let patch: Record<string, unknown> | null = null;
  try { patch = await fetchPublicTenderDetails(record); }
  catch { console.warn("Official tender source unavailable; keeping saved details", record.id); }
  const { error: saveError } = await cacheWriter.rpc("finish_tender_detail_refresh", {
    p_id: record.id, p_token: token, p_patch: patch,
  });
  if (saveError) console.warn("Could not persist public tender refresh", record.id);
}
