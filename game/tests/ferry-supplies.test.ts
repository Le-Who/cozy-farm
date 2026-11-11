import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { createFarm, workBed, sellMarketItem, buyBoat, refillWater, endDay, selectSeed, restoreFarm } from '../src/farm.ts'
import { getFerrySupplyRequirement, sendFerryExpedition, receiveFerryExpedition, transferBayGoods } from '../src/harbour-economy.ts'
import { combinedExpeditionId, quoteExpedition } from '../src/ferry-expeditions.ts'
import { expeditionWallet } from '../src/harbour-economy.ts'
import { getRequirementHint } from '../src/requirement-guidance.ts'
import { ActionClickGuard, ActivationKeyGuard, isGuardedAction } from '../src/action-click-guard.ts'

function firstBoat() {
  const farm=createFarm()
  assert.ok(workBed(farm,2).ok)
  assert.ok(sellMarketItem(farm,'produce:cabbage',2).ok)
  assert.ok(buyBoat(farm).ok)
  return farm
}

test('the cashless first ferry uses ready wheat instead of sending the player to buy more seeds',()=>{
  const farm=firstBoat(),before=structuredClone(farm)
  assert.equal(farm.coins,0)
  assert.equal(farm.seeds.wheat,2)
  const requirement=getFerrySupplyRequirement(farm,'mill-grain','wheat')
  assert.deepEqual(requirement,{kind:'stock',item:{kind:'produce',item:'wheat',quantity:4}})
  assert.deepEqual(getRequirementHint(farm,requirement!).action,{label:'Собрать урожай: пшеница × 3',target:'focus-bed',value:'4'})
  assert.deepEqual(farm,before)
})

test('a supply hint owns its whole gesture before a harvest, sleep or purchase control can take focus',()=>{
  assert.equal(isGuardedAction('expedition-source'),true)
  const click=new ActionClickGuard();click.remember({detail:1,timeStamp:100,clientX:200,clientY:300})
  assert.equal(click.blocks({detail:2,timeStamp:200,clientX:200,clientY:300}),true)
  const key=new ActivationKeyGuard()
  assert.equal(key.blocks({key:'Enter',repeat:false},true),false)
  assert.equal(key.blocks({key:'Enter',repeat:true},false),true)
  key.release('Enter')
  assert.equal(key.blocks({key:'Enter',repeat:false},false),false)
})

test('the same first cargo follows remaining wheat through dry, empty-can, watered and ready states',()=>{
  let farm=firstBoat()
  assert.ok(workBed(farm,4).ok)
  const hint=()=>getRequirementHint(farm,getFerrySupplyRequirement(farm,'mill-grain','wheat')!)
  assert.equal(hint().action.target,'focus-bed');assert.equal(hint().action.value,'11')
  farm.water=0
  const emptyCan=structuredClone(farm)
  assert.equal(hint().action.target,'focus-place');assert.equal(hint().action.value,'well')
  assert.deepEqual(farm,emptyCan)
  assert.ok(refillWater(farm).ok);assert.ok(workBed(farm,11).ok)
  const watered=structuredClone(farm)
  assert.equal(hint().action.value,'farmhouse');assert.match(hint().notice!,/уже полита/)
  assert.deepEqual(farm,watered)
  farm=restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.equal(hint().action.value,'farmhouse')
  assert.ok(endDay(farm).ok)
  assert.equal(hint().action.value,'11')
  assert.ok(workBed(farm,11).ok)
  assert.equal(farm.produce.wheat,6)
  assert.equal(getFerrySupplyRequirement(farm,'mill-grain','wheat'),undefined)
})

test('supply guidance preserves the whole combined quantity and uses a local warehouse before growing more',()=>{
  const farm=firstBoat();assert.ok(workBed(farm,4).ok)
  assert.ok(transferBayGoods(farm,'deposit','home','wheat',3).ok)
  const id=combinedExpeditionId('mill-grain','mill-sale')!,before=structuredClone(farm)
  const requirement=getFerrySupplyRequirement(farm,id,'wheat')!
  assert.deepEqual(requirement,{kind:'stock',item:{kind:'produce',item:'wheat',quantity:6}})
  const hint=getRequirementHint(farm,requirement)
  assert.equal(hint.action.target,'warehouse-supply')
  assert.deepEqual(farm,before)
  assert.equal(getFerrySupplyRequirement(farm,id,'eggs'),undefined)
  assert.equal(getFerrySupplyRequirement(farm,'not-a-voyage','wheat'),undefined)
  assert.equal(getFerrySupplyRequirement(farm,'mill-buy','wheat'),undefined)
  assert.equal(getFerrySupplyRequirement(createFarm(),'mill-grain','wheat'),undefined)
})

