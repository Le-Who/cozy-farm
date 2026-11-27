import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes as strip } from 'node:module'
import test from 'node:test'
import { runInNewContext as vm } from 'node:vm'
import * as F from '../src/farm.ts'
import * as Routes from '../src/harbour-fish-route.ts'
import { renderVillageBudget } from '../src/village-budget.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8')
const main=read('../src/main.ts')
const prelude=JSON.parse(read('fixtures/home-progress-actions.json')) as {name:string;args:unknown[]}[]
function between(a:string,b:string){
  const i=main.indexOf(a),j=main.indexOf(b,i+a.length)
  assert.ok(i>=0&&j>i,a)
  return main.slice(i,j)
}
const select=strip(between('let pastryShape:', '\n')+';pastryShape')
const button=strip(between('function button(label:', 'function quantity(')+';button')
const drawProject=strip(between('function villageProjectCard()', 'function finishSharedSupper(')+';villageProjectCard')
const follow=strip("switch('workshop'){"+between("    case 'workshop': {\n      const shape","    case 'open-village':")+"}")
const mount=strip("switch(panel){"+between("    case 'workshop': {","    case 'cookery': {")+"}")
const push=strip(between('  if(remember&&next!==panel){','  if (remember && next'))
const pop=strip('(()=>{'+between('  const previous=panelHistory.pop()', '  const homeKitchenReturn')+';return previous})()')

function earn(missing: true|false=true){
  const p=commissionPlayer(prelude.slice(0,65).map(({name,args},i)=>name==='workBed'
    ? {name,args:[args[0],1795803600000+i]} : {name,args}))
  assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.produce.wheat],[65,8,120,4])
  p.act('collectEggs')
  p.act('bakeWorkshop','folded') // A genuine earlier decision, remembered on a cold launch.
  p.act('sendFerryExpedition','mill-buy')
  p.visit('grove')
  for(let i=0;i<2;i++){
    const cast=p.act('beginFishingTrip')
    p.act('finishFishingTrip',cast.token,[{kind:'fish',species:'seaBass',variant:'regular'}])
  }
  p.visit('home')
  p.act('contributeVillage')
  p.night()
  p.act('receiveFerryExpedition')
  p.act('contributeVillage')
  if(!missing){
    p.act('sendFerryExpedition','mill-buy')
    p.night()
    p.act('receiveFerryExpedition')
  }
  assert.deepEqual([p.state.day,p.state.coins,p.state.produce.wheat,p.state.handmade.round,p.state.workshopPatterns,p.state.village.supplies],
    [missing?9:10,missing?105:90,2,missing?0:1,['folded'],{honey:2,'fish:seaBass':2,'handmade:round':1}])
  assert.equal(F.getWorkshopAction(p.state).available,true)
  return p
}
type Workshop= {initialShape:F.WorkshopShape;onBake:(shape:F.WorkshopShape)=>boolean;onCancel:()=>void}
function route(farm:F.FarmState, entry='village-project'){
  const result={writes:0}
  const ctx={...F,...Routes,renderVillageBudget,farm,day:farm.day,pastryShape:vm(select,{farm}),workshopRecipe:'pastry',
    panel:entry,panelHistory:[] as {panel:string;pastryShape:F.WorkshopShape}[],dialog:{open:true},
    button:vm(button,{icon:()=>'',escapeHtml:(x:string)=>x,numberFormat:new Intl.NumberFormat('ru-RU')}),
    iconUrl:()=>'',icon:()=>'',row:()=>'',deliveryItems:()=>'',requirementLink:()=>'',nav:(...args:string[])=>args.join(''),
    stockTile:()=>'',dialogContent:{querySelector:()=>({})},workshopGame:undefined as Workshop|undefined,
    createWorkshop(_host:unknown,options:Workshop){return options},
    rememberPanel(){return {panel:ctx.panel,pastryShape:ctx.pastryShape}},
    openPanel(next:string){vm(push,{...ctx,next,remember:true});ctx.panel=next},
    leaveScene(){
      const previous=vm(pop,ctx)
      if(previous){ctx.panel=previous.panel;ctx.pastryShape=previous.pastryShape}
    },
    perform(f:()=>F.ActionResult){const r=f();result.writes+=Number(r.ok);return r.ok},
  }
  const html=entry==='village-project'?vm(drawProject,ctx)() as string:''
  const existing=html.match(/<button[^>]*data-action="workshop"[^>]*>[^<]*<\/button>/)?.[0]
  if(entry==='village-project')assert.ok(existing)
  vm(follow,Object.assign(ctx,{value:existing?.match(/data-value="([^"]+)"/)?.[1]}))
  vm(mount,ctx)
  assert.equal(ctx.panel,'workshop')
  assert.ok(ctx.workshopGame)
  return {ctx,result,workshop:ctx.workshopGame}
}
test('the exact last charter bun is the local workshop entry default without overwriting a learned different form',()=>{
  const p=earn(), f=p.state, before=structuredClone(f)
  const there=route(f)
  assert.deepEqual(f,before)
  assert.equal(there.result.writes,0)
  assert.equal(there.workshop.initialShape,'round')
  assert.equal(there.ctx.pastryShape,'folded','generic form is not overridden even during the preview')
  there.workshop.onCancel()
  assert.equal(there.ctx.panel,'village-project')
  assert.equal(there.ctx.pastryShape,'folded')
  assert.deepEqual(f,before)
  const active=route(f)
  assert.ok(active.workshop.onBake(active.workshop.initialShape))
  assert.deepEqual([f.coins,f.produce.wheat,f.eggs,f.handmade.round,f.handmade.folded,f.village.built,active.result.writes],
    [105,0,1,1,1,false,1])
  assert.equal(F.getVillageProject(f).status,'ready')
  p.act('contributeVillage')
  assert.deepEqual([p.state.day,p.state.island,p.state.coins,p.state.village.built],[9,'home',57,true])
})
test('players still choose a different pastry, and ordinary or already-funded workshop entries keep the learned default',()=>{
  const p=earn(), home=structuredClone(p.state)
  const chosen=route(p.state)
  assert.ok(chosen.workshop.onBake('folded'))
  assert.deepEqual([p.state.handmade.folded,p.state.handmade.round,p.state.produce.wheat,F.getVillageProject(p.state).status],
    [2,0,0,'waiting'])
  assert.equal(route(home,'market').workshop.initialShape,'folded')
  const ready=earn(false).state, before=structuredClone(ready)
  assert.equal(F.getVillageProject(ready).status,'ready')
  assert.equal(route(ready).workshop.initialShape,'folded')
  assert.deepEqual(ready,before)
})
