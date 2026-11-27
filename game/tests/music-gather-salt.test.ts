import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { harbourTradePlayer } from './fixtures/harbour-trade-player.ts'
import { getBerryNurserySource } from '../src/berry-nursery.ts'
import { getLocalWarehouseSupply, withdrawWarehouseSupply } from '../src/warehouse-guidance.ts'
import { bayProductId, openedFreightPorts } from '../src/harbour-economy.ts'
import * as Freight from '../src/bay-freight-model.ts'
import * as F from '../src/farm.ts'
import * as G from '../src/music-material-guidance.ts'
import { getRequirementHint, type Requirement } from '../src/requirement-guidance.ts'
import { gardenMaterialStock, installGardenInstrument, transferBayGoods } from '../src/harbour-economy.ts'

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8')
const main=read('../src/main.ts'), opening=JSON.parse(read('./fixtures/home-progress-actions.json'))
const plain=<T,>(x:T):T=>JSON.parse(JSON.stringify(x))
const between=(a:string,b:string)=>main.slice(main.indexOf(a),main.indexOf(b,main.indexOf(a)+a.length))
function earned(collectSaltToday=false) {
  const p=commissionPlayer(opening)
  assert.deepEqual([p.state.day,p.actions,p.state.coins,p.state.seaSalt],[14,107,68,0])
  for(let day=14;day<=15;day++) {
    p.visit('grove')
    if(day===14||collectSaltToday)p.act('gatherSeaSalt')
    for(let i=0;i<3;i++){assert.equal(F.getShellAt(p.state,i),'regular');p.act('collectShell',i)}
    if(day===14)p.night()
  }
  p.visit('village')
  return p.state
}

const renderSupplies=stripTypeScriptTypes(between('function requirementLink(', '\nfunction statusItem(')
  +between('function button(', '\nfunction quantity(')+between('function nav(', '\nfunction panelTabs(')
  +"switch('music-supplies'){"+between("    case 'music-supplies': {","    case 'bay-freight':")+'}')

function supplies(farm:F.FarmState) {
  const before=structuredClone(farm)
  const content={innerHTML:''}, requirementLinks=new Map<string,Requirement>()
  runInNewContext(renderSupplies,{
    farm,...G,gardenMaterialStock,dialogContent:content,requirementLinks,panel:'music-supplies',
    islandIds:F.islandIds,canSailTo:F.canSailTo,getBerryNurserySource,bayProductId,
  })
  assert.deepEqual(farm,before,'viewing supplies never pays, harvests, withdraws or travels')
  const controls=[...content.innerHTML.matchAll(/<button([^>]+)>([\s\S]*?)<\/button>/g)].map(([,attrs,html])=>({
    action:attrs.match(/data-action="([^"]+)"/)?.[1],value:attrs.match(/data-value="([^"]+)"/)?.[1],
    enabled:!/\bdisabled\b/.test(attrs),content:html.replace(/<[^>]*>/g,'').trim(),
  }))
  const buttons=controls.map(({action,value,enabled})=>({action,value,enabled}))
  const links=controls.filter(x=>x.action==='show-requirement').map(x=>{
    const requirement=x.value===undefined?undefined:requirementLinks.get(x.value)
    assert.ok(requirement,'rendered action id must resolve to a live requirement')
    return {content:x.content,requirement:plain(requirement)}
  })
  return {html:content.innerHTML,buttons,links,salt:links.find(l=>l.content.includes('Морская соль'))?.requirement}
}

async function actuallyFollow(farm:F.FarmState, requirement:Requirement, duringCrossing?:()=>void, notices:string[] = []) {
  const source=between('async function showRequirement(', '// Scene handlers own material sounds.')
  const moves:unknown[][]=[], saves:F.FarmState[]=[]
  const context=runInNewContext(stripTypeScriptTypes(source+';({showRequirement})'),{
    farm,getRequirementHint,islandIds:F.islandIds,canSailTo:F.canSailTo, sail:F.sail,panel:'music-supplies',dialog:{open:true},
    fieldViewButton:{getAttribute:()=> 'false'},closeDialog:()=>moves.push(['close']),
    perform:(work:()=>F.ActionResult)=>{assert.ok(work().ok);saves.push(plain(farm));return true},
    island:{crossIsland:async(commit:()=>boolean)=>{assert.ok(commit());moves.push(['sail',farm.island]);duringCrossing?.()},
      focusTarget:(place:unknown)=>moves.push(['focus',plain(place)])},
    panelTitles:{inventory:'Припасы',rest:'Отдых'}, dialogContent:{querySelector:()=>null},highlightControl:()=>{},
    openPanel:(panel:string)=>moves.push(['panel',panel]),notify:(notice:string)=>notices.push(notice),
  })
  await context.showRequirement(requirement)
  return {moves,saves}
}

