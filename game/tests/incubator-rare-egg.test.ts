import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { transferBayGoods } from '../src/harbour-economy.ts'
import * as F from '../src/farm.ts'
import { renderCoopPanel } from '../src/coop-panel.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
export function beforeRareHatch() {
 const p=commissionPlayer(opening)
 p.visit('home')
 p.act('specializeFacility','hatchery')
 const bed=p.state.beds.findIndex(x=>x.kind==='tilled')
 assert.ok(bed>=0)
 p.act('selectSeed','wheat');p.act('workBed',bed,0)
 const water=()=>{if(F.getBedAction(p.state,bed).kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',bed,0)}}
 water();p.act('feedChickens');p.night();p.act('collectEggs');water();p.night();p.act('workBed',bed,0)
 assert.deepEqual([p.actions,p.state.day,p.state.eggs,p.state.produce.wheat,p.state.eggsReady,p.state.eggBaskets,p.state.variants.egg?.rainbow],[117,16,7,2,0,0,1])
 return p
}
const row=(img:string,n:string,d:string,a='')=>`<li data-row="${n}">${img} ${d} ${a}</li>`
const button=(label:string,action:string,enabled=true,options?:{value?:string|number})=>
 `<button data-action="${action}" data-value="${options?.value??''}"${enabled?'':' disabled'}>${label}</button>`
const render=(farm:F.FarmState)=>renderCoopPanel(farm,{row,button,icon:id=>id,feedRow:()=>''})
test('with both earned breakfast orders delivered, today has a paid rare-egg hatch choice, not a disabled ordinary choice',()=>{
 const p=beforeRareHatch()
 assert.match(render(p.state),/data-action="incubate-egg"/)
 p.act('deliverMarketOrder','flock');p.act('deliverMarketOrder','pantry')
 const f=p.state,snapshot=structuredClone(f),html=render(f)
 assert.deepEqual(snapshot,f)
 assert.equal(f.eggs,0);assert.equal(f.variants.egg?.rainbow,1)
 const egg=F.getMarketStock(f).find(entry=>entry.key==='variants:egg:rainbow')
 assert.equal(egg?.price,6)
 assert.match(html,/data-action="incubate-rare-egg"[^>]*>Положить радужное яйцо/)
 assert.doesNotMatch(html,/data-action="incubate-egg"/)
})

function saved(farm:F.FarmState) {
 const out=F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))
 assert.ok(out)
 return out
}
function branch(seed:F.FarmState) {
 let current=saved(seed)
 return {get state(){return current}, act<Args extends unknown[]>(command:(f:F.FarmState,...args:Args)=>F.ActionResult,...args:Args) {
   const result=command(current,...args)
   assert.ok(result.ok,result.message)
   current=saved(current)
 }}
}
const morning=(route:ReturnType<typeof branch>)=>{
 if(!route.state.feed) route.act(F.buyFeed)
 route.act(F.feedChickens)
 route.act(F.endDay)
 route.act(F.collectEggs)
}

test('one rare egg keeps both Day 16 deliveries and advances hatch by a night; selling remains a real alternative',()=>{
 const shared=beforeRareHatch().state
 const reserve=branch(shared), spendRare=branch(shared), wait=branch(shared)
 for(const route of [reserve,spendRare,wait])route.act(F.deliverMarketOrder,'flock')
 assert.deepEqual([reserve.state.eggs,reserve.state.day],[1,16])
 reserve.act(F.incubateEgg)
 assert.equal(F.deliverMarketOrder(reserve.state,'pantry').ok,false)
 assert.equal(reserve.state.coins,66)
 for(const route of [spendRare,wait])route.act(F.deliverMarketOrder,'pantry')
 assert.deepEqual([spendRare.state.coins,wait.state.coins,spendRare.state.eggs],[87,87,0])
 const forSale=branch(wait.state), rareKey='variants:egg:rainbow'
 forSale.act(F.sellMarketItem,rareKey,1)
 assert.equal(forSale.state.coins-wait.state.coins,6)
 assert.equal(F.getRareIncubatorEgg(forSale.state),undefined)
 const option=F.getRareIncubatorEgg(spendRare.state)!
 const start=structuredClone(spendRare.state)
 spendRare.act(F.incubateRareEgg,option.token)
 assert.equal(spendRare.state.eggs,0)
 assert.equal(spendRare.state.variants.egg?.rainbow??0,0)
 assert.equal(spendRare.state.discoveries.egg?.rainbow,true,'discoveries are not spent')
 assert.equal(spendRare.state.coins,start.coins)
 assert.equal(spendRare.state.hatchDay,18)
 const started=structuredClone(spendRare.state)
 assert.equal(F.incubateRareEgg(spendRare.state,option.token).ok,false)
 assert.deepEqual(spendRare.state,started)
 for(const route of [reserve,spendRare,wait]) morning(route)
 reserve.act(F.deliverMarketOrder,'pantry')
 wait.act(F.incubateEgg)
 assert.deepEqual([reserve.state.hatchDay,spendRare.state.hatchDay,wait.state.hatchDay],[18,18,19])
 for(const route of [reserve,spendRare,wait]) morning(route)
 assert.deepEqual([reserve.state.flockSize,spendRare.state.flockSize,wait.state.flockSize],[5,5,4])
 assert.deepEqual(spendRare.state.henFriendship,reserve.state.henFriendship,'no genetics or faster laying')
 for(const route of [reserve,spendRare,wait]) morning(route)
 assert.deepEqual([reserve.state.eggs,spendRare.state.eggs,wait.state.eggs],[11,12,10])
 assert.deepEqual([reserve.state.coins,spendRare.state.coins,wait.state.coins],[79,79,79])
 assert.deepEqual([reserve.state.variants.egg?.rainbow,spendRare.state.variants.egg?.rainbow??0,wait.state.variants.egg?.rainbow],[1,0,1])
 console.log(JSON.stringify({earnedActions:117,bothOrdersDay16:87,reserveCoinsDay16:66,rareSale:6,firstHatch:[18,18,19],day19Ordinary:[11,12,10]}))
})

