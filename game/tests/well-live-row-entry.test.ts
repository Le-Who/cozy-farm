import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as F from '../src/farm.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true)
const names = ['button','panelTabs','freshIrrigationMode','irrigationRows','focusKey','rememberPanel','openPanel','goBack','perform']
const definitions = names.flatMap(name => {
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  if (name !== 'freshIrrigationMode') assert.ok(node, name)
  return node ? [node.getText(ast)] : []
})
const arms = new Map<string, string>()
function visit(node: ts.Node) {
  if (ts.isCaseClause(node) && ts.isStringLiteral(node.expression) &&
      ['well','irrigation-mode','irrigate-row','irrigate-pair'].includes(node.expression.text)) {
    assert.equal(arms.has(node.expression.text), false)
    arms.set(node.expression.text, node.getText(ast))
  }
  ts.forEachChild(node, visit)
}
visit(ast)
assert.equal(arms.size,4)
const code = ts.transpileModule(`${definitions.join('\n')}
  function enterWell(){switch('well'){${arms.get('well')}}}
  function choose(action,value){const control={dataset:{action}};switch(action){${['irrigation-mode','irrigate-row','irrigate-pair'].map(key=>arms.get(key)).join('\n')}}}
  ({enterWell,choose,openPanel,goBack})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

function earned(branch: 'pipes' | 'rain' | null = 'pipes') {
  let farm = F.createFarm()
  const act = (reducer: Function, ...args: unknown[]) => {
    const result: F.ActionResult = reducer(farm,...args)
    assert.ok(result.ok,result.message)
    const restored = F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))
    assert.deepEqual(restored,farm)
    farm = restored!
  }
  for (const i of [0,0,0,2,3,7]) act(F.workBed,i,1)
  for (const crop of ['cabbage','tomato','pumpkin'] as const) act(F.sellMarketItem,`produce:${crop}`,farm.produce[crop])
  act(F.endDay)
  act(F.upgradeBuilding,'well')
  if (branch) act(F.specializeFacility,branch)
  for (let i=0;i<4;i++) act(F.buySeeds,'wheat')
  act(F.selectSeed,'wheat')
  for (let i=0;i<farm.beds.length;i++) {
    if (F.getBedAction(farm,i).kind==='water') continue
    if (F.getBedAction(farm,i).kind==='harvest') act(F.workBed,i,1)
    if (F.getBedAction(farm,i).kind==='till') act(F.workBed,i,1)
    assert.equal(F.getBedAction(farm,i).kind,'plant')
    act(F.workBed,i,1)
  }
  assert.equal(farm.day,2)
  assert.deepEqual(Array.from({length:F.gardenRows},(_,i)=>F.getIrrigationRow(farm,i).targets.length),[4,4,4,4])
  return {get farm(){return farm}, pour(...plots: number[]){for(const i of plots)act(F.workBed,i,1)}}
}

const noop = () => {}
function screen(farm: F.FarmState) {
  let cards: MockButton[] = []
  let writes = 0
  const splashes: number[][] = []
  const doc: {activeElement: MockButton | null} = {activeElement:null}
  class MockButton {
    dataset: Record<string,string>
    private attributes: Record<string,string>
    constructor(raw: string) {
      this.attributes = Object.fromEntries([...raw.matchAll(/\s([\w-]+)(?:="([^"]*)")?(?=[\s>])/g)].map(([,key,value])=>[key,value??'']))
      this.dataset = Object.fromEntries(Object.entries(this.attributes).filter(([key])=>key.startsWith('data-')).map(([key,val])=>[key.slice(5),val]))
    }
    get disabled(){return 'disabled' in this.attributes}
    getAttribute(name:string){return this.attributes[name] ?? null}
    getClientRects(){return [{}]}
    focus(){doc.activeElement=this}
  }
  const closeButton = new MockButton('<button data-action="close">')
  const fields = 'hiveFlower activeTool pickedMarketOrder selectedMarketOrder journeyDetailsOpen journalDetailsOpen selectedExpeditionPort selectedExpeditionOffer selectedWarehouseRequest selectedWarehouse freightPlanOpen inventoryGroup boatIsland marketSaleFamily marketSaleQuery marketTab marketCategory marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot pastryShape workshopRecipe cookingDish cookingFish seedPickerBed signatureBase signatureSlot signatureRepeatId expandedRepeatId cookingMode communityOrderId communityResident requestedFood kitchenTart kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish signatureFamily celebratedFestival'.split(' ')
  const resets = {reset:noop}
  const frames: (()=>void)[] = []
  const ctx: any = {...F, ...Object.fromEntries(fields.map(key=>[key,undefined])),
    farm, closeButton, document:doc, HTMLButtonElement:MockButton, panel:undefined, panelHistory:[], panelRenderVersion:0, irrigationRowResume:undefined,
    dialog:{open:false,showModal(){this.open=true},close(){this.open=false;ctx.panel=undefined;ctx.panelHistory.length=0;cards=[]},querySelectorAll(){return cards.filter(btn=>!btn.disabled)}},
    dialogContent:{scrollTop:0,querySelector:()=>null,querySelectorAll:()=>[]},
    island:{isCrossing:()=>false,visit:noop,showIrrigation:(targets:number[])=>splashes.push(Array.from(targets)),setViewMode:noop,setCoveFocus:noop}, app:{dataset:{}}, toast:{},
    dialogFeedback:{classList:{toggle:noop},dataset:{}},dialogFeedbackTimer:0,window:{clearTimeout:noop,setTimeout:()=>0},
    recipeBook:{snapshot:()=>({}),load:noop}, signatureSlots:[], bayAudio:{primeEvents:noop},
    transplantSelection:resets, berryNurserySelection:resets, berryRenewalSelection:resets, gardenEditor:resets, recipeSurplusSelection:resets,
    salePresentation:resets, marketSaleBrowse:resets, stopHarbour:noop, stopFishing:noop, stopWorkshop:noop, stopCookery:noop, stopArrangement:noop,
    status:noop, playBaySound:noop, updateCommunityReturn:noop, restoreFerryPanelView:noop,
    requestAnimationFrame:(callback:()=>void)=>frames.push(callback), icon:()=>'', numberFormat:new Intl.NumberFormat('ru-RU'),
    saveFarm:()=>{writes++}, refresh:()=>{if(ctx.dialog.open)ctx.drawPanel()}, notify:noop,
    drawPanel(){ctx.panelRenderVersion++;cards=ctx.panel==='irrigation' ? [...ctx.irrigationRows().matchAll(/<button\b[^>]*>/g)].map(([tag])=>new MockButton(tag)):[]}
  }
  const ui = runInNewContext(code,ctx)
  const button = (action:string,value:string)=>{const control=cards.find(b=>b.dataset.action===action&&b.dataset.value===value);assert.ok(control,action+value);return control}
  const activeTab = () => cards.find(b=>b.dataset.action==='irrigation-mode'&&b.getAttribute('aria-pressed')==='true')?.dataset.value
  const enabled = () => cards.filter(b=>b.dataset.action.startsWith('irrigate-')&&!b.disabled).map(b=>[b.dataset.action,b.dataset.value])
  function pick(action:string,value:string){const control=button(action,value);assert.equal(control.disabled,false);control.focus();ui.choose(action,value)}
  return {ui,ctx,pick,button,enabled,activeTab,doc,splashes,get writes(){return writes},flush(){frames.splice(0).forEach(fn=>fn())}}
}

test('a fresh Pipes Well with 2 water and no live pair exposes its two actionable rows without watering',()=>{
  const p=earned()
  p.pour(0,1,4,8,12,13)
  const f=p.farm, before=structuredClone(f)
  assert.equal(f.water,2)
  assert.equal([0,1,2].some(i=>F.getIrrigationPair(f,i).available),false)
  const s=screen(f)
  s.ui.enterWell()
  assert.equal(s.activeTab(),'row')
  assert.deepEqual(s.enabled(),[['irrigate-row','0'],['irrigate-row','3']])
  assert.equal(s.doc.activeElement,s.ctx.closeButton)
  assert.deepEqual(f,before)

  s.pick('irrigate-row','0')
  assert.equal(f.water,0)
  assert.deepEqual(f.beds.flatMap((b,i)=>JSON.stringify(b)!==JSON.stringify(before.beds[i])?[i]:[]),[2,3])
  assert.equal(f.coins,before.coins)
  assert.equal(s.ctx.irrigationMode,'row','the last explicit watering does not silently change the chosen mode')
  assert.equal(s.ctx.dialog.open,false,'the real apply dismisses to show the field')
  assert.deepEqual(s.splashes,[[2,3]])
})

test('Pipes still defaults to Two rows when a pair works, and keeps it when neither choice works',()=>{
  const p=earned()
  const s=screen(p.farm), start=structuredClone(p.farm)
  s.ui.enterWell()
  assert.equal(s.activeTab(),'pair')
  assert.deepEqual(s.enabled(),[['irrigate-pair','0'],['irrigate-pair','1'],['irrigate-pair','2']])
  assert.deepEqual(p.farm,start)
  p.pour(0,1,4,8,12,13,2,3)
  const empty=screen(p.farm)
  assert.equal(p.farm.water,0)
  empty.ui.enterWell()
  assert.equal(empty.activeTab(),'pair')
  assert.deepEqual(empty.enabled(),[])
})

test('manual mode stays through redraw, same-panel entry, and real Back with tab focus and scroll restored',()=>{
  const p=earned()
  p.pour(0,1,4,8,12,13)
  const f=p.farm, before=structuredClone(f),s=screen(f)
  s.ui.enterWell()
  s.pick('irrigation-mode','pair')
  s.ctx.drawPanel()
  s.ui.enterWell()
  assert.equal(s.activeTab(),'pair')
  s.button('irrigation-mode','pair').focus()
  s.ctx.dialogContent.scrollTop=123
  s.ui.openPanel('guide')
  s.ui.goBack(true)
  s.flush()
  assert.equal(s.activeTab(),'pair')
  assert.deepEqual(s.enabled(),[])
  assert.equal(s.ctx.dialogContent.scrollTop,123)
  assert.equal(s.doc.activeElement,s.button('irrigation-mode','pair'))
  s.pick('irrigation-mode','row')
  assert.deepEqual(s.enabled(),[['irrigate-row','0'],['irrigate-row','3']])
  assert.deepEqual(f,before)
})

test('other Well upgrades still have only the existing row controls',()=>{
  for (const branch of [null,'rain'] as const) {
    const p=earned(branch),s=screen(p.farm), before=structuredClone(p.farm)
    s.ui.enterWell()
    assert.equal(s.activeTab(),undefined)
    assert.equal(s.enabled().length,4)
    assert.ok(s.enabled().every(([action])=>action==='irrigate-row'))
    assert.deepEqual(p.farm,before)
  }
})

function earnedThreeRows() {
  const commands = JSON.parse(readFileSync(new URL('./fixtures/market-order-selection-commands.json',import.meta.url),'utf8'))
  const p = commissionPlayer(commands)
  p.visit('home')
  assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.buildingLevels.well],[119,15,99,2])
  p.act('specializeFacility','pipes'); p.act('upgradeCan'); p.act('buySeeds','wheat')
  const crops: F.CropId[] = ['carrot','cabbage','beetroot','tomato','pumpkin','wheat','leafyGreens']
  for(let i=0;i<12;i++) {
    for(const action of ['harvest','till']) if(F.getBedAction(p.state,i).kind===action)p.act('workBed',i,1)
    assert.equal(F.getBedAction(p.state,i).kind,'plant')
    const preferred = crops[i%crops.length]
    const crop = p.state.seeds[preferred] > 0 ? preferred : crops.find(id=>p.state.seeds[id]>0)
    assert.ok(crop)
    if(p.state.selectedSeed!==crop)p.act('selectSeed',crop)
    p.act('workBed',i,1)
  }
  assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.water],[150,15,16,12])
  assert.deepEqual(Array.from({length:F.gardenRows},(_,i)=>F.getIrrigationRow(p.state,i).targets.length),[4,4,4,0])
  return p.state
}

test('earned D15: each chosen single row reopens in the same mode at neutral focus, with no new watering until the next apply',()=>{
  const f=earnedThreeRows(),before=structuredClone(f),s=screen(f)
  s.ui.enterWell(); assert.equal(s.activeTab(),'pair')
  s.pick('irrigation-mode','row')
  assert.deepEqual(f,before); assert.equal(s.writes,0)
  for(const row of [0,1,2]) {
    const count=s.writes
    s.pick('irrigate-row',String(row))
    assert.equal(s.ctx.dialog.open,false)
    assert.equal(s.writes,count+1)
    assert.equal(f.water,12-4*(row+1))
    assert.deepEqual(s.splashes.at(-1),Array.from({length:4},(_,i)=>row*4+i))
    const after=structuredClone(f)
    if(row===2)break
    s.ui.enterWell()
    assert.equal(s.activeTab(),'row','immediate Well reopening retains the last explicit row choice')
    assert.equal(s.doc.activeElement,s.ctx.closeButton)
    assert.deepEqual(f,after);assert.equal(s.writes,count+1)
  }
  s.ui.enterWell()
  assert.equal(s.activeTab(),'pair');assert.deepEqual(s.enabled(),[])
  assert.equal(f.coins,before.coins)
  assert.deepEqual(f.beds.slice(12),before.beds.slice(12))
  assert.deepEqual(f.seeds,before.seeds)
  assert.equal(s.writes,3)
})

test('earned D15: pair, stopping, changing context, and refusing a stale action remain ordinary',()=>{
  const exact=earnedThreeRows(),pairFarm=structuredClone(exact),pair=screen(pairFarm)
  pair.ui.enterWell();pair.pick('irrigate-pair','0')
  assert.equal(pair.ctx.dialog.open,false);assert.equal(pairFarm.water,4)
  assert.equal(pair.writes,1)
  assert.deepEqual(pair.splashes,[[0,1,2,3,4,5,6,7]])
  assert.deepEqual(F.getIrrigationRow(pairFarm,2).targets,[8,9,10,11])
  pair.ui.enterWell();assert.equal(pair.activeTab(),'pair')
  pair.pick('irrigate-pair','1');assert.equal(pairFarm.water,0)
  assert.deepEqual(pair.splashes.at(-1),[8,9,10,11])
  const oneFarm=structuredClone(exact),one=screen(oneFarm)
  // The stock path remains lawful when the player explicitly reselects the tab each time.
  for(const i of [0,1,2]){
    one.ui.enterWell();one.pick('irrigation-mode','row');one.pick('irrigate-row',String(i))
  }
  assert.ok(F.endDay(pairFarm).ok);assert.ok(F.endDay(oneFarm).ok)
  assert.deepEqual(pairFarm,oneFarm,'no output or morning advantage for either control path')

  for(const interrupt of ['manual-close','other-panel','other-work','stale-row'] as const){
    const f=structuredClone(exact),s=screen(f)
    s.ui.enterWell();s.pick('irrigation-mode','row')
    if(interrupt==='manual-close')s.ctx.dialog.close()
    else{
      s.pick('irrigate-row','0')
      if(interrupt==='other-panel'){s.ui.openPanel('guide');s.ctx.dialog.close()}
      if(interrupt==='other-work')assert.ok(F.workBed(f,4,1).ok)
      if(interrupt==='stale-row'){
        s.ui.enterWell()
        const before=structuredClone(f)
        s.ui.choose('irrigate-row','0')
        assert.deepEqual(f,before);assert.equal(s.writes,1);assert.equal(s.splashes.length,1)
        continue
      }
    }
    const before=structuredClone(f),writes=s.writes
    s.ui.enterWell()
    assert.equal(s.activeTab(),'pair',interrupt)
    assert.deepEqual(f,before);assert.equal(s.writes,writes)
  }
})
