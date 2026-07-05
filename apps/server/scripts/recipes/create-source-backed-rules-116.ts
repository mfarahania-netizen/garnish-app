import fs from 'node:fs';
import path from 'node:path';
import { prisma } from './culinary-authenticity-sprint-common';

const sourceSprintDir = path.resolve(process.cwd(), '..', '..', 'docs', 'qa', 'recipes', 'source-backed-authenticity-116');
const packetsDir = path.join(sourceSprintDir, 'research_packets');
const queuePath = path.join(sourceSprintDir, 'review_queue_116.json');

type SourceRef = { title: string; url: string; domain: string; accessedAt: string; note: string };
type Rule = {
  recipeId: string;
  slug: string;
  titleFa: string;
  titleEn: string;
  canonicalTitle: string;
  country: string;
  region: string;
  city: string;
  requiredCoreIngredients: string[];
  optionalIngredients: string[];
  forbiddenIngredients: string[];
  suspiciousIngredients: string[];
  requiredTechniques: string[];
  forbiddenTechniques: string[];
  acceptableVariations: string[];
  mustNotDriftTo: string[];
  originConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  authenticityConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sourceRefs: SourceRef[];
  ruleStatus:
    | 'RULED_SOURCE_BACKED'
    | 'LOW_RISK_SIMPLE_RULED'
    | 'NON_COOKING_LOW_PRIORITY_RULED'
    | 'NEEDS_HUMAN_DECISION'
    | 'NEEDS_EXTERNAL_RESEARCH'
    | 'BLOCKED_BY_INGREDIENT_DICTIONARY';
  explanation: string;
};

const accessedAt = '2026-07-04';

function ensureDirs() {
  fs.mkdirSync(packetsDir, { recursive: true });
}

function domain(url: string) {
  return new URL(url).hostname.replace(/^www\./, '');
}

function ref(title: string, url: string, note: string): SourceRef {
  return { title, url, domain: domain(url), accessedAt, note };
}

