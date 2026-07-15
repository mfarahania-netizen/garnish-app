// Technical audit identifiers only. They do not imply Privacy/Legal approval.
export const CURRENT_TERMS_POLICY_VERSION = 'terms-1405-03-29';
export const CURRENT_PRIVACY_POLICY_VERSION = 'privacy-1405-03-29';

// UI collection is independently default-off. Future activation requires this reviewed build flag
// plus the matching server-side processing switch and a current recorded choice.
export const OPTIONAL_PERSONALIZATION_UI_ENABLED =
  import.meta.env.VITE_OPTIONAL_PERSONALIZATION_UI_ENABLED === 'true';
