#!/usr/bin/env node
// tools/coverage/coverage-check.mjs
// =============================================================================
// GARNISH COVERAGE SYSTEM — Layer 3: the ENFORCER (diff gate).
//
// Runs the generator (refreshing coverage.generated.json), diffs the live code
// against the hand-maintained coverage.registry.json, and EXITS 1 on a blocking
// violation. This is what makes it impossible to silently drop a backend
// capability from the frontend/design — today or two years from now.
//
// Gate policy (founder decision):
//   UNREGISTERED   -> BLOCK  (a Recipe field or non-internal endpoint exists in
//                             code but is absent from the registry)
//   UNMAPPED       -> BLOCK  (registry says frontend:<ref> but the frontend
//                             neither routes to / calls it (endpoint) nor renders
//                             it (Recipe detail field))
//   ORPHAN_ENDPOINT-> warn   (non-internal endpoint the frontend never calls)
//   ORPHAN_EVENT   -> warn   (event defined on one side only)
//   STALE_REGISTRY -> warn   (registry references a capability no longer in code)
//
// Usage:
//   node tools/coverage/coverage-check.mjs            # enforce; exit 1 on block
//   node tools/coverage/coverage-check.mjs --report   # full report; never fails
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, REPO_ROOT } from './coverage-scan.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_JSON = path.join(REPO_ROOT, 'docs/coverage/coverage.generated.json');
const REGISTRY = path.join(__dirname, 'coverage.registry.json');

const C = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m',
};
const useColor = process.stdout.isTTY;
const paint = (c, s) => (useColor ? c + s + C.reset : s);

function loadRegistry() {
  if (!fs.existsSync(REGISTRY)) {
    throw new Error('coverage.registry.json not found at ' + REGISTRY);
  }
  return JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
}

const isFrontend = (s) => typeof s === 'string' && s.startsWith('frontend:');
const isDetailRef = (s) => typeof s === 'string' && s.startsWith('frontend:recipe-detail');

function analyze(gen, reg) {
  const trackedEntities = new Set(reg.policy?.trackedFieldEntities || ['Recipe']);

  // ---- index live code ----
  const renderedMap = new Map(); // Recipe field -> rendered bool
  if (gen.recipeRenderedFields) {
    for (const f of gen.recipeRenderedFields.fields) renderedMap.set(f.field, f.rendered);
  }
  const nonInternalEndpoints = gen.endpoints.filter((e) => !e.isInternal);
  const endpointById = new Map(gen.endpoints.map((e) => [e.id, e]));

  const v = {
    unregistered: [], // BLOCK
    unmapped: [], // BLOCK
    orphanEndpoints: [], // warn
    orphanEvents: [], // warn
    staleRegistry: [], // warn
    mustRender: [], // debt (non-blocking)
    deferred: [], // documented (non-blocking)
  };

  // ---- UNREGISTERED: tracked-entity fields ----
  if (trackedEntities.has('Recipe') && gen.recipeRenderedFields) {
    for (const f of gen.recipeRenderedFields.fields) {
      const key = 'Recipe.' + f.field;
      if (!reg.fields || !reg.fields[key]) {
        v.unregistered.push({ kind: 'field', key, detail: 'Recipe field present in schema but absent from registry.fields' });
      }
    }
  }
  // ---- UNREGISTERED: non-internal endpoints ----
  for (const e of nonInternalEndpoints) {
    if (!reg.endpoints || !reg.endpoints[e.id]) {
      v.unregistered.push({ kind: 'endpoint', key: e.id, detail: `${e.controller} — endpoint present in code but absent from registry.endpoints` });
    }
  }

  // ---- field-level UNMAPPED + debt classification ----
  for (const [key, entry] of Object.entries(reg.fields || {})) {
    const field = key.replace(/^Recipe\./, '');
    const inCode = renderedMap.has(field);
    if (!inCode) {
      v.staleRegistry.push({ kind: 'field', key, detail: 'registry field not found in live Recipe schema' });
      continue;
    }
    const rendered = renderedMap.get(field);
    const status = entry.status;
    if (isDetailRef(status)) {
      if (!rendered) {
        v.unmapped.push({ kind: 'field', key, status, detail: `registry maps ${key} to ${status} but the detail-page render scan does NOT find it` });
      }
    } else if (status === 'must-render') {
      v.mustRender.push({ key, status, rendered, reason: entry.reason });
    } else if (typeof status === 'string' && status.startsWith('deferred:')) {
      v.deferred.push({ kind: 'field', key, status, reason: entry.reason });
    }
    // frontend:* non-detail refs, internal, admin -> no block (documented intent)
  }

  // ---- endpoint-level UNMAPPED + debt classification ----
  for (const [key, entry] of Object.entries(reg.endpoints || {})) {
    const e = endpointById.get(key);
    if (!e) {
      v.staleRegistry.push({ kind: 'endpoint', key, detail: 'registry endpoint not found in live code' });
      continue;
    }
    const status = entry.status;
    if (isFrontend(status)) {
      if (!e.calledByFrontend) {
        v.unmapped.push({ kind: 'endpoint', key, status, detail: `registry maps ${key} to ${status} but no frontend apiClient call matches it` });
      }
    } else if (typeof status === 'string' && status.startsWith('deferred:')) {
      v.deferred.push({ kind: 'endpoint', key, status, reason: entry.reason });
    }
  }

  // ---- ORPHAN_ENDPOINT (warn): every non-internal endpoint the frontend never calls ----
  for (const e of nonInternalEndpoints) {
    if (!e.calledByFrontend) {
      const status = reg.endpoints?.[e.id]?.status || '(unregistered)';
      v.orphanEndpoints.push({ key: e.id, controller: e.controller, status });
    }
  }

  // ---- ORPHAN_EVENT (warn): defined one side only ----
  for (const ev of gen.events.backendOnly) v.orphanEvents.push({ event: ev, side: 'backend-only (missing in frontend taxonomy)' });
  for (const ev of gen.events.frontendOnly) v.orphanEvents.push({ event: ev, side: 'frontend-only (missing in backend taxonomy)' });

  // ---- tally ----
  const tally = { mapped: 0, internal: 0, admin: 0, deferred: 0, mustRender: 0 };
  const countStatus = (s) => {
    if (isFrontend(s)) tally.mapped++;
    else if (s === 'internal') tally.internal++;
    else if (s === 'admin') tally.admin++;
    else if (typeof s === 'string' && s.startsWith('deferred:')) tally.deferred++;
    else if (s === 'must-render') tally.mustRender++;
  };
  for (const e of Object.values(reg.fields || {})) countStatus(e.status);
  for (const e of Object.values(reg.endpoints || {})) countStatus(e.status);
  // internal-prefix endpoints are auto-internal
  tally.internal += gen.endpoints.filter((e) => e.isInternal).length;

  return { v, tally };
}

