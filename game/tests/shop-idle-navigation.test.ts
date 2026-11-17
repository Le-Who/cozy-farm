import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createBayShop, setBayShopOpen, advanceBayShop, advanceBayShopDay, bayShopPhaseDuration } from '../src/bay-shop-model.ts'

class SceneHost extends EventTarget {
  innerHTML = ''
  querySelector() { return null }
  querySelectorAll() { return [] }
  contains() { return false }
}

test('closed idle browsing is write-free while active clocks and a final departure remain persisted', async () => {
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'})
  const previous=new Map<string,PropertyDescriptor|undefined>()
  let scene:{destroy():void}|undefined,frame:FrameRequestCallback=()=>{}
  try{
    const {mountBayShop}=await server.ssrLoadModule('/src/bay-shop.ts')
    const globals={document:Object.assign(new EventTarget(),{activeElement:null,hidden:false}),HTMLElement:SceneHost,HTMLInputElement:class{},
      matchMedia:()=>({matches:true}),requestAnimationFrame:(callback:FrameRequestCallback)=>{frame=callback;return 1},cancelAnimationFrame:()=>{},ResizeObserver:class{observe(){}disconnect(){}}}
    for(const[name,value]of Object.entries(globals)){previous.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true})}
    for(const kind of ['idle','idle-dirty','open-wait','open-visitor','closed-departing','finished-departure']){
      const state=createBayShop()
      if(kind!=='idle'&&kind!=='idle-dirty')setBayShopOpen(state,true)
      if(kind==='open-visitor'||kind==='closed-departing'||kind==='finished-departure'){
        advanceBayShop(state,1000);advanceBayShop(state,200);assert.ok(state.visitor)
        if(kind!=='open-visitor')setBayShopOpen(state,false)
        if(kind==='finished-departure'){let ms=bayShopPhaseDuration.departing-1;while(ms>0){const step=Math.min(1000,ms);advanceBayShop(state,step);ms-=step}}
      }
      const before=structuredClone(state),saved:typeof state[]=[]
      scene=mountBayShop(new SceneHost(),{state,products:()=>[],takeStock:()=>false,returnStock:()=>{},onEarn:()=>assert.fail('no sale in this navigation check'),onChange:()=>saved.push(structuredClone(state)),onClose:()=>{}})
      if(kind==='idle-dirty')advanceBayShopDay(state,2)
      frame(performance.now()+100)
      scene.destroy();scene=undefined
      if(kind==='idle'){assert.deepEqual(state,before);assert.equal(saved.length,0,'merely entering/leaving a closed idle shop must not save')}
      else{assert.equal(saved.length,kind==='idle-dirty'||kind==='finished-departure'?1:2,kind);assert.deepEqual(saved.at(-1),state,kind);if(kind==='open-wait')assert.ok(state.waitMs<before.waitMs);if(kind==='closed-departing')assert.ok(state.visitor);if(kind==='finished-departure')assert.equal(state.visitor,null)}
    }
  }finally{
    scene?.destroy()
    for(const[name,value]of previous){if(value)Object.defineProperty(globalThis,name,value);else Reflect.deleteProperty(globalThis,name)}
    await server.close()
  }
})
