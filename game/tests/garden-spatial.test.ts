import assert from 'node:assert/strict'
import test from 'node:test'
import { createFarm } from '../src/farm.ts'
import { BedTransplantSelection, renderBedTransplant } from '../src/bed-transplant.ts'
import { BerryNurserySelection, renderBerryNursery } from '../src/berry-nursery.ts'

function fixture() {
  const farm = createFarm()
  farm.beds = farm.beds.map(() => ({kind:'tilled'}))
  farm.beds[5] = {kind:'crop',crop:'carrot',growth:0,watered:true,trait:'rainbow'}
  farm.beds[14] = {kind:'crop',crop:'blueberry',growth:3,watered:false,trait:'dew'}
  farm.beds[15] = {kind:'empty'}
  return farm
}
function indices(html: string) {
  return [...html.matchAll(/class="transplant-bed garden-cell[^>]*data-value="(\d+)"/g)].map(x=>Number(x[1]))
}
test('both spatial choosers retain every physical index and expose coordinates, stage and action',()=>{
  const farm=fixture(), transplant=new BedTransplantSelection(), nursery=new BerryNurserySelection()
  for (const render of [()=>renderBedTransplant(farm,transplant),()=>renderBerryNursery(farm,nursery,()=> '')]) {
    const html=render()
    assert.deepEqual(indices(html),Array.from({length:16},(_,i)=>i))
    assert.match(html,/Грядка 6, ряд 2, место 2[^"]*Морковь[^"]*Рост: 0\/1[^"]*Сегодня полито/)
    assert.match(html,/Грядка 16, ряд 4, место 4[^"]*Целина/)
    assert.doesNotMatch(html,/role="grid"/)
    assert.match(html,/data-frame="0"/)
  }
  transplant.choose(farm,5); nursery.choose(farm,14)
  const move=renderBedTransplant(farm,transplant), divide=renderBerryNursery(farm,nursery,()=> '')
  assert.match(move,/data-value="5"[^>]*aria-pressed="true"/)
  assert.match(move,/Пересадить сюда/);assert.match(divide,/Выбрать вторую грядку/)
  assert.ok(move.indexOf('garden-summary')<move.indexOf('class="transplant-beds garden-map"'))
  assert.ok(divide.indexOf('garden-summary')<divide.indexOf('class="transplant-beds garden-map"'))
})
test('spatial views and cancelled selections are pure; nursery consequence remains explicit',()=>{
  const farm=fixture(),before=structuredClone(farm), nursery=new BerryNurserySelection()
  nursery.choose(farm,14); nursery.destination(farm,9)
  const html=renderBerryNursery(farm,nursery,()=> '')
  assert.match(html,/garden-nursery-confirm/)
  assert.match(html,/Готовый урожай сейчас не получите/)
  assert.match(html,/Возраст обеих посадок начнётся с нуля/)
  assert.match(html,/3 ночи/);assert.match(html,/Чернике достаточно одного полива/)
  assert.match(html,/data-action="berry-nursery-confirm"/)
  assert.match(html,/Грядка 15/);assert.match(html,/Грядка 10/)
  assert.deepEqual(farm,before); nursery.reset(); assert.deepEqual(farm,before)
})
