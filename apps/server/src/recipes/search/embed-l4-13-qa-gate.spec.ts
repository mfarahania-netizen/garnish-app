/**
 * GARNISH-EMBED-L4-13 QA gate — content-side only, deterministic, NO second shadow tower.
 *
 * Proves: the new content representation + feature store are deterministic & local (no Math.random, no
 * external API / vector DB / new dep), do NOT import the frozen recommendation runtime-shadow, and are
 * WIRED to visible features (search/similar read the store; the candidate-generator embedding path reads
 * the principled vector). Writes an evidence artifact under docs/qa.
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildContentVector, cosineDense } from './recipe-content';

const SEARCH_DIR = __dirname; // apps/server/src/recipes/search
const SERVER_SRC = path.resolve(SEARCH_DIR, '../../');
const FILES = {
  content: path.join(SEARCH_DIR, 'recipe-content.ts'),
  store: path.join(SEARCH_DIR, 'recipe-content-feature-store.service.ts'),
  search: path.join(SEARCH_DIR, 'recipe-search.service.ts'),
  embedding: path.join(SERVER_SRC, 'embeddings/recipe-embedding.service.ts'),
};
const read = (p: string) => fs.readFileSync(p, 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const allCode = Object.values(FILES).map((f) => stripComments(read(f))).join('\n');

const EXTERNAL_DEP = /from ['"](openai|@anthropic|cohere|@pinecone|pinecone-|weaviate|qdrant|chromadb|axios|node-fetch|@google\/generative)/i;

describe('EMBED-L4-13 content-side QA gate', () => {
  const IMPORTS_SHADOW = /from\s+['"][^'"]*runtime-shadow/;
  it('NO second shadow: content files never IMPORT the frozen recommendation runtime-shadow', () => {
    for (const [, p] of Object.entries(FILES)) {
      expect(read(p)).not.toMatch(IMPORTS_SHADOW);
    }
  });

  it('DETERMINISTIC + local: no Math.random, no external API / LLM / vector-DB import', () => {
    expect(allCode).not.toMatch(/Math\.random/);
    expect(allCode).not.toMatch(EXTERNAL_DEP);
    // reproducibility: identical input → identical vector
    const a = buildContentVector({ title: 'Chicken Pilaf', diet: 'omnivore', mealType: 'dinner', region: 'persian', cookingTime: 40, ingredients: ['chicken', 'rice'] });
    const b = buildContentVector({ title: 'Chicken Pilaf', diet: 'omnivore', mealType: 'dinner', region: 'persian', cookingTime: 40, ingredients: ['chicken', 'rice'] });
    expect(a).toEqual(b);
  });

  it('replaces the 48-dim hash stub with a principled vector that ranks related content higher', () => {
    const pilaf = buildContentVector({ title: 'Saffron Chicken Pilaf', diet: 'omnivore', mealType: 'dinner', region: 'persian', cookingTime: 40, ingredients: ['chicken', 'rice'] });
    const kebab = buildContentVector({ title: 'Chicken Kebab', diet: 'omnivore', mealType: 'dinner', region: 'persian', cookingTime: 35, ingredients: ['chicken', 'onion'] });
    const cake = buildContentVector({ title: 'Vegan Chocolate Cake', diet: 'vegan', mealType: 'dessert', region: 'international', cookingTime: 70, ingredients: ['flour', 'cocoa'] });
    expect(cosineDense(pilaf, kebab)).toBeGreaterThan(cosineDense(pilaf, cake));
  });

  it('WIRED to visible features: search/similar read the content store; embedding uses the principled vector', () => {
    expect(read(FILES.search)).toMatch(/RecipeContentFeatureStore/); // search + similar read the one store
    expect(read(FILES.search)).toMatch(/content\.getIndex|content\.neighbors/);
    expect(read(FILES.embedding)).toMatch(/buildContentVector/); // embedding (candidate-gen bucket) uses it
  });

  it('writes the evidence artifact', () => {
    const checks = {
      no_runtime_shadow_import: Object.values(FILES).every((p) => !IMPORTS_SHADOW.test(read(p))),
      no_randomness: !/Math\.random/.test(allCode),
      no_external_or_vectordb_dep: !EXTERNAL_DEP.test(allCode),
      deterministic_vector: JSON.stringify(buildContentVector({ title: 't', ingredients: ['a'] })) === JSON.stringify(buildContentVector({ title: 't', ingredients: ['a'] })),
      principled_ranking: cosineDense(buildContentVector({ title: 'a', region: 'persian', diet: 'omnivore', ingredients: ['chicken'] }), buildContentVector({ title: 'b', region: 'persian', diet: 'omnivore', ingredients: ['chicken'] })) > cosineDense(buildContentVector({ title: 'a', region: 'persian', diet: 'omnivore', ingredients: ['chicken'] }), buildContentVector({ title: 'z', region: 'french', diet: 'vegan', ingredients: ['sugar'] })),
      search_reads_store: /RecipeContentFeatureStore/.test(read(FILES.search)),
      embedding_uses_principled_vector: /buildContentVector/.test(read(FILES.embedding)),
    };
    const failedChecks = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    const artifact = { sprint: 'GARNISH-EMBED-L4-13', layer: 'content-side representation + feature store', totalChecks: Object.keys(checks).length, failedChecks, checks, wiredVisibleFeatures: ['recipe search', 'similar recipes', 'recommendation candidate-generator embedding bucket'], deferred: 'user-side learning → Track 7 (R-T7-USERSIDE-EMBEDDING, D13)' };
    expect(Object.keys(checks).length).toBeGreaterThanOrEqual(7);
    expect(failedChecks).toEqual([]);

    const outDir = path.resolve(__dirname, '../../../../..', 'docs/qa/embeddings');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'garnish_embed_l4_13_content_side_results.json'), JSON.stringify(artifact, null, 2));
  });
});
