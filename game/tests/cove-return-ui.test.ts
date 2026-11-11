import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { cancelCovePlan, changeCove, createFarm, endDay, getCoveActions, restoreFarm } from '../src/farm.ts';
import { covePresets } from '../src/shoreline.ts';

test('cove panel distinguishes current shore, future forecast and the applied morning', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { coveControls } = await server.ssrLoadModule('/src/culinary-ui.ts');
    let farm = createFarm(); farm.boatOwned = true; farm.shellDiscoveries = ['regular']; farm.island = 'grove';
    const natural = coveControls(farm);
    assert.match(natural, /Сейчас:<\/strong> Тихое течение · луг · песок/);
    assert.doesNotMatch(natural, /cove-cancel|После прилива|Утренний прилив/);
    changeCove(farm, covePresets.channel);
    const planned = structuredClone(farm), html = coveControls(farm);
    assert.match(html, /Сейчас:<\/strong> Тихое течение · луг · песок/);
    assert.match(html, /После прилива, день 2:<\/strong> Открытое течение · луг · камни/);
    assert.match(html, /План ещё не применён/);
    assert.match(html, /data-action="cove-cancel" data-value="0:1:open:meadow:stones"/);
    assert.deepEqual(farm, planned);
    cancelCovePlan(farm, getCoveActions(farm).planKey);
    assert.equal(coveControls(farm), natural);
    changeCove(farm, covePresets.channel); farm.island = 'home'; endDay(farm); farm.island = 'grove';
    farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!; assert.ok(farm);
    const morning = coveControls(farm);
    assert.match(morning, /Утренний прилив применил план/);
    assert.match(morning, /Сейчас:<\/strong> Открытое течение · луг · камни/);
    assert.doesNotMatch(morning, /cove-cancel|После прилива, день/);
    farm.island = 'home'; endDay(farm); farm.island = 'grove';
    assert.doesNotMatch(coveControls(farm), /Утренний прилив/);
  } finally { await server.close(); }
});
