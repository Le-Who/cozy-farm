import type { FarmState } from './farm.ts'
import { expeditionPortNames } from './ferry-expeditions.ts'
import { ruCount } from './ru.ts'

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))

/** The sent manifest is the promise. Viewing it never requotes or receives a voyage. */
export function renderFerryReturn(farm: Pick<FarmState, 'boatOwned' | 'freight'>, products: readonly {id: string; name: string}[]): string {
  const voyage = farm.freight.expeditions.active
  if (!farm.boatOwned || !voyage) return ''
  const ready = voyage.phase === 'ready', exploring = voyage.kind === 'explore'
  const cargo = voyage.incoming.map(item => `${escape(products.find(product => product.id === item.id)?.name ?? 'Припасы')} ×${item.quantity}`)
  if (voyage.earnCoins) cargo.push(ruCount(voyage.earnCoins, 'монета', 'монеты', 'монет'))
  if (exploring) cargo.push(ready ? escape(expeditionPortNames[voyage.port]) : 'Новый торговый порт')
  return `<section class="rest-preview ferry-return" aria-label="Ваш рейс" data-ferry-phase="${voyage.phase}">
    <h2>Паром «Ласточка» · ${ready ? 'груз ждёт' : 'в море'}</h2>
    <p>${ready ? 'Паром вернулся. Можно забрать результат рейса.' : `Вернётся утром дня ${voyage.returnsOn}.`}${exploring ? '' : ` ${escape(expeditionPortNames[voyage.port])}.`}</p>
    <ul>${cargo.map(item => `<li>${item}</li>`).join('')}</ul>
    <p class="rest-preview-footnote">${ready ? 'Можно заняться другими делами: груз не пропадёт и не будет получен автоматически.' : 'Рейс ждёт игрового утра после сна, а не времени вне игры. Получение будет отдельным действием.'}</p>
    <button type="button" class="dialog-button secondary" data-action="ferry-return" data-value="${voyage.serial}">${ready ? 'К вернувшемуся парому' : 'Посмотреть свой рейс'}</button>
  </section>`
}
