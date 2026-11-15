import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {TreeStorageChoice,storedTreeChoiceLabel,revealTreeStorageReturn} from '../src/tree-storage-choice.ts'
import {createFarm,treeDefinitions,returnNurseryTree,restoreCurrentFarm} from '../src/farm.ts'
import {nurseryFruitDetail} from '../src/orchard-guidance.ts'
import {treeVariantCopy} from '../src/ready-variant-guidance.ts'
import {getRequirementHint} from '../src/requirement-guidance.ts'
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const fn=main.slice(main.indexOf('function nurseryCard('),main.indexOf('\nlet fishingGame:'))
function fixture(){const f=createFarm();f.treeNursery=Array.from({length:12},(_,i)=>({id:i+1,tree:{tree:'apple' as const,age:2,fruitReady:2,...(i===11?{trait:'rainbow' as const}:{})}}));f.treeNurserySerial=12;return f}
function render(farm:ReturnType<typeof createFarm>,treeStorageChoice:TreeStorageChoice,slot?:number){
 return runInNewContext(stripTypeScriptTypes(fn+'\nnurseryCard(slot)'),{farm,treeStorageChoice,slot,treeDefinitions,nurseryFruitDetail,treeVariantCopy,storedTreeChoiceLabel,escapeHtml:(s:string)=>s,
  button:(label:string,action:string,enabled=true,o:any={})=>`<button data-action="${action}" data-value="${o.value}"${enabled?'':' disabled'}>${label}</button>`,
  row:(icon:string,name:string,detail:string,action:string,trait?:string)=>`<li data-trait="${trait??''}"><strong>${name}</strong>${detail}${action}</li>`}) as string
}

test('a later stored tree is selected by exact stable ID, not array index, with no farm mutation',()=>{
 const f=fixture(),before=structuredClone(f),s=new TreeStorageChoice()
 assert.equal(s.current(f)?.id,1);assert.ok(s.choose(f,'12'));assert.equal(s.current(f)?.id,12)
 for(const value of ['0','012','12junk','13','',undefined])assert.equal(s.choose(f,value),false)
 assert.deepEqual(f,before);assert.deepEqual(restoreCurrentFarm(f),f)
 f.treeNursery.reverse();assert.equal(s.current(f)?.id,12)
 f.treeNursery=f.treeNursery.filter(x=>x.id!==12);assert.equal(s.current(f)?.id,11)
 f.island='cape';const away=structuredClone(f);assert.equal(s.choose(f,'3'),false);assert.deepEqual(f,away)
 f.treeNursery=[];assert.equal(s.current(f),undefined)
})

test('all twelve choices remain named/reachable while only the selected exact detail and return are rendered',()=>{
 const f=fixture(),s=new TreeStorageChoice();s.choose(f,'12');const before=structuredClone(f),html=render(f,s,2)
 assert.equal((html.match(/<option /g)||[]).length,12);assert.equal((html.match(/data-action="return-nursery-tree"/g)||[]).length,1)
 for(const {id} of f.treeNursery)assert.match(html,new RegExp(`<option value="${id}"`))
 assert.match(html,/<option value="12" selected>Яблоня · №12 · Радужное/)
 assert.match(html,/data-action="return-nursery-tree" data-value="12">Вернуть · место 3/)
 assert.match(html,/Плодов к сбору: 2/);assert.match(html,/Обычные плоды ×1 · Радужное яблоко ×1/)
 assert.match(html,/<summary>Бесплатное хранение: правила<\/summary>/)
 assert.match(html,/Возраст, готовые плоды и особенность сохраняются/)
 assert.deepEqual(f,before)
 for(const entry of f.treeNursery)assert.ok(storedTreeChoiceLabel(entry).length<45,'native select label stays short, detail is separate')
 f.trees.home[1]={tree:'pear',age:0,fruitReady:0};f.trees.home[2]={tree:'apple',age:0,fruitReady:0}
 assert.match(render(f,s),/data-value="12" disabled>Нет места в саду/)
})

