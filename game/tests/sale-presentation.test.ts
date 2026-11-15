import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SalePresentation, saleRowKeys } from '../src/sale-presentation.ts'
const ordinary={kind:'market' as const,key:'fruit:apple'}, rare={kind:'market' as const,key:'variants:apple:rainbow'}
test('product and revision own controls, never ordinal position or previous draft',()=>{
 const view=new SalePresentation();view.open(rare,{index:2,scroll:420});const stale=view.token
 assert.ok(view.accepts(stale,rare));assert.equal(view.accepts(stale,ordinary),false)
 view.open(ordinary,{index:2,scroll:420});assert.equal(view.accepts(stale,ordinary),false);assert.equal(view.accepts(stale,rare),false);assert.ok(view.accepts(view.token,ordinary))
 const old=view.token;view.open(ordinary,{index:2,scroll:420});assert.equal(view.accepts(old,ordinary),false)
})
test('filter/tab/close reset invalidates controls; detached selection metadata cannot retarget them',()=>{
 const view=new SalePresentation(),place={index:1,scroll:120};view.open(rare,place);const token=view.token;place.index=3
 assert.deepEqual(view.place,{index:1,scroll:120});view.reset();assert.equal(view.accepts(token,rare),false);assert.equal(view.place,undefined)
 view.open(rare);assert.equal(view.place,undefined);assert.ok(view.accepts(view.token,rare));assert.equal(view.accepts(token,rare),false)
})
test('partial rows keep exact keys, exhausted receipt keeps its old place without replacing any product',()=>{
 const keys=['produce:wheat',rare.key,ordinary.key],before=[...keys],place={index:1,scroll:90}
 assert.deepEqual(saleRowKeys(keys,rare.key,place,false),keys)
 assert.deepEqual(saleRowKeys(['produce:wheat',ordinary.key],rare.key,place,true),keys)
 assert.deepEqual(saleRowKeys([],rare.key,place,true),[rare.key])
 assert.deepEqual(saleRowKeys([ordinary.key],rare.key,place,false),[ordinary.key]);assert.deepEqual(keys,before)
})
