import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
import { beginCookeryStroke, cookeryProgress, createCookeryModel, endCookeryStroke, moveCookeryStroke, placeCookeryFruit, type PreserveProcessing } from '../src/cookery-model.ts'

const source = readFileSync(new URL('../src/cookery.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('cookery.ts', source, ts.ScriptTarget.Latest, true)
let syncSource = ''
const visit = (node: ts.Node) => {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'sync') syncSource = node.getText(ast)
  ts.forEachChild(node, visit)
}
visit(ast); assert.ok(syncSource)
const syncCode = ts.transpileModule(`${syncSource}\nsync()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
function kitchen(processing: PreserveProcessing = 'bright') {
  const model = createCookeryModel('preserves', processing)
  for (let i = 0; i < model.fruitRequired; i++) assert.equal(placeCookeryFruit(model, i, { x: Math.cos(i) * .5, y: Math.sin(i) * .5 }), true)
  const hint = { textContent: '' }, progress = { value: '', setAttribute(_name: string, value: string) { this.value = value } }
  const state = { model, cookeryProgress, destroyed: false, root: { dataset: {} }, renderedStage: '', drag: null as null | { kind: 'spoon'; loaded: boolean }, hint, announce() {}, progress,
    progressFill: { style: {} }, finish: { querySelector: () => ({ textContent: '' }) }, contextLost: false, loaded: true, physicallySettled: true,
    options: { recipe: { signature: true } }, sourceCue: {}, updateToolCue() {}, positionRotateHandle() {}, processingControls: { querySelectorAll: () => [] } }
  const sync = () => { const before = structuredClone(model); runInNewContext(syncCode, state); assert.deepEqual(model, before, 'guidance never changes cooking progress or mode') }
  const path = (at: (i: number) => { x: number; y: number }, count = 384) => {
    state.drag = { kind: 'spoon', loaded: false }; beginCookeryStroke(model, at(0))
    for (let i = 1; i <= count; i++) moveCookeryStroke(model, at(i))
    sync()
  }
  return { model, state, hint, progress, sync, path }
}

test('the actual scene asks for pickup only until the spoon is held and explains the required gesture', () => {
  const k = kitchen(); k.sync()
  assert.equal(k.hint.textContent, 'Возьмите ложку и мешайте по кругу')
  k.state.drag = { kind: 'spoon', loaded: false }; k.sync()
  assert.equal(k.hint.textContent, 'Мешайте широкими кругами')
  assert.doesNotMatch(k.hint.textContent, /Возьмите/)
  endCookeryStroke(k.model); k.state.drag = null; k.sync()
  assert.equal(k.hint.textContent, 'Возьмите ложку и мешайте по кругу')
})

for (const processing of ['chunky', 'bright', 'silky'] as const) test(`${processing}: rejected motions explain how to recover, without relaxing genuine circular work`, () => {
  for (const motion of ['center', 'radial', 'wobble']) {
    const k = kitchen(processing)
    k.path(i => motion === 'center' ? { x: .12 * Math.cos(i / 384 * Math.PI * 10), y: .12 * Math.sin(i / 384 * Math.PI * 10) }
      : motion === 'radial' ? { x: .25 + .45 * (1 + Math.sin(i / 384 * Math.PI * 10)) / 2, y: 0 }
      : { x: .6, y: .04 * Math.sin(i / 384 * Math.PI * 100) })
    assert.equal(k.model.stage, 'stir'); assert.ok(cookeryProgress(k.model) <= 2 / 14)
    assert.equal(k.hint.textContent, 'Мешайте широкими кругами')
    assert.equal(k.model.processing, processing)
    endCookeryStroke(k.model)
    k.path(i => ({ x: .6 * Math.cos(i / 384 * Math.PI * 10), y: .6 * Math.sin(i / 384 * Math.PI * 10) }))
    assert.equal(k.model.stage, 'fill'); assert.equal(k.model.scoops, 0)
    assert.equal(k.hint.textContent, 'Переложите конфитюр ложкой в банку')
    assert.equal(k.progress.value, '0', 'the next stage starts at zero; guidance does not silently fill the jar')
  }
})

test('fill/finish guidance and the existing accessible keys stay unchanged', () => {
  const k = kitchen(); k.state.drag = { kind: 'spoon', loaded: false }
  k.model.stage = 'fill'; k.sync()
  assert.equal(k.hint.textContent, 'Переложите конфитюр ложкой в банку')
  k.model.stage = 'ready'; k.sync(); assert.equal(k.hint.textContent, '')
  k.model.stage = 'finished'; k.sync(); assert.equal(k.hint.textContent, '')
  assert.ok(source.includes('S — ложка или сахарница, стрелки — перемещение, пробел — взять или положить'))
})
