import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFarm, restoreFarm, type StockItem } from '../src/farm.ts';
import { getLocalWarehouseSupply, warehouseRequest, warehouseRequestValue, warehouseSupplyCopy, warehouseConfirmation, warehouseConfirmationValue, withdrawWarehouseSupply } from '../src/warehouse-guidance.ts';
import { getRequirementHint } from '../src/requirement-guidance.ts';
import { getSupplyGuidance } from '../src/discovery-path.ts';
import { isGuardedAction } from '../src/action-click-guard.ts';

const wheat: StockItem = { kind:'produce', item:'wheat', quantity:1 };
function quote(item: StockItem, quantity: number, port='home') { return {id:warehouseRequestValue(item).split('|')[0],needed:item.quantity,quantity,port}; }
function fixture() { const farm=createFarm();farm.boatOwned=true;farm.buildingLevels.farmhouse=2;farm.freight.warehouses.home.wheat=2;return farm; }

test('a kitchen ingredient and the general task point to the existing local stock without taking it', () => {
  const farm=fixture(), before=structuredClone(farm);
  const hint=getRequirementHint(farm,{kind:'stock',item:wheat}), task=getSupplyGuidance(farm,wheat,'пирог');
  assert.deepEqual(hint.action,task.action);assert.equal(hint.action.target,'warehouse-supply');assert.equal(hint.action.value,'wheat|1');
  assert.deepEqual(getLocalWarehouseSupply(farm,wheat),{id:'wheat',port:'home',carried:0,stored:2,quantity:1,needed:1});
  assert.deepEqual(farm,before);assert.ok(restoreFarm(farm));
  const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.deepEqual(getRequirementHint(loaded,{kind:'stock',item:wheat}),hint);
});

test('the explicit transfer takes only the shortage and survives reload without work, reward or crafting', () => {
  const farm=fixture(), before=structuredClone(farm);
  assert.equal(withdrawWarehouseSupply(farm,wheat,quote(wheat,1)).ok,true);
  const expected=structuredClone(before);expected.produce.wheat=1;expected.freight.warehouses.home.wheat=1;
  assert.deepEqual(farm,expected);const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(loaded);
  assert.equal(loaded.produce.wheat,1);assert.equal(loaded.freight.warehouses.home.wheat,1);
  assert.equal(getLocalWarehouseSupply(loaded,wheat),undefined);assert.match(warehouseSupplyCopy(loaded,wheat),/уже в припасах/);
  const after=structuredClone(loaded);assert.equal(withdrawWarehouseSupply(loaded,wheat,quote(wheat,1)).ok,false);assert.deepEqual(loaded,after);
});

test('partial stock uses the current missing amount and refuses a stale quote', () => {
  const farm=fixture(), request={...wheat,quantity:3};
  assert.equal(getLocalWarehouseSupply(farm,request)?.quantity,2);
  farm.produce.wheat=2;const before=structuredClone(farm);
  assert.equal(withdrawWarehouseSupply(farm,request,quote(request,2)).ok,false);assert.deepEqual(farm,before);
  assert.equal(getLocalWarehouseSupply(farm,request)?.quantity,1);
  assert.equal(withdrawWarehouseSupply(farm,request,quote(request,1)).ok,true);assert.equal(farm.produce.wheat,3);assert.equal(farm.freight.warehouses.home.wheat,1);
});

test('a stock change or missing request cannot spend anything', () => {
  const farm=fixture();farm.freight.warehouses.home.wheat=1;const before=structuredClone(farm);
  for(const expected of [0,-1,2,1.5,NaN,Infinity]){assert.equal(withdrawWarehouseSupply(farm,{...wheat,quantity:2},quote({...wheat,quantity:2},expected)).ok,false);assert.deepEqual(farm,before);}
  assert.equal(withdrawWarehouseSupply(farm,undefined,quote(wheat,1)).ok,false);assert.deepEqual(farm,before);
});

