import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {createFarm} from '../src/farm.ts'
import {followGardenPlan} from '../src/garden-plans.ts'
import {GardenPlanEditor,renderGardenPlans,renderGardenMode} from '../src/garden-plans-ui.ts'

function fixture(){
  const farm=createFarm(),editor=new GardenPlanEditor();assert.ok(editor.begin(farm));editor.draft!.name='Хлебный огород';editor.brush='wheat'
  for(const index of [0,8,13])assert.ok(editor.paint(index))
  assert.ok(editor.save(farm).ok);assert.ok(followGardenPlan(farm,0,farm.gardenPlans.revision).ok)
  return {farm,editor}
}
const render=(farm:ReturnType<typeof createFarm>,editor:GardenPlanEditor)=>renderGardenPlans(farm,editor,()=>'<i class="icon"></i>')

test('desktop guidance follows the one real control set while compact guidance keeps its original positions',()=>{
  const {farm,editor}=fixture(),before=structuredClone(farm),html=render(farm,editor)
  const moved=html.indexOf('class="garden-plan-guidance-desktop"'),edit=html.indexOf('data-action="garden-edit"'),transfer=html.indexOf('data-value="transplant"'),board=html.indexOf('class="garden-plan-board"')
  assert.ok(moved>transfer&&transfer>edit&&board>moved)
  assert.match(html.slice(0,edit),/class="garden-plan-guidance-compact"/)
  const prose=html.slice(moved,board)
  assert.match(prose,/Выбор другой культуры вручную выключит этот режим/)
  assert.match(prose,/Покупка семян сама по себе план не меняет/)
  assert.match(prose,/Занятые растения остаются на месте/)
  assert.equal([...html.matchAll(/data-action="garden-edit"/g)].length,1)
  assert.equal([...html.matchAll(/data-value="transplant"/g)].length,1)
  assert.equal([...html.matchAll(/data-action="garden-follow"/g)].length,2,'one manual-return action and one existing current-plan button, not duplicate layouts')
  assert.match(html,/Посев по плану: Хлебный огород/);assert.match(html,/План 1 · Сеем/)
  assert.deepEqual(farm,before)
})

test('only tall desktop moves guidance and hides the already-disabled current-plan duplicate',()=>{
  const css=readFileSync(new URL('../src/garden-plans.css',import.meta.url),'utf8')
  assert.match(css,/\.garden-plan-preview \.garden-plan-guidance-desktop\{display:none\}/)
  const desktop=[...css.matchAll(/@media\s*\(min-width:1100px\) and \(min-height:820px\)\s*\{([\s\S]*?)\n\}/g)].at(-1)?.[1]
  assert.ok(desktop)
  assert.match(desktop,/\.garden-plan-preview \.garden-plan-guidance-compact,/)
  assert.match(desktop,/\.garden-plan-preview \.garden-plan-controls \[data-action="garden-follow"\]:disabled\{display:none\}/)
  assert.match(desktop,/\.garden-plan-preview \.garden-plan-guidance-desktop\{display:block\}/)
  assert.doesNotMatch(desktop,/(?:^|[;{])\s*(?:height|max-height|min-height|overflow(?:-[xy])?|font-size|order|position|visibility)\s*:/)
  assert.doesNotMatch(desktop,/\.garden-bed\b|\.garden-brushes\b|\.garden-shopping\b/)
})

test('only the already-active selected plan has a suppressible duplicate; another selected plan retains its real Follow action',()=>{
  const {farm,editor}=fixture()
  const buttons=(html:string)=>[...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([,attrs,text])=>({action:attrs.match(/data-action="([^"]*)"/)?.[1],value:attrs.match(/data-value="([^"]*)"/)?.[1],disabled:/\sdisabled(?:\s|$)/.test(attrs),text}))
  let html=render(farm,editor)
  assert.equal(buttons(html).filter(b=>b.action==='garden-follow'&&b.disabled).length,1)
  assert.ok(editor.choose(1));assert.ok(editor.begin(farm));editor.draft!.name='Другой огород';editor.brush='raspberry';assert.ok(editor.paint(13));assert.ok(editor.save(farm).ok)
  const before=structuredClone(farm);html=render(farm,editor)
  assert.match(html,/Посев по плану: Хлебный огород/);assert.match(html,/<h2>Другой огород<\/h2>/)
  assert.equal(buttons(html).filter(b=>b.action==='garden-follow'&&b.disabled).length,0)
  assert.ok(buttons(html).some(b=>b.action==='garden-follow'&&b.value===`${farm.gardenPlans.revision}:1`&&b.text==='Сеять по плану'))
  assert.deepEqual(farm,before)
  assert.ok(followGardenPlan(farm,null,farm.gardenPlans.revision).ok);const manual=structuredClone(farm);html=render(farm,editor)
  assert.doesNotMatch(html,/Посев по плану:|Вернуться к ручному посеву/)
  assert.ok(buttons(html).some(b=>b.action==='garden-follow'&&!b.disabled))
  assert.deepEqual(farm,manual)
})

test('shared seed-picker mode text and empty, draft and seed-review markup keep their existing guidance',()=>{
  const {farm,editor}=fixture(),before=structuredClone(farm)
  assert.equal(renderGardenMode(farm),'<p class="garden-mode-note"><strong>Посев по плану: Хлебный огород</strong><br>Выбор другой культуры вручную выключит этот режим. Покупка семян сама по себе план не меняет.</p>')
  assert.ok(editor.choose(1));const empty=render(farm,editor)
  assert.doesNotMatch(empty,/garden-plan-guidance-(?:compact|desktop)/)
  assert.match(empty,/Выбор другой культуры вручную выключит этот режим/)
  assert.ok(editor.choose(0));assert.ok(editor.begin(farm));const draft=render(farm,editor)
  assert.doesNotMatch(draft,/garden-plan-guidance-(?:compact|desktop)/)
  assert.match(draft,/Если изменить раскладку грядок, посев по плану выключится/)
  editor.reset();editor.shopping='open';const shopping=render(farm,editor)
  assert.doesNotMatch(shopping,/garden-plan-guidance-(?:compact|desktop)/)
  assert.match(shopping,/Покупка не сеет, не освобождает грядки и не меняет выбранный режим посева/)
  assert.deepEqual(farm,before)
})

test('the real Russian source audit accepts both guidance markup branches without exceptions',async()=>{
  const {auditRussianSource}=await import('../scripts/audit-russian.mjs')
  const source=readFileSync(new URL('../src/garden-plans-ui.ts',import.meta.url),'utf8')
  assert.deepEqual(await auditRussianSource(source,'src/garden-plans-ui.ts'),[])
  const {farm}=fixture()
  const guidance='Выбор другой культуры вручную выключит этот режим. Покупка семян сама по себе план не меняет.'
  assert.equal(renderGardenMode(farm),`<p class="garden-mode-note"><strong>Посев по плану: Хлебный огород</strong><br>${guidance}</p>`)
  assert.equal(renderGardenMode(farm,true),`<p class="garden-mode-note"><strong>Посев по плану: Хлебный огород</strong><span class="garden-plan-guidance-compact"><br>${guidance}</span></p>`)
})
