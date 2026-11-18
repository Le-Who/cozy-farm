import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {createFarm,workBed,buySeeds,restoreCurrentFarm} from '../src/farm.ts'
import {saveGardenPlan,followGardenPlan} from '../src/garden-plans.ts'
import {seedChoice,chooseSeedForBed} from '../src/seed-choice.ts'
import {seedSavingQuote,saveCropSeeds} from '../src/seed-saving.ts'
import {isGuardedAction} from '../src/action-click-guard.ts'

function planned(){
  const farm=createFarm(),crops=Array(16).fill(null);crops[13]='wheat'
  assert.ok(saveGardenPlan(farm,0,{name:'Хлебный уголок',crops},0).ok)
  assert.ok(followGardenPlan(farm,0,1).ok)
  return farm
}

test('a changed manual packet visibly confirms in the open picker; repeats, failures and bed returns keep their presentation',()=>{
  const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const host=source.slice(source.indexOf('function perform('),source.indexOf('const bedTools ='))
    + source.slice(source.indexOf('function chooseSeed('),source.indexOf('function activateTarget('))
  function select(farm:ReturnType<typeof createFarm>,bed?:number,token=seedChoice(farm,'cabbage',bed).token){
    const feedback={textContent:'',hidden:true,dataset:{tone:''},classList:{toggle:(key:string,on:boolean)=>{assert.equal(key,'sr-only');srOnly=on}}}
    let srOnly:boolean|undefined,closed=false,focused:number|undefined
    const state={farm,seedPickerBed:bed,previewSeed:'carrot',activeTool:'hoe',token,chooseSeedForBed,
      dialog:{open:true},dialogFeedback:feedback,dialogFeedbackTimer:0,window:{clearTimeout(){},setTimeout(){return 1}},
      saveFarm(){},refresh(){},playBaySound(){},closeDialog(){closed=true},island:{focusTarget(target:{index:number}){focused=target.index}}}
    runInNewContext(stripTypeScriptTypes(host)+"\nchooseSeed('cabbage',token)",state)
    return {srOnly,closed,focused,feedback}
  }
  const farm=createFarm(),before=structuredClone(farm)
  const changed=select(farm)
  assert.equal(changed.srOnly,false);assert.equal(changed.feedback.hidden,false)
  assert.match(changed.feedback.textContent,/Выбраны семена: капуста/);assert.equal(changed.closed,false)
  assert.equal(changed.focused,undefined);assert.deepEqual(farm,{...before,selectedSeed:'cabbage'})
  assert.equal(select(farm).srOnly,true,'same seed, no state change')
  const plan=planned();plan.selectedSeed='cabbage'
  assert.equal(select(plan).srOnly,false,'leaving a plan changes the sow mode even for the same packet')
  assert.equal(plan.gardenPlans.active,null)
  const failed=select(farm,undefined,'stale')
  assert.equal(failed.srOnly,false);assert.equal(failed.feedback.dataset.tone,'bad');assert.equal(failed.closed,false)
  const atBed=select(createFarm(),13)
  assert.equal(atBed.srOnly,true);assert.equal(atBed.closed,true);assert.equal(atBed.focused,13)
})

test('browsing another in-stock crop and making its packet preserve the mixed garden plan',()=>{
  const farm=planned();assert.ok(workBed(farm,9,0).ok)
  const before=structuredClone(farm),choice=seedChoice(farm,'carrot',13)
  assert.equal(choice.available,true);assert.equal(choice.planned,false)
  assert.match(choice.label,/ручного посева/);assert.match(choice.detail,/выключит посев по плану/)
  assert.deepEqual(farm,before,'preview has no mutation')
  assert.ok(saveCropSeeds(farm,seedSavingQuote(farm,'carrot')!.token).ok)
  assert.deepEqual(farm.gardenPlans,before.gardenPlans);assert.equal(farm.selectedSeed,before.selectedSeed)
  assert.deepEqual(farm.beds,before.beds)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
})

