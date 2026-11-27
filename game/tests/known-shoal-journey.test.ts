import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { createContext, runInContext, runInNewContext } from 'node:vm'
import { ActionClickGuard, ActivationKeyGuard, isGuardedAction } from '../src/action-click-guard.ts'
import * as F from '../src/farm.ts'
import * as J from '../src/journey.ts'
import { getCapeJourneyStatus } from '../src/cape-journey-status.ts'
import { setDiscoveryPace } from '../src/discovery-preferences.ts'
import { initialExpeditionPreview } from '../src/ferry-expeditions.ts'
import { firstFerryCargoOffer } from '../src/ferry-smaller-cargo.ts'
import { expeditionWallet } from '../src/harbour-economy.ts'
import { inviteNeighborVisit } from '../src/neighbor-visits.ts'
import { ruPlural } from '../src/ru.ts'
import { getShoalFindAt, shoalDefinitions, shoalFindIds } from '../src/shoal.ts'
import { shoalReturnCopy } from '../src/shoal-return.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const main = read('../src/main.ts')
const section = (a: string, b: string) => {
  const start = main.indexOf(a), end = main.indexOf(b, start + a.length)
  assert.ok(start >= 0 && end > start, a)
  return main.slice(start, end)
}
const renderCode = stripTypeScriptTypes(section('function button(', 'function panelTabs(') + '\nswitch(panel){'
  + section("    case 'boat': {", "    case 'dock-project':").replaceAll('import.meta.env.BASE_URL', "'/'")
  + section("    case 'shoal': {", "    case 'guest':") + '}')
const actionCode = stripTypeScriptTypes(section('async function visitPanelAt(', 'function openGuidedMarket(')
  + 'async function press(action, value) { switch(action){'
  + (main.includes("case 'shoal-route': {") ? section("    case 'shoal-route': {", "    case 'market-sale-clear':") : '')
  + section("    case 'sail': {", "    case 'store-tree': {")
  + section("    case 'shoal-pick': {", "    case 'grill-fish': {") + '}}')

const readActions = (p: string): {name: string; args: unknown[]}[] => JSON.parse(read('./fixtures/' + p))
const standard = readActions('home-progress-actions.json')
const withBea = readActions('market-order-selection-commands.json')
const ok = (r: F.ActionResult) => assert.ok(r.ok, r.message)
const cold = (f: F.FarmState) => {
  const copy = F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!
  assert.deepEqual(copy, f)
  return copy
}

function earned(withGuest = false) {
  const actions = withGuest ? withBea : standard
  const p = commissionPlayer(actions.slice(0, 55))
  assert.equal(p.state.day, 6)
  p.visit('grove')
  for (const shell of ['regular', 'moon'] as const) {
    const spot = [0, 1, 2].find(n => F.getShellAt(p.state, n) === shell)
    assert.notEqual(spot, undefined)
    p.act('collectShell', spot)
  }
  p.act('collectShoalFind', 'glass')
  p.visit('home')
  let index = 55
  while (p.state.day < 11) {
    const a = actions[index++]; p.act(a.name, ...a.args)
  }
  const first = cold(p.state)
  assert.equal(first.shoalDiscoveries.includes('pearl'), false)
  assert.equal(getShoalFindAt(first, 'pearl'), 'pearl')
  p.visit('grove')
  p.act('collectShoalFind', 'pearl')
  assert.equal(p.actions, 99)
  assert.ok(F.setGrovePearlCabinet(p.state, 'place')); p.reload()
  p.visit('home')
  if (withGuest) {
    while (index < 118) { const a = actions[index++]; p.act(a.name, ...a.args) }
    assert.ok(p.state.village.residents.includes('bea')); assert.equal(p.state.neighbors.bea.completed, 1)
  }
  while (p.state.day < 16) p.night()
  assert.equal(p.state.day, 16)
  assert.deepEqual([p.state.shoalFinds.pearl, p.state.grovePearlDisplay], [1, true])
  return { first, p }
}

