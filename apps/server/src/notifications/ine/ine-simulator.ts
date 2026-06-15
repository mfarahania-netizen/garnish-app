/**
 * INE dry-run simulator (GARNISH-NOTIF-L4-10) — pure, deterministic. Runs the engine over dev personas
 * and reports would-send / suppressed / deferred by trigger WITH reasons. ZERO real sends (no dispatch).
 */
import { decide, IneDecision, UserNotificationState } from './ine-pipeline';
import { getTrigger } from './notification-triggers';

export interface SimPersona {
  name: string;
  state: UserNotificationState;
  candidates: { triggerKey: string; payload?: Record<string, any> }[];
}

export interface SimulationReport {
  personas: number;
  totalDecisions: number;
  wouldSend: number;
  suppressed: number;
  deferred: number;
  realSends: 0; // INVARIANT: a simulation never sends
  byTrigger: Record<string, { send: number; suppress: number; defer: number }>;
  byReason: Record<string, number>;
  decisions: (IneDecision & { persona: string })[];
}

export function runIneSimulation(personas: SimPersona[]): SimulationReport {
  const decisions: (IneDecision & { persona: string })[] = [];
  const byTrigger: SimulationReport['byTrigger'] = {};
  const byReason: Record<string, number> = {};

  for (const p of personas) {
    for (const c of p.candidates) {
      const trigger = getTrigger(c.triggerKey);
      if (!trigger) continue;
      const d = decide(trigger, p.state, c.payload);
      d.userId = p.name;
      decisions.push({ ...d, persona: p.name });
      const bt = (byTrigger[c.triggerKey] ??= { send: 0, suppress: 0, defer: 0 });
      bt[d.decision] += 1;
      for (const r of d.reasons) {
        const tag = r.split('(')[0].trim().slice(0, 40);
        byReason[tag] = (byReason[tag] ?? 0) + 1;
      }
    }
  }

  return {
    personas: personas.length,
    totalDecisions: decisions.length,
    wouldSend: decisions.filter((d) => d.decision === 'send').length,
    suppressed: decisions.filter((d) => d.decision === 'suppress').length,
    deferred: decisions.filter((d) => d.decision === 'defer').length,
    realSends: 0,
    byTrigger,
    byReason,
    decisions,
  };
}
