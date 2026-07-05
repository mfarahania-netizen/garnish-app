import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ROOT, localDbGuard, writeJson } from './gris-repair-common';

const FINAL_DIR = path.join(ROOT, 'docs/qa/recipes/gris-repair-batches/final');
const ROLLBACK_JSON = path.join(FINAL_DIR, 'final_19_rollback.json');
const REPORT_JSON = path.join(FINAL_DIR, 'final_19_patch_report.json');
const REPORT_MD = path.join(FINAL_DIR, 'final_19_patch_report.md');

const TARGET_IDS = [
  'garnish_recipe_fa_1342_ce4a8da3',
  'garnish_recipe_fa_1333_db68905d',
  'garnish_recipe_fa_2064_b5a2a37a',
  'garnish_recipe_intl_019_629698d5',
  'garnish_recipe_fa_2054_be491f02',
  'garnish_recipe_fa_216_1bfdfe55',
  'garnish_recipe_fa_1071_6e0696a6',
  'garnish_recipe_fa_1224_c65df148',
  'garnish_recipe_fa_2071_5391bddf',
  'garnish_recipe_fa_1077_1b3eec19',
  'garnish_recipe_fa_1270_70cc3cff',
  'garnish_recipe_fa_1237_3dff9aba',
  'garnish_recipe_intl_046_0c90256b',
  'garnish_recipe_fa_1238_296fbec3',
  'garnish_recipe_fa_1315_c324442d',
  'garnish_recipe_fa_1816_dec0afbb',
  'garnish_recipe_fa_2103_d26d79d5',
  'garnish_recipe_fa_168_8b2d9b86',
  'garnish_recipe_global_143_001_758db93a',
] as const;

