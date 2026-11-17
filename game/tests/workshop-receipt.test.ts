import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as farmApi from '../src/farm.ts'
import { transferBayGoods } from '../src/harbour-economy.ts'
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
const finished=find(workshop,n=>ts.isIfStatement(n)&&n.expression.getText(workshop)==="stage === 'baking'"&&n.getText(workshop).includes('surface.setBaked'))
const tick=find(workshop,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='tick') as ts.FunctionDeclaration
// Run the actual frame clock and completion block, not an uncapped test-only delta.
const tickStatements=tick.body!.statements
const clockEnd=tickStatements.findIndex(n=>n.getText(workshop).startsWith('setBaySoundContact('))
assert.ok(clockEnd>0)
const frameClock=tickStatements.slice(0,clockEnd).map(n=>n.getText(workshop)).join('\n')
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
 const saved:farmApi.FarmState[]=[],handlers:Record<string,()=>void>={},announcements:string[]=[]
 let options:any,returns=0,now=1000
 const sounds:string[]=[],baked:number[]=[],risen:number[]=[]
 const mainState:any={farm,workshopRecipe:recipe,pastryShape:shape,panel:'workshop',workshopGame:undefined,...farmApi,
  dialogContent:{innerHTML:'',querySelector(){return {}}},createWorkshop(_host:unknown,value:any){options=value;return {destroy(){}}},
  leaveScene(){returns++;state.destroyed=true},perform(action:()=>farmApi.ActionResult){const result=action();if(result.ok)saved.push(structuredClone(farm));return result.ok}}
 runInNewContext(js(`switch('workshop'){${panelCase.getText(main)}}`),mainState)
 assert.ok(options,'earned stock opens actual workshop callback')
 const element=()=>({disabled:false,hidden:false,textContent:'',innerHTML:'',dataset:{},setAttribute(){}})
 const state:any={options,dishDefinitions:farmApi.dishDefinitions,stage:'working',chosenShape:shape,shapeNames:{round:'Круглая булочка',long:'Батон',folded:'Слойка'},destroyed:false,committed:false,contextLost:false,cutPending:false,assetsReady:true,work:.2,mixed:1,selected:0,activeTool:'knead',hand:{down:false},handMenuExpanded:false,
  root:{dataset:{},setAttribute(){}},shapeButtons:[],toolButtons:[],hotspots:[],resultLabel:element(),handButton:element(),handMenu:element(),modeTitle:element(),hint:element(),bakeButton:{...element(),addEventListener(id:string,fn:()=>void){handlers[id]=fn}},signal:new AbortController().signal,
  pieces:[{mass:1,dirty:true,offset:new Float32Array(1),velocity:new Float32Array(1),mesh:{geometry:{}}}],
  performance:{now:()=>now},lastTime:now,elapsed:0,bakeStartedAt:0,workshopToolGuide,updateSpriteBoxes(){},rebuildMixSurface(){},positionHandMenu(){},updateCue(){},fitBakeLabel(){},surface:{setCrustRoughness(){},setBaked(amount:number){baked.push(amount)}},prepareDoughBaking(){return {}},recognize(){return shape},release(){},playBaySound(id:string){sounds.push(id)},announce(v:string){announcements.push(v)},mix(){},bakeElapsed:0,delta:0,ovenLight:{intensity:0},THREE:{MathUtils:{smoothstep:(n:number)=>n}},riseDough(_geometry:unknown,_baking:unknown,amount:number){risen.push(amount)}}
 runInNewContext(js(`${update.getText(workshop)}; const ${close.getText(workshop)}; ${bake.getText(workshop)}; function advance(now){${frameClock};${finished.getText(workshop)}}`),state)
 return {state,options,saved,announcements,sounds,baked,risen,elapseWithoutFrame:(seconds:number)=>{now+=seconds*1000},frameAt:(milliseconds:number)=>{now=1000+milliseconds;state.advance(now)},click:()=>{if(!state.destroyed)handlers.click()},advance:(seconds:number)=>{now+=seconds*1000;state.advance(now)},back:()=>options.onCancel(),returns:()=>returns}
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
