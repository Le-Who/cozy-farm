import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {getBerryNurserySource} from '../src/berry-nursery.ts'
import {villageHomeProgress} from '../src/village-home-art.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
function section(start:string,end:string) {
  const from=source.indexOf(start),to=source.indexOf(end,from+start.length);assert.ok(from>=0&&to>from)
  return source.slice(from,to)
}
const render=stripTypeScriptTypes(section('function neighboursCard()', 'let selectedWarehouseRequest')
  + section('function stockLabel(', 'function recipeDestination(')
  + section('function requirementLink(', 'const islandNames =')
  + section('function button(', 'function quantity(')+';neighboursCard()')
const enter=stripTypeScriptTypes("switch ('practice-pattern') {"+section("    case 'practice-pattern':","    case 'pastry-shape':")+'}')

test('Bea’s unlearned pastry quotes one manual bake, links missing stock, and starts only when affordable',()=>{
  const actions=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
  const firstDinner=actions.findIndex(a=>a.name==='serveVillageMeal'),p=commissionPlayer(actions.slice(0,firstDinner+1))
  const panel=(shape:F.WorkshopShape)=>{
    const requirementLinks=new Map(),opened:string[]=[]
    const ctx={...F,farm:p.state,requirementLinks,getBerryNurserySource,villageHomeProgress,villageSlot:0,panel:'village',pastryShape:shape,value:shape,
      workshopRecipe:'bread',openPanel:(id:string)=>opened.push(id),neighborHelpCard:()=>'',pastryChoices:()=>'',icon:()=>'',
      nav:(...entries:string[])=>entries.join('')}
    return {html:runInNewContext(render,ctx) as string,requirements:[...requirementLinks.values()],
      start:()=>{runInNewContext(enter,ctx);return opened},ctx}
  }
  assert.equal(p.state.day,10);assert.deepEqual(p.state.village.residents,['bea',null])
  assert.deepEqual(p.state.workshopPatterns,['round'])
  const missing=panel('folded')
  assert.deepEqual(missing.requirements.map(r=>r.item),F.workshopIngredients)
  assert.match(missing.html,/0\/2/);assert.match(missing.html,/0\/1/)
  assert.equal((missing.html.match(/data-action="show-requirement"/g)||[]).length,2)
  assert.match(missing.html,/data-action="practice-pattern"[^>]*disabled>/)
  assert.doesNotMatch(missing.html,/data-action="resident-service"|Беа запомнит образец/)
  assert.deepEqual(missing.start(),[],'a stale or keyboard activation cannot enter a shortage screen')

  const harvest=actions.findIndex((a,i)=>i>firstDinner&&a.name==='collectEggs')
  for(const a of actions.slice(firstDinner+1,harvest+1))p.act(a.name,...a.args)
  p.act('sellMarketItem','eggs',p.state.eggs-1);p.visit('village')
  assert.deepEqual([p.state.produce.wheat,p.state.eggs],[2,1])
  const supply=structuredClone(p.state),ready=panel('folded')
  assert.match(ready.html,/2\/2/);assert.match(ready.html,/1\/1/)
  assert.doesNotMatch(ready.html,/data-action="practice-pattern"[^>]*disabled|data-action="resident-service"/)
  assert.deepEqual(ready.start(),['workshop']);assert.equal(ready.ctx.workshopRecipe,'pastry')
  assert.deepEqual(p.state,supply,'opening the manual workshop does not spend ingredients or daily help')
  const learned=panel('round')
  assert.deepEqual(learned.requirements.map(r=>r.item.quantity),[4,2])
  assert.match(learned.html,/data-action="resident-service"[^>]*disabled>Испечь ×3/)
  assert.doesNotMatch(learned.html,/data-action="practice-pattern"/)
  p.act('bakeWorkshop','folded');assert.equal(p.state.handmade.folded,1);assert.deepEqual([p.state.produce.wheat,p.state.eggs],[0,0])
  assert.ok(p.state.workshopPatterns.includes('folded'));assert.doesNotMatch(panel('folded').html,/data-action="practice-pattern"/)
  assert.equal(p.state.village.serviceOn.bea,supply.village.serviceOn.bea)
})

test('an occupied Bea house confirms the selected mastered pastry by name',()=>{
  const actions=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
  const p=commissionPlayer(actions.slice(0,actions.findIndex(a=>a.name==='serveVillageMeal')+1))
  assert.equal(p.state.island,'village');assert.equal(p.state.village.residents[0],'bea')
  const farm=structuredClone(p.state)
  assert.ok(F.sail(farm,'home').ok)
  // Seed ingredients only. Mastery is earned through the same manual bake as normal play.
  farm.produce.wheat=8;farm.eggs=4
  assert.ok(F.bakeWorkshop(farm,'folded').ok)
  assert.ok(F.bakeWorkshop(farm,'long').ok)
  assert.ok(F.sail(farm,'village').ok)
  assert.ok(F.restoreCurrentFarm(farm))
  const before=structuredClone(farm)
  const selectors=section('function pastryChoices()', 'function villageProjectCard()')
  const house=stripTypeScriptTypes(selectors)+render
  const targets:Record<string,string|undefined>={}
  for(const shape of F.workshopShapes){
    assert.ok(F.getResidentService(farm,'bea',shape).available)
    const html=runInNewContext(house,{...F,farm,pastryShape:shape,villageSlot:0,requirementLinks:new Map(),getBerryNurserySource,villageHomeProgress,
      neighborHelpCard:()=>'',icon:()=>'',pastryIcons:{},nav:(...parts:string[])=>parts.join('')}) as string
    assert.match(html,new RegExp('data-action="pastry-shape" data-value="'+shape+'" aria-pressed="true"'))
    const buttons=[...html.matchAll(/<button[^>]+data-action="resident-service"[^>]*>[^<]*<\/button>/g)]
    assert.equal(buttons.length,1);assert.doesNotMatch(buttons[0][0],/\bdisabled\b/)
    assert.match(buttons[0][0],/>Испечь ×3\s*<\/button>/)
    targets[shape]=buttons[0][0].match(/aria-label="([^"]+)"/)?.[1]
    const charged=structuredClone(farm)
    assert.ok(F.runResidentService(charged,'bea',shape).ok)
    assert.deepEqual(charged.handmade,{...farm.handmade,[shape]:farm.handmade[shape]+3})
    assert.ok(!F.runResidentService(charged,'bea',shape).ok,'the action spends daily help')
  }
  assert.deepEqual(targets,{round:'Испечь ×3, Круглая булочка',folded:'Испечь ×3, Слойка',long:'Испечь ×3, Батон'})
  assert.deepEqual(farm,before)
})
