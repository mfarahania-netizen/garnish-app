import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ModelProvider,
  ModelGenerateInput,
  ModelGenerateResult,
  ToolCallingInput,
  ToolCallingResult,
  ToolSpec,
  ChatTurn,
  ToolCallRequest,
} from '../ai-core.types';

/**
 * Gemini model provider (E47-A5) — behind the ModelProvider interface.
 *
 * The ONLY place that talks to Gemini. The orchestrator calls the interface, never this directly.
 * The API key is read from env (passed in by the factory), never printed, never stored beyond the
 * SDK client, never committed. Errors are sanitized (key/url redacted) before being thrown, so no
 * secret can leak into logs/responses.
 *
 * generateWithTools (added 2026-06-28): a RELIABLE tool-capable provider for the agentic chain — the free
 * OpenRouter tool models intermittently return empty completions, so when they all flake the chain now falls to
 * Gemini's native function-calling instead of the grounded reply (which faked unsaved meal-plan tables). The HARD
 * allergy/pork gate still wraps the loop OUTSIDE this provider — unchanged.
 */
export class GeminiModelProvider implements ModelProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenerativeAI;

  constructor(
    private readonly apiKey: string,
    private readonly modelName: string,
  ) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generate(input: ModelGenerateInput): Promise<ModelGenerateResult> {
    try {
      const model = this.client.getGenerativeModel({ model: this.modelName });
      const prompt = input.system ? `${input.system}\n\n${input.prompt}` : input.prompt;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const usage = result.response.usageMetadata;
      // E47-A10A: tag provenance — 'provider' when the SDK returned real usage metadata, else 'estimated'.
      const hasProviderUsage = !!usage && (usage.promptTokenCount != null || usage.totalTokenCount != null);
      const estTotal = Math.max(1, Math.ceil((prompt.length + (text?.length ?? 0)) / 4));
      return {
        text,
        model: this.modelName,
        usage: hasProviderUsage
          ? {
              promptTokens: usage?.promptTokenCount,
              completionTokens: usage?.candidatesTokenCount,
              totalTokens: usage?.totalTokenCount,
              source: 'provider',
            }
          : {
              // SDK gave no usage metadata → conservative estimate, clearly marked estimated.
              promptTokens: Math.max(1, Math.ceil(prompt.length / 4)),
              completionTokens: Math.max(0, Math.ceil((text?.length ?? 0) / 4)),
              totalTokens: estTotal,
              source: 'estimated',
            },
      };
    } catch (err) {
      throw new Error(this.sanitize(err));
    }
  }

  /**
   * Tool-calling round via Gemini's native function-calling. Mirrors the OpenRouter provider's contract:
   * takes the running conversation + tool catalog, returns the model's text OR the tool calls it wants run.
   * The loop (outside) executes the tools, appends results, and calls back. Function-call ids are synthesized
   * (Gemini matches by name) and mapped back to names from the conversation for the functionResponse turns.
   */
  async generateWithTools(input: ToolCallingInput): Promise<ToolCallingResult> {
    try {
      const { systemInstruction, contents } = toGeminiContents(input.messages);
      const functionDeclarations = toFunctionDeclarations(input.tools);
      const model = this.client.getGenerativeModel({
        model: this.modelName,
        ...(functionDeclarations.length ? { tools: [{ functionDeclarations }] } : {}),
        ...(systemInstruction ? { systemInstruction } : {}),
      });
      const result = await model.generateContent({ contents } as never);
      const parts = result.response.candidates?.[0]?.content?.parts ?? [];
      const toolCalls: ToolCallRequest[] = [];
      let text = '';
      parts.forEach((p: any, i: number) => {
        if (p?.functionCall?.name) {
          toolCalls.push({ id: `call_${i}`, name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args ?? {}) });
        } else if (typeof p?.text === 'string') {
          text += p.text;
        }
      });
      if (!text && toolCalls.length === 0) throw new Error(this.sanitize('empty completion (no text, no tool calls)'));
      const usage = result.response.usageMetadata;
      const promptLen = input.messages.reduce((s, m) => s + (m.content?.length ?? 0), 0);
      const hasProviderUsage = !!usage && (usage.promptTokenCount != null || usage.totalTokenCount != null);
      return {
        text,
        toolCalls,
        model: this.modelName,
        usage: hasProviderUsage
          ? { promptTokens: usage?.promptTokenCount, completionTokens: usage?.candidatesTokenCount, totalTokens: usage?.totalTokenCount, source: 'provider' }
          : { promptTokens: Math.max(1, Math.ceil(promptLen / 4)), completionTokens: Math.max(0, Math.ceil(text.length / 4)), totalTokens: Math.max(1, Math.ceil((promptLen + text.length) / 4)), source: 'estimated' },
      };
    } catch (err) {
      throw new Error(this.sanitize(err));
    }
  }

  /** Strip the API key and any key-like/url tokens from an error before it leaves the provider. */
  private sanitize(err: unknown): string {
    let msg = err instanceof Error ? err.message : String(err);
    if (this.apiKey) msg = msg.split(this.apiKey).join('[redacted-key]');
    msg = msg
      .replace(/AIza[A-Za-z0-9_-]{8,}/g, '[redacted-key]')
      .replace(/key=[^\s&'"]+/gi, 'key=[redacted]');
    return `gemini_provider_error: ${msg.slice(0, 300)}`;
  }
}

// ── pure mappers (exported for unit tests) ─────────────────────────────────────────────────────────────────

/** Map the loop's ChatTurn[] to Gemini contents + systemInstruction (functionCall/functionResponse round-trip). */
export function toGeminiContents(messages: ChatTurn[]): { systemInstruction?: string; contents: any[] } {
  let systemInstruction: string | undefined;
  const contents: any[] = [];
  const idToName = new Map<string, string>(); // synthesized call id → function name (for the functionResponse turn)
  for (const m of messages) {
    if (m.role === 'system') {
      systemInstruction = systemInstruction ? `${systemInstruction}\n${m.content ?? ''}` : (m.content ?? '');
      continue;
    }
    if (m.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: m.content ?? '' }] });
      continue;
    }
    if (m.role === 'assistant') {
      const parts: any[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls ?? []) {
        if (tc.id) idToName.set(tc.id, tc.name);
        let args: unknown = {};
        try { args = JSON.parse(tc.arguments || '{}'); } catch { args = {}; }
        parts.push({ functionCall: { name: tc.name, args } });
      }
      if (parts.length) contents.push({ role: 'model', parts });
      continue;
    }
    if (m.role === 'tool') {
      const name = (m.toolCallId && idToName.get(m.toolCallId)) || 'tool';
      let response: any;
      try { response = JSON.parse(m.content ?? '{}'); } catch { response = { result: m.content ?? '' }; }
      if (typeof response !== 'object' || response === null) response = { result: response };
      contents.push({ role: 'user', parts: [{ functionResponse: { name, response } }] });
    }
  }
  return { systemInstruction, contents };
}

