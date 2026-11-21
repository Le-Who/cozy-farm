import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { ActionClickGuard, ActivationKeyGuard, installActionClickGuard, isGuardedAction } from '../src/action-click-guard.ts'
import { MarketInlineSales, inlineReceiptText } from '../src/market-inline-sale.ts'
import { collectEggs, createFarm, endDay, getMarketStock, getSale, getTreeAction, pickFruit, restoreCurrentFarm, sellMarketItem, workBed } from '../src/farm.ts'

test('inline confirmation and rearming own their gesture; quantity stepping stays repeatable', () => {
  assert.equal(isGuardedAction('inline-sale-confirm'), true)
  assert.equal(isGuardedAction('inline-sale-again'), true)
  assert.equal(isGuardedAction('inline-sale-step'), false)
})

test('held Enter cannot cross inline receipt and rearm into another sale', () => {
  const farm = createFarm(); farm.fruit.apple = 10; farm.progress.sell = 1
  const before = structuredClone(farm), ui = new MarketInlineSales(), keys = new ActivationKeyGuard()
  const key = 'fruit:apple', price = getMarketStock(farm).find(item => item.key === key)!.price
  let view = ui.view(key, farm.fruit.apple, price)
  assert.ok(ui.edit(key, view.token, '3', farm.fruit.apple, price))
  const activate = (repeat: boolean) => {
    const view = ui.view(key, farm.fruit.apple, price), action = view.receipt ? 'inline-sale-again' : 'inline-sale-confirm'
    if (keys.blocks({key:'Enter', repeat}, isGuardedAction(action))) return false
    if (view.receipt) return ui.rearm(key, view.token, farm.fruit.apple, price)
    const quote = ui.take(key, view.token, farm.fruit.apple, price)
    if (!quote) return false
    assert.ok(sellMarketItem(farm, key, quote.quantity).ok); ui.finish(key, quote); return true
  }
  assert.equal(activate(false), true)
  for (let i = 0; i < 8; i++) assert.equal(activate(true), false)
  const expected = structuredClone(before); sellMarketItem(expected, key, 3)
  assert.deepEqual(farm, expected)
  keys.release('Enter'); assert.equal(activate(false), true, 'fresh press rearms without selling')
  for (let i = 0; i < 8; i++) assert.equal(activate(true), false)
  assert.deepEqual(farm, expected)
  keys.release('Enter'); assert.equal(activate(false), true, 'next deliberate press sells the one-unit draft')
  sellMarketItem(expected, key, 1); assert.deepEqual(farm, expected)
})

test('one inline pointer gesture cannot fall through a receipt; later intentional actions work', () => {
  for (const action of ['inline-sale-confirm','inline-sale-again']) {
    const guard = new ActionClickGuard(), first = {detail:1,timeStamp:100,clientX:320,clientY:280}
    assert.equal(guard.blocks(first), false)
    if (isGuardedAction(action)) guard.remember(first)
    assert.equal(guard.blocks({...first, timeStamp:180}), true)
    assert.equal(guard.blocks({...first, detail:2,timeStamp:180}), true)
    assert.equal(guard.blocks({...first, detail:0,timeStamp:200}), false)
    assert.equal(guard.blocks({...first, timeStamp:701}), false)
  }
})

test('inline quantity input keeps held-key ownership even if its last stock row disappears', () => {
  const previous = globalThis.Element, handlers = new Map<string, Function>()
  class Control {
    readonly inline: boolean
    constructor(inline = false) { this.inline = inline }
    closest(selector: string) { return this.inline && selector.includes('[data-inline-quantity]') ? this : null }
  }
  Object.assign(globalThis, { Element: Control })
  const root = { addEventListener() {}, contains: () => true, ownerDocument: {
    addEventListener: (type: string, handler: Function) => handlers.set(type, handler), defaultView: {addEventListener() {}},
  } }
  const dispatch = (target: Control, repeat: boolean) => {
    let prevented = false, stopped = false
    handlers.get('keydown')!({target,key:'Enter',repeat,preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}})
    assert.equal(prevented, stopped); return prevented
  }
  try {
    installActionClickGuard(root as unknown as HTMLElement)
    assert.equal(dispatch(new Control(true), false), false)
    assert.equal(dispatch(new Control(), true), true, 'redraw may focus the unguarded search field')
    handlers.get('keyup')!({key:'Enter'})
    assert.equal(dispatch(new Control(), false), false)
  } finally { Object.assign(globalThis, {Element: previous}) }
})

