import { UserFactService, SensitiveFactRejectedError } from './user-fact.service';

function makeService() {
  const upsert = jest.fn().mockResolvedValue({ id: 'f1' });
  const findUnique = jest.fn().mockResolvedValue({ id: 'f1', key: 'preferred_cuisine', value: 'persian' });
  const findMany = jest.fn().mockResolvedValue([{ id: 'f1' }]);
  const prisma = { userFact: { upsert, findUnique, findMany } } as any;
  return { svc: new UserFactService(prisma), upsert, findUnique, findMany };
}

describe('UserFactService', () => {
  it('upserts a non-sensitive preference fact', async () => {
    const { svc, upsert } = makeService();
    const out = await svc.upsert({ userId: 'u1', key: 'preferred_cuisine', value: 'persian', source: 'ai_chat', confidence: 0.8 });
    expect(out).toEqual({ id: 'f1' });
    expect(upsert.mock.calls[0][0]).toMatchObject({ where: { userId_key: { userId: 'u1', key: 'preferred_cuisine' } } });
    expect(upsert.mock.calls[0][0].create).toMatchObject({ userId: 'u1', key: 'preferred_cuisine', source: 'ai_chat' });
  });

  it('REJECTS sensitive health/medical/allergy facts (not stored)', async () => {
    const { svc, upsert } = makeService();
    for (const key of ['allergy_peanut', 'health_goal', 'medical_condition', 'has_diabetes', 'blood_pressure']) {
      expect(svc.isSensitiveKey(key)).toBe(true);
      await expect(svc.upsert({ userId: 'u1', key, value: true, source: 'ai_chat' })).rejects.toBeInstanceOf(SensitiveFactRejectedError);
    }
    expect(upsert).not.toHaveBeenCalled();
  });

  it('reads a fact by key and lists facts for a user', async () => {
    const { svc, findUnique, findMany } = makeService();
    const f = await svc.get('u1', 'preferred_cuisine');
    expect(f).toMatchObject({ key: 'preferred_cuisine' });
    expect(findUnique.mock.calls[0][0]).toMatchObject({ where: { userId_key: { userId: 'u1', key: 'preferred_cuisine' } } });
    const all = await svc.listByUser('u1');
    expect(all).toHaveLength(1);
    expect(findMany.mock.calls[0][0]).toMatchObject({ where: { userId: 'u1' } });
  });
});
