import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bakeWorkshop, completeSignature, cookDish, createFarm, deliverMarketOrder, fishIds,
  getCookIngredients, getMarketOrders, getMarketStock, repeatSignature, restoreFarm,
  sellMarketItem, sellSignature, unitPrice, workshopShapes,
} from '../src/farm.ts';
import type { CookeryResult, SignatureDraft } from '../src/culinary.ts';

function kitchen() {
  const farm = createFarm();
  farm.buildingLevels = { farmhouse: 3, coop: 3, well: 3 };
  farm.projects.fair = { 'dishes:appleJam': 1, eggBaskets: 1, 'produce:carrot': 4, 'produce:wheat': 3 };
  farm.produce.wheat = 100; farm.produce.carrot = 20; farm.eggs = 100;
  farm.fruit.apple = 100; farm.fruit.pear = 100; farm.produce.blueberry = 100;
  farm.progress.sell = 1; // The one-time first-sale goal is not production income.
  return farm;
}
const preserve = (): CookeryResult => ({ family: 'preserves', processing: 'bright', fruit: [], steps: ['fruit', 'stir', 'jar'] });
const tart = (): CookeryResult => ({ family: 'decorate', fruit: [], steps: ['fruit', 'dust', 'bake'], baking: { method: 'oven', finish: 'golden', seconds: 90 } });
const grill = (): CookeryResult => ({ family: 'grilledFish', fruit: [], steps: ['season-fish', 'grill-first-side', 'turn-fish', 'grill-second-side', 'plate-fish', 'arrange-carrot'], baking: { method: 'grill', finish: 'golden', seconds: 18 } });

test('manual bread forms pay equally for the same ingredients and retain a nine-coin margin after the fair', () => {
  const farm = kitchen(), coins = farm.coins;
  for (const shape of workshopShapes) {
    assert.ok(bakeWorkshop(farm, shape).ok);
    assert.equal(getMarketStock(farm).find(row => row.key === `handmade:${shape}`)?.price, 20);
    assert.ok(sellMarketItem(farm, `handmade:${shape}`).ok);
  }
  assert.equal(farm.coins, coins + 60);
  assert.equal(farm.produce.wheat, 94); assert.equal(farm.eggs, 97);
  assert.equal(60 - (6 * 4 + 3 * 3), 27);
});

test('specialized bread and the rarest grilled fish sell above the ingredients they consumed', () => {
  const farm = kitchen(); farm.farmhouseSpecialization = 'bakery';
  const before = farm.coins;
  assert.ok(cookDish(farm, 'farmhouseBread').ok);
  assert.ok(sellMarketItem(farm, 'dishes:farmhouseBread').ok);
  assert.equal(farm.coins - before, 22);
  for (const species of fishIds) {
    farm.fish[species] = 1; farm.seaSalt = 1;
    const raw = getCookIngredients(farm, 'grilledFish', species).reduce((sum, item) => sum + unitPrice(item, farm) * item.quantity, 0);
    const coins = farm.coins;
    if (species === 'lanternfish') assert.equal(raw, 33);
    assert.ok(cookDish(farm, 'grilledFish', { ...grill(), fishSpecies: species }).ok);
    assert.equal(farm.coins, coins, 'cooking pays through the finished portion, without a second coin reward');
    assert.ok(sellMarketItem(farm, 'dishes:grilledFish').ok);
    assert.equal(farm.coins - coins, 38);
    assert.ok(farm.coins - coins - raw >= 5, `${species} must preserve its raw sale value`);
    assert.equal(farm.fish[species], 0);
  }
});

