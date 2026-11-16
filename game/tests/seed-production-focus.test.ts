import test from 'node:test'
import assert from 'node:assert/strict'
import { seedProductionFocus } from '../src/seed-production-focus.ts'
import { readFileSync } from 'node:fs'
const control=(action:string,value:string,disabled=false)=>({dataset:{action,value},disabled})
const current={crop:'carrot',exchangeToken:'ss1|carrot|1|2|6|2',selectionToken:'sc1|home|1|carrot||0|manual|6'}

test('fresh enabled same-crop exchange wins, never the retired token',()=>{
 const stale=control('save-crop-seeds','ss1|carrot|1|3|3|1'), fresh=control('save-crop-seeds',current.exchangeToken), sow=control('choose-seed',current.selectionToken)
 const controls=[stale,sow,fresh], before=structuredClone(controls)
 assert.equal(seedProductionFocus(controls,current),fresh);assert.deepEqual(controls,before)
})

test('last ordinary product falls back to fresh sow selector, not another exchange or purchase',()=>{
 const empty=control('save-crop-seeds',current.exchangeToken,true), staleSow=control('choose-seed','old'), other=control('save-crop-seeds','ss1|wheat|1|2|6|2'), buy=control('buy-seeds','carrot'), sow=control('choose-seed',current.selectionToken)
 assert.equal(seedProductionFocus([empty,other,buy,staleSow,sow],current),sow)
})

test('only the matching read-only crop packet is a final fallback',()=>{
 const selected=control('preview-seed','carrot'), other=control('preview-seed','wheat')
 assert.equal(seedProductionFocus([other,selected],{...current,exchangeToken:undefined}),selected)
 assert.equal(seedProductionFocus([other],current),undefined)
 assert.equal(seedProductionFocus([control('preview-seed','carrot',true)],current),undefined)
})

test('host restoration follows only a successful focused hotbar conversion and never activates a control',()=>{
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'), helper=readFileSync(new URL('../src/seed-production-focus.ts',import.meta.url),'utf8')
 assert.match(main,/const ownedFocus = panel==='seeds' && document\.activeElement===control/)
 assert.match(main,/const saved = perform\(\(\)=>saveCropSeeds\(farm,value\),false,true\)\s*if\(saved&&ownedFocus&&panel==='seeds'&&dialog\.open\)/)
 assert.doesNotMatch(helper,/\.click\(|dispatchEvent|setAttribute|\.value\s*=(?!=)|localStorage/)
})
