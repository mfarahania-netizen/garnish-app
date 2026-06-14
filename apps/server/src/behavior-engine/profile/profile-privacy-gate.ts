/**
 * Profile privacy gate (E43-A4).
 *
 * Graph-level privacy + safety enforcement:
 *  - highest privacy class wins; P2 is NEVER downgraded to P1.
 *  - consent purposes used are derived from real evidence (never fabricated); b2b_aggregate is rejected.
 *  - strict mode blocks a graph built on incompatible/empty consent; shadow/offline allows a weak graph.
 *  - a graph-wide scanner rejects ANY forbidden medical/protected term or creepy phrasing in graph text
 *    (defense against "protected-inference laundering").
 *
 * Pure + deterministic.
 */

import { SignalObservation } from '../signals/signal-types';
import { FORBIDDEN_INFERENCE_TERMS } from '../signals/signal-registry';
import { FORBIDDEN_EXPLANATION_PATTERNS } from '../signals/signal-explainability';
import { GraphPrivacyClass } from './user-food-identity-graph.types';

export interface GraphPrivacy {
  highestPrivacyClass: GraphPrivacyClass;
  consentPurposesUsed: string[];
  containsSensitiveSystemBoundary: boolean;
}

export function computeGraphPrivacy(obs: SignalObservation[]): GraphPrivacy {
  const anyP2 = obs.some((o) => o.privacyClass === 'P2-sensitive');
  const consentPurposesUsed = [...new Set(obs.map((o) => o.consentPurpose))].sort();
  const containsSensitiveSystemBoundary = obs.some((o) => o.signalKey === 'ai.safety_boundary_trigger');
  return {
    highestPrivacyClass: anyP2 ? 'P2-sensitive' : 'P1-pseudonymous',
    consentPurposesUsed,
    containsSensitiveSystemBoundary,
  };
}

export interface ConsentDecision {
  allowed: boolean;
  reason: string;
}

/**
 * Decide whether a graph may be built from these observations.
 * strict: reject on b2b_aggregate consent or zero usable evidence. shadow/offline: allow (weak graph
 * with limitations) as long as no b2b_aggregate is present. Consent is never fabricated.
 */
export function evaluateGraphConsent(obs: SignalObservation[], mode: 'offline_eval' | 'shadow' | 'strict'): ConsentDecision {
  if (obs.some((o) => (o.consentPurpose as string) === 'b2b_aggregate')) {
    return { allowed: false, reason: 'b2b_aggregate consent is not permitted at graph level in v1' };
  }
  if (mode === 'strict' && obs.length === 0) {
    return { allowed: false, reason: 'strict mode requires usable consented evidence; none present' };
  }
  return { allowed: true, reason: obs.length === 0 ? 'no evidence — empty graph (shadow/offline)' : 'consent compatible' };
}

/** Never downgrade: if the existing class is P2, it stays P2 regardless of the candidate. */
export function reconcilePrivacyClass(existing: GraphPrivacyClass, candidate: GraphPrivacyClass): GraphPrivacyClass {
  return existing === 'P2-sensitive' || candidate === 'P2-sensitive' ? 'P2-sensitive' : 'P1-pseudonymous';
}

export interface ForbiddenScan {
  ok: boolean;
  violations: { path: string; term: string }[];
}

/**
 * Deep-scan every STRING value in the graph (or any object) for forbidden medical/protected terms and
 * creepy phrasing. Catches laundering of a forbidden inference into any free-text field. Never throws.
 */
export function scanGraphForForbidden(graph: unknown): ForbiddenScan {
  const violations: { path: string; term: string }[] = [];
  const seen = new WeakSet<object>();
  const walk = (node: unknown, path: string, depth: number): void => {
    if (node == null || depth > 16) return;
    if (typeof node === 'string') {
      const lower = node.toLowerCase();
      for (const term of FORBIDDEN_INFERENCE_TERMS) if (lower.includes(term)) violations.push({ path, term });
      for (const re of FORBIDDEN_EXPLANATION_PATTERNS) if (re.test(node)) violations.push({ path, term: `pattern:${re.source.slice(0, 24)}` });
      return;
    }
    if (typeof node !== 'object') return;
    if (seen.has(node as object)) return;
    seen.add(node as object);
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`, depth + 1));
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) walk(v, path ? `${path}.${k}` : k, depth + 1);
  };
  walk(graph, '', 0);
  return { ok: violations.length === 0, violations };
}
