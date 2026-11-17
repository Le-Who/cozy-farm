import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {createServer} from '../../node_modules/vite/dist/node/index.js'
import * as F from '../../src/farm.ts'
import * as H from '../../src/harbour-economy.ts'
import {reconcileFreightPorts} from '../../src/bay-freight-model.ts'
import {earlyFerryFarm} from '../fixtures/early-ferry.ts'
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),initial=earlyFerryFarm(),key='cozy-farm-island-v7'
reconcileFreightPorts(initial.freight,H.openedFreightPorts(initial));assert.ok(H.sendFerryExpedition(initial,'mill-sale').ok);assert.ok(F.endDay(initial).ok);assert.deepEqual(F.restoreCurrentFarm(structuredClone(initial)),initial)
for(const viewport of[{width:1440,height:900},{width:568,height:320}])test(`earned ferry receipt to deliberate next departure preserves keyboard context at ${viewport.width}×${viewport.height}`,async()=>{
 let server,browser;const out=process.env.FERRY_RESEND_OUTPUT,report={viewport,steps:[],errors:[],external:[]},expected=structuredClone(initial)
 try{
  server=await createServer({root:new URL('../../',import.meta.url).pathname,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}});await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,ignoreDefaultArgs:['--enable-unsafe-swiftshader','--unsafely-disable-devtools-self-xss-warnings']})
  const context=await browser.newContext({viewport});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(report.external.push(r.request().url()),r.abort()))
  await context.addInitScript(({initial,key})=>{localStorage.setItem(key,JSON.stringify(initial));window.__ferry={writes:[],keys:[]};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)window.__ferry.writes.push(v);return set.call(this,k,v)};document.addEventListener('keydown',e=>window.__ferry.keys.push({key:e.key,trusted:e.isTrusted}),true)},{initial,key})
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message))
  const click=async s=>{await page.waitForTimeout(550);await page.locator(s).click();await page.waitForTimeout(150)}
  const press=async key=>{await page.waitForTimeout(550);await page.keyboard.press(key);await page.waitForTimeout(150)}
  const exact=async writes=>{assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),expected);assert.equal(await page.evaluate(()=>window.__ferry.writes.length),writes)}
  const capture=async label=>{const state=await page.evaluate(()=>{const panel=document.querySelector('.bay-freight'),a=document.activeElement,r=a.getBoundingClientRect();let top=0,bottom=innerHeight,left=0,right=innerWidth;for(let e=a.parentElement;e;e=e.parentElement){const style=getComputedStyle(e),b=e.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom)}if(/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,b.left);right=Math.min(right,b.right)}}return{phase:panel?.dataset.expeditionPhase,activeTag:a.tagName,action:a.dataset.action,value:a.dataset.value,activeClass:a.className,activeText:a.textContent.trim().slice(0,180),visible:r.top>=top-1&&r.bottom<=bottom+1&&r.left>=left-1&&r.right<=right+1,departureFocus:!!a.closest('.expedition-departure'),receipt:panel?.querySelector('.expedition-receipt')?.textContent,footer:panel?.querySelector('.expedition-departure')?.textContent,send:panel?.querySelector('[data-action="expedition-send"]')?.dataset.value,scroll:panel?.querySelector('.expedition-card-scroll')?.scrollTop,writes:window.__ferry.writes.length}});report.steps.push({label,...state});if(out){await fs.mkdir(out,{recursive:true});await page.screenshot({path:path.join(out,`${viewport.width}-${label}.png`)})}return state}
  const tabTo=async(selector,key='Tab')=>{for(let i=0;i<20;i++){if(await page.locator(selector).evaluateAll(es=>es.some(e=>e===document.activeElement)))return;await press(key)}assert.fail(`keyboard did not reach ${selector}`)}
  await page.goto(origin,{waitUntil:'networkidle'});await click('.hud-actions [data-panel="guide"]');await click('[data-action="open-panel"][data-value="bay-freight"]');await exact(0)
  await page.locator('[data-action="expedition-claim"]').press('Enter');assert.ok(H.receiveFerryExpedition(expected).ok);await page.waitForTimeout(200);await exact(1);const receipt=await capture('claimed');assert.equal(receipt.activeClass,'expedition-receipt');assert.equal(receipt.visible,true)
  const settled=structuredClone(expected.freight.expeditions.last)
  await tabTo('.expedition-offers > summary','Shift+Tab');await press('Enter');await tabTo('.expedition-offers [data-action="expedition-offer"][data-value="mill-buy"]');const choice=await capture('buy-choice');assert.equal(choice.visible,true);await press('Enter');await exact(1);const picked=await capture('buy-picked');assert.equal(picked.action,'expedition-offer');assert.equal(picked.value,'mill-buy');assert.equal(picked.visible,true)
  await tabTo('[data-action="expedition-send"]');const ready=await capture('send-focused');assert.equal(ready.value,'mill-buy');assert.equal(ready.visible,true);await press('Enter');assert.ok(H.sendFerryExpedition(expected,'mill-buy').ok);await exact(2);const sent=await capture('departed');assert.deepEqual(expected.freight.expeditions.last,settled);assert.equal(sent.phase,'sailing')
  assert.equal(sent.activeClass,'bay-freight-close','preserve the existing safe departure fallback');assert.equal(sent.visible,true)
  // Preserve the existing safe Close fallback; the next home preview remains reachable by Tab without another claim.
  await tabTo('[data-action="expedition-rest"]');const next=await capture('rest-focused');assert.equal(next.visible,true);await exact(2)
  assert.ok(await page.evaluate(()=>window.__ferry.keys.every(e=>e.trusted)));assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);report.pass=true
 }finally{await browser?.close();await server?.close();if(out){await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,`${viewport.width}-result.json`),JSON.stringify(report,null,2))}}
})
