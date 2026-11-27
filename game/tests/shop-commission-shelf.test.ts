import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as M from '../src/bay-shop-model.ts'
import * as C from '../src/shop-commissions.ts'
import * as H from '../src/harbour-economy.ts'
import { renderShopCommissions } from '../src/shop-commissions-ui.ts'
import { describeFood } from '../src/intent-orders.ts'
import { assortmentPlayer } from './fixtures/assortment-player.ts'

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8')
const reopen=(farm:F.FarmState)=>F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
const authoredPrices=[38,23] as const
const productKey='signature:s2'
const p=assortmentPlayer(JSON.parse(read('./fixtures/home-progress-actions.json')))
for(let i=0;i<4;i++)p.cook('tart',p.tart)
for(let i=0;i<3;i++)p.cook('preserves',p.jam)
const game=p.p
assert.equal(game.state.bayShop.open,false)
const tart=structuredClone(game.state.bayShop.slots[0]!.product)
const jamRecipe=game.state.culinary.recipes.find(r=>r.id===p.jam)!
assert.equal(tart.id,productKey)
const jamFood=F.foodDescriptors(game.state).find(r=>r.id==='signature:'+p.jam)!
const preserves={id:String(jamFood.id),identity:String(jamFood.id),name:jamRecipe.name,
  image:'/art/lavender/ui-signature-silky.webp',basePrice:jamRecipe.sellPrice,
  tags:[...jamFood.ingredients,...describeFood(jamFood),jamFood.processing??'bright'],signature:true}
for(const [index,product,quantity] of [[0,tart,4],[1,preserves,1]] as const){
  assert.ok(H.reserveShopGoods(game.state,product.id,quantity))
  assert.ok(M.stockBayShop(game.state.bayShop,index,product,quantity))
  assert.ok(M.setBayShopPrice(game.state.bayShop,index,authoredPrices[index]))
  game.reload()
}
assert.deepEqual([game.state.day,game.state.coins,game.state.culinary.stock[p.jam],game.state.culinary.stock[p.tart]],[32,381,2,0])
const offer=C.getShopAssortment(game.state,'bea',p.jam,p.tart)!
assert.equal(offer.total,114)
game.act('acceptShopCommission',offer.key)
const accepted=reopen(game.state)
const main=read('../src/main.ts')
const index=main.indexOf("    case 'commission-deliver':"),end=main.indexOf("    case 'commission-cancel':",index)
assert.ok(index>=0&&end>index)
const dispatch=stripTypeScriptTypes('(value,control)=>{switch("commission-deliver"){'+main.slice(index,end)+'}}')
const render=(farm:F.FarmState)=>renderShopCommissions(farm,()=> '')
const line=(farm:F.FarmState,id=p.tart)=>C.getShopCommission(farm)!.lines.find(x=>x.recipeId===id)!
const control=(farm:F.FarmState,id=p.tart)=>{
  const value=line(farm,id).actionValue
  const html=render(farm).match(/<button\b[^>]*data-action="commission-deliver"[^>]*>[^<]*<\/button>/g)!
    .find(tag=>tag.includes('data-value="'+value+'"'))
  assert.ok(html)
  const quote=html.match(/data-commission-shelf-quote="([^"]+)"/)?.[1].replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&')
  return {disabled:html.includes(' disabled'),label:html.split('>')[1].split('<')[0],dataset:{value,commissionShelfQuote:quote}}
}
function press(farm:F.FarmState,clicked:ReturnType<typeof control>,{owned=true,opened=true,panel='shop-commissions'}={}){
  const observed:string[]=[], actions=runInNewContext(dispatch,{farm,panel,dialog:{open:opened},
    dialogContent:{contains:(el:unknown)=>owned&&el===clicked},document:{activeElement:undefined},event:{detail:1},
    perform:(action:()=>F.ActionResult)=>{const result=action();observed.push(result.ok?'save':'blocked');return result.ok},
    deliverShopCommission:C.deliverShopCommission,getShopCommissionLine:C.getShopCommissionLine,playBaySound:()=>observed.push('crate')})
  if(!clicked.disabled)actions(clicked.dataset.value,clicked)
  return observed
}
const reject=(farm:F.FarmState,act:()=>unknown)=>{
  const before=structuredClone(farm);act();assert.deepEqual(farm,before);assert.deepEqual(reopen(farm),farm)
}

test('a real mixed Bea order can set one exact already-made tart aside from the live shelf without repricing or booking a sale',()=>{
  const farm=reopen(accepted),before=structuredClone(farm)
  assert.equal(line(farm).inBag+line(farm).warehouse,0)
  const shown=control(farm)
  assert.deepEqual(farm,before,'preview is not a transfer')
  assert.equal(shown.label,'С полки · 1')
  assert.equal(shown.disabled,false)
  assert.ok(shown.dataset.commissionShelfQuote)
  assert.equal(control(farm,p.jam).label,'Отложить 1')
  assert.equal(control(farm,p.jam).dataset.commissionShelfQuote,undefined)
  assert.deepEqual(press(farm,shown),['save','crate'])
  assert.deepEqual(farm.bayShop,{...before.bayShop,slots:[{...before.bayShop.slots[0]!,quantity:3},...before.bayShop.slots.slice(1)]})
  assert.deepEqual(farm.culinary,before.culinary)
  assert.deepEqual(farm.freight,before.freight)
  assert.deepEqual([line(farm).delivered,line(farm,p.jam).delivered,farm.coins,farm.workToday],[1,0,381,before.workToday+1])
  assert.deepEqual(reopen(farm),farm)
})

