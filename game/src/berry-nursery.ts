import { berryCropIds, cropDefinitions, getBedStage, getBerryPropagation, propagateBerry, variantLabel, type CropBed, type FarmState, type StockItem } from './farm.ts'
import { gardenCell, gardenCropArt, gardenSourceSummary } from './garden-spatial.ts'
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
  if (farm.island !== 'home') return '<p>Размножить ягодный куст можно на Родном острове.</p>'
  if (selection.receipt) return `<section class="bed-transplant"><p role="status">${selection.receipt}</p><p>Молодым посадкам нужен обычный уход. Подойдите к каждой и полейте, если сегодня нет дождя.</p><div class="dialog-actions">${close()}${button('Выбрать ещё куст', 'berry-nursery-reset')}</div></section>`
  if (selected?.destination !== undefined) {
    const preview = getBerryPropagation(farm, selected.source, selected.destination), bed = selected.crop
    const name = bed.trait ? variantLabel(bed.crop, bed.trait).name : cropDefinitions[bed.crop].name
    const forecast = bed.trait ? `Обычный урожай каждой посадки: одна ${variantLabel(bed.crop, bed.trait).name.toLowerCase()} и ${cropDefinitions[bed.crop].yield - 1} обычные ягоды.`
      : 'Обычные посадки смогут получить особенность от погоды, как при посеве.'
    return `<section class="bed-transplant berry-nursery garden-nursery-confirm"><div class="garden-summary"><h2 class="transplant-step" tabindex="-1">3. Разделить вместо сбора?</h2>
      <strong class="nursery-name">${name}</strong><p class="nursery-warning"><strong>Готовый урожай сейчас не получите.</strong></p>
      <p>Возраст обеих посадок начнётся с нуля. Семена и монеты не нужны.</p>
      <p>До нового урожая: ${ruCount(cropDefinitions[bed.crop].days, 'ночь', 'ночи', 'ночей')} обычного роста. ${cropDefinitions[bed.crop].retainsWater ? 'Чернике достаточно одного полива.' : 'Поливайте перед каждой ночью роста.'}</p>
      <details class="garden-care"><summary>Уход и особенность</summary><p>${forecast}</p></details></div>
      <div class="nursery-outcome" role="group" aria-label="Грядка ${selected.source + 1} → две молодые посадки на грядках ${selected.source + 1} и ${selected.destination + 1}"><div class="nursery-mother">${gardenCropArt(bed)}<span>Грядка ${selected.source + 1}</span></div><span class="nursery-arrow" aria-hidden="true">↙　↘</span><div class="nursery-young">${[selected.source, selected.destination].map(index => `<div>${gardenCropArt({...bed, growth:0})}<span>Грядка ${index + 1}</span></div>`).join('')}</div></div>
      <div class="dialog-actions garden-actions">${button('Разделить на две посадки', 'berry-nursery-confirm', '', preview.available)}${reset()}</div></section>`
  }
  const destinations = farm.beds.filter(bed => bed.kind === 'tilled').length
  const mothers = farm.beds.filter(bed => bed.kind === 'crop' && berryCropIds.some(id => id === bed.crop) && getBedStage(bed) === 'ripe').length
  const hasDestination = destinations > 0, hasMother = mothers > 0
  return `<section class="bed-transplant berry-nursery garden-workspace"><div class="garden-summary"><h2 class="transplant-step" tabindex="-1">${selected ? `2. Выберите вторую грядку · свободно ${destinations}` : `1. Выберите зрелый куст · доступно ${hasDestination ? mothers : 0}`}</h2>
    ${selected ? gardenSourceSummary(selected.source, selected.crop) : ''}
    <p class="garden-rule"><strong>Без сбора ягод: один куст → две молодые посадки.</strong> Обе начнут расти с нуля: на прежней и выбранной свободной грядках. Известная особенность сохранится у обеих.</p>
    ${!hasMother ? '<p>Сначала вырастите хотя бы одну ягодную посадку до зрелости.</p>' : ''}${!hasDestination ? '<p>Нужна ещё одна свободная вспаханная грядка. Подготовьте место в огороде.</p>' : ''}</div>
    <div class="transplant-beds garden-map" role="group" aria-label="Размножение ягодного куста: четыре ряда по четыре">${farm.beds.map((bed, index) => {
      const mother = bed.kind === 'crop' && berryCropIds.some(id => id === bed.crop) && getBedStage(bed) === 'ripe'
      const available = selected ? getBerryPropagation(farm, selected.source, index).available : hasDestination && mother
      const chosen = selected?.source === index
      const purpose = chosen ? 'Выбрана исходной. Выберите другую грядку.' : selected
        ? available ? 'Выбрать вторую грядку.' : getBerryPropagation(farm, selected.source, index).label
        : !mother ? 'Нужна зрелая ягода.' : hasDestination ? 'Выбрать для размножения.' : 'Сначала подготовьте свободную грядку.'
      return gardenCell(bed, index, { action: selected ? 'berry-nursery-destination' : 'berry-nursery-source', available, selected: chosen, purpose })
    }).join('')}</div>
    <div class="dialog-actions garden-actions">${selected ? reset() : button('К семенам', 'open-panel', 'seeds') + button('Собрать ягоды и сохранить посадку', 'open-panel', 'berry-renewal') + close()}</div></section>`
}
