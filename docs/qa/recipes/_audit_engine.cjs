/*
 * AUDIT ONLY engine for Garnish non-lite recipe completeness audit.
 * Reads /tmp/garnish_audit_snapshot.json (read-only DB snapshot of 493 non-lite recipes).
 * Writes NO data to the DB. Writes only audit output files under docs/qa/recipes/.
 *
 * Implements Steps 3-5 of the audit spec: section scoring, blocker-phrase detection,
 * and classification into COMPLETE_DO_NOT_TOUCH / NEEDS_FULL_GRIS_REPAIR / REVIEW_REQUIRED.
 */
'use strict';
const fs = require('fs');

const SNAPSHOT = '/tmp/garnish_audit_snapshot.json';
const recipes = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));

// ---- Helpers ----
function parseArr(x) {
  if (x === null || x === undefined) return [];
  if (Array.isArray(x)) return x;
  if (typeof x === 'string') { try { const j = JSON.parse(x); return Array.isArray(j) ? j : []; } catch (e) { return []; } }
  return [];
}
function faText(obj) {
  // Pull Persian text out of {fa:..,en:..} or a string
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object') {
    if (typeof obj.fa === 'string') return obj.fa;
    if (typeof obj.text === 'string') return obj.text;
    return Object.values(obj).filter(v => typeof v === 'string').join(' ');
  }
  return String(obj);
}
function textLen(s) { s = s == null ? '' : String(s); return s.replace(/\s+/g, '').length; }
function flattenStrings(node, acc) {
  // Recursively collect all string values from a GRIS section node.
  acc = acc || [];
  if (node == null) return acc;
  if (typeof node === 'string') { acc.push(node); return acc; }
  if (typeof node === 'number') { acc.push(String(node)); return acc; }
  if (Array.isArray(node)) { for (const n of node) flattenStrings(n, acc); return acc; }
  if (typeof node === 'object') {
    for (const v of Object.values(node)) flattenStrings(v, acc);
  }
  return acc;
}
function arrItems(node) {
  // Normalise a GRIS section that should be an array of items.
  // Some sections are arrays of objects {point,explanation} or arrays of strings.
  if (Array.isArray(node)) return node;
  return node == null ? [] : [node];
}
function itemText(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object') {
    if (typeof item.fa === 'string') return item.fa;
    return Object.values(item).filter(v => typeof v === 'string' || typeof v === 'number').map(String).join(' ');
  }
  return String(item);
}

// ---- Blocker phrases (Step 4) ----
const BLOCKER_PHRASES = [
  'کنترل حرارت، بافت را حفظ می‌کند',
  'وقتی حرارت با نوع ماده هماهنگ باشد، غذا خشک یا آبکی نمی‌شود',
  'استراحت کوتاه بعد از پخت، مزه را متعادل می‌کند',
  'چند دقیقه مکث کمک می‌کند آب و چربی دوباره در بافت غذا پخش شود',
  'کنترل حرارت',
  'تشخیص نشانه پایان پخت',
  'تنظیم مزه نهایی',
  'قبل از سرو بچشید و نمک یا اسید را تنظیم کنید',
  'ماده اصلی را اضافه کنید',
  'با توجه به نوع غذا',
  'طبق شخصیت غذا',
  'پایه چربی',
  'بپزید تا آماده شود',
  'مواد را آماده کنید',
  'در پایان تنظیم کنید',
];
const INTERNAL_TERMS = ['ingredientId','code','database','import','Codex','GRIS','source-backed','nutrition engine','fdcId'];
// Display-leak term variants. NOTE: bare "USDA" is intentionally NOT a blocker — it appears legitimately
// as a food-safety citation (e.g. "USDA FSIS: chicken to 74°C"). We only flag fdcId and the Persian
// "موتور قفل‌شده" / "قفل‌شده به منبع" nutrition-engine phrasing, which are real internal leaks.
const INTERNAL_TERMS_FA = ['ingredientId','fdcId','GRIS','Codex','nutrition engine','source-backed','موتور قفل‌شده','قفل‌شده به منبع'];

