import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { createFarm, endDay, getBedAction, getBedHarvestPreview, getFairGuest, restoreCurrentFarm, sellMarketItem, serveFairGuest, workBed, type FarmState, type ActionResult } from '../src/farm.ts'
import { getRestPreview } from '../src/rest-preview.ts'
import { renderRestPreview } from '../src/rest-preview-ui.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

type Command<Args extends unknown[]> = (farm: FarmState, ...args: Args) => ActionResult
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8')) as {name:string;args:unknown[]}[]
const bed = 13
const load = (farm: FarmState) => restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
function beforeFinn(earlyWheat = false) {
  const p = commissionPlayer(fixtures.slice(0, fixtures.findIndex(step => step.name === 'serveFairGuest') + 1))
  while (p.state.day < 8) p.night()
  if (earlyWheat) {
    p.act('selectSeed', 'wheat'); p.act('workBed', 4, 0); p.act('workBed', 4, 0)
  }
  p.night()
  p.act('selectSeed', 'cabbage'); p.act('workBed', 0, 0)
  p.act('selectSeed', 'wheat'); p.act('workBed', bed, 0)
  assert.equal(p.state.beds[bed].kind === 'crop' && p.state.beds[bed].watered, true, 'Day 9 rain watered both plantings')
  p.night()
  assert.deepEqual([p.actions, p.state.day, p.state.fairGuestsServed, p.state.produce.wheat, p.state.coins], [earlyWheat ? 69 : 66, 10, 1, 1, 120])
  assert.deepEqual(getRestPreview(p.state).dry[0], { index: 0, crop: 'cabbage' })
  assert.ok(getRestPreview(p.state).dry.some(entry => entry.index === bed))
  const next = getFairGuest({ ...p.state, day: 11 })!
  assert.deepEqual([next.name, next.item, next.reward], ['Финн', {kind:'produce',item:'wheat',quantity:3}, 15])
  assert.equal(p.state.freight.warehouses.home.wheat ?? 0, 0)
  return p
}
function branch(saved: FarmState) {
  let farm = load(saved)
  return { get farm() { return farm }, act<Args extends unknown[]>(command: Command<Args>, ...args: Args) {
    const receipt = command(farm, ...args)
    assert.ok(receipt.ok, receipt.message)
    farm = load(farm)
    return receipt
  }}
}

test('after choosing to water or sleep on the same earned save, the recurring Finn reward is unchanged but Day 11 vs Day 15', () => {
  const start = beforeFinn().state, prep = branch(start), wait = branch(start), sell = branch(start)
  assert.deepEqual(prep.farm, wait.farm, 'both branches use the exact same saved farm before choosing')
  for (const route of [prep, sell]) {
    route.act(workBed, bed, 0); route.act(endDay)
    assert.equal(route.farm.day, 11)
    assert.deepEqual(getBedHarvestPreview(route.farm, bed), { crop:'wheat',total:3,ordinary:2,special:1,trait:'star',picnicBonus:0 })
    route.act(workBed, bed, 0)
  }
  prep.act(serveFairGuest)
  const result = [prep.farm.produce.wheat, prep.farm.coins, prep.farm.seeds.leafyGreens, prep.farm.fairGuestsServed]
  assert.deepEqual(result, [0, 135, start.seeds.leafyGreens + 2, 2])
  assert.equal(prep.farm.variants.wheat?.star, (start.variants.wheat?.star ?? 0) + 1)
  sell.act(sellMarketItem, 'produce:wheat', 3)
  assert.equal(sell.farm.coins - start.coins, 12)
  assert.equal(sell.farm.seeds.leafyGreens, start.seeds.leafyGreens)
  assert.equal(sell.farm.variants.wheat?.star, prep.farm.variants.wheat?.star)
  wait.act(endDay)
  assert.equal(wait.farm.day, 11)
  assert.equal(getBedAction(wait.farm, bed).kind, 'water')
  const beforeRefusal = structuredClone(wait.farm)
  assert.equal(serveFairGuest(wait.farm).ok, false); assert.deepEqual(wait.farm, beforeRefusal)
  wait.act(workBed, bed, 0);wait.act(endDay); assert.equal(wait.farm.day, 12)
  wait.act(workBed, bed, 0)
  assert.equal(getFairGuest(wait.farm)?.name, 'Беа')
  while (wait.farm.day < 15) wait.act(endDay)
  wait.act(serveFairGuest)
  assert.deepEqual([wait.farm.produce.wheat, wait.farm.coins, wait.farm.seeds.leafyGreens, wait.farm.fairGuestsServed], result)
  assert.equal(wait.farm.variants.wheat?.star, prep.farm.variants.wheat?.star)
})

