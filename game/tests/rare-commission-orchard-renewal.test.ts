import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {test} from 'node:test'
import * as F from '../src/farm.ts'
import {getRequirementHint} from '../src/requirement-guidance.ts'
import {getShopCommission,getShopCommissionOffers} from '../src/shop-commissions.ts'
import {bayProductId} from '../src/bay-product-id.ts'
import {getClimate} from '../src/climate.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8')
const opening=JSON.parse(read('./fixtures/home-progress-actions.json'))
const main=read('../src/main.ts')
const cut=(a:string,b:string)=>{
  const start=main.indexOf(a),end=main.indexOf(b,start+a.length)
  assert.ok(start>=0&&end>start);return main.slice(start,end)
}
const apple={kind:'variants',item:'apple',trait:'frost',quantity:1} as const
const requirement={kind:'stock',item:apple} as const
const clause='К спелым плодам'
function earned() {
  const p=commissionPlayer(opening)
  p.fruit('apple',2);p.fruit('pear',2);p.visit('home')
  const receipt={family:'preserves',processing:'silky',fruit:[],steps:['mix','pour']}
  assert.equal(p.act('completeSignature',{base:'preserves',ingredients:[{id:'apple',quantity:1},{id:'pear',quantity:1}]},receipt).recipeId,'s1')
  p.act('useSignature','s1')
  assert.equal(p.act('completeSignature',{base:'preserves',ingredients:[{id:'apple',quantity:1,trait:'frost'},{id:'pear',quantity:1}]},
    {...receipt,fruitTraitsVersion:1}).recipeId,'s2')
  p.visit('village');p.shelf('s2');p.sale()
  const offer=getShopCommissionOffers(p.state).find(row=>row.recipeId==='s2')!
  assert.deepEqual([offer.customer,offer.quantity,offer.total],['bea',2,52])
  p.act('acceptShopCommission',offer.key);p.act('deliverShopCommission','1')
  assert.deepEqual([p.state.day,p.state.coins,getShopCommission(p.state)?.delivered],[16,91,1])
  return p
}
function blocked(day=40) {
  const p=earned()
  while(p.state.day<day)p.night()
  p.visit('village')
  assert.equal(p.state.trees.home[0]?.trait,'rainbow')
  assert.equal(p.state.variants.apple?.frost,undefined)
  return p
}
function mount(farm:F.FarmState,panel='recipes'){
  const program=stripTypeScriptTypes(cut('function requirementLink(', 'const islandNames =')+
    cut('function stockLabel(', 'function recipeDestination(')+
    cut('async function showRequirement(', '// Scene handlers own material sounds.')+';({showRequirement,stockTile})')
  const opens:unknown[]=[], effects:unknown[]=[], reqs=new Map()
  const picker={}
  const ctx={...F,farm,panel,requirementLinks:reqs,getRequirementHint,bayProductId,getBerryNurserySource:()=>undefined,icon:()=>'<i></i>',
    escapeHtml:(s:string)=>s,closeDialog:()=>opens.push('close'),dialog:{open:true},island:{crossIsland:async (fn:()=>unknown)=>fn()},
    panelTitles:{},treeSlot:-1,fieldViewButton:{getAttribute:()=> 'false'},
    perform:(fn:()=>{ok:boolean})=>{effects.push('cross');return fn().ok},
    openPanel:(panel:string)=>opens.push(panel),highlightControl:(element:unknown)=>effects.push(element===picker?'focus-pick':'focus-other'),
    dialogContent:{querySelector:(selector:string)=>selector==='[data-action="pick-fruit"]'?picker:null},notify:(text:string)=>effects.push(text)}
  const api=runInNewContext(program,ctx)
  return {api,ctx,opens,effects,reqs}
}
test('earned exact order replaces generic weather with an actionable existing ingredient link and a review only',async()=>{
  const p=blocked(),farm=structuredClone(p.state), before=structuredClone(farm)
  const {api,ctx,opens,effects,reqs}=mount(farm)
  const hint=getRequirementHint(farm,requirement,'saved-recipe')
  assert.deepEqual([hint.action.target,hint.action.value,hint.sourceLabel],['sail','home',clause])
  const html=api.stockTile(apple)
  assert.equal((html.match(/<button/g)??[]).length,1)
  assert.match(html,/data-action="show-requirement".*?data-recipe-ingredient="variants:apple:frost".*?К спелым плодам/)
  assert.match(html,/Морозное яблоко.*0\/1/)
  assert.deepEqual(farm,before)
  await api.showRequirement(reqs.get('0'))
  assert.deepEqual(opens,['close','tree'])
  assert.equal(ctx.treeSlot,0)
  assert.deepEqual(effects,['cross','focus-pick','Соберите спелые плоды: их особенность уже не сменится.'])
  assert.deepEqual(farm,{...before,island:'home'},'review and focus never harvest or change the existing order')
  assert.equal(getShopCommission(farm)?.delivered,1)
})
test('waiting keeps the old fruit; deliberate harvest before the same suitable dawn keeps it and enables the actual paid outcome',()=>{
  const waiting=blocked(), progress=blocked()
  waiting.night();assert.equal(waiting.state.day,41);assert.equal(getClimate(41).weather,'snow')
  assert.equal(waiting.state.trees.home[0]?.trait,'rainbow');assert.equal(waiting.state.variants.apple?.frost,undefined)
  const heldRainbow=progress.state.variants.apple?.rainbow??0
  progress.visit('home')
  progress.act('pickFruit',0)
  assert.equal(progress.state.variants.apple?.rainbow,heldRainbow+1)
  assert.equal(getRequirementHint(progress.state,requirement).sourceLabel,undefined,'no advertised blocked harvest without ripe fruit')
  progress.night();assert.equal(progress.state.day,41)
  assert.equal(progress.state.trees.home[0]?.trait,'frost')
  const ready=getRequirementHint(progress.state,requirement)
  assert.equal(ready.sourceLabel,undefined);assert.match(ready.notice!,/Уже можно собрать: Морозное яблоко/)
  progress.act('pickFruit',0);progress.visit('village');progress.act('repeatSignature','s2');progress.act('deliverShopCommission','1')
  assert.equal(getShopCommission(progress.state)?.canClaim,true)
  const money=progress.state.coins
  progress.act('finishShopCommission','1');assert.equal(progress.state.coins,money+52)
  assert.equal(progress.state.variants.apple?.rainbow,heldRainbow+1)
})
test('open orchard, exact local stock, or a non-recipe surface do not show the blocking repeat action',()=>{
  const p=blocked()
  assert.doesNotMatch(mount(p.state,'inventory').api.stockTile(apple),/К спелым плодам/)
  p.visit('home');p.act('buyAndPlantTree',1,'apple')
  assert.equal(getRequirementHint(p.state,requirement).sourceLabel,undefined,'another reachable apple tree can grow the trait')
  const fresh=blocked()
  fresh.visit('home');fresh.act('pickFruit',0);fresh.night();fresh.act('pickFruit',0)
  assert.equal(getRequirementHint(fresh.state,requirement).sourceLabel,undefined,'an owned ingredient is not a blocker')
  fresh.act('transferBayGoods','deposit','home','variants:apple:frost',1)
  assert.equal(getRequirementHint(fresh.state,requirement).action.target,'warehouse-supply')
  assert.equal(getRequirementHint(fresh.state,requirement).sourceLabel,undefined)
})
