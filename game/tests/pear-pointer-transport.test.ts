import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createServer } from 'vite'
import * as THREE from 'three'
import type { HoneyPoint } from '../src/honey-cookery-model.ts'

// Exercise the shipped pointer listeners and controller against the real pear
// meshes, without replacing hit tests with an ellipse or requiring a GPU.
const source = readFileSync(new URL('../src/honey-cookery.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('honey-cookery.ts', source, ts.ScriptTarget.Latest, true)
const names = ['start', 'move', 'release', 'returnTool', 'currentTool', 'recordKnifeContact', 'sync']
const functions = new Map<string, string>()
const visit = (node: ts.Node) => {
  if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) functions.set(node.name.text, node.getText(ast))
  ts.forEachChild(node, visit)
}
visit(ast)
for (const name of names) assert.ok(functions.has(name), `actual ${name} controller`)
const pointerStart = source.indexOf('  const eventPoint = '), pointerEnd = source.indexOf('  function rotateFruit(', pointerStart)
assert.ok(pointerStart > 0 && pointerEnd > pointerStart)
const script = ts.transpileModule([...functions.values(), source.slice(pointerStart, pointerEnd)].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
let server: Awaited<ReturnType<typeof createServer>>, createHoneyPears: typeof import('../src/honey-pear-view.ts').createHoneyPears
let api: typeof import('../src/honey-cookery-model.ts')
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  ;({ createHoneyPears } = await server.ssrLoadModule('/src/honey-pear-view.ts'))
  api = await server.ssrLoadModule('/src/honey-cookery-model.ts')
})
after(async () => { await server.close() })

class Surface extends EventTarget {
  captured = new Set<number>()
  focused = false
  overControl = false
  closest() { return this.overControl ? {} : null }
  getBoundingClientRect() { return { left: 37, top: 61 } }
  setPointerCapture(id: number) { this.captured.add(id) }
  hasPointerCapture(id: number) { return this.captured.has(id) }
  releasePointerCapture(id: number) { this.captured.delete(id) }
  focus() { this.focused = true }
}
const holder = { x: 920, y: 420 }, across = { x: 300, y: 420 }
const cutStart = { x: 375, y: 300 }, cutEnd = { x: 375, y: 525 }
function kitchen() {
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(0, 1000, 0, 700, .1, 2000)
  camera.position.z = 1000
  const texture = new THREE.Texture(), resources = { geometries: new Set<THREE.BufferGeometry>(), materials: new Set<THREE.Material>(), textures: new Set<THREE.Texture>() }
  const pearView = createHoneyPears(scene, camera, { skin: texture, flesh: texture, honey: texture, crown: texture }, resources)
  pearView.layout({ x: 500, y: 420, rx: 240, ry: 120 }, 1000, 700)
  const model = api.createHoneyModel('honeyPear'), view = new Surface(), window = new EventTarget(), abort = new AbortController()
  const knife = { mesh: { rotation: { z: -.12 }, position: { ...holder } }, rect: { width: 40 } }
  const hint = { textContent: '' }, sounds: string[] = []
  const state = {
    ...api, model, pearView, view, window, signal: abort.signal, family: 'honeyPear', loaded: true, lost: false, destroyed: false,
    pointer: null, pointerPressure: .9, keyboard: false, cursor: { x: 0, y: 0 }, held: null, knifeTransport: false, knifeSounded: new Set(),
    parts: new Map([['knife', knife]]), toolReturns: new Map(), knifeAngle: { value: 0, velocity: 0 }, creamRelease: null,
    normalized: (p: HoneyPoint) => ({ x: (p.x - 500) / 240, y: (p.y - 420) / 120 }),
    contains: (object: typeof knife, p: HoneyPoint) => Math.hypot(p.x - object.mesh.position.x, p.y - object.mesh.position.y) < 40,
    moveHeld: (p: HoneyPoint) => { state.cursor = p; knife.mesh.position = { ...p } },
    contact: { x: 0, y: 0, vx: 0, vy: 0 }, contactReady: false, lastContact: null,
    updateCursor() {}, sculpt() {}, updateFoodState() {}, layout() {}, positionRotation() {}, announce() {},
    playBaySound: (id: string) => sounds.push(id), setBaySoundContact() {}, honeySound: 'cook.honey-flow',
    foods: [], grippedDough: null, gripMaterial: null, coating: { value: 0, velocity: 0 }, honeyDrop: null, strandTail: 0,
    root: { dataset: {} }, pourControl: { hidden: true }, hint, previousStage: 'cut', previousProgress: 0,
    progress: { hidden: false, setAttribute() {} }, fill: { style: { width: '' } }, physicalQuiet: true,
    finish: { hidden: true, disabled: false, querySelector: () => ({ textContent: '' }) }, options: {},
  }
  runInNewContext(script, state)
  const point = (p: HoneyPoint) => ({ clientX: p.x + 37, clientY: p.y + 61 })
  function send(type: string, p: HoneyPoint, id = 1, samples?: HoneyPoint[], extra = {}) {
    view.dispatchEvent(Object.assign(new Event(type), { ...point(p), pointerId: id, button: 0, pointerType: 'mouse', pressure: .5,
      getCoalescedEvents: () => samples?.map(point) ?? [], ...extra }))
    // Same partial-kerf feedback as the existing interaction fixture. Completed
    // half rasterization/visible tool motion remain a separate native gate.
    if (!model.cuts.size) pearView.update(model, 1 / 60)
  }
  function path(from: HoneyPoint, to: HoneyPoint, steps: number, coalesced = false) {
    const points = Array.from({ length: steps }, (_, i) => ({ x: from.x + (to.x - from.x) * (i + 1) / steps, y: from.y + (to.y - from.y) * (i + 1) / steps }))
    if (coalesced) send('pointermove', to, 1, points)
    else for (const p of points) send('pointermove', p)
  }
  return { state, model, view, window, hint, sounds, pearView, send, path, dispose() {
    abort.abort(); for (const group of Object.values(resources)) for (const resource of group) resource.dispose(); texture.dispose()
  } }
}
function untouched(k: ReturnType<typeof kitchen>) {
  assert.deepEqual(k.model.cutTracks.map(track => track.progress), [0, 0])
  assert.equal(k.model.cuts.size, 0); assert.equal(k.model.pending, null); assert.equal(k.model.stage, 'cut')
  assert.deepEqual(k.sounds, [])
}