// ---- Source group + cuisine ----
function sourceGroup(id) {
  if (id.startsWith('garnish_recipe_fa_')) return 'Phase One';
  if (id.startsWith('garnish_recipe_intl_')) return 'International Core';
  if (id.startsWith('garnish_recipe_global_143')) return 'Global 143';
  return 'Other/Unknown';
}
function cuisineOrigin(r) {
  // region field is the most reliable signal
  const reg = (r.region || '').toLowerCase();
  if (reg === 'persian' || reg === 'iranian' || reg === 'iran') return 'Iranian';
  if (r.id.startsWith('garnish_recipe_fa_')) {
    // Phase One is the Iranian-authored set; but some may be foreign-origin. Default Iranian unless region says otherwise.
    if (reg && reg !== 'persian' && reg !== 'iranian') return 'Foreign';
    return 'Iranian';
  }
  if (r.id.startsWith('garnish_recipe_global_143') || r.id.startsWith('garnish_recipe_intl_')) {
    // These are deliberately international; a few have region 'persian' (Iranian dishes re-authored).
    if (reg === 'persian' || reg === 'iranian') return 'Iranian';
    return 'Foreign';
  }
  return 'Unknown';
}

// ---- Section extractors (prefer GRIS; fall back to flat fields) ----
function getStory(r) {
  if (r.gris && r.gris.story) return faText(r.gris.story.origin || r.gris.story.hook || r.gris.story) || (r.description || '');
  return r.description || '';
}
function getGlance(r) {
  if (r.gris && r.gris.glance) return r.gris.glance;
  return null;
}
function getWhyItWorks(r) {
  if (r.gris && r.gris.whyItWorks) return arrItems(r.gris.whyItWorks);
  return [];
}
function getSkills(r) {
  if (r.gris && r.gris.skillsLearned) return arrItems(r.gris.skillsLearned);
  return [];
}
function getFinish(r) {
  if (r.gris && r.gris.finish) return r.gris.finish;
  return null;
}
function getTroubleshooting(r) {
  if (r.gris && r.gris.troubleshooting) return arrItems(r.gris.troubleshooting);
  // flat fallback: commonMistakes is the closest analog
  return parseArr(r.commonMistakes);
}
function getVariations(r) {
  if (r.gris && r.gris.variations) return arrItems(r.gris.variations);
  return parseArr(r.substitutions);
}
function getKeep(r) {
  if (r.gris && r.gris.keep) return r.gris.keep;
  return null;
}
function getServeWith(r) {
  if (r.gris && r.gris.serveWith) return arrItems(r.gris.serveWith);
  return parseArr(r.servingSuggestions);
}
function getFaq(r) {
  if (r.gris && r.gris.faq) return arrItems(r.gris.faq);
  return parseArr(r.faq);
}
function getNourishment(r) {
  if (r.gris && r.gris.nourishment) return r.gris.nourishment;
  return null;
}
function getGrisSteps(r) {
  if (r.gris && r.gris.steps) return arrItems(r.gris.steps);
  return [];
}
function getGrisIngredients(r) {
  if (r.gris && r.gris.ingredients) return arrItems(r.gris.ingredients);
  return [];
}

// ---- Scoring (Step 5 weights) ----
const WEIGHTS = { story:8, glance:8, ingredients:15, whyItWorks:15, skills:8, steps:18, finish:6, troubleshooting:10, variations:4, keep:4, serveWith:2, faq:2 };

function scoreSection(quality) {
  // quality is a 0..1 scalar estimating how complete/dish-specific the section is.
  return Math.max(0, Math.min(1, quality));
}

