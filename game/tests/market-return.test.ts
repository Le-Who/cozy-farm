import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFarm, getMarketOrders, deliverMarketOrder, endDay, restoreFarm } from '../src/farm.ts';
import { canVisitMarketRest, getNextMarketOrders, renderNextMarketOrder } from '../src/market-return.ts';
import { isGuardedAction } from '../src/action-click-guard.ts';
function deliveredGarden() {
  const farm=createFarm();farm.produce.cabbage=2;farm.produce.tomato=1;
  assert.ok(deliverMarketOrder(farm,'garden').ok);return farm;
}

test('only delivered lanes get a next-morning preview, and reading leaves the whole farm unchanged', () => {
  const farm=createFarm();assert.deepEqual(getNextMarketOrders(farm),[]);
  farm.produce.cabbage=2;farm.produce.tomato=1;assert.deepEqual(getNextMarketOrders(farm),[]);
  deliverMarketOrder(farm,'garden');const before=structuredClone(farm), next=getNextMarketOrders(farm);
  assert.equal(next.length,1);assert.equal(next[0].lane,'garden');assert.equal(next[0].name,'Ящик корнеплодов');assert.equal(next[0].day,2);
  assert.deepEqual(next[0].items,[{kind:'produce',item:'carrot',quantity:3},{kind:'produce',item:'beetroot',quantity:2}]);assert.deepEqual(farm,before);
  assert.deepEqual(getNextMarketOrders(restoreFarm(JSON.parse(JSON.stringify(farm)))!),next);
});

test('the preview exactly matches an explicit next morning, which never completes a delivery', () => {
  const farm=deliveredGarden(), next=getNextMarketOrders(farm)[0], {day,...order}=next;
  const coins=farm.coins, ledger=structuredClone(farm.orders.garden), produce=structuredClone(farm.produce);
  assert.ok(endDay(farm).ok);assert.equal(farm.day,day);assert.deepEqual(getMarketOrders(farm).find(o=>o.lane==='garden'),order);
  assert.equal(farm.coins,coins);assert.deepEqual(farm.orders.garden,ledger);assert.deepEqual(farm.produce,produce);assert.deepEqual(getNextMarketOrders(farm),[]);assert.ok(restoreFarm(farm));
});

test('sleeping multiple times does not rotate an unfinished market request', () => {
  const farm=deliveredGarden();endDay(farm);const next=getMarketOrders(farm), completed=farm.orders.garden.completed;
  for(let i=0;i<4;i++){endDay(farm);assert.deepEqual(getMarketOrders(farm),next);assert.deepEqual(getNextMarketOrders(farm),[]);}
  assert.equal(farm.orders.garden.completed,completed);assert.ok(restoreFarm(farm));
});

test('all six early market lanes preview from the current rules rather than a duplicate menu', () => {
  const farm=createFarm();farm.boatOwned=true;farm.buildingLevels={farmhouse:2,coop:2,well:2};
  const orders=getMarketOrders(farm);assert.equal(orders.length,6);
  for(const order of orders)for(const item of order.items){
    if(item.kind==='produce')farm.produce[item.item]+=item.quantity;
    else if(item.kind==='dishes')farm.dishes[item.item]+=item.quantity;
    else if(item.kind==='fish')farm.fish[item.item]+=item.quantity;
    else if(item.kind==='eggs'||item.kind==='eggBaskets'||item.kind==='seaSalt')farm[item.kind]+=item.quantity;
  }
  for(const order of orders)assert.ok(deliverMarketOrder(farm,order.lane).ok);
  const preview=getNextMarketOrders(farm);assert.equal(preview.length,6);assert.ok(restoreFarm(farm));
  endDay(farm);for(const {day,...order} of preview)assert.deepEqual(getMarketOrders(farm).find(o=>o.lane===order.lane),order);
});

test('ready supplies cannot bypass the delivered-day limit or pay another reward', () => {
  const farm=deliveredGarden();farm.produce.carrot=3;farm.produce.beetroot=2;const before=structuredClone(farm);
  assert.equal(getNextMarketOrders(farm)[0].status,'ready');assert.equal(deliverMarketOrder(farm,'garden').ok,false);assert.deepEqual(farm,before);
  endDay(farm);const quote=getMarketOrders(farm).find(o=>o.lane==='garden')!, coins=farm.coins;
  assert.ok(deliverMarketOrder(farm,'garden').ok);assert.equal(farm.coins,coins+quote.reward);assert.equal(farm.produce.carrot,0);assert.equal(farm.produce.beetroot,0);
  const after=structuredClone(farm);assert.equal(deliverMarketOrder(farm,'garden').ok,false);assert.deepEqual(farm,after);
});

test('the future card contains requirements but never a future delivery or sleep command', () => {
  const farm=deliveredGarden(), before=structuredClone(farm), next=getNextMarketOrders(farm)[0];
  const html=renderNextMarketOrder(next,item=>`<li>${item.kind}:${'item' in item?item.item:''}×${item.quantity}</li>`);
  assert.match(html,/После отдыха · день 2/);assert.match(html,/Можно подготовить/);assert.match(html,/carrot×3/);assert.match(html,/beetroot×2/);
  assert.doesNotMatch(html,/deliver-order|data-action="rest"|<button/);assert.deepEqual(farm,before);assert.ok(isGuardedAction('market-next-rest'));
  assert.doesNotMatch(renderNextMarketOrder({...next,name:'<img onerror=x>'},()=>''),/<img/);
});


test('a stale rest link is rejected outside the shown orders page or after its morning changes', () => {
  const farm=deliveredGarden(), day=String(farm.day), context={panel:'market',open:true,tab:'orders'}, before=structuredClone(farm);
  assert.ok(canVisitMarketRest(farm,day,context));
  assert.equal(canVisitMarketRest(farm,day,{...context,open:false}),false);
  assert.equal(canVisitMarketRest(farm,day,{...context,panel:'rest'}),false);
  assert.equal(canVisitMarketRest(farm,day,{...context,tab:'buy'}),false);
  assert.equal(canVisitMarketRest(farm,'0',context),false);
  assert.deepEqual(farm,before);
  endDay(farm);assert.equal(canVisitMarketRest(farm,day,context),false);
  farm.produce.carrot=3;farm.produce.beetroot=2;deliverMarketOrder(farm,'garden');const after=structuredClone(farm);
  assert.equal(canVisitMarketRest(farm,day,context),false);
  assert.ok(canVisitMarketRest(farm,String(farm.day),context));assert.deepEqual(farm,after);
});
