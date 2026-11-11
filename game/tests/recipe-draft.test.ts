import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFarm, restoreFarm, getSignatureAction, completeSignature } from '../src/farm.ts';
import { restoreRecipeDraft, rememberRecipeDraft, recipeDraftKey, resumeRecipeDraft, resetRecipeDraft } from '../src/recipe-draft.ts';
import { isGuardedAction, ActionClickGuard, ActivationKeyGuard } from '../src/action-click-guard.ts';
import { recipeDraftFixture } from './fixtures/recipe-draft.ts';

const partial = () => ({ base: 'preserves', slots: [{ id: 'apple', quantity: 1 }, null], activeSlot: 1 });
const full = () => ({ base: 'preserves', slots: [{ id: 'apple', quantity: 1 }, { id: 'pear', quantity: 1 }], activeSlot: 0 });
const reload = (farm: ReturnType<typeof createFarm>) => restoreFarm(JSON.parse(JSON.stringify(farm)))!;
const withoutDraft = (farm: ReturnType<typeof createFarm>) => { const copy = structuredClone(farm); delete copy.recipeDraft; return copy; };

test('old saves remain valid and do not acquire an empty draft field', () => {
  const farm = recipeDraftFixture(), before = JSON.stringify(farm);
  assert.equal(restoreRecipeDraft(undefined), null);
  assert.equal(Object.hasOwn(reload(farm), 'recipeDraft'), false);
  assert.equal(JSON.stringify(reload(farm)), before);
});

test('partial selection roundtrips exactly, resumes as a copy, and neither reserves nor consumes supplies', () => {
  const farm = recipeDraftFixture(), before = structuredClone(farm), selection = partial();
  assert.ok(rememberRecipeDraft(farm, selection));
  selection.slots[0]!.id = 'pear';
  const loaded = reload(farm), draft = loaded.recipeDraft!;
  assert.equal(draft.slots[0]?.id, 'apple');
  assert.equal(draft.activeSlot, 1);
  assert.equal(draft.slots[1], null);
  const resumed = resumeRecipeDraft(loaded, recipeDraftKey(draft))!;
  resumed.slots[0]!.id = 'pear';
  assert.equal(loaded.recipeDraft!.slots[0]?.id, 'apple');
  assert.deepEqual(withoutDraft(loaded), before);
});

test('invalid or extra draft data rejects the save instead of accepting commands or quantities', () => {
  const invalid = [null, [], 'recipe', {}, { ...partial(), command: 'cook' }, { ...partial(), activeSlot: 2 },
    { ...partial(), base: 'bread' }, { ...partial(), slots: [null, null] }, { ...partial(), slots: [null] },
    { ...partial(), slots: new Array(2) }, { ...partial(), slots: [{ id: 'apple', quantity: 2 }, null] },
    { ...partial(), slots: [{ id: 'egg', quantity: 1 }, null] },
    { ...partial(), slots: [{ id: 'apple', quantity: 1, trait: 'fake' }, null] },
    { ...partial(), slots: [{ id: 'apple', quantity: 1, name: '<script>' }, null] }];
  for (const recipeDraft of invalid) {
    assert.equal(restoreRecipeDraft(recipeDraft), undefined);
    assert.equal(restoreFarm({ ...recipeDraftFixture(), recipeDraft }), undefined);
  }
  const farm = recipeDraftFixture();
  assert.ok(rememberRecipeDraft(farm, partial()));
  const before = structuredClone(farm);
  assert.equal(rememberRecipeDraft(farm, invalid[4]), false);
  assert.deepEqual(farm, before);
});

test('missing ingredients remain selected after reload but cooking is freshly unavailable', () => {
  const farm = recipeDraftFixture();
  farm.fruit.pear = 1;
  assert.ok(rememberRecipeDraft(farm, full()));
  farm.fruit.apple = 0;
  const loaded = reload(farm), draft = resumeRecipeDraft(loaded, recipeDraftKey(loaded.recipeDraft!))!;
  const before = structuredClone(loaded);
  const action = getSignatureAction(loaded, { base: draft.base, ingredients: draft.slots.filter(part => part !== null) });
  assert.equal(action.available, false);
  assert.equal(draft.slots[0]?.id, 'apple');
  assert.deepEqual(loaded, before);
});

test('stale reset or resume cannot replace the latest selection and reset affects only the bookmark', () => {
  const farm = recipeDraftFixture();
  rememberRecipeDraft(farm, partial());
  const stale = recipeDraftKey(farm.recipeDraft!);
  rememberRecipeDraft(farm, { ...full(), base: 'tart' });
  const before = structuredClone(farm);
  assert.equal(resetRecipeDraft(farm, stale), false);
  assert.equal(resumeRecipeDraft(farm, stale), undefined);
  assert.deepEqual(farm, before);
  assert.ok(resetRecipeDraft(farm, recipeDraftKey(farm.recipeDraft!)));
  assert.deepEqual(farm, withoutDraft(before));
  assert.equal(Object.hasOwn(reload(farm), 'recipeDraft'), false);
  assert.equal(resetRecipeDraft(farm, stale), false);
});

