import assert from 'node:assert/strict'
import test from 'node:test'
import { deliverMarketOrder, getMarketOrders, restoreCurrentFarm } from '../src/farm.ts'
import { getMarketOrderBoard, renderMarketOrderPicker } from '../src/market-orders-view.ts'
import { getLocalWarehouseSupply, warehouseConfirmation, warehouseConfirmationValue, warehouseRequest, withdrawWarehouseSupply } from '../src/warehouse-guidance.ts'
import { harbourCraftReturnPlayer } from './fixtures/harbour-craft-return.ts'

test('the earned Home order recoverable from its own warehouse precedes shortages; moving stock never pays the order',()=>{
  const {p}=harbourCraftReturnPlayer();p.visit('home')
  const original=getMarketOrders(p.state).find(order=>order.lane==='pantry')!
  assert.equal(original.status,'ready');p.act('transferBayGoods','deposit','home','eggs',p.state.eggs)
  const farm=p.state, before=structuredClone(farm)
  const board=getMarketOrderBoard(farm),order=board.choices.find(o=>o.id==='pantry')!
  assert.ok(board.choices.length>=7);assert.equal(board.selected,'pantry');assert.equal(order.group,'warehouse');assert.equal(order.warehouseRequest,'eggs|1')
  const html=renderMarketOrderPicker(board,()=>''),group=html.indexOf('data-order-group="warehouse"')
  assert.ok(group>=0&&group<html.indexOf('data-order-group="waiting"'));assert.equal(getMarketOrderBoard(farm,'garden').selected,'garden')
  assert.deepEqual(farm,before);assert.equal(deliverMarketOrder(farm,'pantry').ok,false)
  // Ready bag goods take precedence. The source must cover every missing line in full, at Home.
  const other=structuredClone(farm);other.produce.carrot=3;other.produce.beetroot=2
  assert.equal(getMarketOrderBoard(other).selected,'garden')
  const partial=structuredClone(farm);partial.produce.wheat=0;partial.freight.warehouses.home.wheat=1
  assert.equal(getMarketOrderBoard(partial).choices.find(o=>o.id==='pantry')!.group,'waiting')
  partial.freight.warehouses.home.wheat=2
  assert.equal(getMarketOrderBoard(partial).choices.find(o=>o.id==='pantry')!.group,'warehouse')
  const remote=structuredClone(farm);remote.freight.warehouses.grove.eggs=3;delete remote.freight.warehouses.home.eggs
  assert.equal(getMarketOrderBoard(remote).choices.find(o=>o.id==='pantry')!.group,'waiting')
  const request=warehouseRequest(order.warehouseRequest)!,view=getLocalWarehouseSupply(farm,request)!
  assert.equal(view.quantity,1);const confirm=warehouseConfirmation(warehouseConfirmationValue(view))!
  assert.ok(withdrawWarehouseSupply(farm,request,confirm).ok);assert.equal(farm.eggs,1);assert.equal(farm.freight.warehouses.home.eggs,2)
  assert.equal(farm.coins,before.coins);assert.deepEqual(farm.orders,before.orders)
  assert.equal(getMarketOrderBoard(farm).choices.find(o=>o.id==='pantry')!.group,'ready')
  assert.equal(withdrawWarehouseSupply(farm,request,confirm).ok,false)
  const loaded=restoreCurrentFarm(structuredClone(farm))!;assert.ok(loaded)
  assert.ok(deliverMarketOrder(loaded,'pantry').ok);assert.equal(loaded.coins,before.coins+original.reward)
  assert.equal(loaded.eggs,0);assert.equal(loaded.produce.wheat,before.produce.wheat-2);assert.equal(loaded.orders.pantry.completed,before.orders.pantry.completed+1)
})
