import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import * as F from '../src/farm.ts'
import { getDiscoveryTask } from '../src/discovery-path.ts'
import { getGuidanceTask } from '../src/discovery-guidance.ts'
import { chooseDiscoveryIdea } from '../src/discovery-preferences.ts'
import { getIslandJourneys } from '../src/journey.ts'
import { renderRestPreview } from '../src/rest-preview-ui.ts'
import { quoteExpedition } from '../src/ferry-expeditions.ts'
import { expeditionWallet } from '../src/harbour-economy.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const tape=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
const text=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'), ast=ts.createSourceFile('main.ts',text,ts.ScriptTarget.Latest,true)
const nodes:Record<string,ts.IfStatement>={}
function visit(node:ts.Node) {
 if(ts.isIfStatement(node)) {
  const expr=node.expression.getText(ast)
  if(expr==="next === 'archive' || next === 'boat'")nodes.orient=node
  if(expr==="action === 'follow-task'")nodes.follow=node
  if(expr.startsWith("next === 'kitchen' && (") && node.getText(ast).includes('guidedFrom'))nodes.jam=node
 }
 ts.forEachChild(node,visit)
}
visit(ast);assert.deepEqual(Object.keys(nodes).sort(),['follow','jam','orient'])
const orientation=(f:F.FarmState)=>{
 for(const next of ['archive','boat'])runInNewContext(stripTypeScriptTypes(nodes.orient.getText(ast)),{farm:f,next,saveFarm(){},status(){}})
}
function earned(withSalt=false) {
 const p=commissionPlayer(tape.slice(0,15))
 assert.deepEqual([p.state.day,p.state.island,p.state.coins],[2,'grove',22])
 orientation(p.state);p.reload()
 p.act('collectShell',0);p.act('changeCove',{cover:'kelp'})
 p.act('pickFruit',0);if(withSalt)p.act('gatherSeaSalt')
 p.visit('home');p.act('deliverMarketOrder','garden');p.act('upgradeBuilding','farmhouse')
 assert.deepEqual([p.state.day,p.state.island,p.state.coins,p.state.fruit.pear,p.state.fruit.apple],[2,'home',23,2,0])
 return p
}
const task=(f:F.FarmState)=>getDiscoveryTask(f,f.orientation)!
const rest={label:'К отдыху дома',target:'visit-rest'}
const tree={label:'К плодовому дереву',target:'visit-tree',value:'0'}
const kitchen={label:'На кухню',target:'kitchen',value:'appleJam'}
const sail={label:'В рощу',target:'sail',value:'grove'}
const dock={label:'Припасы для причала',target:'project-dock'}

function select(f:F.FarmState,action:typeof rest|typeof tree|typeof kitchen) {
 const before=structuredClone(f), t=task(f)
 assert.deepEqual(t.action,action)
 const events:unknown[][]=[]
 const ctx={
  ...F,farm:f,action:'follow-task',value:undefined,currentTask:()=>getGuidanceTask(f.discoveryPreferences,t),
  panel:'journal',kitchenGroup:'tart',openPanel(...args:unknown[]){events.push(args)},
  island:{visit(target:unknown){events.push(['visit',target])}},dispatch:undefined,
 }
 // Execute the actual recommendation resolver; when it opens a kitchen, also run its real guided-ready selection clause.
 const resolved=runInNewContext(stripTypeScriptTypes(`(()=>{${nodes.follow.getText(ast)}return {action,value}})()`),ctx)
 if(action!==kitchen)assert.deepEqual({...resolved},{action:action.target,value:'value' in action?action.value:undefined})
 if(action===kitchen) {
  assert.deepEqual(JSON.parse(JSON.stringify(events)),[['visit',{kind:'kitchen'}],['kitchen',true,'home','page.unfold','appleJam']])
  runInNewContext(stripTypeScriptTypes(nodes.jam.getText(ast)),Object.assign(ctx,{next:'kitchen',recipeTarget:'appleJam'}))
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.kitchenGroup)),{ready:'appleJam',guidedFrom:'tart'})
 }
 assert.deepEqual(f,before)
 return events.length
}

