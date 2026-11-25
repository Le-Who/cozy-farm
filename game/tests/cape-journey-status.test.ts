import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as F from '../src/farm.ts'
import { expeditionWallet, transferBayGoods } from '../src/harbour-economy.ts'
import { initialExpeditionPreview } from '../src/ferry-expeditions.ts'
import { firstFerryCargoOffer } from '../src/ferry-smaller-cargo.ts'
import { getCapeJourneyStatus } from '../src/cape-journey-status.ts'
import { getIslandJourneys } from '../src/journey.ts'
import { getDiscoveryTask } from '../src/discovery-path.ts'
import { apiaryReturnFixture } from './fixtures/apiary-return.ts'

const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
function earned(until=38) {
  let farm=F.createFarm()
  const commands={...F,transferBayGoods} as Record<string,Function>
  for(const step of opening.slice(0,until)) {
    assert.equal(commands[step.name](farm,...step.args).ok,true,step.name)
    const restored=F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
    assert.ok(restored);assert.deepEqual(restored,farm);farm=restored
  }
  return farm
}
const stock=(farm:F.FarmState)=>[farm.honey,farm.windHoney,farm.beeswax]
function advance(farm:F.FarmState){if(farm.island!=='home')assert.ok(F.sail(farm,'home').ok);assert.ok(F.endDay(farm).ok)}
function collectPreviewed(farm:F.FarmState,expected:string,deltas:number[]) {
  const before=structuredClone(farm)
  for(let read=0;read<3;read++)assert.equal(getCapeJourneyStatus(farm,'cape'),expected)
  assert.deepEqual(farm,before)
  const restored=F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(restored);assert.equal(getCapeJourneyStatus(restored,'cape'),expected)
  if(restored.island!=='cape')assert.ok(F.sail(restored,'cape').ok)
  const old=stock(restored)
  assert.ok(F.collectCapeHoney(restored).ok)
  assert.deepEqual(stock(restored).map((v,i)=>v-old[i]),deltas)
  assert.equal(getCapeJourneyStatus(restored,'cape'),undefined)
  const once=structuredClone(restored);assert.equal(F.collectCapeHoney(restored).ok,false);assert.deepEqual(restored,once)
}

test('earned first route stays unchanged; only a later available receipt-based collection gains the optional cue',()=>{
  for(const count of[29,30,33,34,35]) {
    const farm=earned(count),before=structuredClone(farm)
    assert.equal(farm.capeHoneyOn,0)
    assert.equal(getCapeJourneyStatus(farm,'cape'),undefined)
    assert.deepEqual(farm,before)
  }
  const farm=earned();assert.equal(farm.day,4);assert.equal(farm.honey,3)
  assert.equal(getCapeJourneyStatus(farm,'cape'),undefined)
  advance(farm)
  assert.equal(getDiscoveryTask(farm,{collections:true,islands:true})?.id,'upgrade-coop')
  assert.deepEqual(getIslandJourneys(farm).find(j=>j.id==='cape')?.nextAction,{target:'sail',value:'cape',label:'В путь · Цветочный мыс',enabled:true})
  collectPreviewed(farm,'На мысе можно собрать: цветочный мёд ×3.',[3,0,0])
})

test('actual receipts, not owned goods or a discovery flag, decide whether the return is known',()=>{
  const unknown=earned(35);unknown.honey=9;unknown.bayDiscoveries.push('honey')
  assert.equal(getCapeJourneyStatus(unknown,'cape'),undefined)
  const farm=earned();assert.ok(F.sellMarketItem(farm,'honey',3).ok);assert.equal(farm.honey,0);advance(farm)
  assert.equal(getCapeJourneyStatus(farm,'cape'),'На мысе можно собрать: цветочный мёд ×3.')
})

test('only the exact Cape destination shows a cue, and inaccessible or unready hives do not',()=>{
  const farm=earned();advance(farm)
  for(const island of F.islandIds) {
    const viewed={...farm,island}
    assert.equal(getCapeJourneyStatus(viewed,'cape'),'На мысе можно собрать: цветочный мёд ×3.')
    for(const destination of ['home','grove','village'] as const)assert.equal(getCapeJourneyStatus(viewed,destination),undefined)
  }
  assert.equal(getCapeJourneyStatus({...farm,boatOwned:false},'cape'),undefined)
  assert.equal(getCapeJourneyStatus({...farm,projects:{...farm.projects,dock:{}}},'cape'),undefined)
  assert.equal(getCapeJourneyStatus({...farm,capeFlowers:[null,null,null]},'cape'),undefined)
  assert.equal(getCapeJourneyStatus({...farm,capeFlowers:[farm.day,farm.day,farm.day]},'cape'),undefined)
  assert.equal(getCapeJourneyStatus({...farm,capeHoneyOn:farm.day},'cape'),undefined)
})

