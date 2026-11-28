import { feedBagPrice, feedBagSize, type FarmState } from './farm.ts'
import { ruCount } from './ru.ts'

type FeedStocks = Pick<FarmState, 'day' | 'coins' | 'feed'>
const bagsText = (n: number) => ruCount(n, 'мешок', 'мешка', 'мешков')
const portionsText = (n: number) => ruCount(n, 'порция', 'порции', 'порций')
const coinsText = (n: number) => ruCount(n, 'монета', 'монеты', 'монет')
const money = new Intl.NumberFormat('ru')
const integer = /^[0-9]{1,16}$/

/** A temporary quantity on the current Care card; never a reservation or saved cart. */
export class MarketFeedBags {
  private draft?: string

  reset() { this.draft = undefined }
  edit(raw: string) { this.draft = raw }

  view(farm: FeedStocks) {
    const max = Number.isSafeInteger(farm.coins) && farm.coins >= 0 && Number.isSafeInteger(farm.feed) && farm.feed >= 0
      ? Math.min(Math.floor(farm.coins / feedBagPrice), Math.floor((Number.MAX_SAFE_INTEGER - farm.feed) / feedBagSize)) : 0
    const text = this.draft ?? '1'
    const bags = integer.test(text) ? Number(text) : 0
    const valid = Number.isSafeInteger(bags) && bags >= 1 && bags <= max
    const total = valid ? bags * feedBagPrice : 0
    const parts = valid ? bags * feedBagSize : 0
    return { max, text, bags, total, parts, valid, visible: max >= 2 || this.draft !== undefined,
      less: valid && bags > 1, more: valid && bags < max,
      token: valid ? [farm.day, farm.coins, farm.feed, bags, total].join('|') : '',
      label: valid ? `Купить ${bagsText(bags)} · ${money.format(total)}` : 'Купить корм',
      accessible: valid ? `Купить ${bagsText(bags)} корма за ${coinsText(total)}` : 'Купить корм',
      status: valid ? portionsText(parts) : max > 0 ? `1–${max}` : 'Недоступно' }
  }

  step(farm: FeedStocks, direction: -1 | 1) {
    const view = this.view(farm)
    if (direction < 0 ? view.less : view.more) this.edit(String(view.bags + direction))
  }

  confirm(farm: FeedStocks, token: string | undefined) {
    const quote = this.view(farm)
    return quote.visible && quote.valid && quote.token === token ? quote : undefined
  }

  render(farm: FeedStocks, icon: (id: string) => string) {
    const quote = this.view(farm)
    if (!quote.visible) return ''
    return `<div class="market-feed-editor" data-market-feed-editor role="group" aria-label="Мешки корма">
      <button type="button" class="market-feed-step" data-action="market-feed-step" data-value="less" aria-label="На мешок меньше"${quote.less ? '' : ' disabled'}>−</button>
      <input data-market-feed-count type="number" min="1" max="${quote.max}" step="1" inputmode="numeric" aria-label="Количество мешков корма" aria-invalid="${!quote.valid}" value="${integer.test(quote.text) ? quote.text : ''}">
      <button type="button" class="market-feed-step" data-action="market-feed-step" data-value="more" aria-label="На мешок больше"${quote.more ? '' : ' disabled'}>+</button>
      <button type="button" class="dialog-button" data-action="market-feed-buy-bags" data-quote="${quote.token}" aria-label="${quote.accessible}"${quote.valid ? '' : ' disabled'}><span data-market-feed-total>${quote.label}</span><span data-market-feed-coin${quote.valid ? '' : ' hidden'}>${icon('coin')}</span></button>
      <output class="market-feed-output" data-market-feed-output aria-live="polite">${quote.status}</output>
    </div>`
  }

  paint(farm: FeedStocks, editor: HTMLElement) {
    const quote = this.view(farm)
    const input = editor.querySelector<HTMLInputElement>('[data-market-feed-count]')!
    const buy = editor.querySelector<HTMLButtonElement>('[data-action="market-feed-buy-bags"]')!
    input.max = String(quote.max)
    input.setAttribute('aria-invalid', String(!quote.valid))
    buy.disabled = !quote.valid
    buy.dataset.quote = quote.token
    buy.setAttribute('aria-label', quote.accessible)
    buy.querySelector('[data-market-feed-total]')!.textContent = quote.label
    buy.querySelector<HTMLElement>('[data-market-feed-coin]')!.hidden = !quote.valid
    editor.querySelector('[data-market-feed-output]')!.textContent = quote.status
    editor.querySelector<HTMLButtonElement>('[data-action="market-feed-step"][data-value="less"]')!.disabled = !quote.less
    editor.querySelector<HTMLButtonElement>('[data-action="market-feed-step"][data-value="more"]')!.disabled = !quote.more
  }
}
