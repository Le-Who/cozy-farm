import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as F from '../src/farm.ts'
import { transferBayGoods } from '../src/harbour-economy.ts'
import { getDiscoveryTask, getSupplyGuidance } from '../src/discovery-path.ts'
import { getDiscoveryJournal } from '../src/discovery-journal.ts'
import { getGuidanceTask } from '../src/discovery-guidance.ts'
import { chooseDiscoveryIdea, setDiscoveryPace, resumeDiscoveryIdea } from '../src/discovery-preferences.ts'
import { renderDiscoveryGuidance } from '../src/discovery-preferences-ui.ts'

const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
const commands={...F,transferBayGoods} as Record<string,Function>
const text=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),source=ts.createSourceFile('main.ts',text,ts.ScriptTarget.Latest,true)
let journal:ts.CaseClause,follow:ts.IfStatement,orientation:ts.IfStatement
function visit(node:ts.Node){
 if(ts.isCaseClause(node)&&node.expression.getText(source)==="'journal'")journal=node
 if(ts.isIfStatement(node)&&node.expression.getText(source)==="action === 'follow-task'")follow=node
 if(ts.isIfStatement(node)&&node.expression.getText(source)==="next === 'archive' || next === 'boat'")orientation=node
 ts.forEachChild(node,visit)
}
visit(source)
const js=(code:string)=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
function reload(farm:F.FarmState){const restored=F.restoreFarm(JSON.parse(JSON.stringify(farm)));assert.ok(restored);assert.deepEqual(restored,farm);return restored}
function earned(count=20){
 let farm=F.createFarm()
 for(const {name,args} of opening.slice(0,count)){const result=commands[name](farm,...args);assert.ok(result.ok,`${name}: ${result.message}`);farm=reload(farm)}
 // The two previously visited UI panels use their actual main.ts orientation branch, not goods/unlock grants.
 for(const next of ['archive','boat'])vm.runInNewContext(js(orientation.getText(source)),{farm,next,saveFarm(){},status(){}})
 return reload(farm)
}
function choose(farm:F.FarmState){const next=getDiscoveryTask(farm,farm.orientation)!;assert.ok(chooseDiscoveryIdea(farm.discoveryPreferences,next,next.id));return next}
function browse(farm:F.FarmState){
 const before=JSON.stringify(farm),dialogContent={innerHTML:''};let writes=0
 const currentTask=()=>getGuidanceTask(farm.discoveryPreferences,getDiscoveryTask(farm,farm.orientation))
 vm.runInNewContext(js(`switch('journal'){${journal.getText(source)}}`),{farm,currentTask,getDiscoveryJournal,getDiscoveryTask,renderDiscoveryGuidance,dialogContent,journalDetailsOpen:false,
  renderFerryReturn:()=>'',harbourGoods:()=>[],icon:(v:string)=>`<i>${v}</i>`,row:()=>'',getFishLimit:F.getFishLimit,saveFarm:()=>writes++})
 assert.equal(JSON.stringify(farm),before);assert.equal(writes,0)
 return {html:dialogContent.innerHTML,currentTask}
}
function followCurrent(farm:F.FarmState){const before=JSON.stringify(farm),calls:string[]=[];const context={action:'follow-task',value:undefined as string|undefined,currentTask:()=>getGuidanceTask(farm.discoveryPreferences,getDiscoveryTask(farm,farm.orientation)),openPanel:(v:string)=>calls.push(v)}
 vm.runInNewContext(js(`(()=>{${follow.getText(source)}})()`),context);assert.equal(JSON.stringify(farm),before);return{action:context.action,value:context.value,calls}
}

