import { GoogleGenerativeAI } from '@google/generative-ai';
import { ModelProvider, ModelGenerateInput, ModelGenerateResult } from '../ai-core.types';

/**
 * Gemini model provider (E47-A5) — behind the ModelProvider interface.
 *
 * The ONLY place that talks to Gemini. The orchestrator calls the interface, never this directly.
 * The API key is read from env (passed in by the factory), never printed, never stored beyond the
 * SDK client, never committed. Errors are sanitized (key/url redacted) before being thrown, so no
 * secret can leak into logs/responses.
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
      return {
        text,
        model: this.modelName,
        usage: {
          promptTokens: usage?.promptTokenCount,
          completionTokens: usage?.candidatesTokenCount,
          totalTokens: usage?.totalTokenCount,
        },
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
