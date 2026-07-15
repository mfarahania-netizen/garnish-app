import { TASTE_DISLIKE_LIMIT, TASTE_LIKE_LIMIT, WEEKDAY_TIME_BUCKETS } from './onboarding-v2.contract';

/** Pure projection from the canonical V2 row into live ranker features. Keeping
 * this deterministic makes declared answers effective before behavior matures and
 * makes cache rebuilds/replays produce the same vector. */
export function onboardingV2Features(
  profile: any | null,
  personalizationGranted = false,
): Record<string, number> {
  if (!profile || profile.schemaVersion !== 2 || !profile.completedAt) return {};
  const out: Record<string, number> = {};
  const time = String(profile.weekdayTimeBucket ?? '');
  const quick: Record<string, number> = {
    under_15: 1,
    '15_30': 0.82,
    '30_60': 0.28,
  };
  if ((WEEKDAY_TIME_BUCKETS as readonly string[]).includes(time)) {
    out[`signal_declared_time_${time}`] = 1;
  }
  if (quick[time] !== undefined) {
    out.signal_quick_meal_lover = quick[time];
  }
  // Time is an explicit product preference and remains usable as core account data.
  // Taste calibration is optional personalization data: a later withdrawal must stop
  // it from entering a freshly rebuilt vector even if an older onboarding row remains.
  const likes = personalizationGranted && Array.isArray(profile.likedRecipeIds)
    ? profile.likedRecipeIds
    : [];
  const dislikes = personalizationGranted && Array.isArray(profile.dislikedRecipeIds)
    ? profile.dislikedRecipeIds
    : [];
  for (const id of likes.slice(0, TASTE_LIKE_LIMIT)) {
    if (typeof id === 'string' && id) out[`onboarding_like_${id}`] = 1;
  }
  for (const id of dislikes.slice(0, TASTE_DISLIKE_LIMIT)) {
    if (typeof id === 'string' && id) out[`onboarding_dislike_${id}`] = 1;
  }
  return out;
}
