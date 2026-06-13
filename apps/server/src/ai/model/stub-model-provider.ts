import { Injectable } from '@nestjs/common';
import {
  ModelProvider,
  ModelGenerateInput,
  ModelGenerateResult,
} from '../ai-core.types';

/**
 * Deterministic stub model provider (E47-A1).
 *
 * The default AI_MODEL_PROVIDER. It performs NO network call, so the module and its tests never
 * require a live LLM. A real Gemini-backed provider (`@google/generative-ai`) implements the same
 * `ModelProvider` interface and is swapped in via DI in E47-A2.
 */
@Injectable()
export class StubModelProvider implements ModelProvider {
  readonly name = 'stub-model';

  async generate(input: ModelGenerateInput): Promise<ModelGenerateResult> {
    const totalTokens = Math.max(1, Math.ceil((input.prompt?.length ?? 0) / 4));
    return {
      text: `[stub-model] acknowledged ${input.prompt?.length ?? 0} chars; no live model in A1.`,
      model: 'stub-model-v0',
      usage: { promptTokens: totalTokens, completionTokens: 0, totalTokens },
    };
  }
}
