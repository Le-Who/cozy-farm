import test from 'node:test'
import assert from 'node:assert/strict'
import {createFarm, getBedStage, sellMarketItem, workBed} from '../src/farm.ts'
import {MarketInlineSales, inlineReceiptText} from '../src/market-inline-sale.ts'

test('a first partial sale separates the earned goal bonus from proceeds; the next sale has no bonus',()=>{
  const farm=createFarm(),ui=new MarketInlineSales(), key='produce:carrot'
  const bed=farm.beds.findIndex(b=>b.kind==='crop'&&b.crop==='carrot'&&getBedStage(b)==='ripe')
  assert.ok(workBed(farm,bed).ok)
  for(const first of [true,false]){
    const stock=farm.produce.carrot, before=farm.coins, view=ui.view(key,stock,2)
    const quote=ui.take(key,view.token,stock,2)!
    assert.equal(quote.total,2);assert.equal(quote.quantity,1)
    const result=sellMarketItem(farm,key,1);assert.ok(result.ok)
    ui.finish(key,quote,result.goalRewardText)
    const shown=ui.view(key,stock-1,2),receipt=shown.receipt!
    assert.equal(receipt.total,2);assert.equal(farm.coins-before,first?10:2)
    const lines=inlineReceiptText(receipt).split('\n')
    assert.deepEqual(lines,first?['Продано: 1 · 2 монеты. Осталось: 2.','Награда за задание: +8 монет.']:['Продано: 1 · 2 монеты. Осталось: 1.'])
    assert.ok(ui.rearm(key,shown.token,stock-1,2))
  }
})