test('an explicit manual choice pauses the plan without planting or spending a seed',()=>{
  const farm=planned(),before=structuredClone(farm)
  assert.ok(chooseSeedForBed(farm,'cabbage',13,seedChoice(farm,'cabbage',13).token).ok)
  const expected=structuredClone(before);expected.selectedSeed='cabbage';expected.gardenPlans.active=null;expected.gardenPlans.revision++
  assert.deepEqual(farm,expected)
  assert.equal(chooseSeedForBed(farm,'__proto__',13,'invalid').ok,false);assert.deepEqual(farm,expected)
})

test('returning with the planned crop keeps the plan and a separate ordinary sow uses it',()=>{
  const farm=planned(),before=structuredClone(farm),choice=seedChoice(farm,'wheat',13)
  assert.equal(choice.planned,true);assert.equal(choice.label,'К грядке по плану')
  assert.ok(chooseSeedForBed(farm,'wheat',13,seedChoice(farm,'wheat',13).token).ok);assert.deepEqual(farm,before)
  assert.ok(workBed(farm,13,0).ok)
  assert.deepEqual(farm.beds[13],{kind:'crop',crop:'wheat',growth:0,watered:false})
  assert.equal(farm.seeds.wheat,before.seeds.wheat-1);assert.deepEqual(farm.gardenPlans,before.gardenPlans)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
})

test('restocking missing planned seeds by purchase or own harvest cannot itself choose or sow',()=>{
  for(const source of ['buy','harvest']){
    const farm=planned();farm.seeds.wheat=0
    const before=structuredClone(farm)
    assert.equal(seedChoice(farm,'wheat',13).available,false)
    assert.equal(chooseSeedForBed(farm,'wheat',13,seedChoice(farm,'wheat',13).token).ok,false);assert.deepEqual(farm,before)
    if(source==='buy')assert.ok(buySeeds(farm,'wheat').ok)
    else {assert.ok(workBed(farm,4,0).ok);assert.ok(saveCropSeeds(farm,seedSavingQuote(farm,'wheat')!.token).ok)}
    assert.deepEqual(farm.gardenPlans,before.gardenPlans);assert.equal(farm.selectedSeed,before.selectedSeed)
    assert.deepEqual(farm.beds[13],before.beds[13]);assert.equal(farm.seeds.wheat,3)
    const supplied=structuredClone(farm)
    assert.ok(chooseSeedForBed(farm,'wheat',13,seedChoice(farm,'wheat',13).token).ok);assert.deepEqual(farm,supplied)
  }
})

test('real UI routes browsing and buying separately from the guarded explicit choice',()=>{
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const preview=main.slice(main.indexOf("    case 'preview-seed':"),main.indexOf("    case 'choose-seed':"))
  assert.match(preview,/previewSeed=value as CropId;drawPanel\(\)/)
  assert.doesNotMatch(preview,/chooseSeed\(|selectSeed\(|perform\(/)
  const buy=main.slice(main.indexOf("    case 'buy-seeds':"),main.indexOf("    case 'garden-shop':"))
  assert.doesNotMatch(buy,/chooseSeed\(|selectSeed\(|closeDialog\(/)
  const picker=readFileSync(new URL('../src/seed-picker-ui.ts',import.meta.url),'utf8')
  assert.match(picker,/aria-pressed="\$\{previewSeed === crop\}"/)
  assert.match(picker,/art.button\(label, 'choose-seed'/)
  assert.match(main,/renderSeedPicker\(farm, previewSeed, seedPickerBed/)
  for(const action of ['preview-seed','choose-seed','buy-seeds','save-crop-seeds'])assert.ok(isGuardedAction(action))
})

 test('a stale planned-return choice can never become a manual selection',()=>{
  for(const change of ['plan','day','island','stock','bed']){
    const farm=planned(),shown=seedChoice(farm,'wheat',13)
    assert.equal(shown.planned,true)
    if(change==='plan'){const crops=Array(16).fill('carrot');assert.ok(saveGardenPlan(farm,0,{name:'Другой замысел',crops},2).ok);assert.ok(followGardenPlan(farm,0,3).ok)}
    if(change==='day')farm.day++
    if(change==='island')farm.island='grove'
    if(change==='stock')farm.seeds.wheat++
    const before=structuredClone(farm)
    assert.equal(chooseSeedForBed(farm,'wheat',change==='bed'?14:13,shown.token).ok,false,change)
    assert.deepEqual(farm,before,change)
  }
})