test('earned selected dock resumes after explicit Home sleep/reload using fresh travel then local project action',()=>{
 let farm=earned();assert.equal(farm.day,2);assert.equal(farm.coins,23);assert.equal(farm.fruit.pear,2)
 assert.equal(choose(farm).id,'dock');const selected=structuredClone(farm.discoveryPreferences.idea),project=structuredClone(farm.projects.dock)
 assert.ok(F.sail(farm,'home').ok);assert.ok(F.endDay(farm).ok);farm=reload(farm)
 assert.equal(farm.day,3);assert.deepEqual(farm.projects.dock,project);assert.equal(farm.fruit.pear,2)
 for(let i=0;i<3;i++){const {html}=browse(farm);assert.match(html,/data-action="follow-task"/);assert.match(html,/>В рощу<\/button>/);assert.doesNotMatch(html,/Это сохранённая запись|discovery-pin/)}
 assert.deepEqual(followCurrent(farm),{action:'sail',value:'grove',calls:[]})
 assert.equal(farm.island,'home','browsing and resolving do not execute travel')
 assert.ok(F.sail(farm,'grove').ok);farm=reload(farm)
 assert.match(browse(farm).html,/>Припасы для причала<\/button>/)
 assert.deepEqual(followCurrent(farm),{action:'project-dock',value:undefined,calls:[]})
 assert.deepEqual(farm.projects.dock,project,'no implicit delivery');assert.deepEqual(farm.discoveryPreferences.idea,selected)
 assert.deepEqual(Object.keys(selected!).sort(),['detail','id','label'],'no executable or scope field persisted')
})

test('legacy Home grove bookmark keeps the exact unfinished dock supply step after arrival and quiet resume',()=>{
 let farm=earned(19);assert.equal(choose(farm).id,'grove');const saved=structuredClone(farm.discoveryPreferences.idea)
 setDiscoveryPace(farm.discoveryPreferences,true);assert.ok(F.endDay(farm).ok);assert.ok(F.sail(farm,'grove').ok);farm=reload(farm)
 const quiet=browse(farm).html;assert.match(quiet,/Вернуться к задумке/);assert.doesNotMatch(quiet,/data-action="follow-task"/)
 assert.equal(farm.discoveryPreferences.quiet,true);assert.ok(resumeDiscoveryIdea(farm.discoveryPreferences))
 assert.deepEqual(followCurrent(farm),{action:'project-dock',value:undefined,calls:[]});assert.deepEqual(farm.discoveryPreferences.idea,saved)
})

test('depleted supplies and genuinely completed dock retire the old bookmark without replaying delivery',()=>{
 let farm=earned();choose(farm);const saved=structuredClone(farm.discoveryPreferences.idea)
 for(let i=20;i<29;i++){const a=opening[i];assert.ok(commands[a.name](farm,...a.args).ok);farm=reload(farm)
  if(i===20){const current=getDiscoveryTask(farm,farm.orientation)!;assert.notEqual(current.id,'dock');assert.equal(getGuidanceTask(farm.discoveryPreferences,current)?.bookmarkOnly,true);assert.match(browse(farm).html,/Это сохранённая запись/)}
 }
 assert.ok(F.isProjectComplete(farm,'dock'));assert.deepEqual(farm.discoveryPreferences.idea,saved)
 assert.deepEqual(followCurrent(farm),{action:'open-panel',value:'journal',calls:[]});assert.doesNotMatch(browse(farm).html,/data-action="follow-task"/)
})

test('an unrelated Grove fruit aim or a later untyped Grove route does not inherit dock resumption',()=>{
 const farm=earned(14),fruit=getSupplyGuidance(farm,{kind:'fruit',item:'pear',quantity:1},'знакомство с Солёной рощей')
 assert.deepEqual(fruit.action,{label:'В рощу',target:'sail',value:'grove'})
 assert.ok(chooseDiscoveryIdea(farm.discoveryPreferences,fruit,fruit.id));const dock=earned(),current=getDiscoveryTask(dock,dock.orientation)!
 assert.equal(getGuidanceTask(farm.discoveryPreferences,current)?.bookmarkOnly,true)
 choose(dock)
 const unrelated={...fruit,id:'grove'}
 assert.equal(getGuidanceTask(dock.discoveryPreferences,unrelated)?.bookmarkOnly,true,'id and same destination alone are not the dock scope')
 assert.doesNotMatch(renderDiscoveryGuidance(dock.discoveryPreferences,unrelated).focus,/follow-task/)
})

test('saved action/reward metadata never becomes executable even for a known legacy dock id',()=>{
 const farm=earned(19),saved=JSON.parse(JSON.stringify(farm));saved.discoveryPreferences={quiet:false,idea:{id:'dock',label:'Old dock',detail:'Old record',action:{target:'deliver-project',value:'dock'},reward:999,bookmarkScope:'dock-supplies'}}
 const restored=F.restoreFarm(saved)!;assert.ok(restored);assert.deepEqual(Object.keys(restored.discoveryPreferences.idea!).sort(),['detail','id','label'])
 assert.deepEqual(followCurrent(restored),{action:'sail',value:'grove',calls:[]});assert.equal(restored.coins,23)
})
