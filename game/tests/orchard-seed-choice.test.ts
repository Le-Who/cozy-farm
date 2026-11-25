import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { nightsToFruit, nurseryFruitDetail } from '../src/orchard-guidance.ts'
import assert from 'node:assert/strict'
import * as F from '../src/farm.ts'
import { harbourTradePlayer } from './fixtures/harbour-trade-player.ts'
const actions=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
export function ownOrchardStart() {
 const p=harbourTradePlayer(actions);p.build('mill-buy');p.twoHomes()
 p.visit('grove');p.act('pickFruit',0);p.visit('home')
 assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.fruit.pear,p.state.variants.pear?.rainbow],[109,17,1,1,1])
 return p
}
test('an earned home orchard can start a second pear tree without selling its reserve or moving the existing tree',()=>{
 const p=ownOrchardStart(), f=p.state
 const start=structuredClone(f)
 assert.equal(F.buyAndPlantTree(f,1,'pear').ok,false)
 assert.deepEqual(f,start)
 const offer=F.getFruitTreeSeed?.(f,1,'pear')
 assert.ok(offer,'an ordinary pear may buy time instead of coins or relocating the old tree')
 assert.equal(offer.nights,4)
})

test('same earned orchard: sown home pear costs one ordinary pear and an extra night, without giving up the Grove tree',()=>{
 const seed=ownOrchardStart(), bought=ownOrchardStart(), moved=ownOrchardStart()
 assert.deepEqual(seed.state,bought.state)
 assert.deepEqual(seed.state,moved.state)
 const initial=structuredClone(seed.state), offer=F.getFruitTreeSeed(seed.state,1,'pear')!
 assert.deepEqual(seed.state,initial,'review is read-only')
 seed.act('plantFruitTreeSeed',1,offer.token)
 assert.deepEqual(seed.state.trees.home[1],{tree:'pear',age:0,fruitReady:0,sprouting:true})
 assert.deepEqual(seed.state.trees.grove,initial.trees.grove)
 assert.equal(seed.state.fruit.pear,0)
 assert.equal(seed.state.variants.pear?.rainbow,1)
 assert.equal(seed.state.coins,1)
 assert.equal(seed.state.produce.tomato,2)
 assert.match(F.getTreeAction(seed.state,1).label,/4 ночи/)
 bought.act('sellMarketItem','produce:tomato',2)
 bought.act('buyAndPlantTree',1,'pear')
 assert.equal(bought.state.coins,2);assert.equal(bought.state.produce.tomato,0)
 moved.visit('grove');moved.act('storeTree',0);moved.visit('home')
 moved.act('returnNurseryTree',1,moved.state.treeNurserySerial)
 assert.equal(moved.state.trees.grove[0],null)
 seed.night();bought.night();moved.night()
 assert.equal(F.getTreeAction(moved.state,1).kind,'pick');moved.act('pickFruit',1)
 assert.equal(seed.state.trees.home[1]?.age,0)
 assert.equal(seed.state.trees.home[1]?.sprouting,undefined)
 for(let i=0;i<2;i++){seed.night();bought.night()}
 assert.equal(seed.state.day,20)
 assert.equal(F.getTreeAction(seed.state,1).kind,'wait')
 assert.equal(F.getTreeAction(bought.state,1).kind,'pick');bought.act('pickFruit',1)
 seed.night()
 assert.equal(seed.state.day,21)
 seed.act('pickFruit',1)
 assert.ok(seed.state.fruit.pear>0)
 assert.equal(seed.state.trees.grove[0]?.tree,'pear')
 assert.ok(seed.state.trees.grove[0]?.fruitReady)
 seed.act('pickFruit',0)
 const result=seed.act('completeSignature',
   {base:'preserves',ingredients:[{id:'apple',quantity:1},{id:'pear',quantity:1}]},
   {family:'preserves',processing:'silky',fruit:[],steps:['mix','pour']})
 assert.equal(seed.state.culinary.stock[String(result.recipeId)],1,'the first local fruit already supplies an existing recipe')
 console.log(JSON.stringify({buyFirst:20,moveFirst:18,seedFirst:21,seedSpends:'ordinary pear',coins:1,tomatoesKept:2,groveTreeKept:true}))
})

test('the prepared seed night survives save/store/travel and resumes only when the tree is replanted',()=>{
 const p=ownOrchardStart()
 const offer=F.getFruitTreeSeed(p.state,1,'pear')!
 p.act('plantFruitTreeSeed',1,offer.token);p.act('storeTree',1)
 const id=p.state.treeNurserySerial, snapshot=structuredClone(p.state.treeNursery)
 assert.match(nurseryFruitDetail(snapshot[0].tree),/4 ночи/)
 p.night();p.night()
 assert.deepEqual(p.state.treeNursery,snapshot)
 p.visit('grove');p.act('returnNurseryTree',1,id)
 assert.equal(nightsToFruit(p.state.trees.grove[1]!),4)
 p.night()
 for(let elapsed=1;elapsed<4;elapsed++){
   assert.equal(nightsToFruit(p.state.trees.grove[1]!),4-elapsed)
   assert.equal(p.state.trees.grove[1]?.fruitReady,0)
   p.night()
 }
 p.visit('grove');p.act('pickFruit',1)
 assert.equal(p.state.treeNursery.length,0)
 const bad=structuredClone(p.state)
 bad.trees.grove[1]!.sprouting=true
 assert.equal(F.restoreCurrentFarm(bad),undefined,'an already mature tree cannot be reconstructed with a pending seed night')
})