function evaluateRecipe(r) {
  const result = {
    failedSections: [],
    blockers: [],
    weakExamples: [],
    sectionScores: {},
  };

  // ----- STORY (8) -----
  const story = getStory(r);
  const storyLen = textLen(story);
  let storyQ = 0;
  if (storyLen >= 120) storyQ = 1;
  else if (storyLen >= 60) storyQ = 0.6;
  else if (storyLen >= 25) storyQ = 0.3;
  else storyQ = 0;
  if (storyLen < 25) result.failedSections.push('story');
  result.sectionScores.story = Math.round(WEIGHTS.story * storyQ);

  // ----- GLANCE (8) -----
  const glance = getGlance(r);
  let glanceQ = 0;
  if (glance) {
    const promise = faText(glance.promise || glance.appearance || glance.look);
    const desc = faText(glance.description || glance.appearance || '');
    const combined = promise || desc;
    if (textLen(combined) >= 20) glanceQ = 1;
    else if (textLen(combined) >= 8) glanceQ = 0.5;
  }
  if (glanceQ === 0) result.failedSections.push('glance');
  result.sectionScores.glance = Math.round(WEIGHTS.glance * glanceQ);

  // ----- INGREDIENTS (15) -----
  // Prefer GRIS ingredients (rich: name+amount+role+tip+swap). Fall back to flat relation ingredients.
  const grisIng = getGrisIngredients(r);
  let ingQ = 0;
  if (grisIng.length > 0) {
    // Measure richness: each ingredient ideally has amount + a note/role.
    let rich = 0;
    for (const it of grisIng) {
      const flat = flattenStrings(it).join(' ');
      const hasAmount = /(\d|به|μ|ml|g|کilo|ق|گرم|عدد|قاشق|لیوان|پیمانه|فنجان|بشقاب|قوطی|بسته|حبه|پیمانه)/.test(flat) || (it && (it.amount || it.unit || it.quantity));
      const hasNote = textLen(it && (it.note||it.role||it.tip||it.swap||it.prep||it.buyingTip)) > 0 || (it && typeof it === 'object' && Object.keys(it).length >= 3);
      if (hasAmount && hasNote) rich++;
    }
    const ratio = grisIng.length >= 4 ? (rich / grisIng.length) : (grisIng.length / 4) * 0.5;
    ingQ = Math.min(1, ratio);
    if (grisIng.length < 4) result.failedSections.push('ingredients');
  } else {
    // flat fallback
    const flatIng = r.ingredients || [];
    const ratio = Math.min(1, flatIng.length / 8);
    ingQ = ratio * 0.55; // flat ingredients are inherently less rich
    if (flatIng.length < 3) result.failedSections.push('ingredients');
  }
  result.sectionScores.ingredients = Math.round(WEIGHTS.ingredients * ingQ);

  // ----- WHY IT WORKS / SCIENCE (15) -----
  const why = getWhyItWorks(r);
  let whyQ = 0;
  if (why.length >= 4) {
    // each should have a real explanation, not just a label
    let substantive = 0;
    for (const w of why) {
      const expl = itemText(w.explanation || w.point || w);
      if (textLen(expl) >= 25) substantive++;
    }
    whyQ = Math.min(1, substantive / why.length);
  } else if (why.length > 0) {
    whyQ = 0.2;
    result.failedSections.push('whyItWorks');
  } else {
    result.failedSections.push('whyItWorks');
  }
  if (why.length < 4 && why.length > 0) {
    // still acceptable if >=4 not met but flagged
    if (!result.failedSections.includes('whyItWorks')) result.failedSections.push('whyItWorks');
  }
  result.sectionScores.whyItWorks = Math.round(WEIGHTS.whyItWorks * whyQ);

  // ----- SKILLS (8) -----
  const skills = getSkills(r);
  let skillsQ = 0;
  // detect generic skill phrases
  const GENERIC_SKILLS = ['کنترل حرارت','تنظیم مزه نهایی','تشخیص نشانه پایان پخت','مدیریت زمان','تنظیم حرارت','کنترل شعله'];
  let realSkills = 0;
  for (const s of skills) {
    const t = faText(s);
    if (textLen(t) < 4) continue;
    if (GENERIC_SKILLS.some(g => t.includes(g))) continue;
    realSkills++;
  }
  if (realSkills >= 4) skillsQ = 1;
  else if (realSkills >= 2) skillsQ = 0.5;
  else if (realSkills >= 1) skillsQ = 0.25;
  if (realSkills < 4) { if (!result.failedSections.includes('skills')) result.failedSections.push('skills'); }
  result.sectionScores.skills = Math.round(WEIGHTS.skills * skillsQ);

  // ----- STEPS (18) -----
  const grisSteps = getGrisSteps(r);
  let stepsQ = 0;
  let stepSource = 'none';
  if (grisSteps.length > 0) {
    stepSource = 'gris';
    // each gris step should carry concrete action/cue
    let concrete = 0;
    for (const st of grisSteps) {
      const t = faText(st.instruction || st.text || st.action || st);
      if (textLen(t) >= 30) concrete++;
    }
    if (grisSteps.length >= 5) stepsQ = Math.min(1, concrete / grisSteps.length);
    else stepsQ = Math.min(0.6, (concrete / 5));
  } else {
    // flat steps relation
    const flatSteps = r.steps || [];
    stepSource = 'flat';
    let concrete = 0;
    for (const st of flatSteps) {
      const t = faText(st.instruction || st);
      if (textLen(t) >= 30) concrete++;
    }
    if (flatSteps.length >= 5) stepsQ = Math.min(0.85, (concrete / flatSteps.length) * 0.85);
    else stepsQ = Math.min(0.5, (concrete / 5) * 0.7);
  }
  if (stepsQ < 0.6) { if (!result.failedSections.includes('steps')) result.failedSections.push('steps'); }
  result.sectionScores.steps = Math.round(WEIGHTS.steps * stepsQ);

  // ----- FINISH / CHEF SECRET (6) -----
  const finish = getFinish(r);
  let finishQ = 0;
  if (finish) {
    const secret = faText(finish.chefSecret || finish.secret || '');
    const serving = faText(finish.serving || finish.serve || '');
    if (textLen(secret) >= 15 && textLen(serving) >= 8) finishQ = 1;
    else if (textLen(secret) >= 15 || textLen(serving) >= 8) finishQ = 0.5;
    else if (textLen(secret) + textLen(serving) >= 8) finishQ = 0.3;
  }
  if (finishQ === 0) result.failedSections.push('finish');
  result.sectionScores.finish = Math.round(WEIGHTS.finish * finishQ);

  // ----- TROUBLESHOOTING (10) -----
  const ts = getTroubleshooting(r);
  let tsQ = 0;
  let tsProblems = 0;
  let arrowOnly = 0, empty = 0;
  for (const t of ts) {
    // combine problem + fix (or cause/solution) so a short problem label paired with a real fix counts as substantive
    const problemTxt = faText(typeof t === 'string' ? '' : (t.problem || t.issue || t.cause || ''));
    const fixTxt = faText(typeof t === 'string' ? '' : (t.fix || t.solution || t.solutionText || ''));
    const bodyTxt = faText(typeof t === 'string' ? t : (t.text || flattenStrings(t).join(' ')));
    const txt = [problemTxt, fixTxt, bodyTxt].filter(Boolean).join(' ');
    if (textLen(txt) < 3) { empty++; continue; }
    // arrow-only item: just "←" or starts with arrow and nothing else meaningful
    const stripped = txt.replace(/←/g,'').trim();
    if (textLen(stripped) < 3) { arrowOnly++; continue; }
    // substantive = combined problem+fix length >= 20 (real cause+fix)
    if (textLen(txt) >= 20) tsProblems++;
  }
  if (ts.length >= 4 && tsProblems >= 4) tsQ = 1;
  else if (tsProblems >= 4 && ts.length >= 3) tsQ = 0.7;
  else if (tsProblems >= 2) tsQ = 0.4;
  else tsQ = Math.min(0.3, tsProblems * 0.1);
  if (ts.length < 4 || tsProblems < 4) { if (!result.failedSections.includes('troubleshooting')) result.failedSections.push('troubleshooting'); }
  if (arrowOnly > 0) result.blockers.push('arrow-only troubleshooting item');
  if (empty > 0) result.blockers.push('empty troubleshooting item');
  result.sectionScores.troubleshooting = Math.round(WEIGHTS.troubleshooting * tsQ);

  // ----- VARIATIONS (4) -----
  const variations = getVariations(r);
  let varQ = 0;
  let realVars = 0;
  for (const v of variations) { if (textLen(faText(v)) >= 8) realVars++; }
  if (realVars >= 2) varQ = 1;
  else if (realVars >= 1) varQ = 0.5;
  if (realVars < 2) { if (!result.failedSections.includes('variations')) result.failedSections.push('variations'); }
  result.sectionScores.variations = Math.round(WEIGHTS.variations * varQ);

  // ----- KEEP / STORAGE (4) -----
  const keep = getKeep(r);
  let keepQ = 0;
  if (keep) {
    const flat = flattenStrings(keep).join(' ');
    if (textLen(flat) >= 20) keepQ = 1;
    else if (textLen(flat) >= 8) keepQ = 0.5;
  }
  if (keepQ === 0) result.failedSections.push('keep/storage');
  result.sectionScores.keep = Math.round(WEIGHTS.keep * keepQ);

  // ----- SERVE WITH (2) -----
  const sw = getServeWith(r);
  let swQ = 0;
  let realSw = 0;
  for (const s of sw) { if (textLen(faText(s)) >= 4) realSw++; }
  if (realSw >= 1) swQ = 1;
  result.sectionScores.serveWith = Math.round(WEIGHTS.serveWith * swQ);
  if (swQ === 0) { if (!result.failedSections.includes('serveWith')) result.failedSections.push('serveWith'); }

  // ----- FAQ (2) -----
  const faq = getFaq(r);
  let faqQ = 0;
  let realFaq = 0;
  for (const f of faq) {
    const q = faText(f.question || f.q || (typeof f === 'string' ? f : ''));
    const a = faText(f.answer || f.a || (typeof f === 'object' ? flattenStrings(f).join(' ') : ''));
    if (textLen(q) >= 6 && textLen(a) >= 10) realFaq++;
  }
  if (realFaq >= 4) faqQ = 1;
  else if (realFaq >= 2) faqQ = 0.5;
  else if (realFaq >= 1) faqQ = 0.25;
  if (realFaq < 4) { if (!result.failedSections.includes('faq')) result.failedSections.push('faq'); }
  result.sectionScores.faq = Math.round(WEIGHTS.faq * faqQ);

  // total score
  const total = Object.values(result.sectionScores).reduce((a,b)=>a+b,0);
  result.score = total;

  // ----- Blocker phrase scan across all user-facing text -----
  const allTextParts = [];
  allTextParts.push(faText(story));
  allTextParts.push(...flattenStrings(glance));
  allTextParts.push(...flattenStrings(getWhyItWorks(r)));
  allTextParts.push(...flattenStrings(getSkills(r)));
  allTextParts.push(...flattenStrings(finish));
  allTextParts.push(...flattenStrings(ts));
  allTextParts.push(...flattenStrings(getVariations(r)));
  allTextParts.push(...flattenStrings(keep));
  allTextParts.push(...flattenStrings(getServeWith(r)));
  allTextParts.push(...flattenStrings(getFaq(r)));
  allTextParts.push(...flattenStrings(getNourishment(r)));
  for (const st of grisSteps) allTextParts.push(...flattenStrings(st));
  const allText = allTextParts.join('  ');
  const blockerHits = {};
  for (const phrase of BLOCKER_PHRASES) {
    if (allText.includes(phrase)) {
      blockerHits[phrase] = (blockerHits[phrase] || 0) + 1;
      if (!result.blockers.includes('generic phrase: ' + phrase)) result.blockers.push('generic phrase: ' + phrase);
    }
  }
  // internal term leak
  for (const term of INTERNAL_TERMS_FA) {
    const re = new RegExp(term, 'i');
    if (re.test(allText)) {
      if (!result.blockers.includes('internal term leak: ' + term)) result.blockers.push('internal term leak: ' + term);
    }
  }
  // store weak examples (first 4 blocker hits as snippets)
  for (const phrase of Object.keys(blockerHits).slice(0,4)) {
    const idx = allText.indexOf(phrase);
    if (idx >= 0) result.weakExamples.push(allText.slice(Math.max(0,idx-15), idx+phrase.length+15).trim());
  }

  return result;
}

