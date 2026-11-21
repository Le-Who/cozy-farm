import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { createCookeryModel, placeCookeryFruit, rotateCookeryFruit } from '../src/cookery-model.ts'

const source=readFileSync(new URL('../src/cookery.ts',import.meta.url),'utf8')
const part=(from:string,to:string)=>{const start=source.indexOf(from),end=source.indexOf(to,start+1);assert.ok(start>=0&&end>start);return source.slice(start,end)}
const script=stripTypeScriptTypes(part('  function rotateSelection(', "  view.addEventListener('wheel',"))
  + stripTypeScriptTypes(part("  window.addEventListener('blur',", "  view.addEventListener('keydown',"))
const normalizeAngle=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle))
const start={x:200,y:130}, quarter={x:130,y:200}, half={x:60,y:130}

function setup(){
  const model=createCookeryModel('decorate'), selectedFruit=0
  assert.ok(placeCookeryFruit(model,selectedFruit,{x:.1,y:.2}))
  const fruit=model.fruit[0], origin={x:fruit.x,y:fruit.y}, abort=new AbortController()
  class Handle extends EventTarget{
    readonly captured:number[]=[]
    setPointerCapture(id:number){this.captured.push(id)}
  }
  const rotateHandle=new Handle(),window=new EventTarget(),tabletopBlur:string[]=[]
  runInNewContext(script,{model,selectedFruit,rotateHandle,window,signal:abort.signal,
    view:{getBoundingClientRect:()=>({left:10,top:10})},
    fruitArt:new Map([[selectedFruit,{mesh:{position:{x:120,y:120}}}]]),
    drag:null,normalizeAngle,rotateCookeryFruit,positionFruit(){},abandon:()=>tabletopBlur.push('blur'),
  })
  function send(type:string,pointerId:number,p=start,button=0){
    const e=Object.assign(new Event(type,{cancelable:true}),{pointerId,pointerType:'touch',button,clientX:p.x,clientY:p.y})
    rotateHandle.dispatchEvent(e)
    return e
  }
  function click(detail:number){
    rotateHandle.dispatchEvent(Object.assign(new Event('click'),{detail}))
  }
  function angle(expected:number){
    assert.ok(Math.abs(normalizeAngle(fruit.angle-expected))<1e-9,'angle was '+fruit.angle+' instead of '+expected)
    assert.deepEqual({x:fruit.x,y:fruit.y},origin,'the pie slice has not moved')
    assert.equal(model.stage,'fruit')
  }
  return {fruit,send,angle,click,rotateHandle,window,tabletopBlur,close:()=>abort.abort()}
}

test('the tart fruit handle ignores the old pointer after loss of capture, blur, or pointer cancellation',()=>{
  for(const cancel of ['lostpointercapture','blur','pointercancel'] as const)for(const moved of [false,true]){
    const h=setup(), original=h.fruit.angle, id=9
    try{
      h.send('pointerdown',id)
      if(moved)h.send('pointermove',id,quarter)
      const before=h.fruit.angle;h.angle(original+(moved?Math.PI/2:0))
      if(cancel==='blur')h.window.dispatchEvent(new Event('blur'))
      else h.send(cancel,id)
      // If capture transferred but the contact is still over the handle, native events
      // may still target it by hit testing. Neither path may change the angle.
      if(moved)h.send('pointermove',id,half)
      h.send('pointerup',id);h.click(1);h.angle(before)
      h.send('pointerdown',id);h.send('pointerup',id);h.angle(before+Math.PI/12)
      h.click(0);h.angle(before+Math.PI/6)
      assert.deepEqual(h.tabletopBlur,cancel==='blur'?['blur']:[])
    }finally{h.close()}
  }
})

test('only the captured pointer may move, cancel or release the rotation, and it rotates once',()=>{
  const h=setup(), original=h.fruit.angle, owner=2, other=7
  try{
    assert.equal(h.send('pointerdown',owner).defaultPrevented,true)
    for(const type of ['pointerdown','pointermove','pointerup','lostpointercapture','pointercancel'])h.send(type,other,half)
    assert.deepEqual(h.rotateHandle.captured,[owner])
    h.angle(original)
    h.send('pointermove',owner,quarter);h.send('pointerup',owner,quarter);h.click(1)
    h.angle(original+Math.PI/2)
    h.send('pointerup',owner,half);h.angle(original+Math.PI/2)
  }finally{h.close()}
})
