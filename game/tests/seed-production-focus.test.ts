import test from 'node:test'
import assert from 'node:assert/strict'
import { seedProductionFocus } from '../src/seed-production-focus.ts'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { buySeeds, getBedAction } from '../src/farm.ts'
import { seedChoice } from '../src/seed-choice.ts'
import { seedSavingQuote, saveCropSeeds } from '../src/seed-saving.ts'
import { renderSeedPicker } from '../src/seed-picker-ui.ts'
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

test('after a refill focus stays by the ready selector, but an already-stocked packet keeps its same-crop exchange',()=>{
 const player=commissionPlayer([]),crop='beetroot',bed=0
 player.act('workBed',bed);while(player.state.day<5)player.night()
 player.act('selectSeed',crop);player.act('workBed',bed)
 while(getBedAction(player.state,bed).kind!=='harvest'){assert.ok(player.state.day<10);if(getBedAction(player.state,bed).kind==='water')player.act('workBed',bed,0);player.night()}
 player.act('workBed',bed);player.act('selectSeed','carrot')
 const last=structuredClone(player.state)
 player.act('workBed',5)
 const surplus=player.state.produce[crop]-2
 if(surplus>0)player.act('sellMarketItem','produce:beetroot',surplus)
 assert.equal(last.produce[crop],1);assert.equal(player.state.produce[crop],2);assert.equal(last.variants[crop]?.rainbow,1)
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 const branch=stripTypeScriptTypes("switch('save-crop-seeds'){"+main.slice(main.indexOf("    case 'save-crop-seeds':"),main.indexOf("    case 'preview-seed':"))+'}')
 const empty=[last,player.state], alreadyStocked=empty.map(start=>{
  const state=structuredClone(start);assert.ok(buySeeds(state,crop).ok);return state
 })
 assert.ok(empty.every(start=>start.seeds[crop]===0))
 assert.ok(alreadyStocked.every(start=>start.seeds[crop]===3))
 for(const start of [...empty,...alreadyStocked])for(const panel of ['inventory','seeds'])for(const [detail,owned] of [[0,true],[1,true],[0,false]] as const){
  const farm=structuredClone(start),close=control('close',''),document={activeElement:close},scrollTop=244
  const art={icon:()=>'',button:(label:string,action:string,_enabled:boolean,options:{value?:string})=>`<button data-action="${action}" data-value="${options.value??''}">${label}</button>`}
  const buttons=()=>[...renderSeedPicker(farm,crop,undefined,art).matchAll(/<button\b([^>]*)>/g)].map(([,attrs])=>{
   const el={...control(attrs.match(/data-action="([^"]+)"/)?.[1]??'',attrs.match(/data-value="([^"]+)"/)?.[1]??'',attrs.includes(' disabled')),focus(){document.activeElement=el}};return el
  })
  const old=buttons().find(b=>b.dataset.action==='save-crop-seeds')!;document.activeElement=owned?old:close
  const dialogContent={scrollTop,querySelectorAll:buttons}
  const context={farm,panel,bagTab:'seeds',dialog:{open:true},dialogContent,event:{detail},document,control:old,value:old.dataset.value,previewSeed:crop,seedPickerBed:undefined,
   seedSavingQuote,saveCropSeeds,seedChoice,seedProductionFocus,perform:(action:()=>{ok:boolean})=>{const result=action();if(result.ok)document.activeElement=close;return result.ok}}
  runInNewContext(branch,context)
  const expected=structuredClone(start);assert.ok(saveCropSeeds(expected,old.dataset.value).ok);assert.deepEqual(farm,expected)
  const shouldRepeat=start.seeds[crop]>0 && farm.produce[crop]>0
  assert.equal(document.activeElement.dataset.action,!owned||detail===1&&panel==='inventory'?'close':shouldRepeat?'save-crop-seeds':'choose-seed')
  if(document.activeElement!==close)assert.equal(document.activeElement.dataset.value,shouldRepeat?seedSavingQuote(farm,crop)!.token:seedChoice(farm,crop).token)
  assert.equal(dialogContent.scrollTop,scrollTop);assert.equal(farm.selectedSeed,'carrot');assert.deepEqual(farm.variants,start.variants)
 }
})
