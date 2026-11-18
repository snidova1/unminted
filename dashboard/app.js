/* UNMINTED — no framework, no requests. main.ts writes window.RADAR beside dashboard/.
   The board, detail and six-step plan render the SAME rows written to board.json.
   verifyModel independently recomputes every base/range, quartile and fallback in the browser.
   No handpicked protocol names, fabricated price history or implied launch probability. */
(() => {
  'use strict';
  const D = window.RADAR, root = document.querySelector('#desk');
  if (!D) { root.textContent = 'Missing sealed data. Run main.ts and open out/dashboard/index.html.'; return; }
  const state = { q: '', category: '', chain: '', band: '', scope: '', live: false,
    sort: 'implied_value_usd', dir: -1, page: 0 };
  const PAGE = 10;
  const money = n => n == null ? '—' : (n < 0 ? '−$' : '$') + (Math.abs(n) >= 1e9 ? (Math.abs(n) / 1e9).toFixed(2) + 'B' : Math.abs(n) >= 1e6 ? (Math.abs(n) / 1e6).toFixed(1) + 'M' : Math.abs(n) >= 1e3 ? (Math.abs(n) / 1e3).toFixed(1) + 'K' : Math.abs(n).toFixed(2));
  const exact = n => '$' + Math.round(n).toLocaleString('en-US');
  const decimal = n => n == null ? '—' : n.toFixed(3) + '×';
  const pct = n => n == null ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  const age = n => n == null ? 'unknown' : n >= 365 ? (n / 365).toFixed(1) + 'y' : n + 'd';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const positive = n => n == null ? '' : n >= 0 ? 'positive' : 'negative';
  const sector = c => /Lending|CDP|Collateral|Stable|RWA|Reserve|CeDeFi/i.test(c || '') ? 'Credit & money' : /Dex|Derivatives|Trading|Options|Synthetics|Prediction|Liquidity/i.test(c || '') ? 'Markets' : /Yield|Farm|Curator|Allocator|Indexes|Vault/i.test(c || '') ? 'Asset management' : 'Infrastructure';
  const quantile = (a, q) => { const t = (a.length - 1) * q; return a[Math.floor(t)] + (a[Math.ceil(t)] - a[Math.floor(t)]) * (t - Math.floor(t)); };
  function verifyModel(r) {
    const all = D.live.filter(c => c.mcap_usd !== null && c.tvl_usd > 0);
    const category = all.filter(c => c.category === r.category), group = all.filter(c => sector(c.category) === sector(r.category));
    const comps = category.length >= 4 ? category : group.length >= 4 ? group : all;
    const ratios = comps.map(c => c.mcap_usd / c.tvl_usd).sort((a, b) => a - b);
    const growth = 1 + Math.max(-60, Math.min(120, r.change_7d ?? 0)) / 100 * 0.5;
    const maturity = 0.65 + 0.55 * (1 - Math.exp(-(r.age_days ?? 90) / 365));
    const value = q => Math.max(1, Math.round(r.tvl_usd * quantile(ratios, q) * growth * maturity * 1.5));
    return value(0.5) === r.implied_value_usd && value(0.25) === r.range.low && value(0.75) === r.range.high && comps.length === r.comps.count;
  }
  const verified = D.rows.every(verifyModel);
  window.UNMINTED = { verifyModel, verified, state };
  function mark() {
    return '<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="7"/><path d="M16 2v28M2 16h28M16 16L26 6"/><circle class="dot" cx="21" cy="11" r="2.5"/></svg>';
  }
  function header() {
    return `<header class="top"><a class="brand" href="#">${mark()}<b>UNMINTED<span>RESEARCH DESK</span></b></a><nav aria-label="Research sections"><a href="#" class="${!state.live ? 'active' : ''}" data-mode="pre">01 / RADAR</a><a href="#" class="${state.live ? 'active' : ''}" data-mode="live">02 / COMPARABLES</a></nav><div class="snapshot"><i></i> SEALED SNAPSHOT <strong>${esc(D.as_of)}</strong><span>DEFiLLAMA / ${D.model.version}</span></div></header>`;
  }
  function footer() {
    return `<footer><span>UNMINTED / RESEARCH, NOT A PRICE TARGET</span><span>NO TOKEN ON RECORD ≠ NO TOKEN EXISTS · NO LAUNCH OR ALLOCATION ASSUMED</span><span class="positive">${verified ? '✓ MODEL RECONCILED' : 'MODEL MISMATCH'}</span></footer>`;
  }
  function stat(label, value, note, cls = '') {
    return `<div class="stat"><span class="eyebrow">${label}</span><strong class="${cls}">${value}</strong><small>${note}</small></div>`;
  }
  function summary() {
    return `<div class="stats">${stat('WATCHLIST COVERED', D.covered + '<em> / ' + D.watchlist_size + '</em>', 'Every sealed watchlist slug', 'signal')}${stat('PRE-TOKEN UNIVERSE', D.board_size, 'Ranked, no size-based cap')}${stat('EARLY / BELOW $50M', D.early_size, 'The floor is not the ceiling')}${stat('TOKENED COMPS', D.comp_count, 'MC / TVL observations')}${stat('TOTAL IMPLIED FDV', money(D.total_value), 'Sum of base scenarios')}</div>`;
  }
  function options(values, selected, label) {
    return `<option value="">${label}</option>` + values.map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
  }
  function controls() {
    const all = state.live ? D.live : D.rows;
    return `<section class="controls" aria-label="Radar filters"><div class="control-row"><label class="search">SEARCH<input id="q" type="search" placeholder="Protocol, slug, category…" value="${esc(state.q)}"></label><label>CATEGORY<select id="category">${options([...new Set(all.map(r => r.category || 'Other'))].sort(), state.category, 'All categories')}</select></label><label>CHAIN<select id="chain">${options([...new Set(all.flatMap(r => r.chains))].sort(), state.chain, 'All chains')}</select></label><label>TVL BAND<select id="band">${options(['$5M–$50M', '$50M–$500M', '$500M+'], state.band, 'Any size')}</select></label><label>UNIVERSE<select id="scope" ${state.live ? 'disabled' : ''}>${options(['Watchlist only', 'Early only'], state.scope, 'All protocols')}</select></label><div class="switch" role="group" aria-label="Token status"><button data-mode="pre" aria-pressed="${!state.live}">Pre-token</button><button data-mode="live" aria-pressed="${state.live}">Token trades</button></div></div><div class="filter-line"><div id="chips"></div><span>↵ Open research note <span class="key">/</span> Search</span></div></section>`;
  }
  function filtered() {
    return (state.live ? D.live : D.rows).filter(r => {
      const text = [r.name, r.slug, r.category, ...r.chains].join(' ').toLowerCase();
      return (!state.q || text.includes(state.q.trim().toLowerCase())) &&
        (!state.category || (r.category || 'Other') === state.category) &&
        (!state.chain || r.chains.includes(state.chain)) &&
        (!state.scope || state.live || (state.scope === 'Watchlist only' ? r.watchlist : r.early)) &&
        (!state.band || (state.band === '$5M–$50M' ? r.tvl_usd < 5e7 : state.band === '$50M–$500M' ? r.tvl_usd >= 5e7 && r.tvl_usd < 5e8 : r.tvl_usd >= 5e8));
    }).sort((a, b) => {
      const get = r => state.sort === 'multiple' ? (r.factors?.multiple ?? r.multiple) : state.sort === 'implied_value_usd' && state.live ? r.mcap_usd : r[state.sort];
      const av = get(a), bv = get(b);
      // Missing observations always sort last in either direction.
      if (av == null || bv == null) return av == null && bv == null ? a.slug.localeCompare(b.slug) : av == null ? 1 : -1;
      return (typeof av === 'string' ? av.localeCompare(bv) : av - bv) * state.dir || a.slug.localeCompare(b.slug);
    });
  }
  function sortHead(key, text, cls = '') {
    const active = state.sort === key;
    return `<th scope="col" class="${cls}" aria-sort="${active ? state.dir === 1 ? 'ascending' : 'descending' : 'none'}"><button data-sort="${key}">${text}<span>${active ? state.dir === 1 ? '↑' : '↓' : '↕'}</span></button></th>`;
  }
  function rangeGlyph(r) {
    const max = Math.max(r.range.high, 1), x = n => 4 + 100 * n / max;
    return `<svg class="range" viewBox="0 0 110 16" role="img" aria-label="Low ${exact(r.range.low)}, base ${exact(r.implied_value_usd)}, high ${exact(r.range.high)}"><path d="M${x(r.range.low)} 8H${x(max)}"/><path d="M${x(r.range.low)} 4v8M${x(max)} 4v8"/><circle cx="${x(r.implied_value_usd)}" cy="8" r="3"/></svg>`;
  }
  function table(list) {
    const rows = list.slice(state.page * PAGE, (state.page + 1) * PAGE);
    return `<div class="table-top"><h2>${state.live ? 'Tokened comparables' : 'Launch radar'} <span>${String(list.length).padStart(3, '0')} OBSERVATIONS</span></h2><span>${state.live ? 'Observed circulating cap · not FDV' : 'Base implied FDV · USD · descending by default'}</span></div><div class="table-scroll"><table class="radar-table"><caption class="sr-only">${state.live ? 'Already-tokened protocols, excluded from the launch ranking' : 'Pre-token protocols ranked by implied FDV. Activate a name for the full research note.'}</caption><thead><tr>${sortHead('rank', '#', 'rank')}${sortHead('name', 'PROTOCOL', 'protocol')}${sortHead('tvl_usd', 'TVL', 'num')}${sortHead('change_7d', '7D Δ', 'num')}${sortHead('age_days', 'AGE', 'num')}${sortHead('multiple', 'MC/TVL', 'num')}${sortHead('implied_value_usd', state.live ? 'MCAP' : 'IMPLIED FDV', 'num')}<th scope="col">${state.live ? 'TOKEN' : 'Q1 / BASE / Q3'}</th></tr></thead><tbody>${rows.map(r => `<tr data-slug="${esc(r.slug)}"><td class="rank num">${r.rank ? String(r.rank).padStart(2, '0') : '—'}</td><td><div class="protocol-name">${state.live ? `<span>${esc(r.name)}</span>` : `<a href="#${encodeURIComponent(r.slug)}">${esc(r.name)}</a>`}${!state.live && r.watchlist ? '<span class="watch" title="Sealed watchlist">W</span>' : !state.live && r.early ? '<span class="early">EARLY</span>' : ''}</div><small>${esc(r.category || 'Other')} <span class="chain-label">/ ${esc(r.chains[0] || 'Unknown')}${r.chains.length > 1 ? ' +' + (r.chains.length - 1) : ''}</span></small></td><td class="num">${money(r.tvl_usd)}</td><td class="num ${positive(r.change_7d)}">${pct(r.change_7d)}</td><td class="num muted">${age(r.age_days)}</td><td class="num muted">${decimal(r.factors?.multiple ?? r.multiple)}<small>${r.comps ? 'n=' + r.comps.count : 'observed'}</small></td><td class="num value" title="${exact(state.live ? r.mcap_usd ?? 0 : r.implied_value_usd)}">${money(state.live ? r.mcap_usd : r.implied_value_usd)}</td><td>${state.live ? `<span class="badge">${esc(r.symbol || 'MCAP RECORDED')}</span>` : rangeGlyph(r)}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">No matching protocols. Clear a filter to widen the scan.</td></tr>'}</tbody></table></div><div class="pagination"><span>SHOWING ${list.length ? state.page * PAGE + 1 : 0}–${Math.min(list.length, (state.page + 1) * PAGE)} OF ${list.length} <span class="muted">/ W = WATCHLIST</span></span><div><button id="prev" ${state.page === 0 ? 'disabled' : ''} aria-label="Previous page">←</button><span>${state.page + 1} / ${Math.max(1, Math.ceil(list.length / PAGE))}</span><button id="next" ${(state.page + 1) * PAGE >= list.length ? 'disabled' : ''} aria-label="Next page">→</button></div></div>`;
  }
  function distribution(list) {
    const groups = Object.entries(list.reduce((a, r) => { const key = r.category || 'Other'; a[key] = (a[key] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
    const max = groups[0]?.[1] || 1;
    return groups.slice(0, 5).map(([c, n]) => `<div class="dist"><div><span>${esc(c)}</span><b>${n}</b></div><div class="track"><i style="width:${n / max * 100}%"></i></div></div>`).join('');
  }
  function sidebar(list) {
    const tvl = list.reduce((sum, r) => sum + r.tvl_usd, 0);
    const up = list.filter(r => r.change_7d > 0).length;
    return `<aside class="rail"><section><div class="section-label">01 / SCAN COMPOSITION</div><h3>${money(tvl)} <small>TVL in view</small></h3>${distribution(list)}<div class="breadth"><span>${up} expanding</span><span>${list.filter(r => r.change_7d < 0).length} contracting</span></div><div class="breadth-bar" role="img" aria-label="${up} protocols with positive 7-day growth"><i style="width:${list.length ? up / list.length * 100 : 0}%"></i></div><p class="tiny">Cross-sectional counts. No price or TVL history is supplied.</p></section><section><div class="section-label">02 / VALUATION ENGINE</div><div class="mini-formula">TVL × MC/TVL<br>× growth × maturity × 1.5</div><p>Category median from ≥4 tokened comps. Thin sample? Sector, then global fallback.</p><div class="rail-rule"><span>Growth multiplier</span><b>0.70–1.60×</b></div><div class="rail-rule"><span>Maturity multiplier</span><b>0.65–1.20×</b></div><div class="rail-rule"><span>FDV scale assumption</span><b>1.50×</b></div><button class="text-button" id="method-open">Read model & assumptions ↗</button></section><section class="research-note"><div class="section-label">RESEARCH NOTE / 001</div><p>No token on record is a discovery signal, not proof of a future launch.</p><span>Capitalization ≠ claimable value.</span></section></aside>`;
  }
  function drawTable() {
    const list = filtered();
    state.page = Math.min(state.page, Math.max(0, Math.ceil(list.length / PAGE) - 1));
    document.querySelector('#results').innerHTML = table(list);
    document.querySelector('#rail').innerHTML = sidebar(list);
    const chips = ['q', 'category', 'chain', 'band', 'scope'].filter(k => state[k]);
    document.querySelector('#chips').innerHTML = chips.length ? chips.map(k => `<button class="chip" data-clear="${k}">${esc(k === 'q' ? 'Search: ' + state[k] : state[k])} <span>×</span></button>`).join('') + '<button class="clear" data-clear="all">Reset filters</button>' : '<span class="muted">ALL CATEGORIES / ALL CHAINS / ALL SIZES</span>';
    document.querySelector('#count-announcement').textContent = list.length + ' protocols match';
    bindTable();
  }
  function bindTable() {
    document.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => {
      state.dir = state.sort === b.dataset.sort ? -state.dir : b.dataset.sort === 'rank' || b.dataset.sort === 'name' ? 1 : -1;
      state.sort = b.dataset.sort; state.page = 0; drawTable();
      document.querySelector(`[data-sort="${state.sort}"]`).focus();
    });
    document.querySelectorAll('[data-clear]').forEach(b => b.onclick = () => {
      if (b.dataset.clear === 'all') ['q', 'category', 'chain', 'band', 'scope'].forEach(k => state[k] = '');
      else state[b.dataset.clear] = '';
      state.page = 0; renderBoard();
    });
    document.querySelector('#prev').onclick = () => { state.page--; drawTable(); };
    document.querySelector('#next').onclick = () => { state.page++; drawTable(); };
    document.querySelector('#method-open').onclick = openMethod;
    document.querySelectorAll('tbody tr[data-slug]').forEach(tr => tr.onclick = e => {
      if (!state.live && !e.target.closest('a')) location.hash = encodeURIComponent(tr.dataset.slug);
    });
  }
  function bindHeader() {
    document.querySelectorAll('[data-mode]').forEach(b => b.onclick = e => {
      e.preventDefault(); state.live = b.dataset.mode === 'live'; state.page = 0;
      state.scope = ''; state.sort = 'implied_value_usd'; state.dir = -1;
      history.replaceState(null, '', location.pathname); renderBoard();
    });
  }
  function renderBoard() {
    root.innerHTML = `${header()}<main id="content" tabindex="-1"><div class="intro"><div><div class="eyebrow">TOKEN LAUNCH INTELLIGENCE / ${D.as_of.replaceAll('-', '.')}</div><h1>Before the ticker.</h1></div><p>Find the protocols. Price the possibility.<br><span>Snapshot-derived valuations. Costed farm playbooks. No invented certainty.</span></p><div class="edition">RADAR / 01<span>FROZEN DATA · OFFLINE DESK</span></div></div>${summary()}${controls()}<div class="workspace"><section id="results" aria-label="Protocol results"></section><div id="rail"></div></div><span id="count-announcement" class="sr-only" role="status" aria-live="polite"></span></main>${footer()}`;
    bindHeader(); drawTable();
    ['q', 'category', 'chain', 'band', 'scope'].forEach(k => {
      const input = document.getElementById(k);
      input.addEventListener(k === 'q' ? 'input' : 'change', () => { state[k] = input.value; state.page = 0; drawTable(); });
    });
  }
  function factorCell(label, value, note) {
    return `<div class="factor"><span>${label}</span><b>${value}</b><small>${note}</small></div>`;
  }
  function renderDetail(r) {
    const f = r.factors, farm = r.farm;
    const comps = D.live.filter(c => r.comps.slugs.includes(c.slug)).sort((a, b) => b.mcap_usd - a.mcap_usd);
    root.innerHTML = `${header()}<main id="content" class="detail-page" tabindex="-1"><div class="breadcrumb"><a href="#">← Back to radar</a><span>RESEARCH NOTE / ${String(r.rank).padStart(3, '0')}</span><span class="positive">${verifyModel(r) ? '✓ RECOMPUTED FROM SNAPSHOT' : 'MODEL MISMATCH'}</span></div><div class="detail-title"><div><span class="eyebrow">${esc(r.category || 'Other')} / ${r.watchlist ? 'SEALED WATCHLIST' : r.early ? 'EARLY DISCOVERY' : 'EXTENDED UNIVERSE'}</span><h1>${esc(r.name)} <span>#${String(r.rank).padStart(2, '0')}</span></h1><p>${esc(r.chains.join(' · ') || 'Chain unreported')}</p></div><div class="valuation"><span class="eyebrow">BASE IMPLIED FDV</span><strong>${money(r.implied_value_usd)}</strong><span>Q1 ${money(r.range.low)} <i>—</i> Q3 ${money(r.range.high)}</span></div></div><div class="stats detail-stats">${stat('SUGGESTED CAPITAL', money(farm.capital), '0.001% TVL · $250–$5k bounds')}${stat('COST BUDGET', money(farm.cost), 'Gas, inbound bridge, friction')}${stat('HOLD WINDOW', farm.weeks + '<em> weeks</em>', '10 minutes review / week')}${stat('GROSS / $1K SCENARIO', money(farm.per_1k), '5% pool · time-weighted share', 'signal')}${stat('COST / $1K', money(farm.per_1k_cost), 'Net scenario ' + money(farm.per_1k - farm.per_1k_cost))}</div><div class="detail-grid"><div class="detail-left"><section class="sheet"><div class="section-label">01 / WORKED VALUATION</div><div class="factor-grid">${factorCell('TVL', money(r.tvl_usd), exact(r.tvl_usd))}${factorCell('MC/TVL', decimal(f.multiple), r.comps.scope + ' · n=' + r.comps.count)}${factorCell('7d growth', decimal(f.growth), pct(r.change_7d) + ' raw Δ')}${factorCell('Maturity', decimal(f.maturity), r.age_days == null ? '90d assumed' : r.age_days + ' days tracked')}${factorCell('FDV scale', decimal(f.scale), 'Supply-dilution assumption')}${factorCell('Base result', money(r.implied_value_usd), exact(r.implied_value_usd))}</div><p class="calc-line">${money(r.tvl_usd)} × ${f.multiple.toFixed(4)} × ${f.growth.toFixed(4)} × ${f.maturity.toFixed(4)} × 1.5</p><div class="range-labels"><span>Q1 ${money(r.range.low)}</span>${rangeGlyph(r)}<span>Q3 ${money(r.range.high)}</span></div><p class="tiny">Growth = 1 + 0.5 × clamp(7d, −60, 120)/100. Maturity = 0.65 + 0.55 × (1 − exp(−age/365)). Null growth = 0; null age = 90d.</p></section><section class="sheet comps"><div class="section-label">02 / COMPARABLE EVIDENCE</div><p>${esc(r.comps.scope)} sample: <b>${r.comps.count}</b> comps (${r.comps.category_count} same-category). Below 4: sector → global. Largest caps shown; every comp enters quantiles.</p><table><thead><tr><th>TRADING TOKEN</th><th class="num">MCAP</th><th class="num">MC/TVL</th></tr></thead><tbody>${comps.slice(0, 4).map(c => `<tr><td>${esc(c.name)}</td><td class="num">${money(c.mcap_usd)}</td><td class="num">${decimal(c.multiple)}</td></tr>`).join('')}</tbody></table><div class="quartiles"><span>Q1 <b>${decimal(r.comps.low)}</b></span><span>MED <b>${decimal(r.comps.base)}</b></span><span>Q3 <b>${decimal(r.comps.high)}</b></span></div></section><section class="risk-box"><div class="section-label">03 / RISK FLAGS</div><ul>${r.risks.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section></div><section class="sheet farm-sheet"><div class="farm-head"><div><div class="section-label">04 / EXECUTION PLAYBOOK</div><h2>A measured position, not a points chase.</h2></div><span class="badge">${esc(farm.chain)} / ${farm.weeks} WEEKS</span></div><p class="farm-intro">Category-derived route. Verify current assets and eligibility before funding; the sealed record does not confirm rewards or an executable market.</p><table class="farm-table"><thead><tr><th>#</th><th>ACTION / DECISION</th><th>COST ALLOWANCE</th><th>DURATION</th></tr></thead><tbody>${r.plan.map((s, i) => `<tr><td class="step-num">${String(i + 1).padStart(2, '0')}</td><td>${esc(s.text)}</td><td class="cost-col">${esc(s.cost)}</td><td class="time-col">${esc(s.time)}</td></tr>`).join('')}</tbody></table><div class="pool-note"><div><span class="eyebrow">ILLUSTRATIVE AIRDROP POOL</span><strong>${money(farm.pool)}</strong><small>5% of base FDV, not a forecast</small></div><p>Per $1k share = 1000 / (TVL + 1000) × min(1, ${farm.weeks * 7}/84) = ${(farm.share * 100).toFixed(6)}%. Gross ${money(farm.per_1k)} − cost ${money(farm.per_1k_cost)} = ${money(farm.per_1k - farm.per_1k_cost)} net scenario. No launch probability is known; expected return cannot be inferred.</p></div></section></div><div class="detail-bottom"><span>Circulating market cap is not FDV. The 1.5× scale is an assumption. Tracking age does not establish tokenless history.</span><button class="text-button" id="method-open">Full methodology & chain costs ↗</button></div></main>${footer()}`;
    bindHeader(); document.querySelector('#method-open').onclick = openMethod;
    document.querySelector('#content').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  function openMethod() {
    const modal = document.createElement('dialog'); modal.className = 'method'; modal.setAttribute('aria-labelledby', 'method-title');
    modal.innerHTML = `<div class="method-head"><div><span class="eyebrow">RESEARCH METHODOLOGY / ${D.model.version}</span><h2 id="method-title">Show the assumptions.</h2></div><button id="close-method">Close ×</button></div>
      <h3>Cross-sectional calibration</h3><p>Every non-null mcap_usd / tvl_usd observation enters the sample, including zero caps and the snapshot's −$1 source anomaly; none are silently cleaned. Use category quartiles with ≥4 comps; otherwise sector quartiles with ≥4, then global. Linear interpolation at 25%, 50%, 75%. No name overrides or outlier removal. Q1/Q3 describe sample spread, not confidence bounds.</p>
      <p>Credit & money = lending, CDP, collateral, stable, RWA, reserve, CeDeFi. Markets = DEX, derivatives, trading, options, synthetics, prediction, liquidity. Asset management = yield, farms, curators, allocators, indexes, vaults. Everything else = infrastructure. Rules are case-insensitive category matches in that order.</p>
      <div class="method-equation">FDV = TVL × sample MC/TVL × [1 + 0.5 × clamp(7d, −60, 120)/100]<br>× [0.65 + 0.55 × (1 − exp(−age/365))] × 1.5</div>
      <p>Unknown growth is neutral (0%); unknown age uses 90 days. Age is measured against ${D.as_of}, never today's clock. Maturity has diminishing returns toward 1.20×. The 1.5× scale is an assumed FDV/circulating-cap conversion; actual token supply is unknown.</p>
      <h3>Cost and allocation assumptions</h3><p>Capital = 0.001% of TVL, bounded $250–$5,000, rounded to $50. Hold 12 weeks if age unknown or &lt;180d, 8 if &lt;730d, else 6. Cheapest listed chain by assumed gas is selected; asset availability must be checked. Budget (6 + hold weeks) transactions + one inbound bridge + category friction: lending 0.1%, vault/RWA/delegation 0.2%, mint/general 0.3%, LP 0.4%, trading 0.6%. Loss, funding, interest, taxes and opportunity cost are excluded.</p>
      <p>Pool = 5% of modeled FDV. A $1,000 position receives pool × 1000/(TVL+1000) × min(1, hold days/84), assuming static TVL, a uniform 12-week campaign and pro-rata eligibility. This is conditional gross exposure, not expected profit; actual allocation or probability may be zero.</p>
      <table><thead><tr><th>CHAIN ASSUMPTION</th><th>GAS / TX</th><th>INBOUND BRIDGE</th></tr></thead><tbody>${Object.entries(D.chain_costs).map(([c, v]) => `<tr><td>${esc(c)}</td><td class="num">${money(v.gas)}</td><td class="num">${money(v.bridge)}</td></tr>`).join('')}</tbody></table>
      <h3>Universe and evidence limits</h3><p>Pre-token means both gecko_id and symbol are null. Observable wrapped/staked names, version suffixes, exchange prefixes and bridge/staking/CEX product categories are excluded. No TVL floor or row cap is applied to the remaining universe. Tokened observations are kept outside the ranked board.</p><p>${esc(D.limitations)}</p><p class="tiny">Source: ${esc(D.source)}</p>`;
    document.body.append(modal); modal.querySelector('#close-method').onclick = () => modal.close();
    modal.addEventListener('close', () => modal.remove()); modal.showModal();
  }
  function route() {
    let slug; try { slug = decodeURIComponent(location.hash.slice(1)); } catch { slug = ''; }
    const row = D.rows.find(r => r.slug === slug);
    if (row) renderDetail(row); else renderBoard();
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('keydown', e => {
    if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) {
      const search = document.querySelector('#q'); if (search) { e.preventDefault(); search.focus(); }
    }
  });
  route();
})();