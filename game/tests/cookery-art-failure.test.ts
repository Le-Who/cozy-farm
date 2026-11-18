import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { showCookeryRecovery } from '../src/cookery-recovery.ts'

const source = readFileSync(new URL('../src/cookery.ts', import.meta.url), 'utf8')
const onLoad = source.match(/void loadArt\(\)\.catch\([\s\S]*?\n  \}\)/)![0]

function fixture(returnLabel?: string) {
  let focused: Element | undefined, exits = 0, stopped = 0
  class Element extends EventTarget {
    children: Element[] = []
    dataset: Record<string, string> = {}
    textContent = ''
    style = { removeProperty() {} }
    ownerDocument = { createElement: () => new Element() }
    setAttribute() {}
    append(...children: Element[]) { this.children.push(...children) }
    replaceChildren(...children: Element[]) { this.children = children }
    focus() { focused = this }
  }
  const root = new Element(), board = new Element()
  root.append(board); board.focus()
  let reject!: (error: Error) => void
  const assets = new Promise<void>((_, refused) => { reject = refused })
  const state = { root, abort: new AbortController(), recovery: undefined as AbortController | undefined,
    observer: { disconnect() {} }, frame: 1, cancelAnimationFrame: () => { stopped++ },
    DOMException, AbortController, showCookeryRecovery, options: { returnLabel },
    cancel: () => { exits++ }, status: { hidden: true, textContent: '' }, destroyed: false, loadArt: () => assets }
  runInNewContext(onLoad, state)
  return { state, root, board, reject, focused: () => focused, exits: () => exits, stopped: () => stopped }
}

test('a required kitchen image failure offers only the contextual exit, without spending or double-returning', async () => {
  const h = fixture('К рецепту')
  h.reject(new Error('required pot image could not be decoded')); await Promise.resolve()
  assert.notEqual(h.root.children[0], h.board, 'do not keep offering the unplayable board')
  const [title, reason, back] = h.root.children[0].children
  assert.ok(title.textContent); assert.match(reason.textContent, /загрузить изображения/i)
  assert.match(reason.textContent, /Ингредиенты не потрачены/); assert.doesNotMatch(reason.textContent, /трёхмерную графику|книгу рецептов/)
  assert.equal(back.textContent, 'К рецепту'); assert.equal(h.focused(), back); assert.equal(h.stopped(), 1)
  assert.equal(h.exits(), 0); back.dispatchEvent(new Event('click')); back.dispatchEvent(new Event('click')); assert.equal(h.exits(), 1)
})

test('destroy or abort while loading does not show a recovery panel or steal focus', async () => {
  for (const closed of [true, false]) {
    const h = fixture()
    h.state.destroyed = closed
    h.reject(closed ? new Error('late decode error') : new DOMException('closed', 'AbortError'))
    await Promise.resolve()
    assert.deepEqual(h.root.children, [h.board]); assert.equal(h.focused(), h.board); assert.equal(h.stopped(), 0); assert.equal(h.exits(), 0)
  }
})
