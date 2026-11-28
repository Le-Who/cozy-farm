import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import test from 'node:test'
import * as F from '../src/farm.ts'
import * as P from '../src/garden-plans.ts'
import * as W from '../src/bed-work-intent.ts'
import * as S from '../src/seed-choice.ts'
import {renderSeedPicker} from '../src/seed-picker-ui.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const exact=(a:string,b:string)=>{const i=main.indexOf(a),j=main.indexOf(b,i+1);assert.ok(i>=0&&j>i,[a,b]);return main.slice(i,j)}
const route=stripTypeScriptTypes(exact('function requestSeedChoice(','  island.visit(target)\n  switch')+'}\n'
  + 'function confirmSeed(value){switch("choose-seed"){'+exact("    case 'choose-seed':","    case 'review-harvest-sale':")+'}}')
const clean=(state:F.FarmState)=>{const value=F.restoreCurrentFarm(JSON.parse(JSON.stringify(state)));assert.deepEqual(state,value);return value!}
const art={icon:()=>'',button:(label:string,action:string,enabled:boolean,o:{value?:string})=>
  `<button type="button" data-action="${action}" data-value="${o.value??''}"${enabled?'':' disabled'}>${label}</button>`}

function earned(mature:boolean,plan:boolean) {
 const p=commissionPlayer(mature?JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8')):[])
 const bed=mature?8:0
 if(p.state.island!=='home') p.visit('home')
 if(!p.state.seeds.beetroot)p.act('buySeeds','beetroot')
 p.act('selectSeed','beetroot')
 if(mature){
  const available=p.state.beds.flatMap((b,i)=>b.kind==='tilled'||F.getBedStage(b)==='ripe'?[i]:[])
  const packet=p.state.seeds.beetroot;assert.ok(available.length>=packet)
  for(const at of available.slice(0,packet)){
   if(p.state.beds[at].kind==='crop')p.act('workBed',at,0)
   p.act('workBed',at,0)
  }
 }else p.act('workBed',13,0)
 assert.deepEqual([p.state.day,p.state.coins,p.actions,p.state.beds[bed].kind,p.state.seeds.beetroot],
  mature?[14,68,110,'empty',0]:[1,21,2,'empty',0])
 assert.ok(F.cropIds.filter(id=>p.state.seeds[id]>0).length>=2)
 if(plan){
  const assignment=p.state.beds.map((_,i)=>i===bed?'beetroot' as const:i===1?'wheat' as const:null)
  assert.ok(P.saveGardenPlan(p.state,0,{name:'Свёкла и пшеница',crops:assignment},p.state.gardenPlans.revision).ok)
  assert.ok(P.followGardenPlan(p.state,0,p.state.gardenPlans.revision).ok)
 }
 return {farm:clean(p.state),bed}
}
function drive(farm:F.FarmState){
 const saves:F.FarmState[]=[],visits:number[]=[],motions:string[]=[],focus:number[]=[]
 const app:any={...F,...W,...S,farm,previewSeed:farm.selectedSeed,activeTool:'hoe',seedPickerBed:undefined,
  panel:undefined,dialog:{open:false},bagTab:'seeds',drawPanel(){},
  openPanel(panel:string){app.panel=panel;app.dialog.open=true;app.previewSeed=S.seedPickerBedPreview(farm,app.seedPickerBed)},
  closeDialog(){app.dialog.open=false},perform(fn:()=>F.ActionResult){const r=fn();if(r.ok)saves.push(structuredClone(farm));return r.ok},
  bayAudio:{primeEvents(){}},bedWorkSound(){},playBaySound(){},bedTools:{till:'hoe',plant:'seeds',water:'water'},
  island:{isCrossing:()=>false,visit:(target:{index:number})=>visits.push(target.index),focusTarget:(target:{index:number})=>focus.push(target.index),
   workBed(_index:number,work:()=>string,commit:()=>void){motions.push(work());commit()}},
 }
 runInNewContext(route,app)
 return {app,saves,motions,visits,focus,click:(index:number)=>app.activateTarget({kind:'bed',index}),
  chooser:()=>renderSeedPicker(farm,app.previewSeed,app.seedPickerBed,art)}
}

test('ordinary D1 and D14 till the exact bare bed first; no seed/purchase, a read-only picker, then a separate guarded sow',()=>{
 for(const [mature,planned] of [[false,false],[false,true],[true,true]]){
  const {farm,bed}=earned(mature,planned),ui=drive(farm),before=structuredClone(farm)
  const tilled=structuredClone(farm);assert.ok(F.workBed(tilled,bed,0).ok)
  assert.equal(tilled.coins-before.coins,mature?0:3,'only the existing first-till tutorial reward')
  ui.click(bed)
  assert.deepEqual(ui.motions,['till'])
  assert.equal(ui.app.dialog.open,false)
  assert.deepEqual(ui.visits,[])
  assert.equal(ui.saves.length,1)
  assert.deepEqual(farm,tilled,'canonical tell/all state; no selection, purchase, seed use or plan mutation')
  assert.deepEqual(farm.gardenPlans,before.gardenPlans)
  assert.deepEqual(farm.seeds,before.seeds)
  ui.click(bed)
  assert.deepEqual(ui.visits,[bed])
  assert.deepEqual(ui.motions,['till'],'no accidental second till or empty sow')
  assert.deepEqual([ui.app.panel,ui.app.seedPickerBed,ui.app.previewSeed],['seeds',bed,'beetroot'])
  assert.match(ui.chooser(),/data-action="buy-seeds"/)
  assert.equal((ui.chooser().match(/data-action="preview-seed"/g)??[]).length,10)
  assert.equal(ui.saves.length,1);assert.deepEqual(farm,tilled)

  // Match an existing deliberate option, not the old forced purchase before the soil action.
  let desired:F.CropId='wheat'
  if(planned){
   assert.ok(F.buySeeds(farm,'beetroot').ok)
   desired='beetroot'
  } else ui.app.previewSeed=desired
  const beforeSelect=structuredClone(farm),quote=S.seedChoice(farm,desired,bed)
  assert.ok(quote.available && quote.validTarget)
  assert.match(ui.chooser(),planned?/К грядке по плану/:/Выбрать пшеницу/)
  ui.app.confirmSeed('stale')
  assert.equal(ui.saves.length,1);assert.deepEqual(farm,beforeSelect)
  ui.app.confirmSeed(quote.token)
  assert.equal(ui.app.dialog.open,false);assert.deepEqual(ui.focus,[bed])
  assert.deepEqual(farm,{...beforeSelect,selectedSeed:planned?'beetroot':'wheat'})
  assert.deepEqual(farm.beds[bed],{kind:'tilled'})
  assert.equal(ui.saves.length,2)
  const beforeSow=clean(farm), expected=structuredClone(farm)
  assert.ok(F.workBed(expected,bed,0).ok)
  ui.click(bed)
  assert.deepEqual(ui.motions,['till','plant'])
  assert.equal(ui.saves.length,3)
  assert.deepEqual(farm,expected)
  assert.equal(farm.seeds[desired],beforeSow.seeds[desired]-1)
  assert.deepEqual(farm.gardenPlans,before.gardenPlans)
  assert.deepEqual(farm.variants,before.variants)
  assert.deepEqual(clean(farm),farm)
 }
})