function printSection(title, color, lines) {
  if (!lines.length) return;
  process.stdout.write('\n' + paint(color + C.bold, title) + ` (${lines.length})\n`);
  for (const l of lines) process.stdout.write('  ' + l + '\n');
}

function main() {
  const args = process.argv.slice(2);
  const reportMode = args.includes('--report');

  const gen = generate();
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(gen, null, 2) + '\n', 'utf8');

  const reg = loadRegistry();
  const { v, tally } = analyze(gen, reg);

  const blockCount = v.unregistered.length + v.unmapped.length;

  process.stdout.write(paint(C.bold, '\n=== GARNISH COVERAGE GATE ===') + '\n');
  process.stdout.write(
    paint(C.dim,
      `scanned: models=${gen.counts.models} recipeFields=${gen.counts.recipeTotalFields} ` +
      `endpoints=${gen.counts.endpoints}(internal ${gen.counts.internalEndpoints}) routes=${gen.counts.routes} ` +
      `events=B${gen.counts.backendEvents}/F${gen.counts.frontendEvents}`) + '\n');
  process.stdout.write(
    `coverage: mapped=${tally.mapped} internal=${tally.internal} admin=${tally.admin} ` +
    `deferred=${tally.deferred} must-render=${tally.mustRender} | ` +
    `UNMAPPED=${v.unmapped.length} UNREGISTERED=${v.unregistered.length} ` +
    `orphanEndpoints=${v.orphanEndpoints.length} orphanEvents=${v.orphanEvents.length}\n`);

  // Blocking
  printSection('BLOCK · UNREGISTERED', C.red, v.unregistered.map((x) => `${x.key} — ${x.detail}`));
  printSection('BLOCK · UNMAPPED', C.red, v.unmapped.map((x) => `${x.key} [${x.status}] — ${x.detail}`));

  // Warnings + debt
  printSection('warn · ORPHAN_ENDPOINT (no frontend caller)', C.yellow,
    v.orphanEndpoints.map((x) => `${x.key}  ${paint(C.dim, '[' + x.status + ']')}  ${x.controller}`));
  printSection('warn · ORPHAN_EVENT', C.yellow, v.orphanEvents.map((x) => `${x.event} — ${x.side}`));
  printSection('warn · STALE_REGISTRY', C.yellow, v.staleRegistry.map((x) => `${x.key} — ${x.detail}`));
  printSection('debt · MUST-RENDER (stored, intended for frontend, NOT yet surfaced)', C.cyan,
    v.mustRender.map((x) => `${x.key} — ${x.reason}`));

  if (reportMode) {
    printSection('deferred (intentionally postponed)', C.dim,
      v.deferred.map((x) => `${x.key || x.kind} [${x.status}] — ${x.reason}`));
  }

  process.stdout.write('\n');
  if (blockCount > 0 && !reportMode) {
    process.stdout.write(paint(C.red + C.bold, `COVERAGE GATE FAILED — ${blockCount} blocking violation(s).`) + '\n');
    process.stdout.write(paint(C.dim, 'Fix: register the new capability in tools/coverage/coverage.registry.json (UNREGISTERED) ' +
      'or surface/route/call it (UNMAPPED). Do NOT edit coverage.generated.json.') + '\n\n');
    process.exit(1);
  }
  process.stdout.write(paint(C.green + C.bold, reportMode ? 'COVERAGE REPORT (no enforcement).' : 'COVERAGE GATE PASSED.') +
    (v.orphanEndpoints.length + v.orphanEvents.length + v.mustRender.length > 0 ? paint(C.dim, ' (warnings/debt above are non-blocking)') : '') + '\n\n');
  process.exit(0);
}

main();
