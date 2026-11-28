import assert from 'node:assert/strict'
import test from 'node:test'
import { getCoopMorning, restoreCurrentFarm } from '../src/farm.ts'
import { renderChickenFeedMixes } from '../src/chicken-feed.ts'
import { getIncubatorNewHen } from '../src/coop-panel.ts'
import { renderHenFriendship } from '../src/hen-friendship.ts'
import { chickenCarePlayer } from './fixtures/chicken-care-player.ts'

const cold = (policy: 'garden' | 'orchard') => {
  const p = chickenCarePlayer(policy, 'hatchery')
  for (let day = 0; day < 3; day++) { p.day(); p.act('endDay') }
  assert.equal(p.log.length, 67)
  assert.equal(p.state.day, 4)
  assert.equal(getIncubatorNewHen(p.state), 4)
  return p
}
const choices = (html: string, action: string) =>
  [...html.matchAll(new RegExp(`<button\\b[^>]*data-action="${action}"([^>]*)>`,'g'))].map(([, attrs]) => [
    attrs.match(/data-value="([^"]+)"/)?.[1], !/\sdisabled(?:\s|$)/.test(attrs),
  ])

test('earned first hatch compares either live mix using one shared wheat cost, without arming Meet, Feed or a second batch', () => {
  const orchard = cold('orchard'), garden = cold('garden'), both = cold('garden')
  both.act('pickFruit',0)
  for (const [p, stock, mixChoices, totals] of [
    [orchard,[3,1,0,1],[['orchard',true],['garden',false]],['Запас: 3 → 7']],
    [garden,[2,1,1,0],[['garden',true],['orchard',false]],['Запас: 2 → 5']],
    [both,[2,1,1,2],[['garden',true],['orchard',true]],['Запас: 2 → 5','Запас: 2 → 6']],
  ] as const) {
    const f = p.state, before = structuredClone(f)
    assert.deepEqual([f.feed,f.produce.wheat,f.produce.carrot,f.fruit.apple], stock)
    const meet = renderHenFriendship(f,null,true,4), mix = renderChickenFeedMixes(f)
    const [active,notes] = mix.split('<details class="feed-choice-notes">')
    assert.match(meet, /<h2>Пуговка<\/h2>/)
    assert.deepEqual(choices(meet,'hen-friend-select'),Array.from({length:5},(_,i)=>[String(i),true]))
    assert.deepEqual(choices(meet,'pet'),[['4',true]])
    assert.equal(active.match(/Пшеница ×1/g)?.length, 1)
    const shared = active.match(/<div[^>]*id="(feed-common-wheat)"[^>]*>[\s\S]*?<\/ul>/)?.[0]
    assert.ok(shared && shared.includes('Пшеница ×1') && shared.includes('Есть 1 → 0'))
    assert.deepEqual(choices(active,'mix-chicken-feed'),mixChoices)
    assert.equal(active.match(/aria-describedby="feed-common-wheat"/g)?.length,2)
    assert.deepEqual(active.match(/Запас: \d+ → \d+/g),totals)
    assert.match(active,/Морковь ×1/); assert.match(active,/Яблоко ×1/)
    assert.match(active,/К курятнику/)
    assert.match(notes,/1 порция — вся стая на 1 утро/)
    assert.doesNotMatch(active,/data-action="(?:feed|buy-feed)"/)
    assert.deepEqual(f,before,'looking, selecting the hen, and the cost projection are read-only')
  }
  for (const recipe of ['garden','orchard'] as const) {
    const p=cold('garden'); p.act('pickFruit',0)
    const before=structuredClone(p.state), beforeMorning=getCoopMorning(p.state)
    p.act('mixChickenFeed',recipe)
    const expected=structuredClone(before)
    expected.feed+=recipe==='garden'?3:4;expected.produce.wheat--;expected.workToday++
    if(recipe==='garden')expected.produce.carrot--;else expected.fruit.apple--
    assert.deepEqual(p.state,expected)
    assert.equal(getCoopMorning(p.state).added,0)
    assert.deepEqual(choices(renderChickenFeedMixes(p.state),'mix-chicken-feed'),[['garden',false],['orchard',false]])
    const eggs=p.state.eggsReady
    p.act('feedChickens')
    const funded=getCoopMorning(p.state)
    assert.equal(p.state.feed,expected.feed-1);assert.equal(p.state.chickensFed,true)
    assert.ok(funded.added>beforeMorning.added)
    p.act('endDay')
    assert.equal(p.state.eggsReady,eggs+funded.added)
    assert.deepEqual(restoreCurrentFarm(structuredClone(p.state)),p.state)
  }
})
