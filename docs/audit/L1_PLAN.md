<div dir="rtl">

# 🧠 نقشهٔ L1 — رنکرِ یادگیرنده (priors-first، seam-clean)

> خروجیِ فورجِ طراحی‌پیش‌از‌ساخت (`l1-design-forge`، ۱۱ ایجنت) + **بازبینیِ ادورسریالِ ۲ نفره روی نقشه پیش از کد**.
> اصلِ کار: چون قبل از لانچ **صفر کاربر** داریم، مدلِ یادگرفته زودرس/تئاتر است. فاز ۱ = بنیادی که از اولین کاربرِ
> سرد عالی کار کند (priorهای منطقه/کوهورت با shrinkage) و **خودکار** با آمدنِ داده یاد بگیرد (seamِ priors→learnable).

## ⚠️ اصلاحاتِ حیاتیِ بازبینی (که جلوی دوباره‌کاری را گرفت)
1. **تلهٔ live-vs-shadow:** دو اسکورر هست — زندهٔ `RankingService` (`pipeline/ranking.service.ts`، مجموعِ وزنیِ ۱۰ مؤلفه، وزن از featureStore) و سایهٔ `scoreRecommendationCandidates` (`intelligence/`، با buildUserFoodIdentityGraph + SignalObservation). **`blendCollective`، joinِ cuisine-affinity، گرافِ هویتِ غذایی همه در مسیرِ سایه‌اند، نه زنده.** پس «promote blendCollective، یک‌خطی» **غلط** بود — هر چیزی که می‌سازیم باید به `RankingService`ِ **زنده** وصل شود.
2. **propensity صادق نیست هنوز:** softmaxِ یک رنکرِ قطعی است (نه سیاستِ تصادفی) → IPS تا فعال‌شدنِ seamِ epsilon-randomization **بایاس** است. DoD باید «joinable» باشد نه «unbiased».
3. سه خطای فاکتیِ کوچک‌تر دربارهٔ کدِ موجود + ادعای «region فوراً قابل‌بیان» (User هیچ locale/country ندارد).

## ✅ آنچه هر دو بازبین تأیید کردند (مطمئن، بساز)
- سه seamِ وزن در ranking.service واقعاً وجود دارند (`:141` defaultWeights|getWeights · `:157` resolveWeightsForMaturity · `:892` weightedScore) → wrap تمیز.
- User هیچ locale/country/cohort ندارد → **شکافِ کلیدِ اتصالِ لانچ**.
- **served↔reward امروز غیرقابل‌اتصال + جبران‌ناپذیر است** (ServedItem کلیدِ propensity دارد، AttributionEvent فقط userId/recipeId) — ۱۱۶ served / ۷۰۶ attribution همین حالا برای همیشه گم‌اند. **بهترین و فوری‌ترین آیتم.**

## ترتیبِ فاز ۱ (اصلاح‌شده — مطمئن‌ها اول، همه default-OFF/byte-identical تا flip)
1. **🔴 کلیدِ اتصالِ `requestId`** (جبران‌ناپذیر اگر جا بماند): `requestId` روی RecommendationServedItem + RecommendationAttributionEvent؛ stamp روی اسلیتِ سروشده + برگرداندن در پاسخ تا کلاینت روی رویدادِ اکشن echo کند. **این قدمِ اول.**
2. **🟠 User.locale + User.country** (nullable) + deriverِ `cohortKey` (locale+diet+skill+occasion) — کلیدِ اتصالِ منطقه/کوهورت.
3. **seamِ WeightSource/PriorResolver** روی سه مسیرِ وزنِ **زنده**؛ فقط StaticWeightSource ثبت؛ default-OFF؛ اثباتِ byte-identical با اسپک‌های رنکر.
4. ✅ **DONE (default-OFF، نگهبان‌خورده `9f1e3255`+`79332d43`+`b39be3c3`)** — **PriorService** (empirical-Bayes shrinkage `(κμ+n·x̄)/(κ+n)`) + جدولِ RecipePrior، seed از دادهٔ ادیتوریالِ curated (نقشهٔ دروازهٔ اروپا + تقویمِ مناسبت)؛ n=0 ⇒ دقیقاً priorِ curated. wire به‌عنوان WeightSourceِ کوهورت‌آگاه + تعمیمِ coldStartWeightBlend به person→cohort→population. ساخته‌شده: RecipePriorService (خواندن) + RecipePriorLearnerService (IPS+weighted-Welford) + recipePrior componentِ ranker (وزن=۰، byte-identical) + erasureِ GDPR. جزئیات `L1_STEP4_PRIOR_SPEC.md`. باقی = نویسندگیِ populationMuِ curated (محتوایی) + فعال‌سازی (گیتِ offline-replay + bandit).
5. **degradationِ جمعی + محافظتِ اقلیت** — **در رنکرِ زنده** (نه یک‌خطیِ سایه): جملهٔ افزایشیِ کراندار در اسلاتِ post-linear (`:242`)، seed از محبوبیتِ curated؛ محافظتِ اقلیت = ۳ لایه (کرانِ نامتقارن + گیتِ override با سیگنالِ شخصی + دانه‌بندیِ کوهورت)؛ **invariant: سیگنالِ شخصیِ مثبت ⇒ امتیاز هرگز کم نشود** (property-test).
6. **taste-DNAِ شفاف + قابل‌تنظیم (R7)**: read (ExplainabilityService + FeatureContributionLog) + write (ویرایش→SignalObservation→مسیرِ feature-storeِ **زنده**، نه سایه)، گیتِ consentِ personalization.

## موکول‌شده (داده‌گرسنه، برچسب‌خورده — نه حذف)
L1.3 retrainJob (overwrite RecipePrior از پاداشِ IPS-debiased) → L1.4 LearnedWeightSource (per-cohort) → L1.5 bandit/epsilon (propensityِ صادق) → L1.6 CF/embeddings (R4). هرکدام یک ثبتِ config، بدونِ بازنویسیِ رنکر.

## DoD (هستهٔ فاز ۱)
با همهٔ flagها OFF، سیستم byte-identical به امروز · served↔attribution end-to-end joinable (کوئریِ (context,action,propensity,reward)) · کاربرِ هلندیِ بی‌سابقه در درخواست #۱ اسلیتِ allergy-safe و occasion-aware و cohort-prior می‌گیرد · property-testِ محافظتِ اقلیت پاس · هر مصرف‌کنندهٔ یادگیری با flag/ثبتِ مشخص فعال می‌شود (بدونِ بازنویسی).

## ریسک‌ها
کیفیتِ priorِ curated = محصولِ پیش‌از‌داده (بازبینیِ بنیان‌گذار + حلقهٔ ویرایش) · **جا‌ماندنِ requestId = جبران‌ناپذیر (قدم ۱)** · کجتنظیمیِ κ (per-scope، از control-plane) · propensityِ بایاس تا epsilon (ادعای unbiased نکن) · N+1ِ popularity (cache در مقیاس).

*ساخت با حلقهٔ نگهبان (build→۲ بازبین→loop). منبع: `l1-design-forge` + re-review.*

</div>
