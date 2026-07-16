import { ConflictException, NotFoundException } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import {
  HOUSEHOLD_SKIP_OPTION,
  HouseholdsService,
} from './households.service';

const PREVIOUS_ENABLED = process.env.HOUSEHOLD_V1_ENABLED;
const PREVIOUS_PEPPER = process.env.HOUSEHOLD_INVITE_PEPPER;
const PEPPER = 'household-test-pepper-that-is-long-enough-123';
const NOW = new Date('2026-07-15T12:00:00.000Z');

beforeAll(() => {
  process.env.HOUSEHOLD_V1_ENABLED = 'true';
  process.env.HOUSEHOLD_INVITE_PEPPER = PEPPER;
});

afterAll(() => {
  if (PREVIOUS_ENABLED === undefined) delete process.env.HOUSEHOLD_V1_ENABLED;
  else process.env.HOUSEHOLD_V1_ENABLED = PREVIOUS_ENABLED;
  if (PREVIOUS_PEPPER === undefined) delete process.env.HOUSEHOLD_INVITE_PEPPER;
  else process.env.HOUSEHOLD_INVITE_PEPPER = PREVIOUS_PEPPER;
});

function membership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    userId: 'u1',
    role: 'MEMBER',
    status: 'ACTIVE',
    version: 1,
    joinedAt: NOW,
    household: {
      id: 'h1',
      name: 'خانه',
      status: 'ACTIVE',
      ownerUserId: 'u-owner',
      version: 1,
      createdAt: NOW,
    },
    user: { id: 'u1', name: 'کاربر' },
    ...overrides,
  };
}

function createHouseholdHarness() {
  const idempotencyRows = new Map<string, any>();
  let householdSequence = 0;
  let transactionQueue: Promise<unknown> = Promise.resolve();
  const householdCreate = jest.fn(async ({ data }: any) => ({
    id: `h-${++householdSequence}`,
    ...data,
  }));
  const rowKey = (compound: any) =>
    `${compound.principalUserId}|${compound.operation}|${compound.key}`;
  const makeTx = () => ({
    $queryRaw: jest.fn(async () => []),
    user: {
      findUnique: jest.fn(async ({ where }: any) => ({
        id: where.id,
        isGuest: false,
        phone: '09125550000',
        phoneVerifiedAt: NOW,
      })),
    },
    householdIdempotency: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      findUnique: jest.fn(async ({ where }: any) =>
        idempotencyRows.get(rowKey(where.principalUserId_operation_key)) ?? null,
      ),
      create: jest.fn(async ({ data }: any) => {
        const key = rowKey(data);
        if (idempotencyRows.has(key)) {
          throw Object.assign(new Error('unique constraint'), { code: 'P2002' });
        }
        const row = {
          ...data,
          householdId: data.householdId ?? null,
          state: 'PROCESSING',
          response: null,
        };
        idempotencyRows.set(key, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const key = rowKey(where.principalUserId_operation_key);
        const row = { ...idempotencyRows.get(key), ...data };
        idempotencyRows.set(key, row);
        return row;
      }),
    },
    householdMembership: {
      count: jest.fn(async () => 0),
      create: jest.fn(async ({ data }: any) => ({ id: `m-${data.householdId}`, ...data })),
    },
    household: { create: householdCreate },
    householdShoppingList: { create: jest.fn(async () => ({})) },
    householdAuditEvent: { create: jest.fn(async () => ({})) },
  });
  const prisma: any = {
    user: {
      findUnique: jest.fn(async ({ where }: any) => ({
        id: where.id,
        isGuest: false,
        phone: '09125550000',
        phoneVerifiedAt: NOW,
      })),
    },
    $transaction: jest.fn((callback: any) => {
      const run = transactionQueue.then(() => callback(makeTx()));
      transactionQueue = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    }),
  };
  return { prisma, householdCreate };
}

