import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLISHED_RECIPE_WHERE } from '../recipes/recipe-visibility';
import { SAFETY_FIT_SELECT } from '../recipes/intelligence/recipe-safety-filter.service';
import { analyzeRecipeIntegrity } from '../recipes/intelligence/recipe-integrity';
import { assessRecipeFit } from '../recipes/intelligence/recipe-fit';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_POLICY_VERSION,
  TERMS_LAWFUL_BASIS,
  isOptionalPurposeRuntimeEnabled,
} from '../consent/consent.constants';
import { nextConsentDecisionTimestamp } from '../consent/optional-processing-transaction-boundary.service';
import {
  CompleteOnboardingV2Dto,
  SaveOnboardingDraftDto,
  UpdateOnboardingProfilePreferencesDto,
} from './dto/onboarding-v2.dto';
import {
  COOKS_FOR_COUNT_BANDS,
  DIETARY_RULES,
  DIET_PATTERNS,
  ONBOARDING_SCHEMA_VERSION,
  OnboardingCompleteResponse,
  OnboardingMutationResponse,
  OnboardingProfilePreferencesUpdateResponse,
  OnboardingV2View,
  SUPPORTED_ONBOARDING_ALLERGEN_IDS,
  TASTE_DISLIKE_LIMIT,
  TASTE_LIKE_LIMIT,
  WEEKDAY_TIME_BUCKETS,
} from './onboarding-v2.contract';

type Tx = Prisma.TransactionClient;

type NormalizedSafety = {
  status: 'none' | 'declared';
  allergyIds: string[];
  intoleranceIds: string[];
  dietaryRules: string[];
};

type NormalizedDraft = {
  schemaVersion: 2;
  idempotencyKey: string;
  step: 'safety' | 'preferences' | 'taste';
  expectedRevision: number;
  terms?: { accepted: true; policyVersion: typeof CURRENT_TERMS_POLICY_VERSION };
  safety?: NormalizedSafety;
  preferences?: { dietPattern?: string; weekdayTimeBucket?: string; cooksForCount?: string };
  taste?: { likedRecipeIds: string[]; dislikedRecipeIds: string[] };
};

type NormalizedProfilePreferencesUpdate = {
  schemaVersion: 2;
  idempotencyKey: string;
  expectedRevision: number;
  dietPattern: string;
  weekdayTimeBucket: string;
  cooksForCount: string;
  dietaryRules: string[];
};

const SUPPORTED_ALLERGENS = new Set<string>(SUPPORTED_ONBOARDING_ALLERGEN_IDS);
const ALLOWED_RULES = new Set<string>(DIETARY_RULES);
const ALLOWED_DIETS = new Set<string>(DIET_PATTERNS);
const ALLOWED_TIME_BUCKETS = new Set<string>(WEEKDAY_TIME_BUCKETS);
const ALLOWED_COOKS_FOR = new Set<string>(COOKS_FOR_COUNT_BANDS);
const RECOMMENDATIONS_ENDPOINT = '/recommendations?limit=3' as const;
// Recent-retry window, not permanent key reservation. Keeping only metadata for the
// latest 64 writes bounds user-owned storage while covering normal network retries.
const MAX_MUTATION_LEDGER_ROWS_PER_USER = 64;

function uniqueSorted(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((v) => String(v ?? '').trim().toLowerCase()).filter(Boolean))].sort();
}

