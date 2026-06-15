/**
 * Declared Profile (GARNISH-PROFILE-L4-05) — types.
 *
 * The DECLARED half of the living user profile: what the user states about themselves (vs the OBSERVED
 * UserFoodIdentityGraph built from behavior). ADDITIVE + SEPARATE from the observed graph (does not
 * change its dimensions or QA gate). Pure types only.
 *
 * Privacy stance: declared data can be sensitive (age/gender/job/income/household/goals). Every
 * dimension carries its `privacyClass` + required `consentPurpose`; sensitive values are stored as
 * BANDS/categories (never raw precise values), consent-gated, never written to event metadata, and
 * omitted from any non-owner read or explanation. NO medical/diagnostic/strict-diet claims — health
 * goals are user-declared preferences, never assessments.
 */

export type DeclaredGroup = 'context' | 'dietary' | 'goals' | 'history' | 'constraints';
export const DECLARED_GROUPS: readonly DeclaredGroup[] = ['context', 'dietary', 'goals', 'history', 'constraints'] as const;

/** Mirrors the subset of ConsentPurposeEnum usable at the profile layer (no b2b_aggregate / community). */
export type DeclaredConsentPurpose = 'core' | 'analytics' | 'personalization';
export type DeclaredPrivacyClass = 'P1-pseudonymous' | 'P2-sensitive';
export type DeclaredValueType = 'single_select' | 'multi_select' | 'band' | 'boolean' | 'scale';
export type DeclaredDimensionStatus = 'unknown' | 'declared' | 'stale' | 'consent_withheld';

/** Where a declared dimension is persisted (the builder/service routes accordingly). */
export type DeclaredPersistence = 'user_fact' | 'user_preference' | 'user_allergy' | 'contract_only';

/** A declared-dimension definition — the extensible catalog entry (stage-2 = add one of these). */
export interface DeclaredDimensionDef {
  key: string; // e.g. 'context.age_range'
  group: DeclaredGroup;
  label: string; // safe, non-creepy, non-medical
  valueType: DeclaredValueType;
  /** allowed values (bands/categories for selects). For sensitive numerics these are BANDS, not raw values. */
  options?: string[];
  sensitive: boolean; // sensitive → P2, never in metadata, omitted from non-owner reads
  privacyClass: DeclaredPrivacyClass;
  consentPurpose: DeclaredConsentPurpose;
  storeAsBand: boolean; // age/income/budget/time stored as a band, never a precise value
  recencyHalfLifeDays: number; // declared facts can go stale (job/household change)
  priority: number; // question-engine value weight (higher = ask sooner)
  persistence: DeclaredPersistence;
  safeExplanationTemplate: string;
}

/** A raw declared answer (already banded if the def says storeAsBand). */
export interface DeclaredAnswer {
  key: string;
  value: unknown;
  declaredAt: string; // ISO-8601
}

/** Consent state: which purposes the user has granted. */
export interface DeclaredConsentState {
  granted: DeclaredConsentPurpose[];
}

export interface DeclaredDimension {
  key: string;
  group: DeclaredGroup;
  status: DeclaredDimensionStatus;
  value: unknown | null; // null when unknown / consent withheld
  confidence: number; // 0..1
  recencyScore: number; // 0..1
  privacyClass: DeclaredPrivacyClass;
  consentPurpose: DeclaredConsentPurpose;
  consentGranted: boolean;
  sensitive: boolean;
  declaredAt: string | null;
  safeExplanation: string;
  limitations: string[];
}

export interface DeclaredProfile {
  userId: string;
  version: 1;
  generatedAt: string;
  dimensions: Record<string, DeclaredDimension>;
  coverage: {
    declaredCount: number;
    totalCount: number;
    coverageScore: number; // 0..1 share of consent-eligible dims that are declared
    byGroup: Record<DeclaredGroup, number>;
  };
  privacy: {
    highestPrivacyClass: DeclaredPrivacyClass;
    consentPurposesUsed: string[];
    containsSensitive: boolean;
  };
  limitations: string[];
}
