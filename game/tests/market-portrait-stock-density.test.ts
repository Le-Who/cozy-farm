import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {MarketInlineSales,inlineReceiptText} from '../src/market-inline-sale.ts'
import {searchMarketSaleView} from '../src/market-sale-search.ts'
import {shellDefinitions} from '../src/tide.ts'
import {shoalDefinitions} from '../src/shoal.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'

const file=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const css=file('../src/market-sale-grid.css')
const main=file('../src/main.ts')
function section(a:string,b:string){
  const i=main.indexOf(a),j=main.indexOf(b,i+a.length)
  assert.ok(i>=0&&j>i,a)
  return main.slice(i,j)
}
const renderer=stripTypeScriptTypes([
  section('function goods()','function fishImage('),
  section('function stockLabel(','function stockTile('),
  section('function marketSaleSearchView()','function marketSaleSearchStatus()'),
  section('function marketInlineCard(','function inlineSaleContext(')
].join('\n'))
const escapeHtml=(s:string)=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!))
const icon=()=>'<i class="icon" aria-hidden="true"></i>'
function earnedSale(){
  const p=earned416Mixed(false), farm=p.state
  assert.deepEqual([p.actions,farm.day,F.getSale(farm).items],[543,193,416])
  const sales=new MarketInlineSales(), sprites=new Proxy({},{get:()=>''})
  const scope={
    ...F,farm,marketInlineSales:sales,marketSellGroup:'harvest',marketSaleQuery:'',marketSaleFamily:undefined,marketSaleBrowse:{crossCategorySearch:true},
    searchMarketSaleView,fishImage:()=>'',pastryIcons:sprites,dishIcons:sprites,shellDefinitions,shoalDefinitions,icon,itemIcon:icon,
    quantity:(n:number,noun:string)=>`${n} ${noun}`,escapeHtml,numberFormat:new Intl.NumberFormat('ru-RU'),inlineReceiptText
  }
  runInNewContext(renderer,scope)
  const read=(query:string)=>runInNewContext(query,scope) as string
  const markup=()=>read('marketSaleResults()')
  const apple=()=>read('marketInlineCard(goods().find(row=>row.key==="fruit:apple"))')
  return {farm,sales,apple,markup}
}

test('portrait Sell has a compact second-line action, but keeps DOM order, feedback, targets and nonportrait rules',()=>{
  const m=/@media\(max-width:600px\) and \(orientation:portrait\)\{\n([\s\S]*?)^\}/m.exec(css)
  assert.ok(m,'compact stock rows must be portrait-specific')
  const portrait=m[1]
  assert.match(portrait,/\.market-inline-card\{grid-template-columns:56px minmax\(0,1fr\);grid-template-rows:minmax\(56px,auto\) auto;row-gap:0\}/)
  assert.match(portrait,/\.market-inline-status\{min-height:0;overflow-wrap:anywhere\}/)
  assert.match(portrait,/\.market-inline-status:not\(:empty\)\{margin-top:6px\}/)
  assert.doesNotMatch(portrait,/display\s*:\s*none|visibility\s*:|\border\s*:|overflow\s*:\s*hidden|market-seed|market-order|market-care|market-tree/)
  assert.ok(portrait.trim().split('\n').filter(line=>line.trim().startsWith('[')).every(rule=>rule.trim().startsWith('[data-market-sale-browser] ')))
  assert.match(css,/\.market-inline-stepper :is\(button,input\)\s*\{[^}]*min-height:44px/)
  assert.match(css,/\.market-inline-sell\s*\{[^}]*min-height:46px/)
  const untouched=css.replace(m[0],'')
  const desktop=/^\.market-inline-card\s*\{([^}]+)\}/m.exec(untouched)?.[1]
  assert.ok(desktop)
  assert.match(desktop,/grid-template-columns:136px minmax\(0,1fr\)/)
  assert.match(desktop,/grid-template-rows:minmax\(116px,auto\) auto minmax\(18px,auto\)/)
  const landscape=untouched.slice(untouched.indexOf('@media(max-height:400px) and (orientation:landscape)'))
  assert.match(landscape,/\.market-inline-card\{grid-template-columns:100px minmax\(0,1fr\);grid-template-rows:86px auto minmax\(18px,auto\)/)
})

test('every earned mixed-inventory Harvest row and explicit inline Sell remains, with no quantity/loss side effect',()=>{
  const {farm,markup}=earnedSale(), before=structuredClone(farm)
  const html=markup(), rows=Array.from(html.matchAll(/data-inline-key="([^"]+)"/g),m=>m[1])
  assert.equal(rows.length,35)
  assert.equal(new Set(rows).size,35)
  assert.equal(rows[0],'produce:carrot')
  assert.equal(rows.at(-1),'variants:egg:rainbow')
  assert.equal((html.match(/data-inline-quantity/g)??[]).length,19)
  assert.equal((html.match(/data-action="inline-sale-confirm"/g)??[]).length,35)
  assert.equal((html.match(/role="status" aria-live="polite"><\/p>/g)??[]).length,35,'every clean status node stays mounted and empty')
  assert.deepEqual(farm,before)
})

test('earned apple quantity remains editable and exact, warning and receipt occupy the same existing status region',()=>{
  const {farm,sales,apple}=earnedSale(),before=structuredClone(farm),key='fruit:apple'
  const item=F.getMarketStock(farm).find(row=>row.key===key)!
  assert.ok(item.count>3)
  let view=sales.view(key,item.count,item.price)
  const clean=apple(), statusId='inline-sale-'+encodeURIComponent(key)
  assert.ok(clean.indexOf('market-inline-name')<clean.indexOf('data-inline-quantity'))
  assert.ok(clean.indexOf('data-inline-quantity')<clean.indexOf('data-action="inline-sale-confirm"'))
  assert.ok(clean.includes(`aria-describedby="${statusId}"`))
  assert.ok(sales.edit(key,view.token,String(item.count+1),item.count,item.price))
  assert.match(apple(),/role="status" aria-live="polite">Введите целое число/)
  assert.match(apple(),/data-action="inline-sale-confirm"[^>]*disabled/)
  assert.deepEqual(farm,before)
  view=sales.view(key,item.count,item.price)
  assert.ok(sales.edit(key,view.token,'2',item.count,item.price))
  assert.match(apple(),/role="status" aria-live="polite"><\/p>/)
  assert.deepEqual(farm,before)
  const quote=sales.take(key,sales.view(key,item.count,item.price).token,item.count,item.price)!
  assert.deepEqual(quote,{quantity:2,total:2*item.price,remaining:item.count-2})
  const result=F.sellMarketItem(farm,key,quote.quantity)
  assert.ok(result.ok);sales.finish(key,quote,result.goalRewardText)
  const receipt=apple()
  assert.ok(receipt.includes(`id="${statusId}" role="status" aria-live="off">Продано: 2`))
  assert.match(receipt,/data-action="inline-sale-again"/)
  assert.equal(farm.fruit.apple,before.fruit.apple-2)
  assert.equal(farm.coins,before.coins+2*item.price)
  assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
})
