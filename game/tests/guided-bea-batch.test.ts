import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {createContext,runInContext} from 'node:vm'
import {test} from 'node:test'
import * as F from '../src/farm.ts'
import {getDiscoveryTask} from '../src/discovery-path.ts'
import {getGuidanceTask} from '../src/discovery-guidance.ts'
import {harbourCraftReturnPlayer} from './fixtures/harbour-craft-return.ts'

const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const part=(a:string,b:string)=>{const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j)}
const activation=part('function activateTarget(', "    case 'bay-display':")+"}}"
const playerInput=part("  if (action === 'follow-task') {","  switch (action) {")
const code=stripTypeScriptTypes(part('function pastryChoices()', 'function villageProjectCard()')
  +part('function neighboursCard()','let selectedWarehouseRequest:')
  +activation+`
  function click(action,value,control){
    ${playerInput}
    switch(action){
      ${part("    case 'visit-cottage':","    case 'village-meal':\n      if (value")}
      ${part("    case 'pastry-shape': {","    case 'share-meal':")}
      ${part("    case 'resident-service': {","    case 'finn-pier':")}
    }
  }
  ;({click})
  `)
const earned=()=>{
 const {p}=harbourCraftReturnPlayer()
 assert.deepEqual([p.actions,p.state.day,p.state.island,p.state.coins,p.state.produce.wheat,p.state.eggs],[204,25,'village',218,5,3])
 assert.deepEqual(p.state.workshopPatterns,['round']);assert.ok(p.state.culinary.tastings.bea.bonus)
 return p
}
function view(farm:F.FarmState,manual:F.WorkshopShape='round'){
 let html='',mount={},lastMounted:object|undefined
 const visits:number[]=[],commits:string[]=[]
 const dialogContent={
  get innerHTML(){return html},set innerHTML(v:string){html=v;mount={};lastMounted=undefined},
  querySelector:()=>null,contains:(el:object)=>el===lastMounted,
 }
 const ctx={
  ...F,farm,dialog:{open:true},panel:'village',pastryShape:manual,villageSlot:0,dialogContent,panelHistory:[] as unknown[],
  island:{isCrossing:()=>false,visit:(t:{index:number})=>visits.push(t.index)},
  currentTask:()=>getGuidanceTask(farm.discoveryPreferences,getDiscoveryTask(farm,farm.orientation)),
  pastryIcons:{round:'ui-handmade-round',long:'ui-handmade-long',folded:'ui-handmade-folded'},
  icon:()=>'',stockTile:()=>'',neighborHelpCard:()=>'',getFinnFishingRoute:()=>undefined,villageHomeProgress:()=>'',applyIngredientFinishes:()=>{},
  nav:(...content:string[])=>content.join(''),
  button:(label:string,action:string,enabled=true,options:{value?:string,context?:string}={})=>
    `<button data-action="${action}" data-value="${options.value??''}"${options.context?' data-context="'+options.context+'"':''}${enabled?'':' disabled'}>${label}</button>`,
  openPanel(next:string){ctx.panel=next;ctx.dialog.open=true;if(next==='village')ctx.drawPanel()},
  drawPanel(){runInContext('dialogContent.innerHTML=neighboursCard()',vm)},
  perform(fn:()=>F.ActionResult,close:boolean){const r=fn();if(r.ok){commits.push(r.message);if(close){ctx.dialog.open=false;html='';lastMounted=undefined}}return r.ok},
 }
 const vm=createContext(ctx)
 const {click}=runInContext(code,vm)
 function button(action:string) {
  const match=html.match(new RegExp('<button data-action="'+action+'" data-value="([^"]*)"([^>]*)>([^<]*)'))
  if(!match)return
  const el={mount};lastMounted=el
  return {el,key:match[1],text:match[3],attributes:match[2]}
 }
 return {ctx,click,button,visits,commits,show:()=>html,choose:(s:F.WorkshopShape)=>click('pastry-shape',s),
  guide:()=>{ctx.panel='journal';click('follow-task',undefined,{})},
  openOrdinary:()=>{ctx.panel='journal';click('visit-cottage','0',{})}}
}

