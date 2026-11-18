import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { commissionPlayer } from './fixtures/commission-player.ts';
import { inviteNeighborVisit } from '../src/neighbor-visits.ts';
import { createFarm, getProject, restoreFarm, sail, type FarmState, type ProjectId } from '../src/farm.ts';
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
  assert.deepEqual(journal.activities.map(activity => activity.panel), ['bay-freight', 'neighbor-visits', 'bay-shop', 'bay-music', 'festival']);
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
  assert.equal(journal.activities.length, 5, 'the journal keeps real activities, including the guest book, available after the introduction');
});

test('opening and reopening the journal never changes saves or grants rewards', () => {
  const farm = createFarm(); farm.boatOwned = true;
  const before = JSON.stringify(farm);
  const first = getDiscoveryJournal(farm);
  for (let i = 0; i < 10; i++) assert.deepEqual(getDiscoveryJournal(farm), first);
  assert.equal(JSON.stringify(farm), before);
});

test('a guest changes only the Journal music crossing into an explicit choice', () => {
  const p=commissionPlayer(JSON.parse(readFileSync(new URL('./fixtures/market-order-selection-commands.json',import.meta.url),'utf8')).slice(0,-1));
  const farm=p.state; assert.equal(farm.day,14); assert.equal(farm.island,'home');
  const activity=()=>getDiscoveryJournal(farm).activities.find(a=>a.panel==='bay-music')!;
  assert.match(activity().label,/Плыть/); assert.equal(activity().visit,undefined);
  assert.ok(inviteNeighborVisit(farm,'beaHarvest').ok); const before=structuredClone(farm);
  const choice=activity(); assert.match(choice.label,/Плыть/); assert.match(choice.detail,/Беа вернётся в гавань/);
  assert.equal(choice.visit,farm.neighborVisits.active!.serial); assert.deepEqual(farm,before);
  const stored=restoreFarm(JSON.parse(JSON.stringify(farm)));assert.ok(stored);assert.deepEqual(getDiscoveryJournal(stored).activities.find(a=>a.panel==='bay-music'),choice);
  assert.ok(sail(farm,'village').ok);assert.equal(farm.neighborVisits.active,null);
  assert.equal(activity().label,'Музыкальный сад'); assert.equal(activity().visit,undefined);
  assert.deepEqual(farm.neighborVisits.memories,before.neighborVisits.memories); assert.equal(farm.coins,before.coins); assert.equal(farm.day,before.day);
});

test('only a live journal choice can sail the current guest away', async () => {
  const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
  const start=source.indexOf("    case 'journal-music': {"),end=source.indexOf("    case 'open-panel':",start);
  assert.ok(start>=0 && end>start);
  const click=stripTypeScriptTypes(`(async()=>{switch('journal-music'){${source.slice(start,end)}}})()`,{mode:'transform'});
  for(const [guest,quoted,expanded,attached,expected] of [
    [1,'1',false,true,0], [2,'1',true,true,0], [1,undefined,false,true,0],
    [1,'1',true,false,0], [null,'1',true,true,0],
    [1,'1',true,true,1], [null,undefined,false,true,1],
  ] as const) {
    const calls:string[]=[];
    await runInNewContext(click,{panel:'journal',dialog:{open:true},dialogContent:{contains:()=>attached},
      farm:{island:'home',village:{built:true},neighborVisits:{active:guest?{serial:guest}:null}},
      control:{dataset:{visit:quoted},closest:()=>expanded},visitPanelAt:(dest:string,panel:string)=>calls.push(`${dest}:${panel}`)});
    assert.deepEqual(calls,expected?['village:bay-music']:[]);
  }
});

test('staying collapses only the Journal crossing and returns focus to its summary', async () => {
  const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
  const stay=source.match(/data-action="([\w-]+)">Остаться на ферме<\/button>/)?.[1];
  assert.ok(stay);
  const start=source.indexOf(`    case '${stay}':`),end=source.indexOf("    case '",start+1);
  assert.ok(start>=0 && end>start);
  const click=stripTypeScriptTypes(`(async()=>{switch('${stay}'){${source.slice(start,end)}}})()`,{mode:'transform'});
  let focused=0,closed=0;
  const card={open:true,querySelector:(selector:string)=>selector==='summary'?{focus:()=>focused++}:null};
  await runInNewContext(click,{panel:'journal',dialog:{open:true},dialogContent:{contains:()=>true},
    control:{closest:()=>card},closeDialog:()=>closed++});
  assert.equal(closed,0);assert.equal(card.open,false);assert.equal(focused,1);
});
