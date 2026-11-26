import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { completeSignature, deliverSignature, endDay, forgetSignature, getVillageHomeCount, inviteResident, restoreFarm, serveVillageMeal, bakeWorkshop, sellSignature, sail, getVillageMeal, workshopShapes, workshopDefinitions, residentIds, residentDefinitions, getResidentService, getBeaPastryCount, getWorkshopAction, workshopIngredients } from '../src/farm.ts'
import { getDiscoveryTask } from '../src/discovery-path.ts'
import { getReadySignatureSuppers, getSupperFishFork, renderSupperFishFork, tableSupperFish, renderSignatureSuppers, renderSupperResult, supperCottageReady } from '../src/shared-supper.ts'
import { isGuardedAction, ActionClickGuard, ActivationKeyGuard } from '../src/action-click-guard.ts'
import { sharedSupperFixture } from './fixtures/shared-supper.ts'

const seen = {collections:true,islands:true}
const picture = () => '<span>Блюдо</span>'

test('a ready signature and fish lead to the table without extra pastry or automatic spending', () => {
  const farm = sharedSupperFixture(), before = structuredClone(farm)
  const choices = getReadySignatureSuppers(farm)
  assert.equal(choices.length, 1)
  assert.equal(choices[0].count, 2)
  assert.equal(choices[0].fish, 'perch')
  assert.equal(choices[0].available, true)
  assert.equal(getDiscoveryTask(farm, seen)?.action.target, 'village-meal')
  assert.match(getDiscoveryTask(farm, seen)!.detail, /1 порцию.*1 рыбой/)
  for(let i=0;i<5;i++)renderSignatureSuppers(farm,picture)
  assert.deepEqual(farm, before)
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(restored)
  assert.deepEqual(getReadySignatureSuppers(restored), choices)
})

test('one explicit signature supper spends exactly one chosen portion and fish, with no repeat or coin reward', () => {
  const farm = sharedSupperFixture(), id = farm.culinary.recipes[0].id, before = structuredClone(farm)
  assert.equal(deliverSignature(farm, id).ok, true)
  assert.equal(farm.culinary.stock[id], before.culinary.stock[id]-1)
  assert.equal(farm.fish.perch, before.fish.perch-1)
  assert.equal(farm.fish.seaBass, before.fish.seaBass)
  assert.equal(farm.coins, before.coins)
  assert.equal(farm.village.meals, 2)
  assert.equal(farm.village.mealOn, farm.day)
  assert.equal(getVillageHomeCount(farm), 2)
  assert.deepEqual(farm.culinary.tastings, before.culinary.tastings)
  assert.deepEqual(farm.neighbors, before.neighbors)
  const after = structuredClone(farm)
  assert.equal(deliverSignature(farm,id).ok, false)
  assert.equal(serveVillageMeal(farm,'round').ok, false)
  assert.deepEqual(farm, after)
  assert.equal(renderSignatureSuppers(farm,picture), '')
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))))
})

test('handmade and signature dishes share the same day limit, which survives reload and resets only after actual rest', () => {
  const farm = sharedSupperFixture(), id = farm.culinary.recipes[0].id
  farm.handmade.round=1
  assert.equal(serveVillageMeal(farm,'round').ok,true)
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(restored)
  const before = structuredClone(restored)
  assert.equal(deliverSignature(restored,id).ok,false)
  assert.deepEqual(restored,before)
  restored.island='home';assert.equal(endDay(restored).ok,true);restored.island='village'
  assert.equal(getReadySignatureSuppers(restored)[0].available,true)
  assert.equal(deliverSignature(restored,id).ok,true)
  assert.equal(restored.village.meals,3)
  assert.equal(restored.culinary.stock[id],1)
  assert.equal(restored.fish.perch,0)
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(restored))))
})

