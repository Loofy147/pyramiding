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
