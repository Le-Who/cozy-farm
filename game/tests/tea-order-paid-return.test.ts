import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as C from '../src/culinary.ts'
import { bayProductId } from '../src/bay-product-id.ts'
import { recipePlanningIngredient } from '../src/recipe-planning.ts'
import { rememberRecipeDraft } from '../src/recipe-draft.ts'
import { selectedDailyIntent } from '../src/intent-deadline.ts'
import { signatureBookCapacity } from '../src/signature-book.ts'
import { SalePresentation } from '../src/sale-presentation.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const source=read('../src/main.ts'), scene=read('../src/cookery.ts')
const opening=JSON.parse(read('./fixtures/home-progress-actions.json')), rootOrder='intent:5:delicate'
function between(s:string,a:string,b:string){const start=s.indexOf(a),end=s.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,a);return s.slice(start,end)}
const actions=stripTypeScriptTypes(between(source,'function focusKey(', 'let harbourScene:')+
 between(source,'function rememberCurrentRecipeDraft()', 'const recipeBook =')+
 'async function act(action,value,control){const event={detail:0};switch(action){'+
 between(source,"    case 'fair-jam-picnic':","    case 'open-neighbor':")+
 between(source,"    case 'intent-own-recipe':","    case 'honey-kitchen-recipe':")+
 between(source,"    case 'signature-base':","    case 'signature-home':")+
 between(source,"    case 'back':","    case 'journal-stay':")+
 between(source,"    case 'deliver-intent':","    case 'cook-intent-offer':")+
 '}};({act})')
const cookery=stripTypeScriptTypes(`switch('cookery'){${between(source,"    case 'cookery': {","    case 'village-project':")}}`)
const knownCook=(kind:'silky'|'bright'):C.CookeryResult=>({family:'preserves',processing:kind,fruitTraitsVersion:1,
 fruit:[{ingredientId:'apple',x:.08,y:.12,angle:0},{ingredientId:'pear',x:.2,y:.3,angle:0}],
 steps:['add-fruit','stir-'+kind,'fill-jar'],baking:{method:'stovetop',finish:'set',seconds:18}})
