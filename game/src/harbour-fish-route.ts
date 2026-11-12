import { getVillageProject, type FarmState } from './farm.ts'
import { quoteExpedition, type ExpeditionPort } from './ferry-expeditions.ts'
import { expeditionWallet } from './harbour-economy.ts'

/** Only prepares navigation. No purchase, voyage, night or contribution is automatic. */
export function getHarbourFishRoute(farm: FarmState) {
  const world = farm.freight.expeditions
  const quote = quoteExpedition(world, 'salt-fish', expeditionWallet(farm))!
  const active = world.active
  const port: ExpeditionPort = active?.port ?? (world.discovered.includes('salt') || world.markets.mill.visits ? 'salt' : 'mill')
  const offer = active?.id ?? (world.discovered.includes('salt') ? 'salt-fish' : world.markets.mill.visits ? 'explore-salt' : 'mill-sale')
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

/** The same limited port supply can continue feeding the first shared dinners. */
export function renderHarbourFishChoice(farm: FarmState, purpose: 'building' | 'supper' = 'building'): string {
  if (purpose === 'building' && !harbourFishNeeded(farm)) return ''
  const route = getHarbourFishRoute(farm)
  return `<section class="harbour-fish-choice" aria-label="Два пути за рыбой"><h2>${purpose === 'building' ? 'Улов для гавани' : 'Рыба к общему столу'}</h2>
    ${purpose === 'supper' ? '<p>Для ужина подойдёт обычный окунь или морской окунь.</p>' : ''}
    <p>Поймайте рыбу сами или привезите паромом. У Соляного маяка 2 обычных морских окуня стоят ${route.price} монет. Это покупка из местного запаса, не ваш улов.</p>
    <p>${route.step}</p><nav class="dialog-grid dialog-nav"><button class="dialog-button secondary" type="button" data-action="harbour-fish-catch">Поймать бесплатно</button><button class="dialog-button secondary" type="button" data-action="harbour-fish-trade">${route.label}</button></nav>
    <p>Просмотр ничего не тратит. Отправка рейса и получение рыбы выбираются отдельно.</p></section>`
}
