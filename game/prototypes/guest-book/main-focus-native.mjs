// One short real-main confirmation of the companion explicit-command focus fix.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createServer } from '../../node_modules/vite/dist/node/index.js'
import { createEarnedFixture } from './qa/fixture.mjs'
import { introduceHenToVisitor, restoreCurrentFarm } from '../../src/farm.ts'
import { inviteNeighborVisit, finishNeighborVisit } from '../../src/neighbor-visits.ts'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const root = new URL('../../', import.meta.url).pathname, key = 'cozy-farm-island-v7', initial = createEarnedFixture().farm
const invited = structuredClone(initial); assert.ok(inviteNeighborVisit(invited, 'beaFlock').ok)
const observed = structuredClone(invited); assert.ok(introduceHenToVisitor(observed, 0).ok)
const finished = structuredClone(observed); assert.ok(finishNeighborVisit(finished, 1, 'quiet').ok)
const out = path.resolve(process.env.GUEST_BOOK_QA_OUTPUT ?? 'guest-book-main-focus-evidence'); await fs.mkdir(out, { recursive: true })
const report = { baseline: '98cb3be', companionFix: '16cfc58 surface-only', viewport: { width: 360, height: 640 }, states: [], errors: [], external: [] }
let browser, server
try {
 server = await createServer({ root, configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } }); await server.listen()
 const origin = `http://127.0.0.1:${server.httpServer.address().port}`
 browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? undefined, headless: true, chromiumSandbox: true, ignoreDefaultArgs: ['--enable-unsafe-swiftshader', '--unsafely-disable-devtools-self-xss-warnings'], args: ['--use-gl=angle', '--use-angle=swiftshader'] })
 const context = await browser.newContext({ viewport: report.viewport })
 await context.route('**/*', route => { if (new URL(route.request().url()).origin !== origin) { report.external.push(route.request().url()); return route.abort() } return route.continue() })
 await context.addInitScript(({ farm, key }) => {
  localStorage.setItem(key, JSON.stringify(farm)); window.__focusProof = { writes: [], events: [] }
  const set = Storage.prototype.setItem
  Storage.prototype.setItem = function(k, v) { if (k === key) window.__focusProof.writes.push(v); return set.call(this, k, v) }
  for (const type of ['click', 'keydown', 'keyup']) document.addEventListener(type, event => window.__focusProof.events.push({ type, trusted: event.isTrusted, key: event.key, repeat: event.repeat, action: event.target?.dataset?.action, command: event.target?.dataset?.commandKey }), true)
 }, { farm: initial, key })
 const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message))
 await page.goto(origin + '/?guestBookButtons=1', { waitUntil: 'networkidle' })
 const click = async selector => { await page.waitForTimeout(560); await page.locator(selector).click(); await page.waitForTimeout(180) }
 const open = async () => {
  await page.waitForTimeout(560); await page.getByRole('button', { name: 'Открыть бухту', exact: true }).click()
  await click('[data-action="open-panel"][data-value="rest"]')
  const entry = page.locator('[data-action="open-panel"][data-value="neighbor-visits"]')
  if (!await entry.isVisible()) await click('.home-rest-services summary')
  await click('[data-action="open-panel"][data-value="neighbor-visits"]')
 }
 const exact = async (expected, writes, label) => {
  await page.waitForFunction(({ key, serial, active, memory }) => {
   const f = JSON.parse(localStorage.getItem(key)); return f.neighborVisits.serial === serial && !!f.neighborVisits.active === active && !!f.neighborVisits.active?.observation === memory
  }, { key, serial: expected.neighborVisits.serial, active: !!expected.neighborVisits.active, memory: !!expected.neighborVisits.active?.observation })
  const actual = await page.evaluate(key => ({ farm: JSON.parse(localStorage.getItem(key)), writes: window.__focusProof.writes.length, focus: document.activeElement?.dataset?.commandKey, panel: document.querySelector('.farm-dialog').dataset.panel, open: document.querySelector('.farm-dialog').open }), key)
  assert.deepEqual(actual.farm, expected); assert.deepEqual(restoreCurrentFarm(actual.farm), expected); assert.equal(actual.writes, writes)
  report.states.push({ label, writes, focus: actual.focus, panel: actual.panel, open: actual.open })
 }
 await open(); await click('[data-guest-choice="activity"][data-value="beaFlock"]'); await exact(initial, 0, 'read-only-entry-and-selection')
 await click('[data-command-key="invite"]'); await exact(invited, 1, 'invite-closes-without-hidden-focus-recovery')
 assert.equal(await page.locator('.farm-dialog').evaluate(el => el.open), false)
 assert.equal(await page.evaluate(() => !!document.activeElement.closest('[data-guest-surface]')), false)
 await open()
 // Real openPanel focuses Close; four native Tabs traverse destinations to hen0.
 for (let i = 0; i < 4; i++) await page.keyboard.press('Tab')
 assert.equal(await page.locator('[data-command-key="hen-0"]').evaluate(el => el === document.activeElement), true)
 await page.keyboard.down('Enter')
 await page.waitForFunction(() => document.activeElement?.dataset?.commandKey === 'quiet')
 await exact(observed, 2, 'native-hen-activation-hands-focus-to-quiet')
 await page.keyboard.down('Enter')
 assert.equal(await page.locator('[data-command-key="quiet"]').isVisible(), true)
 await exact(observed, 2, 'held-Enter-does-not-answer-or-write-again')
 await page.screenshot({ path: path.join(out, '360x640-real-main-quiet-focused.png') })
 await page.keyboard.up('Enter'); await page.keyboard.press('Enter')
 await exact(finished, 3, 'fresh-quiet-answer-closes-once')
 assert.equal(await page.locator('.farm-dialog').evaluate(el => el.open), false)
 assert.equal(await page.evaluate(() => !!document.activeElement.closest('[data-guest-surface]')), false)
 report.events = await page.evaluate(() => window.__focusProof.events)
 assert.ok(report.events.length && report.events.every(event => event.trusted)); assert.ok(report.events.some(event => event.repeat))
 assert.deepEqual(report.errors, []); assert.deepEqual(report.external, [])
 report.pass = true; await context.close()
} catch (error) { report.pass = false; report.error = String(error.stack ?? error); throw error }
finally { await browser?.close(); await server?.close(); await fs.writeFile(path.join(out, 'main-focus-result.json'), JSON.stringify(report, null, 2)) }
console.log(JSON.stringify({ pass: report.pass, states: report.states, errors: report.errors, external: report.external }, null, 2))
