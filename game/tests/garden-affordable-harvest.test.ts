import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as G from '../src/garden-plans.ts'
import {transferBayGoods} from '../src/harbour-economy.ts'
import {gardenSeedQuote,buyGardenSeeds} from '../src/garden-seed-basket.ts'
import {GardenPlanEditor,renderGardenSeedBasket} from '../src/garden-plans-ui.ts'
import {gardenHarvestSeeds,saveGardenSeedPacket} from '../src/garden-harvest-seeds.ts'
import {getMarketOrderBoard} from '../src/market-orders-view.ts'
import {getMarketOrderSurplusQuote} from '../src/market-order-surplus.ts'
import {seedSavingQuote,saveCropSeeds} from '../src/seed-saving.ts'
import {renderSeedPicker} from '../src/seed-picker-ui.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'

const reload=(f:F.FarmState)=>F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!
const earned=earned416Mixed(false)
const original=earned.state
function grownPlan(){
 const f=reload(original)
 const stocks=F.getMarketStock(f).filter(x=>x.count>0&&(x.key.startsWith('produce:')||x.key.startsWith('variants:'))
   &&F.cropIds.includes(x.key.split(':')[1] as F.CropId))
 assert.deepEqual([earned.actions,f.day,f.island,f.coins,F.getSale(f).items,stocks.length],[543,193,'home',56,416,23])
 const editor=new GardenPlanEditor()
 assert.ok(editor.begin(f));editor.draft!.name='Огород для следующего рейса'
 for(const [i,crop] of (['beetroot','tomato','pumpkin','wheat','leafyGreens'] as const).flatMap(c=>[c,c,c]).entries()){
  editor.brush=crop;assert.ok(editor.paint(i))
 }
 assert.ok(editor.save(f).ok);assert.ok(G.followGardenPlan(f,0,f.gardenPlans.revision).ok)
 return reload(f)
}

const render=(f:F.FarmState)=>renderGardenSeedBasket(f,0,'open')
const readQuote=(f:F.FarmState)=>gardenSeedQuote(f,0,'open')!
const rows=(f:F.FarmState)=>gardenHarvestSeeds(f,0,'open')
const tomato=(f:F.FarmState)=>seedSavingQuote(f,'tomato')!
const irrigation=(f:F.FarmState)=>getMarketOrderBoard(f).choices.find(v=>v.id==='irrigation')!
function planWithCarrot(){
 const f=grownPlan(),old=f.gardenPlans.pages[0]!
 const crops=[...old.crops];crops[14]='carrot';crops[15]='carrot'
 assert.ok(G.saveGardenPlan(f,0,{...old,crops},f.gardenPlans.revision).ok)
 assert.ok(G.followGardenPlan(f,0,f.gardenPlans.revision).ok)
 return reload(f)
}
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const lift=(action:string,stop:string)=>{
 const x=main.indexOf("    case '"+action+"':"),y=main.indexOf("    case '"+stop+"':",x+1)
 assert.ok(x>=0&&y>x);return stripTypeScriptTypes('switch(action){'+main.slice(x,y)+'}')
}
const offered=(f:F.FarmState,crop:F.CropId)=>rows(f).find(v=>v.crop===crop)
const pickHTML=(f:F.FarmState)=>renderSeedPicker(f,'tomato',undefined,{
 icon:()=>'',button:(label,act,yes,opts)=>`<button data-action="${act}" data-value="${opts.value??''}"${yes?'':' disabled'}>${label}</button>`
})

