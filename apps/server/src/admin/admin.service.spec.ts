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
});
