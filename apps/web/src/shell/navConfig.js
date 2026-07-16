/* ============================================================
   GARNISH APP SHELL — navigation config (FE-RESET-A)
   Single source of truth for the chrome's wayfinding. Paths route via
   react-router; the active state is derived from the route (NavLink).
   No content pages exist yet — unbuilt paths land on the in-shell 404.
   `end: true` makes "/" active only on an exact match.
   ============================================================ */
import {
  IconHome,
  IconCompass,
  IconCalendarEvent,
  IconShoppingCart,
  IconHeart,
  IconUser,
  IconUsers,
  IconChefHat,
  IconLeaf,
  IconSparkles,
  IconSettings,
  IconHelpCircle,
} from '@tabler/icons-react';
import { isHouseholdV1Enabled } from '../app/household/feature';

// BottomNav — 5 primary tabs (RTL order: first item renders at the inline-start / right).
export const BOTTOM_TABS = [
  { label: 'خانه', to: '/', Icon: IconHome, end: true },
  { label: 'پیشنهادها', to: '/discover', Icon: IconCompass },
  { label: 'برنامه', to: '/plan', Icon: IconCalendarEvent },
  { label: 'خرید', to: '/shopping-list', Icon: IconShoppingCart },
  { label: 'پروفایل', to: '/profile', Icon: IconUser },
];

// The drawer is intentionally complementary to the five bottom destinations.
// Repeating profile/plan/shopping here made the menu longer without creating a
// new wayfinding job. Household is a featured entry, not another generic row.
export const DRAWER_PRIMARY = [
  { label: 'دستورها', to: '/recipes', Icon: IconChefHat },
  { label: 'ذخیره‌ها', to: '/favorites', Icon: IconHeart },
  { label: 'شناسهٔ ذائقه', to: '/food-dna', Icon: IconLeaf },
  { label: 'دستیار آشپزی', to: '/assistant', Icon: IconSparkles },
];

export function drawerHouseholdFor(env = import.meta.env) {
  return isHouseholdV1Enabled(env)
    ? {
        label: 'خرید باهم',
        description: 'لیست مشترک و تصمیم سریع برای خرید',
        to: '/household',
        Icon: IconUsers,
      }
    : null;
}

export const DRAWER_HOUSEHOLD = drawerHouseholdFor();

export const DRAWER_SECONDARY = [
  { label: 'تنظیمات', to: '/settings', Icon: IconSettings },
  { label: 'کمک و پشتیبانی', to: '/support', Icon: IconHelpCircle },
];
