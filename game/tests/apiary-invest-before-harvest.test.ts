import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {test} from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {getApiaryCopy} from '../src/apiary-preview.ts'
import {getWindHoneySource} from '../src/wind-honey-guidance.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const commands = JSON.parse(readFileSync(new URL('./fixtures/market-order-selection-commands.json', import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
const bloom = commands.slice(0,commands.findIndex(action=>action.name==='collectCapeHoney'))
const gotHoney = [...bloom,{name:'collectCapeHoney',args:[]},{name:'sail',args:['home']}]
const returnTomorrow = [{name:'endDay',args:[]},{name:'sail',args:['cape']}]
const source = readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const between=(start:string,end:string)=>{
  const from=source.indexOf(start),until=source.indexOf(end,from+start.length)
  assert.ok(from>=0&&until>from,start);return source.slice(from,until)
}
const activate=source.slice(source.indexOf("    case 'cape-upgrade': openPanel("))
const code=stripTypeScriptTypes([
  between('type ButtonOptions =','function quantity('),between('function nav(','function panelTabs('),
  'function render(panel){switch(panel){',between("    case 'hive': {","    case 'honey-kitchen': {"),'}}',
  'function select(action){switch(action){',
  activate.slice(0,activate.indexOf("    case 'visit-guest':")),
  between("    case 'collect-honey':","    case 'serve-guest':"),
  '}};({render,select})'
].join('\n'))

function hive(farm:F.FarmState) {
  let rendered='', open:string|undefined, work:(()=>boolean)|undefined
  const no=()=>{}
  const ctx={
    ...F,farm,hiveFlower:undefined as number|undefined, getApiaryCopy,getWindHoneySource,
    dialogContent:{set innerHTML(html:string){rendered=html}},dialogTitle:{setAttribute:no},
    icon:()=>'',numberFormat:new Intl.NumberFormat('ru-RU'),
    row:()=>'<li></li>',stockTile:(item:{quantity:number})=>`<li data-quantity="${item.quantity}"></li>`,
    openPanel(panel:string){open=panel}, closeDialog:no, playBaySound:no,
    island:{workCape(target:{kind:string},go:()=>boolean){assert.equal(target.kind,'hive');work=go}},
    perform:(reducer:()=>F.ActionResult)=>{const outcome=reducer();return outcome.ok},
  }
  const {render,select} = runInNewContext(code,ctx)
  function view(panel='hive',flower?:number) {
    ctx.hiveFlower=flower
    const before=structuredClone(farm);render(panel);assert.deepEqual(farm,before)
    const buttons=(markup:string)=>[...markup.matchAll(/<button\b([^>]*)>/g)].map(([,attrs])=>({
      action:attrs.match(/data-action="([^"]+)"/)?.[1],
      primary:!attrs.includes('dialog-button secondary'),
      enabled:!/(?:^|\s)disabled(?:\s|$)/.test(attrs),
    }))
    const rows=[...rendered.matchAll(/<div class="dialog-grid dialog-nav">(.*?)<\/div>/gs)].map(([,html])=>buttons(html))
    return {rows,buttons:buttons(rendered),markup:rendered}
  }
  const clicked=(action:string)=>select(action)
  return {view,clicked,get selected(){return open},commit(){assert.ok(work);return work()}}
}

