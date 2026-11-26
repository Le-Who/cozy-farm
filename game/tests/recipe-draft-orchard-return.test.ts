import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { bayProductId } from '../src/bay-product-id.ts'
import { getRequirementHint } from '../src/requirement-guidance.ts'
import { recipePlanningIngredient } from '../src/recipe-planning.ts'
import { rememberRecipeDraft } from '../src/recipe-draft.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const main=read('../src/main.ts'), opening=JSON.parse(read('./fixtures/home-progress-actions.json'))
const orderId='intent:5:delicate', req={kind:'stock' as const,item:{kind:'fruit' as const,item:'apple' as const,quantity:1}}
function cut(source:string,a:string,b:string) {
  const start=source.indexOf(a),end=source.indexOf(b,start+a.length)
  assert.ok(start>=0&&end>start,a);return source.slice(start,end)
}
const actual=stripTypeScriptTypes(
  cut(main,'function focusKey(', 'let harbourScene:')+
  cut(main,'function rememberCurrentRecipeDraft()', 'const recipeBook =')+
  cut(main,'async function showRequirement(', '// Scene handlers own material sounds.')+
  'async function act(action,value,control,event={detail:0}){switch(action){'+
  cut(main,"    case 'fair-jam-picnic':","    case 'open-neighbor':")+
  cut(main,"    case 'intent-own-recipe':","    case 'honey-kitchen-recipe':")+
  cut(main,"    case 'signature-base':","    case 'signature-home':")+
  cut(main,"    case 'show-requirement':","    case 'picnic-field':")+
  cut(main,"    case 'pick-fruit':","    case 'upgrade-building':")+
  cut(main,"    case 'back':","    case 'journal-stay':")+
  '}};({act})')
