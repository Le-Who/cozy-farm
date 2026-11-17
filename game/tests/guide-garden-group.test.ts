import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { createFarm, getVillageMeal } from '../src/farm.ts'
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const branch=main.slice(main.indexOf("    case 'guide': {"),main.indexOf("    case 'workshop': {"))
const names={home:'Родной остров',grove:'Солёная роща',cape:'Цветочный мыс',village:'Лавандовая гавань'}
const garden=['Сад|orchard','Свои планы огорода|garden-plans','Пересадка культур|transplant','Размножить ягодный куст|berry-nursery','Свой ягодник|berry-renewal']
function render(island:keyof typeof names,flags:{fair:boolean;boat:boolean;built:boolean;festival:boolean;shoal:boolean;cape:number},open=false){
 const farm=createFarm();farm.island=island;farm.boatOwned=flags.boat;farm.village.built=flags.built;farm.capeLevel=flags.cape
 if(flags.festival)farm.festivals.active={tradition:'harvest',edition:0,stage:0,startedOn:farm.day,readyOn:farm.day,performanceBaseline:0,materialValue:0,cargoDelivered:0,activity:{harvest:false,bake:false,fish:false,shore:false},delivered:{}}
 const before=structuredClone(farm),dialogContent={innerHTML:''}
 const ctx={farm,getVillageMeal,pastryShape:'round',dialogContent,guideGardenOpen:open,islandNames:names,isProjectComplete:()=>flags.fair,hasShoal:()=>flags.shoal,icon:()=>'',button:(name:string,action:string,enabled:boolean,{value}:any)=>`<button data-action="${action}" data-value="${value}">${name}</button>`}
 runInNewContext(stripTypeScriptTypes(`function draw(){switch('guide'){${branch}}};draw()`),ctx)
 assert.deepEqual(farm,before)
 return dialogContent.innerHTML
}
// Dinner wording is owned by another lane; verify its route without pinning its label.
function routes(html:string){return [...html.matchAll(/<button[^>]*data-action="([^"]+)" data-value="([^"]+)"[^>]*>(?:<strong>)?([^<]+)(?:<\/strong>)?<\/button>/g)].map(([,action,value,name])=>`${action}|${value==='village-meal'?'':name}|${value}`).sort()}

test('grouping preserves every current destination, label and unlock condition across 256 guide states',()=>{
 for(const island of Object.keys(names) as (keyof typeof names)[])for(let bits=0;bits<64;bits++){
  const flags={fair:!!(bits&1),boat:!!(bits&2),built:!!(bits&4),festival:!!(bits&8),shoal:!!(bits&16),cape:bits&32?3:1}
  const home=island==='home',village=island==='village',expected:string[]=[]
  const add=(...items:string[])=>expected.push(...items.map(item=>'open-panel|'+item))
  if(home)add(...garden,'Дом|rest','Курятник|coop','Рынок|market','Улучшения|upgrades','Рыбалка|fishing')
  if(home&&flags.fair)add('Гость ярмарки|guest','Просьбы соседей|intents','Кондитерская|workshop')
  if(island==='grove'){add('Сад|orchard','Рыбалка|fishing','Живая заводь|cove');if(flags.shoal)add('Лунная отмель|shoal')}
  if(island==='cape'){add('Пасека|hive');if(flags.cape>=3)add('Медовая кухня|honey-kitchen')}
  if(village)add('Своя лавка|bay-shop','Музыкальный сад|bay-music','Соседи|village','|village-meal','Кондитерская|workshop','Заказы лавки|shop-commissions','Праздники гавани|festival')
  if(flags.boat)add('Грузовой паром|bay-freight')
  if(!home)expected.push('travel-panel|Рынок дома|market')
  if(!village&&flags.festival)add('Праздники гавани|festival')
  if(!village&&flags.built)add('Своя лавка|bay-shop','Музыкальный сад|bay-music')
  add('Дневник|journal','Запасы|inventory','Настройки|settings');if(home||village)add('Мои рецепты|recipes')
  const html=render(island,flags);assert.deepEqual(routes(html),expected.sort(),`${island}/${bits}`)
  assert.equal((html.match(/data-guide-garden/g)||[]).length,home?1:0)
 }
})
test('one initially collapsed garden group retains full current labels and can restore open state',()=>{
 const flags={fair:false,boat:true,built:false,festival:false,shoal:false,cape:1},closed=render('home',flags),open=render('home',flags,true)
 assert.match(closed,/data-guide-garden><summary>/);assert.match(open,/data-guide-garden open><summary>/)
 const content=closed.match(/<details[^>]*data-guide-garden>[\s\S]*?<\/details>/)![0]
 assert.equal(routes(content).length,5);assert.match(content,/Размножить ягодный куст/);assert.doesNotMatch(content,/Ягодный питомник/)
 assert.match(main,/gardenGroup\.open = previous\.guideGardenOpen/)
})
