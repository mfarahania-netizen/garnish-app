"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const CONCEPT_MAP = {
    'مقوی': ['گوشت', 'حبوبات', 'عدس', 'نخود', 'لوبیا', 'آبگوشت', 'حلیم'],
    'ورزشکاری': ['سینه مرغ', 'تخم‌مرغ', 'ماهی', 'پروتئین', 'اسفناج'],
    'درباری': ['زعفران', 'گردو', 'رب انار', 'آلو', 'ته‌چین', 'فسنجان', 'کباب', 'دلمه'],
    'خونگی': ['سیب‌زمینی', 'پیاز', 'گوجه', 'کتلت', 'کوکو', 'املت'],
    'کودک': ['مرغ', 'پاستا', 'پنیر', 'کتلت', 'فرنی'],
    'ساده': ['تخم‌مرغ', 'گوجه', 'سیب‌زمینی', 'پیاز'],
    'پروتئین': ['گوشت', 'مرغ', 'تخم‌مرغ', 'عدس', 'لوبیا'],
    'کبابی': ['گوشت چرخ‌کرده', 'کباب', 'زعفران', 'گوجه', 'پیاز'],
    'گیاهی': ['بادمجان', 'لوبیا', 'نخود', 'عدس', 'سبزی'],
};
let AiService = class AiService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async handlePrompt(prompt, userId) {
        let userAllergies = [];
        let userProfile = null;
        if (userId) {
            userProfile = await this.prisma.userPreference.findUnique({
                where: { userId },
            });
            if (userProfile) {
                const allergies = await this.prisma.userAllergy.findMany({
                    where: { userId },
                    include: { allergy: true },
                });
                userAllergies = allergies.map(ua => ua.allergy.name);
            }
        }
        let ingredients = [];
        let fromConcept = false;
        const conceptKey = this.findConceptKey(prompt);
        if (conceptKey) {
            ingredients = CONCEPT_MAP[conceptKey];
            fromConcept = true;
        }
        else if (prompt.length < 3) {
            ingredients = this.extractIngredients(prompt);
        }
        else {
            const expanded = await this.expandConcept(prompt);
            if (expanded.length > 0) {
                ingredients = expanded;
                fromConcept = true;
            }
            else {
                ingredients = this.extractIngredients(prompt);
            }
        }
        const intent = this.analyzeUserIntent(prompt);
        const { mealType, diet, cost, occasion, isQuick, isEasy } = intent;
        if (diet === 'healthy' && ingredients.length === 0 && !mealType && !cost && !occasion && !isQuick && !isEasy) {
            return await this.getHealthySuggestions(prompt, userProfile);
        }
        if (ingredients.length === 0 && !mealType && !diet && !cost && !occasion && !isQuick && !isEasy) {
            if (this.isGreeting(prompt)) {
                return '👋 سلام! من دستیار آشپزی گارنیش هستم...';
            }
            const randomRecipes = await this.getRandomRecipes(3);
            if (randomRecipes.length > 0) {
                return `🎲 چند پیشنهاد تصادفی برای امروز:\n\n${this.formatRecipes(randomRecipes)}`;
            }
            return '❌ متأسفانه هیچ رسپی‌ای در دسترس نیست.';
        }
        let recipes = await this.prisma.recipe.findMany({
            include: { ingredients: true },
        });
        if (ingredients.length > 0) {
            const useOr = fromConcept || prompt.includes('یا');
            recipes = recipes.filter(r => {
                if (useOr) {
                    return ingredients.some(ing => r.ingredients.some(ri => ri.name.includes(ing)) || r.title.includes(ing));
                }
                return ingredients.every(ing => r.ingredients.some(ri => ri.name.includes(ing)) || r.title.includes(ing));
            });
        }
        if (mealType)
            recipes = recipes.filter(r => r.mealType?.includes(mealType));
        if (diet === 'healthy') {
            recipes = recipes.filter(r => {
                const cats = r.categories ? JSON.parse(r.categories) : [];
                return r.diet === 'vegetarian' || r.diet === 'vegan' || cats.includes('سالم') || cats.includes('رژیمی');
            });
        }
        else if (diet) {
            recipes = recipes.filter(r => r.diet === diet);
        }
        if (cost)
            recipes = recipes.filter(r => r.cost === cost);
        if (occasion) {
            recipes = recipes.filter(r => {
                const occasions = r.occasion ? JSON.parse(r.occasion) : [];
                return occasions.includes(occasion);
            });
        }
        if (isQuick)
            recipes = recipes.filter(r => (r.cookingTime || 0) <= 30);
        if (isEasy)
            recipes = recipes.filter(r => r.difficulty === 'آسان');
        const personalizationReasons = [];
        if (userProfile) {
            if (userProfile.diet === 'vegetarian' || userProfile.diet === 'vegan') {
                const before = recipes.length;
                recipes = recipes.filter(r => r.diet === 'vegetarian' || r.diet === 'vegan');
                if (recipes.length < before)
                    personalizationReasons.push('رژیم گیاه‌خواری شما');
            }
            if (userAllergies.length > 0) {
                const before = recipes.length;
                recipes = recipes.filter(r => {
                    const recipeAllergens = r.allergens ? JSON.parse(r.allergens) : [];
                    return !userAllergies.some(allergy => recipeAllergens.includes(allergy));
                });
                if (recipes.length < before)
                    personalizationReasons.push('آلرژی‌های غذایی شما');
            }
            if (userProfile.skillLevel === 'beginner') {
                const before = recipes.length;
                recipes = recipes.filter(r => r.difficulty !== 'سخت');
                if (recipes.length < before)
                    personalizationReasons.push('سطح مهارت مبتدی شما');
            }
        }
        if (recipes.length === 0) {
            let relaxedRecipes = await this.prisma.recipe.findMany({
                include: { ingredients: true },
            });
            if (ingredients.length > 0) {
                relaxedRecipes = relaxedRecipes.filter(r => ingredients.some(ing => r.ingredients.some(ri => ri.name.includes(ing)) || r.title.includes(ing)));
            }
            if (relaxedRecipes.length > 0) {
                return `🎯 برای «${prompt}» دقیقاً چیزی پیدا نشد، اما نزدیک‌ترین غذاها اینان:\n\n${this.formatRecipes(relaxedRecipes.slice(0, 3))}`;
            }
            return `❌ برای «${prompt}» غذایی پیدا نشد. می‌تونی با مواد دیگه‌ای امتحان کنی.`;
        }
        if (ingredients.length > 0) {
            recipes.sort((a, b) => {
                const aCount = ingredients.filter(ing => a.ingredients.some(ri => ri.name.includes(ing)) || a.title.includes(ing)).length;
                const bCount = ingredients.filter(ing => b.ingredients.some(ri => ri.name.includes(ing)) || b.title.includes(ing)).length;
                return bCount - aCount;
            });
        }
        const top = recipes.slice(0, 5);
        const lines = top.map(r => {
            const time = r.cookingTime ? `${r.cookingTime} دقیقه` : 'زمان نامشخص';
            const ingNames = r.ingredients.slice(0, 3).map(i => i.name).join('، ');
            return `**${r.title}**\n⏱ ${time} | ${r.difficulty || '؟'}${r.cost ? ` | 💰 ${r.cost}` : ''}\n📝 ${ingNames}`;
        });
        let response = `🔍 ${this.describeFilters(intent)}:\n\n${lines.join('\n\n')}`;
        if (personalizationReasons.length > 0) {
            response += `\n\n💡 (بر اساس ${personalizationReasons.join(' و ')} فیلتر شده است.)`;
        }
        return response;
    }
    findConceptKey(prompt) {
        const lower = prompt.toLowerCase();
        for (const key of Object.keys(CONCEPT_MAP)) {
            if (lower.includes(key))
                return key;
        }
        return null;
    }
    async getHealthySuggestions(prompt, userProfile) {
        let recipes = await this.prisma.recipe.findMany({
            include: { ingredients: true },
        });
        recipes = recipes.filter(r => {
            const cats = r.categories ? JSON.parse(r.categories) : [];
            return r.diet === 'vegetarian' || r.diet === 'vegan' || cats.includes('سالم') || cats.includes('رژیمی');
        });
        if (userProfile?.diet === 'vegetarian' || userProfile?.diet === 'vegan') {
            recipes = recipes.filter(r => r.diet === 'vegetarian' || r.diet === 'vegan');
        }
        if (recipes.length === 0)
            return '❌ متأسفانه هیچ غذای سالمی در دیتابیس پیدا نشد.';
        const top = recipes.slice(0, 5);
        const lines = top.map(r => {
            const time = r.cookingTime ? `${r.cookingTime} دقیقه` : 'زمان نامشخص';
            const ingNames = r.ingredients.slice(0, 3).map(i => i.name).join('، ');
            return `**${r.title}**\n⏱ ${time} | ${r.difficulty || '؟'}${r.cost ? ` | 💰 ${r.cost}` : ''}\n📝 ${ingNames}`;
        });
        return `🥗 پیشنهادهای سالم و رژیمی:\n\n${lines.join('\n\n')}\n\n💡 این غذاها کم‌چرب و پرخاصیت هستن.`;
    }
    async expandConcept(prompt) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is not set');
            return [];
        }
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                            parts: [{
                                    text: `تو یک آشپز حرفه‌ای ایرانی هستی. کاربر جمله‌ای نوشته: "${prompt}". وظیفه تو این است که مفهوم کلی این جمله را درک کنی و ۵ مادهٔ اولیه یا کلمهٔ کلیدی که در آشپزی ایرانی برای این مفهوم به کار می‌روند را به صورت یک آرایه JSON برگردانی. این کلمات را طوری انتخاب کن که اگر در یک پایگاه دادهٔ غذا جستجو شوند، غذاهای مرتبط با آن مفهوم پیدا شوند. فقط آرایه JSON را برگردان، بدون هیچ توضیح اضافی. مثال: برای "کبابی" → ["گوشت چرخ‌کرده", "زعفران", "پیاز", "نان", "گوجه"]. برای "رژیمی" → ["سینه مرغ", "سبزیجات", "ماهی", "سالاد", "کم‌چرب"]. برای "درباری" → ["زعفران", "گردو", "رب انار", "آلو", "ته‌چین"]. اگر مفهومی متوجه نشدی، آرایه خالی برگردان: []`
                                }]
                        }]
                }),
            });
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
            const match = text.match(/\[.*?\]/s);
            if (match)
                return JSON.parse(match[0]);
        }
        catch (e) {
            console.error('expandConcept failed:', e);
        }
        return [];
    }
    analyzeUserIntent(prompt) {
        const ingredients = this.extractIngredients(prompt);
        const lower = prompt.toLowerCase();
        let mealType = null;
        let diet = null;
        let cost = null;
        let occasion = null;
        let isQuick = false;
        let isEasy = false;
        if (lower.includes('صبحانه'))
            mealType = 'breakfast';
        else if (lower.includes('ناهار'))
            mealType = 'lunch';
        else if (lower.includes('شام'))
            mealType = 'dinner';
        else if (lower.includes('عصرانه') || lower.includes('میان‌وعده'))
            mealType = 'snack';
        if (lower.includes('گیاهی') || lower.includes('وجترین'))
            diet = 'vegetarian';
        else if (lower.includes('سالم') || lower.includes('رژیمی'))
            diet = 'healthy';
        else if (lower.includes('ورزشکاری')) {
            diet = 'healthy';
            isQuick = true;
        }
        if (lower.includes('ارزون') || lower.includes('کم‌هزینه'))
            cost = 'کم‌هزینه';
        else if (lower.includes('متوسط') && (lower.includes('هزینه') || lower.includes('قیمت')))
            cost = 'متوسط';
        else if (lower.includes('گرون'))
            cost = 'گران';
        if (lower.includes('مهمونی') || lower.includes('مهمانی') || lower.includes('جشن'))
            occasion = 'مهمانی';
        else if (lower.includes('پیک‌نیک') || lower.includes('طبیعت'))
            occasion = 'پیک‌نیک';
        else if (lower.includes('یلدا') || lower.includes('شب یلدا'))
            occasion = 'شب یلدا';
        else if (lower.includes('افطار'))
            occasion = 'افطار';
        else if (lower.includes('نذری'))
            occasion = 'نذری';
        if (lower.includes('سریع') || lower.includes('فوری') || lower.includes('زیر ۳۰ دقیقه'))
            isQuick = true;
        if (lower.includes('آسون') || lower.includes('راحت') || lower.includes('ساده'))
            isEasy = true;
        return { ingredients, mealType, diet, cost, occasion, isQuick, isEasy };
    }
    extractIngredients(text) {
        const foodList = [
            'مرغ', 'گوشت', 'برنج', 'زعفران', 'پیاز', 'سیر', 'گوجه', 'سیب‌زمینی',
            'عدس', 'لوبیا', 'ماهی', 'میگو', 'قارچ', 'پنیر', 'تخم‌مرغ', 'ماست',
            'بادمجان', 'کدو', 'هویج', 'فلفل', 'سبزی', 'نخود', 'لپه', 'گردو',
            'زرشک', 'آلبالو', 'آلو', 'به', 'انار', 'رب', 'شوید', 'تره',
        ];
        return foodList.filter(f => text.includes(f));
    }
    isGreeting(text) {
        const greetings = ['سلام', 'خوبی', 'چطوری', 'خوب هستی', 'درود', 'خدا قوت', 'خوبم'];
        return greetings.some(g => text.includes(g));
    }
    describeFilters(intent) {
        const parts = [];
        if (intent.ingredients.length > 0)
            parts.push(`دارای «${intent.ingredients.join('، ')}»`);
        if (intent.mealType)
            parts.push(`وعدهٔ «${this.mealLabel(intent.mealType)}»`);
        if (intent.diet === 'vegetarian')
            parts.push('گیاهی');
        if (intent.diet === 'healthy')
            parts.push('سالم');
        if (intent.cost)
            parts.push(`هزینهٔ «${intent.cost}»`);
        if (intent.occasion)
            parts.push(`مناسب «${intent.occasion}»`);
        if (intent.isQuick)
            parts.push('سریع');
        if (intent.isEasy)
            parts.push('آسان');
        if (parts.length === 0)
            parts.push('همهٔ غذاها');
        return 'غذاهای ' + parts.join('، ');
    }
    mealLabel(type) {
        const map = {
            breakfast: 'صبحانه',
            lunch: 'ناهار',
            dinner: 'شام',
            snack: 'میان‌وعده',
        };
        return map[type] || type;
    }
    formatRecipes(recipes) {
        return recipes.map(r => {
            const time = r.cookingTime ? `${r.cookingTime} دقیقه` : '؟';
            const ingNames = r.ingredients.slice(0, 2).map(i => i.name).join('، ');
            return `🔥 **${r.title}** (${time}) - ${ingNames}`;
        }).join('\n\n');
    }
    async getRandomRecipes(count) {
        const all = await this.prisma.recipe.findMany({ take: 50, include: { ingredients: true } });
        if (all.length === 0)
            return [];
        const shuffled = all.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AiService);
//# sourceMappingURL=ai.service.js.map