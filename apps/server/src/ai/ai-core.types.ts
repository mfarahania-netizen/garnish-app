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
  /** opaque, PII-free behavioral signals (hydrated from the behavior engine in E47-A2). */
  signals?: Record<string, unknown>;
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
}
export interface ModelGenerateResult {
  text: string;
  model: string;
  usage?: ModelUsage;
}
export interface ModelProvider {
  readonly name: string;
  generate(input: ModelGenerateInput): Promise<ModelGenerateResult>;
}
/** DI token for the active model provider. */
export const AI_MODEL_PROVIDER = Symbol('AI_MODEL_PROVIDER');

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
  prompt: string;
  /** MANDATORY — the orchestrator fails fast if this is missing/invalid. */
  snapshot?: BehavioralContextSnapshot | null;
  surface?: string;
  estimatedTokens?: number;
  /** overrides snapshot.nutritionSourceLocked when provided. */
  nutritionSourceLocked?: boolean;
}

export interface AiCallResult {
  status: AiCallStatus;
  text: string | null;
  model: string | null;
  blocked: boolean;
  guardHits: string[];
  toolCalls: string[];
  reasons: string[];
}

/** Shape recorded by AiCallLogService (persistence to a Prisma model deferred — see report). */
export interface AICallRecord {
  userId: string;
  model: string | null;
  status: AiCallStatus;
  latencyMs: number;
  estimatedTokens: number | null;
  estimatedCostUsd: number | null;
  guardHits: string[];
  toolCalls: string[];
  surface?: string;
  createdAt: string;
}

/** Thrown when an AI call is attempted without a valid BehavioralContextSnapshot. */
export class MissingBehavioralContextError extends Error {
  constructor(message = 'BehavioralContextSnapshot is required for every AI call') {
    super(message);
    this.name = 'MissingBehavioralContextError';
  }
}
