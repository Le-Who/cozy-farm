import test from 'node:test'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import fs from 'node:fs/promises'
import path from 'node:path'
import {createServer} from '../../node_modules/vite/dist/node/index.js'
import {earlyFerryFarm} from '../fixtures/early-ferry.ts'
import {restoreCurrentFarm} from '../../src/farm.ts'
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const initial=earlyFerryFarm(),key='cozy-farm-island-v7',out=process.env.INVENTORY_FOCUS_OUTPUT,report={fixture:'earlyFerryFarm public actions; no save changes',runs:[]}
test('inventory group round trip keeps the actual keyboard seed focus visible without writes', async () => {
assert.deepEqual(restoreCurrentFarm(structuredClone(initial)),initial);if(out)await fs.mkdir(out,{recursive:true});let server,browser
try {
 server=await createServer({root:new URL('../../',import.meta.url).pathname,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}});await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,ignoreDefaultArgs:['--enable-unsafe-swiftshader','--unsafely-disable-devtools-self-xss-warnings'],timeout:20000})
 for(const viewport of [{width:1440,height:900},{width:568,height:320}].filter(viewport=>!process.env.INVENTORY_FOCUS_COMPACT_ONLY||viewport.width===568)) {
  const run={viewport,steps:[],errors:[],external:[]};report.runs.push(run);const context=await browser.newContext({viewport})
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(run.external.push(r.request().url()),r.abort()))
  await context.addInitScript(({initial,key})=>{localStorage.setItem(key,JSON.stringify(initial));window.__audit={writes:0,untrustedKeys:0};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)window.__audit.writes++;return set.call(this,k,v)};document.addEventListener('keydown',e=>{if(!e.isTrusted)window.__audit.untrustedKeys++},true)},{initial,key})
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>run.errors.push(e.message))
  const press=async key=>{await page.waitForTimeout(520);await page.keyboard.press(key);await page.waitForTimeout(100)}
  const tabTo=async(selector,direction='Tab')=>{for(let i=0;i<30;i++){if(await page.locator(selector).evaluateAll(es=>es.some(e=>e===document.activeElement)))return;await page.keyboard.press(direction);await page.waitForTimeout(40)}assert.fail(`Tab did not reach ${selector}`)}
  const capture=async label=>{
   assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),initial)
   const state=await page.evaluate(()=>{const a=document.activeElement,c=document.querySelector('.dialog-content'),h=document.querySelector('.seed-picker-current'),r=a.getBoundingClientRect(),v=c.getBoundingClientRect(),b=h?.getBoundingClientRect();const rect=x=>x&&({top:x.top,bottom:x.bottom,left:x.left,right:x.right,height:x.height});const visibleTop=Math.max(v.top,b&&a.matches('.seed-picker-tile')?b.bottom:v.top);return{panel:document.querySelector('.farm-dialog').dataset.panel,active:{tag:a.tagName,action:a.dataset.action,value:a.dataset.value,text:a.textContent.trim().slice(0,80),connected:a.isConnected,rect:rect(r)},clip:rect(v),sticky:rect(b),scrollTop:c.scrollTop,selected:document.querySelector('.seed-picker-tile[aria-pressed="true"]')?.dataset.value,group:document.querySelector('[data-action="inventory-group"][aria-pressed="true"]')?.dataset.value,fullyVisible:r.top>=visibleTop-1&&r.bottom<=Math.min(v.bottom,innerHeight)+1&&r.left>=0&&r.right<=innerWidth,horizontal:c.scrollWidth>c.clientWidth+1,writes:window.__audit.writes,untrustedKeys:window.__audit.untrustedKeys}})
   run.steps.push({label,...state});if(out)await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));assert.equal(state.writes,0);assert.equal(state.untrustedKeys,0);assert.equal(state.active.connected,true);assert.equal(state.horizontal,false);assert.ok(state.fullyVisible,`${viewport.width} ${label}: active ${state.active.value} fully visible`);return state
  }
  await page.goto(origin,{waitUntil:'networkidle',timeout:30000});await page.locator('[data-panel="inventory"]').click();await tabTo('[data-action="bag-tab"][data-value="seeds"]');await press('Enter');await page.locator('.seed-picker').waitFor();await tabTo('[data-action="preview-seed"][data-value="raspberry"]');await capture('raspberry-keyboard-before');await press('Enter');const preview=await capture('raspberry-preview');assert.equal(preview.selected,'raspberry');assert.equal(preview.active.value,'raspberry')
  await tabTo('[data-action="bag-tab"][data-value="harvest"]','Shift+Tab');await press('Enter');await capture('supplies-entry');await tabTo('[data-action="inventory-group"][data-value="harvest"]');await press('ArrowRight');const kitchen=await capture('kitchen-group');assert.equal(kitchen.group,'kitchen');assert.equal(kitchen.active.value,'kitchen');await press('ArrowRight');const shore=await capture('shore-group');assert.equal(shore.group,'shore');await press('Home');const farm=await capture('farm-group');assert.equal(farm.group,'harvest')
  await tabTo('[data-action="bag-tab"][data-value="seeds"]','Shift+Tab');await press('Enter');const back=await capture('seeds-return');assert.equal(back.selected,'raspberry');assert.equal(back.active.value,'seeds');await tabTo('[data-action="preview-seed"][data-value="raspberry"]');const focused=await capture('raspberry-restored-focus');assert.equal(focused.active.value,'raspberry');if(out)await page.screenshot({path:path.join(out,`${viewport.width}-raspberry-focus.png`)});await press('Enter');const again=await capture('raspberry-preview-again');assert.equal(again.selected,'raspberry')
  await tabTo('[data-action="bag-tab"][data-value="harvest"]','Shift+Tab');await press('Enter');await tabTo('[data-action="inventory-group"][data-value="harvest"]');await press('End');await capture('shore-selected');await tabTo('[data-action="bag-tab"][data-value="seeds"]','Shift+Tab');await press('Enter');await tabTo('[data-action="bag-tab"][data-value="harvest"]');await press('Enter');const retained=await capture('shore-retained');assert.equal(retained.group,'shore')
  assert.deepEqual(run.errors,[]);assert.deepEqual(run.external,[]);run.pass=run.steps.every(s=>s.fullyVisible);console.log(JSON.stringify({viewport,pass:run.pass,clipped:run.steps.filter(s=>!s.fullyVisible).map(s=>({label:s.label,active:s.active,clip:s.clip,sticky:s.sticky,scrollTop:s.scrollTop}))}));await context.close()
 }
 report.pass=report.runs.every(r=>r.pass)
} catch(error) {report.error=String(error.stack??error);report.pass=false;throw error} finally {await browser?.close();await server?.close();report.resourcesClosed=true;if(out)await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,resourcesClosed:true,runs:report.runs.length,error:report.error}))}

})
