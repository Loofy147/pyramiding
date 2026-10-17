# Pyramid Risk Lab

A local-first, dependency-free browser simulator for researching leveraged crypto pyramiding under a simplified shared cross-margin account. It is a risk-analysis sandbox, not a trading bot, exchange connector, live quote feed, or investment recommendation.

## Start

- Open **standalone.html** in a modern browser for the one-file version. It needs no install, API key, or network request.
- For editable source, open **index.html** with **engine.js** beside it.
- Run automated checks with Node.js 22 or a compatible modern version: **npm test**.
- Rebuild the single-file version with **npm run build:standalone**.

## Included

- Seeded correlated synthetic paths for two assets sharing account equity.
- Long-only linear positions, weighted-average entries, maintenance margin, estimated trading fees, and a conditional liquidation calculation.
- Pyramid additions gated by a measured liquidation-safety gap and maximum initial-margin utilization.
- Deterministic ladder calculations, hard stops, equity trailing stops, and breakeven locks.
- Equity and drawdown tracking, conservative liquidation/ruin classification, terminal percentile bands, and a same-capital spot buy-and-hold baseline.
- A seeded parameter-grid optimizer, SVG chart, exit breakdown, CSV curve export, and JSON run export.
- Automated regression tests and a GitHub Actions workflow.

## Model boundaries

Price paths are synthetic and reproducible, not market forecasts. The liquidation estimate assumes fixed marks for the other asset and a constant maintenance-margin rate. Exchange-specific maintenance tiers, funding, basis, slippage, partial liquidation, and execution details are not fully modeled. Verify venue rules before using exchange-specific numbers. Never treat a simulated safety buffer as a guarantee against liquidation.

Historical prototypes are retained as **Pyramid Lab (1).html**, **Pyramid Lab (2).html**, and **Pyramid Lab.md**. The v1.0.0 implementation starts at **index.html**.