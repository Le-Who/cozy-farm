import { cropDefinitions, seedPackQuote, type CropId, type FarmState } from './farm.ts'
import { ruCount } from './ru.ts'

type Stock = Pick<FarmState, 'coins' | 'seeds'>
const packs = (raw: string) => /^\d+$/.test(raw) ? Number(raw) : 0
const countPacks = (n: number) => ruCount(n,'пакет','пакета','пакетов')
const numbers = new Intl.NumberFormat('ru')
const money = (n: number) => ruCount(n,'монета','монеты','монет')
const seedCount = (n: number) => ruCount(n,'семя','семени','семян')

/** One read-only edit per seed shelf visit, separate from the active sowing crop. */
export class MarketSeedPacks {
  private choice?: { crop: CropId; text: string }
  get crop() { return this.choice?.crop }
  reset() { this.choice = undefined }

  choose(farm: Stock, value: unknown) {
    const quote = seedPackQuote(farm,value)
    if (!quote) return false
    if (this.crop === quote.crop) { this.reset(); return true }
    if (quote.maximum < 2) return false
    this.choice = {crop:quote.crop,text:'1'}
    return true
  }

  edit(value: string) { if (this.choice) this.choice.text = value }

  step(farm: Stock, direction: -1 | 1) {
    const view = this.view(farm)
    if (view && (direction === 1 ? view.more : view.less)) this.edit(String(view.packs ? view.packs + direction : 1))
  }

  view(farm: Stock) {
    if (!this.choice) return
    const {crop,text} = this.choice, n = packs(text), quote = seedPackQuote(farm,crop,n)
    if (!quote) return
    const token = quote.available ? [crop,n,quote.unitPrice,quote.owned,farm.coins].join('|') : ''
    const prompt = quote.available ? `Купить ${countPacks(n)} · ${numbers.format(quote.total)}`
      : quote.maximum<1 ? 'Нет доступных пакетов' : `${quote.maximum>1?'1–':''}${countPacks(quote.maximum)}`
    return {...quote,text,token,prompt,more:Number.isSafeInteger(n) && n < quote.maximum,less:Number.isSafeInteger(n) && n > 1,
      accessible:quote.available ? `Купить ${countPacks(n)}: ${cropDefinitions[crop].name}, ${money(quote.total)}` : prompt,
      summary:quote.available ? `${countPacks(n)}: ${seedCount(quote.seeds)}, ${money(quote.total)}.`
        : quote.maximum < 1 ? 'Покупка сейчас недоступна.' : `Укажите количество: от 1 до ${quote.maximum}.` }
  }

  confirm(farm: Stock, crop: unknown, token: string | undefined) {
    const view = this.view(farm)
    return view && view.crop === crop && view.available && view.token === token ? view : undefined
  }

  canBuyOne(farm: Stock, crop: CropId) { return seedPackQuote(farm,crop)?.available === true }

  renderHeading(farm: Stock, crop: CropId) {
    const title = cropDefinitions[crop].name, active = this.crop === crop
    return active || (seedPackQuote(farm,crop)?.maximum ?? 0) >= 2
      ? `<h2><button type="button" class="market-seed-select" data-action="market-seed-select" data-value="${crop}" aria-expanded="${active}"${active ? ` aria-controls="seed-packs-${crop}"` : ''}>${title}</button></h2>`
      : `<h2>${title}</h2>`
  }

  renderEditor(farm: Stock, crop: CropId, icon: (id: string) => string) {
    const v = this.view(farm)
    if (v?.crop !== crop) return ''
    const title = cropDefinitions[crop].name
    // Only numeric lexemes are restored to the native number field.
    const value = /^\d+$/.test(v.text) ? v.text : ''
    return `<div id="seed-packs-${crop}" class="market-seed-packs" role="group" aria-label="Пакеты: ${title}">
      <button type="button" class="market-seed-step" data-action="market-seed-step" data-value="less" aria-label="На пакет меньше"${v.less ? '' : ' disabled'}>−</button>
      <input type="number" data-market-seed-count aria-label="Количество пакетов: ${title}" min="1" max="${Math.max(1,v.maximum)}" step="1" inputmode="numeric" aria-invalid="${!v.available}" value="${value}">
      <button type="button" class="market-seed-step" data-action="market-seed-step" data-value="more" aria-label="На пакет больше"${v.more ? '' : ' disabled'}>+</button>
      <button type="button" class="dialog-button" data-action="market-buy-seed-packs" data-crop="${crop}" data-quote="${v.token}" aria-label="${v.accessible}"${v.available?'':' disabled'}><span data-market-seed-total>${v.prompt}</span><span data-market-seed-coin${v.available?'':' hidden'}>${icon('coin')}</span></button>
      <output class="sr-only" data-market-seed-summary aria-live="polite">${v.summary}</output>
    </div>`
  }

  paint(farm: Stock, editor: HTMLElement) {
    const v = this.view(farm)
    if (!v) return
    const input = editor.querySelector<HTMLInputElement>('[data-market-seed-count]')!
    const buy = editor.querySelector<HTMLButtonElement>('[data-action="market-buy-seed-packs"]')!
    input.max = String(Math.max(1,v.maximum))
    input.setAttribute('aria-invalid',String(!v.available))
    buy.disabled = !v.available
    buy.dataset.quote = v.token
    buy.setAttribute('aria-label',v.accessible)
    buy.querySelector('[data-market-seed-total]')!.textContent = v.prompt
    buy.querySelector<HTMLElement>('[data-market-seed-coin]')!.hidden = !v.available
    editor.querySelector('[data-market-seed-summary]')!.textContent = v.summary
    editor.querySelector<HTMLButtonElement>('[data-action="market-seed-step"][data-value="less"]')!.disabled = !v.less
    editor.querySelector<HTMLButtonElement>('[data-action="market-seed-step"][data-value="more"]')!.disabled = !v.more
  }
}
