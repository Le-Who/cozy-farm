import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {getNeighborSceneState} from '../src/neighbor-scene.ts'
import {lavenderVillageAnchors} from '../src/lavender-village.ts'
import {festivalRewardArt} from '../src/festival-art.ts'
import {harbourCamera,harbourScreenPoint} from '../src/harbour-view.ts'
import {stripTypeScriptTypes as strip} from 'node:module'
import {runInNewContext as vm} from 'node:vm'
import {cloneBayPattern,normalizeBayMusicState,bayFestivalPattern,createBayMusicState,BAY_INSTRUMENTS,bayActiveVoices,bayPerformanceQuality,type BayMusicState} from '../src/bay-music-model.ts'
import {restoreCurrentFarm,getShellAt,getBedStage,getBedAction,getNeighborPlans,residentIds,type FarmState} from '../src/farm.ts'
import {installGardenInstrument} from '../src/harbour-economy.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const music=readFileSync(new URL('../src/bay-music.ts',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/bay-music.css',import.meta.url),'utf8')
const between=(from:string,to:string,required=true)=>{
 const a=music.indexOf(from),b=music.indexOf(to,a)
 if(required)assert.ok(a>=0&&b>a,[from,to].join(' / '))
 return a>=0&&b>a?music.slice(a,b):''
}
const handlers=strip(between("  root.addEventListener('click'","  document.addEventListener('visibilitychange'"))
const operations=strip(`
 ${between('  const save = ()','  const say =')}
 ${between('  function showSheet(','  function pulse(')}
 ${between('  function clearReplacement(','  root.addEventListener',false)}
`)
const preset=music.split('\n').find(line=>line.startsWith('  presetSelect.value = '))!
const picker=strip(music.split('\n').find(line=>line.startsWith('    for (let i = 0; i < 3; i++) presetSelect'))!)
const compact=(pattern:BayMusicState)=>cloneBayPattern(pattern)
const copy=<T,>(p:T)=>JSON.parse(JSON.stringify(p)) as T

function earned(){
 const history=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
 const p=commissionPlayer(history)
 assert.deepEqual([p.state.day,p.actions,p.state.island,p.state.coins],[14,107,'village',68])
 for(let day=14;day<=15;day++){
  p.visit('grove');p.act('gatherSeaSalt')
  for(let spot=0;spot<3;spot++){assert.equal(getShellAt(p.state,spot),'regular');p.act('collectShell',spot)}
  if(day<15)p.night()
 }
 p.visit('village');assert.equal(installGardenInstrument(p.state),1);p.reload()
 assert.deepEqual([p.state.day,p.actions+1,p.state.coins,p.state.seaSalt,p.state.musicGarden.level],[15,121,68,1,1])
 return p.state
}
type UiTarget={ dataset:Record<string,string>;classList:{contains:(name:string)=>boolean};matches:(s:string)=>boolean;
 textContent:string;value:string;hidden:boolean;inert:boolean;scrollTop:number;isConnected:boolean;
 attributes:Map<string,string>;setAttribute:(k:string,v:string)=>void;removeAttribute:(k:string)=>void;focus:()=>void }
