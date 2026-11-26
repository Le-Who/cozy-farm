import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import { createServer } from './fixtures/ssr-vite.ts'
import * as F from '../src/farm.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'
import {selectedBookId} from '../src/recipe-book-view.ts'
import {signatureTastingGuide} from '../src/signature-tasting-guidance.ts'
import {isGuardedAction} from '../src/action-click-guard.ts'

function earned(mature=false){
  const steps=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
  const p=commissionPlayer(mature?steps:steps.slice(0,steps.findIndex((s:{name:string})=>s.name==='serveVillageMeal')))
  p.visit('home');p.act('selectSeed','wheat');p.act('buySeeds','wheat')
  const beds=[0,2,3,4];for(const i of beds)p.act('workBed',i)
  for(let day=0;p.state.produce.wheat<8 || p.state.eggs<4;day++){
    assert.ok(day<8)
    if(p.state.eggsReady)p.act('collectEggs')
    if(!p.state.chickensFed){if(!p.state.feed)p.act('buyFeed');p.act('feedChickens')}
    for(const i of beds){const a=F.getBedAction(p.state,i);if(a.kind==='water'&&!p.state.water)p.act('refillWater');if(a.kind==='water'||a.kind==='harvest')p.act('workBed',i)}
    if(p.state.produce.wheat>=8 && p.state.eggs>=4)break;p.night()
  }
  const id=p.cook();p.cook(id);p.act('tasteSignature',id,'bea');p.night();p.visit('village')
  if(!mature)assert.equal(p.actions,134);assert.equal(p.state.culinary.stock[id],1)
  return {farm:p.state,id}
}
const src=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
function part(start:string,end:string){const a=src.indexOf(start),b=src.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return src.slice(a,b)}
const cases=part("    case 'tasting-bakery':","    case 'supper-signature':")
  +part("    case 'resident-service':","    case 'finn-pier':")
function table(farm:F.FarmState,id:string){
  const visits:number[]=[],focus:string[]=[],receipts:string[]=[]
  const button={dataset:{value:id},focus(){focus.push(id)},scrollIntoView(){},getClientRects:()=>[{}]}
  const x={...F,selectedBookId,signatureTastingGuide,farm,dialog:{open:true,querySelectorAll:()=>[]},panel:'recipes',island:{isCrossing:()=>false,visit(target:{index:number}){visits.push(target.index)}},
    control:{dataset:{resident:'bea'}},value:id,pastryShape:'long',villageSlot:1,recipeBook:{view:{selectedId:id,mode:'detail'},restore(){},load(){}},panelRenderVersion:0,
    panelHistory:[] as any[],openPanel(next:string,remember=true){if(remember)x.panelHistory.push({panel:x.panel,recipeBook:{...x.recipeBook.view},signatureSlots:[],marketNextOpen:[]});x.panel=next},dialogContent:{querySelector:(q:string)=>q.startsWith('[data-action="taste-signature"]')?button:null,querySelectorAll:()=>[]},
    requestAnimationFrame:(cb:()=>void)=>cb(),restoreFerryPanelView(){},
    perform(act:()=>{ok:boolean;message:string},dismiss:boolean){const r=act();if(r.ok){if(dismiss){x.dialog.open=false;x.panelHistory.length=0};receipts.push(r.message)};return r.ok}}
  const commands=runInNewContext(stripTypeScriptTypes(part('function goBack(','let harbourScene:')+part('function activateTarget(', 'function useHotbar(')+';({click:(action)=>{switch(action){'+cases+'}},back:goBack})'),x)
  return {x,visits,focus,receipts,...commands}
}

