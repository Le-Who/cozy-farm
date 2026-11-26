import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { getCookAction, pickFruit, restoreCurrentFarm, returnNurseryTree, storeTree, treeDefinitions } from '../src/farm.ts'
import { getRequirementHint, type Requirement } from '../src/requirement-guidance.ts'
import { nurseryFruitDetail } from '../src/orchard-guidance.ts'
import { TreeStorageChoice, revealTreeStorageReturn, storedTreeChoiceLabel } from '../src/tree-storage-choice.ts'
import { storedTreeCrossingPlayer } from './fixtures/stored-tree-crossing.ts'

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const part = (a: string, b: string) => {
  const start = source.indexOf(a), end = source.indexOf(b, start + a.length)
  assert.ok(start >= 0 && end > start, a); return source.slice(start, end)
}
const uiCode = stripTypeScriptTypes([
  part('function nurseryCard(', '\nlet fishingGame:'),
  part('async function showRequirement(', '// Scene handlers own material sounds.'),
  'function treeAction(action: string, value: string) { switch (action) {' +
    part("    case 'store-tree': {", "    case 'fruit-tree-seed':") + '}}',
  '({nurseryCard, showRequirement, treeAction})',
].join('\n'))
const apple: Requirement = { kind: 'stock', item: { kind: 'fruit', item: 'apple', quantity: 2 } }

function earned() {
  const { p, id } = storedTreeCrossingPlayer()
  p.visit('grove')
  p.act('buyAndPlantTree', 1, 'apple')
  p.act('buyAndPlantTree', 2, 'peach')
  p.visit('home')
  assert.deepEqual([p.state.day, p.actions, p.state.coins, p.state.fruit.apple, id], [16, 121, 11, 1, 2])
  assert.ok([...p.state.trees.home, ...p.state.trees.grove].every(Boolean))
  return { p, id }
}

function review(farm: ReturnType<typeof earned>['p']['state']) {
  const choice = new TreeStorageChoice(), panelHistory: {panel:string}[] = [], saves: unknown[] = []
  let focused: string | undefined
  const controls = { scrollTop: 0, querySelector(selector: string) {
    return selector.includes('return-nursery-tree') ? {
      focus() { focused = String(choice.current(ctx.farm)?.id) },
      scrollIntoView() {},
    } : null
  }}
  const ctx = {
    farm, panel: 'kitchen', panelHistory, dialog: {open:true}, treeStorageChoice:choice, treeSlot:0,
    treeDefinitions, storedTreeChoiceLabel, revealTreeStorageReturn, nurseryFruitDetail,
    treeVariantCopy: () => '', escapeHtml: String,
    getRequirementHint, returnNurseryTree, storeTree, dialogContent: controls, highlightControl() {}, notify() {},
    openPanel(next:string) {
      if (next !== ctx.panel) {
        if (ctx.dialog.open && ctx.panel) panelHistory.push({panel:ctx.panel})
        else panelHistory.length = 0
      }
      ctx.panel = next; ctx.dialog.open = true
    },
    perform(step:() => {ok:boolean}) {
      const r = step()
      if (r.ok) saves.push(restoreCurrentFarm(JSON.parse(JSON.stringify(ctx.farm))))
      return r.ok
    },
    row: (_art:string, label:string, detail:string, action:string) => label + detail + action,
    button: (label:string, action:string, enabled:boolean, options:{value:number}) =>
      `<button data-action="${action}" data-value="${options.value}"${enabled?'':' disabled'}>${label}</button>`,
  }
  const ui = runInNewContext(uiCode, ctx)
  return { ctx, ui, choice, saves, get focused() { return focused },
    back() { ctx.panel = panelHistory.pop()?.panel ?? '' },
    close() { panelHistory.length=0; ctx.panel=''; ctx.dialog.open=false } }
}

test('making room for an earned apple ingredient retains its exact ripe stored tree until separate return and harvest', async () => {
  const {p,id} = earned(), farm = p.state, before = structuredClone(farm)
  const h = review(farm)
  await h.ui.showRequirement(apple)
  assert.equal(h.ctx.panel,'orchard')
  const initialSelection = h.choice.current(farm)?.id
  assert.equal(getRequirementHint(farm,{kind:'stock',item:{kind:'fruit',item:'apple',quantity:4}}).nurserySpace,undefined)
  assert.ok(h.choice.choose(farm,String(id)), 'a player can deliberately inspect the ripe apple')
  assert.match(h.ui.nurseryCard(), /data-value="2" disabled>Нет места в саду/)
  h.ctx.openPanel('tree')
  h.back()
  assert.equal(h.ctx.panel,'orchard')
  assert.equal(h.choice.current(farm)?.id,id)
  h.ctx.openPanel('tree')
  assert.deepEqual(farm,before); assert.equal(h.saves.length,0)

  h.ui.treeAction('store-tree','0')
  const next = h.ui.nurseryCard(0)
  assert.match(next,/data-value="2">Вернуть · место 1/, 'freeing a plot must not suggest undoing it')
  assert.equal(initialSelection,id)
  assert.equal(h.focused,String(id))
  assert.equal(farm.trees.home[0],null)
  assert.equal(farm.treeNursery.at(-1)?.tree.tree,'peach')
  assert.equal(h.saves.length,1)
  assert.deepEqual([farm.fruit,farm.coins,farm.day],[before.fruit,before.coins,before.day])
  assert.equal(restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))?.treeNursery[1].id,2)
  assert.equal(getCookAction(farm,'appleJam').available,false)

  h.ui.treeAction('return-nursery-tree',String(id))
  assert.equal(h.saves.length,2)
  assert.deepEqual(farm.trees.home[0],before.treeNursery[1].tree)
  assert.deepEqual(farm.fruit,before.fruit)
  h.ui.treeAction('return-nursery-tree',String(id)); assert.equal(h.saves.length,2)
  assert.ok(pickFruit(farm,0).ok)
  assert.equal(farm.fruit.apple,3)
  assert.equal(getCookAction(farm,'appleJam').available,true)
  assert.equal(farm.dishes.appleJam,0)
})

test('ordinary Store keeps immediate Undo; changing the selection, leaving the visit, or stale source never keeps its old pin', async () => {
  for (const variant of ['ordinary','new visit','manual selection','stale id','different day'] as const) {
    const {p,id} = earned(), farm=p.state, h = review(farm)
    if (variant !== 'ordinary') await h.ui.showRequirement(apple)
    else h.ctx.openPanel('orchard')
    if (variant === 'new visit') { h.close(); h.ctx.openPanel('orchard') }
    if (variant === 'manual selection') assert.ok(h.choice.choose(farm,'1'))
    if (variant === 'different day') { p.act('endDay'); h.ctx.farm=p.state }
    if (variant === 'stale id') {
      // Another ordinary site placement removed the source before this old visit continued.
      assert.ok(storeTree(farm,2).ok); assert.ok(returnNurseryTree(farm,2,id).ok)
    }
    const state = h.ctx.farm, before = structuredClone(state)
    h.ctx.openPanel('tree')
    h.ui.treeAction('store-tree','0')
    const own = state.treeNurserySerial
    assert.equal(h.choice.current(state)?.id,own,variant)
    assert.equal(h.focused,String(own),variant)
    assert.equal(h.saves.length,1)
    h.ui.treeAction('return-nursery-tree',String(own))
    assert.deepEqual(state.trees.home[0],before.trees.home[0],variant)
    assert.deepEqual(state.fruit,before.fruit,variant)
    assert.equal(h.saves.length,2)
  }
})
