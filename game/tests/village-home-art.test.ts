import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFarm, deliverSignature, getVillageHomeCount, restoreCurrentFarm } from '../src/farm.ts';
import { createVillageHomePlates, villageHomeArtKey, villageHomePatch, villageHomeProgress, villageHomeStage, villageHomeStages } from '../src/village-home-art.ts';
import { commissionPlayer } from './fixtures/commission-player.ts';
import { sharedSupperFixture } from './fixtures/shared-supper.ts';

const actions = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'));
const meals = actions.flatMap((action: { name: string }, index: number) => action.name === 'serveVillageMeal' ? [index] : []);

test('the actual public-action progression visibly changes after each existing supper and reload', () => {
  const player = commissionPlayer(actions.slice(0, meals[0]));
  assert.equal(villageHomeStage(player.state), 0);
  assert.equal(getVillageHomeCount(player.state), 1);
  assert.equal(villageHomeArtKey(player.state), villageHomeStages[0].key);
  assert.match(villageHomeProgress(player.state), /Каркас.*0\/2/);
  player.act('serveVillageMeal', ...actions[meals[0]].args);
  assert.equal(villageHomeStage(player.state), 1);
  assert.match(villageHomeProgress(player.state), /Отделка.*1\/2/);
  for (const action of actions.slice(meals[0] + 1, meals[1] + 1)) player.act(action.name, ...action.args);
  assert.equal(villageHomeStage(player.state), 2);
  assert.equal(getVillageHomeCount(player.state), 2);
  assert.equal(villageHomeArtKey(player.state), 'village-plate');
  assert.equal(villageHomeProgress(player.state), 'Домик готов');
  const before = structuredClone(player.state);
  for (let i = 0; i < 100; i++) villageHomeArtKey(player.state);
  assert.deepEqual(player.state, before, 'rendering cannot grant progress, spend stock or change a v4 save');
  assert.equal(villageHomeStage(restoreCurrentFarm(JSON.parse(JSON.stringify(before)))!), 2);
});

test('an author recipe supper also completes the same house, without a second timer or counter', () => {
  const farm = sharedSupperFixture();
  assert.equal(villageHomeStage(farm), 1);
  assert.ok(deliverSignature(farm, farm.culinary.recipes[0].id).ok);
  assert.equal(villageHomeStage(farm), 2);
  assert.equal(villageHomeArtKey(restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!), 'village-plate');
});

test('future suppers stay completed and a new farm has no fabricated progress', () => {
  const farm = createFarm();
  assert.equal(villageHomeStage(farm), 0);
  farm.village.built = true;
  for (const meals of [2, 3, 20, 999]) {
    farm.village.meals = meals;
    assert.equal(villageHomeStage(farm), 2);
  }
});

test('local patches erase the old roof, preserve plate dimensions and upload one immutable canvas per stage', () => {
  const calls: unknown[][] = [];
  const context = { drawImage: (...args: unknown[]) => calls.push(['draw', ...args]), clearRect: (...args: unknown[]) => calls.push(['clear', ...args]) };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } });
  try {
    const compose = createVillageHomePlates();
    const base = { naturalWidth: 1586, naturalHeight: 992 } as HTMLImageElement;
    const patch = {} as HTMLImageElement;
    assert.equal(compose(base), base, 'a missing optional patch never removes the base island');
    assert.equal(calls.length, 0);
    const plate = compose(base, patch);
    assert.deepEqual([plate.width, plate.height], [1586, 992]);
    assert.deepEqual(calls, [['draw', base, 0, 0], ['clear', 995, 48, 342, 310], ['draw', patch, 995, 48]]);
    assert.equal(compose(base, patch), plate);
    assert.equal(calls.length, 3, 'no per-frame recomposition/texture mutation');
    assert.equal(compose(base), base, 'an error does not return another stage from cache');
    assert.notEqual(compose(base, {} as HTMLImageElement), plate);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('both authored patches are present, lossless and confined above the front stone approach', () => {
  for (const stage of villageHomeStages) {
    const bytes = readFileSync(new URL(`../public/art/${stage.path}.webp`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.ok(bytes.includes(Buffer.from('VP8L')));
    assert.ok(bytes.length < 160_000);
  }
  assert.ok(villageHomePatch.y + villageHomePatch.h < 380, 'the first path bend is untouched');
});
