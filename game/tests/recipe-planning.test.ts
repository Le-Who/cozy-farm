import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFarm, restoreFarm, completeSignature, type FarmState } from '../src/farm.ts';
import { rememberRecipeDraft, recipeDraftKey, resumeRecipeDraft } from '../src/recipe-draft.ts';
import { recipePlanningChoices, recipePlanningIngredient, recipePlanningGuide } from '../src/recipe-planning.ts';

const reload = (farm: FarmState) => {
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  return restored;
};
const withoutDraft = (farm: FarmState) => {
  const copy = structuredClone(farm);
  delete copy.recipeDraft;
  return copy;
};

test('choose both absent fruits before gathering, reload the tart plan, then cook only when all supplies arrive', () => {
  const farm = createFarm(), before = structuredClone(farm);
  assert.equal(farm.fruit.apple, 0);
  assert.equal(farm.fruit.pear, 0);
  const apple = recipePlanningIngredient(farm, 'apple');
  assert.deepEqual(apple, { id: 'apple', quantity: 1 });
  assert.ok(rememberRecipeDraft(farm, { base: 'tart', slots: [apple, null], activeSlot: 1 }));
  const partial = reload(farm);
  assert.deepEqual(withoutDraft(partial), before);
  assert.equal(recipePlanningGuide(partial), undefined);
  const resumed = resumeRecipeDraft(partial, recipeDraftKey(partial.recipeDraft!))!;
  resumed.slots[1] = recipePlanningIngredient(partial, 'pear')!;
  resumed.activeSlot = 0;
  assert.ok(rememberRecipeDraft(partial, resumed));
  const loaded = reload(partial), planned = structuredClone(loaded);
  const guide = recipePlanningGuide(loaded)!;
  assert.deepEqual(guide.items, [
    { kind: 'fruit', item: 'apple', quantity: 1 },
    { kind: 'fruit', item: 'pear', quantity: 1 },
    { kind: 'produce', item: 'wheat', quantity: 1 },
    { kind: 'eggs', quantity: 1 },
  ]);
  assert.deepEqual(guide.lines.map(({ stock, required, missing }) => ({ stock, required, missing })), [
    { stock: 0, required: 1, missing: 1 }, { stock: 0, required: 1, missing: 1 },
    { stock: 0, required: 1, missing: 1 }, { stock: 0, required: 1, missing: 1 },
  ]);
  assert.equal(guide.missing, 4);
  assert.equal(guide.available, false);
  const result = { family: 'decorate', fruit: [], steps: ['decorate'] } as const;
  assert.equal(completeSignature(loaded, guide.draft, result).ok, false);
  assert.deepEqual(loaded, planned);
  loaded.fruit.apple = loaded.fruit.pear = loaded.produce.wheat = loaded.eggs = 1;
  const ready = recipePlanningGuide(loaded)!;
  assert.equal(ready.available, true);
  assert.equal(ready.missing, 0);
  const control = withoutDraft(loaded);
  assert.ok(completeSignature(loaded, ready.draft, result).ok);
  assert.ok(completeSignature(control, ready.draft, result).ok);
  assert.deepEqual(loaded, control);
  assert.deepEqual(reload(loaded), loaded);
});

