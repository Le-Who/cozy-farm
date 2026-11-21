import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
import {createParfaitTransfer} from '../src/parfait-transfer.ts'
import {beginHoneyStroke,createHoneyModel,depositParfaitCustard,depositParfaitHoney,endHoneyStroke,honeyProgress,moveHoneyStroke,onHoneySurface,placeHoneyFruit,settleHoney} from '../src/honey-cookery-model.ts'
import {honeyPourFlow} from '../src/honey-pour.ts'
import * as motion from '../src/food-motion.ts'

test('an empty spoon cannot fill the glass, and carried cream survives a long trip or release',()=>{
 const cream=createParfaitTransfer()
 for(let i=0;i<120;i++)assert.equal(cream.step(1/60,false,true),0)
 assert.equal(cream.delivered,0)
 for(let i=0;i<20;i++)cream.step(1/60,true,false)
 assert.equal(cream.load,cream.capacity)
 for(let i=0;i<300;i++)cream.step(1/60,false,false)
 assert.equal(cream.load,cream.capacity)
 let delivered=0;for(let i=0;i<60;i++)delivered+=cream.step(1/60,false,true)
 assert.ok(Math.abs(delivered-cream.capacity)<1e-12)
 assert.ok(cream.load<1e-12)
})

test('three continuous real spoonfuls fill one layer and cannot duplicate cream',()=>{
 const cream=createParfaitTransfer(),model=createHoneyModel('windParfait')
 for(let pass=0;pass<3;pass++){
  beginHoneyStroke(model,'spoon',{x:0,y:0})
  for(let i=0;i<8;i++)cream.step(.05,true,false)
  for(let i=0;i<12;i++)depositParfaitCustard(model,cream.step(.05,false,true))
  assert.equal(model.stage,'custard','stage change waits for the spoon release')
  if(pass<2){assert.equal(model.pending,null);assert.ok(honeyProgress(model)<1)}
  endHoneyStroke(model)
 }
 assert.equal(model.stage,'fruit');assert.equal(cream.delivered,1);assert.equal(model.parfaitCustard,1)
 for(let i=0;i<100;i++)assert.equal(cream.step(.05,false,true),0)
 assert.equal(model.steps.filter(s=>s==='layer-custard').length,1)
})

test('a quick source contact takes a sensible scoop and releasing over glass can finish the pour',()=>{
 const cream=createParfaitTransfer();cream.scoop();assert.equal(cream.load,.34)
 // Carrying or releasing elsewhere retains the same portion.
 cream.step(.016,false,false);assert.equal(cream.load,.34)
 const first=cream.step(.016,false,true),remaining=cream.finishDeposit()
 assert.ok(first>0&&remaining>0)
 assert.ok(Math.abs(first+remaining-.34)<1e-12)
 assert.ok(Math.abs(cream.delivered-.34)<1e-12)
 assert.equal(cream.load,0)
})

test('empty coverage gestures never substitute for scooping cream or a contained honey pour',()=>{
 const model=createHoneyModel('windParfait');beginHoneyStroke(model,'spoon',{x:-.8,y:0})
 for(let i=0;i<100;i++)moveHoneyStroke(model,{x:Math.sin(i)*.7,y:Math.cos(i)*.7})
 endHoneyStroke(model);assert.equal(model.stage,'custard');assert.equal(honeyProgress(model),0)
 model.stage='glaze';beginHoneyStroke(model,'honey',{x:0,y:0})
 for(let i=0;i<200;i++){moveHoneyStroke(model,{x:0,y:0});depositParfaitHoney(model,{x:2,y:0},.05)}
 assert.equal(model.parfaitHoney,0);assert.equal(model.pending,null)
})

