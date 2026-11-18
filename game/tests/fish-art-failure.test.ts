import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'

// Exercise the registered initialization/exit callbacks; rendering is not needed to refuse an asset.
const source = readFileSync(new URL('../src/fish-cookery.ts', import.meta.url), 'utf8')
const init = source.slice(source.indexOf('  async function init()'), source.indexOf('  resize();frame=requestAnimationFrame(animate);void init()'))
function fixture() {
  const abort = new AbortController(), root = {style: {removeProperty() {}}}, exits: string[] = []
  let leave: (() => void) | undefined
  const state = {abort, signal: abort.signal, AbortController, destroyed: false, frame: 1, recovery: undefined,
    resizeObserver: {disconnect() {}}, cancelAnimationFrame() {}, root, options: {returnLabel: 'К рецепту'}, cancel() {exits.push('cancel')},
    load: async (name: string) => {if (name === 'fish-raw') throw Error('raw image decode failed')},
    status: {hidden: true, textContent: ''},
    assets: new Map([['fish-raw', {height: 2, width: 4}]]), fishWidth: 0,
    prop: () => {throw Error('later scene setup failed')}, board: undefined,
    showCookeryRecovery(host: object, opts: {returnLabel: string; onCancel(): void; signal: AbortSignal}, cause: string) {
      assert.equal(host, root); assert.equal(opts.signal.aborted, false)
      exits.push(cause, opts.returnLabel); leave = opts.onCancel
    }}
  const start = runInNewContext(stripTypeScriptTypes(init + ';init'), state)
  return {state, start, exits, leave: () => leave!()}
}

test('the grill offers its own working return on failed required art, not on a late refusal', async () => {
  const current = fixture(); await current.start()
  assert.deepEqual(current.exits, ['art', 'К рецепту']); current.leave(); assert.equal(current.exits.at(-1), 'cancel')
  const closed = fixture(); closed.state.destroyed = true; await closed.start()
  assert.deepEqual(closed.exits, [])
})

test('a later setup failure is never reported as a missing image', async () => {
  const h = fixture(); h.state.load = async () => {}; await h.start()
  assert.ok(!h.exits.includes('art')); assert.ok(!h.state.status.hidden || h.exits.length)
})
