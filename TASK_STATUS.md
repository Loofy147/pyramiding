# Implementation status — Pyramid Risk Lab v1.2.0

**Scope:** maximize profit capture from an already-open ticket in an uptrend. No entry or market discovery.  
**Simulation study:** five synthetic scenarios × three seeds × 1,800 paths per seed/scenario × five fixed-entry profiles.  
**Local verification:** 34 tests pass; standalone build is reproducible. Repository CI is the authoritative committed-code check.  
**Deployment:** not performed.

| Status | Feature | Evidence |
|---|---|---|
| PASS ✅ | Fixed-entry strategy experiments | Matched path comparison of current defaults, no-add first ticket, balanced rider, aggressive rider and cautious rider. |
| PASS ✅ | Hold-first-ticket counterfactual | Same initial positions, costs, funding and maintenance rules; no adds or strategy exits. |
| PASS ✅ | Distinct spot comparator | Spot baseline and leveraged first-ticket baseline are reported separately. |
| PASS ✅ | Uptrend profit optimizer | 108 candidates using the same paths, scored against the first ticket with median/P10 return and drawdown/liquidation penalties. |
| PASS ✅ | Fixed first-ticket parameters | Leverage, initial margin %, margin-use cap, entry anchors and asset weights stay fixed in optimizer candidates. |
| PASS ✅ | Rider risk transparency | Hard-stop/breakeven disablement is explicit; P10 outcome, first-ticket beat rate and P90 drawdown are displayed. |
| PASS ✅ | Equity chart and exports | Adds the median first-ticket line; CSV/JSON contain the first-ticket curve/metrics. |
| PASS ✅ | Safety gates / costs | Fee/slippage-aware add constraint, funding, maintenance threshold and liquidation tracking remain active. |
| LIMITATION ⚠️ | Market realism | Synthetic paths only; flat maintenance rate, no partial liquidation, no historical candle replay or order-book fill simulation. |

## Main experimental lesson

Early exit defaults preserved a smaller drawdown in some noisy uptrends but often underperformed simply holding the first ticket. Later/wider equity trails with controlled adds captured more upside, at the cost of deeper tail drawdowns. The aggressive rider won on median in several bull scenarios but was weaker after reversal and had lower P10 in deep-pullback stress. The report documents all numbers and assumptions.
