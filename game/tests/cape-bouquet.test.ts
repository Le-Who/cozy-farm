import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {commissionPlayer} from './fixtures/commission-player.ts'
import {collectCapeHoney,cutCapeBouquet,endDay,getCapeBloom,getCapeBouquetPreview,getCapeHoney,getCapeUpgrade,getCapeWax,restoreCurrentFarm,sail} from '../src/farm.ts'
import {getApiaryCopy} from '../src/apiary-preview.ts'
import {getWindHoneySource} from '../src/wind-honey-guidance.ts'
import {isGuardedAction} from '../src/action-click-guard.ts'

const actions=JSON.parse(readFileSync(new URL('./fixtures/market-order-selection-commands.json',import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
const opening=actions.slice(0,actions.findIndex(a=>a.name==='collectCapeHoney'))
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const branch=(a:string,b:string)=>main.slice(main.indexOf(a),main.indexOf(b,main.indexOf(a)))
const show=stripTypeScriptTypes("switch('hive'){"+branch("    case 'hive': {","    case 'cape-upgrade': {")+"}")
const click=stripTypeScriptTypes("switch('cape-bouquet'){"+branch("    case 'cape-bouquet': {","    case 'collect-honey':")+"}")
const capesrc=readFileSync(new URL('../src/island.ts',import.meta.url),'utf8')
const work=stripTypeScriptTypes('({'+capesrc.slice(capesrc.indexOf('    workCape('),capesrc.indexOf('    async crossIsland('))+'})')

test('earned day four: compare three-honey harvest with the selected flowering bed, clipped physically at arrival exactly once',()=>{
 const p=commissionPlayer(opening);assert.equal(p.actions,36);const f=p.state, ordinary=structuredClone(f)
 assert.equal(f.day,4);assert.equal(f.island,'cape');assert.equal(collectCapeHoney(ordinary).ok,true);assert.equal(ordinary.honey,3)
 assert.equal(getCapeBouquetPreview(ordinary,1),undefined,'cannot take the same nectar after collection')
 const dialogContent={innerHTML:''},ui={farm:f,hiveFlower:undefined as number|undefined,getApiaryCopy,getCapeBouquetPreview,getWindHoneySource,getCapeUpgrade,
  dialogTitle:{textContent:'',setAttribute(){}},dialogContent,nav:(...parts:string[])=>parts.join(''),row:()=>'',button:(label:string,id:string,_enabled:boolean,o?:{value?:string})=>`<button data-action="${id}" data-value="${o?.value??''}">${label}</button>`}
 runInNewContext(show,ui);assert.doesNotMatch(dialogContent.innerHTML,/cape-bouquet/);assert.match(dialogContent.innerHTML,/collect-honey/)
 const siteHandler=main.indexOf("  if (target.kind === 'flower') {",main.indexOf('function activateTarget('))
 const visit=main.slice(siteHandler,main.indexOf("\n  if (target.kind",siteHandler+35))
 let walked=false
 runInNewContext(stripTypeScriptTypes('(function(){'+visit+'})()'),{farm:f,target:{kind:'flower',index:1},getCapeBloom,
  island:{visit(t:{index:number}){walked=t.index===1}},openPanel:(name:string,_r:boolean,_i:string,_c:unknown,_t:unknown,entry:{hiveFlower:number})=>{assert.equal(name,'hive');ui.hiveFlower=entry.hiveFlower}})
 assert.ok(walked);runInNewContext(show,ui)
 const value=dialogContent.innerHTML.match(/data-action="cape-bouquet" data-value="([^"]+)">Срезать букет · мёд 3 → 2/)?.[1]
 assert.ok(value);assert.ok(isGuardedAction('cape-bouquet'));assert.match(dialogContent.innerHTML,/collect-honey/)
 const wait={state:f,crossing:false,world:{available:true},capeWork:undefined as undefined|{commit:()=>boolean},motion:{matches:false},sameTarget:(a:{kind:string;index:number},b:typeof a)=>a.kind===b.kind&&a.index===b.index,
  currentSites:()=>[{target:{kind:'flower',index:1},stop:{x:779,y:513}}],moveTo:(stop:unknown)=>assert.deepEqual(stop,{x:779,y:513})}
 let closes=0;const ctx={...ui,value,panel:'hive',closeDialog:()=>{closes++},island:runInNewContext(work,wait),cutCapeBouquet,perform:(a:()=>{ok:boolean})=>a().ok}
 const start=structuredClone(f);runInNewContext(click,{...ctx,value:'old'});assert.equal(closes,0)
 runInNewContext(click,ctx);assert.equal(closes,1);assert.deepEqual(f,start,'review and approach do not debit or pick anything')
 assert.ok(wait.capeWork?.commit());assert.deepEqual(f,{...start,capeBouquet:{day:f.day,bed:1}})
 assert.equal(wait.capeWork.commit(),false);assert.equal(getCapeBloom(f,1),'growing');assert.equal(getCapeBloom(f,0),'bloom');assert.equal(getCapeBouquetPreview(f,2),undefined)
 runInNewContext(show,ui);assert.doesNotMatch(dialogContent.innerHTML,/cape-bouquet/);assert.ok(getCapeHoney(f).available);assert.equal(collectCapeHoney(f).ok,true);assert.equal(f.honey,2);assert.equal(collectCapeHoney(f).ok,false)
 assert.ok(sail(f,'home').ok);const reloaded=restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!;assert.deepEqual(reloaded,f)
 assert.ok(endDay(reloaded).ok);assert.equal(reloaded.capeBouquet,undefined);assert.deepEqual(reloaded.capeFlowers,start.capeFlowers)
 assert.ok(sail(reloaded,'cape').ok);assert.equal(getCapeHoney(reloaded).honey,3);assert.equal(getCapeBloom(reloaded,1),'bloom')
 assert.equal(cutCapeBouquet(reloaded,1,value).ok,false);assert.ok(getCapeBouquetPreview(reloaded,1))
})

test('quote uses actual yield, no guessed rewards: last wind blossom; established full apiary loses its full-meadow bonus, not its wax',()=>{
 const one=commissionPlayer(opening.filter(a=>a.name!=='plantCapeFlower'||a.args[0]===0)).state
 for(;one.day<8;){assert.ok(sail(one,'home').ok);assert.ok(endDay(one).ok);assert.ok(sail(one,'cape').ok)}
 const last=getCapeBouquetPreview(one,0)!;assert.equal(last.cost,'мёд ветров 1 → 0');assert.ok(cutCapeBouquet(one,0,last.token).ok)
 assert.equal(getCapeHoney(one).available,false);assert.equal(getApiaryCopy(one).harvest?.windHoney,0);assert.equal(collectCapeHoney(one).ok,false)
 // Earn the existing upgrade price by selling actual owned goods rather than granting coins.
 const p=commissionPlayer(opening);p.act('collectCapeHoney');p.visit('home');p.act('sellProduce')
 for(let n=0;p.state.coins<48;n++){assert.ok(n<20);p.night();p.act('pickFruit',0);p.act('sellProduce')}
 p.night();p.visit('cape');p.act('collectCapeHoney');if(p.state.honey<3){p.night();p.visit('cape');p.act('collectCapeHoney')}
 assert.ok(p.state.honey>=3);p.act('upgradeCape');p.night();p.visit('cape')
 const apiary=p.state, before=getCapeHoney(apiary),quote=getCapeBouquetPreview(apiary,1)!
 assert.ok(cutCapeBouquet(apiary,1,quote.token).ok);assert.equal(getCapeWax(apiary),1);assert.equal(getCapeHoney(apiary).honey,before.honey-2);assert.ok(restoreCurrentFarm(structuredClone(apiary)))
})
