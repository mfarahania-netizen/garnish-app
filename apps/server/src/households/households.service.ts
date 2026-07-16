import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { normalizeIranMobile } from '../common/phone-normalization';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateHouseholdDto,
  CreateHouseholdInviteDto,
  CreateHouseholdShoppingItemDto,
  MarkHouseholdItemUnavailableDto,
  ResolveHouseholdDecisionDto,
  TransferHouseholdOwnerDto,
  UpdateHouseholdShoppingItemDto,
} from './dto/household.dto';
import { householdV1Enabled } from './household-v1.features';

type Db = PrismaService | Prisma.TransactionClient;

const MAX_HOUSEHOLDS_PER_USER = 3;
const MAX_ACTIVE_MEMBERS = 8;
const MAX_PENDING_INVITES = 10;
const MAX_ACTIVE_ITEMS = 200;
const MAX_RECENT_TERMINAL_ITEMS = 50;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DECISION_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const HOUSEHOLD_SKIP_OPTION = 'فعلاً نخر';

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashRequest(operation: string, payload: unknown): string {
  return createHash('sha256')
    .update(`${operation}:${stableJson(payload)}`)
    .digest('hex');
}

function isPrismaCode(error: unknown, code: string): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    (error as { code?: string }).code === code,
  );
}

