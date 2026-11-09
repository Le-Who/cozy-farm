import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, restoreFarm, endDay } from '../src/farm.ts'
import { transferBayGoods, reserveShopGoods, returnShopGoods, installGardenInstrument } from '../src/harbour-economy.ts'
import { addFreightStock } from '../src/bay-freight-model.ts'
import { createBayShop, stockBayShop, setBayShopOpen } from '../src/bay-shop-model.ts'

test('an existing farm adopts empty local stores and has no retroactive visitor or concert income',() => {
  const old = JSON.parse(JSON.stringify(createFarm()))
  for(const key of ['freight','bayShop','musicGarden','concertDay'])delete old[key]
  old.day=20
  const restored=restoreFarm(old)!
  assert.equal(restored.freight.lastDay,20)
  assert.equal(restored.bayShop.businessDay,20)
  assert.equal(restored.musicGarden.level,0)
  assert.equal(restored.concertDay,0)
  const coins=restored.coins
  endDay(restored)
  assert.equal(restored.coins,coins)
  assert.equal(restored.bayShop.sold,0)
})

test('bag transfers, local shop reservations and garden expansion conserve real warehouse goods',() => {
  const farm=createFarm()
  farm.boatOwned=true
  farm.village.built=true
  farm.island='village'
  farm.produce.wheat=5
  assert.ok(transferBayGoods(farm,'deposit','village','wheat',4).ok)
  assert.ok(!transferBayGoods(farm,'withdraw','home','wheat',1).ok)
  assert.ok(reserveShopGoods(farm,'wheat',5))
  assert.equal(farm.produce.wheat,0)
  assert.equal(farm.freight.warehouses.village.wheat??0,0)
  returnShopGoods(farm,'wheat',5)
  assert.equal(farm.produce.wheat,5)
  assert.ok(addFreightStock(farm.freight,'village','shells',6))
  assert.equal(installGardenInstrument(farm),undefined)
  assert.equal(farm.freight.warehouses.village.shells,6)
  assert.ok(addFreightStock(farm.freight,'village','seaSalt',3))
  assert.equal(installGardenInstrument(farm),1)
  assert.equal(installGardenInstrument(farm),undefined)
})

test('a concert brings two more real customers and pays exactly once when a played day closes',() => {
  const saleDay=(concert:boolean)=>{
    const f=createFarm()
    f.bayShop=createBayShop(f.day)
    f.concertDay=concert?f.day:0
    stockBayShop(f.bayShop,0,{id:'apple',identity:'apple',name:'Яблоко',image:'/art/icons/apple.webp',tags:['sweet','portable','fruit','pear','hearty'],basePrice:4},12)
    setBayShopOpen(f.bayShop,true)
    const before=f.coins
    endDay(f)
    assert.equal(f.coins-before,f.bayShop.revenue)
    assert.equal(f.bayShop.slots[0]!.quantity,12-f.bayShop.sold)
    const copy=restoreFarm(JSON.parse(JSON.stringify(f)))!
    assert.equal(copy.coins,f.coins)
    assert.equal(copy.bayShop.sold,f.bayShop.sold)
    return f.bayShop.sold
  }
  assert.equal(saleDay(false),6)
  assert.equal(saleDay(true),8)
})

test('a ferry route can open at the cape before wax is produced by the apiary',()=>{
  const farm=createFarm()
  farm.boatOwned=true
  farm.orders.harbor.completed=2
  endDay(farm)
  assert.equal(farm.freight.warehouses.cape.beeswax??0,0)
  farm.capeLevel=2
  endDay(farm)
  assert.equal(farm.freight.warehouses.cape.beeswax,2)
})
