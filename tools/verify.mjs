// Independent local mirror of the seven published gate rows. NOT the unpublished house scorer.
// Also checks model invariants and output determinism. Run after main.ts.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { buildRadar, parseSnapshot, boardIssue, isRankable, ageDays, calibrate, quantile, MODEL } from '../lib/model.ts';
import { buildDossier } from '../vendor/makefun-board.ts';
const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(repo, 'out');
const s = parseSnapshot(readFileSync(join(repo, 'input/snapshot.json'), 'utf8'));
const built = buildRadar(s);
const board = JSON.parse(readFileSync(join(out, 'board.json'), 'utf8')).rows;
const gate = [];
function check(name, test) { test(); gate.push({ check: name, status: 'pass' }); }
function files(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    assert(/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(e.name)); assert(!e.isSymbolicLink());
    return e.isDirectory() ? files(join(dir, e.name), prefix + e.name + '/') : [{ name: prefix + e.name, path: join(dir, e.name) }];
  });
}
check('dashboard_files', () => {
  const f = files(join(out, 'dashboard'));
  assert(f.some(f => f.name === 'index.html')); assert(f.some(f => f.name.endsWith('.js'))); assert(f.some(f => f.name.endsWith('.css')));
  assert(f.length <= 400); const size = f.reduce((n, f) => n + statSync(f.path).size, 0); assert(size < 60000);
  assert(!existsSync(join(repo, 'dashboard/data.js')));
  for (const file of f) {
    const t = readFileSync(file.path, 'utf8');
    if (file.name.endsWith('.html')) {
      assert(!/\b[\w-]+\s*=\s*["'][^"']*https?:\/\//i.test(t), 'Network HTML attribute');
      for (const block of t.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) assert(!/https?:\/\//i.test(block[1]));
    }
    if (file.name.endsWith('.css')) assert(!/https?:\/\//i.test(t));
    if (/\.m?js$/.test(file.name)) assert(!/(?:import|require\s*\(|from\s*)[^\n;]*["']https?:\/\//i.test(t));
  }
});
check('board_file', () => {
  assert(board.length >= 100 && board.length <= 4000); assert(statSync(join(out, 'board.json')).size < 8 * 1024 * 1024);
  assert.equal(new Set(board.map(r => r.slug)).size, board.length);
  for (const r of board) {
    assert(s.protocols.some(p => p.slug === r.slug)); assert(r.name.trim());
    assert(Number.isSafeInteger(r.implied_value_usd) && r.implied_value_usd > 0 && r.implied_value_usd <= 1e14);
    assert.equal(r.gecko_id, null); assert.equal(r.symbol, null); assert(isRankable(r));
  }
});
check('sorted_by_value', () => {
  board.forEach((r, i) => { assert.equal(r.rank, i + 1); if (i) assert(r.implied_value_usd <= board[i - 1].implied_value_usd); });
  assert(new Set(board.map(r => r.implied_value_usd)).size > 1);
});
check('coverage', () => {
  const slugs = new Set(board.map(r => r.slug)); assert(s.watchlist.every(slug => slugs.has(slug)));
  assert.deepEqual(board.map(r => r.slug).sort(), s.protocols.filter(isRankable).map(r => r.slug).sort());
});
check('farm_steps', () => {
  for (const r of board) {
    assert(r.farm_steps.length >= 4 && r.farm_steps.length <= 7);
    assert(r.farm_steps.every(t => t.trim().length >= 20 && t.trim().length <= 600));
    assert.deepEqual(r.farm_steps, r.plan.map(s => `${s.text} Cost: ${s.cost}. Time: ${s.time}.`));
    assert(r.farm.capital >= 250 && r.farm.capital <= 5000);
    assert.equal(r.farm.cost, Math.round(((6 + r.farm.weeks) * r.farm.gas + r.farm.bridge + r.farm.friction) * 100) / 100);
  }
});
check('screenshots', () => {
  const f = files(join(out, 'screenshots')); assert(f.length >= 3 && f.length <= 4);
  for (const file of f) {
    const b = readFileSync(file.path); assert(b.length <= 524288);
    assert(b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Expected our PNG captures');
    const width = b.readUInt32BE(16), height = b.readUInt32BE(20);
    assert(Math.max(width, height) <= 1440 && Math.min(width, height) >= 800);
    const idat = []; let at = 8, ended = false;
    while (at < b.length) {
      const length = b.readUInt32BE(at), type = b.subarray(at + 4, at + 8).toString();
      assert(at + length + 12 <= b.length);
      if (type === 'IDAT') idat.push(b.subarray(at + 8, at + 8 + length));
      if (type === 'IEND') { ended = true; assert.equal(at + length + 12, b.length); }
      at += length + 12;
    }
    assert(ended); const raw = inflateSync(Buffer.concat(idat)); assert(raw.length > width * height * 3);
  }
});
check('dossier_matches', () => {
  const actual = readFileSync(join(out, 'dossier.json'));
  const expected = Buffer.from(buildDossier(out, { text_max_bytes: 65536, screenshots: { max: 4, max_bytes: 524288 }, dashboard: { max_files: 400, max_bytes: 4194304 } }));
  assert(actual.equals(expected)); assert(actual.length <= 1.5 * 1024 * 1024);
  const d = JSON.parse(actual); assert(!d.text.includes('[Cut at ')); assert(!d.text.includes('not shown]'));
});
// Complete serialized rows must agree, not just headline values.
assert.deepEqual(board, built.board); assert.equal(boardIssue(board, s), null);
const repeat = buildRadar(s); assert.deepEqual(repeat, built);
assert.equal(quantile([1, 2, 3, 4], 0.25), 1.75);
assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
assert.equal(ageDays('2026-11-14', null), null);
assert.equal(ageDays('2026-11-14', '2027-01-01'), 0);
const comps = built.radar.live.filter(r => r.mcap_usd !== null);
assert.equal(built.radar.comp_count, s.protocols.filter(p => p.mcap_usd !== null).length, 'Every observed mcap, including zero, is a comp');
for (const r of board) {
  const f = r.factors;
  assert(r.range.low <= r.implied_value_usd && r.implied_value_usd <= r.range.high);
  assert.equal(r.implied_value_usd, Math.max(1, Math.round(r.tvl_usd * f.multiple * f.growth * f.maturity * f.scale)));
  assert(f.growth >= 0.7 && f.growth <= 1.6); assert(f.maturity >= 0.65 && f.maturity <= 1.2);
  assert.equal(r.early, r.tvl_usd < s.floor_usd); assert.equal(r.age_days, ageDays(s.as_of, r.listed_at));
  const c = calibrate(r, comps); assert.deepEqual(c, r.comps);
  const own = comps.filter(c => c.category === r.category);
  if (own.length >= MODEL.min_comps) assert.equal(r.comps.scope, 'Category');
}
// Fallbacks and edge cases use small explicit test records, never output rows or synthetic market results.
const p = { ...s.protocols[0], category: 'Test category' };
const one = { ...p, mcap_usd: 10, tvl_usd: 10, multiple: 1, age_days: 1 };
assert.equal(calibrate(p, [one]).scope, 'Global');
assert.equal(calibrate(p, [one, one, one, one]).scope, 'Category');
assert.equal(calibrate({ ...p, category: 'Chain' }, [one, one, one, one]).scope, 'Sector: Infrastructure');
const changed = structuredClone(s); const target = changed.protocols.find(p => p.slug === board[0].slug); target.name = 'Name independence check';
assert.equal(buildRadar(changed).board.find(r => r.slug === target.slug).implied_value_usd, board[0].implied_value_usd);
console.log(JSON.stringify({ authority: 'Local mirror of published specification; house scorer unavailable', gate, model: 'PASS', deterministic: true,
  rows: board.length, covered: built.radar.covered, early: built.radar.early_size, comps: built.radar.comp_count,
  dashboard_bytes: files(join(out, 'dashboard')).reduce((n, f) => n + statSync(f.path).size, 0), dossier_bytes: statSync(join(out, 'dossier.json')).size }, null, 2));
