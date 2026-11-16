import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, restoreCurrentFarm, sail, getNeighborPlans, joinNeighborPlan, serveNeighborPlan, finishNeighborPlan, introduceHenToVisitor, petChicken, workBed, bakeWorkshop, pickFruit, endDay } from '../src/farm.ts'
import { visitActivityIds, visitActivities, inviteNeighborVisit, finishNeighborVisit } from '../src/neighbor-visits.ts'
import { GuestBookView } from '../src/guest-book-view.ts'

// Existing neighbor-visits.test.ts setup: restored valid synthetic save, not an earned native trace.
function eligible() {
  const farm = createFarm()
  farm.day = 5; farm.boatOwned = true; farm.buildingLevels.farmhouse = 2
  farm.projects.fair = { 'dishes:appleJam': 1, eggBaskets: 1, 'produce:carrot': 4, 'produce:wheat': 3 }
  farm.fairGuestsServed = 1; farm.guestServedOn = 1
  farm.village = { built: true, supplies: { 'handmade:round': 2, 'fish:seaBass': 2, honey: 2 }, residents: ['bea', 'finn'], meals: 2, mealOn: 2, serviceOn: { bea: 0, finn: 0 }, scouting: false }
  farm.dishes.windParfait = 1; farm.dishes.grilledFish = 1; farm.island = 'village'
  for (const plan of getNeighborPlans(farm)) {
    assert.ok(joinNeighborPlan(farm, plan.id).ok)
    assert.ok(serveNeighborPlan(farm, plan.id, plan.resident === 'bea' ? 'dish:windParfait' : 'dish:grilledFish').ok)
    assert.ok(finishNeighborPlan(farm, plan.id, { kind: plan.arrangement, settled: true, placements: [{ slot: 'food', x: 0, y: 0 }, { slot: 'cup', x: -.6, y: .3 }, { slot: 'flowers', x: .6, y: .3 }] }).ok)
  }
  assert.ok(sail(farm, 'home').ok)
  return restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
}

test('each of six real activities is reachable in at most two read-only choices with one exact explicit invitation', () => {
  for (const id of visitActivityIds) {
    const farm = eligible(), view = new GuestBookView(), before = JSON.stringify(farm)
    const resident = id.startsWith('bea') ? 'bea' : 'finn'
    assert.ok(view.choose(farm, 'resident', resident))
    assert.ok(view.choose(farm, 'activity', id))
    const screen = view.current(farm)
    assert.equal(screen.kind, 'invitation')
    assert.equal(screen.activity, id)
    const invitations = screen.commands.filter(command => command.action === 'visit-invite')
    assert.equal(invitations.length, 1)
    assert.equal(invitations[0].value, id)
    assert.equal(invitations[0].enabled, true)
    assert.equal(JSON.stringify(farm), before)
    assert.deepEqual(view.resolve(farm, invitations[0]), { action: 'visit-invite', value: id })
    assert.equal(JSON.stringify(farm), before)
    assert.ok(inviteNeighborVisit(farm, view.resolve(farm, invitations[0])!.value).ok)
    assert.equal(farm.neighborVisits.active?.activity, id)
    assert.equal(view.resolve(farm, invitations[0]), undefined)
  }
})