const PATCHES: Record<string, Array<{ path: Array<string | number>; value: any; repairType: string }>> = {
  garnish_recipe_fa_1342_ce4a8da3: [
    {
      path: ['whyItWorks', 3, 'testedBecause'],
      repairType: 'LEAK_CLEANUP',
      value: 'مرغ باید در مرکز کاملا پخته باشد و رنگ خام نداشته باشد؛ اگر دماسنج دارید، مرکز آن باید به ۷۴ درجه برسد.',
    },
  ],
  garnish_recipe_fa_1333_db68905d: [
    {
      path: ['whyItWorks', 3, 'testedBecause'],
      repairType: 'LEAK_CLEANUP',
      value: 'مرغ باید تا مغز پخته شود و آب آن شفاف باشد؛ پوسته را ترد نگه دارید، اما مرکز تکه‌ها نباید خام بماند.',
    },
  ],
  garnish_recipe_fa_2064_b5a2a37a: [
    {
      path: ['whyItWorks', 3, 'testedBecause'],
      repairType: 'LEAK_CLEANUP',
      value: 'حرارت ملایم، آب پاستا و چربی روغن زیتون کمک می‌کنند پستو به جای بریدن، روی رشته‌ها یک لایهٔ براق و یکدست بسازد.',
    },
  ],
  garnish_recipe_intl_019_629698d5: [
    {
      path: ['whyItWorks', 2, 'testedBecause'],
      repairType: 'LEAK_CLEANUP',
      value: 'تکه‌های مرغ باید کاملا پخته شوند، اما شیر نارگیل نباید قل‌قل شدید بخورد؛ جوش آرام بافت سوپ را نرم و خامه‌ای نگه می‌دارد.',
    },
  ],
  garnish_recipe_fa_2054_be491f02: [
    {
      path: ['nourishment', 'disclaimer'],
      repairType: 'LEAK_CLEANUP',
      value: 'اطلاعات تغذیه‌ای این دستور تقریبی و عمومی است و جایگزین توصیهٔ پزشکی یا برنامهٔ تغذیه‌ای شخصی نیست.',
    },
  ],
  garnish_recipe_fa_216_1bfdfe55: [
    {
      path: ['whyItWorks', 0, 'testedBecause'],
      repairType: 'LEAK_CLEANUP',
      value: 'مرکز تکه‌های جوجه باید کاملا پخته و آبدار باشد؛ اگر دماسنج دارید، دمای مرکز باید به ۷۴ درجه برسد.',
    },
  ],
  garnish_recipe_fa_1071_6e0696a6: [
    {
      path: ['whyItWorks', 3, 'testedBecause'],
      repairType: 'LEAK_CLEANUP',
      value: 'کتلت‌های نازک حرارت را سریع‌تر به مرکز گوشت می‌رسانند؛ داخل کتلت باید رنگ خام نداشته باشد و بیرون آن قهوه‌ای و برشته بماند.',
    },
  ],
  garnish_recipe_fa_1224_c65df148: [
    {
      path: ['whyItWorks', 2, 'testedBecause'],
      repairType: 'LEAK_CLEANUP',
      value: 'تخم‌مرغ باید در گرمای ملایم خورش خودش را بگیرد؛ جوش شدید بافت آن را سفت می‌کند و لطافت باقلاقاتق را می‌گیرد.',
    },
  ],
  garnish_recipe_fa_2071_5391bddf: [
    {
      path: ['whyItWorks', 1, 'testedBecause'],
      repairType: 'LEAK_CLEANUP',
      value: 'استراحت کوتاه بعد از پخت باعث می‌شود آب گوشت در بافت پخش بماند و هنگام برش وارد سالاد نشود.',
    },
    {
      path: ['whyItWorks', 2, 'testedBecause'],
      repairType: 'LEAK_CLEANUP',
      value: 'اگر سالاد با مرغ سرو می‌شود، مرغ باید کاملا پخته و سپس کمی خنک شود؛ برای سس هم امولسیون آرام، بافت براق و یکدست می‌دهد.',
    },
  ],
  garnish_recipe_fa_1077_1b3eec19: [
    {
      path: ['troubleshooting', 4, 'fix'],
      repairType: 'GENERIC_COPY_PATCH',
      value: 'اگر خوراک تخت شد، چند قطره آبلیمو و کمی پیازداغ داغ اضافه کنید؛ شوری را فقط بعد از جاافتادن لوبیا و غلیظ‌شدن آب خوراک بسنجید.',
    },
  ],
  garnish_recipe_fa_1270_70cc3cff: [
    {
      path: ['steps', 5, 'tip'],
      repairType: 'GENERIC_COPY_PATCH',
      value: 'چون بادمجان بعد از نمک‌زدن بخشی از شوری را پس می‌دهد و گوجه هنگام پخت غلیظ‌تر می‌شود، شوری نهایی را وقتی بادمجان و گوجه کاملا به روغن افتادند بسنجید.',
    },
    {
      path: ['ingredients', 9, 'buyTip'],
      repairType: 'GENERIC_COPY_PATCH',
      value: 'این نمک هم برای گرفتن تلخی بادمجان است و هم برای مزهٔ نهایی؛ پس بعد از آبکشی بادمجان، خوراک را در مرحلهٔ جاافتادن دوباره بچشید.',
    },
  ],
  garnish_recipe_fa_1237_3dff9aba: [
    {
      path: ['ingredients', 12, 'buyTip'],
      repairType: 'GENERIC_COPY_PATCH',
      value: 'شوری را بعد از نرم‌شدن گوشت، حبوبات و برنج بسنجید؛ قوام غلیظ آش مزهٔ نمک را متمرکزتر نشان می‌دهد.',
    },
  ],
  garnish_recipe_intl_046_0c90256b: [
    {
      path: ['ingredients', 4, 'buyTip'],
      repairType: 'GENERIC_COPY_PATCH',
      value: 'عصارهٔ آماده ممکن است شور باشد؛ مزه را بعد از بازشدن عدس قرمز و قبل از اضافه‌کردن چاشنی ترش یا کرهٔ فلفلی بسنجید.',
    },
  ],
  garnish_recipe_fa_1238_296fbec3: [
    {
      path: ['ingredients', 3, 'buyTip'],
      repairType: 'GENERIC_COPY_PATCH',
      value: 'نمک را وقتی گندم و گوشت کاملا کشدار و یکدست شدند اضافه کنید؛ هم‌زدن طولانی مزه را فشرده‌تر می‌کند.',
    },
  ],
  garnish_recipe_fa_1315_c324442d: [
    {
      path: ['ingredients', 10, 'buyTip'],
      repairType: 'GENERIC_COPY_PATCH',
      value: 'بعد از بازشدن عدس قرمز و اضافه‌شدن ترشی، شوری را بسنجید؛ عدس له‌شده مزهٔ نمک و تمر یا لیمو را قوی‌تر نشان می‌دهد.',
    },
  ],
  garnish_recipe_fa_1816_dec0afbb: [
    {
      path: ['ingredients', 12, 'buyTip'],
      repairType: 'GENERIC_COPY_PATCH',
      value: 'بعد از ترکیب شیر، آب مرغ و کره مزه را بسنجید؛ لبنیات شوری را نرم‌تر نشان می‌دهد اما آب مرغ ممکن است خودش شور باشد.',
    },
  ],
  garnish_recipe_fa_2103_d26d79d5: [
    {
      path: ['keep', 'makeAhead'],
      repairType: 'GENERIC_COPY_PATCH',
      value: 'پنیر را رنده و خامه و کره را اندازه‌گیری کنید، اما سس را تازه و روی حرارت ملایم بسازید تا پنیر نبرد و چربی از خامه جدا نشود.',
    },
  ],
  garnish_recipe_fa_168_8b2d9b86: [
    {
      path: ['ingredients', 11, 'buyTip'],
      repairType: 'GENERIC_COPY_PATCH',
      value: 'شوری را وقتی گوشت، حبوبات، میوهٔ خشک و مغزها مزه‌شان را به آب داده‌اند بسنجید؛ سطح نهایی آبگوشت تعیین می‌کند نمک چقدر حس شود.',
    },
  ],
  garnish_recipe_global_143_001_758db93a: [
    {
      path: ['variations'],
      repairType: 'SECTION_COMPLETION',
      value: [
        { name: 'کروسان کره‌ای کلاسیک', how: 'همین نسخه را بدون پر کردن بپزید و روی لایه‌بندی، سردماندن کره و زمان استراحت تمرکز کنید.' },
        { name: 'کروسان شکلاتی', how: 'پیش از رول‌کردن، یک نوار شکلات مناسب پخت روی خمیر بگذارید و خمیر را محکم اما بدون له‌کردن لایه‌ها ببندید.' },
        { name: 'کروسان بادامی', how: 'برای کروسان‌های یک‌روزه، داخلشان کمی کرم بادام بزنید، رویه را بادام پرک بدهید و کوتاه دوباره گرم کنید.' },
        { name: 'کروسان پنیر و سبزی', how: 'برای نسخهٔ شور، مقدار کم پنیر کم‌نمک و سبزی معطر خشک اضافه کنید؛ پرکردن زیاد باعث سنگین‌شدن لایه‌ها می‌شود.' },
      ],
    },
    {
      path: ['keep'],
      repairType: 'SECTION_COMPLETION',
      value: {
        makeAhead: 'خمیر می‌تواند بخشی از استراحت را شب در یخچال بگذراند؛ کره باید سرد و انعطاف‌پذیر بماند، نه یخ‌زده و شکننده.',
        storage: 'کروسان همان روز بهترین بافت را دارد. برای نگهداری کوتاه، در ظرف دربسته در دمای اتاق بگذارید و از رطوبت دور نگه دارید.',
        reheat: 'برای برگرداندن تردی، چند دقیقه در فر ملایم گرم کنید تا لایه‌ها دوباره خشک و پوک شوند. مایکروویو لایه‌های لمینیت‌شده را نرم و خمیری می‌کند.',
        freeze: 'کروسان پخته را پس از خنک‌شدن کامل فریز کنید؛ برای سرو، مستقیم از فریزر با فر ملایم گرم کنید تا پوسته دوباره ترد شود.',
      },
    },
    {
      path: ['serveWith'],
      repairType: 'SECTION_COMPLETION',
      value: ['کره و مربا', 'قهوه', 'چای', 'میوهٔ تازه', 'تخم‌مرغ و پنیر برای صبحانهٔ شور', 'کرم شکلاتی یا شکلات صبحانه'],
    },
    {
      path: ['faq'],
      repairType: 'SECTION_COMPLETION',
      value: [
        { q: 'چرا کره از خمیر بیرون زد؟', a: 'کره یا بیش از حد نرم شده یا لایه‌ها خوب بسته نشده‌اند. در هر مرحله اگر خمیر گرم شد، قبل از ادامه آن را در یخچال استراحت بدهید.' },
        { q: 'چرا لایه‌ها محو شدند؟', a: 'فشار زیاد وردنه، گرم‌شدن کره یا کوتاه‌بودن استراحت‌ها لایه‌ها را به هم می‌چسباند. خمیر باید سرد، آرام و با چرخش‌های منظم باز شود.' },
        { q: 'چرا کروسان شبیه نان شد؟', a: 'اگر کره در خمیر جذب شود یا تخمیر بیش از حد طول بکشد، بافت نانی می‌شود. سردماندن کره و کنترل زمان تخمیر کلید پوکی است.' },
        { q: 'می‌شود خمیر را شب در یخچال گذاشت؟', a: 'بله، استراحت شبانه برای طعم و کنترل کار مفید است؛ فقط خمیر را پوشیده نگه دارید تا خشک نشود و قبل از بازکردن، سفتی کره و خمیر نزدیک هم باشد.' },
        { q: 'چطور کروسان مانده را دوباره ترد کنم؟', a: 'چند دقیقه در فر ملایم گرم کنید. مایکروویو سریع است اما پوسته را نرم می‌کند و لایه‌ها را می‌خواباند.' },
      ],
    },
  ],
};

