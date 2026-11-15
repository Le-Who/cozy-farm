import { berryCropIds, canRenewBerryBed, cropDefinitions, getBedHarvestPreview, getBerryRenewalPreview, variantLabel, type FarmState } from './farm.ts'
import { gardenCell } from './garden-spatial.ts'
import { ruCount } from './ru.ts'

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!))
const button = (label: string, action: string, value = '', enabled = true) => `<button type="button" class="dialog-button secondary" data-action="${action}" data-value="${escape(value)}"${enabled ? '' : ' disabled'}>${label}</button>`

/** A detached confirmation, never a saved mode or a reservation. */
export class BerryRenewalSelection {
  selected: { index: number; token: string } | undefined
  reset() { this.selected = undefined }
  choose(farm: FarmState, index: number) {
    const quote = getBerryRenewalPreview(farm, index)
    if (!quote) return false
    this.selected = { index, token: quote.token }; return true
  }
}

function yieldLabel(quote: NonNullable<ReturnType<typeof getBedHarvestPreview>>) {
  return [quote.ordinary ? `${cropDefinitions[quote.crop].name} ×${quote.ordinary} (обычные)` : '',
    quote.special && quote.trait ? `${variantLabel(quote.crop, quote.trait).name} ×${quote.special}` : ''].filter(Boolean).map(escape).join(' + ')
}

export function renderBerryRenewal(farm: FarmState, selection: BerryRenewalSelection, icon: (key: string) => string) {
  if (farm.island !== 'home') return '<p>Свой ягодник доступен на Родном острове.</p>'
  const selected = selection.selected
  const quote = selected && getBerryRenewalPreview(farm, selected.index)
  if (selected && (!quote || quote.token !== selected.token)) return `<section class="bed-transplant berry-nursery"><p role="alert">Посадка или урожай изменились. Выберите зрелую грядку заново.</p>${button('К ягоднику', 'berry-renewal-reset')}</section>`
  if (quote) {
    const ordinary = getBedHarvestPreview(farm, quote.index)!
    return `<section class="bed-transplant berry-nursery"><h2 class="transplant-step" tabindex="-1">Грядка ${quote.index + 1} · Сохранить посадку?</h2>
      <div class="nursery-plant">${icon(quote.crop)}<strong>${cropDefinitions[quote.crop].name}</strong></div>
      <p><strong>Бережный сбор: ${yieldLabel(quote)}.</strong> Та же посадка останется на этой грядке и начнёт новый цикл роста.</p>
      <p>Обычный сбор на поле: ${yieldLabel(ordinary)}. После него грядка освобождается.</p>
      <p>До следующего созревания: ${ruCount(quote.nights, 'ночь', 'ночи', 'ночей')} обычного роста. ${quote.retainsWater ? 'Чернике нужен один полив на новый цикл.' : 'Поливайте перед каждой ночью роста.'} В дождь новый цикл уже полит.</p>
      <p>${quote.trait ? 'Особенность сохраняется: её получит одна ягода каждого урожая этой посадки.' : 'Посадка остаётся обычной, пока погода не подарит ей особенность.'} Семена не нужны, место остаётся занятым. Активный план огорода не меняется.</p>
      ${quote.picnicBonus ? '<p class="dialog-status">В показанный урожай уже включена одна дополнительная обычная ягода от пикника. Этот бонус расходуется один раз, как при обычном сборе.</p>' : ''}
      <div class="dialog-actions">${button(`Бережно собрать ×${quote.total}`, 'berry-renewal-confirm', quote.token)}${button('К посадке без сбора', 'berry-renewal-bed', String(quote.index))}${button('Отменить выбор', 'berry-renewal-reset')}</div></section>`
  }
  const hasBerries = farm.beds.some(bed => bed.kind === 'crop' && berryCropIds.some(id => id === bed.crop))
  return `<section class="bed-transplant berry-nursery berry-renewal garden-workspace"><div class="garden-summary"><h2 class="transplant-step" tabindex="-1">Выберите зрелую ягодную посадку</h2>
    <p>Бережный сбор даёт одну ягоду вместо обычных трёх и сохраняет посадку. Она снова растёт с начала, без новых семян.</p>
    <p class="garden-rule"><strong>Обычное нажатие на зрелую грядку по-прежнему собирает весь урожай и освобождает её.</strong> Бережный сбор выбирается здесь отдельно каждый раз.</p>
    ${hasBerries ? '' : '<p>Начните с клубники, черники или малины. Посейте семена на свободной грядке и вырастите их до зрелости.</p>'}</div>
    <div class="transplant-beds garden-map" role="group" aria-label="Свой ягодник: четыре ряда по четыре, как на поле">${farm.beds.map((bed, index) => {
      const berry = bed.kind === 'crop' && berryCropIds.some(id => id === bed.crop)
      const available = canRenewBerryBed(farm, index)
      const purpose = available ? 'Выбрать бережный сбор.' : berry ? 'Сначала дождитесь зрелости.'
        : bed.kind === 'crop' ? 'Бережный сбор доступен только ягодам.'
        : bed.kind === 'tilled' ? 'Посейте и вырастите ягодную посадку.' : 'Сначала вскопайте и вырастите ягодную посадку.'
      return gardenCell(bed, index, { action: 'berry-renewal-source', available, selected: false, purpose })
    }).join('')}</div>
    <div class="dialog-actions garden-actions">${button('К семенам', 'berry-renewal-seeds')}${button('Разделить ягодную посадку', 'open-panel', 'berry-nursery')}${button('К грядкам', 'close')}</div></section>`
}

/** Return to the physical source after cancelling, not to the disappearing cancel
 * control or Close. A changed source may be unavailable by the time we redraw. */
export function restoreBerryRenewalFocus(root: HTMLElement, index: number | undefined) {
  const source = index === undefined ? null : root.querySelector<HTMLButtonElement>(`[data-action="berry-renewal-source"][data-value="${index}"]:not(:disabled)`)
  const target = source ?? root.querySelector<HTMLElement>('.transplant-step')
  if (!target) return
  target.classList.add('berry-renewal-focus')
  target.addEventListener('blur', () => target.classList.remove('berry-renewal-focus'), { once: true })
  target.focus({ preventScroll: true })
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}


/** Preview a useful packet without choosing a sowing crop or changing a plan. */
export function berrySeedPreview(farm: FarmState) {
  return berryCropIds.find(crop => farm.seeds[crop] > 0) ?? 'strawberry'
}

/** A non-action focus target keeps a held entry key away from Buy or Sow. */
export function revealBerrySeedPreview(root: HTMLElement) {
  const detail = root.querySelector<HTMLElement>('.seed-detail')
  const heading = detail?.querySelector<HTMLElement>('h2')
  if (!detail || !heading) return
  heading.tabIndex = -1
  heading.classList.add('berry-renewal-focus')
  heading.addEventListener('blur', () => heading.classList.remove('berry-renewal-focus'), { once: true })
  detail.scrollIntoView({ block: 'center', inline: 'nearest' })
  heading.focus({ preventScroll: true })
}