function mount(source:FarmState){
 const farm=copy(source), events=new Map<string,(event:any)=>void>(), attrs=new Map<string,UiTarget>(), statuses:string[]=[]
 const focus={activeElement:null as UiTarget|null}
 function target(name='',data:Record<string,string>={}):UiTarget{
  const attributes=new Map<string,string>()
  const t={dataset:data,classList:{contains:(n:string)=>n===name},matches:()=>false,textContent:'',value:'',
   hidden:false,inert:false,scrollTop:0,isConnected:true,attributes,
   setAttribute:(k:string,v:string)=>{attributes.set(k,v)},removeAttribute:(k:string)=>{attributes.delete(k)},focus:()=>{focus.activeElement=t}}
  return t
 }
 const query=(n:string)=>{if(!attrs.has(n))attrs.set(n,target(n.slice(1)));return attrs.get(n)!}
 const s={
  root:{addEventListener:(ev:string,f:(e:any)=>void)=>events.set(ev,f),querySelectorAll:()=>[]},
  signal:null,document:focus,HTMLElement:Object,sheet:null as string|null,sheetFocus:null as UiTarget|null,sheetFooter:target(),
  pendingReplacement:undefined,duet:{cancel(){}},cancelInstrumentPreview(){},remember(){},
  selected:'marimba',selectedNote:0,running:false,preparing:false,recording:false,withBea:false,
  options:{onSave:(musicGarden:BayMusicState)=>{farm.musicGarden=copy(musicGarden);writes++; assert.deepEqual(restoreCurrentFarm(copy(farm)),farm)}},
  state:normalizeBayMusicState(farm.musicGarden),normalizeBayMusicState,cloneBayPattern,bayFestivalPattern,createBayMusicState,BAY_INSTRUMENTS,
  nameInput:target(),presetSelect:{value:'',options:[{},{},{}],addEventListener:(ev:string,f:(e:any)=>void)=>events.set(ev,f)},
  saveButton:query('.bay-music-save'),replaceButton:query('.bay-music-confirm-replace'),playButton:{},recordButton:{},listen:{},expand:{},duetButton:{},
  query,update(){vm(picker,s)},say(message:string){statuses.push(message)},strike(){},paintConcert(){},stop(){stops++},
 }
 let writes=0,stops=0;
 const outside=target('melodies');outside.focus();s.replaceButton.hidden=true
 vm(preset,s);vm(operations+handlers,s);s.update();
 const click=(t:UiTarget,detail=1)=>{
  let stopped=false
  events.get('click')!({detail,target:{closest:()=>t},stopPropagation(){stopped=true}})
  return stopped
 }
 const open=()=>click(target('',{sheet:'library'}))
 const slot=(i:number)=>{s.presetSelect.value=String(i);events.get('change')!({})}
 const name=(name:string)=>{s.nameInput.value=name;events.get('input')!({target:s.nameInput})}
 const tempo=(value:number)=>events.get('input')!({target:{value:String(value),dataset:{},matches:(s:string)=>s==='.bay-music-tempo input'}})
 const note=(voice:string,step:number,n:number)=>{click(target('',{note:String(n)}));click(target('',{voice,step:String(step)}))}
 const key=(key:string,t:UiTarget,repeat=false)=>{
  let prevented=false;events.get('keydown')!({key,repeat,target:t,stopPropagation(){},preventDefault(){prevented=true}})
  return prevented
 }
 const cold=()=>restoreCurrentFarm(copy(farm))!;
 const festivalButton=()=>{
  const code=music.match(/<div class="bay-music-festival-list">.*?<\/div>/)?.[0]
  assert.ok(code,'use the actual reward markup')
  const html=vm('`'+code+'`',s) as string
  const row=html.match(/<button ([^>]*?) data-edition="1"([^>]*)>([^<]+)<\/button>/)
  assert.ok(row,html)
  return {html,button:target('bay-music-festival',{edition:'1'}),label:row[3]}
 }
 return {s,farm,focus,outside,cold,click,open,slot,name,tempo,note,key,query,statuses,festivalButton,get writes(){return writes},get stops(){return stops}}

}
function createTwo(){
 const f=mount(earned());f.open();f.name('Свет в гавани');f.tempo(96);
 f.note('marimba',1,3);f.note('harp',4,5);f.note('shaker',3,4)
 const first=compact(f.s.state)
 f.click(f.s.saveButton);assert.deepEqual(f.farm.musicGarden.saved,[first,null,null]);
 f.name('Ветер с мыса');f.tempo(78);
 f.note('marimba',1,6);f.note('harp',4,2);f.note('shaker',3,1)
 const next=compact(f.s.state);assert.notDeepEqual(first.tracks,next.tracks)
 const cold=f.cold();assert.deepEqual(cold.musicGarden.saved,[first,null,null]);assert.deepEqual(compact(cold.musicGarden),next)
 return {first,next,farm:cold}
}

