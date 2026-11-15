import { readFileSync } from 'node:fs'
import { getBedAction } from '../../src/farm.ts'
import { getShopCommissionOffers } from '../../src/shop-commissions.ts'
import { commissionPlayer } from './commission-player.ts'

/** Public actions and a real shop purchase, with save validation after every action. */
export function firstCommissionReturnPlayer(finish = true) {
  const opening = JSON.parse(readFileSync(new URL('./home-progress-actions.json', import.meta.url), 'utf8'))
  const p = commissionPlayer(opening), recipeId = p.cook()
  p.shelf(recipeId); p.sale()
  for (const resident of ['bea', 'finn']) {
    p.cook(recipeId); p.act('tasteSignature', recipeId, resident)
  }
  if (finish) {
    p.act('acceptShopCommission', getShopCommissionOffers(p.state)[0].key)
    const serial = String(p.state.shopCommissions.serial)
    for (let i = 0; i < 2; i++) { p.cook(recipeId); p.act('deliverShopCommission', serial) }
    p.act('finishShopCommission', serial)
  }
  return { p, recipeId }
}

/** Continue the same earned farm through the first festival to the unspent Bea bonus. */
export function harbourCraftReturnPlayer() {
  const { p, recipeId } = firstCommissionReturnPlayer()
  p.night(); p.visit('village')
  p.act('beginFestival', 'harvest')
  p.fruit('apple', 3); p.visit('village')
  p.act('contributeFestival', 'participation', 'harvest')
  for (let i = 0; i < 3; i++) p.act('contributeFestival', 'fruit', 'apple')
  p.visit('home'); p.act('buySeeds', 'wheat'); p.act('selectSeed', 'wheat')
  for (const index of [0, 2, 3]) p.act('workBed', index)
  for (let day = 0; day < 4; day++) {
    p.visit('home')
    for (let index = 0; index < p.state.beds.length; index++) {
      const action = getBedAction(p.state, index)
      if (action.kind === 'water') {
        if (!action.available) p.act('refillWater')
        p.act('workBed', index)
      } else if (action.kind === 'harvest') p.act('workBed', index)
    }
    p.night()
  }
  p.visit('home')
  for (let index = 0; index < p.state.beds.length; index++) {
    if (getBedAction(p.state, index).kind === 'harvest') p.act('workBed', index)
  }
  p.visit('village')
  for (let i = 0; i < 3; i++) p.act('contributeFestival', 'roots', 'carrot')
  for (let i = 0; i < 2; i++) p.act('contributeFestival', 'greens', 'wheat')
  p.night(); p.visit('village')
  for (let i = 0; i < 2; i++) { p.cook(recipeId); p.act('contributeFestival', 'treat', `signature:${recipeId}`) }
  p.night(); p.visit('village'); p.act('finishFestival')
  return { p, recipeId }
}
