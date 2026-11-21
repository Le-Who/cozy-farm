import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import { ruPlural } from '../src/ru.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const part=(from:string,to:string)=>{const start=source.indexOf(from),end=source.indexOf(to,start+1);assert.ok(start>=0&&end>start);return source.slice(start,end)}
const actionsStart=source.lastIndexOf("    case 'upgrades':")
const script=stripTypeScriptTypes(
  part('function button(', 'function panelTabs(') + part('function marketCards(', 'function treeSelector(')
  + `function drawUpgrades(){ switch('upgrades') {${part("    case 'upgrades': {", "    case 'specialize':\n")}} }
    this.shop=marketCards; this.drawUpgrades=drawUpgrades;
    this.look=()=>{switch('upgrades'){${source.slice(actionsStart,source.indexOf("    case 'specialize': {",actionsStart))}}}`
)

test('the normal Buy card opens and reveals exactly its already-upgraded building without a spend',()=>{
  const actions=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
  const end=actions.findIndex(action=>action.name==='upgradeBuilding'&&action.args[0]==='well')
  assert.ok(end>=0)
  const p=commissionPlayer(actions.slice(0,end+1)),farm=p.state,before=structuredClone(farm)
  assert.equal(farm.island,'home')
  const dialogContent={innerHTML:'',
    querySelector(selector:string){
      const id=selector.match(/^\[data-upgrade-title="([^"]+)"\]$/)?.[1]
      if(!id||!dialogContent.innerHTML.includes(`data-upgrade-title="${id}" tabindex="-1"`))return null
      return {focus({preventScroll}:{preventScroll:boolean}){assert.ok(preventScroll); focused=id},
        scrollIntoView({block}:{block:string}){assert.equal(block,'nearest');revealed=id}}
    },
  }
  let focused='',revealed=''
  const ctx={...F,farm,dialog:{open:true},dialogContent,panel:'market',marketTab:'buy',marketCategory:'buildings',value:'',ruPlural,
    numberFormat:new Intl.NumberFormat('ru'),icon:()=>'',itemIcon:()=>'',panelTabs:()=>'',nav:(s:string)=>s,
    openPanel(panel:string){ctx.panel=panel;ctx.drawUpgrades!()},shop:undefined as (()=>string)|undefined,look:undefined as (()=>void)|undefined,drawUpgrades:undefined as (()=>void)|undefined}
  runInNewContext(script,ctx)
  const html=ctx.shop!()
  const actual:Record<string,string[]>={}
  for(const building of F.buildingIds) {
    assert.equal(farm.buildingLevels[building],2)
    assert.match(html,new RegExp('data-action="upgrades"\\s+data-value="'+building+'"\\s+>Посмотреть'))
    ctx.panel='market';ctx.value=building;focused='';revealed=''
    ctx.look!()
    assert.equal(ctx.panel,'upgrades')
    actual[building]=[focused,revealed]
  }
  assert.deepEqual(actual,{farmhouse:['farmhouse','farmhouse'],coop:['coop','coop'],well:['well','well']})
  // The generic link and links from other screens still open the ordinary list.
  for(const origin of ['market','rest']) {
    ctx.panel=origin;ctx.value=origin==='market'?'': 'well';focused='';revealed=''
    ctx.look!()
    assert.equal(ctx.panel,'upgrades');assert.equal(focused,'');assert.equal(revealed,'')
  }
  assert.deepEqual(farm,before)
})
