import { getFestivalStatus, type FarmState } from './farm.ts'
import { expeditionWallet } from './harbour-economy.ts'
import { quoteExpedition } from './ferry-expeditions.ts'
import { ruCount } from './ru.ts'

const bunOffer = 'mill-buy'

/** The final Lights supply row points only to a manifest that can advance this edition. */
export function getFestivalCargoRoute(farm: FarmState) {
  const preparation = farm.festivals.active
  if (farm.island !== 'village' || !farm.boatOwned || preparation?.tradition !== 'lights' || preparation.stage !== 2) return
  const view = getFestivalStatus(farm).active
  const row = view?.requirements.find(item => item.id === 'cargo')
  if (!row || !view || view.waitingNight || row.delivered >= row.quantity) return
  const delivery = row.alternatives.find(item => item.id === 'delivery')
  if (!delivery || delivery.available) return
  const world = farm.freight.expeditions
  const voyage = world.active
  const key = `lights:${preparation.edition}:${preparation.startedOn}:${farm.day}:${row.delivered}:${world.serial}`
  if (voyage) {
    if (voyage.kind !== 'trade' || !voyage.incoming.some(item => item.quantity > 0)) return
    return { key: `${key}:${voyage.phase}:${voyage.id}`, label: voyage.phase === 'ready' ? 'К готовому грузу' : 'К рейсу с грузом' }
  }
  const carried = row.alternatives.filter(item => item.id === 'wheat' || item.id === 'salt')
    .reduce((sum, item) => sum + item.available, 0)
  // Optional, never replaces a fully supplied hand-in or advertises a partial purchase as enough.
  if (row.quantity - row.delivered - carried !== 1) return
  const quote = quoteExpedition(world, bunOffer, expeditionWallet(farm))
  if (!quote?.available || quote.payCoins < 1 || quote.incoming[0]?.quantity !== 1) return
  return { key: `${key}:${bunOffer}:${quote.payCoins}`, label: `Посмотреть рейс · ${ruCount(quote.payCoins, 'монета', 'монеты', 'монет')}`,
    preview: { port: quote.port, offer: quote.id } }
}
