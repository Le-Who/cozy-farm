import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createFarm} from '../src/farm.ts'
import {renderChickenFeedMixes} from '../src/chicken-feed.ts'

function ready(){const f=createFarm();f.buildingLevels.coop=2;f.produce.wheat=1;f.produce.carrot=0;f.fruit.apple=1;return f}

test('ordinary shortage is identified without removing its named ingredient, cost, result or action',()=>{
 const f=ready(),before=structuredClone(f),html=renderChickenFeedMixes(f)
 assert.match(html,/data-feed-shortage="true" aria-label="Огородная смесь"/)
 assert.match(html,/data-feed-shortage="false" aria-label="Садовая смесь"/)
 assert.match(html,/Морковь ×1<\/strong><small>Нет в запасе/)
 assert.match(html,/Пшеница ×1<\/strong><small>Есть 1 → 0/)
 assert.match(html,/3 порции<\/strong><span>Нужны: морковь/)
 assert.match(html,/4 порции<\/strong><span>Запас: 2 → 6/)
 assert.match(html,/data-value="garden"[^>]* disabled/)
 assert.match(html,/data-value="orchard"[^>]*>Смешать/)
 assert.match(html,/data-action="back">К курятнику/);assert.deepEqual(f,before)
})

test('capacity warnings are never marked as removable ingredient shortages',()=>{
 for(const capacity of ['feed','workToday'] as const){
  const f=ready();f[capacity]=Number.MAX_SAFE_INTEGER;f.produce.wheat=0;f.fruit.apple=0
  const before=structuredClone(f),html=renderChickenFeedMixes(f)
  assert.equal((html.match(/data-feed-shortage="false"/g)||[]).length,2)
  assert.equal((html.match(/Нет места для новой смеси/g)||[]).length,2)
  assert.doesNotMatch(html,/data-feed-shortage="true"/);assert.deepEqual(f,before)
 }
})

test('production feed CSS hides only duplicate shortages in the existing short-landscape breakpoint',()=>{
 const css=readFileSync(new URL('../src/chicken-feed.css',import.meta.url),'utf8')
 const short=css.slice(css.indexOf('@media(min-width:461px) and (max-height:480px)'))
 const rule='.feed-choice-card[data-feed-shortage="true"] .feed-choice-result>span{display:none}'
 assert.ok(short.includes(rule));assert.equal(css.split(rule).length-1,1)
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 assert.doesNotMatch(main,/feedCompact|compactFeedShortages|chicken-feed-shortages-dev/)
 assert.match(main,/renderChickenFeedMixes\(farm, icon\)/)
})