test('first Dock Home guidance waits, points to the ripe apple, then opens the exact recipe, without a round trip or automatic commitment',()=>{
 const p=earned(true)
 assert.equal(p.actions,22,'real first arrival gathers both needed materials before returning Home')
 assert.equal(F.getCoveActions(p.state).forecast?.day,3)
 assert.match(renderRestPreview(p.state,true),/Яблоки к утру · ×2/)
 assert.deepEqual([p.state.fruit.pear,p.state.seaSalt,p.state.dishes.appleJam],[2,2,0])
 assert.equal(select(p.state,rest),0)
 // Even while the journal helps locally, the ordinary Grove map route remains selectable.
 assert.equal(getIslandJourneys(p.state).find(row=>row.id==='grove')?.nextAction?.target,'sail')
 p.act('endDay')
 assert.equal(F.getCoveActions(p.state).phase,'settled')
 assert.equal(select(p.state,tree),0)
 p.act('pickFruit',0);assert.equal(select(p.state,kitchen),2)
 assert.deepEqual([p.state.day,p.state.coins,p.state.fruit.apple,p.state.dishes.appleJam],[3,23,2,0])
 p.act('cookDish','appleJam')
 assert.deepEqual(task(p.state).action,sail)
 p.visit('grove');assert.deepEqual(task(p.state).action,dock)
 p.act('deliverProject','dock')
 assert.deepEqual([p.state.day,p.state.coins,F.canSailTo(p.state,'cape')],[3,78,true])
})

test('same-day funded jar, partial Grove, and an exact available Grove warehouse jar remain legitimate alternatives',()=>{
 const early=commissionPlayer([])
 for(const i of [2,3,4])early.act('workBed',i,0)
 early.act('deliverMarketOrder','garden');early.act('upgradeBuilding','farmhouse');early.act('pickFruit',0)
 early.act('cookDish','appleJam');early.act('sellMarketItem','produce:tomato',1);early.act('buyBoat')
 orientation(early.state);early.reload()
 early.visit('grove');early.act('pickFruit',0);early.act('gatherSeaSalt');early.visit('home')
 assert.deepEqual(task(early.state).action,sail)
 early.visit('grove');early.act('deliverProject','dock');assert.equal(early.state.day,1);assert.ok(F.canSailTo(early.state,'cape'))

 const p=earned()
 assert.deepEqual(task(p.state).action,sail,'true incomplete: pear alone does not override a Grove trip that brings real salt')
 const bookmark=task(p.state)
 assert.ok(chooseDiscoveryIdea(p.state.discoveryPreferences,bookmark,bookmark.id));p.reload()
 p.visit('grove');p.act('gatherSeaSalt')
 assert.deepEqual(task(p.state).action,dock,'local partial hand-in is still offered')
 const q=quoteExpedition(p.state.freight.expeditions,'orchard-apples',expeditionWallet(p.state))!
 assert.equal(q.available,false);assert.match(q.reason,/Сначала разведайте/)
 p.visit('home')
 const current=getGuidanceTask(p.state.discoveryPreferences,task(p.state))
 assert.equal(current?.bookmarkOnly,undefined)
 // Preserve the original saved dock identity, not an executable command.
 assert.deepEqual(Object.keys(p.state.discoveryPreferences.idea!).sort(),['detail','id','label'])
 p.night();p.act('pickFruit',0);p.act('cookDish','appleJam');p.visit('grove');p.act('transferBayGoods','deposit','grove','dish:appleJam',1);p.visit('home')
 assert.deepEqual([p.state.dishes.appleJam,p.state.freight.warehouses.grove['dish:appleJam']],[0,1])
 assert.deepEqual(task(p.state).action,sail,'never prioritize waiting/cooking over an exact already available local-to-Dock jar')
 p.visit('grove');p.act('transferBayGoods','withdraw','grove','dish:appleJam',1);p.act('deliverProject','dock')
 assert.deepEqual([p.state.day,p.state.coins,F.canSailTo(p.state,'cape')],[3,78,true])
})
