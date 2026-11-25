import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { getDiscoveryTask } from '../src/discovery-path.ts'
import { renderDiscoveryGuidance } from '../src/discovery-preferences-ui.ts'
import { getRequirementHint } from '../src/requirement-guidance.ts'
import { chooseSeedForBed, seedChoice } from '../src/seed-choice.ts'
import { ActionClickGuard, ActivationKeyGuard, isGuardedAction } from '../src/action-click-guard.ts'
import { followGardenPlan, saveGardenPlan } from '../src/garden-plans.ts'
import { renderSeedPicker } from '../src/seed-picker-ui.ts'
import { getBedAction, getFairGuest, getVillageProject, type CropId, type FarmState, type StockItem } from '../src/farm.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const seen={collections:true,islands:true}
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const milestones=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
const art={icon:()=>'',button:(label:string,action:string,enabled:boolean,{value='',crop}: {value?:string;crop?:CropId})=>
  `<button data-action="${action}" data-value="${value}" data-crop="${crop??''}"${enabled?'':' disabled'}>${label}</button>`}
function section(a:string,b:string){
  const start=source.indexOf(a),end=source.indexOf(b,start+a.length)
  assert.ok(start>=0 && end>start,[a,b].join(' '))
  return source.slice(start,end)
}
function earnedFinn() {
  const p=commissionPlayer(milestones.slice(0,milestones.findIndex(step=>step.name==='serveFairGuest')))
  p.night()
  assert.deepEqual([p.actions,p.state.day,p.state.island,p.state.selectedSeed,p.state.produce.wheat,p.state.seeds.wheat],[58,7,'home','carrot',1,2])
  assert.ok(p.state.beds.some(bed=>bed.kind==='tilled'))
  assert.ok(!p.state.beds.some(bed=>bed.kind==='crop'&&bed.crop==='wheat'))
  assert.equal(p.state.fairGuestsServed,0)
  const guest=getFairGuest(p.state)!
  assert.equal(guest.name,'Финн')
  assert.deepEqual(guest.item,{kind:'produce',item:'wheat',quantity:3})
  return p
}
function exerciseEntry(farm:FarmState, method:'guide'|'guest', item:StockItem) {
  const follow=section("  if (action === 'follow-task') {","  switch (action) {")
  const open=source.split('\n').find(line=>line.trim().startsWith("if (remember && next !== panel && (next === 'inventory' || next === 'seeds'))"))!
  assert.ok(open)
  const seedEntryHelpers=section('function openGuidedMarket(','function openPanel(')
  const panelEntryCode=`
    ${seedEntryHelpers}
    function openPanel(next, remember=true, destinationIsland=farm.island, cue='page.unfold', recipeTarget, entry){
      ${open}
      visited.push(next);
      if (remember && next !== panel && dialog.open) history.push(panel);
      panel=next; dialog.open=true;
      rendered=render(farm,previewSeed,seedPickerBed,art);
    }`
  const opened:string[]=[],history:string[]=[],highlighted:string[]=[]
  const context={farm,previewSeed:farm.selectedSeed,seedPickerBed:undefined,visited:opened,history,dialog:{open:true}, panel:method,
    rendered:'',art,render:renderSeedPicker,getRequirementHint,
    dialogContent:{querySelector:(value:string)=>value},
    highlightControl:(selector:string)=>highlighted.push(selector),notify(){},
    panelTitles:{seeds:'Семена'},currentTask:()=>getDiscoveryTask(farm,seen),
    action:'follow-task',value:undefined}
  const runner=method==='guide'
    ? `async function click(){${follow}\nswitch(action){${section("    case 'open-panel': if(value","    case 'upgrades':")}}} ; click()`
    : `${section('async function showRequirement(', '// Scene handlers')};showRequirement({kind:'stock',item})`
  if(method==='guide'){
    const task=getDiscoveryTask(farm,seen)!
    assert.match(task.label,/Выберите семена: пшеница/)
    assert.match(renderDiscoveryGuidance(farm.discoveryPreferences,task,task).focus,/data-action="follow-task"[^>]*>Выбрать семена/)
  }
  const state={...context,item}
  return Promise.resolve(runInNewContext(stripTypeScriptTypes(panelEntryCode+runner),state)).then(()=>{
    assert.deepEqual(opened,['seeds']);assert.deepEqual(history,[method])
    // Render again from the preview carried by the real production openPanel initializer.
    // Reading the generated primary token is necessary; highlighting a wheat tile alone is not enough.
    return {get vm(){return state},highlighted}
  })
}

