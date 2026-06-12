const includesAny = (value, words) => {
  const clean = String(value || '').trim().toLowerCase();
  return words.some((word) => clean.includes(word));
};

export const getIngredientEmoji = (name) => {
  if (!name) return '🍽️';
  if (includesAny(name, ['مرغ', 'جوجه', 'chicken'])) return '🍗';
  if (includesAny(name, ['گوشت', 'beef', 'meat'])) return '🥩';
  if (includesAny(name, ['ماهی', 'میگو', 'fish', 'shrimp'])) return '🐟';
  if (includesAny(name, ['پیاز', 'onion'])) return '🧅';
  if (includesAny(name, ['سیر', 'garlic'])) return '🧄';
  if (includesAny(name, ['گوجه', 'tomato'])) return '🍅';
  if (includesAny(name, ['تخم‌مرغ', 'تخم مرغ', 'egg'])) return '🥚';
  if (includesAny(name, ['برنج', 'rice'])) return '🍚';
  if (includesAny(name, ['ماست', 'شیر', 'خامه', 'yogurt', 'milk', 'cream'])) return '🥛';
  if (includesAny(name, ['کره', 'روغن', 'butter', 'oil'])) return '🧈';
  if (includesAny(name, ['پنیر', 'cheese'])) return '🧀';
  if (includesAny(name, ['سبزی', 'جعفری', 'گشنیز', 'شوید', 'تره', 'نعنا', 'parsley', 'mint'])) return '🌿';
  if (includesAny(name, ['فلفل', 'chili', 'pepper'])) return '🌶️';
  if (includesAny(name, ['نمک', 'ادویه', 'زعفران', 'زردچوبه', 'salt', 'spice', 'saffron'])) return '🧂';
  if (includesAny(name, ['قارچ', 'mushroom'])) return '🍄';
  if (includesAny(name, ['لیمو', 'lemon', 'lime'])) return '🍋';
  if (includesAny(name, ['سیب‌زمینی', 'سیب زمینی', 'potato'])) return '🥔';
  if (includesAny(name, ['هویج', 'carrot'])) return '🥕';
  if (includesAny(name, ['لوبیا', 'عدس', 'نخود', 'لپه', 'beans', 'lentil'])) return '🫘';
  if (includesAny(name, ['گردو', 'بادام', 'پسته', 'walnut', 'almond', 'pistachio'])) return '🥜';
  if (includesAny(name, ['شکر', 'عسل', 'sugar', 'honey'])) return '🍯';
  if (includesAny(name, ['آرد', 'flour'])) return '🌾';
  if (includesAny(name, ['خیار', 'cucumber'])) return '🥒';
  if (includesAny(name, ['اسفناج', 'spinach'])) return '🥬';
  return '🍽️';
};

export const getToolEmoji = (name) => {
  if (!name) return '🔧';
  if (includesAny(name, ['سیخ', 'توری'])) return '🥢';
  if (includesAny(name, ['کاسه'])) return '🥣';
  if (includesAny(name, ['تابه', 'قابلمه', 'دیگ', 'گریل', 'منقل'])) return '🍳';
  if (includesAny(name, ['قاشق', 'ملاقه', 'کفگیر'])) return '🥄';
  if (includesAny(name, ['چاقو', 'تخته'])) return '🔪';
  if (includesAny(name, ['فر'])) return '🔥';
  if (includesAny(name, ['پیمانه'])) return '⚖️';
  return '🔧';
};

export const difficultyColor = (diff) => {
  const value = String(diff || '').toLowerCase();
  if (['easy', 'آسان'].includes(value)) return 'green';
  if (['medium', 'متوسط'].includes(value)) return 'yellow';
  if (['hard', 'سخت'].includes(value)) return 'red';
  return 'gray';
};

export const parseMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const num = parseInt(timeStr, 10);
  return Number.isNaN(num) ? 0 : num;
};

export const formatTime = (value) => {
  if (!value) return '';
  const minutes = typeof value === 'number' ? value : parseMinutes(value);
  if (!minutes) return String(value);
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} دقیقه`;
  if (mins === 0) return `${hrs} ساعت`;
  return `${hrs} ساعت و ${mins} دقیقه`;
};

export const regionLabel = (region) => {
  const map = {
    persian: 'ایرانی',
    iranian: 'ایرانی',
    north: 'شمالی',
    south: 'جنوبی',
    west: 'غربی',
    central: 'مرکزی',
    international: 'بین‌المللی',
  };
  return map[region] || region;
};

const normalizeList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [value];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
};

export const mealTypeLabel = (mealTypeValue) => {
  const types = normalizeList(mealTypeValue);
  const map = {
    breakfast: { label: 'صبحانه', icon: 'IconSun', color: 'yellow' },
    lunch: { label: 'ناهار', icon: 'IconSunset', color: 'orange' },
    dinner: { label: 'شام', icon: 'IconMoon', color: 'indigo' },
    snack: { label: 'میان‌وعده', icon: null, color: 'grape' },
  };
  return types.map((type) => map[type] || { label: String(type), icon: null, color: 'gray' });
};

export const costColor = (cost) => {
  const value = String(cost || '').toLowerCase();
  if (['expensive', 'گران'].includes(value)) return 'red';
  if (['medium', 'متوسط'].includes(value)) return 'yellow';
  if (['low', 'budget', 'کم‌هزینه'].includes(value)) return 'green';
  return 'gray';
};
