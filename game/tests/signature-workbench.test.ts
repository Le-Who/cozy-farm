import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as P from '../src/recipe-planning.ts'
import * as D from '../src/recipe-draft.ts'
import * as UI from '../src/intent-orders.ts'
import * as RU from '../src/ru.ts'
import * as C from '../src/culinary.ts'
import * as CL from '../src/climate.ts'
import * as NG from '../src/requirement-guidance.ts'
import * as BOOK from '../src/signature-book.ts'
import * as NURSERY from '../src/berry-nursery.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const rd=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const main=rd('src/main.ts'),culinary=rd('src/culinary-ui.ts'),css=rd('src/culinary-ui.css')
const cut=(s:string,a:string,b:string)=>{const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return s.slice(i,j)}
const actual=stripTypeScriptTypes(
 cut(main,'function button(','function row(')+
 cut(main,'const dishIcons:', 'const pastryIcons =')+
 cut(main,'function requirementLink(','const islandNames')+
 cut(main,'function stockLabel(','function marketOrderStockTile(')+
 cut(main,'function rememberCurrentRecipeDraft()','const recipeBook =')+
 cut(culinary,'export const ingredientArt','export function cookeryResultPicture').replaceAll('export ','')+
 cut(culinary,'const capacityDescription','function bookRecipe(')+
 cut(culinary,'export function signatureStudio','const coveChoiceSummary').replaceAll('export ','')+
 `async function choose(action,value,control){switch(action){`+
 cut(main,"    case 'recipe-family':","    case 'market-category':")+
 cut(main,"    case 'signature-base':","    case 'signature-home':")+
 '\n}};({signatureStudio,stockTile,kitchenFamilies,choose})')