test('honey wind replaces an ordinary portion and the apiary adds only its actual honey and wax',()=>{
  const basic=earned();while(basic.day<8)advance(basic)
  collectPreviewed(basic,'На мысе можно собрать: цветочный мёд ×2 · мёд ветров ×1.',[2,1,0])
  const apiary=apiaryReturnFixture();advance(apiary)
  collectPreviewed(apiary,'На мысе можно собрать: цветочный мёд ×3 · мёд ветров ×1 · пчелиный воск ×1.',[3,1,1])
  const afterWind=apiaryReturnFixture('wind');advance(afterWind)
  collectPreviewed(afterWind,'На мысе можно собрать: цветочный мёд ×4 · пчелиный воск ×1.',[4,0,1])
})

test('one known flower can yield only rare honey, without inventing a zero ordinary portion',()=>{
  const farm=apiaryReturnFixture('empty')
  assert.ok(F.plantCapeFlower(farm,0).ok);advance(farm);assert.ok(F.sail(farm,'cape').ok);assert.ok(F.collectCapeHoney(farm).ok)
  while(farm.day<8)advance(farm)
  collectPreviewed(farm,'На мысе можно собрать: мёд ветров ×1.',[0,1,0])
})

function renderDock(farm:F.FarmState,boatIsland:F.IslandId) {
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const start=main.indexOf("    case 'boat': {",main.indexOf('function drawPanel()'))
  let body=main.slice(start,main.indexOf("    case 'dock-project':",start))
  body=body.replace("    case 'boat': {",'').replace(/\s*break\s*}\s*$/,'').replaceAll('import.meta.env.BASE_URL',"''")
  const button=(label:string,action:string,enabled=true,options:{value?:unknown}={})=>`<button data-action="${action}"${options.value!==undefined?` data-value="${options.value}"`:''}${enabled?'':' disabled'}>${label}</button>`
  const preview=initialExpeditionPreview(farm.freight.expeditions)
  return Function('farm','boatIsland','getIslandJourneys','getCapeJourneyStatus','button','quantity','boatPrice','requirementLink','icon','isProjectComplete','getHarborOrder','journeyDetailsOpen','escapeHtml','firstFerryCargoOffer','expeditionWallet','selectedExpeditionPort','selectedExpeditionOffer',`const dialogContent={innerHTML:''};${body};return dialogContent.innerHTML`)(farm,boatIsland,getIslandJourneys,getCapeJourneyStatus,button,(n:number)=>String(n),F.boatPrice,(s:string)=>s,(s:string)=>`<i>${s}</i>`,F.isProjectComplete,F.getHarborOrder,false,(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;'),firstFerryCargoOffer,expeditionWallet,preview.port,preview.offer) as string
}

test('actual selected dock template renders a passive line only in Cape and preserves its explicit sail action',()=>{
  const farm=earned();advance(farm);const before=structuredClone(farm)
  for(const destination of F.islandIds) {
    const html=renderDock(farm,destination)
    if(destination==='cape') {
      assert.match(html,/<article class="journey-card" data-island="cape"/)
      assert.match(html,/<p class="journey-return-status">На мысе можно собрать: цветочный мёд ×3\.<\/p>/)
      assert.match(html,/<button data-action="sail" data-value="cape">Отправиться<\/button>/)
      assert.match(html,/<p>Выращивайте цветы, собирайте мёд и стройте пасеку\.<\/p>/)
      assert.doesNotMatch(html,/data-action="collect-honey"/)
    } else assert.doesNotMatch(html,/journey-return-status|На мысе можно собрать/)
  }
  assert.deepEqual(farm,before)
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const rest=main.slice(main.indexOf("    case 'rest':\n"),main.indexOf("    case 'journal': {"))
  assert.doesNotMatch(rest,/getCapeJourneyStatus|journey-return-status/)
  assert.doesNotMatch(renderDock(earned(),'cape'),/journey-return-status/)
})
