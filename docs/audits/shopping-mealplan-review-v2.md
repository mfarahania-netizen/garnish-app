# بازبینی فنی جامع — لیست خرید و برنامهٔ غذایی (نسخهٔ ۲)

> **پروژه:** Garnish App · **تاریخ:** جولای ۲۰۲۶ · **دامنه:** بک‌اند (NestJS + Prisma) + فرانت (React + Vite)
> **وضعیت:** مبتنی بر خوانش کامل کد + نقشهٔ وابستگی‌های تأییدشده

---

## فهرست

1. [خلاصهٔ اجرایی](#1-خلاصهٔ-اجرایی)
2. [معماری فعلی (نقشهٔ واقعی)](#2-معماری-فعلی-نقشهٔ-واقعی)
3. [نقشهٔ کامل وابستگی‌ها (برای نشکستن چیزی)](#3-نقشهٔ-کامل-وابستگی‌ها)
4. [مشکلات کد (با اولویت و شمارهٔ خط)](#4-مشکلات-کد)
5. [مشکلات طراحی و UX](#5-مشکلات-طراحی-و-ux)
6. [نقاط قوت (باید حفظ شوند)](#6-نقاط-قوت)
7. [برنامهٔ اجرایی ۹-فازی](#7-برنامهٔ-اجرایی-۹-فازی)
8. [زیرساخت موجود برای ویژگی‌های آینده](#8-زیرساخت-موجود)
9. [تضمین عدم شکست و استراتژی rollback](#9-تضمین-عدم-شکست)

---

## 1. خلاصهٔ اجرایی

| بخش | وضعیت | نمره | یادداشت |
|---|---|---|---|
| بک‌اند لیست خرید | قوی، چندین چرخهٔ ریفاکتور موفق | ۸/۱۰ | باگ re-sync واقعی در `buildFromPlan` |
| بک‌اند برنامه غذایی | قوی، منطق پیچیدهٔ خوب هندل‌شده | ۷.۵/۱۰ | raw SQL workaround قابل حذف |
| فرانت لیست خرید | کار می‌کند ولی کد حجیم + کد مرده | ۶/۱۰ | inline-style فراوان |
| فرانت برنامه غذایی | پیچیده ولی پایدار | ۶.۵/۱۰ | inline-style فراوان |
| کد مرده | **۲ فایل کاملاً مرده** | ⚠️ | صفر مصرف‌کنندهٔ خارجی |
| زیرساخت آینده (PWA/Share) | نصفه آماده | — | Workbox موجود، Share از صفر |

**جمع‌بندی:** منطق بیزینسی پخته و ایمن است (گیت حساسیت HARD/fail-closed، dedup هوشمند، scale per-slot). مشکلات اصلی در **لایهٔ فرانت** (inline-style + کد مرده) و **چند نقص منطق داده‌ای واقعی** (buildFromPlan واقعاً sync نمی‌کند، pantry dedup ناسازگار، notes نیمه‌کاره) متمرکز است.

---

## 2. معماری فعلی (نقشهٔ واقعی)

### ۲.۱ مدل‌های داده (Prisma)

```
User ──1:1──> ShoppingList ──1:N──> ShoppingItem
                                          │
                                          └── ingredientId (soft ref) ──> Ingredient?

User ──1:N──> MealPlan ──1:N──> MealSlot ──0:1──> Recipe
                                    │
                                    ├── cookedAt   (mark-cooked)
                                    ├── servings   (scales shopping)
                                    └── notes      (⚠️ نیمه‌کاره)

User ──1:N──> PantryItem ──0:1──> Ingredient?   (staples subtracted from build)
```

| مدل | کلید واژگان |
|---|---|
| `ShoppingList` | `userId @unique` (فقط **یک** لیست per کاربر) |
| `ShoppingItem` | `ingredientId` (soft ref، merge key)، `source` (`'manual'`/`'recipe:<id>'`/`'plan'`)، `sortOrder`، `checkedAt` |
| `MealSlot` | `cookedAt`، `servings` (هردو additive + nullable migration)، `notes` |
| `PantryItem` | `ingredientId?`، `name`، `amount?`، `unit?` |

### ۲.۲ اندپوینت‌ها

**لیست خرید** (`@Controller('shopping-list')`, `@UseGuards(AuthGuard('jwt'))`):
| متد | مسیر | متد سرویس |
|---|---|---|
| GET | `/` | `getList` (upsert + include items) |
| POST | `/items` | `addItems` (dedup + splitQuantity) |
| POST | `/from-plan` | `buildFromPlan` (⚠️ باگ sync) |
| PATCH | `/items/:id` | `updateItem` |
| DELETE | `/items/:id` | `removeItem` |
| POST | `/clear-checked` | `clearChecked` |
| POST | `/clear-all` | `clearAll` |
| POST | `/uncheck-all` | `uncheckAll` |
| GET | `/pantry` | `getPantry` |
| POST | `/pantry` | `addPantryName` |
| POST | `/items/:id/to-pantry` | `addToPantry` (⚠️ dedup فقط اسم) |
| DELETE | `/pantry/:id` | `removeFromPantry` |

**برنامهٔ غذایی** (`@Controller('meal-plans')`):
| متد | مسیر | متد سرویس |
|---|---|---|
| GET | `/` | `getCurrentPlan` |
| POST | `/` | `savePlan` |
| POST | `/slots` | `addMealSlot` |
| GET | `/dish-options` | `dishOptions` |
| POST | `/slots/:d/:m/cooked` | `markCooked` |
| POST | `/slots/:d/:m/servings` | `setServings` |
| POST | `/copy` | `copyWeek` |
| POST | `/clear-week` | `clearWeek` |
| DELETE | `/slots/:d/:m` | `removeMealSlot` |
| POST | `/generate` | `generateSmartPlan` |
| POST | `/propose` | `planner.proposePlan` |
| POST | `/slots/swap` | `planner.swapSlot` |

### ۲.۳ فرانت‌اند

| فایل | نقش |
|---|---|
| `app/shopping-list/page.jsx` | صفحهٔ لیست خرید (۲۱۷ خط، ~۵۰٪ inline-style) |
| `app/shopping-list/useShopping.js` | hook فعّال (query key `['shopping','list']`) |
| `app/shopping-list/ingredient-emoji.js` | نقشهٔ emoji فارسی → غذا |
| `app/shopping-list/shoppinglist.smoke.test.jsx` | تست دودی |
| `app/plan/page.jsx` | صفحهٔ برنامهٔ هفته (۳۹۰ خط) |
| `app/plan/useMealPlan.js` | hook برنامه (۲۶۶ خط) |
| `app/plan/useMealPlan.test.jsx` | تست hook |
| `app/plan/plan.smoke.test.jsx` | تست دودی |
| `hooks/useShoppingListQuery.js` | ⚠️ **مرده** (صفر مصرف‌کننده) |
| `data/shoppingConstants.js` | ⚠️ **مرده** (صفر import خارجی) |
| `lib/apiClient.js` | axios + interceptor توکن + redirect 401 |
| `vite.config.js` | VitePWA + Workbox (موجود) |

---

## 3. نقشهٔ کامل وابستگی‌ها

### ۳.۱ بک‌اند — مصرف‌کنندگان `ShoppingListService` (تأییدشده با grep)

| فایل | متد استفاده‌شده | چگونه | ریسک تغییر |
|---|---|---|---|
| `briefing/briefing.service.ts:90` | `getList(userId)` | `list.items.filter(i => !i.isChecked).length` | فقط شکل `{items:[...]}` مهم است |
| `ai/agentic/agentic-write-tools.service.ts:259,424,460,492,523` | `buildFromPlan`, `addItems`, `getList` (۴ مکان) | ابزارهای دستیار AI | امضای متد مهم است |
| `outcomes/behavior-outcome.service.ts:13` | `prisma.shoppingItem.findMany` (read مستقیم) | شمارش checked/total | مستقل از سرویس |
| `recommendation/pipeline/candidate-generator.ts:277` | `prisma.shoppingItem.findMany` | استخراج نام مواد برای candidate | مستقل از سرویس |
| `retention/retention-policy.ts:64` | فقط اسم مدل | retention class | فقط نام مدل مهم است |
| `behavior-engine/processors/shopping.signal-processor.ts` | فقط event‌ها | کاملاً مستقل از شکل داده | صفر ریسک |
| `users/export/user-export.service.ts` | export داده | read | مستقل |
| `admin/admin.service.ts` | admin | خواندن | مستقل |

> ⚠️ **قانون طلایی:** امضای `getList()`, `addItems()`, `buildFromPlan(userId, servings?)` و شکل JSON پاسخ باید دست‌نخورده بمانند.

### ۳.۲ بک‌اند — مصرف‌کنندگان `MealPlansService`

| فایل | متد | چگونه |
|---|---|---|
| `briefing/briefing.service.ts:88` | `getCurrentPlan(userId)` | شمارش slots پر |
| `ai/agentic/agentic-write-tools.service.ts` | `addMealSlot`, `fillSlots` | ابزار AI |
| `recommendation/*` (بسیار) | خواندن slot‌ها | امتیازدهی |

### ۳.۳ فرانت — مصرف‌کنندگان hook‌ها

| فایل | چه چیزی import می‌کند |
|---|---|
| `app/shopping-list/page.jsx:5` | `useShopping` |
| `app/shopping-list/shoppinglist.smoke.test.jsx:7` | `useShopping` (mock شده) |
| `hooks/useShoppingListQuery.js` | ⚠️ **هیچ‌کس import نمی‌کند** (مرده) |

### ۳.۴ کد مردهٔ تأییدشده

| فایل | مدرن مرگ |
|---|---|
| `hooks/useShoppingListQuery.js` | `grep -rn "useShoppingListQuery"` → فقط خودش export کرده، ۰ مصرف‌کننده |
| `data/shoppingConstants.js` | `grep -rn "shoppingConstants\|LIST_TYPES\|PARTY_MULTIPLIER\|BULK_MULTIPLIER"` → ۰ import خارجی |

---

## 4. مشکلات کد

### 🔴 P0 — بحرانی / باگ منطقی واقعی

#### ۴.۱ باگ re-sync در `buildFromPlan` (بزرگ‌ترین مشکل)

**محل:** `apps/server/src/shopping-list/shopping-list.service.ts:130`

**باگ:** متد فقط `createMany` می‌کند و هرگز آیتم‌های قدیمی `source='plan'` و unchecked را حذف نمی‌کند. کامنت‌ها (line 61 و در schema) ادعا می‌کنند «re-sync is idempotent» و «can replace plan items without nuking manual» — ولی پیاده‌سازی این ادعا را نقض می‌کند.

**سناریوی شکست:**
1. کاربر لیست را از برنامه می‌سازد → ۵ آیتم با `source='plan'`
2. یک غذا را از برنامه حذف می‌کند
3. دوباره «از روی برنامه» را می‌زند

**نتیجه:** آیتم‌های غذای حذف‌شده روی لیست می‌مانند (فقط اگه دقیقاً همان اسم باشد dedup می‌شوند).

**اصلاح:**
```typescript
// قبل از createMany:
const removed = await this.prisma.shoppingItem.deleteMany({
  where: { shoppingListId: list.id, source: 'plan', isChecked: false }
});
// سپس createMany — manual و checked دست‌نخورده می‌مانند
```
خروجی باید شامل `removedPlan: removed.count` شود.

---

#### ۴.۲ کد مردهٔ دوگانه

**محل:** `apps/web/src/hooks/useShoppingListQuery.js` و `apps/web/src/data/shoppingConstants.js`

**مشکل:**
- `useShoppingListQuery.js` یک PATCH **بدون بدنه** می‌فرستد (line 33) — یعنی همان legacy toggle non-idempotent. اگر کسی از این hook استفاده کند، race condition برمی‌گردد.
- `shoppingConstants.js` مفهوم قدیمی «نوع لیست» (daily/party/bulk) و localStorage را تعریف می‌کند که در بک‌اند فعلی وجود ندارد.

**اصلاح:** حذف هر دو فایل. مدرک مرگ در بخش ۳.۴ آمده (۰ مصرف‌کننده).

---

### 🟠 P1 — مهم / بدهی فنی

#### ۴.۳ raw SQL workaround (باید با prisma generate جایگزین شود)

**محل:**
- `meal-plans.service.ts:36` (`hydrateSlotExtras` — `$queryRawUnsafe`)
- `meal-plans.service.ts:90` (`markCooked` — `$executeRawUnsafe`)
- `meal-plans.service.ts:102` (`setServings` — `$executeRawUnsafe`)
- `shopping-list.service.ts:93` (servingsById در `buildFromPlan` — `$queryRawUnsafe`)

**علت (طبق کامنت):** کلاینت Prisma تولیدنشده ستون‌های `MealSlot.cookedAt`/`servings` را نمی‌شناسد.

**اصلاح:**
1. `pnpm --filter @garnish/server db:generate` (اسکریپت موجود در `package.json`)
2. تأیید کلاینت ستون‌ها را می‌شناسد
3. جایگزینی ۴ مورد با `prisma.mealSlot.update` / `findMany` typed

**ریسک:** اگر کلاینت تولیدنشده باشد، خطا می‌دهد — باید قبل از حذف raw SQL، generate تأیید شود.

---

#### ۴.۴ pantry dedup ناسازگار

**محل:** `shopping-list.service.ts:219` (`addToPantry`) و `:231` (`addPantryName`)

**باگ:** فقط `norm(p.name) === norm(item.name)` را چک می‌کند، در حالی که `ingredientId` دارد ولی استفاده نمی‌کند. نتیجه: «گوجه» و «گوجه فرنگی» دو رکورد جدا می‌شوند. این با الگوی `addItems` (که `ingredientId` را کلید merge می‌داند) ناسازگار است.

**اصلاح:**
```typescript
const sameItem = (a, b) =>
  (a.ingredientId && b.ingredientId && a.ingredientId === b.ingredientId) ||
  norm(a.name) === norm(b.name);
```

---

#### ۴.۵ فیلد `MealSlot.notes` نیمه‌کاره

**محل:** schema (`MealSlot.notes`), DTO (`MealSlotDto.notes @MaxLength(280)`), سرویس (`copyWeek` نوت‌ها را کپی می‌کند)

**باگ:** هیچ ورودی UI در `plan/page.jsx` برای وارد کردن note وجود ندارد. `grep -rn ".notes" apps/web/src/app/plan/` → خالی. ویژگی‌ای که می‌نویسد ولی کاربر نمی‌بیند.

**اصلاح (دو گزینه):** یا input note به صفحه اضافه شود، یا فیلد (و کپی آن) حذف شود تا کد صادقانه شود.

---

#### ۴.۶ نبود تایپ برای `@Req()`

**محل:** همهٔ کنترلرها (مثلاً `shopping-list.controller.ts:13`: `@Req() req` بدون تایپ)

**باگ:** `req.user.userId` بدون هیچ TypeScript interface‌ای خوانده می‌شود. type safety صفر. هیچ `AuthenticatedRequest` موجود نیست (`grep` تأیید کرد).

**اصلاح:** ساخت `auth/authenticated-request.interface.ts` و اعمال روی کنترلرهای shopping + meal-plan.

---

### 🟡 P2 — تجربه و کیفیت کد

#### ۴.۷ inline-style فراوان

**محل:** `shopping-list/page.jsx` (۲۱۷ خط، ~۵۰٪ style) و `plan/page.jsx` (۳۹۰ خط)

**مشکل:**
- هر render یک آبجکت جدید → React reconciliation بی‌فایده
- media query / responsive غیرممکن
- تم‌گذاری سخت
- کد ناخوانا

**اصلاح:** استخراج به `page.module.css`، نگه‌داری design token‌ها.

---

#### ۴.۸ `generateSmartPlan` سنگین و غیرقابل بازتولید

**محل:** `meal-plans.service.ts:182`

**مشکل:** `take: 500` + `include: { ingredients: true }` (بارگذاری ۵۰۰ دستور با همهٔ مواد در حافظه) + `Math.random()` (غیر seedable).

**اصلاح:** seedable PRNG (مثلاً `mulberry32(userId.hashCode())`) + lazy filtering.

---

#### ۴.۹ error handling بی‌صدا (فرانت)

**محل:** اکثر mutation‌ها (`catch { return false }`)

**مشکل:** toast عمومی «نشد — دوباره امتحان کن» بدون دلیل و بدون لاگ. دیباگ production سخت.

**اصلاح:** لاگ خطا + پیام‌های متمایز (شبکه / 403 / 500).

---

#### ۴.۱۰ inference دسته فقط سمت کلاینت

**محل:** `useShopping.js:50` (`inferAisle`)

**مشکل:** وقتی `ShoppingItem.category` خالی است (معمولاً)، دسته از اسم فارسی حدس زده می‌شود. اگر کلمه‌کلیدی نباشد → «سایر». در حالی که بک‌اند دستهٔ دیکشنری دارد ولی آن را persist نمی‌کند.

**اصلاح:** هنگام `createMany` در `buildFromPlan`، `category` از دیکشنری resolve شود.

---

## 5. مشکلات طراحی و UX

| # | مشکل | توضیح |
|---|---|---|
| ۱ | فقط یک لیست per کاربر | `ShoppingList.userId @unique` — لیست جدا برای «مهمونی»/«اعید» ممکن نیست |
| ۲ | اطلاعات تغذیه‌ای فقط وقتی کامل باشد | `page.jsx:265` — چون ~۴۷٪ دستورها nutrition ندارند، خط کالری تقریباً هرگز نمایش داده نمی‌شود. تخمین جزئی با یادآوری مفیدتر است |
| ۳ | پشتیبانی آفلاین نیست | لیست خرید یک مورد استفادهٔ کلاسیک آفلاین است (در فروشگاه، بدون آنتن) |
| ۴ | اشتراک‌گذاری ندارد | نتوانستن ارسال لیست به همسر/خانواده |
| ۵ | drag-and-drop ندارد | انتقال غذا بین روز/وعده = remove + re-add |
| ۶ | فقط نمای هفتگی | نمای روزانه/ماهانه نیست، فقط ±۸ هفته |
| ۷ | insight سبزی معطر | دسته‌بندی «سبزی و سبزیجات معطر» (سبزیِ مرکزی غورما/آش) به‌خوبی از میوه/سبزی جدا شده — نقطهٔ قوت |

---

## 6. نقاط قوت (باید حفظ شوند)

این موارد را تغییر ندهید:

1. **گیت حساسیت HARD و fail-closed** (`safety.filter`) — در همهٔ مسیرها (`generate`, `buildFromPlan`, `dishOptions`, `fillSlots`) اعمال می‌شود. حتی اگر کاربر بعد از برنامه‌ریزی حساسیت اضافه کند، `buildFromPlan` دوباره فیلتر می‌کند (line 86).
2. **Scale per-slot servings** — هر slot با servings خودش scale می‌شود (نه ضرب کلی). منطق درست در `buildFromPlan:108`.
3. **Dedup هوشمند در addItems** — کلید `ingredientId` اول، سپس `norm(name)` (line 39).
4. **`splitQuantity`** — «خیار دو کیلو» → name «خیار» + amount «دو کیلو». خوش‌ذوق در `parse-quantity.ts`.
5. **Variety picker با persian-first** + forbid lunch==dinner هم‌روز (line 231).
6. **relax وقتی strict set نازک است** — اگه فیلتر سخت هفته را خالی کند، relax می‌شود ولی گیت حساسیت هرگز (line 196).
7. **owner-scoped** همهٔ عملیات با `ForbiddenException`.
8. **optimistic UI** برای check/remove در فرانت.
9. **هوشمندی MealPlanPlannerService** — reuse پروفایل living، exclude allergies، exclude recently-declined.

---

## 7. برنامهٔ اجرایی ۹-فازی

### فاز ۱ — P0: حذف کد مرده ⏱️ نیم‌روز

| قدم | فایل | عمل |
|---|---|---|
| ۱ | `apps/web/src/hooks/useShoppingListQuery.js` | حذف |
| ۲ | `apps/web/src/data/shoppingConstants.js` | حذف |
| ۳ | `apps/web/src/data/` | بررسی هرزبریِ پوشه |
| ۴ | — | `pnpm lint` + تست دودی |

**تضمین:** ۰ مصرف‌کننده خارجی (مدرن در بخش ۳.۴).

---

### فاز ۲ — P0: اصلاح `buildFromPlan` ⏱️ نیم‌روز

**فایل:** `apps/server/src/shopping-list/shopping-list.service.ts` (حدود line 130)

```typescript
// قبل از createMany:
const removedPlan = await this.prisma.shoppingItem.deleteMany({
  where: { shoppingListId: list.id, source: 'plan', isChecked: false },
});
// createMany موجود می‌ماند...
return {
  resultStatus: 'ok',
  added: agg.items.length,
  merged: agg.merged,
  flagged: agg.flagged,
  removedPlan: removedPlan.count,   // 🆕 گزارش صادقانه
  householdSize,
  items: agg.items,
};
```

**تست:** به‌روزرسانی `planner-shopping-qa-gate.spec.ts` با سناریوی re-sync (برنامه → حذف غذا → re-sync → آیتم حذف‌شده نباید باشد).

---

### فاز ۳ — P1: prisma generate + حذف raw SQL ⏱️ نیم‌روز

| قدم | عمل |
|---|---|
| ۱ | `pnpm --filter @garnish/server db:generate` |
| ۲ | تأیید `MealSlot.cookedAt`/`servings` در کلاینت typed شده‌اند |
| ۳ | `meal-plans.service.ts:36` `hydrateSlotExtras` → `prisma.mealSlot.findMany` |
| ۴ | `meal-plans.service.ts:90` `markCooked` → `prisma.mealSlot.updateMany` |
| ۵ | `meal-plans.service.ts:102` `setServings` → `prisma.mealSlot.updateMany` |
| ۶ | `shopping-list.service.ts:93` servingsById → `findMany({ select: { id, servings } })` |

**ریسک:** اگر کلاینت تولیدنشده باشد، خطا — باید قبل از حذف، generate تأیید شود.

---

### فاز ۴ — P1: pantry dedup با ingredientId ⏱️ چند ساعت

**فایل:** `apps/server/src/shopping-list/shopping-list.service.ts`

```typescript
const sameItem = (a: {ingredientId?:string|null; name:string}, b: {ingredientId?:string|null; name:string}) =>
  (!!a.ingredientId && !!b.ingredientId && a.ingredientId === b.ingredientId) ||
  norm(a.name) === norm(b.name);
```

اعمال در `addToPantry` (line 219) و `addPantryName` (line 231).

---

### فاز ۵ — P1: typed `AuthenticatedRequest` ⏱️ یک روز

**فایل جدید:** `apps/server/src/auth/authenticated-request.interface.ts`
```typescript
import { Request } from 'express';
export interface AuthenticatedRequest extends Request {
  user: { userId: string; email?: string; };
}
```

اعمال روی `ShoppingListController` و `MealPlansController` (`@Req() req: AuthenticatedRequest`).

**scope:** فقط این دو کنترلر (بقیه فازهای بعدی).

---

### فاز ۶ — P2: inline-style → CSS modules ⏱️ ۲-۳ روز

| فایل | خروجی |
|---|---|
| `shopping-list/page.jsx` | `shopping-list/page.module.css` |
| `plan/page.jsx` | `plan/page.module.css` |

نگه‌داری design token‌ها (`--g-color-*`, `--g-space-*`). بزرگ‌ترین حجم کار.

---

### فاز ۷ — P2: تخمین کالری جزئی + resolve دسته سمت سرور ⏱️ یک روز

**کالری** (`plan/page.jsx:265`):
```javascript
const showNut = dayNut.filled > 0;
// اگه همه دارند → کامل؛ اگه بعضی → جزئی با یادآوری
const missingNote = dayNut.n < dayNut.filled
  ? ` (${toFaDigits(dayNut.filled - dayNut.n)} مورد داده ندارد)`
  : '';
```

**دسته** (`buildFromPlan`): هنگام `createMany`، `category` از `ing.ingredient?.category` (الان در data ولی persist نمی‌شود).

---

### فاز ۸ — آینده: اشتراک لینک فقط‌خواندنی ⏱️ ۳-۴ روز

**Migration:** `apps/server/prisma/migrations/20260702000000_shopping_list_share/migration.sql`
```sql
CREATE TABLE "ShoppingListShare" (
  "id" TEXT NOT NULL,
  "shoppingListId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ShoppingListShare_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShoppingListShare_token_key" ON "ShoppingListShare"("token");
ALTER TABLE "ShoppingListShare"
  ADD CONSTRAINT "ShoppingListShare_shoppingListId_fkey"
  FOREIGN KEY ("shoppingListId") REFERENCES "ShoppingList"("id") ON DELETE CASCADE;
ALTER TABLE "ShoppingListShare"
  ADD CONSTRAINT "ShoppingListShare_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id");
```

**مدل Prisma:** در `schema.prisma` با relation‌های `shoppingList` و `createdBy`.

**اندپوینت‌ها:**
| متد | مسیر | guard | توضیح |
|---|---|---|---|
| POST | `/shopping-list/share` | JWT | تولید token → `{token, url}` |
| GET | `/share/:token` | **عمومی** | فقط `{items, name}` (بدون userId) |
| DELETE | `/shopping-list/share/:id` | JWT | revoke (فقط صاحب) |

**فرانت:**
- دکمهٔ «اشتراک» در هدر `shopping-list/page.jsx`
- صفحهٔ `/share/:token` عمومی فقط‌خواندنی (همان GroceryRow بدون edit/delete)

---

### فاز ۹ — آینده: آفلاین تیک‌زدن ⏱️ ۳-۵ روز

**زیرساخت موجود:** `vite-plugin-pwa` + Workbox (NetworkFirst روی `/api/`).

**افزودن:**

| قدم | عمل |
|---|---|
| ۱ | استراتژی کش اختصاصی `GET /shopping-list` با `StaleWhileRevalidate` در `vite.config.js` |
| ۲ | Offline mutation queue در `useShopping.js`: وقتی offline، toggle → صف در IndexedDB (`idb-keyval`) |
| ۳ | Background sync: ثبت `sync` event → flush با `PATCH /shopping-list/items/:id` |
| ۴ | Visual cue: badge «آفلاین» روی هدر (`navigator.onLine === false`) |
| ۵ | Conflict handling: last-write-wins روی `isChecked` |

**scope:** فقط تیک‌زدن (نه add/remove/edit) — ساده و کافی برای خرید فیزیکی.

---

## 8. زیرساخت موجود برای ویژگی‌های آینده

### ۸.۱ PWA (موجود ✅)

| بخش | وضعیت |
|---|---|
| `vite-plugin-pwa` | نصب (`package.json:31`) |
| manifest | پیکربندی‌شده (RTL, fa-IR, آیکون‌ها) |
| Workbox runtimeCaching | NetworkFirst روی `/api/`، StaleWhileRevalidate روی assets |
| skipWaiting/clientsClaim | فعّال (آپدیت فوری) |

**نتیجه:** برای آفلاین، فقط استراتژی کش اختصاصی + offline queue لازم است.

### ۸.۲ اشتراک‌گذاری (از صفر ❌)

- هیچ مدل `Household`/`Family`/`Share`/`Invite` در schema نیست
- هیچ اندپوینت عمومی (بدون JWT) موجود نیست — باید یک guard عمومی یا کنترلر جدا افزوده شود
- الگوی token می‌تواند از `UserSession` الگو بگیرد (رشتهٔ opaque)

### ۸.۳ apiClient

```javascript
// apps/web/src/lib/apiClient.js
axios + baseURL + interceptor توکن (localStorage) + redirect 401
```
برای صفحهٔ share عمومی، نیاز به یک کلاینت بدون interceptor توکن یا نادیده‌گرفتن آن.

### ۸.۴ پروفایل / cooks_for_count

```typescript
// behavior-engine/profile/declared/declared-dimension-registry.ts:62
def({ key: 'context.cooks_for_count', options: ['1','2','3_4','5_plus'] })
```
`COOKS_FOR_TO_SIZE` در `shopping-list.service.ts:10` و `meal-plan-planner.service.ts:19` این را به عدد تبدیل می‌کند.

---

## 9. تضمین عدم شکست و استراتژی rollback

### ۹.۱ قوانین طلایی (در همهٔ فازها)

1. **امضای متدهای عمومی** `ShoppingListService` و `MealPlansService` حفظ شود
2. **شکل JSON پاسخ** تغییر نکند (briefing و AI وابسته‌اند)
3. **تست‌های دودی** `shoppinglist.smoke.test.jsx` و `plan.smoke.test.jsx` ران شوند
4. **migration‌ها** additive + nullable (همان الگوی موجود: `ADD COLUMN IF NOT EXISTS`)
5. **هر فاز کامیت جدا** → قابل rollback با `git revert`

### ۹.۲ الگوی migration امن (الگوی موجود)

```sql
-- additive + nullable + IF NOT EXISTS → safe
ALTER TABLE "X" ADD COLUMN IF NOT EXISTS "col" TYPE;
```

### ۹.۳ timestamp بعدی

آخرین migration: `20260701012000_workflow_alert_lifecycle`
بعدی: `20260702000000_*`

### ۹.۴ تست پیش از commit هر فاز

```bash
pnpm --filter @garnish/server lint
pnpm --filter @garnish/server test
pnpm --filter @garnish/web lint
pnpm --filter @garnish/web test
```

---

## ضمیمه — جدول مرجع سریع

### مشکل → فاز → تلاش

| مشکل | اولویت | فاز | تلاش |
|---|---|---|---|
| باگ re-sync buildFromPlan | 🔴 P0 | ۲ | نیم‌روز |
| کد مرده (۲ فایل) | 🔴 P0 | ۱ | نیم‌روز |
| raw SQL workaround | 🟠 P1 | ۳ | نیم‌روز |
| pantry dedup ناسازگار | 🟠 P1 | ۴ | چند ساعت |
| notes نیمه‌کاره | 🟠 P1 | (تصمیم) | نیم‌روز |
| نبود تایپ @Req | 🟠 P1 | ۵ | یک روز |
| inline-style فراوان | 🟡 P2 | ۶ | ۲-۳ روز |
| generate سنگین | 🟡 P2 | (اختیاری) | نیم‌روز |
| error handling بی‌صدا | 🟡 P2 | (اختیاری) | نیم‌روز |
| inference دسته کلاینت | 🟡 P2 | ۷ | یک روز |
| تخمین کالری جزئی | 🟡 P2 | ۷ | چند ساعت |
| اشتراک لینک | 🔵 آینده | ۸ | ۳-۴ روز |
| آفلاین تیک | 🔵 آینده | ۹ | ۳-۵ روز |

---

*پایان نسخهٔ ۲ — مبتنی بر خوانش کامل کد و نقشهٔ وابستگی‌های تأییدشده با grep.*