test('mixed signature recipes reward fruit variety while rare portions retain their opportunity value', () => {
  const farm = kitchen();
  const cases: { draft: SignatureDraft; result: CookeryResult; price: number }[] = [
    { draft: { base: 'preserves', ingredients: [{ id: 'apple', quantity: 2 }] }, result: preserve(), price: 14 },
    { draft: { base: 'preserves', ingredients: [{ id: 'apple', quantity: 1 }, { id: 'pear', quantity: 1 }] }, result: preserve(), price: 19 },
    { draft: { base: 'tart', ingredients: [{ id: 'apple', quantity: 1 }, { id: 'pear', quantity: 1 }] }, result: tart(), price: 32 },
  ];
  for (const entry of cases) {
    const coins = farm.coins, made = completeSignature(farm, entry.draft, entry.result);
    assert.ok(made.ok); assert.equal(farm.culinary.recipes.find(recipe => recipe.id === made.recipeId)!.sellPrice, entry.price);
    assert.ok(sellSignature(farm, made.recipeId!).ok); assert.equal(farm.coins - coins, entry.price);
  }
  farm.variants.apple = { frost: 2 }; farm.discoveries.apple = { frost: true };
  const rare = completeSignature(farm, { base: 'tart', ingredients: [{ id: 'apple', quantity: 1, trait: 'frost' }, { id: 'pear', quantity: 1 }] }, tart());
  assert.ok(rare.ok); assert.equal(farm.culinary.recipes.find(recipe => recipe.id === rare.recipeId)!.sellPrice, 36);
  assert.equal(farm.variants.apple.frost, 1);
  const sameFruit = completeSignature(farm, { base: 'tart', ingredients: [{ id: 'apple', quantity: 1, trait: 'frost' }, { id: 'apple', quantity: 1 }] }, tart());
  assert.ok(sameFruit.ok); assert.equal(farm.culinary.recipes.find(recipe => recipe.id === sameFruit.recipeId)!.sellPrice, 31);
});

test('legacy signature prices, coins and portions survive loading and a real repeat/sale', () => {
  const farm = kitchen(); farm.buildingLevels = { farmhouse: 2, coop: 1, well: 1 };
  const id = completeSignature(farm, { base: 'tart', ingredients: [{ id: 'apple', quantity: 1 }, { id: 'pear', quantity: 1 }] }, tart()).recipeId!;
  farm.culinary.recipes[0].sellPrice = 24;
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
  assert.ok(restored); assert.equal(restored.culinary.stock[id], 1); assert.equal(restored.coins, farm.coins);
  assert.ok(repeatSignature(restored, id).ok); assert.equal(restored.culinary.stock[id], 2);
  const coins = restored.coins;
  assert.ok(sellSignature(restored, id, 2).ok); assert.equal(restored.coins - coins, 48);
});

test('market requests always beat direct sale, including fair prices and both facility branches', () => {
  const farm = kitchen(); farm.day = 20; farm.boatOwned = true; farm.capeLevel = 3;
  farm.orders.harbor = { completed: 2, deliveredOn: 2 };
  farm.discoveries.strawberry = { star: true };
  for (const specialization of ['bakery', 'preserves'] as const) {
    farm.farmhouseSpecialization = specialization;
    for (const coop of ['hatchery', 'packing'] as const) {
      farm.coopSpecialization = coop;
      for (const well of ['rain', 'pipes'] as const) {
        farm.wellSpecialization = well;
        for (let step = 0; step < 6; step++) {
          for (const [lane, ledger] of Object.entries(farm.orders)) if (lane !== 'harbor') { ledger.completed = step; ledger.deliveredOn = step; }
          for (const order of getMarketOrders(farm)) {
            const direct = order.items.reduce((sum, item) => sum + unitPrice(item, farm) * item.quantity, 0);
            assert.ok(order.reward >= direct + 8, `${specialization}/${coop}/${well}/${order.name}: ${direct} → ${order.reward}`);
          }
        }
      }
    }
  }
  farm.orders.irrigation = { completed: 0, deliveredOn: 0 }; farm.produce.leafyGreens = 4;
  const before = farm.coins;
  assert.ok(deliverMarketOrder(farm, 'irrigation').ok);
  assert.equal(farm.coins - before, 38);
  assert.equal(farm.produce.leafyGreens, 0); assert.equal(farm.produce.carrot, 16);
  assert.equal(deliverMarketOrder(farm, 'irrigation').ok, false);
});
