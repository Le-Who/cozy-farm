import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { auditWorkshopControls, type WorkshopControlSnapshot } from './helpers/workshop-control-audit.ts'

function snapshot(): WorkshopControlSnapshot {
  return {
    stage: 'working', activeTool: 'knead', bounds: { x: 0, y: 0, width: 1100, height: 733 },
    hand: { x: 16, y: 635, width: 83, height: 84 }, bake: { x: 893, y: 634, width: 193, height: 81 },
    guide: { rect: { x: 300, y: 67, width: 500, height: 60 }, visible: true, title: 'Режим: Размять', hint: 'Нажмите и тяните тесто.' },
    paletteVisible: true,
    tools: ['knead', 'cup', 'roll', 'fold', 'cut', 'move'].map((id, i) => ({
      id, label: i === 0 ? 'Размять' : id, selected: i === 0, selectedMarkerVisible: i === 0,
      rect: { x: 105 + i * 89, y: 635, width: 83, height: 84 },
      labelRect: { x: 110 + i * 89, y: 690, width: 70, height: 14 }, receivesPointer: true,
    })),
  }
}

test('read-only native audit accepts a visible usable palette', () => {
  assert.deepEqual(auditWorkshopControls(snapshot()), [])
})
test('closed compact palette retains selected-mode checks without measuring hidden buttons', () => {
  const s = snapshot(); s.paletteVisible = false
  for (const tool of s.tools) { tool.rect = tool.labelRect = { x: 0, y: 0, width: 0, height: 0 }; tool.receivesPointer = tool.selectedMarkerVisible = false }
  assert.deepEqual(auditWorkshopControls(s), [])
  s.guide.title = 'Режим: Разрезать'
  assert.deepEqual(auditWorkshopControls(s), ['guide:stale-tool'])
})
test('mode-guide overlap is reported even when all buttons remain inside the workshop', () => {
  const s = snapshot(); s.guide.rect = { x: 100, y: 620, width: 190, height: 45 }
  assert.deepEqual(auditWorkshopControls(s), ['knead:covers-mode-guide', 'cup:covers-mode-guide', 'roll:covers-mode-guide'])
})
test('clipped labels and obstructed hit targets cannot pass an outer-bounds-only check', () => {
  const s = snapshot(); s.tools[0].labelRect.width = 120; s.tools[1].receivesPointer = false
  assert.deepEqual(auditWorkshopControls(s), ['knead:label-overflow', 'cup:pointer-obstructed'])
})
test('selected state needs one matching tool and a visible non-color-only marker', () => {
  const s = snapshot(); s.tools[0].selectedMarkerVisible = false
  assert.deepEqual(auditWorkshopControls(s), ['knead:selection-marker-mismatch'])
  s.tools[0].selectedMarkerVisible = true; s.tools[1].selected = true; s.tools[1].selectedMarkerVisible = true
  assert.deepEqual(auditWorkshopControls(s), ['selection:inconsistent'])
})
test('undersized, out-of-bounds and obstructing controls are reported independently', () => {
  const s = snapshot(); s.tools[0].rect = { x: 890, y: 720, width: 70, height: 60 }; s.tools[0].labelRect = { x: 895, y: 725, width: 60, height: 14 }
  assert.deepEqual(auditWorkshopControls(s), ['knead:smaller-than-hand', 'knead:outside-workshop'])
  s.tools[0].rect = { x: 10, y: 630, width: 83, height: 84 }; s.tools[0].labelRect = { x: 15, y: 680, width: 70, height: 14 }
  assert.deepEqual(auditWorkshopControls(s), ['knead:covers-hand'])
})
test('mixing and baking do not expose enabled sculpting controls or a missing guide', () => {
  const s = snapshot(); s.stage = 'baking'; s.paletteVisible = false
  assert.deepEqual(auditWorkshopControls(s), [])
  s.paletteVisible = true; s.guide.visible = false
  assert.deepEqual(auditWorkshopControls(s), ['guide:missing', 'palette:visible-outside-working-stage'])
})

// Intel Iris Xe native 520 × 480 repro on 8bd6e026. The old three-line
// rolling guide ended 15.95px inside the palette despite both staying in bounds.
test('native 520px rolling-guide overlap is rejected, not hidden by a passing button-size check', () => {
  const s = snapshot()
  s.activeTool = 'roll'; s.bounds = {x:10,y:124.7048,width:500,height:230.7692}
  s.hand = {x:10,y:311.474,width:44,height:44}; s.bake = {x:411.5,y:300.0125,width:90,height:44}
  s.guide = {rect:{x:60,y:178.0625,width:400,height:67.9},visible:true,title:'Режим: Раскатать',hint:'Ведите по тесту: скалка раскатает его в более плоскую форму.'}
  s.tools.forEach((tool,i)=>{
    tool.label = tool.id === 'roll' ? 'Раскатать' : tool.label
    tool.selected = tool.selectedMarkerVisible = tool.id === 'roll'
    tool.rect = {x:18+i*82,y:230.0125,width:76,height:64}
    tool.labelRect = {x:22+i*82,y:273,width:66,height:14}
  })
  assert.deepEqual(auditWorkshopControls(s),s.tools.map(tool=>`${tool.id}:covers-mode-guide`))
})

// Keep the compact typography fix and loading visibility guard together.
test('landscape guide shares text lines while the later loading rule keeps it hidden until ready', () => {
  const css = readFileSync(new URL('../src/workshop.css', import.meta.url), 'utf8')
  const compact = /\.dough-workshop\[data-layout="landscape"\] \.workshop-mode \{([^}]+)\}/.exec(css)!
  const loading = /\.dough-workshop:not\(\[data-ready="true"\]\) \.workshop-mode \{([^}]+)\}/.exec(css)!
  assert.match(compact[1], /display:block/)
  assert.match(compact[1], /font-size:13px/, 'readability is not traded for a smaller font')
  assert.match(loading[1], /display:none/)
  assert.ok(loading.index > compact.index, 'equal-specificity loading guard must win the cascade')
})
