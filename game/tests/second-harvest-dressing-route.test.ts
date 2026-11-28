import A from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes as strip} from 'node:module'
import {runInNewContext as vm} from 'node:vm'
const root=new URL('../',import.meta.url)
const read=n=>readFileSync(new URL(n,root),'utf8')
const source=n=>import(new URL(n,root))
const [F,G,R,L,T,H]=await Promise.all(['src/farm.ts','src/requirement-guidance.ts','src/ru.ts','tests/fixtures/harbour-craft-return.ts','src/festival-harvest-route.ts','src/harbour-economy.ts'].map(source))
const M=read('src/main.ts'), U=read('src/bay-festival-ui.ts')
const plant='apple', p=L.harbourCraftReturnPlayer().p
const base=[p.actions,p.state.day,p.state.coins,p.state.festivals.completed.harvest]
A.deepEqual(base,[204,25,218,1])
const current=()=>F.getFestivalStatus(p.state).active
const actions=[]
function act(op,...args){p.act(op,...args);actions.push({op,args,day:p.state.day})}
function visit(d){if(d!==p.state.island)act('sail',d)}
function night(){visit('home');act('endDay')}
act('beginFestival','harvest')
act('contributeFestival','fruit','apple');act('contributeFestival','fruit','pear')
visit('home')
const bed=p.state.beds.findIndex(b=>b.kind==='tilled')
A.equal(bed,0)
if(p.state.selectedSeed!=='carrot')act('selectSeed','carrot')
act('workBed',bed,0)
const gathering={}
for(let d=25;d<29;d++){
 if(F.getBedAction(p.state,bed).kind==='water'){
  if(!p.state.water)act('refillWater')
  act('workBed',bed,0)
 }
 if(d===27){visit('grove');const coins=p.state.coins, starts=p.state.saplings.apple;A.ok(starts>=1);act('plantTree',1,plant);gathering.groveInvestment=coins-p.state.coins;gathering.saplingsUsed=starts-p.state.saplings.apple;A.equal(gathering.saplingsUsed,1)}
 if(d===28){visit('cape');let planted=0;for(let i=0;i<3;i++)if(p.state.capeFlowers[i]===null){act('plantCapeFlower',i);planted++}gathering.newCapeFlowers=planted}
 night()
}
A.equal(F.getBedAction(p.state,bed).kind,'harvest')
act('workBed',bed,0)
act('pickFruit',0);A.equal(p.state.fruit.apple,1)
act('sellMarketItem','fruit:apple',1) // use the ordinary apple; its rainbow companion is not sold
visit('village');act('contributeFestival','participation','harvest')
while(current().stage===0){
 const next=current().requirements.find(r=>r.id==='roots').alternatives.find(a=>a.available)
 act('contributeFestival','roots',next.id)
}
night();visit('village')
const f=p.state, baseStock=structuredClone(f)
A.deepEqual([p.actions,f.day,f.coins,f.fruit.apple,f.honey,gathering.groveInvestment],[232,30,222,0,1,0])
const row=current().requirements.find(r=>r.id==='honey')
A.deepEqual([current().edition,current().stage,row.quantity,row.alternatives.map(a=>[a.id,a.quantity,a.available])],[2,1,2,[['honey',1,1],['apple',2,0]]])
A.deepEqual([f.trees.home[0].fruitReady,f.trees.home[0].trait,f.trees.grove[1].fruitReady,f.trees.grove[1].trait],[2,'dew',2,undefined])
A.deepEqual(F.getCapeHoney({...f,island:'cape'}),{available:true,blooms:3,honey:3,windHoney:0})
const clip=(s:string,a:string,b:string)=>{const lo=s.indexOf(a),hi=s.indexOf(b,lo+a.length);A.ok(0<=lo&&lo<hi,a);return s.slice(lo,hi)}
const authored=strip(U.slice(U.indexOf('const escape =')).replace(/^export (?=function )/gm,'').replaceAll('import.meta.env.BASE_URL','"/"')+';renderFestivalPanel(farm,{dressingGrove:getFestivalDressingGrove?.(farm)?.token})')
const render=(farm:F.FarmState)=>vm(authored,{...F,...R,farm,getFestivalDressingGrove:T.getFestivalDressingGrove})
const button=(farm:F.FarmState)=>render(farm).match(/<button[^>]+data-action="festival-source" data-value="(honey\|apple[^"]*)"[^>]*>[\s\S]*?<\/button>/)
const program=strip(clip(M,'async function showRequirement(', '// Scene handlers own material sounds.')
 + `async function tap(action,value,control){switch(action){${clip(M,"    case 'festival-source': {","    case 'festival-activity': {")}}}\n;tap`)
