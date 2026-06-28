import { AgenticChatService } from './agentic-chat.service';
import { AgenticLoopService } from '../agentic/agentic-loop.service';
import { ToolCallingResult, BehavioralContextSnapshot } from '../ai-core.types';

const snapshot = { userId: 'u1', generatedAt: '2026-01-01T00:00:00Z', schemaVersion: 1 } as BehavioralContextSnapshot;

/** A scripted tool-capable model (returns each result in order, last repeats). */
const scriptModel = (script: ToolCallingResult[]) => {
  let i = 0;
  return {
    name: 'm',
    generate: async () => ({ text: '', model: 'm' }),
    generateWithTools: jest.fn(async (_input: { messages: { role: string; content: string }[]; tools: unknown[] }) => script[Math.min(i++, script.length - 1)]),
  };
};

const catalogWith = (searchExec: jest.Mock) => ({
  build: () => [
    { spec: { name: 'search_recipes', description: 'd', parameters: {} }, execute: searchExec },
    { spec: { name: 'get_recipe_details', description: 'd', parameters: {} }, execute: jest.fn() },
    { spec: { name: 'troubleshoot_cooking', description: 'd', parameters: {} }, execute: jest.fn() },
  ],
});

interface MakeOpts {
  model?: ReturnType<typeof scriptModel>;
  allergens?: string[] | null;
  screenSafe?: boolean;
  screenReason?: string;
  searchExec?: jest.Mock;
  filter?: jest.Mock;
  safeIds?: jest.Mock;
}

function make(opts: MakeOpts) {
  const grounded = {
    getDeclaredAllergens: jest.fn().mockResolvedValue(opts.allergens === undefined ? [] : opts.allergens),
    getDietConstraint: jest.fn().mockResolvedValue(null),
    screenLiveOutput: jest.fn().mockResolvedValue({ safe: opts.screenSafe ?? true, reason: opts.screenReason ?? null }),
  };
  const safety = {
    filter: opts.filter ?? jest.fn(async (_u: string, rows: unknown[]) => rows),
    safeIds: opts.safeIds ?? jest.fn(async (_u: string, ids: string[]) => ids),
  };
  const catalog = catalogWith(opts.searchExec ?? jest.fn(async () => ({ results: [] })));
  const writeTools = { build: () => [] }; // brain phase B — no write tools exercised in these gate tests
  const model = opts.model ?? scriptModel([{ text: 'سلام', toolCalls: [], model: 'm' }]);
  const svc = new AgenticChatService(model as never, new AgenticLoopService(), catalog as never, writeTools as never, grounded as never, safety as never);
  return { svc, grounded, safety, model };
}

describe('AgenticChatService — HARD safety gate', () => {
  const OLD = process.env.AI_AGENTIC_CHAT_ENABLED;
  beforeEach(() => {
    process.env.AI_AGENTIC_CHAT_ENABLED = 'true';
  });
  afterEach(() => {
    process.env.AI_AGENTIC_CHAT_ENABLED = OLD;
  });

  it('SAFE BY DEFAULT: disabled (and the model is never called) unless the flag is on', async () => {
    process.env.AI_AGENTIC_CHAT_ENABLED = 'false';
    const { svc, model } = make({});
    const r = await svc.reply('u1', 'سلام', snapshot);
    expect(r).toMatchObject({ ok: false, reason: 'disabled' });
    expect(model.generateWithTools).not.toHaveBeenCalled();
  });

  it('FAIL-CLOSED: if the allergy set cannot load (null), the model is NEVER run', async () => {
    const { svc, model } = make({ allergens: null });
    const r = await svc.reply('u1', 'یه غذا بده', snapshot);
    expect(r).toMatchObject({ ok: false, reason: 'allergy_unavailable' });
    expect(model.generateWithTools).not.toHaveBeenCalled();
  });

  it('BLOCKS the answer (never serves it) when the output screen flags an allergen', async () => {
    const { svc } = make({ screenSafe: false, screenReason: 'declared_allergen_in_output' });
    const r = await svc.reply('u1', 'یه غذا با بادام‌زمینی', snapshot);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('blocked:declared_allergen_in_output');
    expect(r.text).toBeNull();
  });

  it('INPUT filter: an unsafe recipe is dropped BEFORE the model sees it', async () => {
    const searchExec = jest.fn(async () => ({
      results: [
        { id: 'safe1', title: 'قورمه‌سبزی' },
        { id: 'bad1', title: 'خوراکِ بادام‌زمینی' },
      ],
    }));
    const filter = jest.fn(async (_u: string, rows: { id: string }[]) => rows.filter((r) => r.id !== 'bad1'));
    const model = scriptModel([
      { text: '', toolCalls: [{ id: 'c1', name: 'search_recipes', arguments: '{"query":"غذا"}' }], model: 'm' },
      { text: 'قورمه‌سبزی پیدا کردم', toolCalls: [], model: 'm' },
    ]);
    const { svc, safety } = make({ model, searchExec, filter });
    // prompt must route through the MODEL loop (this test targets the input gate on search_recipes), so avoid the
    // deterministic suggestion/plan short-circuits — «قورمه‌سبزی پیدا کن» is a plain search, not a "suggest"/"plan" ask.
    const r = await svc.reply('u1', 'قورمه‌سبزی پیدا کن', snapshot);
    expect(safety.filter).toHaveBeenCalled();
    // the tool result the model got back on the 2nd turn must contain only the safe recipe
    const secondCallMessages = model.generateWithTools.mock.calls[1][0].messages;
    const toolMsg = secondCallMessages.find((m) => m.role === 'tool')!;
    expect(toolMsg.content).toContain('safe1');
    expect(toolMsg.content).not.toContain('bad1');
    expect(r.ok).toBe(true);
  });

  it('HAPPY PATH: passes both gates and returns the answer', async () => {
    const { svc } = make({ allergens: [], model: scriptModel([{ text: 'قورمه‌سبزی عالیه', toolCalls: [], model: 'm' }]) });
    const r = await svc.reply('u1', 'یه خورشت بده', snapshot);
    expect(r).toMatchObject({ ok: true, text: 'قورمه‌سبزی عالیه' });
  });
});
