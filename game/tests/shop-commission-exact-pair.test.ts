import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import test from 'node:test'
import * as F from '../src/farm.ts'
import * as C from '../src/shop-commissions.ts'
import * as tasting from '../src/signature-tasting-guidance.ts'
import {getStoredSignature} from '../src/stored-signature.ts'
import {getRecipeRepeatGuide,recipeIngredientsDisclosureLabel} from '../src/recipe-repeat-guidance.ts'
import {signatureBookCapacity} from '../src/signature-book.ts'
import {signatureFruitNames,signatureProcessingDefinitions} from '../src/culinary.ts'
import {ruCount} from '../src/ru.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8')
const ui=read('../src/culinary-ui.ts'), main=read('../src/main.ts')
function section(source:string,a:string,b:string){
  const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j)
}
const renderer=runInNewContext(stripTypeScriptTypes(
  section(ui,'export const escapeRecipeText','export const ingredientArt').replace('export ','')+'\n'+
  section(ui,'const control=','\n')+'\n'+section(ui,'const capacityDescription','export function recipeBookSearchStatus')+
  '\nbookRecipe'),
 {...F,...tasting,...C,getStoredSignature,getRecipeRepeatGuide,recipeIngredientsDisclosureLabel,signatureBookCapacity,
  ruCount,signatureFruitNames,signatureProcessingDefinitions,signatureResultPicture:()=>'',ingredientName:()=>'',finishedIcon:()=>'',ingredientArt:()=>'',recipeBookSupper:()=>'',renderPicnicOffer:()=>''})
const routes=stripTypeScriptTypes(`function press(action,value,control){switch(action){${
  section(main,"    case 'commission-recipe':","    case 'commission-rest':")+
  section(main,"    case 'batch-signature':","    case 'favorite-signature':")
}}}
function renderBook(){switch('recipes'){${section(main,"    case 'recipes':","    case 'signature': dialogContent")}}}
`)
function earned() {
  const p=commissionPlayer(JSON.parse(read('./fixtures/home-progress-actions.json')))
  const id=p.cook();p.shelf(id);p.sale()
  const offer=C.getShopCommissionOffers(p.state).find(o=>o.customer==='bea'&&o.recipeId===id)!
  assert.deepEqual([offer.quantity,offer.total],[2,44])
  p.act('acceptShopCommission',offer.key)
  p.fruit('apple',2);p.fruit('pear',2);p.visit('village')
  assert.deepEqual([p.actions,p.state.day,p.state.island,p.state.coins,p.state.fruit.apple,p.state.fruit.pear],
    [120,15,'village',87,2,2])
  return {p,id,token:String(p.state.shopCommissions.serial)}
}
function sheet(farm:F.FarmState,id:string,token:string,fromOrder=true){
  const recipe=farm.culinary.recipes.find(r=>r.id===id)!, writes:F.FarmState[]=[]
  const ctx:any={...F,...C,farm,recipeBook:{view:{selectedId:id,mode:'detail'}},panel:fromOrder?'shop-commissions':'recipes',
    dialog:{open:true},dialogContent:{innerHTML:'',contains:(node:unknown)=>node===ctx.control},
    panelHistory:[],expandedRepeatId:undefined,icon:()=>'',stockTile:()=>'',island:{isCrossing:()=>false},
    event:{detail:1},document:{activeElement:null},backButton:{hidden:false,dataset:{recipeIndex:'false'},focus(){}},focusRecipeAction(){},
    signatureBook(_farm:unknown,art:unknown,view:unknown,pair:unknown){return renderer(farm,recipe,art,view,pair)},
    drawPanel(){ctx.renderBook()},
    openRecipeBook(selected:string){
      assert.equal(selected,id);ctx.panelHistory.push({panel:'shop-commissions'})
      ctx.panel='recipes';ctx.renderBook()
    },
    perform(action:()=>F.ActionResult){
      const done=action()
      if(done.ok){assert.ok(F.restoreCurrentFarm(farm));writes.push(structuredClone(farm));ctx.renderBook()}
      return done.ok
    },
  }
  runInNewContext(routes,ctx)
  if(fromOrder)ctx.press('commission-recipe',token,{dataset:{}})
  else ctx.renderBook()
  return {ctx,writes,html:()=>ctx.dialogContent.innerHTML as string,pressTriple(){ctx.press('batch-signature',id,{dataset:{}})},pressPair(raw:string){
    const control={dataset:{commissionRepeatQuote:raw}};ctx.control=control;ctx.press('batch-signature',id,control)
  }}
}
const unescapeAttr=(s:string)=>s.replaceAll('&#39;',"'").replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&')
function readPair(markup:string){
  return markup.match(/data-commission-repeat-quote="([^"]+)"/)?.[1]
}

