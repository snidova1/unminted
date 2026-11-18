// UNMINTED / sealed-snapshot research model. No network, protocol-name overrides or clock drift.
export interface SnapshotProtocol {
  slug: string; name: string; category: string | null; chains: string[];
  tvl_usd: number; change_7d: number | null; mcap_usd: number | null;
  listed_at: string | null; gecko_id: string | null; symbol: string | null;
}
export interface Snapshot {
  as_of: string; source: string; floor_usd: number;
  protocols: SnapshotProtocol[]; watchlist: string[];
}
export const MODEL = {
  version: 'cross-section / 02', min_comps: 4,
  growth_floor: -60, growth_cap: 120, growth_weight: 0.5,
  maturity_floor: 0.65, maturity_range: 0.55, maturity_days: 365,
  unknown_age_days: 90, scale: 1.5, pool_share: 0.05, campaign_days: 84,
};
// Budget assumptions in USD, not quotes. Unknown chains use the conservative fallback.
// gas = one transaction; bridge = one inbound transfer (not needed if already funded).
export const CHAIN_COSTS: Record<string, { gas: number; bridge: number }> = {
  Ethereum: { gas: 4, bridge: 8 }, Bitcoin: { gas: 2, bridge: 5 },
  Solana: { gas: 0.02, bridge: 1 }, Base: { gas: 0.05, bridge: 1 },
  Arbitrum: { gas: 0.1, bridge: 1 }, Optimism: { gas: 0.1, bridge: 1 },
  Polygon: { gas: 0.03, bridge: 1 }, Avalanche: { gas: 0.05, bridge: 1 },
  BSC: { gas: 0.08, bridge: 1 }, Sui: { gas: 0.03, bridge: 1 },
  Aptos: { gas: 0.03, bridge: 1 }, Hyperliquid: { gas: 0.1, bridge: 1 },
  Unichain: { gas: 0.05, bridge: 1 }, Sonic: { gas: 0.03, bridge: 1 },
  Default: { gas: 1, bridge: 3 },
};
const EXCLUDED = new Set(['Bridge', 'Cross Chain Bridge', 'Canonical Bridge', 'Liquid Staking',
  'Liquid Restaking', 'Restaked BTC', 'CEX']);
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !EXCLUDED.has(p.category ?? '') &&
    !/\s(v\d+(\.\d+)?|\d+\.\d+)$/i.test(p.name) &&
    !/\b(wrapped|staked|staking)\b/i.test(p.name) &&
    !/^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)/i.test(p.name);
}
export function ageDays(asOf: string, listed: string | null): number | null {
  if (!listed) return null;
  const days = Math.floor((Date.parse(asOf) - Date.parse(listed)) / 86400000);
  return Number.isFinite(days) ? Math.max(0, days) : null;
}
export function sector(category: string | null): string {
  if (/Lending|CDP|Collateral|Stable|RWA|Reserve|CeDeFi/i.test(category ?? '')) return 'Credit & money';
  if (/Dex|Derivatives|Trading|Options|Synthetics|Prediction|Liquidity/i.test(category ?? '')) return 'Markets';
  if (/Yield|Farm|Curator|Allocator|Indexes|Vault/i.test(category ?? '')) return 'Asset management';
  return 'Infrastructure';
}
// Preserve every non-null source cap, including zero and the snapshot's -$1 anomaly.
// Quantiles are robust to that tiny negative ratio; the source anomaly stays auditable.
export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) throw new Error('No positive comparable ratios in snapshot');
  const at = (sorted.length - 1) * q, i = Math.floor(at);
  return sorted[i] + (sorted[Math.ceil(at)] - sorted[i]) * (at - i);
}
function stats(values: number[]) {
  const a = values.slice().sort((a, b) => a - b);
  return { count: a.length, low: quantile(a, 0.25), base: quantile(a, 0.5), high: quantile(a, 0.75) };
}
export interface Comp extends SnapshotProtocol { multiple: number; age_days: number | null }
export interface Calibration {
  scope: string; count: number; category_count: number; low: number; base: number; high: number;
  slugs: string[];
}
export function calibrate(p: SnapshotProtocol, comps: Comp[]): Calibration {
  const category = comps.filter(c => c.category === p.category);
  const group = comps.filter(c => sector(c.category) === sector(p.category));
  const selected = category.length >= MODEL.min_comps ? category : group.length >= MODEL.min_comps ? group : comps;
  const scope = selected === category ? 'Category' : selected === group ? `Sector: ${sector(p.category)}` : 'Global';
  return { ...stats(selected.map(c => c.multiple)), scope, category_count: category.length,
    slugs: selected.map(c => c.slug) };
}
export interface FarmStep { text: string; cost: string; time: string }
export interface BoardRow extends SnapshotProtocol {
  rank: number; implied_value_usd: number; range: { low: number; high: number };
  age_days: number | null; early: boolean; watchlist: boolean; comps: Calibration;
  factors: { growth: number; maturity: number; scale: number; multiple: number };
  farm_steps: string[]; plan: FarmStep[];
  farm: { chain: string; capital: number; weeks: number; gas: number; bridge: number;
    friction: number; cost: number; per_1k_cost: number; pool: number; per_1k: number; share: number };
  risks: string[];
}
function actionFor(p: SnapshotProtocol): { action: string; maintain: string; risk: string; friction: number } {
  const c = p.category ?? '';
  if (/Lending|Collateral/i.test(c)) return {
    action: 'Supply an accepted stablecoin to the deepest lending market; use supply-only exposure, not a recursive borrow loop',
    maintain: 'Review utilization, withdrawal liquidity and collateral parameters; top up only if the initial supply remains withdrawable',
    risk: 'Bad debt, oracle failure and withdrawal queues; do not borrow solely for points', friction: 0.001 };
  if (/CDP|Stable|Reserve/i.test(c)) return {
    action: 'Deposit supported collateral; if public minting exists, mint at no more than 25% loan-to-value and retain the debt asset for repayment',
    maintain: 'Check peg and collateral health weekly; repay immediately if the health buffer shrinks',
    risk: 'Depeg and liquidation; quoted budget excludes variable borrowing interest', friction: 0.003 };
  if (/Dex|Liquidity/i.test(c)) return {
    action: 'LP the deepest low-volatility pair with equal-value legs; confirm fee tier and keep the LP receipt',
    maintain: 'Check range weekly; rebalance once only if liquidity leaves range, never wash-trade for volume',
    risk: 'Impermanent loss, adverse selection and concentrated-liquidity range risk', friction: 0.004 };
  if (/Derivatives|Options|Trading|Synthetics|Prediction/i.test(c)) return {
    action: 'Use the public collateral or LP vault if offered; otherwise cap a fully collateralized test position at 10% of the budget with no leverage',
    maintain: 'Review funding, exposure and settlement weekly; close directional positions rather than manufacture volume',
    risk: 'Trading loss, funding and liquidation; vault availability is not recorded in this snapshot', friction: 0.006 };
  if (/RWA|CeDeFi/i.test(c)) return {
    action: 'Check jurisdiction, KYC and minimum subscription first; subscribe to the public asset vault only if eligible, otherwise skip',
    maintain: 'Review NAV, redemption windows and issuer attestations weekly; keep the subscription receipt',
    risk: 'Issuer default, offchain custody and gated redemptions; not all wallets are eligible', friction: 0.002 };
  if (/Chain|AI|Restaking|Staking Pool|Decentralized BTC/i.test(c)) return {
    action: 'Check for public native delegation; delegate to an independent validator if supported, otherwise skip rather than invent a deposit route',
    maintain: 'Check validator uptime, slashing rules and unbonding schedule weekly; retain delegation records',
    risk: 'Slashing, native-asset price and unbonding risk; validator hardware is outside this capital budget', friction: 0.002 };
  if (/Yield|Farm|Curator|Allocator|Vault|Indexes|Basis/i.test(c)) return {
    action: 'Deposit an accepted asset into the largest public vault; inspect underlying allocations and retain the vault shares',
    maintain: 'Review share price, allocations and exit liquidity weekly; no leverage and no forced weekly transactions',
    risk: 'Vault strategy loss, underlying protocol contagion and manager discretion', friction: 0.002 };
  return {
    action: 'Inspect the public app for an accepted deposit or service route; place one small supported position only after confirming eligibility, otherwise skip',
    maintain: 'Review the position and exit route weekly; record receipts without inventing reward eligibility',
    risk: 'Product route and permission requirements are absent from this category record', friction: 0.003 };
}
const dollars = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const round = (n: number) => Math.round(n * 100) / 100;
export function farmPlan(p: SnapshotProtocol, age: number | null, value: number) {
  const chains = p.chains.length ? p.chains : ['Unknown'];
  const costFor = (c: string) => CHAIN_COSTS[c] ?? CHAIN_COSTS.Default;
  const chain = chains.slice().sort((a, b) => costFor(a).gas - costFor(b).gas || a.localeCompare(b))[0];
  const { gas, bridge } = costFor(chain);
  const capital = Math.round(Math.min(5000, Math.max(250, p.tvl_usd * 0.00001)) / 50) * 50;
  const weeks = age === null || age < 180 ? 12 : age < 730 ? 8 : 6;
  const route = actionFor(p);
  const friction = round(capital * route.friction);
  // Budget: six setup/exit tx + one optional tx/week. Cost is an upper planning allowance.
  const cost = round((6 + weeks) * gas + bridge + friction);
  const per_1k_cost = round((6 + weeks) * gas + bridge + 1000 * route.friction);
  const pool = Math.round(value * MODEL.pool_share);
  const share = 1000 / (p.tvl_usd + 1000) * Math.min(1, weeks * 7 / MODEL.campaign_days);
  const per_1k = round(pool * share);
  const farm = { chain, capital, weeks, gas, bridge, friction, cost, per_1k_cost, pool, per_1k, share };
  const risks = [route.risk,
    age === null ? 'Listing age unknown; use 90 days in model' : age < 180 ? `Only ${age} days tracked; immature-contract flag` : `${age} days tracked is not an audit or a launch history`,
    p.change_7d === null ? '7d TVL unreported; neutral growth assumed' : p.change_7d < -10 ? `${p.change_7d.toFixed(1)}% 7d TVL drawdown: reduce size or skip` : 'TVL can include overlapping deposits; not unique capital'];
  const plan: FarmStep[] = [
    { text: `Verify ${p.name}'s official app, accepted assets, public access and any reward terms. ${age === null ? 'Age is unknown' : `Tracked for ${age} days`}; listing age is not contract age. Stop if access or a usable route cannot be verified.`, cost: '$0', time: '20 min' },
    { text: `Fund ${chain}, the lowest assumed gas chain in this record (${chains.length} chain${chains.length === 1 ? '' : 's'}). Budget ${dollars(capital)} capital, scaled at 0.001% of TVL and bounded $250–$5,000. Prefer native funding to avoid a bridge.`, cost: `${dollars(bridge)} bridge + ${dollars(gas)} gas`, time: '10–30 min' },
    { text: `${route.action} in ${p.name} on ${chain}, within ${dollars(capital)}. Confirm the required asset and market in-app; the snapshot records neither pool addresses nor points.`, cost: `${dollars(capital)} locked + ${dollars(3 * gas)} gas`, time: '20 min' },
    { text: `${route.maintain}. Hold for ${weeks} weeks; allow at most one maintenance transaction per week. ${route.risk}.`, cost: `≤ ${dollars(weeks * gas)} gas`, time: `${weeks} weeks / 10 min weekly` },
    { text: `Unwind, redeem and revoke approvals. Allow ${dollars(friction)} for route fees/slippage (${(route.friction * 100).toFixed(1)}% of capital); total cost budget ${dollars(cost)} excludes losses, yield, interest and taxes. ${p.change_7d !== null && p.change_7d < -10 ? 'TVL is drawing down: consider skipping.' : 'Check exit liquidity before adding funds.'}`, cost: `${dollars(2 * gas + friction)}`, time: '20 min + any exit queue' },
    { text: `Scenario per $1k: 5% of implied FDV (${dollars(pool)} pool) × 1000/(TVL+1000) × ${weeks * 7}/84 time weight (capped 1) = ${dollars(per_1k)} gross; cost budget ${dollars(per_1k_cost)}. Conditional pro-rata illustration, not expected profit: no launch probability, allocation or eligibility is known.`, cost: `${dollars(per_1k_cost)} per $1k all-in budget`, time: `${weeks} weeks; launch unknown` },
  ];
  return { farm, risks, plan, farm_steps: plan.map(s => `${s.text} Cost: ${s.cost}. Time: ${s.time}.`) };
}
export function buildRadar(snapshot: Snapshot) {
  // mcap is circulating capitalization, NOT FDV. 1.5x is an explicit supply-dilution scenario.
  const live = snapshot.protocols.filter(p => !isPreToken(p) || p.mcap_usd !== null)
    .map(p => ({ ...p, age_days: ageDays(snapshot.as_of, p.listed_at),
      multiple: p.mcap_usd === null ? null : p.mcap_usd / p.tvl_usd }));
  const comps: Comp[] = live.filter(p => p.mcap_usd !== null && p.tvl_usd > 0) as Comp[];
  if (!comps.length) throw new Error('Snapshot has no usable comparables');
  const watch = new Set(snapshot.watchlist);
  const board: BoardRow[] = snapshot.protocols.filter(isRankable).map(p => {
    const age = ageDays(snapshot.as_of, p.listed_at), calibration = calibrate(p, comps);
    const growth = 1 + Math.max(MODEL.growth_floor, Math.min(MODEL.growth_cap, p.change_7d ?? 0)) / 100 * MODEL.growth_weight;
    const maturity = MODEL.maturity_floor + MODEL.maturity_range * (1 - Math.exp(-(age ?? MODEL.unknown_age_days) / MODEL.maturity_days));
    const value = (multiple: number) => Math.max(1, Math.round(p.tvl_usd * multiple * growth * maturity * MODEL.scale));
    const implied = value(calibration.base);
    return { ...p, rank: 0, age_days: age, early: p.tvl_usd < snapshot.floor_usd, watchlist: watch.has(p.slug),
      comps: calibration, implied_value_usd: implied, range: { low: value(calibration.low), high: value(calibration.high) },
      factors: { growth, maturity, scale: MODEL.scale, multiple: calibration.base }, ...farmPlan(p, age, implied) };
  }).sort((a, b) => b.implied_value_usd - a.implied_value_usd || a.slug.localeCompare(b.slug));
  board.forEach((r, i) => { r.rank = i + 1; });
  const categories = [...new Set(snapshot.protocols.map(p => p.category))].map(category => {
    const own = comps.filter(c => c.category === category);
    return { category, own: own.length ? stats(own.map(c => c.multiple)) : null,
      used: calibrate({ category } as SnapshotProtocol, comps) };
  });
  const radar = { as_of: snapshot.as_of, source: snapshot.source, floor_usd: snapshot.floor_usd,
    model: MODEL, chain_costs: CHAIN_COSTS, categories, comp_count: comps.length,
    watchlist_size: watch.size, covered: board.filter(r => r.watchlist).length,
    board_size: board.length, early_size: board.filter(r => r.early).length, live_size: live.length,
    total_value: board.reduce((sum, r) => sum + r.implied_value_usd, 0), rows: board, live,
    limitations: 'No parentProtocol field is supplied. Apply observable product/name exclusions to all rows; the sealed watchlist is authoritative for coverage. Listing date is a tracking-age proxy, not proof of tokenless history. MC/TVL ratios are circulating-cap observations, scaled 1.5x for illustrative FDV, not measured FDV. Plans are category playbooks, not verified live routes.' };
  return { board, radar };
}
export function parseSnapshot(text: string): Snapshot {
  const s = JSON.parse(text);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.as_of) || typeof s.source !== 'string' ||
      !(s.floor_usd > 0) || !Array.isArray(s.protocols) || !Array.isArray(s.watchlist)) throw new Error('Invalid snapshot envelope');
  const seen = new Set();
  for (const p of s.protocols) {
    if (!p.slug || !p.name || seen.has(p.slug) || !Number.isFinite(p.tvl_usd) || p.tvl_usd <= 0 ||
        !Array.isArray(p.chains) || ![p.change_7d, p.mcap_usd].every(v => v === null || Number.isFinite(v))) throw new Error(`Invalid protocol: ${p.slug}`);
    seen.add(p.slug);
  }
  if (s.watchlist.some(slug => !seen.has(slug))) throw new Error('Watchlist references missing protocol');
  return s;
}
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `Invalid row count ${board.length}`;
  const slugs = new Set(board.map(r => r.slug));
  if (slugs.size !== board.length) return 'Duplicate slug';
  if (snapshot.watchlist.some(s => !slugs.has(s))) return 'Watchlist coverage incomplete';
  if (new Set(board.map(r => r.implied_value_usd)).size < 2) return 'Values do not discriminate';
  for (const [i, r] of board.entries()) {
    if (r.rank !== i + 1 || !isRankable(r)) return `Invalid rank or eligibility: ${r.slug}`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) return `Invalid value: ${r.slug}`;
    if (i && board[i - 1].implied_value_usd < r.implied_value_usd) return 'Not sorted';
    if (r.farm_steps.length < 4 || r.farm_steps.length > 7 || r.farm_steps.some(s => s.trim().length < 20 || s.trim().length > 600)) return `Invalid farm plan: ${r.slug}`;
  }
  return null;
}
export function dataScript(radar: ReturnType<typeof buildRadar>['radar']): string {
  return `window.RADAR=${JSON.stringify(radar).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')};\n`;
}