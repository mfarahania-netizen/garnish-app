# Meze 50 Duplicate Gate v2

## Existing Coverage Regrouped

| group | count |
| --- | --- |
| other_savory_or_unclassified | 345 |
| desserts_sweets_not_savory_meze | 92 |
| drinks_not_savory_meze | 83 |
| bread_cracker_chips | 24 |
| salads_slaws | 15 |
| dips_spreads_olive_yogurt | 13 |
| nuts_seeds | 5 |
| stuffed_vegetables | 5 |
| chickpea_bean_snacks | 3 |
| potato_fries_wedges | 3 |
| corn_elote_mexican_snack | 1 |

## Removed From v1 Final 50

| candidate | v1 status | v2 classification | closest strict match | gate decision |
| --- | --- | --- | --- | --- |
| mexican-elote-cups | v1 selected | REPLACE_DUPLICATE | mexican-street-corn-cup / ذرت مکزیکی فنجانی (الوته آماده) | Same user intent and format as existing mexican-street-corn-cup; elote cup wording is not enough differentiation. |
| mini-tomato-basil-arancini | v1 selected | REPLACE_DUPLICATE | arancini / آرانچینی | Existing arancini already covers the same fried rice ball intent; mini tomato-basil is a variant, not a new app concept. |
| mini-spinach-feta-triangles | v1 selected | REPLACE_DUPLICATE | spanakopita / اسپاناکوپیتا | Spinach + feta + phyllo snack intent is too close to existing spanakopita; mini form is insufficient differentiation. |

## Approved v2 Rows

