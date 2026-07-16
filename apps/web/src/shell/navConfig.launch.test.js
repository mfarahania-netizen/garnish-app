import {
  BOTTOM_TABS,
  DRAWER_PRIMARY,
  DRAWER_SECONDARY,
  drawerHouseholdFor,
} from './navConfig';

describe('launch navigation IA', () => {
  it('puts shopping in bottom nav and removes favorites from primary tabs', () => {
    expect(BOTTOM_TABS.map((tab) => tab.to)).toEqual(['/', '/discover', '/plan', '/shopping-list', '/profile']);
    expect(BOTTOM_TABS.map((tab) => tab.label)).toContain('خرید');
    expect(BOTTOM_TABS.find((tab) => tab.to === '/discover')?.label).toBe('پیشنهادها');
    expect(BOTTOM_TABS.map((tab) => tab.to)).not.toContain('/favorites');
  });

  it('keeps saved recipes reachable from the drawer', () => {
    expect(DRAWER_PRIMARY.some((item) => item.to === '/favorites' && item.label === 'ذخیره‌ها')).toBe(true);
  });

  it('keeps the drawer complementary to bottom navigation and the notification bell', () => {
    const drawerRoutes = [...DRAWER_PRIMARY, ...DRAWER_SECONDARY].map((item) => item.to);
    for (const duplicate of ['/profile', '/plan', '/shopping-list', '/notifications']) {
      expect(drawerRoutes).not.toContain(duplicate);
    }
  });

  it('exposes خرید باهم as a featured drawer destination only when its flag is enabled', () => {
    expect(drawerHouseholdFor({ VITE_HOUSEHOLD_V1_ENABLED: 'true' }))
      .toEqual(expect.objectContaining({ to: '/household', label: 'خرید باهم' }));
    expect(drawerHouseholdFor({ VITE_HOUSEHOLD_V1_ENABLED: 'false' })).toBeNull();
  });
});
