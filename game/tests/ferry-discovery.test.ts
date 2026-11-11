import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createFarm, endDay, restoreFarm } from '../src/farm.ts'
import { expeditionWallet, receiveFerryExpedition, sendFerryExpedition } from '../src/harbour-economy.ts'
import { isGuardedAction, ActionClickGuard, ActivationKeyGuard } from '../src/action-click-guard.ts'

async function withPanel(check: (render: (farm: ReturnType<typeof createFarm>, port?: string) => string) => void) {
  const server = await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom'})
  try {
    const { renderFreightPanel } = await server.ssrLoadModule('/src/bay-freight-ui.ts')
    check((farm, port = 'mill') => renderFreightPanel(farm.freight, {
      day:farm.day, coins:farm.coins, boatOwned:farm.boatOwned, playerPort:farm.island,
      expeditionPort:port, openedPorts:['home','grove'], carried:expeditionWallet(farm).bag,
      products:[{id:'wheat',name:'Пшеница',icon:'wheat'}], icon:()=>'',
    }))
  } finally { await server.close() }
}

test('only a received first trade reveals the next exploration, and previewing it leaves the farm unchanged', async () => {
  await withPanel(render => {
    let farm = createFarm(); farm.boatOwned = true; farm.produce.wheat = 10
    assert.doesNotMatch(render(farm), /aria-label="Следующая разведка"/)
    assert.equal(sendFerryExpedition(farm, 'mill-grain').ok, true)
    assert.doesNotMatch(render(farm), /aria-label="Следующая разведка"/)
    endDay(farm)
    assert.doesNotMatch(render(farm), /aria-label="Следующая разведка"/)
    assert.equal(receiveFerryExpedition(farm).ok, true)
    farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!
    const before = structuredClone(farm), html = render(farm)
    assert.match(html, /aria-label="Следующая разведка"/)
    assert.match(html, /После торговли с Мельничным посадом/)
    assert.match(html, /Пшеница ×2/)
    assert.match(html, /data-action="expedition-discovery" data-value="salt"/)
    assert.doesNotMatch(html, /Соляной маяк|Садовая пристань/)
    assert.deepEqual(farm, before)
  })
})

test('choosing the newly available route owns a repeated click or held key before its send button appears', () => {
  assert.equal(isGuardedAction('expedition-discovery'), true)
  const clicks = new ActionClickGuard()
  clicks.remember({detail:1,timeStamp:100,clientX:300,clientY:400})
  assert.equal(clicks.blocks({detail:2,timeStamp:200,clientX:300,clientY:400}), true)
  const keys = new ActivationKeyGuard()
  assert.equal(keys.blocks({key:'Enter',repeat:false},true), false)
  assert.equal(keys.blocks({key:'Enter',repeat:true},false), true)
  keys.release('Enter')
  assert.equal(keys.blocks({key:'Enter',repeat:false},false), false)
})

test('a discovered lighthouse requires a received trade there before the garden route appears', async () => {
  await withPanel(render => {
    let farm = createFarm(); farm.boatOwned = true; farm.produce.wheat = 12; farm.produce.carrot = 3
    const complete = (id: string) => {
      assert.equal(sendFerryExpedition(farm,id).ok, true)
      endDay(farm)
      assert.equal(receiveFerryExpedition(farm).ok, true)
      farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!
    }
    complete('mill-grain')
    complete('explore-salt')
    assert.doesNotMatch(render(farm,'salt'), /aria-label="Следующая разведка"/)
    assert.equal(sendFerryExpedition(farm,'salt-carrots').ok, true)
    endDay(farm)
    assert.doesNotMatch(render(farm,'salt'), /aria-label="Следующая разведка"/)
    assert.equal(receiveFerryExpedition(farm).ok, true)
    farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!
    const before = structuredClone(farm), html = render(farm,'salt')
    assert.match(html, /После торговли у Соляного маяка/)
    assert.match(html, /data-action="expedition-discovery" data-value="orchard"/)
    assert.doesNotMatch(html, /Садовая пристань/)
    assert.deepEqual(farm,before)
    complete('explore-orchard')
    assert.doesNotMatch(render(farm,'orchard'), /aria-label="Следующая разведка"/)
    assert.deepEqual(farm.freight.expeditions.discovered,['mill','salt','orchard'])
  })
})

test('missing exploration supplies keep preparation visible but cannot grant a departure or a port', async () => {
  await withPanel(render => {
    const farm = createFarm(); farm.boatOwned = true; farm.produce.wheat = 4
    assert.equal(sendFerryExpedition(farm,'mill-grain').ok, true)
    endDay(farm); assert.equal(receiveFerryExpedition(farm).ok, true)
    const before = structuredClone(farm)
    assert.match(render(farm), /data-action="expedition-discovery" data-value="salt"/)
    const preview = render(farm,'salt')
    assert.doesNotMatch(preview, /aria-label="Следующая разведка"/)
    assert.match(preview, /Есть 0 · нужно ещё 2/)
    assert.match(preview, /data-action="expedition-send" data-value="explore-salt"[^>]*disabled/)
    assert.match(preview, /Новый торговый порт/)
    assert.doesNotMatch(preview, /Соляной маяк/)
    assert.equal(sendFerryExpedition(farm,'explore-salt').ok, false)
    assert.deepEqual(farm,before)
  })
})

test('navigation quotes never reserve supplies and exploration still costs two wheat only on explicit departure', async () => {
  await withPanel(render => {
    let farm = createFarm(); farm.boatOwned = true; farm.produce.wheat = 10
    sendFerryExpedition(farm,'mill-grain'); endDay(farm); receiveFerryExpedition(farm)
    const before = structuredClone(farm)
    for(let i=0;i<3;i++) {
      assert.match(render(farm), /Выбран рейс «Зерно для пекаря»/)
      assert.match(render(farm,'salt'), /data-action="expedition-send" data-value="explore-salt"/)
    }
    assert.deepEqual(farm,before)
    assert.equal(sendFerryExpedition(farm,'explore-salt').ok,true)
    assert.equal(farm.produce.wheat,4)
    assert.equal(farm.coins,23)
    assert.deepEqual(farm.freight.expeditions.discovered,['mill'])
    assert.doesNotMatch(render(farm), /aria-label="Следующая разведка"/)
    farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!
    endDay(farm)
    assert.deepEqual(farm.freight.expeditions.discovered,['mill'])
    assert.equal(receiveFerryExpedition(farm).ok,true)
    assert.deepEqual(farm.freight.expeditions.discovered,['mill','salt'])
    const received = structuredClone(farm)
    assert.equal(receiveFerryExpedition(farm).ok,false)
    assert.deepEqual(farm,received)
  })
})
