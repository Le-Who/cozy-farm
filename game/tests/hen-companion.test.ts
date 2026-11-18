import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { createFarm, petChicken, endDay, restoreCurrentFarm } from '../src/farm.ts'
import { canWalkWithHen, createHenCompanion, henWalkPath, isHenWalkSegment, returnHenCompanion, stepHenCompanion } from '../src/hen-companion.ts'
import { renderHenFriendship, refreshHenWalkChoice, treatHen } from '../src/hen-friendship.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { defaultHenPositions, isHenGround, projectHenToGround } from '../src/hen-roaming.ts'
const basic = { farmhouse: 1, well: 1, coop: 1 }, upgraded = { farmhouse: 3, well: 3, coop: 3 }

test('a free walk opens after an earned first friendship, only for an existing hen at home', () => {
  const farm = createFarm(); assert.equal(canWalkWithHen(farm, 0), false)
  for (let i = 0; i < 3; i++) { petChicken(farm, 0); endDay(farm) }
  assert.equal(canWalkWithHen(farm, 0), true)
  for (const id of [-1, 4, 5, '0', null, 0.2, NaN]) assert.equal(canWalkWithHen(farm, id), false)
  assert.equal(canWalkWithHen(farm, 1), false); farm.island = 'grove'; assert.equal(canWalkWithHen(farm, 0), false)
})

test('walk paths use the coop gate and go around upgraded buildings, fences, water and cliffs', () => {
  for (const levels of [basic, upgraded]) for (const from of defaultHenPositions) for (const to of [{x:700,y:430},{x:1120,y:600},{x:1376,y:553},{x:350,y:250},{x:100,y:400}]) {
    const path = henWalkPath(from, to, levels); assert.ok(path.length, `${JSON.stringify(from)} → ${JSON.stringify(to)}`)
    let previous = projectHenToGround(from, levels)
    for (const point of path) { assert.ok(isHenWalkSegment(previous, point, levels)); previous = point }
    assert.deepEqual(previous, projectHenToGround(to, levels))
  }
  assert.equal(isHenWalkSegment({x:250,y:680},{x:800,y:600},basic), false, 'direct walk through fence is forbidden')
})

test('the companion walks safely at bounded speed, rests near the farmer, then returns to its saved home', () => {
  const home = defaultHenPositions[0], farmer = {x:1120,y:600}, walk = createHenCompanion(0, home)
  for (let i = 0; i < 1200; i++) {
    const before = {...walk.point}; stepHenCompanion(walk,farmer,home,upgraded,1/30,i/30)
    assert.ok(isHenGround(walk.point, upgraded)); assert.ok(Math.hypot(walk.point.x-before.x,walk.point.y-before.y)<=155/30+.001)
  }
  assert.ok(Math.hypot(walk.point.x-farmer.x,walk.point.y-farmer.y)<=72)
  const stopped={...walk.point}; stepHenCompanion(walk,farmer,home,upgraded,1/30,50); assert.deepEqual(walk.point,stopped)
  returnHenCompanion(walk); let done=false
  for(let i=0;i<1200&&!done;i++){done=stepHenCompanion(walk,farmer,home,upgraded,1/30,60+i/30);assert.ok(isHenGround(walk.point,upgraded))}
  assert.ok(done); assert.ok(Math.hypot(walk.point.x-home.x,walk.point.y-home.y)<2)
})

test('a moving farmer, interruption and reduced motion never write persistent farm or order state', () => {
  const farm=createFarm(),before=structuredClone(farm),home=defaultHenPositions[2],walk=createHenCompanion(2,home)
  for(let i=0;i<200;i++)stepHenCompanion(walk,{x:700+i*2,y:430},home,basic,.05,i*.05)
  assert.deepEqual(farm,before);assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
  const reduced=createHenCompanion(2,home);stepHenCompanion(reduced,{x:1200,y:500},home,basic,0,1,true);assert.ok(isHenGround(reduced.point))
  returnHenCompanion(reduced);assert.equal(stepHenCompanion(reduced,{x:1200,y:500},home,basic,0,2,true),true);assert.deepEqual(reduced.point,home)
})


