const normalize = (value) => String(value ?? '')
  .replace(/\u200c/g, ' ')
  .replace(/[ي]/g, 'ی')
  .replace(/[ك]/g, 'ک')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const families = [
  ['fish', ['ماهی', 'میگو', 'تن ماهی', 'سالمون', 'fish', 'shrimp', 'salmon', 'tuna']],
  ['liquid', ['آب', 'استاک', 'آب مرغ', 'آب گوشت', 'عصاره', 'water', 'stock', 'broth']],
  ['egg', ['تخم مرغ', 'تخم‌مرغ', 'egg']],
  ['dairy', ['شیر', 'ماست', 'پنیر', 'کشک', 'دوغ', 'خامه', 'کره', 'milk', 'yogurt', 'cheese', 'kashk', 'cream', 'butter']],
  ['protein', ['گوشت', 'مرغ', 'گوسفند', 'گوساله', 'بوقلمون', 'چرخ کرده', 'چرخ‌کرده', 'beef', 'lamb', 'chicken', 'turkey', 'meat']],
  ['aromatic', ['پیاز', 'سیر', 'موسیر', 'تره فرنگی', 'تره‌فرنگی', 'onion', 'garlic', 'shallot', 'leek']],
  ['herb', ['سبزی', 'جعفری', 'گشنیز', 'نعناع', 'شوید', 'ریحان', 'ترخون', 'مرزه', 'parsley', 'cilantro', 'coriander', 'mint', 'dill', 'basil', 'herb']],
  ['legume', ['نخود', 'لوبیا', 'عدس', 'لپه', 'ماش', 'باقالی', 'bean', 'beans', 'chickpea', 'lentil', 'pea']],
  ['grain', ['برنج', 'گندم', 'جو', 'بلغور', 'پاستا', 'ماکارونی', 'رشته', 'آرد', 'rice', 'wheat', 'barley', 'bulgur', 'pasta', 'flour']],
  ['bread', ['نان', 'خمیر', 'کراست', 'تارت', 'پای', 'bread', 'dough', 'pastry', 'crust']],
  ['oil', ['روغن', 'دنبه', 'چربی', 'زیتون', 'oil', 'fat', 'ghee']],
  ['spice', ['نمک', 'فلفل', 'زردچوبه', 'دارچین', 'ادویه', 'زعفران', 'سماق', 'زیره', 'پاپریکا', 'هل', 'جوز', 'salt', 'pepper', 'turmeric', 'cinnamon', 'saffron', 'cumin', 'spice']],
  ['sauce', ['رب', 'سس', 'سویا سس', 'سس سویا', 'میزو', 'خمیر', 'paste', 'sauce', 'miso']],
  ['citrus', ['لیمو', 'لیموعمانی', 'لیمو عمانی', 'آبغوره', 'سرکه', 'نارنج', 'غوره', 'lemon', 'lime', 'vinegar', 'verjuice']],
  ['nut', ['گردو', 'بادام', 'پسته', 'کنجد', 'فندق', 'تخمه', 'walnut', 'almond', 'pistachio', 'sesame', 'seed']],
  ['fruit', ['سیب', 'انار', 'آلبالو', 'کشمش', 'خرما', 'قیسی', 'آلو', 'زردآلو', 'به', 'apple', 'pomegranate', 'cherry', 'raisin', 'date', 'apricot', 'plum', 'quince']],
  ['sweetener', ['شکر', 'عسل', 'شیره', 'سیروپ', 'قند', 'sugar', 'honey', 'syrup']],
  ['vegetable', ['گوجه', 'سیب زمینی', 'سیب‌زمینی', 'هویج', 'بادمجان', 'خیار', 'کدو', 'فلفل دلمه', 'کرفس', 'کلم', 'کاهو', 'tomato', 'potato', 'carrot', 'eggplant', 'cucumber', 'zucchini', 'pepper', 'celery', 'cabbage', 'lettuce', 'vegetable']],
];

export const IngredientIconKey = Object.freeze({
  protein: 'protein',
  fish: 'fish',
  egg: 'egg',
  dairy: 'dairy',
  aromatic: 'aromatic',
  vegetable: 'vegetable',
  herb: 'herb',
  legume: 'legume',
  grain: 'grain',
  oil: 'oil',
  spice: 'spice',
  sauce: 'sauce',
  citrus: 'citrus',
  nut: 'nut',
  bread: 'bread',
  fruit: 'fruit',
  sweetener: 'sweetener',
  liquid: 'liquid',
  default: 'default',
});

export function getIngredientIconKey(ingredient = {}) {
  if (!ingredient || typeof ingredient !== 'object') return IngredientIconKey.default;
  const text = normalize([
    ingredient.displayName,
    ingredient.name,
    ingredient.title,
    ingredient.component,
    ingredient.group,
    ingredient.section,
    ingredient.category,
    ingredient.role,
  ].filter(Boolean).join(' '));

  if (!text) return IngredientIconKey.default;
  const match = families.find(([, terms]) => terms.some((term) => text.includes(normalize(term))));
  return match ? match[0] : IngredientIconKey.default;
}

export const ingredientIconMapInternals = {
  normalize,
  families,
};
