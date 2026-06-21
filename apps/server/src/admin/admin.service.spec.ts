import { AdminService, maskPhone, maskEmail } from './admin.service';

describe('admin PII minimization + audit (advisor audit)', () => {
  describe('maskPhone', () => {
    it('masks the middle, keeps first 4 + last 2', () => {
      expect(maskPhone('09123456789')).toBe('0912*****89');
    });
    it('fully masks short values + passes null/empty through', () => {
      expect(maskPhone('12345')).toBe('*****');
      expect(maskPhone(null)).toBeNull();
      expect(maskPhone('')).toBe('');
    });
  });

  describe('maskEmail', () => {
    it('keeps first char + domain, masks the rest', () => {
      expect(maskEmail('ali@gmail.com')).toBe('a***@gmail.com');
    });
    it('handles malformed / null', () => {
      expect(maskEmail('noatsign')).toBe('***');
      expect(maskEmail(null)).toBeNull();
    });
  });

  describe('recordAudit', () => {
    function make() {
      const created: any[] = [];
      const prisma: any = { userEvent: { create: jest.fn(async ({ data }: any) => { created.push(data); return data; }) } };
      return { svc: new AdminService(prisma, {} as any, {} as any), prisma, created };
    }
    it('writes a PII-free admin audit event (adminId + action token + non-PII meta)', () => {
      const { svc, created } = make();
      svc.recordAudit('admin1', 'admin_view', { route: 'users' });
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({ userId: 'admin1', type: 'admin_view' });
      expect(JSON.parse(created[0].payload)).toMatchObject({ admin: true, route: 'users' });
    });
    it('no-ops when there is no admin id (never writes a userless event)', () => {
      const { svc, prisma } = make();
      svc.recordAudit(undefined, 'admin_view');
      expect(prisma.userEvent.create).not.toHaveBeenCalled();
    });
    it('never throws even if the DB write rejects (fire-and-forget)', () => {
      const prisma: any = { userEvent: { create: jest.fn(() => Promise.reject(new Error('db'))) } };
      const svc = new AdminService(prisma, {} as any, {} as any);
      expect(() => svc.recordAudit('admin1', 'admin_view')).not.toThrow();
    });
  });

  // guardian-caught leak: getRecentEvents must NOT return the raw payload/enrichment strings
  describe('getRecentEvents PII', () => {
    it('omits raw payload/enrichment and masks user.phone (keeps derived recipeTitle)', async () => {
      const event = {
        id: 'e1', type: 'search_query', page: '/discover', duration: null, timestamp: new Date(),
        recipeId: null, consentPurpose: 'analytics', sessionId: 's1',
        payload: JSON.stringify({ query: 'something private', recipeId: 'r1' }),
        enrichment: JSON.stringify({ secret: 'x' }),
        user: { name: 'علی', phone: '09123456789' },
      };
      const prisma: any = {
        userEvent: { findMany: jest.fn(async () => [event]), count: jest.fn(async () => 1) },
        recipe: { findMany: jest.fn(async () => [{ id: 'r1', title: 'قورمه' }]) },
      };
      const svc = new AdminService(prisma, {} as any, {} as any);
      const { events } = await svc.getRecentEvents();
      const e = events[0] as any;
      expect(e).not.toHaveProperty('payload'); // raw user text must not cross the wire
      expect(e).not.toHaveProperty('enrichment');
      expect(e.user.phone).toBe('0912*****89'); // masked
      expect(e.recipeTitle).toBe('قورمه'); // derived display value kept
      expect(JSON.stringify(e)).not.toContain('something private');
    });
  });
});
