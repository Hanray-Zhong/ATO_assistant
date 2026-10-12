const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../aibp/index.html'), 'utf8').replace(/\r\n/g, '\n');

function harness({ common = false, rotate = 0 } = {}) {
  const images = [];
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.dataset = {};
      this.listeners = [];
    }
    get isConnected() { return Boolean(this.parent); }
    appendChild(child) {
      child.remove();
      child.parent = this;
      this.children.push(child);
    }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
      this.parent = null;
    }
    replaceChildren() { [...this.children].forEach(child => child.remove()); }
    addEventListener(event, callback, options) {
      this.listeners.push({ event, callback, once: options?.once });
    }
    dispatch(event) {
      this[`on${event}`]?.();
      this.listeners.filter(listener => listener.event === event).forEach(listener => {
        if (listener.once) this.listeners = this.listeners.filter(item => item !== listener);
        listener.callback();
      });
    }
  }
  class Image extends Element {
    constructor() { super('img'); images.push(this); }
  }
  const grid = new Element('grid');
  const card = { level: 'O', index: 1, ext: 'jpg', src: 'trait.jpg', rotate };
  const context = vm.createContext({
    Image, document: { createElement: tag => new Element(tag) },
    currentApostle: 'THE_NIETZSCJEAN', aibpImageIndex: new Set(['trait.jpg']),
    piles: { THE_NIETZSCJEAN: { traits: [], customTraits: [] } },
    traitLoadToken: 0, traitSaveButton: {}, traitDialogTitle: {}, traitDialogGrid: grid,
    ensurePiles() {}, selectedTraitKeySet: () => new Set(), hiddenTraitKeySet: () => new Set(),
    hiddenExtraCardKeySet: () => new Set(), currentApostleLevel: () => 1,
    availableCycleTraitCards: () => [], traitAreaExtraCards: () => [],
    traitImageCandidates: () => common ? [] : [card],
    commonTraitImageCandidates: () => common ? [card] : [],
    isNietzscheAllForOneLegacyTrait: () => false, isDefaultShownTrait: () => false,
    isTraitRemovedByLevel: () => false, traitKey: () => 'trait', traitCardLabel: () => 'TR O 1',
    loadOptionalImage() {},
    window: {
      setTimeout() {}, AIBP_BOSS_SEARCH: { renderLabel() {} },
      AIBP_BOSS_TRAIT_RULES: { appendOptions() {} }, AIBP_BOSS_LEVEL_DATA: {},
    },
  });
  const match = source.match(/^    function renderTraitCandidates\([^]*?^    }/m);
  assert.ok(match);
  vm.runInContext(match[0], context);
  context.renderTraitCandidates();
  return { grid, image: images[0], context };
}

for (const variant of [{}, { rotate: -90 }, { common: true }]) {
  test(`preview upgrade keeps one trait option and the user's checkbox choice ${JSON.stringify(variant)}`, () => {
    const h = harness(variant);
    h.image.dispatch('load');
    assert.equal(h.grid.children.length, 1);
    const option = h.grid.children[0];
    const checkbox = option.children[0];
    checkbox.checked = true;
    h.image.dispatch('load');
    assert.equal(h.grid.children.length, 1, 'original image must not create an empty duplicate option');
    assert.equal(h.grid.children[0], option);
    assert.equal(checkbox.checked, true, 'upgrading an image must preserve unsaved selection');
    assert.equal(variant.rotate ? option.children[1].children[0] : option.children[1], h.image);
  });
}

test('an image from an obsolete trait dialog render cannot add an option', () => {
  const h = harness();
  h.context.traitLoadToken++;
  h.image.dispatch('load');
  assert.equal(h.grid.children.filter(child => child.tag === 'label').length, 0);
});
