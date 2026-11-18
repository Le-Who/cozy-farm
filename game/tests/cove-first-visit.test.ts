import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import * as F from '../src/farm.ts';
import { createFishingModel } from '../src/fishing-model.ts';
import { covePresets } from '../src/shoreline.ts';
import { getRequirementHint } from '../src/requirement-guidance.ts';
import { commissionPlayer } from './fixtures/commission-player.ts';

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
test('the archive and festival route lanternfish to water deep enough after each actual tide', async () => {
  const p=commissionPlayer(opening.slice(0,opening.findIndex(step=>step.name==='serveVillageMeal')+1));
  p.act('beginFestival','lights');p.visit('grove');p.act('collectShell',0);
  const item=(species:'lanternfish'|'moonfish')=>({kind:'stock',item:{kind:'fish',item:species,quantity:1}} as const);
  const source=(species:'lanternfish'|'moonfish'='lanternfish')=>getRequirementHint(p.state,item(species));
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
  try {
    const {archiveCards}=await server.ssrLoadModule('/src/archive.ts'),{renderFestivalPanel}=await server.ssrLoadModule('/src/bay-festival-ui.ts');
    const clue=()=>archiveCards(p.state,'bay',()=> '').match(/<strong>Рыба-фонарь<\/strong>([^<]+)/)![1];
    p.act('changeCove',{cover:'kelp'});
    assert.equal(source().action.value,'fishing','pending nursery is still natural water');
    p.night();p.visit('grove');assert.equal(p.state.day,11);
    const before=structuredClone(p.state);
    assert.equal(source().action.value,'home','nursery cannot spawn targets in the lanternfish band');
    assert.equal(source('moonfish').action.value,'fishing','moonfish can still spawn locally');
    assert.match(clue(),/у Родного острова/);assert.doesNotMatch(clue(),/и в Солёной роще/);
    assert.equal(source().notice,clue());
    assert.deepEqual(p.state,before);
    p.visit('home');assert.equal(source().action.value,'fishing');
    while(F.getFishAction(p.state).available)p.act('catchFish',true);
    p.visit('village');
    assert.match(renderFestivalPanel(p.state),/data-action="festival-source" data-value="fish\|lanternfish"><span>Рыба-фонарь/);
    assert.equal(source().action.value,'home');
    p.visit('home');assert.equal(source().action.value,'rest');assert.equal(p.state.day,11);
    p.visit('grove');p.act('changeCove',{flow:'open'});
    assert.equal(source().action.value,'home','a proposed channel is not deep water yet');
    p.night();p.visit('grove');
    assert.equal(source().action.value,'fishing');assert.match(clue(),/и в Солёной роще/);
    const config=F.getFishingTripConfig(p.state),seed=p.state.day*1009+(p.state.fishingTripSerial+1)*9176+71;
    assert.ok(createFishingModel(config.capacity,config.resilience,seed,'seaBass',config.habitat).fish.some(({loot})=>loot?.kind==='fish'&&loot.species==='lanternfish'));
  } finally { await server.close(); }
});

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