test('Day15 existing music salt source leads to the live bed; separate warehouse and install stay deliberate',async()=>{
  const farm=earned(), fromWarehouse=structuredClone(farm), before=structuredClone(farm)
  assert.deepEqual(gardenMaterialStock(farm),{shells:6,seaSalt:2,beeswax:0})
  assert.deepEqual([farm.day,farm.coins,farm.island,farm.saltGatheredToday,farm.freight.warehouses.grove.seaSalt],[15,68,'village',false,8])
  const view=supplies(farm)
  assert.match(view.html,/Морская соль · 2\/3/)
  assert.equal(view.links.length,1)
  assert.ok(view.buttons.some(b=>b.action==='music-warehouse-visit'&&b.value==='grove'&&b.enabled))
  const link=view.salt!
  assert.deepEqual(getRequirementHint(farm,link).action,{label:'',target:'sail',value:'grove'},'the exact 2/3 music row must not open the already-carried 2')
  assert.equal(installGardenInstrument(farm),undefined);assert.deepEqual(farm,before)
  const actual=await actuallyFollow(farm,link)
  assert.deepEqual(actual.moves,[['close'],['sail','grove'],['close'],['focus',{kind:'salt'}]])
  assert.equal(actual.saves.length,1,'the existing explicit crossing is the only save')
  assert.deepEqual([farm.coins,farm.seaSalt,farm.saltGatheredToday,farm.musicGarden.level,farm.freight.warehouses.grove.seaSalt],[68,2,false,0,8])
  // An unrelated salt requirement on Grove still chooses the existing reachable warehouse.
  assert.equal(getRequirementHint(farm,{kind:'stock',item:{kind:'seaSalt',quantity:3}}).action.target,'warehouse-supply')
  assert.ok(F.gatherSeaSalt(farm).ok);assert.equal(farm.seaSalt,4)
  assert.ok(F.sail(farm,'village').ok)
  assert.equal(farm.musicGarden.level,0);assert.equal(supplies(farm).salt,undefined)
  assert.equal(installGardenInstrument(farm),1)
  assert.deepEqual([farm.coins,farm.seaSalt,farm.shells.regular,farm.freight.warehouses.grove.seaSalt],[68,1,0,8])
  assert.deepEqual(F.restoreCurrentFarm(plain(farm)),farm)

  assert.ok(F.sail(fromWarehouse,'grove').ok)
  const withdraw=supplies(fromWarehouse).buttons.find(b=>b.action==='freight-withdraw'&&b.value?.startsWith('grove|seaSalt|'))
  assert.deepEqual(withdraw,{action:'freight-withdraw',value:'grove|seaSalt|1',enabled:true})
  assert.equal(fromWarehouse.seaSalt,2)
  assert.ok(transferBayGoods(fromWarehouse,'withdraw','grove','seaSalt',1).ok)
  assert.equal(fromWarehouse.saltGatheredToday,false)
  assert.ok(F.sail(fromWarehouse,'village').ok)
  assert.equal(installGardenInstrument(fromWarehouse),1)
  assert.deepEqual([fromWarehouse.coins,fromWarehouse.seaSalt,fromWarehouse.shells.regular,fromWarehouse.freight.warehouses.grove.seaSalt],[68,0,0,7])
  assert.deepEqual(F.restoreCurrentFarm(plain(fromWarehouse)),fromWarehouse)
})

