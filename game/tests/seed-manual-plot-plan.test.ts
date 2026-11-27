import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as P from '../src/garden-plans.ts'
import * as E from '../src/garden-plans-ui.ts'
import * as S from '../src/seed-choice.ts'
import * as UI from '../src/seed-picker-ui.ts'
import * as W from '../src/bed-work-intent.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const src=read('src/main.ts')
const chunk=(a:string,b:string)=>{const i=src.indexOf(a),j=src.indexOf(b,i+1);assert.ok(i>=0&&j>i,[a,b]);return src.slice(i,j)}
const script=stripTypeScriptTypes([
  chunk('function button(','function quantity('),
  chunk('function seedCards()','function stockLabel('),
  chunk('function perform(','const bedTools ='),
  chunk('function requestSeedChoice(','function activateTarget('),
  chunk('function activateTarget(', '  island.visit(target)\n  switch')+'}',
  "function actionFor(action:string,value?:string){switch(action){"+chunk("    case 'garden-shop': case 'garden-shop-scope':","    case 'visit-book-home':")+chunk("    case 'preview-seed':","    case 'sell-order-surplus':")+'}}',
].join('\n'))
function cropOn(farm:F.FarmState, index:number) {const bed=farm.beds[index];return bed.kind==='crop'?bed.crop:undefined}
function sowTwoBeds(farm:F.FarmState,manual:number,planned:number) {
  const nextCrop='cabbage', plannedCrop='wheat'
  const saves:any[]=[], focuses:any[]=[], visits:any[]=[], gardenEditor=new E.GardenPlanEditor()
  const close=()=>{host.dialog.open=false}
  let markup='', control:any={dataset:{},focus(opts:any){host.document.activeElement=this;assert.equal(opts.preventScroll,true)}}
  const confirmed={dataset:{action:'choose-seed'},focus(opts:any){host.document.activeElement=this;assert.equal(opts.preventScroll,true)}}
  const host:any={...F,...P,...W,...S,...E, farm, gardenEditor, event:{detail:0},control,document:{activeElement:control},dialogContent:{
    querySelector(s:string){assert.match(s,/seed-picker-primary.*choose-seed/);return markup.includes('data-action="choose-seed"')?confirmed:null},
  }, panel:'garden-plans',dialog:{open:true},bagTab:'seeds',previewSeed:farm.selectedSeed,seedPickerBed:undefined,activeTool:'hoe',
    dialogFeedback:{classList:{toggle(){}},dataset:{}},dialogFeedbackTimer:0,window:{clearTimeout(){},setTimeout(){return 1}},
    ...UI,nav:()=>'',bayAudio:{primeEvents(){}},bedWorkSound(){},bedTools:{plant:'seeds'},playBaySound(){},notify(){},icon:()=>'',numberFormat:new Intl.NumberFormat('ru'),
    saveFarm:()=>saves.push(structuredClone(farm)),drawPanel:draw,refresh:draw,closeDialog:close,
    openPanel(next:string){host.panel=next;host.dialog.open=true;if(next==='seeds')host.previewSeed=S.seedPickerBedPreview(farm,host.seedPickerBed);draw()},
    island:{isCrossing:()=>false,visit:(t:any)=>visits.push(t.index),focusTarget:(t:any)=>focuses.push(t.index),
      workBed(index:number,plannedKind:()=>string,commit:()=>void){assert.equal(plannedKind(),F.getBedAction(farm,index).kind);commit()}},
  }
  runInNewContext(script,host)
  function draw() {
    const before=structuredClone(farm)
    markup=host.panel==='garden-plans'? E.renderGardenPlans(farm,gardenEditor,()=>'<i></i>')
      : host.seedCards()
    assert.deepEqual(farm,before)
  }
  const invoke=(name:string,value?:string)=>host.actionFor(name,value)
  invoke('garden-edit');invoke('garden-brush',plannedCrop);invoke('garden-paint',String(planned))
  invoke('garden-brush','none');invoke('garden-paint',String(manual));assert.match(markup,/«Вручную» оставляет обычный выбор семян на этой грядке/)
  invoke('garden-save');invoke('garden-follow','1:0')
  assert.match(markup,new RegExp('data-state="free"[^>]*data-value="'+manual+'"[^>]*Вручную'))
  assert.equal(farm.gardenPlans.active,0)
  assert.equal(P.plannedCropAt(farm,manual),undefined);assert.equal(P.plannedCropAt(farm,planned),plannedCrop)
  assert.equal(farm.beds.filter((b:any)=>b.kind==='crop').length,16)
  close()
  for(const index of [manual,planned]) {
    assert.equal(F.getBedAction(farm,index).kind,'harvest');host.activateTarget({kind:'bed',index})
    assert.equal(farm.beds[index].kind,'tilled')
  }
  assert.equal(farm.seeds[farm.selectedSeed],0)
  const original=F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)));assert.deepEqual(farm,original)
  // One genuine click on the unassigned bed opens the seed picker because the current packet is empty.
  const before=structuredClone(farm), writes=saves.length
  host.activateTarget({kind:'bed',index:manual})
  assert.equal(host.panel,'seeds');assert.equal(host.seedPickerBed,manual);assert.deepEqual(visits,[manual])
  assert.equal((markup.match(/data-action="preview-seed"/g)??[]).length,10)
  assert.equal(saves.length,writes);assert.deepEqual(farm,before)
  invoke('preview-seed',nextCrop)
  assert.equal(host.document.activeElement,confirmed,'native-keyboard branch reaches the same sticky action')
  assert.deepEqual(farm,before);assert.equal(saves.length,writes)
  const token=S.seedChoice(farm,nextCrop,manual).token
  assert.match(markup,/data-action="choose-seed"/)
  const observed={planName:farm.gardenPlans.pages[0].name,caption:markup.match(/<p class="seed-picker-contract">(.*?)<\/p>/)?.[1],
    primary:markup.match(/data-action="choose-seed"[\s\S]*?>([^<]+)<\/button>/)?.[1].trim(),
    nextExpected:F.getBedAction(farm,planned).label,
    contradictoryWarning:markup.includes('Выбор другой культуры вручную выключит этот режим')}
  invoke('choose-seed',token)
  assert.equal(host.dialog.open,false);assert.deepEqual(focuses,[manual])
  assert.equal(saves.length,writes+1,'ordinary explicit packet selection only')
  assert.deepEqual(farm.beds,before.beds);assert.deepEqual(farm.seeds,before.seeds)
  assert.equal(farm.selectedSeed,nextCrop);assert.equal(farm.island,'home');assert.equal(farm.day,before.day);assert.equal(farm.coins,before.coins)
  const reloaded=F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)));assert.deepEqual(farm,reloaded)
  const selected={mode:farm.gardenPlans.active,rev:farm.gardenPlans.revision,nextPlanned:F.getBedAction(farm,planned).label}
  assert.deepEqual(farm.gardenPlans.pages,before.gardenPlans.pages)
  host.activateTarget({kind:'bed',index:manual});assert.equal(cropOn(farm,manual),nextCrop)
  host.activateTarget({kind:'bed',index:planned})
  const actual={twoCrops:[cropOn(farm,manual),cropOn(farm,planned)],manualStock:farm.seeds[nextCrop],planStock:farm.seeds[plannedCrop],
    sameDay:farm.day===before.day,sameIsland:farm.island===before.island,sameCoins:farm.coins===before.coins}
  const repair=structuredClone(before)
  // Stock alternative: explicitly choose the new default, then revisit notebook and reactivate same plan.
  assert.ok(F.selectSeed(repair,nextCrop).ok);assert.equal(repair.gardenPlans.active,null)
  assert.ok(P.followGardenPlan(repair,0,repair.gardenPlans.revision).ok)
  assert.ok(F.workBed(repair,manual,0).ok);assert.ok(F.workBed(repair,planned,0).ok)
  const useful={twoCrops:[cropOn(repair,manual),cropOn(repair,planned)],manualStock:repair.seeds[nextCrop],planStock:repair.seeds[plannedCrop]}
  assert.deepEqual(useful.twoCrops,[nextCrop,plannedCrop]);assert.equal(repair.coins,before.coins)
  return {day:before.day,coins:before.coins,manual:manual+1,planned:planned+1,seedPacketAtOpen:before.selectedSeed,beforeStock:[before.seeds[nextCrop],before.seeds[plannedCrop]], beforePlanRev:before.gardenPlans.revision,observed,selected,actual,existingManualRecovery:useful}
}
function early() {
  const f=F.createFarm()
  for(const i of [0,8,13]) {
    if(f.beds[i].kind==='empty')assert.ok(F.workBed(f,i,0).ok)
    assert.ok(F.workBed(f,i,0).ok)
  }
  return f
}
function mature() {
  const p=commissionPlayer(JSON.parse(read('tests/fixtures/home-progress-actions.json')))
  p.visit('home')
  // Grow every gap using ordinary seedlings. Use carrot as the default and exhaust
  // its packet by filling plots, no inserted stock or state mutation.
  for(const [i,b] of p.state.beds.entries()) {
    if(b.kind==='crop')continue
    if(b.kind==='empty')p.act('workBed',i,0)
    if(!p.state.seeds.carrot)p.act('buySeeds','carrot')
    p.act('selectSeed','carrot');p.act('workBed',i,0)
  }
  if(p.state.selectedSeed!=='carrot'&&p.state.seeds.carrot) p.act('selectSeed','carrot')
  if(p.state.selectedSeed!=='carrot'){p.act('buySeeds','carrot');p.act('selectSeed','carrot')}
  while(p.state.seeds.carrot>0){
    const ready=p.state.beds.findIndex((b:any)=>b.kind==='crop'&&F.getBedStage(b)==='ripe')
    if(ready<0)throw Error('Expected ordinary ripe plants')
    p.act('workBed',ready,0);p.act('workBed',ready,0)
  }
  for(const crop of ['cabbage','wheat'])if(p.state.seeds[crop]<2)p.act('buySeeds',crop)
  for(let night=0;night<5;night++){
    if(p.state.beds.filter((b:any)=>F.getBedStage(b)==='ripe').length>=2)break
    for(const [i,b] of p.state.beds.entries())if(b.kind==='crop'&&F.getBedStage(b)!=='ripe'&&!b.watered){
      if(!p.state.water)p.act('refillWater')
      p.act('workBed',i,0)
    }
    p.night()
  }
  const ripe=p.state.beds.flatMap((b:any,i:number)=>F.getBedStage(b)==='ripe'?[i]:[])
  assert.ok(ripe.length>=2)
  return {state:p.state,ripe,actions:p.actions}
}
for(const mode of ['first day','working farm'] as const) test(`choosing seed at a manual plot keeps the active wheat rows on a ${mode}`,()=>{
  const setup=mode==='first day'?{state:early(),ripe:[3,4]}:mature()
  const attempt=sowTwoBeds(setup.state,setup.ripe[0],setup.ripe[1])
  assert.equal(attempt.observed.nextExpected,'Посеять: пшеница')
  assert.deepEqual(attempt.actual.twoCrops,['cabbage','wheat'],'a change in the manual cell must not make its assigned sibling use the same packet')
  assert.deepEqual(attempt.actual, {...attempt.existingManualRecovery, sameDay:true,sameIsland:true,sameCoins:true})
  assert.deepEqual(attempt.selected,{mode:0,rev:attempt.beforePlanRev,nextPlanned:'Посеять: пшеница'})
  assert.match(attempt.observed.primary??'',/Выбрать капусту/)
  assert.match(attempt.observed.caption??'',/План сохранится.*Посев выполняется отдельным действием/)
  assert.equal(attempt.observed.contradictoryWarning,false)
})


