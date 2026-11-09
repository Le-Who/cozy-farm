async(page)=>{
 await page.getByRole('button').filter({has:page.getByText('Кондитерская',{exact:true})}).click();await page.locator('.dough-workshop[data-ready=true]').waitFor();
 await page.screenshot({path:'../08_docs/acceptance/2026-11-09/workshop/desktop-selection.png'});
 await page.locator('[data-shape=long]').click();await page.locator('.workshop-view').focus();for(let i=0;i<11;i++)await page.keyboard.press('Space');await page.locator('.dough-workshop[data-stage=working]').waitFor();
 await page.screenshot({path:'../08_docs/acceptance/2026-11-09/workshop/desktop-loaf-raw.png'});return await page.locator('.dough-workshop').evaluate(el=>({...el.dataset,visibleTools:[...el.querySelectorAll('.workshop-accessible-tools button')].map(b=>({text:b.textContent,rect:b.getBoundingClientRect().toJSON()}))}))
}