const main = readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const part = (from: string,to: string) => main.slice(main.indexOf(from),main.indexOf(to,main.indexOf(from)))
const cardCode = stripTypeScriptTypes(part('function marketInlineCard(','function marketSaleResults(')+';marketInlineCard(item)')
const rearmCode = stripTypeScriptTypes(part('function updateInlineSaleCard(','function confirmInlineSale(')
  + "switch ('inline-sale-again') {" + part("    case 'inline-sale-again':","    case 'sell-item':") + '}')
const rendering = { escapeHtml:String, itemIcon:()=>'', icon:()=>'', quantity:(n:number)=>`${n} монеты`, numberFormat:new Intl.NumberFormat('ru') }
const row = (farm: ReturnType<typeof createFarm>, key: string, name: string) => ({...getMarketStock(farm).find(item=>item.key===key)!,name})
const card = (item: ReturnType<typeof row>, marketInlineSales: MarketInlineSales) =>
  runInNewContext(cardCode, {...rendering,item,marketInlineSales,inlineReceiptText}) as string

test('the first earned egg has only the exact Sell control, while the first two apples still offer quantity',()=>{
  const farm=createFarm(), sales=new MarketInlineSales()
  assert.ok(collectEggs(farm).ok); assert.ok(pickFruit(farm,0).ok)
  const before=structuredClone(farm), egg=row(farm,'eggs','Яйцо'), apple=row(farm,'fruit:apple','Яблоко')
  assert.equal(farm.day,1); assert.equal(egg.count,1); assert.equal(apple.count,2)
  const one=card(egg,sales)
  assert.equal((one.match(/<button /g)??[]).length,1)
  assert.doesNotMatch(one,/market-inline-stepper|<input/)
  assert.match(one,/aria-label="Продать 1: Яйцо, 3 монеты" data-action="inline-sale-confirm" data-value="eggs">/)
  assert.match(card(apple,sales),/data-inline-quantity[^>]*max="2"/)
  assert.deepEqual(farm,before)
  const quote=sales.take(egg.key,sales.view(egg.key,egg.count,egg.price).token,egg.count,egg.price)!
  assert.deepEqual(quote,{quantity:1,total:egg.price,remaining:0})
  assert.ok(sellMarketItem(farm,egg.key,quote.quantity).ok)
  assert.equal(farm.eggs,0); assert.equal(farm.fruit.apple,before.fruit.apple)
  assert.deepEqual(restoreCurrentFarm(structuredClone(farm)),farm)
})

