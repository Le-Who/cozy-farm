import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createFarm, beginFestival, cancelFestival, contributeFestival } from '../src/farm.ts';

test('festival panel explicitly selects a program and exposes only safe cancellation', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
    server: { middlewareMode: true }, appType: 'custom',
  });
  try {
    const { renderFestivalPanel } = await server.ssrLoadModule('/src/bay-festival-ui.ts');
    const farm = createFarm(); farm.village.built = true; farm.village.meals = 1; farm.island = 'village';
    const untouched = structuredClone(farm);
    const choices = renderFestivalPanel(farm);
    assert.equal((choices.match(/data-action="festival-begin"/g) ?? []).length, 3);
    assert.equal((choices.match(/Выбрать программу/g) ?? []).length, 3);
    assert.doesNotMatch(choices, /data-action="festival-cancel"/);
    assert.deepEqual(farm, untouched, 'opening the selector never chooses a program');

    assert.equal(beginFestival(farm, 'stage').ok, true);
    const selected = structuredClone(farm), selectedHtml = renderFestivalPanel(farm);
    assert.match(selectedHtml, /Выбранная программа/);
    assert.match(selectedHtml, /Садовая сцена/);
    assert.match(selectedHtml, /data-action="festival-cancel" data-value="stage">Отменить выбор/);
    assert.deepEqual(farm, selected);
    assert.equal(cancelFestival(farm, 'stage').ok, true);
    assert.equal(renderFestivalPanel(farm), choices);

    assert.equal(beginFestival(farm, 'harvest').ok, true);
    farm.fruit.apple = 1;
    assert.equal(contributeFestival(farm, 'fruit', 'apple').ok, true);
    const committed = structuredClone(farm), locked = renderFestivalPanel(farm);
    assert.match(locked, /data-action="festival-cancel" data-value="harvest" disabled/);
    assert.match(locked, /Подготовка уже началась/);
    assert.deepEqual(farm, committed, 'the disabled choice preserves the contribution and ledger');
  } finally {
    await server.close();
  }
});
