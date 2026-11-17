import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {createFarm,cropIds} from '../src/farm.ts'
import {followGardenPlan,gardenPlanPreview} from '../src/garden-plans.ts'
import {GardenPlanEditor,renderGardenPlans} from '../src/garden-plans-ui.ts'

function savedPlan() {
  const farm=createFarm(),editor=new GardenPlanEditor()
  assert.ok(editor.begin(farm));editor.draft!.name='Хлебный огород';editor.brush='wheat'
  for(const index of [0,8,13])assert.ok(editor.paint(index))
  assert.ok(editor.save(farm).ok);assert.ok(followGardenPlan(farm,0,farm.gardenPlans.revision).ok)
  return {farm,editor}
}
const render=(farm:ReturnType<typeof createFarm>,editor:GardenPlanEditor)=>renderGardenPlans(farm,editor,()=>'<i class="icon"></i>')
function controls(html:string) {
  return [...html.matchAll(/<button\b([^>]*)>/g)].map(([,attributes])=>({
    action:attributes.match(/data-action="([^"]*)"/)?.[1],value:attributes.match(/data-value="([^"]*)"/)?.[1],disabled:/\sdisabled(?:\s|$)/.test(attributes),
  }))
}

test('saved plans expose controls then a complete board and seed summary without changing control order or farm',()=>{
  const {farm,editor}=savedPlan(),before=structuredClone(farm),html=render(farm,editor),revision=farm.gardenPlans.revision
  assert.match(html,/<section class="garden-plans garden-plan-preview">/)
  const left=html.indexOf('class="garden-plan-controls"'),right=html.indexOf('class="garden-plan-board"'),footer=html.indexOf('class="garden-plan-footer"')
  assert.ok(left>0&&right>left&&footer>right)
  const controlPane=html.slice(left,right),board=html.slice(right,footer)
  assert.match(controlPane,/Четыре личных плана/);assert.match(controlPane,/Посев по плану: Хлебный огород/)
  assert.match(controlPane,/Занятые растения остаются на месте/);assert.match(controlPane,/data-value="transplant"/)
  assert.match(board,/4 ряда по 4 грядки/);assert.match(board,/Раскладка грядок/)
  assert.match(board,/Семена для свободных грядок · Докупить на 4 монет/)
  assert.ok(board.indexOf('class="garden-beds"')<board.indexOf('class="garden-supplies"'))
  assert.match(board,/Покупок и резервирования нет/);assert.match(board,/Цена за пакет из 3 семян/)
  assert.deepEqual(controls(html),[
    ...[0,1,2,3].map(value=>({action:'garden-slot',value:String(value),disabled:false})),
    {action:'garden-follow',value:`${revision}:none`,disabled:false},
    {action:'garden-follow',value:`${revision}:0`,disabled:true},
    {action:'garden-edit',value:'',disabled:false},{action:'open-panel',value:'transplant',disabled:false},
    ...Array.from({length:16},(_,value)=>({action:'garden-bed',value:String(value),disabled:false})),
    {action:'garden-shop',value:'',disabled:false},{action:'travel-panel',value:'market',disabled:false},
    {action:'garden-delete',value:`${revision}:0`,disabled:false},
  ])
  assert.deepEqual(farm,before)
})

