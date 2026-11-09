async(page)=>{await page.setViewportSize({width:1280,height:900});await (async(page)=>{
 const result=await page.evaluate(async()=>{
  const m=await import('/src/farm.ts');const f=m.createFarm();f.day=5;f.projects.fair={'dishes:appleJam':1,eggBaskets:1,'produce:carrot':4,'produce:wheat':3};f.produce.wheat=30;f.eggs=15;f.coins=100;
  if(!m.restoreFarm(f))throw Error('Invalid QA fixture');localStorage.setItem('cozy-farm-island-v1',JSON.stringify(f));return {fixture:'fair complete; enough workshop ingredients'}
 });await page.reload();await page.getByRole('button',{name:'Открыть бухту',exact:true}).click();return result
}
)(page);await (async(page)=>{
 await page.getByRole('button').filter({has:page.getByText('Кондитерская',{exact:true})}).click();await page.locator('.dough-workshop[data-ready=true]').waitFor();
 await page.screenshot({path:'../08_docs/acceptance/2026-11-09/workshop/desktop-selection.png'});
 await page.locator('[data-shape=long]').click();await page.locator('.workshop-view').focus();for(let i=0;i<11;i++)await page.keyboard.press('Space');await page.locator('.dough-workshop[data-stage=working]').waitFor();
 await page.screenshot({path:'../08_docs/acceptance/2026-11-09/workshop/desktop-loaf-raw.png'});return await page.locator('.dough-workshop').evaluate(el=>({...el.dataset,visibleTools:[...el.querySelectorAll('.workshop-accessible-tools button')].map(b=>({text:b.textContent,rect:b.getBoundingClientRect().toJSON()}))}))
}
)(page);await (async(page)=>{
 await page.locator('.workshop-accessible-tools [data-tool=knead]').click();const b=await page.locator('.workshop-view').boundingBox();await page.mouse.move(b.x+b.width*.43,b.y+b.height*.60);await page.mouse.down();await page.mouse.move(b.x+b.width*.34,b.y+b.height*.56,{steps:16});await page.mouse.up();await page.waitForTimeout(600);await page.screenshot({path:'../08_docs/acceptance/2026-11-09/workshop/desktop-loaf-shaped.png'});
 await page.locator('.workshop-bake').click();await page.locator('.dough-workshop[data-stage=finished]').waitFor();await page.waitForTimeout(400);await page.screenshot({path:'../08_docs/acceptance/2026-11-09/workshop/desktop-loaf-baked.png'});
 return await page.evaluate(()=>({shape:document.querySelector('.dough-workshop').dataset.shape,save:JSON.parse(localStorage.getItem('cozy-farm-island-v1')).handmade}))
}
)(page);return {finished:true,toolPaletteHidden:await page.locator(".workshop-accessible-tools").isHidden(),handHidden:await page.locator("[data-prop=hand]").isHidden()}}