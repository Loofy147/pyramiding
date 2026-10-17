const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const page = fs.readFileSync('./index.html', 'utf8');
const standalone = fs.readFileSync('./standalone.html', 'utf8');

test('modular page wires the engine and essential controls', () => {
  assert.match(page, /<script src="engine\.js"><\/script>/);
  for (const id of ['runBtn', 'optBtn', 'csvBtn', 'jsonBtn', 'resetBtn', 'chartWrap', 'ladderBody']) {
    assert.ok(page.includes('id="' + id + '"'), 'missing UI element: ' + id);
  }
});

test('standalone build embeds the engine without external script dependencies', () => {
  assert.doesNotMatch(standalone, /<script\s+src="engine\.js"/i);
  assert.match(standalone, /PyramidEngine/);
  assert.match(standalone, /Run stress test/);
});

test('UI exposes exports, optimizer, risk snapshot, and chart output', () => {
  assert.match(page, /optimizeConfig/);
  assert.match(page, /exportCsv/);
  assert.match(page, /exportJson/);
  assert.match(page, /riskSnapshot/);
  assert.match(page, /<svg/);
});


test('prototype-derived friction, funding, tail-shock controls and leverage scan are reachable', () => {
  const source = fs.readFileSync('./index.html', 'utf8');
  for (const id of ['slippagePct','fundingPctPer8h','hoursPerStep','shockProbabilityPctPerDay','shockMeanPct','shockVolPct']) {
    assert.ok(source.includes('id="' + id + '"'), 'missing input ' + id);
  }
  assert.match(source, /id="scanLeverageBtn"/);
  assert.match(source, /id="meanFunding"/);
  assert.match(source, /id="meanExecutionCosts"/);
  assert.match(source, /scanLeverage/);
});


test('UI identifies the hold-first-ticket baseline separately from spot buy-and-hold', () => {
  assert.match(page, /Paths beating the first ticket/);
  assert.match(page, /initialTicketCurve/);
  assert.match(page, /ticketline/);
  assert.match(page, /Beat first ticket/);
  assert.match(page, /outperformInitialTicketPct/);
});
