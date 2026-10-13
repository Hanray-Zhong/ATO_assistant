(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ATO_EXPLORATION_DELAY_RULES = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CYCLES = new Set(["c1", "c2", "c3", "c4", "c5"]);
  const KINDS = new Set(["end-step-battle", "battle-modifier", "token-clear", "once-until-timeline", "return-exploration-card", "tech-disable"]);
  const TRIGGERS = new Set(["explore-end", "development", "timeline-battle-start", "timeline-battle-end", "card-battle-start"]);
  const TERMINAL = new Set(["done", "cancelled", "expired"]);

  function object(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function safeKey(value) {
    const key = String(value || "").trim();
    return key && !["__proto__", "prototype", "constructor"].includes(key) ? key : "";
  }
  function dayNumber(value) {
    const day = Number(value);
    if (!Number.isSafeInteger(day) || day < 0) throw new Error("请提供有效的战役天数。");
    return day;
  }
  function validateCycle(cycleId) {
    if (!CYCLES.has(cycleId)) throw new Error("未知战役循环。");
  }
  function stateOf(record) {
    const saved = object(record?.explorationDelays) ? record.explorationDelays : {};
    return {
      ...saved, version: 1,
      queue: Array.isArray(saved.queue) ? saved.queue.filter((item) => object(item) && safeKey(item.receiptId)) : [],
      disabledTechs: object(saved.disabledTechs) ? saved.disabledTechs : {},
      timelineEpochs: object(saved.timelineEpochs) ? saved.timelineEpochs : {},
      processedBattles: object(saved.processedBattles) ? saved.processedBattles : {},
    };
  }
  function conditionState(item, id, context, forcedUnknown = false) {
    const confirmed = context.confirmedConditions?.[id];
    if (typeof confirmed === "boolean") return confirmed;
    // A threshold badge alone cannot establish a separate condition printed
    // inside the rule body (notably Propylon's grouped four instructions).
    if (forcedUnknown) return null;
    const rules = context.resourceRules || (typeof globalThis !== "undefined" ? globalThis.ATO_EXPLORATION_RESOURCE_RULES : null);
    if (item.condition && typeof rules?.conditionMet === "function") return rules.conditionMet(item.condition, context);
    const conditions = context.conditionRules;
    if (!item.condition && item.badge && typeof conditions?.conditionFromBadge === "function"
      && typeof conditions?.conditionMet === "function") {
      const parsed = conditions.conditionFromBadge(item.badge, context.cycleId);
      if (parsed) return conditions.conditionMet(parsed, context);
    }
    return item.condition || item.badge ? null : true;
  }

  // Only explicit delayed wording is recognized. Unidentified glyph gains are
  // kept as the original reminder; scheduling does not apply their values.
  function delayed(card, context = {}) {
    if (!context.cycleId && card?.cycleId) context = { ...context, cycleId: card.cycleId };
    if (card?.diplomacyFaction) context = { ...context, diplomacyFaction: card.diplomacyFaction };
    const manual = Array.isArray(card?.manual) ? card.manual : [];
    const result = [];
    const battleItem = manual.find((item) => /At the end of (?:this Exploration Step|the current step), (?:resolve (?:an?|the)|go to the) .+? Battle\b/i.test(item.text || ""));
    const battle = battleItem?.text?.match(/(?:resolve (?:an?|the)|go to the) (.+? Battle)\b/i)?.[1] || "";
    if (card?.key === "c2:13631" && manual.slice(0, 4).map((item) => item.text).join(" ").includes("当前10天后")) {
      result.push({
        id: "manual:0", kind: "tech-disable", trigger: "development", offsetDays: 10,
        text: manual.slice(0, 4).map((item) => item.text).join(" "), badge: manual[0]?.badge || "",
        label: "随机禁用一项 AA 科技，10 天后在发展步骤修复", manualIndexes: [0, 1, 2, 3],
        conditionState: conditionState(manual[0] || {}, "manual:0", context, true),
      });
    }
    manual.forEach((item, index) => {
      if (card?.key === "c2:13631" && index < 4) return;
      const text = String(item.text || "").trim();
      const base = { id: `manual:${index}`, text, badge: item.badge || "", manualIndexes: [index] };
      let descriptor = null;
      if (/^At the end of (?:this Exploration Step|the current step), (?:resolve (?:an?|the)|go to the) .+? Battle\b/i.test(text)) {
        descriptor = { kind: "end-step-battle", trigger: "explore-end", battle, label: `探索结束后进入 ${battle}` };
      } else if (/^At the start of the next Timeline Battle, Escalate (\d+)\.$/i.test(text)) {
        descriptor = { kind: "battle-modifier", trigger: "timeline-battle-start", modifier: "escalate", amount: Number(text.match(/Escalate (\d+)/i)[1]), label: text };
      } else if (/^At the start of this battle, Escalate (\d+)\.$/i.test(text) && battle) {
        descriptor = { kind: "battle-modifier", trigger: "card-battle-start", battle, modifier: "escalate", amount: Number(text.match(/Escalate (\d+)/i)[1]), label: text };
      } else if (/^Add a random Cursed Trait to the next Timeline Battle\.$/i.test(text)) {
        descriptor = { kind: "battle-modifier", trigger: "timeline-battle-start", modifier: "cursed-trait", label: "下次定时战斗增加一个随机诅咒特性" };
      } else if (/^Discard .+ token after the next Timeline Battle\.$/i.test(text) || /^下一次定时战斗后弃置此 .+ 指示物。$/.test(text)) {
        descriptor = { kind: "token-clear", trigger: "timeline-battle-end", label: "下次定时战斗结束后移除对应地图指示物" };
      } else if (/\(once until the next Timeline Battle\)\.$/i.test(text)) {
        descriptor = { kind: "once-until-timeline", trigger: "timeline-battle-end", once: true, label: "本效果在下次定时战斗前只能触发一次" };
      } else if (/remove this card until the next Timeline Battle\.$/i.test(text) || text === "改为移出卡组直到下一次定时战斗") {
        descriptor = { kind: "return-exploration-card", trigger: "timeline-battle-end", label: "下次定时战斗结束后放回这张探索卡" };
      }
      if (descriptor) {
        const forcedUnknown = /^If\b/i.test(text);
        result.push({ ...base, ...descriptor, conditionState: conditionState(item, base.id, context, forcedUnknown) });
      }
    });
    return result;
  }

  function getQueue(record, cycleId = "", statuses = null) {
    const allowed = Array.isArray(statuses) ? new Set(statuses) : null;
    return clone(stateOf(record).queue.filter((item) => (!cycleId || item.cycleId === cycleId) && (!allowed || allowed.has(item.status))));
  }
  function getTechLock(record, cycleId, key) {
    const lock = stateOf(record).disabledTechs[cycleId]?.[key];
    return object(lock) ? clone(lock) : null;
  }
  function isTechDisabled(record, cycleId, key) { return Boolean(getTechLock(record, cycleId, key)); }
  function randomItem(items, random) {
    if (!items.length) throw new Error("没有符合条件的可用项目。");
    const value = Number((typeof random === "function" ? random : Math.random)());
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error("随机数无效。");
    return items[Math.floor(value * items.length)];
  }
  function techChoice(record, cycleId, options) {
    const candidates = (Array.isArray(options.techCandidates) ? options.techCandidates : [])
      .filter((item) => object(item) && item.aa === true && item.unlocked !== false && safeKey(item.key) && !isTechDisabled(record, cycleId, item.key));
    if (options.techKey) {
      const key = safeKey(options.techKey);
      const known = candidates.find((item) => item.key === key);
      if (!key || (!known && options.confirmedAA !== true)) throw new Error("请确认选择的是已解锁的 AA 科技。");
      if (isTechDisabled(record, cycleId, key)) throw new Error("这项科技已被禁用，请选择其它 AA 科技。");
      return { key, label: known?.label || options.techLabel || key };
    }
    const unique = [...new Map(candidates.map((item) => [item.key, item])).values()];
    const chosen = randomItem(unique, options.random);
    return { key: chosen.key, label: chosen.label || chosen.displayName || chosen.nameZh || chosen.name || chosen.key };
  }

  function schedule(record, cycleId, day, entry, options = {}) {
    validateCycle(cycleId);
    day = dayNumber(day);
    const next = clone(object(record) ? record : {});
    const state = stateOf(next);
    const card = options.card;
    const descriptors = Array.isArray(options.descriptors) ? options.descriptors : delayed(card, options.context || {});
    const sourceKey = safeKey(options.sourceKey || entry?.drawnAt || entry?.roundId || `${day}`);
    const cardId = safeKey(entry?.id || card?.cardId);
    if (!sourceKey || !cardId) throw new Error("探索卡来源无效。");
    const receipts = [];
    let changed = false;
    descriptors.forEach((descriptor) => {
      if (!object(descriptor) || !KINDS.has(descriptor.kind) || !TRIGGERS.has(descriptor.trigger) || !safeKey(descriptor.id)) {
        throw new Error("延迟效果定义无效。");
      }
      if (descriptor.conditionState === false) return;
      if (descriptor.conditionState !== true && options.confirmed !== true
        && options.confirmedDescriptors?.[descriptor.id] !== true) {
        throw new Error("请先确认卡面条件成立，再安排此延迟效果。");
      }
      const receiptId = `${cycleId}:${cardId}:${sourceKey}:${descriptor.id}`;
      const onceKey = descriptor.once ? `${cycleId}:${cardId}:${descriptor.id}` : "";
      const existing = state.queue.find((item) => (item.receiptId === receiptId && item.status !== "cancelled")
        || (onceKey && item.onceKey === onceKey && !TERMINAL.has(item.status)));
      if (existing) {
        receipts.push({ ...clone(existing), duplicate: true });
        return;
      }
      // A cancelled arrangement may be made again from the same card draw.
      // Replace its old queue entry so completion/cancellation by receipt ID
      // cannot find stale metadata, and a new AA selection gets a fresh due day.
      state.queue = state.queue.filter((item) => item.receiptId !== receiptId);
      const receipt = {
        ...clone(descriptor), receiptId, sourceKey, cycleId, cardId,
        cardName: String(entry?.name || card?.titleZh || card?.titleEn || cardId),
        scheduledDay: day, status: "waiting", afterEpoch: Number(state.timelineEpochs[cycleId]) || 0,
        ...(onceKey ? { onceKey } : {}),
      };
      if (descriptor.kind === "tech-disable") {
        if (cycleId !== "c2") throw new Error("山门的科技禁用只适用于 Cycle II。");
        const chosen = techChoice({ ...next, explorationDelays: state }, cycleId, options);
        receipt.techKey = chosen.key;
        receipt.techLabel = chosen.label;
        receipt.dueDay = day + 10;
        receipt.label = `${chosen.label} 已禁用；D${receipt.dueDay} 发展步骤修复`;
        if (!object(state.disabledTechs[cycleId])) state.disabledTechs[cycleId] = {};
        state.disabledTechs[cycleId][chosen.key] = { receiptId, untilDay: receipt.dueDay, label: chosen.label };
      }
      if (descriptor.kind === "token-clear" && object(options.tokenRef)) receipt.tokenRef = clone(options.tokenRef);
      if (descriptor.modifier === "cursed-trait" && Array.isArray(options.traitCandidates) && options.traitCandidates.length) {
        const trait = randomItem(options.traitCandidates.filter((item) => object(item) && safeKey(item.id)), options.random);
        receipt.trait = { id: trait.id, label: trait.label || trait.name || trait.id };
      }
      state.queue.push(receipt);
      receipts.push(clone(receipt));
      changed = true;
    });
    if (changed) next.explorationDelays = state;
    return { record: next, receipts, changed, summary: receipts.map((item) => `${item.duplicate ? "已安排：" : ""}${item.label || item.text}`).join("；") || "没有适用的延迟效果" };
  }

  function releaseLock(state, receipt) {
    const locks = state.disabledTechs[receipt.cycleId];
    if (locks?.[receipt.techKey]?.receiptId === receipt.receiptId) delete locks[receipt.techKey];
    return !object(locks?.[receipt.techKey]);
  }
  function normalizePhase(phase) {
    return ({ "end-explore": "explore-end", "battle-start": "timeline-battle-start", "battle-end": "timeline-battle-end" })[phase] || phase;
  }

  // A Timeline Battle must be an explicit caller event. Checking a generic
  // encounter box, rendering the page, or entering a battle never completes it.
  function process(record, cycleId, day, phase, options = {}) {
    validateCycle(cycleId);
    day = dayNumber(day);
    phase = normalizePhase(phase);
    const next = clone(object(record) ? record : {});
    const state = stateOf(next);
    const timeline = phase === "timeline-battle-start" || phase === "timeline-battle-end";
    let timelineEventIsNew = false;
    let changed = false;
    let battleEpoch = Number(state.timelineEpochs[cycleId]) || 0;
    if (timeline && options.timelineBattle === true) {
      const eventId = safeKey(options.eventId);
      if (!eventId) throw new Error("请提供定时战斗事件编号，避免重复结算。");
      state.processedBattles[cycleId] ||= {};
      const eventKey = `${phase}:${eventId}`;
      if (!state.processedBattles[cycleId][eventKey]) {
        timelineEventIsNew = true;
        state.processedBattles[cycleId][eventKey] = true;
        if (phase === "timeline-battle-end") state.timelineEpochs[cycleId] = ++battleEpoch;
        changed = true;
      }
    }
    const receipts = [];
    state.queue.forEach((receipt) => {
      if (receipt.cycleId !== cycleId || receipt.status !== "waiting" || receipt.scheduledDay > day || receipt.trigger !== phase) return;
      if (timeline && (options.timelineBattle !== true || !timelineEventIsNew
        || (phase === "timeline-battle-end" && battleEpoch <= receipt.afterEpoch))) return;
      if (phase === "development" && day < receipt.dueDay) return;
      if (phase === "card-battle-start" && options.battle !== receipt.battle) return;
      if (receipt.kind === "tech-disable") {
        const unlocked = releaseLock(state, receipt);
        receipt.status = "done";
        receipt.label = `${receipt.techLabel}${unlocked ? " 已修复可用" : "：此修复事件已到期，仍受其它禁用事件影响"}`;
      } else if (receipt.kind === "once-until-timeline") {
        receipt.status = "expired";
        receipt.label = "下次定时战斗已结束，本卡一次性触发限制已重置";
      } else receipt.status = "ready";
      receipt.processedDay = day;
      if (timeline) receipt.timelineEventId = options.eventId;
      receipts.push(clone(receipt));
      changed = true;
    });
    if (changed) next.explorationDelays = state;
    const reminders = clone(state.queue.filter((item) => item.cycleId === cycleId && item.status === "ready"));
    const actions = reminders.flatMap((item) => {
      if (item.kind === "token-clear" && item.tokenRef) return [{ type: "clear-map-token", receiptId: item.receiptId, tokenRef: clone(item.tokenRef) }];
      if (item.kind === "return-exploration-card") return [{ type: "return-exploration-card", receiptId: item.receiptId, cardId: item.cardId }];
      if (item.kind === "end-step-battle") return [{ type: "open-battle", receiptId: item.receiptId, battle: item.battle, cycleId }];
      return [];
    });
    return { record: next, receipts, reminders, actions, changed, summary: receipts.map((item) => item.label || item.text).join("；") || "没有新到期的延迟效果" };
  }

  function complete(record, receiptId) {
    const next = clone(object(record) ? record : {});
    const state = stateOf(next);
    const receipt = state.queue.find((item) => item.receiptId === receiptId);
    if (!receipt || receipt.status !== "ready") throw new Error("此延迟效果尚未到期或已经处理。");
    receipt.status = "done";
    next.explorationDelays = state;
    return { record: next, receipt: clone(receipt), changed: true, summary: `${receipt.label || receipt.text}：已处理` };
  }
  function cancel(record, receiptId) {
    const next = clone(object(record) ? record : {});
    const state = stateOf(next);
    const receipt = state.queue.find((item) => item.receiptId === receiptId);
    if (!receipt || TERMINAL.has(receipt.status)) throw new Error("此延迟效果已结束，不能撤销安排。");
    if (receipt.kind === "tech-disable") releaseLock(state, receipt);
    receipt.status = "cancelled";
    next.explorationDelays = state;
    return { record: next, receipt: clone(receipt), changed: true, summary: `${receipt.label || receipt.text}：已撤销安排` };
  }

  return { delayed, schedule, process, complete, cancel, getQueue, getTechLock, isTechDisabled };
});
