import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as THREE from 'three'

const source = readFileSync(new URL('../src/arrangement.ts', import.meta.url), 'utf8')
function section(start: string, end: string) {
  const a = source.indexOf(start), b = source.indexOf(end, a)
  assert.ok(a >= 0 && b > a)
  return source.slice(a, b)
}
const layoutSource = section('  let roomRevision =', '  function pointerRay(')
const readySource = section('    while (!destroyed) {', '  }).catch(')

// Execute the real layout/camera and image-readiness callback, with inert DOM
// and rendering adapters. No WebGL, farm state, network or native input is used.
function scene(documentBase: string, size = { width: 1080, height: 740 }, base = './') {
  const styles = new Map<string, string>(), assignments: string[] = [], sizes: unknown[][] = []
  let src = '', wakes = 0, focuses = 0
  const abort = new AbortController()
  const room = {
    getAttribute(name: string) { assert.equal(name, 'src'); return src },
    get src() { return new URL(src, documentBase).href },
    set src(value: string) { assignments.push(value); src = value },
    decode: async () => {},
  }
  const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 60)
  camera.position.set(0, 7.8, 8); camera.lookAt(0, 0, 0)
  const context = {
    root: { dataset: {} as Record<string, string> },
    view: { getBoundingClientRect: () => size, style: { setProperty(name: string, value: string) { styles.set(name, value) } }, focus() { focuses++ } },
    width: 1, height: 1, portraitSetup: size.width / size.height < .85,
    signal: abort.signal, base, document: { baseURI: documentBase }, URL, room, camera, THREE,
    renderer: { setSize(...args: unknown[]) { sizes.push(args) } },
    options: { mode: 'eggs' }, wake() { wakes++ }, destroyed: false, loaded: false, status: { hidden: false },
    layout: () => {}, ready: async () => {},
  }
  runInNewContext(stripTypeScriptTypes(layoutSource + '\nasync function ready(){' + readySource + '}'), context)
  return { context, room, camera, styles, assignments, sizes, layout: () => context.layout(),
    dispose: () => { context.destroyed = true; abort.abort() },
    ready: () => context.ready(), wakes: () => wakes, focuses: () => focuses }
}

for (const prefix of ['/', '/cozy-farm/']) for (const portrait of [false, true]) {
  test(`room CSS resolves to the existing IMG at ${prefix}, ${portrait ? 'portrait' : 'desktop'}`, () => {
    const documentBase = `https://game.example${prefix}`, size = portrait ? { width: 390, height: 844 } : { width: 1080, height: 740 }
    const h = scene(documentBase, size); h.layout()
    const relative = './art/lavender/' + (portrait ? 'assembly/room-portrait.webp' : 'cookery/room.webp')
    const expected = new URL(relative, documentBase).href
    assert.equal(h.room.getAttribute('src'), relative, 'preserve the original document-relative IMG attribute')
    assert.equal(h.room.src, expected)
    const css = h.styles.get('--assembly-room')!
    assert.equal(css, `url("${expected}")`, 'custom property must not rebase under external /assets CSS')
    assert.equal(new URL(css.slice(5, -2), new URL('assets/arrangement.css', documentBase)).href, expected)
    assert.equal(new URL(expected).origin, new URL(documentBase).origin, 'no new cross-origin destination')
    assert.equal(h.context.root.dataset.portrait, String(portrait)); assert.equal(h.context.root.dataset.compact, 'false')
    assert.deepEqual(h.sizes, [[size.width, size.height, false]])
    assert.equal(h.camera.left, -h.camera.right); assert.equal(h.camera.near, .1); assert.equal(h.camera.far, 60)
    assert.ok(Math.abs((h.camera.right - h.camera.left) / (h.camera.top - h.camera.bottom) - size.width / size.height) < 1e-12)
    assert.equal(h.wakes(), 1); h.layout(); assert.equal(h.assignments.length, 1, 'same layout does not restart decoding')
  })
}

test('resize retains original room choice, compact flag and IMG assignment semantics', () => {
  const size = { width: 1080, height: 740 }, h = scene('https://game.example/cozy-farm/', size)
  h.layout(); size.width = 390; size.height = 844; h.layout()
  assert.equal(h.context.root.dataset.portrait, 'true'); assert.equal(h.assignments.length, 2)
  assert.equal(h.room.getAttribute('src'), './art/lavender/assembly/room-portrait.webp')
  size.width = 800; size.height = 360; h.layout()
  assert.equal(h.context.root.dataset.portrait, 'false'); assert.equal(h.context.root.dataset.compact, 'true')
  assert.equal(h.assignments.length, 3); assert.equal(h.room.getAttribute('src'), './art/lavender/cookery/room.webp')
  assert.equal(h.styles.get('--assembly-room'), 'url("https://game.example/cozy-farm/art/lavender/cookery/room.webp")')
})

test('rooted configured base still shares the exact original IMG resource', () => {
  const h = scene('https://game.example/elsewhere/', undefined, '/cozy-farm/'); h.layout()
  assert.equal(h.room.getAttribute('src'), '/cozy-farm/art/lavender/cookery/room.webp')
  assert.equal(h.styles.get('--assembly-room'), `url("${h.room.src}")`)
})

test('decoding still gates loaded status and focus without replacing the intended IMG', async () => {
  const h = scene('https://game.example/cozy-farm/'); h.layout()
  let finish = () => {}; h.room.decode = () => new Promise<void>(resolve => { finish = resolve })
  const pending = h.ready(); assert.equal(h.context.loaded, false); assert.equal(h.context.status.hidden, false); assert.equal(h.focuses(), 0)
  finish(); await pending
  assert.equal(h.context.loaded, true); assert.equal(h.context.status.hidden, true); assert.equal(h.focuses(), 1); assert.equal(h.assignments.length, 1)
  assert.equal(h.wakes(), 2)
  assert.match(source, /<img class="arrangement-room" alt="" fetchpriority="high" decoding="async">/)
})

test('disposal does not load or refocus a scene after pending image decode', async () => {
  const h = scene('https://game.example/'); h.layout()
  let finish = () => {}; h.room.decode = () => new Promise<void>(resolve => { finish = resolve })
  const pending = h.ready(); h.dispose(); finish(); await pending
  assert.equal(h.context.loaded, false); assert.equal(h.context.status.hidden, false); assert.equal(h.focuses(), 0); assert.equal(h.wakes(), 1)
})
