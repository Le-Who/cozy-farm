import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { pickFruit, createFarm, petChicken, endDay, restoreCurrentFarm, getCoopMorning, incubateEgg, cookDish, sellMarketItem, type FarmState } from '../src/farm.ts'
import { getIncubatorNewHen } from '../src/coop-panel.ts'
import { canWalkWithHen } from '../src/hen-companion.ts'
import { renderHenFriendship, treatHen, henFriends } from '../src/hen-friendship.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { chickenCarePlayer } from './fixtures/chicken-care-player.ts'
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
  const farm = createFarm()
  assert.ok(pickFruit(farm,0).ok,'a real apple harvest gives every hen a usable treat to keep in the main card')
  const before = structuredClone(farm)
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
  assert.match(source,/renderHenFriendship\(farm, island.henWalkStatus\(\), island.henWalkAvailable\(\), selectedFriendHen, icon, island\.henFieldTarget\(selectedFriendHen\)\)/)
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

test('only an actionable, still unknown favorite moves the selected hen’s clue ahead of the treats', () => {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
  const p = commissionPlayer(opening.slice(0, 39))
  p.act('specializeFacility', 'hatchery'); p.act('pickFruit', 0); p.act('incubateEgg')
  p.night(); p.night()
  assert.equal(p.state.flockSize, 5); assert.equal(p.state.day, 6)
  const page = (id: number) => renderHenFriendship(p.state, null, true, select(p.state, String(id)).selectedFriendHen)
  function checkUnknown(id: number, upfront: boolean) {
    const before = structuredClone(p.state), html = page(id), hint = henFriends[id].hint
    const split = html.indexOf('<details class="hen-friend-notes">'), card = html.slice(0, split), notes = html.slice(split)
    assert.ok(split > 0); assert.equal(html.split(hint).length - 1, 1)
    assert.equal(card.includes(hint), upfront); assert.equal(notes.includes(hint), !upfront)
    if (upfront) {
      assert.match(card, /<h3 id="hen-treat-heading">Угостить<\/h3>/)
      assert.ok(card.indexOf('id="hen-treat-heading"') < card.indexOf(hint))
      assert.ok(card.indexOf(hint) < card.indexOf('data-action="hen-treat"'))
    }
    assert.doesNotMatch(card, /<small>Любимое<\/small>/); assert.deepEqual(p.state, before)
  }
  checkUnknown(2, true); checkUnknown(4, true)
  const carrots = p.state.produce.carrot, apples = p.state.fruit.apple
  assert.ok(treatHen(p.state, 4, 'carrot').ok); assert.equal(p.state.produce.carrot, carrots - 1)
  checkUnknown(4, false); p.night(); checkUnknown(4, true)
  assert.ok(treatHen(p.state, 4, 'apple').ok); assert.equal(p.state.fruit.apple, apples - 1)
  for (let day = 0; day < 2; day++) {
    assert.ok(!page(4).includes(henFriends[4].hint)); assert.match(page(4), /<small>Любимое<\/small>/)
    assert.ok(page(4).split('<details class="hen-friend-notes">')[1].includes(henFriends[4].memories[0]))
    if (!day) p.night()
  }
  p.act('sellMarketItem', 'produce:carrot', p.state.produce.carrot)
  p.act('sellMarketItem', 'fruit:apple', p.state.fruit.apple)
  checkUnknown(2, false)
})

