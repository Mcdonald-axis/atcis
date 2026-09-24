import "server-only";
import { createHash } from "node:crypto";
import { providerErrorCode, requestGemini } from "./gemini";

export type AiPart = {
  text?: string; thought?: boolean;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: unknown };
  inlineData?: { mimeType: string; data: string };
  [key: string]: unknown;
};
export type AiContent = { role: "user" | "model"; parts: AiPart[] };
type Declaration = { name: string; description: string; parameters: Record<string, unknown> };
export type AiRequest = {
  contents: AiContent[];
  systemInstruction?: { parts: { text: string }[] };
  tools?: { functionDeclarations: Declaration[] }[];
  toolConfig?: { functionCallingConfig: { mode: string } };
  generationConfig?: { temperature?: number; maxOutputTokens?: number; responseMimeType?: string };
};
type Provider = "gemini" | "openai";
type Result = { content: AiContent; provider: Provider; model: string; fallbackUsed: boolean };
class ProviderFailure extends Error {
  constructor(readonly code: string, readonly retryable: boolean) { super(code); }
}

// Brief process-local cooldown; automatically probe again and reset when a key changes.
const cooldown = new Map<Provider, { keyHash: string; until: number }>();
const keyFor = (provider: Provider) => process.env[provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"] || "";
const hash = (key: string) => createHash("sha256").update(key).digest("hex");
function available(provider: Provider) {
  const key = keyFor(provider), state = cooldown.get(provider);
  return Boolean(key) && (!state || state.keyHash !== hash(key) || state.until <= Date.now());
}

function jsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(jsonSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, key === "type" && typeof item === "string" ? item.toLowerCase() : jsonSchema(item)]));
}

/** Translate conversation/tool history, preserving call IDs even when changing provider mid-answer. */
export function openAiBody(body: AiRequest, model: string) {
  const input: Record<string, unknown>[] = [];
  const pending: { name: string; id: string }[] = [];
  let sequence = 0;
  for (const content of body.contents) {
    const text: Record<string, unknown>[] = [];
    for (const part of content.parts) {
      if (part.thought) continue;
      if (part.functionCall) {
        const call = part.functionCall, id = call.id || `call_atcis_${sequence++}`;
        pending.push({ name: call.name, id });
        input.push({ type: "function_call", call_id: id, name: call.name, arguments: JSON.stringify(call.args || {}) });
      } else if (part.functionResponse) {
        const response = part.functionResponse;
        const index = pending.findIndex(call => response.id ? call.id === response.id : call.name === response.name);
        if (index === -1) throw new ProviderFailure("PROVIDER_TOOL_HISTORY_INVALID", false);
        const [call] = pending.splice(index, 1);
        input.push({ type: "function_call_output", call_id: call.id, output: JSON.stringify(response.response) });
      } else if (part.text) {
        // Replayed assistant replies are output content in the Responses API.
        text.push(content.role === "model"
          ? { type: "output_text", text: part.text, annotations: [] }
          : { type: "input_text", text: part.text });
      } else if (part.inlineData) {
        const { mimeType, data } = part.inlineData;
        const url = `data:${mimeType};base64,${data}`;
        if (mimeType === "application/pdf") text.push({ type: "input_file", filename: `evidence-${sequence++}.pdf`, file_data: url });
        else if (mimeType.startsWith("image/")) text.push({ type: "input_image", image_url: url, detail: "auto" });
        else throw new ProviderFailure("PROVIDER_UNSUPPORTED_FILE", false);
      }
    }
    if (text.length) input.push({ role: content.role === "model" ? "assistant" : "user", content: text });
  }
  const declarations = body.tools?.flatMap(tool => tool.functionDeclarations) || [];
  const mode = body.toolConfig?.functionCallingConfig.mode || "AUTO";
  return {
    model, store: false, instructions: body.systemInstruction?.parts.map(part => part.text).join("\n"), input,
    ...(declarations.length ? { tools: declarations.map(declaration => ({ type: "function", name: declaration.name,
      description: declaration.description, parameters: jsonSchema(declaration.parameters), strict: false })),
      tool_choice: mode === "ANY" ? "required" : mode === "NONE" ? "none" : "auto" } : {}),
    max_output_tokens: body.generationConfig?.maxOutputTokens || 4096,
    temperature: body.generationConfig?.temperature ?? 0.1,
    ...(body.generationConfig?.responseMimeType === "application/json" ? { text: { format: { type: "json_object" } } } : {}),
  };
}

