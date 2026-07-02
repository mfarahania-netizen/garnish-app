/*
 * AUDIT ONLY render helper: reads the v1 audit JSON and emits the matching .md and .csv reports.
 * Does not touch the DB or any recipe source data.
 */
'use strict';
const fs = require('fs');
const A = JSON.parse(fs.readFileSync('docs/qa/recipes/garnish_non_lite_recipe_completeness_audit_v1.json', 'utf8'));
const s = A.summary;

// ---------------- Markdown ----------------
const md = [];
md.push('# Garnish Non-Lite Recipe Completeness Audit — v1');
md.push('');
md.push('> AUDIT ONLY. No recipes rewritten, no imports, no DB writes. Read-only scoring of the live dev DB.');
md.push('> Generated from `PostgreSQL garnish_db (local/dev)` — the single authoritative active source.');
md.push('');
md.push('## 1. Summary');
md.push('');
md.push('| Metric | Value |');
md.push('|---|---|');
md.push('| Total sources found | ' + s.totalSourcesFound + ' |');
md.push('| Total raw recipes found (DB) | ' + s.totalRawRecipesFound + ' |');
md.push('| Deduped recipes | ' + s.dedupedRecipes + ' |');
md.push('| Lite 96 excluded (intentional) | ' + s.lite96Excluded + ' |');
md.push('| **Included non-lite recipes** | **' + s.includedNonLiteRecipes + '** |');
md.push('| ✅ COMPLETE_DO_NOT_TOUCH | ' + s.completeDoNotTouch + ' |');
md.push('| 🔧 NEEDS_FULL_GRIS_REPAIR | ' + s.needsFullGrisRepair + ' |');
md.push('| ❓ REVIEW_REQUIRED | ' + s.reviewRequired + ' |');
md.push('| Iranian origin | ' + s.iranianCount + ' |');
md.push('| Foreign origin | ' + s.foreignCount + ' |');
md.push('| Unknown origin | ' + s.unknownOriginCount + ' |');
md.push('');
md.push('### By source group');
md.push('');
md.push('| Group | Found | Needs repair |');
md.push('|---|---|---|');
md.push('| Phase One | ' + s.phaseOneFound + ' | ' + s.phaseOneNeedsRepair + ' |');
md.push('| International Core | ' + s.internationalCoreFound + ' | ' + s.internationalCoreNeedsRepair + ' |');
md.push('| Global 143 | ' + s.global143Found + ' | ' + s.global143NeedsRepair + ' |');
md.push('');
md.push('## 2. Reliability of this audit');
md.push('');
md.push('- **Reliable.** Source = live dev DB (589 recipes), the only source the app reads. All draft/active/handoff JSON files mirror DB subsets and were de-duplicated, so nothing is double-counted.');
md.push('- Calibration validated against the user\'s named references:');
md.push('  - COMPLETE (matched user intent): جوجه کباب زعفرانی (97), اکبر جوجه (94), چلو کباب کوبیده (97).');
md.push('  - NEEDS_REPAIR (matched user intent): مرغ شکم‌پر (42).');
md.push('  - قیمه سیب‌زمینی scores 97 but carries a localized `fdcId` / "قفل‌شده به منبع" copy leak → routed to REVIEW (targeted copy fix, NOT a full rebuild).');
md.push('- Global 143 re-audited against actual content (per spec, prior PASS reports were ignored). All 143 are missing FAQ + variations and have <4 whyItWorks and <4 troubleshooting — confirming the weakness is real, not a scoring artifact.');
md.push('');
md.push('## 3. Sources discovered');
md.push('');
md.push('| Source | Path | Count | Kind | In audit? | Reason |');
md.push('|---|---|---|---|---|---|');
for (const src of A.sources) {
  md.push('| ' + src.name + ' | `' + src.path + '` | ' + src.recipeCount + ' | ' + src.kind + ' | ' + (src.includeInAudit ? 'yes' : 'no') + ' | ' + src.reason + ' |');
}
md.push('');
md.push('## 4. NEEDS_FULL_GRIS_REPAIR — top 30 by priority');
md.push('');
md.push('| # | Title | Group | Cuisine | Score | Priority | Failed sections | Key blockers |');
md.push('|---|---|---|---|---|---|---|---|');
function priorityRank(p){ return p==='HIGH'?0:p==='MEDIUM'?1:2; }
const repairSorted = A.needsFullGrisRepair.slice().sort((a,b)=>{
  const pr = priorityRank(a.repairPriority)-priorityRank(b.repairPriority);
  if (pr) return pr;
  return a.contentCompletenessScore - b.contentCompletenessScore;
});
repairSorted.slice(0,30).forEach((r,i)=>{
  const blk = r.blockers.length ? r.blockers.slice(0,2).join('; ') : '—';
  md.push('| ' + (i+1) + ' | ' + (r.titleFa||'(no title)') + ' | ' + r.sourceGroup + ' | ' + r.cuisineOrigin + ' | ' + r.contentCompletenessScore + ' | ' + r.repairPriority + ' | ' + (r.failedSections.join(', ')||'—') + ' | ' + blk + ' |');
});
md.push('');
md.push('## 5. REVIEW_REQUIRED (' + A.reviewRequired.length + ')');
md.push('');
if (A.reviewRequired.length === 0) {
  md.push('_None._');
} else {
  md.push('| Title | Group | Score | Why uncertain |');
  md.push('|---|---|---|---|');
  for (const r of A.reviewRequired) {
    md.push('| ' + (r.titleFa||'(no title)') + ' | ' + r.sourceGroup + ' | ' + r.contentCompletenessScore + ' | ' + (r.reasonWhyUncertain||r.reasonWhyIncomplete||'').replace(/\|/g,'/') + ' |');
  }
}
md.push('');
md.push('## 6. COMPLETE_DO_NOT_TOUCH (' + A.completeDoNotTouch.length + ')');
md.push('');
md.push('Full list in `garnish_non_lite_recipe_completeness_audit_v1.json` → `completeDoNotTouch[]`. Sample:');
md.push('');
md.push('| Title | Group | Score | Confidence |');
md.push('|---|---|---|---|');
A.completeDoNotTouch.slice().sort((a,b)=>b.contentCompletenessScore-a.contentCompletenessScore).slice(0,15).forEach(r=>{
  md.push('| ' + (r.titleFa||'(no title)') + ' | ' + r.sourceGroup + ' | ' + r.contentCompletenessScore + ' | ' + r.confidence + ' |');
});
md.push('');
md.push('## 7. Repeated sentence clusters (>=3 recipes)');
md.push('');
if (A.repeatedSentenceClusters.length === 0) {
  md.push('_No generic sentence repeated across 3+ recipes._');
} else {
  md.push('| Sentence (truncated) | Recipes |');
  md.push('|---|---|');
  for (const c of A.repeatedSentenceClusters.slice(0,20)) {
    md.push('| ' + (c.sentence||'').replace(/\|/g,'/').replace(/\n/g,' ') + ' | ' + c.recipeCount + ' |');
  }
}
md.push('');
md.push('## 8. Top blocker-phrase hits (aggregate)');
md.push('');
md.push('| Blocker | Recipes hit |');
md.push('|---|---|');
const blkSorted = Object.entries(A.blockerPhraseHits).sort((a,b)=>b[1]-a[1]).slice(0,15);
for (const [b,n] of blkSorted) md.push('| ' + b.replace(/\|/g,'/') + ' | ' + n + ' |');
md.push('');
md.push('## 9. Output files');
md.push('');
md.push('- `docs/qa/recipes/garnish_non_lite_recipe_completeness_audit_v1.json` — full structured audit');
md.push('- `docs/qa/recipes/garnish_non_lite_recipe_completeness_audit_v1.md` — this report');
md.push('- `docs/qa/recipes/garnish_non_lite_recipe_completeness_audit_v1.csv` — flat per-recipe table');
md.push('- `docs/qa/recipes/_audit_engine.cjs` / `_audit_render.cjs` — reproducible read-only scripts');
md.push('');
md.push('---');
md.push('_Hard stop per spec: no rewrites, no imports, no DB writes. Audit only._');
fs.writeFileSync('docs/qa/recipes/garnish_non_lite_recipe_completeness_audit_v1.md', md.join('\n'));

