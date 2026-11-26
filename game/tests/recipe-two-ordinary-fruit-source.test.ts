import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  getFruitTreeSeed, getSignatureAction, getVillageHomeCount, repeatSignature, restoreCurrentFarm,
  type FarmState, type IslandId,
} from '../src/farm.ts'
import { getRequirementHint, type Requirement } from '../src/requirement-guidance.ts'
import { getRecipeRepeatGuide } from '../src/recipe-repeat-guidance.ts'
import { assortmentPlayer } from './fixtures/assortment-player.ts'

const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
const ordinary = { kind:'stock', item:{kind:'fruit',item:'pear',quantity:2} } as const
const exactPears = { base:'preserves', ingredients:[{id:'pear',quantity:2}] } as const
const silky = { family:'preserves', processing:'silky', fruit:[], steps:['mix','pour'] } as const

function workedOrchard(spendOne = true) {
  const {p,jam} = assortmentPlayer(opening)
  assert.deepEqual([p.actions,p.state.day,p.state.island,p.state.fruit.pear,getVillageHomeCount(p.state)],[200,25,'village',0,2])
  p.visit('grove'); p.act('pickFruit',0); p.visit('home')
  p.act('plantFruitTreeSeed',1,getFruitTreeSeed(p.state,1,'pear')!.token)
  if (spendOne) p.act('repeatSignature',jam)
  for(let night=0;night<4;night++) p.night()
  assert.equal(p.state.day,29)
  assert.deepEqual([p.state.trees.home[1]?.fruitReady,p.state.trees.home[1]?.trait],[2,undefined])
  return p
}

function villageRepeat(spendOne = true) {
  const p = workedOrchard(spendOne)
  p.act('pickFruit',1)
  const recipe = String(p.act('completeSignature',exactPears,silky).recipeId)
  p.act('sellSignature',recipe,1)
  p.night(); p.visit('village')
  assert.deepEqual([p.state.day,p.state.coins,p.state.fruit.pear,p.state.trees.home[1]?.fruitReady,
    p.state.trees.home[1]?.trait,p.state.trees.grove[0]?.fruitReady,p.state.trees.grove[0]?.trait],
    [30,403,Number(!spendOne),2,'dew',2,undefined])
  const guide = getRecipeRepeatGuide(p.state,recipe)!
  assert.deepEqual(guide.missing,[ordinary.item])
  assert.equal(guide.away,false)
  return {p,recipe}
}

const way = (f: FarmState, from?: 'saved-recipe' | 'recipe-draft', requirement: Requirement = ordinary) => {
  const before = structuredClone(f)
  const {target,value} = getRequirementHint(f,requirement,from).action
  assert.deepEqual(f,before,'preview never sails, picks, purchases or cooks')
  return [target,value]
}

test('earned lavender kitchen sends the missing exact two ordinary pears to the shore that can supply both',()=>{
  const {p,recipe}=villageRepeat()
  const expected=structuredClone(p.state), coins=expected.coins, pearVariants=structuredClone(expected.variants.pear)
  assert.deepEqual(way(p.state,'saved-recipe'),['sail','grove'])
  assert.deepEqual(way(p.state,'recipe-draft'),['sail','grove'])
  assert.equal(repeatSignature(p.state,recipe).ok,false,'both ordinary ingredients are still required')
  assert.deepEqual(p.state,expected)
  const crossed:IslandId[]=[]
  for(const i of ['grove','village'] as const){
    p.visit(i); crossed.push(i); assert.equal(p.state.coins,coins)
    if (i==='grove') {
      // showRequirement reruns without the old recipe DOM origin after a passage.
      assert.deepEqual(way(p.state),['visit-tree','0'])
      assert.equal(p.state.fruit.pear,0)
      p.act('pickFruit',0)
      assert.equal(p.state.fruit.pear,2)
    }
  }
  assert.deepEqual(crossed,['grove','village'])
  assert.deepEqual(p.state.variants.pear,pearVariants)
  assert.equal(getRecipeRepeatGuide(p.state,recipe)!.available,true)
  p.act('repeatSignature',recipe)
  assert.deepEqual([p.state.fruit.pear,p.state.culinary.stock[recipe],p.state.coins],[0,1,coins])
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(p.state))),p.state)
})

test('a sufficient home harvest, a single remaining pear, and exact local directions stay put',()=>{
  const ripe=workedOrchard()
  ripe.visit('village')
  assert.deepEqual(way(ripe.state,'saved-recipe'),['sail','home'])
  ripe.visit('home')
  assert.deepEqual(way(ripe.state,'recipe-draft'),['inspect-tree','1'])

  const {p,recipe}=villageRepeat(false)
  assert.equal(p.state.fruit.pear,1)
  assert.deepEqual(way(p.state,'saved-recipe'),['sail','home'])
  p.visit('home')
  assert.deepEqual(way(p.state,'saved-recipe'),['inspect-tree','1'])
  p.act('pickFruit',1)
  assert.equal(p.state.fruit.pear,2)
  assert.equal(p.state.variants.pear?.dew,1)
  assert.equal(getRecipeRepeatGuide(p.state,recipe)!.available,true)
})

test('the ordinary broad help, trait-specific fruit, local partial harvest and both-insufficient fallback do not change',()=>{
  const {p,recipe}=villageRepeat()
  const dew = {kind:'stock',item:{kind:'variants',item:'pear',trait:'dew',quantity:1}} as const
  const one = {kind:'stock',item:{kind:'fruit',item:'pear',quantity:1}} as const
  assert.deepEqual(way(p.state),['sail','home'],'the existing general navigation does not become recipe-only routing')
  assert.deepEqual(way(p.state,'saved-recipe',dew),['sail','home'],'only the actual matching dew is a valid source')
  assert.deepEqual(way(p.state,'recipe-draft',one),['sail','home'],'the same local pear is a real one-unit source')
  p.visit('home')
  assert.deepEqual(way(p.state,'saved-recipe'),['inspect-tree','1'],'already at either garden, keep local choice')
  assert.deepEqual(way(p.state,'saved-recipe',dew),['inspect-tree','1'])
  assert.equal(getSignatureAction(p.state,exactPears).available,false)
  p.visit('grove')
  assert.deepEqual(way(p.state,'saved-recipe'),['inspect-tree','0'])
  p.act('pickFruit',0); p.visit('village'); p.act('repeatSignature',recipe)
  assert.equal(p.state.fruit.pear,0)
  assert.deepEqual(way(p.state,'saved-recipe'),['sail','home'],'Grove empty and Home still supplies one useful pear')
})