for (const steps of [1, 3, 30, 150]) for (const coalesced of [false, true]) test(`holder transport stays uncut through both real meshes: ${steps} samples, coalesced=${coalesced}`, () => {
  const k = kitchen()
  try {
    k.send('pointerdown', holder); k.path(holder, across, steps, coalesced)
    untouched(k); assert.equal(k.state.knifeTransport, true)
    k.send('pointerup', across); untouched(k)
    assert.equal(k.state.held, null); assert.equal(k.state.pointer, null); assert.equal(k.view.captured.size, 0)
    // No need to re-acquire the tool: the next ordinary worktop gesture cuts.
    k.send('pointerdown', cutStart); k.path(cutStart, cutEnd, steps, coalesced); k.send('pointerup', cutEnd)
    assert.deepEqual([...k.model.cuts], [0]); assert.deepEqual(k.sounds, ['cook.pear-cut'])
  } finally { k.dispose() }
})

test('holder pickup immediately explains release, then restores the short direct-gesture cue', () => {
  const k = kitchen()
  try {
    k.send('pointerdown', holder)
    assert.match(k.hint.textContent, /Отпустите нож/)
    k.send('pointerup', holder)
    assert.equal(k.hint.textContent, 'Проведите по груше от края до края · 0/2')
    untouched(k)
  } finally { k.dispose() }
})

test('a new worktop swipe during tool return is not mistaken for picking up the stored knife', () => {
  const k = kitchen()
  try {
    assert.equal(k.pearView.wholeHit(cutStart), false, 'ordinary start just outside the silhouette')
    k.send('pointerdown', holder); k.send('pointermove', cutStart); k.send('pointerup', cutStart)
    untouched(k); assert.ok(k.state.toolReturns.has('knife'))
    k.send('pointerdown', cutStart); assert.equal(k.state.knifeTransport, false)
    k.send('pointermove', cutEnd); k.send('pointerup', cutEnd)
    assert.deepEqual([...k.model.cuts], [0])
  } finally { k.dispose() }
})

for (const steps of [1, 3, 150]) test(`direct worktop swipe keeps its previous hit threshold: ${steps} samples`, () => {
  const k = kitchen()
  try {
    k.send('pointerdown', cutStart); k.path(cutStart, cutEnd, steps); k.send('pointerup', cutEnd)
    assert.deepEqual([...k.model.cuts], [0]); assert.equal(k.model.cutTracks[1].progress, 0)
  } finally { k.dispose() }
})

