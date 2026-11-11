import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { createFarm, completeSignature, repeatSignature, forgetSignature, sellSignature, nameSignature, favoriteSignature, restoreFarm, cookDish } from '../src/farm.ts'
import { signatureBookCapacity } from '../src/signature-book.ts'
import type { SignatureDraft, CookeryResult } from '../src/culinary.ts'

const draft: SignatureDraft = { base: 'tart', ingredients: [{ id: 'apple', quantity: 2 }] }
const result = (angle = .4): CookeryResult => ({ family: 'decorate', processing: 'chunky', fruit: [{ ingredientId: 'apple', x: .2, y: -.3, angle }], steps: ['fruit', 'dust'], baking: { method: 'oven', finish: 'golden', seconds: 90 } })
function kitchen() {
  const farm = createFarm()
  farm.buildingLevels.farmhouse = 2
  farm.fruit.apple = farm.produce.wheat = farm.eggs = 200
  return farm
}
function fullBook() {
  const farm = kitchen()
  for (let i = 0; i < 24; i++) assert.equal(completeSignature(farm, draft, result(i * .1)).ok, true)
  return farm
}

test('one-click repeat preserves the exact saved recipe, placement, name and favourite after reload', () => {
  let farm = kitchen()
  const id = completeSignature(farm, draft, result()).recipeId!
  nameSignature(farm, id, 'Яблочный день')
  favoriteSignature(farm, id)
  farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  const saved = structuredClone(farm.culinary.recipes[0])
  const before = { apples: farm.fruit.apple, wheat: farm.produce.wheat, eggs: farm.eggs, work: farm.workToday }
  const made = repeatSignature(farm, id, undefined, 1)
  assert.equal(made.ok, true)
  assert.equal(made.recipeId, id)
  assert.equal(farm.culinary.recipes.length, 1)
  assert.deepEqual(farm.culinary.recipes[0], { ...saved, batches: saved.batches + 1 })
  assert.equal(farm.culinary.stock[id], 2)
  assert.equal(farm.fruit.apple, before.apples - 2)
  assert.equal(farm.produce.wheat, before.wheat - 1)
  assert.equal(farm.eggs, before.eggs - 1)
  assert.equal(farm.workToday, before.work + 1)
})

test('full book blocks new variants before manual work but exact repeats and ordinary cooking remain possible', () => {
  const farm = fullBook(), id = farm.culinary.recipes[0].id
  assert.equal(signatureBookCapacity(farm.culinary).canCreate, false)
  assert.match(signatureBookCapacity(farm.culinary).message, /24 из 24/)
  assert.equal(repeatSignature(farm, id, undefined, 1).ok, true)
  assert.equal(repeatSignature(farm, id, undefined, 3).ok, true)
  assert.equal(cookDish(farm, 'orchardTart').ok, true)
  const before = structuredClone(farm)
  assert.equal(completeSignature(farm, draft, result(2.4)).ok, false)
  assert.deepEqual(farm, before)
  assert.equal(forgetSignature(farm, id).ok, false)
  assert.equal(sellSignature(farm, id, farm.culinary.stock[id]).ok, true)
  assert.equal(forgetSignature(farm, id).ok, true)
  assert.equal(signatureBookCapacity(farm.culinary).canCreate, true)
  const created = completeSignature(farm, draft, result(2.4))
  assert.equal(created.ok, true)
  assert.notEqual(created.recipeId, id)
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))))
})

test('failed exact repeat with missing ingredients or an unknown ID never debits stock', () => {
  const farm = kitchen(), id = completeSignature(farm, draft, result()).recipeId!
  farm.eggs = 0
  const before = structuredClone(farm)
  assert.equal(repeatSignature(farm, id, undefined, 1).ok, false)
  assert.equal(repeatSignature(farm, 'missing', undefined, 1).ok, false)
  assert.deepEqual(farm, before)
})

test('exhausted recipe serial is explained separately and cannot be repaired by deleting a page', () => {
  const farm = kitchen()
  farm.culinary.serial = 999999
  const capacity = signatureBookCapacity(farm.culinary)
  assert.equal(capacity.canCreate, false)
  assert.match(capacity.message, /номера рецептов/)
  assert.doesNotMatch(capacity.message, /Удалить пустой/)
})

test('book and studio visibly explain capacity, separate exact and manual repeats, and keep deletion explicit', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { signatureBook, signatureStudio } = await server.ssrLoadModule('/src/culinary-ui.ts')
    const farm = fullBook(), id = farm.culinary.recipes[0].id
    const art = { icon: () => '<img alt="">', stock: () => '<li>Продукты</li>' }
    const html = signatureBook(farm, art)
    assert.match(html, /role="status">Книга рецептов заполнена: 24 из 24/)
    assert.match(html, new RegExp(`data-action="make-signature" data-value="${id}"[^>]*>Повторить ×1`))
    assert.doesNotMatch(html, new RegExp(`data-action="make-signature" data-value="${id}"[^>]*disabled`))
    assert.match(html, /data-action="batch-signature"[^>]*>Партия ×3/)
    assert.match(html, /data-action="manual-signature"[^>]*disabled[^>]*>Готовить вручную/)
    assert.match(html, /data-action="new-signature"[^>]*disabled/)
    assert.doesNotMatch(html, /data-action="forget-signature"/)
    sellSignature(farm, id)
    assert.match(signatureBook(farm, art), new RegExp(`data-action="forget-signature" data-value="${id}"`))
    favoriteSignature(farm, id)
    assert.doesNotMatch(signatureBook(farm, art), new RegExp(`data-action="forget-signature" data-value="${id}"`))
    const studio = signatureStudio(farm, draft.base, draft.ingredients, 0, art)
    assert.match(studio, /Книга рецептов заполнена/)
    assert.match(studio, /data-action="start-signature"[^>]*disabled/)
    assert.match(studio, /data-action="open-panel" data-value="recipes"/)
  } finally { await server.close() }
})
