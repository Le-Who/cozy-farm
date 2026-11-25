import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {stripTypeScriptTypes} from 'node:module'
import * as F from '../src/farm.ts'
import {renderCoopPanel} from '../src/coop-panel.ts'
import {groupCoopServices} from '../src/coop-services.ts'
import {renderHenFriendship} from '../src/hen-friendship.ts'
import {chickenCarePlayer} from './fixtures/chicken-care-player.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
function part(a:string,b:string){const i=main.indexOf(a),j=main.indexOf(b,i+1);assert.ok(i>=0&&j>i,[a,b]);return main.slice(i,j)}
const helpers=stripTypeScriptTypes(part('function button(','function panelTabs(')+part('function flockFeedRow()','function seedCards()'))
const segments=['primary','forecast','care','packing','hens'] as const
type Name=typeof segments[number]

/** Real emitted buttons and resize owner; no browser pixel or global tab-order assertions. */
function mount(farm:F.FarmState,desktop=false) {
  const scope:any={...F,farm,icon:(id:string)=>`<i data-img="${id}"></i>`,itemIcon:(id:string)=>`<i data-img="${id}"></i>`,numberFormat:new Intl.NumberFormat('ru-RU'),
    panel:'coop',canMixBedtimeFeed:()=>false}
  runInNewContext(helpers,scope)
  const raw=renderCoopPanel(farm,{icon:scope.icon,row:scope.row,button:scope.button,feedRow:scope.flockFeedRow})
  const listeners=new Set<()=>void>()
  const media={matches:desktop,addEventListener(type:string,fn:()=>void){assert.equal(type,'change');listeners.add(fn)},removeEventListener(type:string,fn:()=>void){assert.equal(type,'change');listeners.delete(fn)}}
  const document={activeElement:null as any,defaultView:{matchMedia(query:string){assert.equal(query,'(min-width: 900px) and (min-height: 600px)');return media}}}
  const buttons=(html:string)=>[...html.matchAll(/<button\b[^>]*data-action="([^"]+)"[^>]*>/g)]
    .map(([tag,action])=>({action,disabled:/\sdisabled(?:[\s>]|=)/.test(tag),value:tag.match(/data-value="([^"]+)"/)?.[1]??'',
      focusCalls:[] as unknown[],focus(options?:unknown){this.focusCalls.push(options);document.activeElement=this}}))
  const starts=['<ul class="dialog-list coop-primary"','<details class="coop-forecast"','<section class="coop-care"','<section class="coop-packing"','<div class="hen-grid"']
  const groups=segments.flatMap((name,i)=>{
    const at=raw.indexOf(starts[i]);if(at<0)return []
    const end=starts.slice(i+1).map(x=>raw.indexOf(x,at)).find(x=>x>at)
    const controls=buttons(raw.slice(at,end))
    const find=(selector:string)=>selector.split(/,\s*/).flatMap(term=>{
      const m=/^\[data-action="([^"]+)"\](?:(:disabled|:not\(:disabled\)))?$/.exec(term)
      assert.ok(m,term)
      return controls.filter(control=>control.action===m[1]&&(!m[2]||control.disabled===(m[2]===':disabled')))
    })[0]??null
    return [{name,controls,contains(item:unknown){return controls.includes(item as typeof controls[number])},querySelector:find}]
  })
  const lookup=(name:Name)=>groups.find(row=>row.name===name)!
  const care=lookup('care'),forecast=lookup('forecast')
  const moves:string[]=[]
  const panel={dataset:{},
    querySelector(selector:string){const group=/^:scope > \.coop-(primary|forecast|care)$/.exec(selector);assert.ok(group);return lookup(group[1] as Name)},
    get firstElementChild(){return groups[0]},
    insertBefore(node:typeof groups[number],before:typeof groups[number] | null){
      assert.equal(node,care,'only move existing care node')
      if(node===before)return
      const pos=groups.indexOf(node);assert.ok(pos>=0);groups.splice(pos,1)
      const target=before===null?groups.length:groups.indexOf(before);assert.ok(target>=0)
      groups.splice(target,0,node);moves.push(node.name)
      if(care.contains(document.activeElement))document.activeElement=null
      root.scrollTop=0
    }}
  for(const x of [care,forecast])Object.defineProperty(x,'nextElementSibling',{get:()=>groups[groups.indexOf(x)+1]??null})
  const root={ownerDocument:document,contains:(node:unknown)=>node===panel,querySelector:()=>panel,scrollTop:0}
  const dispose=groupCoopServices(root as unknown as HTMLElement)
  const groupOrder=()=>groups.map(g=>g.name)
  const enabled=()=>groups.flatMap(g=>g.controls.filter(control=>!control.disabled).map(control=>control.action))
  const all=()=>groups.flatMap(g=>g.controls)
  const resize=(wide:boolean)=>{media.matches=wide;for(const listener of listeners)listener()}
  return {groupOrder,enabled,all,lookup,document,moves,root,dispose,resize}
}