test('ordinary egg, nest, basket or local warehouse remains the cheaper live option; foreign stock does not suppress',()=>{
 const p=beforeRareHatch();p.act('deliverMarketOrder','flock')
 const normal=saved(p.state);assert.equal(normal.eggs,1);assert.doesNotMatch(render(normal),/incubate-rare-egg/)
 p.act('deliverMarketOrder','pantry')
 const scarce=saved(p.state)
 const original=F.getRareIncubatorEgg(scarce)!
 const noPayment=(r:F.FarmState)=>{
   const was=structuredClone(r)
   assert.doesNotMatch(render(r),/incubate-rare-egg/)
   const current=original.token.replace('hatch:16:',`hatch:${r.day}:`)
   assert.equal(F.incubateRareEgg(r,current).ok,false)
   assert.deepEqual(r,was)
 }
 const withNest=branch(scarce);withNest.act(F.buyFeed);withNest.act(F.feedChickens);withNest.act(F.endDay)
 assert.ok(withNest.state.eggsReady>0)
 noPayment(withNest.state)
 const withBasket=branch(withNest.state);withBasket.act(F.collectEggs);withBasket.act(F.packEggBasket)
 assert.equal(withBasket.state.eggBaskets,1)
 if(withBasket.state.eggs)withBasket.act(F.sellMarketItem,'eggs',withBasket.state.eggs)
 assert.match(render(withBasket.state),/data-action="incubator-basket"/)
 noPayment(withBasket.state)
 const stored=branch(normal)
 stored.act(transferBayGoods,'deposit','home','eggs',1)
 assert.equal(stored.state.eggs,0)
 assert.equal(stored.state.freight.warehouses.home.eggs,1)
 noPayment(stored.state)
 stored.act(transferBayGoods,'withdraw','home','eggs',1)
 stored.act(F.sail,'grove')
 stored.act(transferBayGoods,'deposit','grove','eggs',1)
 noPayment(stored.state)
 stored.act(F.sail,'home')
 assert.match(render(stored.state),/incubate-rare-egg/)
})

test('only the exact existing coop control spends it once, and a successful insertion takes focus to the normal bedtime choice',()=>{
 const p=beforeRareHatch();p.act('deliverMarketOrder','flock');p.act('deliverMarketOrder','pantry')
 const farm=saved(p.state), prepared=F.getRareIncubatorEgg(farm)!
 assert.equal(isGuardedAction('incubate-rare-egg'),true)
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 const at=main.indexOf("    case 'incubate-rare-egg':"),end=main.indexOf("    case 'rest-close-shop':",at)
 const script=stripTypeScriptTypes("switch(action){"+main.slice(at,end)+"}")
 const control={dataset:{action:'incubate-rare-egg'}}
 let count=0, attached=true
 const execute=(panel:string,value:string,open=true)=>runInNewContext(script,{
  action:'incubate-rare-egg',farm,panel,control,value,incubateRareEgg:F.incubateRareEgg,
  dialog:{open},dialogContent:{contains:(button:unknown)=>button===control&&attached},
  perform:(action:()=>F.ActionResult)=>{count++;return action().ok},
 })
 const before=structuredClone(farm)
 execute('market',prepared.token)
 execute('coop',prepared.token,false)
 attached=false;execute('coop',prepared.token);attached=true
 assert.equal(count,0);assert.deepEqual(farm,before)
 execute('coop','hatch:15:rainbow')
 execute('coop','hatch:16:frost')
 assert.deepEqual(farm,before)
 execute('coop',prepared.token)
 assert.equal(farm.hatchDay,18)
 const hatched=structuredClone(farm)
 execute('coop',prepared.token)
 assert.deepEqual(farm,hatched)
 assert.match(render(farm),/К отдыху дома/)
 assert.doesNotMatch(render(farm),/incubate-rare-egg/)
 const f=main.indexOf("    const incubatorRoute ="), next=main.indexOf('    const nextFocus',f)
 assert.ok(f>-1&&next>f)
 const link=stripTypeScriptTypes(main.slice(f,next)+';incubatorRoute')
 const bedtime={}
 assert.equal(runInNewContext(link,{panel:'coop',focused:control,replacement:null,
   dialogContent:{querySelector:(selector:string)=>{assert.match(selector,/visit-rest/);return bedtime}}}),bedtime)
})
