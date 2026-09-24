import { setTimeout as delay } from "node:timers/promises";

type ProviderError = { error?: { details?: { violations?: { quotaId?: string }[]; retryDelay?: string }[] } };
async function quotaDetails(response: Response) {
  if (response.status !== 429) return { daily: false, retryMs: 0 };
  try {
    const body = await response.clone().json() as ProviderError;
    const details = body.error?.details || [];
    return {
      daily: details.some(detail => detail.violations?.some(v => /PerDay/i.test(v.quotaId || ""))),
      retryMs: Math.max(0, ...details.map(detail => {
        const seconds = Number((detail.retryDelay || "0s").replace(/s$/, ""));
        return Number.isFinite(seconds) ? seconds * 1000 : 0;
      })),
    };
  } catch { return { daily: false, retryMs: 0 }; }
}

export async function providerErrorCode(response: Response) {
  return (await quotaDetails(response)).daily ? "PROVIDER_DAILY_QUOTA" : `PROVIDER_HTTP_${response.status}`;
}

/** Retry temporary provider failures without exceeding the overall request deadline. */
export async function requestGemini(key: string, model: string, body: unknown, signal: AbortSignal, attempts = 4) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    signal.throwIfAborted();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
      cache: "no-store",
    });
    if (response.ok || ![429, 500, 502, 503, 504].includes(response.status) || attempt === attempts - 1) return response;
    const quota = await quotaDetails(response);
    if (quota.daily) return response;
    const retryAfter = response.headers.get("retry-after");
    const seconds = retryAfter ? Number(retryAfter) : NaN;
    const requestedDelay = Number.isFinite(seconds) ? seconds * 1000
      : retryAfter ? Date.parse(retryAfter) - Date.now() : 0;
    const wait = Math.max(2000 * 2 ** attempt, quota.retryMs, Number.isFinite(requestedDelay) ? requestedDelay : 0);
    // Don't retry sooner than requested if the provider asks us to wait longer.
    if (wait > 15000) return response;
    await response.body?.cancel();
    await delay(wait, undefined, { signal });
  }
  throw new Error("PROVIDER_RETRIES_EXHAUSTED");
}
