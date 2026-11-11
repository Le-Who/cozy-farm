import { cropDefinitions, getBedStage, getBedTransplantAction, transplantCrop, type Bed, type CropBed, type FarmState } from './farm.ts'
import { traitLabel } from './ru.ts'

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

export function transplantBedDescription(bed: Bed) {
  if (bed.kind !== 'crop') return bed.kind === 'tilled' ? 'Свободна · Вспахана' : 'Целина · Сначала вскопайте'
  return [cropDefinitions[bed.crop].name, `Рост: ${bed.growth}/${cropDefinitions[bed.crop].days}`, getBedStage(bed) === 'ripe' ? 'Урожай созрел' : bed.watered ? 'Сегодня полито' : 'Не полито', bed.trait ? traitLabel(bed.trait, bed.crop) : 'Без особенности'].join(' · ')
}

export function renderBedTransplant(farm: FarmState, selection: BedTransplantSelection) {
  if (farm.island !== 'home') return '<p class="dialog-intro">Пересадка доступна на Родном острове.</p>'
  const reset = '<button class="dialog-button secondary" type="button" data-action="transplant-reset">Отменить выбор</button>'
  const close = '<button class="dialog-button secondary" type="button" data-action="close">Выйти из пересадки</button>'
  if (selection.receipt) return `<section class="bed-transplant"><p class="dialog-intro" role="status">${selection.receipt}</p><div class="dialog-actions"><button class="dialog-button" type="button" data-action="transplant-reset">Пересадить ещё</button>${close}</div></section>`
  const source = selection.selected?.source
  const hasDestination = farm.beds.some(bed => bed.kind === 'tilled')
  return `<section class="bed-transplant"><h2 tabindex="-1" class="transplant-step">${source === undefined ? '1. Выберите культуру' : '2. Выберите подготовленную грядку'}</h2>
    <p class="dialog-intro">${source === undefined ? 'Перенесите посадку на свободную вспаханную грядку.' : `Выбрана грядка ${source + 1}. ${transplantBedDescription(selection.selected!.crop)}.`} Возраст, полив и особенность сохранятся. Семена и вода не расходуются.</p>
    ${!hasDestination ? '<p class="dialog-status">Нет свободных вспаханных грядок. Сначала подготовьте место в огороде.</p>' : ''}
    ${!farm.beds.some(bed => bed.kind === 'crop') ? '<p class="dialog-status">Пока нет культур для пересадки.</p>' : ''}
    <div class="dialog-actions">${source === undefined ? '' : reset}${close}</div>
    <div class="transplant-beds" role="group" aria-label="Грядки по порядку рядов">${farm.beds.map((bed, index) => {
      const available = source === undefined ? hasDestination && bed.kind === 'crop' : getBedTransplantAction(farm, source, index).available
      const selected = source === index
      return `<button class="transplant-bed" type="button" data-action="${source === undefined ? 'transplant-source' : 'transplant-destination'}" data-value="${index}" ${available ? '' : 'disabled'} ${selected ? 'aria-pressed="true"' : ''}><strong>Грядка ${index + 1}${selected ? ' · Выбрана' : ''}</strong><span>${transplantBedDescription(bed)}</span><small>${source === undefined ? bed.kind === 'crop' ? 'Выбрать культуру' : 'Нет культуры' : selected ? 'Исходная грядка' : available ? 'Пересадить сюда' : 'Недоступна'}</small></button>`
    }).join('')}</div></section>`
}