test('walk choices disclose the free relationship threshold, one companion and scene availability', () => {
  const f=createFarm();f.henFriendship.hens[0].points=3
  const before=structuredClone(f),ready=renderHenFriendship(f)
  assert.match(ready,/data-action="hen-walk-start" data-value="0">Погулять вместе/)
  assert.match(renderHenFriendship(f,null,true,1),/data-action="hen-walk-start" data-value="1" disabled/)
  assert.match(ready,/Прогулка бесплатна/);assert.match(renderHenFriendship(f,null,false),/Когда отобразится остров/)
  assert.match(renderHenFriendship(f,{id:0,returning:false}),/data-action="hen-walk-return" data-value="0">Закончить прогулку/)
  assert.match(renderHenFriendship(f,{id:0,returning:true}),/data-action="hen-walk-return" data-value="0" disabled/)
  assert.deepEqual(f,before);for(const action of ['hen-walk-start','hen-walk-return'])assert.ok(isGuardedAction(action))
})

test('a requested return frees the next earned walk while the chooser stays open; mere following stays paused', () => {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
  const p = commissionPlayer(opening.slice(0, 39))
  p.act('pickFruit', 0)
  const farm = p.state
  assert.ok(petChicken(farm, 0).ok && treatHen(farm, 0, 'carrot').ok)
  assert.ok(petChicken(farm, 2).ok && treatHen(farm, 2, 'apple').ok)
  assert.ok(canWalkWithHen(farm, 0) && canWalkWithHen(farm, 2))
  const before = structuredClone(farm), home = defaultHenPositions[2], walk = createHenCompanion(2, home)
  const source = readFileSync(new URL('../src/island.ts', import.meta.url), 'utf8')
  const start = source.indexOf('      if (companion?.id === index && !held && state)'), end = source.indexOf('      let x = walkingPoint', start)
  assert.ok(start > 0 && end > start)
  const ctx = {
    companion: walk as typeof walk | undefined, index: 2, held: false, state: farm, viewMode: 'world',
    hen: home, farmer: { x: 1242, y: 405 }, motion: { matches: false }, dt: 1 / 60, moment: 0, stepHenCompanion,
    nativeHenPoint: (point: typeof home) => point, scenePoint: (x: number, y: number) => ({ x, y }),
    clearHenCompanion() { ctx.companion = undefined },
  }
  const paint = runInNewContext('() => { let walkingPoint; ' + source.slice(start, end) + ' }', ctx)
  function frames(view: string, count: number) {
    ctx.viewMode = view
    const rate = view === 'dialog' ? 15 : 60
    ctx.dt = Math.min(1 / rate, .05)
    for (let i = 0; i < count; i++) { ctx.moment += 1000 / rate; paint() }
  }
  frames('world', 900); assert.ok(Math.hypot(walk.point.x - ctx.farmer.x, walk.point.y - ctx.farmer.y) <= 72)
  const far = { ...walk.point }; ctx.farmer = { x: 445, y: 706 }
  frames('dialog', 200); assert.deepEqual(walk.point, far)
  returnHenCompanion(walk)
  assert.match(renderHenFriendship(farm, walk, true, 0), /Другая курочка возвращается/)
  frames('minigame', 200); assert.deepEqual(walk.point, far)
  frames('dialog', 400)
  assert.equal(ctx.companion, undefined, 'the explicit return finishes without closing the chooser')
  assert.ok(Math.hypot(walk.point.x - home.x, walk.point.y - home.y) < 2)
  assert.match(renderHenFriendship(farm, null, true, 0), /data-action="hen-walk-start" data-value="0">Погулять вместе/)
  assert.deepEqual(farm, before)
})

test('the existing walk control tracks the same action, availability and reason as a fresh card', () => {
  const farm = createFarm()
  for (let i = 0; i < 3; i++) { petChicken(farm, 2); endDay(farm) }
  const previous = structuredClone(farm), id = 2
  const button = { dataset: { value: String(id), action: '' }, disabled: false, textContent: '' }, reason = { textContent: '' }
  const row = { querySelector: (selector: string) => selector === 'button' ? button : selector === 'small' ? reason : null }
  const root = { querySelector: (selector: string) => selector === '.hen-walk-choice' ? row : null } as unknown as HTMLElement
  for (const walk of [{ id, returning: false }, { id, returning: true }, { id: 0, returning: true }, null]) {
    refreshHenWalkChoice(root, farm, walk, true)
    const html = renderHenFriendship(farm, walk, true, id)
    assert.ok(html.includes(`data-action="${button.dataset.action}" data-value="${id}"${button.disabled ? ' disabled' : ''}>${button.textContent}</button><small>${reason.textContent}</small>`))
  }
  assert.equal(button.dataset.action, 'hen-walk-start'); assert.equal(button.disabled, false)
  assert.deepEqual(farm, previous)
})
