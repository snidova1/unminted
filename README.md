# unminted

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/snidova1/unminted/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/snidova1/unminted/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

UNMINTED is an offline token-launch research desk: every eligible protocol in the sealed DefiLlama snapshot is ranked by an explicit implied FDV, including the full 40-slug watchlist and early discoveries below $50M. A graphite/chartreuse terminal pairs sortable, filterable research with protocol detail notes, snapshot-derived comparables, valuation ranges and six-step, costed farm playbooks. No framework, remote assets or live API dependencies.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

Open `out/dashboard/index.html` directly in a browser. `input/` and `out/` are intentionally gitignored; copy the kit's read-only snapshot into `input/snapshot.json` before running.

## Value model

For each category, compute the quartiles and median of every non-null token market cap / TVL observation, retaining zero caps and the snapshot's −$1 source anomaly. Use ≥4 category comps, otherwise ≥4 sector comps, otherwise the global sample. Every note shows scope, count, sample ratios and the largest tokened comparables; tokened protocols stay outside the launch ranking.

`Implied FDV = TVL × sample multiple × growth × maturity × 1.5`.

Growth is `1 + 0.5 × clamp(change_7d, -60, 120) / 100`; missing growth is neutral. Maturity is `0.65 + 0.55 × (1 - exp(-age_days / 365))`, with 90 days for missing age. Age is measured at the snapshot date, not the machine clock. The 1.5× factor is an explicit supply-dilution assumption: circulating market cap is not FDV. Q1/base/Q3 are comparable-spread scenarios, not statistical confidence bounds or launch-price predictions. The browser independently recomputes all three values for every ranked row.

Plans choose a category-specific action and the lowest assumed gas chain in each record. Position size is 0.001% of TVL, bounded $250–$5,000; hold windows are 6, 8 or 12 weeks by tracking age. The model contains a single per-chain gas/bridge cost table. Every plan includes setup, funding, participation, monitoring, exit and a conditional per-$1k allocation calculation: 5% of implied FDV × `1000/(TVL+1000)` × `min(1, hold_days/84)`. It reports gross and net scenarios separately from capital and cost budgets. No launch probability or actual reward eligibility is inferred.

The snapshot omits parent-protocol metadata, accepted assets, pool addresses and reward terms. Observable product/name exclusions are applied without a TVL floor; parent relationships cannot be reconstructed. Listing age is a tracking proxy, not contract age or proof of tokenless history. Plans are explicit category playbooks with access checks, not claims of verified live routes. Risks and excluded costs are stated in the research notes.

## Verify and capture

```sh
node tools/verify.mjs
npm exec --package=playwright -- node tools/capture.mjs
MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
node tools/verify.mjs
```

Capture uses installed Chrome/Edge at 1440×900, scale 1, serves only `out/` on loopback, exercises interactions and file-mode loading, and writes the three screenshots. Set `PLAYWRIGHT_MODULE` or `CHROME_PATH` to use another local install. Runtime generation remains Node standard-library only. The verification tool independently mirrors all seven published gate rows; it is not the unpublished house scorer. The kit's `grade-local` cannot execute that sealed scorer from this public kit.

---

<sub>Entered on [make.fun](https://make.fun/?ref=tcfec296&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