test('stale or exhausted wild salt is not offered again; old warehouse and other material paths stay intact',async()=>{
  const original=earned(), stale=supplies(original).salt!
  const afterSale=earned(true)
  assert.ok(F.sail(afterSale,'home').ok)
  const sale=[{key:'seaSalt',quantity:2}],q=F.getMarketBasket(afterSale,sale)!
  assert.equal(q.total,8);assert.ok(F.sellMarketBasket(afterSale,sale,q.token).ok)
  assert.ok(F.sail(afterSale,'village').ok)
  const untouched=structuredClone(afterSale)
  assert.deepEqual([afterSale.seaSalt,afterSale.saltGatheredToday,afterSale.coins],[2,true,76])
  assert.deepEqual(await actuallyFollow(afterSale,stale),{moves:[],saves:[]})
  assert.deepEqual(afterSale,untouched)
  const fresh=supplies(afterSale)
  assert.ok(fresh.buttons.some(b=>b.action==='music-warehouse-visit'&&b.value==='grove'&&b.enabled))
  const freshHint=getRequirementHint(afterSale,fresh.salt!)
  assert.deepEqual([freshHint.action.target,freshHint.action.value],['sail','grove'])
  assert.ok(F.sail(afterSale,'grove').ok)
  assert.deepEqual(getRequirementHint(afterSale,fresh.salt!).action,{label:'Посмотреть запас',target:'warehouse-supply',value:'seaSalt|3'})
  assert.equal(F.gatherSeaSalt(afterSale).ok,false)

  // Explicit above-ground sales and the existing correctly sized warehouse transfers
  // remove the finite reserve without faking scarcity or ticking to a new day.
  for(let visit=0;visit<4;visit++) {
    if(afterSale.island!=='grove')assert.ok(F.sail(afterSale,'grove').ok)
    const next=supplies(afterSale).buttons.find(b=>b.action==='freight-withdraw'&&b.value?.startsWith('grove|seaSalt|'))?.value
    const n=Number(next?.split('|').at(-1));assert.ok(n>=1&&n<=3)
    assert.ok(transferBayGoods(afterSale,'withdraw','grove','seaSalt',n).ok)
    assert.ok(F.sail(afterSale,'home').ok)
    const items=[{key:'seaSalt',quantity:afterSale.seaSalt}],price=F.getMarketBasket(afterSale,items)!
    assert.ok(F.sellMarketBasket(afterSale,items,price.token).ok)
  }
  assert.deepEqual([afterSale.day,afterSale.seaSalt,afterSale.freight.warehouses.grove.seaSalt??0,afterSale.saltGatheredToday],[15,0,0,true])
  const actualWait=supplies(afterSale).salt!
  assert.equal(getRequirementHint(afterSale,actualWait).action.value,'rest')
  const beforeRest=structuredClone(afterSale)
  assert.deepEqual(await actuallyFollow(afterSale,stale),{moves:[],saves:[]})
  assert.deepEqual(afterSale,beforeRest)

  const newDay=earned();assert.ok(F.sail(newDay,'home').ok);assert.ok(F.endDay(newDay).ok)
  assert.ok(F.sail(newDay,'village').ok)
  assert.equal(newDay.day,16);assert.deepEqual(await actuallyFollow(newDay,stale),{moves:[],saves:[]})
  assert.equal(getRequirementHint(newDay,supplies(newDay).salt!).action.value,'grove')

  // Legitimate expenditure of one already earned shell leaves two unchanged existing sources.
  const freshShell=earned()
  assert.ok(F.sail(freshShell,'home').ok)
  const shellSale=[{key:'shells:regular',quantity:1}],quote=F.getMarketBasket(freshShell,shellSale)!
  assert.ok(quote.total>0);assert.ok(F.sellMarketBasket(freshShell,shellSale,quote.token).ok)
  assert.ok(F.sail(freshShell,'village').ok)
  const view=supplies(freshShell)
  assert.deepEqual(view.links.find(x=>x.content.includes('Ракушки'))?.requirement,{kind:'stock',item:{kind:'shells',item:'regular',quantity:6}})

  const enRoute=earned(), wanted=supplies(enRoute).salt!
  const crossed=await actuallyFollow(enRoute,wanted,()=>{assert.ok(F.gatherSeaSalt(enRoute).ok)})
  assert.deepEqual(crossed.moves,[['close'],['sail','grove']],'validation repeats at landing; never focuses an exhausted source')
  assert.equal(crossed.saves.length,1)
})

