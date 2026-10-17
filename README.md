# Pyramid Risk Lab v1.1.0

A local-first browser simulator for researching long-only leveraged crypto pyramiding in a simplified shared cross-margin account. It is an analytical sandbox, not an exchange connector, bot, live quote feed, or investment recommendation.

## Run locally

- Open `standalone.html` in a modern browser. No install, API keys, or network calls are required.
- For editable source, keep `index.html` and `engine.js` together.
- Run `npm test` with Node.js 22+.
- Rebuild the one-file app with `npm run build:standalone`.
- **Scan leverage** evaluates leverage candidates against the same seeded paths.
- **Find safer settings** ranks parameter candidates using the same seeded sample.

## Included

- Seeded correlated synthetic paths for two long-only assets and shared account equity.
- Per-side fees and slippage costs on entries, adds, and modeled exits.
- Configurable funding per eight hours, scaled by hours per step and average pre/post-step notional. Negative rates credit the account.
- Optional reproducible common tail shocks, disabled by default.
- Pyramid additions constrained by a liquidation safety-gap gate and initial-margin utilization limit.
- Hard stops, equity trailing stops, breakeven locks, deterministic ladder math, conditional liquidation estimates, and retrace metrics.
- Per-step equity/drawdown/ruin tracking, P10/P50/P90 bands, a same-capital spot buy-and-hold baseline, strategy optimizer and leverage scan.
- Responsive local UI, SVG chart, exit breakdown, CSV/JSON export, regression tests, and GitHub Actions CI.

## Core approximations

For asset i: quantity qᵢ, mark Pᵢ, average entry Eᵢ; maintenance rate m; execution cost rate c = fee + slippage; wallet cash C; target gap b:

```text
Equity = C + Σ qᵢ(Pᵢ − Eᵢ)
Maintenance = Σ m qᵢ Pᵢ
D = Σ qᵢ Pᵢ(1 − m)
H = Equity − Maintenance
N_safe = max(0, (H − bD) / (m + c + b(1 − m)))
```

Add notional is limited by both the safety-gap constraint and available initial-margin capacity. The conditional liquidation price solves Equity = Maintenance for one asset while holding the other asset's mark fixed. It is not the same as an account-wide liquidation trigger.

The path model uses correlated log returns. Drift/volatility apply per configured step. Hours-per-step scales funding carry and converts the daily shock probability into per-step probability. A shock adds a common log-return jump to both assets. These parameters are stress assumptions, not calibrated market forecasts.

## Known limits

Maintenance margin is a flat rate. Exchange risk tiers, partial liquidation, liquidation fees, order-book fill-price impact, outages, shorts/hedges and live data are not modeled. Slippage is an additive cost, not a changed fill price. Funding is constant within a run and estimated from average pre/post-step notional. Liquidation is conservatively modeled as a full loss of remaining equity after the maintenance threshold is crossed.

The previous prototypes **Pyramid Lab (1).html**, **Pyramid Lab (2).html**, and **Pyramid Lab.md** are preserved for historical comparison. Their funding/slippage inputs, common-jump concept and leverage scan informed v1.1. Their isolated per-token liquidation accounting was not copied because it does not represent a shared cross-margin wallet.

Three independently configured assets and the older volatility-scaled per-token trailing rule are deferred. They require explicit account-wide math and dedicated regression tests rather than adding controls around the two-asset engine.