@Injectable()
export class HouseholdsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    this.ensureEnabled();
    const memberships = await this.prisma.householdMembership.findMany({
      where: { userId, status: 'ACTIVE', household: { status: 'ACTIVE' } },
      include: {
        household: {
          include: {
            _count: {
              select: { memberships: { where: { status: 'ACTIVE' } } },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
    return {
      households: memberships.map((membership) => ({
        id: membership.household.id,
        name: membership.household.name,
        role: membership.role,
        status: membership.household.status,
        memberCount: membership.household._count.memberships,
        version: membership.household.version,
        createdAt: membership.household.createdAt,
      })),
    };
  }

  async create(
    userId: string,
    idempotencyKey: string | undefined,
    dto: CreateHouseholdDto,
  ) {
    this.ensureEnabled();
    const key = this.idempotencyKey(idempotencyKey);
    await this.requireDurableUser(this.prisma, userId, true);
    const name = this.cleanText(dto.name, 80, 'household_name_invalid');
    const operation = 'household.create';
    const requestHash = hashRequest(operation, { name });
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      await this.requireDurableUser(tx, userId, true);
      const now = new Date();
      await tx.householdIdempotency.deleteMany({
        where: { expiresAt: { lte: now } },
      });
      const existing = await tx.householdIdempotency.findUnique({
        where: {
          principalUserId_operation_key: {
            principalUserId: userId,
            operation,
            key,
          },
        },
      });
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new ConflictException({ code: 'idempotency_key_reused' });
        }
        const response = existing.response as { householdId?: unknown } | null;
        if (
          existing.state !== 'COMPLETED' ||
          !existing.householdId ||
          response?.householdId !== existing.householdId
        ) {
          throw new ConflictException({ code: 'idempotency_in_progress' });
        }
        return { householdId: existing.householdId, replayed: true };
      }
      const count = await tx.householdMembership.count({
        where: { userId, status: 'ACTIVE', household: { status: 'ACTIVE' } },
      });
      if (count >= MAX_HOUSEHOLDS_PER_USER) {
        throw new ConflictException({ code: 'household_limit_reached' });
      }
      await tx.householdIdempotency.create({
        data: {
          principalUserId: userId,
          operation,
          key,
          requestHash,
          expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        },
      });
      const household = await tx.household.create({
        data: { name, ownerUserId: userId },
      });
      const membership = await tx.householdMembership.create({
        data: { householdId: household.id, userId, role: 'OWNER' },
      });
      await tx.householdShoppingList.create({
        data: { householdId: household.id },
      });
      await this.audit(
        tx,
        household.id,
        membership.id,
        'household_created',
        'household',
        household.id,
      );
      const response = { householdId: household.id };
      await tx.householdIdempotency.update({
        where: {
          principalUserId_operation_key: {
            principalUserId: userId,
            operation,
            key,
          },
        },
        data: {
          householdId: household.id,
          state: 'COMPLETED',
          response,
        },
      });
      return { householdId: household.id, replayed: false };
    });
    const detail = await this.get(userId, result.householdId);
    return { ...detail, replayed: result.replayed };
  }

  async pendingInvites(userId: string) {
    this.ensureEnabled();
    const phone = await this.verifiedUserPhone(this.prisma, userId);
    if (!phone) return { invites: [] };
    const now = new Date();
    const digest = this.phoneDigest(phone);
    const invites = await this.prisma.$transaction(async (tx) => {
      await tx.householdInvite.updateMany({
        where: {
          targetPhoneDigest: digest,
          status: 'PENDING',
          expiresAt: { lte: now },
        },
        data: { status: 'EXPIRED', activeKey: null, targetPhoneDigest: null },
      });
      return tx.householdInvite.findMany({
        where: {
          targetPhoneDigest: digest,
          status: 'PENDING',
          expiresAt: { gt: now },
        },
        include: {
          household: { select: { id: true, name: true } },
          createdByMembership: { include: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });
    return {
      invites: invites.map((invite) => ({
        id: invite.id,
        household: invite.household,
        invitedBy: { name: invite.createdByMembership?.user?.name ?? null },
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      })),
    };
  }

  async invite(
    userId: string,
    householdId: string,
    dto: CreateHouseholdInviteDto,
  ) {
    this.ensureEnabled();
    const phone = this.canonicalPhone(dto.phone);
    const digest = this.phoneDigest(phone);
    const result = await this.prisma.$transaction(async (tx) => {
      const actor = await this.requireMembership(tx, userId, householdId);
      this.requireOwner(actor);
      // A benign write serializes capacity checks and invite creation per household.
      await tx.household.update({
        where: { id: householdId },
        data: { updatedAt: new Date() },
      });
      const now = new Date();
      await tx.householdInvite.updateMany({
        where: { householdId, status: 'PENDING', expiresAt: { lte: now } },
        data: { status: 'EXPIRED', activeKey: null, targetPhoneDigest: null },
      });
      const [activeMembers, pendingInvites] = await Promise.all([
        tx.householdMembership.count({
          where: { householdId, status: 'ACTIVE' },
        }),
        tx.householdInvite.count({
          where: { householdId, status: 'PENDING', expiresAt: { gt: now } },
        }),
      ]);
      if (activeMembers >= MAX_ACTIVE_MEMBERS) {
        throw new ConflictException({ code: 'household_member_limit_reached' });
      }
      if (pendingInvites >= MAX_PENDING_INVITES) {
        throw new ConflictException({ code: 'household_invite_limit_reached' });
      }
      if (
        digest === this.phoneDigest((await this.userPhone(tx, userId)) ?? '')
      ) {
        throw new ConflictException({ code: 'household_invite_not_available' });
      }
      const targetUser = await tx.user.findUnique({
        where: { phone },
        select: { id: true },
      });
      if (targetUser) {
        const targetMembership = await tx.householdMembership.findUnique({
          where: { householdId_userId: { householdId, userId: targetUser.id } },
          select: { status: true },
        });
        if (targetMembership?.status === 'ACTIVE') {
          throw new ConflictException({
            code: 'household_invite_not_available',
          });
        }
      }
      const existing = await tx.householdInvite.findUnique({
        where: {
          householdId_targetPhoneDigest_activeKey: {
            householdId,
            targetPhoneDigest: digest,
            activeKey: 'PENDING',
          },
        },
      });
      const invite =
        existing ??
        (await tx.householdInvite.create({
          data: {
            householdId,
            createdByMembershipId: actor.id,
            targetPhoneDigest: digest,
            targetDigestKeyVersion: 1,
            expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
          },
        }));
      if (!existing) {
        await this.audit(
          tx,
          householdId,
          actor.id,
          'invite_created',
          'invite',
          invite.id,
        );
      }
      return invite;
    });
    return { invite: this.inviteView(result) };
  }

  async outgoingInvites(userId: string, householdId: string) {
    this.ensureEnabled();
    const invites = await this.prisma.$transaction(async (tx) => {
      const actor = await this.requireMembership(tx, userId, householdId);
      this.requireOwner(actor);
      const now = new Date();
      await tx.householdInvite.updateMany({
        where: { householdId, status: 'PENDING', expiresAt: { lte: now } },
        data: { status: 'EXPIRED', activeKey: null, targetPhoneDigest: null },
      });
      return tx.householdInvite.findMany({
        where: { householdId, status: 'PENDING', expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
        take: MAX_PENDING_INVITES,
      });
    });
    return { invites: invites.map((invite) => this.inviteView(invite)) };
  }

  async revokeInvite(userId: string, householdId: string, inviteId: string) {
    this.ensureEnabled();
    const invite = await this.prisma.$transaction(async (tx) => {
      const actor = await this.requireMembership(tx, userId, householdId);
      this.requireOwner(actor);
      const current = await tx.householdInvite.findFirst({
        where: { id: inviteId, householdId },
      });
      if (!current) throw this.householdNotFound();
      if (current.status === 'REVOKED') return current;
      if (current.status !== 'PENDING') {
        throw new ConflictException({ code: 'household_invite_closed' });
      }
      const changed = await tx.householdInvite.updateMany({
        where: { id: inviteId, householdId, status: 'PENDING' },
        data: { status: 'REVOKED', activeKey: null, targetPhoneDigest: null },
      });
      if (changed.count !== 1)
        throw new ConflictException({ code: 'household_invite_conflict' });
      const revoked = await tx.householdInvite.findFirst({
        where: { id: inviteId, householdId },
      });
      if (!revoked) throw this.householdNotFound();
      await this.audit(
        tx,
        householdId,
        actor.id,
        'invite_revoked',
        'invite',
        inviteId,
      );
      return revoked;
    });
    return { invite: this.inviteView(invite) };
  }

  async acceptInvite(userId: string, inviteId: string) {
    this.ensureEnabled();
    await this.requireDurableUser(this.prisma, userId);
    const householdId = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      await this.requireDurableUser(tx, userId);
      const phone = await this.verifiedUserPhone(tx, userId);
      if (!phone) throw this.inviteNotFound();
      const digest = this.phoneDigest(phone);
      const now = new Date();
      const invite = await tx.householdInvite.findFirst({
        where: {
          id: inviteId,
          targetPhoneDigest: digest,
          status: 'PENDING',
          expiresAt: { gt: now },
        },
        select: { id: true, householdId: true },
      });
      if (!invite) throw this.inviteNotFound();
      await tx.household.update({
        where: { id: invite.householdId },
        data: { updatedAt: now },
      });
      const activeMembers = await tx.householdMembership.count({
        where: { householdId: invite.householdId, status: 'ACTIVE' },
      });
      if (activeMembers >= MAX_ACTIVE_MEMBERS) {
        throw new ConflictException({ code: 'household_member_limit_reached' });
      }
      const activeHouseholds = await tx.householdMembership.count({
        where: { userId, status: 'ACTIVE', household: { status: 'ACTIVE' } },
      });
      if (activeHouseholds >= MAX_HOUSEHOLDS_PER_USER) {
        throw new ConflictException({ code: 'household_limit_reached' });
      }
      const consumed = await tx.householdInvite.updateMany({
        where: {
          id: invite.id,
          targetPhoneDigest: digest,
          status: 'PENDING',
          expiresAt: { gt: now },
        },
        data: {
          status: 'ACCEPTED',
          activeKey: null,
          targetPhoneDigest: null,
          consumedAt: now,
          consumedByUserId: userId,
        },
      });
      if (consumed.count !== 1) throw this.inviteNotFound();
      const membership = await tx.householdMembership.upsert({
        where: {
          householdId_userId: { householdId: invite.householdId, userId },
        },
        create: { householdId: invite.householdId, userId, role: 'MEMBER' },
        update: {
          role: 'MEMBER',
          status: 'ACTIVE',
          endedAt: null,
          version: { increment: 1 },
        },
      });
      await this.audit(
        tx,
        invite.householdId,
        membership.id,
        'invite_accepted',
        'invite',
        invite.id,
      );
      return invite.householdId;
    });
    return this.get(userId, householdId);
  }

  async declineInvite(userId: string, inviteId: string) {
    this.ensureEnabled();
    const phone = await this.verifiedUserPhone(this.prisma, userId);
    if (!phone) throw this.inviteNotFound();
    const digest = this.phoneDigest(phone);
    const invite = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const current = await tx.householdInvite.findFirst({
        where: {
          id: inviteId,
          targetPhoneDigest: digest,
          status: 'PENDING',
          expiresAt: { gt: now },
        },
      });
      if (!current) throw this.inviteNotFound();
      const updated = await tx.householdInvite.updateMany({
        where: {
          id: current.id,
          targetPhoneDigest: digest,
          status: 'PENDING',
          expiresAt: { gt: now },
        },
        data: {
          status: 'DECLINED',
          activeKey: null,
          targetPhoneDigest: null,
          consumedAt: now,
          consumedByUserId: userId,
        },
      });
      if (updated.count !== 1) throw this.inviteNotFound();
      await this.audit(
        tx,
        current.householdId,
        null,
        'invite_declined',
        'invite',
        current.id,
      );
      return { ...current, status: 'DECLINED' as const };
    });
    return { invite: this.inviteView(invite) };
  }

  async get(userId: string, householdId: string) {
    this.ensureEnabled();
    return this.prisma.$transaction(async (tx) => {
      const actor = await this.requireMembership(tx, userId, householdId);
      const members = await tx.householdMembership.findMany({
        where: { householdId, status: 'ACTIVE' },
        include: { user: { select: { id: true, name: true } } },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      });
      return this.householdDetail(actor, members);
    });
  }

  async shopping(userId: string, householdId: string) {
    this.ensureEnabled();
    return this.prisma.$transaction(async (tx) => {
      const actor = await this.requireMembership(tx, userId, householdId);
      await this.reconcileExpiredDecisions(tx, householdId);
      const list = await tx.householdShoppingList.findUnique({
        where: { householdId },
        include: {
          sessions: { where: { status: 'ACTIVE' }, take: 1 },
        },
      });
      if (!list) throw this.householdNotFound();
      const activeItems = await tx.householdShoppingItem.findMany({
        where: {
          householdId,
          listId: list.id,
          status: { notIn: ['BOUGHT', 'SKIPPED', 'REMOVED'] },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        take: MAX_ACTIVE_ITEMS,
      });
      const recentTerminalItems = await tx.householdShoppingItem.findMany({
        where: {
          householdId,
          listId: list.id,
          status: { in: ['BOUGHT', 'SKIPPED'] },
        },
        orderBy: { updatedAt: 'desc' },
        take: MAX_RECENT_TERMINAL_ITEMS,
      });
      const decisions = await tx.householdShoppingDecision.findMany({
        where: { householdId, status: 'OPEN', expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'asc' },
      });
      return {
        householdId,
        list: { id: list.id, name: list.name, version: list.version },
        items: [...activeItems, ...recentTerminalItems].map((item) =>
          this.itemView(item),
        ),
        activeSession: list.sessions[0]
          ? this.sessionView(list.sessions[0])
          : null,
        openDecisions: decisions.map((decision) =>
          this.decisionView(decision, actor.id),
        ),
      };
    });
  }

  async addItem(
    userId: string,
    householdId: string,
    idempotencyKey: string | undefined,
    dto: CreateHouseholdShoppingItemDto,
  ) {
    this.ensureEnabled();
    const key = this.idempotencyKey(idempotencyKey);
    const name = this.cleanText(dto.name, 120, 'shopping_item_name_invalid');
    const normalizedKey = this.semanticText(name);
    const activeSemanticKey = `v1:${normalizedKey}`;
    const normalized = {
      householdId,
      name,
      amount: this.optionalText(dto.amount, 40),
      unit: this.optionalText(dto.unit, 30),
      activeSemanticKey,
    };
    const operation = 'shopping.item.create';
    const requestHash = hashRequest(operation, normalized);
    const replay = await this.idempotencyReplay(
      userId,
      householdId,
      operation,
      key,
      requestHash,
    );
    if (replay) return { ...replay, replayed: true };
    try {
      return await this.prisma.$transaction(async (tx) => {
        const actor = await this.requireMembership(tx, userId, householdId);
        const count = await tx.householdShoppingItem.count({
          where: {
            householdId,
            status: { notIn: ['BOUGHT', 'SKIPPED', 'REMOVED'] },
          },
        });
        if (count >= MAX_ACTIVE_ITEMS)
          throw new ConflictException({ code: 'shopping_item_limit_reached' });
        await tx.householdIdempotency.deleteMany({
          where: { expiresAt: { lte: new Date() } },
        });
        await tx.householdIdempotency.create({
          data: {
            principalUserId: userId,
            householdId,
            operation,
            key,
            requestHash,
            expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
          },
        });
        const list = await tx.householdShoppingList.findUnique({
          where: { householdId },
        });
        if (!list) throw this.householdNotFound();
        const item = await tx.householdShoppingItem.create({
          data: {
            householdId,
            listId: list.id,
            name,
            normalizedKey,
            activeSemanticKey,
            amount: normalized.amount,
            unit: normalized.unit,
          },
        });
        const response = { item: this.itemView(item) };
        await tx.householdIdempotency.update({
          where: {
            principalUserId_operation_key: {
              principalUserId: userId,
              operation,
              key,
            },
          },
          data: { state: 'COMPLETED', response },
        });
        await this.audit(
          tx,
          householdId,
          actor.id,
          'shopping_item_added',
          'shopping_item',
          item.id,
        );
        return { ...response, replayed: false };
      });
    } catch (error) {
      if (isPrismaCode(error, 'P2002')) {
        const concurrent = await this.idempotencyReplay(
          userId,
          householdId,
          operation,
          key,
          requestHash,
        );
        if (concurrent) return { ...concurrent, replayed: true };
        throw new ConflictException({ code: 'shopping_item_already_exists' });
      }
      throw error;
    }
  }

  async updateItem(
    userId: string,
    householdId: string,
    itemId: string,
    dto: UpdateHouseholdShoppingItemDto,
  ) {
    this.ensureEnabled();
    return this.prisma
      .$transaction(async (tx) => {
        const actor = await this.requireMembership(tx, userId, householdId);
        const current = await this.scopedItem(tx, householdId, itemId);
        this.requireVersion(dto.version, current.version);
        if (
          !['NEEDED', 'BOUGHT', 'SUBSTITUTION_APPROVED'].includes(
            current.status,
          )
        ) {
          throw new ConflictException({
            code: 'shopping_item_transition_invalid',
            currentVersion: current.version,
          });
        }
        if (
          current.status === 'SUBSTITUTION_APPROVED' &&
          dto.status &&
          dto.status !== 'BOUGHT'
        ) {
          throw new ConflictException({
            code: 'shopping_item_transition_invalid',
            currentVersion: current.version,
          });
        }
        const name =
          dto.name === undefined
            ? current.name
            : this.cleanText(dto.name, 120, 'shopping_item_name_invalid');
        const normalizedKey = this.semanticText(name);
        const nextStatus = dto.status ?? current.status;
        const terminal = ['BOUGHT', 'SKIPPED', 'REMOVED'].includes(nextStatus);
        const updated = await tx.householdShoppingItem.updateMany({
          where: { id: itemId, householdId, version: dto.version },
          data: {
            name,
            normalizedKey,
            activeSemanticKey: terminal ? null : `v1:${normalizedKey}`,
            ...(dto.amount !== undefined
              ? { amount: this.optionalText(dto.amount, 40) }
              : {}),
            ...(dto.unit !== undefined
              ? { unit: this.optionalText(dto.unit, 30) }
              : {}),
            status: nextStatus,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          await this.throwItemRace(tx, householdId, itemId);
        const item = await this.scopedItem(tx, householdId, itemId);
        await this.audit(
          tx,
          householdId,
          actor.id,
          'shopping_item_updated',
          'shopping_item',
          item.id,
          {
            status: item.status,
          },
        );
        return { item: this.itemView(item), replayed: false };
      })
      .catch((error) => {
        if (isPrismaCode(error, 'P2002'))
          throw new ConflictException({ code: 'shopping_item_already_exists' });
        throw error;
      });
  }

  async deleteItem(
    userId: string,
    householdId: string,
    itemId: string,
    version: number,
  ) {
    this.ensureEnabled();
    this.validVersion(version);
    return this.prisma.$transaction(async (tx) => {
      const actor = await this.requireMembership(tx, userId, householdId);
      const current = await this.scopedItem(tx, householdId, itemId);
      this.requireVersion(version, current.version);
      if (current.status === 'DECISION_PENDING') {
        throw new ConflictException({ code: 'shopping_decision_open', currentVersion: current.version });
      }
      const updated = await tx.householdShoppingItem.updateMany({
        where: { id: itemId, householdId, version, status: { not: 'REMOVED' } },
        data: {
          status: 'REMOVED',
          activeSemanticKey: null,
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        await this.throwItemRace(tx, householdId, itemId);
      const item = await this.scopedItem(tx, householdId, itemId);
      await this.audit(
        tx,
        householdId,
        actor.id,
        'shopping_item_removed',
        'shopping_item',
        item.id,
      );
      return {
        item: { id: item.id, status: item.status, version: item.version },
      };
    });
  }

  async markUnavailable(
    userId: string,
    householdId: string,
    itemId: string,
    dto: MarkHouseholdItemUnavailableDto,
  ) {
    this.ensureEnabled();
    const alternative = this.cleanText(
      dto.alternative,
      80,
      'shopping_alternative_invalid',
    );
    if (alternative === HOUSEHOLD_SKIP_OPTION) {
      throw new BadRequestException({ code: 'shopping_alternative_reserved' });
    }
    return this.prisma
      .$transaction(async (tx) => {
        const actor = await this.requireMembership(tx, userId, householdId);
        const item = await this.scopedItem(tx, householdId, itemId);
        this.requireVersion(dto.version, item.version);
        if (!['NEEDED', 'SUBSTITUTION_APPROVED'].includes(item.status)) {
          throw new ConflictException({
            code: 'shopping_item_transition_invalid',
            currentVersion: item.version,
          });
        }
        const activeMembers = await tx.householdMembership.count({
          where: { householdId, status: 'ACTIVE' },
        });
        if (activeMembers < 2) {
          throw new ConflictException({
            code: 'household_decision_requires_other_member',
          });
        }
        const changed = await tx.householdShoppingItem.updateMany({
          where: {
            id: item.id,
            householdId,
            version: dto.version,
            status: { in: ['NEEDED', 'SUBSTITUTION_APPROVED'] },
          },
          data: { status: 'DECISION_PENDING', version: { increment: 1 } },
        });
        if (changed.count !== 1)
          await this.throwItemRace(tx, householdId, itemId);
        const decision = await tx.householdShoppingDecision.create({
          data: {
            householdId,
            itemId: item.id,
            createdByMembershipId: actor.id,
            question: `«${item.name}» موجود نیست؛ کدام انتخاب بهتر است؟`,
            options: [alternative, HOUSEHOLD_SKIP_OPTION],
            expiresAt: new Date(Date.now() + DECISION_TTL_MS),
          },
        });
        const updatedItem = await this.scopedItem(tx, householdId, itemId);
        await this.audit(
          tx,
          householdId,
          actor.id,
          'shopping_item_unavailable',
          'shopping_decision',
          decision.id,
        );
        return {
          item: this.itemView(updatedItem),
          decision: this.decisionView(decision, actor.id),
        };
      })
      .catch((error) => {
        if (isPrismaCode(error, 'P2002'))
          throw new ConflictException({
            code: 'shopping_decision_already_open',
          });
        throw error;
      });
  }

  async resolveDecision(
    userId: string,
    householdId: string,
    decisionId: string,
    dto: ResolveHouseholdDecisionDto,
  ) {
    this.ensureEnabled();
    const selectedOption = this.cleanText(
      dto.selectedOption,
      80,
      'shopping_decision_option_invalid',
    );
    return this.prisma
      .$transaction(async (tx) => {
        const actor = await this.requireMembership(tx, userId, householdId);
        const decision = await tx.householdShoppingDecision.findFirst({
          where: { id: decisionId, householdId },
          include: { item: true },
        });
        if (!decision) throw this.householdNotFound();
        if (decision.createdByMembershipId === actor.id) {
          throw new ConflictException({
            code: 'household_decision_self_resolution_forbidden',
          });
        }
        this.requireVersion(dto.version, decision.version);
        if (decision.status !== 'OPEN' || decision.expiresAt <= new Date()) {
          throw new ConflictException({
            code: 'shopping_decision_closed',
            currentVersion: decision.version,
          });
        }
        const options = this.stringArray(decision.options);
        if (!options.includes(selectedOption)) {
          throw new BadRequestException({
            code: 'shopping_decision_option_invalid',
          });
        }
        const decisionUpdated = await tx.householdShoppingDecision.updateMany({
          where: {
            id: decision.id,
            householdId,
            status: 'OPEN',
            version: dto.version,
          },
          data: {
            status: 'RESOLVED',
            activeKey: null,
            selectedOption,
            resolvedByMembershipId: actor.id,
            resolvedAt: new Date(),
            version: { increment: 1 },
          },
        });
        if (decisionUpdated.count !== 1) {
          throw new ConflictException({
            code: 'shopping_decision_conflict',
            currentVersion: decision.version,
          });
        }
        const skip = selectedOption === HOUSEHOLD_SKIP_OPTION;
        const selectedNormalizedKey = skip
          ? decision.item.normalizedKey
          : this.semanticText(selectedOption);
        const itemUpdated = await tx.householdShoppingItem.updateMany({
          where: {
            id: decision.itemId,
            householdId,
            status: 'DECISION_PENDING',
            version: decision.item.version,
          },
          data: {
            name: skip ? decision.item.name : selectedOption,
            normalizedKey: selectedNormalizedKey,
            status: skip ? 'SKIPPED' : 'SUBSTITUTION_APPROVED',
            activeSemanticKey: skip ? null : `v1:${selectedNormalizedKey}`,
            version: { increment: 1 },
          },
        });
        if (itemUpdated.count !== 1)
          await this.throwItemRace(tx, householdId, decision.itemId);
        const [resolved, item] = await Promise.all([
          tx.householdShoppingDecision.findFirst({
            where: { id: decision.id, householdId },
          }),
          this.scopedItem(tx, householdId, decision.itemId),
        ]);
        if (!resolved) throw this.householdNotFound();
        await this.audit(
          tx,
          householdId,
          actor.id,
          'shopping_decision_resolved',
          'shopping_decision',
          decision.id,
          {
            outcome: skip ? 'SKIP' : 'SUBSTITUTE',
          },
        );
        return {
          item: this.itemView(item),
          decision: this.decisionView(resolved, actor.id),
        };
      })
      .catch((error) => {
        if (isPrismaCode(error, 'P2002')) {
          throw new ConflictException({ code: 'shopping_item_already_exists' });
        }
        throw error;
      });
  }

  async cancelDecision(
    userId: string,
    householdId: string,
    decisionId: string,
    version: number,
  ) {
    this.ensureEnabled();
    this.validVersion(version);
    return this.prisma.$transaction(async (tx) => {
      const actor = await this.requireMembership(tx, userId, householdId);
      const decision = await tx.householdShoppingDecision.findFirst({
        where: { id: decisionId, householdId },
        include: { item: true },
      });
      if (!decision) throw this.householdNotFound();
      if (decision.createdByMembershipId !== actor.id) {
        throw new ForbiddenException({
          code: 'household_decision_cancel_forbidden',
        });
      }
      if (decision.status === 'CANCELLED') {
        return {
          item: this.itemView(decision.item),
          decision: this.decisionView(decision, actor.id),
        };
      }
      if (decision.status !== 'OPEN' || decision.expiresAt <= new Date()) {
        throw new ConflictException({
          code: 'shopping_decision_closed',
          currentVersion: decision.version,
        });
      }
      this.requireVersion(version, decision.version);
      const now = new Date();
      const decisionUpdated = await tx.householdShoppingDecision.updateMany({
        where: {
          id: decision.id,
          householdId,
          createdByMembershipId: actor.id,
          status: 'OPEN',
          version,
        },
        data: {
          status: 'CANCELLED',
          activeKey: null,
          resolvedAt: now,
          version: { increment: 1 },
        },
      });
      if (decisionUpdated.count !== 1) {
        throw new ConflictException({
          code: 'shopping_decision_conflict',
          currentVersion: decision.version,
        });
      }
      const itemUpdated = await tx.householdShoppingItem.updateMany({
        where: {
          id: decision.itemId,
          householdId,
          status: 'DECISION_PENDING',
          version: decision.item.version,
        },
        data: { status: 'NEEDED', version: { increment: 1 } },
      });
      if (itemUpdated.count !== 1) {
        await this.throwItemRace(tx, householdId, decision.itemId);
      }
      const [cancelled, item] = await Promise.all([
        tx.householdShoppingDecision.findFirst({
          where: { id: decision.id, householdId },
        }),
        this.scopedItem(tx, householdId, decision.itemId),
      ]);
      if (!cancelled) throw this.householdNotFound();
      await this.audit(
        tx,
        householdId,
        actor.id,
        'shopping_decision_cancelled',
        'shopping_decision',
        decision.id,
      );
      return {
        item: this.itemView(item),
        decision: this.decisionView(cancelled, actor.id),
      };
    });
  }

  async startSession(userId: string, householdId: string) {
    this.ensureEnabled();
    return this.prisma
      .$transaction(async (tx) => {
        const actor = await this.requireMembership(tx, userId, householdId);
        const list = await tx.householdShoppingList.findUnique({
          where: { householdId },
        });
        if (!list) throw this.householdNotFound();
        const existing = await tx.householdShoppingSession.findUnique({
          where: { listId_activeKey: { listId: list.id, activeKey: 'ACTIVE' } },
        });
        if (existing) return { session: this.sessionView(existing) };
        const session = await tx.householdShoppingSession.create({
          data: {
            householdId,
            listId: list.id,
            startedByMembershipId: actor.id,
          },
        });
        await this.audit(
          tx,
          householdId,
          actor.id,
          'shopping_session_started',
          'shopping_session',
          session.id,
        );
        return { session: this.sessionView(session) };
      })
      .catch(async (error) => {
        if (!isPrismaCode(error, 'P2002')) throw error;
        return this.prisma.$transaction(async (tx) => {
          await this.requireMembership(tx, userId, householdId);
          const list = await tx.householdShoppingList.findUnique({
            where: { householdId },
          });
          const session =
            list &&
            (await tx.householdShoppingSession.findUnique({
              where: {
                listId_activeKey: { listId: list.id, activeKey: 'ACTIVE' },
              },
            }));
          if (!session)
            throw new ConflictException({ code: 'shopping_session_conflict' });
          return { session: this.sessionView(session) };
        });
      });
  }

  async endSession(
    userId: string,
    householdId: string,
    sessionId: string,
    version: number,
  ) {
    this.ensureEnabled();
    this.validVersion(version);
    return this.prisma.$transaction(async (tx) => {
      const actor = await this.requireMembership(tx, userId, householdId);
      const session = await tx.householdShoppingSession.findFirst({
        where: { id: sessionId, householdId },
      });
      if (!session) throw this.householdNotFound();
      this.requireVersion(version, session.version);
      const ended = await tx.householdShoppingSession.updateMany({
        where: { id: sessionId, householdId, status: 'ACTIVE', version },
        data: {
          status: 'COMPLETED',
          activeKey: null,
          endedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (ended.count !== 1) {
        throw new ConflictException({
          code: 'shopping_session_conflict',
          currentVersion: session.version,
        });
      }
      const current = await tx.householdShoppingSession.findFirst({
        where: { id: sessionId, householdId },
      });
      if (!current) throw this.householdNotFound();
      await this.audit(
        tx,
        householdId,
        actor.id,
        'shopping_session_ended',
        'shopping_session',
        session.id,
      );
      return { session: this.sessionView(current) };
    });
  }

  async removeMember(
    userId: string,
    householdId: string,
    membershipId: string,
    version: number,
  ) {
    this.ensureEnabled();
    this.validVersion(version);
    return this.prisma.$transaction(async (tx) => {
      const actor = await this.requireMembership(tx, userId, householdId);
      this.requireOwner(actor);
      const target = await tx.householdMembership.findFirst({
        where: { id: membershipId, householdId },
      });
      if (!target) throw this.householdNotFound();
      if (target.role === 'OWNER' || target.userId === userId) {
        throw new ConflictException({ code: 'last_owner_transfer_required' });
      }
      this.requireVersion(version, target.version);
      const updated = await tx.householdMembership.updateMany({
        where: { id: membershipId, householdId, status: 'ACTIVE', version },
        data: {
          status: 'REMOVED',
          endedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException({
          code: 'membership_conflict',
          currentVersion: target.version,
        });
      await this.audit(
        tx,
        householdId,
        actor.id,
        'member_removed',
        'membership',
        membershipId,
      );
      return {
        membership: {
          id: membershipId,
          status: 'REMOVED',
          version: version + 1,
        },
      };
    });
  }

  async leave(userId: string, householdId: string, version: number) {
    this.ensureEnabled();
    this.validVersion(version);
    return this.prisma.$transaction(async (tx) => {
      const actor = await this.requireMembership(tx, userId, householdId);
      if (actor.role === 'OWNER' || actor.household.ownerUserId === userId) {
        throw new ConflictException({ code: 'last_owner_transfer_required' });
      }
      this.requireVersion(version, actor.version);
      const updated = await tx.householdMembership.updateMany({
        where: { id: actor.id, householdId, userId, status: 'ACTIVE', version },
        data: {
          status: 'LEFT',
          endedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException({
          code: 'membership_conflict',
          currentVersion: actor.version,
        });
      await this.audit(
        tx,
        householdId,
        actor.id,
        'member_left',
        'membership',
        actor.id,
      );
      return {
        membership: { id: actor.id, status: 'LEFT', version: version + 1 },
      };
    });
  }

  async transferOwner(
    userId: string,
    householdId: string,
    dto: TransferHouseholdOwnerDto,
  ) {
    this.ensureEnabled();
    return this.prisma.$transaction(async (tx) => {
      const actor = await this.requireMembership(tx, userId, householdId);
      this.requireOwner(actor);
      this.requireVersion(dto.version, actor.household.version);
      if (typeof (tx as any).$queryRaw === 'function') {
        await (tx as any).$queryRaw(
          Prisma.sql`SELECT "id" FROM "household_memberships" WHERE "id" = ${dto.membershipId} AND "householdId" = ${householdId} FOR UPDATE`,
        );
      }
      const target = await tx.householdMembership.findFirst({
        where: {
          id: dto.membershipId,
          householdId,
          status: 'ACTIVE',
          role: 'MEMBER',
        },
      });
      if (!target) throw this.householdNotFound();
      const householdUpdated = await tx.household.updateMany({
        where: { id: householdId, ownerUserId: userId, version: dto.version },
        data: { ownerUserId: target.userId, version: { increment: 1 } },
      });
      if (householdUpdated.count !== 1) {
        throw new ConflictException({
          code: 'household_conflict',
          currentVersion: actor.household.version,
        });
      }
      const oldOwnerUpdated = await tx.householdMembership.updateMany({
        where: {
          id: actor.id,
          householdId,
          status: 'ACTIVE',
          role: 'OWNER',
          version: actor.version,
        },
        data: { role: 'MEMBER', version: { increment: 1 } },
      });
      const targetUpdated = await tx.householdMembership.updateMany({
        where: {
          id: target.id,
          householdId,
          status: 'ACTIVE',
          role: 'MEMBER',
          version: target.version,
        },
        data: { role: 'OWNER', version: { increment: 1 } },
      });
      if (oldOwnerUpdated.count !== 1 || targetUpdated.count !== 1) {
        throw new ConflictException({
          code: 'membership_conflict',
          currentVersion: target.version,
        });
      }
      await this.audit(
        tx,
        householdId,
        actor.id,
        'owner_transferred',
        'membership',
        target.id,
      );
      return {
        household: {
          id: householdId,
          ownerMembershipId: target.id,
          version: dto.version + 1,
        },
      };
    });
  }

  private ensureEnabled() {
    if (!householdV1Enabled()) throw this.householdNotFound();
  }

  private householdNotFound() {
    return new NotFoundException({ code: 'household_not_found' });
  }

  private inviteNotFound() {
    return new NotFoundException({ code: 'household_invite_not_found' });
  }

  private async requireMembership(
    db: Db,
    userId: string,
    householdId: string,
  ): Promise<any> {
    // All calls made through a transaction serialize on household first and
    // membership second. Removal/leave and domain mutations therefore have a
    // total order: after removal returns, no earlier-authorized write can commit.
    if (db !== this.prisma && typeof (db as any).$queryRaw === 'function') {
      await (db as any).$queryRaw(
        Prisma.sql`SELECT "id" FROM "households" WHERE "id" = ${householdId} FOR UPDATE`,
      );
      await (db as any).$queryRaw(
        Prisma.sql`SELECT "id" FROM "household_memberships" WHERE "householdId" = ${householdId} AND "userId" = ${userId} FOR UPDATE`,
      );
    }
    const membership = await db.householdMembership.findUnique({
      where: { householdId_userId: { householdId, userId } },
      include: { household: true, user: { select: { id: true, name: true } } },
    });
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      membership.household.status !== 'ACTIVE'
    ) {
      throw this.householdNotFound();
    }
    return membership;
  }

  private requireOwner(membership: any) {
    if (
      membership.role !== 'OWNER' ||
      membership.household.ownerUserId !== membership.userId
    ) {
      throw this.householdNotFound();
    }
  }

  private householdDetail(actor: any, members: any[]) {
    return {
      household: {
        id: actor.household.id,
        name: actor.household.name,
        status: actor.household.status,
        role: actor.role,
        version: actor.household.version,
        createdAt: actor.household.createdAt,
      },
      members: members.map((member) => ({
        id: member.id,
        userId: member.userId,
        name: member.user.name ?? null,
        role: member.role,
        status: member.status,
        joinedAt: member.joinedAt,
        version: member.version,
      })),
      capabilities:
        actor.role === 'OWNER'
          ? [
              'SHOPPING_READ',
              'SHOPPING_WRITE',
              'INVITE_CREATE',
              'MEMBER_REMOVE',
              'OWNER_TRANSFER',
            ]
          : ['SHOPPING_READ', 'SHOPPING_WRITE', 'HOUSEHOLD_LEAVE'],
    };
  }

  private inviteView(invite: any) {
    return {
      id: invite.id,
      expiresAt: invite.expiresAt,
      status: invite.status,
      createdAt: invite.createdAt,
    };
  }

  private itemView(item: any) {
    return {
      id: item.id,
      name: item.name,
      amount: item.amount ?? null,
      unit: item.unit ?? null,
      status: item.status,
      version: item.version,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private sessionView(session: any) {
    return {
      id: session.id,
      status: session.status,
      version: session.version,
      startedAt: session.startedAt,
      endedAt: session.endedAt ?? null,
    };
  }

  private decisionView(decision: any, actorMembershipId: string) {
    const createdByMe = decision.createdByMembershipId === actorMembershipId;
    const open =
      decision.status === 'OPEN' &&
      decision.expiresAt instanceof Date &&
      decision.expiresAt > new Date();
    return {
      id: decision.id,
      itemId: decision.itemId,
      question: decision.question,
      options: this.stringArray(decision.options),
      status: decision.status,
      version: decision.version,
      selectedOption: decision.selectedOption ?? null,
      createdByMe,
      canResolve: open && !createdByMe,
      canCancel: open && createdByMe,
      createdAt: decision.createdAt,
      resolvedAt: decision.resolvedAt ?? null,
    };
  }

  private async scopedItem(
    db: Db,
    householdId: string,
    itemId: string,
  ): Promise<any> {
    const item = await db.householdShoppingItem.findFirst({
      where: { id: itemId, householdId },
    });
    if (!item) throw this.householdNotFound();
    return item;
  }

  private async throwItemRace(
    db: Db,
    householdId: string,
    itemId: string,
  ): Promise<never> {
    const current = await db.householdShoppingItem.findFirst({
      where: { id: itemId, householdId },
      select: { version: true },
    });
    if (!current) throw this.householdNotFound();
    throw new ConflictException({
      code: 'shopping_item_conflict',
      currentVersion: current.version,
    });
  }

  private requireVersion(expected: number, current: number) {
    this.validVersion(expected);
    if (expected !== current) {
      throw new ConflictException({
        code: 'version_conflict',
        currentVersion: current,
      });
    }
  }

  private validVersion(value: number) {
    if (!Number.isInteger(value) || value < 1)
      throw new BadRequestException({ code: 'version_invalid' });
  }

  private canonicalPhone(value: unknown): string {
    const phone = normalizeIranMobile(value);
    if (!/^09\d{9}$/.test(phone))
      throw new BadRequestException({ code: 'phone_invalid' });
    return phone;
  }

  private phoneDigest(phone: string): string {
    const pepper = process.env.HOUSEHOLD_INVITE_PEPPER ?? '';
    if (pepper.length < 32) {
      throw new ServiceUnavailableException({
        code: 'household_configuration_error',
      });
    }
    return createHmac('sha256', pepper).update(phone).digest('hex');
  }

  private async userPhone(db: Db, userId: string): Promise<string | null> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    return user?.phone ? this.canonicalPhone(user.phone) : null;
  }

  private async verifiedUserPhone(
    db: Db,
    userId: string,
  ): Promise<string | null> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { phone: true, phoneVerifiedAt: true },
    });
    if (!user?.phone || !user.phoneVerifiedAt) return null;
    const phone = normalizeIranMobile(user.phone);
    return /^09\d{9}$/.test(phone) ? phone : null;
  }

  private async requireDurableUser(
    db: Db,
    userId: string,
    requirePhone = false,
  ) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, isGuest: true, phone: true, phoneVerifiedAt: true },
    });
    if (!user || user.isGuest) {
      throw new ForbiddenException({ code: 'household_account_required' });
    }
    if (
      requirePhone &&
      (!user.phoneVerifiedAt ||
        !user.phone ||
        !/^09\d{9}$/.test(normalizeIranMobile(user.phone)))
    ) {
      throw new ForbiddenException({ code: 'household_phone_required' });
    }
  }

  private async lockUser(db: Db, userId: string) {
    if (typeof (db as any).$queryRaw !== 'function') return;
    await (db as any).$queryRaw(
      Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`,
    );
  }

  private idempotencyKey(value: string | undefined): string {
    const key = String(value ?? '').trim();
    if (!key)
      throw new BadRequestException({ code: 'idempotency_key_required' });
    if (key.length < 8 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
      throw new BadRequestException({ code: 'idempotency_key_invalid' });
    }
    return key;
  }

  private async idempotencyReplay(
    userId: string,
    householdId: string,
    operation: string,
    key: string,
    requestHash: string,
  ): Promise<any | null> {
    return this.prisma.$transaction(async (tx) => {
      // Replay is a household-owned read. Lock-scoped authorization means a
      // concurrent removal either wins first (replay denied) or waits until the
      // replay transaction has completed; no cached read starts after removal.
      await this.requireMembership(tx, userId, householdId);
      const row = await tx.householdIdempotency.findUnique({
        where: {
          principalUserId_operation_key: {
            principalUserId: userId,
            operation,
            key,
          },
        },
      });
      if (!row) return null;
      if (row.expiresAt <= new Date()) return null;
      if (row.householdId !== householdId || row.requestHash !== requestHash) {
        throw new ConflictException({ code: 'idempotency_key_reused' });
      }
      if (row.state !== 'COMPLETED' || !row.response) {
        throw new ConflictException({ code: 'idempotency_in_progress' });
      }
      return row.response;
    });
  }

  private cleanText(value: unknown, max: number, code: string): string {
    const text = String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!text || text.length > max) throw new BadRequestException({ code });
    return text;
  }

  private optionalText(value: unknown, max: number): string | null {
    if (value === undefined || value === null) return null;
    const text = String(value).trim().replace(/\s+/g, ' ');
    if (text.length > max)
      throw new BadRequestException({ code: 'shopping_item_field_invalid' });
    return text || null;
  }

  private semanticText(value: string): string {
    return value
      .normalize('NFKC')
      .toLocaleLowerCase('fa')
      .replace(/[يى]/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[\u200c\s]+/g, ' ')
      .trim();
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private async audit(
    db: Db,
    householdId: string,
    actorMembershipId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, string> = {},
  ) {
    await db.householdAuditEvent.create({
      data: {
        householdId,
        actorMembershipId,
        action,
        entityType,
        entityId,
        metadata,
      },
    });
  }

  private async reconcileExpiredDecisions(db: Db, householdId: string) {
    const now = new Date();
    const expired = await db.householdShoppingDecision.findMany({
      where: { householdId, status: 'OPEN', expiresAt: { lte: now } },
      include: { item: true },
      take: MAX_ACTIVE_ITEMS,
    });
    for (const decision of expired) {
      const cancelled = await db.householdShoppingDecision.updateMany({
        where: {
          id: decision.id,
          householdId,
          status: 'OPEN',
          version: decision.version,
        },
        data: {
          status: 'CANCELLED',
          activeKey: null,
          resolvedAt: now,
          version: { increment: 1 },
        },
      });
      if (cancelled.count !== 1) continue;
      await db.householdShoppingItem.updateMany({
        where: {
          id: decision.itemId,
          householdId,
          status: 'DECISION_PENDING',
          version: decision.item.version,
        },
        data: { status: 'NEEDED', version: { increment: 1 } },
      });
      await this.audit(
        db,
        householdId,
        null,
        'shopping_decision_expired',
        'shopping_decision',
        decision.id,
      );
    }
  }
}
