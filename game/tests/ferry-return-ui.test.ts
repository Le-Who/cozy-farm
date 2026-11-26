import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from './fixtures/ssr-vite.ts'
import { createFarm, endDay } from '../src/farm.ts'
import { expeditionWallet, receiveFerryExpedition, sendFerryExpedition } from '../src/harbour-economy.ts'
import { earlyFerryFarm, tendEarlyFerryFarm } from './fixtures/early-ferry.ts'
import { renderFerryReturn } from '../src/ferry-return.ts'
import { isGuardedAction, ActionClickGuard, ActivationKeyGuard } from '../src/action-click-guard.ts'

test('the sailing panel offers only an explicit home preview, and arrival keeps a separate receipt', async () => {
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom'})
  try {
    const {renderFreightPanel}=await server.ssrLoadModule('/src/bay-freight-ui.ts')
    const farm=createFarm();farm.boatOwned=true;farm.produce.wheat=8
    assert.equal(sendFerryExpedition(farm,'mill-grain').ok,true)
    const ctx={day:1,coins:farm.coins,boatOwned:true,playerPort:'grove',openedPorts:['home','grove'],products:[],carried:{wheat:4},icon:()=>''}
    const before=structuredClone(farm),html=renderFreightPanel(farm.freight,ctx)
    assert.match(html,/Домой · посмотреть утро/)
    assert.match(html,/data-action="expedition-rest" data-value="1"/)
    assert.match(html,/Переход не начинает ночь/)
    assert.doesNotMatch(html,/data-action="sleep"/)
    assert.deepEqual(farm,before)
    assert.match(renderFreightPanel(farm.freight,{...ctx,playerPort:'home'}),/В дом · посмотреть утро/)
    endDay(farm)
    const ready=renderFreightPanel(farm.freight,{...ctx,day:2})
    assert.doesNotMatch(ready,/data-action="expedition-rest"/)
    assert.match(ready,/data-action="expedition-claim"/)
  } finally {await server.close()}
})

test('return navigation owns the entire double-click or held key before replacement controls appear', () => {
  for(const action of ['ferry-return','expedition-rest'])assert.equal(isGuardedAction(action),true)
  const clicks=new ActionClickGuard()
  clicks.remember({detail:1,timeStamp:100,clientX:200,clientY:300})
  assert.equal(clicks.blocks({detail:2,timeStamp:200,clientX:200,clientY:300}),true)
  assert.equal(clicks.blocks({detail:1,timeStamp:700,clientX:200,clientY:300}),false)
  const keys=new ActivationKeyGuard()
  assert.equal(keys.blocks({key:'Enter',repeat:false},true),false)
  assert.equal(keys.blocks({key:'Enter',repeat:true},false),true)
  keys.release('Enter')
  assert.equal(keys.blocks({key:'Enter',repeat:false},false),false)
})

test('an earned day-two trip keeps one return date and one primary action before and after arrival',async()=>{
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'})
  try {
    const {renderFreightPanel}=await server.ssrLoadModule('/src/bay-freight-ui.ts')
    const farm=earlyFerryFarm();assert.ok(endDay(farm).ok);tendEarlyFerryFarm(farm)
    assert.equal(farm.day,2);assert.equal(farm.produce.wheat,6);assert.ok(sendFerryExpedition(farm,'mill-grain').ok)
    const render=()=>{
      const before=structuredClone(farm)
      const html:string=renderFreightPanel(farm.freight,{day:farm.day,coins:farm.coins,boatOwned:farm.boatOwned,playerPort:'home',
        openedPorts:['home','grove'],products:[],carried:expeditionWallet(farm).bag,icon:()=>''})
      assert.deepEqual(farm,before);return html
    }
    const pending=render()
    assert.equal((pending.match(/утром дня 3/g)??[]).length,1)
    assert.doesNotMatch(pending,/Рейс завершится после отдыха|Игровое утро начинается после сна/)
    assert.match(pending,/Переход не начинает ночь/)
    assert.deepEqual([...pending.matchAll(/data-action="([^"]+)"[^>]*class="bay-freight-primary"/g)].map(m=>m[1]),['expedition-rest'])
    assert.match(renderFerryReturn(farm,[]),/после сна, а не времени вне игры/)
    assert.equal(receiveFerryExpedition(farm).ok,false)
    const before=expeditionWallet(farm);assert.ok(endDay(farm).ok);assert.equal(farm.day,3)
    const ready=render()
    assert.match(ready,/Вернулся утром дня 3/);assert.equal((ready.match(/утром дня 3/g)??[]).length,1)
    assert.doesNotMatch(ready,/ваш груз отложен|Груз вас дождётся/);assert.match(ready,/Без срока получения/)
    assert.deepEqual([...ready.matchAll(/data-action="([^"]+)"[^>]*class="bay-freight-primary"/g)].map(m=>m[1]),['expedition-claim'])
    assert.equal(farm.coins,before.coins);assert.equal(expeditionWallet(farm).bag['handmade:round'],before.bag['handmade:round'])
    assert.ok(receiveFerryExpedition(farm).ok);assert.equal(farm.coins,before.coins+5)
    assert.equal(expeditionWallet(farm).bag['handmade:round'],before.bag['handmade:round']+1)
    const received=structuredClone(farm);assert.equal(receiveFerryExpedition(farm).ok,false);assert.deepEqual(farm,received)
  } finally {await server.close()}
})