| candidate | v1 status | v2 classification | closest strict match | gate decision |
| --- | --- | --- | --- | --- |
| olive-feta-garlic-dip | SAFE_NEW | APPROVED_DISTINCT_BUT_CLOSE | marinated-olive-and-herb-dip-with-bread / زیتون پرورده با نان | Close to olive dips, but approved only if feta is the dominant creamy base and olives are a flavor-in, not zeytoon parvardeh. |
| whipped-feta-with-chili-honey-and-pistachio | SIMILAR_BUT_DISTINCT | APPROVED_DISTINCT_BUT_CLOSE | feta-walnut-and-honey-on-bread / پنیر و گردو و عسل روی نان | Feta and honey exist in breakfast/snack content, but this must remain a whipped dip with chili honey and pistachio. |
| tirokafteri-spicy-feta-spread | SAFE_NEW | APPROVED_DISTINCT_BUT_CLOSE | greek-kleftiko-lamb / کلفتیکوی یونانی | In the feta spread family, but distinct as a spicy Greek pepper-feta spread. |
| labneh-with-zaatar-and-olive-oil | SAFE_NEW | APPROVED_DISTINCT_BUT_CLOSE | marinated-olive-and-herb-dip-with-bread / زیتون پرورده با نان | Close to yogurt dips, but distinct if it keeps thick labneh, zaatar, and olive-oil Levant profile. |
| beet-labneh-with-walnuts | SAFE_NEW | APPROVED_DISTINCT_BUT_CLOSE | beet-yogurt-dip / دیپ ماست و لبو (بورانی سرد) | Close to beet-yogurt-dip; approved only with labneh texture, walnut, and lemon so it does not become generic beet borani. |
| muhammara-walnut-pepper-dip | SIMILAR_BUT_DISTINCT | APPROVED_SAFE_NEW | cucumber-walnut-yogurt-dip / ماست با خیار و گردو (دیپ) | از نظر فرم سرو، کاربرد میان وعده و ترکیب مزه با نزدیک ترین دستور فعلی تفاوت دارد. |
| roasted-carrot-harissa-dip | SAFE_NEW | APPROVED_SAFE_NEW | havij-polo / هویج پلو | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| smoky-white-bean-rosemary-dip | SAFE_NEW | APPROVED_SAFE_NEW | guacamole-with-bread / دیپ گواکاموله با نان | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| lemon-garlic-butter-mushrooms | SAFE_NEW | APPROVED_SAFE_NEW | korean-scallion-pajeon / پاجون پیازچه کره‌ای | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| halloumi-bites-with-honey-sesame | SIMILAR_BUT_DISTINCT | APPROVED_SAFE_NEW | honey-sesame-toast / نان تست با عسل و کنجد | از نظر فرم سرو، کاربرد میان وعده و ترکیب مزه با نزدیک ترین دستور فعلی تفاوت دارد. |
| crispy-feta-phyllo-bites | SAFE_NEW | APPROVED_DISTINCT_BUT_CLOSE | spanakopita / اسپاناکوپیتا | Close to phyllo/feta territory, but without spinach and as crisp feta bites; must not drift into spanakopita. |
| feta-herb-stuffed-mini-peppers | SAFE_NEW | APPROVED_SAFE_NEW | morgh-shekam-por / مرغ شکم‌پر | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| turkish-ezme | SIMILAR_BUT_DISTINCT | APPROVED_SAFE_NEW | turkish-ayran / آیران ترکی | از نظر فرم سرو، کاربرد میان وعده و ترکیب مزه با نزدیک ترین دستور فعلی تفاوت دارد. |
| haydari-yogurt-mint-dip | SIMILAR_BUT_DISTINCT | APPROVED_DISTINCT_BUT_CLOSE | borani-esfenaj / بورانی اسفناج | Close to borani/yogurt dips; must be Turkish haydari with strained yogurt, mint, garlic, olive oil, optional walnut, no cucumber/beet/spinach. |
| skordalia-garlic-potato-dip | SIMILAR_BUT_DISTINCT | APPROVED_SAFE_NEW | kuku-sibzamini / کوکو سیب‌زمینی | از نظر فرم سرو، کاربرد میان وعده و ترکیب مزه با نزدیک ترین دستور فعلی تفاوت دارد. |
| mushroom-thyme-crostini | SAFE_NEW | APPROVED_SAFE_NEW | chicken-and-mushroom / خوراک مرغ و قارچ | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| fried-mozzarella-bites | SAFE_NEW | APPROVED_SAFE_NEW | fried-chicken / مرغ سوخاری | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| dutch-cheese-souffle-bites | SAFE_NEW | APPROVED_SAFE_NEW | cheese-omelet / املت پنیر | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| chili-cheese-potato-wedges | SIMILAR_BUT_DISTINCT | APPROVED_DISTINCT_BUT_CLOSE | french-fries / سیب زمینی سرخ کرده | Close to french fries; approved only with wedge cut, chili-cheese topping, and explicit bake/fry method. |
| buffalo-cauliflower-bites | SAFE_NEW | APPROVED_SAFE_NEW | malva-pudding-caramel-sauce / مالوا پودینگ با سس گرم | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| zaatar-crispy-chickpeas | SAFE_NEW | APPROVED_DISTINCT_BUT_CLOSE | roasted-chickpeas-and-raisins / نخودچی کشمش | Close to chickpea snack mix; approved only as cooked/crisped seasoned chickpeas, not ready snack mix. |
| smoky-spiced-roasted-nuts | SAFE_NEW | APPROVED_SAFE_NEW | smoky-mutabbal-eggplant-tahini / متبل بادمجان دودی | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| quick-cucumber-pickles | SAFE_NEW | APPROVED_SAFE_NEW | mint-yogurt-drink / دوغ نعنا خانگی | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| jalapeno-popper-bites | SAFE_NEW | APPROVED_SAFE_NEW | date-cheese-and-walnut-bite / خرما و پنیر و گردو (لقمه) | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| queso-fundido-with-mushrooms-and-peppers | SAFE_NEW | APPROVED_SAFE_NEW | bread-with-dates-and-sesame / نان و خرما و کنجد | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| seven-layer-bean-dip-cups | SAFE_NEW | APPROVED_SAFE_NEW | chips-with-cheese-dip / چیپس و دیپ پنیر | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| kimchi-cheese-pancake-bites | SAFE_NEW | APPROVED_SAFE_NEW | date-cheese-and-walnut-bite / خرما و پنیر و گردو (لقمه) | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| gochujang-cucumber-cups | SIMILAR_BUT_DISTINCT | APPROVED_SAFE_NEW | korean-scallion-pajeon / پاجون پیازچه کره‌ای | از نظر فرم سرو، کاربرد میان وعده و ترکیب مزه با نزدیک ترین دستور فعلی تفاوت دارد. |
| garlic-chili-edamame | SAFE_NEW | APPROVED_DISTINCT_BUT_CLOSE | salted-edamame / ادامامه نمکی | Close to salted edamame; distinct only as cooked garlic-chili sesame snack. |
| thai-peanut-cucumber-cups | SAFE_NEW | APPROVED_SAFE_NEW | yogurt-with-peanut-butter-and-banana / ماست با کره بادام‌زمینی و موز | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| zaatar-sumac-deviled-eggs | SIMILAR_BUT_DISTINCT | APPROVED_SAFE_NEW | eggs-benedict / بندیکت تخم‌مرغ | از نظر فرم سرو، کاربرد میان وعده و ترکیب مزه با نزدیک ترین دستور فعلی تفاوت دارد. |
| herbed-cheese-ball-bites | SIMILAR_BUT_DISTINCT | APPROVED_SAFE_NEW | persian-breakfast-plate / بشقاب صبحانه پنیر و سبزی و گوجه | از نظر فرم سرو، کاربرد میان وعده و ترکیب مزه با نزدیک ترین دستور فعلی تفاوت دارد. |
| chickpea-sesame-crackers | SAFE_NEW | APPROVED_SAFE_NEW | bread-with-dates-and-sesame / نان و خرما و کنجد | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| crispy-onion-rings-with-yogurt-dip | SAFE_NEW | APPROVED_SAFE_NEW | beet-yogurt-dip / دیپ ماست و لبو (بورانی سرد) | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| eggplant-nachos-with-garlic-yogurt | SAFE_NEW | APPROVED_SAFE_NEW | yogurt-with-honey-and-cinnamon / ماست و عسل و دارچین | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| parmesan-zucchini-chips | SAFE_NEW | APPROVED_SAFE_NEW | parmesan-popcorn / پاپ‌کورن با پنیر پارمزان | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| mini-kofta-skewers-with-mint-yogurt | SAFE_NEW | APPROVED_SAFE_NEW | mint-yogurt-drink / دوغ نعنا خانگی | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| grilled-cheese-and-cherry-tomato-skewers | SIMILAR_BUT_DISTINCT | APPROVED_SAFE_NEW | cottage-cheese-with-tomato-toast / پنیر کاتیج با گوجه و نان | از نظر فرم سرو، کاربرد میان وعده و ترکیب مزه با نزدیک ترین دستور فعلی تفاوت دارد. |
| harissa-cauliflower-florets-with-lemon-yogurt | SAFE_NEW | APPROVED_SAFE_NEW | yogurt-with-honey-and-cinnamon / ماست و عسل و دارچین | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| sweet-potato-wedges-with-lemon-tahini | SIMILAR_BUT_DISTINCT | APPROVED_DISTINCT_BUT_CLOSE | french-fries / سیب زمینی سرخ کرده | Close to potato snacks, but sweet potato plus lemon tahini changes ingredient center and sauce. |
| turkish-feta-herb-borek-cigars | SAFE_NEW | APPROVED_DISTINCT_BUT_CLOSE | gozleme / گوزلمه | Close to Turkish dough/cheese items, but cigar borek format and herb-feta filling are distinct. |
| corn-scallion-fritter-bites | SAFE_NEW | APPROVED_SAFE_NEW | scallion-pancakes / کلوچهٔ پیازچه | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| lentil-kofta-lettuce-cups | SAFE_NEW | APPROVED_SAFE_NEW | adas-polo-ba-goosht / عدس‌پلو با گوشت | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| charred-broccoli-with-lemon-tahini | SAFE_NEW | APPROVED_SAFE_NEW | iced-green-tea-with-lemon / آیس چای سبز با لیمو | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| sesame-tofu-cucumber-skewers | SAFE_NEW | APPROVED_SAFE_NEW | mapo-tofu / ماپو توفو | تکرار مستقیم در عنوان/اسلاگ/ترکیب اصلی پیدا نشد. |
| herbed-cheese-stuffed-mushrooms | SIMILAR_BUT_DISTINCT | APPROVED_SAFE_NEW | morgh-shekam-por / مرغ شکم‌پر | از نظر فرم سرو، کاربرد میان وعده و ترکیب مزه با نزدیک ترین دستور فعلی تفاوت دارد. |
| sumac-pita-chips-with-garlic-yogurt | SAFE_NEW | APPROVED_DISTINCT_BUT_CLOSE | chips-with-cheese-dip / چیپس و دیپ پنیر | Close to chips-and-dip; approved only with homemade pita chips, sumac, and garlic yogurt. |
| smoky-pinto-bean-salad | RAW_POOL_REPLACEMENT | APPROVED_DISTINCT_BUT_CLOSE | corn-and-bean-salad / سالاد ذرت و لوبیا | Close to bean salad, but pinto beans, smoked pepper, lime, and cilantro must lead; it should not become corn-heavy. |
| mini-cheesy-chicken-taquitos | RAW_POOL_REPLACEMENT | APPROVED_DISTINCT_BUT_CLOSE | cheese-quesadilla / کسادیا پنیر | Close to tortilla-cheese family, but rolled crispy chicken-cheese taquitos are distinct from flat quesadilla or layered nachos. |
| caramelized-onion-yogurt-dip | RAW_POOL_REPLACEMENT | APPROVED_DISTINCT_BUT_CLOSE | beet-yogurt-dip / دیپ ماست و لبو (بورانی سرد) | Close to yogurt dips, but caramelized onion is the main sweet-savory driver and it does not overlap with beet/cucumber/spinach borani. |

## Mandatory High-Risk Decisions

- Mexican Elote Cups: rejected and replaced because mexican-street-corn-cup already covers the same snack intent.
- Olive Feta Garlic Dip: approved close only with feta-dominant base; not another zeytoon parvardeh.
- Haydari: approved close only as Turkish strained-yogurt mint/garlic dip; not borani, cacik, beet yogurt, or cucumber yogurt.
- Beet Labneh: approved close only with labneh texture, walnut and lemon; not generic beet yogurt.
- Zaatar Crispy Chickpeas: approved close only as cooked/crisped seasoned chickpeas.
- Sumac Pita Chips: approved close only with homemade pita chips and garlic yogurt.
- Chili Cheese Potato Wedges: approved close only with wedge cut and chili-cheese topping.
- Whipped feta variants: retained only where role differs: whipped sweet-spicy dip, spicy Greek spread, olive-feta dip, phyllo bite, stuffed vegetable, borek cigar.
