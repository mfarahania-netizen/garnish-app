export function householdV1Enabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (env.HOUSEHOLD_V1_ENABLED ?? '').trim().toLowerCase() === 'true';
}
