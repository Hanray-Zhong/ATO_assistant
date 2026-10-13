const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rules = require("../assets/exploration-card-delays.js");
const resourceRules = require("../assets/exploration-card-resource-rules.js");
const conditionRules = require("../assets/exploration-card-conditions.js");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../assets/exploration-card-resources.js"), "utf8"), sandbox);
const dataset = sandbox.window.ATO_EXPLORATION_CARD_RESOURCES;
const clone = (value) => JSON.parse(JSON.stringify(value));
const card = (cycleId, cardId) => dataset.cards[`${cycleId}:${cardId}`];
const entry = (cardId, drawnAt = "round-1") => ({ id: cardId, name: card("c2", cardId)?.titleZh || cardId, day: 12, drawnAt });
const aaCandidates = [
  { key: "recruitment programs", label: "招聘项目", aa: true, unlocked: true },
  { key: "up-stream navigation@@cycle2", label: "上游导航", aa: true, unlocked: true },
  { key: "ordinary active card", aa: false, structureCardTypes: ["active"] },
  { key: "locked AA", aa: true, unlocked: false },
];
const propylon = card("c2", "13631");
function schedulePropylon(record = {}, extra = {}, drawnAt = "round-1", day = 12) {
  return rules.schedule(record, "c2", day, entry("13631", drawnAt), {
    card: propylon, confirmed: true, techCandidates: aaCandidates, random: () => 0, ...extra,
  });
}

test("the module exports its browser UMD API and recognizes the printed battle destinations", () => {
  const browser = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../assets/exploration-card-delays.js"), "utf8"), browser);
  assert.equal(typeof browser.window.ATO_EXPLORATION_DELAY_RULES.schedule, "function");
  for (const [cycleId, cardId, battle] of [
    ["c1", "6434", "Ambush Battle"], ["c1", "6440", "Temenos Battle"],
    ["c2", "13638", "Cruel Lesson Battle"], ["c4", "9327", "Pandora Horizon Battle"],
  ]) {
    const descriptors = rules.delayed(card(cycleId, cardId));
    const destination = descriptors.find((item) => item.kind === "end-step-battle");
    assert.equal(destination.battle, battle, `${cycleId}:${cardId}`);
    assert.equal(destination.trigger, "explore-end");
    const modifier = descriptors.find((item) => item.kind === "battle-modifier");
    assert.equal(modifier.conditionState, null, "a printed icon cannot become an unconditional escalation");
  }
  assert.deepEqual(rules.delayed(card("c1", "6404")), []);
});

test("Propylon groups its four instructions and requires confirmation of the unresolved condition", () => {
  const descriptors = rules.delayed(propylon);
  assert.equal(descriptors.length, 1);
  assert.equal(descriptors[0].kind, "tech-disable");
  assert.equal(descriptors[0].offsetDays, 10);
  assert.equal(descriptors[0].conditionState, null);
  assert.deepEqual(descriptors[0].manualIndexes, [0, 1, 2, 3]);
  assert.throws(() => rules.schedule({}, "c2", 12, entry("13631"), { card: propylon, techCandidates: aaCandidates }), /确认卡面条件/);
  const inapplicable = rules.schedule({ notes: "keep" }, "c2", 12, entry("13631"), {
    card: propylon, context: { confirmedConditions: { "manual:0": false } },
  });
  assert.equal(inapplicable.changed, false);
  assert.deepEqual(inapplicable.record, { notes: "keep" });
});

test("Propylon randomly disables one verified available AA and leaves unlocked technology intact", () => {
  const before = { cycle: "c2", resources: { "c2-warTrireme": 5 }, unlocked: ["keep"], notes: "keep" };
  const snapshot = clone(before);
  const result = schedulePropylon(before, { random: () => 0.99 });
  assert.equal(result.receipts.length, 1);
  const receipt = result.receipts[0];
  assert.equal(receipt.techKey, "up-stream navigation@@cycle2");
  assert.equal(receipt.dueDay, 22);
  assert.equal(receipt.trigger, "development");
  assert.equal(receipt.status, "waiting");
  assert.deepEqual(rules.getTechLock(result.record, "c2", receipt.techKey), {
    receiptId: receipt.receiptId, untilDay: 22, label: "上游导航",
  });
  assert.equal(rules.isTechDisabled(result.record, "c1", receipt.techKey), false);
  assert.deepEqual(result.record.unlocked, ["keep"]);
  assert.deepEqual(before, snapshot, "scheduling is pure and does not mutate the caller's record");
});

