import { AiAssistService } from './ai-assist.service';
import { NutritionClaimGuardService } from '../guards/nutrition-claim.guard';
import { MissingBehavioralContextError, AiTool, BehavioralContextSnapshot } from '../ai-core.types';

const SNAP: BehavioralContextSnapshot = { userId: 'u1', generatedAt: '2026-06-15T00:00:00Z', schemaVersion: 1, nutritionSourceLocked: false };

function fakeSnapshots(valid = true) {
  return {
    build: jest.fn(async () => SNAP),
    validate: jest.fn(() => valid),
  } as any;
}

function fakeTool(name: string, result: any): AiTool {
  return { name, description: name, handler: jest.fn(async () => result) };
}

function makeService(tool: AiTool, opts: { valid?: boolean } = {}) {
  const snapshots = fakeSnapshots(opts.valid ?? true);
  const nutrition = new NutritionClaimGuardService(); // REAL guard — enforcement under test
  // wire the same fake into every slot; each test calls the matching method
  const svc = new AiAssistService(snapshots, nutrition, tool as any, tool as any, tool as any, tool as any);
  return { svc, snapshots };
}

describe('AiAssistService (E47-L4)', () => {
  it('builds the mandatory snapshot, runs the tool, and passes a safe note through the nutrition guard', async () => {
    const tool = fakeTool('suggest_substitutions', {
      resultStatus: 'ok',
      substitutions: [{ name: 'روغن زیتون', reason: 'هم‌نقش با کره' }],
      note: '۱ جایگزین برای «کره» پیشنهاد شد.',
    });
    const { svc, snapshots } = makeService(tool);
    const out: any = await svc.substitutions('u1', { ingredient: 'کره' });
    expect(snapshots.build).toHaveBeenCalledWith('u1', { locale: 'fa' });
    expect(out.resultStatus).toBe('ok');
    expect(out.nutritionGuard).toBe('pass');
    expect(out.substitutions).toHaveLength(1);
  });

  it('ENFORCES the nutrition-claim guard: a health-claim note is blocked and replaced (data preserved)', async () => {
    const tool = fakeTool('suggest_substitutions', {
      resultStatus: 'ok',
      substitutions: [{ name: 'سیر', reason: 'This lowers your cholesterol fast.' }],
      note: 'This substitution lowers your cholesterol and cures diabetes.',
    });
    const { svc } = makeService(tool);
    const out: any = await svc.substitutions('u1', { ingredient: 'کره' });
    expect(out.nutritionGuard).toBe('blocked');
    expect(out.nutritionGuardReasons.length).toBeGreaterThan(0);
    expect(out.note).not.toMatch(/cholesterol/i); // claim stripped
    expect(out.substitutions).toHaveLength(1); // structured grounded data preserved
  });

  it('FAILS FAST when the snapshot is invalid (no tool run, no leak)', async () => {
    const tool = fakeTool('suggest_substitutions', { resultStatus: 'ok' });
    const { svc } = makeService(tool, { valid: false });
    await expect(svc.substitutions('u1', { ingredient: 'کره' })).rejects.toBeInstanceOf(MissingBehavioralContextError);
    expect(tool.handler).not.toHaveBeenCalled();
  });

  it('routes each method to its tool (pantry/technique/pairings)', async () => {
    const pantry = fakeTool('match_pantry_recipes', { resultStatus: 'ok', matches: [], note: 'ok' });
    const snapshots = fakeSnapshots(true);
    const svc = new AiAssistService(snapshots, new NutritionClaimGuardService(), fakeTool('a', {}) as any, pantry as any, fakeTool('c', {}) as any, fakeTool('d', {}) as any);
    const out: any = await svc.pantryMatch('u1', { have: ['گوجه'] });
    expect(pantry.handler).toHaveBeenCalled();
    expect(out.nutritionGuard).toBe('pass');
  });
});
