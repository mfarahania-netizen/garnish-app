#!/usr/bin/env node
// tools/coverage/coverage-scan.mjs
// =============================================================================
// GARNISH COVERAGE SYSTEM — Layer 1: the generator (reads LIVE code).
//
// Dev-only Node script. Adds NO runtime dependency: it reuses the `typescript`
// compiler already installed for apps/server (resolved from apps/server's
// node_modules) for robust AST parsing of NestJS controllers + React routes,
// and plain regex for the Prisma schema, API call sites, events, and the
// Recipe render heuristic.
//
// Deterministic: same code in -> same JSON out (stable sort, no timestamps,
// no network). Output is OVERWRITTEN each run at docs/coverage/coverage.generated.json.
//
// Usage:
//   node tools/coverage/coverage-scan.mjs            # writes JSON (default)
//   node tools/coverage/coverage-scan.mjs --json     # writes JSON
//   node tools/coverage/coverage-scan.mjs --md        # also print a markdown view
//
// DO NOT hand-edit coverage.generated.json — it is a generated artifact.
// The only hand-maintained file is coverage.registry.json (Layer 2).
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ---- paths -----------------------------------------------------------------
const SCHEMA_PRISMA = path.join(REPO_ROOT, 'apps/server/prisma/schema.prisma');
const SERVER_SRC = path.join(REPO_ROOT, 'apps/server/src');
const WEB_SRC = path.join(REPO_ROOT, 'apps/web/src');
const APP_JSX = path.join(WEB_SRC, 'App.jsx');
const API_CLIENT = path.join(WEB_SRC, 'lib/apiClient.js');
const RECIPE_DETAIL_DIR = path.join(WEB_SRC, 'app/recipe/[id]');
const EVENT_TAX_BACKEND = path.join(SERVER_SRC, 'analytics/event-taxonomy.ts');
const EVENT_TAX_FRONTEND = path.join(WEB_SRC, 'lib/eventTaxonomy.js');
const OUT_JSON = path.join(REPO_ROOT, 'docs/coverage/coverage.generated.json');
const OUT_MD = path.join(REPO_ROOT, 'docs/coverage/coverage.generated.md');

const HTTP_VERBS = ['Get', 'Post', 'Put', 'Patch', 'Delete'];
const ROUTE_WRAPPERS = new Set(['MainLayout', 'ProtectedRoute', 'AdminRoute', 'PageWrapper', 'Suspense', 'AnimatePresence', 'Routes', 'Route']);

// ---- typescript loader (no new dependency; reuse apps/server's copy) --------
function loadTypeScript() {
  const candidates = [
    path.join(REPO_ROOT, 'apps/server/package.json'),
    path.join(REPO_ROOT, 'package.json'),
  ];
  for (const anchor of candidates) {
    try {
      const req = createRequire(anchor);
      return req('typescript');
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'Could not resolve the `typescript` compiler. Run `pnpm install --frozen-lockfile` first ' +
      '(typescript 5.7.3 is an apps/server devDependency).',
  );
}

// ---- small fs helpers ------------------------------------------------------
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '.next', 'build', '.turbo']);