test('the palette includes all ordinary fruit and only exact rare pairs discovered or currently stocked', () => {
  const farm = createFarm();
  farm.discoveries.apple = { rainbow: true };
  farm.discoveries.pear = { regular: true };
  farm.discoveries.wheat = { star: true };
  farm.variants.blueberry = { star: 2 };
  const before = structuredClone(farm);
  const choices = recipePlanningChoices(farm);
  assert.deepEqual(choices, [
    { id: 'apple', quantity: 1 }, { id: 'pear', quantity: 1 }, { id: 'peach', quantity: 1 },
    { id: 'strawberry', quantity: 1 }, { id: 'blueberry', quantity: 1 }, { id: 'raspberry', quantity: 1 },
    { id: 'apple', quantity: 1, trait: 'rainbow' }, { id: 'blueberry', quantity: 1, trait: 'star' },
  ]);
  assert.deepEqual(recipePlanningIngredient(farm, 'apple', 'rainbow'), { id: 'apple', quantity: 1, trait: 'rainbow' });
  assert.deepEqual(recipePlanningIngredient(farm, 'blueberry', 'star'), { id: 'blueberry', quantity: 1, trait: 'star' });
  assert.equal(recipePlanningIngredient(farm, 'pear', 'rainbow'), undefined);
  assert.equal(recipePlanningIngredient(farm, 'blueberry', 'frost'), undefined);
  assert.equal(recipePlanningIngredient(farm, 'wheat', 'star'), undefined);
  assert.deepEqual(farm, before);
  choices[0].quantity = 2;
  assert.deepEqual(recipePlanningIngredient(farm, 'apple'), { id: 'apple', quantity: 1 });
  const restored = reload(farm);
  delete restored.variants.blueberry!.star;
  assert.deepEqual(recipePlanningIngredient(restored, 'blueberry', 'star'), { id: 'blueberry', quantity: 1, trait: 'star' });
});

test('malformed palette values and incomplete or invalid bookmarks cannot invent ingredient choices', () => {
  const farm = createFarm();
  farm.discoveries.apple = { rainbow: true };
  const before = structuredClone(farm);
  for (const id of [undefined, null, '', 'Apple', 'egg', 'wheat', 'constructor', '__proto__', {}, ['apple'], 1]) {
    assert.equal(recipePlanningIngredient(farm, id), undefined);
    assert.equal(recipePlanningIngredient(farm, id, 'rainbow'), undefined);
  }
  for (const trait of [null, '', 'ordinary', 'regular', 'rainbow ', 'fake', 'constructor', {}, ['rainbow'], 1]) {
    assert.equal(recipePlanningIngredient(farm, 'apple', trait), undefined);
  }
  assert.equal(recipePlanningIngredient(farm, 'apple', 'star'), undefined);
  const full = { base: 'tart', slots: [{ id: 'apple', quantity: 1 }, { id: 'pear', quantity: 1 }], activeSlot: 0 };
  for (const bookmark of [undefined, null, {}, [], 'tart', { ...full, base: 'bread' },
    { ...full, slots: [null, null] }, { ...full, slots: [full.slots[0], null] },
    { ...full, slots: [full.slots[0]] }, { ...full, slots: [full.slots[0], { id: 'egg', quantity: 1 }] },
    { ...full, slots: [full.slots[0], { id: 'pear', quantity: 2 }] },
    { ...full, slots: [full.slots[0], { id: 'pear', quantity: 1, trait: 'fake' }] },
    { ...full, activeSlot: 2 }, { ...full, command: 'cook' }]) {
    assert.equal(recipePlanningGuide(farm, bookmark), undefined);
  }
  assert.deepEqual(farm, before);
});