test('missing ordinary fish disables service and directs preparation to fish rather than another pastry', () => {
  const farm = sharedSupperFixture(), id = farm.culinary.recipes[0].id
  farm.fish.perch=0;farm.fish.seaBass=0
  const before=structuredClone(farm)
  assert.equal(getReadySignatureSuppers(farm)[0].available,false)
  assert.notEqual(getDiscoveryTask(farm,seen)?.action.target,'workshop')
  assert.equal(deliverSignature(farm,id).ok,false)
  assert.deepEqual(farm,before)
  assert.match(renderSignatureSuppers(farm,picture), /disabled.*1 рыба — окунь/)
  farm.fish.seaBass=2
  assert.equal(getReadySignatureSuppers(farm)[0].fish,'seaBass','Bea accepts the bought ordinary catch too')
  farm.village.residents=['finn',null]
  assert.equal(getReadySignatureSuppers(farm)[0].fish,'seaBass')
  assert.equal(getReadySignatureSuppers(farm)[0].available,true)
  assert.match(renderSignatureSuppers(farm,picture), /морской окунь/)
  assert.equal(deliverSignature(farm,id).ok,true)
  assert.equal(farm.fish.seaBass,1)
  assert.equal(farm.fish.perch,0)
})

test('spent or deleted recipes cannot consume fish through stale supper controls', () => {
  const farm=sharedSupperFixture(),id=farm.culinary.recipes[0].id
  farm.culinary.stock[id]=0
  assert.deepEqual(getReadySignatureSuppers(farm),[])
  assert.equal(getDiscoveryTask(farm,seen)?.action.target,'workshop')
  let before=structuredClone(farm)
  assert.equal(deliverSignature(farm,id).ok,false)
  assert.deepEqual(farm,before)
  assert.equal(forgetSignature(farm,id).ok,true)
  before=structuredClone(farm)
  assert.equal(deliverSignature(farm,id).ok,false)
  assert.deepEqual(farm,before)
  assert.equal(renderSignatureSuppers(farm,picture),'')
})

test('a ready dish on another shore routes to the harbour and never serves remotely', () => {
  const farm=sharedSupperFixture(),id=farm.culinary.recipes[0].id
  farm.island='home';const before=structuredClone(farm)
  assert.equal(getReadySignatureSuppers(farm)[0].available,false)
  assert.deepEqual(getDiscoveryTask(farm,seen)?.action,{label:'В Лавандовую гавань',target:'sail',value:'village'})
  assert.equal(deliverSignature(farm,id).ok,false)
  assert.deepEqual(farm,before)
})

test('the exact selected recipe is spent without touching other portions, and custom names are escaped', () => {
  const farm=sharedSupperFixture(), first=farm.culinary.recipes[0]
  farm.fruit.pear=2
  const made=completeSignature(farm,{base:'tart',ingredients:[{id:'pear',quantity:2}]},{...structuredClone(first.result),fruit:[{ingredientId:'pear',x:0,y:0,angle:0}]})
  assert.equal(made.ok,true)
  const id=made.recipeId!,recipe=farm.culinary.recipes.find(recipe=>recipe.id===id)!
  recipe.name='Тарт & "груша"'
  assert.ok(restoreFarm(farm))
  assert.match(renderSignatureSuppers(farm,picture), /Тарт &amp; &quot;груша&quot;/)
  const firstCount=farm.culinary.stock[first.id],chosenCount=farm.culinary.stock[id]
  assert.equal(deliverSignature(farm,id).ok,true)
  assert.equal(farm.culinary.stock[first.id],firstCount)
  assert.equal(farm.culinary.stock[id],chosenCount-1)
})

test('both supper gestures protect redraw against double click and held activation', () => {
  for(const action of ['supper-signature','share-meal','supper-cottage'])assert.equal(isGuardedAction(action),true)
  const clicks=new ActionClickGuard()
  clicks.remember({detail:1,timeStamp:100,clientX:20,clientY:40})
  assert.equal(clicks.blocks({detail:2,timeStamp:160,clientX:20,clientY:40}),true)
  const keys=new ActivationKeyGuard()
  assert.equal(keys.blocks({key:'Enter',repeat:false},true),false)
  assert.equal(keys.blocks({key:'Enter',repeat:true},false),true)
  keys.release('Enter')
  assert.equal(keys.blocks({key:'Enter',repeat:false},false),false)
})

