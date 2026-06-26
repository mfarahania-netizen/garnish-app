import {
  ModelProvider,
  ModelGenerateInput,
  ModelGenerateResult,
  ModelUsage,
  ToolCallingInput,
  ToolCallingResult,
  ChatTurn,
} from '../ai-core.types';

/** Minimal shape of the OpenRouter (OpenAI-compatible) chat-completions response we read. */
interface OpenRouterResponse {
  choices?: { message?: { content?: string | null; tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[] } }[];
  usage?: Record<string, number>;
  error?: { code?: number };
}

/**
 * Error carrying the HTTP status so the fallback chain can treat 429 (rate-limit) specially
 * (cool the model down) versus a one-off failure (try again sooner).
 */
export class ModelProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly rateLimited = false,
  ) {
    super(message);
    this.name = 'ModelProviderError';
  }
}

/**
 * OpenRouter model provider — OpenAI-compatible chat-completions, behind the ModelProvider interface.
 *
 * Lets the app use ANY OpenRouter-hosted model (free or paid) as a drop-in brain: one key, many models.
 * This is the unit the multi-model fallback chain stacks (see FallbackModelProvider). The key is read
 * from env (passed by the factory), never printed, never committed; errors are sanitized (key redacted)
 * before being thrown. A 429 — common on the shared free tier — is tagged `rateLimited` so the chain
 * cools this model and switches to the next instead of hammering a throttled endpoint.
 */
export class OpenRouterModelProvider implements ModelProvider {
  readonly name: string;
  private readonly endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(
    private readonly apiKey: string,
    private readonly modelName: string,
    private readonly timeoutMs = 20000,
  ) {
    this.name = `openrouter:${modelName}`;
  }

  async generate(input: ModelGenerateInput): Promise<ModelGenerateResult> {
    const messages: { role: string; content: string }[] = [];
    if (input.system) messages.push({ role: 'system', content: input.system });
    messages.push({ role: 'user', content: input.prompt });
    const data = await this.post({ model: this.modelName, messages, ...(input.maxTokens ? { max_tokens: input.maxTokens } : {}) });
    const text = data?.choices?.[0]?.message?.content ?? '';
    if (!text) throw new ModelProviderError(this.sanitize('empty completion'));
    const promptLen = (input.system ? input.system.length : 0) + input.prompt.length;
    return { text, model: this.modelName, usage: this.usageFrom(data?.usage, promptLen, text.length) };
  }

  /**
   * Tool-calling round (agentic brain). Sends the running conversation + tool catalog; returns the
   * model's final text OR the tool calls it wants run. The orchestration loop (outside this provider)
   * executes the tools, appends the results, and calls back — the HARD safety gate wraps that loop.
   */
  async generateWithTools(input: ToolCallingInput): Promise<ToolCallingResult> {
    const messages = input.messages.map((m) => this.toOpenAiMessage(m));
    const tools = input.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
    const data = await this.post({ model: this.modelName, messages, tools, tool_choice: 'auto', ...(input.maxTokens ? { max_tokens: input.maxTokens } : {}) });
    const msg = data?.choices?.[0]?.message ?? {};
    const toolCalls = Array.isArray(msg.tool_calls)
      ? msg.tool_calls.map((tc) => ({ id: tc.id ?? '', name: tc.function?.name ?? '', arguments: tc.function?.arguments ?? '{}' })).filter((c) => c.name)
      : [];
    const text = msg.content ?? '';
    if (!text && toolCalls.length === 0) throw new ModelProviderError(this.sanitize('empty completion (no text, no tool calls)'));
    const promptLen = input.messages.reduce((s, m) => s + (m.content?.length ?? 0), 0);
    return { text, toolCalls, model: this.modelName, usage: this.usageFrom(data?.usage, promptLen, text.length) };
  }

  /** POST a chat-completions body; sanitize + classify errors (429 → rateLimited) for the fallback chain. */
  private async post(body: Record<string, unknown>): Promise<OpenRouterResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://garnish.app',
          'X-Title': 'Garnish',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const msg = err instanceof Error && err.name === 'AbortError' ? `timeout after ${this.timeoutMs}ms` : `network: ${err instanceof Error ? err.message : String(err)}`;
      throw new ModelProviderError(this.sanitize(msg));
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      let detail = '';
      try {
        detail = JSON.stringify((await res.json())?.error ?? '').slice(0, 200);
      } catch {
        /* body not JSON — status alone is enough to route the fallback */
      }
      throw new ModelProviderError(this.sanitize(`http ${res.status}: ${detail}`), res.status, res.status === 429);
    }

    let data: OpenRouterResponse;
    try {
      data = (await res.json()) as OpenRouterResponse;
    } catch (err) {
      throw new ModelProviderError(this.sanitize(`bad json: ${err instanceof Error ? err.message : String(err)}`));
    }
    // OpenRouter can return HTTP 200 with an embedded error (e.g. upstream temporarily rate-limited).
    if (data?.error) {
      const code = Number(data.error.code) || undefined;
      throw new ModelProviderError(this.sanitize(`api: ${JSON.stringify(data.error).slice(0, 200)}`), code, code === 429);
    }
    return data;
  }

  /** Map a provider-agnostic ChatTurn to an OpenAI-compatible message (incl. tool calls / tool results). */
  private toOpenAiMessage(m: ChatTurn): Record<string, unknown> {
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } })),
      };
    }
    if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
    return { role: m.role, content: m.content };
  }

  /** Build ModelUsage from the response, tagging provenance ('provider' metadata vs local 'estimated'). */
  private usageFrom(u: Record<string, number> | undefined, promptLen: number, textLen: number): ModelUsage {
    const hasProviderUsage = !!u && (u.prompt_tokens != null || u.total_tokens != null);
    return hasProviderUsage
      ? { promptTokens: u!.prompt_tokens, completionTokens: u!.completion_tokens, totalTokens: u!.total_tokens, source: 'provider' }
      : {
          promptTokens: Math.max(1, Math.ceil(promptLen / 4)),
          completionTokens: Math.max(0, Math.ceil(textLen / 4)),
          totalTokens: Math.max(1, Math.ceil((promptLen + textLen) / 4)),
          source: 'estimated',
        };
  }

  /** Strip the API key and any key-like/bearer tokens from an error before it leaves the provider. */
  private sanitize(msg: string): string {
    let m = msg;
    if (this.apiKey) m = m.split(this.apiKey).join('[redacted-key]');
    m = m.replace(/sk-or-[A-Za-z0-9_-]{8,}/g, '[redacted-key]').replace(/Bearer\s+[^\s'"]+/gi, 'Bearer [redacted]');
    return `openrouter_provider_error: ${m.slice(0, 300)}`;
  }
}