test('invitation eligibility is distinct from work readiness and always recomputed from live domain state', () => {
  const farm = createFarm(), view = new GuestBookView()
  assert.match(view.current(farm).gate!, /Постройте/)
  assert.equal(view.current(farm).commands.find(c => c.action === 'visit-invite')!.enabled, false)
  farm.village.built = true
  assert.match(view.current(farm).gate!, /поселиться/)
  farm.village.residents = ['bea']
  assert.match(view.current(farm).gate!, /общую встречу/)
  const unlocked = eligible()
  assert.ok(view.choose(unlocked, 'activity', 'beaHands'))
  assert.match(view.current(unlocked).readiness!, /2 пшеницы и 1 яйцо/)
  assert.equal(view.current(unlocked).workReady, false)
  const command = view.current(unlocked).commands.find(c => c.action === 'visit-invite')!
  assert.ok(view.resolve(unlocked, command), 'not having baking supplies does not forbid a free invitation')
  unlocked.produce.wheat = 2; unlocked.eggs = 1
  assert.equal(view.current(unlocked).workReady, true)
  assert.ok(sail(unlocked, 'village').ok)
  assert.match(view.current(unlocked).gate!, /Родного острова/)
  assert.equal(view.resolve(unlocked, command), undefined)
  assert.ok(view.current(unlocked).commands.some(c => c.action === 'visit-book-home'))
  assert.ok(sail(unlocked, 'home').ok)
  unlocked.neighborVisits.serial = 1_000_000
  assert.match(view.current(unlocked).gate!, /заполнена/)
  assert.equal(view.current(unlocked).commands.find(c => c.action === 'visit-invite')!.enabled, false)
})

test('rules, empty memories and Back preserve exact transient choice; stale selections never resolve', () => {
  const farm = eligible(), view = new GuestBookView(), before = JSON.stringify(farm)
  view.choose(farm, 'resident', 'finn'); view.choose(farm, 'activity', 'finnOrchard')
  const selected = view.snapshot(), old = view.current(farm).commands.find(c => c.action === 'visit-invite')!
  assert.ok(view.choose(farm, 'page', 'rules'))
  assert.equal(view.current(farm).kind, 'rules')
  assert.equal(view.resolve(farm, old), undefined)
  assert.ok(view.back())
  assert.deepEqual(view.snapshot(), selected)
  assert.equal(view.resolve(farm, old), undefined, 'Back does not revive a discarded action token')
  assert.ok(view.choose(farm, 'page', 'memories'))
  assert.equal(view.current(farm).kind, 'memories')
  assert.equal(view.current(farm).memory, undefined)
  assert.ok(view.back()); assert.equal(view.back(), false, 'caller may now use its existing parent Back')
  const snapshot = view.snapshot(); snapshot.activity = 'beaFlock'
  assert.equal(view.current(farm).activity, 'finnOrchard', 'snapshot does not leak mutable view state')
  const restored = new GuestBookView()
  assert.ok(restored.restore(selected))
  assert.equal(restored.current(farm).activity, 'finnOrchard')
  for (const bad of [null, {}, { ...selected, activity: 'beaFlock' }, { ...selected, page: 'execute' }, { ...selected, memory: '__proto__' }]) assert.equal(restored.restore(bad), false)
  for (const [part, value] of [['resident', 'stranger'], ['activity', 'beaHarvest'], ['memory', 'finnOrchard'], ['page', 'execute']]) assert.equal(view.choose(farm, part, value), false)
  assert.equal(JSON.stringify(farm), before)
})

