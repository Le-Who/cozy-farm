import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cookDish, createFarm, fishIds, getCookAction, getCookIngredients, getGrillFish, restoreFarm, sellMarketItem } from '../src/farm.ts'
import { copyCookeryResult, isCookeryResult, type CookeryResult } from '../src/culinary.ts'

const prepared = (): CookeryResult => ({ family:'grilledFish', fruit:[], garnish:[{ingredientId:'carrot',x:-.4,y:.4,angle:0},{ingredientId:'carrot',x:0,y:.4,angle:0},{ingredientId:'carrot',x:.4,y:.4,angle:0}], steps:['season-fish','grill-first-side','turn-fish','grill-second-side','plate-fish','arrange-carrot'], baking:{method:'grill',finish:'golden',seconds:14} })
function kitchen() { const farm=createFarm();farm.buildingLevels.farmhouse=2;farm.seaSalt=4;farm.produce.carrot=4;return farm }

test('every catch species can be selected, cooked and restored without consuming a different fish',()=>{
  for(const species of fishIds){
    const farm=kitchen();farm.fish[species]=1;farm.bayDiscoveries.push(species)
    assert.equal(getGrillFish(farm),species)
    assert.equal(getCookAction(farm,'grilledFish').available,true)
    assert.equal(getCookIngredients(farm,'grilledFish',species)[0].kind,'fish')
    const result={...prepared(),fishSpecies:species}
    assert.equal(cookDish(farm,'grilledFish',result).ok,true)
    assert.equal(farm.fish[species],0);assert.equal(farm.dishes.grilledFish,1)
    assert.equal(farm.seaSalt,3);assert.equal(farm.produce.carrot,3)
    assert.equal(farm.culinary.lastDishes.grilledFish.fishSpecies,species)
    const restored=restoreFarm(JSON.parse(JSON.stringify(farm)))
    assert.ok(restored);assert.equal(restored.culinary.lastDishes.grilledFish.fishSpecies,species)
    assert.equal(restored.bayDiscoveries.includes(species),true)
  }
})

test('missing selected fish rejects completion atomically even when another species is stocked',()=>{
  const farm=kitchen();farm.fish.seaBass=1
  const before=JSON.stringify(farm)
  assert.equal(getCookAction(farm,'grilledFish','moonfish').available,false)
  assert.equal(cookDish(farm,'grilledFish',{...prepared(),fishSpecies:'moonfish'}).ok,false)
  assert.equal(JSON.stringify(farm),before)
  assert.equal(isCookeryResult({...prepared(),fishSpecies:'unknown'}),false)
  assert.equal(isCookeryResult({...prepared(),family:'preserves',fishSpecies:'perch'}),false)
})

test('saved grill receipts without species retain the original sea bass recipe',()=>{
  const farm=kitchen();farm.fish.seaBass=1;farm.fish.perch=1
  assert.equal(cookDish(farm,'grilledFish',copyCookeryResult(prepared())).ok,true)
  assert.equal(farm.fish.seaBass,0);assert.equal(farm.fish.perch,1)
  const restored=restoreFarm(JSON.parse(JSON.stringify(farm)))
  assert.ok(restored);assert.equal(restored.culinary.lastDishes.grilledFish.fishSpecies,undefined)
})

test('all fish sell independently and their collection discovery survives sale',()=>{
  for(const species of fishIds){
    const farm=createFarm();farm.fish[species]=1;farm.bayDiscoveries.push(species)
    const stock=getCookIngredients(farm,'grilledFish',species)[0]
    assert.equal(stock.kind,'fish')
    const sale=sellMarketItem(farm,`fish:${species}`)
    assert.equal(sale.ok,true);assert.equal(farm.fish[species],0)
    assert.equal(farm.bayDiscoveries.includes(species),true)
  }
})