test('remote goods and inaccessible local warehouses do not create a false path', () => {
  const farm=fixture();farm.freight.warehouses.home={};farm.freight.warehouses.grove.wheat=2;
  assert.equal(getLocalWarehouseSupply(farm,wheat),undefined);
  assert.notEqual(getRequirementHint(farm,{kind:'stock',item:wheat}).action.target,'warehouse-supply');
  farm.freight.warehouses.home.wheat=2;farm.boatOwned=false;const before=structuredClone(farm);
  assert.equal(getLocalWarehouseSupply(farm,wheat),undefined);assert.equal(withdrawWarehouseSupply(farm,wheat,quote(wheat,1)).ok,false);assert.deepEqual(farm,before);
});

test('early legacy wax and packed crates stay on their valid warehouse instead of corrupting the bag', () => {
  const farm=fixture();farm.freight.warehouses.home.beeswax=2;farm.freight.warehouses.home.eggCrates=1;assert.ok(restoreFarm(farm));
  const before=structuredClone(farm);
  for(const item of [{kind:'beeswax',quantity:1},{kind:'eggCrates',quantity:1}] as const) {
    assert.equal(getLocalWarehouseSupply(farm,item),undefined);assert.equal(withdrawWarehouseSupply(farm,item,quote(item,1)).ok,false);
  }
  assert.deepEqual(farm,before);assert.ok(restoreFarm(farm));
});

test('a requested rare variant cannot be replaced by an ordinary warehouse item', () => {
  const farm=fixture(), item={kind:'variants',item:'wheat',trait:'rainbow',quantity:1} as const;
  assert.equal(getLocalWarehouseSupply(farm,item),undefined);
  assert.deepEqual(warehouseRequest(warehouseRequestValue(item)),item);
  farm.freight.warehouses.home['variants:wheat:rainbow']=1;assert.ok(restoreFarm(farm));
  assert.equal(withdrawWarehouseSupply(farm,item,quote(item,1)).ok,true);
  assert.equal(farm.variants.wheat?.rainbow,1);assert.equal(farm.produce.wheat,0);assert.equal(farm.freight.warehouses.home.wheat,2);assert.ok(restoreFarm(farm));
});

test('request parsing only accepts catalogue goods and bounded integer needs', () => {
  assert.deepEqual(warehouseRequest('wheat|2'),{...wheat,quantity:2});
  for(const value of [undefined,'unknown|1','wheat|0','wheat|-1','wheat|1.5','wheat|Infinity','wheat|1000000','wheat|1|2','__proto__|1'])assert.equal(warehouseRequest(value),undefined);
});

test('navigation and explicit transfer own repeat activation across redraw', () => {
  for(const action of ['show-requirement','warehouse-supply','warehouse-supply-withdraw'])assert.ok(isGuardedAction(action));
});

test('confirmation stays bound to the shown shore, product and total need', () => {
  const farm=fixture(), original=quote(wheat,1);
  assert.deepEqual(warehouseConfirmation(warehouseConfirmationValue(original)),original);
  for(const value of [undefined,'home|wheat|1','home|wheat|1|1|x','unknown|wheat|1|1','home|wheat|1|2','home|__proto__|1|1'])assert.equal(warehouseConfirmation(value),undefined);
  farm.island='grove';farm.freight.warehouses.grove.wheat=2;farm.freight.warehouses.grove.carrot=2;
  const before=structuredClone(farm);
  assert.equal(withdrawWarehouseSupply(farm,wheat,original).ok,false);
  assert.equal(withdrawWarehouseSupply(farm,{kind:'produce',item:'carrot',quantity:1},{...original,port:'grove'}).ok,false);
  assert.equal(withdrawWarehouseSupply(farm,{...wheat,quantity:2},{...original,port:'grove',quantity:2}).ok,false);
  assert.deepEqual(farm,before);
});
