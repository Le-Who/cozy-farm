import { createFarm, restoreFarm, completeSignature } from '../../src/farm.ts';

export function variantStockFixture(exact = false) {
  const farm = createFarm();
  farm.day = 3;
  farm.buildingLevels.farmhouse = 2;
  farm.boatOwned = true;
  farm.orientation = { collections: true, islands: true };
  farm.discoveryPreferences.quiet = true;
  farm.variants.strawberry = { rainbow: 2 };
  const made = completeSignature(farm,
    { base: 'preserves', ingredients: [{ id: 'strawberry', quantity: 2, trait: 'rainbow' }] },
    { family: 'preserves', processing: 'silky', fruit: [], steps: ['stir', 'pour'] });
  if (!made.ok) throw Error('Рецепт не создан');
  farm.freight.warehouses.home.strawberry = 2;
  if (exact) farm.freight.warehouses.home['variants:strawberry:rainbow'] = 2;
  const checked = restoreFarm(farm);
  if (!checked) throw Error('Некорректная ферма');
  return checked;
}