test('both real dinner commands keep the earned choice; only a separate visit opens vacant cottage 2', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
  const between = (start: string, end: string) => {
    const a = main.indexOf(start), b = main.indexOf(end, a + start.length)
    assert.ok(a >= 0 && b > a)
    return main.slice(a,b)
  }
  const route = between("    case 'supper-signature':", "    case 'cove-choice':")
    + main.split('\n').find(line => line.startsWith("    case 'share-meal':"))!
  const code = stripTypeScriptTypes(between('function finishSharedSupper(', 'function neighboursCard(')
    + between('function activateTarget(', 'function useHotbar(')
    + `switch (command) {${route}}`)
  for (const command of ['share-meal','supper-signature']) {
    const farm = sharedSupperFixture('manual'), before = structuredClone(farm)
    const id = farm.culinary.recipes[0].id, home = '<button data-action="sail" data-value="home">Домой</button>'
    const visits: string[] = []
    let focused = false
    const context = { farm, command, value: id, pastryShape: 'round', deliverSignature, serveVillageMeal,
      panel: 'village-meal', villageSlot: 0, supperCottageReady,
      dialogContent: { scrollTop: 99, innerHTML: '', querySelector: (selector: string) => selector === '[data-supper-result]' ? { focus: () => { focused=true } } : null },
      perform(action: () => {ok:boolean}, dismiss: boolean) {
        const {ok} = action()
        if (ok && dismiss) context.panel = ''
        if (ok) context.dialogContent.innerHTML = renderSupperResult(farm,'',home)
        return ok
      },
      island: { isCrossing: () => false, visit: (target: {kind:string, index:number}) => visits.push(target.kind + ':' + target.index) },
      openPanel: (next: string) => { context.panel=next },
    }
    assert.equal(supperCottageReady(farm),false)
    assert.equal(renderSupperResult(farm,'',home),'')
    runInNewContext(code,context)
    assert.equal(context.panel,'village-meal'); assert.equal(focused,true); assert.equal(context.dialogContent.scrollTop,0)
    assert.match(context.dialogContent.innerHTML,/data-action="supper-cottage">К домику 2/); assert.ok(context.dialogContent.innerHTML.includes(home))
    assert.equal(farm.village.meals,2); assert.equal(farm.fish.perch,before.fish.perch-1)
    assert.equal(farm.handmade.round,before.handmade.round-(command==='share-meal'?1:0))
    assert.equal(farm.culinary.stock[id],before.culinary.stock[id]-(command==='supper-signature'?1:0))
    assert.deepEqual(farm.village.residents,['bea',null]); assert.deepEqual(visits,[])
    const paid = structuredClone(farm); context.command='supper-cottage'
    runInNewContext(code,context)
    assert.equal(context.panel,'village'); assert.equal(context.villageSlot,1); assert.deepEqual(visits,['village-home:1'])
    assert.deepEqual(farm,paid,'visiting neither invites, spends nor sails')
    runInNewContext(code,context); assert.equal(visits.length,1,'old table click cannot activate in a house')
    assert.equal(inviteResident(farm,'finn',1).ok,true); context.panel='village-meal'
    runInNewContext(code,context); assert.equal(visits.length,1,'occupied house is no longer offered')
    assert.doesNotMatch(renderSupperResult(farm,'',home),/supper-cottage/); assert.ok(renderSupperResult(farm,'',home).includes(home))
  }
})

