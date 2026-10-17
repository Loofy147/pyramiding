# Uptrend Profit Extraction Study

**Scope:** improve profit capture from an already-open leveraged ticket. No entry, market, or token discovery.  
**Study date:** 2026-10-17.  
**Status:** controlled synthetic scenario research; not a forecast.

## Experimental setup

- Starting equity: 10,000 model USDT units; synthetic anchors 100/100, asset weighting 99%/1% to isolate the primary ticket.
- Fixed first ticket: 5× leverage and 30% initial-margin allocation. Candidates are compared on identical sampled price paths within each seed/scenario.
- Friction: 0.04% fee plus 0.02% slippage per side; funding 0.01% per eight hours; 24 hours per step.
- Horizon: 120 synthetic steps. Each scenario uses 1,800 paths × 3 seeds (12345, 20261017, 42); the report averages the per-seed medians/P10s.
- Scenarios: steady bull, noisy bull, bull with common tail shocks, bull with deep pullbacks, and bull that reverses after step 75.
- The paths are synthetic log-return scenarios. They are not calibrated forecasts or a historical-candle replay.

## Fixed-entry strategy comparisons

Terminal equity in thousands of model USDT; each cell is **median / P10**. “Hold 5×” means hold the original leveraged ticket to the end with no adds or strategy exits. Trend riders disable the hard stop and breakeven lock and use a later equity trail; the increased drawdown tail is shown separately.

| Scenario | Hold first 5× ticket | Current defaults | Balanced rider | Aggressive rider |
|---|---:|---:|---:|---:|
| Steady uptrend | 26.85 / 23.75 | 30.07 / 26.33 | 46.21 / 38.85 | 46.21 / 38.85 |
| Noisy uptrend | 16.93 / 12.60 | 11.71 / 9.91 | 18.13 / 11.13 | 21.91 / 12.39 |
| Uptrend + tail shocks | 17.96 / 13.31 | 13.46 / 9.74 | 21.38 / 10.69 | 24.13 / 11.14 |
| Uptrend + deep pullbacks | 16.78 / 11.24 | 10.82 / 9.70 | 14.21 / 10.30 | 18.27 / 9.56 |
| Uptrend then reversal | 9.26 / 6.94 | 14.60 / 10.47 | 15.53 / 11.52 | 13.27 / 9.80 |

### Drawdown and participation trade-offs

| Scenario | Profile | Median drawdown | P90 drawdown | Paths beating the **spot** baseline | Mean accepted adds / path |
|---|---|---:|---:|---:|---:|
| Noisy bull | Hold 5× | 11.85% | 19.02% | 96.3% | 0.0 |
| Noisy bull | Current defaults | 9.00% | 11.82% | 24.5% | 6.2 |
| Noisy bull | Balanced rider | 18.21% | 22.00% | 75.0% | 20.5 |
| Noisy bull | Aggressive rider | 18.31% | 29.49% | 91.8% | 21.8 |
| Tail shocks | Balanced rider | 17.96% | 32.24% | 74.5% | 21.6 |
| Tail shocks | Aggressive rider | 17.99% | 34.34% | 85.4% | 22.4 |
| Deep pullbacks | Balanced rider | 20.56% | 31.86% | 52.5% | 17.7 |
| Deep pullbacks | Aggressive rider | 28.02% | 35.59% | 71.4% | 19.9 |
| Reversal | Balanced rider | 19.80% | 22.84% | 97.8% | 21.3 |
| Reversal | Aggressive rider | 31.71% | 34.45% | 96.3% | 21.4 |

The “spot” benchmark is unleveraged. It is **not** the same as holding the original leveraged ticket; the engine now exposes both comparisons independently.

## Findings

1. The current early exits give up too much of several noisy uptrends. In the noisy case, their median ($11.71k) is below the no-add first-ticket median ($16.93k), although the P90 drawdown is much smaller.
2. Controlled adds with a later trail raised median terminal equity over the no-add ticket in noisy and shocky uptrends. The aggressive rider captures more median upside, but its P90 drawdown reaches 29–36% in several adverse environments.
3. Aggressive behavior is path-dependent. In the deep-pullback scenario, its median ($18.27k) beats the no-add ticket ($16.78k), but P10 ($9.56k) is worse than the ticket P10 ($11.24k). After a reversal, the balanced rider outperforms the aggressive rider on median ($15.53k vs $13.27k) and P90 drawdown (22.84% vs 34.45%).
4. A highest-median result should not be applied blindly. P10, P90 drawdown, percentage of matched paths beating the first ticket, and add count are all material.
5. No liquidation events occurred in the tested finite samples. This is not evidence that liquidation risk is zero outside those samples; the simulator’s flat maintenance rate and synthetic-path assumptions are simplified.

## In-sample optimizer example

A separate 100-path run used seed 20261017, 120 steps, 0.35% mean return and 1.5% volatility per step, with 0.2% daily common-shock probability. The search evaluated 108 candidates while **holding leverage at 5×, initial-margin allocation at 30%, margin-use cap, entry anchors and asset weights fixed**.

| Metric | Current settings | Top-score candidate | Lower-drawdown alternative (#4) |
|---|---:|---:|---:|
| Median terminal equity | $11,587 | $19,082 | $18,456 |
| P10 terminal equity | $9,834 | $11,142 | $11,312 |
| No-add first-ticket median | $16,328 | $16,328 | $16,328 |
| Matched paths beating first ticket | 17% | 87% | 91% |
| Median vs first-ticket median | -29.0% | +16.9% | +13.0% |
| P90 max drawdown | 14.6% | 31.0% | 29.4% |

The top-score candidate uses 3% add margin, a 2% trigger, up to 12 adds per asset, a 30% equity trail armed after a 25% gain, and no hard-stop/breakeven lock. Candidate #4 caps adds at four per asset. It has a slightly lower median, but higher P10, a higher matched-path win rate versus the first ticket, and lower P90 drawdown. Both P10 outcomes remain slightly below the no-add ticket P10 ($11,611); neither dominates on every measure. These are **in-sample** results, not guaranteed outcomes.

## Implementation changes

- Added a hold-first-ticket counterfactual that uses the same entry, leverage, initial allocation, costs, funding, marks and maintenance checks but no adds/strategy exits.
- Retained the unleveraged spot comparator as a distinct baseline.
- Added a third median line to the equity chart and first-ticket metrics to the CSV/JSON exports.
- The upside optimizer now scores matched-path results against the first-ticket baseline. It freezes leverage, initial-margin %, margin-use cap and entry anchors; it only varies add size/spacing/count and trailing-stop width/activation.
- Trend-rider candidates deliberately switch off the hard stop and breakeven lock. This is shown in the UI rather than being hidden.

## Model limitations / next validation

These results are synthetic scenario tests, not real-candle backtests. Funding is constant within a run and approximated from average pre/post-step notional. Slippage is an additive cost, not a simulated fill-price change. Maintenance margin is flat; partial liquidation, risk tiers, liquidation penalties and order-book gaps are omitted. The next discriminating test is replay against user-supplied historical uptrend candles using the actual first-entry price/time, then test a different market period and post-trend reversals.