describe('HouseholdsService security and concurrency contract', () => {
  it('terminalizes abandoned expired incoming invites and clears their phone digest on discovery', async () => {
    const tx: any = {
      user: {
        findUnique: jest.fn(async ({ select }: any) =>
          select?.isGuest === true
            ? { id: 'u1', isGuest: false }
            : { phone: '+98 912 555 0000', phoneVerifiedAt: NOW },
        ),
      },
      householdInvite: {
        updateMany: jest.fn(async () => ({ count: 1 })),
        findMany: jest.fn(async () => []),
      },
    };
    const prisma: any = {
      user: {
        findUnique: jest.fn(async () => ({
          phone: '09125550000',
          phoneVerifiedAt: NOW,
        })),
      },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    await expect(new HouseholdsService(prisma).pendingInvites('u1')).resolves.toEqual({ invites: [] });
    expect(tx.householdInvite.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'PENDING', expiresAt: { lte: expect.any(Date) } }),
      data: { status: 'EXPIRED', activeKey: null, targetPhoneDigest: null },
    }));
  });

  it('returns the same generic not-found for an outsider and a removed member', async () => {
    for (const row of [null, membership({ status: 'REMOVED' })]) {
      const prisma: any = {
        householdMembership: { findUnique: jest.fn(async () => row) },
        householdShoppingList: { findUnique: jest.fn() },
        $transaction: jest.fn(async (callback: any) =>
          callback({
            householdMembership: { findUnique: jest.fn(async () => row) },
          }),
        ),
      };
      await expect(
        new HouseholdsService(prisma).shopping('u1', 'h1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.householdShoppingList.findUnique).not.toHaveBeenCalled();
    }
  });

  it('binds invite acceptance to the authenticated canonical phone HMAC and never queries by raw target phone', async () => {
    const expectedDigest = createHmac('sha256', PEPPER)
      .update('09125550000')
      .digest('hex');
    const tx: any = {
      user: {
        findUnique: jest.fn(async ({ select }: any) =>
          select?.isGuest === true
            ? { id: 'u1', isGuest: false }
            : { phone: '+98 912 555 0000', phoneVerifiedAt: NOW },
        ),
      },
      householdInvite: {
        findFirst: jest.fn(async ({ where }: any) => {
          expect(where.targetPhoneDigest).toBe(expectedDigest);
          expect(JSON.stringify(where)).not.toContain('09125550000');
          return { id: 'invite-1', householdId: 'h1' };
        }),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      household: { update: jest.fn(async () => ({})) },
      householdMembership: {
        count: jest.fn(async () => 1),
        upsert: jest.fn(async () => membership()),
      },
      householdAuditEvent: { create: jest.fn(async () => ({})) },
    };
    const prisma: any = {
      user: {
        findUnique: jest.fn(async ({ select }: any) =>
          select?.isGuest === true
            ? { id: 'u1', isGuest: false }
            : { phone: '+98 912 555 0000', phoneVerifiedAt: NOW },
        ),
      },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const service = new HouseholdsService(prisma);
    jest
      .spyOn(service, 'get')
      .mockResolvedValue({ household: { id: 'h1' } } as any);
    await expect(service.acceptInvite('u1', 'invite-1')).resolves.toEqual({
      household: { id: 'h1' },
    });
    expect(tx.householdInvite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ targetPhoneDigest: expectedDigest }),
      }),
    );
  });

  it('replays a completed idempotent item create without running a second mutation', async () => {
    const response = {
      item: {
        id: 'item-1',
        name: 'شیر',
        amount: null,
        unit: null,
        status: 'NEEDED',
        version: 1,
      },
    };
    const operation = 'shopping.item.create';
    const payload = {
      householdId: 'h1',
      name: 'شیر',
      amount: null,
      unit: null,
      activeSemanticKey: 'v1:شیر',
    };
    const stable = (value: any): string => {
      if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
      if (value && typeof value === 'object')
        return `{${Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
          .join(',')}}`;
      return JSON.stringify(value);
    };
    const requestHash = createHash('sha256')
      .update(`${operation}:${stable(payload)}`)
      .digest('hex');
    const tx: any = {
      householdMembership: { findUnique: jest.fn(async () => membership()) },
      householdIdempotency: {
        findUnique: jest.fn(async () => ({
          householdId: 'h1',
          requestHash,
          state: 'COMPLETED',
          response,
          expiresAt: new Date(Date.now() + 60_000),
        })),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    await expect(
      new HouseholdsService(prisma).addItem('u1', 'h1', 'mutation-123', {
        name: 'شیر',
      }),
    ).resolves.toEqual({
      ...response,
      replayed: true,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.householdIdempotency.findUnique).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale item version before issuing the CAS update', async () => {
    const current = {
      id: 'item-1',
      householdId: 'h1',
      name: 'شیر',
      normalizedKey: 'شیر',
      activeSemanticKey: 'v1:شیر',
      status: 'NEEDED',
      version: 3,
      amount: null,
      unit: null,
    };
    const tx: any = {
      householdMembership: { findUnique: jest.fn(async () => membership()) },
      householdShoppingItem: {
        findFirst: jest.fn(async () => current),
        updateMany: jest.fn(),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    await expect(
      new HouseholdsService(prisma).updateItem('u1', 'h1', 'item-1', {
        version: 2,
        amount: '۲',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'version_conflict',
        currentVersion: 3,
      }),
    });
    expect(tx.householdShoppingItem.updateMany).not.toHaveBeenCalled();
  });

  it('enforces the last-owner invariant on leave', async () => {
    const owner = membership({
      role: 'OWNER',
      userId: 'u-owner',
      household: { ...membership().household, ownerUserId: 'u-owner' },
    });
    const tx: any = {
      householdMembership: {
        findUnique: jest.fn(async () => owner),
        updateMany: jest.fn(),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    await expect(
      new HouseholdsService(prisma).leave('u-owner', 'h1', 1),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.householdMembership.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a device guest before creating a household', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn(async () => ({ id: 'guest-1', isGuest: true })),
      },
      householdMembership: { count: jest.fn() },
      $transaction: jest.fn(),
    };
    await expect(
      new HouseholdsService(prisma).create('guest-1', 'create-guest-1', {
        name: 'خانه من',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'household_account_required' }),
    });
    expect(prisma.householdMembership.count).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fails closed when a non-guest account has no phone for household identity', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 'google-user-1',
          isGuest: false,
          phone: null,
        })),
      },
      $transaction: jest.fn(),
    };

    await expect(
      new HouseholdsService(prisma).create(
        'google-user-1',
        'create-google-1',
        { name: 'خانه من' },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'household_phone_required' }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not expose pending invites to an unverified legacy phone row', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn(async () => ({
          phone: '09125550000',
          phoneVerifiedAt: null,
        })),
      },
      $transaction: jest.fn(),
    };

    await expect(
      new HouseholdsService(prisma).pendingInvites('legacy-user'),
    ).resolves.toEqual({ invites: [] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns generic invite not-found when an unverified phone tries to accept', async () => {
    const unverified = {
      id: 'legacy-user',
      isGuest: false,
      phone: '09125550000',
      phoneVerifiedAt: null,
    };
    const tx: any = {
      user: { findUnique: jest.fn(async () => unverified) },
      householdInvite: { findFirst: jest.fn() },
    };
    const prisma: any = {
      user: { findUnique: jest.fn(async () => unverified) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    await expect(
      new HouseholdsService(prisma).acceptInvite('legacy-user', 'invite-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'household_invite_not_found' }),
    });
    expect(tx.householdInvite.findFirst).not.toHaveBeenCalled();
  });

  it('returns generic invite not-found when an unverified phone tries to decline', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn(async () => ({
          phone: '09125550000',
          phoneVerifiedAt: null,
        })),
      },
      $transaction: jest.fn(),
    };

    await expect(
      new HouseholdsService(prisma).declineInvite('legacy-user', 'invite-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'household_invite_not_found' }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('replays the same household create intent without creating a second home', async () => {
    const { prisma, householdCreate } = createHouseholdHarness();
    const service = new HouseholdsService(prisma);
    jest.spyOn(service, 'get').mockImplementation(async (userId, householdId) =>
      ({ household: { id: householdId, ownerUserId: userId } }) as any,
    );

    const first = await service.create('u1', 'create-same-1', { name: 'خانه' });
    const replay = await service.create('u1', 'create-same-1', { name: 'خانه' });

    expect(first).toMatchObject({ household: { id: 'h-1' }, replayed: false });
    expect(replay).toMatchObject({ household: { id: 'h-1' }, replayed: true });
    expect(householdCreate).toHaveBeenCalledTimes(1);
  });

  it('serializes concurrent household creates with the same user and key', async () => {
    const { prisma, householdCreate } = createHouseholdHarness();
    const service = new HouseholdsService(prisma);
    jest.spyOn(service, 'get').mockImplementation(async (userId, householdId) =>
      ({ household: { id: householdId, ownerUserId: userId } }) as any,
    );

    const results = await Promise.all([
      service.create('u1', 'create-race-1', { name: 'خانه' }),
      service.create('u1', 'create-race-1', { name: 'خانه' }),
    ]);

    expect(results.map((result) => result.household.id)).toEqual(['h-1', 'h-1']);
    expect(results.map((result) => result.replayed).sort()).toEqual([false, true]);
    expect(householdCreate).toHaveBeenCalledTimes(1);
  });

  it('isolates the same household idempotency key between different users', async () => {
    const { prisma, householdCreate } = createHouseholdHarness();
    const service = new HouseholdsService(prisma);
    jest.spyOn(service, 'get').mockImplementation(async (userId, householdId) =>
      ({ household: { id: householdId, ownerUserId: userId } }) as any,
    );

    const [first, second] = await Promise.all([
      service.create('u1', 'shared-create-key', { name: 'خانه' }),
      service.create('u2', 'shared-create-key', { name: 'خانه' }),
    ]);

    expect(first.household.id).not.toBe(second.household.id);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(false);
    expect(householdCreate).toHaveBeenCalledTimes(2);
  });

  it('deletes an expired idempotency key inside the new mutation before reusing it', async () => {
    const item = {
      id: 'item-new',
      name: 'نان',
      amount: null,
      unit: null,
      status: 'NEEDED',
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const tx: any = {
      householdMembership: { findUnique: jest.fn(async () => membership()) },
      householdShoppingItem: {
        count: jest.fn(async () => 0),
        create: jest.fn(async () => item),
      },
      householdIdempotency: {
        findUnique: jest.fn(async () => ({
          householdId: 'h1',
          requestHash: 'expired-hash',
          state: 'COMPLETED',
          response: { item: { id: 'old' } },
          expiresAt: new Date(Date.now() - 60_000),
        })),
        deleteMany: jest.fn(async () => ({ count: 1 })),
        create: jest.fn(async () => ({})),
        update: jest.fn(async () => ({})),
      },
      householdShoppingList: {
        findUnique: jest.fn(async () => ({ id: 'list-1' })),
      },
      householdAuditEvent: { create: jest.fn(async () => ({})) },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    await expect(
      new HouseholdsService(prisma).addItem('u1', 'h1', 'mutation-expired', {
        name: 'نان',
      }),
    ).resolves.toMatchObject({ item: { id: 'item-new' }, replayed: false });
    expect(tx.householdIdempotency.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: expect.any(Date) } },
    });
  });

  it('cancels expired decisions and makes the item actionable on the next shopping read', async () => {
    const item = { id: 'item-1', status: 'DECISION_PENDING', version: 2 };
    const tx: any = {
      householdMembership: { findUnique: jest.fn(async () => membership()) },
      householdShoppingDecision: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            { id: 'd1', itemId: item.id, version: 1, item },
          ])
          .mockResolvedValueOnce([]),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      householdShoppingItem: {
        findMany: jest.fn(async () => []),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      householdShoppingList: {
        findUnique: jest.fn(async () => ({
          id: 'list-1',
          name: 'list',
          version: 1,
          items: [],
          sessions: [],
        })),
      },
      householdAuditEvent: { create: jest.fn(async () => ({})) },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
      householdShoppingList: {
        findUnique: jest.fn(async () => ({
          id: 'list-1',
          name: 'خرید',
          version: 1,
          items: [],
          sessions: [],
        })),
      },
      householdShoppingDecision: { findMany: jest.fn(async () => []) },
    };
    await new HouseholdsService(prisma).shopping('u1', 'h1');
    expect(tx.householdShoppingItem.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['BOUGHT', 'SKIPPED'] } }),
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    );
    expect(tx.householdShoppingDecision.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED', activeKey: null }),
      }),
    );
    expect(tx.householdShoppingItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'NEEDED', version: { increment: 1 } },
      }),
    );
  });

  it('stops invite creation at the pending-invite cap before persisting another target', async () => {
    const owner = membership({
      role: 'OWNER',
      userId: 'u-owner',
      household: { ...membership().household, ownerUserId: 'u-owner' },
    });
    const tx: any = {
      householdMembership: {
        findUnique: jest.fn(async () => owner),
        count: jest.fn(async () => 2),
      },
      household: { update: jest.fn(async () => ({})) },
      householdInvite: {
        updateMany: jest.fn(async () => ({ count: 0 })),
        count: jest.fn(async () => 10),
        create: jest.fn(),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    await expect(
      new HouseholdsService(prisma).invite('u-owner', 'h1', {
        phone: '09121112222',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'household_invite_limit_reached',
      }),
    });
    expect(tx.householdInvite.create).not.toHaveBeenCalled();
  });

  it('returns every currently pending outgoing invite without terminal history crowding it out', async () => {
    const owner = membership({
      role: 'OWNER',
      userId: 'u-owner',
      household: { ...membership().household, ownerUserId: 'u-owner' },
    });
    const tx: any = {
      householdMembership: { findUnique: jest.fn(async () => owner) },
      householdInvite: {
        updateMany: jest.fn(async () => ({ count: 0 })),
        findMany: jest.fn(async () => []),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    await new HouseholdsService(prisma).outgoingInvites('u-owner', 'h1');

    expect(tx.householdInvite.findMany).toHaveBeenCalledWith({
      where: {
        householdId: 'h1',
        status: 'PENDING',
        expiresAt: { gt: expect.any(Date) },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  });

  it('does not report a revoke as successful after invite acceptance already won', async () => {
    const owner = membership({
      role: 'OWNER',
      userId: 'u-owner',
      household: { ...membership().household, ownerUserId: 'u-owner' },
    });
    const tx: any = {
      householdMembership: { findUnique: jest.fn(async () => owner) },
      householdInvite: {
        findFirst: jest.fn(async () => ({ id: 'invite-1', status: 'ACCEPTED' })),
        updateMany: jest.fn(),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    await expect(
      new HouseholdsService(prisma).revokeInvite('u-owner', 'h1', 'invite-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'household_invite_closed' }),
    });
    expect(tx.householdInvite.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a social unavailable decision when there is no other active member', async () => {
    const item = {
      id: 'item-1',
      householdId: 'h1',
      name: 'milk',
      status: 'NEEDED',
      version: 1,
    };
    const tx: any = {
      householdMembership: {
        findUnique: jest.fn(async () => membership()),
        count: jest.fn(async () => 1),
      },
      householdShoppingItem: {
        findFirst: jest.fn(async () => item),
        updateMany: jest.fn(),
      },
      householdShoppingDecision: { create: jest.fn() },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    await expect(
      new HouseholdsService(prisma).markUnavailable('u1', 'h1', 'item-1', {
        version: 1,
        alternative: 'yogurt',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'household_decision_requires_other_member',
      }),
    });
    expect(tx.householdShoppingItem.updateMany).not.toHaveBeenCalled();
    expect(tx.householdShoppingDecision.create).not.toHaveBeenCalled();
  });

  it('forbids the creator from resolving their own open decision', async () => {
    const decision = {
      id: 'decision-1',
      householdId: 'h1',
      itemId: 'item-1',
      createdByMembershipId: 'm1',
      status: 'OPEN',
      version: 1,
      expiresAt: new Date(Date.now() + 60_000),
      options: ['yogurt', HOUSEHOLD_SKIP_OPTION],
      item: { id: 'item-1', status: 'DECISION_PENDING', version: 2 },
    };
    const tx: any = {
      householdMembership: { findUnique: jest.fn(async () => membership()) },
      householdShoppingDecision: {
        findFirst: jest.fn(async () => decision),
        updateMany: jest.fn(),
      },
      householdShoppingItem: { updateMany: jest.fn() },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    await expect(
      new HouseholdsService(prisma).resolveDecision(
        'u1',
        'h1',
        'decision-1',
        { version: 1, selectedOption: 'yogurt' },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'household_decision_self_resolution_forbidden',
      }),
    });
    expect(tx.householdShoppingDecision.updateMany).not.toHaveBeenCalled();
    expect(tx.householdShoppingItem.updateMany).not.toHaveBeenCalled();
  });

  it('returns caller-relative capabilities for an open social decision', () => {
    const decision = {
      id: 'decision-1',
      itemId: 'item-1',
      createdByMembershipId: 'm-creator',
      question: 'choose',
      options: ['a', 'b'],
      status: 'OPEN',
      version: 1,
      selectedOption: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: NOW,
      resolvedAt: null,
    };
    const service = new HouseholdsService({} as any);

    expect((service as any).decisionView(decision, 'm-creator')).toMatchObject({
      createdByMe: true,
      canResolve: false,
      canCancel: true,
    });
    expect((service as any).decisionView(decision, 'm-other')).toMatchObject({
      createdByMe: false,
      canResolve: true,
      canCancel: false,
    });
  });

  it('forbids a non-creator from cancelling an open decision', async () => {
    const tx: any = {
      householdMembership: {
        findUnique: jest.fn(async () => membership({ id: 'm-other' })),
      },
      householdShoppingDecision: {
        findFirst: jest.fn(async () => ({
          id: 'decision-1',
          householdId: 'h1',
          itemId: 'item-1',
          createdByMembershipId: 'm-creator',
          status: 'OPEN',
          version: 1,
          expiresAt: new Date(Date.now() + 60_000),
          item: { id: 'item-1', status: 'DECISION_PENDING', version: 2 },
        })),
        updateMany: jest.fn(),
      },
      householdShoppingItem: { updateMany: jest.fn() },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    await expect(
      new HouseholdsService(prisma).cancelDecision(
        'u1',
        'h1',
        'decision-1',
        1,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'household_decision_cancel_forbidden',
      }),
    });
    expect(tx.householdShoppingDecision.updateMany).not.toHaveBeenCalled();
    expect(tx.householdShoppingItem.updateMany).not.toHaveBeenCalled();
  });

  it('lets only the creator cancel an open decision and safely replays the terminal result', async () => {
    const originalItem = {
      id: 'item-1',
      householdId: 'h1',
      name: 'milk',
      amount: null,
      unit: null,
      status: 'DECISION_PENDING',
      version: 2,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const openDecision = {
      id: 'decision-1',
      householdId: 'h1',
      itemId: originalItem.id,
      createdByMembershipId: 'm1',
      question: 'choose',
      options: ['yogurt', HOUSEHOLD_SKIP_OPTION],
      selectedOption: null,
      status: 'OPEN',
      activeKey: 'OPEN',
      version: 1,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: NOW,
      resolvedAt: null,
      item: originalItem,
    };
    const neededItem = { ...originalItem, status: 'NEEDED', version: 3 };
    const cancelledDecision = {
      ...openDecision,
      status: 'CANCELLED',
      activeKey: null,
      version: 2,
      resolvedAt: new Date(),
      item: neededItem,
    };
    const firstTx: any = {
      householdMembership: { findUnique: jest.fn(async () => membership()) },
      householdShoppingDecision: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(openDecision)
          .mockResolvedValueOnce(cancelledDecision),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      householdShoppingItem: {
        updateMany: jest.fn(async () => ({ count: 1 })),
        findFirst: jest.fn(async () => neededItem),
      },
      householdAuditEvent: { create: jest.fn(async () => ({})) },
    };
    const replayTx: any = {
      householdMembership: { findUnique: jest.fn(async () => membership()) },
      householdShoppingDecision: {
        findFirst: jest.fn(async () => cancelledDecision),
        updateMany: jest.fn(),
      },
      householdShoppingItem: { updateMany: jest.fn() },
      householdAuditEvent: { create: jest.fn() },
    };
    const prisma: any = {
      $transaction: jest
        .fn()
        .mockImplementationOnce(async (callback: any) => callback(firstTx))
        .mockImplementationOnce(async (callback: any) => callback(replayTx)),
    };
    const service = new HouseholdsService(prisma);

    const cancelled = await service.cancelDecision(
      'u1',
      'h1',
      'decision-1',
      1,
    );
    const replayed = await service.cancelDecision(
      'u1',
      'h1',
      'decision-1',
      1,
    );

    expect(cancelled).toMatchObject({
      item: { id: 'item-1', status: 'NEEDED', version: 3 },
      decision: {
        id: 'decision-1',
        status: 'CANCELLED',
        version: 2,
        createdByMe: true,
        canResolve: false,
        canCancel: false,
      },
    });
    expect(replayed).toEqual(cancelled);
    expect(firstTx.householdShoppingDecision.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdByMembershipId: 'm1',
          status: 'OPEN',
          version: 1,
        }),
        data: expect.objectContaining({
          status: 'CANCELLED',
          activeKey: null,
          version: { increment: 1 },
        }),
      }),
    );
    expect(firstTx.householdShoppingItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'DECISION_PENDING',
          version: 2,
        }),
        data: { status: 'NEEDED', version: { increment: 1 } },
      }),
    );
    expect(firstTx.householdAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'shopping_decision_cancelled' }),
      }),
    );
    expect(replayTx.householdShoppingDecision.updateMany).not.toHaveBeenCalled();
    expect(replayTx.householdAuditEvent.create).not.toHaveBeenCalled();
  });

  it('keeps session conflict recovery authorization and reads in one locked transaction', async () => {
    const activeSession = {
      id: 'session-1',
      status: 'ACTIVE',
      version: 1,
      startedAt: NOW,
      endedAt: null,
    };
    const firstTx: any = {
      householdMembership: { findUnique: jest.fn(async () => membership()) },
      householdShoppingList: { findUnique: jest.fn(async () => ({ id: 'list-1' })) },
      householdShoppingSession: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async () => {
          throw Object.assign(new Error('unique constraint'), { code: 'P2002' });
        }),
      },
    };
    const recoveryTx: any = {
      $queryRaw: jest.fn(async () => []),
      householdMembership: { findUnique: jest.fn(async () => membership()) },
      householdShoppingList: { findUnique: jest.fn(async () => ({ id: 'list-1' })) },
      householdShoppingSession: { findUnique: jest.fn(async () => activeSession) },
    };
    const prisma: any = {
      $transaction: jest
        .fn()
        .mockImplementationOnce(async (callback: any) => callback(firstTx))
        .mockImplementationOnce(async (callback: any) => callback(recoveryTx)),
    };

    await expect(
      new HouseholdsService(prisma).startSession('u1', 'h1'),
    ).resolves.toMatchObject({ session: { id: 'session-1' } });
    expect(recoveryTx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(recoveryTx.householdShoppingSession.findUnique).toHaveBeenCalledTimes(1);
  });
});
