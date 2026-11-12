import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, petChicken, endDay, restoreCurrentFarm } from '../src/farm.ts'
import { canWalkWithHen, createHenCompanion, henWalkPath, isHenWalkSegment, returnHenCompanion, stepHenCompanion } from '../src/hen-companion.ts'
import { renderHenFriendship } from '../src/hen-friendship.ts'
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
  assert.match(ready,/data-action="hen-walk-start" data-value="1" disabled/)
  assert.match(ready,/Прогулка бесплатна/);assert.match(renderHenFriendship(f,null,false),/когда отобразится остров/)
  assert.match(renderHenFriendship(f,{id:0,returning:false}),/data-action="hen-walk-return" data-value="0">Закончить прогулку/)
  assert.match(renderHenFriendship(f,{id:0,returning:true}),/data-action="hen-walk-return" data-value="0" disabled/)
  assert.deepEqual(f,before);for(const action of ['hen-walk-start','hen-walk-return'])assert.ok(isGuardedAction(action))
})
