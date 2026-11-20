import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {stripTypeScriptTypes} from 'node:module'
import {commissionPlayer} from './fixtures/commission-player.ts'
import {deliverSignature, getNeighborPlans, restoreCurrentFarm, type FarmState} from '../src/farm.ts'

const opening=JSON.parse(readFileSync(new URL('./fixtures/market-order-selection-commands.json',import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
const scene=readFileSync(new URL('../src/island.ts',import.meta.url),'utf8')
const draw=stripTypeScriptTypes(scene.slice(scene.indexOf('    if (farm.village.mealOn === farm.day'),scene.indexOf('    for (const [slot, home] of village.homes.entries()',scene.indexOf('    if (farm.village.mealOn === farm.day'))))
function drawn(farm:FarmState){
 const items:{key:string;x:number;y:number;w:number;h:number}[]=[]
 runInNewContext(draw,{farm,getNeighborPlans,world:{},village:{table:{y:738}},scenePoint:(x:number,y:number)=>({x,y}),
   art:{draw:(_w:unknown,key:string,x:number,y:number,w:number,h:number)=>items.push({key,x,y,w,h})}})
 return items
}
const keys=(farm:FarmState)=>drawn(farm).map(x=>x.key)
test('the actual day-15 shared preserves remain on the table after departure, save/reload and deleting the spent recipe; not after sleep',()=>{
 const p=commissionPlayer(opening);p.act('catchFish',true);const id=p.cook('s1')
 assert.equal(p.state.day,15);assert.equal(p.state.culinary.recipes.find(x=>x.id===id)?.name,'Конфитюр: яблоко + груша')
 const before=structuredClone(p.state);p.act('deliverSignature',id)
 const f=p.state;assert.equal(f.culinary.stock[id],before.culinary.stock[id]-1);assert.equal(f.fish.perch,before.fish.perch-1)
 assert.equal(f.coins,before.coins);assert.deepEqual(f.handmade,before.handmade);assert.equal(f.village.meals,before.village.meals+1)
 assert.equal(f.village.supperDish,'orchard-preserves');assert.deepEqual(drawn(f),[{key:'ui-orchard-preserves',x:930,y:607,w:24,h:22},{key:'ui-grilled-fish',x:1020,y:597,w:27,h:22}])
 const expectedSave=structuredClone(before);expectedSave.culinary.stock[id]--;expectedSave.fish.perch--;expectedSave.village.meals++;expectedSave.village.mealOn=f.day;expectedSave.village.supperDish='orchard-preserves';expectedSave.workToday++
 assert.deepEqual(f,expectedSave)
 const expected=structuredClone(f);assert.equal(deliverSignature(f,id).ok,false);assert.deepEqual(f,expected)
 p.act('forgetSignature',id);p.visit('home');p.visit('village')
 assert.deepEqual(keys(restoreCurrentFarm(structuredClone(p.state))!),['ui-orchard-preserves','ui-grilled-fish'])
 p.night();p.visit('village');assert.equal(p.state.village.supperDish,undefined);assert.deepEqual(keys(p.state),[])
})
test('ordinary supper keeps the actual bun; missing or invalid cosmetic metadata never invents another pastry or blocks loading',()=>{
 const served=opening.findIndex(a=>a.name==='serveVillageMeal'),p=commissionPlayer(opening.slice(0,served+1)),f=p.state
 assert.equal(f.village.supperDish,'handmade-round');assert.deepEqual(keys(f),['ui-handmade-round','ui-grilled-fish'])
 for(const bad of [undefined,'../../external',{recipe:'unknown'}]){
   const save=structuredClone(f);if(bad===undefined)delete save.village.supperDish
   else (save.village as Record<string,unknown>).supperDish=bad
   const restored=restoreCurrentFarm(save)!;assert.ok(restored);assert.equal(restored.village.supperDish,undefined)
   assert.deepEqual(keys(restored),['ui-grilled-fish'])
 }
})