const FORBIDDEN_TERMS = [
  'USDA',
  'FSIS',
  'fdcId',
  'McGee',
  'López-Alt',
  'Lopez-Alt',
  'nutrition engine',
  'database',
  'source-backed',
  'قفل‌شده به منبع',
  'موتور تغذیه',
];

const GENERIC_TERMS = [
  'نمک را در پایان تنظیم کنید',
  'در پایان تنظیم کنید',
  'مواد را آماده کنید',
  'بهتر است مواد را آماده کنید',
];

function cloneJson<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function setPath(target: any, pathParts: Array<string | number>, value: any) {
  let cursor = target;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (cursor == null || !(part in cursor)) {
      throw new Error(`Missing GRIS path: ${pathParts.slice(0, i + 1).join('.')}`);
    }
    cursor = cursor[part as any];
  }
  const last = pathParts[pathParts.length - 1];
  if (cursor == null) throw new Error(`Missing GRIS parent path: ${pathParts.slice(0, -1).join('.')}`);
  cursor[last as any] = value;
}

function sanitizeSourceNames(value: string) {
  return value
    .replace(/\s*\((?:\s*(?:USDA|FSIS|McGee|López-Alt|Lopez-Alt|Serious Eats|ATK)(?:\s*[+/]\s*(?:USDA|FSIS|McGee|López-Alt|Lopez-Alt|Serious Eats|ATK))*\s*)\)/g, '')
    .replace(/(?:USDA|FSIS|McGee|López-Alt|Lopez-Alt|Serious Eats|ATK)(?:\s*[+/]\s*(?:USDA|FSIS|McGee|López-Alt|Lopez-Alt|Serious Eats|ATK))*\s*[:：]\s*/g, '')
    .replace(/\s*[—–-]\s*(?:USDA|FSIS|McGee|López-Alt|Lopez-Alt|Serious Eats|ATK)(?:\s*[+/]\s*(?:USDA|FSIS|McGee|López-Alt|Lopez-Alt|Serious Eats|ATK))*\b/g, '')
    .replace(/\b(?:USDA|FSIS|McGee|López-Alt|Lopez-Alt|Serious Eats|ATK)(?:\s*[+/]\s*(?:USDA|FSIS|McGee|López-Alt|Lopez-Alt|Serious Eats|ATK))*\b\s*[—–-]\s*/g, '')
    .replace(/^\s*(?:USDA|FSIS|McGee|López-Alt|Lopez-Alt|Serious Eats|ATK)(?:\s*[+/]\s*(?:USDA|FSIS|McGee|López-Alt|Lopez-Alt|Serious Eats|ATK))*\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([،؛:])/g, '$1')
    .trim();
}

