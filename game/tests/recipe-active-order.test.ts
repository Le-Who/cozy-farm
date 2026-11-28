import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as Farm from '../src/farm.ts'
import * as Commission from '../src/shop-commissions.ts'
import * as BookView from '../src/recipe-book-view.ts'
import * as Tasting from '../src/signature-tasting-guidance.ts'
import * as Repeat from '../src/recipe-repeat-guidance.ts'
import * as Cook from '../src/culinary.ts'
import * as Rules from '../src/climate.ts'
import * as Picnic from '../src/picnic-guidance.ts'
import * as Harvest from '../src/harvest-picnic.ts'
import * as Supper from '../src/shared-supper.ts'
import * as Storage from '../src/stored-signature.ts'
import * as Shop from '../src/bay-shop-quantity.ts'
import * as Draft from '../src/recipe-draft.ts'
import * as Plan from '../src/recipe-planning.ts'
import * as Capacity from '../src/signature-book.ts'
import {ruCount,traitLabel} from '../src/ru.ts'
import {RecipeBookNavigation, selectedBookId} from '../src/recipe-book-view.ts'
import {isGuardedAction} from '../src/action-click-guard.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'
import {transferBayGoods} from '../src/harbour-economy.ts'
import {renderShopCommissions} from '../src/shop-commissions-ui.ts'

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8')
const between=(text:string,start:string,end:string)=>{
  const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return text.slice(a,b)
}
// Extract the real Book renderer without CSS/art loading, as other pure view tests do.
const book=read('../src/culinary-ui.ts')
const revealed=stripTypeScriptTypes((between(book,'export const escapeRecipeText','export function signatureStudio'))
  .replaceAll('export ','').replaceAll('import.meta.env.BASE_URL','"/"'))
const {signatureBook,recipeActiveOrder}=runInNewContext(revealed+'\n;({signatureBook,recipeActiveOrder:typeof recipeActiveOrder==="function"?recipeActiveOrder:undefined})',
  {...Farm,...Commission,...BookView,...Tasting,...Repeat,...Cook,...Rules,...Picnic,...Harvest,
    ...Supper,...Storage,...Shop,...Draft,...Plan,...Capacity,ruCount,traitLabel})
const opening = JSON.parse(read('./fixtures/home-progress-actions.json'))
const art={icon:()=>'',stock:()=>''}
const cold = (farm:Farm.FarmState) => {
  const restored=Farm.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))
  assert.deepEqual(restored,farm)
  return restored!
}
function earned(spare=false) {
  const player=commissionPlayer(opening)
  const id=player.cook()
  player.shelf(id);player.sale()
  const quote=Commission.getShopCommissionOffers(player.state).find(row=>row.recipeId===id&&row.customer==='bea')!
  assert.deepEqual([quote.quantity,quote.total],[2,44])
  player.act('acceptShopCommission',quote.key)
  player.fruit('apple',2);player.fruit('pear',2);player.visit('village')
  for(let i=0;i<2;i++)player.act('repeatSignature',id)
  assert.deepEqual([player.actions,player.state.day,player.state.coins,player.state.fruit.apple,player.state.fruit.pear,
    player.state.culinary.stock[id]],[122,15,87,0,0,2])
  if(spare){player.fruit('apple',1);player.fruit('pear',1);player.visit('village');player.act('repeatSignature',id)}
  return {player,id,farm:player.state}
}
const decode = (s:string) => s.replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&')
function renderedChoice(html:string) {
  const tag=html.match(/<button[^>]+data-action="recipe-active-order"[^>]*>[^<]+<\/button>/)?.[0]
  const quote=tag?.match(/data-order-quote="([^"]+)"/)?.[1]
  return tag&&quote?{tag,quote:decode(quote),id:tag.match(/data-value="([^"]+)"/)![1]}:undefined
}
const activeCard=(farm:Farm.FarmState,id:string,fromOrders=false) => signatureBook(farm,art,{selectedId:id,mode:'detail'},undefined,fromOrders)

