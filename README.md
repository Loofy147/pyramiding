# Pyramid Risk Lab v1.2.0

A local-first browser simulator for managing profit capture after an initial leveraged crypto ticket is already open. It does not discover entries, markets or tokens.

## Start

- Open **standalone.html** in a modern browser. No install, API key or network call is required.
- For editable source, keep **index.html** and **engine.js** together.
- Run `npm test` with Node.js 22+.
- Rebuild the one-file app with `npm run build:standalone`.
- **Optimize trend rider** ranks add/exit profiles on common seeded price paths while keeping the entry, leverage, initial-margin percentage and margin-use cap fixed.

## Profit-extraction features

- Seeded correlated synthetic paths for two long-only assets sharing account equity.
- Per-side fees/slippage, funding scaled by hours per step, optional common tail shocks.
- Add safety-gap gates, initial-margin utilization limits, deterministic ladder, hard stops, trailing-equity stops and breakeven locks.
- Two separate comparisons: (1) unleveraged spot buy-and-hold, and (2) holding the same initial leveraged ticket without adds or strategy exits.
- Upside optimizer searches add size/spacing/count and trailing-stop width/activation; rider candidates deliberately disable hard stop and breakeven lock.
- P10/P50/P90 equity, drawdown, liquidation/ruin, accepted-add/funding/cost summaries, SVG chart, CSV/JSON exports, tests and GitHub Actions.

## Model boundaries

The add safety cap approximates constant-rate maintenance margin. The conditional liquidation price for one asset holds the other asset mark fixed; it is not an exchange's universal cross-margin liquidation trigger. The first-ticket baseline uses the same initial positions, fees/slippage, funding and price path, but has no adds or strategy exits. The spot baseline is independent and unleveraged.

Paths are synthetic, not calibrated forecasts. Funding uses a constant rate over each run and average pre/post-step notional. Slippage is a cost rather than simulated fill-price impact. Flat maintenance margin, no partial liquidation, no tiered risk, no liquidation penalties and no order-book gaps are modeled. Never treat a simulated buffer as a guarantee against liquidation.

See **UPTREND_SIMULATION_REPORT.md** for study design, matched-path outcomes, trade-offs and next tests. Historical prototypes remain **Pyramid Lab (1).html**, **Pyramid Lab (2).html** and **Pyramid Lab.md**.
