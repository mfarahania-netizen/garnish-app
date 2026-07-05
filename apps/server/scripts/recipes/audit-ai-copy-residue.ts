import { parseJson, prisma, writeCsv, writeJson, writeMd } from './culinary-authenticity-sprint-common';

const phrases = [
  'کنار دستت بگذار',
  'مواد را طبق',
  'مواد را آماده کنید',
  'شخصیت غذا',
  'همان شخصیت',
  'نشانهٔ درست این مرحله',
  'ظاهر نهایی باید با هویت غذا هماهنگ باشد',
  'نقطه قوتش این است',
  'این توضیح عمومی است',
  'promised',
];

async function main() {
  const recipes = await prisma.recipe.findMany({
    where: { OR: [{ status: 'active', isPublic: true }, { id: { startsWith: 'meze50_' } }] },
    include: { ingredients: { include: { ingredient: true } }, steps: true, searchTerms: true },
    orderBy: { title: 'asc' },
  });
  const rows = recipes.flatMap((r) => {
    const payload = {
      description: r.description,
      tips: parseJson(r.tips, []),
      faq: parseJson(r.faq, []),
      chefTips: parseJson(r.chefTips, []),
      commonMistakes: parseJson(r.commonMistakes, []),
      servingSuggestions: parseJson(r.servingSuggestions, []),
      substitutions: parseJson(r.substitutions, []),
      gris: r.gris,
      steps: r.steps.map((s: any) => ({ title: s.title, instruction: s.instruction })),
    };
    const hits: any[] = [];
    const walk = (value: unknown, path: string[]) => {
      if (value == null) return;
      if (typeof value === 'string') {
        for (const p of phrases) {
          if (value.includes(p)) {
            hits.push({
              recipeId: r.id,
              title: r.title,
              status: r.status,
              isPublic: r.isPublic,
              fieldPath: path.join('.'),
              phrase: p,
              excerpt: value.slice(Math.max(0, value.indexOf(p) - 80), value.indexOf(p) + p.length + 120),
              classification: /کنار دستت|مواد را طبق|شخصیت غذا|نشانهٔ درست/.test(p) ? 'CRITICAL_USER_VISIBLE_AI_RESIDUE' : 'HIGH_REPEATED_TEMPLATE',
            });
          }
        }
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item, index) => walk(item, [...path, String(index)]));
        return;
      }
      if (typeof value === 'object') {
        Object.entries(value as Record<string, unknown>).forEach(([key, child]) => walk(child, [...path, key]));
      }
    };
    walk(payload, []);
    return hits;
  });
  const counts = rows.reduce((acc: Record<string, number>, r) => {
    acc[r.classification] = (acc[r.classification] ?? 0) + 1;
    return acc;
  }, {});
  writeJson('ai_copy_residue_audit_v1.json', { generatedAt: new Date().toISOString(), counts, rows });
  writeCsv('ai_copy_residue_repeated_phrases.csv', rows.length ? rows : [{ classification: 'NONE', phrase: '', recipeId: '', title: '' }]);
  writeMd('ai_copy_residue_audit_v1.md', `# AI Copy Residue Audit v1

| Classification | Count |
|---|---:|
${Object.entries(counts).map(([k, v]) => `| ${k} | ${v} |`).join('\n') || '| NONE | 0 |'}

Hard gate: CRITICAL_USER_VISIBLE_AI_RESIDUE and HIGH_REPEATED_TEMPLATE must be 0.
`);
  console.log(JSON.stringify({ ok: true, counts }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => {
  console.error(err);
  process.exit(1);
});