test('honey flows and spreads in the single vessel while stationary, then settles after release',()=>{
 const model=createHoneyModel('windParfait');model.stage='fruit'
 for(let i=0;i<3;i++)placeHoneyFruit(model,i,{x:(i-1)*.35,y:0})
 assert.equal(model.stage,'glaze');beginHoneyStroke(model,'honey',{x:0,y:0})
 for(let i=0;i<50;i++)depositParfaitHoney(model,{x:0,y:0},.05)
 assert.equal(model.stage,'glaze');assert.equal(model.parfaitHoney,1)
 endHoneyStroke(model);assert.equal(model.stage,'settling')
 settleHoney(model,.1,true);settleHoney(model,.05,true);assert.equal(model.stage,'ready')
 assert.deepEqual(model.steps,['layer-fruit','pour-honey'])
})

function scoopScene(){
 const read=(name:string)=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8')
 const source=read('honey-cookery.ts'),ast=ts.createSourceFile('honey-cookery.ts',source,ts.ScriptTarget.Latest,true)
 const methods:string[]=[],names=['currentTool','imagePoint','contains','parfaitBowlContact','dispatchCreamPickup','start','move','release','returnTool','advanceMaterial']
 function walk(node:ts.Node){
  if(ts.isFunctionDeclaration(node)&&node.name&&names.includes(node.name.text))methods.push(node.getText(ast))
  if(ts.isCallExpression(node)&&node.expression.getText(ast)==='view.addEventListener'&&node.arguments[0]?.getText(ast)==="'keydown'")methods.push(node.getText(ast))
  ts.forEachChild(node,walk)
 }
 walk(ast)
 // Preserve the real 110 ms cooldown in the separate audio module's namespace.
 const audio=read('game-sound.ts').split('\n').slice(1).join('\n').split('/** Decode')[0]
  .replaceAll('lastContact','lastSoundContact').replaceAll('export ','').replace('function playBaySound(','function forwardBaySound(')
 const slice=(from:string,to:string)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)))
 // Run the same visibility assignment layout uses, without a GPU or texture fixtures.
 const toolLayout=slice('    const current = currentTool();',"    if (parts.has('fruit-dish'))")
 assert.ok(toolLayout.includes('mesh.visible'),'real layout tool visibility')
 const code=stripTypeScriptTypes(['this.refreshTools=function(){'+toolLayout+'}',audio,...methods,slice('  const normalized =','\n  function '),slice('  const eventPoint =','  function rotateFruit('),'this.tick=advanceMaterial'].join('\n'))
 const abort=new AbortController(),view=new(class extends EventTarget{
  captures=new Set<number>()
  closest(){return null} setPointerCapture(id:number){this.captures.add(id)} hasPointerCapture(id:number){return this.captures.has(id)}
  releasePointerCapture(id:number){this.captures.delete(id)} getBoundingClientRect(){return {left:0,top:0}} focus(){}
 })()
 const bowl={x:110,y:180},glass={x:405,y:200},model=createHoneyModel('windParfait'),cream=createParfaitTransfer(),silent=()=>{}
 const part=(point:{x:number;y:number})=>({mesh:{position:point,rotation:{z:0}},rect:{x:point.x-40,y:point.y-40,width:80,height:80}})
 let now=0
 const requests:string[]=[],sounds:{id:string;load:number}[]=[],flow:boolean[]=[]
 const state:Record<string,any>={
  ...motion,model,parfaitTransfer:cream,view,window:new EventTarget(),signal:abort.signal,document:{hidden:false},
  performance:{now:()=>now},bayAudio:{playEvent:(id:string)=>sounds.push({id,load:cream.load}),setContact:(id:string,active:boolean)=>{if(id==='cook.cream-flow')flow.push(active)}},
  playBaySound(id:string,strength?:number,cooldown?:number){requests.push(id);state.forwardBaySound(id,strength,cooldown)},
  family:'windParfait',loaded:true,lost:false,destroyed:false,knifeSounded:new Set(),creamRelease:null,creamPickupSent:false,
  parts:new Map([['spoon',part(bowl)],['custard-bowl',part({x:bowl.x,y:bowl.y+5.6})]]),toolReturns:new Map(),fruitParts:new Map(),
  surface:{...glass,rx:95,ry:80},width:600,height:420,cursor:{x:0,y:0},held:null,pointer:null,pointerPressure:.9,keyboard:false,
  pearView:null,plateView:null,contact:motion.createViscousFollower(),contactReady:false,lastContact:null,knifeTransport:false,
  custardLevel:{value:0,velocity:0},fruitLayer:{value:0,velocity:0},parfaitTopping:{value:0,velocity:0},pitcherTilt:{value:0,velocity:0},
  coating:{value:0,velocity:0},swirl:{value:0,velocity:0},swirlTarget:0,swirlAngle:0,strandTail:0,
  landings:new Map(),incorporated:new Map(),honeyDrops:new Set(),foods:[],batter:null,stream:null,streamGeometry:null,
  honeySound:'cook.honey-flow',creamFlow:0,grippedDough:null,gripMaterial:null,physicalQuiet:true,
  root:{dataset:{}},previousStage:'custard',previousBrushHint:'',previousProgress:0,previousCreamUi:0,finish:{disabled:false},
  beginHoneyStroke,endHoneyStroke,depositParfaitCustard,depositParfaitHoney,honeyProgress,settleHoney,moveHoneyStroke,onHoneySurface,
  brushReleaseHint:()=>'',sync:silent,updateFoodState:silent,layout:silent,updateCursor:silent,
  moveHeld(point:{x:number;y:number}){state.cursor=point}
 }
 runInNewContext(code,state)
 function pointer(type:string,point:{x:number;y:number},pointerType='mouse'){
  view.dispatchEvent(Object.assign(new Event('pointer'+type),{button:0,pointerId:1,pointerType,pressure:.6,clientX:point.x,clientY:point.y}))
 }
 function key(key:string,code:string){
  const event=Object.assign(new Event('keydown',{cancelable:true}),{key,code})
  view.dispatchEvent(event);assert.equal(event.defaultPrevented,true)
 }
 return {state,model,cream,sounds,requests,flow,bowl,glass,pointer,key,
  delay(ms:number){now+=ms},frames(number:number){for(let i=0;i<number;i++){now+=20;state.tick(.02)}},
  close:()=>abort.abort()}
}