test("a repair requires its own cycle, due day, and development phase, including overdue days", () => {
  const scheduled = schedulePropylon({ cycle: "c2", resources: { "c2-warTrireme": 5 } });
  const key = scheduled.receipts[0].techKey;
  for (const [cycleId, day, phase] of [["c1", 22, "development"], ["c2", 21, "development"], ["c2", 22, "explore-end"]]) {
    const result = rules.process(scheduled.record, cycleId, day, phase);
    assert.equal(result.receipts.length, 0);
    assert.equal(rules.isTechDisabled(result.record, "c2", key), true);
  }
  const result = rules.process(scheduled.record, "c2", 23, "development");
  assert.equal(result.receipts[0].status, "done");
  assert.match(result.summary, /已修复可用/);
  assert.equal(rules.isTechDisabled(result.record, "c2", key), false);
  assert.equal(result.record.resources["c2-warTrireme"], 5);
  assert.equal(rules.process(result.record, "c2", 24, "development").changed, false);
});

test("duplicate scheduling is idempotent and a later draw selects another available AA", () => {
  const first = schedulePropylon();
  const duplicate = schedulePropylon(first.record, { random: () => { throw new Error("must not reroll"); } });
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.receipts[0].duplicate, true);
  assert.equal(rules.getQueue(duplicate.record, "c2").length, 1);
  const second = schedulePropylon(first.record, {}, "round-2", 13);
  assert.equal(second.receipts[0].techKey, "up-stream navigation@@cycle2", "exclude the AA disabled by the first draw");
  assert.equal(second.receipts[0].dueDay, 23);
  assert.equal(rules.getQueue(second.record, "c2").length, 2);
  assert.throws(() => schedulePropylon(second.record, {}, "round-3"), /没有符合条件/);
});

test("manual AA selection requires confirmation and scheduling validates random input", () => {
  assert.throws(() => schedulePropylon({}, { techCandidates: [], techKey: "unverified" }), /确认选择/);
  const explicit = schedulePropylon({}, { techCandidates: [], techKey: "manual AA", techLabel: "玩家确认的 AA", confirmedAA: true });
  assert.equal(explicit.receipts[0].techKey, "manual AA");
  assert.throws(() => schedulePropylon({}, { techCandidates: [], techKey: "__proto__", confirmedAA: true }), /确认选择/);
  assert.throws(() => schedulePropylon({}, { random: () => 1 }), /随机数无效/);
  assert.throws(() => schedulePropylon({}, { random: () => NaN }), /随机数无效/);
});

test("repair or cancel only releases the lock belonging to that receipt", () => {
  const first = schedulePropylon();
  const receipt = first.receipts[0];
  const cancelled = rules.cancel(first.record, receipt.receiptId);
  assert.equal(rules.isTechDisabled(cancelled.record, "c2", receipt.techKey), false);
  assert.equal(rules.getQueue(cancelled.record, "c2")[0].status, "cancelled");
  assert.throws(() => rules.cancel(cancelled.record, receipt.receiptId), /已结束/);

  const replaced = clone(first.record);
  replaced.explorationDelays.disabledTechs.c2[receipt.techKey] = { receiptId: "other-receipt", untilDay: 30, label: "另一禁用" };
  const repaired = rules.process(replaced, "c2", 22, "development");
  assert.equal(rules.getTechLock(repaired.record, "c2", receipt.techKey).receiptId, "other-receipt");
  assert.match(repaired.summary, /仍受其它禁用/);
  assert.equal(rules.getTechLock(rules.cancel(replaced, receipt.receiptId).record, "c2", receipt.techKey).receiptId, "other-receipt");
});

