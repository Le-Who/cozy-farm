import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as farmApi from '../src/farm.ts'
import { transferBayGoods } from '../src/harbour-economy.ts'
import { getMarketOrderBoard, renderMarketOrderPicker } from '../src/market-orders-view.ts'
import { getNextMarketOrders } from '../src/market-return.ts'
import { workshopToolGuide } from '../src/workshop-controls.ts'

// Existing source-fixture seam: real UI callbacks/receipt with inert scene adapters,
// public domain actions and canonical save restore. Not a native gesture/GL test.
const source = (path:string) => ts.createSourceFile(path,readFileSync(new URL(path,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true)
const main=source('../src/main.ts'),workshop=source('../src/workshop.ts')
const js=(text:string)=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
function find(file:ts.SourceFile,predicate:(node:ts.Node)=>boolean){let found:ts.Node|undefined;function visit(n:ts.Node){if(!found&&predicate(n))found=n;ts.forEachChild(n,visit)}visit(file);assert.ok(found);return found}
const panelCase=find(main,n=>ts.isCaseClause(n)&&n.expression.getText(main)==="'workshop'"&&n.getText(main).includes('createWorkshop'))
const update=find(workshop,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='updateState')
const bake=find(workshop,n=>ts.isCallExpression(n)&&n.expression.getText(workshop)==='bakeButton.addEventListener')
const orderClick=find(workshop,n=>ts.isCallExpression(n)&&n.expression.getText(workshop)==='orderButton.addEventListener')
const finished=find(workshop,n=>ts.isIfStatement(n)&&n.expression.getText(workshop)==="stage === 'baking'"&&n.getText(workshop).includes('surface.setBaked'))
const tick=find(workshop,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='tick') as ts.FunctionDeclaration
// Run the actual frame clock and completion block, not an uncapped test-only delta.
const tickStatements=tick.body!.statements
const clockEnd=tickStatements.findIndex(n=>n.getText(workshop).startsWith('setBaySoundContact('))
assert.ok(clockEnd>0)
const frameClock=tickStatements.slice(0,clockEnd).map(n=>n.getText(workshop)).join('\n')
const focusListeners:ts.CallExpression[]=[]
function collectFocusListeners(n:ts.Node){if(ts.isCallExpression(n)&&n.expression.getText(workshop)==='document.addEventListener')focusListeners.push(n);ts.forEachChild(n,collectFocusListeners)}
collectFocusListeners(workshop)
const close=find(workshop,n=>ts.isVariableDeclaration(n)&&n.name.getText(workshop)==='close')
const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
function earned(bread=false){
 const farm=farmApi.createFarm(),commands={...farmApi,transferBayGoods} as Record<string,Function>
 let count=0
 for(const action of opening){if(action.name==='bakeWorkshop')break;const result=commands[action.name](farm,...action.args);assert.ok(result.ok,result.message);assert.deepEqual(farmApi.restoreCurrentFarm(structuredClone(farm)),farm);count++}
 assert.equal(count,66);assert.equal(farm.day,8);assert.equal(farm.produce.wheat,4);assert.equal(farm.eggs,3)
 if(bread)assert.ok(farmApi.specializeFarmhouse(farm,'bakery').ok)
 assert.deepEqual(farmApi.restoreCurrentFarm(structuredClone(farm)),farm)
 return farm
}
function handoff(farm:farmApi.FarmState,recipe:'bread'|'pastry',shape:farmApi.WorkshopShape){
 const saved:farmApi.FarmState[]=[],handlers:Record<string,(event:{detail:number})=>void>={},announcements:string[]=[]
 let options:any,returns=0,now=1000,focusCalls=0
 const focusHandlers=new Map<string,Function>(),body={},document={body,activeElement:body,hasFocus:()=>true,addEventListener:(type:string,handler:Function)=>focusHandlers.set(type,handler)}
 const sounds:string[]=[],baked:number[]=[],risen:number[]=[]
 const mainState:any={farm,workshopRecipe:recipe,pastryShape:shape,panel:'workshop',workshopGame:undefined,...farmApi,
  dialogContent:{innerHTML:'',querySelector(){return {}}},createWorkshop(_host:unknown,value:any){options=value;return {destroy(){}}},
  leaveScene(){returns++;state.destroyed=true},perform(action:()=>farmApi.ActionResult){const result=action();if(result.ok)saved.push(structuredClone(farm));return result.ok}}
 runInNewContext(js(`switch('workshop'){${panelCase.getText(main)}}`),mainState)
 assert.ok(options,'earned stock opens actual workshop callback')
 const element=()=>({disabled:false,hidden:false,textContent:'',innerHTML:'',dataset:{},setAttribute(){}})
 const state:any={document,bakeKeyboardFocus:false,options,dishDefinitions:farmApi.dishDefinitions,stage:'working',chosenShape:shape,shapeNames:{round:'Круглая булочка',long:'Батон',folded:'Слойка'},destroyed:false,committed:false,contextLost:false,cutPending:false,assetsReady:true,work:.2,mixed:1,selected:0,activeTool:'knead',hand:{down:false},handMenuExpanded:false,
  root:{dataset:{},setAttribute(){}},shapeButtons:[],toolButtons:[],hotspots:[],resultLabel:element(),handButton:element(),handMenu:element(),orderButton:{...element(),hidden:true,addEventListener(_type:string,handler:()=>void){handlers.order=handler}},modeTitle:element(),hint:element(),bakeButton:{...element(),addEventListener(id:string,fn:(event:{detail:number})=>void){handlers[id]=fn},focus(){focusCalls++;document.activeElement=state.bakeButton}},signal:new AbortController().signal,
  pieces:[{mass:1,dirty:true,offset:new Float32Array(1),velocity:new Float32Array(1),mesh:{geometry:{}}}],
  performance:{now:()=>now},lastTime:now,elapsed:0,bakeStartedAt:0,workshopToolGuide,updateSpriteBoxes(){},rebuildMixSurface(){},positionHandMenu(){},updateCue(){},fitBakeLabel(){},surface:{setCrustRoughness(){},setBaked(amount:number){baked.push(amount)}},prepareDoughBaking(){return {}},recognize(){return shape},release(){},playBaySound(id:string){sounds.push(id)},announce(v:string){announcements.push(v)},mix(){},bakeElapsed:0,delta:0,ovenLight:{intensity:0},THREE:{MathUtils:{smoothstep:(n:number)=>n}},riseDough(_geometry:unknown,_baking:unknown,amount:number){risen.push(amount)}}
 runInNewContext(js(`${update.getText(workshop)}; const ${close.getText(workshop)}; ${bake.getText(workshop)};${orderClick.getText(workshop)};${focusListeners.map(n=>n.getText(workshop)).join(';')}; function advance(now){${frameClock};${finished.getText(workshop)}}`),state)
 return {state,options,mainState,order:()=>handlers.order({detail:1}),saved,announcements,sounds,baked,risen,focusCalls:()=>focusCalls,input:(type:string,event:any={})=>focusHandlers.get(type)?.(event),elapseWithoutFrame:(seconds:number)=>{now+=seconds*1000},frameAt:(milliseconds:number)=>{now=1000+milliseconds;state.advance(now)},click:(detail=1)=>{if(!state.destroyed){handlers.click({detail});if(state.bakeButton.disabled&&document.activeElement===state.bakeButton)document.activeElement=body}},advance:(seconds:number)=>{now+=seconds*1000;state.advance(now)},back:()=>options.onCancel(),returns:()=>returns}
}

test('bread receipt names the actual granted dish for every chosen sculptural form',()=>{
 for(const shape of farmApi.workshopShapes){
  const farm=earned(true),before=structuredClone(farm),h=handoff(farm,'bread',shape)
  h.click();assert.equal(h.state.stage,'baking');assert.equal(farm.dishes.farmhouseBread,1);assert.deepEqual(farm.handmade,before.handmade)
  h.advance(4);assert.equal(h.state.stage,'finished')
  assert.equal(h.state.resultLabel.textContent,'Домашний хлеб · в запасах')
  assert.match(h.state.hint.textContent,/Партия уже в запасах/)
  assert.match(h.announcements.at(-1)!,/добавлена в запасы фермы/)
 }
})

test('manual shaped batch grants one chosen pastry, repeated Bake/Finish and Back do not pay twice',()=>{
 const farm=earned(),before=structuredClone(farm),h=handoff(farm,'pastry','folded')
 h.state.pieces.push({...h.state.pieces[0],mass:.5});h.click();h.click();h.click()
 assert.equal(h.saved.length,1);assert.equal(farm.handmade.folded,1);assert.equal(farm.produce.wheat,before.produce.wheat-2);assert.equal(farm.eggs,before.eggs-1)
 assert.equal(farm.workToday,before.workToday+1);assert.deepEqual(farm.workshopPatterns,['folded']);assert.equal(farm.dishes.farmhouseBread,0)
 h.advance(4);assert.equal(h.state.resultLabel.textContent,'Слойка · в запасах')
 const once=structuredClone(farm);h.click();h.click();h.back();assert.deepEqual(farm,once);assert.equal(h.saved.length,1)
 assert.deepEqual(farmApi.restoreCurrentFarm(structuredClone(farm)),farm)
})

test('explicit Bake is the atomic payment point; early return/reload/day neither refunds nor replays output',()=>{
 const farm=earned(true),before=structuredClone(farm),h=handoff(farm,'bread','long')
 h.click();assert.equal(h.state.stage,'baking');assert.equal(h.state.bakeElapsed,0)
 assert.equal(farm.produce.wheat,before.produce.wheat-2);assert.equal(farm.eggs,before.eggs-1);assert.equal(farm.dishes.farmhouseBread,1)
 h.click();h.back();assert.equal(h.saved.length,1);assert.deepEqual(h.saved[0],farm)
 const restored=farmApi.restoreCurrentFarm(structuredClone(h.saved[0]))!;assert.deepEqual(restored,farm)
 assert.ok(farmApi.endDay(restored).ok);assert.equal(restored.dishes.farmhouseBread,1)
 assert.deepEqual(farmApi.restoreCurrentFarm(structuredClone(restored)),restored)
 const next=handoff(restored,'bread','long'),unchanged=structuredClone(restored);next.back();assert.deepEqual(restored,unchanged);assert.equal(next.saved.length,0)
})

test('closing an unbaked scene, pending cut, lost context and denied payment never grant output',()=>{
 for(const guard of ['back','contextLost','cutPending','short-stock'] as const){
  const farm=earned(true),h=handoff(farm,'bread','long')
  if(guard==='short-stock')assert.ok(farmApi.sellMarketItem(farm,'produce:wheat',4).ok)
  const before=structuredClone(farm)
  if(guard==='back')h.back();else{if(guard!=='short-stock')h.state[guard]=true;h.click()}
  assert.deepEqual(farm,before);assert.equal(h.saved.length,0);assert.equal(h.state.committed,false)
  if(guard==='short-stock')assert.equal(h.state.stage,'working')
 }
})


test('four-second presentation finishes at normal and throttled frame rates, without uncapping physics',()=>{
 for(const step of [1000/60,100,1000]){
  const farm=earned(true),h=handoff(farm,'bread','long');h.click();const settled=structuredClone(farm)
  for(let t=step;t<3999;t+=step){h.frameAt(t);assert.equal(h.state.stage,'baking')}
  h.frameAt(4000);assert.equal(h.state.stage,'finished',`${step}ms frames must finish at four wall-clock seconds`)
  assert.ok(h.state.elapsed<=Math.ceil(4000/step)*.035+1e-8,'physics delta remains capped at 35ms')
  assert.equal(h.baked.at(-1),1);assert.equal(h.risen.at(-1),1);assert.ok(Math.abs(h.state.ovenLight.intensity)<1e-8)
  h.frameAt(12000);assert.equal(h.saved.length,1);assert.deepEqual(farm,settled)
  assert.deepEqual(h.sounds,['cook.oven-in','cook.oven-out'])
 }
})

test('baking starts at the accepted click, not a stale previous frame or time spent mixing',()=>{
 const farm=earned(true),h=handoff(farm,'bread','long')
 h.elapseWithoutFrame(20);h.click();h.advance(0);assert.equal(h.state.stage,'baking');assert.equal(h.state.bakeElapsed,0)
 h.advance(3.999);assert.equal(h.state.stage,'baking');h.advance(.001);assert.equal(h.state.stage,'finished')
})

test('a hidden or suspended frame gap catches up the paid receipt once on resume',()=>{
 const farm=earned(true),h=handoff(farm,'bread','long');h.click();h.advance(.5)
 const settled=structuredClone(farm),physics=h.state.elapsed
 h.elapseWithoutFrame(60);assert.equal(h.state.stage,'baking');assert.deepEqual(farm,settled)
 h.advance(0);assert.equal(h.state.stage,'finished');assert.ok(h.state.elapsed-physics<=.035+1e-8)
 assert.equal(h.baked.at(-1),1);assert.equal(h.risen.at(-1),1)
 h.advance(60);assert.deepEqual(farm,settled);assert.equal(h.saved.length,1)
 assert.deepEqual(h.sounds,['cook.oven-in','cook.oven-out'])
})

test('closing a paid presentation retires its clock; reopening does not consume or grant again',()=>{
 const farm=earned(true),h=handoff(farm,'bread','long');h.click();h.advance(.25);const settled=structuredClone(farm)
 h.back();h.advance(60);assert.equal(h.state.stage,'baking');assert.deepEqual(h.sounds,['cook.oven-in']);assert.deepEqual(farm,settled)
 const reopened=handoff(farm,'bread','long');reopened.advance(60);assert.equal(reopened.state.stage,'working');assert.equal(reopened.saved.length,0)
 reopened.back();assert.deepEqual(farm,settled);assert.equal(h.saved.length,1)
})


test('short visibility gaps keep the remaining presentation time and first post-deadline frame finishes once',()=>{
 const farm=earned(true),h=handoff(farm,'bread','long');h.click();h.advance(.5);const settled=structuredClone(farm)
 h.elapseWithoutFrame(2);assert.equal(h.state.stage,'baking');assert.equal(h.saved.length,1)
 h.advance(0);assert.equal(h.state.stage,'baking');assert.equal(h.state.bakeElapsed,2.5)
 h.click();h.advance(1.499);assert.equal(h.state.stage,'baking')
 h.advance(.4);assert.equal(h.state.stage,'finished');assert.deepEqual(h.sounds,['cook.oven-in','cook.oven-out'])
 h.advance(100);assert.deepEqual(h.sounds,['cook.oven-in','cook.oven-out']);assert.deepEqual(farm,settled);assert.equal(h.saved.length,1)
})


test('keyboard-started Bake restores Done once after the disabled control loses focus',()=>{
 const farm=earned(true),h=handoff(farm,'bread','long');h.state.document.activeElement=h.state.bakeButton;h.click(0)
 assert.equal(h.state.document.activeElement,h.state.document.body);assert.equal(h.focusCalls(),0)
 h.advance(3.999);assert.equal(h.focusCalls(),0);h.advance(.001)
 assert.equal(h.state.document.activeElement,h.state.bakeButton);assert.equal(h.focusCalls(),1);assert.equal(h.state.bakeButton.disabled,false)
 h.advance(20);assert.equal(h.focusCalls(),1);assert.equal(h.saved.length,1)
 assert.match(h.announcements.at(-1)!,/Выпечка готова/)
})

test('pointer or unfocused programmatic Bake never claims completion focus',()=>{
 for(const detail of [0,1]){
  const h=handoff(earned(true),'bread','long');if(detail===1)h.state.document.activeElement=h.state.bakeButton
  h.click(detail);h.advance(4);assert.equal(h.focusCalls(),0);assert.equal(h.state.document.activeElement,h.state.document.body)
 }
})

test('later pointer, fresh keyboard or focused-control intent cancels automatic Done focus',()=>{
 for(const action of ['pointer','key','focus']){
  const h=handoff(earned(true),'bread','long');h.state.document.activeElement=h.state.bakeButton;h.click(0)
  if(action==='pointer')h.input('pointerdown')
  if(action==='key')h.input('keydown',{repeat:false,key:'Tab'})
  if(action==='focus'){const target={};h.state.document.activeElement=target;h.input('focusin',{target});h.state.document.activeElement=h.state.document.body}
  h.advance(4);assert.equal(h.focusCalls(),0,action);assert.equal(h.state.document.activeElement,h.state.document.body)
 }
})

test('holding the initiating key does not cancel focus return; disposal or context loss does',()=>{
 const h=handoff(earned(true),'bread','long');h.state.document.activeElement=h.state.bakeButton;h.click(0);h.input('keydown',{repeat:true,key:'Enter'});h.advance(4);assert.equal(h.focusCalls(),1)
 for(const outcome of ['cancel','contextLost','background']){
  const h=handoff(earned(true),'bread','long');h.state.document.activeElement=h.state.bakeButton;h.click(0)
  if(outcome==='cancel')h.back();else if(outcome==='contextLost')h.state.contextLost=true;else h.state.document.hasFocus=()=>false
  h.advance(4);assert.equal(h.focusCalls(),0,outcome);assert.equal(h.saved.length,1)
 }
})

function extraWheat(farm:farmApi.FarmState) {
 assert.ok(farmApi.selectSeed(farm,'wheat').ok)
 for(let day=0;day<6;day++){
  const a=farmApi.getBedAction(farm,0)
  if(a.kind==='plant'||a.kind==='harvest')assert.ok(farmApi.workBed(farm,0).ok)
  if(farm.produce.wheat>=6)return
  if(farmApi.getBedAction(farm,0).kind==='water')assert.ok(farmApi.workBed(farm,0).ok)
  assert.ok(farmApi.endDay(farm).ok)
 }
 throw Error('No earned wheat')
}

test('the loaf that fills the Bread Basket offers its existing exact order, never delivery or a second cooking session',()=>{
 const farm=earned(true), h=handoff(farm,'bread','long'), ctx=h.mainState, events:string[]=[]
 assert.equal(farmApi.getHomeBreadBasket(farm)?.status,'waiting')
 assert.equal(h.state.orderButton.hidden,true);h.order();assert.equal(farm.dishes.farmhouseBread,0)
 h.click();const paid=structuredClone(farm);assert.equal(h.state.orderButton.hidden,true);h.order()
 assert.deepEqual([farm.dishes.farmhouseBread,farm.produce.wheat,farm.eggs],[1,2,2])
 h.frameAt(4000);assert.equal(h.state.orderButton.textContent,'К заказу «Хлебная корзина»');assert.equal(h.state.orderButton.hidden,false)
 assert.equal(h.state.resultLabel.textContent,'Домашний хлеб · в запасах');assert.equal(h.state.bakeButton.innerHTML,'<span>Готово</span>')
 // Run the real market-order detail, with simple icon/ingredient adapters.
 Object.assign(ctx,{dialog:{open:true},island:{isCrossing:()=>false},getMarketOrderBoard,renderMarketOrderPicker,getNextMarketOrders,
  selectedMarketOrder:'garden',marketTab:'buy',pickedMarketOrder:'garden',numberFormat:new Intl.NumberFormat('ru'),ruPlural:()=> 'монет',
  icon:()=>'',marketOrderStockTile:(item:farmApi.StockItem)=>farmApi.marketKey(item),button:(label:string,action:string,enabled:boolean,meta:{value:string})=>'<button data-action="'+action+'" data-value="'+meta.value+'" '+(enabled?'':'disabled')+'>'+label+'</button>',
  openPanel(next:string,remember:boolean){assert.equal(remember,false,'replace finished receipt, retaining its existing kitchen return');ctx.panel=next;ctx.dialogContent.innerHTML=ctx.marketOrders();events.push(next)},
  dialogContent:{innerHTML:'',querySelector:(q:string)=>{assert.equal(q,'.market-order-detail');return{focus:()=>events.push('focus'),scrollIntoView:()=>events.push('scroll')}}}})
 const orderCard=find(main,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='marketOrders')
 runInNewContext(js(orderCard.getText(main)),ctx)
 h.order();assert.deepEqual(events,['market','focus','scroll']);assert.equal(ctx.marketTab,'orders');assert.equal(ctx.pickedMarketOrder,'garden')
 assert.match(ctx.dialogContent.innerHTML,/<h2 id="order-specialty">Хлебная корзина<\/h2>/)
 assert.match(ctx.dialogContent.innerHTML,/data-action="deliver-order" data-value="specialty" >Доставить/)
 assert.deepEqual(farm,paid);assert.equal(h.saved.length,1);h.order();assert.deepEqual(events,['market','focus','scroll'])
})

test('no extra receipt action for already-ready, insufficient remaining wheat, today’s delivered basket or a different bakery order',()=>{
 for(const example of ['already-ready','not-enough','delivered','different'] as const) {
  const farm=earned(true)
  if(example==='not-enough')assert.ok(farmApi.sellMarketItem(farm,'produce:wheat',1).ok)
  else {
   extraWheat(farm);assert.ok(farmApi.cookDish(farm,'farmhouseBread').ok)
   if(example!=='already-ready')assert.ok(farmApi.deliverMarketOrder(farm,'specialty').ok)
   if(example==='different'){assert.ok(farmApi.endDay(farm).ok);assert.equal(farmApi.getHomeBreadBasket(farm),undefined)}
  }
  const before=structuredClone(farm), h=handoff(farm,'bread','long')
  h.click(); h.frameAt(4100);assert.equal(h.state.stage,'finished',example);assert.equal(h.state.orderButton.hidden,true,example)
  assert.equal(h.options.readyOrder(),undefined);h.order();assert.equal(farm.dishes.farmhouseBread,before.dishes.farmhouseBread+1)
  h.click();assert.equal(h.returns(),1,'normal Done survives');assert.equal(h.saved.length,1)
 }
})

test('a quoted loaf order is rechecked on actual click, and Done remains available if the loaf is no longer held',()=>{
 const farm=earned(true),h=handoff(farm,'bread','long');h.click();h.frameAt(4000);assert.equal(h.state.orderButton.hidden,false)
 assert.ok(farmApi.sellMarketItem(farm,'dishes:farmhouseBread',1).ok);const afterSale=structuredClone(farm)
 h.order();assert.equal(h.state.orderButton.hidden,true);assert.equal(h.mainState.panel,'workshop')
 assert.deepEqual(farm,afterSale);h.click();assert.equal(h.returns(),1)
})
