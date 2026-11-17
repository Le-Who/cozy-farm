import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
import {createFarm,restoreCurrentFarm} from '../src/farm.ts'
import {GardenPlanEditor,renderGardenPlans} from '../src/garden-plans-ui.ts'
import {saveGardenPlan} from '../src/garden-plans.ts'

// Execute actual app history/navigation and the public plan renderer. This tiny
// DOM adapter models closed <details> descendants as hidden, not native geometry.
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true)
function find(predicate:(node:ts.Node)=>boolean){let result:ts.Node|undefined;function visit(node:ts.Node){if(!result&&predicate(node))result=node;ts.forEachChild(node,visit)}visit(ast);assert.ok(result);return result.getText(ast)}
const declarations=['focusKey','rememberPanel','goBack','openPanel','visitPanelAt'].map(name=>find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name))
const travel=find(n=>ts.isCaseClause(n)&&n.expression.getText(ast)==="'travel-panel'")
const code=ts.transpileModule(declarations.join('\n')+`\nasync function act(action,value){switch(action){${travel}}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const noop=()=>{}
function harness(){
 const farm=createFarm(),editor=new GardenPlanEditor()
 for(const [slot,name,crops]of [[0,'Кухонный огород',['wheat','carrot','cabbage']],[1,'Другой план',['tomato','beetroot','wheat']]] as const){
  assert.ok(editor.choose(slot));assert.ok(editor.begin(farm));editor.draft!.name=name
  for(const[i,crop]of crops.entries()){editor.brush=crop;assert.ok(editor.paint([0,8,13][i]))}assert.ok(editor.save(farm).ok)
 }
 editor.choose(0);const baseline=structuredClone(farm),frames:Function[]=[],saves:any[]=[],visits:string[]=[]
 let detail:{open:boolean}|undefined,buttons:Button[]=[],html=''
 const document:{activeElement:Button|null}={activeElement:null}
 class Button{
  dataset:Record<string,string>;textContent:string;className='dialog-button';disabled=false
  constructor(action:string,value:string,text:string,privateDetail?:{open:boolean}){this.dataset={action,value};this.textContent=text;this.owner=privateDetail}
  owner:{open:boolean}|undefined
  getAttribute(name:string){return name==='aria-label'?null:undefined}
  getClientRects(){return this.owner&&!this.owner.open?[]:[{}]}
  focus(){if(this.getClientRects().length)document.activeElement=this}
 }
 const close=new Button('close','','Закрыть'),reset={reset:noop}
 const content={scrollTop:0,querySelector:(selector:string)=>selector==='.garden-supplies'?detail:null,querySelectorAll:()=>[]}
 const state:any={farm,gardenEditor:editor,panel:'garden-plans',panelHistory:[],panelRenderVersion:0,document,HTMLButtonElement:Button,dialogContent:content,
  dialog:{open:true,showModal(){this.open=true},querySelectorAll:()=>[close,...buttons].filter(b=>!b.disabled)},closeButton:close,
  salePresentation:{place:undefined,reset:noop},marketSaleBrowse:{reset:noop},transplantSelection:reset,berryNurserySelection:reset,berryRenewalSelection:reset,recipeSurplusSelection:reset,
  recipeBook:{snapshot:()=>({}),load:noop},restoreFerryPanelView:noop,
  selectedWarehouseRequest:undefined,selectedExpeditionPort:'mill',selectedExpeditionOffer:'mill-grain',selectedWarehouse:'home',freightPlanOpen:false,boatIsland:'home',bagTab:'seeds',archiveGroup:'crops',treeSlot:0,previewSeed:farm.selectedSeed,specializationBuilding:'farmhouse',previewSpecialization:undefined,irrigationMode:'row',villageSlot:0,pastryShape:'round',workshopRecipe:'bread',cookingDish:'farmhouseBread',cookingFish:'perch',seedPickerBed:undefined,signatureBase:'tart',signatureSlots:[],signatureSlot:0,signatureRepeatId:undefined,expandedRepeatId:undefined,cookingMode:'dish',communityOrderId:'',communityResident:'bea',requestedFood:undefined,kitchenTart:'orchardTart',kitchenPreserves:'appleJam',kitchenGroup:'dishes',kitchenDish:'farmhouseBread',honeyKitchenDish:'honeyPear',signatureFamily:'tart',journeyDetailsOpen:false,journalDetailsOpen:false,
  inventoryGroup:'harvest',marketSaleFamily:undefined,marketSaleQuery:'',marketTab:'buy',marketCategory:'seeds',marketSellGroup:'all',celebratedFestival:undefined,
  island:{isCrossing:()=>false,setViewMode:noop,setCoveFocus:noop,crossIsland:()=>{throw Error('This local route must not sail')}},stopHarbour:noop,stopFishing:noop,stopWorkshop:noop,stopCookery:noop,stopArrangement:noop,playBaySound:noop,updateCommunityReturn:noop,
  app:{dataset:{}},toast:{},dialogFeedback:{},requestAnimationFrame:(fn:Function)=>frames.push(fn),saveFarm:()=>saves.push(structuredClone(farm)),
  drawPanel:()=>{state.panelRenderVersion++;visits.push(state.panel);detail=undefined;buttons=[];html=state.panel==='garden-plans'?renderGardenPlans(farm,editor,()=>'<i></i>'):''
   const section=html.match(/<details class="garden-supplies"([^>]*)>([\s\S]*?)<\/details>/)
   if(section){detail={open:/\bopen\b/.test(section[1])};for(const match of section[2].matchAll(/<button[^>]*data-action="([^"]+)"[^>]*data-value="([^"]*)"[^>]*>([^<]+)<\/button>/g))buttons.push(new Button(match[1],match[2],match[3],detail))}
  },
 }
 runInNewContext(code,state);state.drawPanel()
 const target=()=>buttons.find(b=>b.dataset.action==='travel-panel'&&b.dataset.value==='market')!
 const flush=()=>{while(frames.length)frames.shift()!()}
 const assertReadOnly=()=>{assert.deepEqual(farm,baseline);assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),baseline);assert.deepEqual(saves,[])}
 return{state,editor,farm,baseline,content,saves,visits,flush,target,assertReadOnly,get detail(){return detail},get html(){return html},get focused(){return document.activeElement}}
}

test('local Market Back restores the same saved plan supplies before resolving its original focus',async()=>{
 const h=harness();assert.match(h.html,/Семена для свободных грядок/);assert.match(h.html,/Пшеница/);assert.match(h.html,/Морковь/);assert.match(h.html,/Капуста/)
 h.detail!.open=true;h.content.scrollTop=430;h.target().focus()
 await h.state.act('travel-panel','market');assert.equal(h.state.panel,'market');assert.equal(h.state.panelHistory.length,1);h.assertReadOnly()
 h.state.goBack();assert.equal(h.state.panel,'garden-plans');assert.equal(h.detail!.open,true,'disclosure restored before deferred focus')
 h.flush();assert.equal(h.focused,h.target());assert.equal(h.target().getClientRects().length,1);assert.equal(h.content.scrollTop,430);h.assertReadOnly()
})

test('closed supplies, an editor draft and the priced shopping view do not acquire an open disclosure',()=>{
 for(const mode of ['closed','draft','shopping']){
  const h=harness()
  if(mode==='draft')assert.ok(h.editor.begin(h.farm))
  if(mode==='shopping')h.editor.shopping='open'
  h.state.drawPanel();h.state.closeButton.focus();h.state.openPanel('market')
  const saved=h.state.panelHistory.at(-1).gardenSupplies
  if(mode==='closed')assert.equal(saved.open,false);else assert.equal(saved,undefined)
  h.state.goBack();h.flush();assert.equal(h.detail!.open,false);assert.equal(h.focused,h.state.closeButton);h.assertReadOnly()
 }
})

test('a different selected plan or revised plan cannot inherit the old supplies opening or hidden source focus',async()=>{
 for(const mismatch of ['slot','revision']){
  const h=harness();h.detail!.open=true;h.target().focus();await h.state.act('travel-panel','market')
  if(mismatch==='slot')assert.ok(h.editor.choose(1))
  else assert.ok(saveGardenPlan(h.farm,0,h.farm.gardenPlans.pages[0],h.farm.gardenPlans.revision).ok)
  const beforeReturn=structuredClone(h.farm)
  h.state.goBack();h.flush();assert.equal(h.detail!.open,false);assert.equal(h.focused,h.state.closeButton)
  assert.deepEqual(h.farm,beforeReturn);assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(h.farm))),beforeReturn);assert.deepEqual(h.saves,[])
 }
})

test('other routes and later navigation cannot receive the saved garden disclosure or deferred focus',async()=>{
 const h=harness();h.detail!.open=true;h.content.scrollTop=430;h.target().focus();await h.state.act('travel-panel','market')
 h.state.goBack();assert.equal(h.detail!.open,true)
 h.state.openPanel('guide',false);h.flush();assert.equal(h.state.panel,'guide');assert.equal(h.detail,undefined);assert.equal(h.content.scrollTop,0);assert.equal(h.focused,h.state.closeButton)
 h.state.openPanel('market');assert.equal(h.state.panelHistory.at(-1).gardenSupplies,undefined)
 h.state.goBack();h.flush();assert.equal(h.state.panel,'guide')
 h.state.openPanel('garden-plans',false);assert.equal(h.detail!.open,false);h.assertReadOnly()
})
