import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { cookDish, createFarm, endDay, getCookAction, pickFruit, sellMarketItem, storeTree, type FarmState } from '../src/farm.ts'
import { renderRestPreview } from '../src/rest-preview-ui.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

function beforeFirstJam() {
  const steps=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
  const next=steps.findIndex(step=>step.name==='cookDish'&&step.args[0]==='appleJam')
  assert.ok(next>0&&steps[next-1].name==='pickFruit')
  return commissionPlayer(steps.slice(0,next-1)).state
}

test('the earned first-jam forecast makes harvesting before bed optional and predicts the actual refill',()=>{
  const farm=beforeFirstJam(), before=structuredClone(farm)
  assert.equal(farm.day,3);assert.equal(farm.fruit.apple,0);assert.equal(farm.trees.home[0]?.fruitReady,2)
  assert.equal(getCookAction(farm,'appleJam').available,false)
  const render=(f:FarmState)=>renderRestPreview(f,true)
  const html=render(farm)
  assert.match(html,/Если собрать сейчас, утром будет ещё ×2/)
  assert.match(html,/data-action="visit-tree" data-value="0">К яблоне · ×2 сейчас/)
  assert.deepEqual(farm,before)

  const now=structuredClone(farm),later=structuredClone(farm)
  assert.ok(pickFruit(now,0).ok)
  assert.match(render(now),/Яблоки к утру · ×2/);assert.doesNotMatch(render(now),/data-action="visit-tree"/)
  assert.ok(endDay(now).ok);assert.ok(endDay(later).ok)
  assert.equal(now.day,4);assert.equal(later.day,4)
  assert.equal(now.trees.home[0]?.fruitReady,2);assert.equal(later.trees.home[0]?.fruitReady,2,'leaving ripe fruit does not lose it')
  assert.equal(getCookAction(now,'appleJam').available,true);assert.equal(getCookAction(later,'appleJam').available,false)
  assert.ok(pickFruit(now,0).ok);assert.ok(pickFruit(later,0).ok)
  assert.equal(now.fruit.apple,4);assert.equal(later.fruit.apple,2)
  assert.ok(cookDish(now,'appleJam').ok);assert.equal(now.fruit.apple,2)
  assert.doesNotMatch(render(now),/class="rest-orchard-preview"/)
  assert.ok(sellMarketItem(now,'dishes:appleJam').ok);assert.equal(now.dishes.appleJam,0)
  assert.ok(endDay(now).ok);assert.doesNotMatch(render(now),/class="rest-orchard-preview"/)
  assert.deepEqual(farm,before)
})

test('only one real Home apple tree is shown, without requiring a tree task from ineligible players',()=>{
  const f=beforeFirstJam()
  const gone=structuredClone(f);assert.ok(storeTree(gone,0).ok);assert.doesNotMatch(renderRestPreview(gone,true),/class="rest-orchard-preview"/)
  assert.doesNotMatch(renderRestPreview(createFarm(),true),/class="rest-orchard-preview"/)
  for(const orchard of [[null,{tree:'apple',age:0,fruitReady:0},null],[null,{tree:'pear',age:2,fruitReady:2},null]] as FarmState['trees']['home'][]){
    const other=structuredClone(f);other.trees.home=orchard
    assert.doesNotMatch(renderRestPreview(other,true),/class="rest-orchard-preview"/)
  }
  f.trees.home[1]=f.trees.home[0];f.trees.home[0]={tree:'apple',age:1,fruitReady:0}
  const html=renderRestPreview(f,true)
  assert.equal((html.match(/class="rest-orchard-preview"/g)??[]).length,1)
  assert.match(html,/data-action="visit-tree" data-value="1"/)
  f.island='grove';assert.doesNotMatch(renderRestPreview(f,true),/class="rest-orchard-preview"/)
})

test('the forecast uses the existing exact-slot tree and the same Back route without performing farm work',()=>{
  const farm=beforeFirstJam(),before=structuredClone(farm)
  const value=renderRestPreview(farm,true).match(/data-action="visit-tree" data-value="(\d+)"/)?.[1]
  assert.equal(value,'0')
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const part=(from:string,to:string)=>main.slice(main.indexOf(from),main.indexOf(to,main.indexOf(from)))
  const visit=part("    case 'visit-tree':","    case 'pet':")
  const context:any={farm,value,panel:'rest',treeSlot:-1,dialog:{open:true,querySelectorAll:()=>[]},panelRenderVersion:1,panelHistory:[],
    dialogContent:{scrollTop:34,querySelector:()=>null,querySelectorAll:()=>[]},recipeBook:{load(){}},restoreFerryPanelView(){},revealTreeStorageReturn(){},
    island:{visit(){},isCrossing:()=>false},bayAudio:{primeEvents(){}},requestAnimationFrame:(fn:()=>void)=>fn(),
    openPanel(next:string,remember=true){
      if(remember)context.panelHistory.push({panel:context.panel,scroll:context.dialogContent.scrollTop,signatureSlots:[],marketNextOpen:[]})
      context.panel=next
    }}
  const actions=runInNewContext(stripTypeScriptTypes(part('function activateTarget(','function useHotbar(')+part('function goBack(','let harbourScene:')+
    "\n;({visit:()=>{switch('visit-tree'){"+visit+"}},back:goBack})"),context)
  actions.visit();assert.equal(context.panel,'tree');assert.equal(context.treeSlot,0)
  actions.back(true);assert.equal(context.panel,'rest');assert.equal(context.dialogContent.scrollTop,34)
  assert.deepEqual(farm,before)
})