test('one generic Save on the default occupied slot cannot overwrite actual authored work; separate confirmation can',()=>{
 const {first,next,farm}=createTwo(),f=mount(farm);f.open()
 assert.equal(f.s.presetSelect.value,'0');assert.equal(f.s.replaceButton.hidden,true)
 f.s.saveButton.focus();
 const owned=f.click(f.s.saveButton)
 assert.deepEqual(f.cold().musicGarden.saved,[first,null,null],'one generic Save from a freshly reopened album must not destroy a different true favorite')
 assert.equal(owned,true,'the same gesture does not bubble to another app action')
 assert.equal(f.writes,0);
 assert.equal(f.s.replaceButton.hidden,false)
 assert.equal(f.s.replaceButton.textContent,'Заменить «Свет в гавани»')
 assert.equal(f.s.saveButton.attributes.get('aria-expanded'),'true')
 assert.equal(f.focus.activeElement,f.s.saveButton,'the confirming button never takes the held focus')
 f.click(f.s.saveButton,2);f.click(f.s.saveButton,0);
 f.click(f.s.replaceButton,2);
 assert.equal(f.key('Enter',f.s.replaceButton,true),true,'held native Enter cannot activate confirmation')
 assert.equal(f.key(' ',f.s.replaceButton,true),true)
 assert.deepEqual(f.cold(),farm)
 f.s.replaceButton.focus();assert.equal(f.key('Enter',f.s.replaceButton),false,'a new native keyboard activation remains available')
 assert.equal(f.click(f.s.replaceButton,0),true);
 assert.equal(f.focus.activeElement,f.s.saveButton)
 assert.equal(f.s.replaceButton.hidden,true)
 assert.equal(f.s.saveButton.attributes.has('aria-expanded'),false)
 assert.deepEqual(f.cold(),{...farm,musicGarden:{...farm.musicGarden,saved:[next,null,null]}})
 assert.equal(f.writes,1)
 f.click(f.s.replaceButton,1);assert.equal(f.writes,1)
})

test('a new empty slot saves directly and the exact identical existing version stays a non-destructive no-op',()=>{
 const {first,next,farm}=createTwo(),f=mount(farm);f.open();f.slot(1);
 f.click(f.s.saveButton);assert.equal(f.writes,1)
 assert.deepEqual(f.cold().musicGarden.saved,[first,next,null])
 assert.equal(f.s.replaceButton.hidden,true)
 f.click(f.s.saveButton);assert.equal(f.writes,1)
 assert.deepEqual(f.cold().musicGarden.saved,[first,next,null])
 assert.equal(f.s.replaceButton.hidden,true)
 // A third sheet can be saved, then a deliberate occupied slot can still be replaced.
 f.name('Мох у воды');const third=compact(f.s.state);f.slot(2);f.click(f.s.saveButton)
 f.slot(0);f.click(f.s.saveButton);f.click(f.s.replaceButton)
 assert.deepEqual(f.cold().musicGarden.saved,[third,next,third])
})

test('slot switch, a draft edit, normal load, and Escape remove the exact pending replacement',()=>{
 const {first,next,farm}=createTwo(),f=mount(farm);f.open();f.click(f.s.saveButton)
 f.slot(1);f.click(f.s.replaceButton)
 assert.equal(f.s.replaceButton.hidden,true)
 f.slot(0);f.click(f.s.saveButton)
 // An already captured gesture can reach a formerly valid button, even before change redraw.
 f.s.presetSelect.value='1';f.click(f.s.replaceButton)
 assert.deepEqual(f.cold().musicGarden.saved,[first,null,null]);assert.equal(f.s.replaceButton.hidden,true)
 f.slot(0);f.click(f.s.saveButton);f.name('Другой ветер')
 f.click(f.s.replaceButton);
 assert.equal(f.s.replaceButton.hidden,true)
 assert.deepEqual(f.cold().musicGarden.saved,[first,null,null])
 f.click(f.s.saveButton);f.s.replaceButton.focus();f.key('Escape',f.s.replaceButton)
 assert.equal(f.s.replaceButton.hidden,true);assert.equal(f.focus.activeElement,f.outside);
 f.open();f.click(f.s.replaceButton);assert.equal(f.writes,1);
 f.click(f.s.saveButton);f.click(f.query('.bay-music-load'))
 assert.deepEqual(compact(f.cold().musicGarden),first,'the ordinary existing Load still works')
 assert.deepEqual(f.cold().musicGarden.saved,[first,null,null])
 assert.equal(f.s.replaceButton.hidden,true);
 assert.notDeepEqual(next.tracks,first.tracks)
})

test('library reserves one disclosure row and one existing status line before Save, without offering a hidden control',()=>{
 assert.match(music,/class="bay-music-save" aria-controls="bay-music-confirm-replace"/)
 assert.match(music,/id="bay-music-confirm-replace" class="bay-music-confirm-replace" hidden>Заменить<\/button>/)
 assert.match(css,/\.bay-music-library-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);grid-template-rows:auto minmax\(44px,auto\)\}/)
 assert.match(css,/\.bay-music-library-actions \.bay-music-confirm-replace\{grid-column:1\/-1;grid-row:2;justify-self:end;max-width:100%;padding-block:4px;overflow-wrap:anywhere\}/)
 assert.match(css,/\.bay-music-sheet:has\(\.bay-music-library-actions:not\(\[hidden\]\)\)>\.bay-music-sheet-status\{display:block;min-height:34px\}/)
 assert.match(css,/\.bay-music \[hidden\]\{display:none!important\}/)
 assert.doesNotMatch(music,/class="bay-music-confirm-replace[^>]*data-action/)
})