const p0Rules: Record<string, Partial<Rule>> = {
  'ash-reshteh': {
    canonicalTitle: 'Ash Reshteh',
    country: 'ایران',
    requiredCoreIngredients: ['reshteh|noodle', 'beans|chickpeas|lentils|kidney', 'herbs|parsley|cilantro|dill|spinach', 'kashk'],
    optionalIngredients: ['fried onion', 'fried mint', 'garlic'],
    forbiddenIngredients: ['cream', 'mayonnaise'],
    suspiciousIngredients: ['pasta spaghetti instead of ash noodle'],
    requiredTechniques: ['simmer legumes', 'add noodles', 'finish with kashk or garnish'],
    sourceRefs: [
      ref('Ash Reshteh - Cooking With Ayeh', 'https://cookingwithayeh.com/ash-reshteh-persian-noodle-and-herb-soup/', 'Persian noodle/herb/legume soup with kashk.'),
      ref('Ash-e Reshteh - Hami Sharafi', 'https://www.hamisharafi.com/free-recipes/aashe-reshteh', 'Persian noodle, herb and bean pottage identity.'),
      ref('Ash-e Reshteh - Plant Based Persian', 'https://plantbasedpersian.com/ash-e-reshteh-persian-noodle-soup/', 'Beloved Persian noodle soup with herbs and legumes.'),
    ],
  },
  'eggplant-parmigiana': {
    canonicalTitle: 'Parmigiana di Melanzane',
    country: 'ایتالیا',
    region: 'Sicily/Campania',
    requiredCoreIngredients: ['eggplant|aubergine', 'tomato', 'mozzarella|tuma|caciocavallo|cheese', 'basil'],
    optionalIngredients: ['parmigiano|grana|pecorino', 'flour'],
    forbiddenIngredients: ['beef', 'chicken', 'cream'],
    suspiciousIngredients: ['breadcrumb-heavy American cutlet style'],
    requiredTechniques: ['salt eggplant', 'fry or bake eggplant', 'layer with tomato and cheese', 'bake'],
    sourceRefs: [
      ref('Serious Eats - Italian-Style Eggplant Parmesan', 'https://www.seriouseats.com/italian-style-eggplant-parmesan-melanzane-alla-parmigiana-recipe', 'Eggplant, tomato sauce, mozzarella, basil, layered and baked.'),
      ref('La Cucina Italiana - Eggplant Parmesan Traditional Recipe', 'https://www.lacucinaitaliana.com/italian-food/italian-dishes/eggplant-parmesan-the-traditional-recipe', 'Traditional layered eggplant/tomato/cheese technique.'),
      ref('Inside the Rustic Kitchen - Parmigiana di Melanzane', 'https://www.insidetherustickitchen.com/parmigiana-di-melanzane-aubergine-parmigana/', 'Traditional Italian eggplant parmigiana identity.'),
    ],
  },
  'baghali-ghatogh': {
    canonicalTitle: 'Baghali Ghatogh',
    country: 'ایران',
    region: 'گیلان',
    requiredCoreIngredients: ['fava|broad bean|lima', 'dill', 'garlic', 'egg'],
    optionalIngredients: ['turmeric', 'butter', 'oil'],
    forbiddenIngredients: ['meat', 'tomato paste'],
    suspiciousIngredients: ['green bean instead of fava/lima'],
    requiredTechniques: ['cook beans with dill and garlic', 'poach eggs in stew'],
    sourceRefs: [
      ref('Persian Mama - Baghali Ghatogh', 'https://persianmama.com/baghali-ghatogh-fava-beans-with-dill-eggs/', 'Northern Iranian fava beans, dill, garlic and eggs.'),
      ref('The Delicious Crescent - Baghali Ghatogh', 'https://www.thedeliciouscrescent.com/baghali-ghatogh-beans-eggs/', 'Well-known northern Iranian beans and eggs with dill.'),
      ref('DishTales - Baghali Ghatogh', 'https://dishtales.com/baghali-ghatogh/', 'Caspian provinces dish with lima/fava beans, eggs, dill and garlic.'),
    ],
  },
  'beryani-isfahan': {
    canonicalTitle: 'Beryan/Beryani Isfahan',
    country: 'ایران',
    region: 'اصفهان',
    requiredCoreIngredients: ['lamb|mutton', 'sangak|bread', 'cinnamon|saffron|mint'],
    optionalIngredients: ['sheep lung|liver', 'walnut|almond', 'onion'],
    forbiddenIngredients: ['rice as biryani base', 'chicken biryani style'],
    suspiciousIngredients: ['rice', 'basmati'],
    requiredTechniques: ['cook lamb', 'mince or grind cooked meat', 'griddle/fry patty', 'serve on bread'],
    sourceRefs: [
      ref('Isfahan Beryan - Wikipedia', 'https://en.wikipedia.org/wiki/Isfahan_beryan', 'Isfahan fried minced lamb/mutton served on bread, not rice biryani.'),
      ref('UNIQOP - Beryani Recipe', 'https://uniqop.com/beryani-recipe/', 'Isfahan beryooni identity and lamb base.'),
      ref('TasteAtlas - Isfahan dishes', 'https://www.tasteatlas.com/best-dishes-in-isfahan', 'Regional Isfahan food context.'),
    ],
  },
  'bistecca-alla-fiorentina': {
    canonicalTitle: 'Bistecca alla Fiorentina',
    country: 'ایتالیا',
    region: 'Tuscany',
    city: 'Florence',
    requiredCoreIngredients: ['t-bone|porterhouse|steak|beef'],
    optionalIngredients: ['salt', 'pepper', 'olive oil', 'rosemary'],
    forbiddenIngredients: ['sauce marinade heavy', 'cream'],
    suspiciousIngredients: ['thin steak', 'well done target'],
    requiredTechniques: ['thick steak', 'high heat grill', 'rare or medium rare rest'],
    sourceRefs: [
      ref('Visit Tuscany - Bistecca alla Fiorentina', 'https://www.visittuscany.com/en/ideas/bistecca-alla-fiorentina-legends-facts-and-a-recipe/', 'Tuscan T-bone/loin steak, thick and traditionally grilled.'),
      ref('Eataly - Bistecca Fiorentina', 'https://www.eataly.com/us_en/magazine/recipes/main-course-recipes/bistecca-fiorentina-steak', 'Traditional Florentine steak with Chianina/Tuscan identity.'),
      ref('La Cucina Italiana - Chianina steak', 'https://www.lacucinaitaliana.com/recipe/grilled-chianina-steak-sweet-amp-savory-marinade', 'Chianina/Fiorentina steak cultural context.'),
    ],
  },
  'beef-stroganoff': {
    canonicalTitle: 'Beef Stroganoff',
    country: 'روسیه',
    requiredCoreIngredients: ['beef', 'sour cream|cream|creme fraiche'],
    optionalIngredients: ['mushroom', 'onion', 'mustard', 'stock'],
    forbiddenIngredients: ['tomato-only sauce'],
    suspiciousIngredients: ['ground beef hamburger helper style'],
    requiredTechniques: ['sear beef', 'make creamy sauce', 'avoid overcooking beef'],
    sourceRefs: [
      ref('Vikalinka - Beef Stroganoff', 'https://vikalinka.com/best-beef-stroganoff/', 'Russian-style beef strips, mushrooms/onions and sour cream sauce.'),
      ref('Grantourismo - Russian Beef Stroganoff', 'https://grantourismotravels.com/russian-beef-stroganoff-recipe/', 'Historical Russian noble dish context.'),
      ref('Bon Appetit - Beef Stroganoff', 'https://www.bonappetit.com/recipe/beef-stroganoff-recipe', 'Classic beef and sour cream sauce handling.'),
    ],
  },
  'tahchin-morgh': {
    canonicalTitle: 'Tahchin Morgh',
    country: 'ایران',
    requiredCoreIngredients: ['rice', 'chicken', 'yogurt', 'saffron', 'egg'],
    optionalIngredients: ['barberry', 'butter', 'oil'],
    forbiddenIngredients: ['heavy_cream|cream_cheese', 'pasta'],
    suspiciousIngredients: ['no yogurt binder'],
    requiredTechniques: ['parboil rice', 'mix yogurt saffron egg', 'layer chicken', 'bake or steam for tahdig crust'],
    sourceRefs: [
      ref('Persian Mama - Tahchin Morgh', 'https://persianmama.com/tahchin-morgh/', 'Chicken layered with rice and rich saffron crust.'),
      ref('Unicorns in the Kitchen - Tahchin', 'https://www.unicornsinthekitchen.com/persian-savory-saffron-cake-tahchin/', 'Persian saffron rice cake with chicken.'),
      ref('Epicurious - Tachin Ba Morgh', 'https://www.epicurious.com/recipes/food/views/saffron-yogurt-cake-with-chicken-tachin-ba-morgh', 'Saffron yogurt cake with chicken from Sofreh cookbook excerpt.'),
    ],
  },
  'tortilla-espanola': {
    canonicalTitle: 'Tortilla Española / Tortilla de Patatas',
    country: 'اسپانیا',
    requiredCoreIngredients: ['egg', 'potato', 'olive oil'],
    optionalIngredients: ['onion'],
    forbiddenIngredients: ['flour tortilla', 'bread wrap'],
    suspiciousIngredients: ['cheese-heavy frittata'],
    requiredTechniques: ['slow cook potatoes in oil', 'mix with eggs', 'set omelette and flip or finish'],
    sourceRefs: [
      ref('Spanish Sabores - Tortilla de Patatas', 'https://spanishsabores.com/best-spanish-omelet-recipe/', 'Classic Spanish omelette made with eggs, potatoes and olive oil.'),
      ref('Serious Eats - Tortilla Española', 'https://www.seriouseats.com/tortilla-espanola-spanish-potato-omelette-recipe', 'Egg, potato, olive oil, optional onion and technique.'),
      ref('The Mediterranean Dish - Spanish Tortilla', 'https://www.themediterraneandish.com/spanish-tortilla-recipe/', 'Spanish tortilla identity and ingredients.'),
    ],
  },
  tiramisu: {
    canonicalTitle: 'Tiramisù',
    country: 'ایتالیا',
    requiredCoreIngredients: ['mascarpone', 'espresso|coffee', 'ladyfinger|savoiardi', 'cocoa'],
    optionalIngredients: ['egg', 'sugar', 'marsala|liqueur'],
    forbiddenIngredients: ['cream cheese'],
    suspiciousIngredients: ['cake sponge only', 'no coffee'],
    requiredTechniques: ['soak ladyfingers in coffee', 'layer mascarpone cream', 'chill', 'dust cocoa'],
    sourceRefs: [
      ref('La Cucina Italiana - Tiramisu', 'https://www.lacucinaitaliana.com/italian-food/italian-dishes/tiramisu-all-you-need-to-know-about-the-iconic-italian-dessert', 'Savoiardi, espresso, eggs/mascarpone and cocoa identity.'),
      ref('Serious Eats - Best Tiramisu', 'https://www.seriouseats.com/best-tiramisu-recipe', 'Mascarpone, whipped eggs, ladyfingers, espresso and cocoa.'),
      ref("What's Gaby Cooking - Classic Tiramisu", 'https://whatsgabycooking.com/classic-italian-tiramisu/', 'Classic Italian tiramisu ingredient identity.'),
    ],
  },
  fesenjan: {
    canonicalTitle: 'Khoresh Fesenjan',
    country: 'ایران',
    region: 'گیلان / شمال ایران',
    requiredCoreIngredients: ['walnut', 'pomegranate', 'chicken|duck|meatball'],
    optionalIngredients: ['sugar', 'onion', 'saffron'],
    forbiddenIngredients: ['cream', 'tomato-dominant sauce'],
    suspiciousIngredients: ['peanut instead walnut'],
    requiredTechniques: ['grind walnuts', 'slow simmer walnut and pomegranate sauce', 'cook protein in sauce'],
    sourceRefs: [
      ref('Persian Mama - Khoresh Fesenjan', 'https://persianmama.com/chicken-in-walnut-pomegranate-sauce-khoresht-fesenjan/', 'Common ingredients: walnuts and pomegranate concentrate, with chicken/meat variations.'),
      ref('Unicorns in the Kitchen - Fesenjan', 'https://www.unicornsinthekitchen.com/khoresht-fesenjan-persian-pomegranate-and-walnut-stew/', 'Persian walnut and pomegranate stew from northern Iran.'),
      ref('Epicurious - Pomegranate Khoresh', 'https://www.epicurious.com/recipes/food/views/pomegranate-khoresh-231918', 'Najmieh Batmanglij Persian fesenjan context.'),
    ],
  },
  'ghormeh-sabzi': {
    canonicalTitle: 'Ghormeh Sabzi',
    country: 'ایران',
    requiredCoreIngredients: ['herbs|parsley|cilantro|fenugreek', 'dried lime|limoo', 'kidney bean|bean', 'lamb|beef'],
    optionalIngredients: ['green onion', 'leek', 'spinach'],
    forbiddenIngredients: ['cream', 'tomato sauce dominant'],
    suspiciousIngredients: ['no herbs', 'no dried lime'],
    requiredTechniques: ['saute herbs', 'slow simmer meat beans dried lime'],
    sourceRefs: [
      ref('Persian Mama - Ghormeh Sabzi', 'https://persianmama.com/persian-herb-stew-ghormeh-sabzi-sabzi-ghorma/', 'Persian herb stew with herbs, beans, dried limes and beef/lamb.'),
      ref('My Persian Kitchen - Ghormeh Sabzi', 'https://www.mypersiankitchen.com/ghormeh-sabzi-persian-herb-stew/', 'Onion, garlic, meat, dried limes, beans and fresh herbs.'),
      ref('Bon Appetit - Ghormeh Sabzi', 'https://www.bonappetit.com/recipe/ghormeh-sabzi', 'Omani limes and fenugreek/herb aroma as key identity.'),
    ],
  },
  abgoosht: {
    canonicalTitle: 'Dizi / Abgoosht',
    country: 'ایران',
    requiredCoreIngredients: ['lamb|mutton|beef', 'chickpea', 'bean', 'potato', 'tomato'],
    optionalIngredients: ['dried lime', 'turmeric', 'onion'],
    forbiddenIngredients: ['rice base'],
    suspiciousIngredients: ['served as rice pilaf'],
    requiredTechniques: ['slow simmer meat and legumes', 'serve broth separately', 'mash solids'],
    sourceRefs: [
      ref('Turmeric & Saffron - Dizi', 'https://turmericsaffron.blogspot.com/2013/02/dizi-traditional-iranian-lamb-chickpea.html', 'Traditional two-part serving: broth and mashed lamb/chickpea/potato/tomato solids.'),
      ref('Unicorns in the Kitchen - Abgoosht', 'https://www.unicornsinthekitchen.com/abgoosht-recipe/', 'Classic Persian stew with lamb, potatoes, chickpeas, white beans.'),
      ref('Persian Mama - Abgoosht', 'https://persianmama.com/abgoosht-persian-short-ribs-vegetable-stew/', 'Rustic stew with lamb/beef and chickpeas.'),
    ],
  },
  'zereshk-polo-ba-morgh': {
    canonicalTitle: 'Zereshk Polo ba Morgh',
    country: 'ایران',
    requiredCoreIngredients: ['rice', 'barberry|zereshk', 'chicken', 'saffron'],
    optionalIngredients: ['sugar', 'butter', 'tomato paste'],
    forbiddenIngredients: ['cranberry as main without note'],
    suspiciousIngredients: ['no barberry'],
    requiredTechniques: ['steam rice', 'sweet-sour barberries', 'braise or roast saffron chicken'],
    sourceRefs: [
      ref('Saffron and Herbs - Zereshk Polo ba Morgh', 'https://saffronandherbs.com/2021/01/29/zereshk-polo-ba-morgh/', 'Steamed rice with sweetened barberries and saffron chicken.'),
      ref('Cooking With Ayeh - Zereshk Polo', 'https://cookingwithayeh.com/zereshk-polo-persian-barberry-rice/', 'Barberries, basmati rice and saffron as the core rice identity.'),
      ref('Food52 - Barberry Rice with Saffron Chicken', 'https://food52.com/recipes/93292-barberry-rice-with-saffron-chicken-zereshk-polo-ba-morgh', 'Barberry rice and saffron chicken format.'),
    ],
  },
  'french-onion-soup': {
    canonicalTitle: 'Soupe à l’Oignon Gratinée',
    country: 'فرانسه',
    requiredCoreIngredients: ['onion', 'stock|broth', 'bread|baguette', 'gruyere|cheese'],
    optionalIngredients: ['wine|sherry', 'thyme', 'butter'],
    forbiddenIngredients: ['cream soup base'],
    suspiciousIngredients: ['raw onion shortcut'],
    requiredTechniques: ['slow cook or caramelize onions', 'simmer with stock', 'gratinate bread and cheese'],
    sourceRefs: [
      ref('Serious Eats - French Onion Soup', 'https://www.seriouseats.com/french-onion-soup-recipe', 'Onions, stock, bread, cheese and gratinée technique.'),
      ref('Tasting History - French Onion Soup from 1651', 'https://www.tastinghistory.com/episodes/frenchonionsoup', 'Historical onion soup context.'),
      ref('Food.com - Julia Child French Onion Soup', 'https://www.food.com/recipe/authentic-french-onion-soup-courtesy-of-julia-child-356428', 'Classic onion soup formula with stock, wine, bread and cheese.'),
    ],
  },
  'pasta-all-arrabbiata': {
    canonicalTitle: 'Pasta all’Arrabbiata',
    country: 'ایتالیا',
    region: 'Rome/Lazio',
    requiredCoreIngredients: ['pasta|penne', 'tomato', 'garlic', 'chili|pepper'],
    optionalIngredients: ['parsley', 'pecorino'],
    forbiddenIngredients: ['cream'],
    suspiciousIngredients: ['meat ragu'],
    requiredTechniques: ['make spicy tomato garlic sauce', 'toss pasta with sauce'],
    sourceRefs: [
      ref('Ciao Florentina - Arrabbiata Sauce', 'https://ciaoflorentina.com/arrabiata-sauce/', 'Classic spicy tomato sauce with garlic and red pepper.'),
      ref('The Mediterranean Dish - Penne Arrabbiata', 'https://www.themediterraneandish.com/penne-arrabbiata/', 'Penne arrabbiata identity and spicy tomato base.'),
      ref('RecipeTin Eats - Penne Arrabbiata', 'https://www.recipetineats.com/penne-all-arrabbiata-spicy-tomato-pasta/', 'Spicy tomato pasta technique and chile heat.'),
    ],
  },
  'pasta-alla-norma': {
    canonicalTitle: 'Pasta alla Norma',
    country: 'ایتالیا',
    region: 'Sicily',
    requiredCoreIngredients: ['pasta', 'eggplant|aubergine', 'tomato', 'ricotta salata|cheese', 'basil'],
    optionalIngredients: ['garlic', 'olive oil'],
    forbiddenIngredients: ['cream', 'meat ragu'],
    suspiciousIngredients: ['no eggplant', 'no tomato'],
    requiredTechniques: ['fry or roast eggplant', 'make tomato sauce', 'finish with ricotta salata and basil'],
    sourceRefs: [
      ref('Serious Eats - Pasta alla Norma', 'https://www.seriouseats.com/sicilian-style-pasta-with-eggplant-tomatoes-ricotta-salata-pasta-alla-norma-recipe', 'Sicilian pasta with eggplant, tomato, ricotta salata.'),
      ref('La Cucina Italiana - Pasta alla Norma', 'https://www.lacucinaitaliana.com/italian-food/how-to-cook/pasta-alla-norma-watch-video-recipe', 'Classic Sicilian dish with tomato sauce, fried eggplant and seasoned sheep ricotta.'),
      ref('The Mediterranean Dish - Pasta alla Norma', 'https://www.themediterraneandish.com/pasta-alla-norma/', 'Pasta, eggplant, tomato sauce, ricotta salata, basil and olive oil.'),
    ],
  },
  paella: {
    canonicalTitle: 'Paella / Paella Valenciana family',
    country: 'اسپانیا',
    region: 'Valencia',
    requiredCoreIngredients: ['rice', 'saffron', 'stock|broth|عصاره|آب مرغ'],
    optionalIngredients: ['chicken', 'rabbit', 'seafood', 'snail', 'green beans', 'tomato', 'rosemary'],
    forbiddenIngredients: ['chorizo'],
    suspiciousIngredients: ['seafood-only if titled Valencian', 'generic risotto technique'],
    requiredTechniques: ['cook rice in paella pan', 'develop socarrat', 'do not stir after stock settles'],
    sourceRefs: [
      ref('La Tienda - Authentic Valencian Paella', 'https://www.tienda.com/learn-about-spain/the-secrets-of-authentic-valencian-paella', 'Valencian paella identity with chicken/rabbit, beans, saffron and rice.'),
      ref('José Andrés - What’s in a real paella', 'https://joseandres.substack.com/p/whats-in-a-real-paella', 'Valencian origin; chicken/rabbit, saffron, beans, tomatoes; no chorizo.'),
      ref('Food & Wine - Paella tips from Valencian chef', 'https://www.foodandwine.com/cooking-techniques/paella-tips-danny-lledo', 'Rice, stock and socarrat technique from Valencian chef context.'),
    ],
  },
  'chelo-kabab-koobideh': {
    canonicalTitle: 'Chelo Kabab Koobideh',
    country: 'ایران',
    requiredCoreIngredients: ['ground beef|ground lamb|minced meat', 'onion', 'rice'],
    optionalIngredients: ['sumac', 'saffron', 'grilled tomato'],
    forbiddenIngredients: ['egg binder dominant', 'bread crumbs dominant'],
    suspiciousIngredients: ['pan-fried meatball instead skewer'],
    requiredTechniques: ['drain grated onion', 'knead ground meat', 'shape on skewers', 'grill over heat', 'serve with chelo'],
    sourceRefs: [
      ref('Persian Mama - Kabob Koobideh', 'https://persianmama.com/kabob-koobideh-grilled-minced-meat-kabobs/', 'Ground lamb/beef mixture grilled over coals and served as popular Iranian kabab.'),
      ref('Hami Sharafi - Kabab Koobideh', 'https://www.hamisharafi.com/free-recipes/kabab-koobideh', 'Ground lamb/beef, rice or bread, grilled tomatoes and sumac.'),
      ref('Unicorns in the Kitchen - Kabob Koobideh', 'https://www.unicornsinthekitchen.com/kabob-koobideh-recipe/', 'Meat/onion/fat consistency and grilled skewers.'),
    ],
  },
  'koofteh-tabrizi': {
    canonicalTitle: 'Koofteh Tabrizi',
    country: 'ایران',
    region: 'تبریز',
    requiredCoreIngredients: ['ground beef|meat', 'rice', 'split pea', 'herbs|sabzi|tarragon|savory|ترخون|مرزه', 'egg'],
    optionalIngredients: ['prune', 'walnut', 'barberry', 'fried onion'],
    forbiddenIngredients: ['bread crumb dominant'],
    suspiciousIngredients: ['small generic meatballs'],
    requiredTechniques: ['make large stuffed meatball', 'simmer in tomato/onion sauce'],
    sourceRefs: [
      ref('Persian Mama - Koofteh Tabrizi', 'https://persianmama.com/koofteh-tabrizi/', 'Ground beef, split peas, rice/bulgur, egg/spices, large meatball technique.'),
      ref('My Persian Kitchen - Koofteh Tabrizi', 'https://www.mypersiankitchen.com/koofteh-tabrizi/', 'Ground beef, rice, split peas, onion, herbs/spices.'),
      ref('Cooking with Zahra - Koofteh Tabrizi', 'https://cookingwithzahra.com/https-cookingwithzahra-com-2020-03-koofteh-tabrizi/', 'Tabriz origin, meat/herb/pulse mixture, stuffed with prunes/walnuts/fried onions.'),
    ],
  },
};

