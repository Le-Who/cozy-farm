import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as farmApi from '../src/farm.ts'
import * as bedIntent from '../src/bed-work-intent.ts'
import { bedWorkSound } from '../src/farm-sounds.ts'
import { earlyFerryFarm } from './fixtures/early-ferry.ts'
import { communityReturnFixture } from './fixtures/community-return.ts'

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const islandSource = readFileSync(new URL('../src/island.ts', import.meta.url), 'utf8')
const js = (code: string) => stripTypeScriptTypes(code)
const tools = runInNewContext(js(main.slice(main.indexOf('const tools = ['), main.indexOf('type Tool =')) + '; tools'))
const hotbar = main.slice(main.indexOf('function useHotbar('), main.indexOf('function highlightControl('))
const activation = main.slice(main.indexOf('function activateTarget('), main.indexOf('function useHotbar('))
const statusLoop = main.slice(main.indexOf('  for (const button of hotbarButtons) {'), main.indexOf('  updateFieldContext(contextBed)'))
const keyboard = main.slice(main.indexOf("window.addEventListener('keydown', (event) => {"), main.indexOf('\nsaveRecovery ='))

function run(at: farmApi.IslandId, key = false) {
  const {farm} = communityReturnFixture('meeting')
  if (at !== farm.island) assert.ok(farmApi.sail(farm, at).ok)
  assert.ok(farmApi.restoreFarm(farm))
  const before = JSON.stringify(farm), calls: string[] = [], state: any = {
    farm, tools, activeTool: 'water', inventoryGroup:'shore', bagTab:'seeds', workshopRecipe:'bread',
    status: () => {}, notify: () => calls.push('notice'), openPanel: (panel: string) => calls.push(panel),
    activateTarget: (target: {kind:string}) => calls.push(target.kind), canvas: {focus: () => calls.push('canvas')},
    island:{isCrossing:()=>false},dialog:{open:false},window:{addEventListener: (_:string,fn:Function)=>{state.keydown=fn}},
  }
  runInNewContext(js(hotbar), state)
  if (key) {
    runInNewContext(js(keyboard), state)
    state.keydown({key:'5',code:'Digit5',preventDefault(){},defaultPrevented:false,repeat:false})
  } else runInNewContext("useHotbar('basket')", state)
  assert.equal(JSON.stringify(farm), before, 'opening a destination neither gathers nor changes the farm')
  return {calls,state}
}

for (const key of [false,true]) test(`basket ${key?'keyboard 5':'button'} has its island-specific action`, () => {
  const home = run('home',key)
  assert.deepEqual(home.calls,['inventory'])
  assert.equal(home.state.bagTab,'harvest');assert.equal(home.state.inventoryGroup,'harvest')
  assert.deepEqual(run('grove',key).calls,['orchard'])
  assert.deepEqual(run('cape',key).calls,['hive'], 'Cape opens the hive; actual honey collection is still separate')
  const village=run('village',key)
  assert.deepEqual(village.calls,['workshop']);assert.equal(village.state.workshopRecipe,'pastry')
})

test('accessible basket label and title name the actual destination on all islands', async () => {
  // Same dictionary supplied to the real status loop; import occurs after red baseline is recorded.
  const {basketHotbarLabels}=await import('../src/basket-hotbar.ts')
  for(const [at,label] of Object.entries({home:'Запасы',grove:'Сад',cape:'Пасека',village:'Кондитерская'})){
    const attrs:Record<string,string>={},image={getAttribute:()=>'',src:''},badge:any={}
    const button:any={dataset:{tool:'basket'},setAttribute:(key:string,value:string)=>{attrs[key]=value},removeAttribute:(key:string)=>{delete attrs[key]},querySelector:(selector:string)=>selector==='.slot-icon img'?image:badge}
    runInNewContext(js(statusLoop),{farm:{island:at},atHome:at==='home',tools,hotbarButtons:[button],activeTool:'basket',counts:{basket:3},iconUrl:(id:string)=>id,basketHotbarLabels})
    assert.equal(attrs['aria-label'],label);assert.equal(button.title,`${label} (5)`)
    assert.equal(button.hidden,false);assert.equal(button.disabled,false)
  }
})

