/**
 * Workflow engine — core types (spec: docs/audit/ADMIN_CONTROL_CENTER_SPEC.md §B6).
 *
 * A workflow is a DAG: `{ nodes: [{ id, type, params, next? }] }`. The runner walks it in topological order,
 * threading a context (each node reads prior node outputs, writes its own). Node types fall in two families:
 *  - NON-AGENTIC (deterministic): query · threshold · summarize(template) · alert — pure math + DB.
 *  - AGENTIC (LLM): the `summarize`/`ai` node carries an LLM seam (deterministic template now, model later) —
 *    the engine structurally supports agentic nodes; the live model plugs in at Stage 4 (Intelligence layer).
 */

export interface WfNode {
  id: string;
  type: string; // 'query' | 'threshold' | 'summarize' | 'alert' | (future: 'compare' | 'ai' | 'action')
  params?: Record<string, any>;
  next?: string[]; // successor node ids (edges); omit/empty = terminal node
}

export interface WfGraph {
  nodes: WfNode[];
}

/** Per-run context threaded through every node. `outputs[nodeId]` holds each node's produced value. */
export interface WfRunContext {
  outputs: Record<string, any>;
  workflow: { id: string; key: string; name: string; version: number; defaultSeverity: string };
  runId: string;
  log: (msg: string) => void;
}

/** A node handler returns its output, and may request the run STOP early (a gate whose condition isn't met). */
export interface NodeOutcome {
  output: any;
  stop?: boolean; // true → halt the run here (e.g. a threshold gate that wasn't breached → no alert)
  stopReason?: string;
}

export type NodeHandler = (params: Record<string, any>, ctx: WfRunContext) => Promise<NodeOutcome>;

/** Resolve a dotted path against the run outputs, e.g. "queryCost.economics.totalCostUsd". Null-safe. */
export function resolvePath(outputs: Record<string, any>, ref: string): unknown {
  if (!ref) return undefined;
  let cur: any = outputs;
  for (const seg of String(ref).split('.')) {
    if (cur == null) return undefined;
    cur = cur[seg];
  }
  return cur;
}

/** Interpolate `{{nodeId.path}}` placeholders in a template against the run outputs. Missing → '—'. */
export function interpolate(template: string, outputs: Record<string, any>): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, ref) => {
    const v = resolvePath(outputs, ref);
    if (v == null) return '—';
    if (typeof v === 'number') return String(Math.round(v * 1000) / 1000);
    return String(v);
  });
}