// ---- Run evaluation ----
const evaluated = recipes.map(r => {
  const ev = evaluateRecipe(r);
  return { recipe: r, eval: ev };
});

// ---- Classification ----
const complete = [], needsRepair = [], review = [];
for (const { recipe: r, eval: ev } of evaluated) {
  const sg = sourceGroup(r.id);
  const co = cuisineOrigin(r);
  const hasGris = !!r.gris;
  // major blocker = structural (arrow-only/empty troubleshooting) OR >=3 generic phrase hits OR internal leak.
  // BUT a recipe that is otherwise rich (score >= 85) whose ONLY issue is a copy-leak or 1-2 generic
  // phrases does NOT need a full GRIS rebuild — it needs a targeted copy fix. Route those to REVIEW
  // so the repair-target count is not inflated.
  const genericHits = ev.blockers.filter(b => b.startsWith('generic phrase')).length;
  const hasLeak = ev.blockers.some(b => b.startsWith('internal term leak'));
  const hasStructuralBlocker = ev.blockers.some(b => b.includes('arrow-only') || b.includes('empty troubleshooting'));
  const copyOnlyDefect = (hasLeak || genericHits > 0) && !hasStructuralBlocker && ev.score >= 85 && ev.failedSections.length === 0;
  const majorBlocker = (hasLeak || hasStructuralBlocker || genericHits >= 3) && !copyOnlyDefect;

  const base = {
    recipeId: r.id,
    slug: r.id, // DB id IS the slug-equivalent identifier (no separate slug column); titleFa used as label
    titleFa: typeof r.title === 'object' ? r.title.fa : r.title,
    sourceGroup: sg,
    cuisineOrigin: co,
    hasGris: hasGris,
    sourcePathOrDb: 'PostgreSQL garnish_db (local/dev)',
    contentCompletenessScore: ev.score,
    failedSections: ev.failedSections,
    blockers: ev.blockers,
    weakExamples: ev.weakExamples,
  };

  if (ev.score >= 85 && !majorBlocker && ev.failedSections.length <= 1 && !copyOnlyDefect) {
    complete.push({ ...base, reasonWhyComplete: 'All major GRIS sections present, dish-specific, no blockers.', confidence: ev.score >= 92 ? 'HIGH' : 'MEDIUM' });
  } else if (copyOnlyDefect) {
    // Rich recipe with only a localized copy defect — needs targeted copy fix, NOT a full GRIS rebuild.
    review.push({ ...base, reasonWhyUncertain: 'Score ' + ev.score + ' (rich content) but has a localized copy defect needing a targeted fix only: ' + ev.blockers.join('; ') + '. Not a full-GRIS-rebuild candidate.' });
  } else if (ev.score < 75 || majorBlocker) {
    const reason = majorBlocker
      ? 'Has a major blocker (internal term leak, arrow-only/empty troubleshooting, or 3+ generic-phrase hits).'
      : 'Multiple core GRIS sections missing/shallow/generic: ' + ev.failedSections.join(', ');
    // repair priority
    let priority = 'LOW';
    if (ev.score < 50 || hasLeak) priority = 'HIGH';
    else if (ev.score < 65 || genericHits >= 2 || hasStructuralBlocker) priority = 'MEDIUM';
    needsRepair.push({ ...base, reasonWhyIncomplete: reason, repairPriority: priority, confidence: ev.score < 40 ? 'HIGH' : (ev.score < 60 ? 'MEDIUM' : 'LOW') });
  } else {
    // 75-84 band
    review.push({ ...base, reasonWhyUncertain: 'Score in 75-84 review band (' + ev.score + '); borderline section coverage: ' + ev.failedSections.join(', ') + (ev.blockers.length ? ' | blockers: ' + ev.blockers.join('; ') : '') });
  }
}

