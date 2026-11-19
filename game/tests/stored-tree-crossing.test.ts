import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { restoreCurrentFarm, returnNurseryTree, pickFruit, sail, canSailTo, treeDefinitions, type FarmState } from '../src/farm.ts'
import { TreeStorageChoice, storedTreeChoiceLabel } from '../src/tree-storage-choice.ts'
import { treeVariantCopy } from '../src/ready-variant-guidance.ts'
import { nurseryFruitDetail } from '../src/orchard-guidance.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { storedTreeCrossingPlayer } from './fixtures/stored-tree-crossing.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const part=(start:string,end:string)=>{const i=main.indexOf(start),j=main.indexOf(end,i+1);assert.ok(i>=0&&j>i);return main.slice(i,j)}
const compile=(s:string)=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const card=compile(part('function nurseryCard(','\nlet fishingGame:')+';nurseryCard(slot)')
const handler=compile(part('async function visitPanelAt(','function openGuidedMarket(')+'\n(async()=>{switch(action){'+part("case 'nursery-sail-plot':","case 'buy-sapling':")+'}})()')
const seed=storedTreeCrossingPlayer(),saved=structuredClone(seed.p.state)
function render(farm:FarmState,treeStorageChoice:TreeStorageChoice,slot?:number):string {
  return runInNewContext(card,{farm,treeStorageChoice,slot,treeDefinitions,storedTreeChoiceLabel,treeVariantCopy,nurseryFruitDetail,escapeHtml:String,
    button:(l:string,a:string,on:boolean,o:{value:string|number})=>`<button data-action="${a}" data-value="${o.value}"${on?'':' disabled'}>${l}</button>`,
    row:(_i:string,n:string,d:string,b:string)=>n+' '+d+' '+b})
}

test('an earned ripe tree in storage crosses to a genuine free slot; travel, return and collection are three separate actions',async()=>{
  const f=restoreCurrentFarm(JSON.parse(JSON.stringify(saved)))!,s=new TreeStorageChoice()
  assert.equal(f.treeNursery.length,2);assert.ok(s.choose(f,String(seed.id)));const shown=s.otherPlot(f)!
  assert.deepEqual(f.treeNursery.find(t=>t.id===seed.id)?.tree,seed.stored,'no fruit was lost or gained during storage overnight')
  const initial=structuredClone(f),html=render(f,s)
  assert.match(html,/disabled>Нет места в саду/);assert.match(html,/Плыть в Солёную рощу · место 2/)
  assert.ok(html.includes('data-value="'+shown.key+'"'));assert.deepEqual(initial,f)
  assert.equal(returnNurseryTree(f,-1,seed.id).ok,false)
  const events:string[]=[],ctx={action:'nursery-sail-plot',value:shown.key,panel:'orchard',dialog:{open:true},farm:f,treeStorageChoice:s,treeSlot:0,dialogContent:{},
    fieldViewButton:{getAttribute:()=> 'false'},panelHistory:[],rememberPanel:()=>({panel:'orchard'}),
    island:{isCrossing:()=>false,crossIsland:async(fn:()=>boolean)=>{events.push('cross');assert.ok(fn())}},
    canSailTo,sail,perform:(fn:()=>{ok:boolean})=>fn().ok,closeDialog:()=>{ctx.dialog.open=false},
    openPanel:(next:string)=>{ctx.panel=next;ctx.dialog.open=true;events.push(next)},revealTreeStorageReturn:()=>events.push('show return')}
  await runInNewContext(handler,ctx)
  assert.deepEqual(events,['cross','tree','show return']);assert.equal(ctx.treeSlot,1)
  const onlyTravel=structuredClone(initial);assert.ok(sail(onlyTravel,'grove').ok);assert.deepEqual(f,onlyTravel)
  assert.equal(f.trees.grove[ctx.treeSlot],null);assert.match(render(f,s,ctx.treeSlot),/data-action="return-nursery-tree" data-value="2">Вернуть · место 2/)
  assert.ok(returnNurseryTree(f,ctx.treeSlot,seed.id).ok);assert.deepEqual(f.trees.grove[ctx.treeSlot],seed.stored)
  assert.deepEqual(f.fruit,initial.fruit);assert.equal(f.coins,initial.coins);assert.equal(f.treeNursery.length,1)
  assert.equal(pickFruit(f,ctx.treeSlot).ok,true);assert.equal(f.fruit.apple-initial.fruit.apple,seed.stored.fruitReady)
  assert.equal(pickFruit(f,ctx.treeSlot).ok,false);assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f)
})

test('a stale selection, absent boat, or no room does not cross; ordinary free local return is unchanged',async()=>{
  const f=structuredClone(saved),s=new TreeStorageChoice();s.choose(f,String(seed.id))
  const old=s.otherPlot(f)!.key
  s.choose(f,String(f.treeNursery[0].id));assert.notEqual(old,s.otherPlot(f)?.key)
  const ctx={action:'nursery-sail-plot',value:old,panel:'orchard',dialog:{open:true},island:{isCrossing:()=>false},farm:f,treeStorageChoice:s,treeSlot:0}
  await runInNewContext(handler,ctx);assert.equal(f.island,'home');assert.equal(ctx.treeSlot,0)
  f.boatOwned=false;assert.doesNotMatch(render(f,s),/nursery-sail-plot/);f.boatOwned=true
  const blocked=structuredClone(f);blocked.trees.grove=structuredClone(f.trees.home);assert.doesNotMatch(render(blocked,s),/nursery-sail-plot/)
  f.trees.home[1]=null;const html=render(f,s);assert.doesNotMatch(html,/nursery-sail-plot/);assert.match(html,/>Вернуть · место 2/)
  assert.ok(isGuardedAction('nursery-sail-plot'))
})
