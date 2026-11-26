import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes as strip} from 'node:module'
import {test} from 'node:test'
import {runInNewContext as vm} from 'node:vm'
import * as F from '../src/farm.ts'
import * as N from '../src/berry-nursery.ts'
import * as R from '../src/berry-renewal-ui.ts'
import {GardenPlanEditor} from '../src/garden-plans-ui.ts'
import {isGuardedAction} from '../src/action-click-guard.ts'
import {berryNurseryPlayer} from './fixtures/berry-nursery-player.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const main=read('../src/main.ts')
function segment(start:string,end:string) {
  const a=main.indexOf(start),b=main.indexOf(end,a+start.length)
  assert.ok(a>=0 && b>a,start)
  return main.slice(a,b)
}
const handler=strip('(async()=>{switch(action){'+segment("    case 'berry-renewal-confirm':","    case 'berry-nursery-source':")+'}})()')
const link=strip(segment('function requirementLink(','const islandNames'))+"; requirementLink('Росная черника',request,'ingredients','Росная черника')"
const openHistory=strip(segment('  if(remember&&next!==panel){','  if (remember && next'))
const opener=strip('(next,remember=true)=>{'+openHistory+segment('  if (next !== panel) { transplantSelection.reset();','  if (next !== panel && next')+'panel=next}')
const request={kind:'stock' as const,item:{kind:'variants' as const,item:'blueberry' as const,trait:'dew' as const,quantity:1}}
function earned(last?:'empty'|'tilled',second=false) {
  const n=berryNurseryPlayer(JSON.parse(read('./fixtures/home-progress-actions.json'))),p=n.p
  p.act('harvestBerryAndKeep',F.getBerryRenewalPreview(p.state,0)!.token)
  const recipe=n.cook()
  n.grow();p.fruit('apple',1)
  if(second){
    const room=p.state.beds.findIndex(bed=>bed.kind==='tilled')
    assert.ok(room>=0);n.divide(0,room);n.grow()
  }
  const gap=p.state.beds.findIndex(bed=>bed.kind==='empty')
  assert.ok(gap>=0)
  for(const [i,bed] of p.state.beds.entries()) {
    if(bed.kind==='crop')continue
    if(i===gap&&last==='empty'){assert.equal(bed.kind,'empty');continue}
    if(bed.kind==='empty')p.act('workBed',i)
    if(i===gap&&last==='tilled')continue
    const seed=F.cropIds.find(c=>p.state.seeds[c]>0)
    if(!seed)p.act('buySeeds','carrot')
    p.act('selectSeed',seed??'carrot');p.act('workBed',i)
  }
  assert.equal(p.state.day,second?23:20)
  assert.equal(F.ingredientCount(p.state,request.item),0)
  assert.ok(p.state.fruit.apple>0)
  assert.equal(N.getBerryNurserySource(p.state,request.item),0)
  assert.equal(p.state.beds.filter(bed=>bed.kind==='crop').length,last?15:16)
  assert.ok(p.state.culinary.recipes.some(r=>r.id===recipe && r.ingredients.some(i=>i.id==='blueberry'&&i.trait==='dew')))
  return {p,recipe}
}
function mount(farm:F.FarmState,recipe:string){
  const visits:string[]=[],focus:string[]=[],history:unknown[]=[],openCalls:string[]=[]
  const selection=new R.BerryRenewalSelection(),nursery=new N.BerryNurserySelection()
  let motion:undefined|{index:number;valid:()=>string;finish:()=>void},draws=0,focusPart=''
  const control={dataset:{action:'berry-nursery-ingredient',value:'0'},
    focus(options:{preventScroll:true}){assert.equal(options.preventScroll,true);focusPart='ingredient';focus.push(focusPart)}}
  const root={scrollTop:57,contains:(button:unknown)=>button===control,querySelector(key:string){
    assert.equal(key,'.transplant-step')
    return {focus(options:{preventScroll:true}){assert.equal(options.preventScroll,true);focusPart='heading';focus.push(focusPart)}}
  }}
  type PanelState='recipes'|'signature'|'berry-nursery'|'berry-renewal'
  const ctx={
    ...F,...N,...R,farm,request,panel:'recipes' as PanelState,dialog:{open:true},dialogContent:root,control,
    panelHistory:history,gardenEditor:new GardenPlanEditor(),transplantSelection:{reset(){}},berryNurserySelection:nursery,berryRenewalSelection:selection,
    recipe, requirementLinks:new Map(),bayProductId:()=> 'variant:blueberry:dew',
    action:'berry-nursery-ingredient',value:'0',closeDialog(){ctx.dialog.open=false;selection.reset()},
    rememberPanel(){return{panel:ctx.panel,scroll:root.scrollTop,focus:focusPart,recipe:ctx.recipe}},
    openPanel(next:string){openCalls.push(next);return open(next)},
    async visitPanelAt(port:'home',next:string){
      visits.push(port+':'+next)
      if(farm.island!==port)assert.ok(F.sail(farm,port).ok)
      open(next)
    },
    drawPanel(){draws++},
    island:{workBed(index:number,valid:()=>string,finish:()=>void){motion={index,valid,finish}}},
    bedWorkSound(){return undefined},perform(fn:()=>{ok:boolean}){return fn().ok}
  }
  // Same-panel history and reset slices are taken from production openPanel.
  const open=vm(opener,ctx) as (panel:string)=>void
  const markup=vm(link,ctx) as string
  assert.match(markup,/data-action="berry-nursery-ingredient" data-value="0"/)
  const act=async()=>await vm(handler,ctx)
  return{ctx,act,history,visits,focus,openCalls,get motion(){return motion},get draws(){return draws}}
}
test('the earned full home garden previews preserving the exact ingredient without working the land or spending',async()=>{
  const {p,recipe}=earned(),f=p.state,before=structuredClone(f),ui=mount(f,recipe)
  assert.deepEqual([p.actions,f.coins],[139,61])
  const ordinary=structuredClone(f)
  assert.ok(F.workBed(ordinary,0).ok)
  assert.equal(ordinary.beds[0].kind,'tilled')
  assert.equal(ordinary.produce.blueberry-f.produce.blueberry,2)
  assert.equal(F.ingredientCount(ordinary,request.item),1)
  await ui.act()
  assert.equal(ui.ctx.panel,'berry-renewal','full Home garden must not land on a nursery without a usable bed')
  assert.deepEqual(ui.openCalls,['berry-renewal']);assert.deepEqual(ui.visits,[])
  assert.deepEqual(ui.history,[{panel:'recipes',scroll:57,focus:'ingredient',recipe}])
  assert.deepEqual(ui.focus,['ingredient','heading']);assert.equal(ui.ctx.dialogContent.scrollTop,0)
  assert.equal(ui.ctx.berryRenewalSelection.selected?.index,0)
  const html=R.renderBerryRenewal(f,ui.ctx.berryRenewalSelection,()=> '')
  assert.match(html,/Грядка 1 · Сохранить посадку\?/)
  assert.equal((html.match(/data-action="berry-renewal-confirm"/g)??[]).length,1)
  assert.match(html,/data-action="berry-renewal-bed"/,'physical ordinary harvest remains a choice')
  assert.ok(isGuardedAction('berry-renewal-confirm'))
  assert.equal(ui.motion,undefined);assert.deepEqual(f,before)
})
test('the existing explicit confirmation takes one rare berry and restarts the same living crop; the recipe stays manual',async()=>{
  const {p,recipe}=earned(),f=p.state,before=structuredClone(f),ui=mount(f,recipe)
  await ui.act()
  const selected=ui.ctx.berryRenewalSelection.selected
  assert.ok(selected)
  ui.ctx.action='berry-renewal-confirm';ui.ctx.value=selected.token;await ui.act()
  assert.equal(ui.motion?.index,0);assert.equal(ui.motion?.valid(),'harvest')
  assert.deepEqual(f,before,'only the separate physical work callback commits')
  ui.motion?.finish()
  assert.deepEqual(f.beds[0],{kind:'crop',crop:'blueberry',growth:0,watered:F.getBedAction(f,0).kind==='wait',trait:'dew'})
  assert.deepEqual(f.beds.slice(1),before.beds.slice(1))
  assert.equal(F.ingredientCount(f,request.item),1)
  assert.equal(f.produce.blueberry,before.produce.blueberry)
  assert.equal(f.coins,before.coins);assert.equal(f.day,before.day)
  assert.deepEqual(f.culinary,before.culinary)
  const after=structuredClone(f);ui.motion?.finish(); assert.deepEqual(f,after)
  p.reload()
  assert.equal(p.act('repeatSignature',recipe).recipeId,recipe)
  assert.equal(F.ingredientCount(p.state,request.item),0)
})
test('reachable empty space keeps multiplication; stale or disconnected full-bed actions do not open a review',async()=>{
  for(const last of ['empty','tilled'] as const){
    const {p,recipe}=earned(last),before=structuredClone(p.state),ui=mount(p.state,recipe)
    await ui.act()
    assert.equal(ui.ctx.panel,'berry-nursery')
    assert.equal(ui.ctx.berryNurserySelection.selected?.source,last==='tilled'?0:undefined)
    assert.deepEqual(p.state,before)
  }
  for(const stale of ['existing stock','detached click'] as const) {
    const {p,recipe}=earned(undefined,stale==='existing stock'),ui=mount(p.state,recipe)
    if(stale==='existing stock'){
      assert.ok(F.harvestBerryAndKeep(p.state,F.getBerryRenewalPreview(p.state,0)!.token).ok)
      assert.equal(F.ingredientCount(p.state,request.item),1)
      assert.ok(N.getBerryNurserySource(p.state,request.item)!>0,'a second matching ripe source still exists')
    } else ui.ctx.dialogContent.contains=()=>false
    const before=structuredClone(p.state)
    await ui.act()
    assert.equal(ui.ctx.panel,'recipes');assert.equal(ui.motion,undefined)
    assert.deepEqual(p.state,before)
  }
})
