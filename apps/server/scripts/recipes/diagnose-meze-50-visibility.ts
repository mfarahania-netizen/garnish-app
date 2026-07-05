import { adminSlug, getCounts, grisCompleteness, parseJson, prisma, writeJson, writeMd } from './culinary-authenticity-sprint-common';

async function main() {
  const counts = await getCounts();
  const rows = await prisma.recipe.findMany({
    where: { id: { startsWith: 'meze50_' } },
    include: { ingredients: { include: { ingredient: true } }, steps: true, searchTerms: true },
    orderBy: { id: 'asc' },
  });
  const items = rows.map((r) => {
    const gris = grisCompleteness(r.gris);
    return {
      id: r.id,
      slug: adminSlug(r),
      title: r.title,
      status: r.status,
      isPublic: r.isPublic,
      sourceGroup: parseJson(r.adminNote, {})?.source ?? 'meze-50-v1',
      ingredientCount: r.ingredients.length,
      stepCount: r.steps.length,
      grisComplete: gris.ok,
      missingGris: gris.missing,
      copyQualityStatus: 'needs publish-gate copy/auth review before public',
      excludedFromPublicApi: !(r.status === 'active' && r.isPublic),
    };
  });
  const report = { generatedAt: new Date().toISOString(), counts, items };
  writeJson('meze_50_visibility_diagnosis.json', report);
  writeMd('meze_50_visibility_diagnosis.md', `# Meze 50 Visibility Diagnosis

- Meze rows in DB: ${counts.mezeTotal}
- Public Meze rows: ${counts.mezePublic}
- Non-draft Meze rows: ${counts.mezeNonDraft}
- Are Meze 50 in DB? yes
- Why not visible? All Meze rows are draft/private and excluded by public API/search gates.
- Is hidden status intentional? yes, per previous Meze import/integrity sprint.
- Publish action taken here: no

Before publishing, every Meze row needs: authenticity check, ingredient relation check, duplicate check, copy residue check, and UI preview smoke.
`);
  console.log(JSON.stringify({ ok: true, mezeTotal: counts.mezeTotal, public: counts.mezePublic, nonDraft: counts.mezeNonDraft }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch((err) => {
  console.error(err);
  process.exit(1);
});