test('the next jar is a real choice: stored bake first makes 4+4; tasting first makes 4+3 for the same goods',async()=>{
  const {farm,id}=earned(),p=table(farm,id),initial=structuredClone(farm),start=farm.handmade.round
  const server=await createServer({server:{middlewareMode:true},appType:'custom'})
  try{
    const {signatureBook}=await server.ssrLoadModule('/src/culinary-ui.ts')
    const art={icon:()=>'<img alt="">',stock:()=>'<li>Запас</li>'}
    const link=signatureBook(farm,art)
    assert.match(link,/class="dialog-button" data-action="tasting-bakery"[^>]*>.*?К Беа · выпечка ×4<\/button><button[^>]+class="dialog-button secondary"[^>]+data-action="taste-signature"/)
    assert.ok(isGuardedAction('tasting-bakery'))
    p.click('tasting-bakery');assert.deepEqual(p.visits,[0]);assert.equal(p.x.pastryShape,'round');assert.deepEqual(farm,initial)
    p.click('tasting-bakery');assert.deepEqual(p.visits,[0]);assert.equal(p.x.panel,'village')
    p.x.value='bea';p.click('resident-service');assert.equal(farm.handmade.round,start+4);assert.equal(farm.culinary.stock[id],1);assert.ok(p.x.dialog.open)
    p.back(true);assert.equal(p.x.panel,'recipes');assert.equal(p.focus.at(-1),id);assert.match(signatureBook(farm,art),/Угостить Беа/);assert.doesNotMatch(signatureBook(farm,art),/data-action="tasting-bakery"/)
    p.x.value=id;p.click('tasting-bakery');assert.deepEqual(p.visits,[0]);assert.equal(farm.culinary.stock[id],1)
    p.click('taste-signature');assert.match(p.receipts.at(-1),/ещё одно изделие/)
    const early=F.restoreCurrentFarm(initial)!,r=table(early,id)
    r.click('taste-signature');assert.match(r.receipts.at(-1),/Помощь Беа уже сохранена/);assert.doesNotMatch(r.receipts.at(-1),/ещё одно изделие/)
    assert.ok(F.runResidentService(early,'bea','round').ok)
    for(const f of [early,farm]){assert.ok(F.sail(f,'home').ok);assert.ok(F.endDay(f).ok);assert.ok(F.sail(f,'village').ok);assert.ok(F.runResidentService(f,'bea','round').ok);assert.deepEqual(F.restoreCurrentFarm(f),f)}
    assert.equal(early.handmade.round-start,7);assert.equal(farm.handmade.round-start,8);assert.equal(farm.culinary.stock[id],0)
    assert.deepEqual({...farm,handmade:{...farm.handmade,round:early.handmade.round}},early)
  }finally{await server.close()}
})

test('no shortcut for an unknown, spent, unstocked or unusable favor; stale dish/shore cannot start a visit',()=>{
  const {farm,id}=earned()
  for(const invalidate of [
    (f:F.FarmState)=>{f.culinary.tastings.bea.favoriteIds=[]},(f:F.FarmState)=>{f.culinary.stock[id]=0},
    (f:F.FarmState)=>{f.culinary.tastings.bea.bonus=false},(f:F.FarmState)=>{f.village.serviceOn.bea=f.day},
    (f:F.FarmState)=>{f.produce.wheat=3},(f:F.FarmState)=>{f.island='home'},
  ]){const f=structuredClone(farm);invalidate(f);const before=structuredClone(f),p=table(f,id);assert.equal(signatureTastingGuide(f,id,'bea')?.bakeFirst,undefined);p.click('tasting-bakery');assert.deepEqual(p.visits,[]);assert.deepEqual(f,before)}
  const stale=table(farm,id),before=structuredClone(farm);stale.x.value='wrong-id';stale.click('tasting-bakery');stale.click('taste-signature');assert.deepEqual(stale.visits,[]);assert.deepEqual(farm,before)
})