test('active work, all hens and both response choices resolve only the current serial and observation phase', () => {
  for (const id of visitActivityIds) {
    const farm = eligible(), view = new GuestBookView()
    farm.produce.wheat = 2; farm.eggs = 1
    farm.beds[0] = { kind: 'crop', crop: 'carrot', growth: 1, watered: false }
    farm.trees.home[0] = { tree: 'apple', age: 2, fruitReady: 2 }
    assert.ok(inviteNeighborVisit(farm, id).ok)
    const screen = view.current(farm), before = JSON.stringify(farm)
    assert.equal(screen.kind, 'active'); assert.equal(screen.activity, id)
    assert.equal(view.choose(farm, 'activity', 'beaFlock'), false)
    assert.equal(view.choose(farm, 'resident', 'finn'), false)
    assert.equal(screen.commands.some(c => c.action === 'visit-invite' || c.action === 'visit-reply'), false)
    const kind = visitActivities[id].kind
    if (kind === 'hen') {
      const hens = screen.commands.filter(c => c.action === 'visit-introduce-hen')
      assert.equal(hens.length, farm.flockSize)
      assert.deepEqual(hens.map(c => c.value), ['1:0', '1:1', '1:2', '1:3'])
      for (const command of hens) assert.deepEqual(view.resolve(farm, command), { action: command.action, value: command.value })
      assert.equal(JSON.stringify(farm), before)
      petChicken(farm, 0) // The ordinary first pet itself records the visit.
    } else {
      const command = screen.commands.find(c => c.action === 'visit-do')!
      assert.deepEqual(view.resolve(farm, command), { action: 'visit-do', value: '1' })
      assert.equal(JSON.stringify(farm), before)
      assert.ok((kind === 'crop' ? workBed(farm, 0) : kind === 'pastry' ? bakeWorkshop(farm, 'folded') : pickFruit(farm, 0)).ok)
    }
    for (const command of screen.commands) assert.equal(view.resolve(farm, command), undefined, 'old pending buttons cannot finish an observed visit')
    const observed = view.current(farm), saved = JSON.stringify(farm)
    assert.equal(observed.commands.some(c => c.action === 'visit-do' || c.action === 'visit-introduce-hen'), false)
    assert.deepEqual(observed.commands.filter(c => c.action === 'visit-reply').map(c => c.value), ['1:quiet', '1:curious'])
    assert.ok(observed.commands.some(c => c.action === 'visit-finish' && c.value === '1'))
    assert.ok(observed.commands.some(c => c.action === 'close'))
    for (const answer of ['quiet', 'curious', undefined]) {
      const copy = structuredClone(farm)
      const token = observed.commands.find(c => c.action === (answer ? 'visit-reply' : 'visit-finish') && c.value === (answer ? `1:${answer}` : '1'))!
      const resolved = view.resolve(copy, token)!
      assert.ok(finishNeighborVisit(copy, Number(resolved.value.split(':')[0]), answer).ok)
      assert.equal(copy.neighborVisits.memories[0].reply, answer ?? null)
      assert.equal(view.resolve(copy, token), undefined)
      assert.ok(restoreCurrentFarm(JSON.parse(JSON.stringify(copy))))
      inviteNeighborVisit(copy, id)
      assert.equal(view.resolve(copy, token), undefined, 'old serial cannot finish a later visit')
    }
    assert.equal(JSON.stringify(farm), saved)
  }
})

test('six memories remain selectable independently of invitations and retain exact first moment after repeat/rest/reload', () => {
  const farm = eligible(), view = new GuestBookView()
  farm.produce.wheat = 2; farm.eggs = 1
  farm.beds[0] = { kind: 'crop', crop: 'carrot', growth: 1, watered: false }
  farm.beds[1] = { kind: 'crop', crop: 'carrot', growth: 1, watered: false }
  farm.trees.home[0] = { tree: 'apple', age: 2, fruitReady: 2 }
  for (const id of visitActivityIds) {
    assert.ok(inviteNeighborVisit(farm, id).ok)
    const kind = visitActivities[id].kind
    const result = kind === 'crop' ? workBed(farm, id === 'beaHarvest' ? 0 : 1) : kind === 'pastry' ? bakeWorkshop(farm, 'round') : kind === 'fruit' ? pickFruit(farm, 0) : introduceHenToVisitor(farm, 0)
    assert.ok(result.ok)
    assert.ok(finishNeighborVisit(farm, farm.neighborVisits.serial, 'quiet').ok)
  }
  assert.equal(farm.neighborVisits.memories.length, 6)
  const first = structuredClone(farm.neighborVisits.memories)
  view.choose(farm, 'resident', 'finn'); view.choose(farm, 'activity', 'finnOrchard')
  assert.match(view.current(farm).commands[0].label, /Позвать снова/)
  assert.ok(inviteNeighborVisit(farm, 'beaFlock').ok); assert.ok(introduceHenToVisitor(farm, 1).ok)
  assert.notEqual(farm.neighborVisits.active!.observation!.subject, first[2].subject)
  const before = JSON.stringify(farm)
  assert.ok(view.choose(farm, 'page', 'memories'))
  for (const id of visitActivityIds) {
    assert.ok(view.choose(farm, 'memory', id))
    assert.deepEqual(view.current(farm).memory, first.find(m => m.activity === id))
    assert.deepEqual(view.current(farm).commands, [])
  }
  const copy = view.current(farm).memory!; copy.subject = 'not saved'
  assert.deepEqual(farm.neighborVisits.memories, first)
  assert.equal(JSON.stringify(farm), before)
  assert.ok(view.back()); assert.equal(view.current(farm).kind, 'active')
  const token = view.current(farm).commands.find(c => c.action === 'visit-reply')!
  endDay(farm)
  const loaded = restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(loaded); assert.equal(loaded.neighborVisits.active, null)
  assert.deepEqual(loaded.neighborVisits.memories, first)
  assert.equal(view.resolve(loaded, token), undefined)
  assert.equal(view.current(loaded).activity, 'finnOrchard', 'active visit did not overwrite voluntary invitation selection')
  const after = JSON.stringify(loaded)
  assert.ok(view.choose(loaded, 'page', 'memories')); assert.equal(view.current(loaded).memories.length, 6)
  assert.equal(JSON.stringify(loaded), after)
})

