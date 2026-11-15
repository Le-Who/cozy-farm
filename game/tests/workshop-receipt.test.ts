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
const finished=find(workshop,n=>ts.isIfStatement(n)&&n.expression.getText(workshop)==="stage === 'baking'"&&n.getText(workshop).includes('bakeElapsed += delta'))
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
 let options:any,returns=0
 const mainState:any={farm,workshopRecipe:recipe,pastryShape:shape,panel:'workshop',workshopGame:undefined,...farmApi,
  dialogContent:{innerHTML:'',querySelector(){return {}}},createWorkshop(_host:unknown,value:any){options=value;return {destroy(){}}},
  leaveScene(){returns++;state.destroyed=true},perform(action:()=>farmApi.ActionResult){const result=action();if(result.ok)saved.push(structuredClone(farm));return result.ok}}
 runInNewContext(js(`switch('workshop'){${panelCase.getText(main)}}`),mainState)
 assert.ok(options,'earned stock opens actual workshop callback')
 const element=()=>({disabled:false,hidden:false,textContent:'',innerHTML:'',dataset:{},setAttribute(){}})
 const state:any={options,dishDefinitions:farmApi.dishDefinitions,stage:'working',chosenShape:shape,shapeNames:{round:'Круглая булочка',long:'Батон',folded:'Слойка'},destroyed:false,committed:false,contextLost:false,cutPending:false,assetsReady:true,work:.2,mixed:1,selected:0,activeTool:'knead',hand:{down:false},handMenuExpanded:false,
  root:{dataset:{},setAttribute(){}},shapeButtons:[],toolButtons:[],hotspots:[],resultLabel:element(),handButton:element(),handMenu:element(),modeTitle:element(),hint:element(),bakeButton:{...element(),addEventListener(id:string,fn:()=>void){handlers[id]=fn}},signal:new AbortController().signal,
  pieces:[{mass:1,dirty:true,offset:new Float32Array(1),velocity:new Float32Array(1),mesh:{geometry:{}}}],
  workshopToolGuide,updateSpriteBoxes(){},rebuildMixSurface(){},positionHandMenu(){},updateCue(){},fitBakeLabel(){},surface:{setCrustRoughness(){},setBaked(){}},prepareDoughBaking(){return {}},recognize(){return shape},release(){},playBaySound(){},announce(v:string){announcements.push(v)},mix(){},bakeElapsed:0,delta:0,ovenLight:{intensity:0},THREE:{MathUtils:{smoothstep:(n:number)=>n}},riseDough(){}}
 runInNewContext(js(`${update.getText(workshop)}; const ${close.getText(workshop)}; ${bake.getText(workshop)}; function advance(deltaValue){delta=deltaValue;${finished.getText(workshop)}}`),state)
 return {state,options,saved,announcements,click:()=>{if(!state.destroyed)handlers.click()},advance:(seconds:number)=>state.advance(seconds),back:()=>options.onCancel(),returns:()=>returns}
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
