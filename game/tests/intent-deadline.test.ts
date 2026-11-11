import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { createServer } from 'vite'
import { canReturnToDailyIntent, renderIntentDeadline, renderSelectedIntentRest, selectedDailyIntent } from '../src/intent-deadline.ts'
import { deliverIntentOrder, endDay, getCommunityOrders, getMarketOrders, restoreFarm } from '../src/farm.ts'
import { ActionClickGuard, ActivationKeyGuard, isGuardedAction } from '../src/action-click-guard.ts'
import { intentDeadlineFixture } from './fixtures/intent-deadline.ts'
const reload = (farm:ReturnType<typeof intentDeadlineFixture>['farm']) => restoreFarm(JSON.parse(JSON.stringify(farm)))!
function prepared() { const {farm,orderId}=intentDeadlineFixture();return {farm,orderId,selection:{kind:'intent' as const,orderId}} }

test('the selected unfinished request is read-only, reloadable and names the in-game deadline',()=>{
  const {farm,selection,orderId}=prepared(),before=structuredClone(farm)
  for(let n=0;n<3;n++){
    assert.equal(selectedDailyIntent(farm,selection)?.id,orderId)
    const html=renderSelectedIntentRest(farm,selection)
    assert.match(html,/Ещё не выполнено: «Садовый пикник»/);assert.match(html,/После «До утра» эта просьба сменится/)
    assert.match(html,/Блюда в сумке останутся/);assert.match(html,/data-value="intent:6:fruit"/)
    assert.doesNotMatch(html,/data-action="(?:sleep|deliver-intent|request-start-cook)"/)
  }
  assert.deepEqual(farm,before);assert.equal(renderSelectedIntentRest(reload(farm),selection),renderSelectedIntentRest(farm,selection))
  assert.match(renderIntentDeadline(farm),/игровой день 6/)
})

test('no selection, a neighbor, an old ID, a locked fair or a fulfilled request gets no warning',()=>{
  const {farm,selection}=prepared()
  for(const other of [undefined,{kind:'neighbor' as const},{kind:'intent' as const,orderId:'intent:5:fruit'}]){
    assert.equal(selectedDailyIntent(farm,other),undefined);assert.equal(renderSelectedIntentRest(farm,other),'')
  }
  const locked=structuredClone(farm);locked.projects.fair={}
  assert.equal(renderSelectedIntentRest(locked,selection),'')
  assert.equal(deliverIntentOrder(farm,selection.orderId,'signature:s1').ok,true)
  assert.equal(renderSelectedIntentRest(farm,selection),'');assert.ok(reload(farm))
})

test('the existing morning changes the request but preserves bag food and refuses the old delivery without reward',()=>{
  const {farm,selection}=prepared(),stock=structuredClone(farm.culinary.stock),neighbors=structuredClone(farm.neighbors),orders=getMarketOrders(farm)
  assert.equal(endDay(farm).ok,true)
  assert.equal(selectedDailyIntent(farm,selection),undefined);assert.equal(renderSelectedIntentRest(farm,selection),'')
  assert.deepEqual(farm.culinary.stock,stock);assert.deepEqual(farm.neighbors,neighbors)
  assert.deepEqual(getMarketOrders(farm),orders,'unfinished market orders do not inherit the daily intent deadline')
  const before=structuredClone(farm);assert.equal(deliverIntentOrder(farm,selection.orderId,'signature:s1').ok,false);assert.deepEqual(farm,before)
  assert.equal(renderSelectedIntentRest(reload(farm),selection),'')
  assert.ok(getCommunityOrders(farm).every(order=>order.id!==selection.orderId))
})

test('separate delivery spends exactly one portion; a second delivery and its warning are unavailable',()=>{
  const {farm,selection}=prepared(),count=farm.culinary.stock.s1,coins=farm.coins
  const offer=selectedDailyIntent(farm,selection)!.offers.find(offer=>offer.id==='signature:s1')!
  assert.equal(deliverIntentOrder(farm,selection.orderId,offer.id).ok,true)
  assert.equal(farm.culinary.stock.s1,count-1);assert.equal(farm.coins,coins+offer.reward)
  const before=structuredClone(farm);assert.equal(deliverIntentOrder(farm,selection.orderId,offer.id).ok,false);assert.deepEqual(farm,before)
  assert.equal(renderSelectedIntentRest(farm,selection),'')
})

