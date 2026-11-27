import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as C from '../src/shop-commissions.ts'
import {getDiscoveryTask} from '../src/discovery-path.ts'
import {getGuidanceTask} from '../src/discovery-guidance.ts'
import {renderDiscoveryGuidance} from '../src/discovery-preferences-ui.ts'
import {getRecipeRepeatGuide} from '../src/recipe-repeat-guidance.ts'
import {getRequirementHint} from '../src/requirement-guidance.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

type Step = {name:string;args:unknown[]}
const opening: Step[] = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const seen={collections:true,islands:true}
const task=(farm:F.FarmState)=>getDiscoveryTask(farm,seen)!
const bytes=(state:F.FarmState)=>JSON.stringify(state)
const read=(from:string,to:string)=>{
 const i=main.indexOf(from),j=main.indexOf(to,i+from.length)
 assert.ok(i>=0&&j>i,from)
 return main.slice(i,j)
}
const code=stripTypeScriptTypes(read('function currentTask()','function status()')
 +read('function openRecipeBook(','\nfunction updateRecipeBookSearch(')
 +`\nasync function activate(action,value,control){
 ${read("  if (action === 'follow-task') {","  switch (action) {")}
 switch (action) {
 ${read("    case 'visit-tree': {","    case 'pet':")}
 default: taps.push(['dispatch',action,value])
 }
 }; activate`)

function navy(){
 const p=commissionPlayer(opening.slice(0,68).map(s=>s.name==='workBed'?{...s,args:[s.args[0],1000]}:s))
 p.visit('grove')
 for(let i=0;i<2;i++){const cast=p.act('beginFishingTrip');p.act('finishFishingTrip',cast.token,1)}
 p.visit('home');p.act('contributeVillage');p.act('deliverMarketOrder','pantry')
 p.act('sendFerryExpedition','mill-buy');p.night();p.act('receiveFerryExpedition');p.act('contributeVillage')
 assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.village.built],[80,9,78,true])
 p.visit('village');p.act('inviteResident','bea',0)
 const id=p.cook()
 p.shelf(id);p.sale()
 assert.equal(p.state.bayShop.memories.bea.purchases['signature:'+id]?.liked,1)
 const offer=C.getShopCommissionOffers(p.state)[0]
 assert.deepEqual([offer.recipeId,offer.total,offer.quantity,p.state.coins],[id,44,2,97])
 return {p,id,offer}
}

function routes(farm:F.FarmState){
 const taps:unknown[]=[]
 const env={farm:{...farm,orientation:seen},getDiscoveryTask,getGuidanceTask,taps,
  openPanel:(...args:unknown[])=>taps.push(['panel',...args]),focusRecipeAction:()=>taps.push(['focus','recipe-action']),
  activateTarget:(target:unknown)=>taps.push(['target',target]),revealTreeStorageReturn:()=>{},dialogContent:{}}
 const activate=runInNewContext(code,env)
 return {taps,follow:()=>activate('follow-task',undefined,{dataset:{action:'follow-task'}})}
}

test('a real D10 shop order starts with a local ripe apple and the exact Home recipe before the delivery crossing',async()=>{
 const {p,id,offer}=navy()
 p.act('acceptShopCommission',offer.key);p.night()
 p.fruit('pear',1);p.visit('home')
 const f=p.state,snapshot=bytes(f), customer=C.getShopCommission(f)!
 assert.deepEqual([f.day,f.fruit.apple,f.fruit.pear,f.trees.home[0]?.fruitReady,customer.delivered,customer.lines[0].inBag,customer.lines[0].warehouse],
  [10,0,2,2,0,0,0])
 assert.deepEqual(getRecipeRepeatGuide(f,id)?.missing,[{kind:'fruit',item:'apple',quantity:1}])
 assert.deepEqual(getRequirementHint(f,{kind:'stock',item:{kind:'fruit',item:'apple',quantity:1}}).action,
  {label:'К плодовому дереву',target:'visit-tree',value:'0'})
 assert.deepEqual(task(f).action,{label:'К плодовому дереву',target:'visit-tree',value:'0'})
 assert.match(renderDiscoveryGuidance(f.discoveryPreferences,task(f),task(f)).focus,/data-action="follow-task"[^>]*>К плодовому дереву<\/button>/)
 const harvest=routes(f);await harvest.follow()
 assert.deepEqual(JSON.parse(JSON.stringify(harvest.taps)),[['target',{kind:'tree',index:0}]])
 assert.equal(bytes(f),snapshot,'looking at the tree is not a harvest or a crossing')

 p.act('pickFruit',0)
 assert.deepEqual(task(p.state).action,{label:'Открыть рецепт',target:'commission-home-recipe',value:id})
 const beforeBook=bytes(p.state),book=routes(p.state)
 await book.follow()
 assert.deepEqual(book.taps,[['panel','recipes',true,'home','page.unfold',id],['focus','recipe-action']])
 assert.equal(bytes(p.state),beforeBook,'preview does not cook, withdraw, or spend')
 p.act('repeatSignature',id)
 assert.equal(p.state.coins,97);assert.equal(p.state.culinary.stock[id],1)
 assert.deepEqual(task(p.state).action,{label:'В Лавандовую гавань',target:'sail',value:'village'})
 p.visit('village')
 assert.deepEqual(task(p.state).action,{label:'К заказу лавки',target:'open-panel',value:'shop-commissions'})
 p.act('deliverShopCommission',String(customer.serial))
 assert.deepEqual([C.getShopCommission(p.state)?.delivered,p.state.coins,p.state.culinary.stock[id]],[1,97,0])
})