function earned(){
  const p=commissionPlayer(opening.slice(0,53))
  p.visit('grove');p.act('pickFruit',0);p.visit('home')
  assert.deepEqual([p.actions,p.state.day,p.state.fruit.apple,p.state.fruit.pear,p.state.coins],[56,5,0,1,103])
  assert.equal(F.getCommunityOrders(p.state).find(o=>o.id===orderId)?.unlocked,true)
  assert.equal(p.state.trees.home[0]!.fruitReady,2)
  assert.equal(p.state.trees.home[0]!.trait,'rainbow')
  assert.match(read('../src/community-ui.ts'),/Свой рецепт`, 'intent-own-recipe'/)
  assert.match(main,/case 'signature': dialogContent.innerHTML=signatureStudio\(farm,signatureBase,signatureSlots,signatureSlot,\{icon,stock:stockTile\}/)
  assert.match(read('../src/culinary-ui.ts'),/class="ingredients recipe-cost"[^\n]*action.items.map\(art.stock\)/)
  return p
}
function mount(farm:F.FarmState) {
  const trace:string[]=[],saves:F.FarmState[]=[],world:unknown[]=[]
  const empty='selectedWarehouseRequest selectedExpeditionPort selectedExpeditionOffer selectedWarehouse inventoryGroup boatIsland marketSaleFamily marketSaleQuery marketTab marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot seedPickerBed expandedRepeatId communityOrderId communityResident requestedFood kitchenTart kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish freightPlanOpen journeyDetailsOpen journalDetailsOpen selectedMarketOrder pastryShape workshopRecipe cookingDish cookingFish signatureFamily cookingMode communityRequest'.split(' ')
  const saved=(x:F.FarmState)=>JSON.parse(JSON.stringify(x))
  class Button {
    disabled=false
    readonly dataset:{action:string;value?:string}
    readonly cost:boolean
    constructor(dataset:{action:string;value?:string},cost=false){this.dataset=dataset;this.cost=cost}
    closest(q:string){return this.cost&&q.includes('recipe-cost')?this:null}
    focus(){x.document.activeElement=this}
    getClientRects(){return [{}]}
  }
  const ingredient=new Button({action:'show-requirement',value:'apple-source'},true)
  const slot=new Button({action:'signature-slot',value:'0'})
  let sourceFocused=0
  const x:any={...F,...Object.fromEntries(empty.map(k=>[k,undefined])),farm,bayProductId,getRequirementHint,recipePlanningIngredient,rememberRecipeDraft,
    island:{focusTarget:(place:unknown)=>world.push(place),async crossIsland(fn:()=>boolean){trace.push('cross');return fn()}},
    fieldViewButton:{getAttribute:()=> 'false'},signatureSlots:[null,null],signatureSlot:0,signatureBase:'tart',signatureRepeatId:undefined,
    panel:'intents',panelHistory:[],document:{activeElement:null},HTMLButtonElement:Button,
    dialogContent:{scrollTop:0,contains:(n:Button)=>x.panel==='signature'&&n===ingredient,
      querySelector:function(q:string){if(q==='[data-action="pick-fruit"]'&&x.panel==='tree')return {focus(){sourceFocused++}}
        return q.includes('.recipe-portion')&&x.panel==='signature'?slot:null},querySelectorAll:()=>[]},
    dialog:{open:true,querySelectorAll(){return x.panel==='signature'&&farm.fruit.apple===0?[ingredient,slot]:x.panel==='signature'?[slot]:[]}},
    requirementLinks:new Map([['apple-source',req]]),recipeBook:{load(){},snapshot(){return{}}},restoreFerryPanelView(){},
    drawPanel(){x.panelRenderVersion++},panelRenderVersion:0,requestAnimationFrame:(cb:()=>void)=>cb(),
    closeContextualSale:()=>false,returnToRecipeIndex:()=>false,
    closeDialog(){trace.push('close');x.dialog.open=false;x.panel=undefined;x.panelHistory.length=0},
    openPanel(next:string,remember=true){if(remember&&x.panel)x.panelHistory.push(x.rememberPanel());x.panel=next;x.dialogContent.scrollTop=0;
      x.dialog.open=true;x.document.activeElement=null;trace.push(next);x.panelRenderVersion++},
    perform(fn:()=>F.ActionResult){const r=fn();if(r.ok)saves.push(saved(farm));return r.ok},
    saveFarm(){saves.push(saved(farm))}, highlightControl(n:{focus():void}|null){n?.focus()},
    notify(){},bayAudio:{},orchardPickSound:()=>'',playBaySound(){},
  }
  const {act:fn}=runInNewContext(actual,x)
  const act=(name:string,value?:string,button=new Button({action:name,value}))=>fn(name,value,button)
  return {x,act,ingredient,slot,trace,saves,world,sourceFocus:()=>sourceFocused}
}
const draft=(x:any)=>({base:x.signatureBase,ingredients:JSON.parse(JSON.stringify(x.signatureSlots))})
async function chooseOrderDraft(play:ReturnType<typeof mount>){
  await play.act('open-intent',orderId);await play.act('intent-own-recipe');await play.act('signature-base','preserves')
  await play.act('signature-fruit','apple');await play.act('signature-fruit','pear')
  assert.equal(play.x.panel,'signature');assert.equal(play.x.communityRequest.orderId,orderId)
  assert.deepEqual(draft(play.x),{base:'preserves',ingredients:[{id:'apple',quantity:1},{id:'pear',quantity:1}]})
}

for(const pick of [false,true])test('earned tea-order draft keeps its ingredient choice at the local apple tree, '+(pick?'pick explicitly':'cancel preview'),async t=>{
  const p=earned(),f=p.state,play=mount(f);await chooseOrderDraft(play)
  const before=structuredClone(f), writes=play.saves.length
  assert.equal(F.getSignatureAction(f,draft(play.x)).available,false)
  assert.equal(getRequirementHint(f,req).action.target,'visit-tree')
  play.ingredient.focus();play.x.dialogContent.scrollTop=38
  await play.act('show-requirement','apple-source',play.ingredient)
  assert.equal(play.x.panel,'tree','the ingredient click must open the reachable tree without closing the cooking draft')
  assert.equal(play.x.treeSlot,0);assert.equal(play.sourceFocus(),1)
  assert.deepEqual(play.world,[]);assert.equal(play.trace.includes('cross'),false)
  assert.deepEqual(f,before);assert.equal(play.saves.length,writes)
  if(pick) await play.act('pick-fruit','0')
  const afterPick=structuredClone(f)
  await play.act('back')
  assert.equal(play.x.panel,'signature');assert.equal(play.x.dialogContent.scrollTop,38)
  assert.equal(play.x.document.activeElement,pick?play.slot:play.ingredient,'focus is the old source or the non-spending selected portion')
  assert.deepEqual(draft(play.x),{base:'preserves',ingredients:before.recipeDraft!.slots})
  assert.deepEqual(f,afterPick);assert.equal(play.saves.length,writes+Number(pick))
  assert.equal(F.getSignatureAction(f,draft(play.x)).available,pick)
  if(pick){
    assert.deepEqual([f.fruit.apple,f.fruit.pear,f.variants.apple?.rainbow,f.coins],[1,1,1,103])
    const made=F.completeSignature(f,draft(play.x),{family:'preserves',processing:'silky',fruit:[],steps:['stir','pour']})
    assert.equal(made.ok,true);assert.equal(f.coins,103)
    await play.act('back');assert.equal(play.x.panel,'intent');assert.equal(play.x.communityRequest.orderId,orderId)
    const id=`signature:${made.recipeId}` as const
    assert.equal(F.getCommunityOrders(f).find(o=>o.id===orderId)?.offers.find(o=>o.id===id)?.reward,31)
    assert.equal(F.deliverIntentOrder(f,orderId,id).ok,true)
    assert.equal(f.coins,134);assert.equal(F.deliverIntentOrder(f,orderId,id).ok,false)
    assert.equal(f.variants.apple?.rainbow,1,'ordinary fraction only, rare harvest remains unused')
  }
  t.diagnostic(JSON.stringify({day:5,earned:56,path:play.trace,pick,craftAndDeliverExplicit:pick,coins:f.coins,route:'no trip'}))
})

test('the draft reuses only the ready local ordinary tree and keeps paid, stored, or away paths explicit',()=>{
  const p=earned()
  assert.equal(getRequirementHint(p.state,req,'recipe-draft').action.target,'inspect-tree')
  assert.equal(getRequirementHint(p.state,req,'saved-recipe').action.target,'inspect-tree')
  assert.equal(getRequirementHint(p.state,req).action.target,'visit-tree')
  const before=structuredClone(p.state)
  p.visit('grove')
  assert.deepEqual(getRequirementHint(p.state,req,'recipe-draft').action,{label:'Домой',target:'sail',value:'home'})
  assert.deepEqual(p.state,{...before,island:'grove'})
  p.visit('home');p.act('pickFruit',0)
  const bag=structuredClone(p.state)
  assert.notEqual(getRequirementHint(p.state,req,'recipe-draft').action.target,'inspect-tree')
  assert.deepEqual(p.state,bag)
  p.act('transferBayGoods','deposit','home','apple',1);p.night()
  const stored=structuredClone(p.state)
  assert.equal(getRequirementHint(p.state,req,'recipe-draft').action.target,'warehouse-supply')
  assert.deepEqual(p.state,stored)
})
