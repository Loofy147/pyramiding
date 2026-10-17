Pyramid**Lab**

Capital Leverage × Margin per token % Add every +ROE % Reinvest % of float PnL

Leverage

Market

Advanced (defaults are fine)

Token 1 vol %Token 2 vol %Token 3 vol % Max addsStop, % of liq distanceGive back of open gain % Fee %Funding % per 8hSlippage %Maint. margin % Correlation 0-1DaysPaths

### Equity fan (× starting capital)

Band = 10th to 90th percentile, line = median, grey = break-even.

### Pyramid ladder, one token

Price starts at 1.00 and rises by exactly the trigger each step. Last column = equity multiple if price then falls back to 1.00.

### Which leverage pays best?

Same price paths and same rules at each leverage. Bars show mean and median outcome per 1.00 of capital.

### Reality check (from research)

- **Funding** is charged on your full notional, usually every 8 hours (hourly on Hyperliquid). The usual base is 0.01% per 8h, about 11% a year. At ×50 that is about 0.5% of your margin every 8h, even when price moves your way.
- **Maintenance margin** is tiered: bigger positions face a higher rate, so large notional liquidates sooner than a flat rate shows. Check your exchange table.
- A 2026 on-chain study of Hyperliquid found manual, mostly retail traders lost about $1.1B, mainly through execution costs, forced liquidations and fees. Liquidations exit at far worse prices than chosen exits.
- In extreme moves, exchanges can auto-deleverage winning positions, which can cut a pyramid short. This model does not simulate that.

Results log (copy and paste back for tuning)