test('earned stock, unit price, selected amount and batch total remain distinct after live edits',()=>{
  const farm=createFarm(), sales=new MarketInlineSales()
  assert.ok(workBed(farm,9,0).ok)
  const item=row(farm,'produce:carrot','Морковь'), before=structuredClone(farm)
  assert.equal(farm.day,1);assert.equal(item.count,3);assert.equal(item.price,2)
  const css=readFileSync(new URL('../src/market-sale-grid.css',import.meta.url),'utf8')
  const initial=card(item,sales)
  assert.match(initial,/В запасе: 3<\/p>/)
  assert.match(initial,/market-inline-price[^>]*>[\s\S]*?за штуку<\/p>/)
  assert.match(initial,/class="market-inline-sell"[^>]*>Продать 1 · 2\s*<\/button>/)
  assert.match(css,/\.market-inline-sell\s*\{[^}]*overflow-wrap:anywhere/,'large valid quotes can wrap rather than clip')

  const input={value:'1',max:'3',disabled:false}, sell={dataset:{action:''},innerHTML:'',disabled:false,name:'',setAttribute(_k:string,v:string){this.name=v}}
  const step=[{dataset:{step:'less'},disabled:true},{dataset:{step:'more'},disabled:false}]
  const status={textContent:'',ariaLive:''}
  const node={dataset:{inlineToken:sales.view(item.key,item.count,item.price).token},querySelectorAll:()=>step,
    querySelector:(q:string)=>q==='[data-inline-quantity]'?input:q==='.market-inline-sell'?sell:status}
  const script=stripTypeScriptTypes(part('function updateInlineSaleCard(','function confirmInlineSale(')+';updateInlineSaleCard(node)')
  for(const [raw,count,total] of [['2',2,4],['4',null,null],['1.5',null,null],['3',3,6],['2',2,4]] as const){
    assert.ok(sales.edit(item.key,node.dataset.inlineToken,raw,item.count,item.price))
    runInNewContext(script,{...rendering,node,marketInlineSales:sales,inlineReceiptText,inlineSaleContext:()=>({item})})
    assert.equal(sell.innerHTML.trim(),count===null?'Продать · —':`Продать ${count} · ${total}`)
    assert.equal(sell.name,count===null?'Продать: Морковь':`Продать ${count}: Морковь, ${total} монеты`)
    assert.equal(sell.disabled,count===null);assert.equal(input.max,'3')
    assert.equal(step[1].disabled,count===3)
    if(count===null)assert.match(status.textContent,/от 1 до 3/)
    assert.deepEqual(farm,before)
  }
  const quote=sales.take(item.key,node.dataset.inlineToken,item.count,item.price)
  assert.deepEqual(quote,{quantity:2,total:4,remaining:1})
  const result=sellMarketItem(farm,item.key,quote!.quantity)
  assert.ok(result.ok);sales.finish(item.key,quote,result.goalRewardText)
  const receipt=card(row(farm,item.key,item.name),sales)
  assert.match(receipt,/Продать ещё<\/button>/);assert.match(receipt,/Продано: 2 · 4 монеты\./)
  assert.equal(farm.produce.carrot,1);assert.equal(farm.coins,before.coins+4+8,'goal reward never enters the quote')
})

test('a receipt with one left rearms to the singleton sale without expecting a number input',()=>{
  const farm=createFarm(),sales=new MarketInlineSales()
  assert.ok(pickFruit(farm,0).ok)
  let item=row(farm,'fruit:apple','Яблоко')
  const quote=sales.take(item.key,sales.view(item.key,item.count,item.price).token,item.count,item.price)!
  assert.ok(sellMarketItem(farm,item.key,quote.quantity).ok); sales.finish(item.key,quote)
  item=row(farm,item.key,item.name)
  assert.equal(item.count,1)
  const receipt=card(item,sales)
  assert.match(receipt,/data-action="inline-sale-again"/)
  assert.match(receipt,/Осталось: 1/)
  assert.doesNotMatch(receipt,/market-inline-stepper|<input/)
  const sell={dataset:{action:'inline-sale-again'},disabled:false,innerHTML:'',setAttribute(){}}
  const node={dataset:{inlineToken:sales.view(item.key,item.count,item.price).token},querySelectorAll:()=>[],
    querySelector:(selector:string)=>selector==='.market-inline-sell'?sell:selector==='.market-inline-status'?{}:null}
  const before=structuredClone(farm)
  runInNewContext(rearmCode,{...rendering,event:{detail:1},control:sell,marketInlineSales:sales,
    inlineSaleContext:()=>({item,card:node,token:node.dataset.inlineToken})})
  assert.equal(sell.dataset.action,'inline-sale-confirm'); assert.match(sell.innerHTML,/Продать 1 · 4/)
  assert.equal(sell.disabled,false); assert.deepEqual(farm,before)
})

