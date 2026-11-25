import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {test} from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as M from '../src/fishing-model.ts'
import {covePresets} from '../src/shoreline.ts'
import type {FishingGameOptions} from '../src/fishing.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const file=(name:string)=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8')
const main=file('main.ts'), fishing=file('fishing.ts'), cove=file('culinary-ui.ts')
function part(full:string,start:string,end:string){
  const a=full.indexOf(start),b=full.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return full.slice(a,b)
}
const keydown=stripTypeScriptTypes(part(fishing,'  const keyDown =','  const keyUp ='))
const coveMarkup=part(cove,'const control=','\n')+
  '\n'+cove.slice(cove.indexOf('const coveChoiceSummary')).replace('export function coveControls','function coveControls').replaceAll('import.meta.env.BASE_URL','"/"')
const scene=stripTypeScriptTypes([
  'let fishingLanding,fishingGame,fishingToken,fishingPractice',
  coveMarkup,
  part(main,'function focusKey(', 'let harbourScene:'),
  part(main,'function stopFishing()', 'function stopWorkshop()'),
  part(main,'function mountFishing(', 'function pastryChoices()'),
  part(main,'function openPanel(', 'function openRecipeBook('),
  part(main,'function closeDialog(', 'function refresh()'),
  'function clickCove(){switch("cove-fish"){',part(main,"    case 'cove-fish':","    case 'shoal-pick':"),'}}',
  '({openPanel,clickCove,mountFishing})',
].join('\n'))
function earnedCove(){
  const starter=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
  const p=commissionPlayer(starter.slice(0,15));assert.equal(p.state.day,2);assert.equal(p.state.island,'grove')
  p.act('collectShell',0);p.act('changeCove',covePresets.nursery)
  while(p.state.day<5){p.night();p.visit('grove')}
  assert.equal(p.state.shoreline.settledOn,3)
  p.act('changeCove',covePresets.channel)
  assert.equal(p.actions,27);assert.equal(F.getCoveActions(p.state).forecast?.day,6);assert.equal(F.getFishAction(p.state).available,true)
  return p.state
}

const no=()=>{}
function screen(farm:F.FarmState){
  const frames:(()=>void)[]=[], doc:{activeElement:MockButton|null}={activeElement:null}
  const resets={reset:no},host={querySelector:()=>null}
  let options:FishingGameOptions|undefined, buttons:MockButton[]=[], destroyed=0
  const writes:F.FarmState[]=[]
  class MockButton {
    readonly dataset:Record<string,string>;readonly disabled:boolean
    constructor(attrs:string){
      this.dataset=Object.fromEntries([...attrs.matchAll(/data-([\w-]+)="([^"]*)"/g)].map(([,id,value])=>[id,value]))
      this.disabled=/\sdisabled(?:\s|$)/.test(attrs)
    }
    getClientRects(){return [{}]}
    focus(){doc.activeElement=this}
  }
  const closeButton=new MockButton('data-action="close"')
  const fields='hiveFlower pickedMarketOrder selectedMarketOrder marketTreeSpaceVisit journeyDetailsOpen journalDetailsOpen selectedExpeditionPort selectedExpeditionOffer selectedWarehouseRequest selectedWarehouse freightPlanOpen inventoryGroup boatIsland marketSaleFamily marketSaleQuery marketTab marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot pastryShape workshopRecipe cookingDish cookingFish seedPickerBed signatureBase signatureSlot signatureRepeatId expandedRepeatId cookingMode communityOrderId communityResident requestedFood kitchenTart kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish signatureFamily celebratedFestival'.split(' ')
  const ctx:any={...F,...Object.fromEntries(fields.map(x=>[x,undefined])),farm, panel:undefined, panelHistory:[], document:doc,
    HTMLButtonElement:MockButton,hasLanternfishDepth:M.hasLanternfishDepth,
    app:{dataset:{}}, toast:{}, dialogFeedback:{}, panelRenderVersion:0, signatureSlots:[],closeButton,
    dialog:{open:false,showModal(){this.open=true},close(){this.open=false},querySelectorAll(){return buttons.filter(b=>!b.disabled)}},
    dialogContent:{querySelector:(q:string)=>q==='.fishing-host'?host:null,querySelectorAll:()=>[],scrollTop:0},
    rememberClosedMarketSell:no,stopHarbour:no,stopWorkshop:no,stopArrangement:no,stopCookery:no,
    salePresentation:resets,marketSaleBrowse:resets,transplantSelection:resets,berryNurserySelection:resets,berryRenewalSelection:resets,gardenEditor:resets,recipeSurplusSelection:resets,
    island:{isCrossing:()=>false,setViewMode:no,setCoveFocus:no,setFishing:no},
    recipeBook:{snapshot:()=>({}),load:no},restoreFerryPanelView:no,playBaySound:no,status:no,notify:no,updateCommunityReturn:no,
    requestAnimationFrame:(fn:()=>void)=>frames.push(fn),
    saveFarm(){const copy=F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm))); assert.ok(copy); writes.push(copy)},
    perform(action:()=>F.ActionResult){const result=action();if(result.ok)ctx.saveFarm();return result.ok},
    drawPanel(){
      ctx.panelRenderVersion++; doc.activeElement=null
      buttons=ctx.panel==='cove'?[...ctx.coveControls(farm).matchAll(/<button\b([^>]+)>/g)].map(([,attrs])=>new MockButton(attrs)):[]
      if(ctx.panel==='fishing')ui.mountFishing()
    },
    createFishingGame(_host:unknown,opts:FishingGameOptions){options=opts;return {destroy(){destroyed++}}},
  }
  const ui=runInNewContext(scene,ctx)
  function control(action:string){const b=buttons.find(b=>b.dataset.action===action);assert.ok(b);return b}
  function fromCove(){
    ui.openPanel('cove')
    control('cove-fish').focus();ctx.dialogContent.scrollTop=43
    ui.clickCove()
    assert.deepEqual(Array.from(ctx.panelHistory, (parent:any)=>parent.panel),['cove'])
    assert.equal(ctx.panel,'fishing');assert.ok(options)
    return options
  }
  function key(shown:FishingGameOptions,repeat=false){
    let consumed=0
    runInNewContext(keydown+'\nkeyDown(event)',{options:shown,event:{key:'Escape',repeat,preventDefault(){consumed++}}})
    assert.equal(consumed,1)
    for(const cb of frames.splice(0)) cb()
  }
  const assertCove=()=>{assert.equal(ctx.panel,'cove');assert.equal(ctx.dialog.open,true)
    assert.equal(doc.activeElement,control('cove-fish'));assert.equal(ctx.dialogContent.scrollTop,43);
    assert.equal(destroyed,1)}
  const assertClosed=()=>{assert.equal(ctx.panel,undefined);assert.equal(ctx.dialog.open,false);assert.equal(ctx.panelHistory.length,0)}
  return {farm,ui,writes,fromCove,key,assertCove,assertClosed,get options(){assert.ok(options);return options},get panel(){return ctx.panel}}
}