const compact=['primary','care','forecast','packing','hens'],normal=['care','primary','forecast','packing','hens'],desktop=['primary','forecast','care','packing','hens']
const days=(branch:'hatchery'|'packing'|'basic'='hatchery')=>chickenCarePlayer('orchard',branch)
const hatchDayTwo=()=>{const p=days();p.act('feedChickens');p.act('endDay');return p}
const prefix=(m:ReturnType<typeof mount>,act:string)=>m.enabled().slice(0,m.enabled().indexOf(act)+1)
const restored=(f:F.FarmState)=>F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))

test('ordinary first eggs are reachable before care in the real compact mount, with the original same-day and wide actions',()=>{
 const p=hatchDayTwo(),nest=structuredClone(p.state),atNest=mount(p.state)
 assert.deepEqual([p.state.day,p.state.eggs,p.state.eggsReady],[2,0,4])
 assert.deepEqual(atNest.groupOrder(),compact)
 assert.deepEqual(prefix(atNest,'collect'),['feed','collect'])
 assert.equal(atNest.enabled().includes('incubate-egg'),false)
 assert.deepEqual(p.state,nest)
 p.act('collectEggs');const f=p.state,before=structuredClone(f),atEgg=mount(f),wide=mount(f,true)
 assert.deepEqual([f.eggs,f.eggsReady],[4,0])
 assert.deepEqual(atEgg.groupOrder(),compact);assert.deepEqual(prefix(atEgg,'incubate-egg'),['feed','incubate-egg'])
 assert.deepEqual(wide.groupOrder(),desktop)
 assert.deepEqual(atEgg.all().map(x=>[x.action,x.value,x.disabled]).sort(),wide.all().map(x=>[x.action,x.value,x.disabled]).sort())
 assert.deepEqual(f,before)
 p.act('incubateEgg');assert.deepEqual([p.state.eggs,p.state.hatchDay,p.state.flockSize],[before.eggs-1,4,4])
 console.log(JSON.stringify({day:before.day,contentButtonsBeforeInsert:atEgg.enabled().indexOf('incubate-egg'),visibleGroups:atEgg.groupOrder()}))
})

test('same true rest action is earlier when incubation is pending, with zero change to finished or other Coop modes',()=>{
 const p=hatchDayTwo()
 p.act('collectEggs');p.act('incubateEgg');p.act('endDay')
 const f=p.state,saved=structuredClone(f),atRest=mount(f)
 assert.equal(f.hatchDay,f.day+1)
 assert.deepEqual(atRest.groupOrder(),compact);assert.deepEqual(prefix(atRest,'visit-rest'),['feed','visit-rest'])
 assert.equal(atRest.enabled().includes('incubate-egg'),false);assert.deepEqual(f,saved)
 p.act('endDay');assert.equal(p.state.flockSize,5);assert.equal(p.state.hatchDay,null)
 const intro=renderHenFriendship(p.state,null,true,4)
 assert.equal((intro.match(/data-action="hen-friend-select"/g)??[]).length,5)
 assert.equal((intro.match(/class="hen-friend-card"/g)??[]).length,1)
 assert.match(intro,/<h2>Пуговка<\/h2>/);assert.match(intro,/<details class="hen-friend-notes">/)
 for(const state of [p.state,F.createFarm(),days('hatchery').state,days('packing').state]){
  const snapshot=structuredClone(state),adult=mount(state)
  assert.deepEqual(adult.groupOrder().slice(0,3),normal.slice(0,3))
  assert.equal(adult.enabled().some(act=>['incubate-egg','incubate-rare-egg','incubator-basket','visit-rest'].includes(act)),false)
  assert.deepEqual(state,snapshot);assert.deepEqual(state,restored(state))
 }
})

