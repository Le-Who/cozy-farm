import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { renderFacilityChoiceDetails } from '../src/facility-choice.ts'
import { ruPlural } from '../src/ru.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

type Step = { name:string; args:unknown[] }
const actions = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8')) as Step[]
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const take = (from:string,to:string) => {
  const start=main.indexOf(from),end=main.indexOf(to,start+from.length)
  assert.ok(start>=0&&end>start)
  return main.slice(start,end)
}
const options = take('const branchChoices:', 'let specializationBuilding:')
const cards = stripTypeScriptTypes('(()=>{' + options
  + take('type ButtonOptions', 'function row(')
  + take('function specializationCards()', 'function flockFeedRow(').replace('import.meta.env.BASE_URL', '"/"')
  + 'return specializationCards()})()')
const route = stripTypeScriptTypes('{' + options + 'switch(action){' + take("    case 'specialize': {","    case 'kitchen':\n      island.visit") + '} }')

function early() {
  const p=commissionPlayer([])
  for(let i=0;i<p.state.beds.length;i++)if(F.getBedStage(p.state.beds[i])==='ripe')p.act('workBed',i,1000)
  p.act('collectEggs');p.act('pickFruit',0)
  for(const it of F.getMarketStock(p.state))
    if(it.count&&!['eggs','produce:wheat','fruit:apple'].includes(it.key))p.act('sellMarketItem',it.key,it.count)
  p.act('upgradeBuilding','coop');p.act('workBed',11,1000);p.act('feedChickens')
  for(let i=0;i<4;i++)p.act('petChicken',i)
  p.night();p.act('collectEggs');p.act('workBed',11,2000);p.act('pickFruit',0)
  assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.eggs,p.state.produce.wheat],[26,2,91,7,6])
  return p
}

function page(farm:F.FarmState){
  const commits:F.ActionResult[]=[]
  let panel='upgrades',html=''
  const env={...F, farm, action:'',value:'', specializationBuilding:'farmhouse',previewSpecialization:undefined,
    renderFacilityChoiceDetails,ruPlural,numberFormat:new Intl.NumberFormat('ru'),
    icon:()=>'',specializationStages:Object.fromEntries([...F.facilityBranchIds,...F.specializationIds].map(id=>[id,{mask:{path:id}}])),
    perform(commit:()=>F.ActionResult){const result=commit();if(result.ok)commits.push(result);return result.ok},
    island:{showUpgrade(){}},
    openPanel(next:string){panel=next;env.drawPanel()},
    drawPanel(){html=runInNewContext(cards,env)}
  }
  return {commits, get panel(){return panel}, get html(){return html}, action(action:string,value:string){env.action=action;env.value=value;runInNewContext(route,env)}}
}
const current = (farm:F.FarmState) => F.getMarketOrders(farm).find(order=>order.lane==='flock')
const quote = (html:string) => html.match(/<p id="coop-first-order">(Первый заказ:[^<]+)<\/p>/)?.[1]
const nativeButton = (html:string,action:string,value:string) =>
  [...html.matchAll(/<button\b[^>]*>/g)].map(m=>m[0]).find(tag=>tag.includes(`data-action="${action}"`)&&tag.includes(`data-value="${value}"`))
const packed = /Ящик яиц ×1 \+ Пшеница ×2/