test('returning after harvesting more apples replaces the partial receipt with current inline quantity',()=>{
  const farm=createFarm(),sales=new MarketInlineSales(),key='fruit:apple',name='Яблоко'
  assert.ok(pickFruit(farm,0).ok)
  const initial=row(farm,key,name)
  assert.equal(initial.count,2)
  const beforeSale=sales.view(key,initial.count,initial.price).token
  const sold=sales.take(key,beforeSale,initial.count,initial.price)!
  assert.deepEqual(sold,{quantity:1,total:initial.price,remaining:1})
  assert.ok(sellMarketItem(farm,key,sold.quantity).ok)
  sales.finish(key,sold)
  let item=row(farm,key,name)
  const receiptToken=sales.view(key,item.count,item.price).token
  assert.match(card(item,sales),/Осталось: 1/)
  assert.match(card(item,sales),/data-action="inline-sale-again"/)

  for(let i=0; !getTreeAction(farm,0).available && i<5; i++) assert.ok(endDay(farm).ok)
  assert.ok(pickFruit(farm,0).ok)
  item=row(farm,key,name)
  assert.ok(item.count>1)
  const before=structuredClone(farm),total=getSale(farm),fresh=card(item,sales)
  assert.match(fresh,new RegExp(`В запасе: ${item.count}<\/p>`))
  assert.doesNotMatch(fresh,/Осталось: 1|inline-sale-again/,'the old remaining count is not a current balance')
  assert.match(fresh,new RegExp(`data-inline-quantity[^>]*max="${item.count}"[^>]*value="1"(?![^>]*disabled)`))
  assert.match(fresh,new RegExp(`Продать 1 · ${item.price}`))
  assert.equal(sales.rearm(key,receiptToken,item.count,item.price),false)
  assert.equal(sales.take(key,receiptToken,item.count,item.price),undefined)
  let view=sales.view(key,item.count,item.price)
  assert.ok(sales.edit(key,view.token,'2',item.count,item.price))
  view=sales.view(key,item.count,item.price)
  assert.deepEqual(sales.take(key,view.token,item.count,item.price),{quantity:2,total:2*item.price,remaining:item.count-2})
  assert.deepEqual(getSale(farm),total);assert.deepEqual(farm,before)
})

test('an older edited quantity remains visible and repairable when only one item remains',()=>{
  const farm=createFarm(),sales=new MarketInlineSales()
  assert.ok(pickFruit(farm,0).ok)
  let item=row(farm,'fruit:apple','Яблоко')
  assert.ok(sales.edit(item.key,sales.view(item.key,item.count,item.price).token,'2',item.count,item.price))
  const old=sales.view(item.key,item.count,item.price).token
  assert.ok(sellMarketItem(farm,item.key,1).ok)
  item=row(farm,item.key,item.name)
  const before=structuredClone(farm), html=card(item,sales)
  assert.match(html,/data-inline-quantity[^>]*max="1"[^>]*value="2"/)
  assert.match(html,/data-action="inline-sale-confirm"[^>]* disabled/)
  assert.equal(sales.take(item.key,old,item.count,item.price),undefined)
  assert.deepEqual(farm,before)
})

const confirmCode = stripTypeScriptTypes(
  part('function inlineSaleContext(','function updateInlineSaleCard(')
  + part('function confirmInlineSale(','function updateMarketSaleSearch(')
  + part('function perform(','\nconst bedTools')
  + "switch ('inline-sale-confirm') {" + part("    case 'inline-sale-confirm':","    case 'inline-sale-again':") + '}',
)

