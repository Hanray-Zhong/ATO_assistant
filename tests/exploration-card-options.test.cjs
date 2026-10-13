const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const options = require('../assets/exploration-card-options.js');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/exploration-card-resources.js'), 'utf8'), ctx);
const dataset = ctx.window.ATO_EXPLORATION_CARD_RESOURCES;
const merchants = { c1: '13400', c2: '13640', c3: '13537', c4: '9328', c5: '10309' };
const key = (cycle, resource) => dataset.cycles[cycle].resources[resource].storageKey;

test('all five merchants expand their eight printed rows into twelve legal options', () => {
  for (const [cycle, cardId] of Object.entries(merchants)) {
    const card = dataset.cards[`${cycle}:${cardId}`];
    const menu = options.merchant(card);
    assert.equal(menu.limit, 5);
    assert.equal(menu.trades.length, 12, cycle);
    assert.equal(menu.manualIndexes.length, 9, cycle);
    assert.equal(new Set(menu.trades.map((item) => item.id)).size, 12);
    assert.ok(menu.trades.every((item) => item.costs.length === 1 && item.gains.length === 1));
    assert.ok(menu.manualIndexes.every((index) => !card.manual[index].badge), 'optional badge effects remain manual');
    for (const trade of menu.trades) {
      assert.ok(dataset.cycles[cycle].resources[trade.costs[0].resource]);
      assert.ok(dataset.cycles[cycle].resources[trade.gains[0].resource]);
    }
  }
  assert.equal(options.merchant(dataset.cards['c1:6404']), null);
});

test('implicit quantities on either alternative and output choices are independent trades', () => {
  const menu = options.merchant(dataset.cards['c2:13640']);
  const costs = menu.trades.filter((item) => item.gains[0].resource === 'violentAmbrosia' && item.gains[0].amount === 2);
  assert.deepEqual(costs.map((item) => item.costs[0]), [{ resource: 'cyclopeanMetal', amount: 1 }, { resource: 'chimericTar', amount: 1 }]);
  const gains = menu.trades.filter((item) => item.costs[0].resource === 'violentAmbrosia' && item.costs[0].amount === 4);
  assert.deepEqual(gains.map((item) => item.gains[0]), [{ resource: 'cyclopeanMetal', amount: 1 }, { resource: 'chimericTar', amount: 1 }]);
});

test('trades enforce full costs and persist the five-exchange limit across different options', () => {
  const menu = options.merchant(dataset.cards['c1:13400']);
  const initial = { resources: { 'c1-trireme': 20 }, explorationPersistentEffects: { c4: { note: 'keep' } } };
  const first = options.executeTrade(initial, 'c1', '13400', menu.trades[0], 3, 'draw:one', dataset);
  assert.equal(initial.resources['c1-trireme'], 20, 'input remains immutable');
  assert.equal(first.record.resources['c1-trireme'], 11);
  assert.equal(first.record.resources['c1-monument'], 3);
  const second = options.executeTrade(first.record, 'c1', '13400', menu.trades[1], 2, 'draw:one', dataset);
  assert.equal(second.record.explorationTradeRounds['draw:one'].count, 5);
  assert.throws(() => options.executeTrade(second.record, 'c1', '13400', menu.trades[0], 1, 'draw:one', dataset), /最多兑换 5 次/);
  assert.throws(() => options.executeTrade({ resources: { 'c1-trireme': 8 } }, 'c1', '13400', menu.trades[0], 3, 'draw:two', dataset), /不足/);
  assert.throws(() => options.executeTrade(initial, 'c1', '13400', menu.trades[0], 0.5, 'draw:two', dataset), /非负整数/);
  assert.throws(() => options.executeTrade(first.record, 'c2', '13640', options.merchant(dataset.cards['c2:13640']).trades[0], 1, 'draw:one', dataset), /不属于/);
  assert.throws(() => options.executeTrade(initial, 'c1', '13400', { ...menu.trades[0], gains: [{ resource: 'monument', amount: 999 }] }, 1, 'draw:two', dataset), /无效/);
});

test('undo refunds only its transaction and restores slots while preserving later changes', () => {
  const menu = options.merchant(dataset.cards['c1:13400']);
  const initial = { resources: { 'c1-trireme': '10', unrelated: 7 } };
  const first = options.executeTrade(initial, 'c1', '13400', menu.trades[0], 1, 'draw', dataset);
  const undone = options.undoTrade(first.record, first.receipt);
  assert.deepEqual(undone.resources, initial.resources);
  assert.equal(undone.explorationTradeRounds.draw, undefined);
  assert.throws(() => options.undoTrade(undone, first.receipt), /已撤销/);
  const later = { ...first.record, resources: { ...first.record.resources, 'c1-trireme': 12, 'c1-monument': 2 } };
  const reversed = options.undoTrade(later, first.receipt);
  assert.equal(reversed.resources['c1-trireme'], 15);
  assert.equal(reversed.resources['c1-monument'], 1);
  assert.throws(() => options.undoTrade({ ...first.record, resources: { ...first.record.resources, 'c1-monument': 0 } }, first.receipt), /无法撤销/);
});

