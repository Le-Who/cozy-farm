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
  const buttons = ['less','more'].map(step => ({ dataset:{step}, disabled:false }))
  const control = buttons.find(button => button.dataset.step === direction)!
  if (active) document.activeElement = control
  const input = { value:raw, disabled:false, focus(options: {preventScroll:boolean}) { assert.equal(options.preventScroll,true); document.activeElement = input } }
  const sell = { dataset:{}, setAttribute() {} }, status = {}
  const card = { dataset:{inlineToken:sales.view(item.key,3,10).token}, querySelectorAll:()=>buttons,
    querySelector:(selector:string)=>selector==='[data-inline-quantity]'?input:selector==='.market-inline-sell'?sell:status }
  const context = { item, card, token:card.dataset.inlineToken }
  runInNewContext(script,{control,document,event:{detail},marketInlineSales:sales,inlineSaleContext:()=>context,
    quantity:String,numberFormat:new Intl.NumberFormat('ru'),icon:()=>''})
  return {document,input,control,view:sales.view(item.key,3,10)}
}

for(const [direction,raw,expected] of [['more','2','3'],['less','2','1']] as const) {
  test('keyboard '+direction+' at its limit hands focus to the same editable quantity',()=>{
    const {document,input,control,view}=runStep(direction,raw,0)
    assert.equal(control.disabled,true);assert.equal(input.disabled,false)
    assert.equal(document.activeElement,input)
    assert.equal(input.value,expected);assert.equal(view.quote.total,Number(expected)*10);assert.equal(view.pending,false)
  })
}
test('stepping through the middle keeps keyboard focus; pointer and unfocused activations never enter the field',()=>{
  const middle=runStep('more','1',0)
  assert.equal(middle.control.disabled,false);assert.equal(middle.document.activeElement,middle.control)
  for(const [detail,active] of [[1,true],[0,false]] as const) {
    const h=runStep('more','2',detail,active)
    assert.equal(h.control.disabled,true);assert.notEqual(h.document.activeElement,h.input)
  }
})