test('an earned alternative meal clue distinguishes ripe ordinary apples on the farm from actually unavailable fruit', () => {
  const p=chickenCarePlayer('garden','hatchery')
  for(let day=0;day<3;day++){p.day();p.act('endDay')}
  p.act('petChicken',4)
  assert.deepEqual([p.log.length,p.state.day,p.state.flockSize,p.state.fruit.apple,p.state.produce.carrot,p.state.henFriendship.hens[4].points],[68,4,5,0,1,1])
  const view=()=>renderHenFriendship(p.state,null,true,select(p.state,'4').selectedFriendHen)
  const clue=henFriends[4].hint
  function parts(html:string) {
    const [active,notes]=html.split('<details class="hen-friend-notes">')
    assert.ok(notes);assert.equal(html.split(clue).length-1,1);return {active,notes}
  }
  const before=structuredClone(p.state),missing=view(),notReady=parts(missing)
  assert.ok(hasDisabled(missing,'pet','4')&&hasDisabled(missing,'hen-walk-start','4'))
  assert.ok(!hasDisabled(missing,'hen-treat','4:carrot')&&hasDisabled(missing,'hen-treat','4:apple'))
  const depleted=restoreCurrentFarm(structuredClone(before))!
  assert.ok(pickFruit(depleted,0).ok)
  assert.ok(sellMarketItem(depleted,'fruit:apple',depleted.fruit.apple).ok)
  assert.deepEqual([depleted.fruit.apple,depleted.trees.home[0]?.fruitReady],[0,0])
  const noLocalApple=parts(renderHenFriendship(depleted,null,true,4))
  assert.ok(noLocalApple.notes.includes(clue)&&!noLocalApple.active.includes(clue),
    'a genuinely unavailable favorite stays discoverable in the notes')
  assert.ok(!noLocalApple.active.includes('aria-describedby="hen-treat-hint"'))
  assert.ok(notReady.active.includes(clue)&&!notReady.notes.includes(clue),
    'not yet carried is not the same as unavailable: existing ripe ordinary fruit is a choice today')
  assert.match(notReady.active,/aria-describedby="hen-treat-hint"/)
  assert.deepEqual(p.state,before)
  const carrot=restoreCurrentFarm(structuredClone(before))!
  assert.ok(treatHen(carrot,4,'carrot').ok);assert.equal(carrot.henFriendship.hens[4].points,2)
  p.act('pickFruit',0)
  const ready=parts(view()),eligible=structuredClone(p.state)
  assert.ok(ready.active.includes(clue)&&!ready.notes.includes(clue))
  assert.ok(ready.active.indexOf(clue)<ready.active.indexOf('data-action="hen-treat"'))
  assert.match(ready.active,/aria-describedby="hen-treat-hint"/)
  assert.ok(!hasDisabled(ready.active,'hen-treat','4:apple'))
  assert.deepEqual(p.state,eligible)
  assert.ok(treatHen(p.state,4,'apple').ok)
  assert.equal(p.state.henFriendship.hens[4].points,3);assert.equal(p.state.fruit.apple,1)
  assert.equal(p.state.chickensFed,eligible.chickensFed);assert.equal(hasDisabled(view(),'hen-walk-start','4'),false)
})

test('the treat heading names the action only; each of the three buttons states its own cost and stock', () => {
  const f=createFarm(),saved=structuredClone(f),html=renderHenFriendship(f)
  assert.match(html,/<h3 id="hen-treat-heading">Угостить<\/h3>/)
  assert.match(html,/aria-labelledby="hen-treat-heading"/)
  for(const choice of ['Морковь','Зелень','Яблоко']) {
    assert.ok(html.includes(`<strong>${choice} ×1</strong>`))
    assert.match(html,new RegExp(`aria-label="Угостить: ${choice} ×1 · в запасе `))
  }
  assert.deepEqual(f,saved)
})

const opening=JSON.parse(readFileSync(new URL('./fixtures/market-order-selection-commands.json',import.meta.url),'utf8')).slice(0,-1)
const hen=4
const clue='Радуется запаху свежих садовых фруктов.'
function earnedDay16():FarmState {
  const p=commissionPlayer(opening)
  assert.deepEqual([p.actions,p.state.day,p.state.coins],[118,14,99])
  p.act('specializeFacility','hatchery');p.act('incubateEgg');p.night();p.night()
  assert.deepEqual([p.actions,p.state.day,p.state.island,p.state.coins,p.state.eggs,p.state.feed,p.state.flockSize,
    getIncubatorNewHen(p.state),p.state.fruit.apple,p.state.produce.carrot,p.state.produce.leafyGreens],
    [122,16,'home',69,2,1,5,hen,0,1,0])
  const apple=p.state.trees.home[0]!
  assert.deepEqual([apple.tree,apple.fruitReady,apple.trait],['apple',2,undefined])
  const restored=restoreCurrentFarm(JSON.parse(JSON.stringify(p.state)))!
  assert.deepEqual(restored,p.state)
  return restored
}
function sections(farm:FarmState,id=hen) {
  const markup=renderHenFriendship(farm,null,true,id)
  const [choices,notes]=markup.split('<details class="hen-friend-notes">')
  assert.ok(notes)
  const buttons=[...choices.matchAll(/<button\b[^>]+>[\s\S]*?<\/button>/g)].map(([button])=>{
    const tag=button.slice(0,button.indexOf('>'))
    return {action:tag.match(/data-action="([^"]+)"/)?.[1],value:tag.match(/data-value="([^"]*)"/)?.[1],
      enabled:!/\s(?:disabled|hidden)(?:\s|$)/.test(tag),button}
  })
  return {markup,choices,notes,buttons}
}

