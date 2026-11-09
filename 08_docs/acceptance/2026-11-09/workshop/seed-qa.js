async(page)=>{
 const result=await page.evaluate(async()=>{
  const m=await import('/src/farm.ts');const f=m.createFarm();f.day=5;f.projects.fair={'dishes:appleJam':1,eggBaskets:1,'produce:carrot':4,'produce:wheat':3};f.produce.wheat=30;f.eggs=15;f.coins=100;
  if(!m.restoreFarm(f))throw Error('Invalid QA fixture');localStorage.setItem('cozy-farm-island-v1',JSON.stringify(f));return {fixture:'fair complete; enough workshop ingredients'}
 });await page.reload();await page.getByRole('button',{name:'Открыть бухту',exact:true}).click();return result
}
