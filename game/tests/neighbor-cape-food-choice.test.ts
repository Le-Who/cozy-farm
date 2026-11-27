import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {test} from 'node:test'
import * as F from '../src/farm.ts'
import {qualityNames} from '../src/intent-orders.ts'
import {getNeighborFoodRecovery} from '../src/neighbor-food-recovery.ts'
import {neighborHelpStatus} from '../src/neighbor-help.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8')
const recipe=JSON.parse(read('./fixtures/home-progress-actions.json'))
function matured() {
  const p=commissionPlayer(recipe)
  assert.deepEqual([p.actions,p.state.day,p.state.island,p.state.coins,p.state.capeLevel],[107,14,'village',68,1])
  p.visit('cape');p.act('collectCapeHoney');p.act('upgradeCape');p.visit('grove');p.act('pickFruit',0);p.act('gatherSeaSalt');p.visit('home')
  assert.equal(p.state.coins,20)
  const peachSlot=p.state.trees.home.findIndex(x=>x===null)
  p.act('buySapling','peach');p.act('plantTree',peachSlot,'peach');p.act('selectSeed','wheat')
  const grainBeds=p.state.beds.flatMap((b,i)=>b.kind==='tilled'?[i]:[]).slice(0,2)
  if(p.state.seeds.wheat<grainBeds.length)p.act('buySeeds','wheat')
  for(const bed of grainBeds)p.act('workBed',bed)
  function tend(){
   for(const bed of grainBeds){
    const a=F.getBedAction(p.state,bed)
    if(a.kind==='water'){
     if(!a.available)p.act('refillWater')
     p.act('workBed',bed)
    }else if(a.kind==='harvest')p.act('workBed',bed)
   }
  }
  tend()
  for (let day=15;day<=18;day++){
   p.night();tend()
   p.visit('cape');p.act('collectCapeHoney')
   p.visit('home')
   if(p.state.honey>4)p.act('sellMarketItem','honey',p.state.honey-4)
  }
  if(p.state.trees.home[peachSlot].fruitReady)p.act('pickFruit',peachSlot)
  p.visit('grove');p.act('gatherSeaSalt')
  p.visit('cape');p.act('upgradeCape')
  while(p.state.day<20){p.night();tend()}
  if(p.state.trees.home[peachSlot].fruitReady)p.act('pickFruit',peachSlot)
  p.visit('village');return p
}
const source=read('../src/community-ui.ts'), main=read('../src/main.ts')
const between=(s:string,a:string,b:string)=>{const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return s.slice(i,j)}
const view=runInNewContext(stripTypeScriptTypes(
  between(source,'const escape =','export function communityBoard').replaceAll('export function','function')
  +between(source,'export function neighborDetail','export function neighborPlanLinks').replace('export function','function')
  +'\nneighborDetail'),{...F,qualityNames,getNeighborFoodRecovery,neighborHelpStatus})
const clickPreview=stripTypeScriptTypes("switch ('cook-intent-offer'){"
  + between(main,"    case 'cook-intent-offer': {","    case 'request-start-cook':") + "}")
const cold=(f:F.FarmState)=>{const v=F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!;assert.deepEqual(v,f);return v}
const ok=(result:F.ActionResult)=>assert.ok(result.ok,result.message)
const initialized=()=>{
 const p=matured()
 assert.deepEqual([p.actions,p.state.day,p.state.island,p.state.coins,p.state.capeLevel,p.state.produce.wheat,p.state.honey,
   p.state.eggs,p.state.windHoney,p.state.fruit.peach],[154,20,'village',19,3,4,4,3,1,3])
 const f=cold(p.state);ok(F.joinNeighborPlan(f,'bea:1'));return f
}
const noWind=(f:F.FarmState)=>{
 ok(F.sail(f,'home'));ok(F.sellMarketItem(f,'windHoney',1));ok(F.sail(f,'village'))
 return cold(f)
}
function cards(f:F.FarmState) {
 const before=JSON.stringify(f), html=view(f,'bea',{icon:()=>'',offerIcon:()=>''}) as string
 assert.equal(JSON.stringify(f),before,'render is read-only, including plan and exact stocks')
 return [...html.matchAll(/<button\b([^>]+)>([\s\S]*?)<\/button>/g)].filter(([,attrs])=>attrs.includes('class="community-food"'))
  .map(([,attrs,body])=>({id:attrs.match(/data-value="([^"]+)"/)?.[1],action:attrs.match(/data-action="([^"]+)"/)?.[1],
    ready:attrs.includes('data-ready="true"'),tag:attrs,body}))
}
const local='dish:honeyCake', cape='dish:windParfait'
test('earned D20 puts one fully supplied Cape dessert in the first three-card row, not ahead of local cooking',()=>{
 const f=initialized(), all=cards(f)
 assert.equal(all.length,6)
 assert.deepEqual(all.slice(0,2).map(({id,action,ready})=>({id,action,ready})),
   [local,cape].map(id=>({id,action:'cook-intent-offer',ready:false})))
 assert.match(all[0].body,/Приготовить/)
 assert.match(all[1].body,/К рецепту/)
 assert.deepEqual(all.slice(2).map(({id})=>id),['dish:strawberryTart','dish:blueberryTart','dish:raspberryTart','dish:honeyPear'])
 assert.equal(F.getCookAction(f,'windParfait').available,false,'not cookable in the Village')
 assert.equal(F.getCookAction({...f,island:'cape'},'windParfait').available,true,'valid real local Cape result')
})
test('spending the only wind honey through actual sale takes away the promotion immediately',()=>{
 const spent=noWind(initialized()), all=cards(spent)
 assert.equal(spent.windHoney,0)
 assert.equal(all.length,6);assert.equal(all[0].id,local)
 assert.equal(all.at(-1)?.id,cape);assert.equal(all.at(-1)?.ready,false)
 assert.equal(F.getCookAction({...spent,island:'cape'},'windParfait').available,false)
})
test('a prepared local dish remains selected; either unprepared card opens only the existing exact recipe',()=>{
 const f=initialized(), before=cold(f), food=cards(f)
 for(const id of [local,cape]){
  const button=food.find(o=>o.id===id)!
  const panels:string[]=[]
  const context={...F,farm:f,value:button.id,control:{dataset:{plan:'bea:1'}},requestedFood:undefined,communityRequest:undefined,
    communityOffers:()=>F.getIntentOffers(f,'delicate'),openPanel:(panel:string)=>panels.push(panel)}
  runInNewContext(clickPreview,context)
  assert.deepEqual(panels,['request-food']);assert.equal(context.requestedFood,id)
  assert.deepEqual(f,before)
 }
 ok(F.cookDish(f,'honeyCake'));assert.equal(cards(f)[0].id,local);assert.equal(cards(f)[0].ready,true)
 ok(F.serveNeighborPlan(f,'bea:1',local))
 const selected=f.neighbors.bea.current?.food
 assert.ok(selected?.id===local)
 const html=view(f,'bea',{icon:()=>'',offerIcon:()=>''})
 assert.match(html,/data-action="arrange-neighbor"/)
 assert.deepEqual(f.neighbors.bea.current?.food,selected)
 assert.deepEqual([f.dishes.honeyCake,f.coins,f.island],[1,19,'village'])
})
