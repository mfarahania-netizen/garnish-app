import { Injectable, Logger } from '@nestjs/common';
import { ModelProvider, ChatTurn, ToolSpec, ToolContext } from '../ai-core.types';

/** A tool the agentic loop can call: its model-facing spec + a READ-ONLY executor. */
export interface AgenticTool {
  spec: ToolSpec;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
}

export interface AgenticLoopInput {
  systemPrompt: string;
  userPrompt: string;
  tools: AgenticTool[];
  ctx: ToolContext;
  /** safety cap on tool round-trips (default 5). */
  maxIterations?: number;
}

export interface AgenticLoopResult {
  /** final natural-language answer. */
  text: string;
  /** trace of the tool calls actually executed (name + raw args) — for observability/eval. */
  toolCalls: { name: string; arguments: string }[];
  iterations: number;
  model: string | null;
  /** true when the loop hit the iteration cap and the answer came from the forced final turn. */
  truncated: boolean;
}

/** Tool results fed back to the model are capped so a fat tool payload can't blow up the context/cost. */
const MAX_TOOL_RESULT_CHARS = 4000;

/**
 * Agentic orchestration loop (brain piece 2).
 *
 * The MODEL decides which tools to call; this service executes them (read-only), feeds the results back,
 * and repeats until the model produces a final answer or we hit the iteration cap. This replaces the
 * brittle keyword/regex intent routing — the model reasons over the real corpus via tools instead.
 *
 * SAFETY: this service NEVER decides safety. The HARD allergy/pork gate is applied by the CALLER, OUTSIDE
 * this loop (pre-screen the user turn + post-screen the final answer, fail-closed). The tools wired here are
 * read-only; any future write-action needs its own confirmation/gate before being added to the catalog.
 */
@Injectable()
export class AgenticLoopService {
  private readonly logger = new Logger('AgenticLoopService');

  async run(provider: ModelProvider, input: AgenticLoopInput): Promise<AgenticLoopResult> {
    if (!provider.generateWithTools) {
      throw new Error(`model provider ${provider.name} does not support tool-calling`);
    }
    const max = Math.max(1, input.maxIterations ?? 5);
    const toolByName = new Map(input.tools.map((t) => [t.spec.name, t]));
    const specs: ToolSpec[] = input.tools.map((t) => t.spec);
    const messages: ChatTurn[] = [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: input.userPrompt },
    ];
    const trace: { name: string; arguments: string }[] = [];
    let model: string | null = null;

    for (let i = 0; i < max; i++) {
      const res = await provider.generateWithTools({ messages, tools: specs });
      model = res.model;
      if (res.toolCalls.length === 0) {
        return { text: res.text, toolCalls: trace, iterations: i + 1, model, truncated: false };
      }
      // record the assistant's tool request, then execute each call and feed the results back
      messages.push({ role: 'assistant', content: res.text, toolCalls: res.toolCalls });
      for (const call of res.toolCalls) {
        trace.push({ name: call.name, arguments: call.arguments });
        messages.push({ role: 'tool', toolCallId: call.id, content: await this.execute(toolByName, call, input.ctx) });
      }
    }

    // Hit the cap: force ONE final answer with NO tools, so the user always gets a reply.
    const final = await provider.generateWithTools({ messages, tools: [] });
    return { text: final.text, toolCalls: trace, iterations: max, model: final.model ?? model, truncated: true };
  }

  /** Execute one tool call, returning a JSON string for the model (errors are returned, never thrown). */
  private async execute(toolByName: Map<string, AgenticTool>, call: { name: string; arguments: string }, ctx: ToolContext): Promise<string> {
    const tool = toolByName.get(call.name);
    if (!tool) return JSON.stringify({ error: `unknown tool: ${call.name}` });
    try {
      const args = call.arguments ? (JSON.parse(call.arguments) as Record<string, unknown>) : {};
      const out = await tool.execute(args, ctx);
      return JSON.stringify(out ?? null).slice(0, MAX_TOOL_RESULT_CHARS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`tool ${call.name} failed: ${msg}`);
      return JSON.stringify({ error: msg.slice(0, 200) });
    }
  }
}
