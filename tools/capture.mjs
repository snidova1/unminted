// Capture and exercise the actual out/ dashboard. Requires Playwright only for this dev tool.
// npm exec --package=playwright -- node tools/capture.mjs
// Or set PLAYWRIGHT_MODULE to an existing playwright directory. No runtime dependency.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { resolve, join, extname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(repo, 'out');
const destination = process.env.CAPTURE_DIR ? resolve(process.env.CAPTURE_DIR) : join(repo, 'screenshots');
mkdirSync(destination, { recursive: true });
const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright',
  'D:/Claude/node_modules/playwright', 'D:/Claude/node_modules/@playwright/test',
  ...(process.env.PATH || '').split(delimiter).filter(p => p.endsWith('node_modules\\.bin') || p.endsWith('node_modules/.bin')).map(p => resolve(p, '..', 'playwright'))].filter(Boolean);
let chromium;
for (const p of candidates) { try { ({ chromium } = require(p)); if (chromium) break; } catch {} }
if (!chromium) throw new Error('Playwright not found. Run npm exec --package=playwright -- node tools/capture.mjs');
const server = createServer((req, res) => {
  let path;
  try { path = resolve(out, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); } catch { res.writeHead(400).end(); return; }
  if (!path.startsWith(out + '/') && !path.startsWith(out + '\\')) { res.writeHead(403).end(); return; }
  try {
    const bytes = readFileSync(path);
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' })[extname(path)] || 'application/octet-stream' });
    res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const executablePath = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
let browser;
try {
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const errors = [], external = [], missing = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) missing.push(r.url()); });
  await page.route('**/*', route => { if (!route.request().url().startsWith(origin)) { external.push(route.request().url()); return route.abort(); } return route.continue(); });
  await page.goto(origin + '/dashboard/index.html', { waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => window.UNMINTED.verified), true, 'Browser recalculation disagrees');
  assert.equal(await page.locator('tbody tr').count(), 10);
  const meta = await page.evaluate(() => ({ rows: RADAR.board_size, watch: RADAR.covered, comps: RADAR.comp_count, early: RADAR.early_size }));
  assert.equal(meta.watch, 40);
  async function shot(name) {
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth, height: document.documentElement.scrollHeight,
      clipped: [...document.querySelectorAll('.stat,.cost-col,.time-col,.farm-head,.valuation')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className),
      boxes: Object.fromEntries(['.top','.intro','.stats','.controls','.workspace','.radar-table','.rail','.detail-title','.detail-grid','.farm-sheet','.detail-left','footer'].map(s => { const e = document.querySelector(s); const r = e?.getBoundingClientRect(); return [s, r ? { y: Math.round(r.y), height: Math.round(r.height), width: Math.round(r.width) } : null]; })) }));
    assert.equal(metrics.scroll, metrics.width, 'Page overflows horizontally');
    assert.deepEqual(metrics.clipped, [], 'Critical text clipped');
    const png = await page.screenshot({ type: 'png', fullPage: false });
    let bytes = png, extension = 'png';
    if (png.length > 350000) {
      extension = 'jpg';
      for (const quality of [97, 94, 90, 85, 80]) {
        bytes = await page.screenshot({ type: 'jpeg', quality, fullPage: false });
        if (bytes.length <= 350000) break;
      }
    }
    assert(bytes.length <= 524288, 'Screenshot exceeds gate cap');
    for (const old of ['png', 'jpg']) { const path = join(destination, name + '.' + old); if (existsSync(path)) unlinkSync(path); }
    writeFileSync(join(destination, name + '.' + extension), bytes);
    console.log(JSON.stringify({ screenshot: name + '.' + extension, bytes: bytes.length, ...metrics }));
  }
  await shot('1-board');
  // Header sorting with keyboard; ascending TVL must be a numerical sort.
  await page.locator('[data-sort="tvl_usd"]').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-sort="tvl_usd"]').evaluate(e => e.closest('th').getAttribute('aria-sort')), 'ascending');
  const sorted = await page.locator('tbody tr').evaluateAll(es => es.map(e => RADAR.rows.find(r => r.slug === e.dataset.slug).tvl_usd));
  assert(sorted.every((n, i) => !i || n >= sorted[i - 1]));
  // Search stays focused through repeated renders, and locates an exact slug.
  const searchSlug = await page.evaluate(() => RADAR.rows[0].slug);
  await page.locator('#q').pressSequentially(searchSlug);
  assert.equal(await page.locator('#q').inputValue(), searchSlug);
  assert.equal(await page.locator('tbody tr[data-slug]').count(), 1);
  await page.locator('#q').fill('');
  await page.locator('#chain').selectOption('Solana');
  assert(await page.locator('tbody tr[data-slug]').count() > 0);
  assert(await page.locator('tbody tr').evaluateAll(es => es.every(e => RADAR.rows.find(r => r.slug === e.dataset.slug).chains.includes('Solana'))));
  await page.locator('#chain').selectOption('');
  await page.locator('#scope').selectOption('Early only');
  assert(await page.locator('tbody tr').evaluateAll(es => es.every(e => RADAR.rows.find(r => r.slug === e.dataset.slug).early)));
  await page.locator('#scope').selectOption('Watchlist only');
  assert.equal(await page.locator('#count-announcement').textContent(), '40 protocols match');
  await page.locator('[data-clear="all"]').click();
  await page.locator('[data-mode="live"]').last().click();
  assert(await page.locator('tbody tr').evaluateAll(es => es.every(e => !RADAR.rows.some(r => r.slug === e.dataset.slug))));
  await page.locator('[data-mode="pre"]').last().click();
  // Select a real Lending research note, generated from category only, never a handcoded name.
  const detail = await page.evaluate(() => RADAR.rows.find(r => r.category === 'Lending'));
  assert(detail);
  await page.goto(origin + '/dashboard/index.html#' + encodeURIComponent(detail.slug), { waitUntil: 'networkidle' });
  await page.waitForSelector('.farm-table');
  assert.equal(await page.locator('.farm-table tbody tr').count(), 6);
  const steps = await page.locator('.farm-table tbody tr td:nth-child(2)').allTextContents();
  assert.deepEqual(steps, detail.plan.map(p => p.text));
  await shot('2-detail');
  await page.locator('#method-open').click();
  assert.equal(await page.locator('dialog').evaluate(e => e.open), true);
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog', { state: 'detached' });
  await page.goto(origin + '/dashboard/index.html', { waitUntil: 'networkidle' });
  await page.locator('#category').selectOption('Lending');
  assert(await page.locator('tbody tr').evaluateAll(es => es.every(e => RADAR.rows.find(r => r.slug === e.dataset.slug).category === 'Lending')));
  assert(await page.locator('.chip').filter({ hasText: 'Lending' }).count());
  await shot('3-filtered');
  // Every ranked slug must have a real detail route and the exact serialized plan.
  const detailAudit = await page.evaluate(() => {
    const failures = [];
    for (const r of RADAR.rows) {
      history.replaceState(null, '', '#' + encodeURIComponent(r.slug));
      dispatchEvent(new HashChangeEvent('hashchange'));
      const texts = [...document.querySelectorAll('.farm-table tbody tr td:nth-child(2)')].map(e => e.textContent);
      if (JSON.stringify(texts) !== JSON.stringify(r.plan.map(s => s.text))) failures.push(r.slug + ': plan');
      if (document.documentElement.scrollWidth > innerWidth) failures.push(r.slug + ': horizontal overflow');
    }
    return { checked: RADAR.rows.length, failures };
  });
  assert.deepEqual(detailAudit.failures, []);
  // Responsive regression: innerWidth can expand on mobile overflow, so compare against 390 itself.
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  mobile.on('pageerror', e => errors.push(e.message));
  await mobile.route('**/*', route => { if (!route.request().url().startsWith(origin)) { external.push(route.request().url()); return route.abort(); } return route.continue(); });
  await mobile.goto(origin + '/dashboard/index.html', { waitUntil: 'networkidle' });
  const fitsPhone = async () => assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390, 'Mobile document overflow');
  await fitsPhone();
  assert.equal(await mobile.locator('tbody tr').count(), 10);
  assert(await mobile.locator('.table-scroll').evaluate(e => e.scrollWidth > e.clientWidth), 'Dense table should scroll inside its container');
  await mobile.locator('.table-scroll').evaluate(e => { e.scrollLeft = 300; });
  assert(await mobile.locator('.table-scroll').evaluate(e => e.scrollLeft > 0));
  await mobile.locator('[data-mode="live"]').last().click();
  await fitsPhone();
  assert.equal(await mobile.locator('tbody tr').count(), 10);
  await mobile.locator('[data-mode="pre"]').last().click();
  await fitsPhone();
  await mobile.locator('#category').selectOption('Lending');
  await fitsPhone();
  await mobile.locator('tbody a').first().click();
  await mobile.waitForSelector('.farm-table');
  await fitsPhone();
  assert.equal(await mobile.locator('.farm-table tbody tr').count(), 6);
  assert.equal(await mobile.locator('.farm-table tbody tr').first().evaluate(e => getComputedStyle(e).display), 'grid');
  await mobile.locator('#method-open').click();
  assert.equal(await mobile.locator('dialog').evaluate(e => e.open), true);
  await fitsPhone();
  await mobile.locator('#close-method').click();
  await mobile.waitForSelector('dialog', { state: 'detached' });
  await mobile.locator('.breadcrumb a').click();
  await mobile.waitForSelector('#category');
  assert.equal(await mobile.locator('#category').inputValue(), 'Lending');
  await fitsPhone();
  const mobileDetailAudit = await mobile.evaluate(() => {
    const failures = [];
    for (const r of RADAR.rows) {
      history.replaceState(null, '', '#' + encodeURIComponent(r.slug));
      dispatchEvent(new HashChangeEvent('hashchange'));
      if (document.documentElement.scrollWidth !== 390 || document.querySelectorAll('.farm-table tbody tr').length !== 6) failures.push(r.slug);
    }
    return failures;
  });
  assert.deepEqual(mobileDetailAudit, [], 'Mobile detail route overflow or missing steps');
  await mobile.close();
  // Local file mode proves there is no dependency on the capture server.
  const file = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await file.goto(new URL('file:///' + join(out, 'dashboard/index.html').replaceAll('\\', '/')).href);
  assert.equal(await file.evaluate(() => UNMINTED.verified), true);
  assert.equal(await file.locator('tbody tr').count(), 10);
  await file.close();
  assert.deepEqual(errors, [], 'Browser exceptions'); assert.deepEqual(external, [], 'External request attempted'); assert.deepEqual(missing, [], 'Missing assets');
  console.log(JSON.stringify({ browserTests: 'PASS', ...meta, detail: detail.slug, detailRoutesChecked: detailAudit.checked, mobile: '390x844 PASS; contained table scroll, stacked steps, filters, modal, return navigation', externalRequests: external.length, errors }));
} finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
