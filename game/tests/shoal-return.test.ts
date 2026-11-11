import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createFarm, restoreFarm, collectShoalFind, endDay, sail } from '../src/farm.ts'
import { getShoalFindAt, shoalFindIds } from '../src/shoal.ts'
import { isLunarTide } from '../src/tide.ts'
import { getShoalReturn, shoalReturnCopy } from '../src/shoal-return.ts'
function openShoal(day=6) {
  const farm=createFarm();farm.day=day;farm.boatOwned=true;farm.island='grove';farm.shellDiscoveries=['regular','moon'];return farm
}

test('first lunar tide does not falsely promise a pearl today',()=>{
  const farm=openShoal(),before=structuredClone(farm)
  assert.equal(isLunarTide(6),true);assert.equal(getShoalFindAt(farm,'pearl'),undefined)
  assert.deepEqual(getShoalReturn(farm,'pearl'),{status:'waiting',nextDay:11})
  assert.equal(shoalReturnCopy(farm,'pearl'),'Следующая находка: день 11.')
  assert.equal(shoalReturnCopy(farm,'glass'),'На берегу сегодня.')
  assert.deepEqual(farm,before)
})

test('closed shoal explains both discoveries without promising a collectible date',()=>{
  const farm=openShoal(11)
  for(const shells of [[],['regular'],['moon']] as const){
    farm.shellDiscoveries=[...shells]
    for(const id of shoalFindIds){assert.equal(getShoalReturn(farm,id).status,'locked');assert.equal(getShoalReturn(farm,id).nextDay,undefined);assert.match(shoalReturnCopy(farm,id),/обычную и лунную ракушки/)}
  }
})

test('forecasts match actual daily availability across tide cycles and collection states',()=>{
  for(let day=1;day<=1000;day++)for(const id of shoalFindIds)for(const collected of [false,true]){
    const farm=openShoal(day);farm.shoalCollectedToday=collected?[id]:[]
    const forecast=getShoalReturn(farm,id)
    const expected=Array.from({length:11},(_,offset)=>day+offset).find(candidate=>getShoalFindAt({...farm,day:candidate,shoalCollectedToday:candidate===day?farm.shoalCollectedToday:[]},id))
    assert.equal(forecast.nextDay,expected,`${id}, day ${day}, collected ${collected}`)
    assert.equal(forecast.status, getShoalFindAt(farm,id)?'available':collected?'collected':'waiting')
  }
})

test('collection changes only the real ledger and return date; reload cannot recreate the find',()=>{
  let farm=openShoal(11);const before=structuredClone(farm)
  assert.equal(getShoalReturn(farm,'pearl').status,'available')
  assert.ok(collectShoalFind(farm,'pearl').ok)
  assert.equal(farm.shoalFinds.pearl,before.shoalFinds.pearl+1)
  assert.equal(farm.coins,before.coins);assert.equal(farm.day,11)
  assert.equal(farm.workToday,before.workToday+1)
  assert.equal(getShoalReturn(farm,'pearl').status,'collected')
  assert.match(shoalReturnCopy(farm,'pearl'),/^Сегодня собрано\. Следующая находка:/)
  farm=restoreFarm(JSON.parse(JSON.stringify(farm)))!
  const saved=structuredClone(farm)
  assert.equal(collectShoalFind(farm,'pearl').ok,false)
  for(let i=0;i<4;i++)getShoalReturn(farm,'pearl')
  assert.deepEqual(farm,saved)
})

test('tomorrow wording follows explicit sleep rather than reading or real time',()=>{
  const farm=openShoal(10),before=structuredClone(farm)
  assert.equal(shoalReturnCopy(farm,'pearl'),'Следующая находка: завтра, день 11.')
  assert.deepEqual(farm,before)
  assert.ok(sail(farm,'home').ok);assert.ok(endDay(farm).ok);assert.ok(sail(farm,'grove').ok)
  assert.equal(getShoalReturn(farm,'pearl').status,'available')
  assert.equal(getShoalReturn(farm,'pearl').nextDay,11)
})

test('sea glass resets tomorrow independently from the pearl tide',()=>{
  const farm=openShoal(6);assert.ok(collectShoalFind(farm,'glass').ok)
  assert.equal(shoalReturnCopy(farm,'glass'),'Сегодня собрано. Следующая находка: завтра, день 7.')
  assert.equal(getShoalReturn(farm,'pearl').nextDay,11)
})

test('safe-integer boundary never loops past the calendar or promises an unsafe day',()=>{
  const farm=openShoal(Number.MAX_SAFE_INTEGER);farm.shoalCollectedToday=['glass','pearl']
  for(const id of shoalFindIds){assert.equal(getShoalReturn(farm,id).nextDay,undefined);assert.match(shoalReturnCopy(farm,id),/следующих игровых дней/)}
})

test('archive and unlocked map use the shared truthful forecast with an opening guard',()=>{
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),archive=readFileSync(new URL('../src/archive.ts',import.meta.url),'utf8')
  assert.match(archive,/if\(id==='pearl'\) return `Лунная отмель · \$\{shoalReturnCopy\(farm,'pearl'\)\}`/)
  assert.match(main,/if \(hasShoal\(farm\)\) places.push\(tile\('Лунная отмель'/)
  assert.match(main,/next === 'shoal' && \(farm.island !== 'grove' \|\| !hasShoal\(farm\)\)/)
  assert.match(main,/shoalReturnCopy\(farm,id\)/)
})
