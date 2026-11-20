import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {createFarm,getArchive,workBed} from '../src/farm.ts'
import {getDiscoveryTask} from '../src/discovery-path.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const start=main.indexOf("  if (action === 'follow-task') {"),end=main.indexOf('  switch (action) {',start)
const generic=main.split('\n').find(line=>line.startsWith("    case 'open-panel':"))!
const enter=stripTypeScriptTypes('(()=>{'+main.slice(start,end)+'switch(action){'+generic+'}})()')

test('the advertised first harvest opens its earned series; other entry points keep ordinary browsing',()=>{
 const farm=createFarm();assert.ok(workBed(farm,15).ok)
 const task=getDiscoveryTask(farm,farm.orientation)!
 assert.equal(task.id,'collections')
 const groups=getArchive(farm,'crops')
 assert.equal(groups.findIndex(series=>series.items.some(item=>item.discovered)),6)
 function follow(action:string,hasFind:boolean,selectedTask=task){
   const calls:string[]=[],heading={id:'leafyGreens'}
   const group={querySelector:(selector:string)=>selector==='.archive-series-name'?heading:null}
   const slot={closest:(selector:string)=>selector==='.archive-series'?group:null}
   const ctx={action,value:action==='open-panel'?'archive':undefined,farm,panel:'field',dialog:{open:false},panelTitles:{archive:'Коллекции'},
     currentTask:()=>selectedTask,openPanel(next:string){calls.push(next);ctx.panel=next;ctx.dialog.open=true},
     dialogContent:{querySelector:(selector:string)=>selector==='.archive-slot[data-discovered="true"]'&&hasFind?slot:null},
     highlightControl:(node:typeof heading|null)=>{if(node)calls.push(node.id)}}
   runInNewContext(enter,ctx);return calls
 }
 const before=structuredClone(farm)
 assert.deepEqual(follow('follow-task',true),['archive','leafyGreens'])
 assert.deepEqual(follow('follow-task',false),['archive'])
 assert.deepEqual(follow('open-panel',true),['archive'])
 assert.deepEqual(farm,before)
})