function jsonArray(value: unknown): string[] {
  return uniqueSorted(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function requestHash(operation: string, payload: unknown): string {
  return createHash('sha256').update(`${operation}:${stableJson(payload)}`).digest('hex');
}

@Injectable()
export class OnboardingV2Service {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<OnboardingV2View> {
    const [row, legacy] = await Promise.all([
      this.prisma.onboardingProfile.findUnique({ where: { userId } }),
      this.legacySeed(this.prisma, userId),
    ]);
    if (!row) return this.view(legacy);
    // A legacy completion marker wins over an orphan V2 draft. This keeps the route
    // closed for already-onboarded users instead of reopening and replacing settings.
    return this.view(
      !row.completedAt && legacy.completedAt
        ? { ...row, completedAt: legacy.completedAt }
        : row,
    );
  }

  async getTasteCandidates(userId: string, requestedLimit = 6, rawQuery = '') {
    const limit = Math.min(8, Math.max(4, Math.floor(Number(requestedLimit)) || 6));
    const row = await this.prisma.onboardingProfile.findUnique({ where: { userId } });
    if (!row) throw new ConflictException({ code: 'onboarding_draft_missing' });
    const safety = this.validatePersistedSafety(row);
    const dietPattern = ALLOWED_DIETS.has(String(row.dietPattern)) ? String(row.dietPattern) : null;
    const excluded = new Set([...jsonArray(row.likedRecipeIds), ...jsonArray(row.dislikedRecipeIds)]);
    const query = this.normalizeSearchText(rawQuery).slice(0, 80);
    const recipes = await this.prisma.recipe.findMany({
      where: { ...PUBLISHED_RECIPE_WHERE },
      select: {
        ...SAFETY_FIT_SELECT,
        imageUrl: true,
        cookingTime: true,
        searchTerms: { select: { term: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 160,
    });
    const profile = {
      declared: {
        dimensions: {
          'dietary.cultural_constraints': {
            status: 'declared',
            value: safety.dietaryRules,
          },
        },
      },
      reconciled: {
        dimensions: {
          allergies: {
            reconciledValue: [...safety.allergyIds, ...safety.intoleranceIds],
          },
          dietary_pattern: { reconciledValue: dietPattern },
        },
      },
    };
    const timeTarget: Record<string, number> = {
      under_15: 15,
      '15_30': 25,
      '30_60': 45,
      '60_plus': 75,
    };
    const target = timeTarget[String(row.weekdayTimeBucket)] ?? 35;
    const safe = recipes
      .filter((recipe) => !excluded.has(recipe.id))
      .filter((recipe) => {
        if (!query) return true;
        const haystack = this.normalizeSearchText([
          recipe.title,
          recipe.diet,
          recipe.region,
          ...recipe.ingredients.map((ingredient) => ingredient.name),
          ...recipe.searchTerms.map((term) => term.term),
        ].filter(Boolean).join(' '));
        return haystack.includes(query);
      })
      .map((recipe) => {
        const derived = analyzeRecipeIntegrity(recipe).derivedAllergens.allergens;
        return { recipe, fit: assessRecipeFit(recipe, profile, derived) };
      })
      .filter(({ fit }) => fit.recommendation !== 'avoid_allergen' && fit.recommendation !== 'avoid_constraint')
      .sort((a, b) => {
        const at = Number(a.recipe.cookingTime ?? target);
        const bt = Number(b.recipe.cookingTime ?? target);
        return Math.abs(at - target) - Math.abs(bt - target) || a.recipe.title.localeCompare(b.recipe.title);
      });

    // A small round-robin by region avoids presenting six near-duplicates as the
    // user's entire taste calibration set.
    const chosen: typeof safe = [];
    const remaining = [...safe];
    const seenRegion = new Set<string>();
    while (remaining.length && chosen.length < limit) {
      let index = remaining.findIndex(({ recipe }) => !seenRegion.has(String(recipe.region ?? 'unknown')));
      if (index < 0) {
        seenRegion.clear();
        index = 0;
      }
      const [next] = remaining.splice(index, 1);
      chosen.push(next);
      seenRegion.add(String(next.recipe.region ?? 'unknown'));
    }
    return {
      items: chosen.map(({ recipe }) => ({
        id: recipe.id,
        title: recipe.title,
        imageUrl: recipe.imageUrl ?? null,
        cookingTime: recipe.cookingTime ?? null,
        diet: recipe.diet ?? null,
        region: recipe.region ?? null,
      })),
      profileRevision: row.revision,
    };
  }

  async saveDraft(userId: string, dto: SaveOnboardingDraftDto): Promise<OnboardingMutationResponse> {
    const normalized = this.normalizeDraft(dto);
    if (normalized.step === 'taste') {
      throw new BadRequestException({ code: 'taste_requires_atomic_consent' });
    }
    const operation = `draft:${normalized.step}`;
    const hash = requestHash(operation, normalized);

    const replay = await this.findReplay(userId, normalized.idempotencyKey, operation, hash);
    if (replay) return { ...(replay as any), replayed: true };

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`SET LOCAL lock_timeout = '2000ms'`);
        await tx.$executeRaw(Prisma.sql`SET LOCAL statement_timeout = '4500ms'`);
        const lockedUsers = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`,
        );
        if (lockedUsers.length !== 1) {
          throw new BadRequestException({ code: 'user_not_found' });
        }
        const inTransactionReplay = await this.findReplayTx(
          tx,
          userId,
          normalized.idempotencyKey,
          operation,
          hash,
        );
        if (inTransactionReplay) return { ...(inTransactionReplay as any), replayed: true };

        if (normalized.step === 'safety') {
          await this.recordCurrentTermsForSafetyDraft(tx, userId);
        } else {
          await this.requireCurrentTermsForPreferenceDraft(tx, userId);
        }

        const [current, legacy] = await Promise.all([
          tx.onboardingProfile.findUnique({ where: { userId } }),
          this.legacySeed(tx, userId),
        ]);
        if (current?.completedAt || legacy.completedAt) {
          throw new ConflictException({ code: 'onboarding_already_completed' });
        }
        const currentRevision = current?.revision ?? 0;
        if (normalized.expectedRevision !== currentRevision) {
          throw new ConflictException({ code: 'revision_conflict', currentRevision });
        }

        const data = await this.draftData(tx, normalized);
        const row = await tx.onboardingProfile.upsert({
          where: { userId },
          create: {
            userId,
            schemaVersion: ONBOARDING_SCHEMA_VERSION,
            revision: 1,
            ...this.createDataFromLegacy(legacy),
            ...data,
          },
          update: {
            schemaVersion: ONBOARDING_SCHEMA_VERSION,
            revision: { increment: 1 },
            ...data,
          },
        });
        // Keep the idempotency ledger free of repeated allergy/intolerance
        // snapshots. The canonical profile remains the only draft data source.
        const response: OnboardingMutationResponse = {
          revision: Number(row.revision),
          replayed: false,
        };
        await tx.onboardingMutation.create({
          data: {
            userId,
            idempotencyKey: normalized.idempotencyKey,
            operation,
            requestHash: hash,
            response: response as unknown as Prisma.InputJsonValue,
          },
        });
        await this.trimMutationLedger(tx, userId);
        return response;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = await this.findReplay(userId, normalized.idempotencyKey, operation, hash);
        if (raced) return { ...(raced as any), replayed: true };
      }
      if (error?.code === 'P2034') {
        throw new ConflictException({ code: 'serialization_conflict_retry' });
      }
      throw error;
    }
  }

  /**
   * Edit the durable, non-taste preferences after onboarding has completed.
   * This deliberately does not reopen the onboarding draft: completion stays
   * immutable, while the small editable projection is kept synchronized across
   * every current consumer in one locked serializable transaction.
   */
  async updateProfilePreferences(
    userId: string,
    dto: UpdateOnboardingProfilePreferencesDto,
  ): Promise<OnboardingProfilePreferencesUpdateResponse> {
    const normalized = this.normalizeProfilePreferencesUpdate(dto);
    const operation = 'profile:preferences';
    const hash = requestHash(operation, normalized);

    const replay = await this.findReplay(userId, normalized.idempotencyKey, operation, hash);
    if (replay) {
      return { ...(replay as any), replayed: true };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`SET LOCAL lock_timeout = '2000ms'`);
        await tx.$executeRaw(Prisma.sql`SET LOCAL statement_timeout = '4500ms'`);
        const lockedUsers = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`,
        );
        if (lockedUsers.length !== 1) {
          throw new BadRequestException({ code: 'user_not_found' });
        }

        const inTransactionReplay = await this.findReplayTx(
          tx,
          userId,
          normalized.idempotencyKey,
          operation,
          hash,
        );
        if (inTransactionReplay) {
          return { ...(inTransactionReplay as any), replayed: true };
        }

        const [current, legacy] = await Promise.all([
          tx.onboardingProfile.findUnique({ where: { userId } }),
          this.legacySeed(tx, userId),
        ]);
        const effectiveCompletedAtRaw = current?.completedAt ?? legacy.completedAt;
        if (!effectiveCompletedAtRaw) {
          throw new ConflictException({ code: 'onboarding_not_completed' });
        }
        if (current && Number(current.schemaVersion) !== ONBOARDING_SCHEMA_VERSION) {
          throw new ConflictException({ code: 'onboarding_schema_mismatch' });
        }
        const effectiveCompletedAt = new Date(effectiveCompletedAtRaw);
        if (Number.isNaN(effectiveCompletedAt.getTime())) {
          throw new InternalServerErrorException({ code: 'onboarding_completion_timestamp_invalid' });
        }

        const currentRevision = Number(current?.revision ?? 0);
        if (normalized.expectedRevision !== currentRevision) {
          throw new ConflictException({ code: 'revision_conflict', currentRevision });
        }

        await tx.userPreference.upsert({
          where: { userId },
          create: { userId, diet: normalized.dietPattern },
          update: { diet: normalized.dietPattern },
        });
        await this.upsertDeclaredFact(
          tx,
          userId,
          'dietary.cultural_constraints',
          normalized.dietaryRules,
          'onboarding_v2_profile_edit',
        );
        await this.upsertDeclaredFact(
          tx,
          userId,
          'constraints.cooking_time_workday',
          normalized.weekdayTimeBucket,
          'onboarding_v2_profile_edit',
        );
        await this.upsertDeclaredFact(
          tx,
          userId,
          'context.cooks_for_count',
          normalized.cooksForCount,
          'onboarding_v2_profile_edit',
        );

        await tx.onboardingProfile.upsert({
          where: { userId },
          create: {
            userId,
            schemaVersion: ONBOARDING_SCHEMA_VERSION,
            revision: 1,
            ...this.createDataFromLegacy(legacy),
            dietaryRules: normalized.dietaryRules,
            dietPattern: normalized.dietPattern,
            weekdayTimeBucket: normalized.weekdayTimeBucket,
            cooksForCount: normalized.cooksForCount,
            completedAt: effectiveCompletedAt,
          },
          update: {
            schemaVersion: ONBOARDING_SCHEMA_VERSION,
            revision: { increment: 1 },
            dietaryRules: normalized.dietaryRules,
            dietPattern: normalized.dietPattern,
            weekdayTimeBucket: normalized.weekdayTimeBucket,
            cooksForCount: normalized.cooksForCount,
            // Preserve the original completion timestamp. For an orphan V2 row
            // beside a valid legacy marker, this heals the row without reopening it.
            completedAt: effectiveCompletedAt,
          },
        });

        // Both the dense vector and its normalized feature rows may contain the
        // previous time preference. Their next read must rebuild from this commit.
        await tx.userFeatureVector.deleteMany({ where: { userId } });
        await tx.userFeature.deleteMany({ where: { userId } });

        const [persistedProfile, persistedPreference, persistedFacts] = await Promise.all([
          tx.onboardingProfile.findUnique({
            where: { userId },
            select: {
              schemaVersion: true,
              revision: true,
              completedAt: true,
              dietaryRules: true,
              dietPattern: true,
              weekdayTimeBucket: true,
              cooksForCount: true,
            },
          }),
          tx.userPreference.findUnique({ where: { userId }, select: { diet: true } }),
          tx.userFact.findMany({
            where: {
              userId,
              key: {
                in: [
                  'declared.dietary.cultural_constraints',
                  'declared.constraints.cooking_time_workday',
                  'declared.context.cooks_for_count',
                ],
              },
            },
            select: { key: true, value: true },
          }),
        ]);
        const factValues = new Map(
          persistedFacts.map((row: any) => [row.key, (row.value as any)?.v ?? row.value]),
        );
        const persistedCompletedAt = persistedProfile?.completedAt
          ? new Date(persistedProfile.completedAt)
          : null;
        const profileMatches = Boolean(
          persistedProfile
          && Number(persistedProfile.schemaVersion) === ONBOARDING_SCHEMA_VERSION
          && Number(persistedProfile.revision) === currentRevision + 1
          && persistedCompletedAt
          && persistedCompletedAt.getTime() === effectiveCompletedAt.getTime()
          && persistedProfile.dietPattern === normalized.dietPattern
          && persistedProfile.weekdayTimeBucket === normalized.weekdayTimeBucket
          && persistedProfile.cooksForCount === normalized.cooksForCount
          && stableJson(jsonArray(persistedProfile.dietaryRules)) === stableJson(normalized.dietaryRules)
        );
        const projectionsMatch = Boolean(
          persistedPreference?.diet === normalized.dietPattern
          && String(factValues.get('declared.constraints.cooking_time_workday') ?? '')
            === normalized.weekdayTimeBucket
          && String(factValues.get('declared.context.cooks_for_count') ?? '')
            === normalized.cooksForCount
          && stableJson(jsonArray(factValues.get('declared.dietary.cultural_constraints')))
            === stableJson(normalized.dietaryRules)
        );
        if (!profileMatches || !projectionsMatch || !persistedCompletedAt) {
          throw new InternalServerErrorException({ code: 'profile_preferences_commit_verification_failed' });
        }

        const response: OnboardingProfilePreferencesUpdateResponse = {
          revision: Number(persistedProfile!.revision),
          completedAt: persistedCompletedAt.toISOString(),
          replayed: false,
        };
        await tx.onboardingMutation.create({
          data: {
            userId,
            idempotencyKey: normalized.idempotencyKey,
            operation,
            requestHash: hash,
            response: response as unknown as Prisma.InputJsonValue,
          },
        });
        await this.trimMutationLedger(tx, userId);
        return response;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = await this.findReplay(userId, normalized.idempotencyKey, operation, hash);
        if (raced) return { ...(raced as any), replayed: true };
      }
      if (error?.code === 'P2034') {
        throw new ConflictException({ code: 'serialization_conflict_retry' });
      }
      throw error;
    }
  }

  async complete(userId: string, dto: CompleteOnboardingV2Dto): Promise<OnboardingCompleteResponse> {
    const normalized = {
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      idempotencyKey: String(dto.idempotencyKey),
      expectedRevision: Number(dto.expectedRevision),
      personalizationConsent: Boolean(dto.consent.personalization),
      taste: {
        likedRecipeIds: uniqueSorted(dto.taste?.likedRecipeIds),
        dislikedRecipeIds: uniqueSorted(dto.taste?.dislikedRecipeIds),
      },
    } as const;
    if (!normalized.personalizationConsent && (
      normalized.taste.likedRecipeIds.length > 0 || normalized.taste.dislikedRecipeIds.length > 0
    )) {
      throw new BadRequestException({ code: 'taste_requires_personalization_consent' });
    }
    const operation = 'complete';
    const hash = requestHash(operation, normalized);

    const replay = await this.findReplay(userId, normalized.idempotencyKey, operation, hash);
    if (replay) return { ...(replay as any), replayed: true };

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`SET LOCAL lock_timeout = '2000ms'`);
        await tx.$executeRaw(Prisma.sql`SET LOCAL statement_timeout = '4500ms'`);
        const lockedUsers = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`,
        );
        if (lockedUsers.length !== 1) {
          throw new BadRequestException({ code: 'user_not_found' });
        }
        const inTransactionReplay = await this.findReplayTx(
          tx,
          userId,
          normalized.idempotencyKey,
          operation,
          hash,
        );
        if (inTransactionReplay) return { ...(inTransactionReplay as any), replayed: true };
        if (
          normalized.personalizationConsent
          && !isOptionalPurposeRuntimeEnabled('personalization')
        ) {
          throw new BadRequestException({ code: 'personalization_processing_disabled' });
        }

        const [draft, legacy] = await Promise.all([
          tx.onboardingProfile.findUnique({ where: { userId } }),
          this.legacySeed(tx, userId),
        ]);
        if (!draft) throw new ConflictException({ code: 'onboarding_draft_missing' });
        if (draft.schemaVersion !== ONBOARDING_SCHEMA_VERSION) {
          throw new ConflictException({ code: 'onboarding_schema_mismatch' });
        }
        if (draft.completedAt || legacy.completedAt) {
          throw new ConflictException({ code: 'onboarding_already_completed' });
        }
        if (draft.revision !== normalized.expectedRevision) {
          throw new ConflictException({ code: 'revision_conflict', currentRevision: draft.revision });
        }

        const safety = this.validatePersistedSafety(draft);
        const dietPattern = String(draft.dietPattern ?? '');
        const weekdayTimeBucket = String(draft.weekdayTimeBucket ?? '');
        const cooksForCount = String(draft.cooksForCount ?? '');
        if (
          !ALLOWED_DIETS.has(dietPattern) ||
          !ALLOWED_TIME_BUCKETS.has(weekdayTimeBucket) ||
          !ALLOWED_COOKS_FOR.has(cooksForCount)
        ) {
          throw new ConflictException({ code: 'required_preferences_missing' });
        }
        const taste = await this.validatePersistedTaste(
          tx,
          normalized.taste,
          normalized.personalizationConsent,
        );

        // Canonical hard-exclusion projection. Intolerances stay distinguishable in
        // OnboardingProfile, but join the legacy UserAllergy gate so every current
        // recommendation/search/AI serving path fails closed for either declaration.
        // Onboarding is not an allergy-deletion interface. Preserve every pre-existing
        // hard exclusion (settings/chat/legacy onboarding) and add V2 declarations.
        // This prevents a partial/retried onboarding draft from erasing a safety setting.
        const existingHardRows = await tx.userAllergy.findMany({
          where: { userId },
          include: { allergy: true },
        });
        const existingHard = existingHardRows.map((r) => r.allergy.name).filter(Boolean);
        const hardExclusions = [
          ...new Set([...existingHard, ...safety.allergyIds, ...safety.intoleranceIds]),
        ].sort();
        await tx.userAllergy.deleteMany({ where: { userId } });
        for (const name of hardExclusions) {
          await tx.allergy.upsert({ where: { name }, create: { name }, update: {} });
        }
        if (hardExclusions.length > 0) {
          const records = await tx.allergy.findMany({
            where: { name: { in: hardExclusions } },
            select: { id: true, name: true },
          });
          if (records.length !== hardExclusions.length) {
            throw new InternalServerErrorException({ code: 'safety_projection_failed' });
          }
          await tx.userAllergy.createMany({
            data: records.map((a) => ({ userId, allergyId: a.id })),
            skipDuplicates: true,
          });
        }

        await tx.userPreference.upsert({
          where: { userId },
          create: { userId, diet: dietPattern },
          update: { diet: dietPattern },
        });
        const existingIntolerances = await this.readDeclaredFact(
          tx,
          userId,
          'dietary.intolerances',
        );
        const existingRules = await this.readDeclaredFact(
          tx,
          userId,
          'dietary.cultural_constraints',
        );
        await this.upsertDeclaredFact(
          tx,
          userId,
          'dietary.intolerances',
          [...new Set([...existingIntolerances, ...safety.intoleranceIds])].sort(),
        );
        await this.upsertDeclaredFact(
          tx,
          userId,
          'dietary.cultural_constraints',
          [...new Set([...existingRules, ...safety.dietaryRules])].sort(),
        );
        await this.upsertDeclaredFact(tx, userId, 'constraints.cooking_time_workday', weekdayTimeBucket);
        await this.upsertDeclaredFact(tx, userId, 'context.cooks_for_count', cooksForCount);

        // Terms acceptance and the optional personalization decision are explicit,
        // versioned and recorded while holding the canonical User row lock. Analytics
        // remains untouched because onboarding never asks that separate question.
        const latestPersonalization = await tx.userConsent.findFirst({
          where: { userId, purpose: 'personalization' },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { status: true },
        });
        const personalizationStatus = normalized.personalizationConsent
          ? 'granted'
          : latestPersonalization?.status === 'granted' || latestPersonalization?.status === 'withdrawn'
            ? 'withdrawn'
            : 'declined';
        const termsDeclaredAt = await nextConsentDecisionTimestamp(tx, userId, 'terms');
        const personalizationDeclaredAt = await nextConsentDecisionTimestamp(
          tx,
          userId,
          'personalization',
        );
        await tx.consentLog.upsert({
          where: { userId_type: { userId, type: 'terms' } },
          create: {
            userId,
            type: 'terms',
            purpose: 'terms',
            granted: true,
          },
          update: {
            purpose: 'terms',
            granted: true,
          },
        });
        await tx.consentLog.upsert({
          where: { userId_type: { userId, type: 'personalization' } },
          create: {
            userId,
            type: 'personalization',
            purpose: 'personalization',
            granted: normalized.personalizationConsent,
          },
          update: {
            purpose: 'personalization',
            granted: normalized.personalizationConsent,
          },
        });
        await tx.userConsent.create({
          data: {
            userId,
            purpose: 'terms',
            status: 'granted',
            lawfulBasis: TERMS_LAWFUL_BASIS,
            policyVersion: CURRENT_TERMS_POLICY_VERSION,
            source: 'onboarding',
            createdAt: termsDeclaredAt,
            grantedAt: termsDeclaredAt,
          },
        });
        await tx.userConsent.create({
          data: {
            userId,
            purpose: 'personalization',
            status: personalizationStatus,
            lawfulBasis: 'consent',
            policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
            source: 'onboarding',
            createdAt: personalizationDeclaredAt,
            grantedAt: normalized.personalizationConsent ? personalizationDeclaredAt : undefined,
            withdrawnAt: personalizationStatus === 'withdrawn' ? personalizationDeclaredAt : null,
          },
        });

        // Any pre-onboarding vector predates the newly projected declarations.
        // Delete both caches inside the transaction; the next recommendation call
        // synchronously rebuilds them with time + taste V2 features.
        await tx.userFeatureVector.deleteMany({ where: { userId } });
        await tx.userFeature.deleteMany({ where: { userId } });

        const completedAt = new Date();
        const completed = await tx.onboardingProfile.update({
          where: { userId },
          data: {
            revision: { increment: 1 },
            completedAt,
            // Taste is accepted only at this atomic consent boundary. A refusal
            // stores an explicit empty projection; a grant stores the validated ids.
            likedRecipeIds: normalized.personalizationConsent ? taste.likedRecipeIds : [],
            dislikedRecipeIds: normalized.personalizationConsent ? taste.dislikedRecipeIds : [],
          },
        });
        await tx.user.update({
          where: { id: userId },
          data: { onboardingCompletedAt: completedAt },
        });

        // Read-after-write safety assertion is part of the same transaction: any
        // mismatch throws and rolls back both projections and completion markers.
        const [persistedHardRows, completionUser] = await Promise.all([
          tx.userAllergy.findMany({ where: { userId }, include: { allergy: true } }),
          tx.user.findUnique({ where: { id: userId }, select: { onboardingCompletedAt: true } }),
        ]);
        const persistedHard = persistedHardRows.map((r) => r.allergy.name).sort();
        if (
          stableJson(persistedHard) !== stableJson(hardExclusions) ||
          !completionUser?.onboardingCompletedAt ||
          !completed.completedAt
        ) {
          throw new InternalServerErrorException({ code: 'onboarding_commit_verification_failed' });
        }

        const response: OnboardingCompleteResponse = {
          profileRevision: completed.revision,
          completedAt: completedAt.toISOString(),
          nextPath: '/',
          recommendationsEndpoint: RECOMMENDATIONS_ENDPOINT,
          replayed: false,
        };
        await tx.onboardingMutation.create({
          data: {
            userId,
            idempotencyKey: normalized.idempotencyKey,
            operation,
            requestHash: hash,
            response: response as unknown as Prisma.InputJsonValue,
          },
        });
        await this.trimMutationLedger(tx, userId);
        return response;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = await this.findReplay(userId, normalized.idempotencyKey, operation, hash);
        if (raced) return { ...(raced as any), replayed: true };
      }
      if (error?.code === 'P2034') {
        throw new ConflictException({ code: 'serialization_conflict_retry' });
      }
      throw error;
    }
  }

  private async recordCurrentTermsForSafetyDraft(tx: Tx, userId: string): Promise<void> {
    const latest = await tx.userConsent.findFirst({
      where: { userId, purpose: 'terms' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { status: true, policyVersion: true },
    });
    const current = latest?.status === 'granted'
      && latest.policyVersion === CURRENT_TERMS_POLICY_VERSION;
    if (!current) {
      const createdAt = await nextConsentDecisionTimestamp(tx, userId, 'terms');
      await tx.userConsent.create({
        data: {
          userId,
          purpose: 'terms',
          status: 'granted',
          lawfulBasis: TERMS_LAWFUL_BASIS,
          policyVersion: CURRENT_TERMS_POLICY_VERSION,
          source: 'onboarding',
          createdAt,
          grantedAt: createdAt,
        },
      });
    }
    await tx.consentLog.upsert({
      where: { userId_type: { userId, type: 'terms' } },
      create: {
        userId,
        type: 'terms',
        purpose: 'terms',
        granted: true,
      },
      update: {
        purpose: 'terms',
        granted: true,
      },
    });
  }

  private async trimMutationLedger(tx: Tx, userId: string): Promise<void> {
    const stale = await tx.onboardingMutation.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: MAX_MUTATION_LEDGER_ROWS_PER_USER,
      select: { id: true },
    });
    if (stale.length === 0) return;
    await tx.onboardingMutation.deleteMany({
      where: { userId, id: { in: stale.map((row) => row.id) } },
    });
  }

  private async requireCurrentTermsForPreferenceDraft(tx: Tx, userId: string): Promise<void> {
    const latest = await tx.userConsent.findFirst({
      where: { userId, purpose: 'terms' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { status: true, policyVersion: true },
    });
    if (
      latest?.status !== 'granted'
      || latest.policyVersion !== CURRENT_TERMS_POLICY_VERSION
    ) {
      throw new ConflictException({
        code: 'current_terms_acceptance_required',
        requiredPolicyVersion: CURRENT_TERMS_POLICY_VERSION,
      });
    }
  }

  private normalizeProfilePreferencesUpdate(
    dto: UpdateOnboardingProfilePreferencesDto,
  ): NormalizedProfilePreferencesUpdate {
    const normalized: NormalizedProfilePreferencesUpdate = {
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      idempotencyKey: String(dto.idempotencyKey),
      expectedRevision: Number(dto.expectedRevision),
      dietPattern: String(dto.dietPattern ?? '').trim().toLowerCase(),
      weekdayTimeBucket: String(dto.weekdayTimeBucket ?? '').trim().toLowerCase(),
      cooksForCount: String(dto.cooksForCount ?? '').trim().toLowerCase(),
      dietaryRules: uniqueSorted(dto.dietaryRules),
    };
    if (Number(dto.schemaVersion) !== ONBOARDING_SCHEMA_VERSION) {
      throw new BadRequestException({ code: 'onboarding_schema_mismatch' });
    }
    if (
      !Number.isInteger(normalized.expectedRevision)
      || normalized.expectedRevision < 0
      || normalized.expectedRevision > 2_147_483_647
    ) {
      throw new BadRequestException({ code: 'invalid_expected_revision' });
    }
    if (!ALLOWED_DIETS.has(normalized.dietPattern)) {
      throw new BadRequestException({ code: 'invalid_preferences' });
    }
    if (!ALLOWED_TIME_BUCKETS.has(normalized.weekdayTimeBucket)) {
      throw new BadRequestException({ code: 'invalid_preferences' });
    }
    if (!ALLOWED_COOKS_FOR.has(normalized.cooksForCount)) {
      throw new BadRequestException({ code: 'invalid_preferences' });
    }
    if (
      !Array.isArray(dto.dietaryRules)
      || normalized.dietaryRules.length !== dto.dietaryRules.length
      || normalized.dietaryRules.some((rule) => !ALLOWED_RULES.has(rule))
    ) {
      throw new BadRequestException({ code: 'invalid_dietary_rules' });
    }
    return normalized;
  }

  private normalizeDraft(dto: SaveOnboardingDraftDto): NormalizedDraft {
    const base = {
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      idempotencyKey: String(dto.idempotencyKey),
      step: dto.step,
      expectedRevision: Number(dto.expectedRevision),
    } as NormalizedDraft;

    const supplied = [dto.safety !== undefined, dto.preferences !== undefined, dto.taste !== undefined]
      .filter(Boolean).length;
    if (supplied !== 1 || dto[dto.step] === undefined) {
      throw new BadRequestException({ code: 'step_payload_mismatch' });
    }

    if (dto.step === 'safety') {
      if (
        dto.terms?.accepted !== true
        || dto.terms.policyVersion !== CURRENT_TERMS_POLICY_VERSION
      ) {
        throw new BadRequestException({
          code: 'current_terms_acceptance_required',
          requiredPolicyVersion: CURRENT_TERMS_POLICY_VERSION,
        });
      }
      const safety: NormalizedSafety = {
        status: dto.safety!.status,
        allergyIds: uniqueSorted(dto.safety!.allergyIds),
        intoleranceIds: uniqueSorted(dto.safety!.intoleranceIds),
        dietaryRules: uniqueSorted(dto.safety!.dietaryRules),
      };
      this.assertSafety(safety);
      base.terms = {
        accepted: true,
        policyVersion: CURRENT_TERMS_POLICY_VERSION,
      };
      base.safety = safety;
    } else if (dto.step === 'preferences') {
      if (dto.terms !== undefined) {
        throw new BadRequestException({ code: 'terms_consent_only_allowed_for_safety' });
      }
      const preferences: NonNullable<NormalizedDraft['preferences']> = {};
      if (dto.preferences!.dietPattern !== undefined) {
        const dietPattern = String(dto.preferences!.dietPattern).toLowerCase();
        if (!ALLOWED_DIETS.has(dietPattern)) throw new BadRequestException({ code: 'invalid_preferences' });
        preferences.dietPattern = dietPattern;
      }
      if (dto.preferences!.weekdayTimeBucket !== undefined) {
        const weekdayTimeBucket = String(dto.preferences!.weekdayTimeBucket).toLowerCase();
        if (!ALLOWED_TIME_BUCKETS.has(weekdayTimeBucket)) throw new BadRequestException({ code: 'invalid_preferences' });
        preferences.weekdayTimeBucket = weekdayTimeBucket;
      }
      if (dto.preferences!.cooksForCount !== undefined) {
        const cooksForCount = String(dto.preferences!.cooksForCount).toLowerCase();
        if (!ALLOWED_COOKS_FOR.has(cooksForCount)) throw new BadRequestException({ code: 'invalid_preferences' });
        preferences.cooksForCount = cooksForCount;
      }
      if (Object.keys(preferences).length === 0) throw new BadRequestException({ code: 'preferences_empty' });
      base.preferences = preferences;
    } else {
      const likedRecipeIds = uniqueSorted(dto.taste!.likedRecipeIds);
      const dislikedRecipeIds = uniqueSorted(dto.taste!.dislikedRecipeIds);
      if (
        likedRecipeIds.length > TASTE_LIKE_LIMIT ||
        dislikedRecipeIds.length > TASTE_DISLIKE_LIMIT
      ) {
        throw new BadRequestException({ code: 'taste_limit_exceeded' });
      }
      const overlap = likedRecipeIds.filter((id) => dislikedRecipeIds.includes(id));
      if (overlap.length > 0) throw new BadRequestException({ code: 'taste_stance_conflict' });
      base.taste = { likedRecipeIds, dislikedRecipeIds };
    }
    return base;
  }

  private assertSafety(safety: NormalizedSafety): void {
    const unsupported = [...safety.allergyIds, ...safety.intoleranceIds]
      .filter((id) => !SUPPORTED_ALLERGENS.has(id));
    if (unsupported.length > 0) {
      throw new BadRequestException({ code: 'unsupported_allergen', unsupported: [...new Set(unsupported)].sort() });
    }
    const invalidRules = safety.dietaryRules.filter((rule) => !ALLOWED_RULES.has(rule));
    if (invalidRules.length > 0) {
      throw new BadRequestException({ code: 'unsupported_dietary_rule' });
    }
    const overlap = safety.allergyIds.filter((id) => safety.intoleranceIds.includes(id));
    if (overlap.length > 0) {
      throw new BadRequestException({ code: 'allergy_intolerance_conflict', conflicts: overlap });
    }
    const safetyDeclarationCount = safety.allergyIds.length + safety.intoleranceIds.length;
    if (safety.status === 'none' && safetyDeclarationCount !== 0) {
      throw new BadRequestException({ code: 'safety_none_must_be_empty' });
    }
    if (safety.status === 'declared' && safetyDeclarationCount === 0) {
      throw new BadRequestException({ code: 'safety_declaration_empty' });
    }
  }

  private async draftData(tx: Tx, draft: NormalizedDraft): Promise<Record<string, unknown>> {
    if (draft.step === 'safety') {
      return {
        safetyStatus: draft.safety!.status,
        allergyIds: draft.safety!.allergyIds,
        intoleranceIds: draft.safety!.intoleranceIds,
        dietaryRules: draft.safety!.dietaryRules,
      };
    }
    if (draft.step === 'preferences') {
      return { ...draft.preferences };
    }
    const ids = [...draft.taste!.likedRecipeIds, ...draft.taste!.dislikedRecipeIds];
    if (ids.length > 0) {
      const found = await tx.recipe.findMany({
        where: { id: { in: ids }, ...PUBLISHED_RECIPE_WHERE },
        select: { id: true },
      });
      if (found.length !== ids.length) throw new BadRequestException({ code: 'unknown_taste_recipe' });
    }
    return {
      likedRecipeIds: draft.taste!.likedRecipeIds,
      dislikedRecipeIds: draft.taste!.dislikedRecipeIds,
    };
  }

  private validatePersistedSafety(row: any): NormalizedSafety {
    const safety: NormalizedSafety = {
      status: row.safetyStatus,
      allergyIds: jsonArray(row.allergyIds),
      intoleranceIds: jsonArray(row.intoleranceIds),
      dietaryRules: jsonArray(row.dietaryRules),
    };
    if (safety.status !== 'none' && safety.status !== 'declared') {
      throw new ConflictException({ code: 'safety_step_incomplete' });
    }
    this.assertSafety(safety);
    return safety;
  }

  private async validatePersistedTaste(
    tx: Tx,
    row: any,
    requirePublishedRecipes = true,
  ): Promise<{ likedRecipeIds: string[]; dislikedRecipeIds: string[] }> {
    const likedRecipeIds = jsonArray(row.likedRecipeIds);
    const dislikedRecipeIds = jsonArray(row.dislikedRecipeIds);
    if (
      likedRecipeIds.length > TASTE_LIKE_LIMIT ||
      dislikedRecipeIds.length > TASTE_DISLIKE_LIMIT
    ) {
      throw new ConflictException({ code: 'taste_limit_exceeded' });
    }
    if (likedRecipeIds.some((id) => dislikedRecipeIds.includes(id))) {
      throw new ConflictException({ code: 'taste_stance_conflict' });
    }
    const all = [...likedRecipeIds, ...dislikedRecipeIds];
    if (requirePublishedRecipes && all.length > 0) {
      const existing = await tx.recipe.findMany({
        where: { id: { in: all }, ...PUBLISHED_RECIPE_WHERE },
        select: { id: true },
      });
      if (existing.length !== all.length) throw new ConflictException({ code: 'taste_recipe_no_longer_available' });
    }
    return { likedRecipeIds, dislikedRecipeIds };
  }

  private async upsertDeclaredFact(
    tx: Tx,
    userId: string,
    dimension: string,
    value: string | string[],
    source = 'onboarding_v2',
  ) {
    const key = `declared.${dimension}`;
    await tx.userFact.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, value: { v: value }, source, confidence: 1 },
      update: { value: { v: value }, source, confidence: 1, expiresAt: null },
    });
  }

  private async readDeclaredFact(tx: Tx, userId: string, dimension: string): Promise<string[]> {
    const row = await tx.userFact.findUnique({
      where: { userId_key: { userId, key: `declared.${dimension}` } },
      select: { value: true },
    });
    return jsonArray((row?.value as any)?.v ?? row?.value);
  }

  private async legacySeed(client: any, userId: string): Promise<any> {
    const [user, hardRows, preference, facts] = await Promise.all([
      client.user.findUnique({ where: { id: userId }, select: { onboardingCompletedAt: true } }),
      client.userAllergy.findMany({ where: { userId }, include: { allergy: true } }),
      client.userPreference.findUnique({ where: { userId } }),
      client.userFact.findMany({
        where: {
          userId,
          key: {
            in: [
              'declared.dietary.intolerances',
              'declared.dietary.cultural_constraints',
              'declared.constraints.cooking_time_workday',
              'declared.context.cooks_for_count',
            ],
          },
        },
        select: { key: true, value: true, updatedAt: true },
      }),
    ]);
    const factByKey = new Map(facts.map((f: any) => [f.key, (f.value as any)?.v ?? f.value]));
    const allLegacyHard = hardRows.map((r: any) => r.allergy?.name).filter(Boolean);
    // Legacy UserAllergy has no kind discriminator, so preserve it conservatively
    // as allergy. Unsupported/deferred tokens remain in the hard gate but are not
    // surfaced as editable V2 options.
    const allergyIds = uniqueSorted(allLegacyHard).filter((id) => SUPPORTED_ALLERGENS.has(id));
    const intoleranceIds = jsonArray(factByKey.get('declared.dietary.intolerances'))
      .filter((id) => SUPPORTED_ALLERGENS.has(id) && !allergyIds.includes(id));
    const dietaryRules = jsonArray(factByKey.get('declared.dietary.cultural_constraints'))
      .filter((rule) => ALLOWED_RULES.has(rule));
    const dietPattern = ALLOWED_DIETS.has(String(preference?.diet)) ? preference.diet : null;
    const time = factByKey.get('declared.constraints.cooking_time_workday');
    const weekdayTimeBucket = ALLOWED_TIME_BUCKETS.has(String(time)) ? time : null;
    const cooksForRaw = factByKey.get('declared.context.cooks_for_count');
    const cooksForCount = ALLOWED_COOKS_FOR.has(String(cooksForRaw)) ? cooksForRaw : null;
    // The status describes allergy/intolerance disclosure only. A legacy no-pork
    // rule cannot be reinterpreted as "I declared an allergy" or "I have none".
    const hasSafetyDeclaration = allergyIds.length + intoleranceIds.length > 0;
    const updatedTimes = facts.map((f: any) => f.updatedAt).filter(Boolean);
    if (preference?.updatedAt) updatedTimes.push(preference.updatedAt);
    const updatedAt = updatedTimes.length
      ? new Date(Math.max(...updatedTimes.map((d: any) => new Date(d).getTime())))
      : null;
    return {
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      revision: 0,
      safetyStatus: hasSafetyDeclaration ? 'declared' : 'unknown',
      allergyIds,
      intoleranceIds,
      dietaryRules,
      dietPattern,
      weekdayTimeBucket,
      cooksForCount,
      likedRecipeIds: [],
      dislikedRecipeIds: [],
      completedAt: user?.onboardingCompletedAt ?? null,
      updatedAt,
    };
  }

  private createDataFromLegacy(legacy: any): Record<string, unknown> {
    return {
      safetyStatus: legacy.safetyStatus,
      allergyIds: legacy.allergyIds,
      intoleranceIds: legacy.intoleranceIds,
      dietaryRules: legacy.dietaryRules,
      dietPattern: legacy.dietPattern,
      weekdayTimeBucket: legacy.weekdayTimeBucket,
      cooksForCount: legacy.cooksForCount,
      likedRecipeIds: [],
      dislikedRecipeIds: [],
    };
  }

  private view(row: any | null): OnboardingV2View {
    if (!row) {
      return {
        schemaVersion: ONBOARDING_SCHEMA_VERSION,
        revision: 0,
        status: 'draft',
        completedAt: null,
        safety: { status: 'unknown', allergyIds: [], intoleranceIds: [], dietaryRules: [] },
        preferences: { dietPattern: null, weekdayTimeBucket: null, cooksForCount: null },
        taste: { likedRecipeIds: [], dislikedRecipeIds: [] },
        updatedAt: null,
      };
    }
    return {
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      revision: Number(row.revision ?? 0),
      status: row.completedAt ? 'completed' : 'draft',
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
      safety: {
        status: ['none', 'declared'].includes(row.safetyStatus) ? row.safetyStatus : 'unknown',
        allergyIds: jsonArray(row.allergyIds),
        intoleranceIds: jsonArray(row.intoleranceIds),
        dietaryRules: jsonArray(row.dietaryRules) as any,
      },
      preferences: {
        dietPattern: ALLOWED_DIETS.has(String(row.dietPattern)) ? row.dietPattern : null,
        weekdayTimeBucket: ALLOWED_TIME_BUCKETS.has(String(row.weekdayTimeBucket))
          ? row.weekdayTimeBucket
          : null,
        cooksForCount: ALLOWED_COOKS_FOR.has(String(row.cooksForCount)) ? row.cooksForCount : null,
      },
      taste: {
        likedRecipeIds: jsonArray(row.likedRecipeIds),
        dislikedRecipeIds: jsonArray(row.dislikedRecipeIds),
      },
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    };
  }

  private async findReplay(
    userId: string,
    idempotencyKey: string,
    operation: string,
    hash: string,
  ): Promise<Record<string, unknown> | null> {
    const mutation = await this.prisma.onboardingMutation.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    return this.validateReplay(mutation, operation, hash);
  }

  private async findReplayTx(
    tx: Tx,
    userId: string,
    idempotencyKey: string,
    operation: string,
    hash: string,
  ): Promise<Record<string, unknown> | null> {
    const mutation = await tx.onboardingMutation.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    return this.validateReplay(mutation, operation, hash);
  }

  private validateReplay(mutation: any, operation: string, hash: string): Record<string, unknown> | null {
    if (!mutation) return null;
    if (mutation.operation !== operation || mutation.requestHash !== hash) {
      throw new ConflictException({ code: 'idempotency_key_reused' });
    }
    const response = mutation.response;
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      throw new InternalServerErrorException({ code: 'idempotency_response_invalid' });
    }
    return response as Record<string, unknown>;
  }

  private normalizeSearchText(value: unknown): string {
    return String(value ?? '')
      .normalize('NFKC')
      .toLocaleLowerCase('fa-IR')
      .replace(/[يى]/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