// ---- Dedup resolution note: DB is the single authoritative source; draft files mirror it ----
// (no double counting because we only enumerate the live DB.)

// ---- Repeated sentence clusters (across all recipes) ----
const sentenceCounts = {};
for (const { recipe: r, eval: ev } of evaluated) {
  const parts = [];
  parts.push(faText(getStory(r)));
  parts.push(...flattenStrings(getWhyItWorks(r)));
  parts.push(...flattenStrings(getFinish(r)));
  parts.push(...flattenStrings(getKeep(r)));
  parts.push(...flattenStrings(getNourishment(r)));
  const text = parts.join(' ');
  // split on Persian + latin sentence enders
  const sentences = text.split(/[.!؟\n]/).map(s => s.trim()).filter(s => textLen(s) >= 25);
  const seen = new Set();
  for (const s of sentences) {
    if (seen.has(s)) continue; seen.add(s);
    sentenceCounts[s] = sentenceCounts[s] || { count: 0, recipes: new Set() };
    sentenceCounts[s].count++;
    sentenceCounts[s].recipes.add(r.id);
  }
}
const repeatedClusters = Object.entries(sentenceCounts)
  .filter(([,v]) => v.count >= 3)
  .sort((a,b) => b[1].count - a[1].count)
  .slice(0, 40)
  .map(([s,v]) => ({ sentence: s.slice(0,160), count: v.count, recipeCount: v.recipes.size }));

