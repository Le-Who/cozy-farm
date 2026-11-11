import assert from 'node:assert/strict'
import test from 'node:test'
import { createFarm } from '../src/farm.ts'
import { BerryNurserySelection, renderBerryNursery, getBerryNurserySource } from '../src/berry-nursery.ts'
import { isGuardedAction, ActivationKeyGuard } from '../src/action-click-guard.ts'
function garden() { const f = createFarm(); f.beds[0] = { kind:'crop', crop:'blueberry', growth:3, watered:false, trait:'dew' }; f.beds[2] = { kind:'tilled' }; return f }
test('nursery source, destination, cancellation and previews own no resources',()=>{
 const f=garden(), before=structuredClone(f), s=new BerryNurserySelection()
 assert.equal(s.choose(f,0),true); assert.equal(s.destination(f,2),true)
 const html=renderBerryNursery(f,s,k=>`<img alt="${k}">`)
 assert.match(html,/Готовый урожай сейчас не получите/); assert.match(html,/Возраст обеих посадок начнётся с нуля/)
 assert.match(html,/3 ночи/); assert.match(html,/росистая черника/i)
 assert.deepEqual(f,before); s.reset(); assert.equal(s.selected,undefined);assert.deepEqual(f,before)
 assert.equal(s.divide(f).ok,false)
})
test('a nursery confirmation commits once and exposes its receipt, stale source never commits',()=>{
 const f=garden(),s=new BerryNurserySelection();s.choose(f,0);s.destination(f,2)
 assert.equal(s.divide(f).ok,true);const after=structuredClone(f)
 assert.equal(s.divide(f).ok,false);assert.deepEqual(f,after)
 assert.match(renderBerryNursery(f,s,()=>''),/две молодые посадки/);s.reset();assert.equal(s.receipt,'')
 const g=garden();s.choose(g,0);s.destination(g,2);if(g.beds[0].kind==='crop')g.beds[0].trait='bright'
 const stale=structuredClone(g);assert.equal(s.divide(g).ok,false);assert.deepEqual(g,stale)
})
test('unavailable beds and another island cannot be selected; nursery activations own a held key',()=>{
 const f=garden(),s=new BerryNurserySelection();assert.equal(s.choose(f,2),false)
 s.choose(f,0);assert.equal(s.destination(f,0),false);assert.equal(s.destination(f,99),false)
 f.island='village';assert.equal(s.choose(f,0),false);assert.equal(s.destination(f,2),false)
 assert.match(renderBerryNursery(f,s,()=>''),/Родном острове/)
 const k=new ActivationKeyGuard()
 for(const a of ['source','destination','confirm','reset'])assert.equal(isGuardedAction(`berry-nursery-${a}`),true)
 assert.equal(k.blocks({key:'Enter',repeat:false},true),false)
 assert.equal(k.blocks({key:'Enter',repeat:true},false),true)
 k.release('Enter');assert.equal(k.blocks({key:'Enter',repeat:false},true),false)
})

test('a missing exact weather berry can offer preservation without redirecting ordinary or other traits',()=>{
 const f=garden(),before=structuredClone(f)
 const item={kind:'variants',item:'blueberry',trait:'dew',quantity:1} as const
 assert.equal(getBerryNurserySource(f,item),0)
 assert.equal(getBerryNurserySource(f,{...item,trait:'star'}),undefined)
 assert.equal(getBerryNurserySource(f,{kind:'produce',item:'blueberry',quantity:1}),undefined)
 assert.deepEqual(f,before);f.island='village';assert.equal(getBerryNurserySource(f,item),0)
 f.beds[2]={kind:'crop',crop:'carrot',growth:0,watered:false}
 assert.equal(getBerryNurserySource(f,item),0,'still explain how to prepare room in a full garden')
 if(f.beds[0].kind==='crop')f.beds[0].growth=0
 assert.equal(getBerryNurserySource(f,item),undefined)
})
