const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const rules = require('../assets/exploration-card-conditions.js');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/exploration-card-resources.js'), 'utf8'), ctx);
const dataset = ctx.window.ATO_EXPLORATION_CARD_RESOURCES;
const dogDays = dataset.cards['c1:6400'];

test('record context prefers cycle fields and never borrows another cycle legacy values', () => {
  const record = { cycle: 'c1', fate: '11', strangers: '5', crew: '4', cycleStats: { c1: { fate: '7', strangers: '', crew: 0 }, c2: { fate: '2' } } };
  const c1 = rules.contextForRecord(record, 'c1');
  assert.equal(c1.record, record);
  assert.equal(c1.stats.fate, 7);
  assert.equal(c1.stats.strangers, null, 'blank is unknown, not zero');
  assert.equal(c1.stats.crew, 0);
  const c2 = rules.contextForRecord(record, 'c2');
  assert.equal(c2.stats.fate, 2);
  assert.equal(c2.stats.strangers, null);
  assert.equal(c2.stats.crew, null);
  assert.equal(rules.contextForRecord({ cycleStats: { c1: { fate: -1, strangers: 'NaN' } } }, 'c1').stats.fate, null);
  assert.equal(rules.contextForRecord({ fate: '  ' }, 'c1').stats.fate, null);
  assert.equal(rules.contextForRecord({ cycle: 'c1', progress: 9, cycleStats: { c1: { progressTokens: 3 } } }, 'c1').stats.progress, 3);
});

test('progress and doom counters require a unique explicitly named numeric entry', () => {
  const record = { cycleStats: { c1: { counters: { p: { name: 'Progress Token', count: 4 }, d: { name: '灾祸指示物', count: '2' } } } } };
  const context = rules.contextForRecord(record, 'c1');
  assert.equal(context.stats.progress, 4);
  assert.equal(context.stats.doom, 2);
  record.cycleStats.c1.counters.p2 = { name: '进展标记', count: 1 };
  assert.equal(rules.contextForRecord(record, 'c1').stats.progress, null, 'duplicate counters must be reconciled by the player');
});

test('verified Cycle I Fate pictograms resolve the existing icon condition data', () => {
  const context = rules.contextForRecord({ cycle: 'c1', fate: '7' }, 'c1');
  for (const badge of ['ICON(black lozenge with white vessel glyph) 7+', 'ICON(black hexagon with triangle-hook glyph)/7+', 'ICON(Titan symbol)/7+']) {
    const condition = rules.conditionFromBadge(badge, 'c1');
    assert.equal(condition.key, 'fate');
    assert.equal(condition.threshold, 7);
    assert.equal(rules.conditionMet({ type: 'icon', badge }, context), true);
    assert.equal(rules.conditionMet({ type: 'icon', badge }, { ...context, stats: { fate: 6 } }), false);
    assert.equal(rules.conditionMet({ type: 'icon', badge }, { ...context, stats: { fate: null } }), null);
    assert.equal(rules.conditionFromBadge(badge, 'c2'), null, 'unverified cycle descriptions stay unknown');
  }
});

test('explicit track labels and verified C4 money-bag OR conditions are evaluated inclusively', () => {
  const badge = 'ICON(white trident-like glyph on dark lozenge)/8+ or ICON(white Α-like glyph on dark lozenge)/4+';
  const condition = rules.conditionFromBadge(badge, 'c4');
  assert.equal(condition.type, 'or');
  assert.deepEqual(condition.conditions.map((entry) => entry.key), ['fate', 'babelianDebt']);
  assert.equal(rules.conditionMet(condition, { cycleId: 'c4', stats: { fate: 7, babelianDebt: 4 } }), true);
  assert.equal(rules.conditionMet(condition, { cycleId: 'c4', stats: { fate: 7, babelianDebt: 3 } }), false);
  assert.equal(rules.conditionMet(condition, { cycleId: 'c4', stats: { fate: 7, babelianDebt: null } }), null);
  assert.equal(rules.conditionMet(rules.conditionFromBadge('Progress Token 3+', 'c1'), { cycleId: 'c1', stats: { progress: 3 } }), true);
  assert.equal(rules.conditionMet(rules.conditionFromBadge('陌生人 3+', 'c1'), { cycleId: 'c1', stats: { strangers: 2 } }), false);
  assert.equal(rules.conditionFromBadge('ICON(white Ψ glyph in dark hexagon) 8+ or Argo Fate 4+', 'c3').type, 'or');
  assert.equal(rules.conditionFromBadge('ICON(figure)/5+', 'c2').key, 'refugees');
  assert.equal(rules.conditionFromBadge('ICON(unverified glyph)/5+', 'c2'), null);
});

test('Dog Days applies losses first, fallback only after no actual Crew loss, and Fate bonus last', () => {
  const plan = rules.planStrangers({ cycle: 'c1', strangers: '7', crew: '5', fate: '7' }, 'c1', dogDays);
  assert.equal(plan.status, 'ready');
  assert.equal(plan.id, 'conditional:dog-days');
  assert.equal(plan.dynamic, true);
  assert.deepEqual(plan.manualIndexes, [0, 1, 2]);
  assert.deepEqual(plan.effects, [{ type: 'crew', amount: -2 }, { type: 'strangers', amount: -6 }, { type: 'strangers', amount: 2 }]);
  assert.deepEqual(rules.planStrangers({ strangers: 2, crew: 5, fate: 6 }, 'c1', dogDays).effects, [{ type: 'strangers', amount: 1 }]);
  assert.deepEqual(rules.planStrangers({ strangers: 6, crew: 0, fate: 6 }, 'c1', dogDays).effects, [{ type: 'strangers', amount: -6 }, { type: 'strangers', amount: 1 }]);
  assert.deepEqual(rules.planStrangers({ strangers: 8, crew: 1, fate: 6 }, 'c1', dogDays).effects, [{ type: 'crew', amount: -1 }, { type: 'strangers', amount: -6 }]);
});

test('unknown required values preserve all manual rows and plans recalculate from current records', () => {
  const record = { strangers: 5, crew: 3, fate: '' };
  assert.equal(rules.planStrangers(record, 'c1', dogDays).status, 'manual');
  assert.deepEqual(rules.simpleConditionalEffects(dogDays, rules.contextForRecord(record, 'c1')), []);
  record.fate = 0;
  const before = rules.planStrangers(record, 'c1', dogDays);
  record.strangers = 8;
  const after = rules.planStrangers(record, 'c1', dogDays);
  assert.equal(before.effects[0].amount, -1);
  assert.equal(after.effects[0].amount, -2);
  assert.equal(rules.planStrangers({ cycle: 'c2', strangers: 5, crew: 3, fate: 0 }, 'c1', dogDays).status, 'manual');
  assert.equal(rules.planStrangers({ cycle: 'c2', strangers: 5, crew: 3, fate: 0 }, 'c2', dogDays).status, 'manual');
});
