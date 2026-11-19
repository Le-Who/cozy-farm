import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { MarketInlineSales } from '../src/market-inline-sale.ts'
import { getMarketStock, getSale, getTreeAction, sellMarketItem } from '../src/farm.ts'
import { searchMarketSales, type MarketSaleGroup } from '../src/market-sale-search.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const update = main.slice(main.indexOf('function updateInlineSaleCard('), main.indexOf('function confirmInlineSale('))
const step = main.slice(main.indexOf("    case 'inline-sale-step':"), main.indexOf("    case 'inline-sale-confirm':"))
const script = stripTypeScriptTypes(update + "\nswitch ('inline-sale-step') {" + step + '}')

test('the last sale in a selected family offers All without activating it or focusing a different product',()=>{
  const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
  const p=commissionPlayer(opening.slice(0,opening.findIndex(a=>a.name==='serveVillageMeal')+1));p.visit('home')
  const handler=stripTypeScriptTypes(main.slice(main.indexOf('function confirmInlineSale('),main.indexOf('function updateMarketSaleSearch('))+';confirmInlineSale({})')
  function after(key:string,group:MarketSaleGroup,family?:string,query='',emptyOthers=false){
    const farm=structuredClone(p.state),sales=new MarketInlineSales()
    if(emptyOthers)for(const row of getMarketStock(farm))if(row.count&&row.key!==key)assert.ok(sellMarketItem(farm,row.key,row.count).ok)
    const goods=()=>getMarketStock(farm).map(row=>({...row,name:row.key,group:row.item.kind==='dishes'?'kitchen':'harvest'}))
    const item=goods().find(row=>row.key===key)!,token=sales.view(key,item.count,item.price).token,coins=farm.coins
    let focused=''
    const stop=(name:string)=>({focus(){focused=name},scrollIntoView(){}})
    const shell={querySelector:(s:string)=>s==='[data-market-sale-empty]'&&!goods().some(row=>row.count>0)?stop('empty'):s==='[data-market-sale-query]'&&goods().some(row=>row.count>0)?stop('search'):s==='[data-action="market-sell-group"][data-value="all"]'?stop('all'):null,
      querySelectorAll:()=>searchMarketSales(goods(),group,query,family).items.map(row=>({dataset:{inlineKey:row.key},querySelector:()=>stop(row.key)}))}
    const ctx={farm,goods,searchMarketSales,marketInlineSales:sales,marketSellGroup:group,marketSaleFamily:family,marketSaleQuery:query,
      dialogContent:shell,inlineSaleContext:()=>({item,token}),sellMarketItem,perform:(act:()=>{ok:boolean})=>act().ok,playBaySound(){}}
    runInNewContext(handler,ctx)
    assert.equal(farm.coins,coins+item.price);assert.equal(ctx.marketSellGroup,group);assert.equal(ctx.marketSaleFamily,family);assert.equal(ctx.marketSaleQuery,query)
    return focused
  }
  assert.equal(after('produce:carrot','harvest','produce:carrot'),'all')
  assert.equal(after('produce:carrot','harvest','produce:carrot','carrot'),'all')
  assert.equal(after('produce:tomato','harvest','produce:tomato'),'produce:tomato','partial sale retains its own control')
  assert.equal(after('variants:apple:dew','harvest','fruit:apple','dew'),'search','a filtered sibling is not an exhausted family')
  assert.equal(after('produce:carrot','harvest',undefined),'search')
  assert.equal(after('produce:carrot','harvest','produce:carrot','',true),'empty','no other goods to browse: the empty notice replaces search')
})

test('selling the final unit in a crowded grid focuses a neighboring product name, never its sale action',()=>{
  const opening=JSON.parse(readFileSync(new URL('./fixtures/market-order-selection-commands.json',import.meta.url),'utf8'))
  const p=commissionPlayer(opening); p.visit('home')
  while(getSale(p.state).items<416){
    assert.ok(p.state.day<800)
    if(getTreeAction(p.state,0).available)p.act('pickFruit',0);else p.night()
  }
  const baseline=p.state
  assert.equal(getSale(baseline).items,416)
  const confirm=main.slice(main.indexOf('function confirmInlineSale('),main.indexOf('function updateMarketSaleSearch('))
  const click=main.slice(main.indexOf("    case 'inline-sale-confirm':"),main.indexOf("    case 'inline-sale-again':"))
  const code=stripTypeScriptTypes(confirm+";switch ('inline-sale-confirm') {"+click+'}')
  for(const [key,detail,expected] of [
    ['variants:pear:rainbow',0,'variants:egg:rainbow'], // the next card moves into this position
    ['variants:egg:rainbow',0,'variants:pear:rainbow'], // last card: previous heading
    ['variants:pear:rainbow',1,'search'], // pointer retains its original behavior
  ] as const){
    const farm=structuredClone(baseline),sales=new MarketInlineSales(),control={}
    let focused='',scrolled=''
    const stop=(id:string)=>({focus(){focused=id},scrollIntoView(){scrolled=id}})
    const draw=()=>getMarketStock(farm).filter(x=>x.count>0).map(x=>({dataset:{inlineKey:x.key},
      querySelector:(selector:string)=>stop(selector==='.market-inline-name'?x.key:'action:'+x.key)}))
    let cards=draw()
    const item=getMarketStock(farm).find(x=>x.key===key)!,card=cards.find(x=>x.dataset.inlineKey===key)!
    assert.equal(item.count,1)
    const shell={querySelectorAll:()=>cards,querySelector:(s:string)=>s==='[data-market-sale-query]'?stop('search'):null}
    runInNewContext(code,{farm,control,document:{activeElement:control},event:{detail},dialogContent:shell,marketInlineSales:sales,
      inlineSaleContext:()=>({item,card,token:sales.view(key,item.count,item.price).token}),marketSellGroup:'all',sellMarketItem,
      perform:(act:()=>{ok:boolean})=>{const ok=act().ok;cards=draw();return ok},playBaySound(){}})
    assert.equal(focused,expected);assert.equal(scrolled,expected)
    assert.equal(farm.coins,baseline.coins+item.price);assert.equal(getSale(farm).items,415)
  }
  const heading=main.slice(main.indexOf('function marketInlineCard('),main.indexOf('function marketSaleResults('))
  assert.match(heading,/<h2 class="market-inline-name" tabindex="-1">/,'heading is not a transaction or an extra tab stop')
})

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
