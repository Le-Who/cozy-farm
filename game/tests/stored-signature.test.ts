import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {test} from 'node:test'
import ts from 'typescript'
import {createServer} from 'vite'
import {getStoredSignature,storedSignatureValue,withdrawStoredSignature} from '../src/stored-signature.ts'
import {forgetSignature,restoreFarm,sail} from '../src/farm.ts'
import {ActionClickGuard,ActivationKeyGuard,isGuardedAction} from '../src/action-click-guard.ts'
import {storedRecipesFixture} from './fixtures/stored-recipes.ts'

const reload=(farm:ReturnType<typeof storedRecipesFixture>['farm'])=>restoreFarm(JSON.parse(JSON.stringify(farm)))!

test('an accepted saved local portion is discoverable without cooking or changing the farm',()=>{
  const {farm,recipeId}=storedRecipesFixture(),before=structuredClone(farm)
  assert.ok(reload(farm))
  for(let i=0;i<3;i++)assert.deepEqual(getStoredSignature(farm,recipeId),{port:'home',recipeId,stored:3})
  assert.deepEqual(farm,before)
  assert.deepEqual(getStoredSignature(reload(farm),recipeId),getStoredSignature(farm,recipeId))
})

test('one explicit withdrawal conserves the exact recipe, resources, progress and rewards across reload',()=>{
  const {farm,recipeId}=storedRecipesFixture(),before=structuredClone(farm)
  const value=storedSignatureValue(getStoredSignature(farm,recipeId)!)
  assert.equal(withdrawStoredSignature(farm,value).ok,true)
  const expected=structuredClone(before);expected.culinary.stock[recipeId]=1;expected.freight.warehouses.home[`signature:${recipeId}`]=2
  assert.deepEqual(farm,expected);assert.deepEqual(reload(farm),expected)
  assert.equal(withdrawStoredSignature(farm,value).ok,false,'a stale old count is not a second confirmation')
  assert.deepEqual(farm,expected)
})

test('the last portion removes the offer, never repeats or archives the recipe, and cannot be claimed twice',()=>{
  const {farm,recipeId}=storedRecipesFixture()
  for(let n=3;n>0;n--){
    const value=storedSignatureValue(getStoredSignature(farm,recipeId)!)
    assert.equal(withdrawStoredSignature(farm,value).ok,true)
    assert.equal(farm.culinary.stock[recipeId],4-n);assert.ok(reload(farm))
  }
  assert.equal(getStoredSignature(farm,recipeId),undefined)
  const before=structuredClone(farm)
  assert.equal(withdrawStoredSignature(farm,`home|${recipeId}|1`).ok,false);assert.deepEqual(farm,before)
  assert.equal(farm.culinary.recipes.length,1);assert.equal(farm.culinary.serial,1)
})

test('travel never moves stock remotely, and stale confirmations are bound to the shown island',()=>{
  const {farm,recipeId}=storedRecipesFixture(),value=storedSignatureValue(getStoredSignature(farm,recipeId)!)
  const before=structuredClone(farm);assert.equal(sail(farm,'grove').ok,true)
  assert.deepEqual(farm,{...before,island:'grove'});assert.equal(getStoredSignature(farm,recipeId),undefined)
  farm.freight.warehouses.grove[`signature:${recipeId}`]=1
  const away=structuredClone(farm)
  assert.equal(withdrawStoredSignature(farm,value).ok,false);assert.deepEqual(farm,away)
  assert.equal(withdrawStoredSignature(farm,storedSignatureValue(getStoredSignature(farm,recipeId)!)).ok,true)
  assert.equal(farm.freight.warehouses.home[`signature:${recipeId}`],3);assert.ok(reload(farm))
})

test('removed recipes, empty stock, inaccessible shores and invalid resulting saves are rejected before any mutation',()=>{
  for(const blocked of ['recipe','empty','boat','capacity']){
    const {farm,recipeId}=storedRecipesFixture(),value=storedSignatureValue(getStoredSignature(farm,recipeId)!)
    if(blocked==='recipe'){farm.freight.warehouses.home={};assert.equal(forgetSignature(farm,recipeId).ok,true)}
    if(blocked==='empty')farm.freight.warehouses.home={}
    if(blocked==='boat')farm.boatOwned=false
    if(blocked==='capacity')farm.culinary.stock[recipeId]=farm.culinary.recipes[0].batches*2
    assert.ok(reload(farm));const before=structuredClone(farm)
    assert.equal(getStoredSignature(farm,recipeId),undefined)
    assert.equal(withdrawStoredSignature(farm,value).ok,false);assert.deepEqual(farm,before)
  }
})

