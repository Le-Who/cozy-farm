import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { getBedAction, getBedStage, getIntentOffers, getNeighborPlans, getVillageMeal } from '../src/farm.ts'
import { qualityNames } from '../src/intent-orders.ts'
import { getNeighborFoodRecovery } from '../src/neighbor-food-recovery.ts'
import { neighborHelpStatus } from '../src/neighbor-help.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

test('after the day-20 shared supper, Finn’s lantern table is a distinct ready destination',()=>{
  const steps=JSON.parse(readFileSync(new URL('./fixtures/market-order-selection-commands.json',import.meta.url),'utf8'))
  const p=commissionPlayer(steps)
  function growWheat(){
    if(!p.state.seeds.wheat)p.act('buySeeds','wheat')
    p.act('selectSeed','wheat');p.act('workBed',0)
    while(getBedStage(p.state.beds[0])!=='ripe'){
      assert.ok(p.state.day<21)
      if(getBedAction(p.state,0).kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',0)}
      p.night()
    }
    p.act('workBed',0);p.act('bakeWorkshop','round')
  }
  const placements=[{slot:'food',x:0,y:0},{slot:'cup',x:.4,y:.2},{slot:'flowers',x:-.4,y:.2}]
  growWheat();p.visit('village');p.act('joinNeighborPlan','finn:1');p.act('serveNeighborPlan','finn:1','handmade:round')
  p.act('finishNeighborPlan','finn:1',{kind:'basket',settled:true,placements})
  p.act('advanceNeighborPlan','finn:1');p.night()
  growWheat();p.act('catchFish',true);p.visit('village');p.act('serveVillageMeal','round')
  const id='finn:2'
  p.act('joinNeighborPlan',id);p.act('serveNeighborPlan',id,'dish:orchardTart')
  const farm=p.state,before=structuredClone(farm)
  assert.equal(farm.day,20);assert.ok(getVillageMeal(farm).served)
  const plan=getNeighborPlans(farm).find(plan=>plan.id===id)!
  assert.equal(plan.episode,'finnLantern');assert.equal(getNeighborFoodRecovery(farm,id)?.state,'ready')
  const source=readFileSync(new URL('../src/community-ui.ts',import.meta.url),'utf8')
  const body=source.slice(source.indexOf('const escape'),source.indexOf('export function neighborPlanLinks')).replace(/^export /gm,'')
  const html=runInNewContext(stripTypeScriptTypes(body+"\nneighborDetail(farm,'finn',{icon:()=>'',offerIcon:()=>''})"),
    {farm,getNeighborPlans,getIntentOffers,getNeighborFoodRecovery,neighborHelpStatus,qualityNames}) as string
  const button=html.match(/data-action="arrange-neighbor" data-value="([^"]+)"[^>]*>([^<]+)<\/button>/)
  assert.equal(button?.[1],id);assert.equal(button?.[2],'К столу у фонариков')
  assert.doesNotMatch(html,/data-action="(?:village-meal|share-meal)"|>Накрыть стол<\/button>/)

  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const click=main.slice(main.indexOf("    case 'arrange-neighbor':"),main.indexOf("    case 'finn-picnic-ride':"))
  const opened:string[]=[],ctx={farm,getNeighborPlans,getNeighborFoodRecovery,value:button?.[1],communityResident:'finn',
    communityRequest:undefined,arrangementRequest:undefined,openPanel:(panel:string)=>opened.push(panel)}
  runInNewContext(stripTypeScriptTypes("switch('arrange-neighbor'){"+click+'}'),ctx)
  assert.deepEqual(opened,['arrangement'])
  assert.equal(JSON.stringify(ctx.arrangementRequest),JSON.stringify({kind:'neighbor',id}))
  assert.deepEqual(farm,before,'neither reading the card nor opening the table spends the dish')
  p.act('finishNeighborPlan',id,{kind:'table',settled:true,placements})
  assert.equal(p.state.dishes.orchardTart,before.dishes.orchardTart-1);assert.equal(p.state.coins,before.coins+plan.reward)
  assert.equal(p.state.fish.perch,before.fish.perch);assert.equal(p.state.village.meals,before.village.meals)
  assert.ok(p.state.neighbors.finn.helpReady);assert.equal(p.state.neighbors.finn.memories.at(-1)?.episode,'finnLantern')
})
