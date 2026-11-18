import test from 'node:test'
import assert from 'node:assert/strict'
import {createFarm} from '../src/farm.ts'
import {renderChickenFeedMixes} from '../src/chicken-feed.ts'

function ready(){const f=createFarm();f.buildingLevels.coop=2;f.produce.wheat=1;f.produce.carrot=0;f.fruit.apple=1;return f}

test('ordinary shortage is identified without removing its named ingredient, cost, result or action',()=>{
 const f=ready(),before=structuredClone(f),html=renderChickenFeedMixes(f)
 assert.match(html,/Морковь ×1<\/strong><small>Нет в запасе/)
 assert.match(html,/Пшеница ×1<\/strong><small>Есть 1 → 0/)
 assert.match(html,/3 порции<\/strong><\/div>/); assert.doesNotMatch(html,/Нужны:/)
 assert.match(html,/4 порции<\/strong><span>Запас: 2 → 6/)
 assert.match(html,/data-value="garden"[^>]* disabled/)
 assert.match(html,/data-value="orchard"[^>]*>Смешать/)
 assert.match(html,/data-action="back">К курятнику/);assert.deepEqual(f,before)
})

test('capacity warnings remain on both results even when ingredients are also missing',()=>{
 for(const capacity of ['feed','workToday'] as const){
  const f=ready();f[capacity]=Number.MAX_SAFE_INTEGER;f.produce.wheat=0;f.fruit.apple=0
  const before=structuredClone(f),html=renderChickenFeedMixes(f)
  assert.equal((html.match(/Нет места для новой смеси/g)||[]).length,2)
  assert.deepEqual(f,before)
 }
})

test('when both recipes lack both ingredients each card states each shortage once in its cost list',()=>{
 const f=ready();f.produce.wheat=0;f.fruit.apple=0
 const cards=renderChickenFeedMixes(f).match(/<article[^>]*>[\s\S]*?<\/article>/g) ?? []
 assert.equal(cards.length,2)
 for(const [i,card] of cards.entries()){
  const extra=i===0?'Морковь':'Яблоко'
  assert.match(card,/<ul class="feed-choice-cost" aria-label="Расход обычных продуктов">/)
  for(const name of ['Пшеница',extra]){
   assert.match(card,new RegExp(name+' ×1</strong><small>Нет в запасе'))
   assert.equal(card.toLowerCase().split(name.toLowerCase()).length-1,1)
  }
  assert.match(card,/data-action="mix-chicken-feed"[^>]* disabled/)
 }
})