test('unaccepted, unresolved, ready-to-hand-off, or ready-to-claim orders keep their old route',()=>{
 const {p,id,offer}=navy()
 assert.notEqual(task(p.state).id,'shop-commission','a first sale is only an offer, not an accepted obligation')
 p.act('acceptShopCommission',offer.key);p.night()
 const legacy=JSON.parse(bytes(p.state));delete legacy.shopCommissions
 assert.equal(F.restoreCurrentFarm(legacy),undefined,'a current save cannot silently omit transactional state')
 const restored=F.restoreFarm(legacy)!
 assert.ok(restored)
 assert.equal(C.getShopCommission(restored),undefined)
 assert.notEqual(task(restored).id,'shop-commission','an older save without recorded acceptance does not assume an active order')
 const sail={label:'В Лавандовую гавань',target:'sail',value:'village'}
 assert.deepEqual(task(p.state).action,sail,'two shortages are not represented as one local fix')
 p.fruit('pear',1);p.visit('home');p.act('pickFruit',0)
 const saturated={...p.state,workToday:Number.MAX_SAFE_INTEGER}
 assert.deepEqual(task(saturated).action,sail,'no room to prepare locally; leave the ordinary merchant route intact')
 p.visit('village')
 assert.equal(F.getSignatureAction(p.state,p.state.culinary.recipes[0]).available,true,'normal village cooking still works')
 assert.equal(task(p.state).action.target,'open-panel')
 p.act('repeatSignature',id)
 p.visit('home')
 assert.deepEqual(task(p.state).action,sail,'a ready portion should head to the actual handoff')
 p.visit('village')
 const serial=String(p.state.shopCommissions.serial)
 p.act('deliverShopCommission',serial)
 p.cook(id);p.act('deliverShopCommission',serial)
 assert.equal(C.getShopCommission(p.state)?.canClaim,true)
 p.visit('home')
 assert.deepEqual(task(p.state).action,sail,'completed escrow still heads to the real claim')
 assert.equal(p.state.coins,97,'a prepared and held party has not paid yet')
 p.visit('village');p.act('finishShopCommission',serial)
 assert.equal(p.state.coins,141)
})

test('a genuinely listed spare portion keeps the harbour route instead of suggesting another cook',()=>{
 const {p,id,offer}=navy()
 p.act('acceptShopCommission',offer.key)
 p.night();p.fruit('pear',2);p.visit('home');p.night();p.act('pickFruit',0);p.visit('village')
 p.act('repeatSignature',id);p.shelf(id)
 p.fruit('apple',1);p.fruit('pear',1);p.visit('home')
 assert.equal(F.getSignatureAction(p.state,p.state.culinary.recipes[0]).available,true)
 assert.equal(p.state.culinary.stock[id],0)
 assert.equal(p.state.bayShop.slots[0]?.product.id,'signature:'+id)
 assert.equal(p.state.bayShop.slots[0]?.quantity,1)
 assert.deepEqual(task(p.state).action,{label:'В Лавандовую гавань',target:'sail',value:'village'})
 const before=structuredClone(p.state)
 assert.equal(C.deliverShopCommission(p.state,String(p.state.shopCommissions.serial)).ok,false)
 assert.deepEqual(p.state,before,'the preview does not break the independent shelf owner')
})
