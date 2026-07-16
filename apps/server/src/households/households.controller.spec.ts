import { HEADERS_METADATA } from '@nestjs/common/constants';
import { HouseholdsController } from './households.controller';

describe('HouseholdsController private-read cache contract', () => {
  it.each(['list', 'pendingInvites', 'outgoingInvites', 'get', 'shopping'])(
    'marks %s as no-store',
    (method) => {
      const headers = Reflect.getMetadata(
        HEADERS_METADATA,
        (HouseholdsController.prototype as any)[method],
      );
      expect(headers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Cache-Control', value: 'no-store' }),
        ]),
      );
    },
  );
});

describe('HouseholdsController decision commands', () => {
  it('forwards the creator cancel command with the decision CAS version', async () => {
    const households = {
      cancelDecision: jest.fn(async () => ({ decision: { status: 'CANCELLED' } })),
    };
    const controller = new HouseholdsController(households as any);

    await expect(
      controller.cancelDecision(
        { user: { userId: 'u1' } } as any,
        'h1',
        'decision-1',
        { version: 3 },
      ),
    ).resolves.toEqual({ decision: { status: 'CANCELLED' } });
    expect(households.cancelDecision).toHaveBeenCalledWith(
      'u1',
      'h1',
      'decision-1',
      3,
    );
  });
});
