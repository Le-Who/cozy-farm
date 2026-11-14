import { createFarm, getBedStage, getBedAction, workBed, refillWater, feedChickens, buyFeed, collectEggs, pickFruit, getMarketStock, sellMarketItem, buyBoat, selectSeed, type FarmState } from '../../src/farm.ts'

function act(result: { ok: boolean; message: string }): void { if (!result.ok) throw new Error(result.message) }
function water(farm: FarmState): void {
  for (let index = 0; index < farm.beds.length; index++) {
    if (getBedAction(farm, index).kind !== 'water') continue
    if (farm.water === 0) act(refillWater(farm))
    act(workBed(farm, index))
  }
}
/** Ordinary farm commands only: no stock, coin, boat or calendar grants. */
export function tendEarlyFerryFarm(farm: FarmState): void {
  for (let index = 0; index < farm.beds.length; index++) {
    if (getBedStage(farm.beds[index]) === 'ripe') act(workBed(farm, index))
  }
  if (!farm.chickensFed) {
    if (farm.feed === 0) act(buyFeed(farm))
    act(feedChickens(farm))
  }
  if (farm.eggsReady) act(collectEggs(farm))
  if (farm.trees.home[0]?.fruitReady) act(pickFruit(farm, 0))
  water(farm)
}
export function earlyFerryFarm(): FarmState {
  const farm = createFarm()
  tendEarlyFerryFarm(farm)
  for (const row of getMarketStock(farm)) {
    if (row.item.kind !== 'produce' || row.item.item === 'wheat' || row.item.item === 'carrot') continue
    for (let n = 0; n < row.count; n++) act(sellMarketItem(farm, row.key))
  }
  act(buyBoat(farm))
  act(selectSeed(farm, 'wheat'))
  for (const index of [4, 5]) act(workBed(farm, index))
  water(farm)
  return farm
}