function walk(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      out.push(...walk(full, exts));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

function rel(p) {
  return path.relative(REPO_ROOT, p).split(path.sep).join('/');
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

// =============================================================================
// 1) PRISMA SCHEMA — models + scalar/enum fields; relations kept separate.
// =============================================================================
function parsePrisma(text) {
  // First pass: collect model + enum names so we can classify field types.
  const modelNames = new Set();
  const enumNames = new Set();
  for (const m of text.matchAll(/^\s*model\s+(\w+)\s*\{/gm)) modelNames.add(m[1]);
  for (const m of text.matchAll(/^\s*enum\s+(\w+)\s*\{/gm)) enumNames.add(m[1]);

  const SCALARS = new Set([
    'String', 'Boolean', 'Int', 'BigInt', 'Float', 'Decimal',
    'DateTime', 'Json', 'Bytes',
  ]);

  const models = [];
  const lines = text.split(/\r?\n/);
  let current = null;
  for (const raw of lines) {
    const line = raw.replace(/\/\/.*$/, '').trim(); // strip line comments
    if (!line) continue;

    const modelStart = raw.match(/^\s*model\s+(\w+)\s*\{/);
    if (modelStart) {
      current = { name: modelStart[1], dbName: null, fields: [], relations: [] };
      continue;
    }
    if (!current) continue;

    if (line === '}') {
      models.push(current);
      current = null;
      continue;
    }

    // block-level attribute, e.g. @@map("recipes"), @@index([...]), @@id([...])
    if (line.startsWith('@@')) {
      const mapMatch = line.match(/@@map\(\s*"([^"]+)"\s*\)/);
      if (mapMatch) current.dbName = mapMatch[1];
      continue;
    }

    // field line: name type attrs...
    const fieldMatch = line.match(/^(\w+)\s+([A-Za-z0-9_]+)(\[\])?(\?)?(.*)$/);
    if (!fieldMatch) continue;
    const [, fname, baseType, listMark, optMark, restRaw] = fieldMatch;
    const rest = restRaw || '';
    const isList = Boolean(listMark);
    const optional = Boolean(optMark);

    if (modelNames.has(baseType)) {
      // relation field (points at another model)
      current.relations.push({
        name: fname,
        type: baseType,
        list: isList,
        optional,
      });
    } else if (SCALARS.has(baseType) || enumNames.has(baseType)) {
      current.fields.push({
        name: fname,
        type: baseType + (isList ? '[]' : ''),
        optional,
        isEnum: enumNames.has(baseType),
        isId: /@id\b/.test(rest),
        isUnique: /@unique\b/.test(rest),
        hasDefault: /@default\(/.test(rest),
      });
    } else {
      // Unknown base type — treat as relation-ish (defensive; should not happen
      // for this schema). Record under relations so it is never silently lost.
      current.relations.push({ name: fname, type: baseType, list: isList, optional, unresolved: true });
    }
  }

  models.sort((a, b) => a.name.localeCompare(b.name));
  return models;
}

// =============================================================================
// 2) NEST CONTROLLERS — AST parse for @Controller + verb decorators + guards.
// =============================================================================
function buildPath(base, method) {
  const parts = [base, method]
    .map((p) => (p || '').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return '/' + parts.join('/');
}

function makeDecoratorHelpers(ts, sf) {
  const decoratorsOf = (node) =>
    ts.canHaveDecorators?.(node) ? ts.getDecorators(node) ?? [] : ts.getDecorators?.(node) ?? [];
  const nameOf = (dec) => {
    const expr = dec.expression;
    if (ts.isCallExpression(expr)) return expr.expression.getText(sf);
    return expr.getText(sf);
  };
  const firstStringArg = (dec) => {
    const expr = dec.expression;
    if (ts.isCallExpression(expr) && expr.arguments.length) {
      const a = expr.arguments[0];
      if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) return a.text;
    }
    return undefined;
  };
  const guardsFrom = (decs) => {
    const guards = [];
    const roles = [];
    let isPublic = false;
    for (const d of decs) {
      const n = nameOf(d);
      if (n === 'UseGuards' && ts.isCallExpression(d.expression)) {
        for (const a of d.expression.arguments) guards.push(a.getText(sf));
      } else if (n === 'Roles' && ts.isCallExpression(d.expression)) {
        for (const a of d.expression.arguments) roles.push(ts.isStringLiteral(a) ? a.text : a.getText(sf));
      } else if (n === 'Public') {
        isPublic = true;
      }
    }
    return { guards, roles, public: isPublic };
  };
  return { decoratorsOf, nameOf, firstStringArg, guardsFrom };
}

function authSummary(classG, methodG) {
  const guards = [...classG.guards, ...methodG.guards];
  const roles = [...new Set([...classG.roles, ...methodG.roles])];
  const isPublic = classG.public || methodG.public;
  const hasJwt = guards.some((g) => /AuthGuard\(\s*['"]jwt['"]\s*\)/.test(g) || /JwtAuthGuard/.test(g));
  const hasThrottler = guards.some((g) => /Throttler/.test(g));
  if (isPublic) return 'public';
  if (roles.length) return `jwt+roles(${roles.sort().join(',')})`;
  if (hasJwt) return 'jwt';
  if (hasThrottler) return 'throttler';
  return 'none';
}

function parseControllers(ts, files) {
  const endpoints = [];
  for (const file of files) {
    const src = read(file);
    if (!/@Controller\s*\(/.test(src)) continue;
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const H = makeDecoratorHelpers(ts, sf);

    const visit = (node) => {
      if (ts.isClassDeclaration(node)) {
        const decs = H.decoratorsOf(node);
        const controllerDec = decs.find((d) => H.nameOf(d) === 'Controller');
        if (controllerDec) {
          const basePath = H.firstStringArg(controllerDec) ?? '';
          const classGuards = H.guardsFrom(decs);
          const className = node.name ? node.name.getText(sf) : '(anonymous)';
          for (const member of node.members) {
            if (!ts.isMethodDeclaration(member)) continue;
            const mdecs = H.decoratorsOf(member);
            for (const d of mdecs) {
              const dn = H.nameOf(d);
              if (!HTTP_VERBS.includes(dn)) continue;
              const methodPath = H.firstStringArg(d) ?? '';
              const fullPath = buildPath(basePath, methodPath);
              const methodGuards = H.guardsFrom(mdecs);
              const isInternal = /^\/internal\//.test(fullPath);
              endpoints.push({
                id: `${dn.toUpperCase()} ${fullPath}`,
                verb: dn.toUpperCase(),
                path: fullPath,
                controller: className,
                handler: member.name ? member.name.getText(sf) : '(anon)',
                file: rel(file),
                controllerBasePath: '/' + basePath.replace(/^\/+|\/+$/g, ''),
                guards: [...classGuards.guards, ...methodGuards.guards],
                roles: [...new Set([...classGuards.roles, ...methodGuards.roles])].sort(),
                public: classGuards.public || methodGuards.public,
                auth: authSummary(classGuards, methodGuards),
                isInternal,
              });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  // Deterministic order: by path then verb.
  endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.verb.localeCompare(b.verb));
  return endpoints;
}

// =============================================================================
// 3) REACT ROUTES — AST parse of App.jsx <Route> elements.
// =============================================================================
function parseRoutes(ts, file) {
  const src = read(file);
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);

  // lazy-imported page components: const X = lazy(() => import('...'))
  const lazyPages = new Set();
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*lazy\(/g)) lazyPages.add(m[1]);

  const tagName = (el) => {
    const opening = ts.isJsxElement(el) ? el.openingElement : el;
    return opening.tagName.getText(sf);
  };

  const collectJsxTagNames = (node, acc) => {
    if (ts.isJsxElement(node)) acc.push(node.openingElement.tagName.getText(sf));
    else if (ts.isJsxSelfClosingElement(node)) acc.push(node.tagName.getText(sf));
    ts.forEachChild(node, (c) => collectJsxTagNames(c, acc));
  };

  const routes = [];
  const visit = (node) => {
    const isJsx = ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node);
    if (isJsx && tagName(node) === 'Route') {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      let routePath = null;
      let isIndex = false;
      let elementNode = null;
      for (const attr of opening.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        const an = attr.name.getText(sf);
        if (an === 'index') isIndex = true;
        if (an === 'path' && attr.initializer && ts.isStringLiteral(attr.initializer)) {
          routePath = attr.initializer.text;
        }
        if (an === 'element' && attr.initializer && ts.isJsxExpression(attr.initializer)) {
          elementNode = attr.initializer.expression ?? null;
        }
      }
      // Identify the page component + protection from the element subtree.
      const tags = [];
      if (elementNode) collectJsxTagNames(elementNode, tags);
      const isProtected = tags.includes('ProtectedRoute') || tags.includes('AdminRoute');
      const isAdmin = tags.includes('AdminRoute');
      const pageComponent =
        tags.find((t) => lazyPages.has(t)) ||
        tags.find((t) => !ROUTE_WRAPPERS.has(t)) ||
        null;
      // Skip the bare layout route (path "/" whose element is just MainLayout).
      const isLayoutOnly = tags.length > 0 && tags.every((t) => ROUTE_WRAPPERS.has(t));
      if (routePath !== null || isIndex) {
        routes.push({
          path: isIndex ? '(index)' : routePath,
          component: pageComponent,
          protected: isProtected,
          admin: isAdmin,
          layoutOnly: isLayoutOnly && !pageComponent,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  routes.sort((a, b) => String(a.path).localeCompare(String(b.path)));
  return routes;
}

// =============================================================================
// 4) FRONTEND API CALLS — apiClient.<verb>('/path') across apps/web/src.
// =============================================================================
function normalizePath(raw) {
  let p = raw.split('?')[0].trim();
  p = p.replace(/\$\{[^}]*\}/g, '*'); // template interpolation -> *
  p = p.replace(/:[A-Za-z0-9_]+/g, '*'); // express-style params -> *
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/+$/, '') || '/';
  return p;
}

function parseFrontendCalls(files) {
  const calls = [];
  // apiClient.get(`/x/${y}`) | apiClient.post('/x') | apiClient.delete("/x")
  // Tolerate whitespace/newlines around the dot for fluent/chained calls, e.g.
  //   apiClient
  //     .get(`/recipes/${id}`)
  const re = /apiClient\s*\.\s*(get|post|put|patch|delete)\s*\(\s*([`'"])((?:\\.|(?!\2).)*)\2/g;
  for (const file of files) {
    const src = read(file);
    let m;
    while ((m = re.exec(src)) !== null) {
      const verb = m[1].toUpperCase();
      const rawPath = m[3];
      calls.push({
        verb,
        raw: rawPath,
        normalized: normalizePath(rawPath),
        file: rel(file),
        dynamic: /[`]/.test(m[2]) || /\$\{/.test(rawPath),
      });
    }
  }
  calls.sort((a, b) => a.normalized.localeCompare(b.normalized) || a.verb.localeCompare(b.verb));
  return calls;
}

// Build the set of (VERB normalizedPath) the frontend actually calls.
function calledKeySet(calls) {
  const set = new Set();
  for (const c of calls) set.add(`${c.verb} ${c.normalized}`);
  return set;
}

function endpointCalled(endpoint, calledSet) {
  const key = `${endpoint.verb} ${normalizePath(endpoint.path)}`;
  return calledSet.has(key);
}

// =============================================================================
// 5) RECIPE RENDERED FIELDS (heuristic) — identifier matching in recipe/[id]/**.
//    Documented as heuristic, not proof. The registry is the source of intent.
// =============================================================================
function recipeRenderedFields(recipeModel) {
  const files = walk(RECIPE_DETAIL_DIR, ['.jsx', '.js', '.tsx', '.ts']);
  const fileTexts = files.map((f) => ({ file: rel(f), text: read(f) }));
  // scalar fields + the `author` relation (the audit flagged author specifically)
  const targets = [
    ...recipeModel.fields.map((f) => f.name),
    ...recipeModel.relations.filter((r) => r.name === 'author').map((r) => r.name),
  ];
  const result = [];
  for (const field of targets) {
    const re = new RegExp(`\\b${field}\\b`);
    const hitFiles = fileTexts.filter((ft) => re.test(ft.text)).map((ft) => ft.file);
    result.push({ field, rendered: hitFiles.length > 0, files: hitFiles });
  }
  result.sort((a, b) => a.field.localeCompare(b.field));
  return { scope: rel(RECIPE_DETAIL_DIR), scannedFiles: files.map(rel).sort(), fields: result };
}

// =============================================================================
// 6) EVENTS — backend enum vs frontend object; orphans = defined one side only.
// =============================================================================
function parseEventValues(text, kind) {
  // kind 'enum'  : KEY = 'value'
  // kind 'object': KEY: 'value'
  const re = kind === 'enum' ? /(\w+)\s*=\s*'([^']+)'/g : /(\w+)\s*:\s*'([^']+)'/g;
  const map = {};
  let m;
  while ((m = re.exec(text)) !== null) map[m[2]] = m[1];
  return map;
}

function crossReferenceEvents() {
  const backendMap = parseEventValues(read(EVENT_TAX_BACKEND), 'enum');
  const frontendMap = parseEventValues(read(EVENT_TAX_FRONTEND), 'object');
  const backend = new Set(Object.keys(backendMap));
  const frontend = new Set(Object.keys(frontendMap));
  const both = [...backend].filter((v) => frontend.has(v)).sort();
  const backendOnly = [...backend].filter((v) => !frontend.has(v)).sort();
  const frontendOnly = [...frontend].filter((v) => !backend.has(v)).sort();
  return {
    backendCount: backend.size,
    frontendCount: frontend.size,
    bothCount: both.length,
    both,
    backendOnly, // defined backend, missing frontend (orphan)
    frontendOnly, // defined frontend, missing backend (orphan)
  };
}

// =============================================================================
// MAIN
// =============================================================================
function generate() {
  const ts = loadTypeScript();

  const prismaText = read(SCHEMA_PRISMA);
  const models = parsePrisma(prismaText);
  const recipe = models.find((m) => m.name === 'Recipe');

  const controllerFiles = walk(SERVER_SRC, ['.ts']).filter((f) => !f.endsWith('.spec.ts'));
  const endpoints = parseControllers(ts, controllerFiles);

  const routes = parseRoutes(ts, APP_JSX);

  const webFiles = walk(WEB_SRC, ['.js', '.jsx', '.ts', '.tsx']);
  const frontendCalls = parseFrontendCalls(webFiles);
  const calledSet = calledKeySet(frontendCalls);

  // annotate endpoints with frontend-call detection
  for (const e of endpoints) e.calledByFrontend = endpointCalled(e, calledSet);

  const rendered = recipe ? recipeRenderedFields(recipe) : null;
  const events = crossReferenceEvents();

  const internalEndpoints = endpoints.filter((e) => e.isInternal);
  const recipeScalarFields = recipe ? recipe.fields.length : 0;
  const recipeRelations = recipe ? recipe.relations.length : 0;

  const out = {
    generatedBy: 'tools/coverage/coverage-scan.mjs',
    schemaVersion: 1,
    doNotEdit: 'GENERATED ARTIFACT — overwritten by `pnpm coverage:scan`. Hand-edit coverage.registry.json instead.',
    sources: {
      schema: rel(SCHEMA_PRISMA),
      serverSrc: rel(SERVER_SRC),
      appJsx: rel(APP_JSX),
      apiClient: rel(API_CLIENT),
      recipeDetailDir: rel(RECIPE_DETAIL_DIR),
      eventTaxonomyBackend: rel(EVENT_TAX_BACKEND),
      eventTaxonomyFrontend: rel(EVENT_TAX_FRONTEND),
    },
    counts: {
      models: models.length,
      recipeScalarFields,
      recipeRelations,
      recipeTotalFields: recipeScalarFields + recipeRelations,
      endpoints: endpoints.length,
      internalEndpoints: internalEndpoints.length,
      controllers: new Set(endpoints.map((e) => e.controller)).size,
      routes: routes.length,
      protectedRoutes: routes.filter((r) => r.protected).length,
      frontendCallSites: frontendCalls.length,
      backendEvents: events.backendCount,
      frontendEvents: events.frontendCount,
    },
    models,
    recipeRenderedFields: rendered,
    endpoints,
    routes,
    frontendCalls,
    events,
  };

  return out;
}

function toMarkdown(out) {
  const L = [];
  L.push('# coverage.generated (raw view)\n');
  L.push('> Generated artifact — do not hand-edit. Source of truth is the live code.\n');
  L.push('## Counts\n');
  for (const [k, v] of Object.entries(out.counts)) L.push(`- **${k}**: ${v}`);
  L.push('\n## Endpoints\n');
  L.push('| Verb | Path | Controller | Auth | Internal | FrontendCall |');
  L.push('|---|---|---|---|---|---|');
  for (const e of out.endpoints) {
    L.push(`| ${e.verb} | ${e.path} | ${e.controller} | ${e.auth} | ${e.isInternal ? 'yes' : ''} | ${e.calledByFrontend ? 'yes' : 'no'} |`);
  }
  L.push('\n## Recipe rendered fields (heuristic, detail page)\n');
  if (out.recipeRenderedFields) {
    L.push('| Field | Rendered |');
    L.push('|---|---|');
    for (const f of out.recipeRenderedFields.fields) L.push(`| ${f.field} | ${f.rendered ? 'yes' : 'NO'} |`);
  }
  L.push('\n## Events\n');
  L.push(`- backend: ${out.events.backendCount}, frontend: ${out.events.frontendCount}, shared: ${out.events.bothCount}`);
  L.push(`- backend-only (orphan): ${out.events.backendOnly.join(', ') || '(none)'}`);
  L.push(`- frontend-only (orphan): ${out.events.frontendOnly.join(', ') || '(none)'}`);
  return L.join('\n') + '\n';
}

function main() {
  const args = process.argv.slice(2);
  const wantMd = args.includes('--md');
  const out = generate();

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + '\n', 'utf8');

  if (wantMd) {
    const md = toMarkdown(out);
    fs.writeFileSync(OUT_MD, md, 'utf8');
    process.stdout.write(md);
  }

  const c = out.counts;
  process.stderr.write(
    `coverage-scan: models=${c.models} recipeFields=${c.recipeTotalFields}(scalar ${c.recipeScalarFields}+rel ${c.recipeRelations}) ` +
      `endpoints=${c.endpoints}(internal ${c.internalEndpoints}) controllers=${c.controllers} routes=${c.routes} ` +
      `events=B${c.backendEvents}/F${c.frontendEvents} -> ${rel(OUT_JSON)}\n`,
  );
}

// Allow `import { generate }` from sibling scripts (check / matrix) without re-running.
const isMain = path.resolve(process.argv[1] || '') === __filename;
if (isMain) main();

export { generate };