/** Map ToolSpec[] to Gemini functionDeclarations; omit `parameters` for no-arg tools (Gemini rejects empty props). */
export function toFunctionDeclarations(tools: ToolSpec[]): any[] {
  return (tools ?? []).map((t) => {
    const params = cleanSchema(t.parameters);
    const fd: any = { name: t.name, description: t.description };
    if (params && params.type === 'object' && params.properties && Object.keys(params.properties).length > 0) {
      fd.parameters = params;
    }
    return fd;
  });
}

/** Keep only the OpenAPI-subset keys Gemini's function schema accepts (drops additionalProperties/$schema/etc.). */
function cleanSchema(s: any): any {
  if (!s || typeof s !== 'object') return undefined;
  const out: any = {};
  if (s.type) out.type = s.type;
  if (s.description) out.description = s.description;
  if (Array.isArray(s.enum)) out.enum = s.enum;
  if (s.type === 'array') out.items = cleanSchema(s.items) ?? { type: 'string' };
  if (s.type === 'object') {
    const props: any = {};
    if (s.properties && typeof s.properties === 'object') {
      for (const k of Object.keys(s.properties)) {
        const c = cleanSchema(s.properties[k]);
        if (c) props[k] = c;
      }
    }
    out.properties = props;
    if (Array.isArray(s.required) && s.required.length) out.required = s.required;
  }
  return out;
}
