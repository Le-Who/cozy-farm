import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes as strip} from 'node:module'
import {test} from 'node:test'
import {runInNewContext as vm} from 'node:vm'
import * as F from '../src/farm.ts'
import * as S from '../src/shared-supper.ts'
import {isGuardedAction} from '../src/action-click-guard.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const main=read('../src/main.ts')
function actual(start:string,end:string) {
  const a=main.indexOf(start),b=main.indexOf(end,a+start.length)
  assert.ok(a>=0&&b>a,start);return main.slice(a,b)
}
const draw=strip("switch('village-meal'){"+actual("    case 'village-meal': {","    case 'fishing': {")+'}')
const dispatch=strip(actual('function finishSharedSupper(','function neighboursCard(')+";switch(action){"+
  actual("    case 'supper-fish':","    case 'cove-choice':")+main.split('\n').find(l=>l.startsWith("    case 'share-meal':"))+'}')
function earned(catchPerch=true) {
  const p=commissionPlayer(JSON.parse(read('./fixtures/home-progress-actions.json')))
  p.visit('home');p.act('specializeFarmhouse','preserves')
  p.fruit('apple',1);p.fruit('pear',1);p.visit('home');p.act('cookDish','orchardPreserves')
  p.visit('grove');p.act('catchFish',true);p.act('deliverHarborOrder')
  while(p.state.day<17)p.night()
  p.fruit('apple',1);p.fruit('pear',1);p.visit('grove');p.act('gatherSeaSalt')
  p.visit('home');p.act('cookDish','orchardPreserves')
  if(catchPerch)p.act('catchFish',true)
  assert.deepEqual([p.actions,p.state.day,p.state.island,p.state.coins,p.state.village.meals,p.state.dishes.orchardPreserves,
    p.state.seaSalt,p.state.fish.perch,p.state.produce.wheat,p.state.handmade.round,p.state.culinary.recipes.length],
    [catchPerch?128:127,17,'home',52,2,1,2,catchPerch?1:0,0,0,0])
  return p
}
type Control={action:string;value:string}
function table(farm:F.FarmState) {
  let choices:Control[]=[]
  const writes:F.FarmState[]=[]
  const node={innerHTML:'',contains:(c:Control)=>choices.includes(c),querySelector:()=>null,scrollTop:0}
  const c={...F,...S,farm,panel:'village-meal',dialog:{open:true},dialogContent:node,pastryShape:'round',fishImage:String,
    dishIcons:{orchardPreserves:'ui-orchard-preserves'},icon:(name:string)=>`<i>${name}</i>`,stockTile:()=>'',pastryChoices:()=>'<select aria-label="Форма"></select>',
    renderHarbourFishChoice:()=>'',signatureResultPicture:()=>'',nav:(x:string)=>x,
    button:(label:string,action:string,ready=true)=>`<button data-action="${action}"${ready?'':' disabled'}>${label}</button>`,
    action:'',value:'',control:null as Control|null,
    perform(fn:()=>F.ActionResult){const result=fn();if(result.ok){writes.push(structuredClone(c.farm));render()}return result.ok}}
  function render() {
    vm(draw,c)
    choices=[...node.innerHTML.matchAll(/data-action="(supper-preserves|supper-signature)" data-value="([^"]+)"/g)].map(([,action,value])=>({action,value}))
  }
  function choose(control:Control) {({action:c.action,value:c.value}=control);c.control=control;vm(dispatch,c)}
  render()
  return {c,writes,render,choose,choice:(action:string)=>choices.find(x=>x.action===action),get markup(){return node.innerHTML}}
}

test('ordinary D17 has one explicit existing-art supper for a carried Orchard jar, or keeps a real +40 parcel',t=>{
  const p=earned();p.visit('village')
  const farm=p.state,before=structuredClone(farm),ui=table(farm)
  assert.equal(p.actions,129)
  t.diagnostic(JSON.stringify({actions:p.actions,day:farm.day,coins:farm.coins,jar:farm.dishes.orchardPreserves,
    fish:farm.fish.perch,salt:farm.seaSalt,button:ui.choice('supper-preserves')?.action??null}))
  assert.equal(F.getVillageMeal(farm).available,false)
  assert.equal(S.getReadySignatureSuppers(farm).length,0)
  assert.match(ui.markup,/Готовое блюдо вместо выпечки/)
  assert.match(ui.markup,/Подать Садовый конфитюр.*1 рыба — окунь.*Отложит заказ на 40 монет/)
  assert.match(ui.markup,/<i>ui-orchard-preserves<\/i>/)
  assert.equal((ui.markup.match(/data-action="supper-preserves"/g)??[]).length,1)
  assert.match(ui.markup,/<details class="shared-supper-pastry"\s*>/)
  assert.equal(isGuardedAction('supper-preserves'),true)
  assert.deepEqual(farm,before);assert.deepEqual(ui.writes,[])
  const stale=ui.choice('supper-preserves')!
  ui.render();ui.choose(stale);assert.deepEqual(ui.writes,[],'detached control cannot serve')
  const active=ui.choice('supper-preserves')!
  ui.choose(active);ui.choose(active)
  const want=structuredClone(before)
  want.dishes.orchardPreserves--;want.fish.perch--;want.village.meals++;want.village.mealOn=17
  want.village.supperDish='orchard-preserves';want.workToday++
  assert.deepEqual(ui.writes,[want]);assert.deepEqual(farm,want)
  assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),want)
  assert.match(ui.markup,/Сегодня общий ужин уже состоялся/)
  assert.doesNotMatch(ui.markup,/data-action="supper-preserves"/)
  assert.ok(F.sail(farm,'grove').ok)
  const now=F.getHarborOrder(farm)!
  assert.equal(now.items.find(x=>x.item.kind==='dishes')?.available,0)
  assert.equal(farm.coins,52);assert.equal(farm.orders.harbor.completed,1)
  const port=earned();port.visit('grove');port.act('deliverHarborOrder')
  assert.deepEqual([port.state.day,port.state.coins,port.state.dishes.orchardPreserves,port.state.seaSalt,port.state.fish.perch,port.state.village.meals],
    [17,92,0,0,1,2])
})

