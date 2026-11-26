import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { commissionPlayer } from './fixtures/commission-player.ts'
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

function supplies(farm:F.FarmState) {
  const before=structuredClone(farm)
  const content={innerHTML:''}, links:{content:string;requirement:Requirement}[]=[]
  const buttons:{action:string;value:string|undefined;enabled:boolean}[]=[]
  const islandNames=plain({home:'Родной остров',grove:'Солёная роща',cape:'Цветочный мыс',village:'Лавандовая гавань'})
  const source=between("    case 'music-supplies': {","    case 'bay-freight':")
  runInNewContext(stripTypeScriptTypes("switch('music-supplies'){"+source+"}"),{
    farm,...G,gardenMaterialStock,dialogContent:content,islandNames,islandIds:F.islandIds,canSailTo:F.canSailTo,
    nav:(...s:string[])=>s.join(''),
    button:(name:string,action:string,enabled:boolean,options?:{value?:string})=>{buttons.push({action,value:options?.value,enabled});return name},
    requirementLink:(content:string,r:Requirement)=>{links.push({content,requirement:plain(r)});return content},
  })
  assert.deepEqual(farm,before,'viewing supplies never pays, harvests, withdraws or travels')
  return {html:content.innerHTML,buttons,links,salt:links.find(l=>l.content.includes('Морская соль'))?.requirement}
}

async function actuallyFollow(farm:F.FarmState, requirement:Requirement, duringCrossing?:()=>void) {
  const source=between('async function showRequirement(', '// Scene handlers own material sounds.')
  const moves:unknown[][]=[], saves:F.FarmState[]=[]
  const context=runInNewContext(stripTypeScriptTypes(source+';({showRequirement})'),{
    farm,getRequirementHint,islandIds:F.islandIds,canSailTo:F.canSailTo, sail:F.sail,panel:'music-supplies',dialog:{open:true},
    fieldViewButton:{getAttribute:()=> 'false'},closeDialog:()=>moves.push(['close']),
    perform:(work:()=>F.ActionResult)=>{assert.ok(work().ok);saves.push(plain(farm));return true},
    island:{crossIsland:async(commit:()=>boolean)=>{assert.ok(commit());moves.push(['sail',farm.island]);duringCrossing?.()},
      focusTarget:(place:unknown)=>moves.push(['focus',plain(place)])},
    openPanel:(panel:string)=>moves.push(['panel',panel]),
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
  assert.deepEqual(view.links.find(x=>x.content.includes('Ракушки'))?.requirement,{kind:'stock',item:{kind:'shells',item:'regular',quantity:1}})

  const enRoute=earned(), wanted=supplies(enRoute).salt!
  const crossed=await actuallyFollow(enRoute,wanted,()=>{assert.ok(F.gatherSeaSalt(enRoute).ok)})
  assert.deepEqual(crossed.moves,[['close'],['sail','grove']],'validation repeats at landing; never focuses an exhausted source')
  assert.equal(crossed.saves.length,1)
})
