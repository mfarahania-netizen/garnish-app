/**
 * GARNISH-SEC-PRELAUNCH-19 — verification specs for the pre-launch security items.
 *
 * R15 (consent gate): a pre-consent event is rejected by the strict runtime guard with NO canonical value
 *   to persist. R18 (ops/diagnostics RBAC): RolesGuard denies a non-admin; every recommendation ops/job
 *   route is admin-gated. R17 (RecipeContext crash): the previously-missing context now exists with the
 *   right exports, is wired at the app root, and the 4 surfaces import + read `recipes` from it.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/roles.guard';
import { guardEventForRuntime } from '../analytics/event-envelope-runtime-guard';
import { CANONICAL_EVENT_EXAMPLES } from '../analytics/event-envelope.examples';

const REPO = path.resolve(__dirname, '../../../..'); // apps/server/src/security → repo root
const readRepo = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8');

// ── R15: consent gate (use a known-valid canonical example as the base) ──
const VALID_EVENT: any = CANONICAL_EVENT_EXAMPLES[0];

describe('R15 — consent gate (pre-consent event rejected, nothing persisted)', () => {
  const opts = { mode: 'strict' as const, source: 'sec-test', producerId: 'sec-test' };

  it('a pre-consent event is REJECTED with no canonical value to persist', () => {
    const noConsent: any = { ...VALID_EVENT };
    delete noConsent.consentPurpose;
    const r = guardEventForRuntime(noConsent, opts);
    expect(r.allowed).toBe(false);
    expect(r.status).toBe('rejected');
    expect(r.canonicalEvent).toBeUndefined(); // nothing valid → nothing persisted
    expect(r.errors.some((e) => /consent/i.test(e))).toBe(true);
  });

  it('the rejection is SPECIFICALLY about consent (adding consent clears the consent error)', () => {
    // same event with consent present → no consentPurpose error (the consent dimension passes;
    // any remaining strict errors are unrelated taxonomy concerns, not consent).
    const r = guardEventForRuntime(VALID_EVENT, opts);
    expect(r.errors.some((e) => /consent/i.test(e))).toBe(false);
  });

  it('off-mode never blocks (shadow/off paths do not break producers)', () => {
    const r = guardEventForRuntime({ ...VALID_EVENT, consentPurpose: undefined }, { ...opts, mode: 'off' });
    expect(r.allowed).toBe(true); // observability modes never throw/block — strict is the enforcing gate
  });
});

// ── R18: ops/diagnostics RBAC ──
function adminCtx(user: any, roles?: string[]): any {
  const handler = () => undefined;
  if (roles) Reflect.defineMetadata('roles', roles, handler);
  return { getHandler: () => handler, getClass: () => class {}, switchToHttp: () => ({ getRequest: () => ({ user }) }) };
}

describe('R18 — ops/diagnostics RBAC (non-admin denied; ops routes admin-gated)', () => {
  const guard = new RolesGuard(new Reflector());

  it('RolesGuard denies a non-admin on an admin route, allows an admin, deny-by-default', () => {
    expect(guard.canActivate(adminCtx({ isAdmin: false }, ['admin']))).toBe(false); // non-admin denied
    expect(guard.canActivate(adminCtx({ isAdmin: true }, ['admin']))).toBe(true);
    expect(guard.canActivate(adminCtx({ isAdmin: true }, undefined))).toBe(false); // guard w/ no @Roles → fail closed
  });

  it('every recommendation ops/job route is admin-gated (RolesGuard + @Roles(admin))', () => {
    const src = readRepo('apps/server/src/recommendation/recommendation.controller.ts');
    const OPS_ROUTES = ['build-snapshots', 'run-signal-detector', 'build-identity', 'embedding/:recipeId', 'debug-features', 'test-penalty/:recipeId'];
    for (const route of OPS_ROUTES) {
      const idx = src.indexOf(`'${route}'`);
      expect(idx).toBeGreaterThan(-1);
      // the decorator block for this route must include RolesGuard + admin role
      const block = src.slice(idx, idx + 220);
      expect(block).toMatch(/RolesGuard/);
      expect(block).toMatch(/@Roles\('admin'\)/);
    }
  });

  it('the diagnostics controller is class-level admin-gated (deny-by-default)', () => {
    const src = readRepo('apps/server/src/recommendation/diagnostics.controller.ts');
    const head = src.slice(0, src.indexOf('export class'));
    expect(head).toMatch(/@UseGuards\(AuthGuard\('jwt'\),\s*RolesGuard\)/);
    expect(head).toMatch(/@Roles\('admin'\)/);
  });
});

// ── R17: RecipeContext crash fix ──
describe('R17 — RecipeContext exists, is wired, and surviving surfaces consume it', () => {
  it('RecipeContext.jsx exists and exports RecipeProvider + useRecipeContext', () => {
    const ctx = readRepo('apps/web/src/context/RecipeContext.jsx');
    expect(ctx).toMatch(/export function RecipeProvider/);
    expect(ctx).toMatch(/export function useRecipeContext/);
    expect(ctx).toMatch(/useRecipes/); // backed by the existing data hook
  });

  it('App.jsx wraps the routes with <RecipeProvider> (inside QueryClientProvider)', () => {
    const app = readRepo('apps/web/src/App.jsx');
    expect(app).toMatch(/import \{ RecipeProvider \} from '\.\/context\/RecipeContext'/);
    expect(app).toMatch(/<RecipeProvider>/);
  });

  it('all surviving surfaces import useRecipeContext from context/RecipeContext and read recipes', () => {
    // FE-RESET-A wiped the broken UI layer; AddFromFavoritesModal, AddFromPlanModal, and
    // RecipePickerModal were deleted with it. RecipeContext itself is PRESERVED and is still
    // wired at the app root (asserted above) — R17's intent (no missing-context crash) holds.
    // Re-add each surface to this list when its screen is rebuilt in a later content sprint.
    const files = [
      'apps/web/src/features/ai-chat/context/AIChatContext.jsx',
    ];
    for (const f of files) {
      const src = readRepo(f);
      expect(src).toMatch(/useRecipeContext.*from.*context\/RecipeContext/s);
      expect(src).toMatch(/useRecipeContext\(\)/);
    }
  });
});