function sanitizeSourcesDeep(value: any, pathParts: Array<string | number> = [], changed: string[] = []) {
  if (typeof value === 'string') {
    const next = sanitizeSourceNames(value);
    if (next !== value) changed.push(pathParts.join('.'));
    return next;
  }
  if (Array.isArray(value)) return value.map((item, index) => sanitizeSourcesDeep(item, [...pathParts, index], changed));
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [key, child] of Object.entries(value)) out[key] = sanitizeSourcesDeep(child, [...pathParts, key], changed);
    return out;
  }
  return value;
}

function textOf(value: any, key = ''): string {
  if (value == null) return '';
  if (['recipeId', 'schemaVersion', 'ingredientId', 'code'].includes(key)) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => textOf(item)).join('\n');
  if (typeof value === 'object') return Object.entries(value).map(([childKey, childValue]) => textOf(childValue, childKey)).filter(Boolean).join('\n');
  return '';
}

function validatePatchedGris(recipeId: string, gris: any) {
  const text = textOf(gris);
  const forbidden = FORBIDDEN_TERMS.filter((term) => text.includes(term));
  const generic = GENERIC_TERMS.filter((term) => text.includes(term));
  const missingCroissantSections: string[] = [];
  if (recipeId === 'garnish_recipe_global_143_001_758db93a') {
    if (!Array.isArray(gris?.variations) || gris.variations.length < 4) missingCroissantSections.push('variations');
    if (!gris?.keep?.storage || !gris?.keep?.reheat || !gris?.keep?.freeze) missingCroissantSections.push('keep');
    if (!Array.isArray(gris?.serveWith) || gris.serveWith.length < 6) missingCroissantSections.push('serveWith');
    if (!Array.isArray(gris?.faq) || gris.faq.length < 5) missingCroissantSections.push('faq');
  }
  return { forbidden, generic, missingCroissantSections };
}