function mdCell(value: unknown) {
  return String(value ?? '').replace(/\|/g, '/');
}

function packetMarkdown(rule: Rule) {
  return `# ${rule.titleFa} - Research Packet

- recipeId: ${rule.recipeId}
- slug: ${rule.slug}
- ruleStatus: ${rule.ruleStatus}
- confidence: ${rule.authenticityConfidence}
- country: ${rule.country}
- region: ${rule.region}
- city: ${rule.city}

## Canonical Identity

${rule.canonicalTitle}

## Required Core Ingredients

${rule.requiredCoreIngredients.map((x) => `- ${x}`).join('\n') || '- n/a'}

## Forbidden Or Suspicious Ingredients

${[...rule.forbiddenIngredients, ...rule.suspiciousIngredients].map((x) => `- ${x}`).join('\n') || '- n/a'}

## Canonical Technique

${rule.requiredTechniques.map((x) => `- ${x}`).join('\n') || '- n/a'}

## Acceptable Variations

${rule.acceptableVariations.map((x) => `- ${x}`).join('\n') || '- n/a'}

## Sources

${rule.sourceRefs.map((s) => `- [${s.title}](${s.url}) - ${s.note}`).join('\n') || '- No sourceRefs: this packet is deferred and must not be patched.'}
`;
}