test('ordinary D17 named signature remains distinct, learns its own recipe and preserves the jar for the same paid parcel',()=>{
  const p=earned();p.visit('village')
  const recipeId=p.act('completeSignature',{base:'preserves',ingredients:[{id:'apple',quantity:1},{id:'pear',trait:'frost',quantity:1}]},
    {family:'preserves',processing:'silky',fruit:[],fruitTraitsVersion:1,steps:['mix','pour']}).recipeId
  const f=p.state,ui=table(f),before=structuredClone(f)
  assert.match(ui.markup,/Готовое блюдо вместо выпечки/)
  assert.equal((ui.markup.match(/Готовое блюдо вместо выпечки/g)??[]).length,1)
  assert.ok(ui.choice('supper-preserves'));assert.equal(ui.choice('supper-signature')?.value,recipeId)
  assert.deepEqual(f,before);assert.equal(ui.writes.length,0)
  ui.choose(ui.choice('supper-signature')!)
  assert.equal(ui.writes.length,1);assert.equal(f.culinary.stock[recipeId],0)
  assert.ok(f.culinary.recipes.some(x=>x.id===recipeId))
  assert.deepEqual([f.dishes.orchardPreserves,f.fish.perch,f.seaSalt,f.coins,f.village.meals],[1,0,2,52,3])
  assert.ok(F.sail(f,'grove').ok);assert.ok(F.deliverHarborOrder(f).ok)
  assert.deepEqual([f.day,f.coins,f.orders.harbor.completed,f.village.meals],[17,92,2,3])
})

test('only a currently needed carried jar warns; stale, off-island and missing-stock offers never spend silently',()=>{
  const cash=earned();cash.visit('village')
  const ui=table(cash.state),active=ui.choice('supper-preserves')!
  assert.match(ui.markup,/Отложит заказ на 40 монет/)
  // Actual separate warehouse action changes the quote, not the table. No arbitrary state mutation.
  cash.act('transferBayGoods','deposit','village','seaSalt',1)
  ui.c.farm=cash.state
  const later=structuredClone(cash.state)
  ui.choose(active);assert.deepEqual(ui.writes,[]);assert.deepEqual(cash.state,later,'stale consequence requires a newly rendered choice')
  ui.render();assert.ok(ui.choice('supper-preserves'));assert.doesNotMatch(ui.markup,/Отложит заказ/)
  const local=earned();local.visit('village');local.act('transferBayGoods','deposit','village','dish:orchardPreserves',1)
  assert.equal(table(local.state).choice('supper-preserves'),undefined)
  const noFish=earned(false);noFish.visit('village')
  assert.equal(table(noFish.state).choice('supper-preserves'),undefined)
  const distant=earned()
  assert.equal(table(distant.state).choice('supper-preserves'),undefined)
  const opening=JSON.parse(read('./fixtures/home-progress-actions.json'))
  const firstResident=opening.findIndex((step:{name:string;args:unknown[]})=>step.name==='inviteResident'&&step.args[0]==='bea')
  assert.equal(firstResident,79)
  const early=commissionPlayer(opening.slice(0,firstResident+1))
  early.visit('home');early.act('specializeFarmhouse','preserves')
  early.fruit('apple',1);early.fruit('pear',1);early.visit('home');early.act('cookDish','orchardPreserves')
  early.act('catchFish',true);early.visit('village')
  const oneCottage=early.state,before=structuredClone(oneCottage)
  assert.deepEqual([early.actions,oneCottage.day,F.getVillageHomeCount(oneCottage),oneCottage.dishes.orchardPreserves,oneCottage.fish.perch],[89,8,1,1,1])
  assert.equal(table(oneCottage).choice('supper-preserves'),undefined)
  assert.equal(F.serveOrchardPreservesSupper(oneCottage,'perch').ok,false)
  assert.deepEqual(oneCottage,before)
})

test('a separately owned exact jar still pays the same parcel after supper; no misleading delay, withdrawal or sale',()=>{
  const p=earned(),product='dish:orchardPreserves'
  p.visit('grove');p.act('transferBayGoods','deposit','grove',product,1);p.night()
  p.fruit('apple',1);p.fruit('pear',1);p.visit('home');p.act('cookDish','orchardPreserves');p.visit('village')
  const f=p.state,ui=table(f)
  assert.deepEqual([p.actions,f.day,f.coins,f.dishes.orchardPreserves,f.freight.warehouses.grove[product]],[137,18,52,1,1])
  assert.ok(ui.choice('supper-preserves'))
  assert.doesNotMatch(ui.markup,/Отложит заказ/)
  assert.deepEqual(ui.writes,[])
  ui.choose(ui.choice('supper-preserves')!)
  assert.deepEqual([f.dishes.orchardPreserves,f.freight.warehouses.grove[product],f.seaSalt,f.coins,f.orders.harbor.completed],[0,1,2,52,1])
  assert.ok(F.sail(f,'grove').ok)
  // Player's ordinary, separate dock actions from the same earned state.
  p.act('transferBayGoods','withdraw','grove',product,1);p.act('deliverHarborOrder')
  assert.deepEqual([p.state.day,p.state.coins,p.state.dishes.orchardPreserves,p.state.seaSalt,p.state.orders.harbor.completed],[18,92,0,0,2])
})