test('one real bowl press fills an empty spoon, and full regrips stay quiet even after the sound cooldown',()=>{
 const h=scoopScene()
 try{
  h.pointer('down',h.glass);h.frames(8);h.pointer('up',h.glass)
  assert.equal(h.cream.load,0);assert.deepEqual(h.requests,[]);assert.deepEqual(h.sounds,[])
  h.pointer('down',h.bowl);assert.equal(h.cream.load,.34)
  h.frames(8);h.pointer('up',h.bowl)
  for(let i=0;i<2;i++){h.delay(250);h.pointer('down',h.bowl);h.frames(8);h.pointer('up',h.bowl);assert.equal(h.cream.load,.34)}
  assert.deepEqual(h.sounds,[{id:'cook.cream-scoop',load:.34}])
  assert.deepEqual(h.requests,['cook.cream-scoop'])
  assert.ok(h.flow.every(active=>!active));assert.equal(h.model.parfaitCustard,0)
 }finally{h.close()}
})

test('held spoon refills start one scoop per return to the bowl, while only a glass pour sustains flow',()=>{
 const h=scoopScene()
 try{
  h.pointer('down',h.bowl)
  for(let visit=1;visit<=2;visit++){
   const delivered=h.cream.delivered
   h.pointer('move',h.glass);h.frames(16)
   assert.ok(h.cream.load>0&&h.cream.load<.34);assert.ok(h.cream.delivered>delivered)
   assert.equal(h.flow.at(-1),true);assert.equal(h.sounds.length,visit)
   h.pointer('move',h.bowl);h.frames(35)
   assert.equal(h.cream.load,.34);assert.equal(h.flow.at(-1),false)
   assert.equal(h.sounds.length,visit+1);assert.ok(h.sounds.at(-1)!.load>0&&h.sounds.at(-1)!.load<.34)
   assert.deepEqual(h.requests,Array.from({length:visit+1},()=> 'cook.cream-scoop'))
  }
  assert.equal(h.model.parfaitCustard,h.cream.delivered)
 }finally{h.close()}
})

