import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from '../../node_modules/vite/dist/node/index.js'
import * as Farm from '../../src/farm.ts'
import * as Harbour from '../../src/harbour-economy.ts'
import * as Neighbors from '../../src/neighbor-visits.ts'

const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const initial=Farm.createFarm(),reducers={...Farm,...Harbour,...Neighbors},key='cozy-farm-island-v7'
// Reuse the earned Orders route immediately before its first real garden delivery.
for(const {name,args}of JSON.parse(await fs.readFile(new URL('../fixtures/market-order-selection-commands.json',import.meta.url),'utf8'))){
 if(name==='deliverMarketOrder')break
 assert.ok(reducers[name](initial,...args).ok,name)
}
const order=Farm.getMarketOrders(initial).find(order=>order.status==='ready');assert.ok(order)
assert.deepEqual(Farm.restoreCurrentFarm(structuredClone(initial)),initial)
const delivered=structuredClone(initial);assert.ok(Farm.deliverMarketOrder(delivered,order.lane).ok)
for(const viewport of [{width:1440,height:900},{width:568,height:320}])test(`delivered order keeps its receipt and next step in keyboard reach at ${viewport.width}×${viewport.height}`,async()=>{
 let server,browser;const errors=[],external=[],report={viewport,lane:order.lane,reward:order.reward},out=process.env.ORDER_DELIVERY_OUTPUT
 try{
  server=await createServer({root:new URL('../../',import.meta.url).pathname,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}});await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,ignoreDefaultArgs:['--enable-unsafe-swiftshader','--unsafely-disable-devtools-self-xss-warnings']})
  const context=await browser.newContext({viewport});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()))
  await context.addInitScript(({initial,key})=>{localStorage.setItem(key,JSON.stringify(initial));window.__delivery={writes:[],keys:[]};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)window.__delivery.writes.push(v);return set.call(this,k,v)};document.addEventListener('keydown',e=>window.__delivery.keys.push({key:e.key,trusted:e.isTrusted}),true)},{initial,key})
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))
  const click=async s=>{await page.waitForTimeout(550);await page.locator(s).click();await page.waitForTimeout(120)}
  const exact=async(expected,writes)=>{assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),expected);assert.equal(await page.evaluate(()=>window.__delivery.writes.length),writes)}
  const capture=async label=>{const state=await page.evaluate(()=>{const content=document.querySelector('.dialog-content'),detail=document.querySelector('.market-order-detail'),selected=document.querySelector('.market-order-choice[aria-pressed="true"]'),done=detail.querySelector('.order-done'),next=detail.querySelector('[data-action="market-next-rest"]'),visible=el=>{if(!el)return false;const r=el.getBoundingClientRect(),c=content.getBoundingClientRect();return r.top>=c.top-1&&r.bottom<=c.bottom+1&&r.top>=0&&r.bottom<=innerHeight};return{focused:document.activeElement===detail,active:document.activeElement.outerHTML.slice(0,160),selected:selected.dataset.value,group:selected.closest('[data-order-group]').dataset.orderGroup,status:detail.querySelector('.market-order').dataset.status,receiptVisible:visible(done),nextVisible:visible(next),horizontal:content.scrollWidth>content.clientWidth+1,writes:window.__delivery.writes.length,day:JSON.parse(localStorage.getItem('cozy-farm-island-v7')).day}});report[label]=state;if(out){await fs.mkdir(out,{recursive:true});await page.screenshot({path:path.join(out,`${viewport.width}-${label}.png`)})}return state}
  await page.goto(origin,{waitUntil:'networkidle'});await click('.hud-button[data-panel="market"]');await click('[data-action="market-tab"][data-value="orders"]');await click(`[data-action="market-order-select"][data-value="${order.lane}"]`);await exact(initial,0);await capture('before')
  await page.waitForTimeout(550);await page.locator(`[data-action="deliver-order"][data-value="${order.lane}"]`).press('Enter');await page.waitForTimeout(200);const after=await capture('after');await exact(delivered,1)
  assert.equal(after.selected,order.lane);assert.equal(after.group,'delivered');assert.equal(after.status,'delivered');assert.equal(after.horizontal,false)
  assert.equal(after.focused,true,'delivery redraw must keep keyboard focus on the delivered receipt instead of jumping to Close');assert.equal(after.receiptVisible,true);assert.equal(after.nextVisible,true)
  // Focus stays on the non-action receipt: another Enter must not deliver twice or silently rest.
  await page.keyboard.press('Enter');await page.waitForTimeout(200);await exact(delivered,1)
  await page.keyboard.press('Tab');assert.equal(await page.locator('.market-return summary').evaluate(el=>document.activeElement===el),true)
  await page.keyboard.press('Tab');assert.equal(await page.locator('[data-action="market-next-rest"]').evaluate(el=>document.activeElement===el),true)
  assert.ok(await page.evaluate(()=>window.__delivery.keys.every(e=>e.trusted)));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);report.pass=true
 }finally{await browser?.close();await server?.close();if(out){await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,`${viewport.width}-result.json`),JSON.stringify(report,null,2))}}
})
