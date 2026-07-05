import { BOTTOM_TABS, DRAWER_PRIMARY } from './navConfig';

describe('launch navigation IA', () => {
  it('puts shopping in bottom nav and removes favorites from primary tabs', () => {
    expect(BOTTOM_TABS.map((tab) => tab.to)).toEqual(['/', '/discover', '/plan', '/shopping-list', '/profile']);
    expect(BOTTOM_TABS.map((tab) => tab.label)).toContain('خرید');
    expect(BOTTOM_TABS.map((tab) => tab.to)).not.toContain('/favorites');
  });

  it('keeps saved recipes reachable from the drawer', () => {
    expect(DRAWER_PRIMARY.some((item) => item.to === '/favorites' && item.label === 'ذخیره‌ها')).toBe(true);
  });
});
