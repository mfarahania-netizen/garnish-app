import { TasteCorrectionService, CORRECTION_SIGNAL_TYPE } from './taste-correction.service';
import { SignalCalculatorService } from './signal-calculator.service';
import { ConsentService } from '../../consent/consent.service';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../consent/consent.constants';

const previousPersonalizationRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

beforeAll(() => {
  process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
});

afterAll(() => {
  if (previousPersonalizationRuntime === undefined) {
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  } else {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousPersonalizationRuntime;
  }
});

function makePrisma(overrides: any = {}) {
  const prisma: any = {
    userBehaviorSignal: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ingredient: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: 'ing_lentil' }),
    },
    userConsent: {
      findMany: jest.fn().mockResolvedValue([
        {
          purpose: 'personalization',
          status: 'granted',
          policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
        },
      ]),
    },
    recipe: { findUnique: jest.fn(), count: jest.fn().mockResolvedValue(10) },
    recipeIngredient: { groupBy: jest.fn().mockResolvedValue([]) },
    user: {},
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'u1' }]),
    ...overrides,
  };
  prisma.$transaction = jest.fn(async (callback: (tx: any) => unknown) => callback(prisma));
  return prisma;
}

function makeTasteService(prisma: any) {
  return new TasteCorrectionService(prisma, new ConsentService(prisma));
}

