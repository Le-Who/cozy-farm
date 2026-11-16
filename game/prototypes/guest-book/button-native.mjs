// Narrow native proof of the opt-in surface, not a production route/layout test.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from '../../node_modules/vite/dist/node/index.js'
const { createEarnedFixture } = await import(process.env.GUEST_BOOK_EARNED_FIXTURE ?? './qa/fixture.mjs')
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? '/workspace/scratch/30c16872133b/repo/node_modules/playwright/index.mjs').href)
const fixture = createEarnedFixture(), out = path.resolve(process.env.GUEST_BOOK_QA_OUTPUT ?? 'guest-book-button-evidence')
const report = { source: '6df90d1 + opt-in button surface', fixture: '119 public reducer commands, not native progression',
  excludes: ['No production main.ts integration', 'No approved visual layout or pixel-fit claim', 'No native touch/assistive-tech claim', 'Snapshot/restore is the surface API, not a production panel-history route'], runs: [] }
const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Гостевая книга: проверка кнопок</title><body><button id="outside">Вне книги</button><main id="app"><section id="book"></section></main><script type="module">
import * as F from '/src/farm.ts';
import * as V from '/src/neighbor-visits.ts';
import { installActionClickGuard } from '/src/action-click-guard.ts';
import { GuestBookButtonSurface } from '/src/guest-book-button-surface.ts';
const farm = F.restoreCurrentFarm(window.__initialFarm), root = document.querySelector('#book'), app = document.querySelector('#app');
const state = { open: true, accepted: 0, legacy: 0, parentBack: 0 };
installActionClickGuard(app, { guestBookButtons: true });
let book;
book = new GuestBookButtonSurface({ enabled: true, root, farm: () => farm, active: () => state.open, dispatch(command) {
  if (!state.open) return;
  if (command.action === 'close') { state.open = false; return; }
  let result;
  if (command.action === 'visit-invite') result = V.inviteNeighborVisit(farm, command.value);
  if (command.action === 'visit-introduce-hen') { const [serial, hen] = command.value.split(':').map(Number); if (farm.neighborVisits.active?.serial === serial) result = F.introduceHenToVisitor(farm, hen); }
  if (command.action === 'visit-reply' || command.action === 'visit-finish') { const [serial, reply] = command.value.split(':'); result = V.finishNeighborVisit(farm, Number(serial), reply); }
  if (result?.ok) { state.accepted++; book.render(); }
}});
app.addEventListener('click', event => { if (!book.click(event)) state.legacy++; });
root.addEventListener('keydown', event => { if (event.key !== 'Escape' && !(event.altKey && event.key === 'ArrowLeft')) return; if (event.defaultPrevented || book.back(event)) return; state.parentBack++; event.preventDefault(); });
window.__bookQA = { farm, book, state, root, nodes: [...root.querySelectorAll('*')] };
</script></body></html>`
await fs.mkdir(out, { recursive: true })
let server, browser
try {
  server = await createServer({ root: new URL('../../', import.meta.url).pathname, configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false },
    plugins: [{ name: 'guest-book-opt-in-test-route', configureServer(s) { s.middlewares.use('/__guest-book-buttons', (_req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); }); } }] })
  await server.listen()
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ headless: true, chromiumSandbox: true,
    executablePath: process.env.CHROMIUM_PATH ?? '/workspace/scratch/30c16872133b/wave-20261115-integration/chrome/chrome-headless-shell-linux64/chrome-headless-shell',
    ignoreDefaultArgs: ['--enable-unsafe-swiftshader', '--unsafely-disable-devtools-self-xss-warnings'] })
  for (const viewport of [{ width: 568, height: 320 }, { width: 390, height: 700 }, { width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport }), run = { viewport, checks: [], external: [], errors: [] }
    report.runs.push(run)
    await context.route('**/*', route => { if (new URL(route.request().url()).origin !== origin) { run.external.push(route.request().url()); return route.abort(); } return route.continue(); })
    await context.addInitScript(farm => {
      window.__initialFarm = farm; window.__native = { storage: [], events: [] }
      const set = Storage.prototype.setItem
      Storage.prototype.setItem = function(key, value) { window.__native.storage.push(key); return set.call(this, key, value) }
      for (const type of ['click', 'keydown', 'keyup']) document.addEventListener(type, event => window.__native.events.push({ type, trusted: event.isTrusted, key: event.key, repeat: event.repeat, action: event.target?.dataset?.action }), true)
    }, fixture.farm)
    const page = await context.newPage(); page.on('pageerror', error => run.errors.push(error.message))
    try {
      await page.goto(origin + '/__guest-book-buttons'); await page.waitForFunction(() => !!window.__bookQA)
      const choice = (part, value) => page.locator(`[data-guest-choice="${part}"][data-value="${value}"]`)
      const invite = page.locator('[data-guest-command="visit-invite"]')
      const click = async locator => { await locator.click(); await page.waitForTimeout(550) }
      await click(choice('resident', 'finn')); await click(choice('activity', 'finnOrchard'))
      assert.equal(await invite.isDisabled(), true)
      assert.match(await page.locator('[data-text="gate"]').textContent(), /общую встречу/)
      await page.evaluate(() => { window.__saved = window.__bookQA.book.snapshot() })
      await click(choice('page', 'rules')); assert.equal(await page.locator('[data-focus="rules"]').evaluate(e => e === document.activeElement), true)
      await page.keyboard.press('Escape')
      assert.equal(await choice('page', 'rules').evaluate(e => e === document.activeElement), true)
      await page.evaluate(() => {
        const q = window.__bookQA; window.__before = JSON.stringify(q.farm)
        document.querySelector('#outside').focus(); q.root.scrollTop = 50
        window.__scroll = [scrollX, scrollY, q.root.scrollTop]
        for (let i = 0; i < 10; i++) q.book.render()
      })
      assert.deepEqual(await page.evaluate(() => [document.activeElement.id, JSON.stringify(window.__bookQA.farm) === window.__before, window.__native.storage.length]), ['outside', true, 0])
      assert.deepEqual(await page.evaluate(() => [scrollX, scrollY, window.__bookQA.root.scrollTop]), await page.evaluate(() => window.__scroll))
      await click(choice('resident', 'bea')); await click(choice('activity', 'beaFlock'))
      await page.evaluate(() => window.__bookQA.book.restore(window.__saved, { part: 'activity', value: 'finnOrchard' }))
      assert.equal(await choice('activity', 'finnOrchard').evaluate(e => e === document.activeElement), true)
      assert.equal(await invite.isDisabled(), true)
      run.checks.push('locked Finn/eligible Bea distinguished', 'nested Escape/focus ownership', 'passive redraw has zero storage/farm/focus/scroll changes', 'snapshot restore preserves exact Finn orchard choice')
      await click(choice('resident', 'bea'))
      await choice('activity', 'beaFlock').focus(); await page.keyboard.down('Enter')
      assert.equal(await invite.getAttribute('data-value'), 'beaFlock')
      await invite.focus(); await page.keyboard.down('Enter')
      assert.equal(await page.evaluate(() => window.__bookQA.state.accepted), 0)
      await page.keyboard.up('Enter'); await page.keyboard.press('Enter')
      assert.equal(await page.evaluate(() => window.__bookQA.state.accepted), 1)
      assert.equal(await page.evaluate(() => window.__bookQA.farm.neighborVisits.active.activity), 'beaFlock')
      await click(page.locator('[data-command-key="hen-0"]'))
      assert.equal(await page.evaluate(() => window.__bookQA.state.accepted), 2)
      await click(page.locator('[data-command-key="quiet"]'))
      assert.equal(await page.evaluate(() => window.__bookQA.state.accepted), 3)
      assert.deepEqual(await page.evaluate(() => [window.__bookQA.farm.neighborVisits.serial, window.__bookQA.farm.neighborVisits.active, window.__bookQA.farm.neighborVisits.memories[0].reply]), [1, null, 'quiet'])
      const proof = await page.evaluate(() => ({ identities: [...window.__bookQA.root.querySelectorAll('*')].every((node, i) => node === window.__bookQA.nodes[i]), storage: window.__native.storage.length, events: window.__native.events, legacy: window.__bookQA.state.legacy }))
      assert.equal(proof.identities, true); assert.equal(proof.storage, 0); assert.equal(proof.legacy, 0)
      assert.ok(proof.events.every(event => event.trusted)); assert.ok(proof.events.some(event => event.repeat))
      run.checks.push('real held Enter cannot invite until keyup', 'one exact invite then hen observation then quiet reply', 'all control node identities retained', 'all recorded input events trusted')
      run.events = proof.events; run.acceptedDomainActions = 3; run.storageWrites = proof.storage
      await page.screenshot({ path: path.join(out, `${viewport.width}x${viewport.height}-unstyled-not-approved.png`), fullPage: true })
      assert.deepEqual(run.errors, []); assert.deepEqual(run.external, [])
    } finally { await context.close() }
  }
  report.pass = true
} catch (error) { report.pass = false; report.error = String(error.stack ?? error); throw error }
finally { await fs.writeFile(path.join(out, 'native-result.json'), JSON.stringify(report, null, 2)); await browser?.close(); await server?.close() }
console.log(JSON.stringify({ pass: report.pass, runs: report.runs.map(({ viewport, checks, acceptedDomainActions, storageWrites }) => ({ viewport, checks, acceptedDomainActions, storageWrites })), exclusions: report.excludes }, null, 2))