test('malformed or mismatched confirmations cannot choose a different item or amount',()=>{
  const {farm}=storedRecipesFixture(),before=structuredClone(farm)
  for(const value of [undefined,'','home|s2|3','home|__proto__|3','home|s1|0','home|s1|-1','home|s1|1.5','home|s1|Infinity','home|s1|3|2','unknown|s1|3']){
    assert.equal(withdrawStoredSignature(farm,value).ok,false);assert.deepEqual(farm,before)
  }
})

test('the actual handler requires the open book and only plays the existing crate sound on a valid transfer',()=>{
  const source=ts.createSourceFile('main.ts',readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true)
  let clause:ts.CaseClause|undefined
  const visit=(node:ts.Node)=>{if(ts.isCaseClause(node)&&node.expression.getText(source)==="'recipe-warehouse-withdraw'")clause=node;ts.forEachChild(node,visit)}
  visit(source);assert.ok(clause)
  const js=ts.transpileModule(`switch('recipe-warehouse-withdraw'){${clause.getText(source)}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const {farm,recipeId}=storedRecipesFixture(),value=storedSignatureValue(getStoredSignature(farm,recipeId)!),before=structuredClone(farm),cues:string[]=[]
  const state={farm,value,panel:'map',dialog:{open:true},withdrawStoredSignature,perform:(fn:()=>{ok:boolean})=>fn().ok,bayAudio:{playEvent:(id:string)=>cues.push(id)}}
  runInNewContext(js,state);assert.deepEqual(farm,before);assert.deepEqual(cues,[])
  state.panel='recipes';state.dialog.open=false
  runInNewContext(js,state);assert.deepEqual(farm,before);assert.deepEqual(cues,[])
  state.dialog.open=true;runInNewContext(js,state);assert.equal(farm.culinary.stock[recipeId],1);assert.deepEqual(cues,['harbour.crate'])
  runInNewContext(js,state);assert.equal(farm.culinary.stock[recipeId],1);assert.deepEqual(cues,['harbour.crate'])
})

test('withdrawal owns double-click and held activation even after the last button disappears',()=>{
  assert.equal(isGuardedAction('recipe-warehouse-withdraw'),true)
  const guard=new ActionClickGuard(),first={detail:1,timeStamp:100,clientX:100,clientY:150}
  guard.remember(first)
  assert.equal(guard.blocks({...first,detail:2,timeStamp:200}),true)
  assert.equal(guard.blocks({...first,detail:1,timeStamp:201}),true,'redraw can reset browser click detail')
  assert.equal(guard.blocks({...first,timeStamp:700}),false)
  const keys=new ActivationKeyGuard()
  assert.equal(keys.blocks({key:'Enter',repeat:false},true),false)
  assert.equal(keys.blocks({key:'Enter',repeat:true},false),true)
  keys.release('Enter');assert.equal(keys.blocks({key:'Enter',repeat:false},false),false)
})

test('the real book shows ready local stock and a separate one-portion action, not an automatic repeat',async()=>{
  const server=await createServer({server:{middlewareMode:true},appType:'custom'})
  try{
    const {signatureBook}=await server.ssrLoadModule('/src/culinary-ui.ts')
    const {farm,recipeId}=storedRecipesFixture(),before=structuredClone(farm),art={icon:()=>'<img alt="">',stock:()=>'<li>Продукты</li>'}
    const html=signatureBook(farm,art)
    assert.match(html,/Готовых порций на местном складе: 3/)
    assert.match(html,/data-action="recipe-warehouse-withdraw" data-value="home\|s1\|3"/)
    assert.match(html,/Забрать со склада · 1 порция/);assert.match(html,/data-action="make-signature"[^>]*disabled/)
    assert.deepEqual(farm,before)
    farm.island='grove';assert.doesNotMatch(signatureBook(farm,art),/recipe-warehouse-withdraw/)
    farm.island='home'
    while(getStoredSignature(farm,recipeId))withdrawStoredSignature(farm,storedSignatureValue(getStoredSignature(farm,recipeId)!))
    assert.doesNotMatch(signatureBook(reload(farm),art),/recipe-warehouse-withdraw/)
  }finally{await server.close()}
})