test('a clean farm can trade and discover both shores without any seed purchase or inventory injection',()=>{
  let farm=firstBoat()
  const reload=()=>{farm=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(farm)}
  const complete=(id:string)=>{
    assert.ok(sendFerryExpedition(farm,id).ok);reload()
    assert.equal(getFerrySupplyRequirement(farm,'mill-grain','wheat'),undefined)
    assert.ok(endDay(farm).ok);reload()
    assert.ok(receiveFerryExpedition(farm).ok);reload()
  }
  assert.ok(workBed(farm,4).ok);assert.ok(workBed(farm,11).ok)
  assert.ok(endDay(farm).ok);assert.ok(workBed(farm,11).ok)
  assert.equal(farm.produce.wheat,6);assert.equal(farm.coins,15)
  complete('mill-grain');assert.equal(farm.coins,20);assert.equal(farm.produce.wheat,2)
  complete('explore-salt');assert.equal(farm.day,4);assert.equal(farm.produce.wheat,0)
  const carrots=getFerrySupplyRequirement(farm,'salt-carrots','carrot')!
  assert.equal(getRequirementHint(farm,carrots).action.value,'9')
  assert.ok(workBed(farm,9).ok);complete('salt-carrots')
  const wheat=getFerrySupplyRequirement(farm,'explore-orchard','wheat')!,before=structuredClone(farm)
  const hint=getRequirementHint(farm,wheat)
  assert.equal(hint.action.target,'open-panel');assert.equal(hint.action.value,'seeds')
  assert.match(hint.selector!,/preview-seed.*wheat/);assert.deepEqual(farm,before)
  assert.ok(selectSeed(farm,'wheat').ok);assert.ok(workBed(farm,4).ok);assert.ok(workBed(farm,4).ok)
  assert.ok(endDay(farm).ok)
  assert.equal(getRequirementHint(farm,wheat).action.value,'farmhouse','rain has already watered the bed')
  assert.ok(endDay(farm).ok);assert.ok(workBed(farm,4).ok)
  assert.equal(quoteExpedition(farm.freight.expeditions,'explore-orchard',expeditionWallet(farm))?.available,true)
  complete('explore-orchard')
  assert.deepEqual(farm.freight.expeditions.discovered,['mill','salt','orchard'])
  assert.equal(farm.freight.expeditions.completed,4)
  assert.equal(farm.day,8);assert.equal(farm.coins,25);assert.equal(farm.seeds.wheat,1)
  assert.equal(farm.handmade.round,1);assert.equal(farm.seaSalt,2)
})

test('the ferry supply button names the resource and carries the exact single or combined offer',async()=>{
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom'})
  try {
    const {renderFreightPanel}=await server.ssrLoadModule('/src/bay-freight-ui.ts')
    const farm=firstBoat(),render=(offer:string)=>renderFreightPanel(farm.freight,{
      day:farm.day,coins:farm.coins,boatOwned:farm.boatOwned,playerPort:farm.island,
      expeditionPort:'mill',expeditionOffer:offer,openedPorts:['home','grove'],carried:expeditionWallet(farm).bag,
      products:[{id:'wheat',name:'Пшеница',icon:'wheat'}],icon:()=>'',
    })
    assert.match(render('mill-grain'),/data-action="expedition-source" data-value="mill-grain\|wheat"[^>]*>Где взять пшеницу/)
    assert.doesNotMatch(render('mill-grain'),/Семена пшеницы/)
    const pair=combinedExpeditionId('mill-grain','mill-sale')!
    assert.match(render(pair),/data-value="pair:mill-grain\+mill-sale\|wheat"/)
  } finally {await server.close()}
})

test('an emptied bakery recovers through a real grain sale rather than free bread or an extra currency',()=>{
  const farm=firstBoat()
  for(const [bed,key,quantity] of [[3,'produce:tomato',3],[5,'produce:beetroot',2],[7,'produce:pumpkin',2]] as const){
    assert.ok(workBed(farm,bed).ok);assert.ok(sellMarketItem(farm,key,quantity).ok)
  }
  assert.ok(workBed(farm,4).ok)
  const complete=(id:string)=>{assert.ok(sendFerryExpedition(farm,id).ok);assert.ok(endDay(farm).ok);assert.ok(receiveFerryExpedition(farm).ok)}
  for(let i=0;i<3;i++)complete('mill-buy')
  assert.equal(farm.freight.expeditions.markets.mill.stock['handmade:round'],0)
  assert.equal(quoteExpedition(farm.freight.expeditions,'mill-grain',expeditionWallet(farm))?.available,false)
  assert.equal(quoteExpedition(farm.freight.expeditions,'mill-sale',expeditionWallet(farm))?.available,true)
  const before=farm.handmade.round
  complete('mill-sale')
  assert.equal(farm.handmade.round,before)
  assert.equal(farm.freight.expeditions.markets.mill.stock['handmade:round'],1)
  assert.equal(quoteExpedition(farm.freight.expeditions,'mill-buy',expeditionWallet(farm))?.available,false,'restocked bread still needs its price')
  assert.ok(sellMarketItem(farm,'produce:wheat',1).ok)
  assert.equal(quoteExpedition(farm.freight.expeditions,'mill-buy',expeditionWallet(farm))?.available,true)
})
