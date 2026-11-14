import { berryCropIds, cropDefinitions, getBedStage, type Bed, type CropBed } from './farm.ts'
import { traitLabel } from './ru.ts'

export function gardenBedDescription(bed: Bed) {
  if (bed.kind !== 'crop') return bed.kind === 'tilled' ? 'Свободна · Вспахана' : 'Целина · Сначала вскопайте'
  return [cropDefinitions[bed.crop].name, `Рост: ${bed.growth}/${cropDefinitions[bed.crop].days}`, getBedStage(bed) === 'ripe' ? 'Урожай созрел' : bed.watered ? 'Сегодня полито' : 'Не полито', bed.trait ? traitLabel(bed.trait, bed.crop) : 'Без особенности'].join(' · ')
}
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** Existing four-frame crop sheets, never a ripe icon for a young planting. */
export function gardenCropArt(bed: CropBed) {
  const frame = Math.min(3, Math.floor(bed.growth * 3 / cropDefinitions[bed.crop].days))
  const ratio = berryCropIds.some(id => id === bed.crop) ? '1' : '160 / 136'
  return `<span class="garden-crop" aria-hidden="true" data-frame="${frame}" style="aspect-ratio:${ratio};background-image:url('art/lavender/crop-${bed.crop}.webp');background-position:${frame * 100 / 3}% 50%"></span>`
}

export function gardenSourceSummary(source: number, bed: CropBed) {
  return `<div class="garden-selected">${gardenCropArt(bed)}<div><strong>Грядка ${source + 1} · ${cropDefinitions[bed.crop].name}</strong><p>${gardenBedDescription(bed).split(' · ').slice(1).join(' · ')}</p></div></div>`
}

export function gardenCell(bed: Bed, index: number, options: { action: string; available: boolean; selected: boolean; purpose: string }) {
  const { action, available, selected, purpose } = options
  const label = `Грядка ${index + 1}, ряд ${Math.floor(index / 4) + 1}, место ${index % 4 + 1}. ${gardenBedDescription(bed)}. ${purpose}`
  const state = selected ? 'Выбрана' : bed.kind === 'empty' ? 'Целина' : bed.kind === 'tilled' ? 'Свободна' : getBedStage(bed) === 'ripe' ? 'Созрело' : bed.watered ? 'Полито' : 'Сухо'
  return `<button class="transplant-bed garden-cell" type="button" data-action="${action}" data-value="${index}" data-kind="${bed.kind}"${available ? '' : ' disabled'} aria-pressed="${selected}" aria-label="${escape(label)}" title="${escape(label)}"><span class="garden-bed-number" aria-hidden="true">${index + 1}</span>${bed.kind === 'crop' ? gardenCropArt(bed) : '<span class="garden-soil" aria-hidden="true"></span>'}${selected ? '<span class="garden-bed-marker" aria-hidden="true">✓</span>' : available && bed.kind === 'tilled' ? '<span class="garden-bed-marker" aria-hidden="true">+</span>' : ''}<span class="garden-bed-state" aria-hidden="true">${state}${bed.kind === 'crop' && bed.trait ? ' ✦' : ''}</span></button>`
}