function mount(preview:F.FarmState, attached=true){
 const nav:unknown[]=[],control={closest:()=>null,dataset:{action:'festival-source'}}
 const ctx={...F,...G,...T,farm:preview,panel:'festival',dialog:{open:true},fieldViewButton:{getAttribute:()=> 'false'},
  dialogContent:{contains:(n:unknown)=>attached&&n===control},closeDialog(){ctx.dialog.open=false},
  island:{isCrossing:()=>false,crossIsland:(fn:()=>unknown)=>fn(),focusTarget:(t:unknown)=>nav.push({focus:structuredClone(t)})},
  perform(fn:()=>F.ActionResult){const r=fn();A.ok(r.ok,r.message);nav.push({sail:preview.island});return true},
  openPanel:(x:string)=>nav.push({panel:x}),drawPanel:()=>nav.push('redraw'),notify:()=>{}}
 return {nav,ctx,tap:(value:string)=>vm(program,ctx)('festival-source',value,control)}
}
const ok=(r:F.ActionResult)=>A.ok(r.ok,r.message)

test('earned D30 offers an explicit one-shore route for the exact two ordinary apples, then separate pick and contribution',async()=>{
 const f=structuredClone(baseStock)
 A.equal(render(f).includes('data-value="honey|honey"'),true,'the existing carried honey still has its own control')
 const entry=button(f)!
 A.match(entry[0],/<b>×2<\/b><small>В рощу<\/small>/)
 A.match(M,/dressingGrove:getFestivalDressingGrove\(farm\)\?\.token/)
 A.deepEqual(f,baseStock,'preview and rendering are read-only')
 const x=mount(f);await x.tap(entry[1])
 A.deepEqual(x.nav,[{sail:'grove'},{focus:{kind:'tree',index:1}}])
 A.deepEqual(f,{...baseStock,island:'grove'},'intentional sailing does not gather, consume or pay')
 ok(F.pickFruit(f,1));A.deepEqual([f.fruit.apple,f.honey,f.coins],[2,1,222])
 ok(F.sail(f,'village'))
 ok(F.contributeFestival(f,'honey','apple'));ok(F.contributeFestival(f,'honey','honey'))
 A.deepEqual([f.festivals.active?.stage,f.festivals.active?.readyOn,f.coins,f.trees.home[0]?.trait],[2,31,222,'dew'])
 A.deepEqual(F.restoreCurrentFarm(JSON.parse(JSON.stringify(f))),f)
})

test('Grove route expires after ordinary stock changes; removed controls cannot sail',async()=>{
 const f=structuredClone(baseStock), encoded=button(f)![1]
 A.match(encoded,/^honey\|apple\|grove:/)
 const detached=mount(f,false);await detached.tap(encoded);A.deepEqual(detached.nav,[]);A.deepEqual(f,baseStock)
 ok(F.sail(f,'grove'));ok(F.pickFruit(f,1));ok(H.transferBayGoods(f,'deposit','grove','apple',2));ok(F.sail(f,'village'))
 const before=structuredClone(f), stale=mount(f)
 await stale.tap(encoded);A.deepEqual(stale.nav,['redraw']);A.deepEqual(f,before)
 A.equal(button(f)![1],'honey|apple','two in a remote depot are not misrepresented as ripe Grove apples')
 const pledged=structuredClone(baseStock);ok(F.contributeFestival(pledged,'honey','honey'))
 const state=structuredClone(pledged), afterPledge=mount(pledged)
 await afterPledge.tap(encoded);A.deepEqual(afterPledge.nav,['redraw']);A.deepEqual(pledged,state)
})

test('Home can complete with one ordinary plus an apple already carried; local warehouse and one-of-two shortages stay ordinary',()=>{
 const f=structuredClone(baseStock)
 ok(F.sail(f,'home'));ok(F.pickFruit(f,0));A.equal(f.fruit.apple,1)
 // Dawn replenishes the real Home orchard. One carried plus ripe ordinary is enough.
 ok(F.endDay(f));ok(F.sail(f,'village'))
 A.equal(T.getFestivalDressingGrove?.(f),undefined);A.equal(button(f)![1],'honey|apple')
 const local=structuredClone(baseStock)
 ok(F.sail(local,'grove'));ok(F.pickFruit(local,1));ok(F.sail(local,'village'));ok(H.transferBayGoods(local,'deposit','village','apple',2))
 A.equal(T.getFestivalDressingGrove?.(local),undefined);A.equal(button(local)![1],'honey|apple')
 const depot=structuredClone(baseStock)
 ok(F.sail(depot,'grove'));ok(F.pickFruit(depot,1));ok(F.sail(depot,'home'));ok(H.transferBayGoods(depot,'deposit','home','apple',2))
 ok(F.endDay(depot));A.equal(depot.trees.grove[1]?.fruitReady,2)
 ok(F.sail(depot,'village'))
 A.equal(T.getFestivalDressingGrove?.(depot),undefined);A.equal(button(depot)![1],'honey|apple')
 const one=structuredClone(baseStock)
 ok(F.sail(one,'grove'));ok(F.storeTree(one,1));ok(F.sail(one,'home'));ok(F.storeTree(one,0))
 A.ok(one.treeNursery.at(-1)?.tree.trait==='dew')
 ok(F.sail(one,'grove'));ok(F.returnNurseryTree(one,1,one.treeNursery.at(-1)!.id))
 ok(F.sail(one,'village'));A.equal(one.fruit.apple,0)
 A.equal(T.getFestivalDressingGrove?.(one),undefined);A.equal(button(one)![1],'honey|apple')
})