// ---- Blocker phrase hits aggregate ----
const blockerPhraseHitsAgg = {};
for (const { eval: ev } of evaluated) {
  for (const b of ev.blockers) {
    blockerPhraseHitsAgg[b] = (blockerPhraseHitsAgg[b] || 0) + 1;
  }
}

// ---- Summary ----
function countOrigin(list, origin) { return list.filter(x => x.cuisineOrigin === origin).length; }
function grp(list, g) { return list.filter(x => x.sourceGroup === g); }
const summary = {
  totalSourcesFound: 6, // DB, active files(200/122), drafts(global-143, phase-one-122), intl core draft, lite-food, handoff, shared seed
  totalRawRecipesFound: 589, // DB total
  dedupedRecipes: 493,
  lite96Excluded: 96,
  includedNonLiteRecipes: 493,
  completeDoNotTouch: complete.length,
  needsFullGrisRepair: needsRepair.length,
  reviewRequired: review.length,
  iranianCount: evaluated.filter(e => cuisineOrigin(e.recipe) === 'Iranian').length,
  foreignCount: evaluated.filter(e => cuisineOrigin(e.recipe) === 'Foreign').length,
  unknownOriginCount: evaluated.filter(e => cuisineOrigin(e.recipe) === 'Unknown').length,
  global143Found: evaluated.filter(e => sourceGroup(e.recipe.id) === 'Global 143').length,
  global143NeedsRepair: grp(needsRepair, 'Global 143').length,
  phaseOneFound: evaluated.filter(e => sourceGroup(e.recipe.id) === 'Phase One').length,
  phaseOneNeedsRepair: grp(needsRepair, 'Phase One').length,
  internationalCoreFound: evaluated.filter(e => sourceGroup(e.recipe.id) === 'International Core').length,
  internationalCoreNeedsRepair: grp(needsRepair, 'International Core').length,
};

