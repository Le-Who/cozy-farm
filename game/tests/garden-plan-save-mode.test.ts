import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {createFarm,cropIds,getBedAction,workBed,restoreCurrentFarm} from '../src/farm.ts'
import {followGardenPlan,removeGardenPlan,seedForBed} from '../src/garden-plans.ts'
import {GardenPlanEditor,renderGardenPlans,gardenPlanToken} from '../src/garden-plans-ui.ts'
import {gardenSeedQuote,buyGardenSeeds} from '../src/garden-seed-basket.ts'

// Real editor/model/renderer and app command/save boundary, with only the DOM
// and persistence adapters replaced. No invented stock or direct plan mutation.
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const commands=source.slice(source.indexOf("    case 'garden-shop': case 'garden-shop-scope':"),source.indexOf("    case 'visit-book-home':"))
const perform=source.slice(source.indexOf('function perform('),source.indexOf('\nconst bedTools'))
const nameInput=source.split('\n').find(line=>line.includes("event.target.matches('[data-garden-name]')"))!
function harness(){
 const farm=createFarm(),editor=new GardenPlanEditor(),saves:typeof farm[]=[]
 let html=''
 function draw(){const before=structuredClone(farm);html=renderGardenPlans(farm,editor,()=>'<i></i>');assert.deepEqual(farm,before)}
 const ctx:any={farm,gardenEditor:editor,cropIds,gardenPlanToken,followGardenPlan,removeGardenPlan,gardenSeedQuote,buyGardenSeeds,
  panel:'garden-plans',dialog:{open:true},dialogFeedback:{classList:{toggle:()=>{}},dataset:{}},dialogFeedbackTimer:0,window:{clearTimeout:()=>{},setTimeout:()=>0},playBaySound:()=>{},
  saveFarm:()=>saves.push(structuredClone(farm)),refresh:draw,drawPanel:draw}
 runInNewContext(stripTypeScriptTypes(perform+'\nfunction command(action:string,value?:string){switch(action){'+commands+'}}'),ctx)
 function command(action:string,value?:string){ctx.command(action,value);assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)}
 function rename(value:string){class Input{value:string;constructor(value:string){this.value=value}matches(s:string){return s==='[data-garden-name]'}};runInNewContext(stripTypeScriptTypes(nameInput),{...ctx,event:{target:new Input(value)},HTMLInputElement:Input})}
 command('garden-edit');command('garden-brush','wheat');for(const index of [0,8,13])command('garden-paint',String(index));command('garden-save');command('garden-follow','1:0')
 assert.equal(farm.selectedSeed,'carrot');assert.equal(farm.gardenPlans.active,0);assert.equal(seedForBed(farm,13),'wheat');assert.equal(farm.beds[13].kind,'tilled')
 return{farm,editor,saves,command,rename,draw,get html(){return html}}
}

test('saving unchanged active cells retains wheat sowing over manual carrot and only advances the plan revision',()=>{
 const h=harness(),f=h.farm,before=structuredClone(f),writes=h.saves.length,expected=structuredClone(f)
 h.command('garden-edit');assert.deepEqual(f,before);expected.gardenPlans.revision++
 h.command('garden-save')
 assert.deepEqual(f,expected);assert.equal(h.saves.length,writes+1);assert.deepEqual(h.saves.at(-1),expected)
 assert.match(h.html,/Посев по плану: Мой огород 1/);assert.match(h.html,/>Сеем по этому плану</)
 assert.equal(seedForBed(f,13),'wheat');assert.match(getBedAction(f,13).label,/пшеница/)
 assert.ok(workBed(f,13,0).ok);assert.equal(f.beds[13].kind,'crop');assert.equal((f.beds[13] as any).crop,'wheat')
 assert.equal(f.seeds.wheat,before.seeds.wheat-1);assert.equal(f.seeds.carrot,before.seeds.carrot);assert.equal(f.selectedSeed,'carrot')
 assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f)
})