function splitPlot(farm:F.FarmState,manual:number,planned:number) {
  const editor=new E.GardenPlanEditor()
  assert.ok(editor.begin(farm));editor.brush='wheat';assert.ok(editor.paint(planned))
  editor.brush=null;assert.ok(editor.paint(manual));assert.ok(editor.save(farm).ok)
  assert.ok(P.followGardenPlan(farm,0,farm.gardenPlans.revision).ok)
}

test('a shown manual plot choice never becomes a global pause after a plot, plan, day or stock change',()=>{
  for (const change of ['till','filled','assignment','switch','day','buy','other-plot'] as const) {
    const f=change==='till'?F.createFarm():early(),manual=change==='till'?0:3, sibling=4
    splitPlot(f,manual,sibling)
    if(change!=='till')assert.ok(F.workBed(f,manual,0).ok)
    const choice=S.seedChoice(f,'cabbage',manual)
    if(change==='till')assert.ok(F.workBed(f,manual,0).ok)
    if(change==='filled')assert.ok(F.transplantCrop(f,0,manual).ok)
    if(change==='assignment'||change==='switch') {
      const editor=new E.GardenPlanEditor()
      if(change==='switch')assert.ok(editor.choose(1))
      assert.ok(editor.begin(f));editor.brush='carrot';assert.ok(editor.paint(manual));assert.ok(editor.save(f).ok)
      assert.ok(P.followGardenPlan(f,editor.slot,f.gardenPlans.revision).ok)
    }
    if(change==='day')assert.ok(F.endDay(f).ok)
    if(change==='buy')assert.ok(F.buySeeds(f,'cabbage').ok)
    const before=structuredClone(f)
    assert.equal(S.chooseSeedForBed(f,'cabbage',change==='other-plot'?sibling:manual,choice.token).ok,false,change)
    if(change==='filled') {
      const current=S.seedChoice(f,'cabbage',manual)
      assert.equal(S.chooseSeedForBed(f,'cabbage',manual,current.token).ok,false,'even a redraw cannot commit a stale occupied context')
      const markup=UI.renderSeedPicker(f,'cabbage',manual,{icon:()=>'',button:(label,action,enabled)=>`<button data-action="${action}"${enabled?'':' disabled'}>${label}</button>`})
      assert.match(markup,/data-action="choose-seed" disabled/)
    }
    assert.deepEqual(f,before,change)
  }
})