const bill=(html:string)=>{
 const section=html.match(/class="ingredients recipe-cost">([\s\S]*?)<\/ul>/)?.[1]??''
 return [...section.matchAll(/<span>([^<]+)<\/span><strong>(\d+\/\d+)<\/strong>/g)].map(m=>m[1]+': '+m[2])
}
const recovery=(html:string)=>[...html.matchAll(/data-action="show-requirement"[^>]*aria-label="([^"]+)"/g)].map(m=>m[1])
const availableCook=(html:string)=>{const x=html.match(/<button[^>]*data-action="start-signature"[^>]*>/)?.[0];return !!x&&!x.includes('disabled')}
const clone=(x:unknown)=>JSON.parse(JSON.stringify(x))
function mount(farm:F.FarmState){
 const writes:unknown[]=[], requirementLinks=new Map<string,NG.Requirement>()
 const icon=(name:string)=>`<img class="icon" alt="" data-icon="${name}">`
 const ctx:Record<string,any>={...F,...P,...D,...UI,...RU,...C,...CL,...NG,...BOOK,...NURSERY,farm,requirementLinks,icon,numberFormat:new Intl.NumberFormat('ru-RU'),pastryIcons:{},
  kitchenGroup:'tart',kitchenGroups:['tart','preserves','dishes'],kitchenTart:'mixed',kitchenDish:'grilledFish',kitchenPreserves:'appleJam',cookingFish:F.getGrillFish(farm),panel:'kitchen',
  panelHistory:[],dialog:{open:true},signatureBase:'preserves',signatureSlots:[null,null],signatureSlot:0,signatureFamily:undefined,signatureRepeatId:undefined,cookingMode:'dish',
  escapeHtml:(s:string)=>String(s),saveFarm:()=>{writes.push(clone(farm))},openPanel:(panel:string)=>{ctx.panel=panel},drawPanel(){}}
 const api=runInNewContext(actual,ctx)
 function view(intent?:string):string{requirementLinks.clear();return api.signatureStudio(farm,ctx.signatureBase,ctx.signatureSlots,ctx.signatureSlot,{icon,stock:api.stockTile},intent)}
 const press=async (action:string,value?:string,ds:Record<string,string>={})=>api.choose(action,value,{dataset:ds})
 return {ctx, view, press, kitchen:api.kitchenFamilies, writes}
}
test('earned D196 composer retains exact rare choices, ordinary recovery and one explicit craft',async()=>{
 const p=earned416Mixed(), f=p.state
 assert.deepEqual([p.actions,f.day,f.island,f.coins,F.getSale(f).items],[552,196,'home',60,416])
 const original=clone(f),m=mount(f)
 assert.match(m.kitchen(),/data-action="recipe-family" data-family="tart" data-value="mixed"/)
 await m.press('recipe-family','mixed',{family:'tart'})
 assert.match(m.kitchen(),/data-action="family-signature"\s+data-value="berries"/)
 await m.press('family-signature','berries')
 assert.equal(m.ctx.panel,'signature')
 const first=m.view()
 assert.deepEqual(f,original);assert.equal(m.writes.length,0,'preset and inspection do not write')
 const palette=[...first.matchAll(/data-action="signature-fruit" data-value="([^"]+)"\s*(?:data-trait="([^"]+)"\s*)?data-empty="([^"]+)"/g)].map(([_,id,trait,empty])=>({id,trait:trait??null,inStock:empty==='false'}))
 assert.equal(palette.length,14);assert.equal(palette.filter(x=>x.trait).length,8);assert.ok(palette.every(x=>x.inStock))
 assert.ok(first.includes('data-action="start-signature"'));assert.equal(availableCook(first),false)
 assert.deepEqual(bill(first),['Черника: 2/1','Клубника: 3/1','Пшеница (обычный урожай): 0/1','Яйцо (обычный урожай): 0/1'])
 await m.press('signature-fruit','blueberry',{trait:'frost'})
 await m.press('signature-fruit','raspberry',{trait:'frost'})
 const slots:C.SignatureIngredient[]=clone(m.ctx.signatureSlots), blocked=m.view()
 assert.equal(availableCook(blocked),false)
 assert.deepEqual(slots,[{id:'blueberry',quantity:1,trait:'frost'},{id:'raspberry',quantity:1,trait:'frost'}])
 const beforeStock=clone(f);delete beforeStock.recipeDraft
 assert.deepEqual(beforeStock,original);assert.equal(m.writes.length,2)
 assert.deepEqual(F.restoreCurrentFarm(clone(f)),f)
 assert.deepEqual(bill(blocked),['Морозная черника: 1/1','Морозная малина: 1/1',
  'Пшеница (обычный урожай): 0/1','Яйцо (обычный урожай): 0/1'])
 assert.deepEqual(recovery(blocked),['Где найти: Пшеница (обычный урожай), 0 из 1','Где найти: Яйцо (обычный урожай), 0 из 1'])
 const sourceActions=[...m.ctx.requirementLinks.values()].map(req=>NG.getRequirementHint(f,req,'recipe-draft').action)
 assert.deepEqual(sourceActions.map(action=>action.target),['warehouse-supply','warehouse-supply'])

 const p2=earned416Mixed(); p2.act('transferBayGoods','withdraw','home','wheat',1);p2.act('transferBayGoods','withdraw','home','eggs',1)
 const n=mount(p2.state);await n.press('family-signature','berries')
 await n.press('signature-fruit','blueberry',{trait:'frost'})
 await n.press('signature-fruit','raspberry',{trait:'frost'})
 assert.deepEqual(clone(n.ctx.signatureSlots),slots)
 const funded=n.view(), readyBefore=clone(p2.state);assert.equal(availableCook(funded),true)
 assert.deepEqual(bill(funded).slice(-2),['Пшеница: 1/1','Яйцо: 1/1'])
 await n.press('start-signature','tart')
 assert.equal(n.ctx.panel,'cookery');assert.deepEqual(clone(p2.state),readyBefore);assert.equal(n.writes.length,2)
 const receipt=p2.act('completeSignature',{base:'tart',ingredients:slots},{family:'decorate',fruitTraitsVersion:1,fruit:[
  {ingredientId:'blueberry',trait:'frost',x:-.2,y:0,angle:0},{ingredientId:'raspberry',trait:'frost',x:.2,y:0,angle:0}
 ],steps:['fruit','bake'],baking:{method:'oven',finish:'golden',seconds:90}})
 assert.equal(p2.state.culinary.stock[String(receipt.recipeId)],1)
 assert.deepEqual([p2.state.coins, p2.state.produce.wheat,p2.state.eggs,p2.state.variants.blueberry?.frost??0,p2.state.variants.raspberry?.frost??0],[60,0,0,0,0])
 assert.deepEqual([p2.state.produce.blueberry,p2.state.produce.raspberry],[2,2],'rare choices stay distinct from ordinary stock')
})

test('earned D8 unowned ordinary planning stays possible without spending',async()=>{
 const early=commissionPlayer(JSON.parse(rd('tests/fixtures/home-progress-actions.json')).slice(0,80))
 early.visit('home')
 assert.deepEqual([early.actions,early.state.day,early.state.coins],[81,8,72])
 const w=mount(early.state), warmBefore=clone(early.state)
 await w.press('family-signature','berries')
 const options=[...w.view().matchAll(/data-action="signature-fruit"\s/g)].length
 assert.equal(options,8)
 assert.equal(w.writes.length,0)
 await w.press('signature-fruit','pear')
 assert.deepEqual(w.ctx.signatureSlots[0].id,'pear')
 assert.equal(availableCook(w.view()),false)
 const warmer=clone(early.state)
 delete warmer.recipeDraft
 assert.deepEqual(warmer,warmBefore)
 assert.equal(w.writes.length,1,'the out-of-stock plan is still a deliberate saved edit')
})