test('earned mixed D193 plan offers its only strictly cheaper ordinary exchange inline; commit, remaining purchase and planting stay separate',()=>{
 const f=grownPlan(), before=structuredClone(f), originalOrder=getMarketOrderBoard(f).choices
 const q=readQuote(f)
 assert.deepEqual([q.affordable,q.packs,q.total],[true,5,28])
 assert.deepEqual([f.produce.tomato,f.variants.tomato!.rainbow,f.seeds.tomato,irrigation(f).group],[7,1,0,'ready'])
 const html=render(f), tomatoCard=[...html.matchAll(/<li[^>]*>([^]*?)<\/li>/g)].map(m=>m[1]).find(li=>li.includes('<strong>Помидор</strong>'))
 assert.ok(tomatoCard)
 assert.match(tomatoCard,/Обменять: помидор ×1 → 3 семени/)
 assert.match(tomatoCard,/Останется обычного урожая: 6\. Затем к покупке: 21 монета/)
 assert.equal((html.match(/data-action="garden-save-seeds"/g)??[]).length,1)
 assert.match(html,/Купить список за 28 монет/)
 assert.doesNotMatch(html,/<section class="garden-harvest-seeds"/,'no extra group for the affordable exchange')
 const [option]=rows(f)
 assert.deepEqual([option.crop,option.pack,option.remaining,option.after],['tomato',3,6,21])
 assert.deepEqual(f,before,'none of the above has saved or selected a seed')

 const work=[], event={detail:0}, context={
  action:'garden-save-seeds',value:option.token,panel:'garden-plans',dialog:{open:true},gardenEditor:{draft:null,slot:0,shopping:'open'},event,farm:f,saveGardenSeedPacket,
  perform:(fn:()=>F.ActionResult)=>{const r=fn();if(r.ok)work.push('save');return r.ok},
  drawPanel:()=>work.push('ordinary redraw'),
  dialogContent:{querySelector:(sel:string)=>({focus:()=>work.push(sel)})},
 }
 runInNewContext(lift('garden-save-seeds','garden-shop'),context)
 assert.deepEqual(work,['save','[data-garden-basket-total]'],'one native action; after entry restore focus to price, not Spend')
 const after=structuredClone(before);after.produce.tomato--;after.seeds.tomato+=3;after.workToday++
 assert.deepEqual(f,after);assert.deepEqual(reload(f),after)
 assert.deepEqual(getMarketOrderBoard(f).choices,originalOrder)
 assert.equal(saveGardenSeedPacket(f,0,'open',option.token).ok,false,'cannot repeat stale activation')
 assert.deepEqual(f,after)
 assert.equal(buyGardenSeeds(f,q.token).ok,false,'old full-price buy cannot apply after the exchange')
 const reduced=readQuote(f)
 assert.deepEqual([reduced.total,reduced.packs],[21,4]);assert.deepEqual(rows(f),[])
 assert.ok(buyGardenSeeds(f,reduced.token).ok)
 const cash=reload(before);assert.ok(buyGardenSeeds(cash,q.token).ok)
 assert.deepEqual([cash.coins,f.coins,cash.produce.tomato,f.produce.tomato],[28,35,7,6])
 assert.deepEqual(f.seeds,cash.seeds);assert.deepEqual(f.variants,cash.variants)
 assert.equal(f.gardenPlans.active,0);assert.deepEqual(f.beds,before.beds)
 assert.doesNotMatch(render(cash),/data-action="garden-save-seeds"|data-action="garden-buy-seeds"/,'no exchange or purchase when all five packets already present')
 assert.ok(F.workBed(f,3,0).ok);assert.equal(f.beds[3].kind==='crop'&&f.beds[3].crop,'tomato');assert.equal(f.seeds.tomato,2)
})

test('cheap produce reserved for either ready Home choice is not an affordable basket exchange, and other budget/seed choices remain unchanged',()=>{
 const f=planWithCarrot(), initial=offered(f,'carrot')
 assert.ok(initial,'a clean cheap surplus must already be available before tightening the reserve')
 const carrot=()=>seedSavingQuote(f,'carrot')!
 assert.ok(F.sellMarketItem(f,'produce:carrot',2).ok)
 assert.deepEqual([f.produce.carrot,carrot().saleValue,carrot().marketPrice,irrigation(f).group],[4,3,4,'ready'])
 const oldSale=getMarketOrderSurplusQuote(f);assert.ok(oldSale);assert.ok(!oldSale.requests.some(r=>r.key==='produce:carrot'))
 assert.equal(offered(f,'carrot'),undefined)
 assert.doesNotMatch(render(f),/Обменять: морковь ×1/)
 const before=structuredClone(f)
 assert.equal(saveGardenSeedPacket(f,0,'open',initial.token).ok,false)
 const attempted=()=>saveGardenSeedPacket(f,0,'open',[readQuote(f).token,f.coins,carrot().token].join('~'))
 assert.equal(attempted().ok,false);assert.deepEqual(f,before)
 assert.ok(transferBayGoods(f,'deposit','home','leafyGreens',4).ok,'use real existing exact Home ownership')
 assert.equal(irrigation(f).group,'warehouse')
 assert.equal(offered(f,'carrot'),undefined)
 assert.equal(attempted().ok,false)

 const last=grownPlan()
 assert.ok(F.sellMarketItem(last,'produce:tomato',6).ok)
 assert.equal(last.produce.tomato,1);assert.equal(offered(last,'tomato'),undefined)
 assert.match(pickHTML(last),/data-action="save-crop-seeds"[^>]*>Обменять урожай на 3 семени/,'direct ordinary selector still lets its user explicitly trade the last one')
 const pick=last.gardenPlans.active, rare=last.variants.tomato!.rainbow
 assert.ok(saveCropSeeds(last,tomato(last).token).ok);assert.equal(last.produce.tomato,0)
 assert.equal(last.variants.tomato!.rainbow,rare)
 assert.equal(last.gardenPlans.active,pick)

 const dirt=grownPlan()
 while(dirt.coins>=28)assert.ok(F.buySeeds(dirt,'blueberry').ok) // independent real packet choices for a crop not on this plan
 assert.equal(readQuote(dirt).affordable,false)
 assert.match(render(dirt),/<section class="garden-harvest-seeds"/)
 assert.match(render(dirt),/data-action="garden-buy-seeds"[^>]* disabled/)
 assert.deepEqual(rows(dirt).map(x=>x.crop),['beetroot','tomato','pumpkin','wheat','leafyGreens'],'underfunded escape is unchanged, even where paying would normally be better')

 const spare=planWithCarrot()
 assert.ok(F.sellMarketItem(spare,'produce:carrot',1).ok)
 assert.equal(spare.produce.carrot,5)
 const only=offered(spare,'carrot')
 assert.ok(only);assert.ok(saveGardenSeedPacket(spare,0,'open',only.token).ok)
 assert.equal(spare.produce.carrot,4);assert.equal(irrigation(spare).group,'ready')
})
