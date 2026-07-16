export const queryKeys = {
  me: ['home', 'me'],
  preferences: ['discover', 'preferences'],
  gamificationMe: ['home', 'gamification'],
  profile: {
    living: ['home', 'profile'],
    dna: ['profile', 'dna'],
    nextQuestion: ['profile', 'next-question'],
    taste: ['profile', 'taste'],
  },
  consent: ['users', 'consent'],
  onboardingProfile: ['onboarding', 'profile'],
};

export function invalidateProfileDomain(queryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.me });
  queryClient.invalidateQueries({ queryKey: queryKeys.preferences });
  queryClient.invalidateQueries({ queryKey: queryKeys.gamificationMe });
  queryClient.invalidateQueries({ queryKey: queryKeys.profile.living });
  queryClient.invalidateQueries({ queryKey: queryKeys.profile.dna });
  queryClient.invalidateQueries({ queryKey: queryKeys.profile.taste });
  queryClient.invalidateQueries({ queryKey: queryKeys.consent });
  queryClient.invalidateQueries({ queryKey: queryKeys.onboardingProfile });
}
