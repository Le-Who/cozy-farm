import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {createServer} from 'vite'
import * as book from '../src/recipe-book-view.ts'
import {nameSignature, favoriteSignature, restoreCurrentFarm} from '../src/farm.ts'
import {rememberRecipeDraft} from '../src/recipe-draft.ts'
import {earnedRecipeBookPlayer} from './fixtures/earned-recipe-book.ts'

const art={icon:()=>'<img alt="">',stock:()=>'<li>ingredient</li>'}
const indexed=(html:string)=>[...html.matchAll(/class="recipe-book-select" data-action="select-recipe" data-value="([^"]+)"/g)].map(match=>match[1])
async function render(run:(ui:any)=>Promise<void>|void){const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});try{await run(await server.ssrLoadModule('/src/culinary-ui.ts'))}finally{await server.close()}}

test('earned index narrows ten entries by name without retargeting the selected exact recipe',async()=>{
 const p=earnedRecipeBookPlayer(),farm=p.state,before=structuredClone(farm)
 await render(({signatureBook})=>{
  const html=signatureBook(farm,art,{mode:'index',selectedId:'s1',query:'яблоко груша'})
  assert.deepEqual(indexed(html),['s9','s6','s3'])
  assert.match(html,/data-selected-recipe="s1"/)
  assert.match(html,/data-action="make-signature" data-value="s1"/)
  assert.match(html,/type="search"[^>]*data-recipe-query/)
  assert.match(html,/Найдено 3 из 10/)
  assert.equal((html.match(/data-action="new-signature"/g)||[]).length,2)
  assert.match(html,/Рецептов в книге: 10 из 24/)
 })
 assert.deepEqual(farm,before)
})

test('the ephemeral controller preserves exact selection, detail state, favorite ordering and query through Back',()=>{
 const p=earnedRecipeBookPlayer(),farm=p.state,nav=new book.RecipeBookNavigation()
 nav.select(farm,'s3',true,true);nav.view.detailScroll=65;nav.view.disclosures=['picnic-offer'];nav.view.indexScroll=220
 nav.setQuery('яблоко груша')
 assert.equal(nav.view.indexScroll,0);assert.equal(nav.view.detailScroll,65)
 assert.equal(nav.view.selectedId,'s3');assert.deepEqual(nav.view.disclosures,['picnic-offer'])
 assert.ok(favoriteSignature(farm,'s3',true).ok)
 assert.deepEqual(book.visibleBookRecipes(farm,nav.view).map(r=>r.id),['s3','s9','s6'])
 const saved=structuredClone(nav.view);nav.index();assert.equal(nav.view.query,'яблоко груша')
 nav.setQuery('персик');assert.equal(nav.view.selectedId,'s3')
 nav.load(saved);assert.deepEqual(nav.view,saved)
 nav.setQuery('');assert.equal(book.visibleBookRecipes(farm,nav.view).length,10)
 assert.equal(nav.view.selectedId,'s3')
})

test('name search uses the market normalization pattern but retains duplicate names as distinct IDs',()=>{
 const p=earnedRecipeBookPlayer(),farm=p.state,nav=new book.RecipeBookNavigation()
 assert.ok(nameSignature(farm,'s10','Мёд к чаю').ok)
 const before=structuredClone(farm)
 nav.setQuery('  МЕД\t ЧАЮ  ');assert.deepEqual(book.visibleBookRecipes(farm,nav.view).map(r=>r.id),['s10'])
 nav.setQuery('конфитюр груша яблоко');assert.deepEqual(book.visibleBookRecipes(farm,nav.view).map(r=>r.id),['s9','s6','s3'])
 nav.setQuery('X'.repeat(101));assert.equal(nav.view.query!.length,100)
 nav.setQuery('');assert.deepEqual(farm,before);assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),before)
})

test('empty search keeps create, capacity and the saved draft visible, and escapes typed text',async()=>{
 const p=earnedRecipeBookPlayer(),farm=p.state
 assert.ok(rememberRecipeDraft(farm,{base:'tart',slots:[{id:'apple',quantity:1},null],activeSlot:1}))
 const before=structuredClone(farm)
 await render(({signatureBook})=>{
  const html=signatureBook(farm,art,{mode:'index',selectedId:'s1',query:'"<nothing>'})
  assert.deepEqual(indexed(html),[])
  assert.match(html,/По этому названию рецептов нет/)
  assert.match(html,/data-action="select-recipe" data-value="draft"/)
  assert.equal((html.match(/data-action="new-signature"/g)||[]).length,2)
  assert.match(html,/value="&quot;&lt;nothing&gt;"/)
  assert.match(html,/Найдено 0 из 10/)
  assert.match(html,/data-action="make-signature" data-value="s1"/)
 })
 assert.deepEqual(farm,before)
})

