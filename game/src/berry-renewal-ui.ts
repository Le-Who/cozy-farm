import { berryCropIds, cropDefinitions, getBedHarvestPreview, getBedStage, getBerryRenewalPreview, variantLabel, type FarmState } from './farm.ts'
import { transplantBedDescription } from './bed-transplant.ts'
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
  const beds = farm.beds.flatMap((bed, index) => bed.kind === 'crop' && berryCropIds.some(id => id === bed.crop) ? [{ bed, index }] : [])
  return `<section class="bed-transplant berry-nursery"><h2 class="transplant-step" tabindex="-1">Свой ягодник</h2>
    <p>Одни посадки собирайте целиком, другие оставляйте на будущие урожаи. Бережный сбор даёт одну ягоду вместо обычных трёх и сохраняет посадку. Она снова растёт с начала, без новых семян.</p>
    <p><strong>Обычное нажатие на зрелую грядку по-прежнему собирает весь урожай и освобождает её.</strong> Бережный сбор выбирается здесь отдельно каждый раз.</p>
    <div class="dialog-actions">${button('К семенам', 'open-panel', 'seeds')}${button('Разделить ягодную посадку', 'open-panel', 'berry-nursery')}${button('К грядкам', 'close')}</div>
    ${beds.length ? `<div class="transplant-beds" role="group" aria-label="Ягодные грядки">${beds.map(({ bed, index }) => {
      const ripe = getBedStage(bed) === 'ripe'
      return `<button type="button" class="transplant-bed" data-action="berry-renewal-source" data-value="${index}"${ripe ? '' : ' disabled'}><strong>Грядка ${index + 1} · ${cropDefinitions[bed.crop].name}</strong><span>${escape(transplantBedDescription(bed))}</span><small>${ripe ? 'Выбрать бережный сбор' : 'Сначала дождитесь зрелости'}</small></button>`
    }).join('')}</div>` : '<p>Начните с клубники, черники или малины. Посейте семена на свободной грядке и вырастите их до зрелости.</p>'}
    <p>Хотите изменить огород? При следующем созревании соберите посадку обычным действием. Разделение в питомнике остаётся отдельным выбором вместо любого урожая.</p></section>`
}