const render = (farm: F.FarmState, panel: 'boat' | 'shoal' = 'boat', boatIsland = 'grove') => {
  const before = JSON.stringify(farm), dialogContent = {innerHTML: ''}
  const preview = initialExpeditionPreview(farm.freight.expeditions)
  runInNewContext(renderCode, {...F, ...J, farm, dialogContent, boatIsland, panel, getCapeJourneyStatus, getShoalFindAt,
    shoalDefinitions, shoalFindIds, shoalReturnCopy, ruPlural, firstFerryCargoOffer, expeditionWallet,
    selectedExpeditionPort:preview.port, selectedExpeditionOffer:preview.offer, escapeHtml:String, icon:() => '',
    itemIcon:() => '', requirementLink:() => '', journeyDetailsOpen:false, pastryShape:'round', numberFormat:new Intl.NumberFormat('ru')})
  assert.equal(JSON.stringify(farm), before)
  const html = dialogContent.innerHTML
  const nav = html.match(/<nav class="island-places"[^>]*>([\s\S]*?)<\/nav>/)?.[1]
  const controls = [...(nav ?? html).matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attrs, label]) => ({
    action: attrs.match(/data-action="([^"]+)"/)?.[1], value: attrs.match(/data-value="([^"]+)"/)?.[1],
    label: label.trim(), enabled: !/\sdisabled\b/.test(attrs), secondary: attrs.includes('dialog-button secondary'),
  }))
  return {html, controls}
}
const route = {action:'shoal-route', value:'16', label:'На Лунную отмель', enabled:true, secondary:true}
const travel = {action:'sail', value:'grove', label:'Отправиться', enabled:true, secondary:false}
const shortcut = (f: F.FarmState) => render(f).controls.filter(b => b.action === route.action)

function mount(farm: F.FarmState, {present = true, active = true, selected = 'grove', card = 'grove'} = {}) {
  const steps: string[] = []
  const ctx = {
    ...F, ...J, farm, panel:'boat' as string | undefined, boatIsland:selected, dialog:{open:active},
    dialogContent:{contains:() => present}, control:{closest:(s:string) => s === `.journey-card[data-island="${card}"]` ? {} : null},
    island:{isCrossing:() => false, async crossIsland(fn:() => boolean) { steps.push('cross'); assert.ok(fn()) }},
    panelHistory:[] as {panel:string | undefined; boatIsland:string}[],
    rememberPanel:() => ({panel:ctx.panel, boatIsland:ctx.boatIsland}),
    fieldViewButton:{getAttribute:() => 'false'}, fieldLayout:{matches:false}, canvas:{focus() {}},
    closeDialog() { ctx.dialog.open = false; ctx.panel = undefined; ctx.panelHistory.length = 0 },
    perform(fn: () => F.ActionResult) { ok(fn()); steps.push('sail-save'); return true },
    openPanel(id: string) { ctx.dialog.open = true; ctx.panel = id; steps.push('open:' + id) },
    shoalFindIds, getShoalFindAt,
    activateTarget(target: {kind:string; id: 'pearl' | 'glass'}) {
      assert.equal(target.kind, 'shoal-find')
      ok(F.collectShoalFind(farm, target.id)); steps.push('collect')
    },
  }
  const vm = createContext(ctx); runInContext(actionCode, vm)
  return {ctx, steps, press: (action:string, value:string) => runInContext(`press(${JSON.stringify(action)}, ${JSON.stringify(value)})`, vm)}
}

test('a normally earned known pearl distinguishes the ready D16 and waiting D17 Grove cards before any crossing', () => {
  const {first, p} = earned(), today = p.state
  const next = cold(today); ok(F.endDay(next))
  assert.deepEqual([today.day, today.coins, next.day, next.coins], [16, 72, 17, 72])
  assert.equal(F.ingredientCount(today, {kind:'shoalFinds', item:'pearl', quantity:1}), 0)
  assert.match(render(today).html, /class="journey-return-status">Лунная жемчужина · На берегу сегодня\./)
  assert.match(render(next).html, /class="journey-return-status">Лунная жемчужина · Следующая находка: день 21\./)
  for (const f of [first, today, next]) assert.deepEqual(render(f).controls[0], travel)
  assert.doesNotMatch(render(first).html, /Лунная жемчужина|shoal-route/)
  assert.deepEqual(shortcut(today), [route])
  assert.deepEqual(shortcut(next), [])
  for (const island of ['home','cape','village']) assert.doesNotMatch(render(today,'boat',island).html, /Лунная жемчужина|shoal-route/)
})

