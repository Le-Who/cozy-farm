import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarm, deliverHarborOrder, endDay, getHarborOrder, restoreFarm, sail } from '../src/farm.ts';
import { canVisitHarborRest, getNextHarborOrder, renderNextHarborOrder } from '../src/harbor-return.ts';
import { isGuardedAction } from '../src/action-click-guard.ts';
import { harborReturnFixture } from './fixtures/harbor-return.ts';

const composition=(farm:ReturnType<typeof createFarm>)=>getHarborOrder(farm)?.items.map(({item})=>item);

test('only a completed manual harbor order exposes a detached next-morning composition',()=>{
  const farm=harborReturnFixture(),before=structuredClone(farm),next=getNextHarborOrder(farm)!;
  assert.deepEqual(next,{day:4,name:'Посылка из Солёной рощи',items:[{kind:'dishes',item:'farmhouseBread',quantity:1},{kind:'seaSalt',quantity:2}]});
  assert.deepEqual(farm,before);assert.equal('reward' in next,false);
  assert.deepEqual(getNextHarborOrder(restoreFarm(JSON.parse(JSON.stringify(farm)))!),next);
  next.items[0].quantity=99;assert.deepEqual(farm,before);
  assert.equal(getNextHarborOrder(createFarm()),undefined);
});

test('the forecast matches the actual next morning without delivering or paying again',()=>{
  const farm=harborReturnFixture(),next=getNextHarborOrder(farm)!,coins=farm.coins,ledger=structuredClone(farm.orders.harbor);
  assert.ok(sail(farm,'home').ok);assert.equal(farm.day,3);assert.ok(endDay(farm).ok);
  assert.equal(farm.day,next.day);assert.equal(getHarborOrder(farm)!.name,next.name);assert.deepEqual(composition(farm),next.items);
  assert.equal(farm.coins,coins);assert.deepEqual(farm.orders.harbor,ledger);assert.deepEqual(farm.harborSupplies,{});
  assert.equal(getNextHarborOrder(farm),undefined);assert.ok(restoreFarm(farm));
});

test('both menu rotations and primary kitchen branches are derived from current rules',()=>{
  for(const branch of ['bakery','preserves'] as const) for(const completed of [1,2,3,4]) {
    const farm=harborReturnFixture();farm.farmhouseSpecialization=branch;farm.orders.harbor.completed=completed;
    const next=getNextHarborOrder(farm)!;
    assert.deepEqual(next.items,composition({...farm,day:farm.day+1}));
    const dish=next.items[0];assert.equal(dish.kind,'dishes');if(dish.kind==='dishes')assert.equal(dish.item,branch==='bakery'?'farmhouseBread':'orchardPreserves');
    assert.equal(next.items[1].kind,completed%2===1?'seaSalt':'fish');
  }
});

test('a newly learned secondary kitchen does not replace the existing primary order',()=>{
  const farm=harborReturnFixture(),before=getNextHarborOrder(farm);
  farm.farmhouseSecondarySpecialization='preserves';
  assert.deepEqual(getNextHarborOrder(farm),before);assert.ok(restoreFarm(farm));
  farm.farmhouseSpecialization='preserves';farm.farmhouseSecondarySpecialization='bakery';
  assert.notDeepEqual(getNextHarborOrder(farm),before);assert.ok(restoreFarm(farm));
});

test('an incomplete reserved parcel remains the same across nights, without a next-order preview',()=>{
  const farm=harborReturnFixture();farm.orders.harbor={completed:0,deliveredOn:0};farm.dishes.farmhouseBread=1;
  assert.ok(deliverHarborOrder(farm).ok);
  const supplies=structuredClone(farm.harborSupplies),order=getHarborOrder(farm)!,coins=farm.coins;
  assert.equal(getNextHarborOrder(farm),undefined);assert.ok(sail(farm,'home').ok);endDay(farm);endDay(farm);
  const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;
  assert.ok(loaded);assert.deepEqual(loaded.harborSupplies,supplies);assert.equal(getHarborOrder(loaded)!.name,order.name);
  assert.equal(loaded.coins,coins);assert.equal(getNextHarborOrder(loaded),undefined);
});

test('stale rest links require the correct open panel and current game day',()=>{
  const farm=harborReturnFixture(),before=structuredClone(farm),day=String(farm.day),context={panel:'harbor',open:true,tab:'buy'};
  assert.ok(canVisitHarborRest(farm,day,context));
  assert.ok(canVisitHarborRest(farm,day,{panel:'market',open:true,tab:'orders'}));
  for(const changed of [{...context,open:false},{...context,panel:'rest'},{panel:'market',open:true,tab:'buy'}])assert.equal(canVisitHarborRest(farm,day,changed),false);
  for(const stale of [undefined,'2','4','3x'])assert.equal(canVisitHarborRest(farm,stale,context),false);
  assert.deepEqual(farm,before);farm.orders.harbor.deliveredOn=0;assert.equal(canVisitHarborRest(farm,day,context),false);
  assert.ok(isGuardedAction('harbor-next-rest'));
});

test('preview copy separates preparation from automatic shipping and omits speculative rewards',()=>{
  const next=getNextHarborOrder(harborReturnFixture())!;
  const html=renderNextHarborOrder(next,item=>`<li>${item.quantity}</li>`);
  assert.match(html,/После отдыха · день 4/);assert.match(html,/основному направлению кухни/);assert.match(html,/не отправляются автоматически/);
  assert.doesNotMatch(html,/Доставить|монет|reward/);
  assert.match(renderNextHarborOrder({...next,name:'<test>'},()=>''),/&lt;test&gt;/);
});
