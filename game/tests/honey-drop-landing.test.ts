import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as THREE from 'three'
import ts from 'typescript'
import * as farmApi from '../src/farm.ts'
import {createFruitLanding,stepFruitLanding} from '../src/food-motion.ts'
import * as modelApi from '../src/honey-cookery-model.ts'
import {createHoneyPlateFilm,onHoneyPlate} from '../src/honey-plate.ts'
import {honeyPourFlow} from '../src/honey-pour.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read=(file:string)=>readFileSync(new URL(file,import.meta.url),'utf8')
const main=read('../src/main.ts'), controller=read('../src/honey-cookery.ts')
const js=(source:string)=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
function extract(source:string,names:string[]) {
  const ast=ts.createSourceFile('fixture-source.ts',source,ts.ScriptTarget.Latest,true), found=new Map<string,string>()
  function visit(node:ts.Node) {
    if(ts.isFunctionDeclaration(node)&&node.name&&names.includes(node.name.text))found.set(node.name.text,node.getText(ast))
    ts.forEachChild(node,visit)
  }
  visit(ast)
  return found
}
const methods=extract(controller,['start','release','paintGlaze','depositHoneyLanding','honeyDropMaterial','launchHoneyDrop','recycleHoneyDrop','clearHoneyDrops','advanceHoneyDrops','advanceMaterial','finishRecipe'])
const advance=methods.get('advanceMaterial')!, quietStart=advance.indexOf('quiet=quiet&&honeyDrops.size')
const quietEnd=advance.indexOf('\n',quietStart)
assert.ok(quietStart>=0&&quietEnd>quietStart)
const gestures=controller.slice(controller.indexOf('  const abandon = '), controller.indexOf('  function rotateFruit('))
assert.ok(gestures.includes("view.addEventListener('pointercancel'") && gestures.includes("view.addEventListener('lostpointercapture'"))
const closeBinding=controller.match(/^  const cancel = .*\n  close\.addEventListener.*$/m)?.[0]
const lossBinding=controller.match(/^  canvas\.addEventListener\('webglcontextlost'.*$/m)?.[0]
const destruction=controller.match(/^  return \{ destroy.*$/m)?.[0]
assert.ok(closeBinding&&lossBinding&&destruction)
const branch=js([...methods].filter(([name])=>name!=='advanceMaterial').map(([,body])=>body).join('\n')+
  '\n'+gestures+'\n'+closeBinding+'\n'+lossBinding+'\nfunction destroyedScene(){'+destruction+'}'+
  '\nthis.actions={start,release,paintGlaze,finishRecipe,closeScene:destroyedScene().destroy,frame(){advanceHoneyDrops(dt)},settle(){let quiet=true;'+advance.slice(quietStart,quietEnd)+'}}')
const plateMethod=extract(read('../src/honey-plate-view.ts'),['createHoneyPlateView']).get('createHoneyPlateView')
assert.ok(plateMethod)
const createPlate=runInNewContext(js(plateMethod.replace(/^export /,'')+'\ncreateHoneyPlateView'),{THREE,createHoneyPlateFilm,onHoneyPlate}) as typeof import('../src/honey-plate-view.ts').createHoneyPlateView

// The worktop already measured its coating. Replay the real release and impact
// branches with real gravity and the actual plate view/film, without a GPU.
function atRelease(qualified=true, target:modelApi.HoneyPoint={x:60,y:51.5}, occluded=false) {
  const model=modelApi.createHoneyModel('honeyPear'), sounds:string[]=[], doses:number[]=[]
  const scene=new THREE.Scene(), ceramic=new THREE.Texture(), resources={geometries:new Set<THREE.BufferGeometry>(),materials:new Set<THREE.Material>(),textures:new Set<THREE.Texture>()}
  const plate=createPlate(scene,ceramic,resources), [texture]=resources.textures as Set<THREE.DataTexture>
  const plateRect={x:10,y:20,width:100,height:60};plate.layout(plateRect)
  const cloneTexture=ceramic.clone.bind(ceramic);let textureClones=0
  ceramic.clone=()=>{textureClones++;return cloneTexture()}
  modelApi.beginHoneyStroke(model,'knife',target)
  for(const i of [0,1])modelApi.recordHoneyKnife(model,i,0,Array.from({length:16},(_,bin)=>bin))
  modelApi.endHoneyStroke(model)
  modelApi.beginHoneyStroke(model,'honey',target)
  if(qualified)modelApi.syncHoneyCoating(model,[.36,.35,.34,.33])
  const drop=new THREE.Mesh(new THREE.SphereGeometry(1),new THREE.ShaderMaterial({uniforms:{map:{value:ceramic},time:{value:0},alpha:{value:0}}}))
  const jug={}
  const fruitDoses:number[]=[], impacts:modelApi.HoneyPoint[]=[], noEffect=()=>{}
  const abort=new AbortController()
  const ctx={
    ...modelApi,THREE,createFruitLanding,stepFruitLanding,model,family:'honeyPear',honeySound:'cook.honey-flow',
    view:new EventTarget(),window:new EventTarget(),canvas:new EventTarget(),close:new EventTarget(),signal:abort.signal,abort,pointer:null as number|null,
    scene,...resources,cancelAnimationFrame:noEffect,frame:0,renderer:{dispose:noEffect,forceContextLoss:noEffect},observer:{disconnect:noEffect},
    status:{hidden:true,textContent:''},root:{remove:noEffect},previousFocus:null,
    held:{tool:'honey'},drop,honeyDrops:new Set<{mesh:typeof drop}>(),idleDropMeshes:[] as (typeof drop)[],creamRelease:null,coating:{value:.8,velocity:0},
    knifeSounded:new Set(),parts:new Map([['honey',jug]]),toolReturns:new Map(),currentTool:()=>'honey',contains:(object:unknown)=>object===jug,normalized:()=>({x:0,y:0}),
    moveHeld(point:modelApi.HoneyPoint){ctx.strandTip={x:point.x,y:point.y-24}},
    cursor:target,contact:{...target,vx:0,vy:0},strandTip:{x:target.x,y:target.y-24},
    strandTail:1,dt:1/60,surface:{rx:100,ry:60},
    pearView:{releaseTrace:noEffect,hit:()=>occluded,paint:(_a:modelApi.HoneyPoint,_b:modelApi.HoneyPoint,dose:number)=>fruitDoses.push(dose)},
    plateView:{...plate,paint(...args:Parameters<typeof plate.paint>){impacts.push({x:args[1].x,y:args[1].y});doses.push(args[2]);plate.paint(...args)}},
    foods:[],returnTool:noEffect,setBaySoundContact:noEffect,updateFoodState:noEffect, layout:noEffect,sync:noEffect,
    playBaySound:(id:string)=>sounds.push(id),lastContact:null,grippedDough:null,gripMaterial:null,knifeTransport:false,
    loaded:true,lost:false,destroyed:false,physicalQuiet:false, angle:(v:number)=>v,
    options:{onCancel:noEffect,onComplete:(_result:unknown)=>false},
    actions:undefined as unknown as {start(point:modelApi.HoneyPoint):void;release(commit?:boolean):void;paintGlaze(from:modelApi.HoneyPoint,to:modelApi.HoneyPoint,amount:number):void;frame():void;settle():void;finishRecipe():void;closeScene():void},
  }
  runInNewContext(branch,ctx)
  const wet=()=>texture.image.data.some((v:number,i:number)=>i%4===0&&v>0)
  const filmAt=(point:modelApi.HoneyPoint)=>{
    const {width,height,data}=texture.image
    const x=Math.floor((point.x-plateRect.x)/plateRect.width*width),y=Math.floor((point.y-plateRect.y)/plateRect.height*height)
    return data[(y*width+x)*4]
  }
  const finishDrop=()=>{for(let i=0;i<55;i++){ctx.actions.frame();plate.update(ctx.dt)}}
  return {ctx,model,plate,wet,filmAt,finishDrop,doses,fruitDoses,impacts,sounds,textureClones:()=>textureClones,dispose(){
    for(const items of Object.values(resources))for(const item of items)item.dispose()
    ceramic.dispose();drop.geometry.dispose();drop.material.dispose()
  }}
}

test('the drop already emitted on release wets exposed plate during settling exactly once',()=>{
  const k=atRelease()
  try{
    assert.equal(k.model.pending,'settling')
    k.ctx.actions.release()
    assert.equal(k.ctx.honeyDrops.size,1);assert.equal(k.model.stage,'settling')
    const step=[...k.model.steps], coverage=[...k.model.coated]
    k.ctx.actions.paintGlaze(k.ctx.cursor,k.ctx.cursor,1)
    assert.deepEqual(k.doses,[],'ongoing fresh paint stops as before')
    k.finishDrop();k.finishDrop()
    assert.ok(k.wet(),'the visible release drop should leave real retained plate film')
    assert.deepEqual(k.doses,[.38*.8]);assert.deepEqual(k.fruitDoses,[])
    assert.deepEqual(k.sounds,['cook.honey-end']);assert.equal(k.ctx.honeyDrops.size,0)
    assert.deepEqual([...k.model.coated],coverage);assert.deepEqual(k.model.steps,step)
  }finally{k.dispose()}
})

test('regripping before impact keeps the first aim and dose, then lands the new tilt exactly once',()=>{
  const left={x:43,y:51.5},right={x:77,y:51.5},gentle=honeyPourFlow(.35),steep=honeyPourFlow(.85)
  const k=atRelease(false,left)
  try{
    assert.ok(k.plate.hit(left)&&k.plate.hit(right))
    k.ctx.coating.value=gentle;k.ctx.actions.release();k.ctx.actions.frame()
    assert.deepEqual(k.doses,[],'the first dose is airborne')
    k.ctx.actions.start(right)
    assert.equal(k.ctx.held?.tool,'honey')
    k.ctx.strandTail=1;k.ctx.coating.value=steep
    modelApi.syncHoneyCoating(k.model,[.36,.35,.34,.33])
    k.ctx.actions.release()
    assert.equal(k.model.stage,'settling')
    let commits=0
    k.ctx.options.onComplete=()=>{commits++;return true}
    k.ctx.actions.frame()
    const meshes=[...k.ctx.honeyDrops].map(({mesh})=>mesh)
    assert.deepEqual(meshes.map(mesh=>[mesh.position.x,mesh.visible]),[[left.x,true],[right.x,true]])
    assert.equal(meshes[0].geometry,meshes[1].geometry)
    assert.equal(meshes[0].material.uniforms.map,meshes[1].material.uniforms.map)
    assert.notEqual(meshes[0].material.uniforms.alpha,meshes[1].material.uniforms.alpha)
    assert.equal(k.textureClones(),0,'detached meshes never copy the shared texture, even transiently')
    for(let i=0;i<10;i++)k.ctx.actions.settle()
    k.ctx.actions.finishRecipe()
    assert.equal(k.model.stage,'settling');assert.equal(commits,0,'both flights must finish before the receipt')
    k.finishDrop();k.finishDrop()
    assert.deepEqual(k.impacts,[left,right])
    assert.deepEqual(k.doses,[.38*gentle,.38*steep])
    assert.ok(k.filmAt(left)>0&&k.filmAt(right)>k.filmAt(left),'both aimed points wet the real plate; the steeper pour leaves more there')
    assert.deepEqual(k.sounds,['cook.honey-end','cook.honey-end'])
    assert.ok(k.ctx.idleDropMeshes.every(mesh=>!mesh.visible),'both finished splash meshes were hidden for reuse')
    assert.deepEqual(k.fruitDoses,[]);assert.equal(k.model.steps.filter(step=>step==='pour-honey').length,1)
    for(let i=0;i<10;i++)k.ctx.actions.settle()
    assert.equal(k.model.stage,'ready')
    k.ctx.actions.finishRecipe();k.ctx.actions.finishRecipe()
    assert.equal(k.model.stage,'finished');assert.equal(commits,1)
  }finally{k.dispose()}
})

test('an immediate re-grip and release without a new pour frame cannot re-emit the previous dose',()=>{
  const original={x:43,y:51.5},next={x:77,y:51.5}, k=atRelease(false,original)
  try{
    k.ctx.actions.release()
    const [first]=k.ctx.honeyDrops
    k.ctx.actions.start(next);k.ctx.actions.release()
    assert.equal(k.ctx.honeyDrops.size,1)
    assert.equal([...k.ctx.honeyDrops][0],first)
    k.finishDrop()
    assert.deepEqual(k.impacts,[original]);assert.deepEqual(k.doses,[.38*.8])
  }finally{k.dispose()}
})

for (const event of ['pointercancel','lostpointercapture']) test(`${event} abandons the current grip, not an earlier released drop`,()=>{
  const original={x:43,y:51.5},next={x:77,y:51.5},k=atRelease(false,original)
  try{
    k.ctx.actions.release();k.ctx.actions.frame()
    k.ctx.actions.start(next);k.ctx.pointer=2;k.ctx.coating.value=.9
    k.ctx.view.dispatchEvent(Object.assign(new Event(event),{pointerId:2}))
    assert.equal(k.ctx.pointer,null);assert.equal(k.ctx.held,null)
    assert.equal(k.ctx.honeyDrops.size,1,'the earlier release is still airborne')
    k.finishDrop()
    assert.deepEqual(k.impacts,[original]);assert.deepEqual(k.doses,[.38*.8])
    assert.ok(k.filmAt(original)>0);assert.equal(k.filmAt(next),0)
  }finally{k.dispose()}
})

for (const stop of ['close','destroy','graphics loss']) test(`${stop} discards an old flight without making a receipt`,()=>{
  const original={x:43,y:51.5},next={x:77,y:51.5},k=atRelease(false,original)
  try{
    let commits=0,leaves=0
    k.ctx.options.onComplete=()=>{commits++;return true};k.ctx.options.onCancel=()=>{leaves++}
    k.ctx.actions.release();k.ctx.actions.frame()
    const [flight]=k.ctx.honeyDrops
    k.ctx.actions.start(next)
    if(stop==='graphics loss'){
      const event=new Event('webglcontextlost',{cancelable:true});k.ctx.canvas.dispatchEvent(event)
      assert.equal(event.defaultPrevented,true);assert.equal(k.ctx.lost,true)
    }else{
      modelApi.syncHoneyCoating(k.model,[.36,.35,.34,.33]);assert.equal(k.model.pending,'settling')
      if(stop==='close')k.ctx.close.dispatchEvent(new Event('click'))
      else k.ctx.actions.closeScene()
      assert.equal(k.model.stage,'cancelled');assert.equal(k.model.pending,null)
    }
    assert.equal(k.ctx.honeyDrops.size,0);assert.equal(flight.mesh.visible,false)
    k.finishDrop()
    for(let i=0;i<10;i++)k.ctx.actions.settle()
    k.ctx.actions.finishRecipe()
    assert.equal(commits,0);assert.equal(leaves,stop==='close'?1:0)
    assert.equal(k.wet(),false);assert.deepEqual(k.doses,[]);assert.deepEqual(k.sounds,[])
  }finally{k.dispose()}
})

test('ordinary glaze and release still wet the plate without fruit credit; rim and occluded final drops stay dry',()=>{
  const ordinary=atRelease(false)
  try{
    ordinary.ctx.actions.paintGlaze(ordinary.ctx.cursor,ordinary.ctx.cursor,.2)
    ordinary.ctx.actions.release();ordinary.finishDrop()
    assert.equal(ordinary.model.stage,'glaze');assert.ok(ordinary.wet())
    assert.equal(modelApi.honeyProgress(ordinary.model),0)
    assert.deepEqual(ordinary.doses,[.2,.38*.8])
  }finally{ordinary.dispose()}
  const misses=[{point:{x:60,y:27},occluded:false},{point:{x:60,y:51.5},occluded:true}]
  for(const {point,occluded} of misses){
    const k=atRelease(true,point,occluded)
    try{k.ctx.actions.release();k.finishDrop();assert.equal(k.wet(),false);assert.deepEqual(k.fruitDoses,[])}
    finally{k.dispose()}
  }
})

test('an abandoned stroke or stale landing after cancellation/completion cannot leave more plate film',()=>{
  const abandoned=atRelease()
  try{abandoned.ctx.actions.release(false);abandoned.finishDrop();assert.equal(abandoned.wet(),false);assert.deepEqual(abandoned.doses,[])}
  finally{abandoned.dispose()}
  for(const terminal of ['cancelled','finished'] as const){
    const k=atRelease()
    try{
      k.ctx.actions.release();assert.equal(k.ctx.honeyDrops.size,1)
      if(terminal==='cancelled')modelApi.cancelHoney(k.model)
      else {
        modelApi.settleHoney(k.model,.08,true);modelApi.settleHoney(k.model,.08,true)
        assert.ok(modelApi.completeHoney(k.model,()=>true))
      }
      assert.equal(k.model.stage,terminal);k.finishDrop();assert.equal(k.wet(),false)
      assert.deepEqual(k.doses,[]);assert.deepEqual(k.fruitDoses,[])
    }finally{k.dispose()}
  }
})

test('the earned Cape recipe still spends once through actual Finish and caller, never during landing',()=>{
  const p=commissionPlayer(JSON.parse(read('./fixtures/home-progress-actions.json')).slice(0,39))
  p.visit('home');p.act('sellProduce')
  function tillPrice(price:number){
    for(let n=0;p.state.coins<price;n++){assert.ok(n<28);p.night();p.act('pickFruit',0);p.act('sellProduce')}
  }
  tillPrice(48);p.night();p.visit('cape');p.act('collectCapeHoney')
  if(!farmApi.getCapeUpgrade(p.state)?.available){p.night();p.visit('cape');p.act('collectCapeHoney')}
  p.act('upgradeCape');tillPrice(farmApi.getCapeUpgrade(p.state)!.coins)
  for(let n=0;p.state.seaSalt<3||p.state.fruit.pear<2;n++){
    assert.ok(n<10);p.night();p.visit('grove')
    if(p.state.seaSalt<3)p.act('gatherSeaSalt')
    if(p.state.fruit.pear<2&&farmApi.getTreeAction(p.state,0).available)p.act('pickFruit',0)
  }
  for(let n=0;n<7;n++){
    p.night();p.visit('cape');p.act('collectCapeHoney')
    if(farmApi.getCapeUpgrade(p.state)?.available){p.act('upgradeCape');break}
  }
  const farm=p.state
  assert.equal(farm.day,10);assert.equal(p.actions,67);assert.ok(farmApi.getCookAction(farm,'honeyPear').available)
  const from=main.indexOf('        onComplete(result) {if(made)',main.indexOf("    case 'cookery': {"))
  const to=main.indexOf('        onCancel(){if(signature',from);assert.ok(from>=0&&to>from)
  let spends=0, leaves=0
  const commit=runInNewContext(js('({'+main.slice(from,to)+'})'),{farm,signature:false,preparedDish:'honeyPear',made:false,
    panel:'cookery',familyName:undefined,perform:(act:()=>{ok:boolean})=>{spends++;return act().ok},cookDish:farmApi.cookDish})
  const k=atRelease()
  try{
    k.ctx.options={...commit,onCancel(){leaves++}}
    const before=structuredClone(farm)
    k.ctx.actions.release();k.finishDrop();k.ctx.actions.finishRecipe()
    assert.deepEqual(farm,before);assert.equal(spends,0)
    modelApi.settleHoney(k.model,.08,true);modelApi.settleHoney(k.model,.08,true);k.ctx.physicalQuiet=true
    k.ctx.actions.finishRecipe();const after=structuredClone(farm)
    assert.equal(farm.honey,before.honey-1);assert.equal(farm.fruit.pear,before.fruit.pear-2);assert.equal(farm.seaSalt,before.seaSalt-1)
    assert.equal(farm.dishes.honeyPear,before.dishes.honeyPear+1);assert.equal(farm.workToday,before.workToday+1)
    assert.ok(farmApi.restoreCurrentFarm(after))
    k.ctx.actions.finishRecipe();assert.deepEqual(farm,after);assert.equal(spends,1);assert.equal(leaves,1)
  }finally{k.dispose()}
})
