import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFarm, restoreFarm, completeSignature, type FarmState } from '../src/farm.ts';
import { rememberRecipeDraft, recipeDraftKey, resumeRecipeDraft } from '../src/recipe-draft.ts';
import { recipePlanningIngredient, recipePlanningGuide } from '../src/recipe-planning.ts';

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