test('source guidance selects the exact later rare tree before drawing its single return action',()=>{
 const f=fixture(),before=structuredClone(f),request={kind:'variants',item:'apple',trait:'rainbow',quantity:1} as const
 const hint=getRequirementHint(f,{kind:'stock',item:request})
 assert.equal(hint.action.target,'orchard');assert.equal(hint.action.value,'12')
 const s=new TreeStorageChoice();assert.ok(s.choose(f,hint.action.value));assert.match(render(f,s),/data-action="return-nursery-tree" data-value="12"/)
 assert.deepEqual(f,before)
 assert.match(main,/else if \(target === 'orchard'\) \{ if \(value\) treeStorageChoice.choose\(farm,value\); openPanel\('orchard'\) \}/)
 assert.match(main,/case 'orchard':\s+if \(value\) treeStorageChoice.choose\(farm,value\)\s+openPanel\('orchard'\)/)
 const selected=structuredClone(s.current(f)!.tree);assert.ok(returnNurseryTree(f,2,12).ok)
 assert.deepEqual(f.trees.home[2],selected);assert.equal(f.fruit.apple,0);assert.deepEqual(f.variants,{})
 assert.equal(s.current(f)?.id,1);const after=structuredClone(f);assert.equal(returnNurseryTree(f,1,12).ok,false);assert.deepEqual(f,after)
 assert.deepEqual(restoreCurrentFarm(f),f)
})

test('only explicit user paths reveal the existing return; passive render preserves current focus without scrolling',()=>{
 let calls=0;const button={scrollIntoView:(o:any)=>{assert.deepEqual(o,{block:'nearest',inline:'nearest'});calls++}}
 revealTreeStorageReturn({querySelector:(q:string)=>{assert.match(q,/:not\(:disabled\)/);return button}} as unknown as HTMLElement)
 assert.equal(calls,1);revealTreeStorageReturn({querySelector:()=>null} as unknown as HTMLElement);assert.equal(calls,1)
 const draw=main.slice(main.indexOf('function drawPanel()'),main.indexOf('async function visitPanelAt('))
 const open=main.slice(main.indexOf('function openPanel('),main.indexOf('function openRecipeBook('))
 assert.doesNotMatch(draw,/revealTreeStorageReturn/);assert.doesNotMatch(open,/revealTreeStorageReturn/)
 assert.match(draw,/const focusedStorageChoice = document\.activeElement instanceof HTMLSelectElement/)
 assert.match(draw,/if \(focusedStorageChoice\) dialogContent\.querySelector<HTMLSelectElement>\('\[data-tree-storage-choice\]'\)\?\.focus\(\{preventScroll:true\}\)/)
 const f=fixture(),s=new TreeStorageChoice(),before=structuredClone(f);s.choose(f,'12');render(f,s);render(f,s);assert.equal(s.current(f)?.id,12);assert.deepEqual(f,before)
})

test('native-select change handler is read-only, context-checked, and keeps focus on the selector',()=>{
 const start=main.indexOf("  if (input instanceof HTMLSelectElement && input.matches('[data-tree-storage-choice]')")
 const end=main.indexOf("  if((input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement)&&input.dataset.recipeName)",start)
 const branch=main.slice(start,end)
 class Select {value='12';matches=()=>true}
 for(const overrides of [{},{panel:'rest'},{dialog:{open:false}},{input:new class extends Select {value='999'}}]){
  const farm=fixture(),before=structuredClone(farm),treeStorageChoice=new TreeStorageChoice();let draw=0,focus=0,scroll=0,reveal=0
  const ctx={input:new Select(),HTMLSelectElement:Select,panel:'tree',dialog:{open:true},farm,treeStorageChoice,drawPanel:()=>draw++,dialogContent:{querySelector:()=>({focus:()=>focus++,scrollIntoView:()=>scroll++})},revealTreeStorageReturn:()=>reveal++,...overrides}
  runInNewContext(stripTypeScriptTypes(branch),ctx)
  const expected=Object.keys(overrides).length?0:1;assert.equal(draw,expected);assert.equal(focus,expected);assert.equal(scroll,expected);assert.equal(reveal,expected);assert.deepEqual(farm,before)
 }
 assert.doesNotMatch(branch,/saveFarm|perform\(|returnNurseryTree|storeTree\(/)
})
