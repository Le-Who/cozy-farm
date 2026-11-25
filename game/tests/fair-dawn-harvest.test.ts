import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {exposedTrait, getClimate} from '../src/climate.ts'
import {getNextFairGuest} from '../src/fair-return.ts'
import {renderRestPreview} from '../src/rest-preview-ui.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'
const steps = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8')) as {name:string;args:unknown[]}[]
const load = (f:F.FarmState) => F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!
const publicAct = <T extends unknown[]>(command:(f:F.FarmState,...args:T)=>F.ActionResult,f:F.FarmState,...args:T) => {
 const out = command(f,...args); assert.ok(out.ok,out.message)
}
function earnedDay18() {
 const p=commissionPlayer(steps.slice(0,steps.findIndex(s=>s.name==='serveFairGuest')+1))
 for(;p.state.day<16;)p.night()
 p.act('selectSeed','wheat'); p.act('workBed',3,0)
 if(F.getBedAction(p.state,3).kind==='water')p.act('workBed',3,0)
 p.night()
 if(F.getBedAction(p.state,3).kind==='water')p.act('workBed',3,0)
 p.night()
 if(p.state.produce.wheat>0)p.act('sellMarketItem','produce:wheat',p.state.produce.wheat)
 return p
}

test('same earned Day 18 save, wheat harvest before or after night',()=>{
 const p=earnedDay18(), f=p.state;assert.equal(f.day,18);assert.equal(f.produce.wheat,0);assert.equal(f.freight.warehouses.home.wheat??0,0)
 assert.deepEqual(getNextFairGuest(f)?.item,{kind:'produce',item:'wheat',quantity:3})
 assert.equal(F.getBedHarvestPreview(f,3)?.ordinary,3)
 const collect=load(f),wait=load(f)
 const snapshot=structuredClone(f), html=renderRestPreview(f,true);assert.deepEqual(f,snapshot)
 publicAct(F.workBed,collect,3,0)
 assert.doesNotMatch(renderRestPreview(collect,true), /data-fair-crop-prep/, "once carried, no reminder")
 publicAct(F.endDay,collect); publicAct(F.serveFairGuest,collect)
 assert.equal(collect.coins - f.coins,15)
 publicAct(F.endDay,wait); assert.equal(F.getBedHarvestPreview(wait,3)?.ordinary,2)
 publicAct(F.workBed,wait,3,0)
 const before=structuredClone(wait);assert.equal(F.serveFairGuest(wait).ok,false);assert.deepEqual(wait,before)
 console.log(JSON.stringify({earnedActions:p.actions,before:18,tomorrow:19,reward:collect.coins-f.coins,harvestNoon:3,harvestAfter:2,hasFairChoice:html.includes('data-fair-crop-prep')}))
 const button = html.match(/data-fair-crop-prep[^>]*data-action="focus-bed" data-value="(\d+)"[^>]*>К грядке · собрать сегодня/)
 assert.equal(button?.[1], '3')
 const main = readFileSync(new URL('../src/main.ts', import.meta.url),'utf8')
 const first = main.indexOf("    case 'focus-bed':"), next = main.indexOf("    case 'travel-panel':", first)
 assert.ok(first >= 0 && next > first)
 const actions: unknown[] = []
 runInNewContext(stripTypeScriptTypes("switch(action){" + main.slice(first,next) + "}"), {
   action:'focus-bed',value:button[1],closeDialog(){actions.push('close')},
   island:{focusTarget(value:unknown){actions.push(JSON.stringify(value))}},
 })
 assert.deepEqual(actions,['close',JSON.stringify({kind:'bed',index:3})])
 assert.deepEqual(f, snapshot, 'focus alone does not harvest, spend water, or end the day')
})

test('no new action when away; collecting a mature bed never requires water',()=>{
 const p=earnedDay18()
 assert.match(renderRestPreview({...p.state,water:0},true), /data-fair-crop-prep/)
 p.visit('grove')
 assert.doesNotMatch(renderRestPreview(p.state,true), /data-fair-crop-prep/)
})

test('no urgent harvest if the same ordinary wheat still covers the request at dawn',()=>{
 const p=earnedDay18(), tomorrow=p.state.day+1, {weather}=getClimate(tomorrow)
 const bed=p.state.beds.findIndex((b,i)=>b.kind==='tilled'&&!exposedTrait(tomorrow,weather,i+1))
 assert.ok(bed>=0, 'the earned farm has an available bed with no overnight exposure')
 p.act('transplantCrop',3,bed)
 assert.deepEqual(F.getBedHarvestPreview(p.state,bed),
   {crop:'wheat',total:3,ordinary:3,special:0,picnicBonus:0})
 assert.doesNotMatch(renderRestPreview(p.state,true),/data-fair-crop-prep/)
 p.night()
 assert.equal(F.getBedHarvestPreview(p.state,bed)?.ordinary,3)
 p.act('workBed',bed,0)
 p.act('serveFairGuest')
})

test('a real chunky picnic justifies one extra ordinary wheat today, not after another harvest or dawn',()=>{
 const p=earnedDay18()
 p.night()
 assert.deepEqual(getNextFairGuest(p.state)?.item,{kind:'dishes',item:'honeyCake',quantity:1})
 assert.doesNotMatch(renderRestPreview(p.state,true),/data-fair-crop-prep/)
 p.fruit('apple',2)
 const recipe=p.act('completeSignature',{base:'preserves',ingredients:[{id:'apple',quantity:2}]},
   {family:'preserves',processing:'chunky',fruit:[],steps:['mix','pour']}).recipeId
 assert.ok(recipe)
 while(p.state.day<22)p.night()
 assert.equal(p.state.day,22)
 assert.deepEqual(getNextFairGuest(p.state)?.item,{kind:'produce',item:'wheat',quantity:3})
 assert.equal(F.getBedHarvestPreview(p.state,3)?.ordinary,2)
 assert.doesNotMatch(renderRestPreview(p.state,true),/data-fair-crop-prep/)
 p.act('useSignature',recipe)
 const before=p.state
 const take=load(before), another=load(before), wait=load(before)
 assert.deepEqual(F.getBedHarvestPreview(before,3),
   {crop:'wheat',total:4,ordinary:3,special:1,trait:'star',picnicBonus:1})
 assert.match(renderRestPreview(before,true),/data-fair-crop-prep[^>]*data-action="focus-bed" data-value="3"/)
 const other=before.beds.findIndex((_,index)=>index!==3&&F.getBedHarvestPreview(before,index)?.crop!=='wheat'&&F.getBedAction(before,index).kind==='harvest')
 assert.ok(other>=0)
 publicAct(F.workBed,another,other,0)
 assert.equal(another.culinary.picnic,null)
 assert.doesNotMatch(renderRestPreview(another,true),/data-fair-crop-prep/)
 publicAct(F.workBed,take,3,0)
 publicAct(F.endDay,take)
 publicAct(F.serveFairGuest,take)
 assert.equal(take.produce.wheat,0)
 assert.equal(take.variants.wheat?.star,(before.variants.wheat?.star??0)+1)
 publicAct(F.endDay,wait)
 assert.equal(wait.culinary.picnic,null)
 assert.equal(F.getBedHarvestPreview(wait,3)?.ordinary,2)
 publicAct(F.workBed,wait,3,0)
 assert.equal(F.serveFairGuest(wait).ok,false)
})