test('Escape before casting goes back to the same Cove with focus and planned tide, without spending',()=>{
  const farm=earnedCove(),before=structuredClone(farm),s=screen(farm),shown=s.fromCove()
  s.key(shown);s.assertCove()
  assert.deepEqual(farm,before);assert.equal(s.writes.length,0)
  s.key(shown);s.assertCove()
  assert.equal(F.getCoveActions(farm).planKey,F.getCoveActions(before).planKey)
})

test('a repeat Escape does not activate the mounted scene or its parent',()=>{
  const farm=earnedCove(),before=structuredClone(farm),s=screen(farm),shown=s.fromCove()
  s.key(shown,true);assert.equal(s.panel,'fishing')
  s.key(shown);s.assertCove()
  s.key(shown,true);s.assertCove()
  assert.deepEqual(farm,before);assert.equal(s.writes.length,0)
})

test('active Cove Escape retains the same cast consumption and save as an explicit shore exit',()=>{
  const farm=earnedCove(),a=screen(structuredClone(farm)),b=screen(structuredClone(farm))
  const withBack=a.fromCove(),withShore=b.fromCove()
  assert.equal(withBack.onCast?.(),true);assert.equal(withShore.onCast?.(),true)
  assert.ok(a.farm.pendingFishingTrip)
  a.key(withBack);a.assertCove()
  withShore.onCancel?.();b.assertClosed()
  assert.deepEqual(a.farm,b.farm);assert.deepEqual(a.writes,b.writes);assert.equal(a.writes.length,2)
  assert.equal(a.farm.pendingFishingTrip,null)
  assert.equal(a.farm.fishingTripSerial,farm.fishingTripSerial+1)
  assert.equal(a.farm.fishCaughtToday.grove,0)
})

test('Escape from result keeps a landed generated fish once before the Cove return',()=>{
  const farm=earnedCove(),s=screen(farm),shown=s.fromCove()
  assert.equal(shown.onCast?.(),true)
  const model=M.createFishingModel(shown.capacity,shown.resilience!,shown.seed!,shown.fish,shown.habitat)
  const fish=model.fish.find(f=>f.loot?.kind==='fish'&&f.loot.variant==='regular')?.loot
  assert.ok(fish?.kind==='fish')
  const result=shown.onFinish({count:1,depth:8,catches:[fish]})
  assert.ok(result && typeof result==='object')
  s.key(shown);s.assertCove()
  assert.equal(farm.fish[fish.species],1);assert.equal(farm.fishCaughtToday.grove,1)
  assert.equal(result.release(),false);s.key(shown)
  assert.equal(shown.onFinish({count:1,depth:8,catches:[fish]}),false)
  assert.equal(farm.fish[fish.species],1);assert.equal(farm.fishCaughtToday.grove,1)
})

test('direct pier Escape and the explicit shore action from Cove still close without side effects',()=>{
  const farm=earnedCove(),before=structuredClone(farm),direct=screen(farm)
  direct.ui.openPanel('fishing',false)
  direct.key(direct.options);direct.assertClosed()
  const explicit=screen(farm)
  explicit.fromCove().onCancel?.();explicit.assertClosed()
  assert.deepEqual(farm,before)
})
