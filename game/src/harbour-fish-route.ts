import { canSailTo, getFishAction, getVillageProject, type FarmState } from './farm.ts'
import { quoteExpedition, type ExpeditionPort } from './ferry-expeditions.ts'
import { expeditionWallet } from './harbour-economy.ts'
import { getSupperFishRecovery } from './shared-supper.ts'
import { getLocalWarehouseSupply, warehouseRequestValue } from './warehouse-guidance.ts'

/** Only prepares navigation. No purchase, voyage, night or contribution is automatic. */
export function getHarbourFishRoute(farm: FarmState) {
  const world = farm.freight.expeditions
  const wallet = expeditionWallet(farm)
  const quote = quoteExpedition(world, 'salt-fish', wallet)!
  const active = world.active
  const port: ExpeditionPort = active?.port ?? (world.discovered.includes('salt') || world.markets.mill.visits ? 'salt' : 'mill')
  let offer = active?.id ?? (world.discovered.includes('salt') ? 'salt-fish' : world.markets.mill.visits ? 'explore-salt' : 'mill-sale')
  if (offer === 'mill-sale' && !active && farm.island === 'home' && !farm.village.built && farm.boatOwned) {
    const charter = getVillageProject(farm)
    const missing = charter.items.filter(({ item, delivered, available }) => delivered + available < item.quantity)
    // The first mill trip can also bring a charter bun. Preview it only if
    // the usual wheat sale cannot sail and the egg trade asks for no coins.
    if (charter.unlocked && missing.some(({ item }) => item.kind === 'fish') && missing.some(({ item }) => item.kind === 'handmade')
      && !quoteExpedition(world, 'mill-sale', wallet)?.available) {
      const bun = quoteExpedition(world, 'mill-eggs', wallet)
      if (bun?.available && bun.payCoins === 0) offer = bun.id
    }
  }
  const step = !farm.boatOwned ? 'Сначала нужна деревянная лодка.'
    : active ? 'Сначала получите текущий рейс. Оплаченный груз дождётся вас.'
    : !world.markets.mill.visits ? 'Сначала завершите любой торговый рейс в Мельничный посад.'
    : !world.discovered.includes('salt') ? 'Разведайте Соляной маяк: 2 пшеницы и одно игровое утро.'
    : 'Выберите покупку улова. Паром привезёт рыбу следующим игровым утром.'
  return { port, offer, price: quote.payCoins, step, label: !farm.boatOwned ? 'Посмотреть лодку'
    : active ? 'К текущему рейсу' : !world.markets.mill.visits ? 'Посмотреть рейсы посада'
    : !world.discovered.includes('salt') ? 'Подготовить разведку маяка' : 'Посмотреть покупку улова' }
}

export function harbourFishNeeded(farm: FarmState): boolean {
  const project = getVillageProject(farm)
  return !farm.village.built && project.items.some(({ item, delivered, available }) => item.kind === 'fish' && delivered + available < item.quantity)
}

/** An exhausted Grove shore may still hold the exact ordinary bass needed for construction. */
export function getVillageFishWarehouse(farm: FarmState) {
  if (farm.island !== 'home' || farm.village.built || !canSailTo(farm, 'grove')) return
  const project = getVillageProject(farm)
  const fish = project.items.find(({ item }) => item.kind === 'fish' && item.item === 'seaBass')
  if (!project.unlocked || !fish || fish.delivered + fish.available >= fish.item.quantity) return
  const item = { kind: 'fish', item: 'seaBass', quantity: fish.item.quantity - fish.delivered } as const
  const grove = { ...farm, island: 'grove' as const }
  if (getFishAction(grove).available || getLocalWarehouseSupply(farm, item)) return
  const stored = getLocalWarehouseSupply(grove, item)
  if (stored && stored.carried + stored.quantity >= item.quantity) return { item, value: warehouseRequestValue(item) }
}

/** The same limited port supply can continue feeding the first shared dinners. */
export function renderHarbourFishChoice(farm: FarmState, purpose: 'building' | 'supper' = 'building'): string {
  if (purpose === 'building' && !harbourFishNeeded(farm)) return ''
  const route = getHarbourFishRoute(farm)
  const recovery = purpose === 'supper' && farm.island === 'village' && farm.village.built ? getSupperFishRecovery(farm) : undefined
  const warehouse = purpose === 'building' ? getVillageFishWarehouse(farm) : undefined
  const catchLabel = warehouse ? 'На склад в рощу' : recovery?.kind === 'rest' ? 'К отдыху дома' : recovery?.kind === 'warehouse'
    ? recovery.port === farm.island ? 'К рыбе на складе' : {home:'На домашний склад',grove:'На склад в рощу',cape:'На склад мыса',village:'На склад гавани'}[recovery.port]
    : 'Поймать бесплатно'
  const fishing = recovery?.kind === 'rest' ? 'Рыбалка снова завтра. ' : warehouse || recovery?.kind === 'warehouse' ? '' : 'Поймайте рыбу сами или привезите паромом. '
  return `<section class="harbour-fish-choice" aria-label="Два пути за рыбой"><h2>${purpose === 'building' ? 'Улов для гавани' : 'Рыба к общему столу'}</h2>
    ${purpose === 'supper' ? '<p>Для ужина подойдёт обычный окунь или морской окунь.</p>' : ''}
    <p>${fishing}У Соляного маяка 2 обычных морских окуня стоят ${route.price} монет. Это покупка из местного запаса, не ваш улов.</p>
    <p>${route.step}</p><nav class="dialog-grid dialog-nav"><button class="dialog-button secondary" type="button" data-action="harbour-fish-catch"${warehouse ? ` data-value="${warehouse.value}"` : ''}>${catchLabel}</button><button class="dialog-button secondary" type="button" data-action="harbour-fish-trade">${route.label}</button></nav>
    <p>Просмотр ничего не тратит. Отправка рейса и получение рыбы выбираются отдельно.</p></section>`
}
