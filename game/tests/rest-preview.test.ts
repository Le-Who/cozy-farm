import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createFarm, cropDefinitions, cropIds, endDay, getBedStage, restoreFarm, workBed, type Bed } from '../src/farm.ts'
import { getClimate } from '../src/climate.ts'
import { canConfirmRest, getRestPreview } from '../src/rest-preview.ts'
import { renderRestPreview } from '../src/rest-preview-ui.ts'

test('rest preview separates dry, growing, newly ripe and already ripe beds without changing the farm', () => {
  const farm = createFarm()
  farm.beds = [
    {kind:'empty'}, {kind:'tilled'},
    {kind:'crop',crop:'carrot',growth:0,watered:true,wateredAt:1},
    {kind:'crop',crop:'pumpkin',growth:1,watered:true},
    {kind:'crop',crop:'cabbage',growth:1,watered:false},
    {kind:'crop',crop:'tomato',growth:3,watered:false,trait:'star'},
  ]
  const before = structuredClone(farm), preview = getRestPreview(farm)
  assert.deepEqual(preview, {day:2,weather:'sun',ripening:[{index:2,crop:'carrot'}],growing:[{index:3,crop:'pumpkin'}],dry:[{index:4,crop:'cabbage'}],ready:[{index:5,crop:'tomato'}]})
  renderRestPreview(farm)
  assert.deepEqual(farm,before)
  preview.dry[0].crop='carrot'
  assert.deepEqual(farm,before)
})

test('forecast matches the real next morning for all crops, growth stages, watering states and weather windows', () => {
  for(let day=1;day<=22;day++)for(const crop of cropIds)for(let growth=0;growth<=cropDefinitions[crop].days;growth++)for(const watered of [false,true]){
    const farm=createFarm();farm.day=day
    farm.beds=[{kind:'crop',crop,growth,watered}]
    const preview=getRestPreview(farm),before=structuredClone(farm.beds[0])
    assert.equal(endDay(farm).ok,true)
    const after=farm.beds[0];assert.equal(after.kind,'crop');if(after.kind!=='crop'||before.kind!=='crop')continue
    assert.equal(preview.day,farm.day);assert.equal(preview.weather,getClimate(farm.day).weather)
    assert.equal(preview.ripening.length,Number(getBedStage(before)!=='ripe'&&getBedStage(after)==='ripe'))
    assert.equal(preview.growing.length,Number(getBedStage(after)!=='ripe'&&after.growth>before.growth))
    assert.equal(preview.dry.length,Number(getBedStage(before)!=='ripe'&&after.growth===before.growth))
    assert.equal(preview.ready.length,Number(getBedStage(before)==='ripe'))
  }
})

test('tomorrow rain never promises growth to a currently dry crop, but retained water does count', () => {
  const farm=createFarm();farm.day=Array.from({length:30},(_,i)=>i+1).find(day=>getClimate(day+1).weather==='rain')!
  farm.beds=[{kind:'crop',crop:'carrot',growth:0,watered:false},{kind:'crop',crop:'pumpkin',growth:1,watered:true}]
  assert.deepEqual(getRestPreview(farm).dry,[{index:0,crop:'carrot'}])
  assert.match(renderRestPreview(farm),/Завтрашний дождь польёт грядки утром, но не заменит полив/)
  endDay(farm)
  assert.deepEqual(farm.beds.map(b=>b.kind==='crop'?[b.growth,b.watered]:[]),[[0,true],[2,true]])
  assert.deepEqual(getRestPreview(farm).ripening,[{index:0,crop:'carrot'},{index:1,crop:'pumpkin'}])
})

test('watering and harvesting immediately update the forecast; browsing never spends resources or resets quotas', () => {
  const farm=createFarm();farm.beds[0]={kind:'crop',crop:'carrot',growth:0,watered:false};farm.fishCaughtToday.home=3;farm.saltGatheredToday=true
  const before=structuredClone(farm)
  for(let i=0;i<8;i++){getRestPreview(farm);renderRestPreview(farm)}
  assert.deepEqual(farm,before)
  workBed(farm,0)
  assert.ok(getRestPreview(farm).ripening.some(b=>b.index===0))
  const day=String(farm.day)
  assert.equal(canConfirmRest(farm,day),true)
  endDay(farm)
  assert.equal(canConfirmRest(farm,day),false)
  assert.ok(getRestPreview(farm).ready.some(b=>b.index===0))
  workBed(farm,0)
  assert.equal(Object.values(getRestPreview(farm)).some(value=>Array.isArray(value)&&value.some(b=>b.index===0)),false)
})

test('rest confirmation requires the current home day, not an expired day, malformed value or island visit', () => {
  const farm=createFarm()
  for(const day of [undefined,'','0','01','2','1.0','NaN'])assert.equal(canConfirmRest(farm,day),false)
  assert.equal(canConfirmRest(farm,'1'),true)
  farm.island='grove';assert.equal(canConfirmRest(farm,'1'),false)
})

test('preview is derived after reload without a new save field or changing the chosen quiet idea', () => {
  const farm=createFarm();farm.discoveryPreferences={quiet:true,idea:{id:'test',label:'Своя задумка',detail:'Вернуться к огороду'}}
  const raw=JSON.stringify(farm),restored=restoreFarm(JSON.parse(raw))!
  assert.ok(restored);assert.deepEqual(getRestPreview(restored),getRestPreview(farm))
  renderRestPreview(restored)
  assert.equal(JSON.stringify(farm),raw);assert.deepEqual(restored.discoveryPreferences,farm.discoveryPreferences)
})

test('empty and already ripe gardens do not ask for unnecessary watering or automatically harvest', () => {
  const farm=createFarm();farm.beds=Array.from({length:16},():Bed=>({kind:'tilled'}))
  assert.match(renderRestPreview(farm),/Посадок пока нет/);assert.doesNotMatch(renderRestPreview(farm),/data-action/)
  farm.beds[4]={kind:'crop',crop:'carrot',growth:1,watered:false}
  const html=renderRestPreview(farm)
  assert.match(html,/Созревший урожай останется на грядках до сбора/);assert.doesNotMatch(html,/data-action="focus-bed"/)
  assert.match(html,/День начнётся только по кнопке «До утра»/)
})

test('rest shortcut only visits home and the sleep branch requires an open preview with the current day token', async () => {
  const main=await readFile(new URL('../src/main.ts',import.meta.url),'utf8')
  const shortcut=main.slice(main.indexOf("case 'visit-rest':"),main.indexOf("case 'sleep':"))
  assert.match(shortcut,/visitPanelAt\('home','rest'\)/);assert.doesNotMatch(shortcut,/endDay|perform|saveFarm/)
  const sleep=main.slice(main.indexOf("case 'sleep':"),main.indexOf("case 'refill':"))
  assert.match(sleep,/panel !== 'rest' \|\| !dialog.open \|\| !canConfirmRest\(farm,value\)/)
  assert.match(main,/button\('До утра', 'sleep', true, \{value:farm.day\}\)/)
})

 test('opening a local home panel does not require owning a boat', async () => {
  const main=await readFile(new URL('../src/main.ts',import.meta.url),'utf8')
  const visit=main.slice(main.indexOf('async function visitPanelAt'),main.indexOf('function openPanel'))
  assert.ok(visit.indexOf('farm.island === destination') < visit.indexOf('!canSailTo(farm,destination)'))
  assert.ok(visit.indexOf('farm.island === destination') > visit.indexOf('island.isCrossing()'))
})
