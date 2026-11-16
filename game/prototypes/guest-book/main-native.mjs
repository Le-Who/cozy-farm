// Run against real main.ts DEV opt-in, not a synthetic host. One earned initial
// save; subsequent input is trusted browser input. No runtime monkeypatch.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from '../../node_modules/vite/dist/node/index.js'
import { createEarnedFixture, repeatOracle, sourceCommit, nativeSourceCommit } from './qa/fixture.mjs'
import { restoreCurrentFarm } from '../../src/farm.ts'
import { visitActivities, inviteNeighborVisit, finishNeighborVisit } from '../../src/neighbor-visits.ts'

const root = process.env.GUEST_BOOK_GAME_ROOT ?? new URL('../../', import.meta.url).pathname
const expectRepeatCopy = true
const query = '?guestBookButtons=1'
const out = path.resolve(process.env.GUEST_BOOK_QA_OUTPUT ?? 'guest-book-dev-main-evidence')
const playwrightPath = process.env.PLAYWRIGHT_MODULE
  ?? 'playwright'
const executablePath = process.env.CHROMIUM_PATH
  ?? undefined
const { chromium } = await import(pathToFileURL(playwrightPath).href)
const fixture = createEarnedFixture(), oracle = repeatOracle(fixture)
const key = 'cozy-farm-island-v7'
const report = { sourceCommit: 'edad8fd + 211d18e three files + dev main bridge', nativeSourceCommit, expectRepeatCopy,
  provenance: 'Initial save: 119 public reducers from createFarm; subsequent visit actions: trusted native browser inputs through DEV-only main.ts bridge and unchanged domain/save handlers.',
  excludes: ['No claim of native 119-command progression', 'No final visual/layout acceptance', 'No new art or approved visual layout', 'No pointer/touch crop gesture claim: crop gesture is keyboard Enter'],
  crops: fixture.crops, runs: [] }
