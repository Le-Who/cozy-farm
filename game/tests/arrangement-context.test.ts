import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

type Mode = 'table' | 'basket' | 'eggs' | 'crate'
const source = readFileSync(new URL('../src/arrangement.ts', import.meta.url), 'utf8')

// Execute the scene's actual markup and registered commit handler, without loading
// WebGL, audio, art or a saved farm. The regression is in these two UI boundaries.
function markup(mode: Mode): string {
  const template = source.match(/root\.innerHTML = (`[^\n]+`)/)?.[1]
  assert.ok(template, 'the scene markup assignment is present')
  return runInNewContext(template, { options: { mode }, packing: mode === 'eggs' || mode === 'crate' })
}
function commit(mode: Mode, succeeds: boolean, points: object[] | null = [{ slot: 'food', x: 0, y: 0 }]) {
  const registration = source.match(/  finish\.addEventListener\('click', \(\) => \{[\s\S]*?\n  \}, \{ signal \}\)/)?.[0]
  assert.ok(registration, 'the scene commit handler is present')
  const status = { textContent: '', hidden: true }, live = { textContent: '' }
  let handler = () => {}, calls = 0, sounds = 0
  const finish = { hidden: false, addEventListener: (_name: string, callback: () => void) => { handler = callback } }
  const context = { committed: false, physics: { result: () => points }, lost: false, packing: mode === 'eggs' || mode === 'crate',
    options: { mode, onComplete: () => { calls++; return succeeds } }, finish, live, status, signal: undefined,
    playBaySound: () => { sounds++ } }
  const compiled = ts.transpileModule(registration, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(compiled, context)
  return { click: () => handler(), status, live, finish, calls: () => calls, sounds: () => sounds, committed: () => context.committed }
}

const labels: Record<Mode, string> = {
  table: 'Сервировка стола', basket: 'Сбор корзинки для пикника',
  eggs: 'Упаковка корзины яиц', crate: 'Упаковка ящика яиц',
}
for (const mode of Object.keys(labels) as Mode[]) test(`${mode}: scene's accessible name identifies its actual activity`, () => {
  const html = markup(mode)
  assert.equal(html.match(/class="arrangement-view"[^>]*aria-label="([^"]+)"/)?.[1], labels[mode])
  assert.equal(html.includes('data-action="finish-egg-packing"'), mode === 'eggs' || mode === 'crate')
})
for (const mode of ['eggs', 'crate'] as const) test(`${mode}: rejected packing points back to coop, not a food recipe`, () => {
  const scene = commit(mode, false)
  scene.click()
  assert.equal(scene.status.textContent, 'Не удалось упаковать яйца. Вернитесь в курятник и проверьте запасы.')
  assert.equal(scene.status.hidden, false)
  assert.equal(scene.finish.hidden, false)
  assert.equal(scene.committed(), false)
  assert.equal(scene.sounds(), 0)
  scene.click()
  assert.equal(scene.calls(), 2, 'a failed commit remains retryable')
})
for (const mode of ['table', 'basket'] as const) test(`${mode}: neighbor failure retains the existing recipe recovery message`, () => {
  const scene = commit(mode, false)
  scene.click()
  assert.equal(scene.status.textContent, 'Не хватает угощения. Вернитесь к рецепту.')
  assert.equal(scene.committed(), false)
})
for (const mode of Object.keys(labels) as Mode[]) test(`${mode}: successful completion remains once-only`, () => {
  const scene = commit(mode, true)
  scene.click(); scene.click()
  assert.equal(scene.calls(), 1)
  assert.equal(scene.sounds(), 1)
  assert.equal(scene.committed(), true)
  assert.equal(scene.finish.hidden, true)
  assert.equal(scene.live.textContent, 'Готово')
  assert.equal(scene.status.hidden, true)
})
test('an unsettled arrangement still cannot reach the commit boundary', () => {
  const blocked = commit('crate', false, null)
  blocked.click()
  assert.equal(blocked.calls(), 0)
  assert.equal(blocked.status.hidden, true)
})

const modeInstructions: Record<Mode, { loading: string; placement: string; finish: string }> = {
  table: { loading: 'Накрываем стол…', placement: 'Перенесите предметы на салфетку.', finish: 'сервировку' },
  basket: { loading: 'Готовим корзинку для пикника…', placement: 'Перенесите предметы в корзинку.', finish: 'сбор корзинки' },
  eggs: { loading: 'Готовим корзинку для яиц…', placement: 'Перенесите яйца в корзинку.', finish: 'упаковку яиц' },
  crate: { loading: 'Готовим ящик для яиц…', placement: 'Перенесите яйца в ящик.', finish: 'упаковку яиц' },
}
for (const mode of Object.keys(modeInstructions) as Mode[]) test(`${mode}: described controls and loading status agree with the scene`, () => {
  const html = markup(mode), expected = modeInstructions[mode]
  assert.match(html, /aria-describedby="assembly-controls"/)
  assert.equal(html.match(/class="arrangement-status" role="status">([^<]+)</)?.[1], expected.loading)
  const instructions = html.match(/id="assembly-controls">([^<]+)</)?.[1]
  assert.ok(instructions)
  assert.ok(instructions.startsWith(expected.placement))
  assert.ok(instructions.includes(`Enter завершает ${expected.finish}, Escape возвращается.`))
  assert.ok(instructions.includes('пробел берёт и отпускает, стрелки перемещают'))
  if (mode === 'eggs' || mode === 'crate') assert.doesNotMatch(instructions, /сервиров|угощени/)
  if (mode === 'crate') assert.doesNotMatch(instructions, /корзин/)
})
