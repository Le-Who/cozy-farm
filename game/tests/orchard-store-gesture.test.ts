import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import {installActionClickGuard} from '../src/action-click-guard.ts'
import {createFarm,buyAndPlantTree,storeTree,restoreCurrentFarm} from '../src/farm.ts'
import {orchardMarketReturnIndex} from '../src/orchard-market-return.ts'
import {TreeStorageChoice} from '../src/tree-storage-choice.ts'

test('holding Store cannot follow its newly focused sapling shortcut until Enter is released',t=>{
  const farm=createFarm();for(const slot of [1,2])assert.ok(buyAndPlantTree(farm,slot,'apple').ok)
  const apple=structuredClone(farm.trees.home[0]);assert.equal(apple?.fruitReady,2)
  const expected=structuredClone(farm);assert.ok(storeTree(expected,0).ok)
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const part=(from:string,to:string)=>{const i=main.indexOf(from),j=main.indexOf(to,i);assert.ok(j>i&&i>=0);return main.slice(i,j)}
  const code=part('function marketTreeReturnIndex()', 'let panelRenderVersion')+
    '\nfunction choose(action,value){switch(action){'+part("    case 'market-orchard-space':","    case 'orchard':")+
    part("    case 'store-tree':","    case 'return-nursery-tree':")+'}}'
  class Button {
    dataset:{action:string};disabled=false
    constructor(action:string){this.dataset={action}}
    matches(){return false}
    closest(s:string){return s==='button'?this:null}
    focus(){focused=this}
    scrollIntoView(){}
  }
  const previous=Object.getOwnPropertyDescriptor(globalThis,'Element')
  Object.defineProperty(globalThis,'Element',{configurable:true,value:Button})
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'Element',previous);else Reflect.deleteProperty(globalThis,'Element')})
  const listeners:Record<string,Function>={}
  const root={contains:(button:Button)=>button===focused,addEventListener:(type:string,fn:Function)=>{listeners[type]=fn},
    ownerDocument:{addEventListener:(type:string,fn:Function)=>{listeners[type]=fn}}}
  installActionClickGuard(root as unknown as HTMLElement)
  let focused=new Button('market-orchard-space'),returns=0,stores=0
  const back=new Button('market-trees-return'),category=new Button('market-category')
  const ctx:any={farm,storeTree,treeStorageChoice:new TreeStorageChoice(),treeSlot:0,orchardMarketReturnIndex,
    panel:'market',marketTab:'buy',marketCategory:'trees',panelHistory:[],marketTreeSpaceVisit:undefined,dialog:{open:true},
    button:(label:string,action:string)=>'<button data-action="'+action+'">'+label+'</button>',
    rememberPanel:()=>({panel:ctx.panel,marketTab:ctx.marketTab,marketCategory:ctx.marketCategory}),focusKey:()=> 'trees',
    openPanel:(next:string)=>{ctx.panel=next},goBack(){returns++;ctx.panel=ctx.panelHistory.pop().panel;focused=category},
    perform(action:()=>{ok:boolean}){assert.ok(action().ok);stores++;return true},
    dialogContent:{querySelector:(selector:string)=>selector.includes('market-category')?category:
      selector.includes('market-trees-return')&&ctx.marketTreeContinuation().includes('К саженцам')?back:null}}
  runInNewContext(stripTypeScriptTypes(code),ctx)
  ctx.choose(focused.dataset.action);assert.equal(ctx.panel,'orchard')
  ctx.panelHistory.push(ctx.rememberPanel());ctx.openPanel('tree');focused=new Button('store-tree')
  const enter=(repeat=false)=>{
    const target=focused
    let blocked=false
    listeners.keydown({key:'Enter',target,repeat,preventDefault:()=>{blocked=true},stopImmediatePropagation(){}})
    if(!blocked)ctx.choose(target.dataset.action,'0') // The normal button activation after an uncancelled Enter.
  }
  enter();assert.equal(focused,back);assert.deepEqual(farm,expected)
  enter(true);assert.equal(ctx.panel,'tree','holding Enter must not immediately navigate to Market')
  enter(true);assert.equal(returns,0);assert.equal(focused,back)
  listeners.keyup({key:'Enter'});enter();assert.equal(ctx.panel,'market');assert.equal(returns,1)
  assert.equal(stores,1);assert.deepEqual(farm,expected);assert.deepEqual(farm.treeNursery,[{id:1,tree:apple}])
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),expected)
})