test('failed cooking keeps the draft, successful matching cooking clears it with unchanged economics', () => {
  const farm = recipeDraftFixture(), composition = { base: 'preserves', ingredients: [{ id: 'apple', quantity: 1 }, { id: 'pear', quantity: 1 }] } as const;
  const result = { family: 'preserves', processing: 'silky', fruit: [], steps: ['stir', 'pour'] } as const;
  rememberRecipeDraft(farm, full());
  const before = structuredClone(farm);
  assert.equal(completeSignature(farm, composition, result).ok, false);
  assert.deepEqual(farm, before);
  farm.fruit.pear = 1;
  const control = withoutDraft(farm);
  assert.ok(completeSignature(farm, composition, result).ok);
  assert.ok(completeSignature(control, composition, result).ok);
  assert.deepEqual(farm, control);
  assert.ok(reload(farm));
});

test('unrelated cooking preserves the current draft and rare traits survive load without stocking them', () => {
  const farm = recipeDraftFixture();
  rememberRecipeDraft(farm, { ...partial(), slots: [{ id: 'apple', quantity: 1, trait: 'rainbow' }, null] });
  farm.fruit.apple = 2;
  const before = structuredClone(farm.recipeDraft);
  assert.ok(completeSignature(farm, { base: 'preserves', ingredients: [{ id: 'apple', quantity: 2 }] },
    { family: 'preserves', processing: 'silky', fruit: [], steps: ['stir', 'pour'] }).ok);
  assert.deepEqual(reload(farm).recipeDraft, before);
  assert.equal(farm.variants.apple?.rainbow, undefined);
});

test('resume/reset own their gesture while separate clicks and keyboard remain available', () => {
  for (const action of ['resume-recipe-draft', 'reset-recipe-draft']) assert.ok(isGuardedAction(action));
  const guard = new ActionClickGuard(), first = { detail: 1, timeStamp: 10, clientX: 10, clientY: 10 };
  guard.remember(first);
  assert.ok(guard.blocks({ ...first, detail: 2, timeStamp: 60 }));
  assert.equal(guard.blocks({ ...first, timeStamp: 700 }), false);
  const keys = new ActivationKeyGuard();
  assert.equal(keys.blocks({ key: 'Enter', repeat: false }, true), false);
  assert.ok(keys.blocks({ key: 'Enter', repeat: true }, false));
  keys.release('Enter');
  assert.equal(keys.blocks({ key: 'Enter', repeat: false }, true), false);
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const resume = main.slice(main.indexOf("case 'resume-recipe-draft':"), main.indexOf("case 'new-signature':"));
  assert.match(resume, /!dialog.open \|\| panel !== 'recipes'/);
  assert.doesNotMatch(resume, /completeSignature|repeatSignature|workBed|endDay/);
});

test('actual main resume/reset cases enforce current page and quote, with no implicit work', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const handlers = main.slice(main.indexOf("case 'resume-recipe-draft':"), main.indexOf("case 'new-signature':"));
  // Execute the real synchronous switch cases, not a rewritten approximation.
  const run = new Function('action', 'value', 'farm', 'dialog', 'panel', 'resumeRecipeDraft', 'resetRecipeDraft',
    'saveFarm', 'drawPanel', 'openPanel', `
      let signatureBase, signatureSlots, signatureSlot, signatureRepeatId = 'old', signatureFamily = 'berries', cookingMode;
      switch (action) { ${handlers} }
      return { signatureBase, signatureSlots, signatureSlot, signatureRepeatId, signatureFamily, cookingMode };
    `);
  const farm = recipeDraftFixture();
  rememberRecipeDraft(farm, partial());
  const key = recipeDraftKey(farm.recipeDraft!), before = structuredClone(farm);
  let saves = 0, draws = 0;
  const opened: string[] = [];
  const invoke = (action: string, value = key, open = true, panel = 'recipes') => run(action, value, farm,
    { open }, panel, resumeRecipeDraft, resetRecipeDraft, () => saves++, () => draws++, (name: string) => opened.push(name));
  invoke('resume-recipe-draft', key, false);
  invoke('reset-recipe-draft', key, true, 'market');
  invoke('resume-recipe-draft', 'stale');
  assert.deepEqual(opened, []);
  assert.equal(saves, 0);
  assert.deepEqual(farm, before);
  const resumed = invoke('resume-recipe-draft');
  assert.equal(resumed.signatureBase, 'preserves');
  assert.equal(resumed.signatureSlot, 1);
  assert.deepEqual(resumed.signatureSlots, before.recipeDraft!.slots);
  assert.equal(resumed.signatureRepeatId, undefined);
  assert.equal(resumed.signatureFamily, undefined);
  assert.deepEqual(opened, ['signature']);
  assert.equal(saves, 0);
  assert.deepEqual(farm, before);
  invoke('reset-recipe-draft');
  assert.equal(saves, 1);
  assert.equal(draws, 1);
  assert.deepEqual(farm, withoutDraft(before));
  invoke('reset-recipe-draft');
  invoke('resume-recipe-draft');
  assert.equal(saves, 1);
  assert.deepEqual(opened, ['signature']);
});
