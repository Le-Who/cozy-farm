async(page)=>{
 await page.locator('.workshop-accessible-tools [data-tool=knead]').click();const b=await page.locator('.workshop-view').boundingBox();await page.mouse.move(b.x+b.width*.43,b.y+b.height*.60);await page.mouse.down();await page.mouse.move(b.x+b.width*.34,b.y+b.height*.56,{steps:16});await page.mouse.up();await page.waitForTimeout(600);await page.screenshot({path:'../08_docs/acceptance/2026-11-09/workshop/desktop-loaf-shaped.png'});
 await page.locator('.workshop-bake').click();await page.locator('.dough-workshop[data-stage=finished]').waitFor();await page.waitForTimeout(400);await page.screenshot({path:'../08_docs/acceptance/2026-11-09/workshop/desktop-loaf-baked.png'});
 return await page.evaluate(()=>({shape:document.querySelector('.dough-workshop').dataset.shape,save:JSON.parse(localStorage.getItem('cozy-farm-island-v1')).handmade}))
}
