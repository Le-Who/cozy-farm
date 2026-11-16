import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {createServer} from '../../node_modules/vite/dist/node/index.js'
import * as F from '../../src/farm.ts'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE),baseline=!!process.env.TASK_QA_BASELINE
const out=path.resolve(process.env.TASK_QA_OUTPUT??'task-rail-evidence'),key='cozy-farm-island-v7',initial=F.createFarm()
const report={baseline:'753cdb37ab3baf70b3f5312aaf85e4363e6d5ce9',fixture:'Canonical unmodified createFarm; every later farm action uses trusted native input.',runs:[]};let server,browser
await fs.mkdir(out,{recursive:true})
try{
 server=await createServer({root:new URL('../../',import.meta.url).pathname,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}});await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`,{plots,scenePoint}=await server.ssrLoadModule('/src/lavender-layout.ts')
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,ignoreDefaultArgs:['--enable-unsafe-swiftshader','--unsafely-disable-devtools-self-xss-warnings'],args:['--use-gl=angle','--use-angle=swiftshader']})
 const cases=baseline?[{width:568,height:320}]:[{width:568,height:320},{width:568,height:320,safe:{left:24,right:24,top:12,bottom:16}},{width:568,height:320,safe:{left:24,right:44,top:12,bottom:16},name:'notch'},{width:844,height:390},{width:360,height:640}]
 for(const spec of cases){
  const {width,height,safe}=spec,viewport={width,height},id=`${width}x${height}${safe?'-'+(spec.name??'safe'):''}`,run={viewport,safe,states:[],errors:[],external:[]},context=await browser.newContext({viewport,hasTouch:true});report.runs.push(run)
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(run.external.push(r.request().url()),r.abort()))
  await context.addInitScript(({initial,key})=>{localStorage.setItem(key,JSON.stringify(initial));window.__taskQA={writes:[],events:[],hudReads:0,railWrites:0};const rect=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){if(this.matches(".hud-top"))window.__taskQA.hudReads++;return rect.call(this)};const property=CSSStyleDeclaration.prototype.setProperty;CSSStyleDeclaration.prototype.setProperty=function(k,v,p){if(k==="--field-rail-width"||k==="--field-hud-height")window.__taskQA.railWrites++;return property.call(this,k,v,p)};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)window.__taskQA.writes.push(v);return set.call(this,k,v)};for(const t of ['pointerup','click','keydown','keyup'])document.addEventListener(t,e=>window.__taskQA.events.push({type:t,trusted:e.isTrusted,key:e.key,target:e.target?.closest?.('button')?.className??e.target?.tagName}),true)},{initial,key})
  const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>run.errors.push(e.message));if(safe){const session=await context.newCDPSession(page);await session.send('Emulation.setSafeAreaInsetsOverride',{insets:safe})}
  const canvas=page.locator('canvas.island-canvas'),card=page.locator('.task-card')
  const projection=async()=>{const r=await canvas.boundingBox(),close=await page.locator('.view-toggle').getAttribute('aria-pressed')==='true',short=r.width>r.height&&r.height<480,scale=close?Math.min(r.width/486,Math.max(140,r.height-(short?123:190))/278):Math.min(r.width/1440,r.height/900),center=close?scenePoint(784,577):{x:720,y:450};return plots.map(p=>({x:r.x+r.width/2+(p.center.x-center.x)*scale,y:r.y+r.height/2+(p.center.y-center.y)*scale,width:p.w*scale,height:p.h*scale}))}
  const capture=async(label)=>{const beds=await projection(),s=await page.evaluate(({beds,label})=>{const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}},c=document.querySelector('.task-card'),r=box(c),n=document.querySelector('.task-name'),range=document.createRange();range.selectNodeContents(n);return{label,card:{...r,title:c.title,name:n.textContent,count:c.querySelector('.task-count').textContent,key:c.getAttribute('aria-keyshortcuts'),font:getComputedStyle(n).fontSize,readable:[...range.getClientRects()].every(t=>t.x>=r.x&&t.y>=r.y&&t.right<=r.right&&t.bottom<=r.bottom)},header:box(document.querySelector('.hud-top')),footer:box(document.querySelector('.hotbar')),centers:beds.map((p,i)=>({i,...p,target:document.elementFromPoint(p.x,p.y)?.closest('button')?.className??document.elementFromPoint(p.x,p.y)?.tagName})),soilOverlap:beds.some(p=>r.x<p.x+p.width/2&&r.right>p.x-p.width/2&&r.y<p.y+p.height/2&&r.bottom>p.y-p.height/2),writes:window.__taskQA.writes.length}},{beds,label});run.states.push(s);await page.screenshot({path:path.join(out,`${id}-${label}.png`)});return s}
  try{
   await page.goto(origin,{waitUntil:'networkidle'});await page.waitForTimeout(300);const before=await capture('initial'),p=(await projection())[3]
   assert.equal(before.card.key,'J');assert.ok(before.card.readable);assert.ok(before.card.width>=44&&before.card.height>=(width>height?44:40))
   if(baseline){assert.equal(before.centers[3].target,'task-card');await page.mouse.click(p.x,p.y);await page.waitForTimeout(1000);const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.deepEqual(saved.beds[3],initial.beds[3]);run.baselineBlocked={pointer:p,tomatoUnharvested:true,writes:await page.evaluate(()=>window.__taskQA.writes.length)};await capture('blocked-tomato-click')}
   else{
    await page.waitForTimeout(400);const idleStart=await page.evaluate(()=>({reads:window.__taskQA.hudReads,writes:window.__taskQA.railWrites}));await page.waitForTimeout(800);const idleEnd=await page.evaluate(()=>({reads:window.__taskQA.hudReads,writes:window.__taskQA.railWrites}));assert.deepEqual(idleEnd,idleStart);run.idleHud={milliseconds:800,additionalReads:0,additionalWrites:0};
    assert.equal(before.soilOverlap,false);assert.ok(before.centers.every(p=>p.target==='CANVAS'),'all 16 bed centers reach the canvas');assert.ok(before.card.x>=(safe?.left??0)&&before.card.right<=width-(safe?.right??0));if(width>height){assert.ok(before.card.y>=before.header.bottom+7);assert.ok(before.card.bottom<=before.footer.y)}
    // The task remains a real button; initial follow-task only focuses the empty bed.
    await card.click();assert.equal(await canvas.evaluate(e=>document.activeElement===e),true);assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),initial);assert.equal(await page.evaluate(()=>window.__taskQA.writes.length),0)
    await page.keyboard.press('j');await page.locator('.farm-dialog[open][data-panel="journal"]').waitFor();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__taskQA.writes.length),0)
    // Exact previously obstructed target, no dispatchEvent or direct reducer calls in the page.
    if(safe)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y)
    const expected=structuredClone(initial);assert.ok(F.workBed(expected,3).ok);await page.waitForFunction(()=>window.__taskQA.writes.length>=1);await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>window.__taskQA.writes.length),1);assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),expected)
    const after=await capture('tomato-harvested');assert.equal(after.soilOverlap,false);assert.ok(after.card.readable);assert.ok(after.centers.every(p=>p.target==='CANVAS'));run.expectedTomatoes=expected.produce.tomato;run.primaryWrites=1
   }
   run.events=await page.evaluate(()=>window.__taskQA.events);assert.ok(run.events.every(e=>e.trusted));assert.deepEqual(run.errors,[]);assert.deepEqual(run.external,[])
  }finally{await context.close()}
 }
 report.pass=true
}catch(e){report.pass=false;report.error=String(e.stack??e);throw e}finally{await fs.writeFile(path.join(out,'native-result.json'),JSON.stringify(report,null,2));await browser?.close();await server?.close()}
console.log(JSON.stringify({pass:report.pass,runs:report.runs.map(r=>({viewport:r.viewport,safe:r.safe,primaryWrites:r.primaryWrites,baselineBlocked:r.baselineBlocked}))},null,2))