function earned(){
 const p=commissionPlayer(opening.slice(0,53));p.visit('grove');p.act('pickFruit',0);p.visit('home');p.act('pickFruit',0)
 assert.deepEqual([p.actions,p.state.day,p.state.island,p.state.fruit.apple,p.state.fruit.pear,p.state.coins],[57,5,'home',1,1,103])
 assert.equal(F.getCommunityOrders(p.state).find(o=>o.id===rootOrder)?.unlocked,true)
 return p.state
}
type Ticket={name:string;label?:string;primary?:boolean;open():void}
type Options={ onComplete(result:C.CookeryResult):boolean;onCancel():void;returnLabel:string;readyOrder?:()=>Ticket|undefined }
function open(farm:F.FarmState){
 const trace:string[]=[],saves:F.FarmState[]=[],focus:string[]=[]
 const empty='selectedWarehouseRequest selectedExpeditionPort selectedExpeditionOffer selectedWarehouse inventoryGroup boatIsland marketSaleFamily marketSaleQuery marketTab marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot seedPickerBed expandedRepeatId communityOrderId communityResident requestedFood kitchenTart kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish freightPlanOpen journeyDetailsOpen journalDetailsOpen selectedMarketOrder pastryShape workshopRecipe signatureFamily cookingMode communityRequest'.split(' ')
 const heading={tabIndex:0,focus(){focus.push('request-heading')},setAttribute(){},scrollIntoView(){}}
 let opts:Options|undefined
 const x:any={...F,...C,...Object.fromEntries(empty.map(k=>[k,undefined])),farm,selectedDailyIntent,recipePlanningIngredient,rememberRecipeDraft,signatureBookCapacity,bayProductId,
  panel:'intents',panelHistory:[],document:{activeElement:null},HTMLButtonElement:class{},salePresentation:new SalePresentation(),
  dialogContent:{scrollTop:0,innerHTML:'',querySelector:(q:string)=>q.includes('community-intent')?heading:q.endsWith('-host')?{}:null,querySelectorAll:()=>[]},
  dialog:{open:true,querySelectorAll:()=>[]},panelRenderVersion:0,requestAnimationFrame:(fn:()=>void)=>fn(),restoreFerryPanelView(){},recipeBook:{snapshot:()=>({}),load(){}},
  cookingDish:'appleJam',cookingFish:'perch',signatureSlots:[null,null],signatureSlot:0,signatureBase:'tart',signatureRepeatId:undefined,
  island:{isCrossing:()=>false,crossIsland(){throw Error('never travel on paid local receipt')}},
  closeContextualSale:()=>false,returnToRecipeIndex:()=>false,
  openPanel(next:string,remember=true){if(remember&&x.panel)x.panelHistory.push(x.rememberPanel());x.panel=next;x.dialogContent.scrollTop=0
   x.dialog.open=true;x.panelRenderVersion++;trace.push(next)},
  closeDialog(){x.panel=undefined;x.panelHistory.length=0;x.dialog.open=false;trace.push('close')},
  openRecipeBook(id:string,expanded:boolean,remember:boolean){trace.push('book:'+id);x.openPanel('recipes',remember)},
  saveFarm(){saves.push(structuredClone(farm))},drawPanel(){},updateCommunityReturn(){},familyRecipeName:()=>undefined,stockLabel:()=>({name:'',image:''}),iconUrl:()=>'',
  perform(fn:()=>{ok:boolean}){const res=fn();if(res.ok)saves.push(structuredClone(farm));return res.ok},
  createCookery(_host:unknown,options:Options){opts=options},
 }
 const api=runInNewContext(actions,x)
 const act=(name:string,value?:string,order?:string)=>api.act(name,value,{dataset:{action:name,value,order}})
 async function enter(origin='intent'){
  await act('open-intent',rootOrder)
  if(origin==='kitchen'){x.openPanel('kitchen');x.openPanel('signature')}
  else await act('intent-own-recipe')
  await act('signature-base','preserves');await act('signature-fruit','apple');await act('signature-fruit','pear')
  await act('start-signature');assert.equal(x.panel,'cookery')
  runInNewContext(cookery,x);assert.ok(opts)
  trace.length=0;saves.length=0
  return opts
 }
 return {act,enter,x,trace,saves,focus,heading}
}
function offer(farm:F.FarmState,id='s1'){
 const order=F.getCommunityOrders(farm).find(o=>o.id===rootOrder)
 assert.ok(order)
 return order.offers.find(o=>o.id===`signature:${id}`)
}
test('Day 5 prepared tea has an exact read-only return from the paid receipt and hand-in stays separate',async t=>{
 const farm=earned(),u=open(farm),o=await u.enter()
 assert.equal(o.readyOrder?.(),undefined)
 assert.ok(o.onComplete(knownCook('silky')));assert.ok(o.onComplete(knownCook('silky')))
 assert.equal(u.saves.length,1);assert.deepEqual([farm.fruit.apple,farm.fruit.pear,farm.culinary.stock.s1,farm.coins],[0,0,1,103])
 assert.equal(offer(farm)?.available,true);assert.equal(offer(farm)?.reward,31)
 const receipt=o.readyOrder?.()
 t.diagnostic(JSON.stringify({day:5,earnedActions:57,bookAction:o.returnLabel,originalRequest:u.x.communityRequest,localHandIn:offer(farm)?.id,pendingStock:farm.culinary.stock.s1,receipt:receipt?.name??null}))
 assert.ok(receipt,'the paid exact tea recipe must offer its original ready fair request')
 assert.deepEqual([receipt.name,receipt.label,receipt.primary],['Нежное к чаю','К просьбе',true])
 const paid=structuredClone(farm)
 receipt.open();receipt.open()
 assert.equal(u.x.panel,'intent');assert.equal(u.x.communityOrderId,rootOrder)
 assert.deepEqual(u.trace,['intent']);assert.deepEqual(u.focus,['request-heading'])
 assert.deepEqual(u.x.panelHistory.map((x:{panel:string})=>x.panel),['intents'])
 assert.deepEqual(farm,paid);assert.equal(u.saves.length,1)
 await u.act('deliver-intent','signature:s1',rootOrder)
 assert.deepEqual([farm.coins,farm.culinary.stock.s1],[134,0]);assert.equal(u.saves.length,2)
 const handed=structuredClone(farm)
 await u.act('deliver-intent','signature:s1',rootOrder);assert.deepEqual(farm,handed);assert.equal(u.saves.length,2)
})
test('the usual book action and the two ordinary Back steps are independent of a new receipt route',async()=>{
 const f=earned(),a=open(f),o=await a.enter();assert.ok(o.onComplete(knownCook('silky')))
 assert.equal(o.returnLabel,'Мои рецепты')
 o.onCancel();assert.deepEqual(a.trace,['book:s1','recipes']);assert.equal(a.x.panelHistory.length,0)
 const g=earned(),b=open(g),n=await b.enter();assert.ok(n.onComplete(knownCook('silky')))
 await b.act('back');await b.act('back')
 assert.deepEqual(b.trace,['signature','intent']);assert.equal(b.x.communityOrderId,rootOrder)
})