test('on the settled two-cottage farm, a preview can be left without losing the existing bake or spending the last jar',()=>{
  const {farm,id}=earned(true),before=structuredClone(farm),p=table(farm,id)
  assert.deepEqual(farm.village.residents,['bea','finn']);assert.ok(farm.village.meals>=2)
  assert.ok(signatureTastingGuide(farm,id,'bea')?.bakeFirst);assert.equal(signatureTastingGuide(farm,id,'finn')?.bakeFirst,undefined)
  p.click('tasting-bakery');p.back(true)
  assert.equal(p.x.panel,'recipes');assert.deepEqual(farm,before);assert.equal(p.focus.length,0)
  p.click('tasting-bakery');assert.deepEqual(p.visits,[0,0]);assert.deepEqual(farm,before)
})

test('first tasting opens a carried recipe for the named neighbor without handing it over',async()=>{
  const {getDiscoveryTask}=await import('../src/discovery-path.ts')
  const {RecipeBookNavigation,sortedBookRecipes}=await import('../src/recipe-book-view.ts')
  const steps=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
  const p=commissionPlayer(steps),food=p.cook();p.cook(food)
  p.fruit('apple',2);p.visit('village')
  const empty=p.act('completeSignature',{base:'preserves',ingredients:[{id:'apple',quantity:2}]},
    {family:'preserves',processing:'bright',fruit:[],steps:['stir','pour']}).recipeId as string
  p.shelf(empty);p.sale()
  const book=new RecipeBookNavigation(),task=()=>getDiscoveryTask(p.state,p.state.orientation)!
  assert.equal(task().id,'first-tasting');assert.equal(selectedBookId(p.state,book.view),empty)
  assert.equal(p.state.culinary.stock[empty],0);assert.equal(p.state.culinary.stock[food],2)
  const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
  try{
    const {signatureBook}=await server.ssrLoadModule('/src/culinary-ui.ts')
    let focus:string|undefined,html=''
    const route=runInNewContext(stripTypeScriptTypes('(action,value)=>{switch(action){'+
      part("    case 'visit-first-tasting':","    case 'tasting-bakery':")+'}}'),{
      get farm(){return p.state},residentIds:F.residentIds,recipeBook:book,selectedBookId,sortedBookRecipes,signatureTastingGuide,
      openRecipeBook(id:string){assert.ok(book.select(p.state,id));html=signatureBook(p.state,{icon:()=>'',stock:()=>''},book.view)},
      dialogContent:{querySelector:(q:string)=>q},highlightControl:(q:string)=>{focus=q},
    })
    function follow(resident:F.ResidentId,expected:string){
      const before=structuredClone(p.state),action=task().action
      assert.deepEqual([action.target,action.value],['visit-first-tasting',resident])
      route(action.target,action.value)
      assert.equal(book.view.selectedId,expected);assert.equal(book.view.mode,'detail')
      assert.equal(focus,`[data-action="taste-signature"][data-resident="${resident}"]:not(:disabled)`)
      assert.match(html,new RegExp(`<button[^>]+data-action="taste-signature" data-value="${expected}"(?![^>]* disabled)[^>]*data-resident="${resident}"`))
      assert.deepEqual(p.state,before,'arrival and repeated preview do not travel or spend')
    }
    follow('bea',food);follow('bea',food)
    // This separate user gesture is the only one that spends. The next suggestion belongs to Finn.
    const explicit=table(p.state,food);explicit.click('taste-signature');p.reload()
    assert.equal(p.state.culinary.stock[food],1);assert.equal(p.state.culinary.tastings.bea.visits,1)
    const before=structuredClone(p.state);focus=undefined;route('visit-first-tasting','bea')
    assert.equal(focus,undefined);assert.deepEqual(p.state,before)
    follow('finn',food)
    p.visit('home')
    assert.deepEqual(task().action,{label:'В Лавандовую гавань',target:'sail',value:'village'})
    const home=structuredClone(p.state);focus=undefined;route('visit-first-tasting','finn')
    assert.equal(focus,undefined);assert.deepEqual(p.state,home)
  }finally{await server.close()}
})
