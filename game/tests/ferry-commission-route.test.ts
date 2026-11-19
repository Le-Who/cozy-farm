import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { ferryCommissionUse, openFerryCommissionRecipe } from '../src/ferry-commission-use.ts'
import { RecipeBookNavigation } from '../src/recipe-book-view.ts'
import { orchardCustomerReturn } from './fixtures/ferry-commission-return.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const part=(from:string,to:string)=>{const a=main.indexOf(from),b=main.indexOf(to,a+from.length);assert.ok(a>=0&&b>a);return main.slice(a,b)}
const compile=(code:string)=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const click=compile(part('function openRecipeBook(','function updateRecipeBookSearch(')+part('function focusRecipeAction(','function returnToRecipeIndex(')+"\nswitch(action){"+part("case 'expedition-order-recipe':","case 'expedition-claim':")+'}')
const escape=compile(part('function returnToRecipeIndex(','function closeDialog(')+part('function returnFromPanel(','dialog.addEventListener(\'cancel\', returnFromPanel)')+'\nreturnFromPanel(event)')

test('live click dispatcher opens/focuses just the saved recipe; a narrow Escape uses the source visit, not the index or a sailing action',()=>{
  const {p,id}=orchardCustomerReturn();p.act('receiveFerryExpedition')
  const before=structuredClone(p.state),book=new RecipeBookNavigation(),visits:string[]=[],calls:string[]=[]
  let openedOn:string|undefined
  const actionButton={matches:()=>true,classList:{add(){}},scrollIntoView(){},focus:()=>calls.push('cook focus')}
  const ctx={action:'expedition-order-recipe',value:ferryCommissionUse(p.state)!.key,panel:'bay-freight',dialog:{open:true},farm:p.state,expandedRepeatId:undefined,
    openFerryCommissionRecipe,dialogContent:{querySelector:(q:string)=>q.startsWith('[data-action="make-signature"]')?actionButton:null},
    openPanel(next:string,remember:boolean,island:string,_cue:string,target:string){assert.equal(next,'recipes');assert.equal(remember,true);openedOn=island;visits.push(ctx.panel);book.select(p.state,target);ctx.panel=next}}
  const key=ctx.value;ctx.value='old';runInNewContext(click,ctx);ctx.value=key;ctx.dialog.open=false;runInNewContext(click,ctx);ctx.dialog.open=true;ctx.panel='guide';runInNewContext(click,ctx)
  assert.deepEqual(calls,[]);assert.deepEqual(visits,[])
  ctx.panel='bay-freight';runInNewContext(click,ctx)
  assert.deepEqual(calls,['cook focus']);assert.equal(openedOn,'home');assert.equal(book.view.selectedId,id);assert.equal(ctx.expandedRepeatId,id)
  runInNewContext(escape,{...ctx,recipeBook:book,recipeBookNarrow:()=>true,panelHistory:visits,closeContextualSale:()=>false,communityRequest:undefined,
    event:{type:'keydown',preventDefault(){calls.push('prevent close')}},goBack(keyboard:boolean){assert.equal(keyboard,true);calls.push(visits.pop()!)}})
  assert.deepEqual(calls,['cook focus','prevent close','bay-freight']);assert.deepEqual(p.state,before)
})