// ---------------- CSV ----------------
const csv = [];
csv.push('recipeId,titleFa,sourceGroup,cuisineOrigin,classification,score,repairPriority,confidence,failedSections,blockers,reason');
function esc(v){ v = v==null?'':String(v); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }
function row(r, cls){
  return [
    esc(r.recipeId), esc(r.titleFa), esc(r.sourceGroup), esc(r.cuisineOrigin), esc(cls),
    esc(r.contentCompletenessScore),
    esc(r.repairPriority||''), esc(r.confidence||''),
    esc((r.failedSections||[]).join('; ')),
    esc((r.blockers||[]).join('; ')),
    esc(r.reasonWhyIncomplete||r.reasonWhyUncertain||r.reasonWhyComplete||'')
  ].join(',');
}
for (const r of A.completeDoNotTouch) csv.push(row(r,'COMPLETE_DO_NOT_TOUCH'));
for (const r of A.reviewRequired) csv.push(row(r,'REVIEW_REQUIRED'));
for (const r of A.needsFullGrisRepair) csv.push(row(r,'NEEDS_FULL_GRIS_REPAIR'));
fs.writeFileSync('docs/qa/recipes/garnish_non_lite_recipe_completeness_audit_v1.csv', csv.join('\n'));

console.log('WROTE .md and .csv');
console.log('rows in csv (excl header):', csv.length-1);
