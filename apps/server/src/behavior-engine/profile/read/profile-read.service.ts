/**
 * ProfileReadService (GARNISH-PROFILE-L4-05) — owner-only, consent-aware. NO UI.
 *
 * Orchestrates: read consent + persisted declared answers → build the DeclaredProfile → compose the
 * Living Profile (declared + observed) with maturity/coverage. Also serves the question engine and
 * persists declared answers privacy-safely:
 *   - non-sensitive-keyed declared dims → UserFact (UserFactService still enforces its sensitive-key guard),
 *   - dietary pattern / skill / budget → UserPreference (existing),
 *   - allergies → deferred to the existing allergy flow (never bypasses the safe-fact guard),
 *   - sensitive demographics → UserFact under a non-clinical key, stored as BANDS only.
 *
 * Reads are owner-scoped by the authenticated userId; sensitive dims are never exposed to a non-owner.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserFactService } from '../../../ai/facts/user-fact.service';
import { buildDeclaredProfile, ownerReadView, validateDeclaredAnswer } from '../declared/declared-profile.builder';
import { getDeclaredDef } from '../declared/declared-dimension-registry';
import { DeclaredAnswer, DeclaredConsentState, DeclaredConsentPurpose } from '../declared/declared-profile.types';
import { QuestionSelectionService } from '../onboarding/question-selection.service';
import { composeLivingProfile, COLD_START_OBSERVED, LivingProfile } from './living-profile';

const FACT_PREFIX = 'declared.';
const VALID_PURPOSES = new Set<DeclaredConsentPurpose>(['core', 'analytics', 'personalization']);
const BUDGET_BANDS = new Set(['tight', 'moderate', 'comfortable', 'flexible']);

export interface AnswerResult {
  accepted: boolean;
  status: 'persisted' | 'rejected' | 'consent_required' | 'use_allergy_flow';
  dimensionKey: string;
  reason?: string;
}

@Injectable()
export class ProfileReadService {
  private readonly logger = new Logger(ProfileReadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userFacts: UserFactService,
    private readonly questions: QuestionSelectionService,
  ) {}

  /** Read the user's consent state (granted purposes) from ConsentLog. core is always granted. */
  async getConsentState(userId: string): Promise<DeclaredConsentState> {
    const granted = new Set<DeclaredConsentPurpose>(['core']);
    try {
      const rows = await this.prisma.consentLog.findMany({ where: { userId, granted: true } });
      for (const r of rows) {
        const p = (r.purpose ?? '') as DeclaredConsentPurpose;
        if (VALID_PURPOSES.has(p)) granted.add(p);
      }
    } catch (err) {
      this.logger.warn(`consent read unavailable; defaulting to core only: ${err instanceof Error ? err.name : 'error'}`);
    }
    return { granted: [...granted] };
  }

  /** Gather persisted declared answers from UserFact + UserPreference + UserAllergy. */
  async getDeclaredAnswers(userId: string): Promise<DeclaredAnswer[]> {
    const answers: DeclaredAnswer[] = [];
    try {
      const facts = await this.userFacts.listByUser(userId);
      for (const f of facts) {
        if (!f.key.startsWith(FACT_PREFIX)) continue;
        answers.push({ key: f.key.slice(FACT_PREFIX.length), value: (f.value as any)?.v ?? f.value, declaredAt: (f.updatedAt ?? new Date()).toISOString() });
      }
    } catch (err) {
      this.logger.warn(`user-fact read unavailable: ${err instanceof Error ? err.name : 'error'}`);
    }
    try {
      const pref = await this.prisma.userPreference.findUnique({ where: { userId } });
      if (pref) {
        const at = (pref.updatedAt ?? new Date()).toISOString();
        if (pref.diet) answers.push({ key: 'dietary.pattern', value: pref.diet, declaredAt: at });
        if (pref.skillLevel) answers.push({ key: 'constraints.cooking_skill', value: pref.skillLevel, declaredAt: at });
        if (pref.budget && BUDGET_BANDS.has(pref.budget)) answers.push({ key: 'constraints.weekly_budget_band', value: pref.budget, declaredAt: at });
      }
    } catch (err) {
      this.logger.warn(`preference read unavailable: ${err instanceof Error ? err.name : 'error'}`);
    }
    try {
      const allergies = await this.prisma.userAllergy.findMany({ where: { userId }, include: { allergy: true } });
      if (allergies.length) {
        answers.push({ key: 'dietary.allergies_intolerances', value: allergies.map((a) => a.allergy?.name).filter(Boolean), declaredAt: new Date().toISOString() });
      }
    } catch (err) {
      this.logger.warn(`allergy read unavailable: ${err instanceof Error ? err.name : 'error'}`);
    }
    return answers;
  }

  async getLivingProfile(userId: string, now: Date = new Date()): Promise<LivingProfile> {
    const consent = await this.getConsentState(userId);
    const answers = await this.getDeclaredAnswers(userId);
    const declared = buildDeclaredProfile(userId, answers, consent, { now });
    // owner sees full declared; observed is cold-start until signal hydration (stage-2 plug-in)
    const ownerDeclared = ownerReadView(declared, true);
    return composeLivingProfile(ownerDeclared, COLD_START_OBSERVED, now);
  }

  async getNextQuestion(userId: string, now: Date = new Date()) {
    const consent = await this.getConsentState(userId);
    const answers = await this.getDeclaredAnswers(userId);
    const declared = buildDeclaredProfile(userId, answers, consent, { now });
    return this.questions.selectNext(declared, consent);
  }

  /** Persist a declared answer privacy-safely (consent-gated, banded, guard-respecting). */
  async submitAnswer(userId: string, key: string, value: unknown): Promise<AnswerResult> {
    const def = getDeclaredDef(key);
    if (!def) return { accepted: false, status: 'rejected', dimensionKey: key, reason: 'unknown dimension' };

    const consent = await this.getConsentState(userId);
    if (!consent.granted.includes(def.consentPurpose)) {
      return { accepted: false, status: 'consent_required', dimensionKey: key, reason: `requires consent: ${def.consentPurpose}` };
    }
    const v = validateDeclaredAnswer(def, value);
    if (!v.ok) return { accepted: false, status: 'rejected', dimensionKey: key, reason: v.reason };

    if (def.persistence === 'user_allergy') {
      // never bypass the safe-fact guard / re-store allergies here — route to the dedicated flow
      return { accepted: false, status: 'use_allergy_flow', dimensionKey: key, reason: 'manage allergies via the allergy settings flow' };
    }
    if (def.persistence === 'contract_only') {
      return { accepted: true, status: 'persisted', dimensionKey: key, reason: 'validated (contract-only; not persisted in stage 1)' };
    }
    if (def.persistence === 'user_preference') {
      const data: Record<string, unknown> = {};
      if (key === 'dietary.pattern') data.diet = v.value;
      else if (key === 'constraints.cooking_skill') data.skillLevel = v.value;
      else if (key === 'constraints.weekly_budget_band') data.budget = v.value;
      await this.prisma.userPreference.upsert({ where: { userId }, create: { userId, ...data }, update: data });
      return { accepted: true, status: 'persisted', dimensionKey: key };
    }
    // user_fact — UserFactService re-enforces its sensitive-key guard (we never weaken it)
    await this.userFacts.upsert({ userId, key: `${FACT_PREFIX}${key}`, value: { v: v.value }, source: 'declared', confidence: 0.85 });
    return { accepted: true, status: 'persisted', dimensionKey: key };
  }
}
