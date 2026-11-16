import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from '../../node_modules/vite/dist/node/index.js'
import * as F from '../../src/farm.ts'
const { chromium }=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const out=path.resolve(process.env.MARKET_QA_OUTPUT??'market-sale-grid-evidence'),key='cozy-farm-island-v7'
let initial=F.createFarm()
for(const group of ['produce','fruit','fish','handmade'])for(const id of Object.keys(initial[group]))initial[group][id]=10
initial.eggs=10;for(const resource of [...Object.keys(initial.produce),...Object.keys(initial.fruit)])initial.variants[resource]={rainbow:10};initial.progress.sell=1
initial=F.restoreFarm(initial);assert.ok(initial)
assert.deepEqual(F.restoreCurrentFarm(structuredClone(initial)),initial)
const stock=F.getMarketStock(initial).filter(row=>row.count>0);assert.ok(stock.length>=30)
const report={baseline:'753cdb37ab3baf70b3f5312aaf85e4363e6d5ce9',fixture:`Synthetic isolated ${stock.length}-type stock; no owner save or mid-run inventory injection`,runs:[]}
let server,browser
await fs.mkdir(out,{recursive:true})
try {
 server=await createServer({root:new URL('../../',import.meta.url).pathname,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}});await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,ignoreDefaultArgs:['--enable-unsafe-swiftshader','--unsafely-disable-devtools-self-xss-warnings']})
 const configs=process.env.MARKET_QA_BASELINE?[{width:360,height:640,baseline:true}]:[{width:568,height:320},{width:360,height:640},{width:1280,height:800}]
 for(const {baseline=false,...viewport} of configs.filter(v=>!process.env.MARKET_QA_WIDTH||v.width===Number(process.env.MARKET_QA_WIDTH))){
  const run={viewport,baseline,geometry:[],checks:[],errors:[],external:[]};report.runs.push(run)
  const context=await browser.newContext({viewport});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(run.external.push(r.request().url()),r.abort()))
  await context.addInitScript(({initial,key})=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem(key,JSON.stringify(initial));sessionStorage.setItem('seeded','1')}window.__marketQA={writes:[],events:[]};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)window.__marketQA.writes.push(v);return set.call(this,k,v)};for(const type of ['click','keydown','keyup','wheel'])document.addEventListener(type,e=>window.__marketQA.events.push({type,trusted:e.isTrusted,key:e.key,action:e.target?.dataset?.action}),true)},{initial,key})
  const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>run.errors.push(e.message))
  const click=async selector=>{await page.waitForTimeout(550);await page.locator(selector).click();await page.waitForTimeout(120)}
  const open=async()=>{await page.locator('.hud-button[data-panel="market"]').click();await click('[data-action="market-tab"][data-value="sell"]')}
  const measure=async(label,selectors=[])=>{
   const g=await page.evaluate(({label,selectors})=>{const box=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};const visible=el=>{const r=box(el);let c={x:0,y:0,right:innerWidth,bottom:innerHeight};for(let p=el.parentElement;p;p=p.parentElement)if(/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflow)){const b=box(p);c={x:Math.max(c.x,b.x),y:Math.max(c.y,b.y),right:Math.min(c.right,b.right),bottom:Math.min(c.bottom,b.bottom)}}return{rect:r,clip:c,visible:r.x>=c.x-1&&r.y>=c.y-1&&r.right<=c.right+1&&r.bottom<=c.bottom+1}};const d=document.querySelector('.dialog-content');return{label,dialogScroll:d.scrollTop,horizontal:d.scrollWidth>d.clientWidth+1,controls:selectors.map(s=>({selector:s,...visible(document.querySelector(s))}))}},{label,selectors})
   run.geometry.push(g);await page.screenshot({path:path.join(out,`${viewport.width}x${viewport.height}-${label}.png`)});console.log(`${viewport.width} ${label}`)
   if(!baseline){assert.equal(g.horizontal,false);for(const c of g.controls){assert.ok(c.rect.height>=44,label+' 44px '+c.selector);assert.ok(c.visible,label+' clipped '+c.selector)}}return g
  }
  try{
   await page.goto(origin+(baseline?'':'/?marketSaleGrid=1'),{waitUntil:'networkidle'});await open()
   assert.deepEqual(new Set(await page.locator('[data-action="sell-item"]').evaluateAll(es=>es.map(e=>e.dataset.value))),new Set(stock.map(s=>s.key)))
   await measure('inventory',['[data-market-sale-group]','[data-market-sale-query]',...baseline?[]:['[data-action="sell"]']])
   const scroll=page.locator(baseline?'.dialog-content':'#market-sale-results');const b=await scroll.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.wheel(0,1500);await page.waitForTimeout(300)
   const after=await measure('after-scroll',['[data-market-sale-group]','[data-market-sale-query]'])
   if(baseline){assert.ok(after.controls.some(c=>!c.visible),'baseline gap reproduced');run.checks.push('baseline filters scroll out of view across 34-type inventory');continue}
   assert.equal(after.dialogScroll,0,'only item grid scrolls')
   // Open the last item and close without any inventory mutation.
   await click('[data-action="sell-item"][data-value="handmade:long"]')
   await measure('quantity',['[data-market-sale-group]','[data-market-sale-query]','[data-sale-quantity]','[data-action="confirm-sale"]','[data-action="sale-context-close"]'])
   await click('[data-action="sale-context-close"]');assert.equal(await page.locator('[data-action="sell-item"][data-value="handmade:long"]').evaluate(e=>e===document.activeElement),true)
   assert.equal(await page.evaluate(()=>window.__marketQA.writes.length),0)
   // Native keyboard selection, no programmatic change event or direct state call.
   await page.locator('[data-market-sale-group]').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter')
   assert.equal(await page.locator('[data-market-sale-group]').inputValue(),'harvest')
   await page.locator('[data-market-sale-query]').focus();await page.keyboard.type('радуж яблок')
   await page.waitForTimeout(200);assert.deepEqual(await page.locator('[data-action="sell-item"]').evaluateAll(es=>es.map(e=>e.dataset.value)),['variants:apple:rainbow'])
   await click('[data-action="sell-item"]');await page.locator('[data-sale-quantity]').focus();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('11');assert.equal(await page.locator('[data-action="confirm-sale"]').isDisabled(),true)
   await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('3');assert.equal(await page.locator('[data-action="confirm-sale"]').isDisabled(),false)
   await measure('exact-rare-quote',['[data-market-sale-group]','[data-market-sale-query]','[data-sale-quantity]','[data-action="confirm-sale"]'])
   await page.waitForTimeout(550);await page.locator('[data-action="confirm-sale"]').dblclick({delay:80});await page.waitForFunction(()=>window.__marketQA.writes.length===1)
   const expected=structuredClone(initial);assert.ok(F.sellMarketItem(expected,'variants:apple:rainbow',3).ok)
   assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),expected)
   await measure('receipt',['[data-market-sale-group]','[data-market-sale-query]','[data-action="sale-context-close"]'])
   assert.match(await page.locator('.exact-sale-receipt').textContent(),/Осталось: 7/)
   run.events=await page.evaluate(()=>window.__marketQA.events);assert.ok(run.events.every(e=>e.trusted));assert.deepEqual(run.errors,[]);assert.deepEqual(run.external,[])
   await page.reload({waitUntil:'networkidle'});assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),expected)
   run.checks.push('all 34 semantic stock keys accessible','category and search stay visible across grid scrolling','quantity step and category/search visible together','cancel returns exact source focus without writes','native group+search preserves rare identity','invalid quantity rejected','double click commits exact quantity once','exact full save survives reload')
  }finally{await context.close()}
 }
 report.pass=true
}catch(e){report.pass=false;report.error=String(e.stack??e);throw e}finally{await fs.writeFile(path.join(out,'native-result.json'),JSON.stringify(report,null,2));await browser?.close();await server?.close()}
console.log(JSON.stringify({pass:report.pass,runs:report.runs.map(r=>({viewport:r.viewport,baseline:r.baseline,checks:r.checks}))},null,2))
