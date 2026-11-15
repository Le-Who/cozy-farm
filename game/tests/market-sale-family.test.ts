import assert from 'node:assert/strict'
import { test } from 'node:test'
import { marketFamilyId, marketFamilyLabel, marketSaleFamilies } from '../src/market-sale-family.ts'
import { searchMarketSales } from '../src/market-sale-search.ts'
import { createFarm,getMarketStock,sellMarketItem,variantLabel } from '../src/farm.ts'

test('semantic families group ordinary and exact rare identities, never similarly named dishes',()=>{
 for(const key of ['fruit:apple','variants:apple:rainbow'])assert.equal(marketFamilyId(key),'fruit:apple')
 for(const key of ['produce:carrot','variants:carrot:dew'])assert.equal(marketFamilyId(key),'produce:carrot')
 for(const key of ['eggs','variants:egg:star'])assert.equal(marketFamilyId(key),'eggs')
 assert.equal(marketFamilyId('dishes:appleJam'),undefined);assert.equal(marketFamilyId('fish:perch'),undefined)
 assert.equal(marketFamilyLabel('fruit:apple'),'Яблоко');assert.equal(marketFamilyLabel('unknown'),undefined);assert.equal(marketFamilyLabel('__proto__'),undefined)
})
test('family and search compose without mutating or dropping rarity/count/price; category stays authoritative',()=>{
 const rows=[{key:'fruit:apple',name:'Яблоко',count:24,price:4,group:'harvest'},...(['dew','frost','rainbow','star'] as const).map(trait=>({key:`variants:apple:${trait}`,name:variantLabel('apple',trait).name,count:12,price:8,group:'harvest'})),{key:'dishes:appleJam',name:'Яблочное варенье',count:2,price:14,group:'kitchen'}]
 const before=structuredClone(rows),families=marketSaleFamilies(rows)
 assert.deepEqual(families,[{id:'fruit:apple',label:'Яблоко',rows:5}])
 assert.deepEqual(searchMarketSales(rows,'harvest','','fruit:apple').items,rows.slice(0,5))
 assert.equal(searchMarketSales(rows,'harvest','радуж','fruit:apple').items[0],rows[3])
 assert.deepEqual(searchMarketSales(rows,'harvest','морк','fruit:apple'),{total:5,items:[]})
 assert.equal(searchMarketSales(rows,'kitchen','','fruit:apple').items[0],rows[5]);assert.deepEqual(rows,before)
})
test('partial/exhausted rare-only family remains selected and empty instead of falling onto another product',()=>{
 const farm=createFarm();farm.variants.apple={rainbow:2};farm.produce.carrot=4
 const rows=()=>getMarketStock(farm).map(item=>({...item,name:item.key,group:'harvest'}))
 const family='fruit:apple',key='variants:apple:rainbow',before=structuredClone(farm)
 assert.equal(searchMarketSales(rows(),'harvest','',family).items[0].key,key);assert.deepEqual(farm,before)
 assert.ok(sellMarketItem(farm,key,1).ok);assert.equal(searchMarketSales(rows(),'harvest','',family).items[0].count,1)
 assert.ok(sellMarketItem(farm,key,1).ok);assert.deepEqual(searchMarketSales(rows(),'harvest','',family),{total:0,items:[]})
 assert.deepEqual(marketSaleFamilies(rows(),family).find(item=>item.id===family),{id:family,label:'Яблоко',rows:0})
 assert.equal(farm.produce.carrot,4);assert.equal(marketSaleFamilies(rows(),'bogus').some(item=>item.id==='bogus'),false)
})
