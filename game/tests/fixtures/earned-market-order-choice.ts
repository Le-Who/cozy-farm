import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getBedAction, getBedHarvestPreview, getTreeAction, type FarmState } from '../../src/farm.ts'
import { commissionPlayer } from './commission-player.ts'

const steps = JSON.parse(readFileSync(new URL('./home-progress-actions.json', import.meta.url), 'utf8')) as {name:string;args:unknown[]}[]

/** Public operations only; the two order alternatives use the same earned stock. */
export function earnedMarketOrderChoice(): FarmState {
  const player = commissionPlayer(steps)
  player.visit('home')
  player.act('pickFruit', 0)
  player.act('selectSeed', 'wheat')
  player.act('workBed', 0, 0)
  while (getBedAction(player.state, 0).kind !== 'harvest') {
    assert.ok(player.state.day < 18)
    if (getBedAction(player.state, 0).kind === 'water') player.act('workBed', 0, 0)
    player.night()
    if (player.state.day < 16 && getTreeAction(player.state, 0).kind === 'pick') player.act('pickFruit', 0)
  }
  assert.deepEqual(getBedHarvestPreview(player.state, 0),
    {crop:'wheat',total:3,ordinary:2,special:1,trait:'dew',picnicBonus:0})
  player.act('workBed', 0, 0)
  if (getTreeAction(player.state, 0).kind === 'pick') player.act('pickFruit', 0)
  player.act('cookDish', 'appleJam')
  assert.deepEqual([player.actions,player.state.day,player.state.produce.wheat,player.state.dishes.appleJam,player.state.eggs], [118,16,2,1,3])
  assert.deepEqual(player.state.village.residents, ['bea','finn'])
  return player.state
}
