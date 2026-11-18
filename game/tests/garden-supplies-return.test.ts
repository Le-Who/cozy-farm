import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
import {createFarm,getGrillFish,restoreCurrentFarm,workBed} from '../src/farm.ts'
import {GardenPlanEditor,renderGardenPlans} from '../src/garden-plans-ui.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'
import {saveGardenPlan,followGardenPlan} from '../src/garden-plans.ts'

// Execute actual app history/navigation and the public plan renderer. This tiny
// DOM adapter models closed <details> descendants as hidden, not native geometry.
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true)
function find(predicate:(node:ts.Node)=>boolean){let result:ts.Node|undefined;function visit(node:ts.Node){if(!result&&predicate(node))result=node;ts.forEachChild(node,visit)}visit(ast);assert.ok(result);return result.getText(ast)}
const declarations=['button','nav','focusKey','rememberPanel','goBack','openPanel','visitPanelAt'].map(name=>find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name))
const home=find(n=>ts.isCaseClause(n)&&n.expression.getText(ast)==="'rest'"&&n.getText(ast).includes('home-rest-services'))
const travel=find(n=>ts.isCaseClause(n)&&n.expression.getText(ast)==="'travel-panel'")
const code=ts.transpileModule(declarations.join('\n')+`\nfunction renderHome(){ switch("rest") { ${home} } }\nasync function act(action,value){switch(action){${travel}}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const noop=()=>{}
function harness(){
 const farm=createFarm(),editor=new GardenPlanEditor()
 for(const [slot,name,crops]of [[0,'Кухонный огород',['wheat','carrot','cabbage']],[1,'Другой план',['tomato','beetroot','wheat']]] as const){
  assert.ok(editor.choose(slot));assert.ok(editor.begin(farm));editor.draft!.name=name
  for(const[i,crop]of crops.entries()){editor.brush=crop;assert.ok(editor.paint([0,8,13][i]))}assert.ok(editor.save(farm).ok)
 }
 editor.choose(0);const baseline=structuredClone(farm),frames:Function[]=[],saves:any[]=[],visits:string[]=[]
 let detail:{open:boolean}|undefined,homeServices:{open:boolean}|undefined,buttons:Button[]=[],html=''
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
 const content={scrollTop:0,querySelector:(selector:string)=>selector==='.garden-supplies'?detail:selector==='.home-rest-services'?homeServices:null,querySelectorAll:()=>[]}
 const state:any={farm,getGrillFish,
  communityRequest:undefined,bayAudio:{primeEvents:noop},getClimate:()=>({weather:'sun'}),weatherNames:{sun:'Ясно'},renderSelectedIntentRest:noop,renderShopRest:noop,renderRestPreview:noop,renderFerryReturn:noop,harbourGoods:noop,renderVisitRest:noop,renderPicnicStatus:noop,renderCoopCapacityWarning:noop,flockFeedRow:noop,gardenEditor:editor,panel:'garden-plans',panelHistory:[],panelRenderVersion:0,document,HTMLButtonElement:Button,dialogContent:content,
  dialog:{open:true,showModal(){this.open=true},querySelectorAll:()=>[close,...buttons].filter(b=>!b.disabled)},closeButton:close,
  salePresentation:{place:undefined,reset:noop},marketSaleBrowse:{reset:noop},transplantSelection:reset,berryNurserySelection:reset,berryRenewalSelection:reset,recipeSurplusSelection:reset,
  recipeBook:{snapshot:()=>({}),load:noop},restoreFerryPanelView:noop,
  selectedWarehouseRequest:undefined,selectedExpeditionPort:'mill',selectedExpeditionOffer:'mill-grain',selectedWarehouse:'home',freightPlanOpen:false,boatIsland:'home',bagTab:'seeds',archiveGroup:'crops',treeSlot:0,previewSeed:farm.selectedSeed,specializationBuilding:'farmhouse',previewSpecialization:undefined,irrigationMode:'row',villageSlot:0,pastryShape:'round',workshopRecipe:'bread',cookingDish:'farmhouseBread',cookingFish:'perch',seedPickerBed:undefined,signatureBase:'tart',signatureSlots:[],signatureSlot:0,signatureRepeatId:undefined,expandedRepeatId:undefined,cookingMode:'dish',communityOrderId:'',communityResident:'bea',requestedFood:undefined,kitchenTart:'orchardTart',kitchenPreserves:'appleJam',kitchenGroup:'dishes',kitchenDish:'farmhouseBread',honeyKitchenDish:'honeyPear',signatureFamily:'tart',journeyDetailsOpen:false,journalDetailsOpen:false,
  inventoryGroup:'harvest',marketSaleFamily:undefined,marketSaleQuery:'',marketTab:'buy',marketCategory:'seeds',marketSellGroup:'all',celebratedFestival:undefined,
  island:{isCrossing:()=>false,setViewMode:noop,setCoveFocus:noop,crossIsland:()=>{throw Error('This local route must not sail')}},stopHarbour:noop,stopFishing:noop,stopWorkshop:noop,stopCookery:noop,stopArrangement:noop,playBaySound:noop,updateCommunityReturn:noop,
  app:{dataset:{}},toast:{},dialogFeedback:{},requestAnimationFrame:(fn:Function)=>frames.push(fn),saveFarm:()=>saves.push(structuredClone(farm)),
  drawPanel:()=>{state.panelRenderVersion++;visits.push(state.panel);detail=undefined;homeServices=undefined;buttons=[];html=state.panel==='garden-plans'?renderGardenPlans(farm,editor,()=>'<i></i>'):''
   if(state.panel==='rest'){
    state.renderHome()
    const services=(content as any).innerHTML.match(/<details class="home-rest-details home-rest-services"([^>]*)>([\s\S]*?)<\/details>/)
    assert.ok(services);homeServices={open:/\bopen\b/.test(services[1])}
    for(const match of services[2].matchAll(/<button[^>]*data-action="([^"]+)"([^>]*)>([^<]+)<\/button>/g)){
     buttons.push(new Button(match[1],match[2].match(/data-value="([^"]+)"/)?.[1]??'',match[3].trim(),homeServices))
    }
   }
   const section=html.match(/<details class="garden-supplies"([^>]*)>([\s\S]*?)<\/details>/)
   if(section){detail={open:/\bopen\b/.test(section[1])};for(const match of section[2].matchAll(/<button[^>]*data-action="([^"]+)"[^>]*data-value="([^"]*)"[^>]*>([^<]+)<\/button>/g))buttons.push(new Button(match[1],match[2],match[3],detail))}
  },
 }
 runInNewContext(code,state);state.drawPanel()
 const target=()=>buttons.find(b=>b.dataset.action==='travel-panel'&&b.dataset.value==='market')!
 const flush=()=>{while(frames.length)frames.shift()!()}
 const assertReadOnly=()=>{assert.deepEqual(farm,baseline);assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),baseline);assert.deepEqual(saves,[])}
 return{state,editor,farm,baseline,content,saves,visits,flush,target,assertReadOnly,get homeServices(){return homeServices},homeService:(name:string)=>buttons.find(button=>button.dataset.action===name),get detail(){return detail},get html(){return html},get focused(){return document.activeElement}}
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

test('the named HUD shortcut opens the active loaded page and its real seed deficit, unlike the general notebook', () => {
 const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
 const p=commissionPlayer(opening.slice(0,39)),editor=new GardenPlanEditor()
 for(const [slot,name,crop,beds] of [[0,'Для хлеба','wheat',[3]],[2,'Для борща','beetroot',[0,2]]] as const){
  assert.ok(editor.choose(slot)&&editor.begin(p.state));editor.draft!.name=name;editor.brush=crop
  for(const bed of beds)assert.ok(editor.paint(bed))
  assert.ok(editor.save(p.state).ok)
 }
 assert.ok(followGardenPlan(p.state,2,p.state.gardenPlans.revision).ok)
 assert.equal(p.state.seeds.beetroot,1);assert.ok(workBed(p.state,0).ok)
 const farm=restoreCurrentFarm(JSON.parse(JSON.stringify(p.state)))!,gardenEditor=new GardenPlanEditor()
 assert.equal(farm.seeds.beetroot,0);assert.equal(farm.beds[2].kind,'tilled');assert.equal(farm.gardenPlans.active,2)
 const before=structuredClone(farm)
 const branch=find(n=>ts.isIfStatement(n)&&n.expression.getText(ast)==='control.dataset.panel')
 const enter=ts.transpileModule(`function enter(control){${branch}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 let html=''
 const ctx:any={farm,gardenEditor,taskCard:{},dialog:{open:false},openPanel:(next:string)=>{assert.equal(next,'garden-plans');html=renderGardenPlans(farm,gardenEditor,()=> '')}}
 runInNewContext(enter,ctx)
 const token=`${farm.gardenPlans.revision}:${farm.gardenPlans.active}`
 const button=(named:boolean,plan=token)=>({dataset:{panel:'garden-plans',plan},matches:(q:string)=>named&&q==='.garden-mode',closest:()=>null})
 ctx.enter(button(true));assert.equal(gardenEditor.slot,2);assert.match(html,/<h2>Для борща<\/h2>/);assert.match(html,/Докупить на 5 монет/)
 gardenEditor.choose(0);ctx.enter(button(false));assert.equal(gardenEditor.slot,0);assert.match(html,/<h2>Для хлеба<\/h2>/)
 html='';ctx.enter(button(true,'0:2'));assert.equal(html,'');assert.equal(gardenEditor.slot,0)
 ctx.enter(button(true,`${farm.gardenPlans.revision}:0`));assert.equal(html,'');assert.equal(gardenEditor.slot,0)
 ctx.dialog.open=true;ctx.enter(button(true));assert.equal(html,'');ctx.dialog.open=false
 ctx.enter(button(true));assert.equal(gardenEditor.slot,2);assert.deepEqual(farm,before)
 assert.ok(followGardenPlan(farm,null,farm.gardenPlans.revision).ok);gardenEditor.choose(0);html=''
 const manual=structuredClone(farm);ctx.enter(button(true));assert.equal(html,'');assert.equal(gardenEditor.slot,0);assert.deepEqual(farm,manual)
})

