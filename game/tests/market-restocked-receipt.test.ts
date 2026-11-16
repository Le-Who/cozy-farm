import assert from 'node:assert/strict'
import test from 'node:test'
import {MarketInlineSales} from '../src/market-inline-sale.ts'
import * as F from '../src/farm.ts'

test('inline draft never spends; invalid, stale and duplicate confirmations are blocked',()=>{
 const ui=new MarketInlineSales(),key='produce:carrot';let v=ui.view(key,10,5)
 assert.equal(v.raw,'1');assert.equal(v.quote.total,5)
 assert.ok(ui.edit(key,v.token,'11',10,5));v=ui.view(key,10,5);assert.equal(ui.take(key,v.token,10,5),undefined)
 assert.ok(ui.edit(key,v.token,'3',10,5));v=ui.view(key,10,5)
 const old=v.token;assert.deepEqual(ui.take(key,v.token,10,5),{quantity:3,total:15,remaining:7})
 assert.equal(ui.take(key,old,10,5),undefined);ui.finish(key,{quantity:3,total:15,remaining:7})
 v=ui.view(key,7,5);assert.equal(ui.take(key,v.token,7,5),undefined)
 assert.ok(ui.rearm(key,v.token,7,5));v=ui.view(key,7,5);assert.equal(v.raw,'1');assert.equal(ui.take(key,v.token,7,5)?.quantity,1)
})
test('live stock/price changes invalidate prior token without silently changing quantity',()=>{
 const ui=new MarketInlineSales();const a=ui.view('fruit:apple',10,3)
 assert.ok(ui.edit('fruit:apple',a.token,'10',10,3));const b=ui.view('fruit:apple',10,3)
 assert.equal(ui.take('fruit:apple',b.token,7,3),undefined);assert.equal(ui.view('fruit:apple',7,3).raw,'10')
 const c=ui.view('fruit:apple',7,3);assert.equal(ui.take('fruit:apple',c.token,7,4),undefined)
})
test('rare/ordinary drafts cannot cross targets; exact reducer and intentional second one remain unchanged',()=>{
 const farm=F.createFarm();farm.fruit.apple=10;farm.variants.apple={rainbow:10};farm.progress.sell=1
 const before=structuredClone(farm),ui=new MarketInlineSales(),key='variants:apple:rainbow'
 const price=F.getMarketStock(farm).find(x=>x.key===key)!.price
 let v=ui.view(key,10,price);const ordinary=ui.view('fruit:apple',10,3)
 assert.equal(ui.edit(key,ordinary.token,'3',10,price),false)
 assert.ok(ui.edit(key,v.token,'3',10,price));v=ui.view(key,10,price);const q=ui.take(key,v.token,10,price)!
 assert.ok(F.sellMarketItem(farm,key,q.quantity).ok);ui.finish(key,q)
 const expected=structuredClone(before);F.sellMarketItem(expected,key,3);assert.deepEqual(farm,expected);assert.equal(farm.fruit.apple,10)
 v=ui.view(key,7,price);assert.ok(ui.rearm(key,v.token,7,price));v=ui.view(key,7,price);const one=ui.take(key,v.token,7,price)!
 assert.equal(one.quantity,1);assert.ok(F.sellMarketItem(farm,key,one.quantity).ok);ui.finish(key,one)
 F.sellMarketItem(expected,key,1);assert.deepEqual(farm,expected)
})
test('quantity stepping is bounded, malformed text is not confirmed, failure can be retried explicitly',()=>{
 const ui=new MarketInlineSales(),key='produce:beet';let v=ui.view(key,1,5)
 assert.ok(ui.step(key,v.token,'more',1,5));v=ui.view(key,1,5);assert.equal(v.raw,'1')
 for(const raw of ['','0','-1','1.5','1e2','9007199254740992']){assert.ok(ui.edit(key,v.token,raw,1,5));v=ui.view(key,1,5);assert.equal(ui.take(key,v.token,1,5),undefined)}
 assert.ok(ui.edit(key,v.token,'1',1,5));v=ui.view(key,1,5);assert.ok(ui.take(key,v.token,1,5));ui.finish(key)
 v=ui.view(key,1,5);assert.ok(ui.take(key,v.token,1,5))
})

test('depleted identity replenished later gets a fresh one-unit draft, never an old receipt or token',()=>{
 const ui=new MarketInlineSales(),key='produce:carrot';let v=ui.view(key,3,2)
 assert.ok(ui.edit(key,v.token,'3',3,2));v=ui.view(key,3,2);const beforeSale=v.token,q=ui.take(key,v.token,3,2)!
 assert.deepEqual(q,{quantity:3,total:6,remaining:0});ui.finish(key,q)
 const exhausted=ui.view(key,0,2);assert.deepEqual(exhausted.receipt,q)
 assert.equal(ui.take(key,beforeSale,2,2),undefined,'retained old control cannot sell new stock')
 const fresh=ui.view(key,2,2);assert.equal(fresh.receipt,undefined);assert.equal(fresh.raw,'1');assert.equal(fresh.pending,false)
 assert.equal(ui.rearm(key,exhausted.token,2,2),false);assert.equal(ui.take(key,exhausted.token,2,2),undefined)
 const one=ui.take(key,fresh.token,2,2);assert.deepEqual(one,{quantity:1,total:2,remaining:1});assert.equal(ui.take(key,fresh.token,2,2),undefined)
 ui.finish(key,one);v=ui.view(key,1,2);assert.equal(v.receipt?.remaining,1);assert.equal(ui.take(key,v.token,1,2),undefined)
 assert.ok(ui.rearm(key,v.token,1,2));v=ui.view(key,1,2);assert.equal(ui.take(key,v.token,1,2)?.quantity,1)
})
test('unchanged depleted stock stays receipted; fresh ordinary stock cannot clear its rare sibling',()=>{
 const ui=new MarketInlineSales(),normal='produce:carrot',rare='variants:carrot:rainbow'
 const finish=(key:string,count:number,price:number)=>{const v=ui.view(key,count,price),q=ui.take(key,v.token,count,price)!;ui.finish(key,q);return q}
 const normalReceipt=finish(normal,1,2),rareReceipt=finish(rare,2,5)
 assert.deepEqual(ui.view(normal,0,2).receipt,normalReceipt);assert.deepEqual(ui.view(normal,0,3).receipt,normalReceipt)
 assert.equal(ui.view(normal,3,2).receipt,undefined)
 const sibling=ui.view(rare,1,5);assert.deepEqual(sibling.receipt,rareReceipt);assert.equal(ui.take(rare,sibling.token,1,5),undefined)
})