function earnedBeforeL3() {
  const grower = harbourTradePlayer(opening)
  grower.build(); grower.wheat(2); grower.voyage('explore-orchard')
  const tail: [string, ...unknown[]][] = [
    ["sendFerryExpedition", "mill-buy"], ["endDay"], ["receiveFerryExpedition"],
    ["sendFerryExpedition", "orchard-buns"], ["endDay"], ["receiveFerryExpedition"],
    ["plantFruitTreeSeed", 1, "fruit-tree:20:home:1:peach"], ["sendFerryExpedition", "mill-buy"], ["endDay"],
    ["receiveFerryExpedition"], ["sendFerryExpedition", "orchard-buns"], ["endDay"],
    ["receiveFerryExpedition"], ["pickFruit", 0], ["endDay"],
    ["pickFruit", 0], ["sendFerryExpedition", "orchard-apples"], ["endDay"],
    ["receiveFerryExpedition"], ["pickFruit", 0], ["endDay"],
    ["pickFruit", 0], ["sendFerryExpedition", "orchard-apples"], ["endDay"],
    ["receiveFerryExpedition"], ["pickFruit", 0], ["sail", "grove"],
    ["pickFruit", 0], ["sail", "home"], ["sellMarketItem", "fruit:peach", 2],
    ["specializeFarmhouse", "preserves"], ["cookDish", "orchardPreserves"], ["sail", "grove"],
    ["catchFish", true], ["deliverHarborOrder"], ["sail", "home"],
    ["sellMarketItem", "dishes:appleJam", 1], ["sail", "cape"], ["collectCapeHoney"],
    ["sail", "home"], ["endDay"], ["sail", "cape"],
    ["upgradeCape"], ["collectCapeHoney"], ["sail", "home"],
    ["endDay"], ["sail", "cape"], ["collectCapeHoney"],
    ["sail", "home"], ["endDay"], ["sail", "cape"],
    ["collectCapeHoney"], ["sail", "home"], ["sellMarketItem", "dishes:orchardTart", 1],
    ["sellMarketItem", "honey", 5], ["sail", "grove"], ["gatherSeaSalt"],
    ["sail", "cape"],
  ]
  return commissionPlayer([...grower.log, ...tail.map(([name,...args])=>({name,args}))])
}

const ok=(r:{ok:boolean,message:string})=>assert.ok(r.ok,r.message)
function at(farm:F.FarmState, port:F.IslandId) { if(farm.island!==port)ok(F.sail(farm,port)) }
function cold(farm:F.FarmState) { const result=F.restoreCurrentFarm(plain(farm));assert.ok(result);return result }
const take=(farm:F.FarmState,id:string,n:number)=>ok(transferBayGoods(farm,'withdraw',farm.island,id,n))
const wax=(farm:F.FarmState)=>supplies(farm).links.find(l=>l.content.includes('Пчелиный воск'))?.requirement

// Replay the real pre-upgrade Cape route; build the first instrument, make the
// ordinary Apiary sale, then buy the kitchen. This leaves three actual wax at Cape.
function earnedWaxReserve() {
  const farm=earnedBeforeL3().state
  assert.deepEqual([farm.day,farm.coins,farm.beeswax,farm.seaSalt,farm.capeLevel,farm.freight.warehouses.cape.beeswax],[29,70,3,2,2,4])
  at(farm,'home');take(farm,'shells',6)
  at(farm,'grove');take(farm,'seaSalt',1)
  at(farm,'village');assert.equal(installGardenInstrument(farm),1)
  at(farm,'home');take(farm,'shells',2)
  for(let i=0;farm.shells.regular<8||farm.seaSalt<2;i++){
    assert.ok(i<2);at(farm,'grove')
    for(let n=0;n<3&&farm.shells.regular<8;n++)if(F.getShellAt(farm,n)==='regular')ok(F.collectShell(farm,n))
    if(!farm.saltGatheredToday&&farm.seaSalt<2)ok(F.gatherSeaSalt(farm))
    if(farm.shells.regular<8||farm.seaSalt<2){at(farm,'home');ok(F.endDay(farm))}
  }
  at(farm,'home')
  const order=F.getMarketOrders(farm).find(o=>o.lane==='apiary')
  assert.deepEqual([order?.reward,order?.status],[42,'ready']);ok(F.deliverMarketOrder(farm,'apiary'))
  at(farm,'cape')
  const request={kind:'beeswax' as const,quantity:3}, quote=getLocalWarehouseSupply(farm,request)
  assert.equal(quote?.quantity,3);ok(withdrawWarehouseSupply(farm,request,quote))
  ok(F.upgradeCape(farm))
  assert.deepEqual([farm.day,farm.coins,farm.beeswax,farm.freight.warehouses.cape.beeswax,farm.shells.regular,farm.musicGarden.level],[30,44,0,3,8,1])
  assert.ok(F.getCapeHoney(farm).available)
  at(farm,'village')
  return cold(farm)
}