// This is a responsive stylesheet contract, not a claim of native pixel geometry.
test('desktop workspace is saved-preview-only and keeps target sizes and outer scroll ownership',()=>{
  const css=readFileSync(new URL('../src/garden-plans.css',import.meta.url),'utf8')
  assert.match(css,/\.garden-plan-preview > :is\(\.garden-plan-controls,\.garden-plan-board,\.garden-plan-footer\)\s*\{\s*display:contents;?\s*\}/)
  const desktop=css.match(/@media\s*\(min-width:1100px\) and \(min-height:820px\)\s*\{([\s\S]*?)\n\}/)?.[1]
  assert.ok(desktop,'a tall desktop, not every garden view, owns the wider workspace')
  assert.match(desktop,/\.farm-dialog\[data-panel="garden-plans"\]:has\(\.garden-plan-preview\)\s*\{\s*width:min\(1040px,calc\(100vw - 48px\)\)/)
  assert.match(desktop,/grid-template-columns:340px minmax\(0,1fr\)/)
  assert.match(desktop,/column-gap:24px/);assert.match(desktop,/grid-column:1\/-1/)
  assert.doesNotMatch(desktop,/(?:^|[;{])\s*(?:height|max-height|min-height|overflow(?:-[xy])?|font-size|order|position|visibility|pointer-events)\s*:/)
  assert.doesNotMatch(desktop,/\.garden-bed\b|\.garden-brushes\b|\.garden-shopping\b/)
  assert.match(css,/\.garden-bed\{[^}]*min-height:95px/)
  assert.match(css,/\.garden-plans \.dialog-button\{[^}]*min-height:44px/)
  assert.match(css,/\.garden-beds\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/)
})

test('selected saved page stays distinct from the active sowing plan and deletion remains after the board',()=>{
  const {farm,editor}=savedPlan()
  assert.ok(editor.choose(1));assert.ok(editor.begin(farm));editor.draft!.name='Ягодный уголок';editor.brush='raspberry'
  assert.ok(editor.paint(13));assert.ok(editor.save(farm).ok)
  const before=structuredClone(farm),html=render(farm,editor),revision=farm.gardenPlans.revision
  assert.equal(farm.gardenPlans.active,0)
  assert.match(html,/Посев по плану: Хлебный огород/);assert.match(html,/<h2>Ягодный уголок<\/h2>/)
  assert.match(html,/data-value="1" aria-pressed="true"/)
  assert.ok(controls(html).some(b=>b.action==='garden-follow'&&b.value===`${revision}:1`&&!b.disabled))
  editor.deleting=`${revision}:1`;const deleting=render(farm,editor)
  assert.ok(deleting.indexOf('class="garden-plan-footer"')>deleting.indexOf('class="garden-supplies"'))
  assert.match(deleting,/Удалить только запись «Ягодный уголок»/)
  assert.deepEqual(controls(deleting).slice(-2),[{action:'garden-remove',value:`${revision}:1`,disabled:false},{action:'garden-cancel',value:'',disabled:false}])
  assert.deepEqual(farm,before)
})

test('empty pages, draft editing and priced seed review do not opt into desktop preview layout',()=>{
  const {farm,editor}=savedPlan(),before=structuredClone(farm)
  assert.ok(editor.choose(1));const empty=render(farm,editor)
  assert.doesNotMatch(empty,/garden-plan-(?:preview|controls|board|footer)/);assert.match(empty,/Нарисовать план/)
  assert.ok(editor.choose(0));assert.ok(editor.begin(farm));const draft=render(farm,editor)
  assert.doesNotMatch(draft,/garden-plan-(?:preview|controls|board|footer)/)
  assert.match(draft,/Если изменить раскладку грядок, посев по плану выключится/)
  assert.equal(controls(draft).filter(b=>b.action==='garden-paint').length,16)
  editor.reset();editor.shopping='open';const shopping=render(farm,editor)
  assert.doesNotMatch(shopping,/garden-plan-(?:preview|controls|board|footer)/)
  assert.match(shopping,/garden-shopping/);assert.match(shopping,/Оплата только по кнопке ниже/)
  assert.ok(controls(shopping).some(b=>b.action==='garden-buy-seeds'))
  assert.deepEqual(farm,before)
})

test('a dense legitimate sixteen-bed plan retains every state, label and missing-seed review',()=>{
  const farm=createFarm(),editor=new GardenPlanEditor(),initial=structuredClone(farm)
  for(let slot=0;slot<4;slot++){
    assert.ok(editor.choose(slot));assert.ok(editor.begin(farm))
    editor.draft!.name='Огород для кухни и ягодных запасов '.slice(0,35)+(slot+1)
    for(let i=0;i<16;i++){editor.brush=i===13?'raspberry':cropIds[i%cropIds.length];assert.ok(editor.paint(i))}
    assert.ok(editor.save(farm).ok)
  }
  assert.ok(followGardenPlan(farm,0,farm.gardenPlans.revision).ok);assert.ok(editor.choose(0))
  assert.deepEqual({...farm,gardenPlans:initial.gardenPlans},initial,'only four legitimate saved plans, no inventory fixture grants')
  const before=structuredClone(farm),html=render(farm,editor),preview=gardenPlanPreview(farm,farm.gardenPlans.pages[0]!)
  assert.equal(preview.planned,16);assert.ok(preview.waiting>0);assert.ok(preview.missingCoins>0)
  assert.deepEqual(controls(html).filter(b=>b.action==='garden-bed').map(b=>b.value),Array.from({length:16},(_,i)=>String(i)))
  for(let i=1;i<=16;i++)assert.ok(html.includes(`aria-label="Грядка ${i}:`))
  assert.match(html,/Занято:/);assert.match(html,/Нет семян/);assert.match(html,/Сначала вскопать/)
  assert.match(html,/Семена для свободных грядок · Докупить на/)
  assert.match(html,/Занятые другой культурой места не включены в закупку/)
  assert.doesNotMatch(html,/tabindex="[1-9]|aria-hidden="true"|style="[^"]*(?:height|font-size)/)
  assert.deepEqual(farm,before)
})