/** Ordinary production supplies and four completed rounds. Clock, paint, and audio outputs are not invoked. */
function firstFestivalScore(beforeAward?: (farm: FarmState) => void) {
 const history=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
 const p=commissionPlayer(history)
 p.act('beginFestival','stage')
 p.fruit('apple',5);p.visit('home');p.act('cookDish','appleJam');p.visit('village')
 p.act('contributeFestival','treat','orchardTart');p.act('contributeFestival','treat','appleJam')
 p.night()
 for(let n=0;p.state.produce.wheat<1;n++){
  assert.ok(n<8,'ordinary wheat matures')
  const live=p.state.beds.findIndex(b=>b.kind==='crop'&&b.crop==='wheat')
  if(live>=0){
   if(getBedStage(p.state.beds[live])==='ripe'){p.act('workBed',live);continue}
   if(getBedAction(p.state,live).kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',live)}
   p.night();continue
  }
  const free=p.state.beds.findIndex(b=>b.kind==='tilled');assert.ok(free>=0)
  if(!p.state.seeds.wheat)p.act('buySeeds','wheat')
  if(p.state.selectedSeed!=='wheat')p.act('selectSeed','wheat')
  p.act('workBed',free)
 }
 p.visit('village')
 for(let i=0;i<3;i++)p.act('contributeFestival','fruit','apple')
 p.act('contributeFestival','greens','wheat');p.night();p.visit('village')
 assert.equal(p.state.musicGarden.festivalUnlocked,false)
 const state=p.state.musicGarden
 const complete=strip(between('  function draw()', '  function stop(')+';draw();')
 vm(complete,{state, destroyed:false,running:true,scheduled:Array.from({length:64},(_,i)=>({step:i%16,time:i/6})),
  bayAudio:{currentTime:20},root:{querySelectorAll:()=>[]},currentStep:-1,available:()=>true,pulse(){},
  BAY_INSTRUMENTS,bayActiveVoices,bayPerformanceQuality,BAY_CONCERT_STEPS:64,stepsPerformed:0,rewarded:false,
  save(){},options:{},paintConcert(){},requestAnimationFrame:()=>0,frame:0})
 assert.equal(state.performances,1)
 p.reload();p.act('contributeFestival','concert','concert');p.night();p.visit('village')
 if(beforeAward){while(p.state.day<32){p.night();p.visit('village')}beforeAward(copy(p.state))}
 p.act('finishFestival')
 assert.deepEqual([p.state.musicGarden.festivalLevel,p.state.musicGarden.festivalUnlocked,p.state.musicGarden.saved],[1,true,[null,null,null]])
 return p.state
}

test('an earned festival title cannot overwrite a genuinely edited current draft until separate confirmation',()=>{
 const baseline=firstFestivalScore()
 const edited=mount(baseline);edited.name('Личная мелодия');edited.note('marimba',1,2)
 const original=edited.cold()
 const f=mount(original);f.open()
 const {html,button,label}=f.festivalButton()
 button.focus();f.click(button)
 assert.deepEqual(f.cold(),original,'opening the earned title must not silently erase the only copy of the active song')
 assert.match(label,/Открыть.*Вечер садовой сцены/)
 assert.match(html,/aria-controls="bay-music-confirm-replace"/)
 assert.equal(f.s.replaceButton.textContent,'Заменить «Личная мелодия»')
 assert.equal(f.writes,0);assert.equal(f.stops,0)
 assert.equal(button.attributes.get('aria-expanded'),'true')
 assert.equal(f.focus.activeElement,button)
 f.click(button,2)
 assert.equal(f.key('Enter',f.s.replaceButton,true),true)
 f.click(f.s.replaceButton,2)
 assert.deepEqual(f.cold(),original)
 f.s.replaceButton.focus();f.key('Escape',f.s.replaceButton)
 assert.equal(f.s.replaceButton.hidden,true)
 assert.equal(f.focus.activeElement,f.outside)
 assert.deepEqual(f.cold(),original)
 f.open();button.focus();f.click(button);f.s.replaceButton.focus()
 assert.equal(f.key('Enter',f.s.replaceButton),false)
 f.click(f.s.replaceButton,0)
 const expected={...original,musicGarden:{...original.musicGarden,...bayFestivalPattern(1)}}
 assert.deepEqual(f.cold(),expected)
 assert.equal(f.writes,1);assert.equal(f.stops,1)
 assert.equal(f.focus.activeElement,button)
 assert.equal(f.s.replaceButton.hidden,true)
 assert.equal(button.attributes.has('aria-expanded'),false)
 f.click(f.s.replaceButton);assert.equal(f.writes,1)
 // Clear the four actual available parts by clicking each already selected note. Locked tracks
 // still contain factory notes, but they are not editable/audible and must not mark this as a draft.
 const silent=mount(baseline)
 for(const {id,level} of BAY_INSTRUMENTS)if(level<=baseline.musicGarden.level)
  baseline.musicGarden.tracks[id].steps.forEach((note,index)=>{if(note>=0)silent.note(id,index,note)})
 assert.equal(bayActiveVoices(silent.cold().musicGarden),0)
 assert.equal(silent.cold().musicGarden.tracks.shaker.steps.some(note=>note>=0),true)
 // Original built-in or blank draft, same festival score, and explicit named copy all open directly.
 for(const raw of [baseline,silent.cold(),f.cold(),(()=>{const backup=mount(original);backup.open();backup.click(backup.s.saveButton);return backup.cold()})()]){
  const direct=mount(raw);direct.open();direct.click(direct.festivalButton().button)
  assert.deepEqual(compact(direct.cold().musicGarden),bayFestivalPattern(1))
  assert.deepEqual(direct.cold().musicGarden.saved,raw.musicGarden.saved)
  assert.equal(direct.s.replaceButton.hidden,true)
  assert.equal(direct.writes,1)
 }
})


test('the earned opaque front of the physical stage opens the original Music Garden without changing the farm',()=>{
 let pre:FarmState|undefined
 const awarded=firstFestivalScore(f=>{pre=f})
 assert.ok(pre)
 assert.deepEqual([pre.day,awarded.day,pre.festivals.completed.stage,awarded.festivals.completed.stage],[32,32,0,1])
 const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
 const artBytes=readFileSync(new URL('../public/art/lavender/festivals/stage.webp',import.meta.url))
 assert.equal(createHash('sha256').update(artBytes).digest('hex'),'71532f25f72a7132104f9109951a67a36e59b05b29c297e8560ee3ad706db83f')
 const cut=(s:string,a:string,b:string)=>{const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return s.slice(i,j)}
 const layout=read('src/lavender-layout.ts'),island=read('src/island.ts'),main=read('src/main.ts')
 const geom=strip(cut(layout,'const origin =','function sceneBox').replaceAll('export ','')
  +cut(layout,'const mapped =','export const cape =').replaceAll('export ','')
  +cut(layout,'export const docks = {','  home: {').replace('export ','')+'};({scenePoint,sceneScale,village,docks})')
 const geometry=vm(geom,{lavenderVillageAnchors})
 const sites=cut(island,'const harbourPlacesOnMap =','// The graph follows')
 const scene=cut(island,'  function mooredFerry(', '  function paintProp(')
 const actors=cut(island,'  function syncVillageResidents(', '  function paintVillage(')
 const picking=cut(island,'  function location(', '  function describeFocus(')
 const visualMasks=cut(island,'  function visibleUpgrades(', '  function islandPlate(')
 const up=cut(island,'    if (Math.hypot(start.x - event.clientX, start.y - event.clientY) > 12) return;', '  }, listeners);')
 const key=cut(island,"  canvas.addEventListener('keydown', (event) => {","  }, listeners);")
 const route=cut(main,"    case 'bay-shop': case 'bay-music': case 'bay-freight': openPanel",String.fromCharCode(10))
 const program=strip(`${sites}
${scene}
${actors}
${picking}
${visualMasks}
 function mouseUp(event){let start={x:event.clientX,y:event.clientY};${up}}
 function activate(target){switch(target.kind){${route}}}
 ${key} });
 ({mouseUp,syncVillageResidents,currentSites,focusedSite:()=>focused?.target.kind})`)
 const viewport={width:1280,height:720,top:0,bottom:0},camera=harbourCamera(viewport,'overview')
 // Sparse Canvas readback at verified WebP coordinates; all hit math and pointer/keyboard routing are production.
 const frontDrum=[815,400],frontStage=[805,405],transparent=[805,418],marimba=[793,347],square=[803,470]
 const rgba=new Uint8ClampedArray(657*486*4)
 for(const [x,y] of [[372,385],[328,407]]) rgba[(y*657+x)*4+3]=253
 function mount(f:FarmState,loaded:boolean){
  const state=restoreCurrentFarm(copy(f))!
  const raw=JSON.stringify(state), opens:string[]=[], listeners=new Map<string,(event:any)=>void>()
  let stageReads=0,pixelReads=0
  const img={naturalWidth:657,naturalHeight:486}
  const app=vm(program,{...geometry,festivalRewardArt,residentIds,getNeighborPlans,getNeighborSceneState,state,
   villageActors:new Map(),currentIsland:'village',villageMealSeen:state.village.mealOn,residentServiceSeen:state.village.serviceOn,
   routeResident(){},motion:{matches:true},world:{available:true},
   art:{image:(key:string)=>{assert.equal(key,'festival-stage');stageReads++;return loaded?img:undefined}},
   document:{createElement:(tag:string)=>{assert.equal(tag,'canvas');return {getContext:()=>({
    drawImage:()=>{},getImageData:()=>{pixelReads++;return {data:rgba,width:657,height:486}}
   })}}},
   maskPixels:new WeakMap(),crossing:false,offset:{x:640-camera.center.x*camera.scale,y:360-camera.center.y*camera.scale},
   scale:camera.scale,canvas:{getBoundingClientRect:()=>({left:0,top:0}),addEventListener:(name:string,fn:(event:any)=>void)=>listeners.set(name,fn)},
   distance:(a:any,b:any)=>Math.hypot(a.x-b.x,a.y-b.y),harborSite:{},kitchenSite:{},fieldView:false,focused:undefined,showFocus:false,
   guidance:undefined,hovered:undefined,frameHarbourTarget(){},describeFocus(){},requestPaint(){},
   bedPointerGuard:{accepts:()=>true},openPanel:(target:string)=>{opens.push(target)}
  })
  app.syncVillageResidents(state,100)
  return {pointer([x,y]:number[],pointerType='mouse'){
   const p=harbourScreenPoint(viewport,'overview',geometry.scenePoint(x,y));opens.length=0
   app.mouseUp({pointerType,clientX:p.x,clientY:p.y});assert.equal(JSON.stringify(state),raw);return [...opens]
  },key(key:string,repeat=false){
   opens.length=0;listeners.get('keydown')!({key,repeat,preventDefault(){}})
   assert.equal(JSON.stringify(state),raw);return [...opens]
  },focus:app.focusedSite,count:()=>app.currentSites().filter((a:any)=>a.target.kind==='bay-music').length,
  get stageReads(){return stageReads},get pixelReads(){return pixelReads}}
 }
 const old=mount(pre,true)
 assert.deepEqual(old.pointer(frontDrum),[])
 assert.equal(old.stageReads,0,'visible progress only after the player completes the festival')
 const pending=mount(awarded,false)
 assert.deepEqual(pending.pointer(frontStage),[])
 assert.deepEqual(pending.pointer(marimba),['bay-music'],'old plateau works even before the optional stage asset loads')
 assert.equal(pending.pixelReads,0)
 const ready=mount(awarded,true)
 assert.deepEqual(ready.pointer(frontDrum),['bay-music'],'the clearly opaque front instrument belongs to the already unlocked Music Garden')
 assert.deepEqual(ready.pointer(frontStage),['bay-music'])
 assert.deepEqual(ready.pointer(frontDrum,'touch'),['bay-music'])
 assert.deepEqual(ready.pointer(transparent),[])
 assert.equal(ready.pixelReads,1,'one loaded asset mask is cached')
 assert.deepEqual(ready.pointer([700,411]),[])
 assert.deepEqual(ready.pointer(square),[])
 assert.equal(ready.focus(),'village','nearby ordinary square keeps its first pick')
 assert.deepEqual(ready.pointer(marimba),['bay-music'])
 assert.equal(ready.stageReads <= 5,true,'ordinary hittable sites keep priority')
 assert.equal(ready.count(),1,'world aliases never add a keyboard or accessibility stop')
 assert.deepEqual(ready.key('Enter',true),[])
 assert.deepEqual(ready.key('Enter'),['bay-music'],'existing focused keyboard action still routes to music')
})
