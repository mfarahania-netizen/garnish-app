// apps/web/src/app/recipe/[id]/components/helpers.js

export const getIngredientEmoji = (name) => {
  if (!name) return '🍽️';
  const clean = name.trim().toLowerCase();
  if (clean.includes('مرغ') || clean.includes('جوجه')) return '🍗';
  if (clean.includes('گوشت')) return '🥩';
  if (clean.includes('پیاز')) return '🧅';
  if (clean.includes('سیر')) return '🧄';
  if (clean.includes('گوجه')) return '🍅';
  if (clean.includes('تخم‌مرغ') || clean.includes('تخم مرغ')) return '🥚';
  if (clean.includes('رب')) return '🥫';
  if (clean.includes('برنج')) return '🍚';
  if (clean.includes('ماست')) return '🥛';
  if (clean.includes('کره') || clean.includes('روغن')) return '🧈';
  if (clean.includes('پنیر')) return '🧀';
  if (clean.includes('سبزی') || clean.includes('نعنا') || clean.includes('جعفری') || clean.includes('گشنیز') || clean.includes('شوید') || clean.includes('تره')) return '🌿';
  if (clean.includes('فلفل')) return '🌶️';
  if (clean.includes('زردچوبه') || clean.includes('زعفران') || clean.includes('نمک') || clean.includes('ادویه') || clean.includes('فلفل سیاه')) return '🧂';
  if (clean.includes('قارچ')) return '🍄';
  if (clean.includes('لیمو')) return '🍋';
  if (clean.includes('سیب‌زمینی') || clean.includes('سیب زمینی')) return '🥔';
  if (clean.includes('هویج')) return '🥕';
  if (clean.includes('لوبیا') || clean.includes('عدس') || clean.includes('نخود') || clean.includes('لپه')) return '🫘';
  if (clean.includes('ماهی') || clean.includes('میگو')) return '🐟';
  if (clean.includes('گردو') || clean.includes('بادام') || clean.includes('پسته')) return '🥜';
  if (clean.includes('شکر') || clean.includes('عسل')) return '🍯';
  if (clean.includes('آرد') || clean.includes('آرد‌')) return '🌾';
  if (clean.includes('خیار')) return '🥒';
  if (clean.includes('شیر')) return '🥛';
  if (clean.includes('خرما')) return '🌴';
  if (clean.includes('گلاب') || clean.includes('بهار نارنج')) return '🌸';
  if (clean.includes('سرکه')) return '🍶';
  if (clean.includes('اسفناج')) return '🥬';
  if (clean.includes('آلو')) return '🫐';
  return '🍽️';
};

export const getToolEmoji = (name) => {
  if (!name) return '🔧';
  const clean = name.trim().toLowerCase();
  if (clean.includes('سیخ') || clean.includes('توری')) return '🥢';
  if (clean.includes('کاسه')) return '🥣';
  if (clean.includes('برس')) return '🖌️';
  if (clean.includes('منقل') || clean.includes('تابه') || clean.includes('گریل') || clean.includes('قابلمه') || clean.includes('دیگ')) return '🍳';
  if (clean.includes('کفگیر') || clean.includes('قاشق') || clean.includes('ملاقه')) return '🥄';
  if (clean.includes('رنده') || clean.includes('غذاساز')) return '🔪';
  if (clean.includes('فر')) return '🔥';
  if (clean.includes('چاقو') || clean.includes('تخته')) return '🔪';
  if (clean.includes('پارچ') || clean.includes('بطری')) return '🏺';
  if (clean.includes('لیوان')) return '🥃';
  if (clean.includes('سینی') || clean.includes('قالب')) return '📦';
  if (clean.includes('صافی')) return '🫗';
  if (clean.includes('کاغذ')) return '📄';
  if (clean.includes('پیمانه')) return '⚖️';
  if (clean.includes('پوست‌کن') || clean.includes('پوست کن')) return '🔪';
  if (clean.includes('دماسنج')) return '🌡️';
  if (clean.includes('دستمال')) return '🧻';
  return '🔧';
};

export const difficultyColor = (diff) => {
  const map = { 'آسان': 'green', 'متوسط': 'yellow', 'سخت': 'red' };
  return map[diff] || 'gray';
};

export const parseMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const num = parseInt(timeStr, 10);
  return isNaN(num) ? 0 : num;
};

export const formatTime = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const hrs = Math.floor(value / 60);
  const mins = value % 60;
  if (hrs === 0) return `${mins} دقیقه`;
  if (mins === 0) return `${hrs} ساعت`;
  return `${hrs} ساعت و ${mins} دقیقه`;
};

export const regionLabel = (region) => {
  const map = {
    'persian': '🇮🇷 ایرانی',
    'north': '🌿 شمال',
    'south': '🌊 جنوب',
    'west': '🏔️ غرب',
    'central': '🏜️ مرکز',
    'international': '🌍 بین‌الملل',
  };
  return map[region] || region;
};

export const mealTypeLabel = (mealTypeStr) => {
  if (!mealTypeStr) return [];
  const types = mealTypeStr.split(',').map(t => t.trim());
  const map = {
    'breakfast': { label: 'صبحانه', icon: 'IconSun', color: 'yellow' },
    'lunch': { label: 'ناهار', icon: 'IconSunset', color: 'orange' },
    'dinner': { label: 'شام', icon: 'IconMoon', color: 'indigo' },
    'snack': { label: 'میان‌وعده', icon: null, color: 'grape' },
  };
  return types.map(t => map[t] || { label: t, icon: null, color: 'gray' });
};

export const costColor = (cost) => {
  const map = { 'گران': 'red', 'متوسط': 'yellow', 'کم‌هزینه': 'green' };
  return map[cost] || 'gray';
};