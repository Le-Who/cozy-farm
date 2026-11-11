import assert from 'node:assert/strict'
import {test} from 'node:test'
import {ActionClickGuard,ActivationKeyGuard,isGuardedAction} from '../src/action-click-guard.ts'
import {buyFeed,feedChickens,feedBagPrice,feedBagSize,getCoopMorning,restoreFarm,endDay} from '../src/farm.ts'
import {supplyPurchasesFixture} from './fixtures/supply-purchases.ts'

const event=(timeStamp:number,detail=1)=>({timeStamp,detail,clientX:40,clientY:80})

test('the feed purchase owns its click and key activation through redraw',()=>{
  assert.ok(isGuardedAction('buy-feed'))
})

test('a double purchase in the home preview does not activate the replacement feeding button',()=>{
  const {farm}=supplyPurchasesFixture(),before=structuredClone(farm),guard=new ActionClickGuard()
  const activate=(action:'buy-feed'|'feed',timeStamp:number,detail=1)=>{
    const click=event(timeStamp,detail)
    if(guard.blocks(click))return false
    if(isGuardedAction(action))guard.remember(click)
    return (action==='buy-feed'?buyFeed(farm):feedChickens(farm)).ok
  }
  assert.equal(activate('buy-feed',100),true)
  assert.equal(activate('feed',180,2),false)
  const expected=structuredClone(before);expected.coins-=feedBagPrice;expected.feed+=feedBagSize
  assert.deepEqual(farm,expected,'purchase alone has no feeding, task reward, work or sleep')
  assert.equal(getCoopMorning(farm).added,0)
  assert.equal(activate('feed',200,0),true,'an independent keyboard confirmation still feeds')
  assert.equal(farm.chickensFed,true);assert.equal(farm.feed,feedBagSize-1)
  assert.equal(farm.progress.feed,before.progress.feed+1)
  assert.equal(farm.coins,50,'the existing first-feed reward of 4 coins remains')
  assert.equal(farm.eggsReady,6);assert.equal(getCoopMorning(farm).added,0,'full nests do not gain an extra egg')
})

test('a market double-click buys one bag but a deliberate later purchase buys another',()=>{
  const {farm}=supplyPurchasesFixture(),guard=new ActionClickGuard()
  const buy=(stamp:number,detail=1)=>{
    const click=event(stamp,detail)
    if(guard.blocks(click))return false
    if(isGuardedAction('buy-feed'))guard.remember(click)
    return buyFeed(farm).ok
  }
  assert.equal(buy(100),true);assert.equal(buy(170,2),false)
  assert.equal(farm.feed,feedBagSize);assert.equal(farm.coins,50-feedBagPrice)
  assert.equal(buy(701),true);assert.equal(farm.feed,2*feedBagSize);assert.equal(farm.coins,50-2*feedBagPrice)
  assert.equal(farm.chickensFed,false);assert.equal(farm.progress.feed,0)
})

test('a held activation remains blocked when focus moves to feeding, close or rest',()=>{
  for(const key of ['Enter',' ']){
    const keys=new ActivationKeyGuard()
    assert.equal(keys.blocks({key,repeat:false},isGuardedAction('buy-feed')),false)
    assert.equal(keys.blocks({key,repeat:true},false),true)
    assert.equal(keys.blocks({key,repeat:true},false),true)
    keys.release(key)
    assert.equal(keys.blocks({key,repeat:false},false),false)
  }
})

test('reload preserves an unused bag; only deliberate feeding affects the next morning',()=>{
  const {farm}=supplyPurchasesFixture();farm.eggsReady=0
  assert.equal(buyFeed(farm).ok,true)
  const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(loaded)
  assert.equal(loaded.feed,feedBagSize);assert.equal(loaded.chickensFed,false);assert.equal(getCoopMorning(loaded).added,0)
  const unfed=structuredClone(loaded)
  assert.equal(endDay(unfed).ok,true);assert.equal(unfed.eggsReady,0);assert.equal(unfed.feed,feedBagSize)
  assert.equal(feedChickens(loaded).ok,true)
  const eggs=getCoopMorning(loaded).added
  assert.ok(eggs>0);assert.equal(endDay(loaded).ok,true);assert.equal(loaded.eggsReady,eggs)
  assert.equal(loaded.feed,feedBagSize-1);assert.ok(restoreFarm(loaded))
})

test('insufficient coins and repeated feeding keep their original atomic refusal',()=>{
  const {farm}=supplyPurchasesFixture();farm.coins=feedBagPrice-1
  const before=structuredClone(farm)
  assert.equal(buyFeed(farm).ok,false);assert.deepEqual(farm,before)
  farm.feed=1;assert.equal(feedChickens(farm).ok,true)
  const fed=structuredClone(farm)
  assert.equal(feedChickens(farm).ok,false);assert.deepEqual(farm,fed)
})