await fs.mkdir(out, { recursive: true })
await fs.writeFile(path.join(out, 'earned-home.json'), JSON.stringify(fixture.farm, null, 2))
await fs.writeFile(path.join(out, 'public-trace.json'), JSON.stringify(fixture.trace, null, 2))
let server, browser
try {
  server = await createServer({ root, configFile: false, server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
  await server.listen()
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ executablePath, headless: true, chromiumSandbox: true,
    ignoreDefaultArgs: ['--enable-unsafe-swiftshader', '--unsafely-disable-devtools-self-xss-warnings'],
    args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  for (const viewport of [{ width: 568, height: 320 }, { width: 360, height: 640 }]) {
    const id = `${viewport.width}x${viewport.height}`
    const run = { viewport, states: [], actions: [], trusted: [], errors: [], external: [] }
    report.runs.push(run)
    const context = await browser.newContext({ viewport })
    let page
    try {
      await context.route('**/*', route => {
        const url = new URL(route.request().url())
        if (url.origin !== origin || url.pathname.startsWith('/api/')) {
          run.external.push(url.href); return route.abort()
        }
        return route.continue()
      })
      await context.addInitScript(({ farm, key }) => {
        if (!sessionStorage.getItem('guest-book-earned-seeded')) {
          localStorage.setItem(key, JSON.stringify(farm))
          sessionStorage.setItem('guest-book-earned-seeded', '1')
        }
        window.__guestQA = { writes: [], events: [] }
        const set = Storage.prototype.setItem
        Storage.prototype.setItem = function(k, value) {
          if (k === key) window.__guestQA.writes.push(value)
          return set.call(this, k, value)
        }
        for (const type of ['click', 'wheel', 'keydown', 'keyup']) document.addEventListener(type, event => {
          window.__guestQA.events.push({ type, trusted: event.isTrusted,
            key: event.key, action: event.target?.dataset?.action, value: event.target?.dataset?.value })
        }, true)
      }, { farm: fixture.farm, key })
      page = await context.newPage()
      page.on('pageerror', error => run.errors.push(error.message))
      page.setDefaultTimeout(20_000)
      const state = () => page.evaluate(key => ({ raw: localStorage.getItem(key), writes: window.__guestQA.writes.length }), key)
      const exact = async (expected, writes, label) => {
        const current = await state(), farm = JSON.parse(current.raw)
        assert.deepEqual(farm, expected, `${id} ${label}: full save equality`)
        assert.deepEqual(restoreCurrentFarm(farm), expected, `${id} ${label}: exact restore`)
        assert.equal(current.writes, writes, `${id} ${label}: primary write count`)
        run.states.push({ label, writes, serial: farm.neighborVisits.serial,
          visit: structuredClone(farm.neighborVisits), firstBed: farm.beds[fixture.crops[0].index], secondBed: farm.beds[fixture.crops[1].index] })
        console.log(`${id} ${label}: ${writes} writes; serial ${farm.neighborVisits.serial}`)
      }
      const reach = async selector => {
        // Real wheel input, measured against the dialog's clipping viewport.
        for (let attempt = 0; attempt < 80; attempt++) {
          const target = await page.locator(selector).first().boundingBox()
          const clip = await page.locator('.dialog-content').boundingBox()
          assert.ok(target && clip, selector)
          if (target.y >= clip.y - 1 && target.y + target.height <= clip.y + clip.height + 1) return
          const delta = target.y < clip.y ? target.y - clip.y - 4
            : target.y + target.height - (clip.y + clip.height) + 4
          await page.mouse.move(clip.x + clip.width * .6, clip.y + clip.height / 2)
          await page.mouse.wheel(0, Math.sign(delta) * Math.min(110, Math.max(16, Math.abs(delta))))
          await page.waitForTimeout(100)
        }
        assert.fail(`Wheel scroll could not expose ${selector}`)
      }
      const click = async selector => {
        await page.waitForTimeout(560)
        await page.locator(selector).click()
        await page.waitForTimeout(180)
      }
      const shot = async label => {
        await page.screenshot({ path: path.join(out, `${id}-${label}.png`) })
        const geometry = await page.evaluate(() => {
          const el = document.querySelector('.dialog-content'), rect = el?.getBoundingClientRect()
          return { panel: document.querySelector('.farm-dialog')?.dataset.panel,
            scrollTop: el?.scrollTop, horizontalOverflow: el ? el.scrollWidth > el.clientWidth + 1 : false,
            content: rect ? { top: rect.top, bottom: rect.bottom, height: rect.height } : null }
        })
        assert.equal(geometry.horizontalOverflow, false)
        run.states.push({ label: `${label}-geometry`, ...geometry })
      }
      const openBook = async () => {
        await page.waitForTimeout(560)
        await page.getByRole('button', { name: 'Открыть бухту', exact: true }).click()
        await click('[data-action="open-panel"][data-value="rest"]')
        if (await page.locator('.home-rest-services summary').count()) {
          const expanded = await page.locator('.home-rest-services').getAttribute('open')
          if (expanded === null) { await reach('.home-rest-services summary'); await click('.home-rest-services summary') }
        }
        await reach('[data-action="open-panel"][data-value="neighbor-visits"]')
        await click('[data-action="open-panel"][data-value="neighbor-visits"]')
        await page.locator('[data-guest-surface]').waitFor()
      }
      const choose = async (part, value) => {
        const selector = `[data-guest-choice="${part}"][data-value="${value}"]`
        await reach(selector); await click(selector)
      }
      const verifyGates = async () => {
        await choose('resident', 'finn'); await choose('activity', 'finnOrchard')
        assert.equal(await page.locator('[data-guest-command="visit-invite"]').isDisabled(), true)
        assert.match(await page.locator('[data-text="gate"]').innerText(), /общую встречу/)
        await choose('resident', 'bea'); await choose('activity', 'beaHarvest')
        assert.equal(await page.locator('[data-guest-command="visit-invite"]').isDisabled(), false)
        assert.equal(await page.locator('[data-guest-command="visit-invite"]:visible').count(), 1)
        run.states.push({ label: 'actual-button-gates', eligible: 'bea', locked: 'finn', exactInvitation: 'beaHarvest' })
      }
      const history = async () => {
        await choose('resident', 'finn'); await choose('activity', 'finnOrchard')
        await choose('page', 'rules')
        assert.equal(await page.locator('[data-focus="rules"]').evaluate(el => el === document.activeElement), true)
        await click('.dialog-back')
        assert.equal(await page.locator('[data-guest-choice="page"][data-value="rules"]').evaluate(el => el === document.activeElement), true)
        await choose('page', 'memories'); await page.keyboard.press('Escape')
        assert.equal(await page.locator('[data-guest-choice="page"][data-value="memories"]').evaluate(el => el === document.activeElement), true)
        await click('.dialog-back')
        assert.equal(await page.locator('.farm-dialog').getAttribute('data-panel'), 'rest')
        if (await page.locator('.home-rest-services').count() && await page.locator('.home-rest-services').getAttribute('open') === null) {
          await reach('.home-rest-services summary'); await click('.home-rest-services summary')
        }
        await reach('[data-action="open-panel"][data-value="neighbor-visits"]')
        await click('[data-action="open-panel"][data-value="neighbor-visits"]')
        assert.equal(await page.locator('[data-guest-choice="activity"][data-value="finnOrchard"]').getAttribute('aria-pressed'), 'true')
        run.states.push({ label: 'real-Home-history-and-local-back', exactChoice: 'finnOrchard', parent: 'rest', localBack: ['header', 'Escape'], parentBack: 'header, then real Home reopening' })
      }
      const collectEvents = async () => run.trusted.push(...await page.evaluate(() => window.__guestQA.events))
      const reloadExact = async (expected, label) => {
        const before = await state()
        await collectEvents()
        await page.reload({ waitUntil: 'networkidle' })
        await page.getByRole('button', { name: 'Открыть бухту', exact: true }).waitFor()
        assert.equal((await state()).raw, before.raw, 'reload keeps exact serialized save bytes')
        await exact(expected, 0, label)
      }
      await page.goto(origin + query, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'Открыть бухту', exact: true }).waitFor()
      await exact(fixture.farm, 0, 'initial-earned-fixture')
      await openBook(); await history(); await verifyGates(); await exact(fixture.farm, 0, 'read-only-entry-and-gates')
      await reach('[data-action="visit-invite"][data-value="beaHarvest"]'); await shot('01-first-invitation')
      for (let visit = 0; visit < 2; visit++) {
        const serial = visit + 1, offset = visit * 3, crop = fixture.crops[visit]
        const reply = visit === 0 ? 'quiet' : 'curious'
        await reach('[data-action="visit-invite"][data-value="beaHarvest"]')
        await click('[data-action="visit-invite"][data-value="beaHarvest"]')
        await exact(oracle[offset].state, 1, `visit-${serial}-separate-invitation`)
        run.actions.push({ native: true, command: 'inviteNeighborVisit', args: ['beaHarvest'], serial })
        await openBook()
        assert.equal(await page.locator('[data-action="visit-reply"]:visible').count(), 0)
        await reach(`[data-action="visit-do"][data-value="${serial}"]`)
        await click(`[data-action="visit-do"][data-value="${serial}"]`)
        assert.equal(await page.locator('.island-canvas').evaluate(el => el === document.activeElement), true)
        await exact(oracle[offset].state, 1, `visit-${serial}-source-route-is-read-only`)
        await page.waitForTimeout(560)
        await page.keyboard.press('Enter')
        await page.waitForFunction(({ key, crop }) => JSON.parse(localStorage.getItem(key)).beds[crop.index].kind === 'tilled', { key, crop })
        await exact(oracle[offset + 1].state, 2, `visit-${serial}-native-${crop.crop}-harvest`)
        const harvestToast = await page.locator('.toast').innerText()
        run.states.push({ label: `visit-${serial}-harvest-toast`, text: harvestToast })
        if (expectRepeatCopy) assert.match(harvestToast, visit === 0
          ? /Воспоминание добавлено в гостевую книгу/ : /В гостевой книге осталась первая встреча за этим занятием/)
        run.actions.push({ native: true, command: 'workBed', args: [crop.index], gesture: 'canvas Enter after real visit-do focus' })
        await openBook()
        assert.deepEqual(await page.locator('[data-action="visit-reply"]:visible').evaluateAll(items => items.map(item => item.dataset.value)), [`${serial}:quiet`, `${serial}:curious`])
        const activeSubject = expectRepeatCopy && visit === 1 ? `Сегодня: ${crop.subject}` : crop.subject
        assert.equal(await page.locator('[data-text="observation-subject"]').innerText(), activeSubject)
        if (expectRepeatCopy) {
          const text = await page.locator('[data-screen="active"]').innerText()
          assert.match(text, visit === 0 ? /Воспоминание добавлено в книгу/ : /В книге осталась ваша первая встреча за этим занятием/)
          if (visit === 1) assert.ok(!text.includes(visitActivities.beaHarvest.memory), 'repeat does not reuse first-moment narrative')
        }
        await reach('[data-text="observation-subject"]'); await shot(`0${serial + 1}-${crop.crop}-observation`)
        let writesBeforeReply = 2
        if (visit === 1) {
          await reloadExact(oracle[offset + 1].state, 'reload-active-repeat-keeps-beetroot-and-first-carrot-quiet')
          await openBook()
          assert.equal(await page.locator('[data-text="observation-subject"]').innerText(), activeSubject)
          writesBeforeReply = 0
        }
        await reach(`[data-action="visit-reply"][data-value="${serial}:${reply}"]`)
        await click(`[data-action="visit-reply"][data-value="${serial}:${reply}"]`)
        await exact(oracle[offset + 2].state, writesBeforeReply + 1, `visit-${serial}-${reply}-reply`)
        // Existing production perform() writes replies to dialog feedback, then
        // closes the book. Do not mistake a stale harvest toast for a farewell.
        const farewellFeedback = await page.locator('.dialog-feedback').textContent()
        run.states.push({ label: `visit-${serial}-farewell-feedback`, text: farewellFeedback,
          visible: await page.locator('.dialog-feedback').isVisible(), presentation: 'Existing closed dialog feedback, not a visible toast' })
        if (expectRepeatCopy) assert.match(farewellFeedback, visit === 0
          ? /Воспоминание осталось в гостевой книге/ : /В гостевой книге осталась первая встреча за этим занятием/)
        run.actions.push({ native: true, command: 'finishNeighborVisit', args: [serial, reply] })
        await reloadExact(oracle[offset + 2].state, `reload-after-visit-${serial}`)
        await openBook(); await verifyGates()
        await choose('page', 'memories')
        const memory = page.locator('[data-screen="memories"]')
        assert.equal(await memory.count(), 1)
        assert.equal(await memory.locator('[data-text="memory-subject"]').innerText(), fixture.crops[0].subject)
        assert.ok((await memory.innerText()).includes(visitActivities.beaHarvest.quiet))
        assert.ok(!(await memory.innerText()).includes(visitActivities.beaHarvest.curious))
        await reach('[data-text="memory-subject"]'); await shot(`0${serial + 3}-first-memory-still-carrot-quiet`)
        await exact(oracle[offset + 2].state, 0, `visit-${serial}-memory-reading-zero-writes`)
        await reach('[data-guest-back]'); await click('[data-guest-back]')
      }
      // Real pastry source pushes the actual Guest Book PanelVisit, unlike the
      // map destination shortcut which deliberately rewinds existing history.
      const third = structuredClone(oracle[5].state)
      assert.ok(inviteNeighborVisit(third, 'beaHands').ok)
      await choose('activity', 'beaHands')
      // Keep Enter held while Tab moves from Hands to Flock and then the CTA.
      // No evaluate/focus/click shim: every activation below is trusted input.
      await page.keyboard.down('Enter')
      await page.keyboard.press('Tab'); await page.keyboard.press('Tab')
      assert.equal(await page.locator('[data-guest-command="visit-invite"]').evaluate(el => el === document.activeElement), true)
      await page.keyboard.down('Enter')
      assert.equal(await page.locator('[data-guest-command="visit-invite"]').isVisible(), true, 'blocked repeat leaves actual farm in invitation phase')
      await exact(oracle[5].state, 0, 'held-Enter-selection-cannot-invite')
      await page.keyboard.up('Enter'); await page.keyboard.press('Enter')
      // VersionedSave commits asynchronously. Wait for its real durable result.
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).neighborVisits.serial === 3, key)
      await exact(third, 1, 'pastry-invitation-real-save')
      await openBook(); await reach('[data-command-key="do"]')
      const sourceScroll = await page.locator('.dialog-content').evaluate(el => el.scrollTop)
      await click('[data-command-key="do"]')
      assert.equal(await page.locator('.farm-dialog').getAttribute('data-panel'), 'workshop')
      await exact(third, 1, 'real-workshop-source-no-save')
      await page.keyboard.press('Alt+ArrowLeft'); await page.waitForTimeout(250)
      assert.equal(await page.locator('.farm-dialog').getAttribute('data-panel'), 'neighbor-visits')
      assert.equal(await page.locator('[data-command-key="do"]').evaluate(el => el === document.activeElement), true)
      assert.equal(await page.locator('.dialog-content').evaluate(el => el.scrollTop), sourceScroll)
      assert.equal(await page.locator('[data-guest-choice="activity"][data-value="beaHands"]').getAttribute('aria-pressed'), 'true')
      await exact(third, 1, 'PanelVisit-restores-choice-command-focus-scroll')
      await reach('[data-command-key="close"]'); await click('[data-command-key="close"]')
      await exact(third, 1, 'close-does-not-finish')
      await openBook(); await reach('[data-command-key="finish"]'); await click('[data-command-key="finish"]')
      assert.ok(finishNeighborVisit(third, 3).ok)
      await exact(third, 2, 'explicit-finish-without-reply-real-save')
      run.states.push({ label: 'workshop-return-history-proof', selectedActivity: 'beaHands', source: 'workshop', commandFocus: 'do', scroll: sourceScroll })
      await collectEvents()
      assert.ok(run.trusted.length > 0 && run.trusted.every(event => event.trusted))
      assert.deepEqual(run.errors, []); assert.deepEqual(run.external, [])
      assert.equal(run.actions.length, 6)
      run.pass = true
    } catch (error) {
      run.error = String(error)
      if (page) {
        run.body = await page.locator('body').innerText().catch(() => '')
        await page.screenshot({ path: path.join(out, `${id}-FAIL.png`) }).catch(() => {})
      }
      console.error(error)
    } finally { await context.close() }
  }
} finally {
  if (browser) await browser.close()
  if (server) await server.close()
  report.closed = { browser: true, server: true }
  report.pass = report.runs.length === 2 && report.runs.every(run => run.pass)
  await fs.writeFile(path.join(out, 'native-main-result.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ pass: report.pass, closed: report.closed, runs: report.runs.map(({ viewport, pass, error }) => ({ viewport, pass, error })) }))
}
if (!report.pass) process.exitCode = 1
