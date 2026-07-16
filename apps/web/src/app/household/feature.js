export function isHouseholdV1Enabled(env = import.meta.env) {
  return env?.VITE_HOUSEHOLD_V1_ENABLED === 'true';
}
