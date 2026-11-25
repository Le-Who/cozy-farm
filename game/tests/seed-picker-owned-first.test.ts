import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as choice from '../src/seed-choice.ts'
import { followGardenPlan, saveGardenPlan, seedForBed } from '../src/garden-plans.ts'
import { renderSeedPicker } from '../src/seed-picker-ui.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const route = source.slice(source.indexOf('function requestSeedChoice('), source.indexOf('function chooseSeed('))
const preview = source.split('\n').find(s => s.includes("next === 'inventory' || next === 'seeds'") && s.includes('previewSeed ='))!
assert.ok(route.includes("openPanel('seeds')") && preview)
const open = stripTypeScriptTypes(route + `
function openPanel(next, remember = true, entry = explicit ? {seedPreview:explicit} : undefined) {
  ${preview}
  panel = next
}
`)
function presentation(farm: F.FarmState, at?: number, explicit?: F.CropId) {
  const actions:{name:string; label:string; enabled:boolean; token?:string}[] = [], visits:unknown[] = []
  const ctx = { farm, ...choice, seedForBed, explicit,
    seedPickerBed: undefined as number | undefined, previewSeed: farm.selectedSeed, activeTool: '', panel: undefined,
    island: { visit(target:unknown) { visits.push(target) } } }
  runInNewContext(open + (at === undefined ? '\nopenPanel("seeds")' : '\nrequestSeedChoice(' + at + ')'), ctx)
  const html = renderSeedPicker(farm, ctx.previewSeed, ctx.seedPickerBed, { icon:() => '',
    button(label,name,enabled,options) { actions.push({name,label,enabled,token:options.value}); return `<button data-action="${name}">${label}</button>` } })
  const tiles = [...html.matchAll(/data-action="preview-seed" data-value="([^"]+)"/g)].map(m=>m[1])
  const primary = actions.find(a => html.match(/class="seed-picker-primary">([\s\S]*?)<\/div>/)?.[1].includes('data-action="' + a.name + '"'))
  return { ...ctx, primary, actions, tiles, visits:JSON.parse(JSON.stringify(visits)) }
}

function earnedPacket() {
  const p=commissionPlayer([])
  for(const index of [2,3,4,5,7,9,15]) p.act('workBed',index,0)
  const free = p.state.beds.flatMap((b,i)=>b.kind==='crop'?[]:[i])
  let next = 0
  for(const crop of ['carrot','cabbage','beetroot','tomato','pumpkin','leafyGreens'] as const){
    if (crop!==p.state.selectedSeed) p.act('selectSeed',crop)
    while(p.state.seeds[crop]){
      const at=free[next++]
      if(p.state.beds[at].kind==='empty')p.act('workBed',at,0)
      p.act('workBed',at,0)
    }
  }
  const bed=free[next]
  assert.deepEqual([p.actions,p.state.day,p.state.coins,bed], [23,1,32,15])
  assert.equal(p.state.beds[bed].kind,'tilled')
  assert.equal(p.state.selectedSeed,'leafyGreens')
  assert.deepEqual(F.cropIds.filter(c=>p.state.seeds[c]>0),['wheat'])
  return {p,bed}
}

test('ordinary Day 1 tilled plot offers the sole already-owned seed instead of starting on a paid packet',()=>{
  const {p,bed}=earnedPacket(), f=p.state, before=structuredClone(f)
  assert.ok(F.needsSeedChoice(f,bed))
  const stocked=presentation(f,bed)
  assert.equal(stocked.panel,'seeds')
  assert.deepEqual(stocked.visits,[{kind:'bed',index:bed}])
  assert.deepEqual(stocked.tiles,[...F.cropIds])
  assert.deepEqual(f,before,'opening never selects, buys or plants')
  console.log(JSON.stringify({day:f.day,earnedActions:p.actions,coins:f.coins,bed,preview:stocked.previewSeed,firstAction:stocked.primary?.name,wheat:f.seeds.wheat}))
  assert.equal(stocked.previewSeed,'wheat')
  assert.deepEqual({name:stocked.primary?.name,enabled:stocked.primary?.enabled},{name:'choose-seed',enabled:true})
  assert.ok(choice.chooseSeedForBed(f,'wheat',bed,stocked.primary!.token).ok)
  assert.equal(f.selectedSeed,'wheat');assert.equal(f.seeds.wheat,2);assert.equal(f.coins,before.coins)
  assert.equal(f.beds[bed].kind,'tilled','no automatic sowing')
  assert.ok(F.workBed(f,bed).ok)
  assert.equal(f.seeds.wheat,1);assert.equal(f.coins,before.coins)
  assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f)
})

test('explicit/planned/store browsing and multiple real alternatives preserve the original preview',()=>{
  const {p,bed}=earnedPacket(), f=p.state, before=structuredClone(f)
  assert.equal(presentation(f).previewSeed,'leafyGreens','plain seed pocket keeps the current selection')
  const guided=presentation(f,bed,'tomato')
  assert.equal(guided.previewSeed,'tomato');assert.equal(guided.primary?.name,'buy-seeds')
  assert.deepEqual(f,before)
  const crops=Array<F.CropId|null>(16).fill(null);crops[bed]='carrot'
  assert.ok(saveGardenPlan(f,0,{name:'Огород',crops},f.gardenPlans.revision).ok)
  assert.ok(followGardenPlan(f,0,f.gardenPlans.revision).ok)
  const planned=structuredClone(f)
  assert.equal(presentation(f,bed).previewSeed,'carrot')
  assert.deepEqual(f,planned,'no silent plan cancellation')
  assert.ok(followGardenPlan(f,null,f.gardenPlans.revision).ok)
  assert.ok(F.buySeeds(f,'tomato').ok)
  assert.deepEqual(F.cropIds.filter(c=>f.seeds[c]>0),['tomato','wheat'])
  const multiple=structuredClone(f)
  assert.equal(presentation(f,bed).previewSeed,'leafyGreens')
  assert.deepEqual(f,multiple,'never silently chooses among multiple owned crops')
})
