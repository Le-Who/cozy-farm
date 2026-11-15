import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import { getRecipeRepeatGuide, renderRecipeRepeatGuide } from '../src/recipe-repeat-guidance.ts'
import { RecipeBookNavigation } from '../src/recipe-book-view.ts'
import { earnedRecipeBookPlayer } from './fixtures/earned-recipe-book.ts'
import { signatureIdentity } from '../src/culinary.ts'
import type { StockItem } from '../src/farm.ts'

const stock = (item: StockItem) => `<li>${item.kind}:${item.item ?? ''}:${item.trait ?? ''} ×${item.quantity}</li>`

test('ten earned recipes retain exact identity while the triangle names its ingredient content', async () => {
  const p = earnedRecipeBookPlayer(), farm = p.state
  assert.equal(farm.culinary.recipes.length, 10)
  assert.equal(new Set(farm.culinary.recipes.map(recipe => signatureIdentity(recipe, recipe.result))).size, 10)
  const selected = farm.culinary.recipes.at(-1)!.id, nav = new RecipeBookNavigation()
  assert.ok(nav.select(farm, selected))
  const before = structuredClone(farm), guide = getRecipeRepeatGuide(farm, selected)!
  assert.equal(guide.available, true)
  assert.deepEqual(guide.items, [{kind:'fruit', item:'peach', quantity:2}])
  const server = await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
  try {
    const {signatureBook} = await server.ssrLoadModule('/src/culinary-ui.ts')
    const art = {icon:()=>'<img alt="">',stock}
    for (const expanded of [false, true]) {
      nav.view.expandedRepeatId = expanded ? selected : undefined
      const html = signatureBook(farm, art, nav.view)
      assert.equal((html.match(/data-action="select-recipe"/g) ?? []).length, 10)
      assert.match(html, new RegExp(`data-repeat-guide="${selected}"${expanded?' open':''}><summary>Ингредиенты на 1 порцию</summary>`))
      assert.match(html, /fruit:peach: ×2/)
      assert.match(html, /Для партии ×3 нужно втрое больше каждого ингредиента/)
      assert.match(html, new RegExp(`data-action="make-signature" data-value="${selected}"`))
      assert.equal((html.match(/data-action="make-signature"/g) ?? []).length, 1)
      assert.match(renderRecipeRepeatGuide(farm, selected, stock, expanded), /<summary>Ингредиенты на 1 порцию<\/summary>/)
      assert.doesNotMatch(html, /Для точного повтора ×1/)
    }
    const saved = structuredClone(nav.view)
    nav.index(); nav.load(saved)
    assert.equal(nav.view.selectedId, selected)
    assert.equal(nav.view.expandedRepeatId, selected)
    assert.deepEqual(farm, before, 'browsing and disclosures must not cook, travel, or spend')
    p.reload()
    assert.deepEqual(p.state, before, 'all ten earned recipes survive an exact save roundtrip')
  } finally {await server.close()}
})