test('semantic prototype exposes one exact invitation, named selectors/memory/rules, and no live production hooks', async () => {
  const { renderGuestBookPrototype: render } = await import('../src/guest-book-prototype.ts')
  const farm = eligible(), view = new GuestBookView(), before = JSON.stringify(farm)
  for (const id of visitActivityIds) {
    view.choose(farm, 'resident', id.startsWith('bea') ? 'bea' : 'finn'); view.choose(farm, 'activity', id)
    const html = render(farm, view, key => `<i data-art="${key}"></i>`)
    assert.equal((html.match(/data-guest-command="visit-invite"/g) ?? []).length, 1)
    assert.equal((html.match(/<option /g) ?? []).length, 3)
    assert.match(html, /<label[^>]*>Чем займёмся/)
    assert.match(html, /aria-pressed="true"/)
    assert.ok(html.includes(visitActivities[id].goal)); assert.ok(html.includes(visitActivities[id].invitation))
    assert.ok(html.includes(`data-value="${id}"`)); assert.match(html, /Наши встречи · 0\/6/); assert.match(html, /О визитах/)
    assert.doesNotMatch(html, /data-action=|<script|onclick=/, 'not accidentally executable by the live delegated main handler')
  }
  view.choose(farm, 'page', 'rules')
  const rules = render(farm, view, () => '')
  assert.match(rules, /Повторные визиты не дают монет/); assert.match(rules, /Один гость за раз/); assert.match(rules, /К приглашениям/)
  view.choose(farm, 'page', 'memories')
  assert.match(render(farm, view, () => ''), /первые встречи/)
  assert.equal(JSON.stringify(farm), before)
})

