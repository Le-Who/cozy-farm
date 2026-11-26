import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {installActionClickGuard} from '../src/action-click-guard.ts'
import {buyFeed,feedBagPrice,feedBagSize,restoreCurrentFarm} from '../src/farm.ts'
import {chickenCarePlayer} from './fixtures/chicken-care-player.ts'

type Frame={name:string;at:number;x:number;y:number;trusted:boolean;detail:number;action?:string|null;value?:string|null;panel?:string|null;tag:string}
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
// Trusted portrait capture: same action order, relative times and coordinates.
const observed:Frame[]=[
  {
    "name": "Pet",
    "at": 0.0,
    "x": 115,
    "y": 474,
    "trusted": true,
    "detail": 1,
    "action": "pet",
    "value": "4",
    "panel": null,
    "tag": "BUTTON"
  },
  {
    "name": "Close",
    "at": 99.3,
    "x": 341,
    "y": 221,
    "trusted": true,
    "detail": 1,
    "action": null,
    "value": null,
    "panel": null,
    "tag": "BUTTON"
  },
  {
    "name": "World map",
    "at": 151.2,
    "x": 360,
    "y": 30,
    "trusted": true,
    "detail": 1,
    "action": null,
    "value": null,
    "panel": "guide",
    "tag": "BUTTON"
  },
  {
    "name": "Garden disclosure",
    "at": 453.7,
    "x": 195,
    "y": 520,
    "trusted": true,
    "detail": 1,
    "action": null,
    "value": null,
    "panel": null,
    "tag": "SUMMARY"
  },
  {
    "name": "Garden",
    "at": 532.4,
    "x": 114,
    "y": 476,
    "trusted": true,
    "detail": 1,
    "action": "open-panel",
    "value": "orchard",
    "panel": null,
    "tag": "BUTTON"
  }
]

function earned() {
  const p=chickenCarePlayer('orchard','hatchery')
  for(const action of ['feedChickens','endDay','collectEggs','incubateEgg','endDay','endDay'])p.act(action)
  assert.deepEqual([p.log.length,p.state.day,p.state.flockSize,p.state.fruit.apple],[26,4,5,0])
  return p
}

function harness() {
  const original=globalThis.Element
  class ElementAt {
    readonly dataset:Record<string,string|undefined>
    readonly row:Frame
    readonly disabled:boolean
    constructor(row:Frame,disabled=false){
      this.row=row;this.disabled=disabled
      this.dataset={action:row.action??undefined,panel:row.panel??undefined,value:row.value??undefined}
    }
    closest(selector:string){assert.equal(selector,'button');return this.row.tag==='BUTTON'?this:null}
  }
  let onClick:(e:unknown)=>void
  const app={addEventListener(type:string,listen:(e:unknown)=>void,capture:boolean){
    assert.equal(type,'click');assert.equal(capture,true);onClick=listen
  },ownerDocument:{addEventListener(){}}}
  Object.assign(globalThis,{Element:ElementAt})
  try{installActionClickGuard(app as unknown as HTMLElement)}
  finally{Object.assign(globalThis,{Element:original})}
  return {accept(frame:Frame,disabled=false){
    let prevented=false, stopped=false
    Object.assign(globalThis,{Element:ElementAt})
    try {
      onClick({target:new ElementAt(frame,disabled),detail:frame.detail,timeStamp:frame.at,clientX:frame.x,clientY:frame.y,isTrusted:frame.trusted,
        preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}})
    }finally{Object.assign(globalThis,{Element:original})}
    assert.equal(prevented,stopped)
    return !prevented
  }}
}

function replay(shortenCloseGap:number) {
  const g=harness(), p=earned()
  const start=structuredClone(p.state)
  let pane='hen-friendship';let gardenOpen=false
  const ops=[]
  const route=observed.map((frame,i)=>({...frame,at:i?frame.at-shortenCloseGap:frame.at}))
  for(const f of route) {
    if(!g.accept(f)){ops.push(f.name+':guard-blocked');continue}
    ops.push(f.name)
    if(f.name==='Pet')p.act('petChicken',4)
    if(f.name==='Close')pane='world'
    if(f.name==='World map'){assert.equal(pane,'world');pane='guide'}
    if(f.name==='Garden disclosure'){assert.equal(pane,'guide');gardenOpen=true}
    if(f.name==='Garden'){assert.equal(pane,'guide');assert.ok(gardenOpen);pane='orchard'}
  }
  assert.equal(p.state.henFriendship.hens[4].points,1)
  assert.deepEqual([p.state.coins,p.state.fruit,p.state.day,p.state.island],[start.coins,start.fruit,start.day,start.island])
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(p.state))),p.state)
  return {pane,ops,spentMs:route.at(-1)!.at,distance:Math.hypot(route[0].x-route.at(-1)!.x,route[0].y-route.at(-1)!.y)}
}

test('unmodified observed physical 532.4 ms timing passes and navigation itself spends nothing',()=>{
  assert.match(source,/class="dialog-close" type="button" aria-label="Закрыть меню"/)
  assert.match(source,/class="hud-button" type="button" data-panel="guide" aria-label="Открыть бухту"/)
  assert.match(source,/case 'open-panel': if\(value&&value in panelTitles\)openPanel\(value as Panel\);break/)
  const r=replay(0)
  assert.equal(r.spentMs,532.4);assert.ok(r.distance<3)
  assert.deepEqual(r.ops,['Pet','Close','World map','Garden disclosure','Garden'])
  assert.equal(r.pane,'orchard')
})

test('a real separate X and map sequence at 482.4 ms must not be mistaken for a Pet double-tap',()=>{
  // Keep the browser-observed geometry, action order, map/summary animation
  // intervals; only shorten Pet→the separate X from 99.3ms to 49.3ms.
  const r=replay(50)
  assert.equal(r.spentMs,482.4);assert.ok(r.distance<3)
  assert.deepEqual(r.ops,['Pet','Close','World map','Garden disclosure','Garden'])
  assert.equal(r.pane,'orchard')
})

test('same-point rapid touch and double click spend one bag only, with no unsafe reset by disabled/untrusted/keyboard clicks',()=>{
  const p=earned(),g=harness()
  const before=structuredClone(p.state)
  const f:Frame={name:'normal Buy Feed',at:50,x:80,y:400,trusted:true,detail:1,action:'buy-feed',tag:'BUTTON'}
  const purchase=(frame:Frame)=>{if(g.accept(frame))assert.ok(buyFeed(p.state).ok)}
  purchase(f)
  assert.ok(g.accept({...f,at:80,x:300,action:undefined,panel:'guide',detail:0}))
  assert.ok(g.accept({...f,at:85,x:300,action:undefined,panel:'guide',trusted:false}))
  assert.ok(g.accept({...f,at:90,x:300,action:undefined,panel:'guide'},true))
  assert.ok(g.accept({...f,at:92,x:300,action:undefined}))
  purchase({...f,at:95,detail:1});purchase({...f,at:100,detail:2})
  // A near-point replacement unguarded Close is still blocked if it is the same gesture.
  assert.equal(g.accept({...f,at:102,x:81,action:undefined,panel:'guide'}),false)
  assert.deepEqual([p.state.coins,p.state.feed,p.state.chickensFed],[before.coins-feedBagPrice,before.feed+feedBagSize,before.chickensFed])
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(p.state))),p.state)
  purchase({...f,at:551,detail:1})
  assert.equal(p.state.coins,before.coins-2*feedBagPrice)
})