test("a cancelled source can be scheduled again with one receipt and a new AA repair deadline", () => {
  const first = schedulePropylon();
  const old = first.receipts[0];
  const cancelled = rules.cancel(first.record, old.receiptId);
  const restarted = schedulePropylon(cancelled.record, { random: () => 0.99 }, "round-1", 15);
  assert.equal(restarted.changed, true);
  assert.equal(restarted.receipts[0].duplicate, undefined);
  assert.equal(restarted.receipts[0].receiptId, old.receiptId);
  assert.equal(restarted.receipts[0].status, "waiting");
  assert.equal(restarted.receipts[0].dueDay, 25);
  assert.equal(rules.getQueue(restarted.record, "c2").length, 1);
  assert.equal(rules.isTechDisabled(restarted.record, "c2", old.techKey), false);
  const newKey = restarted.receipts[0].techKey;
  assert.equal(newKey, "up-stream navigation@@cycle2");
  assert.equal(rules.getTechLock(restarted.record, "c2", newKey).untilDay, 25);
  const oldDeadline = rules.process(restarted.record, "c2", 22, "development");
  assert.equal(oldDeadline.receipts.length, 0);
  assert.equal(rules.isTechDisabled(oldDeadline.record, "c2", newKey), true);
  const repaired = rules.process(oldDeadline.record, "c2", 25, "development");
  assert.equal(repaired.receipts[0].status, "done");
  assert.equal(rules.isTechDisabled(repaired.record, "c2", newKey), false);
  assert.equal(rules.getQueue(repaired.record, "c2").length, 1);
});

test("completed and expired source receipts remain idempotent rather than being reactivated", () => {
  const first = schedulePropylon();
  const repaired = rules.process(first.record, "c2", 22, "development");
  const replay = schedulePropylon(repaired.record, { random: () => { throw new Error("must not reroll a completed source"); } });
  assert.equal(replay.changed, false);
  assert.equal(replay.receipts[0].status, "done");
  assert.equal(rules.getQueue(replay.record, "c2").length, 1);

  const cardDef = card("c1", "6430");
  const context = { resourceRules, diplomacy: [{ id: "minoians", bonus: 2 }] };
  const once = rules.schedule({}, "c1", 12, entry("6430"), { card: cardDef, context });
  const expired = rules.process(once.record, "c1", 13, "timeline-battle-end", { timelineBattle: true, eventId: "battle-1" });
  const repeated = rules.schedule(expired.record, "c1", 13, entry("6430"), { card: cardDef, context });
  assert.equal(repeated.changed, false);
  assert.equal(repeated.receipts[0].status, "expired");
  assert.equal(rules.getQueue(repeated.record, "c1").length, 1);
});

test("an unstructured known threshold badge is evaluated automatically and keeps unknown values unresolved", () => {
  const cardDef = card("c1", "6440");
  const context = (fate) => ({ conditionRules, record: { cycle: "c1", cycleStats: { c1: { fate } } } });
  const modifier = (fate) => rules.delayed(cardDef, context(fate)).find((item) => item.kind === "battle-modifier");
  assert.equal(modifier("8").conditionState, true);
  assert.equal(modifier("7").conditionState, false);
  assert.equal(modifier("").conditionState, null);
  const scheduled = rules.schedule({}, "c1", 12, entry("6440"), { card: cardDef, context: context("8") });
  assert.equal(scheduled.receipts.some((item) => item.kind === "battle-modifier"), true);
  const omitted = rules.schedule({}, "c1", 12, entry("6440"), { card: cardDef, context: context("7") });
  assert.equal(omitted.receipts.some((item) => item.kind === "battle-modifier"), false);
});

test("Propylon and conditional removal bodies still require confirmation despite an evaluable badge", () => {
  const modified = clone(propylon);
  modified.manual[0].badge = "Argo Fate 0+";
  const context = { conditionRules, record: { cycle: "c2", cycleStats: { c2: { fate: "9" } } } };
  assert.equal(rules.delayed(modified, context)[0].conditionState, null);
  assert.equal(rules.delayed(modified, { ...context, confirmedConditions: { "manual:0": true } })[0].conditionState, true);
  const removal = clone(card("c3", "13536"));
  const conditional = removal.manual.find((item) => item.text.startsWith("If"));
  conditional.badge = "Argo Fate 0+";
  assert.equal(rules.delayed(removal, { conditionRules, record: { cycle: "c3", cycleStats: { c3: { fate: "9" } } } })
    .find((item) => item.text.startsWith("If")).conditionState, null);
});