test('an ordinary D15 Book shows the exact matching fully funded order beside current uses, not another unrelated list',()=>{
  const {farm,id}=earned(),before=cold(farm)
  const page=activeCard(farm,id)
  const summary=page.match(/<div class="recipe-book-stock">[\s\S]*?(?=<section class="recipe-book-cooking")/)?.[0]
  assert.ok(summary)
  const choice=renderedChoice(summary)
  assert.ok(choice,'ready exact order is reachable from the existing stock area')
  assert.equal(choice.id,id)
  assert.match(choice.tag,/>К заказу · Беа · нужны 2 порции<\/button>/)
  assert.match(page,/data-action="use-signature" data-value="s1" +>Пикник · 1 порция/)
  assert.match(page,/data-action="taste-signature" data-value="s1" +data-resident="bea"/)
  assert.match(page,/data-action="open-panel" data-value="bay-shop"/)
  assert.deepEqual(farm,before,'opening the recipe never spends, reserves or sails')

  assert.ok(Farm.useSignature(farm,id).ok)
  assert.equal(renderedChoice(activeCard(farm,id)),undefined,'the committed picnic left one, not a covered order')
  const token=String(farm.shopCommissions.serial)
  assert.ok(Commission.deliverShopCommission(farm,token).ok)
  assert.equal(Commission.finishShopCommission(farm,token).ok,false)
  assert.equal(farm.coins,87)
  assert.ok(farm.culinary.picnic)
})

test('partial escrow and exact local split count, while spare bag/warehouse and the real shelf alternative do not prompt',()=>{
  const {farm,id}=earned(), token=String(farm.shopCommissions.serial)
  const split=cold(farm)
  assert.ok(transferBayGoods(split,'deposit','village','signature:'+id,1).ok)
  const splitHtml=activeCard(split,id)
  assert.ok(renderedChoice(splitHtml))
  assert.match(splitHtml,/data-action="recipe-warehouse-withdraw"/)
  assert.deepEqual([Commission.getShopCommissionLine(split,token)?.inBag,Commission.getShopCommissionLine(split,token)?.warehouse],[1,1])
  assert.ok(Commission.deliverShopCommission(split,token).ok)
  assert.equal(split.culinary.stock[id],1,'the existing explicit reserve still takes local warehouse first')
  assert.match(renderedChoice(activeCard(split,id))!.tag,/нужна 1 порция/)
  assert.ok(Commission.deliverShopCommission(split,token).ok)
  assert.equal(renderedChoice(activeCard(split,id)),undefined)
  assert.equal(split.coins,87,'two explicit reserves are not themselves payment')
  assert.ok(Commission.finishShopCommission(split,token).ok);assert.equal(split.coins,131)
  assert.equal(renderedChoice(activeCard(split,id)),undefined)

  const canceled=cold(farm);assert.ok(Commission.cancelShopCommission(canceled,token).ok)
  assert.equal(renderedChoice(activeCard(canceled,id)),undefined)
  const away=cold(farm);assert.ok(Farm.sail(away,'home').ok)
  assert.equal(renderedChoice(activeCard(away,id)),undefined)
  assert.equal(renderedChoice(activeCard(farm,id,true)),undefined,'when Orders opened the Book existing Back suffices')

  const extra=earned(true)
  const enough=cold(extra.farm)
  assert.equal(enough.culinary.stock[id],3)
  assert.equal(renderedChoice(activeCard(enough,id)),undefined)
  assert.ok(transferBayGoods(enough,'deposit','village','signature:'+id,2).ok)
  assert.deepEqual([enough.culinary.stock[id],Commission.getShopCommissionLine(enough,token)?.warehouse],[1,2])
  assert.equal(renderedChoice(activeCard(enough,id)),undefined)
  assert.match(activeCard(enough,id),/data-action="recipe-warehouse-withdraw"/)

  extra.player.shelf(id) // real explicit store transfer; now the exact shelf can supply one missing good
  const stocked=extra.player.state
  assert.deepEqual([stocked.culinary.stock[id],stocked.bayShop.slots[0]?.quantity],[2,1])
  assert.equal(renderedChoice(activeCard(stocked,id)),undefined)
  assert.ok(Farm.useSignature(stocked,id).ok)
  assert.ok(Commission.deliverShopCommission(stocked,token).ok)
  const alternative=Commission.getShopCommissionLine(stocked,token)?.shelf
  assert.ok(alternative)
  const beforeRevenue=stocked.bayShop.revenue
  assert.ok(Commission.deliverShopCommission(stocked,token,alternative.quote).ok)
  assert.equal(stocked.bayShop.revenue,beforeRevenue)
  assert.ok(Commission.finishShopCommission(stocked,token).ok);assert.equal(stocked.coins,131)
})

