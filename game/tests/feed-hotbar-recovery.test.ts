import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { buyFeed, feedChickens, restoreCurrentFarm } from '../src/farm.ts'
import { canMixBedtimeFeed } from '../src/chicken-feed.ts'
import { chickenCarePlayer } from './fixtures/chicken-care-player.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const start=main.indexOf("    case 'feed':",main.indexOf('function useHotbar('))
const branch=stripTypeScriptTypes("switch('feed'){"+main.slice(start,main.indexOf("    case 'basket':",start))+'}')
test('empty feed shortcut reveals the existing coop choice only when a hungry flock can use a harvest mix',()=>{
 const player=chickenCarePlayer('garden');player.day();player.act('endDay');player.day();player.act('endDay')
 player.act('workBed',4);player.act('workBed',9);player.act('pickFruit',0)
 assert.ok(canMixBedtimeFeed(player.state))
 for(const situation of ['harvest','stock','already-fed','no-wheat','only-apple','locked-coop']){
  const farm=structuredClone(player.state)
  if(situation==='stock'||situation==='already-fed')assert.ok(buyFeed(farm).ok)
  if(situation==='already-fed')assert.ok(feedChickens(farm).ok)
  if(situation==='no-wheat')farm.produce.wheat=0
  if(situation==='only-apple')farm.produce.carrot=0
  if(situation==='locked-coop')farm.buildingLevels.coop=1
  const expected=structuredClone(farm),recover=situation==='harvest'||situation==='only-apple',calls:string[]=[]
  const choice={};runInNewContext(branch,{farm,canMixBedtimeFeed,feedChickens,island:{visit:({kind})=>calls.push('visit:'+kind)},
   openPanel:(panel:string)=>calls.push(panel),dialogContent:{querySelector:(sel:string)=>{assert.equal(sel,'[data-coop-feed-compare], [data-action="chicken-feed-open"]');assert.equal(calls.at(-1),'coop');return choice}},
   highlightControl:(el:object)=>{assert.equal(el,choice);calls.push('show choice')},
   perform:(fn:Function)=>{calls.push('try feed');return fn().ok},playBaySound:(id:string)=>calls.push(id),
  })
  if(recover){assert.deepEqual(calls,['visit:coop','coop','show choice'])}
  else {const result=feedChickens(expected);assert.deepEqual(calls,['visit:coop','try feed',...(result.ok?['flock.feed']:[])])}
  assert.deepEqual(farm,expected);if(situation==='harvest')assert.deepEqual(restoreCurrentFarm(structuredClone(farm)),farm)
 }
})
