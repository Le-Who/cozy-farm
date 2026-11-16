// Short real-page gate check: default dev and query-bearing production stay legacy.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createServer, preview } from '../../node_modules/vite/dist/node/index.js'
import { createEarnedFixture } from './qa/fixture.mjs'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const root = new URL('../../', import.meta.url).pathname, fixture = createEarnedFixture(), key = 'cozy-farm-island-v7'
const out = path.resolve(process.env.GUEST_BOOK_QA_OUTPUT ?? 'guest-book-dev-main-gates')
await fs.mkdir(out, { recursive: true })
const report = { cases: [], productionSurfacePayload: [] }
for (const file of await fs.readdir(path.join(root, 'dist/assets'))) {
  if (!file.endsWith('.js')) continue
  const source = await fs.readFile(path.join(root, 'dist/assets', file), 'utf8')
  for (const marker of ['data-guest-surface', 'data-command-key', 'кнопочный прототип', 'guest-book-button-surface']) if (source.includes(marker)) report.productionSurfacePayload.push({ file, marker })
}
assert.deepEqual(report.productionSurfacePayload, [])
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? undefined, headless: true, chromiumSandbox: true, ignoreDefaultArgs: ['--enable-unsafe-swiftshader', '--unsafely-disable-devtools-self-xss-warnings'], args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  for (const mode of ['dev-default', 'dev-opt-in', 'production-with-query']) {
    let server, context
    const run = { mode, errors: [], external: [] }; report.cases.push(run)
    try {
      if (mode.startsWith('dev')) { server = await createServer({ root, configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } }); await server.listen() }
      else server = await preview({ root, configFile: false, logLevel: 'error', preview: { host: '127.0.0.1', port: 0 } })
      const origin = `http://127.0.0.1:${server.httpServer.address().port}`
      context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
      await context.route('**/*', route => { if (new URL(route.request().url()).origin !== origin) { run.external.push(route.request().url()); return route.abort() } return route.continue() })
      await context.addInitScript(({ farm, key }) => {
        localStorage.setItem(key, JSON.stringify(farm)); window.__writes = []
        const set = Storage.prototype.setItem
        Storage.prototype.setItem = function(k, v) { if (k === key) window.__writes.push(v); return set.call(this, k, v) }
      }, { farm: fixture.farm, key })
      const page = await context.newPage(); page.on('pageerror', error => run.errors.push(error.message))
      await page.goto(origin + (mode === 'dev-default' ? '' : '?guestBookButtons=1'), { waitUntil: 'networkidle' })
      const click = async selector => { await page.waitForTimeout(560); await page.locator(selector).click(); await page.waitForTimeout(180) }
      await page.getByRole('button', { name: 'Открыть бухту', exact: true }).click()
      await click('[data-action="open-panel"][data-value="rest"]')
      await click('.home-rest-services summary'); await click('[data-action="open-panel"][data-value="neighbor-visits"]')
      run.surface = await page.locator('[data-guest-surface]').count()
      run.invitations = await page.locator('[data-action="visit-invite"]:visible').count()
      run.writes = await page.evaluate(() => window.__writes.length)
      assert.equal(run.surface, mode === 'dev-opt-in' ? 1 : 0)
      assert.equal(run.invitations, mode === 'dev-opt-in' ? 1 : 6)
      assert.equal(run.writes, 0)
      assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key), fixture.farm)
      assert.deepEqual(run.errors, []); assert.deepEqual(run.external, [])
      run.pass = true
    } finally { await context?.close(); if (server?.close) await server.close(); else if (server) await new Promise(resolve => server.httpServer.close(resolve)) }
  }
  report.pass = true
} catch (error) { report.error = String(error.stack ?? error); report.pass = false; throw error }
finally { await browser?.close(); await fs.writeFile(path.join(out, 'main-gates-result.json'), JSON.stringify(report, null, 2)) }
console.log(JSON.stringify(report, null, 2))