test('earned Home Harvest follow-through picks the ready Bea batch on the guided card without spending or overwriting manual shape',()=>{
 const {state}=earned(),v=view(state),before=JSON.stringify(state)
 v.choose('folded')
 assert.equal(v.button('practice-pattern')?.key,'folded')
 v.guide()
 const batch=v.button('resident-service')
 assert.deepEqual([v.ctx.panel,v.ctx.pastryShape,batch?.key,batch?.text],['village','folded','bea:round','Испечь ×4'])
 assert.match(v.show(),/data-value="round" aria-pressed="true"/)
 assert.match(v.show(),/data-value="folded" aria-pressed="false"/)
 assert.match(v.show(),/data-value="long" aria-pressed="false"/)
 assert.equal(v.button('practice-pattern'),undefined)
 assert.deepEqual(v.visits,[0]);assert.deepEqual(v.commits,[]);assert.equal(JSON.stringify(state),before)
 v.click('resident-service',batch!.key,batch!.el)
 assert.deepEqual([state.day,state.coins,state.produce.wheat,state.eggs,state.handmade.round,state.handmade.folded],[25,218,1,1,4,0])
 assert.equal(state.culinary.tastings.bea.bonus,false);assert.equal(v.commits.length,1)
 const baked=JSON.stringify(state)
 v.click('resident-service',batch!.key,batch!.el)
 assert.equal(v.commits.length,1);assert.equal(JSON.stringify(state),baked)
 v.openOrdinary()
 assert.equal(v.ctx.pastryShape,'folded');assert.equal(v.button('practice-pattern')?.key,'folded');assert.equal(JSON.stringify(state),baked)
})

test('manual visit, return from guided mode and an already valid chosen shape stay ordinary',()=>{
 const {state}=earned(),v=view(state,'folded'),before=JSON.stringify(state)
 v.openOrdinary()
 assert.equal(v.button('practice-pattern')?.key,'folded')
 v.guide()
 const guided=v.button('resident-service')
 assert.equal(guided?.key,'bea:round')
 v.openOrdinary() // Real manual renderer replaces the guided control and marks its saved manual shape.
 assert.equal(v.button('practice-pattern')?.key,'folded')
 v.click('resident-service',guided!.key,guided!.el)
 assert.equal(JSON.stringify(state),before)
 v.choose('round');v.guide()
 const round=v.button('resident-service')
 assert.equal(round?.key,'bea','no guided override when selected shape is ready')
 assert.equal(round?.text,'Испечь ×4');assert.equal(v.ctx.pastryShape,'round')
 assert.equal(JSON.stringify(state),before)
})

test('a real manual bake can make the batch unaffordable; the live guide no longer puts a false batch in Bea’s cottage',()=>{
 const p=earned()
 p.act('bakeWorkshop','folded')
 assert.deepEqual([p.state.produce.wheat,p.state.eggs,p.state.handmade.folded],[3,2,1])
 const v=view(p.state,'folded'),before=JSON.stringify(p.state)
 v.openOrdinary()
 assert.match(v.button('resident-service')!.attributes,/disabled/)
 v.guide()
 assert.equal(v.ctx.villageSlot,1,'when unavailable the existing Finn opportunity remains, without inventing a Bea route')
 assert.equal(v.button('resident-service')?.key,'finn')
 assert.equal(JSON.stringify(p.state),before)
})

test('when two shapes are actually mastered and affordable the nondefault selection remains the chosen batch',()=>{
 const p=earned()
 p.act('bakeWorkshop','folded');p.visit('home')
 if(!p.state.seeds.wheat)p.act('buySeeds','wheat')
 if(p.state.selectedSeed!=='wheat')p.act('selectSeed','wheat')
 const i=p.state.beds.findIndex(b=>b.kind==='tilled')
 assert.ok(i>=0);p.act('workBed',i)
 for(let n=0;n<8&&F.getBedAction(p.state,i).kind!=='harvest';n++){
  if(F.getBedAction(p.state,i).kind==='water'){
   if(!p.state.water)p.act('refillWater')
   p.act('workBed',i)
  }
  p.night()
 }
 p.act('workBed',i);p.visit('village')
 const f=p.state,before=JSON.stringify(f),v=view(f,'folded')
 assert.deepEqual(f.workshopPatterns,['round','folded'])
 assert.ok(F.getResidentService(f,'bea','round').available&&F.getResidentService(f,'bea','folded').available)
 v.guide()
 const chosen=v.button('resident-service')
 assert.equal(chosen?.key,'bea');assert.match(chosen!.attributes,/Слойка/)
 assert.match(v.show(),/data-value="folded" aria-pressed="true"/)
 assert.equal(JSON.stringify(f),before)
})