test('the rest link validates its selected ID, current day, shore and still-open panel',()=>{
  const {farm,selection}=prepared(),context={panel:'rest',open:true},before=structuredClone(farm)
  assert.equal(canReturnToDailyIntent(farm,selection,selection.orderId,context),true)
  for(const bad of [{...context,panel:'intent'},{...context,open:false}])assert.equal(canReturnToDailyIntent(farm,selection,selection.orderId,bad),false)
  assert.equal(canReturnToDailyIntent(farm,selection,undefined,context),false)
  assert.equal(canReturnToDailyIntent(farm,{kind:'intent',orderId:'intent:6:hearty'},selection.orderId,context),false)
  const away={...farm,island:'village' as const};assert.equal(canReturnToDailyIntent(away,selection,selection.orderId,context),false)
  assert.deepEqual(farm,before);endDay(farm);assert.equal(canReturnToDailyIntent(farm,selection,selection.orderId,context),false)
})

const text=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),source=ts.createSourceFile('main.ts',text,ts.ScriptTarget.Latest,true)
let clause:ts.CaseClause|undefined
function visit(node:ts.Node){if(ts.isCaseClause(node)&&node.expression.getText(source)==="'rest-intent-request'")clause=node;ts.forEachChild(node,visit)}
visit(source);assert.ok(clause)
const js=ts.transpileModule(`(async()=>{switch('rest-intent-request'){${clause.getText(source)}}})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText

test('the actual handler returns to the request, regardless of which recipe was highlighted, without crafting, submitting or sleeping',async()=>{
  for(const food of [undefined,'dish:appleJam','signature:s1']){
    const {farm,selection}=prepared(),before=structuredClone(farm),routes:string[]=[]
    const state={farm,communityRequest:selection,requestedFood:food,value:selection.orderId,panel:'rest',dialog:{open:true},canReturnToDailyIntent,resumeCommunityRequest:async(mode:string)=>{routes.push(mode)}}
    await runInNewContext(js,state);assert.deepEqual(routes,['request']);assert.deepEqual(farm,before);assert.equal(state.requestedFood,food)
    state.dialog.open=false;await runInNewContext(js,state);assert.deepEqual(routes,['request'])
    state.dialog.open=true;endDay(farm);await runInNewContext(js,state);assert.deepEqual(routes,['request'])
  }
  assert.match(text,/case 'rest':[\s\n]*dialogContent.innerHTML = `\$\{renderSelectedIntentRest/,'selected pending request precedes other rest forecasts')
  assert.match(text,/const deadline = selectedDailyIntent\(farm, communityRequest\)/)
})

test('a return gesture cannot also deliver from the redrawn request card',()=>{
  assert.equal(isGuardedAction('rest-intent-request'),true)
  const guard=new ActionClickGuard(),event={detail:1,timeStamp:100,clientX:100,clientY:120}
  guard.remember(event);assert.equal(guard.blocks({...event,detail:2,timeStamp:180}),true)
  assert.equal(guard.blocks({...event,detail:0,timeStamp:190}),false)
  const keys=new ActivationKeyGuard();assert.equal(keys.blocks({key:'Enter',repeat:false},true),false)
  assert.equal(keys.blocks({key:'Enter',repeat:true},false),true);keys.release('Enter');assert.equal(keys.blocks({key:'Enter',repeat:false},false),false)
})

test('the real daily board and card explain the deadline; ongoing neighbor meetings never do',async()=>{
  const server=await createServer({server:{middlewareMode:true},appType:'custom'})
  try{
    const {communityBoard,communityIntent,neighborDetail}=await server.ssrLoadModule('/src/community-ui.ts')
    const {farm,selection}=prepared(),before=structuredClone(farm),art={icon:()=>'',offerIcon:()=>''}
    assert.match(communityBoard(farm,art),/Просьбы на игровой день 6/)
    assert.match(communityIntent(farm,selection.orderId,art),/После «До утра» они сменятся/)
    assert.doesNotMatch(neighborDetail(farm,'bea',art),/Просьбы на игровой день|эта просьба сменится|они сменятся/)
    assert.deepEqual(farm,before)
  }finally{await server.close()}
})