test('rendered exact tokens use the real resolver, while stale/repeated/forged and escaped memory data are inert', async () => {
  const { renderGuestBookPrototype: render } = await import('../src/guest-book-prototype.ts')
  const farm = eligible(), view = new GuestBookView()
  view.choose(farm, 'activity', 'beaFlock')
  const html = render(farm, view, () => '')
  const attrs = /data-guest-command="([^"]+)" data-value="([^"]*)" data-context="([^"]+)"/.exec(html)!
  const request = { action: attrs[1], value: attrs[2], context: attrs[3] }
  assert.deepEqual(view.resolve(farm, request), { action: 'visit-invite', value: 'beaFlock' })
  for (const requestChange of [{ action: 'sail', value: 'grove' }, { value: 'finnFlock' }, { context: 'saved-payload' }]) assert.equal(view.resolve(farm, { ...request, ...requestChange }), undefined)
  assert.ok(inviteNeighborVisit(farm, view.resolve(farm, request)!.value).ok)
  assert.equal(view.resolve(farm, request), undefined, 'one accepted dispatch invalidates repeat click token')
  assert.ok(introduceHenToVisitor(farm, 0).ok)
  const before = JSON.stringify(farm), observed = render(farm, view, () => '')
  assert.equal((observed.match(/data-guest-command="visit-reply"/g) ?? []).length, 2)
  assert.match(observed, /data-guest-command="visit-finish"/); assert.match(observed, /data-guest-command="close"/)
  assert.ok(observed.includes(visitActivities.beaFlock.quiet)); assert.ok(observed.includes(visitActivities.beaFlock.curious))
  assert.equal(JSON.stringify(farm), before)
  // Deliberately unsafe in-memory display fields: renderer escapes even though save validation also rejects them.
  farm.neighborVisits.active!.observation!.subject = '<img onerror="alert(1)">'
  farm.neighborVisits.memories[0].detail = '<script>untrusted</script>'
  assert.match(render(farm, view, () => ''), /&lt;img/)
  view.choose(farm, 'page', 'memories')
  const memory = render(farm, view, () => '')
  assert.match(memory, /<label[^>]*>Выберите встречу/); assert.match(memory, /&lt;script&gt;untrusted/)
  assert.doesNotMatch(memory, /<script|<img|data-guest-command="visit-reply"/)
  assert.match(memory, /К гостю/)
})

test('the prototype tells today’s second harvest apart from the original crop and reply in the book', async () => {
  const { renderGuestBookPrototype: render } = await import('../src/guest-book-prototype.ts')
  const farm = eligible(), view = new GuestBookView(), icon = () => ''
  farm.beds[0] = { kind: 'crop', crop: 'carrot', growth: 1, watered: false }
  farm.beds[1] = { kind: 'crop', crop: 'wheat', growth: 2, watered: false }
  assert.ok(inviteNeighborVisit(farm, 'beaHarvest').ok)
  assert.ok(workBed(farm, 0).ok)
  assert.match(render(farm, view, icon), /Воспоминание добавлено в книгу/)
  assert.ok(finishNeighborVisit(farm, 1, 'quiet').ok)
  const first = structuredClone(farm.neighborVisits.memories[0])
  assert.ok(inviteNeighborVisit(farm, 'beaHarvest').ok)
  assert.ok(workBed(farm, 1).ok)
  const today = farm.neighborVisits.active!.observation!
  assert.notEqual(today.subject, first.subject)
  const before = JSON.stringify(farm), html = render(farm, view, icon)
  assert.ok(html.includes(`Сегодня: ${today.subject}`))
  assert.match(html, /В книге осталась ваша первая встреча/)
  assert.doesNotMatch(html, /Воспоминание добавлено в книгу/)
  assert.equal(JSON.stringify(farm), before)
  assert.ok(finishNeighborVisit(farm, 2, 'curious').ok)
  const loaded = restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
  assert.deepEqual(loaded.neighborVisits.memories, [first])
  view.choose(loaded, 'page', 'memories')
  assert.ok(render(loaded, view, icon).includes(first.subject))
  assert.ok(render(loaded, view, icon).includes(visitActivities.beaHarvest.quiet))
})

test('the rules explain that only the neighbor you have already met is unlocked', async () => {
  const { renderGuestBookPrototype: render } = await import('../src/guest-book-prototype.ts')
  const farm = eligible(), view = new GuestBookView()
  farm.neighbors.finn.completed = 0
  assert.equal(view.current(farm).commands[0].enabled, true)
  view.choose(farm, 'resident', 'finn')
  assert.equal(view.current(farm).commands[0].enabled, false)
  view.choose(farm, 'page', 'rules')
  assert.match(render(farm, view, () => ''), /сначала устройте встречу с ним в Лавандовой гавани/)
})
