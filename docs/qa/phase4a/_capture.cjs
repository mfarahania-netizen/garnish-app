/* Phase 4A visual QA capture — drives installed Edge via playwright-core.
   Repo deps untouched (playwright-core installed to a temp prefix).
   Presets dark-mode + suppresses the consent modal via localStorage.
   App is dir="rtl" so every shot is RTL by construction. */
const PW = 'C:/Users/mfara/.pwqa/node_modules/playwright-core';
const { chromium } = require(PW);

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.QA_BASE || 'http://localhost:5173';
const OUT = 'C:/Users/mfara/OneDrive/Desktop/garnish-app/docs/qa/phase4a';

const prep = (dark) => {
  // runs in the page before app scripts
  try {
    localStorage.setItem('garnish_dark_mode', dark ? 'true' : 'false');
    localStorage.setItem('garnish.analyticsConsent', 'denied'); // suppress consent modal
  } catch (e) { /* noop */ }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(browser, { name, w, h, dark, route }) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    locale: 'fa-IR',
  });
  await ctx.addInitScript(prep, dark);
  if (route) await ctx.route('**/recipes?**', route);
  if (route) await ctx.route('**/recipes', route);
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  } catch (e) { console.log('goto warn', name, e.message); }
  await sleep(name.includes('loading') ? 1200 : name.includes('error') ? 5000 : 2200);
  await page.screenshot({ path: `${OUT}/home-${name}.png`, fullPage: !name.includes('loading') });
  console.log('captured', name);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  // populated (live backend, real recipes; recs rail hidden — no auth token)
  await shot(browser, { name: 'mobile-light', w: 390, h: 844, dark: false });
  await shot(browser, { name: 'mobile-dark', w: 390, h: 844, dark: true });
  await shot(browser, { name: 'desktop-light', w: 1440, h: 900, dark: false });
  await shot(browser, { name: 'desktop-dark', w: 1440, h: 900, dark: true });
  // state captures (intercept /recipes)
  await shot(browser, { name: 'loading-mobile-light', w: 390, h: 844, dark: false, route: (r) => { /* hang */ } });
  await shot(browser, { name: 'error-mobile-light', w: 390, h: 844, dark: false, route: (r) => r.abort() });
  await shot(browser, { name: 'empty-mobile-light', w: 390, h: 844, dark: false, route: (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }) }) });
  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