function primary(html:string) {
  const match=html.match(/<div class="seed-picker-primary"><button data-action="choose-seed" data-value="([^"]+)" data-crop="([^"]+)">([^<]+)<\/button><\/div>/)
  assert.ok(match, 'the named crop must have a real enabled confirmation button')
  return {token:match[1],crop:match[2],label:match[3]}
}

for(const method of ['guide','guest'] as const)test(`Finn's actual day-7 ${method} entry previews wheat, not the selected carrot`,async()=>{
  const p=earnedFinn(),farm=p.state,guest=getFairGuest(farm)!,before=structuredClone(farm)
  const {vm,highlighted}=await exerciseEntry(farm,method,guest.item)
  assert.deepEqual(farm,before,'opening is a preview only: no purchase, seed switch, tilling, planting, or guest reward')
  const choice=primary(vm.rendered)
  assert.deepEqual(choice,{token:seedChoice(farm,'wheat').token,crop:'wheat',label:'Выбрать пшеницу'})
  assert.equal(farm.selectedSeed,'carrot')
  assert.deepEqual(highlighted, ['.seed-picker-primary [data-action="choose-seed"]:not(:disabled)'])
  const opener=method==='guide'?'follow-task':'show-requirement', keys=new ActivationKeyGuard(), clicks=new ActionClickGuard()
  assert.equal(isGuardedAction(opener),true);assert.equal(isGuardedAction('choose-seed'),true)
  assert.equal(keys.blocks({key:'Enter',repeat:false},isGuardedAction(opener)),false)
  assert.equal(keys.blocks({key:'Enter',repeat:true},isGuardedAction('choose-seed')),true)
  keys.release('Enter')
  assert.equal(keys.blocks({key:'Enter',repeat:false},isGuardedAction('choose-seed')),false)
  clicks.remember({detail:1,timeStamp:100,clientX:100,clientY:80})
  assert.equal(clicks.blocks({detail:2,timeStamp:180,clientX:100,clientY:80}),true)
  assert.ok(chooseSeedForBed(farm,choice.crop,undefined,choice.token).ok);p.reload()
  assert.equal(p.state.selectedSeed,'wheat');assert.equal(p.state.seeds.wheat,2);assert.deepEqual(p.state.beds,before.beds)
  const bed=p.state.beds.findIndex(bed=>bed.kind==='tilled')
  p.act('workBed',bed,0)
  assert.equal(p.state.beds[bed].kind==='crop'&&p.state.beds[bed].crop,'wheat')
  assert.equal(p.state.seeds.wheat,1);assert.equal(p.state.coins,before.coins)
  while(getBedAction(p.state,bed).kind!=='harvest'){
    if(getBedAction(p.state,bed).kind==='water')p.act('workBed',bed,0)
    p.night()
    assert.ok(p.state.day<=10)
  }
  p.act('workBed',bed,0)
  while(p.state.day<11)p.night()
  const earned=getFairGuest(p.state)!
  assert.equal(earned.name,'Финн');assert.ok(p.state.produce.wheat>=3)
  assert.equal(p.state.fairGuestsServed,0)
  assert.equal(getDiscoveryTask(p.state,seen)?.action.target,'visit-guest')
  const beforeServe=structuredClone(p.state)
  p.act('serveFairGuest')
  assert.deepEqual([p.state.fairGuestsServed,p.state.produce.wheat,p.state.coins,p.state.seeds.leafyGreens],
    [1,beforeServe.produce.wheat-3,beforeServe.coins+earned.reward,beforeServe.seeds.leafyGreens+2])
  assert.ok(getVillageProject(p.state).unlocked)
  p.reload()
  assert.equal(getFairGuest(p.state)?.served,true)
})

