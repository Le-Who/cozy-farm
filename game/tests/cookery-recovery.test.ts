import assert from 'node:assert/strict'
import { test } from 'node:test'
import { showCookeryRecovery } from '../src/cookery-recovery.ts'

// Minimal DOM boundary: recovery must work even when no canvas or renderer exists.
class Element extends EventTarget {
  ownerDocument = { createElement: (_tag: string) => new Element() }
  dataset: Record<string, string> = {}
  className = ''
  textContent = ''
  type = ''
  children: Element[] = []
  attributes: Record<string, string> = {}
  focused = false
  setAttribute(key: string, value: string) { this.attributes[key] = value }
  append(...children: Element[]) { this.children.push(...children) }
  replaceChildren(...children: Element[]) { this.children = children }
  focus() { this.focused = true }
}
function recovery() {
  const root = new Element(), abort = new AbortController()
  let cancellations = 0
  showCookeryRecovery(root as unknown as HTMLElement, { onCancel: () => cancellations++, signal: abort.signal })
  return { root, abort, button: root.children[0].children[2], cancelled: () => cancellations }
}

test('renderer failure mounts readable recovery in document flow and focuses a real return button', () => {
  const { root, button, cancelled } = recovery()
  assert.equal(root.dataset.unavailable, 'true')
  assert.equal(root.children[0].className, 'cookery-recovery')
  assert.match(root.children[0].children[1].textContent, /Ингредиенты не потрачены/)
  assert.equal(button.textContent, 'В книгу рецептов')
  assert.equal(button.focused, true)
  assert.equal(cancelled(), 0)
  button.dispatchEvent(new Event('click'))
  button.dispatchEvent(new Event('click'))
  assert.equal(cancelled(), 1)
})

for (const key of ['Enter', ' ', 'Escape']) test(`renderer failure can be left with ${JSON.stringify(key)} without a duplicate action`, () => {
  const { root, button, cancelled } = recovery()
  const event = Object.assign(new Event('keydown', { cancelable: true }), { key, repeat: false })
  root.dispatchEvent(event)
  assert.equal(event.defaultPrevented, true)
  button.dispatchEvent(new Event('click'))
  assert.equal(cancelled(), 1)
})

test('held keys and callbacks after destruction do not navigate away from a newer panel', () => {
  const { root, button, abort, cancelled } = recovery()
  root.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Enter', repeat: true }))
  assert.equal(cancelled(), 0)
  abort.abort()
  button.dispatchEvent(new Event('click'))
  root.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape', repeat: false }))
  assert.equal(cancelled(), 0)
})
