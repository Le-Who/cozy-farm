import assert from 'node:assert/strict'
import test from 'node:test'
import { createFarm, feedChickens, restoreCurrentFarm } from '../src/farm.ts'
import { mixChickenFeed, renderChickenFeedMixes } from '../src/chicken-feed.ts'
import { ActionClickGuard, isGuardedAction } from '../src/action-click-guard.ts'

function ready() { const f = createFarm(); f.buildingLevels.coop = 2; f.produce.wheat = 2; f.produce.carrot = 1; f.fruit.apple = 1; return f }

test('choice keeps one panel title, exact visual costs, result and separate feeding', () => {
 const f = ready(), before = structuredClone(f)
 const html = renderChickenFeedMixes(f, name => `<img data-icon="${name}">`)
 assert.deepEqual(f, before)
 assert.equal((html.match(/class="feed-choice-card"/g) ?? []).length, 2)
 assert.doesNotMatch(html, /<h2>Корм/)
 assert.match(html, /Пшеница ×1/); assert.match(html, /Морковь ×1/); assert.match(html, /Яблоко ×1/)
 assert.match(html, new RegExp(`Запас: ${f.feed} → ${f.feed + 3}`))
 assert.match(html, new RegExp(`Запас: ${f.feed} → ${f.feed + 4}`))
 assert.match(html, /Смешивание не кормит стаю/)
 assert.match(html, /data-action="back">К курятнику/)
 assert.match(html, /<details class="feed-choice-notes"><summary>О корме/)
 assert.match(html, /data-icon="wheat"/); assert.match(html, /data-icon="carrot"/); assert.match(html, /data-icon="apple"/)
})

test('missing ingredient is named at its choice, with no impossible total or enabled spend', () => {
 const f = ready(); f.fruit.apple = 0
 const html = renderChickenFeedMixes(f).split('aria-label="Садовая смесь"')[1]
 assert.match(html, /Яблоко ×1<\/strong><small>Нет в запасе/); assert.doesNotMatch(html, /Нужны:/)
 assert.match(html, /data-value="orchard"[^>]* disabled/)
 assert.doesNotMatch(html, /Запас: /)
 const before = structuredClone(f); assert.equal(mixChickenFeed(f, 'orchard').ok, false); assert.deepEqual(f, before)
})

function mixButtons(f: ReturnType<typeof createFarm>) {
 return [...renderChickenFeedMixes(f).matchAll(/<button[^>]+data-action="mix-chicken-feed" data-value="(garden|orchard)"([^>]*)>/g)]
   .map(([,value,attrs]) => ({ value, disabled: /\bdisabled\b/.test(attrs) }))
}

test('the mix you can make is listed first with both choices still present and ties in familiar order', () => {
 for (const [carrot,apple,order] of [
   [0,1,['orchard','garden']], [1,0,['garden','orchard']],
   [1,1,['garden','orchard']], [0,0,['garden','orchard']],
 ] as const) {
  const f=ready(); f.produce.carrot=carrot; f.fruit.apple=apple
  const before=structuredClone(f), buttons=mixButtons(f)
  assert.deepEqual(buttons.map(button=>button.value),order)
  assert.deepEqual(buttons.map(({value,disabled})=>[value,disabled]),order.map(value=>[value,value==='garden'?carrot===0:apple===0]))
  assert.deepEqual(f,before)
 }
})

test('after the first mix runs out, the other moves up but the same fast pointer gesture cannot buy it', () => {
 const f=ready(), guard=new ActionClickGuard()
 const clickLeading=(timeStamp:number,detail:number)=>{
  const action='mix-chicken-feed',event={timeStamp,detail,clientX:230,clientY:220},btn=mixButtons(f)[0]
  if (btn.disabled || guard.blocks(event)) return false
  if (isGuardedAction(action)) guard.remember(event)
  return mixChickenFeed(f,btn.value).ok
 }
 assert.equal(clickLeading(1000,1),true)
 assert.deepEqual(mixButtons(f),[{value:'orchard',disabled:false},{value:'garden',disabled:true}])
 const after=structuredClone(f)
 assert.equal(clickLeading(1120,2),false); assert.deepEqual(f,after)
 assert.equal(clickLeading(1601,1),true); assert.equal(f.feed,after.feed+4)
})

test('one deliberate mix changes only original stock/work; return and feeding remain separate', () => {
 const f = ready(), before = structuredClone(f)
 assert.ok(mixChickenFeed(f, 'garden').ok)
 const expected = structuredClone(before); expected.produce.wheat--; expected.produce.carrot--; expected.feed += 3; expected.workToday++
 assert.deepEqual(f, expected); assert.equal(f.chickensFed, false)
 const html = renderChickenFeedMixes(f); assert.match(html, /Морковь ×1<\/strong><small>Нет в запасе/)
 assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))), f)
 assert.ok(feedChickens(f).ok); assert.equal(f.feed, expected.feed - 1)
 assert.match(renderChickenFeedMixes(f), /Стая уже накормлена/)
})

test('locked coop, away, numeric capacity and rare produce keep their existing boundaries', () => {
 const f = ready(); f.buildingLevels.coop = 1
 assert.doesNotMatch(renderChickenFeedMixes(f), /data-action="mix-chicken-feed"/)
 f.buildingLevels.coop = 2; f.island = 'grove'; assert.equal(renderChickenFeedMixes(f), '')
 f.island = 'home'; f.feed = Number.MAX_SAFE_INTEGER
 assert.equal((renderChickenFeedMixes(f).match(/ disabled/g) ?? []).length, 2)
 f.feed = 0; f.variants = { wheat: { star: 4 }, carrot: { dew: 2 } }
 const rare = structuredClone(f.variants); assert.ok(mixChickenFeed(f, 'garden').ok); assert.deepEqual(f.variants, rare)
})
