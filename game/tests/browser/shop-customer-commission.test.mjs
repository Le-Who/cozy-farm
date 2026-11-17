import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from '../../node_modules/vite/dist/node/index.js'
import { assortmentPlayer } from '../fixtures/assortment-player.ts'
import { advanceBayShop, removeBayShopStock } from '../../src/bay-shop-model.ts'
import { getShopCommissionOffers, acceptShopCommission, getShopCommission } from '../../src/shop-commissions.ts'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const opening=JSON.parse(await fs.readFile(new URL('../fixtures/home-progress-actions.json',import.meta.url),'utf8'))
let completedSnapshot
const earned=assortmentPlayer(opening,farm=>{if(farm.island==='village'&&farm.shopCommissions.lastCompletedOn===farm.day)completedSnapshot=structuredClone(farm)})
// Finish the already-paid visitor's departure before measuring read-only navigation.
for(let i=0;earned.p.state.bayShop.visitor&&i<20;i++)assert.deepEqual(advanceBayShop(earned.p.state.bayShop,1000),[])
assert.equal(earned.p.state.bayShop.visitor,null)
// The shared fixture uses placeholder art even for its now-empty sold tart slot.
// Clear only empty shelves through the public model, so ordinary catalog refresh is not mistaken for navigation writes.
for(const [index,slot] of earned.p.state.bayShop.slots.entries())if(slot&&slot.quantity===0)removeBayShopStock(earned.p.state.bayShop,index)
earned.p.reload()
const initial=structuredClone(earned.p.state),key='cozy-farm-island-v7'
for(const viewport of [{width:1440,height:900},{width:568,height:320}])test(`selected shopper opens their existing orders at ${viewport.width}×${viewport.height}`,async()=>{
 let server,browser;const errors=[],external=[],report={viewport,steps:[]},out=process.env.SHOP_ENTRY_OUTPUT
 try{
  server=await createServer({root:new URL('../../',import.meta.url).pathname,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}});await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,ignoreDefaultArgs:['--enable-unsafe-swiftshader','--unsafely-disable-devtools-self-xss-warnings']})
  const context=await browser.newContext({viewport});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()))
  await context.addInitScript(({initial,key})=>{localStorage.setItem(key,JSON.stringify(initial));window.__shopEntry={writes:[],clicks:[]};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)window.__shopEntry.writes.push(v);return set.call(this,k,v)};document.addEventListener('click',e=>window.__shopEntry.clicks.push(e.isTrusted),true)},{initial,key})
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))
  const click=async s=>{await page.waitForTimeout(550);await page.locator(s).click();await page.waitForTimeout(120)}
  const exact=async(expected,writes)=>{assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),expected);assert.equal(await page.evaluate(()=>window.__shopEntry.writes.length),writes)}
  const capture=async label=>{const state=await page.evaluate(()=>{const content=document.querySelector('.dialog-content'),entry=document.querySelector('[data-commissions]'),selected=document.querySelector('[data-commission-view="customer"]');return{entry:entry?.textContent,selected:selected?.value,focus:document.activeElement.dataset.commissionView??document.activeElement.className,writes:window.__shopEntry.writes.length,text:content.innerText,horizontal:content.scrollWidth>content.clientWidth+1}});report.steps.push({label,...state});if(out){await fs.mkdir(out,{recursive:true});await page.screenshot({path:path.join(out,`${viewport.width}-${label}.png`)})}return state}
  await page.goto(origin,{waitUntil:'networkidle'});await click('.hud-actions [data-panel="guide"]');await click('[data-action="open-panel"][data-value="bay-shop"]');await click('[data-tab="journal"]')
  for(const customer of ['finn','bea']){
   await click(`[data-customer="${customer}"]`);const entry=await capture(`${customer}-shop`);await click('[data-commissions]');const preview=await capture(`${customer}-preview`)
   assert.equal(preview.selected,customer,'the chosen shopper, not an unrelated default, owns this preview');assert.equal(preview.focus,'customer');assert.equal(preview.horizontal,false)
   assert.match(entry.entry,new RegExp(customer==='bea'?'Беа':'Финн'));await exact(initial,0)
   // Returning to the same shopper preserves the actual request the player chose.
   if(customer==='bea'){
    const requests=await page.locator('[data-commission-view="request"] option').evaluateAll(es=>es.map(e=>e.value));const request=requests.find(x=>x!==requests[0]&&x!=='set');assert.ok(request)
    await page.locator('[data-commission-view="request"]').selectOption(request);await exact(initial,0);await click('[data-action="open-panel"][data-value="bay-shop"]');await click('[data-tab="journal"]');await click('[data-commissions]');assert.equal(await page.locator('[data-commission-view="request"]').inputValue(),request);await exact(initial,0)
   }
   if(customer==='finn'){await click('[data-action="open-panel"][data-value="bay-shop"]');await click('[data-tab="journal"]')}
  }
  // Existing explicit acceptance is separate; the active route must stay generic.
  const active=structuredClone(initial),request=await page.locator('[data-commission-view="request"]').inputValue(),offer=getShopCommissionOffers(active).find(o=>o.customer==='bea'&&o.recipeId===request);assert.ok(offer);assert.ok(acceptShopCommission(active,offer.key).ok)
  await click('[data-action="commission-accept"]');await exact(active,1);await click('[data-action="open-panel"][data-value="bay-shop"]');await click('[data-tab="journal"]');await click('[data-customer="finn"]');const generic=await capture('active-shop');assert.equal(generic.entry.trim(),'Заказы')
  await click('[data-commissions]');const activePage=await capture('active-order');assert.match(activePage.text,new RegExp(getShopCommission(active).customerName));assert.equal(await page.locator('[data-commission-view="customer"]').count(),0);await exact(active,1)
  assert.ok(await page.evaluate(()=>window.__shopEntry.clicks.every(Boolean)));assert.deepEqual(errors,[]);assert.deepEqual(external,[])
  if(viewport.width===1440){
   assert.ok(completedSnapshot);assert.deepEqual(getShopCommissionOffers(completedSnapshot),[])
   for(let i=0;completedSnapshot.bayShop.visitor&&i<20;i++)assert.deepEqual(advanceBayShop(completedSnapshot.bayShop,1000),[])
   assert.equal(completedSnapshot.bayShop.visitor,null)
   for(const [index,slot] of completedSnapshot.bayShop.slots.entries())if(slot&&slot.quantity===0)removeBayShopStock(completedSnapshot.bayShop,index)
   const receiptContext=await browser.newContext({viewport});await receiptContext.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()))
   await receiptContext.addInitScript(({farm,key})=>{localStorage.setItem(key,JSON.stringify(farm));window.__receiptWrites=0;const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)window.__receiptWrites++;return set.call(this,k,v)}},{farm:completedSnapshot,key})
   const receiptPage=await receiptContext.newPage();receiptPage.on('pageerror',e=>errors.push(e.message));const tap=async s=>{await receiptPage.waitForTimeout(550);await receiptPage.locator(s).click();await receiptPage.waitForTimeout(120)}
   await receiptPage.goto(origin,{waitUntil:'networkidle'});await tap('.hud-actions [data-panel="guide"]');await tap('[data-action="open-panel"][data-value="bay-shop"]');await tap('[data-tab="journal"]');await tap('[data-customer="finn"]')
   assert.equal((await receiptPage.locator('[data-commissions]').textContent()).trim(),'Заказы');await tap('[data-commissions]');assert.equal(await receiptPage.locator('.commission-receipt').count(),1);assert.equal(await receiptPage.locator('[data-action="commission-rest"]').count(),1);assert.equal(await receiptPage.locator('[data-commission-view="customer"]').count(),0)
   assert.deepEqual(await receiptPage.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),completedSnapshot);assert.equal(await receiptPage.evaluate(()=>window.__receiptWrites),0);report.completedReceipt={genericEntry:true,existingReceipt:true,restAction:true,writes:0}
   if(out)await receiptPage.screenshot({path:path.join(out,'1440-completed-receipt.png')});await receiptContext.close()
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);report.pass=true
 }finally{await browser?.close();await server?.close();if(out){await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,`${viewport.width}-result.json`),JSON.stringify(report,null,2))}}
})
