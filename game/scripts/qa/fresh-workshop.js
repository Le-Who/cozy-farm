// Bake one ordinary round bun in an open workshop, without fixtures or state writes.
async(page)=>{
  const before=await page.evaluate(()=>{const f=JSON.parse(localStorage.getItem('cozy-farm-island-v1'));return{day:f.day,wheat:f.produce.wheat,eggs:f.eggs,round:f.handmade.round};});
  const workbench=page.getByRole('application',{name:'Pastry workbench'});
  await page.locator('.workshop-render-status').waitFor({state:'hidden'});
  await workbench.focus();
  for(let i=0;i<11;i++)await page.keyboard.press('Space');
  await page.locator('.dough-workshop[data-stage=working]').waitFor();
  await page.getByRole('button',{name:'Bake',exact:true}).click();
  await page.locator('.dough-workshop[data-stage=finished]').waitFor();
  await page.screenshot({path:`../output/playwright/fresh-day${before.day}-round-bun.png`,scale:'css'});
  const after=await page.evaluate(()=>{const f=JSON.parse(localStorage.getItem('cozy-farm-island-v1'));return{day:f.day,wheat:f.produce.wheat,eggs:f.eggs,round:f.handmade.round,patterns:f.workshopPatterns};});
  return{before,actions:['11 native Space mixing presses','Native Bake click','Waited for completed oven animation'],after};
}