async function main() {
  ensureDirs();
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8')).rows;
  if (queue.length !== 116) throw new Error(`EXPECTED_QUEUE_116_FOUND_${queue.length}`);
  const recipes = await prisma.recipe.findMany({
    where: { id: { in: queue.map((r: any) => r.recipeId) } },
    include: { ingredients: { include: { ingredient: true }, orderBy: { order: 'asc' } }, steps: { orderBy: { order: 'asc' } } },
  });
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const rules: Rule[] = queue.map((row: any) => {
    const base = p0Rules[row.slug];
    if (base) {
      return {
        recipeId: row.recipeId,
        slug: row.slug,
        titleFa: row.titleFa,
        titleEn: row.titleEn,
        canonicalTitle: base.canonicalTitle ?? row.titleEn,
        country: base.country ?? row.country,
        region: base.region ?? row.cityRegion ?? '',
        city: base.city ?? '',
        requiredCoreIngredients: base.requiredCoreIngredients ?? [],
        optionalIngredients: base.optionalIngredients ?? [],
        forbiddenIngredients: base.forbiddenIngredients ?? [],
        suspiciousIngredients: base.suspiciousIngredients ?? [],
        requiredTechniques: base.requiredTechniques ?? [],
        forbiddenTechniques: base.forbiddenTechniques ?? [],
        acceptableVariations: base.acceptableVariations ?? ['regional and household variation accepted if core identity remains intact'],
        mustNotDriftTo: base.mustNotDriftTo ?? [...(base.forbiddenIngredients ?? []), ...(base.suspiciousIngredients ?? [])],
        originConfidence: base.originConfidence ?? 'HIGH',
        authenticityConfidence: base.authenticityConfidence ?? 'HIGH',
        sourceRefs: base.sourceRefs ?? [],
        ruleStatus: 'RULED_SOURCE_BACKED',
        explanation: 'P0 canonical high-risk recipe received a source-backed rule.',
      };
    }
    if (row.priority === 'P3_SIMPLE_OR_NON_COOKING') {
      return {
        recipeId: row.recipeId,
        slug: row.slug,
        titleFa: row.titleFa,
        titleEn: row.titleEn,
        canonicalTitle: row.titleEn,
        country: row.country,
        region: row.cityRegion,
        city: '',
        requiredCoreIngredients: [],
        optionalIngredients: [],
        forbiddenIngredients: [],
        suspiciousIngredients: [],
        requiredTechniques: [],
        forbiddenTechniques: [],
        acceptableVariations: ['simple/non-cooking item; authenticity risk is lower than cooked canonical dishes'],
        mustNotDriftTo: [],
        originConfidence: 'LOW',
        authenticityConfidence: 'MEDIUM',
        sourceRefs: [],
        ruleStatus: 'LOW_RISK_SIMPLE_RULED',
        explanation: 'Classified as low-risk simple/non-cooking for this sprint; no patch permitted from this rule alone.',
      };
    }
    return {
      recipeId: row.recipeId,
      slug: row.slug,
      titleFa: row.titleFa,
      titleEn: row.titleEn,
      canonicalTitle: row.titleEn,
      country: row.country,
      region: row.cityRegion,
      city: '',
      requiredCoreIngredients: [],
      optionalIngredients: [],
      forbiddenIngredients: [],
      suspiciousIngredients: [],
      requiredTechniques: [],
      forbiddenTechniques: [],
      acceptableVariations: [],
      mustNotDriftTo: [],
      originConfidence: 'LOW',
      authenticityConfidence: 'LOW',
      sourceRefs: [],
      ruleStatus: row.priority === 'P1_FAMOUS_REGIONAL' ? 'NEEDS_EXTERNAL_RESEARCH' : 'NEEDS_HUMAN_DECISION',
      explanation:
        row.priority === 'P1_FAMOUS_REGIONAL'
          ? 'Famous/regional recipe still requires three independent reputable sources before any authenticity pass or patch.'
          : 'Cooked recipe requires source review; no safe patch generated in this pass.',
    };
  });

  for (const rule of rules) {
    fs.writeFileSync(path.join(packetsDir, `${rule.slug}.md`), packetMarkdown(rule), 'utf8');
  }
  fs.writeFileSync(path.join(sourceSprintDir, 'source_backed_rules_116.json'), JSON.stringify({ generatedAt: new Date().toISOString(), count: rules.length, rules }, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(sourceSprintDir, 'source_backed_rules_116.md'),
    `# Source-Backed Rules 116

| # | Status | Title | Slug | Sources |
|---:|---|---|---|---:|
${rules.map((rule, index) => `| ${index + 1} | ${rule.ruleStatus} | ${mdCell(rule.titleFa)} | ${rule.slug} | ${rule.sourceRefs.length} |`).join('\n')}
`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(sourceSprintDir, 'research_packet_index.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: rules.length,
        packets: rules.map((rule) => ({
          recipeId: rule.recipeId,
          slug: rule.slug,
          titleFa: rule.titleFa,
          ruleStatus: rule.ruleStatus,
          sourceCount: rule.sourceRefs.length,
          packetPath: `docs/qa/recipes/source-backed-authenticity-116/research_packets/${rule.slug}.md`,
        })),
      },
      null,
      2,
    ),
    'utf8',
  );
  fs.writeFileSync(
    path.join(sourceSprintDir, 'research_packet_index.md'),
    `# Research Packet Index

| # | Status | Title | Slug | Source Count | Packet |
|---:|---|---|---|---:|---|
${rules
  .map(
    (rule, index) =>
      `| ${index + 1} | ${rule.ruleStatus} | ${mdCell(rule.titleFa)} | ${rule.slug} | ${rule.sourceRefs.length} | research_packets/${rule.slug}.md |`,
  )
  .join('\n')}
`,
    'utf8',
  );
  const counts = rules.reduce((acc: Record<string, number>, rule) => {
    acc[rule.ruleStatus] = (acc[rule.ruleStatus] ?? 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({ ok: true, count: rules.length, counts }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
