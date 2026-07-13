import { ShoppingSignalProcessor } from './shopping.signal-processor';

const previousPersonalizationRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

beforeAll(() => {
  process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
});

afterAll(() => {
  if (previousPersonalizationRuntime === undefined) delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  else process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousPersonalizationRuntime;
});

// recsys audit P0-3: the real FE shopping-add events must be processed (they were emitted but unrouted).
describe('ShoppingSignalProcessor — real add events (recsys P0-3)', () => {
  let prisma: any;
  let signalCalculator: any;
  let proc: ShoppingSignalProcessor;

  beforeEach(() => {
    prisma = { signalObservation: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue(null) } };
    signalCalculator = { updateSignalInLockedTransaction: jest.fn().mockResolvedValue(undefined) };
    proc = new ShoppingSignalProcessor(prisma, signalCalculator);
  });

  const ev = (type: string, payload: any = {}) => ({ id: 'e1', type, payload: JSON.stringify(payload) });
  const names = () => prisma.signalObservation.create.mock.calls.map((c: any) => c[0].data.signalName);

  it('shopping_add_manual → grocery observation + budget signal', async () => {
    await proc.process(ev('shopping_add_manual'), 'u1', prisma);
    expect(signalCalculator.updateSignalInLockedTransaction).toHaveBeenCalled();
    expect(names()).toContain('shops_efficiently');
  });

  it('shopping_add_from_plan → ALSO a routine.meal_planning signal (planning intent)', async () => {
    await proc.process(ev('shopping_add_from_plan', { added: 4 }), 'u1', prisma);
    expect(names()).toContain('shops_efficiently');
    expect(names()).toContain('routine.meal_planning');
  });

  it('shopping_item_add still works (no regression)', async () => {
    await proc.process(ev('shopping_item_add'), 'u1', prisma);
    expect(names()).toContain('shops_efficiently');
    expect(signalCalculator.updateSignalInLockedTransaction).toHaveBeenCalled();
  });
});