test('Back from each ordinary Home service reopens that visit before restoring its scroll and original button',()=>{
 for(const service of ['kitchen','upgrades']){
  const h=harness();h.state.openPanel('rest',false)
  assert.equal(h.homeServices!.open,false);h.homeServices!.open=true;h.content.scrollTop=185
  const launcher=h.homeService(service)!;assert.ok(launcher);launcher.focus()
  h.state.openPanel(service);h.state.goBack(true)
  assert.equal(h.homeServices!.open,true);h.flush()
  assert.equal(h.content.scrollTop,185);assert.equal(h.focused,h.homeService(service));h.assertReadOnly()
 }
})
test('a closed Home group stays closed on Back, and newer navigation supersedes a queued Home return',()=>{
 const h=harness();h.state.openPanel('rest',false);h.state.closeButton.focus()
 h.state.openPanel('guide');h.state.goBack();h.flush()
 assert.equal(h.homeServices!.open,false);assert.equal(h.focused,h.state.closeButton)
 h.homeServices!.open=true;h.homeService('upgrades')!.focus();h.content.scrollTop=185
 h.state.openPanel('upgrades');h.state.goBack();h.state.openPanel('guide',false);h.flush()
 assert.equal(h.state.panel,'guide');assert.equal(h.focused,h.state.closeButton);assert.equal(h.content.scrollTop,0)
 h.state.openPanel('rest',false);assert.equal(h.homeServices!.open,false);h.assertReadOnly()
})
