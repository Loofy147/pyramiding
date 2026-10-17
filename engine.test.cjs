const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');

const base = {
  capital: 10000, leverage: 3, mmrPct: 0.5, feePct: 0.04,
  initialMarginPct: 3, addMarginPct: 1.5, maxMarginUsePct: 40,
  safetyBufferPct: 20, ladderStepPct: 3, maxAdds: 4,
  hardStopPct: 15, trailingStopPct: 8, trailActivationPct: 5,
  breakevenActivationPct: 5, breakevenLockPct: 0,
  startingPriceA: 65000, startingPriceB: 3200, weightA: 70,
  steps: 24, paths: 60, driftPct: 0.03, volPct: 1.5,
  correlation: 0.65, seed: 12345
};

test('normalization clamps leverage, correlation, and path count to supported bounds', () => {
  const c = E.normalizeConfig({ leverage: 999, correlation: 4, paths: 1 });
  assert.equal(c.leverage, 100);
  assert.equal(c.correlation, 1);
  assert.equal(c.paths, 10);
});

test('seeded price paths are deterministic and remain positive', () => {
  const a = E.generatePricePaths(base, 4);
  const b = E.generatePricePaths(base, 4);
  assert.deepEqual(a, b);
  assert.equal(a[0].a.length, base.steps + 1);
  assert.ok(a.flatMap(p => [...p.a, ...p.b]).every(v => Number.isFinite(v) && v > 0));
});

test('conditional liquidation price solves the equity-equals-maintenance equation', () => {
  const c = { ...base, leverage: 8, initialMarginPct: 40, maxMarginUsePct: 90 };
  const state = E.createInitialState(c);
  const p = E.conditionalLiquidationPrice(state, 0, [c.startingPriceA, c.startingPriceB], c);
  assert.ok(p > 0 && p < c.startingPriceA);
  assert.ok(Math.abs(E.accountEquity(state, [p, c.startingPriceB]) - E.maintenanceMargin(state, [p, c.startingPriceB], c)) < 1e-6);
});

test('pyramid add preserves the requested liquidation safety gap', () => {
  const state = E.createInitialState(base);
  const prices = [base.startingPriceA, base.startingPriceB];
  E.addPosition(state, 0, state.cash * 0.9, prices, base);
  assert.ok(E.liquidationGapPct(state, prices, base) >= base.safetyBufferPct - 1e-6);
});

test('initial margin utilization is capped against shared equity', () => {
  const c = { ...base, initialMarginPct: 30, maxMarginUsePct: 30, addMarginPct: 20, leverage: 5 };
  const state = E.createInitialState(c);
  const prices = [c.startingPriceA, c.startingPriceB];
  E.addPosition(state, 0, 100000, prices, c);
  assert.ok(E.usedInitialMargin(state, prices, c) <= E.accountEquity(state, prices) * c.maxMarginUsePct / 100 + 1e-7);
});

test('perfect correlation produces matching per-step gross returns', () => {
  const c = { ...base, correlation: 1, volPct: 2, steps: 20 };
  const path = E.generatePricePaths(c, 1)[0];
  for (let i = 1; i <= c.steps; i++) {
    assert.ok(Math.abs(path.a[i] / path.a[i - 1] - path.b[i] / path.b[i - 1]) < 1e-12);
  }
});

test('simulation is reproducible and percentile summaries are ordered', () => {
  const paths = E.generatePricePaths(base, 32);
  const a = E.runSimulation(base, paths);
  const b = E.runSimulation(base, paths);
  assert.deepEqual(a, b);
  assert.equal(a.curve.length, base.steps + 1);
  assert.ok(a.metrics.p10Final <= a.metrics.medianFinal);
  assert.ok(a.metrics.medianFinal <= a.metrics.p90Final);
});

test('hard stop exits the full portfolio', () => {
  const c = { ...base, steps: 1, leverage: 5, addMarginPct: 0, hardStopPct: 10, trailActivationPct: 500, breakevenActivationPct: 500 };
  const path = { a: [c.startingPriceA, c.startingPriceA * 0.8], b: [c.startingPriceB, c.startingPriceB * 0.8] };
  assert.equal(E.simulateOne(c, path).exitReason, 'hard-stop');
});

test('trailing stop exits after a configured peak-equity retracement', () => {
  const c = { ...base, steps: 2, leverage: 5, initialMarginPct: 30, addMarginPct: 0, hardStopPct: 0, trailingStopPct: 5, trailActivationPct: 0, breakevenActivationPct: 500 };
  const path = { a: [c.startingPriceA, c.startingPriceA * 1.2, c.startingPriceA], b: [c.startingPriceB, c.startingPriceB * 1.2, c.startingPriceB] };
  assert.equal(E.simulateOne(c, path).exitReason, 'trailing-stop');
});

test('breakeven lock exits after activation and a fall to the lock', () => {
  const c = { ...base, steps: 2, trailingStopPct: 80, trailActivationPct: 500, hardStopPct: 0, breakevenActivationPct: 0, breakevenLockPct: 0 };
  const path = { a: [c.startingPriceA, c.startingPriceA * 1.2, c.startingPriceA * 0.9], b: [c.startingPriceB, c.startingPriceB * 1.2, c.startingPriceB * 0.9] };
  assert.equal(E.simulateOne(c, path).exitReason, 'breakeven-lock');
});

test('liquidation is detected against shared equity and maintenance margin', () => {
  const c = { ...base, steps: 1, leverage: 10, initialMarginPct: 40, maxMarginUsePct: 90, safetyBufferPct: 10, addMarginPct: 0, hardStopPct: 0, trailActivationPct: 500, breakevenActivationPct: 500 };
  const path = { a: [c.startingPriceA, c.startingPriceA * 0.5], b: [c.startingPriceB, c.startingPriceB * 0.5] };
  const result = E.simulateOne(c, path);
  assert.equal(result.exitReason, 'liquidation');
  assert.equal(result.finalEquity, 0);
});

test('ladder plan has a row per allowed add and blocks unsafe additions', () => {
  const result = E.calculateLadderPlan(base);
  assert.equal(result.rows.length, base.maxAdds);
  for (const row of result.rows) assert.ok(row.gapAfterPct >= base.safetyBufferPct - 1e-6 || row.addStatus === 'blocked');
});

test('optimizer returns deterministic ranked candidates', () => {
  const c = { ...base, steps: 12 };
  const paths = E.generatePricePaths(c, 24);
  const a = E.optimizeConfig(c, paths);
  assert.deepEqual(a, E.optimizeConfig(c, paths));
  assert.ok(a.length > 0);
  assert.ok(a.every((item, i) => item.rank === i + 1));
});
