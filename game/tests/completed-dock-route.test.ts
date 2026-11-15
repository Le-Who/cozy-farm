import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
import * as F from '../src/farm.ts'
import { ruPlural } from '../src/ru.ts'
import { getBerryNurserySource } from '../src/berry-nursery.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true)
const names=['button','quantity','row','nav','panelTabs','stockLabel','fishImage','requirementLink','deliveryItems','projectCard','marketCards','openPanel','goBack','focusKey']
const definitions=names.map(name=>{
  const node=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name)
  assert.ok(node,name);return node.getText(ast)
})
for(const name of ['dishIcons','pastryIcons']) {
  const node=ast.statements.find(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(ast)===name))
  assert.ok(node,name);definitions.push(node.getText(ast))
}
const clauses: string[]=[]
function visit(node: ts.Node) {
  if(ts.isCaseClause(node)&&["'project-dock'","'sail'"].includes(node.expression.getText(ast)))clauses.push(node.getText(ast))
  ts.forEachChild(node,visit)
}
visit(ast);assert.equal(clauses.length,2)
const code=ts.transpileModule(`${definitions.join('\n')}\nasync function activate(action,value){switch(action){${clauses.join('\n')}}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
function earned(commands=40) {return commissionPlayer(opening.slice(0,commands)).state}
const noop=()=>{}
function view(farm: F.FarmState, allowTravel=true) {
  const sourceButton={dataset:{action:'project-dock'},getClientRects:()=>[{}],focus:()=>{state.focused='project-dock'}}
  const state:Record<string,any>={
    ...F,farm,ruPlural,getBerryNurserySource,numberFormat:new Intl.NumberFormat('ru-RU'),requirementLinks:new Map(),
    icon:(name:string)=>`<img data-icon="${name}" alt="">`,itemIcon:(name:string)=>`<img data-icon="${name}" alt="">`,
    canSailTo:(f:F.FarmState,d:F.IslandId)=>allowTravel&&F.canSailTo(f,d),
    panel:'market',marketTab:'projects',panelHistory:[],panelRenderVersion:0,
    dialog:{open:true,showModal:noop,querySelectorAll:()=>state.panel==='market'?[sourceButton]:[]},
    dialogContent:{scrollTop:146,querySelectorAll:()=>[],querySelector:()=>null},
    island:{isCrossing:()=>false,setViewMode:noop,setCoveFocus:noop,crossIsland:async(fn:()=>unknown)=>{state.crossings++;return fn()}},
    fieldViewButton:{getAttribute:()=> 'false'},fieldLayout:{matches:false},canvas:{focus:noop},toggleFieldView:noop,
    salePresentation:{place:undefined},transplantSelection:{reset:noop},berryNurserySelection:{reset:noop},berryRenewalSelection:{reset:noop},gardenEditor:{reset:noop},recipeSurplusSelection:{reset:noop},
    stopHarbour:noop,stopFishing:noop,stopWorkshop:noop,stopCookery:noop,stopArrangement:noop,playBaySound:noop,
    app:{dataset:{}},toast:{},dialogFeedback:{},closeButton:{focus:()=>{state.focused='close'}},updateCommunityReturn:noop,
    recipeBook:{load:noop},restoreFerryPanelView:noop,requestAnimationFrame:(fn:()=>void)=>fn(),
    draws:0,saves:0,crossings:0,html:'',focused:'project-dock',
    rememberPanel:()=>({panel:state.panel,marketTab:state.marketTab,marketNextOpen:[],signatureSlots:[],scroll:state.dialogContent.scrollTop,focus:state.focusKey(sourceButton)}),
    drawPanel:()=>{state.draws++;state.html=state.panel==='market'?state.marketCards():state.projectCard('dock');state.panelRenderVersion++},
    closeDialog:()=>{state.dialog.open=false;state.panel=undefined;state.panelHistory.length=0},
    perform:(fn:()=>{ok:boolean})=>{const result=fn();if(result.ok)state.saves++;return result.ok},
  }
  runInNewContext(code,state)
  return state
}

test('earned completed dock outside Grove offers a truthful explicit destination, not an actionless history card',()=>{
  const farm=earned(),before=structuredClone(farm),s=view(farm)
  assert.equal(farm.day,4);assert.equal(F.isProjectComplete(farm,'dock'),true);assert.equal(farm.island,'home')
  const html=s.projectCard('dock')
  assert.match(html,/✓ Построено/)
  assert.match(html,/data-action="sail"[\s\S]*?data-value="grove"[^>]*>В рощу к причалу/)
  assert.doesNotMatch(html,/<(?:details|summary)\b/)
  assert.deepEqual(farm,before)
})

test('actual Market entry only opens the preview; actual Back restores projects, scroll and source focus without a save',async()=>{
  const farm=earned(),before=structuredClone(farm),s=view(farm)
  await s.activate('project-dock')
  assert.equal(s.panel,'dock-project');assert.equal(s.panelHistory.length,1)
  assert.match(s.html,/В рощу к причалу/);assert.equal(s.saves,0);assert.equal(s.crossings,0);assert.deepEqual(farm,before)
  s.goBack()
  assert.equal(s.panel,'market');assert.equal(s.marketTab,'projects');assert.equal(s.dialogContent.scrollTop,146)
  assert.equal(s.focused,'project-dock');assert.equal(s.panelHistory.length,0)
  assert.match(s.html,/Причал рощи/);assert.match(s.html,/Путь на Цветочный мыс открыт/);assert.match(s.html,/Лавандовая гавань/)
  assert.equal(s.saves,0);assert.deepEqual(farm,before)
})

test('only the second explicit travel action sails once, preserving stock, progress, coins and completed history',async()=>{
  const farm=earned(),before=structuredClone(farm),s=view(farm)
  await s.activate('project-dock');assert.deepEqual(farm,before)
  await s.activate('sail','grove')
  const expected=structuredClone(before);expected.island='grove'
  assert.deepEqual(farm,expected);assert.equal(s.saves,1);assert.equal(s.crossings,1)
  assert.ok(F.restoreCurrentFarm(structuredClone(farm)))
  await s.activate('sail','grove');assert.equal(s.saves,1);assert.equal(s.crossings,1);assert.deepEqual(farm,expected)
})

test('an unavailable destination is disabled and the existing controller rejects a stale travel action',async()=>{
  const farm=earned(),before=structuredClone(farm),s=view(farm,false)
  const html=s.projectCard('dock')
  assert.match(html,/data-action="sail"[\s\S]*?data-value="grove"[^>]*disabled>В рощу к причалу/)
  await s.activate('project-dock');await s.activate('sail','grove')
  assert.equal(s.panel,'dock-project');assert.equal(s.crossings,0);assert.equal(s.saves,0);assert.deepEqual(farm,before)
})

test('completed dock in Grove retains Cape travel, with no duplicate build or delivery action',()=>{
  const farm=earned();assert.equal(F.sail(farm,'grove').ok,true)
  const before=structuredClone(farm),s=view(farm),html=s.projectCard('dock')
  assert.match(html,/data-action="sail"[\s\S]*?data-value="cape"[^>]*>На Цветочный мыс/)
  assert.doesNotMatch(html,/data-action="deliver-project"|В рощу к причалу/)
  assert.deepEqual(farm,before)
})

test('unfinished dock, fair contribution and completed fair remain unchanged',()=>{
  const early=earned(17),s=view(early)
  assert.match(s.projectCard('dock'),/>К причалу рощи\s*</)
  assert.doesNotMatch(s.projectCard('dock'),/В рощу к причалу|✓ Построено/)
  assert.match(s.projectCard('fair'),/>Улучшения/)
  const ready=view(earned());assert.match(ready.projectCard('fair'),/data-action="deliver-project"[\s\S]*?data-value="fair"[^>]*>Внести припасы/)
  const complete=view(earned(58)),html=complete.projectCard('fair')
  assert.match(html,/✓ Построено/);assert.doesNotMatch(html,/<button\b/)
  assert.match(complete.marketCards(),/data-action="workshop"/)
})
