import { eventRewardValue } from './reward-values';

describe('eventRewardValue — canonical reward scale', () => {
  it('maps each outcome to its reward', () => {
    expect(eventRewardValue('recommendation_cook')).toBe(1);
    expect(eventRewardValue('cook_complete')).toBe(1); // organic cook (no-lost-signals union)
    expect(eventRewardValue('recommendation_save')).toBe(0.6);
    expect(eventRewardValue('recommendation_click')).toBe(0.2);
    expect(eventRewardValue('recommendation_dismiss')).toBe(-0.8);
    expect(eventRewardValue('recommendation_ignore')).toBe(-0.4);
  });
  it('unknown / neutral events score 0', () => {
    expect(eventRewardValue('recipe_view')).toBe(0);
    expect(eventRewardValue('whatever')).toBe(0);
  });
});
