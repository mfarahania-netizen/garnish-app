#!/usr/bin/env node
// tools/coverage/coverage-matrix.mjs
// =============================================================================
// GARNISH COVERAGE SYSTEM — writes docs/coverage/COVERAGE_MATRIX.md
// (the living Backend <-> Frontend <-> Design coverage matrix).
//
// GENERATED ARTIFACT — do NOT hand-edit. Regenerate with `pnpm coverage:matrix`.
// Columns:
//   Capability | Backend (model/endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status
// Design (GES ref) and States are not derivable from code (tracked via the GES /
// Figma Code Connect sync) — emitted as "—" placeholders for now.
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, REPO_ROOT } from './coverage-scan.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY = path.join(__dirname, 'coverage.registry.json');
const OUT_MD = path.join(REPO_ROOT, 'docs/coverage/COVERAGE_MATRIX.md');
const OUT_JSON = path.join(REPO_ROOT, 'docs/coverage/coverage.generated.json');

function statusBadge(status) {
  if (!status) return '❓ unregistered';
  if (status.startsWith('frontend:')) return '✅ mapped';
  if (status === 'must-render') return '🔴 must-render (debt)';
  if (status === 'admin') return '🛠 admin';
  if (status === 'internal') return '⚙️ internal';
  if (status.startsWith('deferred:')) return '🕓 deferred';
  return status;
}

// Frontend cell from a registry status.
function frontendCell(status) {
  if (!status) return '—';
  if (status.startsWith('frontend:')) return '`' + status.slice('frontend:'.length) + '`';
  if (status === 'must-render') return '_(none — debt)_';
  if (status === 'admin') return '_(admin dashboard)_';
  if (status === 'internal') return '_(none — internal)_';
  if (status.startsWith('deferred:')) return '_(none — ' + status.slice('deferred:'.length) + ')_';
  return status;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/\|/g, '\\|');
}

function main() {
  const gen = generate();
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(gen, null, 2) + '\n', 'utf8');
  const reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));

  const L = [];
  L.push('# Garnish Coverage Matrix');
  L.push('');
  L.push('> **GENERATED ARTIFACT — do not hand-edit.** Regenerate with `pnpm coverage:matrix`.');
  L.push('> Source of intent: `tools/coverage/coverage.registry.json` (the only hand-maintained coverage file).');
  L.push('> Source of truth: live code, parsed by `tools/coverage/coverage-scan.mjs`.');
  L.push('');
  L.push('`Design (GES ref)` and `States(L/E/Err)` are not derivable from code and are tracked');
  L.push('via the GES / Figma Code Connect sync — emitted as `—` until that link exists.');
  L.push('');
  const c = gen.counts;
  L.push('## Counts');
  L.push('');
  L.push(`- models: **${c.models}**, Recipe fields: **${c.recipeTotalFields}** (${c.recipeScalarFields} scalar + ${c.recipeRelations} relations)`);
  L.push(`- endpoints: **${c.endpoints}** across **${c.controllers}** controllers (${c.internalEndpoints} internal)`);
  L.push(`- frontend routes: **${c.routes}** (${c.protectedRoutes} protected), API call sites: **${c.frontendCallSites}**`);
  L.push(`- events: backend **${c.backendEvents}**, frontend **${c.frontendEvents}**`);
  L.push('');

  // ---- Endpoints, grouped by controller ----
  L.push('## Endpoints');
  L.push('');
  const byController = {};
  for (const e of gen.endpoints) (byController[e.controller] ||= []).push(e);
  for (const controller of Object.keys(byController).sort()) {
    L.push(`### ${controller}`);
    L.push('');
    L.push('| Capability | Backend (endpoint) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |');
    L.push('|---|---|---|---|---|---|');
    for (const e of byController[controller].sort((a, b) => a.path.localeCompare(b.path) || a.verb.localeCompare(b.verb))) {
      const status = e.isInternal ? 'internal' : reg.endpoints?.[e.id]?.status;
      const cap = esc(e.handler);
      const backend = '`' + esc(e.verb + ' ' + e.path) + '`' + (e.auth !== 'none' ? ` _(${esc(e.auth)})_` : '');
      const fe = e.isInternal ? '_(none — internal)_' : esc(frontendCell(status));
      L.push(`| ${cap} | ${backend} | ${fe} | — | — | ${statusBadge(e.isInternal ? 'internal' : status)} |`);
    }
    L.push('');
  }

  // ---- Recipe fields ----
  L.push('## Recipe fields (tracked entity)');
  L.push('');
  L.push('| Capability | Backend (model field) | Frontend (route/component) | Design (GES ref) | States(L/E/Err) | Status |');
  L.push('|---|---|---|---|---|---|');
  const recipe = gen.models.find((m) => m.name === 'Recipe');
  const renderedMap = new Map((gen.recipeRenderedFields?.fields || []).map((f) => [f.field, f.rendered]));
  const fieldType = new Map(recipe.fields.map((f) => [f.name, f.type + (f.optional ? '?' : '')]));
  // author is a tracked relation
  const tracked = (gen.recipeRenderedFields?.fields || []).map((f) => f.field);
  for (const field of tracked) {
    const key = 'Recipe.' + field;
    const status = reg.fields?.[key]?.status;
    const typ = fieldType.get(field) || 'relation';
    const rendered = renderedMap.get(field);
    const cap = esc(key) + (rendered ? '' : ' ⚠︎');
    const backend = '`' + esc('Recipe.' + field) + '`' + ` _(${esc(typ)})_`;
    L.push(`| ${cap} | ${backend} | ${esc(frontendCell(status))} | — | — | ${statusBadge(status)} |`);
  }
  L.push('');
  L.push('> ⚠︎ = not found by the (heuristic) recipe-detail render scan.');
  L.push('');

  // ---- Events ----
  L.push('## Events');
  L.push('');
  L.push(`- shared (defined both sides): **${gen.events.bothCount}**`);
  L.push(`- backend-only (orphan): ${gen.events.backendOnly.map((e) => '`' + e + '`').join(', ') || '_(none)_'}`);
  L.push(`- frontend-only (orphan): ${gen.events.frontendOnly.map((e) => '`' + e + '`').join(', ') || '_(none)_'}`);
  L.push('');

  fs.writeFileSync(OUT_MD, L.join('\n') + '\n', 'utf8');
  process.stderr.write(`coverage-matrix: wrote ${path.relative(REPO_ROOT, OUT_MD).split(path.sep).join('/')}\n`);
}

main();
