(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ATO_EXPLORATION_CHOICE_RULES = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  // These choices were checked against the card faces. They only describe a
  // selected operation; drawing or describing a card never changes the record.
  const PRIEST_OFFERS = {
    "c1:6426": { type: "fate", amount: 3, label: "阿尔戈号命运" },
    "c3:13521": { type: "fate", amount: 3, label: "阿尔戈号命运" },
    "c4:9303": { type: "babelianDebt", amount: 1, label: "巴比伦债务" },
    "c5:10325": { type: "paranoia", amount: 1, label: "猜忌" },
  };
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  function numeric(value) {
    if (value == null || typeof value === "boolean" || typeof value === "object"
      || (typeof value === "string" && !value.trim())) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }
  function cardKey(card) {
    return `${card?.cycleId || ""}:${String(card?.cardId || card?.id || card?.key || "").split(":").pop()}`;
  }
  function conditions(context) {
    return context.conditionRules || root.ATO_EXPLORATION_CONDITIONS
      || (typeof module === "object" && module.exports ? require("./exploration-card-conditions.js") : null);
  }
  function resources(context) {
    return context.resourceRules || root.ATO_EXPLORATION_RESOURCE_RULES
      || (typeof module === "object" && module.exports ? require("./exploration-card-resource-rules.js") : null);
  }
  function activeCycle(card, context) {
    return !context.cycleId || context.cycleId === card.cycleId;
  }
  function trackValue(card, context, key) {
    if (!activeCycle(card, context)) return null;
    if (own(context.stats, key)) return numeric(context.stats[key]);
    return numeric(conditions(context)?.contextForRecord?.(context.record || {}, card.cycleId)?.stats?.[key]);
  }
  function diplomacyState(card, context, condition) {
    if (!activeCycle(card, context)) return null;
    const effective = card.diplomacyFaction ? { ...context, diplomacyFaction: card.diplomacyFaction } : context;
    const value = resources(context)?.conditionMet?.(condition, effective);
    return value === true || value === false ? value : null;
  }
  function choice(id, label, effects, extra = {}) {
    return { id, label, effects, ...extra };
  }
  function descriptor(id, manualIndexes, text, conditionState, choices, extra = {}) {
    return { id, manualIndexes, manualIds: manualIndexes.map(index => `manual:${index}`), text,
      displayText: text, conditionState, effects: [], remainder: "", dynamic: true, choices, ...extra };
  }
  function losses(frozenTime = false) {
    const base = frozenTime ? [{ type: "frozenTime", amount: -1 }] : [];
    return [choice("crew", frozenTime ? "凝固时光 −1，船员 −1" : "船员 −1", [...base, { type: "crew", amount: -1 }]),
      choice("hull", frozenTime ? "凝固时光 −1，船体 −1" : "船体 −1", [...base, { type: "hull", amount: -1 }])];
  }
  function descriptors(card, context = {}) {
    const key = cardKey(card);
    const offer = PRIEST_OFFERS[key];
    if (offer) {
      const blocked = Boolean(context.blockGains);
      return [descriptor("choice:priest-offer", [0], `是否获得${offer.label} +${offer.amount}，并获得祭司 +1？`,
        activeCycle(card, context) ? true : null,
        [choice("accept", `${offer.label} +${offer.amount}，祭司 +1`, [{ type: offer.type, amount: offer.amount }, { type: "priests", amount: 1 }],
          blocked ? { blocked: true, disabled: true, reason: "本牌堆禁止获得祭司" } : {}),
        choice("decline", "不接受（无数值变化）", [])], { optional: true, ...(blocked ? { blocked: true } : {}) })];
    }
    if (key === "c5:10316") {
      const condition = { type: "diplomacy", mode: "atLeast", bonus: 2, badge: "Allied" };
      return [descriptor("choice:peace-emissaries", [1], "同盟：是否获得阿尔戈号命运 +1，额外降低猜忌 1？",
        diplomacyState(card, context, condition),
        [choice("accept", "阿尔戈号命运 +1，猜忌 −1", [{ type: "fate", amount: 1 }, { type: "paranoia", amount: -1 }]),
          choice("decline", "不接受（无数值变化）", [])], { optional: true, condition, badge: "Allied" })];
    }
    if (key === "c2:13639") {
      return [descriptor("choice:moral-erosion", [0], "选择获得灾祸 1 或降低人性 1", activeCycle(card, context) ? true : null,
        [choice("doom", "灾祸 +1", [{ type: "doom", amount: 1 }]), choice("humanity", "人性 −1", [{ type: "humanity", amount: -1 }])])];
    }
    if (key === "c3:13532") {
      const condition = { type: "diplomacy", mode: "only", bonus: -2, badge: "Denounced" };
      return [descriptor("choice:helian-loss", [5], "谴责：选择失去船员 1 或船体 1",
        diplomacyState(card, context, condition), losses(), { condition, badge: "Denounced" })];
    }
    if (key === "c3:13534") {
      const paradox = trackValue(card, context, "paradox");
      return [descriptor("choice:chekhov-loss", [0, 1], "悖论 ≥3：凝固时光 −1，并选择失去船员 1 或船体 1",
        paradox === null ? null : paradox >= 3, losses(true), { badge: "悖论 ≥3" })];
    }
    if (key === "c3:13541") {
      const fate = trackValue(card, context, "fate");
      const parent = context.appliedEffects?.["conditional:tomorrows-edge-map"]?.descriptor;
      return [descriptor("choice:tomorrows-edge-fallback", [2], "请按实际事件确认：是否执行未触发分支？",
        activeCycle(card, context) ? true : null,
        [choice("accept", "执行：悖论 +1，并暂时移出", [{ type: "paradox", amount: 1 }], { removal: "remove" }),
          choice("decline", fate === null ? "不执行（请先填写阿尔戈号命运）" : `不执行未触发分支，并${fate >= 7 ? "暂时" : "永久"}移出`, [],
            fate === null ? { disabled: true, reason: "请先填写阿尔戈号命运，以确认移出类型" } : { removal: fate >= 7 ? "remove" : "permanent" })],
        { requiresEffect: "conditional:tomorrows-edge-map", ...(parent?.remainder ? { requiresManual: "conditional:tomorrows-edge-map" } : {}) })];
    }
    return [];
  }
  function automatic(card, context = {}) {
    if (cardKey(card) !== "c3:13534") return [];
    const paradox = trackValue(card, context, "paradox");
    const state = paradox === null ? null : paradox < 3;
    // Both branches share an ID: resolving the +1 at Paradox 2 must not offer
    // a second settlement when the newly recorded Paradox becomes 3.
    return [{ ...descriptor("choice:chekhov-loss", [0, 1], "悖论不足 3：悖论 +1", state, []),
      effects: state === true ? [{ type: "paradox", amount: 1 }] : [], automatic: state === true,
      summary: "悖论 +1", ...(state === null ? { remainder: "悖论数值未知，请补齐记录后结算" } : {}) }];
  }
  function resolve(card, context, descriptorId, choiceId) {
    const item = descriptors(card, context).find(entry => entry.id === descriptorId);
    if (!item || item.conditionState !== true) throw new Error("当前记录无法确认该选择适用");
    const selected = item.choices.find(entry => entry.id === choiceId);
    if (!selected || selected.disabled || selected.blocked) throw new Error(selected?.reason || "该选项不可结算");
    return { ...item, choice: selected.id, choiceLabel: selected.label, effects: selected.effects.map(effect => ({ ...effect })),
      ...(selected.removal ? { removal: selected.removal } : {}) };
  }

  return { version: 1, descriptors, automatic, resolve };
});
