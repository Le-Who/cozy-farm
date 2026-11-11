import { createFarm, restoreFarm } from '../../src/farm.ts';
export function recipeDraftFixture() {
  const farm = createFarm();
  farm.day = 3;
  farm.buildingLevels.farmhouse = 2;
  farm.orientation = { collections: true, islands: true };
  farm.discoveryPreferences.quiet = true;
  farm.fruit.apple = 1;
  farm.trees.home[1] = { tree: 'pear', age: 3, fruitReady: 2 };
  const checked = restoreFarm(farm);
  if (!checked) throw Error('Некорректная проверочная ферма');
  return checked;
}