test('tomorrow’s cottage table starts on the ready pastry, not yesterday’s spent shape',()=>{
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const between=(a:string,b:string)=>{const from=main.indexOf(a),to=main.indexOf(b,from+a.length);assert.ok(from>=0&&to>from);return main.slice(from,to)}
  const js=stripTypeScriptTypes(between('function pastryChoices()', 'function villageProjectCard()')
    +between('function neighboursCard()','let selectedWarehouseRequest')
    +between('function openPanel(', 'function openRecipeBook(')
    +between('function goBack(', 'let harbourScene:')
    +"\nfunction draw(){switch(panel){"+between("    case 'village': dialogContent.innerHTML = neighboursCard()", "    case 'fishing': {")+"}}"
    +"\n;({draw,goBack,openDinner(){switch('village-meal'){"+between("    case 'village-meal':\n      if (value", "    case 'build-village':")+"}}})")
  const farm=sharedSupperFixture('manual'),noop=()=>{},slot=0
  const history:unknown[]=[],reset={reset:noop}
  const ctx:any={farm,panel:'village',value:undefined,pastryShape:'round',villageSlot:slot,dialog:{open:true,querySelectorAll:()=>[]},
    panelHistory:history,panelRenderVersion:1,dialogContent:{innerHTML:'',scrollTop:30,querySelector:()=>null,querySelectorAll:()=>[]},
    getVillageMeal,getVillageHomeCount,workshopShapes,workshopDefinitions,residentIds,residentDefinitions,getResidentService,getBeaPastryCount,getWorkshopAction,workshopIngredients,getFinnFishingRoute:noop,
    getReadySignatureSuppers,getSupperFishFork,renderSupperFishFork,tableSupperFish,renderSignatureSuppers,renderSupperResult,supperCottageReady,
    signatureResultPicture:()=>'',renderHarbourFishChoice:()=>'',pastryIcons:{},villageHomeProgress:()=>'',neighborHelpCard:()=>'',
    icon:()=>'',stockTile:()=>'',button:(label:string,action:string,enabled=true)=>`<button data-action="${action}"${enabled?'':' disabled'}>${label}</button>`,
    nav:(...parts:string[])=>parts.join(''),app:{dataset:{}},toast:{},dialogFeedback:{},island:{isCrossing:()=>false,setViewMode:noop,setCoveFocus:noop},
    salePresentation:{},transplantSelection:reset,berryNurserySelection:reset,berryRenewalSelection:reset,gardenEditor:reset,recipeSurplusSelection:reset,
    stopHarbour:noop,stopFishing:noop,stopWorkshop:noop,stopCookery:noop,stopArrangement:noop,playBaySound:noop,updateCommunityReturn:noop,
    closeButton:{focus:noop},recipeBook:{load:noop},restoreFerryPanelView:noop,requestAnimationFrame:(f:()=>void)=>f(),
    rememberPanel(){return {panel:ctx.panel,pastryShape:ctx.pastryShape,villageSlot:slot,signatureSlots:[],marketNextOpen:[],scroll:ctx.dialogContent.scrollTop}},
    drawPanel(){ui.draw()},
  }
  const ui=runInNewContext(js,ctx)
  assert.ok(bakeWorkshop(farm,'folded').ok)
  assert.ok(serveVillageMeal(farm,'round').ok)
  ui.draw()
  assert.match(ctx.dialogContent.innerHTML,/Ужин завтра/)
  assert.doesNotMatch(ctx.dialogContent.innerHTML,/data-action="village-meal"/,'the served-day cottage has no dinner action')

  assert.ok(sail(farm,'home').ok)
  const recipe=farm.culinary.recipes[0]
  assert.ok(sellSignature(farm,recipe.id,farm.culinary.stock[recipe.id]).ok,'only manual pastry remains')
  assert.ok(endDay(farm).ok);assert.ok(sail(farm,'village').ok)
  assert.equal(getVillageMeal(farm,'round').available,false);assert.equal(getVillageMeal(farm,'folded').available,true)
  assert.equal(getVillageMeal(farm).served,false)
  const before=structuredClone(farm)
  ui.draw()
  assert.match(ctx.dialogContent.innerHTML,/data-action="village-meal">Накрыть стол/)
  ui.openDinner()
  assert.equal(ctx.panel,'village-meal')
  assert.match(ctx.dialogContent.innerHTML,/<button data-action="share-meal">Подать выпечку/)
  assert.match(ctx.dialogContent.innerHTML,/data-action="pastry-shape" data-value="folded" aria-pressed="true"/)
  assert.deepEqual(farm,before,'opening the table consumes neither a pastry nor a fish')
  ui.goBack(true)
  assert.equal(ctx.panel,'village');assert.equal(ctx.pastryShape,'round','restore the cottage’s own shape')
  assert.deepEqual(farm,before)
})