test("battle entrances become reminders and jump actions, and never complete a battle", () => {
  const cardDef = card("c1", "6440");
  const descriptors = rules.delayed(cardDef).filter((item) => item.kind === "end-step-battle");
  const scheduled = rules.schedule({ completed: { encounter: false } }, "c1", 12, entry("6440"), { card: cardDef, descriptors });
  assert.throws(() => rules.complete(scheduled.record, scheduled.receipts[0].receiptId), /尚未到期/);
  assert.equal(rules.process(scheduled.record, "c1", 12, "development").receipts.length, 0);
  const result = rules.process(scheduled.record, "c1", 12, "explore-end");
  assert.equal(result.receipts[0].status, "ready");
  assert.equal(result.reminders[0].battle, "Temenos Battle");
  assert.deepEqual(result.actions, [{ type: "open-battle", receiptId: result.receipts[0].receiptId, battle: "Temenos Battle", cycleId: "c1" }]);
  assert.equal(result.record.completed.encounter, false);
  const repeated = rules.process(result.record, "c1", 12, "explore-end");
  assert.equal(repeated.receipts.length, 0);
  assert.equal(repeated.reminders.length, 1, "a ready reminder remains until explicit completion");
  const acknowledged = rules.complete(result.record, result.receipts[0].receiptId);
  assert.equal(rules.process(acknowledged.record, "c1", 12, "explore-end").reminders.length, 0);
  assert.equal(acknowledged.record.completed.encounter, false);
});

test("named diplomacy controls next-Timeline escalation, without using another faction's status", () => {
  const cardDef = card("c1", "6403");
  const context = { resourceRules, diplomacy: [{ id: "labyrinthians", bonus: -2 }, { id: "hornsworn", bonus: 1 }] };
  const descriptor = rules.delayed(cardDef, context).find((item) => item.trigger === "timeline-battle-start");
  assert.equal(descriptor.conditionState, true);
  const wrong = rules.delayed(cardDef, { resourceRules, diplomacy: [{ id: "labyrinthians", bonus: 1 }, { id: "hornsworn", bonus: -2 }] })
    .find((item) => item.trigger === "timeline-battle-start");
  assert.equal(wrong.conditionState, false);
  const scheduled = rules.schedule({}, "c1", 12, entry("6403"), { descriptors: [descriptor] });
  assert.equal(rules.process(scheduled.record, "c1", 13, "timeline-battle-start").receipts.length, 0);
  const result = rules.process(scheduled.record, "c1", 13, "timeline-battle-start", { timelineBattle: true, eventId: "c1:D13" });
  assert.equal(result.reminders[0].modifier, "escalate");
  assert.equal(result.reminders[0].amount, 1);
  assert.equal(result.reminders[0].status, "ready");
});

test("a current-card battle modifier requires the matching battle destination", () => {
  const cardDef = card("c2", "13638");
  const modifier = rules.delayed(cardDef).find((item) => item.kind === "battle-modifier");
  const scheduled = rules.schedule({}, "c2", 12, entry("13638"), { descriptors: [modifier], confirmed: true });
  assert.equal(rules.process(scheduled.record, "c2", 12, "card-battle-start", { battle: "Ambush Battle" }).receipts.length, 0);
  const result = rules.process(scheduled.record, "c2", 12, "card-battle-start", { battle: "Cruel Lesson Battle" });
  assert.equal(result.reminders[0].modifier, "escalate");
});

test("map marker expiry requires an explicit Timeline completion and keeps removal as an action", () => {
  const cardDef = card("c2", "13636");
  const tokenRef = { tileId: "001", tokenId: "sludge-12", direction: "north" };
  const scheduled = rules.schedule({ map: { keep: true } }, "c2", 12, entry("13636"), { card: cardDef, tokenRef });
  for (const [phase, options] of [["encounter", {}], ["battle-end", {}], ["timeline-battle-end", { timelineBattle: false }]]) {
    const result = rules.process(scheduled.record, "c2", 13, phase, options);
    assert.equal(result.changed, false);
    assert.equal(result.receipts.length, 0);
  }
  assert.throws(() => rules.process(scheduled.record, "c2", 13, "timeline-battle-end", { timelineBattle: true }), /事件编号/);
  const completed = rules.process(scheduled.record, "c2", 13, "timeline-battle-end", { timelineBattle: true, eventId: "c2:D13" });
  assert.equal(completed.receipts[0].status, "ready");
  assert.equal(completed.actions[0].type, "clear-map-token");
  assert.deepEqual(completed.actions[0].tokenRef, tokenRef);
  assert.deepEqual(completed.record.map, { keep: true }, "the queue cannot remove a marker from another save section");
  const repeated = rules.process(completed.record, "c2", 13, "timeline-battle-end", { timelineBattle: true, eventId: "c2:D13" });
  assert.equal(repeated.changed, false);
  assert.equal(repeated.record.explorationDelays.timelineEpochs.c2, 1);
});

