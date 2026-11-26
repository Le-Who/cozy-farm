import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as Farm from '../src/farm.ts'
import * as Routes from '../src/harbour-fish-route.ts'
import {ActionClickGuard,ActivationKeyGuard,isGuardedAction} from '../src/action-click-guard.ts'
import {renderVillageBudget} from '../src/village-budget.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8')
const milestones=JSON.parse(read('./fixtures/home-progress-actions.json'))
const main=read('../src/main.ts')
function between(a:string,b:string){
 const i=main.indexOf(a),j=main.indexOf(b,i+1)
 assert.ok(i>=0&&j>i)
 return main.slice(i,j)
}
const code=stripTypeScriptTypes(between('function button(label:','function quantity(')
 +between('function requirementLink(', 'const islandNames =')+between('function deliveryItems(', 'function harborCard(')
 +between('function villageProjectCard()', 'function finishSharedSupper(')
 +"\nfunction choose(action:string,value?:string){switch(action){"+between("    case 'build-village':","    case 'village-slot':")+"}}")
const ledger=(f:Farm.FarmState)=>structuredClone(f.village.supplies)
const fishKey='fish:seaBass'
function player(successfulCasts=2){
 const p=commissionPlayer(milestones.slice(0,58))
 if(successfulCasts){
  p.visit('grove')
  for(let i=0;i<successfulCasts;i++){
   const cast=p.act('beginFishingTrip')
   p.act('finishFishingTrip',cast.token,1)
  }
  p.visit('home')
 }
 const f=p.state
 assert.deepEqual([p.actions,f.day,f.island,f.coins,f.honey,f.fish.seaBass,
  f.freight.warehouses.grove.seaBass??0,f.handmade.round,f.capeLevel],
  [successfulCasts?60+2*successfulCasts:58,6,'home',120,3,successfulCasts,0,0,1])
 return p
}
function panel(farm:Farm.FarmState,opts:{open?:boolean;panel?:string;attached?:boolean}={}){
 const ctrl={}, writes:Farm.FarmState[]=[]
 const noIcon=()=>'', ctx={...Farm,...Routes,farm,panel:opts.panel??'village-project',dialog:{open:opts.open??true},
  control:ctrl, dialogContent:{contains:()=>opts.attached!==false},
  icon:noIcon,iconUrl:noIcon,bayProductId:noIcon,getBerryNurserySource:()=>undefined,
  stockLabel:(item:Farm.StockItem)=>({name:({fish:'Морской окунь',honey:'Цветочный мёд',handmade:'Круглая булочка'} as Record<string,string>)[item.kind],image:item.kind}),
  numberFormat:new Intl.NumberFormat('ru'),nav:(...html:string[])=>html.join(''),requirementLinks:new Map(),renderVillageBudget,
  playBaySound:noIcon,
  perform(fn:()=>Farm.ActionResult){const result=fn();if(result.ok)writes.push(structuredClone(farm));return result.ok}
 }
 const menu=runInNewContext(code+';({villageProjectCard,choose})',ctx)
 return {draw:():string=>menu.villageProjectCard(),click:(action:string,value?:string)=>menu.choose(action,value),writes}
}
function fishControl(html:string,amount:number) {
 const m=/<button[^>]*data-action="village-supply-pledge"[^>]*data-value="([^"]+)"[^>]*aria-label="Внести: Морской окунь ×(\d+)"/.exec(html)
 assert.ok(m,'the exact fish row, not the bulk button, must offer the ordinary fish pledge')
 assert.equal(Number(m[2]),amount)
 return m[1]
}

test('a genuinely earned exact fish pledge can reserve honey for an Apiary upgrade before its same-day harvest',()=>{
 const p=player(),f=p.state,before=structuredClone(f),ui=panel(f)
 const html=ui.draw(), fish=fishControl(html,2)
 assert.match(html,/aria-label="Внести: Цветочный мёд ×2"/)
 assert.match(html,/data-action="build-village"[^>]*>Внести всё/)
 assert.deepEqual(f,before);assert.equal(ui.writes.length,0)
 ui.click('village-supply-pledge',fish)
 assert.deepEqual([f.fish.seaBass,f.honey,f.coins,ledger(f),f.village.built,f.workToday],[0,3,120,{[fishKey]:2},false,before.workToday+1])
 assert.equal(ui.writes.length,1)
 ui.click('village-supply-pledge',fish)
 assert.equal(ui.writes.length,1)
 assert.doesNotMatch(ui.draw(),/data-action="village-supply-pledge"/)
 p.reload();p.visit('cape')
 assert.equal(Farm.getCapeUpgrade(p.state)?.available,true)
 p.act('upgradeCape');p.act('collectCapeHoney')
 assert.deepEqual([p.state.day,p.state.coins,p.state.beeswax,p.state.honey,p.state.village.built,ledger(p.state)],
  [6,72,1,4,false,{[fishKey]:2}])
 p.visit('home');p.act('contributeVillage')
 assert.deepEqual([p.state.beeswax,p.state.honey,ledger(p.state)],[1,2,{[fishKey]:2,honey:2}])
})

