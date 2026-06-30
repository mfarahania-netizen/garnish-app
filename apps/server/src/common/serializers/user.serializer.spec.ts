import { sanitizeUser, sanitizeUsers } from './user.serializer';

describe('user.serializer (E2)', () => {
  const rawUser = {
    id: 'u1',
    phone: '09123456789',
    name: 'Test',
    email: 'test@example.com',
    avatar: 'a.png',
    isAdmin: false,
    adminRole: 'user',
    createdAt: new Date('2026-01-01'),
    // sensitive — must never survive serialization:
    password: '$2a$10$hashedhashedhashed',
    updatedAt: new Date('2026-02-01'),
  };

  describe('sanitizeUser', () => {
    it('strips password and any non-allow-listed field', () => {
      const safe = sanitizeUser(rawUser) as any;
      expect(safe.password).toBeUndefined();
      expect(safe.updatedAt).toBeUndefined();
    });

    it('keeps the allow-listed safe fields', () => {
      const safe = sanitizeUser(rawUser) as any;
      expect(safe).toEqual({
        id: 'u1',
        phone: '09123456789',
        name: 'Test',
        email: 'test@example.com',
        avatar: 'a.png',
        isAdmin: false,
        adminRole: 'user',
        createdAt: rawUser.createdAt,
      });
    });

    it('returns null for null/undefined input', () => {
      expect(sanitizeUser(null)).toBeNull();
      expect(sanitizeUser(undefined)).toBeNull();
    });

    it('omits fields that are absent (e.g. safe-selected findById without createdAt)', () => {
      const partial = { id: 'u2', phone: '0912', name: null, email: null, avatar: null, isAdmin: true, adminRole: 'admin' };
      const safe = sanitizeUser(partial) as any;
      expect(safe).toEqual(partial);
      expect('createdAt' in safe).toBe(false);
    });
  });

  describe('sanitizeUsers', () => {
    it('sanitizes a list and never leaks password', () => {
      const list = sanitizeUsers([rawUser, rawUser]) as any[];
      expect(list).toHaveLength(2);
      for (const u of list) expect(u.password).toBeUndefined();
    });

    it('returns [] for null/undefined', () => {
      expect(sanitizeUsers(null)).toEqual([]);
      expect(sanitizeUsers(undefined)).toEqual([]);
    });
  });
});
