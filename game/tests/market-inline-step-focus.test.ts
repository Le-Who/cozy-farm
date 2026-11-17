import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { MarketInlineSales } from '../src/market-inline-sale.ts'

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const update = main.slice(main.indexOf('function updateInlineSaleCard('), main.indexOf('function confirmInlineSale('))
const step = main.slice(main.indexOf("    case 'inline-sale-step':"), main.indexOf("    case 'inline-sale-confirm':"))
const script = stripTypeScriptTypes(update + "\nswitch ('inline-sale-step') {" + step + '}')

function runStep(direction: 'more'|'less', raw: string, detail: number, active = true) {
  const document = { activeElement: null as object|null }
  const item = { key:'variants:raspberry:star', name:'Звёздная малина', count:3, price:10 }
  const sales = new MarketInlineSales(), first = sales.view(item.key, item.count, item.price)
  assert.ok(sales.edit(item.key, first.token, raw, item.count, item.price))
  const stops = ['less','more'].map(() => ({ focus(options:{preventScroll:boolean}) { assert.equal(options.preventScroll,true); document.activeElement=this } }))
  const buttons = ['less','more'].map((step,i) => ({ dataset:{step}, disabled:false, closest:(selector:string)=>selector==='.market-step-limit'?stops[i]:null }))
  const control = buttons.find(button => button.dataset.step === direction)!
  if (active) document.activeElement = control
  const input = { value:raw, disabled:false, focus(options: {preventScroll:boolean}) { assert.equal(options.preventScroll,true); document.activeElement = input } }
  const sell = { dataset:{}, setAttribute() {} }, status = {}
  const card = { dataset:{inlineToken:sales.view(item.key,3,10).token}, querySelectorAll:()=>buttons,
    querySelector:(selector:string)=>selector==='[data-inline-quantity]'?input:selector==='.market-inline-sell'?sell:status }
  const context = { item, card, token:card.dataset.inlineToken }
  runInNewContext(script,{control,document,event:{detail},marketInlineSales:sales,inlineSaleContext:()=>context,
    quantity:String,numberFormat:new Intl.NumberFormat('ru'),icon:()=>''})
  return {document,input,control,limit:control.closest('.market-step-limit'),view:sales.view(item.key,3,10)}
}

for(const [direction,raw,expected] of [['more','2','3'],['less','2','1']] as const) {
  test('keyboard '+direction+' at its limit hands focus to the same neutral step position',()=>{
    const {document,input,control,limit,view}=runStep(direction,raw,0)
    assert.equal(control.disabled,true);assert.equal(input.disabled,false)
    assert.equal(document.activeElement,limit); assert.notEqual(document.activeElement,input)
    assert.equal(input.value,expected);assert.equal(view.quote.total,Number(expected)*10);assert.equal(view.pending,false)
  })
}
test('stepping through the middle keeps keyboard focus; pointer and unfocused activations do not move focus',()=>{
  const middle=runStep('more','1',0)
  assert.equal(middle.control.disabled,false);assert.equal(middle.document.activeElement,middle.control)
  for(const [detail,active] of [[1,true],[0,false]] as const) {
    const h=runStep('more','2',detail,active)
    assert.equal(h.control.disabled,true);assert.notEqual(h.document.activeElement,h.limit);assert.notEqual(h.document.activeElement,h.input)
  }
})

test('limit anchors occupy the original step positions without adding tab stops or Enter actions',()=>{
  const render=main.slice(main.indexOf('function marketInlineCard('),main.indexOf('function marketSaleResults('))
  for(const [raw,sign,next] of [['1','−','data-inline-quantity'],['3','+','market-inline-sell']] as const) {
    const item={key:'fruit:apple',name:'Яблоко',count:3,price:10},sales=new MarketInlineSales()
    assert.ok(sales.edit(item.key,sales.view(item.key,3,10).token,raw,3,10))
    const html=runInNewContext(stripTypeScriptTypes(render+';marketInlineCard(item)'),{item,marketInlineSales:sales,escapeHtml:String,itemIcon:()=>'',icon:()=>'',quantity:String,numberFormat:new Intl.NumberFormat('ru')}) as string
    const anchors=[...html.matchAll(/<span class="market-step-limit"([^>]+)><button ([^>]+)>([−+])<\/button><\/span>/g)]
    assert.equal(anchors.length,2)
    for(const [,attrs] of anchors){assert.match(attrs,/tabindex="-1"/);assert.match(attrs,/role="group"/);assert.doesNotMatch(attrs,/data-action|data-inline-quantity/)}
    const limit=anchors.find(m=>m[3]===sign)!
    assert.match(limit[2],/disabled/)
    // From the inert anchor, its disabled child cannot take Tab. The next enabled
    // control in this actual render is still the same one in document order.
    const after=html.slice(limit.index!+limit[0].length)
    const following=after.match(/<(?:button|input)\b(?![^>]*\bdisabled)[^>]+>/)?.[0]
    assert.ok(following?.includes(next),next)
  }
  const css=readFileSync(new URL('../src/market-sale-grid.css',import.meta.url),'utf8')
  assert.match(css,/\.market-inline-card :is\(button,input,\.market-step-limit\):focus-visible\s*\{outline:3px/)
})
