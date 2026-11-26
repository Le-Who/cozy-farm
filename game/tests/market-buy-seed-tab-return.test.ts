import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import { buySeeds, cropDefinitions, cropIds, getSale, sail, seedPackSize } from '../src/farm.ts'
import { MarketSaleBrowseMemory } from '../src/market-sale-browse.ts'
import { earned416Mixed } from './fixtures/earned-416-market-orders.ts'

const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/market-buy-seeds.css',import.meta.url),'utf8')
function section(a:string,b:string){
  const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j)
}
const switchCase=(name:string,tail:string)=>`switch('${name}'){${section("    case '"+name+"':",tail)}}`
const tabs=stripTypeScriptTypes(section('function marketBuySeedGridKey(','function rememberClosedMarketSell()')+
  switchCase('market-tab',"    case 'market-order-pickup':"))
const category=stripTypeScriptTypes(switchCase('market-category',"    case 'inventory-group':"))
const renderedOwner=section("  // A different rendered panel ends the Buy shelf's same-Market tab visit.","  dialog.dataset.marketTab = marketTab")
const commonOpen=section('function openPanel(','function openRecipeBook(')
const freshOpen=source.match(/^  if \(!dialog.open\) marketSaleBrowse\.reset\(\)$/m)?.[0]
const modalDisplay=source.indexOf('if (!dialog.open) dialog.showModal()')
const closeListener=section("dialog.addEventListener('close',","app.addEventListener('change'")
assert.ok(freshOpen&&modalDisplay>source.indexOf(freshOpen))
assert.doesNotMatch(commonOpen,/resetBuySeeds/,'common navigation does not own tab-only scroll state')
assert.equal(source.match(/dialog\.showModal\(/g)?.length,1,'every fresh modal opening goes through the common reset')
assert.doesNotMatch(closeListener,/marketSaleBrowse/,'unrelated dialog closes do not own Market session state')
const earned=earned416Mixed(false)
function ui(){
  const farm=structuredClone(earned.state),mem=new MarketSaleBrowseMemory()
  const layout={clientWidth:350,scrollHeight:1650,cards:[...cropIds]}, sellRows={scrollTop:0}
  const newGrid=()=>({clientWidth:layout.clientWidth,scrollHeight:layout.scrollHeight,scrollTop:0,
    querySelectorAll(q:string){
      assert.equal(q,'[data-seed-pack]')
      return layout.cards.map(seedPack=>({dataset:{seedPack}}))
    },
  })
  let buy=newGrid()
  const c={farm,panel:'market', marketTab:'buy',marketCategory:'seeds',value:'orders', marketSaleBrowse:mem,
    dialog:{open:true,dataset:{panel:'market'}},dialogContent:{scrollTop:0,querySelector(q:string){
      if(q==='.market-seed-grid')return c.marketTab==='buy'&&c.marketCategory==='seeds'?buy:null
      if(q==='#market-sale-results')return c.marketTab==='sell'?sellRows:null
      return null
    }},
    dialogFeedback:{hidden:false,textContent:''}, closeContextualSale(){}, marketSaleGridKey:()=> 'existing-sell-key',
    drawPanel(){runInNewContext(renderedOwner,c);if(c.panel==='market'&&c.marketTab==='buy')buy=newGrid();if(c.panel==='market'&&c.marketTab==='sell')sellRows.scrollTop=0},
  }
  return {c,mem,layout,farm,sellRows,get buy(){return buy}, tab(value:string){c.value=value;runInNewContext(tabs,c)},
    category(value:string){c.value=value;runInNewContext(category,c)}, visitOtherPanel(){c.panel='intents';c.drawPanel();c.panel='market';c.drawPanel()},
    reopen(){c.dialog.open=false;runInNewContext(freshOpen!,c);c.dialog.open=true;c.drawPanel()}}
}

test('earned late seed shelf returns after either other Market tab, with no automatic purchase or focus move', t=>{
  assert.deepEqual([earned.actions,earned.state.day,getSale(earned.state).items,cropIds.length,cropIds.at(-1)],[543,193,416,10,'raspberry'])
  assert.match(css,/@media\(max-width:600px\)[\s\S]*?\.market-seed-grid\s*\{grid-template-columns:minmax\(0,1fr\)/)
  assert.doesNotMatch(section("    case 'market-tab':","    case 'market-order-pickup':"),/\.focus\(|perform\(|buySeeds\(|saveFarm\(/)
  for(const alternate of ['orders','sell']){
    const s=ui(),before=structuredClone(s.farm),original=s.buy;
    original.scrollTop=641;s.tab(alternate);s.c.drawPanel() // an ordinary alternate-tab redraw stays inside this Market
    if(alternate==='sell')s.mem.resetPositions() // changing/resetting a Sell scope is independent from Buy
    s.tab('buy')
    assert.notEqual(original,s.buy)
    assert.equal(s.buy.scrollTop,641)
    assert.deepEqual([s.c.marketTab,s.c.marketCategory],['buy','seeds'])
    assert.deepEqual(s.farm,before)
    assert.ok(buySeeds(s.farm,'raspberry').ok)
    assert.deepEqual([s.farm.coins,s.farm.seeds.raspberry],[before.coins-cropDefinitions.raspberry.seedPrice,before.seeds.raspberry+seedPackSize])
    t.diagnostic(JSON.stringify({tab:alternate,modeledScrollBefore:641,modeledScrollRestored:s.buy.scrollTop,ordinaryPrice:cropDefinitions.raspberry.seedPrice}))
  }
})

test('fresh modal after close, category, other scene, island and incompatible layout each invalidate this one-use offset',()=>{
  for(const invalidation of [
    (s:ReturnType<typeof ui>)=>s.reopen(), // Even before a queued native close event fires.
    (s:ReturnType<typeof ui>)=>{s.category('care');s.category('seeds')},
    (s:ReturnType<typeof ui>)=>s.visitOtherPanel(),
    (s:ReturnType<typeof ui>)=>assert.ok(sail(s.farm,'grove').ok),
    (s:ReturnType<typeof ui>)=>s.layout.clientWidth=970,
    (s:ReturnType<typeof ui>)=>s.layout.scrollHeight=740,
    (s:ReturnType<typeof ui>)=>s.layout.cards.reverse(),
  ]){
    const s=ui();s.buy.scrollTop=641;s.tab('orders');invalidation(s);s.tab('buy')
    assert.equal(s.buy.scrollTop,0)
  }
  const m=new MarketSaleBrowseMemory()
  m.rememberBuySeeds('x',0);assert.equal(m.takeBuySeeds('x'),0)
  m.rememberBuySeeds('x',641);assert.equal(m.takeBuySeeds('different'),undefined)
  assert.equal(m.takeBuySeeds('x'),undefined,'discard the stale capture instead of reviving it')
})

test('Sell and Buy pause independent real tab visits with existing selection/editor preservation',()=>{
  const s=ui(),before=structuredClone(s.farm)
  s.buy.scrollTop=641;s.tab('sell');s.sellRows.scrollTop=428
  s.tab('buy');assert.equal(s.buy.scrollTop,641)
  s.buy.scrollTop=500;s.tab('orders');s.tab('sell');assert.equal(s.sellRows.scrollTop,428)
  s.tab('buy');assert.equal(s.buy.scrollTop,500)
  assert.equal(s.c.dialogContent.scrollTop,0,'only the inner grid changes')
  assert.deepEqual(s.farm,before)
})
