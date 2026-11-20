import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { createFarm, cropIds, cropDefinitions, buySeeds, buyFeed, workBed, selectSeed, sellMarketItem, marketKey, restoreCurrentFarm } from '../src/farm.ts'
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
test('an earned empty berry packet explains an unaffordable purchase in the existing sticky detail',()=>{
 const f=createFarm(), crop='blueberry'
 assert.ok(buySeeds(f,'pumpkin').ok)
 assert.ok(buySeeds(f,'cabbage').ok)
 assert.equal(f.day,1);assert.equal(f.coins,4);assert.equal(f.seeds[crop],0)
 const before=structuredClone(f),html=renderSeedPicker(f,crop,undefined,art)
 const header=html.split('class="seed-picker-grid"')[0]
 assert.match(header,/data-action="buy-seeds"[^>]*data-crop="blueberry" disabled>Купить ×3 · 7/)
 assert.match(header,/<p class="seed-picker-contract">У вас: 4 монеты · не хватает 3\.<\/p>/)
 assert.doesNotMatch(html,/data-action="save-crop-seeds"|data-action="choose-seed"/)
 assert.equal((html.match(/ disabled/g)??[]).length,1)
 assert.equal((html.match(/class="seed-picker-tile"/g)??[]).length,cropIds.length)
 assert.equal(buySeeds(f,crop).ok,false);assert.deepEqual(f,before)

 assert.ok(workBed(f,4,0).ok)
 assert.ok(sellMarketItem(f,marketKey({kind:'produce',item:'wheat',quantity:1})).ok)
 // Wheat sale and the first sale reward refill the purse. Buy another normal
 // packet to arrive at the exact blueberry price without editing balances.
 assert.ok(buySeeds(f,'pumpkin').ok)
 assert.equal(f.coins,cropDefinitions[crop].seedPrice)
 const ready=structuredClone(f), enabled=renderSeedPicker(f,crop,undefined,art)
 assert.match(enabled,/data-action="buy-seeds"[^>]*data-crop="blueberry">Купить ×3 · 7/)
 assert.match(enabled,/Покупка пополнит запас. Выбор и посев — отдельно/)
 assert.doesNotMatch(enabled,/не хватает/)
 assert.deepEqual(f,ready)
 assert.ok(buySeeds(f,crop).ok);assert.equal(f.coins,0);assert.equal(f.seeds[crop],3)
 assert.equal(f.selectedSeed,ready.selectedSeed);assert.deepEqual(f.beds,ready.beds)
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

test('the primary purchase names the actual coin cost as well as the seed gain, unlike the harvest exchange',()=>{
 const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 const button=runInNewContext(stripTypeScriptTypes(source.slice(source.indexOf('function button(label:'),source.indexOf('function quantity('))+';button'),{cropDefinitions,icon:art.icon,numberFormat:new Intl.NumberFormat('ru')})
 const f=createFarm();assert.ok(selectSeed(f,'beetroot').ok);assert.ok(workBed(f,13).ok);assert.ok(selectSeed(f,'carrot').ok)
 for(const [crop,price] of [['beetroot',5],['blueberry',7]] as const){
  const before=structuredClone(f),html=renderSeedPicker(f,crop,undefined,{...art,button})
  const buy=html.match(/<button[^>]*data-action="buy-seeds"[^>]*>/)?.[0]
  assert.ok(buy);assert.match(buy,new RegExp('aria-label="Купить ×3, Семена: '+cropDefinitions[crop].name.toLowerCase()+', цена: '+price+' монет"'));assert.deepEqual(f,before)
  const checkout=structuredClone(f);assert.ok(buySeeds(checkout,crop).ok);assert.equal(f.coins-checkout.coins,price);assert.equal(checkout.seeds[crop]-f.seeds[crop],3)
 }
 const selected=renderSeedPicker(f,'carrot',undefined,{...art,button})
 assert.doesNotMatch(selected,/data-action="buy-seeds"/);assert.match(selected,/Обменять урожай на 3 семени/)
})

test('an earned empty packet puts the only affordable refill before all ten choices without spending on preview',()=>{
 const f=createFarm(), bed=2, crop='wheat'
 // Harvest wheat, sow the two remaining seeds, prepare another bed, then spend down to two coins.
 for(const result of [workBed(f,4,0),selectSeed(f,crop),workBed(f,4,0),workBed(f,13,0),workBed(f,bed,0),buySeeds(f,'pumpkin'),buySeeds(f,'blueberry')]) assert.ok(result.ok,result.message)
 const primary=(html:string)=>html.match(/<div class="seed-picker-primary">([\s\S]*?)<\/div>/)![1]
 assert.match(primary(renderSeedPicker(f,crop,bed,art)),/data-action="buy-seeds"/,'buy stays first while affordable')
 assert.ok(buyFeed(f).ok);assert.equal(f.coins,2);assert.equal(f.seeds.wheat,0);assert.equal(f.produce.wheat,3)
 const before=structuredClone(f),html=renderSeedPicker(f,crop,bed,art),quote=seedSavingQuote(f,crop)!
 assert.deepEqual(f,before);assert.equal((html.match(/class="seed-picker-tile"/g)??[]).length,10)
 assert.match(primary(html),/data-action="save-crop-seeds"/);assert.ok(primary(html).includes(quote.token))
 assert.ok(html.indexOf('data-action="save-crop-seeds"')<html.indexOf('class="seed-picker-grid"'))
 assert.equal((html.match(/data-action="save-crop-seeds"/g)??[]).length,1)
 assert.match(html,/Цена: пшеница ×1 из обычного урожая/);assert.match(html,/data-action="buy-seeds"[^>]* disabled>Купить ×3 · 4/)
 assert.ok(saveCropSeeds(f,quote.token).ok)
 const after=structuredClone(before);after.produce.wheat--;after.seeds.wheat+=3;after.workToday++
 assert.deepEqual(f,after);assert.equal(saveCropSeeds(f,quote.token).ok,false)
 assert.match(primary(renderSeedPicker(f,crop,bed,art)),/data-action="choose-seed"/)
 assert.ok(chooseSeedForBed(f,crop,bed,seedChoice(f,crop,bed).token).ok)
 assert.equal(f.beds[bed].kind,'tilled');assert.equal(f.seeds.wheat,3)
 assert.ok(workBed(f,bed,0).ok);assert.equal(f.seeds.wheat,2);assert.equal(f.beds[bed].kind,'crop')
 assert.deepEqual(restoreCurrentFarm(structuredClone(f)),f)
})
