import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarm, endDay, restoreFarm, returnNurseryTree, storeTree, type FarmState } from '../src/farm.ts';
import { getDiscoveryJournal } from '../src/discovery-journal.ts';
import { receiveFerryExpedition, sendFerryExpedition } from '../src/harbour-economy.ts';
import { ProtectedSave } from '../src/protected-save.ts';

function storageWith(raw: string) {
  let writes = 0;
  return {
    getItem: () => raw,
    setItem: (_key: string, next: string) => { raw = next; writes++; },
    get raw() { return raw; },
    get writes() { return writes; },
  };
}

function restoreSaved(farm: FarmState) {
  const storage = storageWith(JSON.stringify(farm));
  const saved = new ProtectedSave(() => storage, 'cozy-farm-island-v1', restoreFarm);
  const restored = saved.load();
  assert.ok(restored);
  assert.equal(saved.blocked, false);
  return { farm: restored, saved, storage };
}

test('pre-redesign saves gain expedition and nursery defaults together', () => {
  const legacy = JSON.parse(JSON.stringify(createFarm()));
  delete legacy.freight.expeditions;
  delete legacy.treeNursery;
  delete legacy.treeNurserySerial;
  const storage = storageWith(JSON.stringify(legacy));
  const saved = new ProtectedSave(() => storage, 'cozy-farm-island-v1', restoreFarm);
  const farm = saved.load();
  assert.ok(farm);
  assert.deepEqual(farm.treeNursery, []);
  assert.equal(farm.treeNurserySerial, 0);
  assert.deepEqual(farm.freight.expeditions.discovered, ['mill']);
  assert.equal(farm.freight.expeditions.active, null);
  assert.equal(saved.save(farm), true);
  assert.ok(restoreFarm(JSON.parse(storage.raw)));
});

test('a stored rare tree and paid voyage survive the same save, night, claim and replant', () => {
  let farm = createFarm();
  farm.boatOwned = true;
  farm.coins = 100;
  farm.produce.wheat = 4;
  farm.trees.home[0]!.trait = 'star';
  const tree = structuredClone(farm.trees.home[0]);
  assert.equal(storeTree(farm, 0).ok, true);
  const nurseryId = farm.treeNursery[0].id;
  assert.equal(sendFerryExpedition(farm, 'mill-baking').ok, true);
  const receipt = structuredClone(farm.freight.expeditions.active);
  const coinsAfterDispatch = farm.coins;
  farm = restoreSaved(farm).farm;
  const beforeJournal = structuredClone(farm);
  getDiscoveryJournal(farm);
  assert.deepEqual(farm, beforeJournal);
  assert.deepEqual(farm.freight.expeditions.active, receipt);
  assert.deepEqual(farm.treeNursery[0].tree, tree);
  assert.equal(endDay(farm).ok, true);
  farm = restoreSaved(farm).farm;
  assert.equal(farm.freight.expeditions.active?.phase, 'ready');
  assert.deepEqual(farm.treeNursery[0].tree, tree);
  assert.equal(receiveFerryExpedition(farm).ok, true);
  assert.equal(farm.coins, coinsAfterDispatch);
  assert.equal(farm.handmade.round, 2);
  assert.equal(returnNurseryTree(farm, 0, nurseryId).ok, true);
  const result = restoreSaved(farm);
  farm = result.farm;
  assert.deepEqual(farm.trees.home[0], tree);
  assert.equal(farm.treeNursery.length, 0);
  const beforeRepeat = structuredClone(farm);
  assert.equal(receiveFerryExpedition(farm).ok, false);
  assert.equal(returnNurseryTree(farm, 1, nurseryId).ok, false);
  assert.deepEqual(farm, beforeRepeat);
  assert.equal(result.saved.save(farm), true);
});

test('invalid voyage or nursery data cannot be replaced by fallback autosave', () => {
  const farm = createFarm();
  farm.boatOwned = true;
  farm.produce.wheat = 4;
  assert.equal(storeTree(farm, 0).ok, true);
  assert.equal(sendFerryExpedition(farm, 'mill-grain').ok, true);
  const corruptVoyage = JSON.parse(JSON.stringify(farm));
  corruptVoyage.freight.expeditions.active.incoming = [{ id: 'honey', quantity: 999 }];
  const corruptNursery = JSON.parse(JSON.stringify(farm));
  corruptNursery.treeNursery.push(structuredClone(corruptNursery.treeNursery[0]));
  for (const corrupt of [corruptVoyage, corruptNursery]) {
    const original = JSON.stringify(corrupt);
    const storage = storageWith(original);
    const saved = new ProtectedSave(() => storage, 'cozy-farm-island-v1', restoreFarm);
    assert.equal(saved.load(), undefined);
    assert.equal(saved.blocked, true);
    assert.equal(saved.issue, 'invalid');
    assert.equal(saved.save(createFarm()), false);
    assert.equal(storage.writes, 0);
    assert.equal(storage.raw, original);
  }
});

test('a paid voyage with missing or inconsistent bookkeeping locks the original save', () => {
  const farm = createFarm();
  farm.boatOwned = true;
  farm.coins = 100;
  farm.produce.wheat = 4;
  assert.equal(sendFerryExpedition(farm, 'mill-baking').ok, true);
  assert.equal(farm.coins, 90);
  assert.equal(farm.produce.wheat, 0);
  for (const damage of [
    (ledger: any) => { delete ledger.active; },
    (ledger: any) => { ledger.active = null; },
    (ledger: any) => { ledger.active.serial++; },
    (ledger: any) => { delete ledger.serial; },
    (ledger: any) => { ledger.completed++; },
  ]) {
    const corrupt = JSON.parse(JSON.stringify(farm));
    damage(corrupt.freight.expeditions);
    const original = JSON.stringify(corrupt);
    const storage = storageWith(original);
    const saved = new ProtectedSave(() => storage, 'cozy-farm-island-v1', restoreFarm);
    assert.equal(saved.load(), undefined);
    assert.equal(saved.issue, 'invalid');
    assert.equal(saved.save(createFarm()), false);
    assert.equal(storage.writes, 0);
    assert.equal(storage.raw, original);
  }
});

test('a stale ferry tab cannot overwrite a nursery move saved in another tab', () => {
  const initial = createFarm();
  initial.boatOwned = true;
  initial.produce.wheat = 4;
  const storage = storageWith(JSON.stringify(initial));
  const orchardTab = new ProtectedSave(() => storage, 'cozy-farm-island-v1', restoreFarm);
  const ferryTab = new ProtectedSave(() => storage, 'cozy-farm-island-v1', restoreFarm);
  const orchard = orchardTab.load();
  const ferry = ferryTab.load();
  assert.ok(orchard);
  assert.ok(ferry);
  assert.equal(storeTree(orchard, 0).ok, true);
  assert.equal(orchardTab.save(orchard), true);
  const savedMove = storage.raw;
  assert.equal(sendFerryExpedition(ferry, 'mill-grain').ok, true);
  assert.equal(ferryTab.save(ferry), false);
  assert.equal(ferryTab.issue, 'changed');
  assert.equal(ferryTab.blocked, true);
  assert.equal(ferryTab.raw, savedMove);
  assert.equal(storage.raw, savedMove);
  assert.equal(storage.writes, 1);
  const recovered = restoreFarm(JSON.parse(storage.raw));
  assert.ok(recovered);
  assert.equal(recovered.treeNursery.length, 1);
  assert.equal(recovered.freight.expeditions.active, null);
  assert.equal(recovered.produce.wheat, 4);
});
