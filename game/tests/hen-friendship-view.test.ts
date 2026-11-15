import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { createFarm, petChicken, endDay, restoreCurrentFarm, getCoopMorning, incubateEgg } from '../src/farm.ts'
import { renderHenFriendship, treatHen, henFriends } from '../src/hen-friendship.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const branch = source.slice(source.indexOf("    case 'hen-friend-select': {"), source.indexOf("    case 'hen-walk-start': {"))
const select = (farm: ReturnType<typeof createFarm>, value: unknown, panel = 'hen-friendship', open = true) => {
  const context = { farm, value, panel, dialog: { open }, selectedFriendHen: 0, redraws: 0, drawPanel() { context.redraws++ } }
  runInNewContext(stripTypeScriptTypes(`switch ('hen-friend-select') { ${branch} }`), context)
  return context
}
const hasDisabled = (html: string, action: string, value: string) => new RegExp(`data-action="${action}" data-value="${value}"[^>]* disabled`).test(html)

test('one selected friend replaces repeated pages; every present hen stays accessible without farm writes', () => {
  const farm = createFarm(), before = structuredClone(farm)
  for (let id = 0; id < farm.flockSize; id++) {
    const view = renderHenFriendship(farm, null, true, id, name => `<img alt="" src="${name}.webp">`)
    assert.equal((view.match(/class="hen-friend-card"/g) ?? []).length, 1)
    assert.equal((view.match(/data-action="hen-friend-select"/g) ?? []).length, farm.flockSize)
    assert.equal((view.match(/aria-pressed="true"/g) ?? []).length, 1)
    assert.match(view, new RegExp(`<h2>${henFriends[id].name}</h2>`))
    assert.match(view, new RegExp(`data-action="pet" data-value="${id}"`))
    assert.equal((view.match(/data-action="hen-treat"/g) ?? []).length, 3)
    assert.match(view, /<summary>Характер и правила<\/summary>/)
    assert.ok(view.indexOf('data-action="pet"') < view.indexOf('<details'))
    assert.ok(view.indexOf('data-action="hen-treat"') < view.indexOf('<details'))
    assert.ok(view.indexOf('data-action="hen-walk-start"') < view.indexOf('<details'))
    const selection = select(farm, String(id)); assert.equal(selection.selectedFriendHen, id); assert.equal(selection.redraws, 1)
  }
  assert.deepEqual(farm, before)
  assert.match(renderHenFriendship(farm,null,true,99), /<h2>Плюша<\/h2>/)
  for (const value of ['4', '-1', '0.5', 'x', undefined]) assert.equal(select(farm, value).redraws, 0)
  assert.equal(select(farm,'1','coop').redraws, 0); assert.equal(select(farm,'1','hen-friendship',false).redraws, 0)
  farm.island = 'grove'; assert.equal(select(farm,'1').redraws,0)
  assert.equal(isGuardedAction('hen-friend-select'), true)
})

test('preview discloses actual stock, preserves favorite discovery and does not feed the flock', () => {
  const farm = createFarm(); farm.produce.carrot = 2; farm.produce.leafyGreens = 0; farm.fruit.apple = 1
  const before = structuredClone(farm), morning = getCoopMorning(farm)
  const first = renderHenFriendship(farm)
  assert.equal(hasDisabled(first,'hen-treat','0:carrot'), false)
  assert.equal(hasDisabled(first,'hen-treat','0:leafyGreens'), true)
  assert.equal(hasDisabled(first,'hen-treat','0:apple'), false)
  assert.match(first,/Угостить: Морковь ×1 · в запасе 2/)
  assert.doesNotMatch(first,/<small>Любимое<\/small>/)
  assert.match(first,/не заменяет корм/)
  assert.deepEqual(farm,before)
  assert.ok(treatHen(farm,0,'carrot').ok)
  assert.equal(farm.produce.carrot,1);assert.equal(farm.henFriendship.hens[0].points,2)
  assert.deepEqual(getCoopMorning(farm),morning)
  const treated = renderHenFriendship(farm)
  assert.match(treated,/<small>Любимое<\/small>/);assert.match(treated,/Сегодня уже угощали/)
  for (const item of ['carrot','leafyGreens','apple']) assert.ok(hasDisabled(treated,'hen-treat',`0:${item}`))
  assert.equal(hasDisabled(treated,'pet','0'),false)
  assert.ok(petChicken(farm,0).ok)
  const friends = renderHenFriendship(farm)
  assert.ok(hasDisabled(friends,'pet','0'));assert.equal(hasDisabled(friends,'hen-walk-start','0'),false)
  const exact = structuredClone(farm); assert.equal(treatHen(farm,0,'apple').ok,false);assert.deepEqual(farm,exact)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
  endDay(farm);const tomorrow=renderHenFriendship(farm)
  assert.equal(hasDisabled(tomorrow,'pet','0'),false);assert.equal(hasDisabled(tomorrow,'hen-treat','0:carrot'),false)
})

