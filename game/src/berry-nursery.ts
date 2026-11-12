import { berryCropIds, cropDefinitions, getBedStage, getBerryPropagation, propagateBerry, variantLabel, type CropBed, type FarmState, type StockItem } from './farm.ts'
import { transplantBedDescription } from './bed-transplant.ts'
import { ruCount } from './ru.ts'

/** Offer preservation beside the missing exact ingredient, without replacing immediate harvest. */
export function getBerryNurserySource(farm: FarmState, item: StockItem) {
  if (item.kind !== 'variants' || !berryCropIds.some(id => id === item.item)) return undefined
  const source = farm.beds.findIndex(bed => bed.kind === 'crop' && bed.crop === item.item
    && bed.trait === item.trait && getBedStage(bed) === 'ripe')
  return source >= 0 ? source : undefined
}

/** A reversible UI choice. No resources are owned or reserved before confirmation. */
export class BerryNurserySelection {
  selected?: { source: number; crop: CropBed; destination?: number }
  receipt = ''
  reset() { this.selected = undefined; this.receipt = '' }
  choose(farm: FarmState, source: number) {
    const bed = farm.beds[source]
    if (farm.island !== 'home' || !Number.isInteger(source) || bed?.kind !== 'crop'
      || !berryCropIds.some(id => id === bed.crop) || getBedStage(bed) !== 'ripe') return false
    this.selected = { source, crop: { ...bed } }; this.receipt = ''; return true
  }
  destination(farm: FarmState, destination: number) {
    if (!this.selected || !getBerryPropagation(farm, this.selected.source, destination).available) return false
    this.selected.destination = destination; return true
  }
  divide(farm: FarmState) {
    const selected = this.selected
    if (selected?.destination === undefined) return { ok: false, message: 'Сначала выберите зрелую посадку и вторую грядку.' }
    const result = propagateBerry(farm, selected.source, selected.destination, selected.crop)
    if (result.ok) { this.selected = undefined; this.receipt = result.message }
    return result
  }
}
const button = (label: string, action: string, value = '', enabled = true) => `<button class="dialog-button" type="button" data-action="${action}" data-value="${value}"${enabled ? '' : ' disabled'}>${label}</button>`
const reset = () => button('Отменить выбор', 'berry-nursery-reset')
const close = () => button('К грядкам', 'close')
export function renderBerryNursery(farm: FarmState, selection: BerryNurserySelection, icon: (key: string) => string) {
  const selected = selection.selected
  if (farm.island !== 'home') return '<p>Ягодный питомник находится на Родном острове.</p>'
  if (selection.receipt) return `<section class="bed-transplant"><p role="status">${selection.receipt}</p><p>Молодым посадкам нужен обычный уход. Подойдите к каждой и полейте, если сегодня нет дождя.</p><div class="dialog-actions">${close()}${button('Выбрать ещё куст', 'berry-nursery-reset')}</div></section>`
  if (selected?.destination !== undefined) {
    const preview = getBerryPropagation(farm, selected.source, selected.destination), bed = selected.crop
    const name = bed.trait ? variantLabel(bed.crop, bed.trait).name : cropDefinitions[bed.crop].name
    const forecast = bed.trait ? `Обычный урожай каждой посадки: одна ${variantLabel(bed.crop, bed.trait).name.toLowerCase()} и ${cropDefinitions[bed.crop].yield - 1} обычные ягоды.`
      : 'Обычные посадки смогут получить особенность от погоды, как при посеве.'
    return `<section class="bed-transplant berry-nursery"><h2 class="transplant-step" tabindex="-1">3. Разделить вместо сбора?</h2>
      <div class="nursery-plant">${icon(bed.crop)}<strong>${name}</strong></div>
      <p>Грядка ${selected.source + 1} → две молодые посадки на грядках ${selected.source + 1} и ${selected.destination + 1}.</p>
      <p><strong>Готовый урожай сейчас не получите.</strong> Возраст обеих посадок начнётся с нуля. Семена и монеты не нужны.</p>
      <p>До нового урожая: ${ruCount(cropDefinitions[bed.crop].days, 'ночь', 'ночи', 'ночей')} обычного роста. ${cropDefinitions[bed.crop].retainsWater ? 'Чернике достаточно одного полива.' : 'Поливайте перед каждой ночью роста.'}</p>
      <p>${forecast}</p>
      <div class="dialog-actions">${button('Разделить на две посадки', 'berry-nursery-confirm', '', preview.available)}${reset()}</div></section>`
  }
  const hasDestination = farm.beds.some(bed => bed.kind === 'tilled')
  const hasMother = farm.beds.some(bed => bed.kind === 'crop' && berryCropIds.some(id => id === bed.crop) && getBedStage(bed) === 'ripe')
  return `<section class="bed-transplant berry-nursery"><h2 class="transplant-step" tabindex="-1">${selected ? '2. Выберите вторую грядку' : '1. Выберите зрелую ягодную посадку'}</h2>
    <p>${selected ? `Грядка ${selected.source + 1}: ${transplantBedDescription(selected.crop)}.` : 'Размножайте клубнику, чернику и малину. Вместо готового урожая получите две молодые посадки. Известная особенность сохранится у обеих. Одни посадки собирайте, другие оставляйте для размножения.'}</p>
    ${!hasMother ? '<p>Сначала вырастите хотя бы одну ягодную посадку до зрелости.</p>' : ''}${!hasDestination ? '<p>Нужна ещё одна свободная вспаханная грядка. Подготовьте место в огороде.</p>' : ''}
    <div class="dialog-actions">${selected ? reset() : button('К семенам', 'open-panel', 'seeds') + button('Собрать ягоды и сохранить посадку', 'open-panel', 'berry-renewal')}${close()}</div>
    <div class="transplant-beds" role="group" aria-label="Грядки ягодного питомника">${farm.beds.map((bed, index) => {
      const mother = bed.kind === 'crop' && berryCropIds.some(id => id === bed.crop) && getBedStage(bed) === 'ripe'
      const enabled = selected ? getBerryPropagation(farm, selected.source, index).available : hasDestination && mother
      return `<button class="transplant-bed" type="button" data-action="${selected ? 'berry-nursery-destination' : 'berry-nursery-source'}" data-value="${index}"${enabled ? '' : ' disabled'}${selected?.source === index ? ' aria-pressed="true"' : ''}><strong>Грядка ${index + 1}</strong><span>${transplantBedDescription(bed)}</span><small>${selected ? selected.source === index ? 'Исходная посадка' : enabled ? 'Выбрать вторую грядку' : 'Недоступна' : mother ? 'Выбрать для размножения' : 'Нужна зрелая ягода'}</small></button>`
    }).join('')}</div></section>`
}