async function useWarehouseButton(farm:F.FarmState, action:'music-warehouse-visit'|'freight-withdraw', value:string) {
  const source=between('async function visitPanelAt(', 'function openGuidedMarket(')
    + "async function click(action,value){switch(action){"
    + between("    case 'music-warehouse-visit': {","    case 'freight-unlock':")
    + between("    case 'freight-deposit':","    case 'freight-start':")+'}};click'
  const saves:F.FarmState[]=[], moves:unknown[][]=[]
  await runInNewContext(stripTypeScriptTypes(source), {
    farm,panel:'music-supplies',dialog:{open:true},panelHistory:[],rememberPanel:()=>({panel:'music-supplies'}),
    islandIds:F.islandIds,canSailTo:F.canSailTo,sail:F.sail,transferBayGoods,
    island:{isCrossing:()=>false,crossIsland:async(commit:()=>boolean)=>{assert.ok(commit());moves.push(['sail',farm.island])}},
    fieldViewButton:{getAttribute:()=>'false'},closeDialog:()=>moves.push(['close']),
    openPanel:(panel:string)=>moves.push(['panel',panel]),bayAudio:{playEvent:()=>{}},
    perform:(work:()=>F.ActionResult)=>{ok(work());saves.push(plain(farm));return true},
  })(action,value)
  return {saves,moves}
}

test('Day30 bass source at 3/4 focuses the live hive, not inventory; warehouse and assembly remain separate',async()=>{
  const farm=earnedWaxReserve(), beforeVisit=plain(farm)
  const remote=supplies(farm)
  assert.deepEqual(remote.buttons.filter(b=>b.action==='music-warehouse-visit'),[{action:'music-warehouse-visit',value:'cape',enabled:true}])
  assert.match(remote.html,/Где собрать: Пчелиный воск/)
  const visit=await useWarehouseButton(farm,'music-warehouse-visit','cape')
  assert.deepEqual(visit.moves,[['close'],['sail','cape'],['panel','music-supplies']])
  assert.deepEqual(visit.saves,[{...beforeVisit,island:'cape'}])
  const stored=supplies(farm).buttons.find(b=>b.action==='freight-withdraw')
  assert.deepEqual(stored,{action:'freight-withdraw',value:'cape|beeswax|3',enabled:true})
  assert.equal(farm.beeswax,0)
  assert.equal((await useWarehouseButton(farm,'freight-withdraw',stored!.value!)).saves.length,1)
  assert.deepEqual([farm.beeswax,farm.freight.warehouses.cape.beeswax??0,F.getCapeHoney(farm).available],[3,0,true])

  const local=supplies(farm), link=wax(farm), before=plain(farm), notices:string[]=[]
  assert.match(local.html,/Пчелиный воск · 3\/4/)
  assert.match(local.html,/aria-label="Где найти: Пчелиный воск"/)
  assert.deepEqual(local.buttons.filter(b=>b.action==='freight-withdraw'||b.action==='music-warehouse-visit'),[])
  assert.ok(link)
  assert.deepEqual(await actuallyFollow(farm,link,undefined,notices),{moves:[['close'],['focus',{kind:'hive'}]],saves:[]},
    'the real 3/4 source must not open an already-carried inventory panel')
  assert.deepEqual(notices,[])
  assert.deepEqual(farm,before,'focus cannot collect from the live hive')

  const remoteSource=cold(farm);at(remoteSource,'village')
  const beforeSource=plain(remoteSource), remoteLink=wax(remoteSource)
  assert.ok(remoteLink)
  assert.deepEqual(await actuallyFollow(remoteSource,remoteLink),{
    moves:[['close'],['sail','cape'],['close'],['focus',{kind:'hive'}]],saves:[{...beforeSource,island:'cape'}],
  })
  assert.deepEqual(remoteSource,{...beforeSource,island:'cape'},'the explicit existing source click moves only the player')
  assert.equal(installGardenInstrument(farm),undefined)
  ok(F.collectCapeHoney(farm))
  assert.equal(farm.beeswax,4)
  assert.equal(wax(farm),undefined)
  at(farm,'village')
  assert.equal(installGardenInstrument(farm),2)
  assert.deepEqual([farm.day,farm.coins,farm.beeswax,farm.shells.regular],[30,44,0,0])
  const completed=plain(farm)
  assert.equal(installGardenInstrument(farm),undefined);assert.deepEqual(farm,completed)
})

