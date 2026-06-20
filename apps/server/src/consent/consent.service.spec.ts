import { ConsentService } from './consent.service';

function make(rows: any[] = []) {
  const created: any[] = [];
  const prisma: any = {
    userConsent: {
      create: jest.fn(async ({ data }: any) => { created.push(data); return { id: 'c1', ...data }; }),
      findMany: jest.fn().mockResolvedValue(rows),
    },
  };
  return { svc: new ConsentService(prisma), prisma, created };
}

describe('ConsentService (L0/B)', () => {
  it('grantPurpose appends a granted, lawful-basis-stamped UserConsent row', async () => {
    const { svc, created } = make();
    await svc.grantPurpose('u1', 'personalization', { source: 'settings', ip: '1.2.3.4' });
    expect(created[0]).toMatchObject({ userId: 'u1', purpose: 'personalization', status: 'granted', lawfulBasis: 'consent', source: 'settings', ip: '1.2.3.4' });
  });

  it('grantedPurposes always includes core and reflects the LATEST decision per purpose', async () => {
    // granted, then later withdrawn → not granted; analytics granted → granted
    const { svc } = make([
      { purpose: 'personalization', status: 'granted' },
      { purpose: 'analytics', status: 'granted' },
      { purpose: 'personalization', status: 'withdrawn' }, // newer (createdAt asc), wins
    ]);
    const g = await svc.grantedPurposes('u1');
    expect([...g].sort()).toEqual(['analytics', 'core']);
  });

  it('hasPurpose is fail-CLOSED for non-core, open for core', async () => {
    const open = make([{ purpose: 'personalization', status: 'granted' }]);
    expect(await open.svc.hasPurpose('u1', 'personalization')).toBe(true);
    expect(await open.svc.hasPurpose('u1', 'core')).toBe(true);
    const closed = make([]); // no rows
    expect(await closed.svc.hasPurpose('u1', 'personalization')).toBe(false);
    expect(await closed.svc.hasPurpose('u1', 'core')).toBe(true); // core never blocked
  });

  it('grantedPurposes is core-only and never throws on a DB error (fail-safe)', async () => {
    const { svc, prisma } = make();
    prisma.userConsent.findMany.mockRejectedValueOnce(new Error('db'));
    expect([...(await svc.grantedPurposes('u1'))]).toEqual(['core']);
  });
});
