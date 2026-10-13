const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rules = require("../assets/exploration-card-resource-rules.js");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../assets/exploration-card-resources.js"), "utf8"), sandbox);
const dataset = sandbox.window.ATO_EXPLORATION_CARD_RESOURCES;

test("a stack prohibition blocks the actual Cycle IV resource write plan", () => {
  const card = rules.cardsForCycle(dataset, "c4").find((entry) => entry.grants.length);
  assert.ok(card);
  const context = { cycleId: "c4", dataset, diplomacy: [] };
  const ordinary = rules.plan(card, context);
  assert.ok(ordinary.grants.length || ordinary.variants.some((variant) => variant.grants.length));

  const blocked = rules.plan(card, { ...context, blockResourceGains: true });
  assert.equal(blocked.blocked, true);
  assert.match(blocked.summary, /本堆禁止获得资源/);
  assert.ok(blocked.blockedGrants.length);
  assert.deepEqual(blocked.grants, []);
  assert.deepEqual(blocked.variants, []);
  assert.deepEqual(rules.planChanges(dataset, "c4", blocked.grants), []);
  assert.deepEqual(blocked.manual, ordinary.manual);

  // The other stack continues to use the same card's ordinary plan.
  assert.deepEqual(rules.plan(card, context), ordinary);
});

test("unknown diplomacy and icon branches cannot restore prohibited gains", () => {
  for (const [cycleId, cardId] of [["c1", "6404"], ["c2", "13603"]]) {
    const card = rules.getCard(dataset, cycleId, cardId);
    assert.equal(rules.plan(card, { cycleId, dataset }).status, "choice");
    const plan = rules.plan(card, { cycleId, dataset, blockResourceGains: true });
    assert.equal(plan.status, "auto");
    assert.deepEqual(plan.grants, []);
    assert.deepEqual(plan.variants, [], "do not offer buttons with no resource changes");
    assert.ok(plan.blockedGrants.length >= 2);
  }
});

test("rare gains are blocked while active non-resource effects remain", () => {
  const card = rules.getCard(dataset, "c3", "13511");
  const context = { cycleId: "c3", dataset, diplomacy: [{ id: "sunheirs", bonus: 2 }] };
  const ordinary = rules.plan(card, context);
  assert.ok(ordinary.grants.some((grant) => grant.rareName));
  const plan = rules.plan(card, { ...context, blockResourceGains: true });
  assert.deepEqual(plan.grants, []);
  assert.ok(plan.blockedGrants.some((grant) => grant.rareName));
  assert.deepEqual(plan.manual, ordinary.manual);

  const fleet = rules.getCard(dataset, "c1", "6401");
  const fleetContext = { cycleId: "c1", dataset, diplomacy: [{ id: "minoians", bonus: 0 }] };
  const fleetPlan = rules.plan(fleet, { ...fleetContext, blockResourceGains: true });
  assert.ok(fleetPlan.manual.some((item) => item.badge === "Neutral"));
});

test("a gain restriction preserves losses and meaningful conditional choices", () => {
  const card = {
    grants: [
      { resource: "trireme", amount: 4 },
      { resource: "armament", amount: -1 },
      { resource: "monument", amount: -2, condition: { type: "icon", badge: "ICON/test", label: "卡面图标条件" } },
    ],
    manual: [{ text: "Choose an Argonaut.", condition: null }],
  };
  const context = { cycleId: "c1", dataset, blockResourceGains: true };
  const plan = rules.plan(card, context);
  assert.equal(plan.status, "choice");
  assert.deepEqual(plan.grants.map((grant) => [grant.resource, grant.amount]), [["armament", -1]]);
  assert.equal(plan.variants.length, 2);
  assert.ok(plan.variants.every((variant) => variant.grants.length && variant.grants.every((grant) => grant.amount < 0)));
  assert.ok(plan.variants.every((variant) => !variant.label.includes("船材")));
  assert.match(plan.summary, /军备 ×-1/);
  assert.equal(plan.manual[0].text, "Choose an Argonaut.");
  assert.equal(plan.blockedGrants.length, 1, "the same base gain is reported once across all branches");
  const changes = rules.planChanges(dataset, "c1", plan.variants[1].grants);
  assert.ok(changes.every((change) => change.amount < 0));
  assert.deepEqual(rules.applyChanges({ "c1-armament": 3, "c1-monument": 4 }, changes), {
    "c1-armament": 2,
    "c1-monument": 2,
  });
});

test("no dataset card or choice can write a positive gain under a stack prohibition", () => {
  for (const card of Object.values(dataset.cards)) {
    const ordinary = rules.plan(card, { cycleId: card.cycleId, dataset });
    const plan = rules.plan(card, { cycleId: card.cycleId, dataset, blockResourceGains: true });
    assert.deepEqual(plan.manual, ordinary.manual, `${card.key} keeps its manual effects`);
    for (const grants of [plan.grants, ...plan.variants.map((variant) => variant.grants)]) {
      assert.ok(grants.every((grant) => grant.amount < 0), card.key);
      assert.ok(rules.planChanges(dataset, card.cycleId, grants).every((change) => change.amount < 0), card.key);
    }
  }
});
