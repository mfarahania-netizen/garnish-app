// apps/server/src/users/users.service.ts
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { ErasureService } from './erasure/erasure.service';
import { UserExportService } from './export/user-export.service';
import { ConsentService } from '../consent/consent.service';
import { CANONICAL_ALLERGEN_TOKENS } from '../ai/intent/allergen-extractor';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_POLICY_VERSION,
  OPTIONAL_CONSENT_PURPOSES,
  TERMS_LAWFUL_BASIS,
  isOptionalPurposeRuntimeEnabled,
} from '../consent/consent.constants';
import { ENABLED_ONBOARDING_ALLERGEN_TOKENS } from '../recipes/intelligence/recipe-integrity';
import { normalizeIranMobile } from '../common/phone-normalization';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import {
  nextConsentDecisionTimestamp,
  withUserConsentMutationBoundary,
  withUserOptionalProcessingBoundary,
  type OptionalProcessingTransactionClient,
} from '../consent/optional-processing-transaction-boundary.service';

const ENABLED_ALLERGEN_WRITE_TOKENS = new Set<string>(ENABLED_ONBOARDING_ALLERGEN_TOKENS);

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly erasureService: ErasureService,
    private readonly userExportService: UserExportService,
    private readonly consent: ConsentService,
  ) {}

  async createUser(phone: string, password: string, name?: string) {
    const normalizedPhone = normalizeIranMobile(phone);
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: { phone: normalizedPhone, password: hashedPassword, name },
    });
  }

  async createPasswordlessUser(phone: string, name?: string) {
    const normalizedPhone = normalizeIranMobile(phone);
    return this.prisma.user.create({
      data: { phone: normalizedPhone, password: null, isGuest: false, name },
    });
  }

  async findByPhone(phone: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { phone: normalizeIranMobile(phone) },
      include: {
        _count: { select: { allergies: true } },
        onboardingProfile: { select: { completedAt: true } },
        userConsents: {
          where: { purpose: { in: ['terms', 'personalization'] } },
          orderBy: { createdAt: 'desc' },
          select: { purpose: true, status: true, policyVersion: true, source: true },
        },
      },
    });
    return this.withVerifiedOnboardingState(user);
  }

  private withVerifiedOnboardingState<T extends Record<string, any> | null>(user: T): T {
    if (!user) return user;
    const declaredAllergyCount = Number(user?._count?.allergies ?? 0);
    const decisions = Array.isArray(user?.userConsents) ? user.userConsents : [];
    // Completion is historical truth, not current optional-processing authorization.
    // A later Settings grant/decline/withdrawal must never reopen onboarding or make
    // withdrawal conditional on answering the same questions again. V2 has an
    // immutable completion row; the historical pair remains the compatibility proof
    // for the atomic legacy command.
    const v2CompletionProof = Boolean(user?.onboardingProfile?.completedAt);
    const onboardingTermsProof = decisions.some((row: any) =>
      row?.purpose === 'terms'
      && row?.status === 'granted'
      && row?.source === 'onboarding');
    const onboardingPersonalizationDecisionProof = decisions.some((row: any) =>
      row?.purpose === 'personalization'
      && ['granted', 'declined'].includes(row?.status)
      && row?.source === 'onboarding');
    const atomicDecisionProof = onboardingTermsProof
      && onboardingPersonalizationDecisionProof;
    return {
      ...user,
      onboardingComplete: Boolean(
        v2CompletionProof
        || (user.onboardingCompletedAt && (declaredAllergyCount > 0 || atomicDecisionProof)),
      ),
    };
  }

  // A guest deviceKey is a bearer credential, so it must be a SERVER-issued secret — never a client-chosen value
  // (a client could otherwise pick a low-entropy/guessable key and let anyone resume that guest). 256 bits, url-safe.
  private newDeviceKey(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Onboarding v1 — passwordless GUEST. The deviceKey is the resume secret and is ALWAYS server-issued:
   *  - a supplied deviceKey only RESUMES an existing guest we previously issued it to (else it is ignored);
   *  - otherwise we mint a fresh guest with a CSPRNG key and return it (caller exposes it so the client can store
   *    it and resume later — keeping declared allergies). The minted row is a real User, so the normal JWT (sub) +
   *    jwt.strategy + the server-side safeIds allergy gate all apply.
   * No client-chosen key is ever written, which closes the weak-key-hijack + the upsert concurrent-create race.
   */
  async findOrCreateGuest(deviceKey?: string) {
    if (deviceKey) {
      const existing = await this.prisma.user.findUnique({ where: { deviceKey } });
      if (existing?.isGuest) return existing; // resume only a guest we issued this key to
      // a key we never issued (or one pointing at a non-guest) is NOT honored — fall through to a fresh server key
    }
    return this.createGuestWithFreshKey();
  }

  private async createGuestWithFreshKey(retries = 1): Promise<any> {
    try {
      return await this.prisma.user.create({ data: { isGuest: true, deviceKey: this.newDeviceKey() } });
    } catch (e: any) {
      // astronomically-unlikely 256-bit key collision → regenerate once
      if (e?.code === 'P2002' && retries > 0) return this.createGuestWithFreshKey(retries - 1);
      throw e;
    }
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        avatar: true,
        isAdmin: true,
        adminRole: true,
        isGuest: true,
        onboardingCompletedAt: true,
        onboardingProfile: { select: { completedAt: true } },
        createdAt: true,
        isBanned: true, // jwt strategy rejects a banned principal
        sessionEpoch: true, // jwt strategy rejects a token with a stale epoch (force-logout / ban / password-reset)
        _count: { select: { allergies: true } },
        userConsents: {
          where: { purpose: { in: ['terms', 'personalization'] } },
          orderBy: { createdAt: 'desc' },
          select: { purpose: true, status: true, policyVersion: true, source: true },
        },
      },
    }).then((user) => this.withVerifiedOnboardingState(user));
  }

  /**
   * ADDITIVE allergy declaration (conversational-allergy §3 confirm-then-write): ADD allergens to the declared
   * set WITHOUT replacing it (unlike updatePreferences which set-replaces the whole set). Idempotent
   * (skipDuplicates). The deterministic hard allergy gate reads this declared set — so once written, the gate
   * filters the allergen. Names are the canonical chip tokens (e.g. 'nut','peanut','dairy').
   */
  async addAllergies(userId: string, names: string[]): Promise<{ added: string[] }> {
    // WRITE-BOUNDARY ALLOWLIST (guardian): accept ONLY the currently audited onboarding tokens, so a crafted/buggy client can
    // neither pollute the global Allergy table with arbitrary strings nor write a non-canonical token the hard gate
    // would silently ignore. Off-list tokens are dropped (not 400) so a partly-valid batch still saves its valid set.
    const clean = [
      ...new Set(
        (names || [])
          .map((n) => String(n ?? '').trim().toLowerCase())
          .filter((n) => n && ENABLED_ALLERGEN_WRITE_TOKENS.has(n)),
      ),
    ];
    if (!clean.length) return { added: [] };
    const boundary = await withUserConsentMutationBoundary(
      this.prisma,
      { userId, operation: 'users.add-allergies' },
      async (tx) => {
        for (const name of clean) await tx.allergy.upsert({ where: { name }, create: { name }, update: {} });
        const records = await tx.allergy.findMany({ where: { name: { in: clean } }, select: { id: true } });
        await tx.userAllergy.createMany({ data: records.map((a) => ({ userId, allergyId: a.id })), skipDuplicates: true });
        return clean;
      },
    );
    if (boundary.status !== 'executed') throw new BadRequestException('User not found');
    return { added: boundary.value };
  }

  async removeAllergies(userId: string, names: string[]): Promise<{ removed: string[] }> {
    const clean = [
      ...new Set(
        (names || [])
          .map((n) => String(n ?? '').trim().toLowerCase())
          // Removal is deliberately wider than creation. Deferred legacy declarations
          // (currently lupin/sulphites) must remain removable even though current clients
          // cannot create them until corpus coverage passes the policy gate.
          .filter((n) => n && CANONICAL_ALLERGEN_TOKENS.has(n)),
      ),
    ];
    if (!clean.length) return { removed: [] };
    const boundary = await withUserConsentMutationBoundary(
      this.prisma,
      { userId, operation: 'users.remove-allergies' },
      async (tx) => {
        const records = await tx.allergy.findMany({ where: { name: { in: clean } }, select: { id: true, name: true } });
        if (records.length > 0) {
          await tx.userAllergy.deleteMany({
            where: { userId, allergyId: { in: records.map((a) => a.id) } },
          });
        }
        return records.map((a) => a.name);
      },
    );
    if (boundary.status !== 'executed') throw new BadRequestException('User not found');
    return { removed: boundary.value };
  }

  private async getPreferencesFromClient(
    client: PrismaService | OptionalProcessingTransactionClient,
    userId: string,
  ) {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: {
        preferences: true,
        allergies: { include: { allergy: true } },
        cuisines: { include: { cuisine: true } },
        healthGoals: { include: { healthGoal: true } },
      },
    });

    if (!user) return null;

    // Return declared allergies/cuisines/goals even when no diet row exists yet — a user who only declared an allergy
    // (e.g. via chat) must still be able to SEE/manage it (was returning null until a UserPreference existed). [P2 fix]
    return {
      id: user.preferences?.id ?? null,
      diet: user.preferences?.diet ?? null,
      skillLevel: user.preferences?.skillLevel ?? null,
      budget: user.preferences?.budget ?? null,
      allergies: user.allergies.map(ua => ua.allergy.name),
      cuisine: user.cuisines.map(uc => uc.cuisine.name),
      healthGoals: user.healthGoals.map(uhg => uhg.healthGoal.name),
      updatedAt: user.preferences?.updatedAt ?? null,
    };
  }

  async getPreferences(userId: string) {
    return this.getPreferencesFromClient(this.prisma, userId);
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const optionalPersonalizationRequested = dto.cuisine !== undefined
      || dto.budget !== undefined
      || dto.healthGoals !== undefined;
    if (optionalPersonalizationRequested) {
      const allowed = await this.consent
        .hasPurpose(userId, 'personalization')
        .catch(() => false);
      if (!allowed) {
        throw new ForbiddenException('Personalization processing is not active');
      }
    }
    const safeParseArray = (value: any): string[] => {
      if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean);
      if (typeof value === 'string') {
        try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
      }
      return [];
    };

    // WRITE-BOUNDARY ALLOWLIST (guardian): the PRIMARY allergy write must enforce the SAME invariant as addAllergies
    // — only currently audited tokens reach the global Allergy table, so a crafted/buggy client (or a future
    // free-text field) can neither pollute it nor store a non-canonical token the hard gate silently ignores. The
    // legit onboarding/settings UI already sends only canonical chip ids, so this is byte-identical for real users.
    const normalizedAllergies = safeParseArray(dto.allergies)
      .map((n) => String(n ?? '').trim().toLowerCase())
      .filter(Boolean);
    if (
      dto.allergies !== undefined
      && normalizedAllergies.some(
        (name) => !CANONICAL_ALLERGEN_TOKENS.has(name) || !ENABLED_ALLERGEN_WRITE_TOKENS.has(name),
      )
    ) {
      throw new BadRequestException('Preferences contain an unsupported allergen token');
    }
    const requestedEnabledAllergies = [
      ...new Set(normalizedAllergies),
    ].sort();
    const cuisine = safeParseArray(dto.cuisine).sort();
    const healthGoals = safeParseArray(dto.healthGoals).sort();

    const persistPreferences = async (
      tx: OptionalProcessingTransactionClient,
      currentPrefs: Awaited<ReturnType<UsersService['getPreferences']>>,
    ) => {
      const oldDiet = currentPrefs?.diet || null;
      const oldSkillLevel = currentPrefs?.skillLevel || null;
      const oldBudget = currentPrefs?.budget || null;
      const oldAllergies = (currentPrefs?.allergies || []).slice().sort();
      const oldCuisines = (currentPrefs?.cuisine || []).slice().sort();
      const oldHealthGoals = (currentPrefs?.healthGoals || []).slice().sort();
      // Settings currently exposes only audited options. A replace-style save must not
      // silently erase a pre-existing deferred/legacy hard exclusion just because it was
      // not renderable in that form. Such declarations remain explicitly removable via
      // removeAllergies, while a crafted request still cannot inject a new deferred token.
      const protectedLegacyAllergies = oldAllergies.filter(
        (name) => !ENABLED_ALLERGEN_WRITE_TOKENS.has(String(name).toLowerCase()),
      );
      const allergies = [...new Set([...requestedEnabledAllergies, ...protectedLegacyAllergies])].sort();

      await tx.userPreference.upsert({
        where: { userId },
        create: { userId, diet: dto.diet, skillLevel: dto.skillLevel, budget: dto.budget },
        update: { diet: dto.diet, skillLevel: dto.skillLevel, budget: dto.budget },
      });

      if (dto.allergies !== undefined) { // ONLY touch allergies when the request actually sent them — a diet-only save must
        // NOT wipe chat-declared allergies (safeParseArray returns [] for an omitted field, so the old `allergies !== undefined`
        // guard was ALWAYS true and silently cleared the set → re-exposed an allergic user). [P1 allergy-safety fix]
        await tx.userAllergy.deleteMany({ where: { userId } });
        if (allergies.length > 0) {
          for (const name of allergies) await tx.allergy.upsert({ where: { name }, create: { name }, update: {} });
          const records = await tx.allergy.findMany({ where: { name: { in: allergies } }, select: { id: true } });
          if (records.length > 0) await tx.userAllergy.createMany({ data: records.map(a => ({ userId, allergyId: a.id })), skipDuplicates: true });
        }
      }

      if (dto.cuisine !== undefined) { // partial update — don't wipe cuisines a diet-only save omitted
        await tx.userCuisine.deleteMany({ where: { userId } });
        if (cuisine.length > 0) {
          for (const name of cuisine) await tx.cuisine.upsert({ where: { name }, create: { name }, update: {} });
          const records = await tx.cuisine.findMany({ where: { name: { in: cuisine } }, select: { id: true } });
          if (records.length > 0) await tx.userCuisine.createMany({ data: records.map(c => ({ userId, cuisineId: c.id })), skipDuplicates: true });
        }
      }

      if (dto.healthGoals !== undefined) { // partial update — don't wipe health goals a diet-only save omitted
        await tx.userHealthGoal.deleteMany({ where: { userId } });
        if (healthGoals.length > 0) {
          for (const name of healthGoals) await tx.healthGoal.upsert({ where: { name }, create: { name }, update: {} });
          const records = await tx.healthGoal.findMany({ where: { name: { in: healthGoals } }, select: { id: true } });
          if (records.length > 0) await tx.userHealthGoal.createMany({ data: records.map(g => ({ userId, healthGoalId: g.id })), skipDuplicates: true });
        }
      }

      const historyEntries: any[] = [];
      const now = new Date();
      const addIfChanged = (field: string, oldVal: any, newVal: any) => {
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          historyEntries.push({ userId, fieldName: field, oldValue: JSON.stringify(oldVal), newValue: JSON.stringify(newVal), changedAt: now });
        }
      };
      if (dto.diet !== undefined) addIfChanged('diet', oldDiet, dto.diet ?? null);
      if (dto.skillLevel !== undefined) addIfChanged('skillLevel', oldSkillLevel, dto.skillLevel ?? null);
      if (dto.budget !== undefined) addIfChanged('budget', oldBudget, dto.budget ?? null);
      if (dto.allergies !== undefined) addIfChanged('allergies', oldAllergies, allergies);
      if (dto.cuisine !== undefined) addIfChanged('cuisine', oldCuisines, cuisine);
      if (dto.healthGoals !== undefined) addIfChanged('healthGoals', oldHealthGoals, healthGoals);
      if (historyEntries.length > 0) await tx.preferenceHistory.createMany({ data: historyEntries });
    };

    if (optionalPersonalizationRequested) {
      const boundary = await withUserOptionalProcessingBoundary(
        this.prisma,
        {
          userId,
          purposes: ['personalization'],
          operation: 'users.update-preferences',
        },
        async (tx) => persistPreferences(
          tx,
          await this.getPreferencesFromClient(tx, userId),
        ),
      );
      if (boundary.status !== 'executed') {
        throw new ForbiddenException('Personalization processing is not active');
      }
    } else {
      const boundary = await withUserConsentMutationBoundary(
        this.prisma,
        { userId, operation: 'users.update-preferences-core' },
        async (tx) => persistPreferences(
          tx,
          await this.getPreferencesFromClient(tx, userId),
        ),
      );
      if (boundary.status !== 'executed') {
        throw new BadRequestException('User not found');
      }
    }

    return this.getPreferences(userId);
  }

  async updateProfile(userId: string, name?: string, email?: string, avatar?: string) {
    const data: any = {};
    if (name !== undefined) {
      const clean = String(name).trim().replace(/\s+/g, ' ');
      if (clean.length > 80) throw new BadRequestException('Name is too long');
      data.name = clean || null;
    }
    if (email !== undefined) {
      const clean = String(email).trim().toLowerCase();
      if (clean.length > 160) throw new BadRequestException('Email is too long');
      data.email = clean || null;
    }
    if (avatar !== undefined) {
      const clean = String(avatar).trim();
      if (clean.length > 260) throw new BadRequestException('Avatar URL is too long');
      if (clean && !/^\/uploads\/avatars\/[A-Za-z0-9._-]+$/.test(clean) && !/^https:\/\/[^<>"'\s]+$/.test(clean)) {
        throw new BadRequestException('Avatar URL is not allowed');
      }
      data.avatar = clean || null;
    }

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data,
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Email is already in use');
      throw e;
    }
  }

  private onboardingUserSelect() {
    return {
      id: true,
      phone: true,
      name: true,
      email: true,
      avatar: true,
      isAdmin: true,
      adminRole: true,
      isGuest: true,
      onboardingCompletedAt: true,
      createdAt: true,
    } as const;
  }

  private canonicalOnboardingAllergies(names: string[]): string[] {
    const normalized = (names || []).map((name) => String(name ?? '').trim().toLowerCase());
    const invalid = normalized.filter((name) => !name || !CANONICAL_ALLERGEN_TOKENS.has(name));
    if (invalid.length > 0) throw new BadRequestException('Onboarding contains an unsupported allergen token');
    return [...new Set(normalized)].sort();
  }

  /**
   * The only launch-facing completion command. Every critical write and its canonical read-back happen in one
   * transaction; optional profile signals are intentionally handled by the client only after this succeeds.
   */
  async completeOnboardingCommand(userId: string, dto: CompleteOnboardingDto, ip?: string) {
    if (
      dto.termsAccepted !== true
      || dto.termsPolicyVersion !== CURRENT_TERMS_POLICY_VERSION
      || dto.privacyPolicyVersion !== CURRENT_PRIVACY_POLICY_VERSION
      || typeof dto.personalizationConsent !== 'boolean'
    ) {
      throw new BadRequestException('Current Terms and Privacy decisions are required');
    }

    const allergies = this.canonicalOnboardingAllergies(dto.allergies);
    const allergyDecisionMatches = dto.allergyDecision === 'none'
      ? allergies.length === 0
      : dto.allergyDecision === 'declared' && allergies.length > 0;
    if (!allergyDecisionMatches) {
      throw new BadRequestException('Allergy decision does not match the declared allergy set');
    }
    const personalizationStatus = dto.personalizationConsent ? 'granted' : 'declined';

    const boundary = await withUserConsentMutationBoundary(
      this.prisma,
      { userId, operation: 'users.complete-onboarding' },
      async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: this.onboardingUserSelect() });
      if (!user) throw new BadRequestException('User not found');

      // A completed onboarding command is immutable. An exact retry may read the
      // existing canonical state, but a stale/replayed payload must not overwrite
      // later Settings changes or re-grant a withdrawn optional purpose.
      if (user.onboardingCompletedAt) {
        const [preferences, declaredAllergies, terms, personalization] = await Promise.all([
          tx.userPreference.findUnique({ where: { userId }, select: { diet: true } }),
          tx.userAllergy.findMany({
            where: { userId },
            select: { allergy: { select: { name: true } } },
          }),
          tx.userConsent.findFirst({
            where: { userId, purpose: 'terms' },
            orderBy: { createdAt: 'desc' },
            select: { status: true, lawfulBasis: true, policyVersion: true, source: true },
          }),
          tx.userConsent.findFirst({
            where: { userId, purpose: 'personalization' },
            orderBy: { createdAt: 'desc' },
            select: { status: true, lawfulBasis: true, policyVersion: true, source: true },
          }),
        ]);
        const readBackAllergies = declaredAllergies.map((row) => row.allergy.name).sort();
        const exactRetry = !!preferences
          && JSON.stringify(readBackAllergies) === JSON.stringify(allergies)
          && (dto.diet === undefined || preferences.diet === (dto.diet ?? null))
          && terms?.status === 'granted'
          && (terms.lawfulBasis === TERMS_LAWFUL_BASIS || terms.lawfulBasis === 'contract')
          && terms.policyVersion === CURRENT_TERMS_POLICY_VERSION
          && terms.source === 'onboarding'
          && personalization?.status === personalizationStatus
          && personalization.lawfulBasis === 'consent'
          && personalization.policyVersion === CURRENT_PRIVACY_POLICY_VERSION
          && personalization.source === 'onboarding';
        if (!exactRetry) {
          throw new ConflictException('Onboarding is already complete; use Settings for later changes');
        }
        return {
          user,
          preferences: {
            diet: preferences.diet,
            allergies: readBackAllergies,
            allergyDecision: dto.allergyDecision,
          },
          consent: {
            terms: { granted: true, policyVersion: CURRENT_TERMS_POLICY_VERSION },
            personalization: {
              granted: dto.personalizationConsent,
              status: personalizationStatus,
              policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
              processingEnabled: isOptionalPurposeRuntimeEnabled('personalization'),
            },
          },
        };
      }

      await tx.userPreference.upsert({
        where: { userId },
        create: { userId, diet: dto.diet ?? null },
        update: dto.diet === undefined ? {} : { diet: dto.diet ?? null },
      });

      await tx.userAllergy.deleteMany({ where: { userId } });
      if (allergies.length > 0) {
        for (const name of allergies) {
          await tx.allergy.upsert({ where: { name }, create: { name }, update: {} });
        }
        const records = await tx.allergy.findMany({ where: { name: { in: allergies } }, select: { id: true } });
        if (records.length !== allergies.length) throw new BadRequestException('Allergy write could not be verified');
        await tx.userAllergy.createMany({
          data: records.map((allergy) => ({ userId, allergyId: allergy.id })),
          skipDuplicates: true,
        });
      }

      const ensureConsentDecision = async (
        purpose: 'terms' | 'personalization',
        status: 'granted' | 'declined',
        lawfulBasis: string,
        policyVersion: string,
      ) => {
        const latest = await tx.userConsent.findFirst({
          where: { userId, purpose },
          orderBy: { createdAt: 'desc' },
          select: { status: true, lawfulBasis: true, policyVersion: true, source: true },
        });
        if (
          latest?.status !== status
          || latest?.lawfulBasis !== lawfulBasis
          || latest?.policyVersion !== policyVersion
          || latest?.source !== 'onboarding'
        ) {
          const createdAt = await nextConsentDecisionTimestamp(
            tx,
            userId,
            purpose,
          );
          await tx.userConsent.create({
            data: {
              userId,
              purpose,
              status,
              lawfulBasis,
              policyVersion,
              source: 'onboarding',
              ip,
              createdAt,
              grantedAt: status === 'granted' ? createdAt : undefined,
            },
          });
        }
      };

      await ensureConsentDecision('terms', 'granted', TERMS_LAWFUL_BASIS, CURRENT_TERMS_POLICY_VERSION);
      await ensureConsentDecision(
        'personalization',
        personalizationStatus,
        'consent',
        CURRENT_PRIVACY_POLICY_VERSION,
      );

      const mirrorDecision = async (type: 'terms' | 'personalization', granted: boolean) => {
        const existing = await tx.consentLog.findUnique({ where: { userId_type: { userId, type } } });
        if (!existing) {
          await tx.consentLog.create({ data: { userId, type, purpose: type, granted, ip } });
        } else if (existing.granted !== granted || existing.purpose !== type) {
          await tx.consentLog.update({
            where: { userId_type: { userId, type } },
            data: { purpose: type, granted, ip, updatedAt: new Date() },
          });
        }
      };
      await mirrorDecision('terms', true);
      await mirrorDecision('personalization', dto.personalizationConsent);

      const [preferences, declaredAllergies, terms, personalization] = await Promise.all([
        tx.userPreference.findUnique({ where: { userId }, select: { diet: true } }),
        tx.userAllergy.findMany({
          where: { userId },
          select: { allergy: { select: { name: true } } },
        }),
        tx.userConsent.findFirst({
          where: { userId, purpose: 'terms' },
          orderBy: { createdAt: 'desc' },
          select: { status: true, lawfulBasis: true, policyVersion: true, source: true },
        }),
        tx.userConsent.findFirst({
          where: { userId, purpose: 'personalization' },
          orderBy: { createdAt: 'desc' },
          select: { status: true, lawfulBasis: true, policyVersion: true, source: true },
        }),
      ]);

      const readBackAllergies = declaredAllergies.map((row) => row.allergy.name).sort();
      const allergyMatch = JSON.stringify(readBackAllergies) === JSON.stringify(allergies);
      const dietMatch = dto.diet === undefined || preferences?.diet === (dto.diet ?? null);
      const termsMatch = terms?.status === 'granted'
        && terms.lawfulBasis === TERMS_LAWFUL_BASIS
        && terms.policyVersion === CURRENT_TERMS_POLICY_VERSION
        && terms.source === 'onboarding';
      const personalizationMatch = personalization?.status === personalizationStatus
        && personalization.lawfulBasis === 'consent'
        && personalization.policyVersion === CURRENT_PRIVACY_POLICY_VERSION
        && personalization.source === 'onboarding';
      if (!preferences || !allergyMatch || !dietMatch || !termsMatch || !personalizationMatch) {
        throw new BadRequestException('Onboarding canonical read-back failed');
      }

      const completedUser = user.onboardingCompletedAt
        ? user
        : await tx.user.update({
          where: { id: userId },
          data: { onboardingCompletedAt: new Date() },
          select: this.onboardingUserSelect(),
        });

      return {
        user: completedUser,
        preferences: {
          diet: preferences.diet,
          allergies: readBackAllergies,
          allergyDecision: dto.allergyDecision,
        },
        consent: {
          terms: { granted: true, policyVersion: CURRENT_TERMS_POLICY_VERSION },
          personalization: {
            granted: dto.personalizationConsent,
            status: personalizationStatus,
            policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
            processingEnabled: isOptionalPurposeRuntimeEnabled('personalization'),
          },
        },
      };
      },
    );
    if (boundary.status !== 'executed') {
      throw new BadRequestException('User not found');
    }
    return boundary.value;
  }

  /** Legacy compatibility route: it may acknowledge an existing completion, never create one. */
  async completeOnboarding(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: this.onboardingUserSelect() });
      if (!user) throw new BadRequestException('User not found');
      if (user.onboardingCompletedAt) return user;
      throw new BadRequestException('Use POST /users/onboarding/complete with an explicit allergy decision');
    });
  }

  async getConsentStatus(userId: string) {
    const latest = new Map<string, {
      status: string;
      updatedAt: Date | null;
      source: string | null;
      policyVersion: string | null;
      lawfulBasis: string | null;
      withdrawnAt: Date | null;
    }>();
    try {
      const rows = await this.prisma.userConsent.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: {
          purpose: true,
          status: true,
          updatedAt: true,
          source: true,
          policyVersion: true,
          lawfulBasis: true,
          withdrawnAt: true,
        },
      });
      for (const r of rows) latest.set(r.purpose, {
        status: r.status,
        updatedAt: r.updatedAt ?? null,
        source: r.source ?? null,
        policyVersion: r.policyVersion ?? null,
        lawfulBasis: r.lawfulBasis ?? null,
        withdrawnAt: r.withdrawnAt ?? null,
      });
    } catch {
      // Fall back to the legacy log below; absence must remain fail-closed except for core.
    }

    try {
      const rows = await this.prisma.consentLog.findMany({
        where: { userId },
        orderBy: { updatedAt: 'asc' },
        select: { type: true, purpose: true, granted: true, updatedAt: true },
      });
      for (const r of rows) {
        const purpose = r.purpose || r.type;
        if (!purpose || latest.has(purpose)) continue;
        latest.set(purpose, {
          status: r.granted ? 'granted' : 'withdrawn',
          updatedAt: r.updatedAt ?? null,
          source: 'legacy',
          policyVersion: null,
          lawfulBasis: null,
          withdrawnAt: r.granted ? null : (r.updatedAt ?? null),
        });
      }
    } catch {
      // No legacy state available.
    }

    const purposes = ['core', 'terms', 'analytics', 'personalization', 'notifications'];
    return {
      purposes: Object.fromEntries(purposes.map((purpose) => {
        if (purpose === 'core') return [purpose, {
          granted: true,
          status: 'granted',
          updatedAt: null,
          source: 'system',
          policyVersion: null,
          lawfulBasis: TERMS_LAWFUL_BASIS,
          withdrawnAt: null,
        }];
        const row = latest.get(purpose);
        const currentPolicy = purpose === 'terms'
          ? row?.policyVersion === CURRENT_TERMS_POLICY_VERSION
          : (OPTIONAL_CONSENT_PURPOSES as readonly string[]).includes(purpose)
            ? row?.policyVersion === CURRENT_PRIVACY_POLICY_VERSION
            : true;
        return [purpose, {
          granted: row?.status === 'granted' && currentPolicy,
          processingEnabled: isOptionalPurposeRuntimeEnabled(purpose),
          status: row?.status ?? 'unknown',
          updatedAt: row?.updatedAt ?? null,
          source: row?.source ?? null,
          policyVersion: row?.policyVersion ?? null,
          lawfulBasis: row?.lawfulBasis ?? null,
          withdrawnAt: row?.withdrawnAt ?? null,
        }];
      })),
    };
  }

  async grantConsent(userId: string, type: string, granted: boolean, ip?: string) {
    if (!(OPTIONAL_CONSENT_PURPOSES as readonly string[]).includes(type)) {
      throw new BadRequestException('Unsupported optional consent purpose');
    }
    const boundary = await withUserConsentMutationBoundary(
      this.prisma,
      { userId, operation: `users.consent.${type}` },
      async (tx) => {
      const latest = await tx.userConsent.findFirst({
        where: { userId, purpose: type },
        orderBy: { createdAt: 'desc' },
        select: { status: true, policyVersion: true, source: true },
      });
      const status = granted
        ? 'granted'
        : latest?.status === 'granted' || latest?.status === 'withdrawn'
          ? 'withdrawn'
          : 'declined';

      await tx.consentLog.upsert({
        where: { userId_type: { userId, type } },
        create: { userId, type, purpose: type, granted, ip },
        update: { purpose: type, granted, ip, updatedAt: new Date() },
      });

      const isIdempotentRetry = latest?.status === status
        && latest.policyVersion === CURRENT_PRIVACY_POLICY_VERSION
        && latest.source === 'settings';
      if (!isIdempotentRetry) {
        const createdAt = await nextConsentDecisionTimestamp(tx, userId, type);
        await tx.userConsent.create({
          data: {
            userId,
            purpose: type,
            status,
            source: 'settings',
            lawfulBasis: 'consent',
            policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
            ip,
            createdAt,
            grantedAt: status === 'granted' ? createdAt : undefined,
            withdrawnAt: status === 'withdrawn' ? createdAt : null,
          },
        });
      }
      if (type === 'personalization') {
        await tx.userFeatureVector.deleteMany({ where: { userId } });
        await tx.userFeature.deleteMany({ where: { userId } });
      }
      },
    );
    if (boundary.status !== 'executed') {
      throw new BadRequestException('User not found');
    }
    return this.getConsentStatus(userId);
  }

  // 🆕 GDPR: Right to be Forgotten — delegated to the transactional ErasureService (E39-1C).
  // The bare `prisma.user.delete()` is replaced by a safe transaction that revokes sessions,
  // scrubs residual PII on audit-long records, writes a PII-free ErasureEvent proof, then
  // deletes the user (Cascade + SetNull). Returns a PII-free erasure summary.
  async deleteUser(userId: string) {
    return this.erasureService.eraseUser(userId, { actorType: 'self' });
  }

  // 🆕 GDPR Art. 20: data portability — export the current user's own data (E39-1D).
  // Delegated to the dedicated UserExportService. `userId` always comes from the verified JWT.
  async exportUser(userId: string) {
    return this.userExportService.exportUser(userId);
  }
}
