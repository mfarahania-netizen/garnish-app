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
exports.EventEnrichmentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const constants_1 = require("../shared/constants");
const INGREDIENTS_LIST = [
    'پیاز', 'سیر', 'گوجه', 'سیب‌زمینی', 'هویج', 'فلفل دلمه‌ای', 'فلفل سبز', 'فلفل قرمز',
    'کدو', 'بادمجان', 'قارچ', 'کلم', 'کلم بروکلی', 'گل کلم', 'اسفناج', 'کرفس',
    'چغندر', 'شلغم', 'ترب', 'تربچه', 'خیار', 'کاهو', 'کلم قرمز', 'کلم سفید',
    'ذرت', 'نخود فرنگی', 'لوبیا سبز', 'باقلا', 'کنگر', 'ریواس', 'مارچوبه',
    'زیتون', 'کبر', 'خیارشور', 'فلفل تند', 'زنجبیل', 'زردچوبه', 'دارچین',
    'هل', 'میخک', 'جوز هندی', 'فلفل سیاه', 'فلفل سفید', 'نمک', 'آویشن',
    'نعنا', 'شوید', 'جعفری', 'گشنیز', 'ترخون', 'مرزه', 'ریحان', 'رزماری',
    'آبلیمو', 'آبغوره', 'سرکه', 'رب انار', 'رب گوجه', 'رب', 'سس سویا',
    'سس مایونز', 'خردل', 'کچاپ', 'سس باربیکیو', 'زعفران', 'گلاب',
    'سیب', 'موز', 'پرتقال', 'نارنگی', 'لیمو', 'گریپ فروت', 'انار', 'انگور',
    'هندوانه', 'طالبی', 'خربزه', 'آلبالو', 'گیلاس', 'آلو', 'زردآلو', 'هلو',
    'شلیل', 'کیوی', 'انبه', 'آناناس', 'نارگیل', 'پاپایا', 'توت فرنگی',
    'تمشک', 'بلوبری', 'شاه توت', 'ازگیل', 'به', 'گلابی', 'خرمالو',
    'انجیر', 'خرما', 'کشمش', 'آلو بخارا', 'قیسی', 'زرشک', 'سنجد',
    'مرغ', 'گوشت', 'گوسفند', 'گوساله', 'ماهی', 'میگو', 'تن ماهی', 'ساردین',
    'کنسرو ماهی', 'تخم‌مرغ', 'دل', 'جگر', 'قلوه', 'سوسیس', 'کالباس',
    'بیکن', 'ژامبون', 'پپرونی', 'گوشت چرخ‌کرده', 'سینه مرغ', 'ران مرغ',
    'بال مرغ', 'فیله مرغ', 'ماهی قزل‌آلا', 'ماهی سالمون', 'ماهی تن',
    'ماهی حلوا', 'ماهی سفید', 'ماهی کپور', 'ماهی شیر', 'میگوی درشت',
    'برنج', 'نان', 'آرد', 'ماکارونی', 'پاستا', 'رشته', 'لازانیا', 'بلغور',
    'جو', 'جو دوسر', 'عدس', 'لوبیا', 'نخود', 'لپه', 'ماش', 'باقالی',
    'سویا', 'کینوا', 'گندم', 'سبوس', 'آرد سوخاری', 'پودر سوخاری',
    'شیر', 'ماست', 'پنیر', 'کره', 'خامه', 'دوغ', 'کشک', 'پنیر پیتزا',
    'پنیر چدار', 'پنیر گودا', 'پنیر فتا', 'پنیر محلی', 'شیر خشک',
    'گردو', 'بادام', 'پسته', 'فندق', 'بادام زمینی', 'تخمه', 'کنجد',
    'تخم کتان', 'تخم چیا', 'تخم آفتابگردان', 'نارگیل رنده‌شده',
    'روغن', 'روغن زیتون', 'روغن کنجد', 'روغن نارگیل', 'کره حیوانی',
    'کره گیاهی', 'مارگارین', 'عسل', 'شکر', 'قند', 'شیره انگور', 'شیره خرما',
    'پودر قند', 'وانیل', 'بیکینگ پودر', 'جوش شیرین', 'مایه خمیر', 'نشاسته',
    'ژلاتین', 'آگار', 'پکتین',
    'ناگت مرغ', 'کباب لقمه', 'همبرگر', 'فلافل', 'سمبوسه', 'اسنک',
    'چیپس', 'پفک', 'بیسکویت', 'کیک آماده', 'نان باگت', 'نان تست',
    'نان همبرگر', 'نان ساندویچی', 'نان لواش', 'نان سنگک', 'نان تافتون',
    'نان پیتا', 'ترتیلا', 'رشته فرنگی', 'نودل', 'بلغور پخته',
];
const RECIPES_LIST = [
    'قرمه سبزی', 'قیمه', 'فسنجان', 'جوجه کباب', 'کباب کوبیده', 'کباب برگ',
    'کباب شیشلیک', 'کباب ترش', 'کباب تابه‌ای', 'کباب دیگی', 'چلو کباب',
    'چلو خورشت', 'چلو ماهیچه', 'چلو مرغ', 'چلو گوشت', 'زرشک پلو با مرغ',
    'زرشک پلو با گوشت', 'آلبالو پلو', 'آلبالو پلو با مرغ', 'شوید پلو',
    'شوید پلو با ماهی', 'باقالی پلو', 'باقالی پلو با گوشت', 'عدس پلو',
    'عدس پلو با گوشت', 'لوبیا پلو', 'لوبیا پلو با گوشت', 'ماش پلو',
    'کلم پلو', 'کلم پلو شیرازی', 'هویج پلو', 'شیرین پلو', 'مرصع پلو',
    'دمپختک', 'دمپخت گوجه', 'دمپخت عدس', 'استانبولی', 'ته چین مرغ',
    'ته چین گوشت', 'ته چین بادمجان', 'تاس کباب', 'کله جوش', 'آش رشته',
    'آش جو', 'آش دوغ', 'آش شله قلمکار', 'آش ترش', 'آش انار', 'آش کدو',
    'آش شلغم', 'آش بلغور', 'سوپ جو', 'سوپ مرغ', 'سوپ گوجه', 'سوپ کدو',
    'سوپ قارچ', 'سوپ شیر', 'سوپ عدس', 'سوپ سبزیجات', 'کوکو سبزی',
    'کوکو سیب زمینی', 'کوکو لوبیا', 'کوکو بادمجان', 'شامی', 'کتلت',
    'فلافل', 'سمبوسه', 'پیراشکی', 'دلمه برگ مو', 'دلمه فلفل', 'دلمه گوجه',
    'دلمه بادمجان', 'کوفته تبریزی', 'کوفته برنجی', 'کوفته سبزی',
    'کوفته تره', 'میرزا قاسمی', 'باقالی قاتق', 'زیتون پرورده', 'ترشی',
    'شور', 'ماست و خیار', 'ماست و موسیر', 'ماست و بادمجان', 'کشک بادمجان',
    'حلیم بادمجان', 'کله جوش', 'اشکنه', 'عدسی', 'خاگینه', 'املت',
    'املت پنیر', 'املت گوجه', 'املت قارچ', 'پوره سیب زمینی', 'سالاد شیرازی',
    'سالاد فصل', 'سالاد کلم', 'سالاد ماکارونی', 'سالاد الویه', 'سالاد مرغ',
    'سالاد تن ماهی', 'سالاد یونانی', 'سالاد سزار', 'سالاد نودل',
    'پیتزا', 'پیتزا مارگاریتا', 'پیتزا پپرونی', 'پیتزا سبزیجات', 'پیتزا گوشت',
    'پیتزا مرغ', 'پیتزا مخلوط', 'پاستا', 'پاستا آلفردو', 'پاستا بولونیز',
    'پاستا کربونارا', 'پاستا پستو', 'لازانیا', 'راویولی', 'اسپاگتی',
    'ماکارونی', 'نودل', 'رامن', 'استیک', 'بیف استروگانف', 'کباب ترکی',
    'شاورما', 'دونر کباب', 'فلافل', 'حمص', 'بابا غنوج', 'تبوله', 'سوشی',
    'ساشیمی', 'تمپورا', 'کاری مرغ', 'تندوری مرغ', 'چیکن تندوری',
    'ماسالا دوسا', 'پالاک پنیر', 'بریانی', 'پلو بریانی', 'نان سیر',
    'سوپ پیاز', 'سوپ مینسترون', 'سوپ تورتلینی', 'ساندویچ', 'همبرگر',
    'چیزبرگر', 'چیکن برگر', 'فیله مرغ سوخاری', 'ماهی سوخاری', 'چیپس',
    'سیب زمینی سرخ‌کرده', 'املت فرانسوی', 'کروسان', 'پنکیک', 'وافل',
    'فرنی', 'پودینگ', 'کرم بروله', 'موس شکلات', 'ترامیسو', 'کیک شکلاتی',
    'کیک وانیلی', 'کیک هویج', 'کیک موز', 'کیک لیمو', 'کیک پنیر',
    'چیزکیک', 'بستنی', 'بستنی وانیلی', 'بستنی شکلاتی', 'بستنی توت فرنگی',
    'میلک شیک', 'اسموتی', 'آبمیوه', 'چای', 'قهوه', 'هات چاکلت',
];
let EventEnrichmentService = class EventEnrichmentService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async enrichEvent(eventId) {
        const event = await this.prisma.userEvent.findUnique({ where: { id: eventId } });
        if (!event || event.enrichment)
            return;
        let enrichmentData = {};
        try {
            if (event.type === 'ai_message_send') {
                const payload = JSON.parse(event.payload || '{}');
                const message = payload.message || '';
                if (message.trim()) {
                    const ingredients = INGREDIENTS_LIST.filter(ing => message.includes(ing));
                    const recipes = RECIPES_LIST.filter(recipe => message.includes(recipe));
                    const intent = this.analyzeUserIntent(message);
                    const conceptKey = this.findConceptKey(message);
                    const concepts = [];
                    if (conceptKey)
                        concepts.push(conceptKey);
                    if (intent.isQuick)
                        concepts.push('سریع');
                    if (intent.isEasy)
                        concepts.push('آسان');
                    if (intent.diet)
                        concepts.push(intent.diet);
                    enrichmentData = {
                        ingredients,
                        recipes,
                        concepts,
                        mealType: intent.mealType || '',
                        diet: intent.diet || '',
                        budget: intent.cost || '',
                        occasion: intent.occasion || '',
                        sentiment: '',
                    };
                    console.log('✅ Enrichment result:', JSON.stringify(enrichmentData));
                }
            }
            if (Object.keys(enrichmentData).length > 0) {
                await this.prisma.userEvent.update({
                    where: { id: eventId },
                    data: { enrichment: JSON.stringify(enrichmentData) },
                });
            }
        }
        catch (e) {
            console.error('Event enrichment failed:', e);
        }
    }
    findConceptKey(prompt) {
        const lower = prompt.toLowerCase();
        for (const key of Object.keys(constants_1.CONCEPT_MAP)) {
            if (lower.includes(key))
                return key;
        }
        return null;
    }
    analyzeUserIntent(prompt) {
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
        return { mealType, diet, cost, occasion, isQuick, isEasy };
    }
};
exports.EventEnrichmentService = EventEnrichmentService;
exports.EventEnrichmentService = EventEnrichmentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EventEnrichmentService);
//# sourceMappingURL=event-enrichment.service.js.map