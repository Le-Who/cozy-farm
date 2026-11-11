import { neighborHelpFixture } from './fixtures/neighbor-help.ts';
import { ActionClickGuard, ActivationKeyGuard, isGuardedAction } from '../src/action-click-guard.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarm, getProject, getFishLimit, restoreFarm, endDay, beginFishingTrip, finishFishingTrip } from '../src/farm.ts';
import { createFishingModel, fishingLootAtDepth, fishingDepth } from '../src/fishing-model.ts';
import { getFishSource, rareFishClue } from '../src/fish-guidance.ts';
import { getSupplyGuidance } from '../src/discovery-path.ts';
import { getRequirementHint } from '../src/requirement-guidance.ts';
const rare = ['moonfish','lanternfish'] as const;

for (const fish of rare) test(`${fish} points to Home without buying a boat or changing the save`, () => {
  const f=createFarm(), before=structuredClone(f), item={kind:'fish',item:fish,quantity:1} as const;
  assert.equal(getFishSource(f,fish),'home');
  const hint=getRequirementHint(f,{kind:'stock',item}), task=getSupplyGuidance(f,item,'гриль');
  assert.equal(hint.action.target,'open-panel');assert.equal(hint.action.value,'fishing');
  assert.deepEqual(task.action,hint.action);assert.match(hint.notice!,/может встретиться/);assert.match(task.detail,/не гарантирован/);
  assert.deepEqual(f,before);
  const loaded=restoreFarm(JSON.parse(JSON.stringify(f)))!;assert.ok(loaded);
  assert.deepEqual(getRequirementHint(loaded,{kind:'stock',item}),hint);
});

test('both rare fish really exist in the home-shore model, without claiming every seed has them', () => {
  assert.equal(fishingLootAtDepth(20,.99,'perch').kind,'fish');
  assert.deepEqual(fishingLootAtDepth(20,.99,'perch'),{kind:'fish',species:'moonfish',variant:'rare'});
  assert.deepEqual(fishingLootAtDepth(27,.99,'perch'),{kind:'fish',species:'lanternfish',variant:'rare'});
  for (const [day,fish] of [[1,'moonfish'],[2,'lanternfish']] as const) {
    const model=createFishingModel(2,2,day*1009+9176+17,'perch');
    assert.ok(model.fish.some(entry=>entry.loot?.kind==='fish'&&entry.loot.species===fish));
  }
  const empty=createFishingModel(2,2,5*1009+9176+17,'perch');
  assert.ok(!empty.fish.some(entry=>entry.rare));
});

test('prefer the current eligible shore, then another reachable one with unused quota', () => {
  const f=createFarm();f.boatOwned=true;
  for (const fish of rare) {
    assert.equal(getFishSource(f,fish),'home');f.fishCaughtToday.home=3;
    assert.equal(getFishSource(f,fish),'grove');
    assert.equal(getRequirementHint(f,{kind:'stock',item:{kind:'fish',item:fish,quantity:1}}).action.value,'grove');
    f.island='grove';f.fishCaughtToday.home=0;
    assert.equal(getFishSource(f,fish),'grove');f.fishCaughtToday.grove=3;
    assert.equal(getFishSource(f,fish),'home');f.island='home';f.fishCaughtToday.grove=0;
  }
});

test('without a boat the exhausted home shore leads to read-only rest, not a boat purchase', () => {
  const f=createFarm();f.fishCaughtToday.home=3;const before=structuredClone(f);
  for(const fish of rare){
    const item={kind:'fish',item:fish,quantity:1} as const;
    assert.equal(getFishSource(f,fish),'home');
    assert.equal(getSupplyGuidance(f,item,'гриль').action.target,'visit-rest');
    assert.deepEqual(getRequirementHint(f,{kind:'stock',item}).action,{label:'',target:'open-panel',value:'rest'});
  }
  assert.deepEqual(f,before);assert.equal(endDay(f).ok,true);
  assert.equal(f.day,2);assert.equal(f.fishCaughtToday.home,0);
  assert.equal(getRequirementHint(f,{kind:'stock',item:{kind:'fish',item:'moonfish',quantity:1}}).action.value,'fishing');
});

test('both exhausted shores go Home and stay there until an explicit rest', () => {
  const f=createFarm();f.boatOwned=true;f.island='grove';f.fishCaughtToday={home:3,grove:3};
  const item={kind:'fish',item:'lanternfish',quantity:1} as const;
  assert.equal(getRequirementHint(f,{kind:'stock',item}).action.value,'home');
  f.island='home';const before=structuredClone(f);
  for(let i=0;i<3;i++)assert.equal(getRequirementHint(f,{kind:'stock',item}).action.value,'rest');
  assert.deepEqual(f,before);
  const loaded=restoreFarm(JSON.parse(JSON.stringify(f)))!;assert.ok(loaded);
  assert.equal(getRequirementHint(loaded,{kind:'stock',item}).action.value,'rest');
});

