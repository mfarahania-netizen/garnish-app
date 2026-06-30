// Admin USER management + monitoring (founder mandate: "I must be able to do everything + watch users moment-by-moment").
// The User model + GDPR erasure/export already exist and are solid — this is the ACTION + DOSSIER layer on top.
//
// PII posture: these admin views return REAL phone/email (a support/moderation action needs the real value, and the
// founder is the data controller). Accountability is preserved — the controller wraps every call in recordAudit
// (GDPR Art.30: who accessed/changed whom, when). If staff admins are added later, re-introduce maskPhone/maskEmail.
//
// Real kicks: this app uses STATELESS JWT, so deleting UserSession rows can't actually log anyone out. Ban /
// force-logout / password-reset therefore BUMP user.sessionEpoch — the jwt strategy rejects any token whose epoch
// is stale → a real, immediate kick. We also clear the session rows so the "active sessions" view reflects reality.
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ErasureService } from '../users/erasure/erasure.service';
import { UserExportService } from '../users/export/user-export.service';
import { maskPhone, maskEmail } from './pii.util';
import * as bcrypt from 'bcryptjs';

type ListArgs = { page?: number; limit?: number; search?: string; role?: string; status?: string };

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly erasure: ErasureService,
    private readonly exporter: UserExportService,
  ) {}

  /** Rich, searchable, filterable roster with per-user counts + last-activity (the "monitor users" list). */
  async list({ page = 1, limit = 20, search, role, status }: ListArgs) {
    const where: Prisma.UserWhereInput = {};
    const s = (search ?? '').trim();
    if (s) {
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }
    if (role === 'admin') where.isAdmin = true;
    else if (role === 'guest') where.isGuest = true;
    else if (role === 'registered') { where.isGuest = false; where.isAdmin = false; }
    if (status === 'banned') where.isBanned = true;
    else if (status === 'active') where.isBanned = false;

    const take = Math.min(Math.max(1, limit), 100);
    const skip = (Math.max(1, page) - 1) * take;
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, phone: true, email: true, avatar: true,
          isAdmin: true, isGuest: true, isBanned: true, locale: true, country: true, createdAt: true,
          _count: { select: { events: true, tickets: true, favorites: true, mealPlans: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // last activity = newest event per listed user (one grouped query, not N)
    const ids = rows.map((r) => r.id);
    const last = ids.length
      ? await this.prisma.userEvent.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _max: { timestamp: true } })
      : [];
    const lastMap = new Map(last.map((e) => [e.userId, e._max.timestamp]));
    // P0-5: default-mask PII in the roster (the bulk-exposure surface). Real values via the audited reveal endpoint.
    const data = rows.map((r) => ({ ...r, phone: maskPhone(r.phone), email: maskEmail(r.email), lastActiveAt: lastMap.get(r.id) ?? null }));
    return { data, total, page: Math.max(1, page), limit: take };
  }

  /** Roster headline counts for the KPI row. */
  async stats() {
    const [total, guests, admins, banned] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isGuest: true } }),
      this.prisma.user.count({ where: { isAdmin: true } }),
      this.prisma.user.count({ where: { isBanned: true } }),
    ]);
    return { total, registered: total - guests, guests, admins, banned };
  }

  /** Full per-user dossier for the detail drawer: identity, preferences, allergies, sessions, recent activity, counts. */
  async detail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, phone: true, email: true, avatar: true,
        isAdmin: true, isGuest: true, isBanned: true, bannedAt: true, banReason: true,
        locale: true, country: true, createdAt: true, updatedAt: true,
        preferences: { select: { diet: true, skillLevel: true, budget: true, updatedAt: true } },
        allergies: { select: { allergy: { select: { name: true } } } },
        cuisines: { select: { cuisine: { select: { name: true } } } },
        healthGoals: { select: { healthGoal: { select: { name: true } } } },
        _count: { select: { events: true, tickets: true, favorites: true, mealPlans: true, recipes: true, sessions: true } },
      },
    });
    if (!user) throw new NotFoundException('user_not_found');

    const [sessions, recentEvents] = await Promise.all([
      this.prisma.userSession.findMany({ where: { userId: id }, orderBy: { startTime: 'desc' }, take: 10 }),
      this.prisma.userEvent.findMany({
        where: { userId: id }, orderBy: { timestamp: 'desc' }, take: 20,
        select: { id: true, type: true, timestamp: true, page: true, recipeId: true },
      }),
    ]);
    return {
      ...user,
      phone: maskPhone(user.phone), // P0-5: masked by default; real value via the audited reveal endpoint
      email: maskEmail(user.email),
      // P1-4 (re-audit): allergy + health-goal data is MORE sensitive than contact — return COUNTS by default,
      // never the named lists (the names are health-sensitive and need a role-gated reveal, not an auto-return to
      // every admin). Cuisine taste is not health-sensitive, so it stays.
      allergiesCount: user.allergies.length,
      healthGoalsCount: user.healthGoals.length,
      allergies: [] as string[], // redacted — count is in allergiesCount
      healthGoals: [] as string[], // redacted — count is in healthGoalsCount
      cuisines: user.cuisines.map((c) => c.cuisine.name),
      sessions,
      activeSessions: sessions.filter((x) => !x.endTime).length,
      recentEvents,
    };
  }

  /** Reveal the REAL phone/email for ONE user (advisor P0-5) — only via the audited, reason-gated reveal endpoint. */
  async reveal(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true, phone: true, email: true } });
    if (!u) throw new NotFoundException('user_not_found');
    return u;
  }

  /** Create a user from admin (staff/manual). Friendly uniqueness errors instead of a raw P2002. */
  async create(body: { phone?: string; email?: string; name?: string; password?: string; isAdmin?: boolean }) {
    const phone = body.phone?.trim() || null;
    const email = body.email?.trim() || null;
    if (!phone && !email) throw new BadRequestException('phone_or_email_required');
    if (!body.password || body.password.length < 6) throw new BadRequestException('password_min_6');
    if (phone && (await this.prisma.user.findUnique({ where: { phone } }))) throw new BadRequestException('phone_taken');
    if (email && (await this.prisma.user.findUnique({ where: { email } }))) throw new BadRequestException('email_taken');
    const password = await bcrypt.hash(body.password, 10);
    return this.prisma.user.create({
      data: { phone, email, name: body.name?.trim() || null, password, isAdmin: !!body.isAdmin, isGuest: false },
      select: { id: true, name: true, phone: true, email: true, isAdmin: true, createdAt: true },
    });
  }

  /** Update profile + role. */
  async update(id: string, body: { name?: string; email?: string; isAdmin?: boolean }) {
    await this.ensureExists(id);
    const data: Prisma.UserUncheckedUpdateInput = {};
    if (body.name !== undefined) data.name = body.name?.trim() || null;
    if (body.isAdmin !== undefined) data.isAdmin = !!body.isAdmin;
    // keep the email as a plain value so it can ALSO be used in a WHERE filter below — reading `data.email` back
    // is typed as an UpdateInput operation, not a filter, so narrow it here instead.
    const email = body.email !== undefined ? (body.email?.trim() || null) : undefined;
    if (email !== undefined) data.email = email;
    if (email) {
      const clash = await this.prisma.user.findFirst({ where: { email, NOT: { id } }, select: { id: true } });
      if (clash) throw new BadRequestException('email_taken');
    }
    return this.prisma.user.update({ where: { id }, data, select: { id: true, name: true, email: true, isAdmin: true } });
  }

  /** Reset a user's password (admin recovery). Bumps the epoch + clears sessions → forces re-login everywhere. */
  async resetPassword(id: string, newPassword: string) {
    await this.ensureExists(id);
    if (!newPassword || newPassword.length < 6) throw new BadRequestException('password_min_6');
    const password = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id }, data: { password, sessionEpoch: { increment: 1 } } });
    await this.prisma.userSession.deleteMany({ where: { userId: id } });
    return { ok: true };
  }

  /** Ban/unban. Banning bumps the epoch + clears sessions → the user is kicked immediately and can't log back in. */
  async setBanned(id: string, banned: boolean, reason?: string) {
    await this.ensureExists(id);
    const data: Prisma.UserUncheckedUpdateInput = banned
      ? { isBanned: true, bannedAt: new Date(), banReason: reason?.trim() || null, sessionEpoch: { increment: 1 } }
      : { isBanned: false, bannedAt: null, banReason: null };
    const u = await this.prisma.user.update({ where: { id }, data, select: { id: true, isBanned: true, bannedAt: true, banReason: true } });
    if (banned) await this.prisma.userSession.deleteMany({ where: { userId: id } });
    return u;
  }

  /** Force-logout: bump the epoch (invalidate live JWTs) + clear session rows. */
  async forceLogout(id: string) {
    await this.ensureExists(id);
    await this.prisma.user.update({ where: { id }, data: { sessionEpoch: { increment: 1 } } });
    const { count } = await this.prisma.userSession.deleteMany({ where: { userId: id } });
    return { ok: true, revoked: count };
  }

  /** Hard delete = GDPR erasure (the existing transactional path), actor=admin. */
  async remove(id: string) {
    await this.ensureExists(id);
    return this.erasure.eraseUser(id, { actorType: 'admin' });
  }

  async sessions(id: string) {
    await this.ensureExists(id);
    return this.prisma.userSession.findMany({ where: { userId: id }, orderBy: { startTime: 'desc' }, take: 50 });
  }

  /** GDPR export of a user's full data (admin-triggered, for a support/compliance request). */
  async export(id: string) {
    await this.ensureExists(id);
    return this.exporter.exportUser(id);
  }

  private async ensureExists(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!u) throw new NotFoundException('user_not_found');
  }
}