async function fromOpenAi(body: AiRequest, signal: AbortSignal): Promise<AiContent> {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyFor("openai")}` },
    body: JSON.stringify(openAiBody(body, model)), signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]), cache: "no-store",
  });
  if (!response.ok) throw new ProviderFailure(`PROVIDER_OPENAI_HTTP_${response.status}`, [401, 403, 404, 429, 500, 502, 503, 504].includes(response.status));
  const result = await response.json() as { status?: string; output?: { type: string; call_id?: string; name?: string;
    arguments?: string; content?: { type: string; text?: string; refusal?: string }[] }[] };
  if (result.status === "incomplete") throw new ProviderFailure("PROVIDER_OPENAI_INCOMPLETE", false);
  const parts: AiPart[] = [];
  for (const item of result.output || []) {
    if (item.type === "function_call" && item.name && item.call_id) {
      const args: unknown = JSON.parse(item.arguments || "{}");
      if (!args || typeof args !== "object" || Array.isArray(args)) throw new ProviderFailure("PROVIDER_OPENAI_INVALID_ARGUMENTS", false);
      parts.push({ functionCall: { id: item.call_id, name: item.name, args: args as Record<string, unknown> } });
    } else if (item.type === "message") {
      for (const value of item.content || []) {
        if (value.text) parts.push({ text: value.text });
        else if (value.refusal) parts.push({ text: value.refusal });
      }
    }
  }
  if (!parts.length) throw new ProviderFailure("PROVIDER_OPENAI_EMPTY", false);
  return { role: "model", parts };
}

async function fromGemini(body: AiRequest, signal: AbortSignal): Promise<AiContent> {
  const response = await requestGemini(keyFor("gemini"), "gemini-2.5-flash", body, signal, keyFor("openai") ? 1 : 4);
  if (!response.ok) throw new ProviderFailure(await providerErrorCode(response), [401, 403, 404, 429, 500, 502, 503, 504].includes(response.status));
  const result = await response.json() as { candidates?: { content?: AiContent; finishReason?: string }[] };
  const candidate = result.candidates?.[0];
  if (!candidate?.content?.parts?.length) throw new ProviderFailure("PROVIDER_GEMINI_EMPTY", false);
  return candidate.content;
}

export class AiProviders {
  private readonly primary: Provider = process.env.AI_PRIMARY_PROVIDER === "openai" ? "openai" : "gemini";
  private current: Provider | undefined;
  async generate(body: AiRequest, signal: AbortSignal): Promise<Result> {
    const first = this.current || this.primary;
    const order: Provider[] = [first, first === "gemini" ? "openai" : "gemini"];
    let last: unknown;
    for (const provider of order) {
      if (!available(provider)) continue;
      try {
        const content = await (provider === "gemini" ? fromGemini(body, signal) : fromOpenAi(body, signal));
        this.current = provider;
        cooldown.delete(provider);
        return { content, provider, model: provider === "gemini" ? "gemini-2.5-flash" : process.env.OPENAI_MODEL || "gpt-4.1-mini",
          fallbackUsed: provider !== this.primary };
      } catch (error) {
        if (signal.aborted) throw error;
        if (error instanceof ProviderFailure && !error.retryable) throw error;
        if (!(error instanceof ProviderFailure) && !(error instanceof TypeError)
          && !(error instanceof Error && error.name === "TimeoutError")) throw error;
        last = error;
        cooldown.set(provider, { keyHash: hash(keyFor(provider)), until: Date.now() +
          (error instanceof ProviderFailure && error.code === "PROVIDER_DAILY_QUOTA" ? 300000 : 60000) });
      }
    }
    throw last || new ProviderFailure("PROVIDER_UNAVAILABLE", false);
  }
}