test('walk availability, return and completion are compact without dropping their gates or memories', () => {
  const farm=createFarm();farm.produce.carrot=3
  assert.match(renderHenFriendship(farm),/С 3 шагов дружбы/)
  for(let i=0;i<3;i++){petChicken(farm,0);treatHen(farm,0,'carrot');endDay(farm)}
  const done=renderHenFriendship(farm)
  assert.match(done,/Близкие друзья/);assert.doesNotMatch(done,/data-action="hen-treat"/)
  assert.equal(hasDisabled(done,'pet','0'),false)
  for(const memory of henFriends[0].memories)assert.ok(done.includes(memory))
  assert.ok(hasDisabled(renderHenFriendship(farm,null,false),'hen-walk-start','0'))
  assert.ok(hasDisabled(renderHenFriendship(farm,{id:1,returning:false}),'hen-walk-start','0'))
  assert.equal(hasDisabled(renderHenFriendship(farm,{id:0,returning:false}),'hen-walk-return','0'),false)
  assert.ok(hasDisabled(renderHenFriendship(farm,{id:0,returning:true}),'hen-walk-return','0'))
  assert.match(renderHenFriendship(farm,{id:0,returning:true}),/Возвращается на своё место/)
})

test('view-only selection is not serialized, spends still use original guarded domain actions', () => {
  assert.match(source,/renderHenFriendship\(farm, island.henWalkStatus\(\), island.henWalkAvailable\(\), selectedFriendHen, icon\)/)
  assert.doesNotMatch(branch,/saveFarm|perform\(|treatHen|petChicken|playBaySound|localStorage/)
  assert.match(source,/case 'hen-treat':[\s\S]*?perform\(\(\) => treatHen\(farm, Number\(choice\[1\]\), choice\[2\]\), false, true\)/)
  for(const action of ['hen-treat','pet','hen-walk-start','hen-walk-return'])assert.ok(isGuardedAction(action))
  const css=readFileSync(new URL('../src/hen-friendship.css',import.meta.url),'utf8')
  assert.match(css,/hen-friend-notes>summary\{[^}]*min-height:44px/)
  assert.match(css,/hen-friend-card \.dialog-button\{[^}]*min-height:44px/)
})


test('a genuinely hatched fifth hen is independently selectable with her own actions', () => {
  const farm=createFarm();farm.buildingLevels.coop=3;farm.coopSpecialization='hatchery';farm.eggs=1
  assert.ok(incubateEgg(farm).ok);endDay(farm);endDay(farm)
  assert.equal(farm.flockSize,5);assert.ok(restoreCurrentFarm(structuredClone(farm)))
  const before=structuredClone(farm),selection=select(farm,'4'),view=renderHenFriendship(farm,null,true,selection.selectedFriendHen)
  assert.equal(selection.redraws,1);assert.match(view,/<h2>Пуговка<\/h2>/)
  assert.match(view,/data-action="pet" data-value="4"/);assert.match(view,/data-action="hen-treat" data-value="4:apple"/)
  assert.deepEqual(farm,before)
})