test('an actual empty manual plot keeps its plan after selection; only ordinary till and sow spend any seed',()=>{
  const f=F.createFarm(),manual=0,sibling=13
  splitPlot(f,manual,sibling)
  const before=structuredClone(f)
  const choice=S.seedChoice(f,'cabbage',manual)
  assert.ok(S.chooseSeedForBed(f,'cabbage',manual,choice.token).ok)
  assert.deepEqual(f,{...before,selectedSeed:'cabbage'})
  assert.ok(F.workBed(f,manual,0).ok);assert.deepEqual(f.seeds,before.seeds)
  assert.ok(F.workBed(f,manual,0).ok);assert.equal(cropOn(f,manual),'cabbage')
  assert.equal(F.getBedAction(f,sibling).label,'Посеять: пшеница')
  assert.ok(F.workBed(f,sibling,0).ok);assert.equal(cropOn(f,sibling),'wheat')
  assert.deepEqual(f.seeds,{...before.seeds,cabbage:1,wheat:1})
  assert.deepEqual(f.gardenPlans,before.gardenPlans)
})

test('standalone selection and an explicit different crop at an assigned plot still pause the plan, never sow',()=>{
  for (const bed of [undefined,13]) {
    const f=F.createFarm()
    splitPlot(f,0,13)
    const before=structuredClone(f),choice=S.seedChoice(f,'cabbage',bed)
    assert.match(choice.detail,/выключит посев по плану/)
    assert.ok(S.chooseSeedForBed(f,'cabbage',bed,choice.token).ok)
    assert.deepEqual(f,{...before,selectedSeed:'cabbage',gardenPlans:{...before.gardenPlans,active:null,revision:3}})
  }
})
