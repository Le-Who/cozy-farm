import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createFarm, endDay, getFairGuest, restoreFarm, serveFairGuest } from '../src/farm.ts'
import { getNextFairGuest, renderFairReturn } from '../src/fair-return.ts'
import { isGuardedAction, ActionClickGuard } from '../src/action-click-guard.ts'
import { fairReturnFixture } from './fixtures/fair-return.ts'

const stock = (item: {kind:string,quantity:number,item?:string}) => `<li>${item.kind}:${item.item??''} ×${item.quantity}</li>`

test('the next fair guest matches the actual next day across repeated four-day cycles', () => {
  const names=['Мара','Поппи','Финн','Беа']
  for(let day=3;day<=14;day++) {
    const farm=fairReturnFixture('first');farm.day=day
    const expected=getNextFairGuest(farm)!
    assert.equal(expected.day,day+1)
    assert.equal(expected.name,names[day%4])
    assert.equal(expected.served,false)
    assert.equal(endDay(farm).ok,true)
    const {day:_,...guest}=expected
    assert.deepEqual(guest,getFairGuest(farm))
    assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))))
  }
})

test('newly planted flowers are already old enough for tomorrow’s Bea request, without advancing the farm', () => {
  const farm=fairReturnFixture('new-flowers'),before=structuredClone(farm)
  const expected=getNextFairGuest(farm)!
  assert.equal(expected.name,'Беа')
  assert.deepEqual(expected.item,{kind:'dishes',item:'honeyCake',quantity:1})
  for(let i=0;i<5;i++)renderFairReturn(farm,stock)
  assert.deepEqual(farm,before)
  const restored=restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(restored)
  assert.deepEqual(getNextFairGuest(restored),expected)
  assert.equal(endDay(restored).ok,true)
  assert.deepEqual(getFairGuest(restored)?.item,expected.item)
})

test('preview preserves the existing wheat alternative before cape discovery and updates when it changes', () => {
  const farm=fairReturnFixture('return')
  assert.deepEqual(getNextFairGuest(farm)?.item,{kind:'produce',item:'wheat',quantity:3})
  farm.capeFlowers[0]=farm.day
  assert.deepEqual(getNextFairGuest(farm)?.item,{kind:'dishes',item:'honeyCake',quantity:1})
  farm.capeFlowers[0]=null
  assert.deepEqual(getNextFairGuest(farm)?.item,{kind:'produce',item:'wheat',quantity:3})
})

test('serving and reopening keep the exact reward once, while the next day only changes the guest', () => {
  const farm=fairReturnFixture('first'),guest=getFairGuest(farm)!,before=structuredClone(farm)
  assert.equal(serveFairGuest(farm).ok,true)
  assert.equal(farm.produce.wheat,before.produce.wheat-3)
  assert.equal(farm.coins,before.coins+guest.reward)
  assert.equal(farm.seeds[guest.seeds.crop],before.seeds[guest.seeds.crop]+2)
  assert.equal(farm.fairGuestsServed,1)
  const served=structuredClone(farm)
  renderFairReturn(farm,stock)
  assert.equal(serveFairGuest(farm).ok,false)
  assert.deepEqual(farm,served)
  const restored=restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(restored)
  assert.equal(getFairGuest(restored)?.served,true)
  const next=getNextFairGuest(restored)!
  assert.equal(endDay(restored).ok,true)
  assert.equal(getFairGuest(restored)?.name,next.name)
  assert.equal(getFairGuest(restored)?.served,false)
  assert.equal(restored.coins,served.coins)
  assert.equal(restored.fairGuestsServed,1)
  assert.equal(restored.guestServedOn,served.guestServedOn)
})

test('missing supplies or a different island still reject serving without spending or granting rewards', () => {
  const farm=fairReturnFixture('return')
  farm.produce.wheat=2
  let before=structuredClone(farm)
  assert.equal(serveFairGuest(farm).ok,false)
  assert.deepEqual(farm,before)
  farm.produce.wheat=6;farm.island='grove';before=structuredClone(farm)
  renderFairReturn(farm,stock)
  assert.equal(serveFairGuest(farm).ok,false)
  assert.deepEqual(farm,before)
})

test('the preview explains the voluntary day change and no guest exists before the fair opens', () => {
  const early=createFarm()
  assert.equal(getNextFairGuest(early),undefined)
  assert.equal(renderFairReturn(early,stock),'')
  const farm=fairReturnFixture('return'),html=renderFairReturn(farm,stock)
  assert.match(html,/Следующий гость · день 8/)
  assert.match(html,/Беа/)
  assert.match(html,/produce:wheat ×3/)
  assert.match(html,/После отдыха сегодняшняя просьба сменится новой/)
  assert.match(html,/по нынешним открытиям фермы/)
  assert.doesNotMatch(html,/data-action=/)
  assert.match(renderFairReturn(fairReturnFixture('served'),stock),/Сегодняшний гость уже угощён/)
})

test('the map keeps the daily guest separate from community requests and the serve gesture is guarded', () => {
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  assert.match(main,/if \(isProjectComplete\(farm,'fair'\)\) places\.push\(tile\('Гость ярмарки','ui-market','guest'\),tile\('Просьбы соседей'/)
  assert.match(main,/button\('К отдыху дома','visit-rest'\)/)
  assert.equal(isGuardedAction('serve-guest'),true)
  const guard=new ActionClickGuard()
  guard.remember({detail:1,timeStamp:100,clientX:120,clientY:220})
  assert.equal(guard.blocks({detail:2,timeStamp:150,clientX:120,clientY:220}),true)
})
