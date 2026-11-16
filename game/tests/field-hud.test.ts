import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
const source=readFileSync(new URL('../src/island.ts',import.meta.url),'utf8')
const sync=stripTypeScriptTypes(source.slice(source.indexOf('  let fieldHudKey:'),source.indexOf('  function updateCameraView()')))
const base={state:{island:'home'},fieldView:true,viewport:{width:568,height:320},offset:{x:-221.45863309352517,y:-173.82374100719423},fieldLeft:497.625,fieldRight:921.375,scale:197/278}
function projected(overrides:Record<string,unknown>={}){
 const calls:({left:number;right:number}|undefined)[]=[]
 runInNewContext(sync+';syncFieldHud()', {...base,...overrides,fieldHudChanged:(field:{left:number;right:number}|undefined)=>calls.push(field)})
 assert.equal(calls.length,1)
 return calls[0]
}
test('task rail receives the same current field projection used by hit testing, not a parallel camera formula',()=>{
 assert.equal(projected()!.right,base.offset.x+base.fieldRight*base.scale)
 assert.equal(projected()!.left,base.offset.x+base.fieldLeft*base.scale)
 assert.equal(projected({offset:{x:28,y:0},scale:0.4})!.right,28+base.fieldRight*0.4)
})
test('leaving short landscape, field view or home clears rail presentation',()=>{
 for(const overrides of [{state:undefined},{state:{island:'village'}},{state:{island:'grove'}},{fieldView:false},{viewport:{width:360,height:640}},{viewport:{width:1280,height:800}},{viewport:{width:844,height:480}}])assert.equal(projected(overrides),undefined)
 assert.equal(typeof projected({viewport:{width:844,height:390}}),'object')
})
test('optional presentation hook leaves the scene usable without a HUD consumer',()=>{
 assert.doesNotThrow(()=>runInNewContext(sync+';syncFieldHud()', {...base,fieldHudChanged:undefined}))
 assert.match(source,/world\.setView\([^\n]+\);\s+syncFieldHud\(\)/)
 assert.match(source,/world\.resize\([^\n]+\);\s+syncFieldHud\(\)/)
})

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const hook=stripTypeScriptTypes(main.slice(main.indexOf('function updateFieldHud()'),main.indexOf('const fieldHudObserver =')))
test('rail chooses actual safe space, switching sides for a notch and leaving cramped layouts unchanged',()=>{
 for(const [field,header,expected,width] of [
  [{left:131,right:432},{left:9,right:559,height:48},'right','119px'],
  [{left:131,right:432},{left:24,right:524,height:48},'left','99px'],
  [{left:131,right:432},{left:44,right:524,height:48},undefined,undefined],
  [undefined,{left:9,right:559,height:48},undefined,undefined],
 ] as const){
  const values:Record<string,string>={},app={dataset:{fieldRail:'stale'} as {fieldRail?:string},style:{setProperty:(k:string,v:string)=>{values[k]=v}},querySelector:()=>({getBoundingClientRect:()=>header})}
  runInNewContext(hook+';updateFieldHud()',{app,taskRailField:field,taskRailKey:''})
  assert.equal(app.dataset.fieldRail,expected);assert.equal(values['--field-rail-width'],width)
 }
})
test('unchanged camera frames do not notify or measure HUD again; real geometry changes do',()=>{
 let calls=0
 runInNewContext(sync+'; for(let i=0;i<100;i++)syncFieldHud(); viewport.width+=1; syncFieldHud(); fieldView=false; syncFieldHud(); syncFieldHud()', {...base,fieldHudChanged:()=>calls++})
 assert.equal(calls,3)
 let reads=0,writes=0
 const app={dataset:{} as {fieldRail?:string},style:{setProperty:()=>writes++},querySelector:()=>({getBoundingClientRect:()=>{reads++;return{left:9,right:559,height:48}}})}
 runInNewContext(hook+';updateFieldHud();updateFieldHud()',{app,taskRailField:{left:131,right:432},taskRailKey:''})
 assert.equal(reads,2,'HUD measurements only enter via changed projection or ResizeObserver')
 assert.equal(writes,2,'unchanged measured HUD bounds cannot cause repeated style writes')
 assert.match(main,/new ResizeObserver\(updateFieldHud\)/)
})
