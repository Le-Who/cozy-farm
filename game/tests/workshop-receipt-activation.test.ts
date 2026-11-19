import assert from 'node:assert/strict'
import test from 'node:test'
import { installActionClickGuard } from '../src/action-click-guard.ts'

function withCapture(run:(h:ReturnType<typeof capture>)=>void){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'Element')
 Object.defineProperty(globalThis,'Element',{configurable:true,value:Control})
 try{run(capture())}finally{if(previous)Object.defineProperty(globalThis,'Element',previous);else Reflect.deleteProperty(globalThis,'Element')}
}
class Control{
 disabled=false
 className:string;dataset:{action?:string};inside:boolean;button:boolean
 constructor(className='',dataset:{action?:string}={},inside=true,button=true){this.className=className;this.dataset=dataset;this.inside=inside;this.button=button}
 closest(selector:string){return selector==='button'&&this.button?this:null}
 matches(selector:string){return selector==='.workshop-bake'&&this.className==='workshop-bake'}
}
function capture(){
 const handlers=new Map<string,Function>(),windowHandlers=new Map<string,Function>()
 const root={addEventListener(){},contains:(target:Control)=>target.inside,ownerDocument:{addEventListener:(type:string,handler:Function)=>handlers.set(type,handler),defaultView:{addEventListener:(type:string,handler:Function)=>windowHandlers.set(type,handler)}}}
 installActionClickGuard(root as unknown as HTMLElement)
 return{release:(key='Enter')=>handlers.get('keyup')!({key}),blur:()=>windowHandlers.get('blur')!(),key(target:Control,repeat=false,key='Enter'){
  let prevented=false,stopped=false
  handlers.get('keydown')!({target,key,repeat,preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}})
  assert.equal(prevented,stopped);return prevented
 }}
}

test('held Done owns Enter across restored Cook and cannot mount another workshop',()=>withCapture(h=>{
 const done=new Control('workshop-bake'),cook=new Control('dialog-button',{action:'cook'}),close=new Control('workshop-close')
 let focus=done,panel='workshop',mounts=0,leaves=0
 const press=(repeat:boolean)=>{
  if(h.key(focus,repeat))return
  if(panel==='workshop'){panel='kitchen';focus=cook;leaves++}else{panel='workshop';focus=close;mounts++}
 }
 press(false);for(let i=0;i<8;i++)press(true)
 assert.equal(mounts,0,'checking final kitchen panel alone misses alternating reopen/close cycles')
 assert.equal(leaves,1);assert.equal(panel,'kitchen');assert.equal(focus,cook)
 h.release();press(false);assert.equal(mounts,1,'a released fresh Cook gesture remains available')
}))

test('Bake or Done activation keeps ownership through lost focus, with release and blur recovery',()=>withCapture(h=>{
 const bake=new Control('workshop-bake'),body=new Control('',{},false,false),cook=new Control('dialog-button',{action:'cook'})
 for(const key of ['Enter',' ']){
  assert.equal(h.key(bake,false,key),false)
  assert.equal(h.key(body,true,key),true);assert.equal(h.key(cook,true,key),true)
  h.release(key);assert.equal(h.key(cook,false,key),false)
 }
 h.key(bake);h.blur();assert.equal(h.key(cook,true),false)
}))

test('tool shortcuts and unrelated fresh buttons keep their existing repeat behavior',()=>withCapture(h=>{
 const tool=new Control('workshop-object'),disabled=new Control('workshop-bake');disabled.disabled=true
 for(const key of ['ArrowRight','r',' '])assert.equal(h.key(tool,true,key),false)
 assert.equal(h.key(disabled),false);assert.equal(h.key(tool,true),false)
 assert.equal(h.key(new Control('dialog-button',{action:'cook'}),false),false)
}))

test('a held receipt review key cannot activate Deliver on the replacement page',()=>withCapture(h=>{
 const review=new Control('workshop-order',{action:'bread-basket-review'}),deliver=new Control('dialog-button',{action:'deliver-order'})
 for(const key of ['Enter',' ']){
  assert.equal(h.key(review,false,key),false);assert.equal(h.key(deliver,true,key),true)
  h.release(key);assert.equal(h.key(deliver,false,key),false);h.release(key)
 }
}))
