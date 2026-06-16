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
  IconCalendarWeek,
  IconShoppingCart,
  IconHeart,
  IconUser,
  IconUserCircle,
  IconLeaf,
  IconSparkles,
  IconSettings,
  IconBell,
  IconHelpCircle,
} from '@tabler/icons-react';

// BottomNav — 5 primary tabs (RTL order: first item renders at the inline-start / right).
export const BOTTOM_TABS = [
  { label: 'خانه', to: '/', Icon: IconHome, end: true },
  { label: 'برنامه', to: '/plan', Icon: IconCalendarEvent },
  { label: 'کشف', to: '/discover', Icon: IconCompass },
  { label: 'علاقه‌مندی‌ها', to: '/favorites', Icon: IconHeart },
  { label: 'پروفایل', to: '/profile', Icon: IconUser },
];

// Hamburger Drawer — two grouped sections, matching the approved mockup. Each item
// is a real route (unbuilt paths land on the in-shell 404); rendered ONCE.
export const DRAWER_PRIMARY = [
  { label: 'پروفایل من', to: '/profile', Icon: IconUserCircle },
  { label: 'شناسهٔ ذائقه', to: '/food-dna', Icon: IconLeaf },
  { label: 'برنامهٔ هفتگی', to: '/plan', Icon: IconCalendarWeek },
  { label: 'لیست خرید', to: '/shopping-list', Icon: IconShoppingCart },
  { label: 'دستیار آشپزی', to: '/assist', Icon: IconSparkles },
];

export const DRAWER_SECONDARY = [
  { label: 'تنظیمات', to: '/settings', Icon: IconSettings },
  { label: 'اعلان‌ها', to: '/notifications', Icon: IconBell },
  { label: 'کمک و پشتیبانی', to: '/support', Icon: IconHelpCircle },
];