test('renaming out of a filter does not choose a replacement, and explicit deletion retains the query safely',()=>{
 const p=earnedRecipeBookPlayer(),farm=p.state,nav=new book.RecipeBookNavigation()
 nav.select(farm,'s1',false,true);nav.setQuery('яблоко')
 assert.ok(nameSignature(farm,'s1','Первый к чаю').ok);nav.reconcile(farm)
 assert.equal(nav.view.selectedId,'s1');assert.ok(!book.visibleBookRecipes(farm,nav.view).some(r=>r.id==='s1'))
 p.act('sellSignature','s1',p.state.culinary.stock.s1);p.act('forgetSignature','s1');nav.reconcile(p.state)
 assert.equal(nav.view.query,'яблоко');assert.equal(nav.view.mode,'index')
 assert.equal(nav.select(p.state,'s1'),false)
 assert.equal(nav.view.selectedId,'s10','normal exact-ID deletion fallback is not the filtered row position')
})

test('input and clear paths are inspection-only and do not remount the search input',()=>{
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 const update=main.slice(main.indexOf('function updateRecipeBookSearch('),main.indexOf('function focusRecipeAction('))
 assert.match(update,/recipeBook\.setQuery\(query\)/)
 assert.match(update,/results\.innerHTML = recipeBookResults/)
 assert.doesNotMatch(update,/perform\(|saveFarm|drawPanel\(|openPanel\(/)
 assert.match(main,/data-recipe-query[^\n]+updateRecipeBookSearch\(event\.target\.value\)/)
 const clear=main.slice(main.indexOf("case 'recipe-search-clear':"),main.indexOf("case 'select-recipe':"))
 assert.match(clear,/updateRecipeBookSearch\(''\)/)
 assert.match(clear,/focus\(/)
 assert.doesNotMatch(clear,/perform\(|saveFarm|openPanel\(/)
})


test('the real input updater keeps the same input/caret and detail while clear restores all rows without a farm write',async()=>{
 const p=earnedRecipeBookPlayer(),farm=p.state,nav=new book.RecipeBookNavigation();nav.select(farm,'s1',false,true)
 const before=structuredClone(farm),input={value:'яблоко груша',selectionStart:6,selectionEnd:6,focus:()=>{focused=true}},results={innerHTML:''},status={textContent:''},clear={disabled:true},index={scrollTop:400}
 let focused=false,finishes=0
 const nodes=new Map([['[data-recipe-query]',input],['#recipe-book-results',results],['.recipe-book-search-status',status],['[data-action="recipe-search-clear"]',clear],['.recipe-book-index',index]])
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 const fn=main.slice(main.indexOf('function updateRecipeBookSearch('),main.indexOf('function focusRecipeAction('))
 const clearCase=main.slice(main.indexOf("    case 'recipe-search-clear':"),main.indexOf("    case 'select-recipe':"))
 await render(({recipeBookResults,recipeBookSearchStatus})=>{
  const state={farm,recipeBook:nav,panel:'recipes',dialog:{open:true},dialogContent:{querySelector:(s:string)=>nodes.get(s)},recipeBookResults,recipeBookSearchStatus,icon:art.icon,stockTile:art.stock,applyIngredientFinishes:()=>finishes++}
  runInNewContext(stripTypeScriptTypes(fn+";updateRecipeBookSearch('яблоко груша')"),state)
  assert.deepEqual(indexed(results.innerHTML),['s9','s6','s3']);assert.equal(status.textContent,'Найдено 3 из 10')
  assert.equal(input.selectionStart,6);assert.equal(input.selectionEnd,6);assert.equal(index.scrollTop,0)
  assert.equal(clear.disabled,false);assert.equal(nav.view.selectedId,'s1');assert.equal(finishes,1)
  runInNewContext(stripTypeScriptTypes(fn+`;switch('recipe-search-clear'){${clearCase}}`),state)
  assert.equal(indexed(results.innerHTML).length,10);assert.equal(input.value,'');assert.equal(clear.disabled,true);assert.equal(focused,true)
  state.panel='kitchen';runInNewContext(stripTypeScriptTypes(fn+";updateRecipeBookSearch('персик')"),state);assert.equal(nav.view.query,'')
 })
 assert.deepEqual(farm,before)
})

test('Back with a filtered-out exact ID focuses the visible query, not an unrelated cooking action',()=>{
 const oldElement=globalThis.HTMLElement,oldDocument=globalThis.document
 let focused=0,visible=true
 class SearchElement {
  dataset={};tagName='INPUT';scrollTop=0
  matches(selector:string){return selector==='[data-recipe-query]'}
  closest(){return {}}
  getClientRects(){return visible?[{}]:[]}
  focus(){focused++}
 }
 const search=new SearchElement(),nav=new book.RecipeBookNavigation()
 const root={querySelector:(selector:string)=>selector==='[data-recipe-query]'?search:null,querySelectorAll:(selector:string)=>selector.startsWith('button:not')?[search]:[]}
 try{
  Object.assign(globalThis,{HTMLElement:SearchElement,document:{activeElement:search}})
  nav.view={mode:'index',selectedId:'s1',query:'персик',focus:'index:["select-recipe","s1",null]'}
  nav.restore(root as unknown as HTMLElement,true);assert.equal(focused,1)
  visible=false;nav.restore(root as unknown as HTMLElement,true);assert.equal(focused,1,'never focus the hidden narrow-pane search field')
 }finally{Object.assign(globalThis,{HTMLElement:oldElement,document:oldDocument})}
})
