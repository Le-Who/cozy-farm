import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createFarm, getMarketStock, cropIds, treeIds, cropDefinitions, treeDefinitions, variantLabel } from '../src/farm.ts'
import { traitIds } from '../src/climate.ts'
import { groupHarvestStocks, renderHarvestStocks, type InventoryStockEntry } from '../src/inventory-harvest.ts'

function stock(f= createFarm()):InventoryStockEntry[]{return getMarketStock(f).filter(s=>s.count>0).map(s=>{
 const i=s.item,label=i.kind==='variants'?variantLabel(i.item,i.trait):i.kind==='produce'?{name:cropDefinitions[i.item].name,image:i.item}:i.kind==='fruit'?{name:treeDefinitions[i.item].name,image:i.item}:i.kind==='eggs'?{name:'Яйцо',image:'egg'}:{name:i.kind,image:i.kind}
 return {...s,...label,trait:i.kind==='variants'?i.trait:undefined}
})}
const art=(name:string,trait?:string)=>`<i data-art="${name}" data-trait="${trait??''}"></i>`

test('all ordinary and rare quantities stay separate and exact, without changing input',()=>{
 const f=createFarm();for(const id of cropIds){f.produce[id]=110;f.variants[id]={dew:2,frost:3,rainbow:4,star:5}}for(const id of treeIds){f.fruit[id]=55;f.variants[id]={star:7}}f.eggs=142;f.variants.egg={rainbow:3};f.honey=8
 const entries=stock(f),before=structuredClone(entries),groups=groupHarvestStocks(entries)
 const lines=groups.flatMap(g=>g.kind==='other'?[g.entry]:[...(g.ordinary?[g.ordinary]:[]),...g.variants])
 assert.deepEqual(lines.map(({key,count})=>({key,count})).sort((a,b)=>a.key.localeCompare(b.key)),entries.map(({key,count})=>({key,count})).sort((a,b)=>a.key.localeCompare(b.key)))
 assert.deepEqual(entries,before);assert.equal(groups.filter(g=>g.kind==='resource').length,cropIds.length+treeIds.length+1)
 for(const group of groups)if(group.kind==='resource')assert.equal(new Set(group.variants.map(v=>v.trait)).size,group.variants.length)
})

test('rare-only stock says ordinary absent, displays every trait without an accordion or pooled total',()=>{
 const f=createFarm();f.variants.carrot={dew:12,frost:34,rainbow:56,star:78}
 const entries=stock(f).map(({trait,...entry})=>entry),before=structuredClone(f),html=renderHarvestStocks(entries,art,()=>'<li>other</li>')
 assert.match(html,/Обычных нет/);assert.doesNotMatch(html,/data-stock-key="produce:carrot"/)
 for(const trait of traitIds){assert.ok(html.includes(`data-stock-key="variants:carrot:${trait}"`));assert.ok(html.includes(`aria-label="${variantLabel('carrot',trait).name}, ${f.variants.carrot[trait]}"`))}
 assert.equal((html.match(/data-stock-count=/g)??[]).length,4)
 assert.match(html,/data-trait="star"/)
 assert.doesNotMatch(html,/<details|Итого|Всего/);assert.deepEqual(f,before)
})

test('ordinary-only items and unrelated action-bearing rows retain their own exact identity',()=>{
 const f=createFarm();f.produce.wheat=123456;f.fish.perch=2;f.eggBaskets=1
 const entries=stock(f),otherCalls:string[]=[]
 const html=renderHarvestStocks(entries,art,entry=>{otherCalls.push(entry.key);return `<li data-stock-key="${entry.key}"><button data-existing-action="${entry.item.kind}">same action</button></li>`},'<li id="feed">2 порции</li>','<li id="sapling">×3</li>')
 assert.match(html,/data-stock-key="produce:wheat" data-stock-count="123456"/);assert.match(html,/×123456/)
 assert.deepEqual(otherCalls,['fish:perch','eggBaskets'])
 assert.match(html,/data-existing-action="fish"/);assert.match(html,/data-existing-action="eggBaskets"/)
 assert.ok(html.indexOf('id="feed"')<html.indexOf('data-stock-resource'));assert.ok(html.indexOf('id="sapling"')>html.indexOf('data-stock-resource'))
})

test('zero quantities are not invented as rare entries and empty input keeps ancillary stock',()=>{
 const f=createFarm();f.variants.egg={star:0}
 assert.deepEqual(groupHarvestStocks(stock(f)),[])
 assert.match(renderHarvestStocks([],art,()=>'', '<li>Корм 0</li>'),/Корм 0/)
})

test('inventory-only composition retains existing fish/unpack actions and explicit home kitchen navigation',()=>{
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 const rows=main.slice(main.indexOf('function inventoryStockRow'),main.indexOf('function inventorySupplies'))
 for(const action of ['fish-kitchen','sell-item','fish-market','unpack-egg-basket','unpack-egg-crate'])assert.ok(rows.includes(`'${action}'`))
 const inventory=main.slice(main.indexOf('function inventorySupplies'),main.indexOf('function specializationCards'))
 assert.match(inventory,/farm.island==='home'&&inventoryGroup==='harvest'/);assert.match(inventory,/button\('На кухню','kitchen'/)
 assert.match(inventory,/stock.map\(inventoryStockRow\)/);assert.doesNotMatch(inventory,/perform\(|saveFarm\(|sellMarketItem\(/)
})
