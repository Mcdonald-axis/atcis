import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const encode = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText).toString("base64")}`;
const gemini = encode(await readFile("src/lib/ai/gemini.ts", "utf8"));
const source = (await readFile("src/lib/ai/providers.ts", "utf8")).replace('import "server-only";', "")
  .replace('"./gemini"', JSON.stringify(gemini));
const { AiProviders, openAiBody } = await import(encode(source));
const savedFetch = globalThis.fetch;
const savedEnv = Object.fromEntries(["GEMINI_API_KEY", "OPENAI_API_KEY", "AI_PRIMARY_PROVIDER", "OPENAI_MODEL"].map(k => [k, process.env[k]]));
let version = 0;
const reset = () => { version++; process.env.GEMINI_API_KEY = `fake-gemini-${version}`;
  process.env.OPENAI_API_KEY = `fake-openai-${version}`; delete process.env.AI_PRIMARY_PROVIDER; delete process.env.OPENAI_MODEL; };
const body = { contents: [{ role: "user", parts: [{ text: "Look up my pipeline." }] }] };
const answer = text => new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }] }));
try {
  reset(); let calls = [];
  globalThis.fetch = async url => { calls.push(String(url)); return String(url).includes("googleapis") ? new Response("{}", { status: 503 }) : answer("Fallback answer"); };
  const providers = new AiProviders();
  const first = await providers.generate(body, new AbortController().signal);
  assert.equal(first.provider, "openai"); assert(first.fallbackUsed);
  await providers.generate(body, new AbortController().signal);
  assert.equal(calls.filter(url => url.includes("googleapis")).length, 1);
  console.log("PASS Gemini failure switches to OpenAI and keeps that provider through the answer");

  const converted = openAiBody({ ...body, contents: [body.contents[0],
    { role: "model", parts: [{ functionCall: { name: "read_document", args: { sourceId: "S2" } } }] },
    { role: "user", parts: [{ functionResponse: { name: "read_document", response: { sourceId: "S2" } } },
      { inlineData: { mimeType: "application/pdf", data: "JVBERi0=" } }] }],
    tools: [{ functionDeclarations: [{ name: "read_document", description: "Read", parameters: { type: "OBJECT", properties: { sourceId: { type: "STRING" } }, required: ["sourceId"] } }] }],
    toolConfig: { functionCallingConfig: { mode: "ANY" } },
  }, "gpt-4.1-mini");
  assert.equal(converted.input[1].call_id, converted.input[2].call_id);
  assert.equal(converted.input[3].content[0].type, "input_file");
  assert.equal(converted.input[3].content[0].file_data, "data:application/pdf;base64,JVBERi0=");
  assert.equal(converted.tools[0].parameters.type, "object"); assert.equal(converted.tool_choice, "required");
  assert.equal(converted.store, false);
  console.log("PASS Tool call IDs, required tools and actual PDF data survive provider conversion");

  const history = openAiBody({ contents: [
    { role: "user", parts: [{ text: "hie" }] },
    { role: "model", parts: [{ text: "Hello! How can I assist you today?" }] },
    { role: "user", parts: [{ text: "how many tenders have we won sofar" }] },
    { role: "model", parts: [{ text: "I will check the pipeline." },
      { functionCall: { id: "call_count", name: "search_system", args: { dataset: "pipeline" } } }] },
    { role: "user", parts: [{ functionResponse: { id: "call_count", name: "search_system", response: { won: 1 } } }] },
  ] }, "gpt-4.1-mini");
  const messages = history.input.filter(item => item.role);
  assert.deepEqual(messages.map(item => item.role), ["user", "assistant", "user", "assistant"]);
  assert.deepEqual(messages.map(item => item.content[0].type), ["input_text", "output_text", "input_text", "output_text"]);
  assert.equal(messages[1].content[0].text, "Hello! How can I assist you today?");
  assert.equal(history.input.find(item => item.type === "function_call_output").call_id, "call_count");
  console.log("PASS Follow-up history preserves assistant output text alongside live tool calls");

  reset(); calls = [];
  globalThis.fetch = async url => { calls.push(String(url)); return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: "Gemini answer" }] } }] })); };
  assert.equal((await new AiProviders().generate(body, new AbortController().signal)).provider, "gemini");
  assert.equal(calls.length, 1);
  console.log("PASS Healthy Gemini remains the primary provider");

  reset(); delete process.env.GEMINI_API_KEY;
  globalThis.fetch = async () => answer("Only OpenAI configured");
  assert.equal((await new AiProviders().generate(body, new AbortController().signal)).provider, "openai");
  console.log("PASS OpenAI works when Gemini is not configured");

  reset(); globalThis.fetch = async () => new Response("{}", { status: 503 });
  await assert.rejects(new AiProviders().generate(body, new AbortController().signal));
  console.log("PASS Both providers unavailable returns an error rather than an invented answer");

  reset(); const controller = new AbortController(); calls = [];
  globalThis.fetch = async url => { calls.push(String(url)); controller.abort(); throw new DOMException("Aborted", "AbortError"); };
  await assert.rejects(new AiProviders().generate(body, controller.signal), { name: "AbortError" });
  assert.equal(calls.length, 1);
  console.log("PASS Cancellation does not start a fallback request");

  const json = openAiBody({ ...body, generationConfig: { responseMimeType: "application/json" } }, "gpt-4.1-mini");
  assert.equal(json.text.format.type, "json_object");
  console.log("PASS Structured tender analysis requests retain JSON output mode");
} finally {
  globalThis.fetch = savedFetch;
  for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
}
