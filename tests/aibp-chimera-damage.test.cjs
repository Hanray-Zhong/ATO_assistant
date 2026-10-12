const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../aibp/index.html'), 'utf8').replace(/\r\n/g, '\n');
const clone = value => JSON.parse(JSON.stringify(value));

function harness() {
  const bp = { deck: [], discard: [], pending: null, damage1: [], damage2: [], removed: [] };
  let criticalMass = 0;
  const context = vm.createContext({
    currentApostle: 'CHIMERA_METASTASIOS', currentBpView: '第二损伤堆',
    piles: { CHIMERA_METASTASIOS: { BP: bp } }, window: {},
    isChimera: () => true, isCyclonus: () => false, supportsCombinedBp: () => false,
    ensurePiles() {}, rememberUndo() {}, savePiles() {}, renderAibpCards() {},
    setChimeraPhaseFromCard() {}, insertPromotedCard() {}, promoteAiFromLevel() {},
    promoteAiForBpIII() {}, hasSupply: () => false, shuffleCards: cards => cards,
    addCriticalMass: count => { criticalMass += count; },
  });
  for (const name of ['currentBpDamageKey', 'currentBpDamageView', 'bpDamageValue',
    'notifyBpWound', 'pushBpDamage', 'addChimeraSecondDamage', 'resolveBpDefeat', 'resolveBpCritical',
    'sameCard', 'removePendingFromDeck', 'resolveBp', 'addBpSpecialDamage',
    'addChimeraDamage2Sw', 'removeChimeraDamage2Sw']) {
    const match = source.match(new RegExp(`^    function ${name}\\([^]*?^    }`, 'm'));
    assert.ok(match, name);
    vm.runInContext(match[0], context);
  }
  return { context, bp, get criticalMass() { return criticalMass; } };
}

for (const level of ['I', 'II', 'III']) {
  for (const mode of ['defeat', 'critical', 'vp-defeat', 'vp-critical']) {
    test(`Chimera ${level} ${mode}: regular wounds use damage1; only VP bonus uses damage2`, () => {
      const h = harness();
      const card = { type: 'BP', level, index: 1 };
      h.bp.deck = [card];
      h.bp.pending = card;
      h.context.resolveBp(mode);
      const expected = level === 'III'
        ? mode.endsWith('critical') ? { ...card, damageValue: 2 } : { special: 'DW' }
        : card;
      assert.deepEqual(clone(h.bp.damage1), [expected]);
      assert.deepEqual(clone(h.bp.damage2), mode.startsWith('vp-') ? [{ special: 'SW' }] : []);
      assert.equal(h.criticalMass, mode.startsWith('vp-') ? 1 : 0);
      assert.equal(h.bp.pending, null);
    });
  }
}

test('SW and DW buttons use regular damage even while viewing the second pile', () => {
  const h = harness();
  h.bp.damage2 = [{ special: 'SW' }];
  h.context.addBpSpecialDamage('SW');
  h.context.currentBpView = '第二损伤堆';
  h.context.addBpSpecialDamage('DW');
  assert.deepEqual(clone(h.bp.damage1), [{ special: 'SW' }, { special: 'DW' }]);
  assert.deepEqual(clone(h.bp.damage2), [{ special: 'SW' }]);
  assert.equal(h.context.currentBpView, '常规损伤堆');
  assert.equal(h.criticalMass, 0);
});

test('second damage plus and minus buttons continue to affect only the second pile', () => {
  const h = harness();
  h.bp.damage1 = [{ special: 'DW' }];
  h.context.addChimeraDamage2Sw();
  assert.deepEqual(clone(h.bp.damage2), [{ special: 'SW' }]);
  assert.equal(h.context.currentBpView, '第二损伤堆');
  assert.equal(h.criticalMass, 1);
  h.context.removeChimeraDamage2Sw();
  assert.deepEqual(clone(h.bp.damage2), []);
  assert.deepEqual(clone(h.bp.damage1), [{ special: 'DW' }]);
  assert.equal(h.context.currentBpView, '第二损伤堆');
});

test('the BP area no longer includes the damage destination selector', () => {
  assert.doesNotMatch(source, /chimeraDamageTarget|bpDamageTargetSelect|damage-target/);
  assert.match(source, /id="addSwDamage2Button"/);
  assert.match(source, /id="removeSwDamage2Button"/);
  assert.match(source, /data-bp-zoom-action="vp-defeat"/);
});
