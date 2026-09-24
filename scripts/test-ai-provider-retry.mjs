import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("src/lib/ai/gemini.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ES2022 } }).outputText;
const { requestGemini, providerErrorCode } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const originalFetch = globalThis.fetch;
try {
  let calls = 0;
  globalThis.fetch = async () => new Response("{}", { status: ++calls === 1 ? 503 : 200 });
  assert.equal((await requestGemini("test-key", "test-model", {}, new AbortController().signal)).status, 200);
  assert.equal(calls, 2);
  console.log("PASS Temporary provider failure retries and recovers");
  calls = 0;
  globalThis.fetch = async () => { calls++; return new Response("{}", { status: 401 }); };
  assert.equal((await requestGemini("test-key", "test-model", {}, new AbortController().signal)).status, 401);
  assert.equal(calls, 1);
  console.log("PASS Permanent provider errors are not retried");
  calls = 0;
  globalThis.fetch = async () => { calls++; return new Response("{}", { status: 429, headers: { "Retry-After": "120" } }); };
  assert.equal((await requestGemini("test-key", "test-model", {}, new AbortController().signal)).status, 429);
  assert.equal(calls, 1);
  console.log("PASS Retry-After is respected when waiting would exceed the retry budget");
  calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ error: { details: [
    { violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }, { retryDelay: "5s" },
  ] } }), { status: 429 }); };
  const quota = await requestGemini("test-key", "test-model", {}, new AbortController().signal);
  assert.equal(await providerErrorCode(quota), "PROVIDER_DAILY_QUOTA");
  assert.equal(calls, 1);
  console.log("PASS Daily quota exhaustion is identified and is not retried");
  calls = 0;
  globalThis.fetch = async () => { calls++; return new Response("{}", { status: 503 }); };
  const controller = new AbortController();
  const pending = requestGemini("test-key", "test-model", {}, controller.signal);
  setTimeout(() => controller.abort(), 25);
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(calls, 1);
  console.log("PASS Cancellation aborts the retry wait before another provider request");
} finally { globalThis.fetch = originalFetch; }