test('one native workbench keeps both missing actions and the separate Cook outside the scrollable choice grid', async()=>{
 const p=earned416Mixed(),m=mount(p.state)
 await m.press('family-signature','berries')
 const html=m.view()
 const palette=html.match(/<div class="recipe-fruit-palette" role="group" aria-label="Фрукты и ягоды">([\s\S]*?)<\/div>/)
 assert.ok(palette)
 assert.equal((palette[1].match(/data-action="signature-fruit"/g)??[]).length,14)
 assert.doesNotMatch(palette[1],/show-requirement|start-signature|recipe-book-return/)
 const order=['data-action="signature-base"','data-action="signature-slot"','data-action="signature-fruit"',
   'class="recipe-studio-requirements"','data-action="show-requirement"','data-action="start-signature"'].map(key=>html.indexOf(key))
 assert.ok(order.every((pos,i)=>pos>=0&&(!i||pos>order[i-1])),'keep native Tab order through real choices and actions')
 assert.equal(recovery(html).length,2)
 assert.match(html,/<footer><button[^>]*data-action="start-signature"[^>]*disabled/)
 assert.match(css,/\.recipe-studio footer\{position:sticky;bottom:-1px/,'smaller geometry retains its existing sticky action')
 const desktop=css.slice(css.indexOf('@media (min-width:1000px) and (min-height:700px)'))
 assert.match(desktop,/\.farm-dialog\[data-panel="signature"\]/)
 assert.match(desktop,/"slots slots palette" "cost cost palette" "book cook palette"/,
  'the appearance of the bookmark must not insert a vertical track in front of Cook')
 assert.match(desktop,/\.recipe-studio:not\(:has\(> \.recipe-studio-book\)\) > footer \{ grid-column:1 \/ 3 \}/)
 await m.press('signature-fruit','blueberry',{trait:'frost'})
 const selected=m.view(), book=selected.indexOf('data-action="recipe-book-return"')
 assert.ok(book>selected.indexOf('data-action="show-requirement"')&&book<selected.indexOf('data-action="start-signature"'),
  'an explicit draft edit adds its optional native Book action before Cook, in the same keyboard order')
 assert.match(selected,/<div class="recipe-studio-book"><button[^>]*data-action="recipe-book-return"/)
 assert.match(desktop,/\.recipe-fruit-palette\s*\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)[^}]*max-block-size:[^;]*;[^}]*overflow-y:auto/)
 assert.doesNotMatch(desktop,/\.dialog-content\s*\{|\.recipe-fruit-palette[^}]*display:none/,'no outer scroll or availability policy was changed')
})

test('the palette preserves intra-visit scroll on real draw and Back seams, but not on another visit',()=>{
 const capture=cut(main,'  // A choice redraw replaces this small list','  dialogEmblem.src =')
 const signature=cut(main,"    case 'signature':", "    case 'cove':")
 const back=cut(main,'    if (previous.signaturePaletteScroll', '    if (previous.marketOrder) {')
 const saved=main.match(/signaturePaletteScroll:(panel === 'signature'.*),/)?.[1]
 assert.ok(saved)
 const run=runInNewContext(stripTypeScriptTypes(`({draw(){${capture}\nswitch(panel){${signature}}},save(){return ${saved}},back(){${back}}})`),{
  get panel(){return panel},dialog:{get open(){return open}},dialogContent:{
   querySelector(selector:string){assert.equal(selector,'.recipe-fruit-palette');return palette},
   set innerHTML(_:string){palette={scrollTop:0}}
  },signatureStudio:()=>'<div></div>',farm:{},signatureBase:'tart',signatureSlots:[],signatureSlot:0,
  icon(){},stockTile(){},currentCommunityRequest(){},get previous(){return previous}
 })
 let palette:{scrollTop:number}|undefined={scrollTop:139},panel='signature',open=true,previous:{signaturePaletteScroll?:number}={}
 run.draw();assert.equal(palette?.scrollTop,139)
 previous={signaturePaletteScroll:run.save()};assert.deepEqual(previous,{signaturePaletteScroll:139})
 palette={scrollTop:0};run.back();assert.equal(palette.scrollTop,139)
 palette={scrollTop:0};panel='kitchen';run.back();assert.equal(palette.scrollTop,0)
 assert.equal(run.save(),undefined)
 panel='signature';palette=undefined;run.draw();assert.equal((palette as {scrollTop:number}|undefined)?.scrollTop,0)
})