test('stock is not taken and no hatch is started by moving a real basket or rare-egg action earlier',()=>{
 const p=days('basic')
 p.act('feedChickens');p.act('endDay');p.act('collectEggs');p.act('packEggBasket');p.act('sellMarketItem','eggs',p.state.eggs);p.act('specializeFacility','hatchery')
 const saved=structuredClone(p.state),basket=mount(p.state)
 assert.deepEqual([p.state.eggs,p.state.eggBaskets],[0,1])
 assert.deepEqual(basket.groupOrder(),compact);assert.deepEqual(prefix(basket,'incubator-basket'),['feed','incubator-basket']);assert.ok(basket.enabled().includes('unpack-egg-basket'))
 assert.deepEqual(p.state,saved)
 p.act('unpackEggBasket');assert.equal(p.state.hatchDay,null);assert.equal(p.state.eggs,F.eggsPerBasket)
 const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
 const route=commissionPlayer(opening);route.visit('home');route.act('specializeFacility','hatchery')
 const bed=route.state.beds.findIndex(x=>x.kind==='tilled');assert.ok(bed>=0)
 route.act('selectSeed','wheat');route.act('workBed',bed,0)
 const water=()=>{if(F.getBedAction(route.state,bed).kind==='water'){if(!route.state.water)route.act('refillWater');route.act('workBed',bed,0)}}
 water();route.act('feedChickens');route.night();route.act('collectEggs');water();route.night();route.act('workBed',bed,0)
 route.act('deliverMarketOrder','flock');route.act('deliverMarketOrder','pantry')
 assert.deepEqual([route.state.day,route.state.eggs,route.state.variants.egg?.rainbow],[16,0,1])
 const rareSnapshot=structuredClone(route.state),rare=mount(route.state),choice=F.getRareIncubatorEgg(route.state)!
 assert.ok(rare.enabled().includes('incubate-rare-egg'));assert.deepEqual(rare.groupOrder(),compact)
 assert.equal(rare.all().find(btn=>btn.action==='incubate-rare-egg')?.value,choice.token)
 assert.deepEqual(route.state,rareSnapshot)
})

test('real compact-active resize preserves original keyboard focus and scroll, never activates a rest or spend',()=>{
 const p=hatchDayTwo();p.act('collectEggs')
 const f=p.state,before=structuredClone(f),m=mount(f)
 assert.deepEqual(m.groupOrder(),compact)
 const [care,insert]=['hen-friendship-open','incubate-egg'].map(action=>m.all().find(control=>control.action===action)!)
 assert.ok(care&&insert)
 const initialMoves=m.moves.length;m.root.scrollTop=53;care.focus();care.focusCalls.length=0
 m.resize(false);assert.equal(m.moves.length,initialMoves)
 m.resize(true);assert.deepEqual(m.groupOrder(),desktop);assert.equal(m.document.activeElement,care);assert.equal(m.root.scrollTop,53)
 m.resize(false);assert.deepEqual(m.groupOrder(),compact);assert.equal(m.document.activeElement,care);assert.equal(m.root.scrollTop,53)
 assert.deepEqual(care.focusCalls,[{preventScroll:true},{preventScroll:true}])
 insert.focus();insert.focusCalls.length=0;care.focusCalls.length=0
 m.resize(true);m.resize(false)
 assert.equal(m.document.activeElement,insert);assert.deepEqual(insert.focusCalls,[]);assert.deepEqual(care.focusCalls,[])
 assert.equal(m.root.scrollTop,53);assert.ok(m.all().includes(care)&&m.all().includes(insert))
 assert.deepEqual(f,before)
 m.dispose();const count=m.moves.length;m.resize(true);assert.equal(m.moves.length,count)
})
