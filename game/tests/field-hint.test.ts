import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {createFarm, cropDefinitions, getBedAction, getBedHarvestPreview, needsSeedChoice, selectSeed, getWaterCapacity, refillWater, workBed, upgradeBuilding, facilitySpecializations} from '../src/farm.ts'
import {plannedCropAt,saveGardenPlan,followGardenPlan} from '../src/garden-plans.ts'
import {compactFieldHintRooms, fieldHintOverlaps} from '../src/field-hint.ts'

const view={width:568,height:320},field={left:134,right:434}
const controls=[{x:9,y:9,width:306,height:48},{x:404,y:9,width:155,height:48},{x:350,y:65,width:208,height:55},{x:86,y:254,width:398,height:57},{x:9,y:202,width:95,height:44}]
const bands={top:57,bottom:254,obstacles:controls}

test('short landscape reuses free side space without covering soil or controls',()=>{
  const rooms=compactFieldHintRooms(view,field,bands)
  assert.ok(rooms.length)
  for(const room of rooms){
    assert.ok(room.x+room.maxWidth<=field.left-8||room.x>=field.right+8)
    assert.ok(room.x>=10&&room.x+room.maxWidth<=558)
    assert.ok(room.top>=65&&room.bottom<=246)
    assert.equal(fieldHintOverlaps({x:room.x,y:room.top,width:room.maxWidth,height:room.bottom-room.top},controls),false)
  }
  assert.ok(rooms.some(room=>room.bottom-room.top>=84),'wrapped next-action copy fits')
})

test('the result toast cannot hide the separate sow or water step',()=>{
  const obstacles=[...controls,{x:260,y:178,width:299,height:58}]
  const rooms=compactFieldHintRooms(view,field,{...bands,obstacles})
  const fit=rooms.find(room=>room.bottom-room.top>=84)!
  assert.ok(fit)
  assert.ok(fit.x+fit.maxWidth<=field.left-8,'uses free left margin while toast occupies right')
  assert.equal(fieldHintOverlaps({x:fit.x,y:fit.bottom-84,width:fit.maxWidth,height:84},obstacles),false)
})

test('portrait, roomy, narrow and crowded layouts keep their existing placement',()=>{
  for(const viewport of [{width:360,height:640},{width:568,height:568},{width:960,height:430},{width:900,height:480}])
    assert.deepEqual(compactFieldHintRooms(viewport,field,bands),[])
  assert.deepEqual(compactFieldHintRooms(view,{left:90,right:470},bands),[])
  assert.deepEqual(compactFieldHintRooms(view,field,{...bands,top:240}),[])
})

test('only painted-control collisions count, not empty HUD-wrapper space',()=>{
  assert.equal(fieldHintOverlaps({x:67.45,y:30.75,width:200.3,height:30},controls),true)
  assert.equal(fieldHintOverlaps({x:294.93,y:30.75,width:200.3,height:30},controls),true)
  assert.equal(fieldHintOverlaps({x:294.93,y:169.66,width:200.3,height:30},controls),false)
  assert.equal(fieldHintOverlaps({x:67.45,y:80,width:200.3,height:30},controls),false)
})

test('the well hint follows the real watering can and leaves irrigation destinations intact',()=>{
  const farm=createFarm()
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const part=(from:string,to:string)=>main.slice(main.indexOf(from),main.indexOf(to,main.indexOf(from)))
  const code=stripTypeScriptTypes(part('const locationLabels =','function updateFieldContext(')
    + 'const controls={'+part('  inspect(target) {','  activate: activateTarget')+'};controls.inspect({kind:"well"})')
  const inspect=()=>runInNewContext(code,{farm,getWaterCapacity,branchDefinitions:facilitySpecializations.well,updateFieldContext(){}})
  const full='Колодец · Лейка полна', refill='Колодец · Набрать воды'
  assert.equal(farm.water,6); assert.equal(inspect(),full); assert.equal(refillWater(farm).ok,false)
  const dryBed=farm.beds.findIndex((_,i)=>getBedAction(farm,i).kind==='water')
  assert.ok(workBed(farm,dryBed).ok); assert.equal(farm.water,5); assert.equal(inspect(),refill)
  assert.ok(refillWater(farm).ok); assert.equal(farm.water,6); assert.equal(inspect(),full)
  assert.ok(upgradeBuilding(farm,'well').ok); assert.equal(farm.water,getWaterCapacity(farm)); assert.equal(inspect(),'Поливной колодец')
  for(const branch of ['rain','pipes'] as const){
    farm.wellSpecialization=branch
    assert.equal(inspect(),facilitySpecializations.well[branch].name)
  }
})