test('one deliberate shelf deposit survives reopen; normal claim and cancel cannot count it twice',()=>{
  const original=reopen(accepted), first=control(original)
  assert.deepEqual(press(original,first),['save','crate'])
  const resumed=reopen(original), serial=String(C.getShopCommission(resumed)!.serial)
  reject(resumed,()=>{
    assert.deepEqual(press(resumed,first),['blocked'],'an already used quote must not deposit again')
    assert.equal(C.finishShopCommission(resumed,serial).ok,false)
  })
  assert.ok(C.cancelShopCommission(resumed,serial).ok)
  assert.deepEqual([resumed.culinary.stock[p.tart],resumed.bayShop.slots[0]?.quantity,resumed.bayShop.slots[0]?.price,
    resumed.bayShop.slots[1]?.quantity,resumed.bayShop.slots[1]?.price,resumed.coins,resumed.shopCommissions.completed.bea],
    [1,3,38,1,23,381,2])
  reject(resumed,()=>{
    assert.equal(C.cancelShopCommission(resumed,serial).ok,false)
    assert.deepEqual(press(resumed,first),['blocked'])
  })

  const finish=reopen(original)
  assert.deepEqual(press(finish,control(finish)),['save','crate'])
  assert.deepEqual(press(finish,control(finish,p.jam)),['save','crate'])
  assert.deepEqual(press(finish,control(finish,p.jam)),['save','crate'])
  assert.deepEqual([finish.coins,finish.bayShop.slots[0]?.quantity,finish.bayShop.slots[0]?.price,
    finish.bayShop.revenue,finish.bayShop.sold,finish.shopCommissions.completed.bea],
    [381,2,38,accepted.bayShop.revenue,accepted.bayShop.sold,2])
  assert.ok(C.finishShopCommission(finish,serial).ok)
  assert.deepEqual([finish.coins,finish.shopCommissions.completed.bea],[495,3])
  reject(finish,()=>assert.equal(C.finishShopCommission(finish,serial).ok,false))
})

function relist(farm:F.FarmState,pieces:number){
  const returned=M.removeBayShopStock(farm.bayShop,0)!
  H.returnShopGoods(farm,returned.id,returned.quantity)
  assert.ok(H.reserveShopGoods(farm,productKey,pieces)&&M.stockBayShop(farm.bayShop,0,tart,pieces))
  assert.ok(M.setBayShopPrice(farm.bayShop,0,38))
}
test('live price, quantities, not-this-panel and ordinary bag/depot ownership veto stale or ambiguous shelf choices',()=>{
  const fresh=()=>reopen(accepted)
  const old=control(fresh())
  for(const scope of [{owned:false},{panel:'recipes'},{opened:false}]){
    const f=fresh();reject(f,()=>assert.deepEqual(press(f,old,scope),[]))
  }
  const foreign=fresh();assert.ok(F.sail(foreign,'home').ok)
  reject(foreign,()=>assert.deepEqual(press(foreign,old),['blocked']))
  const price=fresh();assert.ok(M.setBayShopPrice(price.bayShop,0,39))
  reject(price,()=>assert.deepEqual(press(price,old),['blocked']))
  const bought=fresh()
  M.setBayShopOpen(bought.bayShop,true)
  let seenTart=false
  for(let n=0;n<100&&!seenTart;n++)for(const sale of M.advanceBayShop(bought.bayShop,1000)){
    bought.coins+=sale.price
    if(sale.product.id===productKey)seenTart=true
  }
  assert.ok(seenTart)
  assert.equal(bought.bayShop.slots[0]?.quantity,3)
  reject(bought,()=>assert.deepEqual(press(bought,old),['blocked']))

  const bag=fresh();relist(bag,3)
  assert.deepEqual([line(bag).inBag,line(bag).warehouse],[1,0])
  assert.equal(control(bag).label,'Отложить 1')
  assert.equal(control(bag).dataset.commissionShelfQuote,undefined)
  reject(bag,()=>assert.deepEqual(press(bag,old),['blocked']))
  // Store ownership boundary only: production model's normal warehouse writer,
  // not a claimed current player-facing deposit button.
  const depot=structuredClone(bag)
  assert.ok(H.transferBayGoods(depot,'deposit','village',productKey,1).ok)
  assert.deepEqual([line(depot).inBag,line(depot).warehouse],[0,1])
  assert.equal(control(depot).label,'Отложить 1')
  assert.deepEqual(press(depot,control(depot)),['save','crate'])
  assert.deepEqual([line(depot).warehouse,line(depot).delivered,depot.bayShop.slots[0]?.quantity],[0,1,3])
  assert.deepEqual(press(bag,control(bag)),['save','crate'])
  assert.deepEqual([line(bag).inBag,line(bag).delivered,bag.bayShop.slots[0]?.quantity],[0,1,3])

  const duplicate=fresh();relist(duplicate,3)
  assert.ok(H.reserveShopGoods(duplicate,productKey,1)&&M.stockBayShop(duplicate.bayShop,2,tart,1))
  assert.equal(control(duplicate).disabled,true,'do not guess which display lot to spend')
  reject(duplicate,()=>assert.deepEqual(press(duplicate,old),['blocked']))
  const empty=fresh(),emptied=M.removeBayShopStock(empty.bayShop,0)!
  H.returnShopGoods(empty,emptied.id,emptied.quantity)
  assert.ok(H.reserveShopGoods(empty,productKey,4)&&M.stockBayShop(empty.bayShop,0,tart,4))
  M.setBayShopOpen(empty.bayShop,true)
  for(let n=0;n<100&&empty.bayShop.slots[0]!.quantity;n++)for(const sale of M.advanceBayShop(empty.bayShop,1000))empty.coins+=sale.price
  assert.equal(empty.bayShop.slots[0]?.quantity,0)
  assert.equal(control(empty).disabled,true)
  reject(empty,()=>assert.deepEqual(press(empty,old),['blocked']))
})