for (const hasApples of [true,false]) {
  test(`the day-one keyboard egg sale announces its result and moves to ${hasApples?'the apples name':'the empty market notice'}`,()=>{
    const farm=createFarm(),marketInlineSales=new MarketInlineSales(),written:typeof farm[]=[]
    assert.ok(collectEggs(farm).ok); if (hasApples) assert.ok(pickFruit(farm,0).ok)
    const before=structuredClone(farm),expected=structuredClone(farm),expectedSale=sellMarketItem(expected,'eggs',1)
    assert.ok(expectedSale.ok); assert.match(expectedSale.message,/Награда за задание: \+8 монет/)
    const goods=()=>getMarketStock(farm).filter(item=>item.count>0)
      .map(item=>({...item,name:item.key==='eggs'?'Яйцо':'Яблоко'}))

    const document={activeElement:undefined as unknown}, grid={scrollTop:hasApples?22:0}
    let scrolled:string|undefined
    const focusTarget=(id:string)=>({
      focus({preventScroll}:{preventScroll:boolean}) {assert.equal(preventScroll,true); document.activeElement=id},
      scrollIntoView({block,inline}:{block:string;inline:string}) {assert.equal(block,'nearest'); assert.equal(inline,'nearest'); scrolled=id},
    })
    const nodes=()=>goods().map(item=>{
      const key=item.key, html=card(item,marketInlineSales), node={
        dataset:{inlineKey:key,inlineToken:marketInlineSales.view(key,item.count,item.price).token},
        querySelector(selector:string) {return focusTarget(selector==='.market-inline-name'?`name:${key}`:`sell:${key}`)},
      }
      return {key,html,node}
    })
    let cards=nodes()
    const egg=cards.find(card=>card.key==='eggs')!
    assert.doesNotMatch(egg.html,/<input/)
    const control={closest:(selector:string)=>selector==='[data-inline-key]'?egg.node:null}
    document.activeElement=control
    const dialogContent={
      contains: (element:unknown)=>element===control && cards.includes(egg),
      querySelectorAll:(selector:string)=>{assert.equal(selector,'[data-inline-key]');return cards.map(card=>card.node)},
      querySelector:(selector:string)=>selector==='#market-sale-results'?(cards.length?grid:null)
        :selector==='[data-market-sale-empty]'&&!cards.length?focusTarget('empty')
          :selector==='[data-market-sale-query]'&&cards.length?focusTarget('search'):null,
    }
    let srOnly:boolean|undefined
    const feedback={hidden:true,textContent:'',classList:{toggle:(name:string,value:boolean)=>{assert.equal(name,'sr-only');srOnly=value}},dataset:{tone:''}}
    const context={farm,document,dialog:{open:true},panel:'market',marketTab:'sell',control,event:{detail:0},dialogContent,
      marketInlineSales,marketSellGroup:'all',goods,sellMarketItem,island:{isCrossing:()=>false},playBaySound(){},
      dialogFeedback:feedback,dialogFeedbackTimer:0,window:{setTimeout:()=>1,clearTimeout(){}},
      saveFarm(){written.push(structuredClone(farm))},refresh(){cards=nodes();document.activeElement=undefined;grid.scrollTop=0}}
    assert.deepEqual(farm,before)
    runInNewContext(confirmCode,context)
    assert.deepEqual(written,[expected]); assert.deepEqual(farm,expected)
    assert.equal(feedback.hidden,false); assert.equal(srOnly,false)
    assert.equal(feedback.dataset.tone,'good'); assert.equal(feedback.textContent,expectedSale.message)
    const next=hasApples?'name:fruit:apple':'empty'
    assert.equal(document.activeElement,next); assert.equal(scrolled,next)
    assert.ok(cards.every(card=>card.key!=='eggs'))
    if (hasApples) {
      assert.equal(grid.scrollTop,22)
      const firstEnabled=cards[0].html.match(/<(?:button|input)\b(?![^>]*\bdisabled)[^>]+>/)?.[0]
      assert.match(firstEnabled!,/data-inline-quantity[^>]*max="2"/,'the next Tab can reach the unchanged two-apple picker')
    }
    runInNewContext(confirmCode,context)
    assert.deepEqual(written,[expected],'the removed sale control cannot run again')
  })
}
