import { commissionPlayer } from './commission-player.ts'
import { cropDefinitions, getBedStage, type CropBed } from '../../src/farm.ts'
import { getShopCommissionOffers } from '../../src/shop-commissions.ts'
import { setBayShopPrice } from '../../src/bay-shop-model.ts'

export function berryNurseryPlayer(opening: { name: string; args: unknown[] }[]) {
  const p = commissionPlayer(opening)
  const home = () => p.visit('home')
  function grow() {
    home()
    for (let night = 0; night < 4; night++) {
      const growing = p.state.beds.flatMap((b, i) => b.kind === 'crop' && b.crop === 'blueberry' && getBedStage(b) !== 'ripe' ? [i] : [])
      if (!growing.length) return
      for (const i of growing) if (!(p.state.beds[i] as CropBed).watered) {
        if (!p.state.water) p.act('refillWater')
        p.act('workBed', i)
      }
      p.night()
    }
    throw Error('Blueberry failed to mature')
  }
  home(); p.act('buySeeds', 'blueberry'); p.act('selectSeed', 'blueberry'); p.act('workBed', 0); grow()
  if ((p.state.beds[0] as CropBed).trait !== 'dew') throw Error('Earned baseline changed: expected rainy blueberry')
  function divide(source: number, destination: number) { home(); p.act('propagateBerry', source, destination) }
  function cook(id?: string) {
    p.fruit('apple', 1); p.visit('village')
    return id ? p.act('repeatSignature', id).recipeId as string : p.act('completeSignature',
      { base: 'preserves', ingredients: [{ id: 'apple', quantity: 1 }, { id: 'blueberry', quantity: 1, trait: 'dew' }] },
      { family: 'preserves', processing: 'chunky', fruit: [], steps: ['mix', 'pour'] }).recipeId as string
  }
  function introduce(id: string) {
    p.shelf(id)
    // An actual fair price above Bea's unmatched willingness, within Finn's taste premium.
    const base = p.state.culinary.recipes.find(r => r.id === id)!.sellPrice
    if (!setBayShopPrice(p.state.bayShop, 0, Math.ceil(base * 1.1))) throw Error('Cannot set shop price')
    p.sale()
    if (!getShopCommissionOffers(p.state).some(o => o.customer === 'finn' && o.recipeId === id)) throw Error('No real returning customer')
  }
  return { p, grow, divide, cook, introduce, nights: cropDefinitions.blueberry.days }
}
