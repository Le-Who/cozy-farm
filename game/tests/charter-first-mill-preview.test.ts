import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes as strip } from 'node:module'
import test from 'node:test'
import { runInNewContext as vm } from 'node:vm'
import * as F from '../src/farm.ts'
import { getHarbourFishRoute, renderHarbourFishChoice } from '../src/harbour-fish-route.ts'
import * as H from '../src/harbour-economy.ts'
import * as Q from '../src/ferry-expeditions.ts'
import * as stocks from '../src/bay-freight-model.ts'
import * as restock from '../src/ferry-restock.ts'
import * as smaller from '../src/ferry-smaller-cargo.ts'
import * as exploration from '../src/ferry-discovery.ts'
import * as progress from '../src/ferry-project-progress.ts'
import { ruCount } from '../src/ru.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const milestones=JSON.parse(read('./fixtures/home-progress-actions.json'))
const main=read('../src/main.ts'), freight=read('../src/bay-freight-ui.ts')
function slice(text:string,a:string,b:string){
  const i=text.indexOf(a),j=text.indexOf(b,i+a.length)
  assert.ok(i>=0&&j>i,a)
  return text.slice(i,j)
}
const routeCode=strip("switch(action){"+slice(main,"    case 'harbour-fish-trade':","    case 'expedition-discovery':")
  +slice(main,"    case 'back':","    case 'journal-stay':")+"}")
const push=strip(slice(main,'  if(remember&&next!==panel){','  if (remember && next'))
const pop=strip('(()=>{'+slice(main,'  const previous=panelHistory.pop()','  const homeKitchenReturn')+';return previous})()')
const show=vm(strip(slice(freight,'const labels:', '/** DOM entry used').replaceAll('export function','function')
  .replaceAll('import.meta.env.BASE_URL','"/"')+';renderFreightPanel'),
  {...stocks,...Q,...restock,...smaller,...exploration,...progress,ruCount})
const quote=(f:F.FarmState,id:string)=>Q.quoteExpedition(f.freight.expeditions,id,H.expeditionWallet(f))!
function earn(){
  const p=commissionPlayer(milestones.slice(0,58))
  p.act('contributeVillage');p.act('collectEggs');p.act('buyFeed');p.act('feedChickens');p.night();p.act('collectEggs')
  assert.deepEqual([p.actions,p.state.day,p.state.island,p.state.coins,p.state.eggs,p.state.produce.wheat,
    p.state.village.supplies],[64,7,'home',116,7,1,{honey:2}])
  return p
}
function mounted(farm:F.FarmState){
  const ctx={farm,panel:'village-project',dialog:{open:true},action:'harbour-fish-trade',getHarbourFishRoute,
    selectedExpeditionPort:undefined as Q.ExpeditionPort|undefined,selectedExpeditionOffer:undefined as string|undefined,
    panelHistory:[] as {panel:string;focus:string}[],focus:'harbour-fish-trade',closeContextualSale:()=>false,
    returnToRecipeIndex:()=>false,returnToFerrySupplyOrigin:()=>false,event:{detail:0},
    rememberPanel:()=>({panel:ctx.panel,focus:ctx.focus}),
    openPanel(next:string){vm(push,{...ctx,next,remember:true});ctx.panel=next;ctx.focus='close'},
    goBack(keyboard:boolean){
      assert.equal(keyboard,true)
      const prior=vm(pop,ctx)
      if(prior){ctx.panel=prior.panel;ctx.focus=prior.focus}
    }}
  return {ctx,click(action=ctx.action){ctx.action=action;vm(routeCode,ctx)},
    draw:()=>show(farm.freight,{day:farm.day,coins:farm.coins,boatOwned:farm.boatOwned,playerPort:farm.island,
      expeditionPort:ctx.selectedExpeditionPort,expeditionOffer:ctx.selectedExpeditionOffer,
      openedPorts:H.openedFreightPorts(farm),carried:H.expeditionWallet(farm).bag,products:[],icon:()=>''}) as string}
}

test('an earned first charter shows an immediately viable, no-charge bun shipment instead of a disabled wheat sale',()=>{
  const p=earn(), f=p.state, before=structuredClone(f), ui=mounted(f)
  assert.match(renderHarbourFishChoice(f),/data-action="harbour-fish-catch"[^>]*>Поймать бесплатно<\/button>/)
  assert.match(renderHarbourFishChoice(f),/data-action="harbour-fish-trade"[^>]*>Посмотреть рейсы посада<\/button>/)
  assert.equal(quote(f,'mill-sale').available,false)
  assert.deepEqual([quote(f,'mill-eggs').available,quote(f,'mill-eggs').payCoins,quote(f,'mill-eggs').earnCoins],[true,0,1])
  ui.click()
  const html=ui.draw()
  assert.equal(ui.ctx.panel,'bay-freight')
  assert.match(html,/<h3>Яйца для свежей выпечки<\/h3>/)
  assert.match(html,/<strong>Булочка ×1<\/strong>/)
  assert.match(html,/<button[^>]*data-action="expedition-send" data-value="mill-eggs"[^>]*>/)
  assert.doesNotMatch(html,/<button[^>]*data-action="expedition-send"[^>]*disabled/)
  // Other orders are still reachable through the original disclosure.
  assert.match(html,/<details class="expedition-offers"><summary>Выбрать один или два заказа/)
  assert.match(html,/data-action="expedition-offer" data-value="mill-sale"/)
  assert.match(html,/data-action="expedition-pair" data-value="mill-buy"/)
  assert.deepEqual(f,before)
  ui.click('back')
  assert.deepEqual([ui.ctx.panel,ui.ctx.focus,ui.ctx.panelHistory.length],['village-project','harbour-fish-trade',0])
  assert.deepEqual(f,before)
  p.act('sendFerryExpedition','mill-eggs')
  assert.deepEqual([p.state.coins,p.state.eggs,p.state.handmade.round,getHarbourFishRoute(p.state).label],[116,3,0,'К текущему рейсу'])
  p.night()
  assert.equal(p.state.handmade.round,0)
  p.act('receiveFerryExpedition')
  assert.deepEqual([p.state.day,p.state.coins,p.state.handmade.round,p.state.village.built,
    p.state.village.supplies,getHarbourFishRoute(p.state).offer],[8,117,1,false,{honey:2},'explore-salt'])
})

test('honest mill sale, missing eggs, cargo in flight and elsewhere retain the established route',()=>{
  const beforeCare=commissionPlayer(milestones.slice(0,58)).state
  const wheatReady=commissionPlayer(milestones.slice(0,65)).state
  assert.equal(quote(beforeCare,'mill-eggs').available,false)
  assert.equal(getHarbourFishRoute(beforeCare).offer,'mill-sale')
  assert.equal(quote(wheatReady,'mill-sale').available,true)
  assert.equal(getHarbourFishRoute(wheatReady).offer,'mill-sale')
  const p=earn()
  p.visit('grove')
  assert.equal(getHarbourFishRoute(p.state).offer,'mill-sale')
  p.visit('home')
  p.act('sendFerryExpedition','mill-buy')
  assert.deepEqual([getHarbourFishRoute(p.state).offer,getHarbourFishRoute(p.state).label],['mill-buy','К текущему рейсу'])
  p.night()
  assert.deepEqual([getHarbourFishRoute(p.state).offer,getHarbourFishRoute(p.state).label],['mill-buy','К текущему рейсу'])
})
