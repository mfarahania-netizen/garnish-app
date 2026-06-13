import { ModelProvider, ModelGenerateInput, ModelGenerateResult } from '../ai-core.types';

/**
 * Deterministic stub model provider (E47).
 *
 * The SAFE DEFAULT. Performs NO network call, so the module and tests never require a live LLM.
 * Selected by the provider factory whenever live AI is disabled or unconfigured.
 */
export class StubModelProvider implements ModelProvider {
  readonly name = 'stub-model';

  async generate(input: ModelGenerateInput): Promise<ModelGenerateResult> {
    const totalTokens = Math.max(1, Math.ceil((input.prompt?.length ?? 0) / 4));
    return {
      text: `[stub-model] acknowledged ${input.prompt?.length ?? 0} chars; no live model.`,
      model: 'stub-model-v0',
      usage: { promptTokens: totalTokens, completionTokens: 0, totalTokens },
    };
  }
}