test('earned D15 first order can make exactly two in one deliberate recipe action, not deliver or pay them',t=>{
  const {p,id,token}=earned(), farm=p.state,before=structuredClone(farm)
  const beforeLine=C.getShopCommissionLine(farm,token)!
  assert.deepEqual([beforeLine.remaining,beforeLine.inBag,beforeLine.warehouse,farm.culinary.picnic],[2,0,0,null])
  const seen=sheet(farm,id,token)
  assert.deepEqual(farm,before)
  const html = seen.html()
  assert.match(html,/data-action="make-signature" data-value="s1"/)
  t.diagnostic(JSON.stringify({day:farm.day,actions:p.actions,coins:farm.coins,apple:farm.fruit.apple,pear:farm.fruit.pear,
   exactPair:!!readPair(html),pairEnabled:html.includes('Партия ×2')}))
  assert.match(html,/Расход: 2 набора · Выход: 2 порции/)
  assert.doesNotMatch(html,/Партия ×3/)
  const raw=readPair(html);assert.ok(raw)
  assert.equal(seen.writes.length,0)
  const twoSingles=structuredClone(farm)
  assert.ok(F.repeatSignature(twoSingles,id,undefined,1).ok)
  assert.ok(F.repeatSignature(twoSingles,id,undefined,1).ok)
  seen.pressPair(unescapeAttr(raw))
  assert.equal(seen.writes.length,1)
  assert.deepEqual(farm,twoSingles)
  assert.deepEqual(farm.shopCommissions,before.shopCommissions)
  assert.equal(farm.coins,87)
  assert.equal(readPair(seen.html()),undefined)
  seen.pressPair(unescapeAttr(raw));assert.equal(seen.writes.length,1)
  assert.equal(C.deliverShopCommission(farm,token).ok,true)
  assert.equal(C.deliverShopCommission(farm,token).ok,true)
  assert.equal(farm.coins,87)
  assert.equal(C.finishShopCommission(farm,token).ok,true)
  assert.equal(farm.coins,131)
})

test('ordinary book, already active double yield, a stale order and genuinely enabled triple retain their different options',()=>{
  const {p,id,token}=earned(), ordinary=structuredClone(p.state)
  assert.doesNotMatch(sheet(ordinary,id,token,false).html(),/data-commission-repeat-quote/)
  assert.equal(F.repeatSignature(ordinary,id,undefined,2).ok,false)
  assert.deepEqual(ordinary,p.state)
  const clicked=sheet(p.state,id,token)
  const raw=readPair(clicked.html());assert.ok(raw)
  assert.ok(F.repeatSignature(p.state,id).ok)
  const afterOne=structuredClone(p.state)
  clicked.pressPair(unescapeAttr(raw))
  assert.equal(clicked.writes.length,0);assert.deepEqual(p.state,afterOne)

  const mature=earned()
  mature.p.fruit('apple',3);mature.p.fruit('pear',3);mature.p.visit('village')
  const tripleView=sheet(mature.p.state,id,token), triple=tripleView.html()
  assert.doesNotMatch(triple,/data-commission-repeat-quote/)
  assert.match(triple,/data-action="batch-signature" data-value="s1" +>Партия ×3/)

  const threeSingles=structuredClone(mature.p.state)
  assert.ok(F.repeatSignature(threeSingles,id,undefined,3).ok)
  tripleView.pressTriple()
  assert.equal(tripleView.writes.length,1)
  assert.deepEqual(mature.p.state,threeSingles)
  const picnic=earned()
  picnic.p.fruit('apple',4);picnic.p.visit('village')
  const spare=picnic.p.act('completeSignature',{base:'preserves',ingredients:[{id:'apple',quantity:2}]},
    {family:'preserves',processing:'silky',fruit:[],steps:['mix','pour']}).recipeId as string
  assert.notEqual(spare,id)
  picnic.p.act('useSignature',spare)
  assert.deepEqual([picnic.p.state.fruit.apple,picnic.p.state.fruit.pear],[2,2])
  const doubled=sheet(picnic.p.state,id,token).html()
  assert.doesNotMatch(doubled,/data-commission-repeat-quote/)
  assert.match(doubled,/Повторить ×1 · 2 порции/)
  assert.match(doubled,/data-action="batch-signature" data-value="s1" disabled +>Партия ×3/)
  assert.ok(F.repeatSignature(picnic.p.state,id).ok)
  assert.deepEqual([picnic.p.state.fruit.apple,picnic.p.state.fruit.pear,picnic.p.state.culinary.stock[id],picnic.p.state.culinary.picnic],[1,1,2,null])
})
