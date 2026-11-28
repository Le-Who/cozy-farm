import { getCapeHoney, getCapeWax, getMarketOrders, ingredientCount, type FarmState } from './farm.ts'
import { getLocalWarehouseSupply, warehouseRequestValue } from './warehouse-guidance.ts'

/** Reuse the harvest calculation; looking ahead never advances the farm or collects anything. */
export function getApiaryPreview(farm: FarmState) {
  const now = getCapeHoney(farm)
  const tomorrowFarm = { ...farm, day: farm.day + 1 }
  const tomorrow = getCapeHoney(tomorrowFarm)
  return {
    planted: farm.capeFlowers.filter(day => day !== null).length,
    harvested: farm.capeHoneyOn === farm.day,
    now: { ...now, wax: getCapeWax(farm), day: farm.day },
    tomorrow: { ...tomorrow, wax: getCapeWax(tomorrowFarm), day: tomorrowFarm.day },
  }
}

function firstParcelWax(farm: FarmState, now: ReturnType<typeof getApiaryPreview>['now']) {
  if (farm.island !== 'cape' || farm.capeLevel < 2 || farm.orders.apiary.completed !== 0 || !farm.freight.warehouses.cape.beeswax) return
  const order = getMarketOrders(farm).find(({ lane }) => lane === 'apiary')
  const wax = order?.items.find(({ kind }) => kind === 'beeswax')
  if (order?.status !== 'waiting' || !wax) return
  const stocked = getLocalWarehouseSupply(farm, wax)
  const today = now.available ? now : undefined
  if (!stocked || !order.items.every(item => ingredientCount(farm, item) +
    (item.kind === 'beeswax' ? stocked.quantity + (today?.wax ?? 0) : item.kind === 'honey' ? (today?.honey ?? 0) : 0) >= item.quantity)) return
  return { quantity: stocked.quantity, value: warehouseRequestValue(wax) }
}

export function getApiaryCopy(farm: FarmState) {
  const preview = getApiaryPreview(farm)
  const waiting = preview.harvested || preview.now.blooms === 0
  return {
    ...preview,
    waiting,
    firstParcelWax: firstParcelWax(farm, preview.now),
    harvest: preview.planted ? waiting ? preview.tomorrow : preview.now : null,
    heading: preview.planted ? `${waiting ? 'Завтра' : 'Сегодня'} · день ${waiting ? preview.tomorrow.day : farm.day}` : '',
    summary: !preview.planted ? 'Сначала посадите цветы на клумбах мыса. Пустые клумбы не дадут мёда после отдыха.'
      : preview.harvested ? 'Сегодня мёд уже собран. Новый сбор после отдыха дома.'
      : !preview.now.blooms && farm.capeBouquet ? 'Цветы срезаны. После ночи дома клумба снова зацветёт.'
      : !preview.now.blooms ? 'Цветы посажены. Они распустятся после отдыха дома.'
      : `Цветущие клумбы: ${preview.now.blooms}/${farm.capeFlowers.length}. Мёд можно собрать один раз за день.`,
    note: preview.planted && waiting ? 'Прогноз по нынешним клумбам и уровню пасеки. Сбор на мысе вручную.' : '',
  }
}
