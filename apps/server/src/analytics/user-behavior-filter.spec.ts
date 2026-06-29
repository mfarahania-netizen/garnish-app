import { isUserBehaviorEvent, USER_BEHAVIOR_EVENT_WHERE } from './user-behavior-filter';

describe('isUserBehaviorEvent', () => {
  it('accepts real user events', () => {
    for (const t of ['recipe_view', 'cook_complete', 'search_query', 'ai_message_send', 'favorite_add', 'session_start']) {
      expect(isUserBehaviorEvent(t)).toBe(true);
    }
  });

  it('rejects operator (admin_*) and system (cron_*) events', () => {
    for (const t of ['admin_view', 'admin_tab_change', 'admin_recipe_approve', 'cron_behavior_engine_run']) {
      expect(isUserBehaviorEvent(t)).toBe(false);
    }
  });

  it('rejects the non-prefixed system event + nullish', () => {
    expect(isUserBehaviorEvent('resolve_miss')).toBe(false);
    expect(isUserBehaviorEvent('')).toBe(false);
    expect(isUserBehaviorEvent(null)).toBe(false);
    expect(isUserBehaviorEvent(undefined)).toBe(false);
  });

  it('is case-insensitive on the prefix', () => {
    expect(isUserBehaviorEvent('ADMIN_view')).toBe(false);
    expect(isUserBehaviorEvent('Cron_X')).toBe(false);
  });

  it('the Prisma WHERE excludes admin_/cron_/resolve_miss', () => {
    expect(USER_BEHAVIOR_EVENT_WHERE.NOT).toEqual(
      expect.arrayContaining([
        { type: { startsWith: 'admin_' } },
        { type: { startsWith: 'cron_' } },
      ]),
    );
    const inClause = USER_BEHAVIOR_EVENT_WHERE.NOT.find((n: any) => n.type?.in);
    expect((inClause as any).type.in).toContain('resolve_miss');
  });
});
