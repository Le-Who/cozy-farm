import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarm, cropIds, treeIds, restoreFarm, type StockItem } from '../src/farm.ts';
import { traitIds } from '../src/climate.ts';
import { bayProductId } from '../src/bay-product-id.ts';
import { getRequirementHint } from '../src/requirement-guidance.ts';
import { getLocalWarehouseSupply, withdrawWarehouseSupply } from '../src/warehouse-guidance.ts';
import { variantStockFixture } from './fixtures/variant-stock.ts';
import { nurseryVariantFixture } from './fixtures/nursery-variant.ts';
import { growingVariantFixture } from './fixtures/growing-variant.ts';

const request = { kind: 'variants', item: 'strawberry', trait: 'rainbow', quantity: 2 } as const;
const hint = (farm: ReturnType<typeof createFarm>, item: StockItem = request) => getRequirementHint(farm, { kind: 'stock', item });

// Ordinary warehouse keys cannot satisfy a recipe's selected trait.
test('all rare crops, fruit and eggs ignore ordinary local warehouse stock without mutating it', () => {
  for (const item of [...cropIds, ...treeIds, 'egg'] as const) for (const trait of traitIds) {
    const farm = createFarm();
    farm.boatOwned = true;
    farm.freight.warehouses.home[item === 'egg' ? 'eggs' : item] = 4;
    farm.buildingLevels.coop = 3;
    farm.coopSpecialization = 'packing';
    farm.eggBaskets = 1;
    farm.eggCrates = 1;
    const before = structuredClone(farm);
    const result = hint(farm, { kind: 'variants', item, trait, quantity: 2 });
    assert.notEqual(result.action.target, 'warehouse-supply', `${item}/${trait}`);
    assert.match(result.notice!, /Редкие разновидности/);
    assert.deepEqual(farm, before);
    const loaded = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
    assert.ok(loaded);
    assert.deepEqual(hint(loaded, { kind: 'variants', item, trait, quantity: 2 }), result);
  }
});

test('ordinary ingredient still uses ordinary local warehouse stock', () => {
  const farm = variantStockFixture();
  assert.equal(hint(farm, { kind: 'produce', item: 'strawberry', quantity: 2 }).action.value, 'strawberry|2');
  assert.notEqual(hint(farm).action.target, 'warehouse-supply');
});

test('exact stored trait keeps priority and explicit transfer uses only the current rare shortfall', () => {
  const farm = variantStockFixture(), id = bayProductId(request);
  farm.variants.strawberry = { rainbow: 1 };
  farm.freight.warehouses.home[id] = 4;
  farm.beds[1] = { kind: 'crop', crop: 'strawberry', growth: 2, watered: false, trait: 'rainbow' };
  const before = structuredClone(farm);
  assert.equal(hint(farm).action.target, 'warehouse-supply');
  assert.equal(hint(farm).action.value, `${id}|2`);
  const supply = getLocalWarehouseSupply(farm, request)!;
  assert.equal(supply.quantity, 1);
  assert.deepEqual(farm, before);
  assert.ok(withdrawWarehouseSupply(farm, request, supply).ok);
  assert.equal(farm.variants.strawberry?.rainbow, 2);
  assert.equal(farm.freight.warehouses.home[id], 3);
  assert.equal(farm.freight.warehouses.home.strawberry, 2);
  assert.equal(farm.produce.strawberry, 0);
  assert.equal(farm.day, before.day);
  assert.equal(farm.workToday, before.workToday);
  assert.deepEqual(farm.culinary, before.culinary);
  assert.ok(restoreFarm(farm));
});

test('other traits, remote stock and inaccessible local stock are not substitutes', () => {
  const farm = variantStockFixture();
  farm.freight.warehouses.home['variants:strawberry:dew'] = 3;
  farm.freight.warehouses.grove[bayProductId(request)] = 3;
  assert.notEqual(hint(farm).action.target, 'warehouse-supply');
  farm.freight.warehouses.home[bayProductId(request)] = 3;
  farm.boatOwned = false;
  assert.notEqual(hint(farm).action.target, 'warehouse-supply');
});

test('ready exact, reachable nursery and known growing sources retain their existing priority', () => {
  const farm = variantStockFixture();
  farm.beds[1] = { kind: 'crop', crop: 'strawberry', growth: 2, watered: false, trait: 'rainbow' };
  assert.equal(hint(farm).action.target, 'focus-bed');
  assert.equal(hint(farm).action.value, '1');
  const nursery = nurseryVariantFixture();
  nursery.boatOwned = true;
  nursery.freight.warehouses.home.apple = 3;
  assert.equal(hint(nursery, { ...request, item: 'apple' }).action.target, 'orchard');
  const growing = growingVariantFixture();
  growing.boatOwned = true;
  growing.freight.warehouses.home.strawberry = 3;
  assert.equal(hint(growing).action.target, 'focus-bed');
  assert.match(hint(growing).notice!, /Сначала полейте/);
});

test('stale exact stock recalculates instead of silently taking ordinary goods', () => {
  const farm = variantStockFixture(), id = bayProductId(request);
  farm.freight.warehouses.home[id] = 2;
  const quote = getLocalWarehouseSupply(farm, request)!;
  delete farm.freight.warehouses.home[id];
  const before = structuredClone(farm);
  assert.equal(withdrawWarehouseSupply(farm, request, quote).ok, false);
  assert.notEqual(hint(farm).action.target, 'warehouse-supply');
  assert.deepEqual(farm, before);
  const loaded = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
  assert.ok(loaded);
  assert.deepEqual(hint(loaded), hint(farm));
});

test('the existing exact warehouse format works for every resource and trait', () => {
  for (const item of [...cropIds, ...treeIds, 'egg'] as const) for (const trait of traitIds) {
    const farm = createFarm();
    farm.boatOwned = true;
    const requested = { kind: 'variants', item, trait, quantity: 2 } as const;
    const id = bayProductId(requested);
    farm.freight.warehouses.home[id] = 2;
    const loaded = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
    assert.ok(loaded);
    assert.equal(hint(loaded, requested).action.value, `${id}|2`);
    const supply = getLocalWarehouseSupply(loaded, requested)!;
    assert.equal(supply.id, id);
    assert.ok(withdrawWarehouseSupply(loaded, requested, supply).ok);
    assert.equal(loaded.variants[item]?.[trait], 2);
    assert.ok(restoreFarm(loaded));
  }
});
