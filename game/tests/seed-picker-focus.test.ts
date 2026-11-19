import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { revealSeedPickerFocus } from '../src/seed-picker-focus.ts'

function fixture(top=304.125,bottom=374.125,desktop=false) {
 const calls:string[]=[],state={active:true,connected:true,keyboard:true,tile:true,rendered:true,header:true}
 const sticky={getBoundingClientRect:()=>desktop?{top:235.65625,bottom:321.5}:{top:78.28125,bottom:158.125}}
 const picker={querySelector:()=>state.header?sticky:null}
 const target={matches:(selector:string)=>{assert.equal(selector,'button.seed-picker-tile[data-action="preview-seed"]:focus-visible');return state.keyboard&&state.tile},closest:()=>picker,getClientRects:()=>state.rendered?[{}]:[],getBoundingClientRect:()=>({top,bottom}),focus:()=>calls.push('focus'),click:()=>calls.push('click')}
 const document={get activeElement(){return state.active?target:null}}
 let scrollTop=desktop?0:147
 const host={ownerDocument:document,contains:()=>state.connected,getBoundingClientRect:()=>desktop?{top:179.65625,bottom:782.5}:{top:77.28125,bottom:300},get scrollTop(){return scrollTop},set scrollTop(value:number){calls.push('scroll');scrollTop=value}}
 return{state,calls,host:host as unknown as HTMLElement,target:target as unknown as HTMLElement,scroll:()=>scrollTop}
}

test('actual short-viewport raspberry geometry reveals only the clipped tile plus its focus ring',()=>{
 const h=fixture();revealSeedPickerFocus(h.host,h.target)
 assert.equal(h.scroll(),226.125);assert.deepEqual(h.calls,['scroll'])
})

test('reverse keyboard focus reveals a tile hidden under the sticky crop header',()=>{
 const h=fixture(140,210);revealSeedPickerFocus(h.host,h.target)
 assert.equal(h.scroll(),123.875);assert.deepEqual(h.calls,['scroll'])
})

test('a fully visible seed tile keeps the exact existing scroll and focus',()=>{
 for(const [top,bottom] of [[170,240],[163.125,295]]) {
  const h=fixture(top,bottom);revealSeedPickerFocus(h.host,h.target)
  assert.equal(h.scroll(),147);assert.deepEqual(h.calls,[])
 }
})

test('recorded desktop round-trip and activation bounds remain a strict no-op',()=>{
 const h=fixture(583.5,660.5,true);revealSeedPickerFocus(h.host,h.target)
 assert.equal(h.scroll(),0);assert.deepEqual(h.calls,[])
})

test('stale, detached, pointer-focused, special-action and hidden controls never move the panel',()=>{
 for(const flag of ['active','connected','keyboard','tile','rendered','header'] as const) {
  const h=fixture();h.state[flag]=false;revealSeedPickerFocus(h.host,h.target)
  assert.equal(h.scroll(),147,flag);assert.deepEqual(h.calls,[],flag)
 }
})

test('real focusin integration waits for native focus scrolling and guards a later panel change',()=>{
 const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 const start=source.indexOf("dialogContent.addEventListener('focusin',")
 assert.ok(start>=0,'seed preview owns a dialog-content focus listener')
 const end=source.indexOf('// Native focus scrolling',start);assert.ok(end>start)
 const listeners:Record<string,(event:{target:unknown})=>void>={},frames:(()=>void)[]=[],reveals:unknown[][]=[]
 class Control {keyboard=true;matches(){return this.keyboard}}
 const dialogContent={addEventListener:(type:string,listener:(event:{target:unknown})=>void)=>{listeners[type]=listener}}
 const state={HTMLButtonElement:Control,dialogContent,dialog:{open:true},panel:'inventory',bagTab:'seeds',requestAnimationFrame:(frame:()=>void)=>frames.push(frame),revealSeedPickerFocus:(...args:unknown[])=>reveals.push(args)}
 runInNewContext(stripTypeScriptTypes(source.slice(start,end)),state)
 const target=new Control();listeners.focusin({target});assert.equal(reveals.length,0);assert.equal(frames.length,1)
 frames.shift()!();assert.equal(reveals.length,1);assert.deepEqual(reveals[0],[dialogContent,target])
 listeners.focusin({target});state.bagTab='harvest';frames.shift()!();assert.equal(reveals.length,1)
 state.panel='seeds';listeners.focusin({target});frames.shift()!();assert.equal(reveals.length,2,'the standalone hotbar picker reveals its focused crop regardless of the bag tab')
 assert.deepEqual(reveals[1],[dialogContent,target])
 listeners.focusin({target});state.panel='market';frames.shift()!();assert.equal(reveals.length,2)
 state.panel='seeds';listeners.focusin({target});state.dialog.open=false;frames.shift()!();assert.equal(reveals.length,2)
 target.keyboard=false;listeners.focusin({target});assert.equal(frames.length,0)
 listeners.focusin({target:{}});assert.equal(frames.length,0)
})
