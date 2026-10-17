(function (root) {
  'use strict';

  const DEFAULTS = {
    capital: 10000, leverage: 5, mmrPct: 0.5, feePct: 0.04, slippagePct: 0.02,
    fundingPctPer8h: 0.01, hoursPerStep: 24,
    shockProbabilityPctPerDay: 0, shockMeanPct: -8, shockVolPct: 3,
    initialMarginPct: 30, addMarginPct: 1.5, maxMarginUsePct: 40,
    safetyBufferPct: 20, ladderStepPct: 3, maxAdds: 4,
    hardStopPct: 15, trailingStopPct: 8, trailActivationPct: 5,
    breakevenActivationPct: 5, breakevenLockPct: 0,
    startingPriceA: 65000, startingPriceB: 3200, weightA: 70,
    steps: 120, paths: 500, driftPct: 0.03, volPct: 1.5,
    correlation: 0.65, seed: 12345
  };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const num = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const rate = (pct) => Math.max(0, num(pct, 0)) / 100;
  const executionCostRate = (c) => rate(c.feePct) + rate(c.slippagePct);

  function normalizeConfig(input = {}) {
    const c = { ...DEFAULTS, ...input };
    c.capital = clamp(num(c.capital, DEFAULTS.capital), 100, 1e9);
    c.leverage = clamp(num(c.leverage, DEFAULTS.leverage), 1, 100);
    c.mmrPct = clamp(num(c.mmrPct, DEFAULTS.mmrPct), 0.01, 20);
    c.feePct = clamp(num(c.feePct, DEFAULTS.feePct), 0, 5);
    c.slippagePct = clamp(num(c.slippagePct, DEFAULTS.slippagePct), 0, 5);
    c.fundingPctPer8h = clamp(num(c.fundingPctPer8h, DEFAULTS.fundingPctPer8h), -5, 5);
    c.hoursPerStep = clamp(num(c.hoursPerStep, DEFAULTS.hoursPerStep), 0.25, 168);
    c.shockProbabilityPctPerDay = clamp(num(c.shockProbabilityPctPerDay, DEFAULTS.shockProbabilityPctPerDay), 0, 100);
    c.shockMeanPct = clamp(num(c.shockMeanPct, DEFAULTS.shockMeanPct), -50, 10);
    c.shockVolPct = clamp(num(c.shockVolPct, DEFAULTS.shockVolPct), 0, 50);
    c.initialMarginPct = clamp(num(c.initialMarginPct, DEFAULTS.initialMarginPct), 0.1, 100);
    c.addMarginPct = clamp(num(c.addMarginPct, DEFAULTS.addMarginPct), 0, 25);
    c.maxMarginUsePct = clamp(num(c.maxMarginUsePct, DEFAULTS.maxMarginUsePct), 1, 95);
    c.safetyBufferPct = clamp(num(c.safetyBufferPct, DEFAULTS.safetyBufferPct), 1, 80);
    c.ladderStepPct = clamp(num(c.ladderStepPct, DEFAULTS.ladderStepPct), 0.25, 50);
    c.maxAdds = Math.round(clamp(num(c.maxAdds, DEFAULTS.maxAdds), 0, 20));
    c.hardStopPct = clamp(num(c.hardStopPct, DEFAULTS.hardStopPct), 0, 95);
    c.trailingStopPct = clamp(num(c.trailingStopPct, DEFAULTS.trailingStopPct), 0.1, 95);
    c.trailActivationPct = clamp(num(c.trailActivationPct, DEFAULTS.trailActivationPct), 0, 500);
    c.breakevenActivationPct = clamp(num(c.breakevenActivationPct, DEFAULTS.breakevenActivationPct), 0, 500);
    c.breakevenLockPct = clamp(num(c.breakevenLockPct, DEFAULTS.breakevenLockPct), -90, 300);
    c.startingPriceA = clamp(num(c.startingPriceA, DEFAULTS.startingPriceA), 0.000001, 1e12);
    c.startingPriceB = clamp(num(c.startingPriceB, DEFAULTS.startingPriceB), 0.000001, 1e12);
    c.weightA = clamp(num(c.weightA, DEFAULTS.weightA), 1, 99);
    c.steps = Math.round(clamp(num(c.steps, DEFAULTS.steps), 1, 1000));
    c.paths = Math.round(clamp(num(c.paths, DEFAULTS.paths), 10, 5000));
    c.driftPct = clamp(num(c.driftPct, DEFAULTS.driftPct), -10, 10);
    c.volPct = clamp(num(c.volPct, DEFAULTS.volPct), 0, 50);
    c.correlation = clamp(num(c.correlation, DEFAULTS.correlation), -1, 1);
    c.seed = Math.trunc(clamp(num(c.seed, DEFAULTS.seed), 0, 2147483647));
    return c;
  }

  function initialPrices(c) { return [c.startingPriceA, c.startingPriceB]; }
  function weights(c) { return [c.weightA / 100, 1 - c.weightA / 100]; }

  function accountEquity(state, prices) {
    let eq = state.cash;
    for (let i = 0; i < 2; i++) {
      const p = state.positions[i];
      if (p.qty > 0) eq += p.qty * (prices[i] - p.avgEntry);
    }
    return eq;
  }

  function maintenanceMargin(state, prices, c) {
    const mmr = rate(c.mmrPct);
    let mm = 0;
    for (let i = 0; i < 2; i++) mm += state.positions[i].qty * prices[i] * mmr;
    return mm;
  }

  function usedInitialMargin(state, prices, c) {
    let used = 0;
    for (let i = 0; i < 2; i++) used += state.positions[i].qty * prices[i] / c.leverage;
    return used;
  }

  function riskDenominator(state, prices, c) {
    const mmr = rate(c.mmrPct);
    let d = 0;
    for (let i = 0; i < 2; i++) d += state.positions[i].qty * prices[i] * (1 - mmr);
    return d;
  }

  function liquidationGapPct(state, prices, c) {
    const d = riskDenominator(state, prices, c);
    if (d <= 0) return 10000;
    return Math.max(0, (accountEquity(state, prices) - maintenanceMargin(state, prices, c)) / d) * 100;
  }

  function maxSafeAddNotional(state, prices, c) {
    const eq = accountEquity(state, prices);
    const mm = maintenanceMargin(state, prices, c);
    const d = riskDenominator(state, prices, c);
    const headroom = eq - mm;
    if (eq <= 0 || headroom <= 0) return 0;
    const target = rate(c.safetyBufferPct);
    const bufferHeadroom = headroom - target * d;
    if (bufferHeadroom <= 0) return 0;
    const mmr = rate(c.mmrPct);
    const entryCost = executionCostRate(c);
    const denominator = mmr + entryCost + target * (1 - mmr);
    const notionalByGap = denominator > 0 ? bufferHeadroom / denominator : 0;
    const maxUse = rate(c.maxMarginUsePct);
    const marginRoom = Math.max(0, maxUse * eq - usedInitialMargin(state, prices, c));
    // Include fee and slippage in the post-entry equity and margin-use constraint.
    const notionalByInitialMargin = marginRoom / (1 / c.leverage + maxUse * entryCost);
    return Math.max(0, Math.min(notionalByGap, notionalByInitialMargin));
  }

  function addPosition(state, assetIndex, marginBudget, prices, inputConfig) {
    const c = normalizeConfig(inputConfig);
    const idx = assetIndex === 1 ? 1 : 0;
    const price = prices[idx];
    const eq = accountEquity(state, prices);
    const desired = Math.max(0, marginBudget) * c.leverage;
    const cap = maxSafeAddNotional(state, prices, c);
    const notional = Math.min(desired, cap);
    const minNotional = Math.max(1e-8, c.capital * 1e-9);
    if (!(price > 0) || !(eq > 0) || !(notional >= minNotional)) {
      return { accepted: false, status: 'blocked', notional: 0, fee: 0, slippage: 0, executionCost: 0 };
    }
    const fee = notional * rate(c.feePct);
    const slippage = notional * rate(c.slippagePct);
    const executionCost = fee + slippage;
    const position = state.positions[idx];
    const qty = notional / price;
    if (position.qty === 0) {
      position.qty = qty;
      position.avgEntry = price;
      state.lastAddPrice[idx] = price;
    } else {
      position.avgEntry = ((position.avgEntry * position.qty) + (price * qty)) / (position.qty + qty);
      position.qty += qty;
      state.addCounts[idx] += 1;
      state.lastAddPrice[idx] = price;
    }
    state.cash -= executionCost;
    state.executionCosts = (state.executionCosts || 0) + executionCost;
    return { accepted: true, status: 'added', notional, fee, slippage, executionCost, qty, price };
  }

  function createInitialState(inputConfig) {
    const c = normalizeConfig(inputConfig);
    const prices = initialPrices(c);
    const state = {
      cash: c.capital,
      initialCapital: c.capital,
      positions: [{ qty: 0, avgEntry: 0 }, { qty: 0, avgEntry: 0 }],
      addCounts: [0, 0],
      lastAddPrice: [...prices],
      gateBlocks: 0,
      acceptedAdds: 0,
      fundingPaid: 0,
      executionCosts: 0
    };
    const w = weights(c);
    for (let i = 0; i < 2; i++) {
      const marginBudget = c.capital * rate(c.initialMarginPct) * w[i];
      addPosition(state, i, marginBudget, prices, c);
    }
    return state;
  }

  function conditionalLiquidationPrice(state, assetIndex, prices, inputConfig) {
    const c = normalizeConfig(inputConfig);
    const idx = assetIndex === 1 ? 1 : 0;
    const p = state.positions[idx];
    if (!p || p.qty <= 0) return null;
    const mmr = rate(c.mmrPct);
    if (mmr >= 1) return null;
    let equityOther = state.cash;
    let mmOther = 0;
    for (let i = 0; i < 2; i++) {
      if (i === idx) continue;
      const q = state.positions[i].qty;
      if (q > 0) {
        equityOther += q * (prices[i] - state.positions[i].avgEntry);
        mmOther += q * prices[i] * mmr;
      }
    }
    const numerator = p.qty * p.avgEntry + mmOther - equityOther;
    const denominator = p.qty * (1 - mmr);
    if (denominator <= 0) return null;
    const result = numerator / denominator;
    return Number.isFinite(result) && result > 0 ? result : null;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function normalGenerator(rng) {
    let spare = null;
    return function normal() {
      if (spare !== null) { const v = spare; spare = null; return v; }
      let u = 0, v = 0;
      while (u <= Number.EPSILON) u = rng();
      while (v <= Number.EPSILON) v = rng();
      const mag = Math.sqrt(-2 * Math.log(u));
      const theta = 2 * Math.PI * v;
      spare = mag * Math.sin(theta);
      return mag * Math.cos(theta);
    };
  }

  function generatePricePaths(inputConfig, requestedCount) {
    const c = normalizeConfig(inputConfig);
    const count = Math.round(clamp(num(requestedCount, c.paths), 1, 10000));
    const rng = mulberry32(c.seed);
    const normal = normalGenerator(rng);
    const rho = clamp(c.correlation, -1, 1);
    const orth = Math.sqrt(Math.max(0, 1 - rho * rho));
    const mu = c.driftPct / 100;
    const sigma = c.volPct / 100;
    const paths = new Array(count);
    for (let n = 0; n < count; n++) {
      const a = new Array(c.steps + 1);
      const b = new Array(c.steps + 1);
      a[0] = c.startingPriceA;
      b[0] = c.startingPriceB;
      for (let t = 1; t <= c.steps; t++) {
        const z1 = normal();
        const z2 = rho * z1 + orth * normal();
        let logA = mu - 0.5 * sigma * sigma + sigma * z1;
        let logB = mu - 0.5 * sigma * sigma + sigma * z2;
        const dailyShockProb = rate(c.shockProbabilityPctPerDay);
        const shockProbPerStep = dailyShockProb >= 1 ? 1 : 1 - Math.pow(1 - dailyShockProb, c.hoursPerStep / 24);
        if (shockProbPerStep > 0 && rng() < shockProbPerStep) {
          const commonShock = (c.shockMeanPct + c.shockVolPct * normal()) / 100;
          logA += commonShock; logB += commonShock;
        }
        logA = clamp(logA, -8, 8); logB = clamp(logB, -8, 8);
        a[t] = Math.max(1e-10, a[t - 1] * Math.exp(logA));
        b[t] = Math.max(1e-10, b[t - 1] * Math.exp(logB));
      }
      paths[n] = { a, b };
    }
    return paths;
  }

  function closePortfolio(state, prices, c) {
    const eq = accountEquity(state, prices);
    let notional = 0;
    for (let i = 0; i < 2; i++) notional += state.positions[i].qty * prices[i];
    const closeCost = notional * executionCostRate(c);
    const finalEquity = Math.max(0, eq - closeCost);
    state.executionCosts += closeCost;
    state.cash = finalEquity;
    state.positions = [{ qty: 0, avgEntry: 0 }, { qty: 0, avgEntry: 0 }];
    return finalEquity;
  }

  function accrueFunding(state, previousPrices, currentPrices, c) {
    const ratePerStep = (num(c.fundingPctPer8h, 0) / 100) * (c.hoursPerStep / 8);
    if (ratePerStep === 0) return 0;
    let netCost = 0;
    for (let i = 0; i < 2; i++) {
      const qty = state.positions[i].qty;
      if (qty <= 0) continue;
      netCost += qty * ((previousPrices[i] + currentPrices[i]) / 2) * ratePerStep;
    }
    state.cash -= netCost;
    state.fundingPaid += netCost;
    return netCost;
  }

  function simulateOne(inputConfig, pricePath) {
    const c = normalizeConfig(inputConfig);
    const pricesAt = (i) => [pricePath.a[i], pricePath.b[i]];
    const state = createInitialState(c);
    let closed = false;
    let liquidated = false;
    let exitReason = 'horizon';
    let exitStep = c.steps;
    let equity = accountEquity(state, pricesAt(0));
    let peakEquity = Math.max(c.capital, equity);
    let peakForDrawdown = Math.max(1e-9, c.capital, equity);
    let maxDrawdownPct = peakForDrawdown > 0 ? Math.max(0, (peakForDrawdown - equity) / peakForDrawdown * 100) : 100;
    let breakevenArmed = false;
    const curve = [equity];
    const start = c.capital;
    const w = weights(c);

    for (let t = 1; t <= c.steps; t++) {
      const prices = pricesAt(t);
      if (closed) { curve.push(equity); continue; }
      accrueFunding(state, pricesAt(t - 1), prices, c);
      equity = accountEquity(state, prices);
      const mm = maintenanceMargin(state, prices, c);
      if (equity <= mm || equity <= 0) {
        liquidated = true;
        closed = true;
        exitReason = 'liquidation';
        exitStep = t;
        state.cash = 0;
        state.positions = [{ qty: 0, avgEntry: 0 }, { qty: 0, avgEntry: 0 }];
        equity = 0;
        maxDrawdownPct = 100;
        curve.push(0);
        continue;
      }

      peakEquity = Math.max(peakEquity, equity);
      if (peakEquity > peakForDrawdown) peakForDrawdown = peakEquity;
      const dd = peakForDrawdown > 0 ? (peakForDrawdown - equity) / peakForDrawdown * 100 : 100;
      maxDrawdownPct = Math.max(maxDrawdownPct, dd);

      const hardStopped = c.hardStopPct > 0 && state.positions.some((p, i) => p.qty > 0 && prices[i] <= p.avgEntry * (1 - rate(c.hardStopPct)));
      if (equity >= start * (1 + rate(c.breakevenActivationPct))) breakevenArmed = true;
      const breakevenStopped = breakevenArmed && equity <= start * (1 + c.breakevenLockPct / 100);
      const trailArmed = peakEquity >= start * (1 + rate(c.trailActivationPct));
      const trailingStopped = trailArmed && c.trailingStopPct > 0 && equity <= peakEquity * (1 - rate(c.trailingStopPct));

      if (hardStopped || breakevenStopped || trailingStopped) {
        exitReason = hardStopped ? 'hard-stop' : breakevenStopped ? 'breakeven-lock' : 'trailing-stop';
        exitStep = t;
        equity = closePortfolio(state, prices, c);
        closed = true;
        peakForDrawdown = Math.max(peakForDrawdown, equity);
        maxDrawdownPct = Math.max(maxDrawdownPct, peakForDrawdown > 0 ? (peakForDrawdown - equity) / peakForDrawdown * 100 : 100);
        curve.push(equity);
        continue;
      }

      for (let i = 0; i < 2; i++) {
        const pos = state.positions[i];
        if (pos.qty <= 0 || state.addCounts[i] >= c.maxAdds || c.addMarginPct <= 0) continue;
        const trigger = state.lastAddPrice[i] * (1 + rate(c.ladderStepPct));
        if (prices[i] + Math.abs(trigger) * 1e-12 < trigger) continue;
        const budget = Math.max(0, accountEquity(state, prices)) * rate(c.addMarginPct) * w[i];
        const result = addPosition(state, i, budget, prices, c);
        if (result.accepted) state.acceptedAdds++;
        else state.gateBlocks++;
      }
      equity = accountEquity(state, prices);
      peakEquity = Math.max(peakEquity, equity);
      if (peakEquity > peakForDrawdown) peakForDrawdown = peakEquity;
      const ddAfterAdds = peakForDrawdown > 0 ? (peakForDrawdown - equity) / peakForDrawdown * 100 : 100;
      maxDrawdownPct = Math.max(maxDrawdownPct, ddAfterAdds);
      curve.push(equity);
    }

    if (!closed) {
      const prices = pricesAt(c.steps);
      const grossEq = accountEquity(state, prices);
      let closeNotional = 0;
      for (let i = 0; i < 2; i++) closeNotional += state.positions[i].qty * prices[i];
      const closeCost = closeNotional * executionCostRate(c);
      state.executionCosts += closeCost;
      equity = Math.max(0, grossEq - closeCost);
      curve[curve.length - 1] = equity;
      peakForDrawdown = Math.max(peakForDrawdown, equity);
      maxDrawdownPct = Math.max(maxDrawdownPct, peakForDrawdown > 0 ? (peakForDrawdown - equity) / peakForDrawdown * 100 : 100);
      if (equity <= 0 && grossEq > 0) exitReason = 'horizon-close-out';
    }

    const spotExecutionCost = executionCostRate(c);
    const holdAt = (t) => {
      const p = pricesAt(t);
      return start * (1 - spotExecutionCost) * (w[0] * p[0] / c.startingPriceA + w[1] * p[1] / c.startingPriceB);
    };
    const buyHoldFinal = Math.max(0, holdAt(c.steps) * (1 - spotExecutionCost));
    const buyHoldSeries = new Array(c.steps + 1);
    for (let t = 0; t <= c.steps; t++) buyHoldSeries[t] = t === c.steps ? Math.max(0, holdAt(t) * (1 - spotExecutionCost)) : holdAt(t);

    return {
      finalEquity: equity,
      buyHoldFinal,
      maxDrawdownPct,
      liquidated,
      ruin: liquidated || equity <= 0,
      exitReason,
      exitStep,
      acceptedAdds: state.acceptedAdds,
      gateBlocks: state.gateBlocks,
      fundingPaid: state.fundingPaid,
      executionCosts: state.executionCosts,
      curve,
      buyHoldSeries
    };
  }

  function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const pos = (sorted.length - 1) * p;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  function runSimulation(inputConfig, pricePaths) {
    const c = normalizeConfig(inputConfig);
    const paths = pricePaths || generatePricePaths(c, c.paths);
    if (!paths.length) throw new Error('At least one price path is required.');
    const results = paths.map(path => simulateOne(c, path));
    const finals = results.map(r => r.finalEquity).sort((a, b) => a - b);
    const holds = results.map(r => r.buyHoldFinal).sort((a, b) => a - b);
    const mdds = results.map(r => r.maxDrawdownPct).sort((a, b) => a - b);
    const count = results.length;
    const liquidations = results.filter(r => r.liquidated).length;
    const ruins = results.filter(r => r.ruin).length;
    const exits = {};
    for (const r of results) exits[r.exitReason] = (exits[r.exitReason] || 0) + 1;
    const meanFinal = results.reduce((s, r) => s + r.finalEquity, 0) / count;
    const meanHold = results.reduce((s, r) => s + r.buyHoldFinal, 0) / count;
    const meanMdd = results.reduce((s, r) => s + r.maxDrawdownPct, 0) / count;
    const meanAdds = results.reduce((s, r) => s + r.acceptedAdds, 0) / count;
    const meanBlocks = results.reduce((s, r) => s + r.gateBlocks, 0) / count;
    const meanFundingPaid = results.reduce((s, r) => s + r.fundingPaid, 0) / count;
    const meanExecutionCosts = results.reduce((s, r) => s + r.executionCosts, 0) / count;
    const curve = [];
    const buyHoldCurve = [];
    for (let t = 0; t <= c.steps; t++) {
      const strategyVals = results.map(r => r.curve[t]).sort((a, b) => a - b);
      const holdVals = results.map(r => r.buyHoldSeries[t]).sort((a, b) => a - b);
      curve.push({ step: t, p10: percentile(strategyVals, 0.1), p50: percentile(strategyVals, 0.5), p90: percentile(strategyVals, 0.9) });
      buyHoldCurve.push({ step: t, p50: percentile(holdVals, 0.5) });
    }
    return {
      config: c,
      curve,
      buyHoldCurve,
      metrics: {
        p10Final: percentile(finals, 0.1), medianFinal: percentile(finals, 0.5), p90Final: percentile(finals, 0.9),
        meanFinal, medianBuyHold: percentile(holds, 0.5), meanBuyHold: meanHold,
        medianMaxDrawdownPct: percentile(mdds, 0.5), p90MaxDrawdownPct: percentile(mdds, 0.9), meanMaxDrawdownPct: meanMdd,
        liquidationRatePct: liquidations / count * 100, ruinRatePct: ruins / count * 100,
        winRatePct: results.filter(r => r.finalEquity > c.capital).length / count * 100,
        outperformBuyHoldPct: results.filter(r => r.finalEquity > r.buyHoldFinal).length / count * 100,
        medianOutperformancePct: percentile(holds, 0.5) > 0 ? (percentile(finals, 0.5) / percentile(holds, 0.5) - 1) * 100 : 0,
        meanAdds, meanGateBlocks: meanBlocks, meanFundingPaid, meanExecutionCosts, meanReturnPct: (meanFinal / c.capital - 1) * 100,
        medianReturnPct: (percentile(finals, 0.5) / c.capital - 1) * 100,
        medianBuyHoldReturnPct: (percentile(holds, 0.5) / c.capital - 1) * 100,
        worstFinal: finals[0], bestFinal: finals[finals.length - 1], paths: count, steps: c.steps
      },
      exitCounts: exits
    };
  }

  function calculateLadderPlan(inputConfig) {
    const c = normalizeConfig(inputConfig);
    const state = createInitialState(c);
    const startPrices = initialPrices(c);
    const w = weights(c);
    const rows = [];
    const initialState = {
      equity: accountEquity(state, startPrices),
      gapPct: liquidationGapPct(state, startPrices, c),
      prices: [...startPrices],
      liquidationA: conditionalLiquidationPrice(state, 0, startPrices, c),
      liquidationB: conditionalLiquidationPrice(state, 1, startPrices, c)
    };
    for (let level = 1; level <= c.maxAdds; level++) {
      const factor = Math.pow(1 + rate(c.ladderStepPct), level);
      const prices = [startPrices[0] * factor, startPrices[1] * factor];
      const equityBefore = accountEquity(state, prices);
      const gapBeforePct = liquidationGapPct(state, prices, c);
      const statuses = [];
      for (let i = 0; i < 2; i++) {
        if (state.positions[i].qty <= 0 || state.addCounts[i] >= c.maxAdds || c.addMarginPct <= 0) {
          statuses.push('skipped');
          continue;
        }
        const trigger = state.lastAddPrice[i] * (1 + rate(c.ladderStepPct));
        if (prices[i] + Math.abs(trigger) * 1e-10 < trigger) { statuses.push('waiting'); continue; }
        const budget = Math.max(0, accountEquity(state, prices)) * rate(c.addMarginPct) * w[i];
        const added = addPosition(state, i, budget, prices, c);
        if (added.accepted) { state.acceptedAdds++; statuses.push(`added ${added.notional}`); }
        else { state.gateBlocks++; statuses.push('blocked'); }
      }
      const gapAfterPct = liquidationGapPct(state, prices, c);
      rows.push({
        level,
        triggerA: startPrices[0] * Math.pow(1 + rate(c.ladderStepPct), level),
        triggerB: startPrices[1] * Math.pow(1 + rate(c.ladderStepPct), level),
        prices,
        equityBefore,
        gapBeforePct,
        aStatus: statuses[0],
        bStatus: statuses[1],
        addStatus: statuses.some(s => s === 'blocked') ? 'blocked' : statuses.filter(s => s.startsWith('added')).length ? 'added' : 'skipped',
        gapAfterPct,
        liquidationA: conditionalLiquidationPrice(state, 0, prices, c),
        liquidationB: conditionalLiquidationPrice(state, 1, prices, c),
        retraceA: conditionalLiquidationPrice(state, 0, prices, c) == null ? null : (prices[0] - conditionalLiquidationPrice(state, 0, prices, c)) / prices[0] * 100,
        retraceB: conditionalLiquidationPrice(state, 1, prices, c) == null ? null : (prices[1] - conditionalLiquidationPrice(state, 1, prices, c)) / prices[1] * 100
      });
    }
    return { initialState, rows };
  }

  function uniqueVals(vals) {
    return [...new Set(vals.map(v => Math.round(v * 10000) / 10000))];
  }

  function optimizeConfig(inputConfig, pricePaths) {
    const base = normalizeConfig(inputConfig);
    const availablePaths = Array.isArray(pricePaths) && pricePaths.length ? pricePaths : generatePricePaths(base, Math.min(base.paths, 250));
    const paths = availablePaths.slice(0, Math.min(availablePaths.length, 250));
    const steps = uniqueVals([Math.max(0.25, base.ladderStepPct - 1), base.ladderStepPct, Math.min(50, base.ladderStepPct + 1)]);
    const adds = uniqueVals([Math.max(0, base.addMarginPct * 0.5), base.addMarginPct, Math.min(25, base.addMarginPct * 1.5)]);
    const buffers = uniqueVals([Math.max(1, base.safetyBufferPct - 5), base.safetyBufferPct, Math.min(80, base.safetyBufferPct + 5)]);
    const candidates = [];
    for (const step of steps) for (const add of adds) for (const buffer of buffers) {
      const candidate = { ...base, ladderStepPct: step, addMarginPct: add, safetyBufferPct: buffer };
      const r = runSimulation(candidate, paths);
      const m = r.metrics;
      const score = m.medianReturnPct - 1.5 * m.liquidationRatePct - 0.35 * m.medianMaxDrawdownPct - Math.max(0, m.liquidationRatePct - 5) * 2.5;
      candidates.push({
        config: { ladderStepPct: step, addMarginPct: add, safetyBufferPct: buffer },
        score,
        medianFinal: m.medianFinal,
        liquidationRatePct: m.liquidationRatePct,
        medianMaxDrawdownPct: m.medianMaxDrawdownPct,
        medianReturnPct: m.medianReturnPct,
        paths: m.paths
      });
    }
    candidates.sort((a, b) => b.score - a.score || a.liquidationRatePct - b.liquidationRatePct || a.medianMaxDrawdownPct - b.medianMaxDrawdownPct);
    return candidates.slice(0, 5).map((item, i) => ({ ...item, rank: i + 1 }));
  }

  function optimizeUpsideConfig(inputConfig, pricePaths) {
    const base = normalizeConfig(inputConfig);
    if (base.driftPct <= 0) throw new Error('Upside optimization requires a positive drift assumption.');
    const available = Array.isArray(pricePaths) && pricePaths.length ? pricePaths : generatePricePaths(base, Math.min(base.paths, 100));
    const paths = available.slice(0, Math.min(available.length, 100));
    const adds = uniqueVals([0, base.addMarginPct, Math.min(10, Math.max(2, base.addMarginPct * 2))]);
    const steps = uniqueVals([Math.max(0.25, base.ladderStepPct - 1), base.ladderStepPct, Math.min(25, base.ladderStepPct + 1)]);
    const addCounts = uniqueVals([base.maxAdds, Math.max(12, base.maxAdds)]);
    const trails = uniqueVals([Math.max(5, base.trailingStopPct), Math.min(40, Math.max(base.trailingStopPct + 10, 18)), Math.min(50, Math.max(base.trailingStopPct + 20, 30))]);
    const trailArms = uniqueVals([base.trailActivationPct, Math.min(75, Math.max(25, base.trailActivationPct + 20))]);
    if (!paths.length) throw new Error('At least one path is required for upside optimization.');

    const bm = runSimulation(base, paths).metrics;
    const baseline = {
      leverage: base.leverage, initialMarginPct: base.initialMarginPct,
      hardStopPct: base.hardStopPct, breakevenActivationPct: base.breakevenActivationPct,
      medianFinal: bm.medianFinal, p10Final: bm.p10Final, p90Final: bm.p90Final,
      medianReturnPct: bm.medianReturnPct, outperformBuyHoldPct: bm.outperformBuyHoldPct,
      medianOutperformancePct: bm.medianOutperformancePct,
      medianMaxDrawdownPct: bm.medianMaxDrawdownPct, p90MaxDrawdownPct: bm.p90MaxDrawdownPct,
      liquidationRatePct: bm.liquidationRatePct, paths: bm.paths
    };
    const candidates = [];
    for (const add of adds) for (const step of steps)
      for (const maxAdds of addCounts) for (const trail of trails) for (const arm of trailArms) {
        // Keep the original ticket's leverage and initial-margin allocation fixed.
        // Rider candidates deliberately disable early hard-stop/BE exits to test profit capture.
        const candidate = normalizeConfig({
          ...base, addMarginPct: add, ladderStepPct: step, maxMarginUsePct: base.maxMarginUsePct,
          maxAdds, trailingStopPct: trail, trailActivationPct: arm,
          hardStopPct: 0, breakevenActivationPct: 500, breakevenLockPct: 0
        });
        const runs = paths.map(path => simulateOne(candidate, path));
        const finals = runs.map(r => r.finalEquity).sort((a, b) => a - b);
        const holds = runs.map(r => r.buyHoldFinal).sort((a, b) => a - b);
        const drawdowns = runs.map(r => r.maxDrawdownPct).sort((a, b) => a - b);
        const medianFinal = percentile(finals, 0.5), p10Final = percentile(finals, 0.1);
        const medianHold = percentile(holds, 0.5);
        const medianReturnPct = (medianFinal / candidate.capital - 1) * 100;
        const p10ReturnPct = (p10Final / candidate.capital - 1) * 100;
        const outperformBuyHoldPct = runs.filter(r => r.finalEquity > r.buyHoldFinal).length / runs.length * 100;
        const medianOutperformancePct = medianHold > 0 ? (medianFinal / medianHold - 1) * 100 : 0;
        const medianMaxDrawdownPct = percentile(drawdowns, 0.5), p90MaxDrawdownPct = percentile(drawdowns, 0.9);
        const liquidationRatePct = runs.filter(r => r.liquidated).length / runs.length * 100;
        const ruinRatePct = runs.filter(r => r.ruin).length / runs.length * 100;
        const meanAdds = runs.reduce((sum, r) => sum + r.acceptedAdds, 0) / runs.length;
        const score = 0.4 * medianReturnPct + 0.25 * p10ReturnPct + 0.35 * medianOutperformancePct
          - 0.4 * medianMaxDrawdownPct - 0.5 * Math.max(0, p90MaxDrawdownPct - 35) - 10 * liquidationRatePct;
        candidates.push({
          config: {
            leverage: candidate.leverage, initialMarginPct: candidate.initialMarginPct,
            addMarginPct: candidate.addMarginPct, ladderStepPct: candidate.ladderStepPct,
            maxMarginUsePct: candidate.maxMarginUsePct, maxAdds: candidate.maxAdds,
            safetyBufferPct: candidate.safetyBufferPct, hardStopPct: candidate.hardStopPct,
            trailingStopPct: candidate.trailingStopPct, trailActivationPct: candidate.trailActivationPct,
            breakevenActivationPct: candidate.breakevenActivationPct, breakevenLockPct: candidate.breakevenLockPct
          },
          score, medianFinal, p10Final, p90Final: percentile(finals, 0.9), medianReturnPct, p10ReturnPct,
          outperformBuyHoldPct, medianOutperformancePct, medianMaxDrawdownPct, p90MaxDrawdownPct,
          liquidationRatePct, ruinRatePct, meanAdds, paths: paths.length
        });
      }
    candidates.sort((a, b) => b.score - a.score || b.p10Final - a.p10Final || a.liquidationRatePct - b.liquidationRatePct);
    return { baseline, candidates: candidates.slice(0, 8).map((item, i) => ({ ...item, rank: i + 1 })), evaluatedCandidates: candidates.length, paths: paths.length };
  }

    function scanLeverage(inputConfig, pricePaths, leverageValues) {
    const base = normalizeConfig(inputConfig);
    const availablePaths = Array.isArray(pricePaths) && pricePaths.length ? pricePaths.slice(0, Math.min(pricePaths.length, 250)) : generatePricePaths(base, Math.min(base.paths, 250));
    const choices = Array.isArray(leverageValues) && leverageValues.length ? leverageValues : [2, 3, 5, 8, 10, 15, 20, 25, 50, 75, 100, base.leverage];
    const leverages = uniqueVals(choices.map(v => clamp(num(v, base.leverage), 1, 100))).sort((a, b) => a - b);
    return leverages.map(leverage => {
      const result = runSimulation({ ...base, leverage }, availablePaths), m = result.metrics;
      return { leverage, meanFinal: m.meanFinal, medianFinal: m.medianFinal, p10Final: m.p10Final, p90Final: m.p90Final, medianReturnPct: m.medianReturnPct, liquidationRatePct: m.liquidationRatePct, ruinRatePct: m.ruinRatePct, medianMaxDrawdownPct: m.medianMaxDrawdownPct, paths: m.paths };
    });
  }

function formatSnapshot(state, prices, inputConfig) {
    const c = normalizeConfig(inputConfig);
    const eq = accountEquity(state, prices);
    return {
      equity: eq,
      maintenance: maintenanceMargin(state, prices, c),
      gapPct: liquidationGapPct(state, prices, c),
      usedMargin: usedInitialMargin(state, prices, c),
      assets: [0, 1].map(i => {
        const lp = conditionalLiquidationPrice(state, i, prices, c);
        return { qty: state.positions[i].qty, avgEntry: state.positions[i].avgEntry, mark: prices[i], liquidationPrice: lp, retracePct: lp == null ? null : (prices[i] - lp) / prices[i] * 100 };
      })
    };
  }

  const api = {
    DEFAULTS, normalizeConfig, accountEquity, maintenanceMargin, usedInitialMargin,
    riskDenominator, liquidationGapPct, maxSafeAddNotional, addPosition,
    createInitialState, conditionalLiquidationPrice, generatePricePaths,
    simulateOne, runSimulation, calculateLadderPlan, optimizeConfig, optimizeUpsideConfig, scanLeverage, formatSnapshot,
    percentile, initialPrices, weights, executionCostRate, accrueFunding
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PyramidEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
