import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {createFarm,buyAndPlantTree,storeTree,returnNurseryTree,restoreCurrentFarm,treeDefinitions} from '../src/farm.ts'
import {TreeStorageChoice,storedTreeChoiceLabel,revealTreeStorageReturn} from '../src/tree-storage-choice.ts'
import {nurseryFruitDetail} from '../src/orchard-guidance.ts'
import {treeVariantCopy} from '../src/ready-variant-guidance.ts'

// Exercise the existing UI command/render seam, including perform's save then
// refresh ordering. The adapter records requested focus; it is not native geometry.
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const renderer=main.slice(main.indexOf('function nurseryCard('),main.indexOf('\nlet fishingGame:'))
const perform=main.slice(main.indexOf('function perform('),main.indexOf('\nconst bedTools'))
const handlers=main.slice(main.indexOf("    case 'store-tree': {"),main.indexOf("    case 'buy-plant-tree':"))
function harness(){
 const farm=createFarm(),choice=new TreeStorageChoice(),saved:typeof farm[]=[],views:string[]=[]
 let html='',focused:{action:string;id?:number}|undefined,marketContinuation=false
 const currentReturn=()=>{const match=html.match(/data-action="return-nursery-tree" data-value="(\d+)"/);return match?Number(match[1]):undefined}
 const dialogContent={scrollTop:0,querySelector:(query:string)=>{
  if(query.includes('market-trees-return'))return marketContinuation?{focus:()=>{focused={action:'market-trees-return'}},scrollIntoView:()=>{}}:null
  if(query.includes('return-nursery-tree')){const id=currentReturn();return id===undefined?null:{focus:()=>{focused={action:'return-nursery-tree',id}},scrollIntoView:()=>{}}}
  return{focus:()=>{focused={action:'returned-tree'}}}
 }}
 const context:any={farm,treeStorageChoice:choice,treeSlot:0,panel:'tree',storeTree,returnNurseryTree,treeDefinitions,nurseryFruitDetail,treeVariantCopy,storedTreeChoiceLabel,revealTreeStorageReturn,escapeHtml:(s:string)=>s,dialogContent,
  dialog:{open:true},dialogFeedbackTimer:0,dialogFeedback:{classList:{toggle:()=>{}},dataset:{}},window:{clearTimeout:()=>{},setTimeout:()=>0},playBaySound:()=>{},
  saveFarm:()=>saved.push(structuredClone(farm)),refresh:()=>render(),
  button:(label:string,action:string,enabled=true,o:any={})=>`<button data-action="${action}" data-value="${o.value}"${enabled?'':' disabled'}>${label}</button>`,
  row:(_icon:string,name:string,detail:string,action:string)=>`<li><strong>${name}</strong>${detail}${action}</li>`}
 runInNewContext(stripTypeScriptTypes(renderer+'\n'+perform+'\nfunction handle(action:string,value:string){switch(action){'+handlers+'}}'),context)
 function render(){const before=structuredClone(farm);html=context.nurseryCard(context.treeSlot);views.push(html);assert.deepEqual(farm,before);return html}
 function handle(action:string,value:string,slot:number){context.treeSlot=slot;render();context.handle(action,value);assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)}
 return{farm,choice,saved,views,handle,render,currentReturn,get focused(){return focused},get html(){return html},get panel(){return context.panel},set panel(value:string){context.panel=value},set marketContinuation(value:boolean){marketContinuation=value}}
}

test('storing a second earned tree hands the existing Return to that exact new tree, before the saved refresh',()=>{
 const h=harness(),f=h.farm,apple=structuredClone(f.trees.home[0]);assert.ok(buyAndPlantTree(f,1,'pear').ok);assert.equal(f.coins,7)
 const pear=structuredClone(f.trees.home[1]);h.handle('store-tree','0',0)
 assert.equal(h.currentReturn(),1);assert.deepEqual(h.focused,{action:'return-nursery-tree',id:1});assert.equal(h.saved.length,1)
 const before=structuredClone(f),expected=structuredClone(f);assert.ok(storeTree(expected,1).ok)
 h.handle('store-tree','1',1)
 assert.deepEqual(f,expected);assert.deepEqual(h.saved.at(-1),expected);assert.equal(h.saved.length,2)
 assert.equal(h.choice.current(f)?.id,2);assert.equal(h.currentReturn(),2)
 assert.match(h.views.at(-1)!,/<option value="2" selected>Грушевое дерево · №2/)
 assert.deepEqual(h.focused,{action:'return-nursery-tree',id:2})
 h.handle('return-nursery-tree','2',1)
 assert.deepEqual(f.trees.home[1],pear);assert.deepEqual(f.treeNursery,[{id:1,tree:apple}]);assert.equal(h.saved.length,3)
 assert.deepEqual(h.focused,{action:'returned-tree'})
 for(const field of ['coins','saplings','seeds','fruit','produce','variants','beds'] as const)assert.deepEqual(f[field],before[field],field)
 const after=structuredClone(f);h.handle('return-nursery-tree','2',0);assert.deepEqual(f,after);assert.equal(h.saved.length,3)
})

test('manual browsing and failed stores keep their choice; successful storage keeps Market continuation focus priority',()=>{
 const h=harness(),f=h.farm
 assert.ok(buyAndPlantTree(f,1,'pear').ok);assert.ok(buyAndPlantTree(f,2,'apple').ok)
 h.handle('store-tree','0',0);h.handle('store-tree','1',1)
 const before=structuredClone(f),writes=h.saved.length
 assert.ok(h.choice.choose(f,'1'));h.render();h.render()
 assert.equal(h.currentReturn(),1);assert.deepEqual(f,before);assert.equal(h.saved.length,writes)
 h.handle('store-tree','0',0) // Empty source: no save or replacement selection.
 h.handle('store-tree','2',0) // A stale card's slot cannot store a different tree.
 h.panel='orchard';h.handle('store-tree','2',2);h.panel='tree'
 assert.equal(h.choice.current(f)?.id,1);assert.deepEqual(f,before);assert.equal(h.saved.length,writes)
 h.marketContinuation=true
 const expected=structuredClone(f);assert.ok(storeTree(expected,2).ok)
 h.handle('store-tree','2',2)
 assert.deepEqual(f,expected);assert.deepEqual(h.saved.at(-1),expected);assert.equal(h.saved.length,writes+1)
 assert.equal(h.currentReturn(),3);assert.match(h.html,/<option value="3" selected>Яблоня · №3/)
 assert.deepEqual(h.focused,{action:'market-trees-return'})
 const after=structuredClone(f);assert.ok(h.choice.choose(f,'2'));h.render()
 assert.equal(h.currentReturn(),2);assert.deepEqual(f,after);assert.equal(h.saved.length,writes+1)
})