test('an earned D2 Coop II previews both native choices read-only, and only explicit Build reaches the exact first live order',()=>{
  const start=early().state
  for(const branch of ['hatchery','packing'] as const) {
    const farm=F.restoreCurrentFarm(JSON.parse(JSON.stringify(start)))!, p=page(farm)
    const old=structuredClone(farm)
    assert.equal(current(farm),undefined)
    p.action('specialize','coop')
    assert.equal(p.panel,'specialize')
    assert.equal(quote(p.html),undefined)
    assert.ok(nativeButton(p.html,'preview-specialization','hatchery'))
    assert.ok(nativeButton(p.html,'preview-specialization','packing'))
    const other=branch==='hatchery'?'packing':'hatchery'
    p.action('preview-specialization',other);p.action('preview-specialization',branch)
    const preview=quote(p.html)
    assert.ok(preview,'the real emitted details must show the first order, not generic market prose')
    assert.equal((p.html.match(/Первый заказ:/g)??[]).length,1)
    assert.doesNotMatch(p.html,/Откроются заказы этого направления на рынке/)
    assert.match(nativeButton(p.html,'preview-specialization',branch)!,/aria-pressed="true"/)
    assert.match(nativeButton(p.html,'preview-specialization',branch)!,/aria-describedby="coop-first-order"/)
    assert.doesNotMatch(nativeButton(p.html,'preview-specialization',other)!,/aria-describedby|aria-pressed="true"/)
    assert.doesNotMatch(nativeButton(p.html,'build-specialization',branch)!,/disabled/)
    assert.match(p.html,branch==='hatchery'?/через 2 ночи/:/5 обычных яиц → 1 ящик/)
    assert.deepEqual(farm,old)
    assert.equal(p.commits.length,0)

    p.action('build-specialization',branch)
    assert.equal(p.commits.length,1)
    assert.equal(farm.coins,old.coins-F.facilitySpecializations.coop[branch].price)
    assert.deepEqual([farm.eggs,farm.eggCrates,farm.produce.wheat,farm.hatchDay],[old.eggs,0,old.produce.wheat,null])
    const order=current(farm)!
    assert.ok(preview.includes(`· +${order.reward} монет`))
    assert.deepEqual(order.items.map(it=>[F.marketKey(it),it.quantity]),branch==='hatchery'?[['eggs',6]]:[['eggCrates',1],['produce:wheat',2]])
    assert.match(preview,branch==='hatchery'?/6 яиц/:packed)
    assert.equal(order.status,branch==='hatchery'?'ready':'waiting','a quoted order does not create a crate')
    assert.equal(farm.orders.flock.completed,0)
    assert.equal(quote(renderFacilityChoiceDetails(farm,branch)),undefined, 'not a projection for an already-built facility')
  }
})

test('the same production quote observes actually earned Fair pricing rather than promising a fixed 40',()=>{
  const throughFair=actions.map(x=>x.name==='deliverProject'&&x.args[0]==='fair').lastIndexOf(true)+1
  const p=commissionPlayer(actions.slice(0,throughFair));const farm=p.state
  assert.equal(F.getProject(farm,'fair').status,'completed')
  assert.equal(farm.buildingLevels.coop,2)
  assert.equal(current(farm),undefined)
  const before=structuredClone(farm)
  const html=renderFacilityChoiceDetails(farm,'packing')
  assert.match(quote(html)??'',packed)
  assert.match(quote(html)??'',/\+42 монеты/)
  assert.deepEqual(farm,before)
  p.act('specializeFacility','packing')
  assert.equal(current(p.state)?.reward,42)
  assert.ok(current(p.state)?.items.some(item=>item.kind==='produce'&&item.item==='wheat'&&item.quantity===2))
})

test('unfunded Home still previews the terms without making Build eligible, unrelated and off-island choices do not get this row',()=>{
  const p=early()
  p.act('upgradeBuilding','farmhouse');p.act('upgradeBuilding','well');p.act('buyBoat')
  assert.ok(p.state.coins<F.facilitySpecializations.coop.hatchery.price)
  const h=page(p.state),safe=structuredClone(p.state)
  h.action('specialize','coop');h.action('preview-specialization','packing')
  assert.match(quote(h.html)??'',packed)
  assert.match(nativeButton(h.html,'build-specialization','packing')!,/disabled/)
  assert.deepEqual(p.state,safe)
  assert.equal(h.commits.length,0)
  h.action('specialize','well');h.action('preview-specialization','rain')
  assert.equal(quote(h.html),undefined)
  assert.match(h.html,/Откроются заказы этого направления на рынке/)
  assert.doesNotMatch(h.html,/aria-describedby="coop-first-order"/)
  assert.equal(quote(renderFacilityChoiceDetails(F.createFarm(),'hatchery')),undefined)
  p.visit('grove');assert.equal(quote(renderFacilityChoiceDetails(p.state,'packing')),undefined)
})
