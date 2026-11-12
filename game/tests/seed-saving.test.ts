import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createFarm,workBed,restoreCurrentFarm} from '../src/farm.ts'
import {seedSavingQuote,saveCropSeeds} from '../src/seed-saving.ts'

test('one harvested ordinary carrot becomes three seeds without planting or changing money and progress',()=>{
  const farm=createFarm();assert.ok(workBed(farm,9,0).ok)
  const before=structuredClone(farm),quote=seedSavingQuote(farm,'carrot')!
  assert.equal(quote.available,true);assert.equal(quote.produce,3);assert.equal(quote.remaining,2)
  assert.equal(quote.seeds,3);assert.equal(quote.total,6);assert.deepEqual(farm,before)
  assert.ok(saveCropSeeds(farm,quote.token).ok)
  const expected=structuredClone(before);expected.produce.carrot=2;expected.seeds.carrot=6;expected.workToday++
  assert.deepEqual(farm,expected)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),expected)
  assert.equal(saveCropSeeds(farm,quote.token).ok,false);assert.deepEqual(farm,expected)
})
