/**
 * Question Selection Service (GARNISH-PROFILE-L4-05) — backend logic, NO UI.
 *
 * Deterministically decides WHICH declared question to ask next, WHEN, and WHY, from:
 *  - declared-profile gaps + per-dimension confidence (ask high-value, low-confidence dims first),
 *  - consent state (NEVER ask a question whose required consent purpose is not granted),
 *  - already-known/inferred state (skip dims already declared with good recency).
 *
 * Pure + deterministic; returns the selected question(s) with an explicit, auditable `reason`.
 */
import { Injectable } from '@nestjs/common';
import { QUESTION_BANK, OnboardingQuestion } from './question-bank';
import { DeclaredConsentState, DeclaredProfile } from '../declared/declared-profile.types';

export interface NextQuestionResult {
  question: OnboardingQuestion | null;
  reason: string;
  remaining: number; // eligible, not-yet-confident questions still askable
}

const GROUP_ORDER: Record<string, number> = { dietary: 0, constraints: 1, goals: 2, context: 3, history: 4 };
const CONFIDENT_ENOUGH = 0.6; // a dim above this with fresh data is "known" → not re-asked

@Injectable()
export class QuestionSelectionService {
  /** All questions still worth asking, ranked (highest-value first). */
  rankEligible(profile: DeclaredProfile, consent: DeclaredConsentState): { question: OnboardingQuestion; score: number }[] {
    const granted = new Set(consent.granted);
    const eligible = QUESTION_BANK.filter((q) => {
      // consent gate: never ask a question whose purpose isn't granted (esp. sensitive ones)
      if (!granted.has(q.consentPurpose)) return false;
      const dim = profile.dimensions[q.dimensionKey];
      if (!dim) return true;
      // skip ones already known with good confidence + fresh recency
      const known = dim.status === 'declared' && dim.confidence >= CONFIDENT_ENOUGH;
      return !known;
    });

    return eligible
      .map((q) => {
        const dim = profile.dimensions[q.dimensionKey];
        const confidence = dim?.confidence ?? 0;
        // higher priority + lower current confidence ⇒ higher score; stale beats unknown only slightly
        const score = q.priority * 10 + (1 - confidence) * 5 - (GROUP_ORDER[q.group] ?? 9) * 0.1;
        return { question: q, score };
      })
      .sort((a, b) => b.score - a.score || a.question.dimensionKey.localeCompare(b.question.dimensionKey));
  }

  selectNext(profile: DeclaredProfile, consent: DeclaredConsentState): NextQuestionResult {
    const ranked = this.rankEligible(profile, consent);
    if (ranked.length === 0) {
      return { question: null, reason: 'no eligible questions — all consented dimensions are known or consent is insufficient', remaining: 0 };
    }
    const top = ranked[0];
    const dim = profile.dimensions[top.question.dimensionKey];
    const why = dim?.status === 'stale'
      ? `re-asking a high-value dimension (${top.question.dimensionKey}) whose declared value is going stale`
      : `highest-value dimension not yet known (${top.question.dimensionKey}, priority ${top.question.priority})`;
    return { question: top.question, reason: why, remaining: ranked.length };
  }

  /** Ordered sequence (e.g. for a future onboarding flow) — same ranking, full list. */
  selectSequence(profile: DeclaredProfile, consent: DeclaredConsentState, limit = 50): OnboardingQuestion[] {
    return this.rankEligible(profile, consent).slice(0, limit).map((r) => r.question);
  }
}