test("once-until-Timeline effects enforce the interval and cannot expire on a repeated event", () => {
  const cardDef = card("c1", "6430");
  const context = { resourceRules, diplomacy: [{ id: "minoians", bonus: 2 }] };
  const first = rules.schedule({}, "c1", 12, entry("6430"), { card: cardDef, context });
  assert.equal(first.receipts[0].kind, "once-until-timeline");
  const duplicate = rules.schedule(first.record, "c1", 12, entry("6430", "round-2"), { card: cardDef, context });
  assert.equal(duplicate.receipts[0].duplicate, true);
  assert.equal(rules.getQueue(duplicate.record, "c1").length, 1);
  const ended = rules.process(first.record, "c1", 13, "timeline-battle-end", { timelineBattle: true, eventId: "battle-1" });
  assert.equal(ended.receipts[0].status, "expired");
  const nextInterval = rules.schedule(ended.record, "c1", 13, entry("6430", "round-3"), { card: cardDef, context });
  const replay = rules.process(nextInterval.record, "c1", 13, "timeline-battle-end", { timelineBattle: true, eventId: "battle-1" });
  assert.equal(replay.receipts.length, 0);
  assert.equal(rules.getQueue(replay.record, "c1", ["waiting"]).length, 1);
  const nextBattle = rules.process(replay.record, "c1", 19, "timeline-battle-end", { timelineBattle: true, eventId: "battle-2" });
  assert.equal(nextBattle.receipts[0].status, "expired");
});

test("newly scheduled start effects do not attach themselves to a replayed battle-start event", () => {
  const descriptor = rules.delayed(card("c4", "9332")).find((item) => item.modifier === "cursed-trait");
  const started = rules.process({}, "c4", 12, "timeline-battle-start", { timelineBattle: true, eventId: "battle-1" });
  const queued = rules.schedule(started.record, "c4", 12, entry("9332"), {
    descriptors: [descriptor], traitCandidates: [{ id: "curse-a", label: "诅咒 A" }], random: () => 0,
  });
  const replay = rules.process(queued.record, "c4", 12, "timeline-battle-start", { timelineBattle: true, eventId: "battle-1" });
  assert.equal(replay.receipts.length, 0);
  const next = rules.process(replay.record, "c4", 13, "timeline-battle-start", { timelineBattle: true, eventId: "battle-2" });
  assert.deepEqual(next.reminders[0].trait, { id: "curse-a", label: "诅咒 A" });
});

test("conditional card removal waits for confirmation and exposes a return-card action", () => {
  const descriptors = rules.delayed(card("c3", "13536"));
  const conditional = descriptors.find((item) => item.kind === "return-exploration-card" && item.text.startsWith("If"));
  assert.equal(conditional.conditionState, null);
  assert.throws(() => rules.schedule({}, "c3", 12, entry("13536"), { descriptors: [conditional] }), /确认卡面条件/);
  const scheduled = rules.schedule({}, "c3", 12, entry("13536"), { descriptors: [conditional], confirmed: true });
  const ready = rules.process(scheduled.record, "c3", 18, "timeline-battle-end", { timelineBattle: true, eventId: "c3:D18" });
  assert.equal(ready.actions[0].type, "return-exploration-card");
  assert.equal(ready.actions[0].cardId, "13536");
  const detached = rules.getQueue(ready.record, "c3");
  detached[0].status = "done";
  assert.equal(rules.getQueue(ready.record, "c3")[0].status, "ready");
});
