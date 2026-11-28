import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as W from '../src/warehouse-guidance.ts'
import { getApiaryCopy } from '../src/apiary-preview.ts'
import { getWindHoneySource } from '../src/wind-honey-guidance.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const seller = 'apiary'
const source = readFileSync(new URL('../src/main.ts', import.meta.url),'utf8')
const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url),'utf8'))
function exact(a:string,b:string) {
  const start=source.indexOf(a),end=source.indexOf(b,start+a.length)
  assert.ok(start>=0&&end>start,a);return source.slice(start,end)
}
const render=stripTypeScriptTypes(exact('function button(label:','function quantity(')
  +"\n;switch(panel){"+exact("    case 'hive': {","    case 'cape-upgrade': {")
  +exact("    case 'warehouse-supply': {","    case 'music-supplies': {")+"}")
const dispatch=stripTypeScriptTypes('switch(action){'
  +exact("    case 'warehouse-supply': {\n      selectedWarehouseRequest","    case 'show-requirement': {")+"}")
const stock=(f:F.FarmState)=>[f.day,f.island,f.coins,f.honey,f.beeswax,f.freight.warehouses.cape.beeswax??0,f.orders.apiary.completed]
function start(built=true) {
  const p=commissionPlayer(opening.slice(0,15))
  p.act('collectShell',0);p.act('changeCove',{cover:'kelp'});p.act('pickFruit',0);p.act('gatherSeaSalt')
  p.visit('home');p.act('deliverMarketOrder','garden');p.act('upgradeBuilding','farmhouse')
  p.night();p.act('pickFruit',0);p.act('cookDish','appleJam');p.visit('grove');p.act('deliverProject','dock')
  p.visit('cape');for(let i=0;i<3;i++)p.act('plantCapeFlower',i)
  p.night();p.visit('cape');p.act('collectCapeHoney')
  if(built)p.act('upgradeCape')
  p.visit('home');p.act('deliverMarketOrder','pantry')
  p.act('upgradeBuilding','coop');p.act('upgradeBuilding','well')
  p.night();p.visit('cape')
  if(!built)p.act('upgradeCape')
  assert.deepEqual(stock(p.state),[5,'cape',9,0,0,built?2:0,0])
  return p
}
function ui(farm:F.FarmState, flower?: number) {
  const dialogContent={innerHTML:''}, opened:string[]=[], transfers:string[]=[]
  const ctx={...F,...W,farm,panel:'hive',action:'',value:'',hiveFlower:flower,dialog:{open:true},dialogContent,opened,
    dialogTitle:{textContent:'',setAttribute(){}},panelHistory:['hive'],numberFormat:new Intl.NumberFormat('ru'),
    selectedWarehouseRequest:undefined as F.StockItem|undefined, getApiaryCopy,getWindHoneySource,
    bayAudio:{playEvent(){}},stockLabel:()=>({name:'Пчелиный воск',image:'ui-beeswax'}),escapeHtml:(s:string)=>s,
    itemIcon:()=>'',icon:()=>'',row:()=>'',nav:(...s:string[])=>s.join(''),
    openPanel(p:string){opened.push(p);ctx.panel=p},
    perform(action:()=>F.ActionResult){const result=action();if(result.ok)transfers.push(result.message);return result.ok},
  }
  function buttons(panel=ctx.panel){
    const before=structuredClone(farm);runInNewContext(render,{...ctx,panel});assert.deepEqual(farm,before)
    return [...dialogContent.innerHTML.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)].map(([,attrs,label])=>({
      action:attrs.match(/data-action="([^"]+)"/)?.[1],value:attrs.match(/data-value="([^"]+)"/)?.[1],
      label:label.trim(),enabled:!/\bdisabled\b/.test(attrs),
    }))
  }
  return {buttons,opened,transfers,click(action:string,value:string){Object.assign(ctx,{action,value});runInNewContext(dispatch,ctx)}}
}
const route={action:'warehouse-supply',value:'beeswax|3',label:'К складу · воск ×2',enabled:true}
const pickup=(h:ReturnType<typeof ui>)=>h.buttons().filter(b=>b.action==='warehouse-supply')

test('real D5 Hive surfaces its two depot wax before or after optional gathering, not an order or voyage',()=>{
  const p=start(),h=ui(p.state),before=structuredClone(p.state)
  assert.deepEqual(pickup(h),[route])
  assert.ok(h.buttons().some(b=>b.action==='collect-honey'&&b.enabled))
  assert.ok(h.buttons().some(b=>b.action==='cape-upgrade'&&b.enabled))
  const named=ui(p.state,1)
  assert.deepEqual(pickup(named),[]);assert.ok(named.buttons().some(b=>b.action==='cape-bouquet'&&b.enabled))
  h.click(route.action,route.value)
  assert.deepEqual(h.opened,['warehouse-supply'])
  assert.deepEqual(h.transfers,[]);assert.deepEqual(p.state,before)
  const commit=h.buttons().find(b=>b.action==='warehouse-supply-withdraw')
  assert.deepEqual(commit,{action:'warehouse-supply-withdraw',value:'cape|beeswax|3|2',label:'Забрать в припасы ×2',enabled:true})
  assert.ok(h.buttons().some(b=>b.action==='back'&&b.enabled))
  h.click(commit!.action!,commit!.value!);h.click(commit!.action!,commit!.value!)
  assert.equal(h.transfers.length,1)
  assert.deepEqual(stock(p.state),[5,'cape',9,0,2,0,0])
  assert.deepEqual(pickup(ui(p.state)),[])
  p.reload();p.act('collectCapeHoney');p.visit('home')
  assert.equal(F.getMarketOrders(p.state).find(o=>o.lane===seller)?.status,'ready')
  p.act('deliverMarketOrder',seller)
  assert.deepEqual(stock(p.state),[5,'home',51,2,0,0,1])

  const other=start();other.act('collectCapeHoney')
  const after=ui(other.state)
  assert.deepEqual(pickup(after),[route])
  assert.ok(after.buttons().some(b=>b.action==='visit-rest'&&b.enabled))
  assert.ok(!after.buttons().some(b=>b.action==='collect-honey'&&b.enabled))
})

test('no pickup when production was missed, honey already sold, on a different shore, or first parcel completed',()=>{
  const late=start(false)
  assert.deepEqual(pickup(ui(late.state)),[])
  late.act('collectCapeHoney');assert.deepEqual(pickup(ui(late.state)),[])
  const p=start();p.act('collectCapeHoney');p.visit('home')
  assert.deepEqual(pickup(ui(p.state)),[])
  p.act('sellMarketItem','honey',3);p.visit('cape')
  assert.deepEqual(stock(p.state),[5,'cape',30,1,1,2,0])
  assert.deepEqual(pickup(ui(p.state)),[],'stock alone does not make the other line available')
  const completed=start();completed.act('collectCapeHoney')
  completed.act('transferBayGoods','withdraw','cape','beeswax',2);completed.visit('home')
  completed.act('deliverMarketOrder',seller)
  completed.night();completed.visit('cape')
  assert.equal(completed.state.freight.warehouses.cape.beeswax,2)
  assert.deepEqual(pickup(ui(completed.state)),[],'never turn later orders into this first-parcel shortcut')
})
