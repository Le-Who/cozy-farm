import { getBedTransplantAction, transplantCrop, type CropBed, type FarmState } from './farm.ts'
import { gardenCell, gardenSourceSummary } from './garden-spatial.ts'
export { gardenBedDescription as transplantBedDescription } from './garden-spatial.ts'

/** Only a UI selection. It is never saved and owns no farm resources. */
export class BedTransplantSelection {
  selected: { source: number; crop: CropBed } | undefined
  receipt = ''
  reset() { this.selected = undefined; this.receipt = '' }
  choose(farm: FarmState, source: number) {
    const bed = farm.beds[source]
    if (farm.island !== 'home' || !Number.isInteger(source) || bed?.kind !== 'crop') return false
    this.selected = { source, crop: { ...bed } }; this.receipt = ''
    return true
  }
  move(farm: FarmState, destination: number) {
    const selected = this.selected
    if (!selected) return { ok: false, message: 'Сначала выберите культуру.' }
    const result = transplantCrop(farm, selected.source, destination, selected.crop)
    if (result.ok) { this.selected = undefined; this.receipt = result.message }
    return result
  }
}

export function renderBedTransplant(farm: FarmState, selection: BedTransplantSelection) {
  if (farm.island !== 'home') return '<p class="dialog-intro">Пересадка доступна на Родном острове.</p>'
  const reset = '<button class="dialog-button secondary" type="button" data-action="transplant-reset">Отменить выбор</button>'
  const close = '<button class="dialog-button secondary" type="button" data-action="close">Выйти из пересадки</button>'
  if (selection.receipt) return `<section class="bed-transplant"><p class="dialog-intro" role="status">${selection.receipt}</p><div class="dialog-actions"><button class="dialog-button" type="button" data-action="transplant-reset">Пересадить ещё</button>${close}</div></section>`
  const source = selection.selected?.source
  const hasDestination = farm.beds.some(bed => bed.kind === 'tilled')
  return `<section class="bed-transplant garden-workspace"><div class="garden-summary"><h2 tabindex="-1" class="transplant-step">${source === undefined ? '1. Выберите культуру' : '2. Выберите подготовленную грядку'}</h2>
    ${source === undefined ? '<p>Перенесите посадку на свободную вспаханную грядку.</p>' : gardenSourceSummary(source, selection.selected!.crop)}
    <p class="garden-rule">Возраст, полив и особенность сохранятся. Семена и вода не расходуются.</p>
    ${!hasDestination ? '<p class="dialog-status">Нет свободных вспаханных грядок. Сначала подготовьте место в огороде.</p>' : ''}
    ${!farm.beds.some(bed => bed.kind === 'crop') ? '<p class="dialog-status">Пока нет культур для пересадки.</p>' : ''}</div>
    <div class="transplant-beds garden-map" role="group" aria-label="Грядки по порядку рядов: четыре ряда по четыре">${farm.beds.map((bed, index) => {
      const available = source === undefined ? hasDestination && bed.kind === 'crop' : getBedTransplantAction(farm, source, index).available
      const selected = source === index
      const purpose = selected ? 'Выбрана исходной. Выберите другую грядку.' : source === undefined
        ? bed.kind !== 'crop' ? 'Нет культуры для пересадки.' : hasDestination ? 'Выбрать культуру.' : 'Сначала подготовьте свободную грядку.'
        : available ? 'Пересадить сюда.' : getBedTransplantAction(farm, source, index).label
      return gardenCell(bed, index, { action: source === undefined ? 'transplant-source' : 'transplant-destination', available, selected, purpose })
    }).join('')}</div>
    <div class="dialog-actions garden-actions">${source === undefined ? close : reset}</div></section>`
}
