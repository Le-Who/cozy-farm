import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarm, getProject, restoreFarm, type FarmState, type ProjectId } from '../src/farm.ts';
import { getDiscoveryJournal } from '../src/discovery-journal.ts';

function complete(farm: FarmState, project: ProjectId): void {
  for (const { item } of getProject(farm, project).items) {
    farm.projects[project]['item' in item ? `${item.kind}:${item.item}` : item.kind] = item.quantity;
  }
}

test('fresh players see one chapter, one horizon and an explanation of voluntary nights', () => {
  const farm = createFarm();
  const journal = getDiscoveryJournal(farm);
  assert.equal(journal.current?.id, 'roots');
  assert.equal(journal.next?.id, 'grove');
  assert.equal(journal.completed, 0);
  assert.match(journal.tip, /ночь начнётся, когда вы отдохнёте дома/);
  assert.match(journal.tip, /полейте посадки и покормите курочек/);
  assert.deepEqual(journal.activities, []);
  assert.equal(journal.chapters.length, 6);
});

test('older developed farms skip basic lessons without claiming locked islands are open', () => {
  const farm = createFarm(); farm.buildingLevels.coop = 2;
  let journal = getDiscoveryJournal(farm);
  assert.equal(journal.current?.id, 'grove');
  assert.equal(journal.chapters.find(chapter => chapter.id === 'cape')?.complete, false);
  assert.equal(journal.activities.length, 0);
  farm.boatOwned = true;
  journal = getDiscoveryJournal(farm);
  assert.equal(journal.current?.id, 'cape');
  assert.deepEqual(journal.activities.map(activity => activity.panel), ['bay-freight']);
});

test('spending the first honey does not undo the permanent chapter milestone', () => {
  const farm = createFarm(); farm.boatOwned = true;
  complete(farm, 'dock');
  assert.equal(getDiscoveryJournal(farm).current?.id, 'cape');
  farm.day = 2; farm.capeFlowers[0] = 1; farm.capeHoneyOn = 2;
  farm.bayDiscoveries.push('honey'); farm.honey = 0;
  assert.equal(getDiscoveryJournal(farm).current?.id, 'harbour');
  const loaded = restoreFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(loaded);
  assert.equal(getDiscoveryJournal(loaded).current?.id, 'harbour');
});

test('the inhabited bay exposes its repeatable systems rather than an all-quests-complete message', () => {
  const farm = createFarm(); farm.boatOwned = true; farm.village.built = true;
  let journal = getDiscoveryJournal(farm);
  assert.equal(journal.current?.id, 'living-bay');
  assert.equal(journal.completed, 4);
  assert.deepEqual(journal.activities.map(activity => activity.panel), ['bay-freight', 'bay-shop', 'bay-music', 'festival']);
  farm.bayShop.sold = 1;
  assert.equal(getDiscoveryJournal(farm).current?.id, 'living-bay');
  farm.musicGarden.performances = 1;
  journal = getDiscoveryJournal(farm);
  assert.equal(journal.current?.id, 'traditions');
  assert.equal(journal.next, undefined);
});

test('three repeats of one festival do not imply discovery of all traditions', () => {
  const farm = createFarm(); farm.boatOwned = true; farm.village.built = true;
  farm.bayShop.sold = 1; farm.musicGarden.performances = 1;
  farm.festivals.completed.harvest = 3;
  assert.equal(getDiscoveryJournal(farm).current?.id, 'traditions');
  farm.festivals.completed.lights = 1; farm.festivals.completed.stage = 1;
  const journal = getDiscoveryJournal(farm);
  assert.equal(journal.current, undefined);
  assert.equal(journal.completed, 6);
  assert.equal(journal.activities.length, 4, 'the journal keeps real activities available after the introduction');
});

test('opening and reopening the journal never changes saves or grants rewards', () => {
  const farm = createFarm(); farm.boatOwned = true;
  const before = JSON.stringify(farm);
  const first = getDiscoveryJournal(farm);
  for (let i = 0; i < 10; i++) assert.deepEqual(getDiscoveryJournal(farm), first);
  assert.equal(JSON.stringify(farm), before);
});