test('a payable Apiary and live harvest sit together with equal weight before optional rest',()=>{
  const p=commissionPlayer([...gotHoney,...returnTomorrow]), start=structuredClone(p.state)
  assert.equal(p.actions,40);assert.equal(p.state.day,5)
  assert.equal(F.getCapeUpgrade(p.state)?.available,true)
  assert.equal(p.state.coins,78);assert.equal(p.state.honey,3);assert.equal(p.state.beeswax,0)
  const h=hive(p.state), view=h.view()
  assert.deepEqual(view.rows[0],[
    {action:'cape-upgrade',primary:true,enabled:true},
    {action:'collect-honey',primary:true,enabled:true},
  ])
  assert.equal(view.buttons.filter(button=>button.action==='cape-upgrade').length,1)
  assert.equal(view.buttons.filter(button=>button.action==='collect-honey').length,1)
  assert.ok(view.buttons.some(button=>button.action==='visit-rest' && !button.primary))
  h.clicked('cape-upgrade')
  assert.equal(h.selected,'cape-upgrade')
  assert.deepEqual(p.state,start,'reviewing the upgrade is not a purchase, harvest or rest')
  const quote=h.view('cape-upgrade')
  assert.ok(quote.buttons.some(button=>button.action==='build-cape-upgrade'&&button.enabled))
  assert.match(quote.markup,/data-quantity="3"/);assert.match(quote.markup,/48/)
  h.clicked('build-cape-upgrade')
  assert.equal(p.state.capeLevel,2);assert.equal(p.state.coins,30);assert.equal(p.state.honey,0);assert.equal(p.state.beeswax,0)
  h.clicked('collect-honey')
  assert.equal(p.state.honey,0,'review plus explicit Build does not collect')
  assert.ok(h.commit())
  assert.equal(p.state.honey,4);assert.equal(p.state.beeswax,1)
  assert.equal(h.commit(),false,'the paid Apiary cannot collect twice')
})

test('gathering alone and the genuine alternate sale stay available without paying for construction',()=>{
  const p=commissionPlayer([...gotHoney,...returnTomorrow]),h=hive(p.state)
  assert.ok(h.view().buttons.some(b=>b.action==='collect-honey'&&b.enabled))
  h.clicked('collect-honey')
  assert.equal(p.state.honey,3);assert.equal(p.state.coins,78)
  assert.ok(h.commit())
  assert.equal(p.state.honey,6);assert.equal(p.state.coins,78);assert.equal(p.state.capeLevel,1)
  p.visit('home');p.act('sellMarketItem','honey',3)
  assert.equal(p.state.honey,3);assert.equal(p.state.coins,99);assert.equal(p.state.capeLevel,1)
})

test('missing honey, a spent collection, a low-coin upgrade and a named flower keep their old pathways',()=>{
  const short=commissionPlayer(bloom), waiting=hive(short.state)
  assert.equal(F.getCapeUpgrade(short.state)?.available,false)
  assert.deepEqual(waiting.view().rows.at(-1)?.map(b=>[b.action,b.primary,b.enabled]),[
    ['collect-honey',true,true],['cape-upgrade',false,true],
  ])
  assert.ok(waiting.view('cape-upgrade').buttons.some(b=>b.action==='build-cape-upgrade'&&!b.enabled))

  const both=commissionPlayer([...gotHoney,...returnTomorrow]),thisHive=hive(both.state)
  assert.deepEqual(thisHive.view('hive',1).buttons.map(b=>[b.action,b.primary]),[
    ['cape-bouquet',false],['visit-rest',false],['collect-honey',true],['cape-upgrade',false],
  ])
  both.act('collectCapeHoney')
  const spent=hive(both.state)
  assert.equal(F.getCapeUpgrade(both.state)?.available,true)
  assert.deepEqual(spent.view().rows.at(-1)?.map(b=>[b.action,b.primary,b.enabled]),[
    ['visit-rest',true,true],['cape-upgrade',false,true],
  ])

  const budget=commissionPlayer([...gotHoney,{name:'upgradeBuilding',args:['well']},{name:'upgradeBuilding',args:['coop']},...returnTomorrow])
  assert.equal(budget.state.coins,38);assert.equal(budget.state.honey,3)
  assert.equal(F.getCapeUpgrade(budget.state)?.available,false)
  assert.deepEqual(hive(budget.state).view().rows.at(-1)?.map(b=>[b.action,b.primary,b.enabled]),[
    ['collect-honey',true,true],['cape-upgrade',false,true],
  ])
})

test('wind adds its own honey without substituting for readiness or either existing choice',()=>{
  const p=commissionPlayer([...gotHoney,...returnTomorrow])
  while(p.state.day<8){p.night();p.visit('cape')}
  const f=p.state,before=structuredClone(f)
  assert.equal(F.getCapeHoney(f).windHoney,1)
  assert.ok(F.getCapeUpgrade(f)?.available)
  assert.deepEqual(hive(f).view().rows[0]?.map(b=>[b.action,b.primary,b.enabled]),[
    ['cape-upgrade',true,true],['collect-honey',true,true],
  ])
  assert.deepEqual(f,before)
})
