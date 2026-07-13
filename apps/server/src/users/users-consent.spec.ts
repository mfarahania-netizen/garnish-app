/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../consent/consent.constants';
import { UpdateConsentDto } from './dto/update-consent.dto';
import { UsersService } from './users.service';

function serviceWith(prisma: Record<string, unknown>, consent: Record<string, unknown> = {}) {
  return new UsersService(prisma as never, {} as never, {} as never, consent as never);
}

describe('UsersService canonical consent boundary', () => {
  it('reports stale and legacy optional grants as inactive', async () => {
    const prisma = {
      userConsent: {
        findMany: jest.fn().mockResolvedValue([
          {
            purpose: 'analytics',
            status: 'granted',
            updatedAt: new Date('2026-01-01'),
            source: 'settings',
            policyVersion: 'privacy-stale',
            lawfulBasis: 'consent',
            withdrawnAt: null,
          },
        ]),
      },
      consentLog: {
        findMany: jest.fn().mockResolvedValue([
          { type: 'personalization', purpose: 'personalization', granted: true, updatedAt: new Date('2026-01-01') },
        ]),
      },
    };

    const state = await serviceWith(prisma).getConsentStatus('u1');

    expect(state.purposes.analytics).toMatchObject({
      granted: false,
      status: 'granted',
      policyVersion: 'privacy-stale',
    });
    expect(state.purposes.personalization).toMatchObject({
      granted: false,
      status: 'granted',
      source: 'legacy',
      policyVersion: null,
    });
    expect(state.purposes.analytics.processingEnabled).toBe(false);
    expect(state.purposes.personalization.processingEnabled).toBe(false);
  });

  it('rejects Terms/core and any unknown purpose at the service boundary', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = serviceWith(prisma);

    await expect(service.grantConsent('u1', 'terms', true)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.grantConsent('u1', 'unknown', true)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('writes a current versioned optional decision and returns canonical read-back', async () => {
    const latest = new Map<string, Record<string, unknown>>();
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'u1' }]),
      userConsent: {
        findFirst: jest.fn(async ({ where }: { where: { purpose: string } }) => latest.get(where.purpose) ?? null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          latest.set(String(data.purpose), data);
          return data;
        }),
      },
      consentLog: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      userConsent: {
        findMany: jest.fn(async () => [...latest.values()].map((row) => ({
          ...row,
          updatedAt: new Date('2026-07-12'),
        }))),
      },
      consentLog: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const state = await serviceWith(prisma).grantConsent('u1', 'analytics', true);

    expect(tx.userConsent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        purpose: 'analytics',
        status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        source: 'settings',
      }),
    });
    expect(state.purposes.analytics).toMatchObject({
      granted: true,
      policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      processingEnabled: false,
    });
  });
});

describe('UpdateConsentDto', () => {
  it('rejects malformed, bundled and non-optional decisions', async () => {
    const invalid = Object.assign(new UpdateConsentDto(), { type: 'terms', granted: 'yes' });
    const errors = await validate(invalid);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['type', 'granted']));
  });

  it('accepts only an explicit optional boolean decision', async () => {
    const valid = Object.assign(new UpdateConsentDto(), { type: 'analytics', granted: false });
    await expect(validate(valid)).resolves.toEqual([]);
  });
});
