import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { ActionClickGuard, ActivationKeyGuard, isGuardedAction } from '../src/action-click-guard.ts'
import { contributeFestival, getFestivalStatus, restoreFarm, sail, endDay } from '../src/farm.ts'
import { festivalContributionsFixture } from './fixtures/festival-contributions.ts'

const click = (timeStamp: number, detail = 1) => ({timeStamp, detail, clientX: 80, clientY: 140})

test('a festival contribution owns its activation gesture through the installed UI guard', () => {
  const ui=readFileSync(new URL('../src/bay-festival-ui.ts',import.meta.url),'utf8')
  assert.match(ui, /'festival-contribute'/)
  assert.ok(isGuardedAction('festival-contribute'))
})

test('a double-click contributes exactly one fruit and a separate Enter contributes the next', () => {
  const {farm}=festivalContributionsFixture(), guard=new ActionClickGuard(), coins=farm.coins
  const activate=(stamp:number,detail=1)=>{
    const event=click(stamp,detail)
    if(guard.blocks(event))return false
    if(isGuardedAction('festival-contribute'))guard.remember(event)
    return contributeFestival(farm,'fruit','apple').ok
  }
  assert.equal(activate(100),true);assert.equal(activate(180,2),false)
  assert.equal(farm.fruit.apple,5);assert.equal(farm.festivals.active!.delivered.fruit,1)
  assert.equal(farm.festivals.active!.materialValue,4);assert.equal(farm.coins,coins)
  assert.equal(activate(200,0),true);assert.equal(farm.fruit.apple,4)
  assert.equal(farm.festivals.active!.delivered.fruit,2)
  const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(loaded);assert.deepEqual(loaded.festivals,farm.festivals);assert.equal(loaded.fruit.apple,4)
})

test('a final contribution cannot leak onto the rest link after redraw', () => {
  const {farm}=festivalContributionsFixture('last'), guard=new ActionClickGuard(), before=structuredClone(farm)
  guard.remember(click(100));assert.equal(contributeFestival(farm,'fruit','apple').ok,true)
  assert.equal(farm.fruit.apple,before.fruit.apple-1)
  assert.equal(getFestivalStatus(farm).active!.waitingNight,true)
  assert.equal(guard.blocks(click(150,2)),true);assert.equal(guard.blocks(click(160,1)),true)
  assert.equal(farm.day,before.day);assert.equal(farm.island,'village')
  assert.equal(guard.blocks(click(700)),false,'a deliberate later departure remains possible')
})

test('held Enter or Space cannot spend another portion or activate a replacement control', () => {
  for(const key of ['Enter',' ']){
    const keys=new ActivationKeyGuard()
    assert.equal(keys.blocks({key,repeat:false},isGuardedAction('festival-contribute')),false)
    assert.equal(keys.blocks({key,repeat:true},false),true,'focus can move to a close or rest control')
    assert.equal(keys.blocks({key,repeat:true},true),true)
    keys.release(key)
    assert.equal(keys.blocks({key,repeat:false},true),false)
  }
})

test('stale stage, missing stock and a wrong shore cannot consume supplies', () => {
  const {farm}=festivalContributionsFixture('last')
  assert.equal(contributeFestival(farm,'fruit','apple').ok,true)
  const waiting=structuredClone(farm)
  assert.equal(contributeFestival(farm,'fruit','apple').ok,false);assert.deepEqual(farm,waiting)
  assert.equal(sail(farm,'home').ok,true);assert.equal(endDay(farm).ok,true)
  const away=structuredClone(farm)
  assert.equal(contributeFestival(farm,'roots','carrot').ok,false);assert.deepEqual(farm,away)
  assert.equal(sail(farm,'village').ok,true)
  const current=structuredClone(farm)
  assert.equal(contributeFestival(farm,'fruit','apple').ok,false);assert.deepEqual(farm,current)
  farm.produce.carrot=0
  const missing=structuredClone(farm)
  assert.equal(contributeFestival(farm,'roots','carrot').ok,false);assert.deepEqual(farm,missing)
})
