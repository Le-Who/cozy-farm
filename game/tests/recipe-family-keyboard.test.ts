import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const start = source.indexOf("dialog.addEventListener('keydown', event => {\n  if (event.defaultPrevented")
assert.ok(start >= 0)
const end = source.indexOf('\n})', start) + 3
const actualListener = stripTypeScriptTypes(source.slice(start, end))
type Choice = { action: string; value: string; disabled?: boolean; hidden?: boolean }
const tarts: Choice[] = [
  ...['orchardTart', 'strawberryTart', 'blueberryTart', 'raspberryTart', 'mixed'].map(value => ({ action: 'recipe-family', value })),
  { action: 'new-signature', value: 'tart' },
]
function harness(group = 'recipe-family-choices', definitions = tarts) {
  const effects: string[] = []
  let listener: (event: any) => void = () => { throw Error('Listener not attached') }
  class Button {
    dataset: { action: string; value: string }
    disabled: boolean
    hidden: boolean
    constructor(choice: Choice) { this.dataset = { action: choice.action, value: choice.value }; this.disabled = !!choice.disabled; this.hidden = !!choice.hidden }
    closest() { return selector }
    getClientRects() { return this.hidden ? [] : [{}] }
    focus(options: { preventScroll: boolean }) { assert.deepEqual(JSON.parse(JSON.stringify(options)), { preventScroll: true }); effects.push(`focus:${this.dataset.action}:${this.dataset.value}`) }
    click() { effects.push(`click:${this.dataset.action}:${this.dataset.value}`) }
  }
  const buttons = definitions.map(choice => new Button(choice))
  const selector = {
    classList: { contains: (name: string) => name === group },
    querySelectorAll(query: string) {
      assert.ok(['button:not(:disabled)', 'button[data-action="recipe-family"]:not(:disabled)'].includes(query), query)
      return buttons.filter(button => !button.disabled && (!query.includes('[data-action=') || button.dataset.action === 'recipe-family'))
    },
  }
  runInNewContext(actualListener, { HTMLButtonElement: Button, dialog: { addEventListener(type: string, fn: typeof listener) { assert.equal(type, 'keydown'); listener = fn } } })
  return {
    effects,
    press(key: string, index = 0, extra: Record<string, unknown> = {}) {
      let prevented = false
      listener({ key, target: buttons[index], defaultPrevented: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, preventDefault() { prevented = true }, ...extra })
      return { prevented, effects: [...effects] }
    },
  }
}

test('Tart End and wrapped Left choose the last family, never the adjacent fruit editor', () => {
  for (const key of ['End', 'ArrowLeft']) {
    const h = harness(), result = h.press(key)
    assert.equal(result.prevented, true)
    assert.deepEqual(h.effects, ['focus:recipe-family:mixed', 'click:recipe-family:mixed'])
  }
})

test('family Home and forward wrapping remain within five choices, focusing before dispatch', () => {
  for (const [key, index, expected] of [['Home', 4, 'orchardTart'], ['ArrowRight', 4, 'orchardTart'], ['ArrowRight', 0, 'strawberryTart']] as const) {
    const h = harness(); assert.equal(h.press(key, index).prevented, true)
    assert.deepEqual(h.effects, [`focus:recipe-family:${expected}`, `click:recipe-family:${expected}`])
  }
})

test('ordinary editor owns no family traversal; Tab and Enter stay native and unhandled', () => {
  for (const key of ['End', 'Home', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter']) {
    const h = harness(); assert.equal(h.press(key, 5).prevented, false, key); assert.deepEqual(h.effects, [])
  }
  for (const key of ['Tab', 'Enter']) {
    const h = harness(); assert.equal(h.press(key).prevented, false); assert.deepEqual(h.effects, [])
  }
})

test('disabled and hidden family choices remain excluded, with adjacent editor still excluded', () => {
  const choices = tarts.map(c => ({ ...c, disabled: c.value === 'mixed', hidden: c.value === 'raspberryTart' }))
  for (const key of ['End', 'ArrowLeft']) {
    const h = harness('recipe-family-choices', choices); h.press(key)
    assert.deepEqual(h.effects, ['focus:recipe-family:blueberryTart', 'click:recipe-family:blueberryTart'])
  }
})

test('singleton and already-selected Home do not dispatch another action', () => {
  const singleton = harness('recipe-family-choices', [tarts[0], tarts[5]])
  assert.equal(singleton.press('ArrowRight').prevented, true); assert.deepEqual(singleton.effects, [])
  const first = harness(); assert.equal(first.press('Home').prevented, true); assert.deepEqual(first.effects, [])
})

test('every other shared selector keeps its existing enabled, visible button traversal', () => {
  for (const group of ['island-selector', 'house-selector', 'tree-selector', 'panel-tabs', 'market-category-icons', 'recipe-fish-choices']) {
    const choices: Choice[] = [{ action: 'other', value: 'first' }, { action: 'other', value: 'disabled', disabled: true }, { action: 'other', value: 'hidden', hidden: true }, { action: 'other', value: 'last' }]
    for (const key of ['End', 'ArrowLeft']) {
      const h = harness(group, choices); assert.equal(h.press(key).prevented, true)
      assert.deepEqual(h.effects, ['focus:other:last', 'click:other:last'], group)
    }
  }
})

test('modifier and handled-event guards are unchanged', () => {
  for (const extra of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { defaultPrevented: true }, { target: {} }]) {
    const h = harness(); assert.equal(h.press('End', 0, extra).prevented, false); assert.deepEqual(h.effects, [])
  }
})

test('the editor remains in normal markup after the five recipes and its intentional handler stays navigation-only', () => {
  assert.match(source, /tart === 'orchardTart' \? button\('Выбрать фрукты','new-signature',true,\{value:'tart',secondary:true\}\) : ''/)
  const handler = source.slice(source.indexOf("    case 'new-signature':"), source.indexOf("    case 'signature-base':"))
  assert.match(handler, /signatureSlots=\[null,null\]/)
  assert.match(handler, /openPanel\('signature'\)/)
  assert.doesNotMatch(handler, /saveFarm|perform\(|cookDish|bakeWorkshop/)
})
