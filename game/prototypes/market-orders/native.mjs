import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from '../../node_modules/vite/dist/node/index.js'
import * as F from '../../src/farm.ts'
import * as H from '../../src/harbour-economy.ts'
import * as V from '../../src/neighbor-visits.ts'
import { getMarketOrderBoard } from '../../src/market-orders-view.ts'
const { chromium }=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const initial=F.createFarm(),reducers={...F,...H,...V}
for(const {name,args} of JSON.parse(await fs.readFile(new URL('./earned-home-commands.json',import.meta.url),'utf8')))assert.ok(reducers[name](initial,...args).ok,name)
assert.deepEqual(F.restoreCurrentFarm(structuredClone(initial)),initial)
const out=path.resolve(process.env.ORDERS_QA_OUTPUT??'orders-entry-evidence'),key='cozy-farm-island-v7',baseline=!!process.env.ORDERS_QA_BASELINE
const report={baseline:'753cdb37ab3baf70b3f5312aaf85e4363e6d5ce9',fixture:'119 public reducers earn home+village fixture; initial fixture is not native progression',runs:[]}
let server,browser;await fs.mkdir(out,{recursive:true})
try{
 server=await createServer({root:new URL('../../',import.meta.url).pathname,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}});await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,ignoreDefaultArgs:['--enable-unsafe-swiftshader','--unsafely-disable-devtools-self-xss-warnings']})
 for(const viewport of [{width:568,height:320},{width:360,height:640},{width:1280,height:800}].filter(v=>!process.env.ORDERS_QA_WIDTH||v.width===Number(process.env.ORDERS_QA_WIDTH))){
  const run={viewport,geometry:[],checks:[],errors:[],external:[]};report.runs.push(run)
  const context=await browser.newContext({viewport});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(run.external.push(r.request().url()),r.abort()))
  await context.addInitScript(({initial,key})=>{localStorage.setItem(key,JSON.stringify(initial));window.__ordersQA={writes:[],events:[]};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)window.__ordersQA.writes.push(v);return set.call(this,k,v)};for(const type of ['click','keydown','keyup','wheel'])document.addEventListener(type,e=>window.__ordersQA.events.push({type,trusted:e.isTrusted,key:e.key,action:e.target?.dataset?.action}),true)},{initial,key})
  const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>run.errors.push(e.message))
  const click=async selector=>{await page.waitForTimeout(550);await page.locator(selector).click();await page.waitForTimeout(120)}
  const shop='[data-action="open-panel"][data-value="bay-shop"]'
  const measure=async(label)=>{
   const geometry=await page.evaluate(({label,shop})=>{const box=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};const visible=el=>{const r=box(el);let c={x:0,y:0,right:innerWidth,bottom:innerHeight};for(let p=el.parentElement;p;p=p.parentElement)if(/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflow)){const b=box(p);c={x:Math.max(c.x,b.x),y:Math.max(c.y,b.y),right:Math.min(c.right,b.right),bottom:Math.min(c.bottom,b.bottom)}}return{rect:r,clip:c,visible:r.x>=c.x-1&&r.y>=c.y-1&&r.right<=c.right+1&&r.bottom<=c.bottom+1}};return{label,shop:{text:document.querySelector(shop).textContent,count:document.querySelectorAll(shop).length,...visible(document.querySelector(shop))},selected:visible(document.querySelector('.market-order-choice[aria-pressed="true"]')),firstChoice:visible(document.querySelector('.market-order-choice')),detail:visible(document.querySelector('.market-order-detail')),groups:[...document.querySelectorAll('[data-order-group]')].map(e=>e.dataset.orderGroup),horizontal:document.querySelector('.dialog-content').scrollWidth>document.querySelector('.dialog-content').clientWidth+1,focus:document.activeElement.outerHTML.slice(0,220)}},{label,shop})
   run.geometry.push(geometry);await page.screenshot({path:path.join(out,`${viewport.width}x${viewport.height}-${label}.png`)});console.log(`${viewport.width}: ${label}`);return geometry
  }
  try{
   await page.goto(origin+(baseline?'':'/?marketOrdersEntry=1'),{waitUntil:'networkidle'});await page.locator('.hud-button[data-panel="market"]').click();assert.equal((await page.locator(shop).textContent()).trim(),'В лавку в гавань');await click('[data-action="market-tab"][data-value="orders"]')
   const landing=await measure('landing');assert.equal(landing.shop.count,1);assert.equal(landing.horizontal,false)
   const ids=await page.locator('.market-order-choice').evaluateAll(es=>es.map(e=>e.dataset.value));assert.deepEqual(ids.sort(),getMarketOrderBoard(initial).choices.map(o=>o.id).sort())
   if(!baseline){assert.equal(landing.shop.text.trim(),'Своя лавка в гавани');assert.ok(landing.shop.visible,'shop visible on landing');assert.ok(landing.firstChoice.visible,'order picker visible on landing');assert.ok(landing.shop.rect.height>=44);assert.ok(landing.firstChoice.rect.height>=44)}
   for(const id of ids){await click(`[data-action="market-order-select"][data-value="${id}"]`);assert.equal(await page.locator(`.market-order-choice[data-value="${id}"]`).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.market-order-detail').evaluate(e=>document.activeElement===e),true)}
   const after=await measure('last-order');if(!baseline){assert.ok(after.shop.visible,'shop remains visible after selection');assert.ok(after.detail.visible,'focused detail visible after selection')}
   await click('.market-orders-timing summary');assert.equal(await page.locator('.market-orders-timing').getAttribute('open'),'');await click('.market-orders-timing summary')
   await click('[data-action="market-tab"][data-value="buy"]');await click('[data-action="market-tab"][data-value="orders"]');assert.equal(await page.locator(`.market-order-choice[data-value="${ids.at(-1)}"]`).getAttribute('aria-pressed'),'true')
   assert.equal(await page.evaluate(()=>window.__ordersQA.writes.length),0);assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),initial)
   if(viewport.width===360 && (!baseline || process.env.ORDERS_QA_ROUTE)){
    await click(shop);await page.locator('.bay-shop').waitFor();await page.waitForFunction(()=>window.__ordersQA.writes.length>=1)
    assert.equal((await page.locator('.bay-shop-header h2').textContent()).trim(),'Своя лавка')
    const arrived=structuredClone(initial);assert.ok(F.sail(arrived,'village').ok);assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),arrived)
    await page.screenshot({path:path.join(out,`${viewport.width}x${viewport.height}-own-shop.png`)})
    run.shopRoute={description:'Existing explicit home→village crossing, exact sail state, no stock/coin/economy change; actual page heading Своя лавка',primaryWrites:await page.evaluate(()=>window.__ordersQA.writes.length)}
   }
   run.events=await page.evaluate(()=>window.__ordersQA.events);assert.ok(run.events.every(e=>e.trusted));assert.deepEqual(run.errors,[]);assert.deepEqual(run.external,[])
   run.checks.push('exact complete order portfolio preserved','one unchanged shop destination, no duplicate','native selection of every current order is read-only','selected detail receives focus','timing disclosure and market tabs remain reachable','selection retained across tabs','zero primary writes/full save unchanged throughout Orders browsing (shop crossing is separate)')
  }finally{await context.close()}
 }
 report.pass=true
}catch(e){report.pass=false;report.error=String(e.stack??e);throw e}finally{await fs.writeFile(path.join(out,'native-result.json'),JSON.stringify(report,null,2));await browser?.close();await server?.close()}
console.log(JSON.stringify({pass:report.pass,runs:report.runs.map(r=>({viewport:r.viewport,checks:r.checks}))},null,2))