test('earned first Meet puts the existing orchard clue beside the choice while the apples are still on the local tree',()=>{
  const farm=earnedDay16(), before=structuredClone(farm)
  const {markup,choices,notes,buttons}=sections(farm)
  assert.match(choices,/<h2>Пуговка<\/h2>/)
  assert.ok(choices.includes(clue),'the ready local apple clue belongs by Treat, not behind Character and rules')
  assert.ok(!notes.includes(clue))
  assert.equal(markup.split(clue).length,2,'no duplicate instruction')
  assert.match(choices,/aria-describedby="hen-treat-hint"/)
  assert.deepEqual(buttons.map(b=>[b.action,b.value,b.enabled]),[
    ...[0,1,2,3,4].map(i=>['hen-friend-select',String(i),true]),
    ['pet','4',true],['hen-walk-start','4',false],['hen-guide','',false],
    ['hen-treat','4:carrot',true],['hen-treat','4:leafyGreens',false],['hen-treat','4:apple',false],
  ])
  assert.match(choices,/Угостить: Морковь ×1 · в запасе 1/)
  assert.match(choices,/Угостить: Яблоко ×1 · в запасе 0/)
  assert.deepEqual(farm,before,'looking never chooses a treat or picks fruit')

  const fast=structuredClone(farm)
  assert.ok(petChicken(fast,hen).ok);assert.ok(treatHen(fast,hen,'carrot').ok)
  assert.equal(canWalkWithHen(fast,hen),false)
  assert.ok(pickFruit(fast,0).ok)
  const afterPick=structuredClone(fast)
  assert.equal(treatHen(fast,hen,'apple').ok,false,'today\'s carrot is still the only permitted treat')
  assert.deepEqual(fast,afterPick)

  assert.ok(petChicken(farm,hen).ok);assert.ok(pickFruit(farm,0).ok)
  assert.match(sections(farm).choices,/Угостить: Яблоко ×1 · в запасе 2/)
  assert.ok(treatHen(farm,hen,'apple').ok)
  assert.deepEqual([farm.henFriendship.hens[hen].points,farm.fruit.apple,farm.produce.carrot,farm.coins,
    farm.eggs,farm.feed,farm.day,canWalkWithHen(farm,hen)],[3,1,1,69,2,1,16,true])
  const walk=sections(farm).buttons.find(b=>b.action==='hen-walk-start')!
  assert.equal(walk.enabled,true)
  assert.match(walk.button,/>Погулять вместе<\/button>/)
  assert.deepEqual(getCoopMorning(fast),getCoopMorning(farm))
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),farm)
})

test('depleted local fruit, an already served treat and the other apple-loving hen keep their existing advice',()=>{
  const farm=earnedDay16()
  const other=sections(farm,2)
  const otherClue='Часто засматривается на яблоню.'
  assert.ok(!other.choices.includes(otherClue)&&other.notes.includes(otherClue),'chosen care card, not global advice')

  const treated=structuredClone(farm)
  assert.ok(treatHen(treated,hen,'carrot').ok)
  const spent=sections(treated)
  assert.ok(!spent.choices.includes(clue)&&spent.notes.includes(clue),'not a second treat offer')

  assert.ok(pickFruit(farm,0).ok)
  const carried=sections(farm)
  assert.ok(carried.choices.includes(clue)&&!carried.notes.includes(clue),'carried apple keeps its existing eligible hint')
  assert.ok(cookDish(farm,'appleJam').ok)
  assert.deepEqual([farm.fruit.apple,farm.trees.home[0]?.fruitReady],[0,0])
  const cold=sections(farm)
  assert.ok(!cold.choices.includes(clue)&&cold.notes.includes(clue),'no advice about a nonexistent current apple harvest')
})
