const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const options = require('../assets/exploration-card-options.js');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/exploration-card-resources.js'), 'utf8'), ctx);
const dataset = ctx.window.ATO_EXPLORATION_CARD_RESOURCES;
const key = resource => dataset.cycles.c4.resources[resource].storageKey;
const record = (debt, fate, stocks = {}) => ({ cycle: 'c4', cycleStats: { c4: { babelianDebt: String(debt), fate: String(fate) } },
  resources: Object.fromEntries(Object.entries(stocks).map(([resource, stock]) => [key(resource), stock])) });

test('Diminishing Returns offers only affordable resources with the correct debt tier and stock labels', () => {
  const initial = record(2, 6, { cursedDerelict: 3, imperialScroll: 1, babylonianContraption: 1 });
  const plan = options.duesPlan(initial, 'c4', dataset);
  assert.equal(plan.status, 'choice');
  assert.deepEqual(plan.choices.map(item => [item.resource, item.amount]), [['cursedDerelict', 3], ['babylonianContraption', 1]]);
  assert.match(plan.choices[0].label, /3 .*（库存 3）/);
  assert.deepEqual(plan.effects, []);
  assert.throws(() => options.applyDues(initial, plan, null, dataset), /请选择/);
  assert.throws(() => options.applyDues(initial, plan, 'imperialScroll', dataset), /请选择/);
  const penalized = options.duesPlan(record(3, 7, { cursedDerelict: 4, imperialScroll: 3, babylonianContraption: 2 }), 'c4', dataset);
  assert.deepEqual(penalized.requirements.map(item => item.amount), [5, 3, 2]);
  assert.deepEqual(penalized.choices.map(item => item.resource), ['imperialScroll', 'babylonianContraption']);
  assert.deepEqual(penalized.effects, [{ type: 'hull', amount: -1 }]);
  assert.equal(penalized.removePermanent, false);
});

test('Diminishing Returns payment is immutable, rejects stale plans, and undo preserves later stock changes', () => {
  const initial = record(0, 7, { cursedDerelict: 5, imperialScroll: 2 });
  const plan = options.duesPlan(initial, 'c4', dataset);
  const applied = options.applyDues(initial, plan, 'imperialScroll', dataset);
  assert.equal(initial.resources[key('imperialScroll')], 2);
  assert.equal(applied.record.resources[key('imperialScroll')], 0);
  assert.equal(applied.removePermanent, true);
  assert.deepEqual(applied.effects, [{ type: 'hull', amount: -1 }]);
  assert.deepEqual(applied.record.cycleStats, initial.cycleStats, 'numeric effects are applied by the shared record transaction');
  assert.deepEqual(options.undoDues(applied.record, applied.receipt), initial);
  const later = structuredClone(applied.record);
  later.resources[key('imperialScroll')] = 4;
  assert.equal(options.undoDues(later, applied.receipt).resources[key('imperialScroll')], 6);
  for (const changed of [
    record(3, 7, { cursedDerelict: 5, imperialScroll: 2 }),
    record(0, 6, { cursedDerelict: 5, imperialScroll: 2 }),
    record(0, 7, { cursedDerelict: 4, imperialScroll: 2 }),
  ]) assert.throws(() => options.applyDues(changed, plan, 'imperialScroll', dataset), /已变化/);
});

test('Diminishing Returns needs no resource choice when all inventories are insufficient', () => {
  const initial = record(3, 7, { cursedDerelict: 4, imperialScroll: 2, babylonianContraption: 1 });
  const plan = options.duesPlan(initial, 'c4', dataset);
  assert.equal(plan.status, 'ready');
  assert.deepEqual(plan.choices, []);
  assert.deepEqual(plan.effects, [{ type: 'doom', amount: 1 }, { type: 'hull', amount: -1 }]);
  const applied = options.applyDues(initial, plan, null, dataset);
  assert.deepEqual(applied.record.resources, initial.resources, 'partial payments are never consumed');
  assert.equal(applied.receipt.fallback, true);
  assert.match(applied.summary, /灾祸指示物 \+1.*船体 -1/);
  assert.deepEqual(options.undoDues(applied.record, applied.receipt), initial);
  assert.equal(options.duesPlan(record(0, 6), 'c4', dataset).removePermanent, true);
});

test('Diminishing Returns uses C4 scoped stats and declines malformed inventory or another cycle', () => {
  const initial = record(1, 0, { babylonianContraption: 1 });
  initial.cycle = 'c3'; initial.babelianDebt = 8; initial.fate = 9;
  const plan = options.duesPlan(initial, 'c4', dataset);
  assert.equal(plan.status, 'choice');
  assert.equal(plan.choices[0].amount, 1);
  assert.deepEqual(plan.effects, []);
  initial.resources[key('babylonianContraption')] = -1;
  assert.equal(options.duesPlan(initial, 'c4', dataset).status, 'manual');
  assert.equal(options.duesPlan(record(0, 0), 'c3', dataset).status, 'manual');
});

test('Diminishing Returns requires recorded Debt and Fate while omitted inventories remain zero', () => {
  for (const stat of ['babelianDebt', 'fate']) {
    for (const value of [undefined, null, '', '  ', true, false, {}, [], -1, 1.5, '1.5', NaN, Infinity]) {
      const initial = record(0, 0, { babylonianContraption: 1 });
      if (value === undefined) delete initial.cycleStats.c4[stat];
      else initial.cycleStats.c4[stat] = value;
      const plan = options.duesPlan(initial, 'c4', dataset);
      assert.equal(plan.status, 'manual', `${stat}: ${String(value)}`);
      assert.deepEqual(plan.effects, []);
      assert.deepEqual(plan.choices, []);
      assert.equal(plan.removePermanent, false, 'unknown values cannot remove the card permanently');
      assert.throws(() => options.applyDues(initial, plan, 'babylonianContraption', dataset));
      assert.equal(initial.resources[key('babylonianContraption')], 1);
    }
  }
  const knownZero = options.duesPlan(record(0, 0), 'c4', dataset);
  assert.equal(knownZero.status, 'ready');
  assert.ok(knownZero.requirements.every(item => item.stock === 0));
  assert.equal(knownZero.removePermanent, true, 'an explicitly recorded zero remains valid');
});