test('preview retains an earned plan, exposes manual override only on confirmation, and keeps other packets visible',async()=>{
  const p=earnedFinn(), plan=Array<CropId | null>(16).fill(null)
  const bed=p.state.beds.findIndex(bed=>bed.kind==='tilled');plan[bed]='carrot'
  assert.ok(saveGardenPlan(p.state,0,{name:'Морковная грядка',crops:plan},p.state.gardenPlans.revision).ok);p.reload()
  assert.ok(followGardenPlan(p.state,0,p.state.gardenPlans.revision).ok);p.reload()
  const farm=p.state, guest=getFairGuest(farm)!,before=structuredClone(farm)
  const {vm}=await exerciseEntry(farm,'guest',guest.item)
  assert.deepEqual(farm,before)
  assert.match(vm.rendered,/data-action="preview-seed" data-value="carrot"/)
  assert.match(vm.rendered,/Этот выбор выключит посев по плану, но сохранит саму запись./)
  const choice=primary(vm.rendered)
  assert.equal(choice.crop,'wheat')
  assert.match(choice.label,/пшеницу вручную/)
  assert.equal(farm.gardenPlans.active,0)
  assert.ok(chooseSeedForBed(farm,choice.crop,undefined,choice.token).ok);p.reload()
  assert.equal(p.state.gardenPlans.active,null)
  assert.deepEqual(p.state.gardenPlans.pages,before.gardenPlans.pages)
  assert.deepEqual(p.state.beds,before.beds)
  assert.equal(p.state.seeds.wheat,before.seeds.wheat)
})

test('a planned wheat bed keeps the direct focus route, not an unnecessary packet selector',()=>{
  const p=earnedFinn(), plan=Array<CropId | null>(16).fill(null)
  const bed=p.state.beds.findIndex(bed=>bed.kind==='tilled');plan[bed]='wheat'
  assert.ok(saveGardenPlan(p.state,0,{name:'Пшеница к ярмарке',crops:plan},p.state.gardenPlans.revision).ok);p.reload()
  assert.ok(followGardenPlan(p.state,0,p.state.gardenPlans.revision).ok);p.reload()
  const afterPlan=getDiscoveryTask(p.state,seen)!
  assert.equal(afterPlan.seedPreview,undefined)
  assert.deepEqual(afterPlan.action,{label:'Посеять: пшеница',target:'focus-bed',value:String(bed)})
  assert.equal(p.state.selectedSeed,'carrot')
  p.act('workBed',bed,0)
  assert.equal(p.state.gardenPlans.active,0)
  assert.equal(p.state.beds[bed].kind==='crop'&&p.state.beds[bed].crop,'wheat')
  assert.equal(p.state.seeds.wheat,1)
})

test('putting the one earned wheat in the local warehouse keeps the existing withdrawal before sowing',()=>{
  const p=earnedFinn()
  p.act('transferBayGoods','deposit','home','wheat',1)
  const before=structuredClone(p.state),item=getFairGuest(p.state)!.item
  const task=getDiscoveryTask(p.state,seen)!
  assert.equal(task.seedPreview,undefined)
  assert.equal(task.action.target,'warehouse-supply')
  assert.equal(getRequirementHint(p.state,{kind:'stock',item}).action.target,'warehouse-supply')
  assert.deepEqual(p.state,before)
  p.act('transferBayGoods','withdraw','home','wheat',1)
  assert.equal(p.state.produce.wheat,1)
  assert.equal(p.state.seeds.wheat,2)
  assert.equal(getDiscoveryTask(p.state,seen)?.action.value,'seeds')
})
