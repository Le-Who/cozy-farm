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
const methods=extract(controller,['release','paintGlaze','depositHoneyLanding','advanceMaterial','finishRecipe'])
const advance=methods.get('advanceMaterial')!, landingStart=advance.indexOf('if(drop){')
const landingEnd=advance.indexOf('\n',landingStart)
assert.ok(landingStart>=0&&landingEnd>landingStart)
const branch=js([...methods].filter(([name])=>name!=='advanceMaterial').map(([,body])=>body).join('\n')+
  '\nthis.actions={release,paintGlaze,finishRecipe,frame(){'+advance.slice(landingStart,landingEnd)+'}}')
const plateMethod=extract(read('../src/honey-plate-view.ts'),['createHoneyPlateView']).get('createHoneyPlateView')
assert.ok(plateMethod)
const createPlate=runInNewContext(js(plateMethod.replace(/^export /,'')+'\ncreateHoneyPlateView'),{THREE,createHoneyPlateFilm,onHoneyPlate}) as typeof import('../src/honey-plate-view.ts').createHoneyPlateView

// The worktop already measured its coating. Replay the real release and impact
// branches with real gravity and the actual plate view/film, without a GPU.
function atRelease(qualified=true, target:modelApi.HoneyPoint={x:60,y:51.5}, occluded=false) {
  const model=modelApi.createHoneyModel('honeyPear'), sounds:string[]=[], doses:number[]=[]
  const scene=new THREE.Scene(), ceramic=new THREE.Texture(), resources={geometries:new Set<THREE.BufferGeometry>(),materials:new Set<THREE.Material>(),textures:new Set<THREE.Texture>()}
  const plate=createPlate(scene,ceramic,resources), [texture]=resources.textures as Set<THREE.DataTexture>
  plate.layout({x:10,y:20,width:100,height:60})
  modelApi.beginHoneyStroke(model,'knife',target)
  for(const i of [0,1])modelApi.recordHoneyKnife(model,i,0,Array.from({length:16},(_,bin)=>bin))
  modelApi.endHoneyStroke(model)
  modelApi.beginHoneyStroke(model,'honey',target)
  if(qualified)modelApi.syncHoneyCoating(model,[.36,.35,.34,.33])
  const drop={visible:false,position:new THREE.Vector3(),scale:new THREE.Vector3(),material:{uniforms:{alpha:{value:0}}}}
  const fruitDoses:number[]=[], noEffect=()=>{}
  const ctx={
    ...modelApi,createFruitLanding,stepFruitLanding,model,family:'honeyPear',honeySound:'cook.honey-flow',
    held:{tool:'honey'},drop,honeyDrop:null,creamRelease:null,coating:{value:.8,velocity:0},
    cursor:target,contact:target,bottom:target,strandTip:{x:target.x,y:target.y-24},
    strandTail:0,strength:0,show:false,dt:1/60,surface:{rx:100,ry:60},
    pearView:{releaseTrace:noEffect,hit:()=>occluded,paint:(_a:modelApi.HoneyPoint,_b:modelApi.HoneyPoint,dose:number)=>fruitDoses.push(dose)},
    plateView:{...plate,paint(...args:Parameters<typeof plate.paint>){doses.push(args[2]);plate.paint(...args)}},
    foods:[],returnTool:noEffect,setBaySoundContact:noEffect,updateFoodState:noEffect, layout:noEffect,sync:noEffect,
    playBaySound:(id:string)=>sounds.push(id),lastContact:null,grippedDough:null,gripMaterial:null,knifeTransport:false,
    loaded:true,lost:false,destroyed:false,physicalQuiet:false, angle:(v:number)=>v,
    options:{onCancel:noEffect,onComplete:(_result:unknown)=>false},
    actions:undefined as unknown as {release(commit?:boolean):void;paintGlaze(from:modelApi.HoneyPoint,to:modelApi.HoneyPoint,amount:number):void;frame():void;finishRecipe():void},
  }
  runInNewContext(branch,ctx)
  const wet=()=>texture.image.data.some((v:number,i:number)=>i%4===0&&v>0)
  const finishDrop=()=>{for(let i=0;i<55;i++){ctx.actions.frame();plate.update(ctx.dt)}}
  return {ctx,model,plate,wet,finishDrop,doses,fruitDoses,sounds,dispose(){
    for(const items of Object.values(resources))for(const item of items)item.dispose()
    ceramic.dispose()
  }}
}

test('the drop already emitted on release wets exposed plate during settling exactly once',()=>{
  const k=atRelease()
  try{
    assert.equal(k.model.pending,'settling')
    k.ctx.actions.release()
    assert.ok(k.ctx.honeyDrop);assert.equal(k.model.stage,'settling')
    const step=[...k.model.steps], coverage=[...k.model.coated]
    k.ctx.actions.paintGlaze(k.ctx.bottom,k.ctx.bottom,1)
    assert.deepEqual(k.doses,[],'ongoing fresh paint stops as before')
    k.finishDrop();k.finishDrop()
    assert.ok(k.wet(),'the visible release drop should leave real retained plate film')
    assert.deepEqual(k.doses,[.38*.8]);assert.deepEqual(k.fruitDoses,[])
    assert.deepEqual(k.sounds,['cook.honey-end']);assert.equal(k.ctx.honeyDrop,null)
    assert.deepEqual([...k.model.coated],coverage);assert.deepEqual(k.model.steps,step)
  }finally{k.dispose()}
})

test('ordinary glaze and release still wet the plate without fruit credit; rim and occluded final drops stay dry',()=>{
  const ordinary=atRelease(false)
  try{
    ordinary.ctx.actions.paintGlaze(ordinary.ctx.bottom,ordinary.ctx.bottom,.2)
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
      k.ctx.actions.release();assert.ok(k.ctx.honeyDrop)
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