for (const cancel of ['pointercancel', 'lostpointercapture', 'blur']) test(`${cancel} ends transport and late move/up cannot cut`, () => {
  const k = kitchen()
  try {
    k.send('pointerdown', holder); k.send('pointermove', { x: 610, y: 420 })
    if (cancel === 'blur') k.window.dispatchEvent(new Event('blur'))
    else k.send(cancel, { x: 610, y: 420 })
    k.send('pointermove', across); k.send('pointerup', across); untouched(k)
    assert.equal(k.state.pointer, null); assert.equal(k.state.held, null)
    k.send('pointerdown', cutStart); k.send('pointermove', cutEnd); k.send('pointerup', cutEnd)
    assert.deepEqual([...k.model.cuts], [0])
  } finally { k.dispose() }
})

test('pointer identity, controls and right button cannot start or hijack a cut', () => {
  const k = kitchen()
  try {
    k.send('pointerdown', cutStart, 1, undefined, { button: 2 }); k.send('pointermove', cutEnd); untouched(k)
    k.view.overControl = true; k.send('pointerdown', cutStart); k.view.overControl = false
    k.send('pointermove', cutEnd); untouched(k)
    k.send('pointerdown', holder)
    k.send('pointerdown', cutStart, 2); k.send('pointermove', cutEnd, 2); k.send('pointerup', cutEnd, 2)
    assert.equal(k.state.pointer, 1); assert.equal(k.state.knifeTransport, true); untouched(k)
    k.send('pointerup', holder); untouched(k)
    k.send('pointerdown', cutStart); k.send('pointermove', cutEnd, 2); untouched(k)
    k.send('pointermove', cutEnd); k.send('pointerup', cutEnd)
    assert.deepEqual([...k.model.cuts], [0])
  } finally { k.dispose() }
})

test('empty worktop motion and an outside press never credit a pear', () => {
  const k = kitchen()
  try {
    k.send('pointerdown', { x: 20, y: 20 }); k.send('pointermove', across); k.send('pointerup', across); untouched(k)
    const a = { x: 475, y: 300 }, b = { x: 515, y: 300 }
    assert.equal(k.pearView.wholeHit(a), false); assert.equal(k.pearView.wholeHit(b), false)
    k.send('pointerdown', a); k.path(a, b, 150); k.send('pointerup', b); untouched(k)
  } finally { k.dispose() }
})

test('a slightly wavering diagonal across both rendered fruit works in either direction and at both sample rates', () => {
  for (const samples of [5, 40]) for (const reverse of [false, true]) {
    const k = kitchen()
    try {
      for (const [i, cx] of [375, 610].entries()) {
        const at = (fraction: number) => {
          const t = reverse ? 1 - fraction : fraction, wobble = 3 * Math.sin(3 * Math.PI * t)
          return { x: cx + (t - .5) * 155 + wobble, y: 407 + (t - .5) * 180 - wobble * .45 }
        }
        k.send('pointerdown', at(0))
        for (let j = 1; j <= samples; j++) k.send('pointermove', at(j / samples))
        if (i === 1) { assert.equal(k.model.stage, 'cut'); assert.equal(k.model.pending, 'glaze') }
        k.send('pointerup', at(1))
        assert.ok(k.model.cuts.has(i), `fruit=${i} reverse=${reverse} samples=${samples}`)
        assert.equal(k.model.cuts.size, i + 1)
      }
      assert.equal(k.model.stage, 'glaze'); assert.deepEqual(k.model.steps, ['cut-pears'])
      assert.deepEqual(k.sounds, ['cook.pear-cut', 'cook.pear-cut'])
    } finally { k.dispose() }
  }
})

test('jitter, a short nick and circling on the skin do not finish a pear', () => {
  for (const kind of ['jitter', 'nick', 'circle']) {
    const k = kitchen()
    try {
      const at = (i: number) => kind === 'circle' ? { x: 380 + 23 * Math.cos(i * Math.PI / 12), y: 407 + 23 * Math.sin(i * Math.PI / 12) }
        : kind === 'nick' ? { x: 375 + i, y: 400 } : { x: 375 + i % 3 - 1, y: 400 + i % 2 * 2 }
      assert.ok(k.pearView.wholeHit(at(0)))
      k.send('pointerdown', at(0))
      for (let i = 1; i <= 24; i++) k.send('pointermove', at(i))
      k.send('pointerup', at(24)); assert.equal(k.model.cuts.size, 0, kind)
      assert.equal(k.model.stage, 'cut'); assert.equal(k.model.pending, null)
    } finally { k.dispose() }
  }
})