test('String Wish requires an initial choice and persists the selected resource for five repayments', () => {
  const initial = { cycle: 'c4', resources: {} };
  assert.equal(options.wishPlan(initial, 'c4', null, false, dataset).status, 'choice');
  const grant = options.applyWish(initial, options.wishPlan(initial, 'c4', 'imperialScroll', false, dataset));
  assert.equal(grant.record.resources[key('c4', 'imperialScroll')], 5);
  assert.equal(grant.record.explorationPersistentEffects.c4.stringWish.remaining, 5);
  const repayPlan = options.wishPlan(grant.record, 'c4', 'cursedDerelict', false, dataset);
  assert.equal(repayPlan.resource, 'imperialScroll', 'repayment uses the persisted choice');
  const repayment = options.applyWish(grant.record, repayPlan);
  assert.equal(repayment.record.resources[key('c4', 'imperialScroll')], 3);
  assert.equal(repayment.record.explorationPersistentEffects.c4.stringWish.remaining, 4);
  const penalized = options.applyWish(repayment.record, options.wishPlan(repayment.record, 'c4', null, true, dataset));
  assert.equal(penalized.record.resources[key('c4', 'imperialScroll')], 0);
  assert.equal(penalized.record.explorationPersistentEffects.c4.stringWish.remaining, 3);
});

test('String Wish cannot partially charge and instead adds Babelian Debt when insufficient', () => {
  const record = { cycle: 'c4', resources: { 'c4-cursedDerelict': 2 }, cycleStats: { c4: { babelianDebt: '3' } }, babelianDebt: '3', explorationPersistentEffects: { c4: { stringWish: { resource: 'cursedDerelict', remaining: 2 } } } };
  const result = options.applyWish(record, options.wishPlan(record, 'c4', null, false, dataset));
  assert.equal(result.record.resources['c4-cursedDerelict'], 2);
  assert.equal(result.record.cycleStats.c4.babelianDebt, '4');
  assert.equal(result.record.babelianDebt, '4');
  assert.equal(result.record.explorationPersistentEffects.c4.stringWish.remaining, 1);
  assert.match(result.summary, /资源不足/);
  const undone = options.undoWish(result.record, result.receipt);
  assert.deepEqual(undone, record);
  const stalePlan = options.wishPlan(record, 'c4', null, false, dataset);
  assert.throws(() => options.applyWish({ ...record, resources: { 'c4-cursedDerelict': 5 } }, stalePlan), /资源已变化/);
});

test('String Wish undo requires the latest state and refuses stale plans or spent rewards', () => {
  const record = { resources: {} };
  const plan = options.wishPlan(record, 'c4', 'cursedDerelict', false, dataset);
  const grant = options.applyWish(record, plan);
  assert.throws(() => options.applyWish(grant.record, plan), /标记已变化/);
  const repayment = options.applyWish(grant.record, options.wishPlan(grant.record, 'c4', null, false, dataset));
  assert.throws(() => options.undoWish(repayment.record, grant.receipt), /后续结算/);
  const repaidUndo = options.undoWish(repayment.record, repayment.receipt);
  assert.equal(repaidUndo.resources['c4-cursedDerelict'], 10);
  const grantUndo = options.undoWish(repaidUndo, grant.receipt);
  assert.equal(grantUndo.explorationPersistentEffects.c4.stringWish, undefined);
  assert.equal(grantUndo.resources['c4-cursedDerelict'], undefined);
  assert.throws(() => options.undoWish({ ...grant.record, resources: { 'c4-cursedDerelict': 0 } }, grant.receipt), /无法撤销/);
  assert.throws(() => options.applyWish({ ...record, resources: { 'c4-cursedDerelict': 1 } }, plan), /已变化/);
});

test('exhausted wishes start a new chosen resource and malformed state stays manual', () => {
  const record = { explorationPersistentEffects: { c4: { stringWish: { resource: 'cursedDerelict', remaining: 0 } } } };
  const result = options.applyWish(record, options.wishPlan(record, 'c4', 'imperialScroll', false, dataset));
  assert.equal(result.record.explorationPersistentEffects.c4.stringWish.resource, 'imperialScroll');
  assert.equal(result.record.explorationPersistentEffects.c4.stringWish.remaining, 5);
  assert.equal(options.wishPlan({ explorationPersistentEffects: { c4: { stringWish: { resource: 'unknown', remaining: 4 } } } }, 'c4', null, false, dataset).status, 'manual');
  assert.equal(options.wishPlan({}, 'c1', 'imperialScroll', false, dataset).status, 'manual');
});

test('pile bans suppress initial Wish resources but preserve marks and later repayment', () => {
  const record = { resources: { 'c4-cursedDerelict': 9 } };
  const grant = options.applyWish(record, options.wishPlan(record, 'c4', 'cursedDerelict', false, dataset, { blockGains: true }));
  assert.equal(grant.record.resources['c4-cursedDerelict'], 9);
  assert.equal(grant.changes.length, 0);
  assert.equal(grant.record.explorationPersistentEffects.c4.stringWish.remaining, 5);
  assert.match(grant.summary, /禁止资源收益/);
  const repayment = options.applyWish(grant.record, options.wishPlan(grant.record, 'c4', null, false, dataset, { blockGains: true }));
  assert.equal(repayment.record.resources['c4-cursedDerelict'], 6);
  assert.equal(repayment.record.explorationPersistentEffects.c4.stringWish.remaining, 4);
  assert.equal(options.undoWish(grant.record, grant.receipt).explorationPersistentEffects.c4.stringWish, undefined);
});
