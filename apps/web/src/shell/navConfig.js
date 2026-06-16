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
  IconTrophy,
  IconSettings,
  IconHeadset,
} from '@tabler/icons-react';

// BottomNav — 5 primary tabs (RTL order: first item renders at the inline-start / right).
export const BOTTOM_TABS = [
  { label: 'خانه', to: '/', Icon: IconHome, end: true },
  { label: 'برنامه', to: '/plan', Icon: IconCalendarEvent },
  { label: 'کشف', to: '/discover', Icon: IconCompass },
  { label: 'علاقه‌مندی‌ها', to: '/favorites', Icon: IconHeart },
  { label: 'پروفایل', to: '/profile', Icon: IconUser },
];

// Hamburger Drawer — the full nav (9 destinations per the approved design).
export const DRAWER_ITEMS = [
  { label: 'خانه', to: '/', Icon: IconHome, end: true },
  { label: 'کشف', to: '/discover', Icon: IconCompass },
  { label: 'برنامه', to: '/plan', Icon: IconCalendarEvent },
  { label: 'لیست خرید', to: '/shopping-list', Icon: IconShoppingCart },
  { label: 'علاقه‌مندی‌ها', to: '/favorites', Icon: IconHeart },
  { label: 'پروفایل', to: '/profile', Icon: IconUser },
  { label: 'دستاوردها', to: '/achievements', Icon: IconTrophy },
  { label: 'تنظیمات', to: '/settings', Icon: IconSettings },
  { label: 'پشتیبانی', to: '/support', Icon: IconHeadset },
];
