/**
 * AI Core v1 — shared contracts (E47-A1 skeleton).
 *
 * Defines the minimal types every AI Core piece shares. No autonomous agents, no multi-agent
 * orchestration, no vision, no medical advice. All AI calls route through AiOrchestratorService.
 */

/** Mandatory context for every AI call (Constitution E47). A call without one fails fast. */
export interface BehavioralContextSnapshot {
  userId: string;
  /** ISO-8601 build time. */
  generatedAt: string;
  schemaVersion: number;
  /** opaque, PII-free behavioral signals (hydrated from the behavior engine in a later phase). */
  signals?: Record<string, unknown>;
  /** UI locale if known (e.g. 'fa'). */
  locale?: string;
  /** known, already-stored, NON-sensitive preferences (e.g. diet/skill/budget). No health/allergy inference. */
  preferences?: Record<string, unknown>;
  /** active consent purposes (mirrors the canonical envelope consentPurpose set). */
  consents?: string[];
  /** true only when the user's nutrition data is source-locked (gates nutrition claims). */
  nutritionSourceLocked?: boolean;
  dataMaturity?: string;
}

/* ── Model provider (pluggable; stubbed for tests, real Gemini provider wired in A2) ── */
export interface ModelGenerateInput {
  prompt: string;
  system?: string;
  maxTokens?: number;
}
export interface ModelUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** E47-A10A: provenance of the token counts — 'provider' (real metadata) or 'estimated'. */
  source?: 'provider' | 'estimated';
}
export interface ModelGenerateResult {
  text: string;
  model: string;
  usage?: ModelUsage;
}
export interface ModelProvider {
  readonly name: string;
  generate(input: ModelGenerateInput): Promise<ModelGenerateResult>;
  /**
   * OPTIONAL tool-calling capability (function-calling) — the substrate of the agentic brain.
   * Given the running conversation + a tool catalog, the model returns EITHER a final `text` answer
   * OR `toolCalls` it wants executed (the loop runs them and calls back). Providers that don't support
   * tools simply omit this; the agentic loop only uses providers that implement it. The HARD safety gate
   * still wraps the loop OUTSIDE the model — tool-calling never decides safety.
   */
  generateWithTools?(input: ToolCallingInput): Promise<ToolCallingResult>;
}
/** DI token for the active model provider. */
export const AI_MODEL_PROVIDER = Symbol('AI_MODEL_PROVIDER');

/* ── Tool-calling (agentic brain substrate) ── */
/** One turn in a tool-calling conversation (OpenAI-compatible roles). */
export interface ChatTurn {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** assistant turn only — the tool calls the model requested on this turn. */
  toolCalls?: ToolCallRequest[];
  /** tool turn only — which assistant tool call this result answers. */
  toolCallId?: string;
}
/** A tool the model MAY call: name + human description + JSON-Schema parameters. */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
/** A tool call the model emitted; `arguments` is a raw JSON string (parse at the call site). */
export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: string;
}
export interface ToolCallingInput {
  messages: ChatTurn[];
  tools: ToolSpec[];
  maxTokens?: number;
}
export interface ToolCallingResult {
  /** final natural-language answer (empty when the model only asked for tools). */
  text: string;
  /** tools the model wants executed before it can answer (empty when it answered directly). */
  toolCalls: ToolCallRequest[];
  model: string;
  usage?: ModelUsage;
}

/* ── Tools (a small, fixed, read-only set in A1) ── */
export interface ToolContext {
  userId: string;
  snapshot: BehavioralContextSnapshot;
}
export interface AiTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  /** read-only handler — no irreversible actions. */
  handler(input: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
}

/* ── Guards ── */
export interface GuardResult {
  blocked: boolean;
  reasons: string[];
}

/* ── Orchestrator request/result ── */
export type AiCallStatus =
  | 'ok'
  | 'blocked_injection'
  | 'blocked_safety'
  | 'blocked_nutrition'
  | 'blocked_cost'
  | 'error';

export interface AiCallRequest {
  userId: string;
  /** The UNTRUSTED user input — the inbound guards (injection/safety) inspect THIS. */
  prompt: string;
  /** OPTIONAL grounded/wrapped prompt actually sent to the model (system instruction + safe-set + user turn).
   *  When present the model sees this while the guards still inspect `prompt`. This prevents the grounding
   *  system-instruction's own safety vocabulary ("no medical/diagnosis/nutrition claims") from tripping the
   *  inbound safety guard and self-blocking every live turn. Falls back to `prompt` when absent. */
  modelPrompt?: string;
  /** MANDATORY — the orchestrator fails fast if this is missing/invalid. */
  snapshot?: BehavioralContextSnapshot | null;
  surface?: string;
  conversationId?: string;
  estimatedTokens?: number;
  /** overrides snapshot.nutritionSourceLocked when provided. */
  nutritionSourceLocked?: boolean;
  /** Deterministic routing metadata for the AICallLog ledger; never derived by the model. */
  intent?: string | null;
  tier?: string | null;
  /** Cache observability. Defaults to false/null until a verified cache serves the turn. */
  cacheHit?: boolean | null;
  cacheTokens?: number | null;
}

export interface AiCallResult {
  status: AiCallStatus;
  text: string | null;
  model: string | null;
  blocked: boolean;
  guardHits: string[];
  toolCalls: string[];
  reasons: string[];
  /** id of the persisted AICallLog row (null if persistence failed). */
  aiCallLogId: string | null;
}

/** Thrown when an AI call is attempted without a valid BehavioralContextSnapshot. */
export class MissingBehavioralContextError extends Error {
  constructor(message = 'BehavioralContextSnapshot is required for every AI call') {
    super(message);
    this.name = 'MissingBehavioralContextError';
  }
}
