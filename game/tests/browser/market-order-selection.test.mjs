import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from '../../node_modules/vite/dist/node/index.js'
import * as Farm from '../../src/farm.ts'
import * as Harbour from '../../src/harbour-economy.ts'
import * as Neighbors from '../../src/neighbor-visits.ts'
import { getMarketOrderBoard } from '../../src/market-orders-view.ts'

// Optional native seam: run with the already installed browser/module paths. No real save or remote requests.
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const initial = Farm.createFarm(), reducers = { ...Farm, ...Harbour, ...Neighbors }
for (const { name, args } of JSON.parse(await fs.readFile(new URL('../fixtures/market-order-selection-commands.json', import.meta.url), 'utf8'))) {
  assert.ok(reducers[name](initial, ...args).ok, name)
}
assert.deepEqual(Farm.restoreCurrentFarm(structuredClone(initial)), initial)
const key = 'cozy-farm-island-v7', board = getMarketOrderBoard(initial)

for (const viewport of [{ width:1440, height:900 }, { width:360, height:640 }, { width:568, height:320 }]) {
  test(`order selection keeps the player's place in its picker at ${viewport.width}×${viewport.height}`, async () => {
    let server, browser
    const errors = [], external = [], report = { viewport, selections: [] }
    try {
      server = await createServer({ root:new URL('../../', import.meta.url).pathname, configFile:false, logLevel:'error', server:{ host:'127.0.0.1', port:0, hmr:false } })
      await server.listen()
      const origin = `http://127.0.0.1:${server.httpServer.address().port}`
      browser = await chromium.launch({ executablePath:process.env.CHROMIUM_PATH, headless:true, chromiumSandbox:true,
        ignoreDefaultArgs:['--enable-unsafe-swiftshader', '--unsafely-disable-devtools-self-xss-warnings'] })
      const context = await browser.newContext({ viewport })
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : (external.push(route.request().url()), route.abort()))
      await context.addInitScript(({ initial, key }) => {
        localStorage.setItem(key, JSON.stringify(initial))
        window.__ordersSelection = { writes:[], gestures:[] }
        const set = Storage.prototype.setItem
        Storage.prototype.setItem = function (k, v) { if (k === key) window.__ordersSelection.writes.push(v); return set.call(this, k, v) }
        document.addEventListener('pointerdown', event => {
          const choice = event.target.closest?.('[data-action="market-order-select"]')
          if (choice) window.__ordersSelection.gestures.push({ id:choice.dataset.value, trusted:event.isTrusted,
            pickerScroll:document.querySelector('.market-order-picker').scrollTop })
        }, true)
      }, { initial, key })
      const page = await context.newPage()
      page.setDefaultTimeout(15000)
      page.on('pageerror', error => errors.push(error.message))
      const click = async selector => { await page.waitForTimeout(550); await page.locator(selector).click(); await page.waitForTimeout(120) }
      await page.goto(origin, { waitUntil:'networkidle' })
      await click('.hud-button[data-panel="market"]')
      await click('[data-action="market-tab"][data-value="orders"]')
      assert.deepEqual(await page.locator('.market-order-choice').evaluateAll(elements => elements.map(element => element.dataset.value)), board.choices.map(choice => choice.id))
      for (const id of [board.choices.at(-1).id, board.choices[0].id]) {
        await click(`[data-action="market-order-select"][data-value="${id}"]`)
        const state = await page.evaluate(() => {
          const picker = document.querySelector('.market-order-picker'), selected = picker.querySelector('[aria-pressed="true"]')
          const p = picker.getBoundingClientRect(), s = selected.getBoundingClientRect(), content = document.querySelector('.dialog-content')
          return { gesture:window.__ordersSelection.gestures.at(-1), selected:selected.dataset.value,
            pickerScroll:picker.scrollTop, selectedInsidePicker:s.top >= p.top - 1 && s.bottom <= p.bottom + 1,
            detailFocused:document.activeElement === document.querySelector('.market-order-detail'),
            horizontal:content.scrollWidth > content.clientWidth + 1 }
        })
        report.selections.push(state)
        assert.equal(state.gesture.trusted, true)
        assert.equal(state.selected, id)
        assert.equal(state.detailFocused, true)
        assert.equal(state.horizontal, false)
        if (id === board.choices.at(-1).id && viewport.width !== 568) assert.ok(state.gesture.pickerScroll > 0, 'fixture exercises a genuinely scrolled picker')
        assert.equal(state.pickerScroll, state.gesture.pickerScroll, 'selection must retain the nested picker position instead of hiding the selected order')
        assert.equal(state.selectedInsidePicker, true)
        if (process.env.ORDERS_SELECTION_OUTPUT) {
          const out = path.resolve(process.env.ORDERS_SELECTION_OUTPUT)
          await fs.mkdir(out, { recursive:true })
          await page.screenshot({ path:path.join(out, `${viewport.width}-${id}.png`) })
        }
      }
      assert.equal(await page.evaluate(() => window.__ordersSelection.writes.length), 0)
      assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key), initial)
      assert.deepEqual(errors, [])
      assert.deepEqual(external, [])
      report.pass = true
    } finally {
      await browser?.close()
      await server?.close()
      if (process.env.ORDERS_SELECTION_OUTPUT) {
        const out = path.resolve(process.env.ORDERS_SELECTION_OUTPUT)
        await fs.mkdir(out, { recursive:true })
        await fs.writeFile(path.join(out, `${viewport.width}-result.json`), JSON.stringify(report, null, 2))
      }
    }
  })
}