test('existing owned sapling or stored mature tree wins; a stale button, rare-only stock and pre-harbour state spend nothing',()=>{
 const p=ownOrchardStart(), f=p.state
 assert.ok(F.getFruitTreeSeed(f,1,'pear'))
 assert.equal(F.getFruitTreeSeed(f,0,'pear'),undefined,'occupied slot')
 assert.equal(F.getFruitTreeSeed(F.createFarm(),1,'apple'),undefined)
 assert.equal(F.getFruitTreeSeed(f,1,'apple'),undefined,'owned apple sapling should remain the visible free route')
 const before=structuredClone(f), quote=F.getFruitTreeSeed(f,1,'pear')!
 assert.equal(F.plantFruitTreeSeed(f,2,quote.token).ok,false)
 assert.deepEqual(f,before)
 p.act('sellMarketItem','fruit:pear',1)
 const noOrdinary=structuredClone(p.state)
 assert.equal(p.state.variants.pear?.rainbow,1)
 assert.equal(F.getFruitTreeSeed(p.state,1,'pear'),undefined)
 assert.equal(F.plantFruitTreeSeed(p.state,1,quote.token).ok,false)
 assert.deepEqual(p.state,noOrdinary)
 const stored=ownOrchardStart()
 stored.visit('grove');stored.act('storeTree',0);stored.visit('home')
 assert.equal(F.getFruitTreeSeed(stored.state,1,'pear'),undefined,'use the available free stored tree before showing a redundant fruit cost')
 stored.act('returnNurseryTree',1,stored.state.treeNurserySerial)
 assert.equal(stored.state.trees.home[1]?.tree,'pear')
 const ample=ownOrchardStart()
 ample.act('sellMarketItem','produce:tomato',2);ample.act('buySapling','pear')
 assert.equal(F.getFruitTreeSeed(ample.state,1,'pear'),undefined,'use the already owned sapling')
 ample.act('plantTree',1,'pear')
 assert.equal(ample.state.trees.home[1]?.sprouting,undefined)
})

test('actual empty-plot entry shows both prices with a single spend and sends focus to neutral time remaining',()=>{
 const p=ownOrchardStart(), farm=p.state
 const main=readFileSync(new URL('../src/main.ts', import.meta.url),'utf8')
 const start=main.indexOf('<div class="sapling-options">${treeIds.map(tree=>{')
 const end=main.indexOf('.join(\'\')}</div>`',start)
 assert.ok(start>=0&&end>start)
 const html=runInNewContext(stripTypeScriptTypes('`'+main.slice(start,end+'.join(\'\')}</div>`'.length)),{
  farm,treeSlot:1,treeIds:F.treeIds,treeDefinitions:F.treeDefinitions,getFruitTreeSeed:F.getFruitTreeSeed,
  icon:(name:string)=>`<img src="${name}">`,quantity:(n:number)=>n+' ночи',
  button:(label:string,action:string,enabled:boolean,o:{value:number|string})=>`<button data-action="${action}" data-value="${o.value}"${enabled?'':' disabled'}>${label}</button>`,
 }) as string
 const pearl=html.match(/Грушевое дерево<\/h2>.*?<\/article>/)?.[0]??''
 assert.match(pearl,/До зрелости: 3 ночи/)
 assert.match(pearl,/data-action="buy-plant-tree" data-value="pear" disabled/)
 const chosen=pearl.match(/data-action="fruit-tree-seed" data-value="([^"]+)"[^>]*>Из 1 груши · 4 ночи/)
 assert.ok(chosen)
 assert.equal((html.match(/data-action="fruit-tree-seed"/g)??[]).length,1)
 assert.equal(isGuardedAction('fruit-tree-seed'),true)
 const i=main.indexOf("    case 'fruit-tree-seed':"),j=main.indexOf("    case 'buy-plant-tree':",i)
 assert.ok(i>=0&&j>i)
 const action=stripTypeScriptTypes("switch(action){"+main.slice(i,j)+"}")
 const control={}, events:string[]=[]
 const dispatch=(panel:string,slot:number,open=true,attached=true)=>runInNewContext(action,{
  farm, action:'fruit-tree-seed',panel,treeSlot:slot,value:chosen[1],control,dialog:{open},
  perform:(fn:()=>F.ActionResult)=>fn().ok,plantFruitTreeSeed:F.plantFruitTreeSeed,
  dialogContent:{contains:(c:unknown)=>attached&&c===control,querySelector:(q:string)=>{
   assert.equal(q,'[data-tree-remaining]');return {focus:()=>events.push('focus')}
  }},playBaySound:(s:string)=>events.push(s),
 })
 const snapshot=structuredClone(farm)
 dispatch('market',1);dispatch('tree',1,false);dispatch('tree',1,true,false);dispatch('tree',2)
 assert.deepEqual(farm,snapshot)
 dispatch('tree',1);dispatch('tree',1)
 assert.equal(farm.fruit.pear,0)
 assert.deepEqual(events,['orchard.sapling','focus'])
 assert.match(main,/[<]strong data-tree-remaining tabindex="-1"/)
})