test('two remembered portions of the same absent rare berry aggregate exactly and never use ordinary or other rare stock', () => {
  const farm = createFarm();
  farm.buildingLevels.farmhouse = 2;
  farm.discoveries.strawberry = { rainbow: true };
  farm.produce.strawberry = 5;
  farm.variants.strawberry = { star: 7 };
  const part = recipePlanningIngredient(farm, 'strawberry', 'rainbow')!;
  assert.ok(rememberRecipeDraft(farm, { base: 'preserves', slots: [part, part], activeSlot: 0 }));
  const loaded = reload(farm), before = structuredClone(loaded);
  const guide = recipePlanningGuide(loaded)!;
  assert.deepEqual(guide.draft, { base: 'preserves', ingredients: [{ id: 'strawberry', quantity: 2, trait: 'rainbow' }] });
  assert.deepEqual(guide.items, [{ kind: 'variants', item: 'strawberry', trait: 'rainbow', quantity: 2 }]);
  assert.equal(guide.lines.length, 1);
  assert.equal(guide.lines[0].stock, 0);
  assert.equal(guide.lines[0].required, 2);
  assert.equal(guide.missing, 2);
  assert.equal(guide.available, false);
  assert.deepEqual(loaded, before);
  loaded.variants.strawberry!.rainbow = 1;
  assert.equal(recipePlanningGuide(loaded)!.missing, 1);
  assert.equal(recipePlanningGuide(loaded)!.available, false);
  loaded.variants.strawberry!.rainbow = 2;
  const result = { family: 'preserves', processing: 'bright', fruit: [], steps: ['stir', 'pour'] } as const;
  const control = withoutDraft(loaded);
  assert.ok(completeSignature(loaded, recipePlanningGuide(loaded)!.draft, result).ok);
  assert.ok(completeSignature(control, guide.draft, result).ok);
  assert.deepEqual(loaded, control);
  assert.equal(loaded.produce.strawberry, 5);
  assert.deepEqual(loaded.variants.strawberry, { star: 7 });
  assert.deepEqual(reload(loaded), loaded);
});

test('ordinary and rare portions of one fruit remain separate and guide results are detached from the bookmark', () => {
  const farm = createFarm();
  farm.buildingLevels.farmhouse = 2;
  farm.fruit.apple = 3;
  farm.discoveries.apple = { rainbow: true };
  const ordinary = recipePlanningIngredient(farm, 'apple')!;
  const rare = recipePlanningIngredient(farm, 'apple', 'rainbow')!;
  assert.ok(rememberRecipeDraft(farm, { base: 'preserves', slots: [ordinary, ordinary], activeSlot: 0 }));
  assert.deepEqual(recipePlanningGuide(farm)!.items, [{ kind: 'fruit', item: 'apple', quantity: 2 }]);
  assert.ok(rememberRecipeDraft(farm, { base: 'preserves', slots: [ordinary, rare], activeSlot: 1 }));
  const before = structuredClone(farm), guide = recipePlanningGuide(farm)!;
  assert.deepEqual(guide.items, [
    { kind: 'fruit', item: 'apple', quantity: 1 },
    { kind: 'variants', item: 'apple', trait: 'rainbow', quantity: 1 },
  ]);
  assert.deepEqual(guide.lines.map(({ stock, missing }) => ({ stock, missing })), [
    { stock: 3, missing: 0 }, { stock: 0, missing: 1 },
  ]);
  assert.equal(guide.available, false);
  guide.items[0].quantity = 100;
  guide.draft.ingredients[0].quantity = 100;
  assert.deepEqual(farm, before);
  assert.equal(recipePlanningGuide(farm)!.items[0].quantity, 1);
  assert.deepEqual(reload(farm).recipeDraft, before.recipeDraft);
});

test('stock-ready guidance still checks the current kitchen and upgrade without moving or cooking', () => {
  const farm = createFarm();
  farm.fruit.apple = 2;
  const part = recipePlanningIngredient(farm, 'apple')!;
  assert.ok(rememberRecipeDraft(farm, { base: 'preserves', slots: [part, part], activeSlot: 0 }));
  const locked = structuredClone(farm), upgrade = recipePlanningGuide(farm)!;
  assert.equal(upgrade.missing, 0);
  assert.equal(upgrade.available, false);
  assert.match(upgrade.label, /Улучшите дом/);
  assert.deepEqual(farm, locked);
  farm.buildingLevels.farmhouse = 2;
  assert.equal(recipePlanningGuide(farm)!.available, true);
  farm.boatOwned = true;
  farm.island = 'cape';
  const away = structuredClone(farm), awayGuide = recipePlanningGuide(farm)!;
  assert.equal(awayGuide.missing, 0);
  assert.equal(awayGuide.available, false);
  assert.match(awayGuide.label, /кухне/);
  assert.deepEqual(farm, away);
  farm.island = 'home';
  assert.equal(recipePlanningGuide(farm)!.available, true);
});
