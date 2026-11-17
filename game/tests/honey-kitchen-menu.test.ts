import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { capeDishIds, dishDefinitions } from '../src/farm.ts'
import { chooseHoneyKitchenRecipe, renderHoneyKitchenMenu } from '../src/honey-kitchen-menu.ts'

const context = {panel:'honey-kitchen',open:true,island:'cape',capeLevel:3}
test('all three canonical honey recipes remain named choices; exactly one unchanged recipe card is rendered',()=>{
 for(const selected of capeDishIds){
  const calls: unknown[]=[]
  const card=`<section class="recipe"><button data-action="cook" data-value="${selected}" disabled>Готовить</button><button data-action="requirement">Продукт</button></section>`
  const html=renderHoneyKitchenMenu(selected,id=>`<img data-art="${id}" alt="">`,ids=>{calls.push(ids);return card})
  assert.deepEqual(calls,[[selected]])
  assert.equal((html.match(/data-action="honey-kitchen-recipe"/g)??[]).length,3)
  assert.equal((html.match(/aria-pressed="true"/g)??[]).length,1)
  for(const id of capeDishIds){assert.ok(html.includes(dishDefinitions[id].name));assert.ok(html.includes(`data-value="${id}"`))}
  assert.ok(html.includes(card),'original card, ingredient links, availability and cook payload are not rewritten')
  assert.equal((html.match(/data-action="cook"/g)??[]).length,1)
  assert.doesNotMatch(html,/<details|<summary/)
 }
})

test('selection is read-only and accepts only real recipes in an open unlocked cape kitchen',()=>{
 const snapshot=JSON.stringify(context)
 for(const id of capeDishIds)assert.equal(chooseHoneyKitchenRecipe(id,context),id)
 for(const id of [undefined,'','honeyCake','__proto__'])assert.equal(chooseHoneyKitchenRecipe(id,context),undefined)
 for(const delta of [{panel:'kitchen'},{panel:undefined},{open:false},{island:'home'},{capeLevel:2}])assert.equal(chooseHoneyKitchenRecipe('honeyPear',{...context,...delta}),undefined)
 assert.equal(JSON.stringify(context),snapshot)
})

test('choice wiring owns only transient honey-panel selection and preserves return state',()=>{
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 assert.ok(main.includes("import { chooseHoneyKitchenRecipe, renderHoneyKitchenMenu, type HoneyKitchenRecipe } from './honey-kitchen-menu'"))
 assert.ok(main.includes('dialogContent.innerHTML = renderHoneyKitchenMenu(honeyKitchenDish, dish => icon(dishIcons[dish]), recipeCards)'))
 assert.ok(main.includes('honeyKitchenDish:HoneyKitchenRecipe;'))
 assert.ok(main.includes('kitchenDish,honeyKitchenDish,signatureFamily,scroll:'))
 assert.ok(main.includes('honeyKitchenDish=previous.honeyKitchenDish'))
 const branch=main.split("case 'honey-kitchen-recipe': {")[1]?.split("case 'kitchen-group':")[0]
 assert.ok(branch)
 assert.match(branch,/chooseHoneyKitchenRecipe\(value, \{panel,open:dialog.open,island:farm.island,capeLevel:farm.capeLevel\}\)/)
 assert.doesNotMatch(branch,/perform\(|saveFarm\(|cookDish\(|openPanel\(/)
})