test('rename or repaint-and-revert retains the active layout, but every save still invalidates a priced quote',()=>{
 for(const kind of ['unchanged','rename','revert'] as const){
  const h=harness(),f=h.farm,quote=gardenSeedQuote(f,0,'open')!,before=structuredClone(f),writes=h.saves.length,expected=structuredClone(f)
  assert.equal(quote.packs,1);assert.equal(quote.affordable,true)
  h.command('garden-edit')
  assert.match(h.html,/Если изменить раскладку грядок, посев по плану выключится\./)
  if(kind==='rename'){h.rename(' На хлеб ');expected.gardenPlans.pages[0]!.name='На хлеб'}
  if(kind==='revert'){h.command('garden-brush','carrot');h.command('garden-paint','13');h.command('garden-brush','wheat');h.command('garden-paint','13')}
  assert.deepEqual(f,before);expected.gardenPlans.revision++
  h.command('garden-save');assert.deepEqual(f,expected);assert.equal(h.saves.length,writes+1)
  assert.equal(seedForBed(f,13),'wheat');assert.match(h.html,/>Сеем по этому плану</)
  if(kind==='rename')assert.match(h.html,/Посев по плану: На хлеб/)
  const now=structuredClone(f),rejected=buyGardenSeeds(f,quote.token)
  assert.equal(rejected.ok,false);assert.match(rejected.message,/Список семян изменился/);assert.deepEqual(f,now)
  assert.notEqual(gardenSeedQuote(f,0,'open')!.token,quote.token);assert.equal(gardenSeedQuote(f,0,'open')!.packs,1)
  assert.ok(workBed(f,13,0).ok);assert.equal((f.beds[13] as any).crop,'wheat')
  assert.equal(f.seeds.wheat,before.seeds.wheat-1);assert.equal(f.seeds.carrot,before.seeds.carrot)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f)
 }
})

test('a real crop or manual-cell edit still pauses the active plan before the next ordinary sow',()=>{
 for(const brush of ['cabbage','none']){
  const h=harness(),f=h.farm,before=structuredClone(f),expected=structuredClone(f),writes=h.saves.length
  h.command('garden-edit');h.command('garden-brush',brush);h.command('garden-paint','13')
  assert.deepEqual(f,before)
  expected.gardenPlans.pages[0]!.crops[13]=brush==='none'?null:'cabbage';expected.gardenPlans.active=null;expected.gardenPlans.revision++
  h.command('garden-save');assert.deepEqual(f,expected);assert.equal(h.saves.length,writes+1);assert.deepEqual(h.saves.at(-1),expected)
  assert.equal(seedForBed(f,13),'carrot');assert.doesNotMatch(h.html,/Посев по плану:|>Сеем по этому плану</)
  assert.match(h.html,/>Сеять по плану</);assert.ok(workBed(f,13,0).ok)
  assert.equal((f.beds[13] as any).crop,'carrot');assert.equal(f.seeds.carrot,before.seeds.carrot-1);assert.equal(f.seeds.wheat,before.seeds.wheat)
 }
})

test('editing another page cannot pause or alter the active page, and its warning does not claim otherwise',()=>{
 const h=harness(),f=h.farm,before=structuredClone(f),writes=h.saves.length
 h.command('garden-slot','1');h.command('garden-edit');h.rename('Другой огород');h.command('garden-brush','beetroot');h.command('garden-paint','13')
 assert.doesNotMatch(h.html,/Если изменить раскладку грядок, посев по плану выключится/)
 assert.deepEqual(f,before);const expected=structuredClone(f)
 expected.gardenPlans.pages[1]={name:'Другой огород',crops:Array(16).fill(null)};expected.gardenPlans.pages[1]!.crops[13]='beetroot';expected.gardenPlans.revision++
 h.command('garden-save');assert.deepEqual(f,expected);assert.equal(h.saves.length,writes+1);assert.equal(seedForBed(f,13),'wheat')
 h.command('garden-edit');h.command('garden-brush','tomato');h.command('garden-paint','13');h.command('garden-save')
 expected.gardenPlans.pages[1]!.crops[13]='tomato';expected.gardenPlans.revision++
 assert.deepEqual(f,expected);assert.equal(h.saves.length,writes+2);assert.deepEqual(f.gardenPlans.pages[0],before.gardenPlans.pages[0])
})
