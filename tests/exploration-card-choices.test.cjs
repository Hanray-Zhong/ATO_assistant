const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const choices = require('../assets/exploration-card-choices.js');
const rules = require('../assets/exploration-card-resource-rules.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/exploration-card-resources.js'), 'utf8'), context);
const cards = context.window.ATO_EXPLORATION_CARD_RESOURCES.cards;

test('the four priest offers are explicit immutable choices and preserve unrelated diplomacy rows', () => {
  const expected = [['c1:6426', 'fate', 3], ['c3:13521', 'fate', 3], ['c4:9303', 'babelianDebt', 1], ['c5:10325', 'paranoia', 1]];
  for (const [key, type, amount] of expected) {
    const card = cards[key];
    const before = JSON.stringify(card);
    const item = choices.descriptors(card)[0];
    assert.deepEqual(item.manualIndexes, [0]);
    assert.deepEqual(choices.resolve(card, {}, item.id, 'accept').effects, [{ type, amount }, { type: 'priests', amount: 1 }]);
    assert.deepEqual(choices.resolve(card, {}, item.id, 'decline').effects, []);
    assert.throws(() => choices.resolve(card, { blockGains: true }, item.id, 'accept'), /禁止获得祭司/);
    assert.deepEqual(choices.resolve(card, { blockGains: true }, item.id, 'decline').effects, []);
    assert.equal(JSON.stringify(card), before);
  }
});

test('choice conditions use the correct faction and retain the independent printed effects', () => {
  const c3 = cards['c3:13532'];
  const denied = { resourceRules: rules, diplomacy: [{ id: 'sunheirs', bonus: 0 }, { id: 'other', bonus: -2 }] };
  assert.equal(choices.descriptors(c3, denied)[0].conditionState, false);
  const active = { ...denied, diplomacy: [{ id: 'sunheirs', bonus: -2 }, { id: 'other', bonus: 0 }] };
  assert.deepEqual(choices.descriptors(c3, active)[0].manualIds, ['manual:5']);
  assert.deepEqual(choices.resolve(c3, active, 'choice:helian-loss', 'hull').effects, [{ type: 'hull', amount: -1 }]);
  assert.equal(choices.descriptors(c3, { diplomacy: [] })[0].conditionState, null);
  const emissaries = cards['c5:10316'];
  const allied = { diplomacy: [{ id: 'vanguard', bonus: 2 }] };
  assert.deepEqual(choices.descriptors(emissaries, allied)[0].manualIds, ['manual:1']);
  assert.deepEqual(choices.resolve(emissaries, allied, 'choice:peace-emissaries', 'accept').effects,
    [{ type: 'fate', amount: 1 }, { type: 'paranoia', amount: -1 }]);
  assert.deepEqual(choices.descriptors(cards['c2:13639'])[0].manualIds, ['manual:0'], 'conditional Fate bonuses are not part of the choice');
  assert.deepEqual(choices.resolve(cards['c2:13639'], {}, 'choice:moral-erosion', 'humanity').effects, [{ type: 'humanity', amount: -1 }]);
});

test('Chekhov has reciprocal branches sharing one receipt ID and does not trust the erroneous fallback badge', () => {
  const card = cards['c3:13534'];
  const low = { stats: { paradox: 2 } };
  const high = { stats: { paradox: 3 } };
  const fallback = choices.automatic(card, low)[0];
  assert.equal(fallback.conditionState, true);
  assert.deepEqual(fallback.effects, [{ type: 'paradox', amount: 1 }]);
  assert.equal(choices.descriptors(card, low)[0].conditionState, false);
  const selected = choices.resolve(card, high, 'choice:chekhov-loss', 'crew');
  assert.equal(fallback.id, selected.id);
  assert.deepEqual(selected.manualIds, ['manual:0', 'manual:1'], 'memory instructions manual:2 and manual:3 remain separate');
  assert.deepEqual(selected.effects, [{ type: 'frozenTime', amount: -1 }, { type: 'crew', amount: -1 }]);
  assert.equal(choices.automatic(card, high)[0].conditionState, false);
  for (const value of [null, '', 'bad', false, -1, 1.5]) {
    const unknown = { stats: { paradox: value }, record: { cycle: 'c3', paradox: 2 } };
    assert.equal(choices.automatic(card, unknown)[0].conditionState, null);
    assert.deepEqual(choices.automatic(card, unknown)[0].effects, []);
    assert.equal(choices.descriptors(card, unknown)[0].conditionState, null);
  }
  assert.equal(choices.automatic(card, { record: { cycle: 'c3', cycleStats: { c3: { paradox: '1' } } } })[0].conditionState, true);
});