const output = {
  summary,
  sources: [
    { name:'PostgreSQL live DB (garnish_db, local/dev)', path:'apps/server/.env DATABASE_URL=...localhost:5432/garnish_db', recipeCount:589, kind:'active', includeInAudit:true, reason:'Authoritative source the app reads.' },
    { name:'data/recipes/active/recipes.fa.phase-one.200.json', path:'data/recipes/active/recipes.fa.phase-one.200.json', recipeCount:200, kind:'active-data-file', includeInAudit:false, reason:'Mirrors DB Phase One 200; DB is authoritative (dedup).' },
    { name:'data/recipes/active/recipes.fa.phase-one.json', path:'data/recipes/active/recipes.fa.phase-one.json', recipeCount:122, kind:'legacy', includeInAudit:false, reason:'Strict subset of the 200; dedup against DB.' },
    { name:'data/recipes/drafts/global-143/recipes.global-143.all.fa.final.json', path:'data/recipes/drafts/global-143/recipes.global-143.all.fa.final.json', recipeCount:143, kind:'draft', includeInAudit:false, reason:'Mirrors DB Global 143; DB is authoritative (dedup).' },
    { name:'garnish_recipe_international_core_150_draft_candidate_v0_6_0 (recipes file)', path:'garnish_recipe_international_core_150_draft_candidate_v0_6_0/recipes.international.core-150.draft-candidate.v0.6.0.json', recipeCount:150, kind:'draft', includeInAudit:false, reason:'Mirrors DB Intl Core 150; DB is authoritative (dedup).' },
    { name:'data/lite-food/v0.3/lite-food-96', path:'data/lite-food/v0.3/lite-food-96.recipe-shaped.with-ingredient-expansion.v0.3.json', recipeCount:96, kind:'lite', includeInAudit:false, reason:'Intentional Lite Food 96 — excluded per spec.' },
    { name:'garnish_import_handoffs/garnish_global_143_final_v0_3_full_reviewed', path:'garnish_import_handoffs/.../recipes.global-143.all.fa.v0.3.FULL_REVIEWED.json', recipeCount:143, kind:'handoff', includeInAudit:false, reason:'Import handoff for Global 143; dedup against DB.' },
    { name:'packages/shared/data/recipes_clean.json (seed)', path:'packages/shared/data/recipes_clean.json', recipeCount:124, kind:'seed', includeInAudit:false, reason:'Old seed set (124 legacy excerpt/content recipes); superseded by GRIS DB recipes.' },
    { name:'apps/server/prisma/dev.db (SQLite)', path:'apps/server/prisma/dev.db', recipeCount:'stale', kind:'legacy', includeInAudit:false, reason:'Stale June-2 SQLite dev artifact; not the active datasource.' },
    { name:'data/recipes/archive (122 v0.5.4)', path:'data/recipes/archive/recipes.fa.phase-one.122.v0.5.4.json', recipeCount:122, kind:'archive', includeInAudit:false, reason:'Archived older subset; dedup.' },
  ],
  completeDoNotTouch: complete,
  needsFullGrisRepair: needsRepair,
  reviewRequired: review,
  lite96Excluded: [{ note:'96 Lite Food recipes excluded intentionally (category=lite_food, id prefix garnish_lite_).', location:'DB + data/lite-food/v0.3/', count:96 }],
  duplicateResolution: [
    { strategy:'DB is the single authoritative active source (589 recipes). All draft/active/handoff JSON files mirror subsets of the DB and were NOT counted again.', dbTotal:589, nonLiteDeduped:493, liteExcluded:96 },
  ],
  repeatedSentenceClusters: repeatedClusters,
  blockerPhraseHits: blockerPhraseHitsAgg,
};

fs.writeFileSync('docs/qa/recipes/garnish_non_lite_recipe_completeness_audit_v1.json', JSON.stringify(output, null, 2));
console.log('WROTE docs/qa/recipes/garnish_non_lite_recipe_completeness_audit_v1.json');
console.log(JSON.stringify(summary, null, 2));
console.log('top blocker hits:', Object.entries(blockerPhraseHitsAgg).sort((a,b)=>b[1]-a[1]).slice(0,8));
