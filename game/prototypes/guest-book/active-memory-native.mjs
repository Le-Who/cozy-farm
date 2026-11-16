// Real DEV main, trusted inputs. Only the initial save is a deterministic fixture.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { createServer } from '../../node_modules/vite/dist/node/index.js'
import { createEarnedFixture } from './qa/fixture.mjs'
import * as F from '../../src/farm.ts'
import * as V from '../../src/neighbor-visits.ts'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const out = path.resolve(process.env.GUEST_BOOK_QA_OUTPUT ?? 'active-memory-evidence')
const initial = createEarnedFixture().farm
// Synthetic precondition via domain callbacks: not a claim of browser progression.
for (const activity of ['beaHarvest', 'beaHands', 'beaFlock']) {
  assert.ok(V.inviteNeighborVisit(initial, activity).ok)
  V.noteNeighborVisit(initial, V.visitActivities[activity].kind, activity === 'beaFlock' ? 'Искорка' : activity === 'beaHands' ? 'Домашняя булочка' : 'Морковь', 'Первое воспоминание: урожай и выпечка остаются на вашей ферме.')
  assert.ok(V.finishNeighborVisit(initial, initial.neighborVisits.serial, 'quiet').ok)
}
assert.ok(V.inviteNeighborVisit(initial, 'beaFlock').ok)
assert.deepEqual(F.restoreCurrentFarm(structuredClone(initial)), initial)
const candidate = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: new URL('../../', import.meta.url), encoding: 'utf8' }).trim()
const report = { candidate, invitationParent: 'd9cd81c796b2d530292f3cab62528cdfc89beb16', baseline: '053660bd90e0c1da4fcfc4f398f5ef0b83188269', provenance: 'Real main.ts DEV opt-in. Initial save: earned-home + domain callback memories and pending repeat hen visit; not native progression. All subsequent inputs trusted.', runs: [] }
const key = 'cozy-farm-island-v7'
let server, browser
await fs.mkdir(out, { recursive: true })
try {
  server = await createServer({ root: new URL('../../', import.meta.url).pathname, configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } })
  await server.listen(); const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, chromiumSandbox: true, ignoreDefaultArgs: ['--enable-unsafe-swiftshader', '--unsafely-disable-devtools-self-xss-warnings'] })
  for (const viewport of [{ width: 568, height: 320 }, { width: 360, height: 640 }, { width: 1280, height: 800 }].filter(v => !process.env.GUEST_BOOK_QA_WIDTH || v.width === Number(process.env.GUEST_BOOK_QA_WIDTH))) {
    const context = await browser.newContext({ viewport }), run = { viewport, checks: [], errors: [], external: [], geometry: [] }; report.runs.push(run)
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : (run.external.push(route.request().url()), route.abort()))
    await context.addInitScript(({ initial, key }) => {
      localStorage.setItem(key, JSON.stringify(initial)); window.__layoutQA = { writes: [], events: [] }
      const set = Storage.prototype.setItem
      Storage.prototype.setItem = function(k, value) { if (k === key) window.__layoutQA.writes.push(value); return set.call(this, k, value) }
      for (const type of ['click', 'keydown', 'keyup', 'wheel']) document.addEventListener(type, event => window.__layoutQA.events.push({ type, trusted: event.isTrusted, key: event.key, action: event.target?.dataset?.action }), true)
    }, { initial, key })
    const page = await context.newPage(); page.on('pageerror', error => run.errors.push(error.message)); page.setDefaultTimeout(30000)
    const click = async selector => { await page.waitForTimeout(560); await page.locator(selector).click(); await page.waitForTimeout(150) }
    const surface = '[data-guest-surface]'
    const measure = async (label, controls = []) => {
      const geometry = await page.evaluate(({ controls, label }) => {
        const rect = el => { const r = el.getBoundingClientRect(); return { left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height } }
        const visible = el => { let r = rect(el), clip = { left:0,top:0,right:innerWidth,bottom:innerHeight }; for(let p = el.parentElement;p;p=p.parentElement) { const cs=getComputedStyle(p); if(/auto|scroll|hidden|clip/.test(cs.overflowX+' '+cs.overflowY)) { const c=rect(p); clip={left:Math.max(clip.left,c.left),top:Math.max(clip.top,c.top),right:Math.min(clip.right,c.right),bottom:Math.min(clip.bottom,c.bottom)} } } return { rect:r,clip,visible:r.left>=clip.left-1&&r.top>=clip.top-1&&r.right<=clip.right+1&&r.bottom<=clip.bottom+1 } }
        return { label, content:rect(document.querySelector('.dialog-content')), overflow:document.querySelector('.dialog-content').scrollWidth>document.querySelector('.dialog-content').clientWidth+1, controls:controls.map(s=>({selector:s,...visible(document.querySelector(s))})), focus: document.activeElement?.outerHTML.slice(0,250) }
      }, {controls,label})
      run.geometry.push(geometry)
      console.log(`${viewport.width}x${viewport.height}: ${label}`)
      assert.equal(geometry.overflow, false, label+' horizontal overflow')
      for(const c of geometry.controls) { assert.ok(c.rect.height>=44, label+' 44px '+c.selector); assert.ok(c.visible,label+' clipped '+c.selector) }
      await page.screenshot({ path:path.join(out,`${viewport.width}x${viewport.height}-${label}.png`) })
    }
    try {
      await page.goto(origin+'/?guestBookButtons=1',{waitUntil:'networkidle'})
      await page.getByRole('button',{name:'Открыть бухту',exact:true}).click(); await click('[data-action="open-panel"][data-value="rest"]')
      if(await page.locator('.home-rest-services summary').count() && await page.locator('.home-rest-services').getAttribute('open')===null) await click('.home-rest-services summary')
      await click('[data-action="open-panel"][data-value="neighbor-visits"]'); await page.locator(surface).waitFor()
      await measure('pending-hens', ['[data-command-key="hen-0"]','[data-command-key="hen-3"]','[data-command-key="close"]','[data-command-key="finish"]','[data-guest-choice="page"][data-value="memories"]'])
      assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key), initial)
      assert.equal(await page.evaluate(()=>window.__layoutQA.writes.length),0)
      await page.locator('[data-command-key="hen-0"]').focus(); await page.keyboard.press('Enter')
      await page.waitForFunction(()=>window.__layoutQA.writes.length===1)
      const expected=structuredClone(initial); assert.ok(F.introduceHenToVisitor(expected,0).ok)
      assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),expected)
      assert.equal(await page.locator('[data-command-key="quiet"]').evaluate(el=>document.activeElement===el),true)
      await measure('observed-repeat',['[data-command-key="quiet"]','[data-command-key="curious"]','[data-command-key="close"]','[data-command-key="finish"]'])
      await click('[data-guest-choice="page"][data-value="memories"]')
      assert.equal(await page.locator('[data-focus="memories"]').evaluate(el=>document.activeElement===el),true)
      const heading=await page.locator('[data-focus="memories"]').boundingBox(),clip=await page.locator('.dialog-content').boundingBox()
      assert.ok(heading.y>=clip.y-1 && heading.y+heading.height<=clip.y+clip.height+1,'explicit Memories heading visible')
      await measure('memories', ['[data-guest-choice="memory"][data-value="beaHarvest"]','[data-guest-choice="memory"][data-value="beaFlock"]','[data-guest-back]'])
      const detailBox=await page.locator('[data-memory-detail]').boundingBox()
      await page.mouse.move(detailBox.x+detailBox.width/2,detailBox.y+detailBox.height/2);await page.mouse.wheel(0,300);await page.waitForTimeout(200)
      await click('[data-guest-choice="memory"][data-value="beaFlock"]')
      assert.equal(await page.locator('[data-memory-detail]').evaluate(el=>el.scrollTop),0,'new selected memory starts at its beginning')
      await page.evaluate(()=>{window.__preserved={ node:document.activeElement, scroll:document.querySelector('.dialog-content').scrollTop, detail:document.querySelector('[data-memory-detail]').scrollTop }})
      await page.waitForTimeout(1600)
      assert.deepEqual(await page.evaluate(()=>[document.activeElement===window.__preserved.node,document.querySelector('.dialog-content').scrollTop===window.__preserved.scroll,document.querySelector('[data-memory-detail]').scrollTop===window.__preserved.detail]),[true,true,true])
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('[data-guest-choice="page"][data-value="memories"]').evaluate(el=>document.activeElement===el),true)
      await measure('back-to-active',['[data-command-key="quiet"]','[data-guest-choice="page"][data-value="memories"]'])
      assert.equal(await page.evaluate(()=>window.__layoutQA.writes.length),1)
      assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),expected)
      const events=await page.evaluate(()=>window.__layoutQA.events);assert.ok(events.every(e=>e.trusted));run.events=events
      run.checks.push('44px visible active commands and navigation','trusted hen action exactly one expected full save','explicit hidden-command focus visible','memory heading visible after navigation','memory selection + focus + scroll preserved over passive redraw','Escape returns source focus without save','original memory untouched by repeat observation')
      assert.deepEqual(run.errors,[]);assert.deepEqual(run.external,[])
    } finally { await context.close() }
  }
  report.pass=true
} catch(error) { report.pass=false;report.error=String(error.stack??error);throw error }
finally { await fs.writeFile(path.join(out,'native-result.json'),JSON.stringify(report,null,2));await browser?.close();await server?.close() }
console.log(JSON.stringify({pass:report.pass,runs:report.runs.map(r=>({viewport:r.viewport,checks:r.checks}))},null,2))
