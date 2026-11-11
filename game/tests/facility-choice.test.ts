import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFacilityChoiceDetails, renderFacilityChoiceDetails } from '../src/facility-choice.ts';
import { endDay, facilityBranchIds, facilitySpecializations, getIrrigationPair, getWaterCapacity, incubateEgg, irrigatePair, maxFlockSize, packEggCrate, refillWater, restoreFarm, specializeFacility, unpackEggCrate, upgradeCan } from '../src/farm.ts';
import { facilityChoiceFixture } from './fixtures/facility-choice.ts';
const copy=(farm:ReturnType<typeof facilityChoiceFixture>,branch: typeof facilityBranchIds[number])=>getFacilityChoiceDetails(farm,branch).lines.join(' ');

test('previewing every permanent facility is pure and reload-stable', () => {
  const farm=facilityChoiceFixture(), before=structuredClone(farm);
  for(const branch of facilityBranchIds){
    const detail=getFacilityChoiceDetails(farm,branch);
    assert.deepEqual(getFacilityChoiceDetails(restoreFarm(JSON.parse(JSON.stringify(farm)))!,branch),detail);
    assert.match(renderFacilityChoiceDetails(farm,branch),/Условия направления/);
  }
  assert.deepEqual(farm,before);
});

test('cistern capacity follows the current can, while construction does not fill or water', () => {
  for(const large of [false,true]){
    const farm=facilityChoiceFixture();if(large)assert.equal(upgradeCan(farm).ok,true);
    farm.water=3;const beds=structuredClone(farm.beds),old=farm.coins;
    assert.match(copy(farm,'rain'),new RegExp(`${large?16:12} порций`));
    assert.match(copy(farm,'rain'),/поливать самостоятельно/);
    assert.equal(specializeFacility(farm,'rain').ok,true);
    assert.equal(farm.coins,old-facilitySpecializations.well.rain.price);
    assert.equal(farm.water,3);assert.deepEqual(farm.beds,beds);
    assert.equal(getWaterCapacity(farm),large?16:12);
    assert.equal(endDay(farm).ok,true);assert.equal(farm.water,large?16:12);
    assert.ok(restoreFarm(farm));
  }
});

test('pipes still require an explicit pair and charge only dry growing beds', () => {
  const farm=facilityChoiceFixture();farm.beds.splice(0,8,
    {kind:'crop',crop:'carrot',growth:1,watered:false},
    {kind:'crop',crop:'carrot',growth:0,watered:true},
    ...Array.from({length:6},()=>({kind:'crop',crop:'carrot',growth:0,watered:false} as const)));
  const before=structuredClone(farm.beds);assert.match(copy(farm,'pipes'),/до 8 грядок/);
  assert.match(copy(farm,'pipes'),/1 порция воды/);
  assert.equal(specializeFacility(farm,'pipes').ok,true);assert.deepEqual(farm.beds,before);
  assert.equal(getIrrigationPair(farm,0).targets.length,6);
  const scarce=structuredClone(farm);assert.equal(irrigatePair(farm,0).ok,false);assert.deepEqual(farm,scarce);
  refillWater(farm);assert.equal(irrigatePair(farm,0).ok,true);assert.equal(farm.water,2);
});

test('hatchery purchase can precede the required egg but never starts incubation automatically', () => {
  const farm=facilityChoiceFixture();farm.eggs=0;
  assert.match(copy(farm,'hatchery'),/через 2 ночи/);assert.match(copy(farm,'hatchery'),/Предел стада: 5/);
  assert.match(copy(farm,'hatchery'),/Яиц в запасе: 0/);
  assert.equal(specializeFacility(farm,'hatchery').ok,true);assert.equal(farm.hatchDay,null);
  const before=structuredClone(farm);assert.equal(incubateEgg(farm).ok,false);assert.deepEqual(farm,before);
  farm.eggs=1;assert.equal(incubateEgg(farm).ok,true);assert.equal(farm.eggs,0);
  endDay(farm);assert.equal(farm.flockSize,4);endDay(farm);assert.equal(farm.flockSize,maxFlockSize);
  farm.eggs=1;const full=structuredClone(farm);assert.equal(incubateEgg(farm).ok,false);assert.deepEqual(farm,full);
  assert.match(copy(farm,'hatchery'),/Сейчас у вас: 5/);
});

test('packing purchase needs no eggs, and explicit packing and unpacking match the described quantities', () => {
  const farm=facilityChoiceFixture();farm.eggs=0;assert.match(copy(farm,'packing'),/5 обычных яиц → 1 ящик/);
  assert.equal(specializeFacility(farm,'packing').ok,true);assert.equal(farm.eggCrates,0);
  const before=structuredClone(farm);assert.equal(packEggCrate(farm).ok,false);assert.deepEqual(farm,before);
  farm.eggs=5;assert.equal(packEggCrate(farm).ok,true);assert.equal(farm.eggs,0);assert.equal(farm.eggCrates,1);
  assert.equal(unpackEggCrate(farm).ok,true);assert.equal(farm.eggs,5);assert.equal(farm.eggCrates,0);
  assert.ok(restoreFarm(farm));
});

test('insufficient coins, stale repeat and an alternative branch cannot change the permanent choice', () => {
  for(const branch of facilityBranchIds){
    const farm=facilityChoiceFixture();farm.coins=0;const before=structuredClone(farm);
    getFacilityChoiceDetails(farm,branch);assert.equal(specializeFacility(farm,branch).ok,false);assert.deepEqual(farm,before);
    farm.coins=150;assert.equal(specializeFacility(farm,branch).ok,true);
    const after=structuredClone(farm),other=branch==='rain'?'pipes':branch==='pipes'?'rain':branch==='hatchery'?'packing':'hatchery';
    assert.equal(specializeFacility(farm,branch).ok,false);assert.equal(specializeFacility(farm,other).ok,false);assert.deepEqual(farm,after);
    const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(loaded);assert.equal(specializeFacility(loaded,other).ok,false);
  }
});
