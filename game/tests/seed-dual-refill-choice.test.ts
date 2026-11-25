import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { buySeeds, restoreCurrentFarm, type CropId, type FarmState } from '../src/farm.ts'
import { seedChoice, chooseSeedForBed } from '../src/seed-choice.ts'
import { renderSeedPicker } from '../src/seed-picker-ui.ts'
import { seedProductionFocus } from '../src/seed-production-focus.ts'
import { seedSavingQuote, saveCropSeeds } from '../src/seed-saving.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const crop='wheat',bed=2
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const source=stripTypeScriptTypes("switch('save-crop-seeds'){"+main.slice(main.indexOf("    case 'save-crop-seeds':"),main.indexOf("    case 'preview-seed':"))+'}')
const art={icon:()=>'',button:(label:string,action:string,enabled:boolean,options:{value?:string;crop?:CropId;cost?:{amount:number}})=>
  `<button type="button" data-action="${action}" data-value="${options.value??''}" data-crop="${options.crop??''}"${enabled?'':' disabled'}>${label}${options.cost?' · '+options.cost.amount:''}</button>`}

function earned(){
  const p=commissionPlayer([])
  p.act('workBed',4,0);p.act('selectSeed',crop);p.act('workBed',4,0);p.act('workBed',13,0);p.act('workBed',bed,0)
  assert.equal(p.state.day,1);assert.equal(p.state.seeds.wheat,0);assert.equal(p.state.produce.wheat,3)
  assert.equal(p.state.beds[bed].kind,'tilled')
  assert.ok(p.state.coins>=4)
  return p
}
const view=(state:FarmState)=>renderSeedPicker(state,crop,bed,art)
const control=(html:string,action:string)=>[...html.matchAll(/<button\b[^>]*>/g)].find(([tag])=>tag.includes(`data-action="${action}"`))?.[0]
const choicesBefore=(html:string,action:string)=>{
  const index=html.indexOf(`data-action="${action}"`)
  assert.ok(index>0)
  return (html.slice(0,index).match(/data-action="preview-seed"/g)??[]).length
}
const normal=(farm:FarmState)=>restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!

test('an empty wheat packet offers both already-possible refills before the ten unrelated crop tiles',t=>{
  const p=earned(),f=p.state,before=structuredClone(f),html=view(f)
  const buy=control(html,'buy-seeds'), exchange=control(html,'save-crop-seeds')
  assert.ok(buy && exchange);assert.doesNotMatch(buy+exchange,/ disabled/)
  t.diagnostic(JSON.stringify({day:f.day,earnedActions:p.actions,ordinaryWheat:f.produce.wheat,coins:f.coins,seedCount:f.seeds.wheat,buyBeforeTiles:choicesBefore(html,'buy-seeds'),exchangeBeforeTiles:choicesBefore(html,'save-crop-seeds')}))
  assert.equal(choicesBefore(html,'buy-seeds'),0)
  assert.equal(choicesBefore(html,'save-crop-seeds'),0)
  assert.ok(html.indexOf('data-action="buy-seeds"')<html.indexOf('data-action="save-crop-seeds"'),'keep the existing coin-first reading order')
  assert.match(html,/Только обычный урожай: пшеница ×1/)
  assert.equal((html.match(/data-action="buy-seeds"/g)??[]).length,1)
  assert.equal((html.match(/data-action="save-crop-seeds"/g)??[]).length,1)
  assert.equal((html.match(/data-action="preview-seed"/g)??[]).length,10)
  assert.deepEqual(f,before)
  const coin=normal(f), harvest=normal(f), quote=seedSavingQuote(f,crop)!
  assert.ok(buySeeds(coin,crop).ok)
  assert.ok(saveCropSeeds(harvest,quote.token).ok)
  assert.deepEqual(coin,{...before,coins:before.coins-4,seeds:{...before.seeds,wheat:3}})
  assert.deepEqual(harvest,{...before,produce:{...before.produce,wheat:2},seeds:{...before.seeds,wheat:3},workToday:before.workToday+1})
  for(const state of [coin,harvest]){
    assert.equal(state.beds[bed].kind,'tilled')
    assert.equal(choicesBefore(view(state),'choose-seed'),0)
    assert.equal(choicesBefore(view(state),'save-crop-seeds'),10,'restocking a packet remains an optional later action')
    assert.ok(chooseSeedForBed(state,crop,bed,seedChoice(state,crop,bed).token).ok)
    assert.equal(state.beds[bed].kind,'tilled');assert.equal(state.seeds.wheat,3)
  }
  assert.equal(saveCropSeeds(harvest,quote.token).ok,false)
})

