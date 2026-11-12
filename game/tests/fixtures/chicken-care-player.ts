import * as F from '../../src/farm.ts'
import { getChickenFeedMix, mixChickenFeed, type ChickenFeedRecipe } from '../../src/chicken-feed.ts'

type Policy = ChickenFeedRecipe | 'shop'
/** Earned farm, public commands and a JSON restore after every successful action. */
export function chickenCarePlayer(policy: Policy = 'orchard', branch: 'basic'|'hatchery'|'packing' = 'basic') {
 let state=F.createFarm()
 const log:{name:string;args:unknown[];day:number;coins:number}[]=[]
 const commands={...F,mixChickenFeed} as Record<string,Function>
 function act(name:string,...args:unknown[]) {
  const result=commands[name](state,...args);if(!result.ok)throw Error(`${name}: ${result.message}`)
  log.push({name,args,day:state.day,coins:state.coins})
  const next=F.restoreCurrentFarm(JSON.parse(JSON.stringify(state)));if(!next)throw Error(`Save rejected after ${name}`);state=next
  return result
 }
 function sell(reserve=false) {
  for(const stock of F.getMarketStock(state)) {
   const keep=stock.item.kind==='eggs'?state.eggs:(reserve&&policy!=='shop'&&(
    stock.item.kind==='produce'&&stock.item.item==='wheat'||policy==='garden'&&stock.item.kind==='produce'&&stock.item.item==='carrot'||policy==='orchard'&&stock.item.kind==='fruit'&&stock.item.item==='apple'))?1:0
   if(stock.count>keep)act('sellMarketItem',stock.key,stock.count-keep)
  }
 }
 // The same initial harvest/coins for all policies, before any care choice.
 for(let i=0;i<16;i++)if(F.getBedStage(state.beds[i])==='ripe')act('workBed',i)
 act('collectEggs');act('pickFruit',0)
 for(const stock of F.getMarketStock(state))if(stock.count)act('sellMarketItem',stock.key,stock.count)
 const opening={coins:state.coins,actions:log.length}
 act('upgradeBuilding','coop')
 if(branch!=='basic')act('specializeFacility',branch)
 function grow(bed:number,crop:F.CropId) {
  if(F.getBedStage(state.beds[bed])==='ripe')act('workBed',bed)
  if(state.beds[bed].kind==='tilled'){
   if(!state.seeds[crop])act('buySeeds',crop)
   if(state.selectedSeed!==crop)act('selectSeed',crop)
   act('workBed',bed)
  }
  if(F.getBedAction(state,bed).kind==='water'){
   if(!state.water)act('refillWater')
   act('workBed',bed)
  }
 }
 function day() {
  grow(4,'wheat');grow(9,'carrot')
  if(F.getTreeAction(state,0).available)act('pickFruit',0)
  if(state.eggsReady)act('collectEggs')
  if(branch==='hatchery'&&state.flockSize<5&&state.hatchDay===null&&state.eggs)act('incubateEgg')
  if(!state.feed){
   if(policy!=='shop'&&getChickenFeedMix(state,policy).available)act('mixChickenFeed',policy)
   else act('buyFeed')
  }
  act('feedChickens')
  for(let id=0;id<state.flockSize&&state.chickenHappiness<5;id++)act('petChicken',id)
  const count=branch==='packing'?5:3
  while(state.eggs>=count)act(branch==='packing'?'packEggCrate':'packEggBasket')
  sell(true)
 }
 function run(days:number) {for(let i=0;i<days;i++){day();if(i<days-1)act('endDay')}return summary()}
 function summary(){return {policy,branch,day:state.day,coins:state.coins,liquid:F.getSale(state).coins+state.coins,feed:state.feed,
  includingFeed:F.getSale(state).coins+state.coins+state.feed*2,actions:log.length,boughtBags:log.filter(x=>x.name==='buyFeed').length,
  mixes:log.filter(x=>x.name==='mixChickenFeed').length,flock:state.flockSize,eggs:state.eggs,happiness:state.chickenHappiness}}
 return {get state(){return state},log,opening,act,day,run,summary}
}
