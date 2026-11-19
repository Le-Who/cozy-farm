import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {renderSupperResult,supperCottageReady} from '../src/shared-supper.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
function section(start:string,end:string){const i=main.indexOf(start),j=main.indexOf(end,i+start.length);assert.ok(i>=0&&j>i);return main.slice(i,j)}
const functions=section('function finishSharedSupper(','function neighboursCard(')
  +section('function perform(', 'const bedTools =')
  +section('function goBack(','let harbourScene:')
  +section('function closeCurrentPanel()', "closeButton.addEventListener('click'")
const serve=main.split('\n').filter(line=>/^    case '(share-meal|supper-signature)'/.test(line)).join('\n')

test('first harbour supper keeps the cottage return for either dish; Back focuses Bea and Close stays on the island',()=>{
  const p=commissionPlayer(opening.slice(0,opening.findIndex(action=>action.name==='serveVillageMeal')))
  const id=p.cook()
  assert.equal(p.actions,95);assert.equal(p.state.village.meals,0);assert.equal(p.state.village.residents[0],'bea')
  assert.equal(p.state.handmade.round,1);assert.equal(p.state.culinary.stock[id],1);assert.equal(p.state.fish.perch,1)
  for(const command of ['share-meal','supper-signature']){
    const farm=structuredClone(p.state), source={panel:'village',villageSlot:0,signatureSlots:[],pastryShape:'round',marketNextOpen:[]}
    const history=[source],focus:string[]=[]
    const ctx={...F,supperCottageReady,farm,panel:'village-meal',panelHistory:history,value:id,command,pastryShape:'round',villageSlot:0,
      communityRequest:undefined,dialog:{open:true,close(){this.open=false;history.length=0},querySelectorAll:()=>[]},
      dialogContent:{innerHTML:'',scrollTop:64,querySelector:(s:string)=>s==='[data-supper-result]'?{focus:()=>focus.push('receipt')}:
        s==='[data-action="village-slot"][aria-pressed="true"]'?{focus:()=>focus.push('occupied cottage')}:null,querySelectorAll:()=>[]},
      openPanel(next:string){ctx.panel=next},closeDialog(){ctx.dialog.close();ctx.panel='field'},
      dialogFeedback:{dataset:{},classList:{toggle(){}}},dialogFeedbackTimer:0,window:{clearTimeout(){},setTimeout(){}},
      saveFarm(){},refresh(){ctx.dialogContent.innerHTML=renderSupperResult(farm,'','<button>Домой</button>')},notify(){},
      recipeBook:{load(){}},restoreFerryPanelView(){},panelRenderVersion:1,requestAnimationFrame:(callback:()=>void)=>callback()}
    const dispatch=runInNewContext(stripTypeScriptTypes(functions+";({serve:()=>{switch(command){"+serve+"}},goBack,closeCurrentPanel})"),ctx)
    dispatch.serve()
    assert.ok(ctx.dialog.open);assert.deepEqual(history,[source]);assert.equal(ctx.panel,'village-meal')
    assert.match(ctx.dialogContent.innerHTML,/1 из 2 ужинов/);assert.doesNotMatch(ctx.dialogContent.innerHTML,/supper-cottage/)
    assert.deepEqual(focus,['receipt']);assert.equal(ctx.dialogContent.scrollTop,0)
    assert.equal(farm.village.meals,1);assert.equal(farm.fish.perch,0)
    assert.equal(farm.handmade.round,command==='share-meal'?0:1);assert.equal(farm.culinary.stock[id],command==='supper-signature'?0:1)
    const served=structuredClone(farm);assert.deepEqual(F.restoreCurrentFarm(served),served)
    dispatch.goBack(true);assert.equal(ctx.panel,'village');assert.equal(ctx.villageSlot,0);assert.equal(focus.at(-1),'occupied cottage')
    dispatch.closeCurrentPanel();assert.equal(ctx.panel,'field');assert.equal(farm.island,'village');assert.deepEqual(farm,served)
  }
})
