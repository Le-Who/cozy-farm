const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
// Use only a disposable browser context and an explicit loopback test server.
const dir=(process.env.GARDEN_QA_OUTPUT ?? '/tmp/cozy-garden-spatial-qa').replace(/\/$/,'')+'/';
await fs.mkdir(dir,{recursive:true});
const base=process.env.GARDEN_QA_ORIGIN ?? 'http://127.0.0.1:5221';
const origin=new URL(base);
assert.ok(origin.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(origin.hostname),'Loopback test origin required');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,ignoreDefaultArgs:true,args:['--headless','--remote-debugging-pipe','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--no-first-run','--no-default-browser-check']});
const results=[];
async function seed(page){
 await page.goto(base+'/tests/manual/rest-preview.html');
 return await page.evaluate(async()=>{
  if(localStorage.length)throw Error('Expected disposable origin with no saves');
  const {createFarm,restoreFarm,cropDefinitions}=await import('/src/farm.ts'); const {farmSaveKeys}=await import('/src/farm-save-keys.ts');
  const farm=createFarm();
  farm.beds=farm.beds.map((_,i)=>i===9?{kind:'tilled'}:i===15?{kind:'empty'}:{kind:'crop',crop:['leafyGreens','wheat','carrot','cabbage'][i%4],growth:0,watered:i%2===0});
  farm.beds[5]={kind:'crop',crop:'carrot',growth:0,watered:true,trait:'rainbow'};
  farm.beds[14]={kind:'crop',crop:'blueberry',growth:3,watered:false,trait:'dew'};
  if(!restoreFarm(farm))throw Error('Invalid seed');localStorage.setItem(farmSaveKeys.primary,JSON.stringify(farm));return farm;
 });
}
async function state(page){return await page.evaluate(async()=>{const {farmSaveKeys}=await import('/src/farm-save-keys.ts');return JSON.parse(localStorage.getItem(farmSaveKeys.primary))})}
async function open(page,panel){await page.getByRole('button',{name:'Открыть бухту',exact:true}).click();await page.locator(`dialog[open] [data-action="open-panel"][data-value="${panel}"]`).click();}
async function geometry(page){return await page.evaluate(()=>{
 const cells=[...document.querySelectorAll('.garden-map .garden-cell')],panel=document.querySelector('.farm-dialog'),content=document.querySelector('.dialog-content');
 const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}},c=r(content);
 const visible=e=>{const b=r(e);return b.x>=0&&b.right<=innerWidth+1&&b.y>=c.y-1&&b.bottom<=c.bottom+1};
 const compact=cells.map(e=>{const n=r(e.querySelector('.garden-bed-number')),m=e.querySelector('.garden-bed-marker'),b=m?r(m):null;return {stateVisible:e.querySelector('.garden-bed-state').getClientRects().length>0,markerOverlapsNumber:b?Math.min(n.right,b.right)>Math.max(n.x,b.x)&&Math.min(n.bottom,b.bottom)>Math.max(n.y,b.y):false}});
 return {compact,cells:cells.map(e=>({...r(e),index:Number(e.dataset.value),visible:visible(e)})),content:c,panel:r(panel),scrollWidth:content.scrollWidth,clientWidth:content.clientWidth,focus:document.activeElement.className,actions:[...document.querySelectorAll('.garden-actions button')].map(e=>({...r(e),visible:visible(e),label:e.textContent})),nav:[...document.querySelectorAll('.dialog-destinations button,.dialog-close,.dialog-back:not([hidden])')].map(e=>({...r(e),label:e.textContent}))};
})}
try{
 for(const [width,height] of [[390,844],[360,640],[568,320],[844,390],[1280,800]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   const before=await seed(page);await page.goto(base);await open(page,'transplant');
   // A late physical index, held activation, cancellation and rotation only change UI state.
   if(width===390){
    const last=page.locator('[data-action="transplant-source"][data-value="14"]');await last.scrollIntoViewIfNeeded();await last.focus();
    await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');
    await page.locator('[data-action="transplant-destination"][data-value="14"][aria-pressed="true"]').waitFor();
    assert.equal(await page.locator('.dialog-content').evaluate(e=>e.scrollTop),0);
    assert.match(await page.locator('.garden-selected').innerText(),/Грядка 15/);
    assert.match(await page.evaluate(()=>document.activeElement.className),/transplant-step/);
    await page.setViewportSize({width:568,height:320});assert.deepEqual((await state(page)).beds,before.beds);
    assert.equal(await page.locator('[data-value="14"][aria-pressed="true"]').count(),1);
    await page.setViewportSize({width,height});await page.getByRole('button',{name:'Отменить выбор',exact:true}).click();
    assert.deepEqual((await state(page)).beds,before.beds);
   }
   await page.locator('[data-action="transplant-source"][data-value="5"]').tap();
   const g=await geometry(page);await page.screenshot({path:dir+`transplant-${width}x${height}.png`});
   assert.deepEqual(g.cells.map(x=>x.index),Array.from({length:16},(_,i)=>i));
   assert.equal(new Set(g.cells.map(x=>Math.round(x.x))).size,4);assert.equal(new Set(g.cells.map(x=>Math.round(x.y))).size,4);
   assert.ok(g.cells.every(x=>x.w>=43.99&&x.h>=43.99&&x.visible),JSON.stringify(g));assert.ok(g.actions.every(x=>x.visible&&x.h>=44));
   assert.ok(g.nav.every(x=>x.w>=44&&x.h>=44&&x.y>=0&&x.bottom<=height));assert.ok(g.scrollWidth<=g.clientWidth);assert.match(g.focus,/transplant-step/);
   if(width>=500&&height<=500) assert.ok(g.compact.every(x=>!x.stateVisible&&!x.markerOverlapsNumber),'Compact cells keep numbers and state markers separate');
   assert.deepEqual((await state(page)).beds,before.beds);
   await page.locator('[data-action="transplant-destination"][data-value="9"]').tap();await page.getByRole('button',{name:'Пересадить ещё',exact:true}).waitFor();
   await page.waitForFunction(async()=>{const {farmSaveKeys}=await import('/src/farm-save-keys.ts');return JSON.parse(localStorage.getItem(farmSaveKeys.primary)).beds[5].kind==='tilled'}); let moved=await state(page);assert.deepEqual(moved.beds[9],before.beds[5]);assert.deepEqual(moved.beds[5],{kind:'tilled'});
   await page.getByRole('button',{name:'Закрыть меню',exact:true}).click();await open(page,'berry-nursery');
   await page.locator('[data-action="berry-nursery-source"][data-value="14"]').tap();
   const ng=await geometry(page);await page.screenshot({path:dir+`nursery-${width}x${height}.png`});
   assert.ok(ng.cells.every(x=>x.visible&&x.w>=44&&x.h>=44));
   await page.locator('[data-action="berry-nursery-destination"][data-value="5"]').tap();
   assert.deepEqual((await state(page)).beds,moved.beds);
   const cg=await geometry(page);await page.screenshot({path:dir+`confirm-${width}x${height}.png`});
   assert.ok(cg.actions.every(x=>x.visible&&x.h>=44),JSON.stringify(cg));
   await page.getByRole('button',{name:'Разделить на две посадки',exact:true}).tap();await page.getByRole('button',{name:'Выбрать ещё куст',exact:true}).waitFor();
   await page.waitForFunction(async()=>{const {farmSaveKeys}=await import('/src/farm-save-keys.ts');return JSON.parse(localStorage.getItem(farmSaveKeys.primary)).beds[14].growth===0}); const divided=await state(page);assert.equal(divided.beds[14].growth,0);assert.equal(divided.beds[5].growth,0);assert.deepEqual(divided.produce,moved.produce);
   await page.reload();assert.deepEqual((await state(page)).beds,divided.beds);
   assert.deepEqual(errors,[]);results.push({width,height,transplant:g,nursery:ng,confirm:cg,errors,pass:true});
  }catch(e){console.error(e);await page.screenshot({path:dir+`FAIL-${width}x${height}.png`});results.push({width,height,error:String(e),geometry:await geometry(page).catch(()=>null),errors});console.error(width,height,e);break;}finally{await context.close()}
 }
 await fs.writeFile(dir+'browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(x=>({width:x.width,height:x.height,pass:x.pass,error:x.error})),null,2));
 assert.ok(results.length===5&&results.every(x=>x.pass));
}finally{await browser.close()}
