import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { canMixBedtimeFeed, getChickenFeedMix, mixChickenFeed, renderChickenFeedMixes } from '../src/chicken-feed.ts'
import { renderCoopPanel } from '../src/coop-panel.ts'
import { MarketSaleBrowseMemory } from '../src/market-sale-browse.ts'
import { ruPlural } from '../src/ru.ts'
import { chickenCarePlayer } from './fixtures/chicken-care-player.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const source = readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
function slice(from:string,to:string){
  const a=source.indexOf(from),b=source.indexOf(to,a+from.length)
  assert.ok(a>=0&&b>a,from)
  return source.slice(a,b)
}
const code=stripTypeScriptTypes(
  slice('function button(','function goods()')+
  slice('function flockFeedRow(','function seedCards()')+
  slice('function focusKey(','let harbourScene:')+
  slice('function openPanel(','function openRecipeBook(')+
  `async function click(action,value,control,event){switch(action){${slice("    case 'back':","    case 'journal-stay':")}
  ${slice("    case 'chicken-feed-open':","    case 'collect':")}}}`)

function earned() {
  const route=chickenCarePlayer('orchard');route.run(10)
  const i=route.log.findIndex(a=>a.name==='mixChickenFeed');assert.equal(i,56)
  const p=commissionPlayer(route.log.slice(0,i));assert.equal(p.actions,56);assert.equal(p.state.day,3)
  assert.equal(p.state.feed,0);assert.equal(p.state.chickensFed,false);assert.ok(canMixBedtimeFeed(p.state))
  assert.ok(getChickenFeedMix(p.state,'orchard').available&&getChickenFeedMix(p.state,'garden').available)
  return p.state
}
const noop=()=>{}
function ready(farm:F.FarmState){
  const s:Record<string,any>={...F,farm,canMixBedtimeFeed,mixChickenFeed,ruPlural,
    closeContextualSale:()=>false,returnToRecipeIndex:()=>false,numberFormat:new Intl.NumberFormat('ru-RU'),icon:()=>'',itemIcon:()=>'',requirementLinks:new Map(),
    panel:'rest',panelHistory:[],panelRenderVersion:0,selection:'',controls:[],returns:[],scrolls:[],flushed:[],sales:0,
    salePresentation:{place:undefined},marketSaleBrowse:new MarketSaleBrowseMemory(),signatureSlots:[null,null],
    recipeBook:{load:noop,snapshot:()=>({})},restoreFerryPanelView:noop,bayAudio:{primeEvents:noop},
    island:{isCrossing:()=>false,setViewMode:noop,setCoveFocus:noop},app:{dataset:{}},toast:{},dialogFeedback:{},
    updateCommunityReturn:noop,playBaySound:noop,stopHarbour:noop,stopFishing:noop,stopWorkshop:noop,stopCookery:noop,stopArrangement:noop,
    transplantSelection:{reset:noop},berryNurserySelection:{reset:noop},berryRenewalSelection:{reset:noop},gardenEditor:{reset:noop},recipeSurplusSelection:{reset:noop}}
  for (const k of 'seedPickerBed hiveFlower celebratedFestival journeyDetailsOpen journalDetailsOpen selectedWarehouseRequest selectedWarehouse selectedExpeditionPort selectedExpeditionOffer freightPlanOpen inventoryGroup boatIsland marketSaleFamily marketSaleQuery marketTab marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot pastryShape workshopRecipe cookingDish cookingFish signatureBase signatureSlot signatureRepeatId expandedRepeatId cookingMode communityOrderId communityResident requestedFood kitchenTart kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish signatureFamily'.split(' ')) s[k] ??= undefined
  class FeedRow {
    tabIndex=undefined as number|undefined
    getClientRects(){return s.feedVisible===false?[]:[{}]}
    focus(o:FocusOptions){assert.ok(o.preventScroll);s.selection='feed-row';s.document.activeElement=this;s.returns.push(s.selection)}
    scrollIntoView(o:ScrollIntoViewOptions){s.scrolls.push(o.block)}
  }
  class Button {
    body:string; dataset:Record<string,string>; disabled:boolean
    constructor(tag:string){
      this.body=tag;this.dataset=Object.fromEntries([...tag.matchAll(/data-([a-z-]+)="([^"]+)"/g)].map(m=>[m[1],m[2]]))
      this.disabled=/\sdisabled(?:\s|>|=)/.test(tag)
    }
    getClientRects(){return this.dataset.action==='feed'&&s.feedVisible===false?[]:[{}]}
    closest(selector:string){return selector==='.dialog-row'&&this.dataset.action==='feed'?s.feedRow:null}
    focus(o?:FocusOptions){if(o)assert.ok(o.preventScroll);s.selection=this.dataset.action;s.document.activeElement=this;s.returns.push(s.selection)}
  }
  s.document={activeElement:null}
  s.HTMLButtonElement=Button
  s.closeButton=new Button('<button data-action="close">')
  s.dialog={open:true,showModal(){this.open=true},querySelectorAll:()=>s.controls.filter((b:Button)=>!b.disabled)}
  s.dialogContent={scrollTop:0,querySelectorAll:()=>[],
    querySelector(selector:string){
      if(selector==='[data-feed-stock]')return {focus:()=>{s.selection='stock';s.document.activeElement=null}}
      if(selector.includes('[data-action="feed"]')&&s.panel==='rest')return s.controls.find((b:Button)=>b.dataset.action==='feed'&&!b.disabled)??null
      if(selector==='[data-rest-feed-ready]')return s.panel==='rest'?s.feedRow:null
      return null
    }}
  s.requestAnimationFrame=(f:()=>void)=>s.deferFocus?s.flushed.push(f):f()
  s.perform=(f:()=>{ok:boolean})=>{const r=f();if(r.ok){s.sales++;s.drawPanel()};return r.ok}
  s.drawPanel=()=>{
    s.panelRenderVersion++
    const art={icon:s.icon,row:s.row,button:s.button,feedRow:s.flockFeedRow}
    const content=s.panel==='chicken-feed'?renderChickenFeedMixes(farm,s.icon,s.panelHistory.at(-1)?.panel==='rest')
      :s.panel==='coop'?renderCoopPanel(farm,art):'<div class="rest-before-morning">'+s.flockFeedRow()+'</div>'
    s.feedRow=content.includes('data-action="feed"')?new FeedRow():null
    s.controls=[...content.matchAll(/<button\b[^>]*>/g)].map(([tag])=>new Button(tag))
    s.html=content
  }
  runInNewContext(code,s)
  s.act=async(action:string,detail=0,value?:string)=>{
    const control=s.controls.find((b:Button)=>b.dataset.action===action&&!b.disabled&&b.dataset.value===value)
    assert.ok(control,`${s.panel}: ${action} ${value??''} available`)
    if(detail===0)control.focus()
    await s.click(action,value,control,{detail})
  }
  s.drawPanel()
  return s
}

test('after an earned explicit mix, keyboard Back returns to the existing Rest feed row without arming or spending',async()=>{
  const farm=earned(),s=ready(farm),before=structuredClone(farm)
  assert.match(s.html,/data-action="chicken-feed-open"/)
  s.dialogContent.scrollTop=72
  await s.act('chicken-feed-open')
  assert.equal(s.panel,'chicken-feed')
  assert.deepEqual(farm,before,'opening mix does not spend anything')
  await s.act('mix-chicken-feed',0,'orchard')
  assert.equal(farm.feed,4);assert.equal(farm.chickensFed,false)
  assert.equal(farm.fruit.apple,before.fruit.apple-1);assert.equal(farm.produce.wheat,before.produce.wheat-1)
  const mixed=structuredClone(farm)
  await s.act('back')
  assert.equal(s.panel,'rest');assert.equal(s.dialogContent.scrollTop,72)
  assert.doesNotMatch(s.html,/data-action="chicken-feed-open"/)
  assert.match(s.html,/data-action="feed"/)
  assert.deepEqual(farm,mixed)
  console.log(JSON.stringify({day:farm.day,actions:56,oldButtonGone:true,focus:s.selection,feedAfterBack:farm.feed,alreadyFed:farm.chickensFed}))
  assert.equal(s.selection,'feed-row')
  assert.deepEqual(s.scrolls,['nearest'])
  assert.equal(s.document.activeElement,s.feedRow)
  assert.equal(s.document.activeElement.dataset,undefined,'focus cannot execute the feeding action or spend a held key')
  await s.act('feed')
  assert.equal(farm.feed,3);assert.equal(farm.chickensFed,true)
  assert.equal(s.sales,2)
  assert.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
})

test('plain Back retains the old mix, pointer/hidden or stale returns do not take keyboard focus',async()=>{
  for(const mode of ['no-mix','pointer','pointer-entry','hidden','stale'] as const){
    const f=earned(),s=ready(f)
    s.dialogContent.scrollTop=61;await s.act('chicken-feed-open',mode==='pointer-entry'?1:0)
    if(mode!=='no-mix')await s.act('mix-chicken-feed',0,'orchard')
    const before=structuredClone(f)
    if(mode==='hidden')s.feedVisible=false
    if(mode==='stale')s.deferFocus=true
    await s.act('back',mode==='pointer'?1:0)
    if(mode==='stale'){
      s.panelRenderVersion++;s.flushed.forEach((cb:()=>void)=>cb())
    }
    assert.equal(s.panel,'rest');assert.deepEqual(f,before)
    assert.equal(s.selection,mode==='no-mix'?'chicken-feed-open':'close')
    assert.deepEqual(s.scrolls,[])
    if(mode!=='stale')assert.equal(s.dialogContent.scrollTop,61)
  }
})
