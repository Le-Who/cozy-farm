import test from 'node:test'
import assert from 'node:assert/strict'
import { beginFishingTrip, createFarm, endDay, getFishLimit, getFishingTripConfig, getResidentService, restoreFarm, runResidentService } from '../src/farm.ts'
import { neighborHelpStatus } from '../src/neighbor-help.ts'
import { neighborHelpFixture } from './fixtures/neighbor-help.ts'

const reload = (farm: ReturnType<typeof createFarm>) => {
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))
  assert.ok(restored)
  return restored
}

test('stored help is a pure view of both completed meetings and survives reload', () => {
  const farm = neighborHelpFixture(), before = structuredClone(farm)
  for (let i=0;i<3;i++) {
    assert.equal(neighborHelpStatus(farm,'bea')?.summary,'Следующая выпечка ×4')
    assert.match(neighborHelpStatus(farm,'finn')!.next,/Сначала попросите Финна/)
  }
  assert.deepEqual(farm,before)
  assert.deepEqual(neighborHelpStatus(reload(farm),'bea'),neighborHelpStatus(farm,'bea'))
  assert.deepEqual(neighborHelpStatus(reload(farm),'finn'),neighborHelpStatus(farm,'finn'))
})

test('a new morning preserves unused help and starts the next meeting normally', () => {
  const farm=neighborHelpFixture(); farm.island='home'
  assert.ok(endDay(farm).ok)
  const restored=reload(farm)
  assert.equal(restored.neighbors.bea.current?.phase,'preparing')
  assert.ok(neighborHelpStatus(restored,'bea'))
  assert.ok(neighborHelpStatus(restored,'finn'))
})

test('Bea consumes help only on successful baking, for the unchanged ingredient cost', () => {
  const farm=neighborHelpFixture(), wheat=farm.produce.wheat, eggs=farm.eggs, pastries=farm.handmade.round, coins=farm.coins
  farm.eggs=0
  assert.equal(getResidentService(farm,'bea','round').label,'Принесите 4 пшеницы и 2 яйца для четырёх изделий.')
  assert.equal(runResidentService(farm,'bea','round').ok,false)
  assert.ok(neighborHelpStatus(farm,'bea'))
  farm.eggs=eggs
  assert.ok(runResidentService(farm,'bea','round').ok)
  assert.equal(farm.produce.wheat,wheat-4); assert.equal(farm.eggs,eggs-2)
  assert.equal(farm.handmade.round,pastries+4); assert.equal(farm.coins,coins)
  assert.equal(neighborHelpStatus(farm,'bea'),undefined)
  const used=structuredClone(farm)
  assert.equal(runResidentService(farm,'bea','round').ok,false)
  assert.deepEqual(farm,used)
  assert.equal(neighborHelpStatus(reload(farm),'bea'),undefined)
  farm.island='home'; assert.ok(endDay(farm).ok); farm.island='village'
  assert.ok(runResidentService(farm,'bea','round').ok)
  assert.equal(farm.handmade.round,pastries+7)
})

test('missing ingredients describe three normal items or four with either help source', () => {
  const farm=neighborHelpFixture(); farm.eggs=0; farm.neighbors.bea.helpReady=false
  assert.equal(getResidentService(farm,'bea','round').label,'Принесите 4 пшеницы и 2 яйца для трёх изделий.')
  farm.culinary.tastings.bea.bonus=true
  assert.equal(getResidentService(farm,'bea','round').label,'Принесите 4 пшеницы и 2 яйца для четырёх изделий.')
})

test('a used service today explains the later opportunity without expiring help', () => {
  const farm=neighborHelpFixture()
  farm.village.serviceOn.bea=farm.village.serviceOn.finn=farm.day
  assert.match(neighborHelpStatus(farm,'bea')!.next,/Сегодня Беа уже пекла/)
  assert.match(neighborHelpStatus(farm,'finn')!.next,/После отдыха/)
  assert.equal(getResidentService(farm,'bea','round').available,false)
  assert.equal(getResidentService(farm,'finn').available,false)
  farm.island='home'; assert.ok(endDay(farm).ok)
  assert.doesNotMatch(neighborHelpStatus(farm,'bea')!.next,/Сегодня Беа уже пекла/)
  assert.doesNotMatch(neighborHelpStatus(farm,'finn')!.next,/После отдыха/)
})

test('Finn scouting is distinct from the promise and does not spend it until a valid trip starts', () => {
  const farm=neighborHelpFixture()
  assert.equal(getFishingTripConfig(farm).resilience,2)
  assert.ok(runResidentService(farm,'finn').ok)
  assert.ok(farm.neighbors.finn.helpReady)
  assert.match(neighborHelpStatus(farm,'finn')!.next,/Маршрут уже готов/)
  assert.equal(getFishingTripConfig(farm).resilience,5)
  assert.equal(beginFishingTrip(farm).ok,false) // The village is not a fishing shore.
  assert.ok(neighborHelpStatus(farm,'finn'))
  const restored=reload(farm); restored.island='home'
  restored.fishCaughtToday.home=getFishLimit(restored)
  assert.equal(beginFishingTrip(restored).ok,false)
  assert.ok(neighborHelpStatus(restored,'finn'))
  assert.ok(restored.village.scouting)
  restored.fishCaughtToday.home=0
  const trip=beginFishingTrip(restored)
  assert.ok(trip.ok); assert.equal(trip.config!.capacity,3); assert.equal(trip.config!.resilience,5)
  assert.equal(neighborHelpStatus(restored,'finn'),undefined)
  assert.equal(restored.village.scouting,false)
  assert.equal(neighborHelpStatus(reload(restored),'finn'),undefined)
})

test('the same one-use benefit from a tasting is shown without inventing a second reward', () => {
  const farm=neighborHelpFixture()
  farm.neighbors.bea.helpReady=false; farm.culinary.tastings.bea.bonus=true
  assert.ok(neighborHelpStatus(farm,'bea'))
  farm.neighbors.bea.helpReady=true
  const before=farm.handmade.round
  assert.ok(runResidentService(farm,'bea','round').ok)
  assert.equal(farm.handmade.round,before+4)
  assert.equal(neighborHelpStatus(farm,'bea'),undefined)
})

test('there is no promise for absent residents or fresh games', () => {
  assert.equal(neighborHelpStatus(createFarm(),'bea'),undefined)
  const farm=neighborHelpFixture(); farm.village.residents[0]=null
  assert.equal(neighborHelpStatus(farm,'bea'),undefined)
  assert.ok(neighborHelpStatus(farm,'finn'))
})