test('keyboard S scoops once, goes to the glass with no new scoop, then scoops again only after pouring',()=>{
 const h=scoopScene()
 try{
  h.key('s','KeyS');assert.equal(h.cream.load,.34);assert.equal(h.sounds.length,1)
  h.frames(8);h.key('s','KeyS')
  assert.deepEqual({...h.state.cursor},h.glass);assert.equal(h.sounds.length,1)
  h.frames(25);assert.equal(h.cream.load,0);assert.equal(h.model.parfaitCustard,.34);assert.ok(h.flow.includes(true))
  h.key('s','KeyS');assert.equal(h.cream.load,.34);assert.equal(h.sounds.length,2)
  assert.deepEqual(h.requests,['cook.cream-scoop','cook.cream-scoop'])
 }finally{h.close()}
})

test('parfait touch has no pitcher on the peach layer; the same glass gesture pours after three peaches',()=>{
 const h=scoopScene(),s=h.state,holder={x:540,y:330}
 const jug={mesh:{position:holder,rotation:{z:0},visible:false},rect:{x:520,y:310,width:40,height:40}}
 s.parts.set('honey',jug)
 Object.assign(s,{fruitFollow:motion.createViscousFollower(),landingXY:new Map(),selected:-1,fruitAngle:0,reduced:{matches:false},
   placeHoneyFruit,honeyPourFlow,pourTilt:.85,paintGlaze(){},launchHoneyDrop(){}})
 const peaches=[{x:40,y:260},{x:100,y:275},{x:160,y:290}]
 for(const [id,p] of peaches.entries())s.fruitParts.set(id,{mesh:{position:p,rotation:{z:0},visible:true},rect:{x:p.x-12,y:p.y-12,width:24,height:24}})
 const touch=(type:string,p:{x:number;y:number})=>h.pointer(type,p,'touch')
 try{
   s.refreshTools();assert.equal(s.parts.get('spoon').mesh.visible,true);assert.equal(jug.mesh.visible,false)
   for(let i=0;i<3;i++){touch('down',h.bowl);touch('move',h.glass);h.frames(60);touch('up',h.glass);h.frames(2)}
   assert.equal(h.model.stage,'fruit')
   s.refreshTools()
   const beforeGlaze={pitcher:jug.mesh.visible,grips:[] as (string|null)[],honey:0}
   for(const p of [holder,h.glass]){
     touch('down',p);h.frames(12);beforeGlaze.grips.push(s.held?.tool??null)
     touch('up',p)
   }
   beforeGlaze.honey=h.model.parfaitHoney
   assert.deepEqual(beforeGlaze,{pitcher:false,grips:[null,null],honey:0},'neither holder nor glass should offer a pitcher that cannot pour')
   for(const [id,p] of peaches.entries()){
     touch('down',p);assert.equal(s.held?.fruit,id)
     if(id===0){h.key('s','KeyS');assert.equal(s.held?.fruit,0,'tool shortcut cannot drop the peach')}
     touch('move',h.glass);touch('up',h.glass)
   }
   assert.equal(h.model.stage,'glaze');s.refreshTools();assert.equal(jug.mesh.visible,true)
   touch('down',holder);assert.equal(s.held?.tool,'honey');touch('up',holder)
   h.key('s','KeyS');assert.equal(s.held?.tool,'honey');assert.deepEqual({...s.cursor},h.glass);h.key(' ','Space')
   touch('down',h.glass);assert.equal(s.held?.tool,'honey');h.frames(20)
   assert.ok(h.model.parfaitHoney>0,'this same touch now deposits actual honey')
   h.frames(160);touch('up',h.glass)
   assert.equal(h.model.stage,'settling');touch('down',holder);assert.equal(s.held,null);touch('up',holder)
   h.frames(120);assert.equal(h.model.stage,'ready');s.refreshTools();assert.equal(jug.mesh.visible,false)
 }finally{h.close()}
})
