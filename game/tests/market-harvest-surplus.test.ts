import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {test} from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as S from '../src/market-order-surplus.ts'
import {ruPlural,traitLabel} from '../src/ru.ts'
import {shellDefinitions} from '../src/tide.ts'
import {shoalDefinitions} from '../src/shoal.ts'
import {MarketInlineSales} from '../src/market-inline-sale.ts'
import {marketSaleFamilies} from '../src/market-sale-family.ts'
import {searchMarketSales,searchMarketSaleView} from '../src/market-sale-search.ts'
import {ActivationKeyGuard,ActionClickGuard,isGuardedAction} from '../src/action-click-guard.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const part=(a:string,b:string)=>{
 const i=main.indexOf(a),j=main.indexOf(b,i+a.length)
 assert.ok(i>=0&&j>i,a);return main.slice(i,j)
}
const common=part('function button(','function fishSource(')
 +part('function stockLabel(','function stockTile(')
 +part('function marketFamilyOptions(','function marketSellView(')
 +part('function marketSaleSearchView()','function inlineSaleContext(')
 +part('function marketCareProducts(','function treeSelector()')
const vm=stripTypeScriptTypes(common+'\nmarketCards()')
const esc=(s:string)=>s.replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]!))
const unesc=(s:string)=>s.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&')
const p=earned416Mixed(false)
const base=p.state
const reopen=(f:F.FarmState)=>F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!
function commonContext(farm:F.FarmState) {
 const blanks=new Proxy({},{get:()=>''})
 return {...F,...S,farm,marketTab:'sell',marketCategory:'seeds',marketSellGroup:'harvest',marketSaleFamily:undefined,marketSaleQuery:'',
  marketInlineSales:new MarketInlineSales(()=>farm),salePresentation:{place:undefined},marketSaleBrowse:{crossCategorySearch:true},
  marketSaleFamilies,searchMarketSales,searchMarketSaleView,
  shellDefinitions,shoalDefinitions,traitLabel,ruPlural,pastryIcons:blanks,dishIcons:blanks,
  icon:()=>'<img alt="">',itemIcon:()=>'<img alt="">',escapeHtml:esc,numberFormat:new Intl.NumberFormat('ru-RU')}
}
const render=(farm=base,filters:Record<string,unknown>={})=>runInNewContext(vm,{...commonContext(farm),...filters}) as string
const estate=(markup:string,action:string)=>markup.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`))?.[0]
const token=(markup:string,action:string)=>unesc(estate(markup,action)?.match(/data-value="([^"]+)"/)?.[1]??'')

test('earned 416-stock Harvest offers one named read-only review, without touching the old inline or global actions',()=>{
 assert.deepEqual([base.day,p.actions,F.getSale(base).items],[193,543,416])
 const before=structuredClone(base),html=render()
 assert.ok(estate(html,'review-harvest-sale'),'one visible review for ordinary bed/tree surplus')
 assert.match(html,/Излишки с грядок и деревьев/)
 assert.equal((html.match(/data-action="review-harvest-sale"/g)??[]).length,1)
 assert.ok(!estate(html,'confirm-harvest-sale'),'a market group click is not a sale')
 assert.match(html,/data-inline-key="fruit:apple"/)
 assert.match(html,/data-inline-key="variants:apple:star"/)
 assert.match(html,/data-inline-quantity/)
 assert.match(html,/data-action="inline-sale-confirm"/)
 assert.deepEqual(base,before)
 const all=render(base,{marketSellGroup:'all'})
 assert.ok(estate(all,'sell-order-surplus'));assert.ok(estate(all,'sell'));assert.equal(estate(all,'review-harvest-sale'),undefined)
 for(const filters of [{marketSaleQuery:'яблоки'},{marketSaleFamily:'fruit:apple'},{marketSellGroup:'kitchen'}]){
   assert.equal(estate(render(base,filters),'review-harvest-sale'),undefined)
 }
})

function workflow(farm:F.FarmState,overrides:Record<string,unknown>={}){
  const events:string[]=[]
  const previewToken=token(render(farm),'review-harvest-sale')
  const originButton={id:'review-harvest-sale',getClientRects:()=>[1],focus:()=>events.push('origin focus')}
  const heading={focus:()=>events.push('review heading focus')}
  const receipt={focus:()=>events.push('payment receipt focus')}
  const basket={disabled:false,closest:(selector:string)=>selector==='[data-harvest-sale-review]'?{}:null}
  const grid={scrollTop:230}, original={panel:'market',marketTab:'sell',marketCategory:'care',marketSaleFamily:undefined,
    marketSaleQuery:'',marketSellGroup:'harvest',marketSaleGrid:{key:'actualHarvestRows',scroll:230},scroll:3,focus:'review-harvest-sale'}
  const draw=()=>{
    const review=ctx.panelHistory.at(-1)?.harvestSale
    ctx.markup=ctx.panel==='sale'?ctx.drawReview(review):render(farm,ctx)
  }
  const ctx:any={...commonContext(farm),...original,events,markup:render(farm),dialog:{open:true,querySelectorAll:()=>[originButton]},
    panelHistory:[],event:{detail:1},selection:{},dialogContent:{scrollTop:3,contains:control=>[originButton,basket].includes(control),
      querySelector(selector:string){return selector==='#market-sale-results'?grid:selector.endsWith(' h2')?heading:selector.endsWith('.exact-sale-receipt')?receipt:null}},
    rememberPanel:()=>({...original,marketSaleGrid:{key:'actualHarvestRows',scroll:grid.scrollTop}}),
    openPanel(next:string,remember:boolean){assert.equal(remember,false);ctx.panel=next;draw()},
    perform(fn:()=>F.ActionResult){const r=fn();events.push(r.ok?'one save':'blocked');if(r.ok)draw();return r.ok},
    updateMarketSaleSearch:()=>events.push('refresh current stock'),playBaySound:(sound:string)=>events.push(sound),
    marketSaleGridKey:()=> 'actualHarvestRows',
    focusKey:(button:typeof originButton)=>button.id,
    ...overrides}
  // Execute the actual production handlers and review. Use the existing
  // Back projection and guarded stock-scroll restoration, after local draw.
  // Other unrelated Back restorers intentionally aren't in this source test.
  const restore=part('  marketSaleFamily=previous.marketSaleFamily;', '  previewSeed=previous.previewSeed;')
  const reopenMarket=part("  openPanel(destinationPanel,false,farm.island,'page.fold')",'  restoreFerryPanelView(dialogContent,previous.ferryView)')
  const back=part("    case 'back':","    case 'journal-stay':")
  runInNewContext(stripTypeScriptTypes(
    common+'\n'+part('function harvestSaleCard(', 'function exactSaleCard(')
    +"\nfunction drawReview(review){return harvestSaleCard(review)}"
    +"\nfunction activate(action,value,control){switch(action){"+part("    case 'review-harvest-sale':","    case 'sell-order-surplus':")+back+"}}"
    +"\nfunction goBack(){const previous=panelHistory.pop();const destinationPanel=previous.panel;"+restore+reopenMarket+"}"
  ),ctx)
  ctx.closeContextualSale=()=>false;ctx.returnToRecipeIndex=()=>false
  return {ctx,events,grid,originButton,basket,previewToken,
    pressPreview(){ctx.activate('review-harvest-sale',previewToken,originButton)},
    pressConfirm(value=token(ctx.markup,'confirm-harvest-sale')){ctx.activate('confirm-harvest-sale',value,basket)},
    back(){ctx.activate('back',undefined,{})}}
}

test('the actual standard review gives exact 338 / 1417 and Cancel returns to the same group and scroll with no write',()=>{
 const f=reopen(base),before=structuredClone(f),w=workflow(f)
 const target=w.ctx.marketInlineSales.view('fruit:apple',312,4)
 assert.ok(w.ctx.marketInlineSales.edit('fruit:apple',target.token,'7',312,4))
 w.pressPreview()
 assert.equal(w.ctx.panel,'sale');assert.deepEqual(f,before)
 assert.match(w.ctx.markup,/Обычные излишки с грядок и деревьев/)
 assert.match(w.ctx.markup,/338 предметов · 1[\s\u00a0\u202f]417 монет/)
 assert.match(w.ctx.markup,/Редкости и запасы для заказов останутся/)
 assert.match(w.ctx.markup,/Состав · 11/)
 assert.match(w.ctx.markup,/Отмена/)
 assert.equal(w.events[0],'review heading focus')
 w.grid.scrollTop=0;w.ctx.marketSellGroup='all'
 w.back()
 assert.deepEqual([w.ctx.panel,w.ctx.marketTab,w.ctx.marketSellGroup,w.ctx.marketSaleQuery,w.ctx.marketSaleFamily,w.grid.scrollTop],
   ['market','sell','harvest','',undefined,230])
 assert.match(w.ctx.markup,/data-inline-key="fruit:apple"/)
 assert.equal(w.ctx.marketInlineSales.view('fruit:apple',312,4).raw,'7')
 assert.deepEqual(f,before)
 assert.ok(!w.events.includes('one save'))
 w.pressConfirm();assert.deepEqual(f,before,'a detached confirm has nothing to own')
})

test('exact one basket sale leaves rare, shore, kitchen, and every actionable order intact',()=>{
 const f=reopen(base),before=structuredClone(f),w=workflow(f)
 w.pressPreview()
 const old=token(w.ctx.markup,'confirm-harvest-sale')
 assert.ok(old)
 w.pressConfirm()
 assert.equal(f.coins-before.coins,1417)
 assert.equal(F.getSale(f).items,78)
 assert.equal(f.progress.sell,before.progress.sell+1)
 assert.equal(f.workToday,before.workToday+1)
 assert.deepEqual([f.variants,f.shells,f.dishes,f.eggs,f.bayShop,f.orders,f.freight,f.seeds],
   [before.variants,before.shells,before.dishes,before.eggs,before.bayShop,before.orders,before.freight,before.seeds])
 const ready=(farm:F.FarmState)=>F.getMarketOrders(farm).filter(order=>order.status==='ready').map(order=>order.lane)
 assert.deepEqual(ready(f),['garden','pantry','kitchen','irrigation'])
 assert.equal(reopen(f).island,'home');assert.deepEqual(reopen(f),f)
 assert.match(w.ctx.markup,/Продано: 338 предметов/)
 assert.equal(estate(w.ctx.markup,'confirm-harvest-sale'),undefined)
 assert.equal(w.events.filter(event=>event==='one save').length,1)
 const done=structuredClone(f);w.pressConfirm(old);assert.deepEqual(f,done)
 assert.ok(isGuardedAction('review-harvest-sale')&&isGuardedAction('confirm-harvest-sale'))
 const clicks=new ActionClickGuard(),point={detail:1,clientX:55,clientY:55,timeStamp:100}
 clicks.remember(point);assert.ok(clicks.blocks({...point,timeStamp:120,detail:2}))
 const keys=new ActivationKeyGuard();assert.ok(!keys.blocks({key:'Enter',repeat:false},true));assert.ok(keys.blocks({key:'Enter',repeat:true},true))
})

test('a visible review cannot silently follow stock/order changes; filtered, narrow, and detached entries never authorize it',()=>{
 const f=reopen(base),w=workflow(f)
 w.pressPreview()
 assert.ok(F.sellMarketItem(f,'fruit:apple',1).ok)
 const changed=structuredClone(f)
 w.pressConfirm()
 assert.deepEqual(f,changed);assert.ok(w.basket.disabled)
 assert.ok(!w.events.includes('one save'))
 assert.ok(w.events.includes('blocked'))
 w.back()
 w.pressPreview();assert.equal(w.ctx.panel,'market');assert.ok(w.events.includes('refresh current stock'))
 const elsewhere=reopen(base);assert.ok(F.sail(elsewhere,'village').ok)
 assert.equal(S.getMarketHarvestSurplusQuote(elsewhere),undefined)
 const filtered=workflow(reopen(base),{marketSaleQuery:'яблоки'})
 filtered.pressPreview();assert.equal(filtered.ctx.panel,'market')
 const one=reopen(base)
 for(const row of F.getMarketStock(one))if(row.count>0&&row.key!=='fruit:apple')assert.ok(F.sellMarketItem(one,row.key,row.count).ok)
 assert.equal(S.getMarketHarvestSurplusQuote(one),undefined)
 const ordered=reopen(base),withPlan=workflow(ordered)
 withPlan.pressPreview();assert.ok(F.deliverMarketOrder(ordered,'garden').ok)
 const afterOrder=structuredClone(ordered)
 withPlan.pressConfirm();assert.deepEqual(ordered,afterOrder);assert.ok(withPlan.events.includes('blocked'))
})

test('the ordinary first-day review separates its exact quote from the existing one-time task reward',()=>{
 const f=F.createFarm()
 assert.ok(F.pickFruit(f,0).ok)
 assert.ok(F.workBed(f,2).ok)
 assert.ok(F.workBed(f,3).ok)
 const w=workflow(f),before=structuredClone(f)
 w.pressPreview()
 assert.deepEqual(f,before)
 assert.match(w.ctx.markup,/4 предмета · 18 монет/)
 assert.doesNotMatch(w.ctx.markup,/Награда за задание/)
 w.pressConfirm()
 assert.equal(f.coins-before.coins,26)
 assert.equal(F.getSale(before).items-F.getSale(f).items,4)
 assert.equal(f.eggs,before.eggs)
 assert.match(w.ctx.markup,/Продано: 4 предмета · 18 монет<br>Награда за задание: \+8 монет\./)
 assert.equal(w.events.filter(event=>event==='one save').length,1)
})