test('the old deliberate bulk and cheapest ordinary sequence remain separate and economically real',()=>{
 const p=player(),f=p.state,menu=panel(f)
 menu.click('build-village')
 assert.deepEqual([f.coins,f.honey,f.fish.seaBass,f.village.built,ledger(f),menu.writes.length],[120,1,0,false,{[fishKey]:2,honey:2},1])
 p.visit('cape');assert.equal(Farm.getCapeUpgrade(p.state)?.available,false)
 p.act('collectCapeHoney');p.act('upgradeCape')
 assert.deepEqual([p.state.day,p.state.coins,p.state.beeswax,p.state.honey],[6,72,0,1])
 assert.equal(Farm.getCapeHoney(p.state).available,false)
 const q=player();q.visit('cape')
 q.act('upgradeCape');q.act('collectCapeHoney');q.visit('home');q.act('contributeVillage')
 assert.deepEqual([q.state.day,q.state.coins,q.state.beeswax,q.state.honey,ledger(q.state)],[6,72,1,2,{[fishKey]:2,honey:2}])
})

test('wrong owner, stale amount or day and rapid/held reactivation do not pledge an extra item',()=>{
 const p=player(),home=p.state,token=fishControl(panel(home).draw(),2), before=structuredClone(home)
 for(const opts of [{open:false},{panel:'market'},{attached:false}]){
  const view=panel(home,opts);view.click('village-supply-pledge',token);assert.deepEqual(view.writes,[]);assert.deepEqual(home,before)
 }
 p.visit('grove');const remote=p.state, moved=structuredClone(remote)
 panel(remote).click('village-supply-pledge',token);assert.deepEqual(remote,moved)
 p.visit('home');p.act('sellMarketItem',fishKey,1)
 const changed=p.state,afterSale=structuredClone(changed), ui=panel(changed)
 ui.click('village-supply-pledge',token);assert.deepEqual(ui.writes,[]);assert.deepEqual(changed,afterSale)
 const left=fishControl(ui.draw(),1)
 p.night();const later=p.state,afterNight=structuredClone(later)
 const late=panel(later);late.click('village-supply-pledge',left);assert.deepEqual(late.writes,[]);assert.deepEqual(later,afterNight)
 assert.equal(isGuardedAction('village-supply-pledge'),true)
 const c=new ActionClickGuard(), k=new ActivationKeyGuard()
 c.remember({detail:1,timeStamp:100,clientX:200,clientY:210})
 assert.equal(c.blocks({detail:1,timeStamp:190,clientX:200,clientY:210}),true)
 assert.equal(k.blocks({key:'Enter',repeat:false},true),false)
 assert.equal(k.blocks({key:'Enter',repeat:true},false),true)
})

test('single available ingredient and genuinely finishable construction keep original actions',()=>{
 const p=player(0),f=p.state,ui=panel(f)
 assert.match(ui.draw(),/data-action="build-village"[^>]*>Внести припасы/)
 assert.doesNotMatch(ui.draw(),/data-action="village-supply-pledge"/)
 ui.click('build-village')
 assert.deepEqual([f.honey,ledger(f),f.coins,f.village.built],[1,{honey:2},120,false])
 // The existing independently tested earned complete route still charges through the one original action.
 const completed=commissionPlayer(milestones.slice(0,77)), state=completed.state, oldCoins=state.coins, ready=panel(state)
 assert.match(ready.draw(),/data-action="build-village"[^>]*>Построить/)
 assert.doesNotMatch(ready.draw(),/data-action="village-supply-pledge"/)
 ready.click('build-village')
 assert.equal(state.village.built,true);assert.equal(state.coins,oldCoins-48);assert.equal(ready.writes.length,1)
 ready.click('build-village')
 assert.equal(state.coins,oldCoins-48);assert.equal(ready.writes.length,1)
})
