import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as C from '../src/shop-commissions.ts'
import * as F from '../src/farm.ts'
import { firstCommissionReturnPlayer } from './fixtures/harbour-craft-return.ts'

const source = readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
function part(a:string,b:string) {
  const i=source.indexOf(a),j=source.indexOf(b,i+a.length)
  assert.ok(i>=0 && j>i);return source.slice(i,j)
}
const handlers=stripTypeScriptTypes("function activate(action,value){switch(action){"+
  part("    case 'commission-recipe':","    case 'commission-rest':")+part("    case 'make-signature':","    case 'manual-signature':")+"}}")
const back=stripTypeScriptTypes(part('function focusKey(','function leaveScene(')+part('function goBack(','let harbourScene:'))
const {p,recipeId}=firstCommissionReturnPlayer(false)
p.cook(recipeId);p.act('acceptShopCommission',C.getShopCommissionOffers(p.state)[0].key)
const stocked=structuredClone(p.state)
function trace(mode:'bonus'|'ready'|'pointer'|'other'|'half'|'closed'|'no-stock'|'canceled'|'different'|'wrong-focus') {
  const farm=structuredClone(stocked),line=String(farm.shopCommissions.serial)
  assert.ok(C.deliverShopCommission(farm,line).ok)
  if(mode==='half'||mode==='bonus'){assert.ok(C.cancelShopCommission(farm,line).ok);assert.ok(C.acceptShopCommission(farm,C.getShopCommissionOffers(farm)[0].key).ok);assert.ok((mode==='bonus'?F.useSignature(farm,recipeId):F.tasteSignature(farm,recipeId,'bea')).ok)}
  const token=String(farm.shopCommissions.serial)
  const before=structuredClone(farm),events:string[]=[]
  function button(action:string,value:string,tag=action) {
    return {dataset:{action,value},focus:()=>events.push(tag),getClientRects:()=>[{}],scrollIntoView:()=>events.push('reveal:'+tag)}
  }
  const read=button('commission-recipe',token),reserve=button('commission-deliver',token),other=button('commission-deliver','999'),b=button('make-signature',recipeId)
  const visit={panel:'shop-commissions',signatureSlots:[],marketNextOpen:[],focus:JSON.stringify(Object.entries(read.dataset)),recipeBook:{}}
  const ctx:any={farm,...C,...F,panel:'shop-commissions',dialog:{open:true,querySelectorAll:()=>[read,other,reserve]},dialogContent:{querySelector:()=>null,querySelectorAll:(s:string)=>s.includes('commission-deliver')&&C.getShopCommissionLine(farm,token)?.canDeliver?[other,reserve]:[]},
    document:{activeElement:mode==='wrong-focus'?read:b},control:b,event:{detail:mode==='pointer'?1:0},panelHistory:[],panelRenderVersion:1,recipeBook:{view:{mode:'detail',selectedId:recipeId},load(){}},
    backButton:{hidden:false,dataset:{recipeIndex:'false'},focus:()=>events.push('back')},
    focusRecipeAction(){},openRecipeBook(){ctx.panelHistory.push(visit);ctx.panel='recipes'},
    openPanel(next:string){ctx.panel=next;events.push('open:'+next)},requestAnimationFrame:(f:()=>void)=>f(),restoreFerryPanelView(){},
    perform:(f:()=>{ok:boolean})=>{const r=f();if(r.ok)events.push('one repeat');return r.ok}}
  runInNewContext(handlers+'\n'+back,ctx)
  if(mode==='other'){ctx.panel='recipes';ctx.panelHistory.push({...visit,panel:'journal'})}
  else ctx.activate('commission-recipe',token)
  if(mode==='closed'){ctx.panelHistory.length=0;ctx.panel='recipes'} // Reopened book from the world, no remembered commission.
  ctx.activate('make-signature',recipeId)
  assert.equal(farm.coins,before.coins);assert.equal(farm.culinary.stock[recipeId],before.culinary.stock[recipeId]+(mode==='bonus'?2:1))
  assert.deepEqual(farm.shopCommissions,before.shopCommissions)
  const guided=['bonus','ready','no-stock','canceled','different'].includes(mode)
  assert.deepEqual(events,guided?['one repeat','back']:['one repeat'])
  if(mode==='no-stock')assert.ok(F.useSignature(farm,recipeId).ok) // A different explicit choice spent the portion.
  if(mode==='canceled')assert.ok(C.cancelShopCommission(farm,token).ok) // Stale serial.
  if(mode==='different')ctx.recipeBook.view.selectedId='draft'
  events.length=0;const beforeBack=structuredClone(farm)
  ctx.goBack(true);assert.deepEqual(farm,beforeBack)
  if(mode==='ready'||mode==='bonus')assert.deepEqual(events,['open:shop-commissions','commission-deliver','reveal:commission-deliver'])
  else assert.ok(!events.includes('commission-deliver'),mode)
}

test('the last explicitly cooked portion returns a keyboard player to the exact reserve action without depositing it',()=>{trace('ready');trace('bonus')})
test('ordinary cooking, a half-filled order, pointer input, and a closed visit do not acquire an order handoff',()=>{
  for(const mode of ['other','half','pointer','closed','wrong-focus'] as const)trace(mode)
})
test('Back cannot arm another reserve after spending the portion, canceling the order, or changing recipes',()=>{
  for(const mode of ['no-stock','canceled','different'] as const)trace(mode)
})
