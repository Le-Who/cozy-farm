import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getDiscoveryTask } from '../src/discovery-path.ts'
import { renderHarbourFishChoice } from '../src/harbour-fish-route.ts'
import { harbourTradePlayer } from './fixtures/harbour-trade-player.ts'

const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
const exactReturn = { label: 'К вернувшемуся парому', target: 'open-panel', value: 'bay-freight' }

function earnedVoyage(resident: 'bea' | 'finn', shipment: 'salt-fish' | 'salt-buy' = 'salt-fish') {
  const p = harbourTradePlayer(opening)
  p.build('mill-buy')
  p.visit('village')
  p.act('inviteResident', resident, 0)
  p.visit('home')
  p.act('sendFerryExpedition', shipment)
  p.visit('village')
  return p
}

function returnToVillage(p: ReturnType<typeof earnedVoyage>) {
  p.night()
  p.visit('village')
  p.reload()
}

test('the first supper points to already paid local bass without claiming or serving it', () => {
  const p = earnedVoyage('bea')
  assert.equal(p.state.freight.expeditions.active?.phase, 'sailing')
  assert.deepEqual(getDiscoveryTask(p.state).action, { label: 'Домой', target: 'sail', value: 'home' })
  returnToVillage(p)
  assert.equal(p.state.day, 14)
  assert.equal(p.actions, 95)
  assert.equal(p.state.village.meals, 0)
  assert.equal(p.state.fish.seaBass + p.state.fish.perch, 0)
  assert.equal(p.state.handmade.round, 1)
  assert.equal(p.state.freight.expeditions.active?.phase, 'ready')
  assert.equal(p.state.freight.expeditions.active?.payCoins, 28)
  const before = structuredClone(p.state)
  assert.deepEqual(getDiscoveryTask(p.state).action, exactReturn)
  assert.match(renderHarbourFishChoice(p.state, 'supper'), /Поймать бесплатно/)
  assert.deepEqual(p.state, before)
  p.act('receiveFerryExpedition')
  assert.equal(p.state.fish.seaBass, 2)
  assert.equal(p.state.village.meals, 0)
  assert.equal(getDiscoveryTask(p.state).action.target, 'village-meal')
  p.act('serveVillageMeal', 'round')
  assert.equal(p.state.fish.seaBass, 1)
  assert.equal(p.state.village.meals, 1)
  assert.equal(p.state.island, 'village')
  assert.equal(p.state.coins, before.coins)
  assert.deepEqual(p.log.slice(-2).map(action => action.name), ['receiveFerryExpedition', 'serveVillageMeal'])
})

test('a ready local meeting and an unrelated paid cargo keep their original guidance', () => {
  const finn = earnedVoyage('finn')
  returnToVillage(finn)
  assert.deepEqual(getDiscoveryTask(finn.state).action, { label: 'К встрече', target: 'open-neighbor', value: 'finn' })
  const salt = earnedVoyage('bea', 'salt-buy')
  returnToVillage(salt)
  assert.equal(salt.state.freight.expeditions.active?.phase, 'ready')
  assert.deepEqual(getDiscoveryTask(salt.state).action, { label: 'Домой', target: 'sail', value: 'home' })
})
