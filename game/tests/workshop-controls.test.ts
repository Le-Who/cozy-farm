import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { containArtwork, containRaster, getWorkshopLayout, type ArtBox } from '../src/workshop-camera.ts'
import { workshopToolGuide, workshopToolPalette, workshopTools } from '../src/workshop-controls.ts'

test('every tool has a visible selected mode and a concrete gesture and result', () => {
  for (const tool of workshopTools) {
    const guide = workshopToolGuide('working', tool.id, 1)
    assert.equal(guide.title, `Режим: ${tool.label}`)
    assert.ok(guide.hint.length > 40)
  }
  assert.match(workshopToolGuide('working', 'roll', 1).hint, /Ведите по тесту.*скалка.*плоскую/)
  assert.match(workshopToolGuide('working', 'cut', 1).hint, /отпустите.*два кусочка/)
  assert.match(workshopToolGuide('working', 'move', 1).hint, /целиком/)
})

test('pending and maximum cuts do not promise an unavailable action', () => {
  assert.match(workshopToolGuide('working', 'cut', 2, true).hint, /Дождитесь/)
  assert.match(workshopToolGuide('working', 'cut', 6).hint, /шесть.*другой инструмент/)
  assert.doesNotMatch(workshopToolGuide('working', 'knead', 6).hint, /другой инструмент/)
})

test('mixing, transfer, baking and ready stages cannot retain a stale sculpting mode', () => {
  assert.match(workshopToolGuide('ingredients', 'cut', 0).hint, /миске.*пробел/)
  assert.equal(workshopToolGuide('mixing', 'roll', 0).title, 'Замесить тесто')
  assert.equal(workshopToolGuide('transferring', 'fold', 1).title, 'Тесто на доску')
  assert.equal(workshopToolGuide('baking', 'move', 1).title, 'Выпекаем')
  assert.match(workshopToolGuide('finished', 'cup', 1).hint, /уже в запасах.*Готово/)
})

const intersects=(a:{x:number;y:number;width:number;height:number},b:{x:number;y:number;width:number;height:number})=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y
for (const [label, view, hand, bake] of [
  ['desktop', { width:1140,height:760 },{x:17,y:658,width:86,height:87},{x:926,y:657,width:200,height:84}],
  ['phone portrait', { width:340,height:535 },{x:14,y:486,width:44,height:44},{x:226,y:489,width:104,height:44}],
  ['small landscape', { width:548,height:253 },{x:10,y:219,width:44,height:44},{x:440,y:197,width:99,height:44}],
  ['wide landscape', { width:802,height:370 },{x:15,y:321,width:44,height:44},{x:644,y:289,width:144,height:56}],
  ['intermediate', { width:500,height:333 },{x:8,y:288,width:44,height:44},{x:406,y:288,width:88,height:44}],
] as const) test(`${label}: every action is at least as big as the hand without covering hand or bake`, () => {
  const p = workshopToolPalette(view, hand, bake)
  assert.ok(p.buttonWidth >= hand.width && p.buttonHeight >= hand.height)
  assert.ok(p.buttonWidth >= 76 && p.buttonHeight >= 64)
  const box = {x:p.left,y:p.top,width:p.width,height:p.height}
  assert.ok(box.x >= 0 && box.y >= 0 && box.x+box.width <= view.width && box.y+box.height <= view.height)
  assert.equal(intersects(box,hand),false)
  assert.equal(intersects(box,bake),false)
  if(p.compact) assert.ok(box.y+box.height<Math.min(hand.y,bake.y))
})

// Use the authored room and hand asset, not a guessed 500 × 333 content area.
// The 520 × 480 window actually selects the 1846:852 landscape room.
function authoredControls(windowWidth: number, windowHeight: number) {
  const layout = getWorkshopLayout(windowWidth - 20, windowHeight - 20)
  const view = containArtwork(layout, windowWidth - 20, windowHeight - 20)
  const manifest = JSON.parse(readFileSync(new URL('../public/art/lavender/workshop-authored/manifest.json', import.meta.url), 'utf8'))
  const box = layout.props.hand
  const fitted = containRaster(manifest.items.handMedallion, box.width * layout.art.width, box.height * layout.art.height)
  const handBox = { u: box.u + fitted.x / layout.art.width, v: box.v + fitted.y / layout.art.height,
    width: fitted.width / layout.art.width, height: fitted.height / layout.art.height }
  // Same minimum hit area and centered transparent padding as workshop.applyBox.
  const rect = (box: ArtBox, minimumWidth = 44) => {
    const width = Math.max(minimumWidth, box.width * view.width), height = Math.max(44, box.height * view.height)
    return { x: Math.max(0, Math.min(box.u * view.width - (width - box.width * view.width) / 2, view.width - width)),
      y: Math.max(0, Math.min(box.v * view.height - (height - box.height * view.height) / 2, view.height - height)), width, height }
  }
  return { view, hand: rect(handBox), bake: rect(layout.ui.bake, 90) }
}

for (const [width, height] of [[360,640],[390,844],[568,320],[844,390],[520,480],[1120,760]]) {
  test(`authored ${width} × ${height}: tools fit the real room and stay clear of hand and bake`, () => {
    const {view, hand, bake} = authoredControls(width, height)
    const p = workshopToolPalette(view, hand, bake), box = {x:p.left,y:p.top,width:p.width,height:p.height}
    assert.ok(p.buttonWidth >= hand.width && p.buttonHeight >= hand.height)
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= view.width + .001 && box.y + box.height <= view.height + .001)
    assert.equal(intersects(box,hand),false)
    assert.equal(intersects(box,bake),false)
    if (width === 520) {
      assert.ok(Math.abs(view.height - 230.76923076923077) < .001)
      assert.equal(p.columns,6)
      // This is geometry evidence only. Native text metrics must also pass the fixture audit.
      assert.ok(Math.abs(p.top - 105.30769230769232) < .001)
    }
  })
}
