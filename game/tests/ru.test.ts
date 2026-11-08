import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ruCount, ruPlural, formatRuNumber, traitLabel } from '../src/ru.ts';
import { createFarm, completeSignature, nameSignature, repeatSignature, restoreFarm, variantLabel } from '../src/farm.ts';

test('Russian quantities use the correct form for teens, compound numbers and fractions', () => {
  for (const [count, expected] of [[0, 'дней'], [1, 'день'], [2, 'дня'], [5, 'дней'], [11, 'дней'], [14, 'дней'], [21, 'день'], [22, 'дня'], [25, 'дней'], [101, 'день'], [111, 'дней'], [-22, 'дня'], [1.5, 'дня']] as const) {
    assert.equal(ruPlural(count, ['день', 'дня', 'дней']), expected);
  }
  assert.equal(ruCount(21, 'монета', 'монеты', 'монет'), '21 монета');
  assert.equal(formatRuNumber(1.5), '1,5');
});

test('rare harvest labels agree with masculine, feminine and neuter resources', () => {
  assert.equal(variantLabel('strawberry', 'star').name, 'Звёздная клубника');
  assert.equal(variantLabel('tomato', 'frost').name, 'Морозный помидор');
  assert.equal(variantLabel('egg', 'dew').name, 'Росистое яйцо');
  assert.equal(variantLabel('apple', 'rainbow').name, 'Радужное яблоко');
  assert.equal(traitLabel('dew', 'leafyGreens'), 'Росистая');
});

test('Russian recipe names and legacy personal names retain their exact text across save and repeat', () => {
  const farm = createFarm();
  farm.buildingLevels.farmhouse = 2;
  farm.fruit.apple = 10;
  const made = completeSignature(farm, { base: 'preserves', ingredients: [{ id: 'apple', quantity: 2 }] }, {
    family: 'preserves', processing: 'silky', fruit: [], steps: ['fruit', 'stir', 'jar'],
  });
  assert.ok(made.ok);
  const id = made.recipeId!;
  assert.equal(farm.culinary.recipes[0].name, 'Конфитюр: яблоко');
  assert.doesNotMatch(farm.culinary.recipes[0].name, /[a-z]/i);
  assert.ok(nameSignature(farm, id, 'Бабушкино яблочное варенье').ok);
  let restored = restoreFarm(JSON.parse(JSON.stringify(farm)))!;
  assert.ok(restored);
  assert.equal(restored.culinary.recipes[0].name, 'Бабушкино яблочное варенье');
  assert.ok(repeatSignature(restored, id).ok);
  assert.equal(restored.culinary.recipes[0].name, 'Бабушкино яблочное варенье');
  restored.culinary.recipes[0].name = 'Old Family Favourite';
  restored = restoreFarm(JSON.parse(JSON.stringify(restored)))!;
  assert.equal(restored.culinary.recipes[0].name, 'Old Family Favourite');
});

test('generated names keep complete berry names and leave processing to its separate label', () => {
  const farm = createFarm();
  farm.buildingLevels.farmhouse = 2;
  farm.produce.strawberry = 1;
  farm.produce.raspberry = 1;
  assert.ok(completeSignature(farm, { base: 'preserves', ingredients: [{ id: 'strawberry', quantity: 1 }, { id: 'raspberry', quantity: 1 }] }, {
    family: 'preserves', processing: 'chunky', fruit: [], steps: ['fruit', 'stir', 'jar'],
  }).ok);
  const recipe = farm.culinary.recipes[0];
  assert.equal(recipe.name, 'Конфитюр: малина + клубника');
  assert.ok(recipe.name.length <= 32);
  assert.equal(recipe.processing, 'chunky');
  assert.equal(restoreFarm(JSON.parse(JSON.stringify(farm)))?.culinary.recipes[0].name, recipe.name);
});
