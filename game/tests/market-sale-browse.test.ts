import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MarketSaleBrowseMemory } from '../src/market-sale-browse.ts'
import { marketSaleFamilies } from '../src/market-sale-family.ts'
import { searchMarketSales } from '../src/market-sale-search.ts'

const start = {family:undefined,scroll:0}
test('each named group returns to its own exact family and item-grid position',()=>{
 const browse=new MarketSaleBrowseMemory(), raspberry={family:'produce:raspberry',scroll:566}
 assert.deepEqual(browse.change('harvest','shore',raspberry),start)
 assert.deepEqual(browse.change('shore','harvest',{family:undefined,scroll:219}),raspberry)
 assert.deepEqual(browse.change('harvest','kitchen',raspberry),start)
 assert.deepEqual(browse.change('kitchen','shore',{family:undefined,scroll:88}),{family:undefined,scroll:219})
 assert.deepEqual(browse.change('shore','kitchen',{family:undefined,scroll:220}),{family:undefined,scroll:88})
})
test('explicit All clears every remembered family and position; repeated group retains current view',()=>{
 const browse=new MarketSaleBrowseMemory(), apple={family:'fruit:apple',scroll:42}
 assert.deepEqual(browse.change('harvest','harvest',apple),apple)
 assert.deepEqual(browse.change('harvest','all',apple),start)
 assert.deepEqual(browse.change('all','harvest',{family:undefined,scroll:120}),start)
})
test('a new search, Clear, or a new dialog session invalidates old browse positions',()=>{
 const browse=new MarketSaleBrowseMemory()
 browse.change('harvest','shore',{family:'produce:raspberry',scroll:566})
 browse.reset()
 assert.deepEqual(browse.change('shore','harvest',start),start)
})
test('return keeps an exhausted semantic family empty, never a neighboring product',()=>{
 const browse=new MarketSaleBrowseMemory(), exhausted={family:'fruit:apple',scroll:32}
 const stock=[{key:'produce:carrot',name:'Морковь',count:4,group:'harvest'}],before=structuredClone(stock)
 browse.change('harvest','shore',exhausted)
 const returned=browse.change('shore','harvest',start)
 assert.deepEqual(returned,exhausted)
 assert.deepEqual(searchMarketSales(stock,'harvest','',returned.family),{total:0,items:[]})
 assert.deepEqual(marketSaleFamilies(stock,returned.family).find(x=>x.id===returned.family),{id:'fruit:apple',label:'Яблоко',rows:0})
 assert.deepEqual(stock,before)
})
test('remembered positions are detached from callers and never include inventory or persistence',()=>{
 const browse=new MarketSaleBrowseMemory(), view={family:'eggs',scroll:67}
 browse.change('harvest','shore',view);view.scroll=900
 const returned=browse.change('shore','harvest',start);assert.equal(returned.scroll,67)
 returned.scroll=0
 assert.equal(browse.change('shore','harvest',start).scroll,67)
})
const view = {island:'home', group:'harvest' as const, family:'produce:carrot', query:'радуж'}
test('a closed Sell grid resumes once and only for the exact island, group, family and search', () => {
  const memory = new MarketSaleBrowseMemory()
  for (const change of [{query:'морковь'},{group:'all' as const},{family:undefined},{island:'grove'}]) {
    memory.rememberClosed(view,436)
    assert.equal(memory.takeClosed({...view,...change}),undefined)
    assert.equal(memory.takeClosed(view),undefined,'a mismatch consumes the old position')
  }
  memory.rememberClosed(view,436)
  assert.equal(memory.takeClosed({...view}),436)
  assert.equal(memory.takeClosed(view),undefined)
})
test('fresh unrelated navigation or explicit reset drops closed position without changing live group memory semantics',()=> {
  const memory=new MarketSaleBrowseMemory()
  memory.change('harvest','shore',{family:view.family,scroll:212})
  memory.rememberClosed(view,436)
  assert.deepEqual(memory.change('shore','harvest',{family:undefined,scroll:70}),{family:view.family,scroll:212})
  memory.reset()
  assert.equal(memory.takeClosed(view),undefined)
  assert.deepEqual(memory.change('shore','harvest',{family:undefined,scroll:0}),{family:undefined,scroll:0})
})
