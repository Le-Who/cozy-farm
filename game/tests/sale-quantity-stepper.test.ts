import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stepSaleQuantity, exactSaleQuote, saleStock } from '../src/exact-sale.ts'
import { createFarm, sellMarketItem } from '../src/farm.ts'

test('quantity shortcuts stay within current stock, recover invalid drafts and never mutate inventory',()=>{
 const farm=createFarm();farm.fruit.apple=24;farm.variants.apple={rainbow:12};const before=structuredClone(farm)
 assert.equal(stepSaleQuantity('1',12,'less'),'1');assert.equal(stepSaleQuantity('1',12,'more'),'2')
 assert.equal(stepSaleQuantity('2',12,'all'),'12');assert.equal(stepSaleQuantity('12',12,'more'),'12')
 assert.equal(stepSaleQuantity('12',12,'less'),'11');assert.equal(stepSaleQuantity('999',12,'more'),'12')
 for(const invalid of ['', '-1', '2.5','1e2','Infinity','NaN']){assert.equal(stepSaleQuantity(invalid,12,'more'),'1');assert.equal(stepSaleQuantity(invalid,12,'all'),'12')}
 for(const missing of [0,-1,NaN,Infinity])assert.equal(stepSaleQuantity('1',missing,'all'),'')
 assert.deepEqual(farm,before)
})
test('all means the exact selected rare stock, independent of ordinary siblings; confirmation remains separate',()=>{
 const farm=createFarm();farm.fruit.apple=24;farm.variants.apple={rainbow:12};const target={kind:'market' as const,key:'variants:apple:rainbow'}
 const stock=saleStock(farm,target)!,before=structuredClone(farm);const raw=stepSaleQuantity('1',stock.count,'all')
 assert.equal(raw,'12');assert.deepEqual(farm,before);const quote=exactSaleQuote(raw,stock.count,stock.price);assert.ok(quote.valid)
 assert.ok(sellMarketItem(farm,target.key,quote.quantity).ok);assert.equal(farm.fruit.apple,24);assert.equal(farm.variants.apple?.rainbow??0,0)
 assert.equal(exactSaleQuote(raw,saleStock(farm,target)?.count??0,stock.price).valid,false)
})
