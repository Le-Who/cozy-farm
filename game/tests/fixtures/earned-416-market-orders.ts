import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as F from '../../src/farm.ts'
import { commissionPlayer } from './commission-player.ts'
const opening=JSON.parse(readFileSync(new URL('./market-order-selection-commands.json',import.meta.url),'utf8'))
export function earned416Mixed(homeWarehouse=true) {
 const p=commissionPlayer(opening);p.visit('home')
 for(const {key,count} of F.getMarketStock(p.state))if(count&&key==='fruit:apple')p.act('sellMarketItem',key,count)
 for(const [i,crop] of F.cropIds.entries()){
  if(F.getBedAction(p.state,i).kind==='harvest')p.act('workBed',i,0)
  if(p.state.beds[i].kind==='crop')continue
  if(p.state.beds[i].kind==='empty')p.act('workBed',i,0)
  if(!p.state.seeds[crop])p.act('buySeeds',crop)
  p.act('selectSeed',crop);p.act('workBed',i,0)
 }
 const garden=()=>{
  for(const [i,b] of p.state.beds.entries()){
   if(b.kind!=='crop')continue
   const a=F.getBedAction(p.state,i)
   if(a.kind==='harvest')p.act('workBed',i,0)
   else if(a.kind==='water'){if(!a.available)p.act('refillWater');p.act('workBed',i,0)}
  }
 }
 for(const [slot,tree] of [[1,'pear'],[2,'peach']] as const)if(p.state.trees.home[slot]===null)p.act('buyAndPlantTree',slot,tree)
 for(let night=0;night<4;night++){garden();p.night()}
 garden()
 for(const i of [0,1,2])if(F.getTreeAction(p.state,i).kind==='pick')p.act('pickFruit',i)
 p.visit('grove')
 for(let i=0;i<3;i++)if(F.getShellAt(p.state,i))p.act('collectShell',i)
 p.visit('home')
 if(p.state.fruit.apple>=2)p.act('cookDish','appleJam')
 assert.ok(p.state.produce.wheat>=2)
 assert.ok(p.state.eggs>=1)
 if(homeWarehouse) {
  p.act('transferBayGoods','deposit','home','wheat',p.state.produce.wheat)
  p.act('transferBayGoods','deposit','home','eggs',p.state.eggs)
 }
 while(F.getSale(p.state).items<416) {
  assert.ok(p.state.day<800)
  if(F.getTreeAction(p.state,0).kind==='pick')p.act('pickFruit',0);else p.night()
 }
 const extra=F.getSale(p.state).items-416
 if(extra>0)p.act('sellMarketItem','fruit:apple',extra)
 assert.equal(F.getSale(p.state).items,416)
 return p
}