test('the hoe only directs the player to untilled soil while a till action exists',()=>{
  const farm=createFarm()
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const hotbar=stripTypeScriptTypes(main.slice(main.indexOf('function useHotbar('),main.indexOf('function highlightControl('))+";useHotbar('hoe')")
  const expected='Выберите пустую грядку, чтобы вскопать её.'
  function chooseHoe(){
    const before=structuredClone(farm),events:string[]=[]
    const ctx={farm,needsSeedChoice,activeTool:'seeds',status(){events.push('status')},canvas:{focus(){events.push('focus')}},notify(msg:string){events.push(msg)}}
    runInNewContext(hotbar,ctx)
    assert.deepEqual(farm,before);assert.equal(ctx.activeTool,'hoe')
    assert.deepEqual(events.slice(0,2),['status','focus']);assert.equal(events.length,3)
    return events[2]
  }
  const tillable=()=>farm.beds.map((_,i)=>i).filter(i=>getBedAction(farm,i).kind==='till')
  assert.deepEqual(tillable(),[0,8]);assert.equal(chooseHoe(),expected)
  assert.ok(selectSeed(farm,'beetroot').ok);assert.ok(workBed(farm,13).ok)
  assert.equal(farm.seeds.beetroot,0);assert.equal(chooseHoe(),'Выберите семена.')
  assert.ok(selectSeed(farm,'carrot').ok);assert.equal(chooseHoe(),expected)
  assert.ok(workBed(farm,0).ok);assert.deepEqual(tillable(),[8]);assert.equal(chooseHoe(),expected)
  assert.ok(workBed(farm,8).ok);assert.deepEqual(tillable(),[])
  assert.deepEqual([...new Set(farm.beds.map((_,i)=>getBedAction(farm,i).kind))].sort(),['harvest','plant','water'])
  assert.equal(farm.day,1);assert.equal(chooseHoe(),'Все грядки уже вскопаны.')
})

test('the field card and the canvas announce the existing seed picker before it intercepts untilled ground',()=>{
  const farm=createFarm(), main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const part=(from:string,to:string)=>main.slice(main.indexOf(from),main.indexOf(to,main.indexOf(from)))
  const code=stripTypeScriptTypes(part('function updateFieldContext(','function readFieldHintBands()')+
    'const controls={'+part('  inspect(target) {','  activate: activateTarget')+'};controls.inspect({kind:"bed",index})')
  function hints(index:number){
    const contextButton={textContent:'',dataset:{action:''},hidden:false}, before=structuredClone(farm)
    const hint=runInNewContext(code,{farm,index,contextBed:undefined,contextButton,contextCard:{hidden:false},contextIcon:{getAttribute(){return ''}},
      portraitView:{matches:true},fieldViewButton:{getAttribute(){return 'true'}},iconUrl:(id:string)=>id,updateFieldContextCopy(){},getBedAction,getBedHarvestPreview,cropDefinitions,plannedCropAt,needsSeedChoice})
    assert.deepEqual(farm,before);return [hint,contextButton.textContent,contextButton.dataset.action,contextButton.hidden]
  }
  assert.ok(selectSeed(farm,'beetroot').ok);assert.ok(workBed(farm,13).ok);assert.equal(farm.seeds.beetroot,0)
  assert.deepEqual(hints(0),['Целина · Выбрать семена','Выбрать семена','work-context',false])
  assert.ok(selectSeed(farm,'carrot').ok)
  assert.deepEqual(hints(0),['Целина · Вскопать землю','Вскопать землю','work-context',false])
  const beds=farm.beds.map((_,i)=>i===0?'beetroot' as const:null)
  assert.ok(saveGardenPlan(farm,0,{name:'Свёкла',crops:beds},farm.gardenPlans.revision).ok);assert.ok(followGardenPlan(farm,0,farm.gardenPlans.revision).ok)
  assert.deepEqual(hints(0),['Целина · Выбрать семена · По плану','Выбрать семена','work-context',false])
})

test('the watering can suggests a plant only while a bed actually needs water',()=>{
  const farm=createFarm()
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const action=stripTypeScriptTypes(main.slice(main.indexOf('function useHotbar('),main.indexOf('function highlightControl('))+";useHotbar('water')")
  const targets=()=>farm.beds.map((_,i)=>i).filter(i=>getBedAction(farm,i).kind==='water')
  const actions:string[]=[],ctx={farm,getBedAction,activeTool:'hoe',status(){},canvas:{focus:()=>actions.push('canvas')},
    notify:(text:string)=>actions.push(text),activateTarget:(target:{kind:string})=>actions.push(target.kind)}
  const choose=()=>{
    const before=structuredClone(farm);actions.length=0;runInNewContext(action,ctx)
    assert.equal(ctx.activeTool,'water');assert.deepEqual(farm,before);return actions.slice()
  }
  const wet=['canvas','Выберите растение, которому нужна вода.'],empty=['canvas','Наберите воду в колодце.']
  const initial=targets();assert.equal(initial.length,6);assert.deepEqual(choose(),wet)
  for(const i of initial)assert.ok(workBed(farm,i).ok)
  assert.equal(farm.water,0);assert.deepEqual(choose(),empty)
  assert.ok(refillWater(farm).ok);assert.equal(farm.water,6);assert.deepEqual(targets(),[])
  assert.deepEqual(choose(),['canvas','Сейчас поливать нечего.'])
  const bed=farm.beds.findIndex((_,i)=>getBedAction(farm,i).kind==='plant' && getBedAction(farm,i).available)
  assert.ok(bed>=0);assert.ok(workBed(farm,bed).ok);assert.deepEqual(targets(),[bed])
  assert.deepEqual(choose(),wet);assert.ok(workBed(farm,bed).ok)
  assert.equal(farm.day,1);assert.equal(farm.water,5);assert.deepEqual(choose(),['canvas','Сейчас поливать нечего.'])
  assert.ok(upgradeBuilding(farm,'well').ok);assert.deepEqual(choose(),['well'])
})
