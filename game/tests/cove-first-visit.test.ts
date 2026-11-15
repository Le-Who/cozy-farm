import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import * as F from '../src/farm.ts';
import { createFishingModel } from '../src/fishing-model.ts';
import { covePresets } from '../src/shoreline.ts';

const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8')) as { name: keyof typeof F; args: unknown[] }[];
function reload(farm: F.FarmState) {
  const restored = F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(restored);
  assert.deepEqual(restored, farm);
  return restored;
}
function firstVisit() {
  let farm = F.createFarm();
  for (const { name, args } of opening.slice(0, 15)) {
    const result = (F[name] as Function)(farm, ...args);
    assert.ok(result.ok, `${name}: ${result.message}`);
    farm = reload(farm);
  }
  assert.equal(farm.day, 2);
  assert.equal(farm.island, 'grove');
  assert.equal(F.isProjectComplete(farm, 'dock'), false);
  assert.equal(F.getCoveActions(farm).available, false);
  const locked = structuredClone(farm);
  assert.equal(F.changeCove(farm, { cover: 'kelp' }).ok, false);
  assert.deepEqual(farm, locked);
  assert.ok(F.collectShell(farm, 0).ok);
  assert.equal(F.getCoveActions(farm).available, true);
  return reload(farm);
}

// The ordinary fish names deliberately match the existing stock/species names.
const kelpSummary = 'Обычно морской окунь, иногда окунь';
test('earned first Cove plan describes its fish mix, not an increase over the natural shore', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { coveControls } = await server.ssrLoadModule('/src/culinary-ui.ts');
    const read = (farm: F.FarmState) => {
      const before = structuredClone(farm), html = coveControls(farm);
      assert.deepEqual(farm, before, 'rendering does not apply the plan or grant discoveries');
      return html as string;
    };
    let farm = firstVisit();
    assert.equal(F.fishDefinitions.seaBass.name, 'Морской окунь');
    assert.equal(F.fishDefinitions.perch.name, 'Окунь');
    assert.equal(F.getCoveHabitat(farm), undefined);
    assert.match(read(farm), /Естественный берег/);
    const before = structuredClone(farm);
    assert.ok(F.changeCove(farm, { cover: 'kelp' }).ok);
    const { shoreline: _, ...unchanged } = farm, { shoreline: __, ...original } = before;
    assert.deepEqual(unchanged, original, 'choosing a plan spends no goods, coins or daily quota');
    const pending = read(farm);
    assert.match(pending, /После прилива, день 3/);
    assert.ok(pending.includes(kelpSummary));
    assert.doesNotMatch(pending, /Морской окунь чаще/);
    assert.match(pending, /Прилив наступит после отдыха дома/);
    assert.equal(F.getCoveHabitat(farm), undefined);
    assert.deepEqual(farm.shoreline.observations, []);
    assert.ok(F.sail(farm, 'home').ok);
    assert.ok(F.endDay(farm).ok);
    farm = reload(farm);
    assert.ok(F.sail(farm, 'grove').ok);
    const current = read(farm), config = F.getFishingTripConfig(farm);
    assert.ok(current.includes(kelpSummary));
    assert.doesNotMatch(current, /После прилива, день/);
    assert.match(current, /data-action="cove-fish"/);
    assert.equal(config.habitat!.seaBassWeight, .7);
    assert.equal(config.habitat!.perchWeight, .3);
    const seed = farm.day * 1009 + (farm.fishingTripSerial + 1) * 9176 + 71;
    const ordinary = (habitat?: typeof config.habitat) => createFishingModel(config.capacity, config.resilience, seed, 'seaBass', habitat).fish
      .flatMap(fish => fish.loot?.kind === 'fish' && fish.loot.variant !== 'rare' ? [fish.loot.species] : []);
    assert.ok(ordinary().every(species => species === 'seaBass'), 'natural Grove does not have a 70/30 mix');
    assert.deepEqual(new Set(ordinary(config.habitat)), new Set(['seaBass', 'perch']));
    const fishBefore = structuredClone(farm.fish), trip = F.beginFishingTrip(farm);
    assert.ok(trip.ok);
    assert.deepEqual(trip.config!.habitat, config.habitat);
    assert.deepEqual(farm.fish, fishBefore, 'returning and starting a cast do not award fish');
    const settled = structuredClone(farm.shoreline);
    assert.ok(F.sail(farm, 'home').ok);
    assert.ok(F.endDay(farm).ok);
    farm = reload(farm);
    assert.ok(F.sail(farm, 'grove').ok);
    assert.deepEqual(farm.shoreline, settled, 'a later return keeps the habitat with no deadline');
    assert.match(read(farm), /Обустройство действует с дня 3/);
    assert.ok(read(farm).includes(kelpSummary));
  } finally { await server.close(); }
});

test('meadow forecast and current description stay unchanged; cancelling kelp restores them', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { coveControls } = await server.ssrLoadModule('/src/culinary-ui.ts');
    const farm = firstVisit();
    assert.ok(F.changeCove(farm, covePresets.channel).ok);
    const meadowSummary = 'Окунь чаще · больше редкой рыбы на глубине. Камни укрывают краба и смягчают рывки рыб.';
    assert.ok(coveControls(farm).includes(meadowSummary));
    assert.ok(F.sail(farm, 'home').ok);
    assert.ok(F.endDay(farm).ok);
    assert.ok(F.sail(farm, 'grove').ok);
    const current = coveControls(farm), settled = structuredClone(farm);
    assert.ok(current.includes(meadowSummary));
    assert.ok(F.changeCove(farm, { cover: 'kelp' }).ok);
    assert.ok(coveControls(farm).includes(kelpSummary));
    assert.ok(F.cancelCovePlan(farm, F.getCoveActions(farm).planKey!).ok);
    assert.equal(coveControls(farm), current);
    assert.deepEqual(farm.shoreline.settled, settled.shoreline.settled);
    assert.deepEqual(farm.shoreline.observations, settled.shoreline.observations);
  } finally { await server.close(); }
});
