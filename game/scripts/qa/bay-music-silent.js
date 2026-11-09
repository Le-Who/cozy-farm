async page=>{
 await page.evaluate(async()=>{const {bayAudio}=await import('/src/bay-audio.ts');window.musicAudio=bayAudio;window.musicPrimeCalls=0;const original=bayAudio.primeInstruments.bind(bayAudio);bayAudio.primeInstruments=(...args)=>{window.musicPrimeCalls++;return original(...args)};window.musicDrawFrames=0;const frame=requestAnimationFrame;window.requestAnimationFrame=callback=>frame(time=>{if(callback.name==='draw')window.musicDrawFrames++;callback(time)});});
 const receipt=[];
 for(const [mode,settings] of [['muted',{muted:true,volume:.7,music:.8}],['volume0',{muted:false,volume:0,music:.8}],['music0',{muted:false,volume:.7,music:0}]]){
  await page.evaluate(settings=>{window.musicAudio.setSettings(settings);window.musicPrimeCalls=0},settings);
  await page.getByRole('button',{name:'Глиняный барабан',exact:true}).click();
  await page.getByRole('button',{name:'Настроить звук и дорожки',exact:true}).click();
  await page.getByRole('button',{name:'Очистить выбранную дорожку',exact:true}).click();
  await page.keyboard.press('Escape');await page.keyboard.press('Digit7');
  if(await page.getByRole('button',{name:'Записывать касания инструментов',exact:true}).getAttribute('aria-pressed')!=='true')await page.getByRole('button',{name:'Записывать касания инструментов',exact:true}).click();
  await page.getByRole('button',{name:'▶ Играть',exact:true}).click();
  await page.locator('.bay-music-play[aria-pressed=true]').waitFor();await page.waitForTimeout(250);
  await page.getByRole('button',{name:'Глиняный барабан',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cozy-farm-island-v1')).musicGarden.tracks.ceramic.steps.includes(6));
  const playing=await page.evaluate(()=>({primeCalls:window.musicPrimeCalls,drawFrames:window.musicDrawFrames,status:document.querySelector('.bay-music-status').textContent}));
  if(playing.primeCalls!==0)throw new Error(mode+' requested samples');
  await page.getByRole('button',{name:'Ⅱ Пауза',exact:true}).click();
  const stopped=await page.evaluate(()=>window.musicDrawFrames);await page.waitForTimeout(150);
  const after=await page.evaluate(()=>window.musicDrawFrames);if(stopped!==after)throw new Error('draw loop continued after stop');
  receipt.push({mode,...playing,recorded:true,stoppedFrames:stopped,afterFrames:after});
 }
 await page.evaluate(()=>window.musicAudio.setSettings({muted:false,volume:.7,music:.8}));return receipt;
}
