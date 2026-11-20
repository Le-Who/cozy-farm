import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as farmApi from '../src/farm.ts'
import { basketHotbarIcons, basketHotbarLabels } from '../src/basket-hotbar.ts'
import * as bedIntent from '../src/bed-work-intent.ts'
import { bedWorkSound } from '../src/farm-sounds.ts'
import { earlyFerryFarm } from './fixtures/early-ferry.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { communityReturnFixture } from './fixtures/community-return.ts'

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const islandSource = readFileSync(new URL('../src/island.ts', import.meta.url), 'utf8')
const js = (code: string) => stripTypeScriptTypes(code)
const tools = runInNewContext(js(main.slice(main.indexOf('const tools = ['), main.indexOf('type Tool =')) + '; tools'), { basketHotbarLabels, farm:{island:'home'} })
const hotbar = main.slice(main.indexOf('function useHotbar('), main.indexOf('function highlightControl('))
const activation = main.slice(main.indexOf('function activateTarget('), main.indexOf('function useHotbar('))
const statusLoop = main.slice(main.indexOf('  for (const button of hotbarButtons) {'), main.indexOf('  updateFieldContext(contextBed)'))
const keyboard = main.slice(main.indexOf("window.addEventListener('keydown', (event) => {"), main.indexOf('\nsaveRecovery ='))

function run(at: farmApi.IslandId, key = false, tool = 'basket', farm = communityReturnFixture('meeting').farm) {
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
    const digit=tools.find((entry:{id:string})=>entry.id===tool)!.key;
    state.keydown({key:digit,code:'Digit'+digit,preventDefault(){state.prevented=true},defaultPrevented:false,repeat:false})
  } else runInNewContext('useHotbar('+JSON.stringify(tool)+')', state)
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
  for(const [at,label] of Object.entries({home:'Припасы фермы',grove:'Сад',cape:'Пасека',village:'Кондитерская'})){
    const attrs:Record<string,string>={},image={getAttribute:()=>'',src:''},badge:any={}
    const button:any={dataset:{tool:'basket'},setAttribute:(key:string,value:string)=>{attrs[key]=value},removeAttribute:(key:string)=>{delete attrs[key]},querySelector:(selector:string)=>selector==='.slot-icon img'?image:badge}
    runInNewContext(js(statusLoop),{farm:{island:at},atHome:at==='home',tools,hotbarButtons:[button],activeTool:'basket',counts:{basket:3},iconUrl:(id:string)=>id,basketHotbarIcons,basketHotbarLabels})
    assert.equal(attrs['aria-label'],label);assert.equal(button.title,`${label} (5)`)
    assert.equal(image.src, at==='home'?'pack':at==='village'?'ui-handmade-round':'tool-crate')
    assert.equal(badge.textContent,'3')
    assert.equal(badge.hidden,at==='village')
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
  for (const island of ['home','grove','cape','village']) for (const activeTool of ['seeds','basket','hoe']) {
    const states=tools.map(({id}: {id:string})=>{
      const attrs:Record<string,string>={'aria-haspopup':'dialog'},image={getAttribute:()=>'',src:''},badge:any={}
      const button:any={dataset:{tool:id},setAttribute:(key:string,value:string)=>{attrs[key]=value},removeAttribute:(key:string)=>{delete attrs[key]},querySelector:(selector:string)=>selector==='.slot-icon img'?image:badge}
      return {button,attrs}
    })
    runInNewContext(js(statusLoop),{farm:{island,selectedSeed:'carrot'},atHome:island==='home',sowingPlan:undefined,cropDefinitions:farmApi.cropDefinitions,tools,hotbarButtons:states.map(s=>s.button),activeTool,counts:{basket:3},iconUrl:(id:string)=>id,basketHotbarIcons,basketHotbarLabels})
    for(const {button,attrs} of states){
      const shortcut=button.dataset.tool==='basket'&&island==='home'
      assert.equal(attrs['aria-pressed'],shortcut?undefined:String(button.dataset.tool===activeTool && !(island==='grove'&&button.disabled)))
      if(shortcut)assert.equal(attrs['aria-haspopup'],'dialog')
      else if(button.dataset.tool==='basket')assert.equal(attrs['aria-haspopup'],undefined,'home popup semantics cannot leak into another island')
    }
  }
})

test('first Grove landing enables only its three working shortcuts; returning Home restores the others',()=>{
  const farm=earlyFerryFarm(),slots=tools.map(({id}:{id:string})=>{
    const attrs:Record<string,string>={},image={getAttribute:()=>'',src:''},badge={};
    return {dataset:{tool:id},attrs,disabled:false,hidden:false,title:'',
      setAttribute:(k:string,v:string)=>attrs[k]=v,removeAttribute:(k:string)=>delete attrs[k],
      querySelector:(s:string)=>s==='.slot-icon img'?image:badge};
  });
  assert.ok(farmApi.sail(farm,'grove').ok);
  const expected=structuredClone(farm),events:string[]=[];
  const state:any={...farmApi,tools,farm,hotbarButtons:slots,atHome:false,counts:{},activeTool:'water',sowingPlan:null,
    iconUrl:(s:string)=>s,basketHotbarLabels,basketHotbarIcons,island:{isCrossing:()=>false,visit:()=>{}},status:()=>{},
    notify:(s:string)=>events.push(s),openPanel:(p:string)=>events.push(p),dialog:{open:false},
    window:{addEventListener:(_:string,fn:Function)=>state.keydown=fn}};
  runInNewContext(js(activation+hotbar+keyboard),state);
  const draw=()=>runInNewContext(js(statusLoop),state);
  draw();
  assert.equal(slots.filter((s:any)=>!s.hidden&&!s.disabled).map((s:any)=>s.dataset.tool).join(','),'basket,rod,boat');
  for (const slot of slots.filter((s:any)=>s.disabled)) {
    assert.equal(slot.hidden,false);assert.equal(slot.attrs['aria-pressed'],'false');assert.equal(slot.attrs['aria-keyshortcuts'],undefined);
    const key=tools.find((t:any)=>t.id===slot.dataset.tool).key;
    state.keydown({key,code:'Digit'+key,preventDefault(){}});
  }
  assert.deepEqual(events,[]);assert.equal(state.activeTool,'water');
  for(const key of ['5','7','8']) state.keydown({key,code:'Digit'+key,preventDefault(){}});
  assert.deepEqual(events,['orchard','fishing','boat']);assert.deepEqual(farm,expected);
  assert.ok(farmApi.sail(farm,'home').ok);state.atHome=true;draw();
  assert.equal(slots.filter((s:any)=>!s.hidden&&!s.disabled).length,8);
  assert.equal(slots.find((s:any)=>s.dataset.tool==='seeds').attrs['aria-keyshortcuts'],'3');
  state.keydown({key:'3',code:'Digit3',preventDefault(){}});
  assert.equal(events.at(-1),'seeds');
});


