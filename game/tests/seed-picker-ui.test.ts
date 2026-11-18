import assert from 'node:assert/strict'
import test from 'node:test'
import { createFarm, cropIds, cropDefinitions, workBed, restoreCurrentFarm } from '../src/farm.ts'
import { renderSeedPicker } from '../src/seed-picker-ui.ts'
import { seedChoice, chooseSeedForBed } from '../src/seed-choice.ts'
import { seedSavingQuote, saveCropSeeds } from '../src/seed-saving.ts'
import { saveGardenPlan, followGardenPlan } from '../src/garden-plans.ts'

const art = { icon:(name:string)=>`<img data-icon="${name}">`, button:(label:string,action:string,enabled:boolean,options:{value?:string;crop?:string;cost?:{amount:number}})=>`<button data-action="${action}" data-value="${options.value ?? ''}" data-crop="${options.crop ?? ''}"${enabled?'':' disabled'}>${label}${options.cost?` · ${options.cost.amount}`:''}</button>` }
test('all ten crops, berries included, remain browsable without mutation and one action precedes the grid',()=>{
 const f=createFarm(),before=structuredClone(f),html=renderSeedPicker(f,'carrot',undefined,art)
 assert.deepEqual(f,before)
 assert.equal((html.match(/class="seed-picker-tile"/g)??[]).length,cropIds.length)
 for(const crop of cropIds){assert.match(html,new RegExp(`data-value="${crop}"`));assert.ok(html.includes(cropDefinitions[crop].name))}
 assert.equal((html.match(/aria-pressed="true"/g)??[]).length,1)
 assert.ok(html.indexOf('data-action="choose-seed"')<html.indexOf('class="seed-picker-grid"'))
 assert.match(html,/Выбрать морковь/);assert.match(html,/Посев выполняется отдельно на грядке/)
 assert.ok(html.includes(seedChoice(f,'carrot').token))
})
test('the named preview region follows browsing without claiming the active seed changed',()=>{
 const f=createFarm(),before=structuredClone(f)
 for(const crop of [...cropIds.filter(id=>id!==f.selectedSeed),f.selectedSeed]){
  const html=renderSeedPicker(f,crop,undefined,art)
  assert.equal(html.match(/<section class="seed-picker-current" aria-label="([^"]+)">/)?.[1],`Просмотр: ${cropDefinitions[crop].name}`)
 }
 assert.deepEqual(f,before)
})
test('ordinary selection from the tool or a bed never consumes seed; the next bed action does',()=>{
 for(const bed of [undefined,13]){
  const f=createFarm(),before=structuredClone(f),choice=seedChoice(f,'cabbage',bed)
  const html=renderSeedPicker(f,'cabbage',bed,art)
  assert.match(html,/data-action="choose-seed"[^>]*>Выбрать капусту<\/button>/)
  assert.ok(html.includes(choice.token))
  assert.ok(chooseSeedForBed(f,'cabbage',bed,choice.token).ok)
  assert.deepEqual(f,{...before,selectedSeed:'cabbage'})
  assert.ok(workBed(f,bed??13,0).ok)
  assert.equal(f.seeds.cabbage,before.seeds.cabbage-1)
  assert.deepEqual(f.beds[bed??13],{kind:'crop',crop:'cabbage',growth:0,watered:false})
 }
})
test('empty packet offers its actual purchase, without disabling browsing or claiming planting',()=>{
 const f=createFarm();f.seeds.blueberry=0;f.coins=0
 const html=renderSeedPicker(f,'blueberry',undefined,art)
 assert.match(html,/data-action="buy-seeds"[^>]*data-crop="blueberry" disabled>Купить ×3 · 7/)
 assert.match(html,/Покупка пополнит запас. Выбор и посев — отдельно/)
 assert.doesNotMatch(html,/data-action="save-crop-seeds"/)
 assert.equal((html.match(/ disabled/g)??[]).length,1)
})
test('planned return and explicit manual replacement keep existing guards and wording',()=>{
 const f=createFarm(),crops=Array(16).fill(null);crops[13]='wheat'
 assert.ok(saveGardenPlan(f,0,{name:'Хлеб',crops},0).ok);assert.ok(followGardenPlan(f,0,1).ok)
 const before=structuredClone(f)
 assert.match(renderSeedPicker(f,'wheat',13,art),/К грядке по плану/)
 assert.match(renderSeedPicker(f,'cabbage',13,art),/Выбрать капусту вручную/)
 assert.match(renderSeedPicker(f,'cabbage',13,art),/выключит посев по плану/)
 assert.deepEqual(f,before)
 assert.ok(chooseSeedForBed(f,'wheat',13,seedChoice(f,'wheat',13).token).ok);assert.deepEqual(f,before)
})
test('seed exchange names exact ordinary cost, preserves rare stock and never sows or selects',()=>{
 const f=createFarm();assert.ok(workBed(f,9,0).ok);f.variants.carrot={star:2};f.discoveries.carrot!.star=true
 const before=structuredClone(f),html=renderSeedPicker(f,'carrot',undefined,art)
 assert.match(html,/Обменять урожай на 3 семени/);assert.match(html,/Только обычный урожай: морковь ×1/)
 assert.match(html,/После обмена: урожай ×2 · семена ×6/);assert.doesNotMatch(html,/Посев выбирается отдельно/)
 assert.match(html,/<summary>Сравнить с покупкой<\/summary>/)
 assert.deepEqual(f,before)
 assert.ok(saveCropSeeds(f,seedSavingQuote(f,'carrot')!.token).ok)
 assert.deepEqual(f.variants,before.variants);assert.deepEqual(f.beds,before.beds);assert.equal(f.selectedSeed,before.selectedSeed)
 assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f)
})