test('real home forecast points to the wheat bed before sleep and its existing control only focuses', () => {
  const farm = beforeFinn().state, saved = structuredClone(farm), html = renderRestPreview(farm, true)
  const button = html.match(/<button[^>]*data-fair-crop-prep[^>]*data-action="focus-bed" data-value="(\d+)"[^>]*>([^<]+)<\/button>/)
  assert.equal(button?.[1], String(bed), 'the optional home route must reach the crop that can cover tomorrow, not generic cabbage bed 0')
  assert.match(button?.[2] ?? '', /К грядке · полить сегодня/)
  assert.match(html, /Финн завтра/)
  assert.match(html, /data-action="focus-bed" data-value="0"/, 'unrelated ordinary care remains available')
  assert.ok(html.indexOf('data-fair-crop-prep') < html.indexOf('rest-preview-stats'), 'the one-window choice precedes the generic garden summary')
  assert.ok(html.indexOf('data-fair-crop-prep') < html.indexOf('<details'), 'the one-window choice precedes the generic optional list')
  const css = readFileSync(new URL('../src/rest-preview.css', import.meta.url), 'utf8')
  assert.match(css, /\.rest-fair-prep\{[^}]*flex-wrap:wrap/)
  assert.match(css, /\.rest-preview .dialog-button\{[^}]*min-height:44px/)
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
  const from = main.indexOf("    case 'focus-bed':"), to = main.indexOf("    case 'travel-panel':", from)
  assert.ok(from >= 0 && to > from)
  const actions:unknown[] = []
  runInNewContext(stripTypeScriptTypes("switch(action){" + main.slice(from, to) + "}"),
    { action:'focus-bed', value:button![1],closeDialog(){actions.push('close')}, island:{focusTarget(target:unknown){actions.push(JSON.stringify(target))}} })
  assert.deepEqual(actions, ['close', JSON.stringify({kind:'bed',index:bed})])
  assert.deepEqual(farm, saved, 'opening, rendering and focusing spend neither water, stock nor a day')
  assert.equal(renderRestPreview(load(farm),true),html)
  assert.doesNotMatch(renderRestPreview(createFarm(),true),/data-fair-crop-prep/)
})

test('a free ready crop or spendable local warehouse wins over watering; a different shore does not count as local', () => {
  const p = beforeFinn(true)
  assert.ok(getBedHarvestPreview(p.state, 4)?.ordinary! >= 2)
  const shown = () => renderRestPreview(p.state, true)
  assert.doesNotMatch(shown(), /data-fair-crop-prep/, 'a second, already ripe, wheat bed fills the request')
  p.act('workBed', 4, 0)
  const grown = p.state.produce.wheat
  assert.ok(grown >= 3)
  assert.doesNotMatch(shown(), /data-fair-crop-prep/, 'ready bag stock needs no prep')
  p.act('transferBayGoods', 'deposit', 'home', 'wheat', grown - 1)
  assert.equal(p.state.produce.wheat, 1)
  assert.doesNotMatch(shown(), /data-fair-crop-prep/, 'local warehouse is a cheaper equivalent')
  p.act('transferBayGoods', 'withdraw', 'home', 'wheat', grown - 1)
  p.visit('grove')
  p.act('transferBayGoods', 'deposit', 'grove', 'wheat', grown - 1)
  assert.doesNotMatch(shown(), /data-fair-crop-prep/, 'no evening crop action away from the farm')
  p.visit('home')
  assert.match(shown(), /data-fair-crop-prep/, 'remote reserve does not masquerade as ready local stock')
  assert.equal(p.state.produce.wheat,1)
})

test('a watered bed, an insufficient ordinary yield, or an empty can adds no extra shortcut', () => {
  const p = beforeFinn(), farm = p.state
  assert.equal(farm.beds[bed].kind === 'crop' && farm.beds[bed].trait, 'star')
  assert.match(renderRestPreview(farm,true), /data-fair-crop-prep/)
  assert.doesNotMatch(renderRestPreview({...farm,water:0},true), /data-fair-crop-prep/)
  const next = branch(farm)
  next.act(workBed,bed,0)
  assert.doesNotMatch(renderRestPreview(next.farm,true), /data-fair-crop-prep/, 'already watered: tomorrow is covered')
  const sold = branch(farm)
  sold.act(sellMarketItem,'produce:wheat',1)
  assert.equal(sold.farm.produce.wheat,0)
  assert.doesNotMatch(renderRestPreview(sold.farm,true), /data-fair-crop-prep/, 'the rare produce does not meet an ordinary shortage')
})
