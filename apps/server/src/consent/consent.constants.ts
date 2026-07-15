/**
 * Technical policy identifiers mirror the currently visible legal-page dates.
 * They are version keys for auditability, not legal approval.
 */
export const CURRENT_TERMS_POLICY_VERSION = 'terms-1405-03-29' as const;
export const CURRENT_PRIVACY_POLICY_VERSION = 'privacy-1405-03-29' as const;

/** Technical placeholder only; Privacy/Legal owns the final Terms lawful-basis determination. */
export const TERMS_LAWFUL_BASIS = 'pending_legal_review' as const;

/** Purposes a user may independently grant or decline from Settings. */
export const OPTIONAL_CONSENT_PURPOSES = [
  'analytics',
  'personalization',
] as const;
export type OptionalConsentPurpose = (typeof OPTIONAL_CONSENT_PURPOSES)[number];

/**
 * Privacy/Legal has not approved the operational purpose matrix yet. A recorded user choice therefore
 * does not activate optional processing by itself. These server-owned switches remain false unless an
 * operator explicitly enables the corresponding approved purpose in a reviewed environment.
 */
export function isOptionalPurposeRuntimeEnabled(purpose: string): boolean {
  if (purpose === 'analytics') {
    return process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED === 'true';
  }
  if (purpose === 'personalization') {
    return process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED === 'true';
  }
  return true;
}