function md(report: any) {
  return [
    '# Final 19 GRIS Patch Report',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- mode: ${report.mode}`,
    `- database: ${report.db.redacted}`,
    `- target count: ${report.targetCount}`,
    `- recipe count before: ${report.recipeCountBefore}`,
    `- recipe count after: ${report.recipeCountAfter}`,
    `- planned update count: ${report.plannedUpdateCount}`,
    `- updated count: ${report.updatedCount}`,
    `- created count: ${report.createdCount}`,
    `- deleted count: ${report.deletedCount}`,
    `- rollback: ${path.relative(ROOT, ROLLBACK_JSON)}`,
    `- validation: ${report.ok ? 'PASS' : 'FAIL'}`,
    '',
    '## Updated Recipes',
    '',
    '| recipeId | repairTypes | patchedPaths | postPatch |',
    '|---|---|---|---|',
    ...report.recipes.map((r: any) => `| \`${r.recipeId}\` | ${r.repairTypes.join(', ')} | ${r.patchedPaths.map((p: string) => `\`${p}\``).join('<br>')} | ${r.postPatchOk ? 'PASS' : 'FAIL'} |`),
    '',
    '## Errors',
    '',
    report.errors.length ? report.errors.map((e: string) => `- ${e}`).join('\n') : '- none',
    '',
  ].join('\n');
}

async function main() {
  const db = localDbGuard();
  const prisma = new PrismaClient();
  const errors: string[] = [];
  try {
    const recipeCountBefore = await prisma.recipe.count();
    const rows = await prisma.recipe.findMany({
      where: { id: { in: [...TARGET_IDS] } },
      select: { id: true, title: true, gris: true, updatedAt: true },
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const missingIds = TARGET_IDS.filter((id) => !rowById.has(id));
    errors.push(...missingIds.map((id) => `missing recipeId: ${id}`));

    const duplicateIds = TARGET_IDS.filter((id, idx, arr) => arr.indexOf(id) !== idx);
    errors.push(...duplicateIds.map((id) => `duplicate target recipeId: ${id}`));

    const updates = TARGET_IDS.map((recipeId) => {
      const row = rowById.get(recipeId);
      const before = cloneJson(row?.gris || {});
      const after = cloneJson(before);
      const patches = PATCHES[recipeId] || [];
      if (!row) return { recipeId, before, after: null, patches, validation: null };
      if (!after || typeof after !== 'object' || Array.isArray(after)) throw new Error(`Recipe ${recipeId} has invalid/missing gris object`);
      for (const patch of patches) setPath(after, patch.path, patch.value);
      const sanitizedPaths: string[] = [];
      const sanitizedAfter = sanitizeSourcesDeep(after, [], sanitizedPaths);
      return { recipeId, before, after: sanitizedAfter, patches, sanitizedPaths: [...new Set(sanitizedPaths)], validation: validatePatchedGris(recipeId, sanitizedAfter) };
    });

    for (const update of updates) {
      if (!update.after) continue;
      if (update.validation?.forbidden.length) errors.push(`${update.recipeId} forbidden leak remains: ${update.validation.forbidden.join(', ')}`);
      if (update.validation?.generic.length) errors.push(`${update.recipeId} generic phrase remains: ${update.validation.generic.join(', ')}`);
      if (update.validation?.missingCroissantSections.length) errors.push(`${update.recipeId} missing croissant sections: ${update.validation.missingCroissantSections.join(', ')}`);
    }

    fs.mkdirSync(FINAL_DIR, { recursive: true });
    writeJson(ROLLBACK_JSON, {
      schemaVersion: 'gris_final_19_rollback_v1',
      generatedAt: new Date().toISOString(),
      db,
      recipeCountBefore,
      recipes: rows.map((row) => ({ recipeId: row.id, title: row.title, gris: row.gris, updatedAt: row.updatedAt })),
    });

    let updatedCount = 0;
    if (errors.length === 0) {
      await prisma.$transaction(async (tx) => {
        const insideBefore = await tx.recipe.count();
        if (insideBefore !== recipeCountBefore) throw new Error(`recipe count changed before update: ${recipeCountBefore} -> ${insideBefore}`);
        for (const update of updates) {
          if (!update.after) throw new Error(`missing after payload: ${update.recipeId}`);
          await tx.recipe.update({ where: { id: update.recipeId }, data: { gris: update.after } });
          updatedCount++;
        }
        const insideAfter = await tx.recipe.count();
        if (insideAfter !== insideBefore) throw new Error(`recipe count changed inside transaction: ${insideBefore} -> ${insideAfter}`);
      }, { timeout: 600000, maxWait: 30000 });
    }

    const recipeCountAfter = await prisma.recipe.count();
    if (recipeCountAfter !== recipeCountBefore) errors.push(`recipe count changed after update: ${recipeCountBefore} -> ${recipeCountAfter}`);
    if (updatedCount !== TARGET_IDS.length && errors.length === 0) errors.push(`updated count mismatch: ${updatedCount} !== ${TARGET_IDS.length}`);

    const report = {
      schemaVersion: 'gris_final_19_patch_report_v1',
      generatedAt: new Date().toISOString(),
      mode: 'apply',
      db,
      targetCount: TARGET_IDS.length,
      recipeCountBefore,
      recipeCountAfter,
      plannedUpdateCount: TARGET_IDS.length,
      updatedCount,
      createdCount: 0,
      deletedCount: 0,
      recipes: updates.map((update) => ({
        recipeId: update.recipeId,
        repairTypes: [...new Set(update.patches.map((patch) => patch.repairType))],
        patchedPaths: [...new Set([...update.patches.map((patch) => patch.path.join('.')), ...(update.sanitizedPaths || []).map((p: string) => `source-sanitize:${p}`)])],
        postPatchOk: !!update.validation && !update.validation.forbidden.length && !update.validation.generic.length && !update.validation.missingCroissantSections.length,
        validation: update.validation,
      })),
      errors,
      ok: errors.length === 0,
    };
    writeJson(REPORT_JSON, report);
    fs.writeFileSync(REPORT_MD, md(report), 'utf8');
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exit(1);
});
