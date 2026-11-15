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
 assert.match(html,/Сеять морковь/);assert.match(html,/Посев выполняется отдельно на грядке/)
 assert.ok(html.includes(seedChoice(f,'carrot').token))
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
 assert.match(renderSeedPicker(f,'cabbage',13,art),/Сеять капусту вручную/)
 assert.match(renderSeedPicker(f,'cabbage',13,art),/выключит посев по плану/)
 assert.deepEqual(f,before)
 assert.ok(chooseSeedForBed(f,'wheat',13,seedChoice(f,'wheat',13).token).ok);assert.deepEqual(f,before)
})
test('seed exchange names exact ordinary cost, preserves rare stock and never sows or selects',()=>{
 const f=createFarm();assert.ok(workBed(f,9,0).ok);f.variants.carrot={star:2};f.discoveries.carrot!.star=true
 const before=structuredClone(f),html=renderSeedPicker(f,'carrot',undefined,art)
 assert.match(html,/Получить 3 семени/);assert.match(html,/Цена: морковь ×1 · обычный урожай/)
 assert.match(html,/Необычные продукты останутся у вас/);assert.match(html,/В припасах: 3 → 2. Семян: 3 → 6/)
 assert.match(html,/<summary>Сравнить с покупкой<\/summary>/)
 assert.deepEqual(f,before)
 assert.ok(saveCropSeeds(f,seedSavingQuote(f,'carrot')!.token).ok)
 assert.deepEqual(f.variants,before.variants);assert.deepEqual(f.beds,before.beds);assert.equal(f.selectedSeed,before.selectedSeed)
 assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f)
})