describe('TasteCorrectionService (FI-4.1)', () => {
  describe('listTastePreferences', () => {
    it('maps inferred + corrected signals to named, signed preferences (corrections marked "you")', async () => {
      const prisma = makePrisma();
      prisma.userBehaviorSignal.findMany.mockResolvedValue([
        { signalName: 'ing_lentil', signalType: 'ingredient_preference', value: -0.4, confidence: 0.6 },
        { signalName: 'ing_saffron', signalType: CORRECTION_SIGNAL_TYPE, value: 0.5, confidence: 1 },
        { signalName: 'ing_salt', signalType: 'ingredient_preference', value: 0.01, confidence: 0.5 }, // noise → dropped
      ]);
      prisma.ingredient.findMany.mockResolvedValue([
        { id: 'ing_lentil', nameFa: 'عدس', nameEn: 'lentil' },
        { id: 'ing_saffron', nameFa: 'زعفران', nameEn: 'saffron' },
      ]);
      const svc = makeTasteService(prisma);

      const out = await svc.listTastePreferences('u1');

      expect(out).toHaveLength(2); // salt noise filtered out
      const lentil = out.find((p) => p.ingredientId === 'ing_lentil')!;
      expect(lentil).toMatchObject({ name: 'عدس', stance: 'dislike', source: 'inferred' });
      const saffron = out.find((p) => p.ingredientId === 'ing_saffron')!;
      expect(saffron).toMatchObject({ name: 'زعفران', stance: 'like', source: 'you' });
    });

    it('drops signals whose ingredient cannot be named (honest, no raw ids)', async () => {
      const prisma = makePrisma();
      prisma.userBehaviorSignal.findMany.mockResolvedValue([
        { signalName: 'ing_ghost', signalType: 'ingredient_preference', value: -0.5, confidence: 0.7 },
      ]);
      prisma.ingredient.findMany.mockResolvedValue([]); // unresolvable
      const svc = makeTasteService(prisma);
      expect(await svc.listTastePreferences('u1')).toEqual([]);
    });

    it('returns nothing and performs no profile read after deny or withdrawal', async () => {
      const prisma = makePrisma({
        userConsent: {
          findMany: jest.fn().mockResolvedValue([{
            purpose: 'personalization',
            status: 'withdrawn',
            policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
          }]),
        },
      });
      const svc = makeTasteService(prisma);

      await expect(svc.listTastePreferences('u1')).resolves.toEqual([]);

      expect(prisma.userBehaviorSignal.findMany).not.toHaveBeenCalled();
      expect(prisma.ingredient.findMany).not.toHaveBeenCalled();
    });
  });

  describe('correctTastePreference', () => {
    it('like → writes a locked positive correction the ranker reads', async () => {
      const prisma = makePrisma();
      const svc = makeTasteService(prisma);
      const res = await svc.correctTastePreference('u1', 'ing_lentil', 'like');
      expect(res).toEqual({ ok: true, ingredientId: 'ing_lentil', stance: 'like' });
      const arg = prisma.userBehaviorSignal.upsert.mock.calls[0][0];
      expect(arg.create.signalType).toBe(CORRECTION_SIGNAL_TYPE);
      expect(arg.create.value).toBeGreaterThan(0);
      expect(arg.create.confidence).toBe(1);
    });

    it('dislike → writes a locked negative correction', async () => {
      const prisma = makePrisma();
      const svc = makeTasteService(prisma);
      await svc.correctTastePreference('u1', 'ing_lentil', 'dislike');
      const arg = prisma.userBehaviorSignal.upsert.mock.calls[0][0];
      expect(arg.create.value).toBeLessThan(0);
    });

    it('neutral → deletes the row (re-enables behavioral learning) and never upserts', async () => {
      const prisma = makePrisma();
      const svc = makeTasteService(prisma);
      const res = await svc.correctTastePreference('u1', 'ing_lentil', 'neutral');
      expect(res).toEqual({ ok: true, ingredientId: 'ing_lentil', stance: 'neutral' });
      expect(prisma.userBehaviorSignal.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', signalName: 'ing_lentil' } });
      expect(prisma.userBehaviorSignal.upsert).not.toHaveBeenCalled();
    });

    it('rejects an unknown ingredient — never writes an arbitrary signal name', async () => {
      const prisma = makePrisma({ ingredient: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn() } });
      const svc = makeTasteService(prisma);
      const res = await svc.correctTastePreference('u1', 'ing_nope', 'like');
      expect(res).toMatchObject({ ok: false });
      expect(prisma.userBehaviorSignal.upsert).not.toHaveBeenCalled();
    });

    it('rejects an invalid stance', async () => {
      const prisma = makePrisma();
      const svc = makeTasteService(prisma);
      const res = await svc.correctTastePreference('u1', 'ing_lentil', 'love' as any);
      expect(res).toMatchObject({ ok: false });
    });

    it('denied consent fails closed before ingredient lookup or signal write', async () => {
      const prisma = makePrisma({
        userConsent: { findMany: jest.fn().mockResolvedValue([]) },
      });
      const svc = makeTasteService(prisma);

      const res = await svc.correctTastePreference('u1', 'ing_lentil', 'like');

      expect(res).toEqual({ ok: false, reason: 'personalization consent required' });
      expect(prisma.ingredient.findUnique).not.toHaveBeenCalled();
      expect(prisma.userBehaviorSignal.upsert).not.toHaveBeenCalled();
      expect(prisma.userBehaviorSignal.deleteMany).not.toHaveBeenCalled();
    });

    it('latest withdrawal fails closed before ingredient lookup or signal write', async () => {
      const prisma = makePrisma({
        userConsent: {
          findMany: jest.fn().mockResolvedValue([
            { purpose: 'personalization', status: 'granted', policyVersion: CURRENT_PRIVACY_POLICY_VERSION },
            { purpose: 'personalization', status: 'withdrawn', policyVersion: CURRENT_PRIVACY_POLICY_VERSION },
          ]),
        },
      });
      const svc = makeTasteService(prisma);

      const res = await svc.correctTastePreference('u1', 'ing_lentil', 'dislike');

      expect(res).toEqual({ ok: false, reason: 'personalization consent required' });
      expect(prisma.ingredient.findUnique).not.toHaveBeenCalled();
      expect(prisma.userBehaviorSignal.deleteMany).not.toHaveBeenCalled();
    });

    it('neutral deletion remains available without consent as a privacy control', async () => {
      const prisma = makePrisma({
        userConsent: { findMany: jest.fn().mockResolvedValue([]) },
      });
      const svc = makeTasteService(prisma);

      const res = await svc.correctTastePreference('u1', 'ing_lentil', 'neutral');

      expect(res).toEqual({ ok: true, ingredientId: 'ing_lentil', stance: 'neutral' });
      expect(prisma.userConsent.findMany).not.toHaveBeenCalled();
      expect(prisma.ingredient.findUnique).not.toHaveBeenCalled();
      expect(prisma.userBehaviorSignal.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', signalName: 'ing_lentil' },
      });
      expect(prisma.userBehaviorSignal.upsert).not.toHaveBeenCalled();
    });

    it('consent read error fails closed before ingredient lookup or signal write', async () => {
      const prisma = makePrisma({
        userConsent: { findMany: jest.fn().mockRejectedValue(new Error('db unavailable')) },
      });
      const svc = makeTasteService(prisma);

      const res = await svc.correctTastePreference('u1', 'ing_lentil', 'dislike');

      expect(res).toEqual({ ok: false, reason: 'personalization consent required' });
      expect(prisma.ingredient.findUnique).not.toHaveBeenCalled();
      expect(prisma.userBehaviorSignal.upsert).not.toHaveBeenCalled();
    });
  });

  describe('durability guard (SignalCalculatorService)', () => {
    it('behavioral feedback NEVER overwrites a user correction', async () => {
      const prisma = makePrisma();
      prisma.recipe.findUnique.mockResolvedValue({
        ingredients: [{ name: 'دانهٔ خنثی', ingredientId: 'ing_corrected' }],
        categories: '[]',
        diet: null,
      });
      // the ingredient already carries an explicit user correction
      prisma.userBehaviorSignal.findUnique.mockResolvedValue({
        signalName: 'ing_corrected',
        signalType: CORRECTION_SIGNAL_TYPE,
        value: 0.5,
        confidence: 1,
      });
      prisma.recipeIngredient.groupBy.mockResolvedValue([{ ingredientId: 'ing_corrected', _count: { recipeId: 1 } }]);

      const calc = new SignalCalculatorService(prisma as any);
      await calc.applyNegativeFeedback('u1', 'r1', -0.5);

      // the corrected ingredient's signal must be left untouched
      expect(prisma.userBehaviorSignal.upsert).not.toHaveBeenCalled();
      expect(prisma.userBehaviorSignal.update).not.toHaveBeenCalled();
    });
  });
});