test('ripe-bed harvesting never requires selecting the basket beforehand', () => {
  const opening=earlyFerryFarm();assert.ok(farmApi.endDay(opening).ok)
  const index=opening.beds.findIndex((_,i)=>farmApi.getBedAction(opening,i).kind==='harvest')
  assert.ok(index>=0,'honestly tended first crop is ready')
  for(const tool of tools){
    const farm=structuredClone(opening),expected=structuredClone(opening)
    assert.ok(farmApi.workBed(expected,index).ok)
    const state:any={...farmApi,...bedIntent,farm,activeTool:tool.id,bedWorkSound,bedTools:{till:'hoe',plant:'seeds',water:'water',harvest:'basket'},
      bayAudio:{primeEvents:()=>Promise.resolve()},playBaySound:()=>{},
      perform:(action:()=>{ok:boolean})=>action().ok,
      island:{isCrossing:()=>false,workBed:(_:number,kind:()=>string,commit:()=>void)=>{assert.equal(kind(),'harvest');commit()}},
    }
    runInNewContext(js(activation)+`;activateTarget({kind:'bed',index:${index}})`,state)
    assert.deepEqual(farm,expected,`direct bed activation still harvests with ${tool.id} selected`)
  }
})

test('existing pointer, Enter/Space and compact contextual harvesting still activate the bed directly', () => {
  const pointer=islandSource.slice(islandSource.indexOf("  canvas.addEventListener('pointerup'"),islandSource.indexOf("  canvas.addEventListener('focus'"))
  assert.match(pointer,/activate\(target\.target\)/)
  const keySource=islandSource.slice(islandSource.indexOf("  canvas.addEventListener('keydown'"),islandSource.indexOf("  motion.addEventListener('change'"))
  assert.match(keySource,/event\.key !== 'Enter' && event\.key !== ' '/)
  assert.match(keySource,/activate\(focused\.target\)/)
  assert.doesNotMatch(pointer+keySource,/activeTool|basket/)
  assert.match(main,/case 'work-context': if \(contextBed !== undefined\) activateTarget\(\{ kind: 'bed', index: contextBed \}\)/)
})


test('home inventory shortcut is a dialog button, never a harvest toggle; other controls and islands stay unchanged', async () => {
  const {basketHotbarLabels}=await import('../src/basket-hotbar.ts')
  for (const island of ['home','grove','cape','village']) for (const activeTool of ['seeds','basket','hoe']) {
    const states=tools.map(({id}: {id:string})=>{
      const attrs:Record<string,string>={'aria-haspopup':'dialog'},image={getAttribute:()=>'',src:''},badge:any={}
      const button:any={dataset:{tool:id},setAttribute:(key:string,value:string)=>{attrs[key]=value},removeAttribute:(key:string)=>{delete attrs[key]},querySelector:(selector:string)=>selector==='.slot-icon img'?image:badge}
      return {button,attrs}
    })
    runInNewContext(js(statusLoop),{farm:{island,selectedSeed:'carrot'},atHome:island==='home',sowingPlan:undefined,cropDefinitions:farmApi.cropDefinitions,tools,hotbarButtons:states.map(s=>s.button),activeTool,counts:{basket:3},iconUrl:(id:string)=>id,basketHotbarLabels})
    for(const {button,attrs} of states){
      const shortcut=button.dataset.tool==='basket'&&island==='home'
      assert.equal(attrs['aria-pressed'],shortcut?undefined:String(button.dataset.tool===activeTool))
      if(shortcut)assert.equal(attrs['aria-haspopup'],'dialog')
      else if(button.dataset.tool==='basket')assert.equal(attrs['aria-haspopup'],undefined,'home popup semantics cannot leak into another island')
    }
  }
})