test('exact mounted Book action opens only the live local order and focuses its heading, never Reserve',()=>{
  const {farm,id}=earned(), before=cold(farm), choice=renderedChoice(activeCard(farm,id))!
  assert.ok(choice)
  const main=read('../src/main.ts')
  const actual=stripTypeScriptTypes("switch(action){"+between(main,"    case 'recipe-active-order':","    case 'recipe-harbour-shop':")+"}")
  assert.equal(isGuardedAction('recipe-active-order'),true,'real double click and held key protection remains in force')
  function run(f:Farm.FarmState, m:'live'|'hidden'|'wrong-card'|'wrong-selected'|'crossing'|'orders-origin'|'closed'|'wrong-panel', quote=choice.quote){
    const before=cold(f), events:string[]=[], heading={focus(){events.push('order-heading')}}, recipeBook=new RecipeBookNavigation()
    assert.ok(recipeBook.select(f,id))
    recipeBook.view={...recipeBook.view,query:'конфитюр',detailScroll:86}
    const chosen={dataset:{orderQuote:quote},closest(selector:string){
      assert.equal(selector,'.signature-page')
      return {dataset:{recipe:m==='wrong-card'?'s2':id}}
    },focus(){events.push('book-trigger')}}
    let html=''
    const ctx={action:'recipe-active-order',value:id,panel:m==='wrong-panel'?'kitchen':'recipes',
      dialog:{open:m!=='closed'},farm:f,control:chosen,recipeBook,recipeActiveOrder,
      selectedBookId: m==='wrong-selected'?()=> 's2':selectedBookId,panelHistory:m==='orders-origin'?[{panel:'shop-commissions'}]:[],
      island:{isCrossing:()=>m==='crossing'},dialogContent:{contains:(b:unknown)=>m!=='hidden'&&b===chosen,
        querySelector:(s:string)=>{assert.equal(s,'.commission-current');return heading}},
      drawPanel(){events.push('refresh')},
      openPanel(next:string,remember=true){assert.equal(next,'shop-commissions');assert.equal(remember,true);events.push('existing-orders')
        html=renderShopCommissions(f,()=>'' )},
      perform(){assert.fail('navigating must not take a gameplay action')},
    }
    runInNewContext(actual,ctx)
    assert.deepEqual(f,before,'route is read-only regardless of revalidation')
    return {events,html}
  }
  const opened=run(farm,'live')
  assert.deepEqual(opened.events,['book-trigger','existing-orders','order-heading'])
  assert.match(opened.html,/Отложено 0\/2/)
  assert.match(opened.html,/За всю партию: 44 монеты/)
  assert.match(opened.html,/data-action="commission-deliver" data-value="1"/)
  assert.doesNotMatch(opened.html,/data-action="commission-finish"/)
  assert.deepEqual(farm,before)
  for(const mode of ['hidden','wrong-card','wrong-selected','crossing','orders-origin','closed','wrong-panel'] as const)
    assert.deepEqual(run(farm,mode).events,[],mode)
  const moved=cold(farm)
  assert.ok(transferBayGoods(moved,'deposit','village','signature:'+id,1).ok)
  assert.deepEqual(run(moved,'live').events,['refresh'],'same total but exact stock changed')
  const fresh=renderedChoice(activeCard(moved,id))!
  assert.notEqual(fresh.quote,choice.quote)
  assert.deepEqual(run(moved,'live',fresh.quote).events,['book-trigger','existing-orders','order-heading'])
  const done=cold(farm)
  assert.ok(Commission.cancelShopCommission(done,'1').ok)
  assert.deepEqual(run(done,'live').events,['refresh'])
  const off=cold(farm)
  assert.ok(Farm.sail(off,'home').ok)
  assert.deepEqual(run(off,'live').events,['refresh'],'an old link never transports the player')
})

test('a different saved recipe or no permitted immediate use remains ordinary, even with an active covered order',()=>{
  const grown=earned(true),p=grown.player,id=grown.id
  for(let i=0;i<2;i++)p.cook(id)
  const active=p.state
  assert.equal(active.culinary.stock[id],5)
  assert.ok(Farm.useSignature(active,id).ok)
  assert.ok(Farm.tasteSignature(active,id,'bea').ok)
  assert.ok(Farm.tasteSignature(active,id,'finn').ok)
  const before=cold(active)
  assert.equal(active.culinary.stock[id],2)
  assert.equal(renderedChoice(activeCard(active,id)),undefined)
  assert.deepEqual(active,before)
  p.fruit('apple',1);p.fruit('pear',1);p.visit('village')
  const other=p.act('completeSignature',{base:'preserves',ingredients:[{id:'apple',quantity:1},{id:'pear',quantity:1}]},
    {family:'preserves',processing:'bright',fruit:[],steps:['mix','pour']}).recipeId as string
  assert.notEqual(other,id)
  assert.equal(Commission.getShopCommission(p.state)?.lines[0].recipeId,id)
  assert.match(activeCard(p.state,other),new RegExp(`data-recipe="${other}"`))
  assert.equal(renderedChoice(activeCard(p.state,other)),undefined)
})