test('Day30 exhausted hive remains a real wait, not an already-owned or forced extra collection',async()=>{
  const farm=earnedWaxReserve()
  at(farm,'cape');take(farm,'beeswax',3);ok(F.collectCapeHoney(farm))
  at(farm,'home');ok(F.sellMarketItem(farm,'beeswax',1))
  assert.deepEqual([farm.day,farm.beeswax,farm.capeHoneyOn,farm.freight.warehouses.cape.beeswax??0],[30,3,30,0])
  const link=wax(farm), before=plain(farm), notices:string[]=[]
  assert.ok(link)
  assert.deepEqual(await actuallyFollow(farm,link,undefined,notices),{moves:[['close'],['focus',{kind:'farmhouse'}]],saves:[]})
  assert.match(notices.join(' '),/Улей снова наполнится завтра/)
  assert.deepEqual(farm,before,'the wait route never starts a night')
})

test('real freight already unloaded at the Harbour reduces only the bag target',()=>{
  const farm=earnedWaxReserve()
  at(farm,'home')
  // The explicit stock haul is distinct from personal sailing and the source button.
  const ui=read('../src/bay-freight-ui.ts')
  const source=ui.slice(ui.indexOf('export function freightControl('),ui.indexOf('const portArt'))
  const control=runInNewContext(stripTypeScriptTypes(source.replace('export function','function')+';freightControl'),Freight)
  const route=(action:string,value='')=>{
    const result=control(farm.freight,action,value,farm.day,openedFreightPorts(farm))
    assert.ok(result);ok(result)
  }
  for(const port of ['cape','village'] as const)if(!farm.freight.route.stops.includes(port))route('freight-route-port',port)
  if(farm.freight.route.stops.includes('grove'))route('freight-route-port','grove')
  route('freight-start')
  for(let morning=0;(farm.freight.warehouses.village.beeswax??0)===0;morning++){
    assert.ok(morning<4,JSON.stringify({route:farm.freight.route,ship:farm.freight.ship}));ok(F.endDay(farm))
  }
  route('freight-pause')
  assert.ok(farm.freight.events.some(e=>e.kind==='unloading'&&e.port==='village'&&e.items.some(i=>i.id==='beeswax')))
  const delivered=farm.freight.warehouses.village.beeswax
  assert.ok(delivered>1)
  // Manually take the other wax to make the independent bag vs reserve accounting observable.
  at(farm,'village')
  take(farm,'beeswax',delivered-2)
  if(farm.beeswax>1){at(farm,'home');ok(F.sellMarketItem(farm,'beeswax',farm.beeswax-1));at(farm,'village')}
  if(farm.beeswax===0){at(farm,'cape');ok(F.collectCapeHoney(farm));at(farm,'village')}
  assert.deepEqual([farm.beeswax,farm.freight.warehouses.village.beeswax],[1,2])
  const link=wax(farm);assert.ok(link?.kind==='stock')
  assert.equal(link.item.quantity,2,'4 total minus 2 Harbour warehouse, not the remaining deficit of 1')
  assert.match(supplies(farm).html,/Пчелиный воск · 3\/4/)
  const before=plain(farm)
  assert.equal(installGardenInstrument(farm),undefined);assert.deepEqual(farm,before)
})