test('ordinary kitchen, an ineligible taste, and a no-longer-owned or live receipt never navigate',async()=>{
 for(const kind of ['ordinary kitchen','ineligible taste','closed','day','different request','sold','served','foreign island','different composer'] as const){
  const farm=earned(),u=open(farm),o=await u.enter(kind==='ordinary kitchen'?'kitchen':'intent')
  assert.ok(o.onComplete(knownCook(kind==='ineligible taste'?'bright':'silky')),kind)
  const receipt=o.readyOrder?.()
  if(kind==='ordinary kitchen'||kind==='ineligible taste'){assert.equal(receipt,undefined,kind);continue}
  assert.ok(receipt,kind)
  if(kind==='closed')u.x.dialog.open=false
  if(kind==='day')assert.ok(F.endDay(farm).ok)
  if(kind==='different request'){u.x.communityRequest={kind:'intent',orderId:'intent:5:portable'};u.x.communityOrderId='intent:5:portable'}
  if(kind==='sold')assert.ok(F.sellSignature(farm,'s1',1).ok)
  if(kind==='served')assert.ok(F.deliverIntentOrder(farm,rootOrder,'signature:s1').ok)
  if(kind==='foreign island')assert.ok(F.sail(farm,'grove').ok)
  if(kind==='different composer')u.x.panelHistory[u.x.panelHistory.length-1]={...u.x.panelHistory.at(-1)}
  const before=structuredClone(farm),previous=u.x.panelHistory.slice()
  assert.equal(o.readyOrder?.(),undefined,kind)
  receipt.open()
  assert.deepEqual(farm,before,kind);assert.deepEqual(u.trace,[],kind);assert.deepEqual(u.focus,[],kind)
  assert.deepEqual(u.x.panelHistory,previous,kind)
 }
})
test('the live receipt makes the existing secondary slot primary without swapping the finished button’s hit target',()=>{
 const display=between(scene,'    if (options.readyOrder && orderButton) {','    sourceCue.hidden')
 const events:string[]=[]; let quote:Ticket|undefined
 const node={hidden:true,textContent:'',nextElementSibling:null as unknown,setAttribute(name:string,value:string){events.push(name+':'+value)}}
 const finish={before(item:typeof node){assert.equal(item,node);events.push('place-primary-before-book');item.nextElementSibling=finish}}
 const x={options:{readyOrder:()=>quote},orderButton:node,finish,model:{stage:'ready'},loaded:true,contextLost:false}
 const frame=()=>runInNewContext(display,x)
 frame();assert.ok(node.hidden);assert.deepEqual(events,[])
 quote={name:'Нежное к чаю',label:'К просьбе',primary:true,open(){}}
 x.model.stage='finished';frame();assert.equal(node.hidden,false);assert.equal(node.textContent,'К просьбе')
 assert.deepEqual(events,['aria-label:К просьбе «Нежное к чаю»','data-primary:true','place-primary-before-book'])
 assert.match(scene,/finish\.querySelector\('span'\)!\.textContent = model.stage === 'finished' \? options.returnLabel/)
 const css=read('../src/cookery.css')
 assert.match(css,/cookery-order\[data-primary="true"\]\{background:/)
 assert.match(css,/cookery-order\[data-primary="true"\]:not\(\[hidden\]\)\) \.cookery-finish/)
 quote=undefined;frame();assert.ok(node.hidden)
})
