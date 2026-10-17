# Implementation status — Pyramid Risk Lab v1.1.0

**Prototype audit:** complete. The previous two HTML prototypes and research note were inspected.  
**Implementation:** v1.1 prototype-derived improvements committed.  
**Deployment:** not performed; this remains a local browser app.

| Status | Work item | Evidence / decision |
|---|---|---|
| PASS ✅ | Leverage pyramiding | Weighted entries, trigger-based adds, weighted-average entry, bounded add count. |
| PASS ✅ | In-browser simulator + optimizer | Local HTML/JS, deterministic 3×3×3 candidate grid. |
| PASS ✅ | Liquidation and margin-add math | Conditional liquidation equation and add cap constrained by safety gap and initial margin. |
| PASS ✅ | Correlated paths, shared equity | Seeded two-asset log returns with shared wallet cash/equity. |
| PASS ✅ | Deterministic ladder + stop gates | Ladder rows show triggers, status, pre/post gap and liquidation/retrace estimates. |
| PASS ✅ | UI, charts and exports | Risk controls, SVG chart, cost metrics, ladder, optimizer, leverage scan, CSV and JSON. |
| PASS ✅ | Hard/trailing/breakeven exits | Portfolio-level hard stop, equity trailing stop and breakeven lock. |
| PASS ✅ | Safety-buffer sizing | Gate accounts for fee and slippage costs and bounds margin utilization. |
| PASS ✅ | Liquidation/retrace metrics | Conditional single-asset solution with other mark prices held fixed. |
| PASS ✅ | Equity drift and ruin | Per-step equity, drawdown, maintenance checks, liquidation and terminal ruin stats. |
| PASS ✅ | Percentile bands | P10/P50/P90 terminal metrics and time-series chart bands. |
| PASS ✅ | Buy-and-hold baseline | Same-capital, unlevered synthetic spot baseline with entry/exit friction. |
| PASS ✅ | Per-step risk reporting | Equity series, drawdown, exit reason, liquidation/ruin rates. |
| PASS ✅ | Prototype funding input | Configurable rate per 8h, scaled by step duration and average notional. |
| PASS ✅ | Prototype slippage input | Per-side cost on entry, adds and modeled exits; included in add safety gate. |
| PASS ✅ | Prototype leverage scan | Leverage candidates evaluated on common seeded paths; median/mean, liquidation, ruin and drawdown included. |
| PASS ✅ | Prototype stress shocks | Optional common negative/positive shock term, reproducible by seed, disabled by default. |
| DEFERRED | Three-asset extension | Old prototype had three tokens but isolated token accounting. Generalize account-level maintenance/liquidation algebra first. |
| DEFERRED | Volatility-scaled per-asset stop and precise ROE trigger semantics | Preserve current equity trailing stop and price-step add trigger until legacy semantics are specified and tested. |

## Risk-model qualifications

Funding uses a constant rate and average pre/post-step notional. Slippage is an additive cost, not an execution-price simulation. Tail-shock parameters are stress assumptions, not empirically calibrated distributions. Constant maintenance margin and zero-equity liquidation are approximations; this is not live trading software.