test('focus returns to non-spending same-crop selection after explicitly using the now-raised refill',t=>{
  for(const panel of ['seeds','inventory']){
    const farm=normal(earned().state), before=structuredClone(farm),old=seedSavingQuote(farm,crop)!, tested=[]
    const oldControl={parentElement:{classList:{contains:()=>false}}}, close={}
    const document={activeElement:oldControl as unknown}
    const choices=()=>[...view(farm).matchAll(/<button\b[^>]*>/g)].map(([tag])=>{
      const dataset=Object.fromEntries([...tag.matchAll(/data-(action|value)="([^"]*)"/g)].map(([,k,v])=>[k,v]))
      return {dataset,disabled:tag.includes(' disabled'),focus(){tested.push({...dataset})}}
    })
    const bindings={farm,previewSeed:crop,seedPickerBed:bed,value:old.token,control:oldControl,document,
      event:{detail:0},dialog:{open:true},panel,bagTab:'seeds',
      seedSavingQuote,saveCropSeeds,seedChoice,seedProductionFocus,dialogContent:{querySelectorAll:choices},
      perform(action:()=>{ok:boolean}){const r=action();if(r.ok)document.activeElement=close;return r.ok}}
    runInNewContext(source,bindings)
    t.diagnostic(JSON.stringify({panel,focus:tested.map(x=>x.action),wheatRemaining:farm.produce.wheat,packet:farm.seeds.wheat}))
    assert.deepEqual(tested,[{action:'choose-seed',value:seedChoice(farm,crop,bed).token}])
    assert.deepEqual(farm,{...before,produce:{...before.produce,wheat:2},seeds:{...before.seeds,wheat:3},workToday:before.workToday+1})
    runInNewContext(source,bindings)
    assert.equal(tested.length,1);assert.equal(farm.seeds.wheat,3)
  }
})

test('unaﬀordable, missing, already-stocked and foreign routes retain their existing controls',()=>{
  const poor=earned()
  poor.act('buySeeds','pumpkin');poor.act('buySeeds','blueberry');poor.act('buyFeed')
  assert.equal(poor.state.coins,2)
  const end=view(poor.state)
  assert.equal(choicesBefore(end,'save-crop-seeds'),0)
  assert.match(control(end,'buy-seeds')??'',/ disabled/)
  assert.equal(choicesBefore(end,'buy-seeds'),10)
  const noCrop=earned()
  noCrop.act('sellMarketItem','produce:wheat',3)
  assert.equal(choicesBefore(view(noCrop.state),'buy-seeds'),0)
  assert.match(control(view(noCrop.state),'save-crop-seeds')??'',/ disabled/)
  assert.equal(choicesBefore(view(noCrop.state),'save-crop-seeds'),10)
  noCrop.act('buySeeds','wheat')
  assert.equal(choicesBefore(view(noCrop.state),'choose-seed'),0)
  assert.equal(choicesBefore(view(noCrop.state),'save-crop-seeds'),10)
  const across=earned()
  across.act('sellMarketItem','produce:wheat',2)
  const apple=across.state.trees.home[0];assert.ok(apple?.fruitReady)
  across.act('pickFruit',0);across.act('sellMarketItem','fruit:apple',across.state.fruit.apple)
  across.act('buyBoat');across.visit('grove')
  assert.equal(across.state.produce.wheat,1)
  assert.doesNotMatch(view(across.state),/data-action="save-crop-seeds"/)
})