test('the opted-in route is one ordinary crossing into the existing Shoal; only separate Pick earns an item', async () => {
  const f = cold(earned().p.state), start = cold(f), model = cold(f)
  const {ctx, steps, press} = mount(f)
  const entry = shortcut(f)[0]
  assert.ok(entry?.enabled, 'the actual boat card offers the separate explicit action')
  await press(entry.action!, entry.value!)
  ok(F.sail(model,'grove'))
  assert.deepEqual(steps, ['cross','sail-save','open:shoal'])
  assert.deepEqual(f, model)
  assert.deepEqual([ctx.panel, ctx.panelHistory[0]?.panel, ctx.panelHistory[0]?.boatIsland, f.day, f.coins, f.shoalFinds.pearl],
    ['shoal', 'boat', 'grove', 16, start.coins, 1])
  assert.doesNotMatch(render(f).html, /shoal-route/, 'local Grove retains the same default paths')
  // Reduced-motion travel may replace the button before a double click finishes.
  // The same accepted pointer/held key must not pick from the newly opened panel.
  assert.ok(isGuardedAction(entry.action))
  const pointer = new ActionClickGuard(), keys = new ActivationKeyGuard()
  const gesture = {clientX:548, clientY:411, timeStamp:200, detail:1}
  pointer.remember(gesture)
  assert.equal(pointer.blocks({...gesture,timeStamp:275,detail:2}), true)
  assert.equal(pointer.blocks({...gesture,clientY:431,timeStamp:275}), false)
  assert.equal(keys.blocks({key:'Enter',repeat:false},isGuardedAction(entry.action)),false)
  assert.equal(keys.blocks({key:'Enter',repeat:true},false),true)
  keys.release('Enter')
  assert.equal(keys.blocks({key:'Enter',repeat:false},false),false)
  const pick = render(f,'shoal').controls.find(b => b.action==='shoal-pick' && b.value==='pearl')
  assert.ok(pick?.enabled)
  await press(pick.action!,pick.value!)
  ok(F.collectShoalFind(model,'pearl'))
  assert.deepEqual(f, model)
  assert.deepEqual(steps, ['cross','sail-save','open:shoal','collect'])
  assert.deepEqual([f.coins, f.shoalFinds.pearl, f.grovePearlDisplay], [start.coins,2,true])
  ok(F.sail(f,'home'))
  assert.match(render(f).html, /Сегодня собрано\. Следующая находка: день 21\./)
  assert.deepEqual(shortcut(f), [])
})

test('quiet play and a real active Bea visit keep the ordinary Grove route; stale or wrong-context controls cannot sail', async () => {
  const f = cold(earned().p.state), q = cold(f), old = cold(f)
  setDiscoveryPace(q.discoveryPreferences,true)
  const {p} = earned(true)
  const occupied = cold(p.state)
  ok(inviteNeighborVisit(occupied,'beaFlock'))
  for (const state of [occupied, q]) assert.match(render(state).html, /Лунная жемчужина · На берегу сегодня/)
  for (const state of [q, occupied]) {
    const before=cold(state)
    assert.deepEqual(shortcut(state), [])
    assert.deepEqual(render(state).controls[0], travel)
    const check = mount(state); await check.press('shoal-route','16')
    assert.deepEqual(check.steps, []); assert.deepEqual(state, before)
  }
  for (const opts of [{present:false},{active:false},{selected:'cape'},{card:'home'}]) {
    const check = mount(f, opts); await check.press('shoal-route','16')
    assert.deepEqual(check.steps, []); assert.deepEqual(f, old)
  }
  const check = mount(f); await check.press('shoal-route','11')
  assert.deepEqual(check.steps, []); assert.deepEqual(f, old)
  const next = cold(f); ok(F.endDay(next))
  const spent = cold(f); ok(F.sail(spent,'grove')); ok(F.collectShoalFind(spent,'pearl')); ok(F.sail(spent,'home'))
  for (const invalid of [next, spent]) {
    const initial=cold(invalid), click=mount(invalid); await click.press('shoal-route',String(invalid.day))
    assert.deepEqual(click.steps, []); assert.deepEqual(invalid,initial)
  }
  await check.press('sail','grove')
  assert.deepEqual(check.steps, ['cross','sail-save'])
  assert.equal(check.ctx.panel, undefined)
  assert.deepEqual([f.day, f.coins, f.shoalFinds.pearl], [16, old.coins, old.shoalFinds.pearl])
})