test('first Cape landing has no coop shortcut; the same key still leads to Home care and Village neighbors',()=>{
  const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
  const player=commissionPlayer(opening.slice(0,30));assert.equal(player.state.day,3);assert.equal(player.state.island,'cape')
  const cape=run('cape',true,'coop',player.state);assert.deepEqual(cape.calls,[]);assert.equal(cape.state.prevented,undefined)
  const attrs:Record<string,string>={},img={getAttribute:()=>'',src:''},badge={}
  const button={dataset:{tool:'coop'},disabled:false,title:'',setAttribute:(k:string,v:string)=>attrs[k]=v,removeAttribute:(k:string)=>delete attrs[k],querySelector:(s:string)=>s==='.slot-icon img'?img:badge}
  const paint=(farm:farmApi.FarmState)=>runInNewContext(js(statusLoop),{...cape.state,farm,atHome:farm.island==='home',hotbarButtons:[button],activeTool:'coop',counts:{},iconUrl:(s:string)=>s,basketHotbarLabels,basketHotbarIcons})
  paint(player.state);assert.ok(button.disabled);assert.equal(attrs['aria-pressed'],'false');assert.equal(attrs['aria-keyshortcuts'],undefined);assert.equal(button.title,'Курятник · Родной остров')
  for(const [island,title,panel] of [['home','Курятник','coop'],['village','Соседи','village']] as const){
    const available=run(island,true,'coop');paint(available.state.farm)
    assert.equal(button.disabled,false);assert.equal(attrs['aria-keyshortcuts'],'6');assert.equal(attrs['aria-label'],title)
    assert.deepEqual(available.calls,[panel]);assert.equal(available.state.prevented,true)
  }
})

test('Cape seed button and 3 never send a player to plant in an occupied meadow',()=>{
  const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
  const player=commissionPlayer(opening.slice(0,30))
  assert.equal(player.state.island,'cape');assert.equal(player.state.capeLevel,1)
  const action=(key:boolean)=>{
    const farm=player.state,before=structuredClone(farm),effects:string[]=[]
    const state:any={farm,tools,dialog:{open:false},getCapeHoney:farmApi.getCapeHoney,
      window:{addEventListener:(_:string,fn:Function)=>state.keydown=fn},notify:(s:string)=>effects.push(s),
      island:{isCrossing:()=>false,focusTarget:(t:{kind:string;index:number})=>effects.push(t.kind+':'+t.index)}}
    runInNewContext(js(hotbar+keyboard),state)
    if(key) state.keydown({key:'3',code:'Digit3',preventDefault(){},defaultPrevented:false,repeat:false})
    else state.useHotbar('seeds')
    assert.deepEqual(farm,before)
    return effects
  }
  const check=(want:string)=>{for(const key of [false,true])assert.deepEqual(action(key),[want])}
  const seeds=player.state.seeds[player.state.selectedSeed]
  for(let i=0;i<3;i++){check('flower:'+i);player.act('plantCapeFlower',i)}
  assert.equal(player.state.seeds[player.state.selectedSeed],seeds)
  check('Все клумбы засеяны. Цветы распустятся после ночи дома.')
  player.night();player.visit('cape')
  check('Все клумбы засеяны. В улье можно собрать мёд.')
  player.act('collectCapeHoney');check('Все клумбы засеяны. Сегодня мёд уже собран.')
  const attrs:Record<string,string>={},img={getAttribute:()=>'',src:''},badge:any={}
  const slot:any={dataset:{tool:'seeds'},setAttribute:(k:string,v:string)=>attrs[k]=v,removeAttribute:(k:string)=>delete attrs[k],querySelector:(s:string)=>s==='.slot-icon img'?img:badge}
  const draw=()=>runInNewContext(js(statusLoop),{farm:player.state,tools,atHome:player.state.island==='home',sowingPlan:null,hotbarButtons:[slot],activeTool:'boat',
    counts:{seeds},iconUrl:(s:string)=>s,cropDefinitions:farmApi.cropDefinitions})
  draw();assert.equal(slot.title,'Клумбы мыса (3)');assert.equal(attrs['aria-label'],'Клумбы мыса');assert.ok(badge.hidden)
  player.visit('home');draw();assert.match(slot.title,new RegExp(farmApi.cropDefinitions[player.state.selectedSeed].name));assert.equal(badge.hidden,false)
})