test('the restored Grove dock bonus counts as remaining quota', () => {
  const f=createFarm();f.boatOwned=true;f.fishCaughtToday={home:3,grove:3};
  for(const {item} of getProject(f,'dock').items)f.projects.dock['item' in item?`${item.kind}:${item.item}`:item.kind]=item.quantity;
  assert.equal(getFishLimit(f,'grove'),4);assert.equal(getFishSource(f,'moonfish'),'grove');
  const loaded=restoreFarm(JSON.parse(JSON.stringify(f)))!;assert.ok(loaded);
  assert.equal(getFishSource(loaded,'moonfish'),'grove');loaded.island='grove';
  assert.equal(getRequirementHint(loaded,{kind:'stock',item:{kind:'fish',item:'moonfish',quantity:1}}).action.value,'fishing');
});

test('ordinary species keep their regional and boat requirements', () => {
  const f=createFarm();
  assert.equal(getFishSource(f,'perch'),'home');assert.equal(getFishSource(f,'seaBass'),'grove');
  assert.equal(getSupplyGuidance(f,{kind:'fish',item:'perch',quantity:1},'гриль').action.target,'visit-pier');
  const hint=getRequirementHint(f,{kind:'stock',item:{kind:'fish',item:'seaBass',quantity:1}});
  assert.match(hint.notice!,/Лодка/);assert.equal(rareFishClue('perch'),undefined);
});

test('guidance never spends a cast token, quota, scouting or saved help', () => {
  const f=neighborHelpFixture();f.island='home';f.village.scouting=true;f.village.serviceOn.finn=f.day;f.culinary.picnic={day:f.day,processing:'bright'};assert.ok(restoreFarm(f));const before=structuredClone(f);
  for(const fish of rare)getRequirementHint(f,{kind:'stock',item:{kind:'fish',item:fish,quantity:1}});
  assert.deepEqual(f,before);
  const trip=beginFishingTrip(f);assert.equal(trip.ok,true);assert.equal(f.fishCaughtToday.home,0);
  assert.equal(f.village.scouting,false);assert.equal(f.neighbors.finn.helpReady,false);assert.equal(f.culinary.picnic,null);
  assert.equal(finishFishingTrip(f,trip.token!,[{kind:'fish',species:'moonfish',variant:'rare'}]).ok,true);
  assert.equal(f.fishCaughtToday.home,1);assert.equal(f.fish.moonfish,1);
  const after=structuredClone(f);assert.equal(finishFishingTrip(f,trip.token!,1).ok,false);assert.deepEqual(f,after);
});


test('moon and lantern depth clues reflect their distinct bands in displayed metres', () => {
  assert.equal(fishingDepth*4,120);
  assert.deepEqual(fishingLootAtDepth(fishingDepth*.619,.99,'perch'),{kind:'fish',species:'perch',variant:'regular'});
  assert.deepEqual(fishingLootAtDepth(fishingDepth*.62,.99,'perch'),{kind:'fish',species:'moonfish',variant:'rare'});
  assert.deepEqual(fishingLootAtDepth(fishingDepth*.84,.99,'perch'),{kind:'fish',species:'moonfish',variant:'rare'});
  assert.deepEqual(fishingLootAtDepth(fishingDepth*.841,.99,'perch'),{kind:'fish',species:'lanternfish',variant:'rare'});
  assert.match(rareFishClue('moonfish')!,/примерно 75–100 м/);
  assert.match(rareFishClue('lanternfish')!,/глубже 100 м/);
});


test('an ingredient navigation owns its double click and held key across the new panel', () => {
  assert.ok(isGuardedAction('show-requirement'));
  const pointer = new ActionClickGuard();
  pointer.remember({detail:1,timeStamp:100,clientX:220,clientY:600});
  assert.ok(pointer.blocks({detail:1,timeStamp:200,clientX:220,clientY:600}));
  assert.equal(pointer.blocks({detail:1,timeStamp:750,clientX:220,clientY:600}),false);
  const key = new ActivationKeyGuard();
  assert.equal(key.blocks({key:'Enter',repeat:false},true),false);
  assert.equal(key.blocks({key:'Enter',repeat:true},false),true);
  key.release('Enter');assert.equal(key.blocks({key:'Enter',repeat:false},false),false);
});
