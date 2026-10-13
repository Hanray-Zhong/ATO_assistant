const test = require('node:test');
const assert = require('node:assert/strict');
const effects = require('../assets/exploration-card-effects.js');
const conditions = require('../assets/exploration-card-conditions.js');
const resources = require('../assets/exploration-card-resource-rules.js');

const confirmed = [
 ['c1','6426','inverted triangle - Despair token','fate'],
 ['c1','6437','labyrinth diamond','faction'],
 ['c2','13630','solid black disc','hull'],
 ['c2','13633','small dark emblem','equipment'],
 ['c2','13635','黑色交叉状图标','crew'],
 ['c2','13635','深色团块状图标','hull'],
 ['c2','13635','深色五边形内白色Ψ状符号','fate'],
 ['c2','13635','深色五边形内白色动物剪影','refugees'],
 ['c2','13635','三角形轮廓内的小符号','doom'],
 ['c2','13636','深色淤泥状指示物','map-token'],
 ['c2','13639','outlined triangle with small inner glyph','doom'],
 ['c3','13515','black emblem glyph','progress'],
 ['c3','13530','pale outlined inverted-triangle glyph with a small inner emblem','nymphCharges'],
 ['c3','13532','pale outlined inverted-triangle glyph with a small inner emblem','doom'],
 ['c3','13535','dark disc with a white emblem','hull'],
 ['c3','13535','white Α glyph in dark hexagon','paradox'],
 ['c3','13541','sun with rays','faction'],
 ['c4','9326','small black splatter-like card-type icon','equipment'],
 ['c4','9329','white glyph on dark lozenge','babelianDebt'],
 ['c4','9329','pale outlined triangle glyph','doom'],
 ['c4','9339','book-with-flame resource glyph','knowledge'],
 ['c4','9344','white rounded glyph on dark lozenge','babelianDebt'],
 ['c5','10313','dark irregular sludge-like token glyph','map-token'],
 ['c5','10326','dark round glyph with a pale inner emblem','nemesis','Allied'],
];

test('all 24 player-confirmed samples have the correct identity and readable labels', () => {
 for (const [cycle,card,glyph,expected,badge=''] of confirmed) {
  const identity=effects.iconIdentity(glyph,cycle,card,badge);
  assert.equal(identity?.type || identity?.kind,expected,`${cycle}:${card} ${glyph}`);
  assert.ok(!effects.displayIcons(`ICON(${glyph})`,cycle,card,badge).includes('ICON('));
  if(identity.kind==='stat') assert.deepEqual(effects.parse(`Gain +1 ICON(${glyph}).`,cycle,card,badge).effects,[{type:expected,amount:1}]);
 }
});

test('C2 Refugee thresholds and writes use crewCounters and preserve Defectors', () => {
 const before={cycle:'c2',crew:'4',renegade:'8',cycleStats:{c2:{crew:'4',renegade:'8',crewCounters:{crew:4,refugees:2,captives:1}},c3:{paradox:'3'}}};
 const context=conditions.contextForRecord(before,'c2');
 assert.equal(conditions.conditionMet(conditions.conditionFromBadge('ICON(figure)/3+','c2'),context),false);
 assert.equal(conditions.conditionMet(conditions.conditionFromBadge('ICON(figure)/2+','c2'),context),true);
 const gain=effects.apply(before,'c2',[{type:'refugees',amount:3}]);
 assert.equal(gain.record.cycleStats.c2.crewCounters.refugees,3,'shared crew capacity clamps the gain to one');
 assert.equal(gain.record.renegade,'8');assert.equal(gain.record.cycleStats.c2.renegade,'8');
 assert.equal(gain.record.crew,'4');assert.equal(gain.record.cycleStats.c3.paradox,'3');
 assert.equal(gain.changes[0].amount,1);
 assert.deepEqual(effects.revert(gain.record,gain.changes),before);
 const old={cycle:'c2',crew:'5',crewBoxes:{'c2-crew-4':'refugee','c2-crew-5':'captive'}};
 assert.equal(conditions.contextForRecord(old,'c2').stats.refugees,1);
 assert.equal(effects.apply(old,'c2',[{type:'refugees',amount:1}]).record.cycleStats.c2.crewCounters.refugees,2);
 const card={cycleId:'c2',cardId:'13629',manual:[{text:'Gain +1 ICON(small dark human figure).'}]};
 const rows=effects.describe(card,{cycleId:'c2',appliedEffects:{'manual:0':{ruleVersion:2,changes:[{type:'renegade',amount:1}]}}},resources);
 assert.equal(rows[0].receiptMismatch,true,'old wrong writes are exposed for undo, never silently converted');
});

test('Nymph charge limits and the corrected Hull and Debt identities write the actual fields', () => {
 const before={cycle:'c3',nymphCharges:'1',nymphLimit:'2',hull:'4',cycleStats:{c3:{hull:'4'}}};
 const charges=effects.apply(before,'c3',[{type:'nymphCharges',amount:2}]);
 assert.equal(charges.record.nymphCharges,'2');assert.equal(charges.changes[0].amount,1);
 assert.deepEqual(effects.revert(charges.record,charges.changes),before);
 const parsed=effects.parse('Lose -1 ICON(dark disc with a white emblem).','c3','13535');
 assert.equal(effects.apply(before,'c3',parsed.effects).record.hull,'3');
 assert.equal(conditions.conditionFromBadge('ICON(white Α glyph in dark hexagon)/4+','c3').key,'paradox');
 assert.equal(conditions.conditionFromBadge('ICON(white rounded glyph on dark lozenge)/4+','c4').key,'babelianDebt');
 assert.equal(conditions.conditionFromBadge('ICON(white glyph on dark lozenge)/3+','c4').key,'babelianDebt');
 assert.equal(effects.iconType('small dark round resource glyph','c4','9329','ICON(white trident-like glyph on dark lozenge)/7+'),'hull');
 assert.equal(effects.iconType('small dark round resource glyph','c4','9329'),'babelianDebt','same vague text has a different symbol on other rows');
 assert.equal(effects.iconType('black disc with white emblem','c3','13532','Denounced'),'hull');
 assert.equal(effects.iconType('black disc with white emblem','c3','13534'),'hull');
 assert.equal(effects.iconType('outlined slanted angular glyph with white bars','c3','13532','Friendly'),'progress');
 assert.equal(effects.iconType('outlined slanted angular glyph with white bars','c3','13532','Allied'),'paradox');
});

module.exports={confirmed};
