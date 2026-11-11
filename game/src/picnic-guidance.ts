import { getFishLimit, type FarmState } from './farm.ts'
import { picnicExpiryText, signatureProcessingDefinitions, type SignatureProcessing } from './culinary.ts'

/** Describe the existing effect without consuming food, starting actions or saving. */
export function picnicLimitNote(farm: FarmState, processing: SignatureProcessing): string {
  if (processing !== 'bright') return ''
  const reachable = farm.boatOwned ? ['home', 'grove'] as const : ['home'] as const
  return reachable.every(island => farm.fishCaughtToday[island] >= getFishLimit(farm, island))
    ? 'Сегодня обычная рыбалка уже недоступна на открытых островах. Лучше оставить порцию для завтрашнего пикника.' : ''
}

export function renderPicnicOffer(farm: FarmState, processing: SignatureProcessing): string {
  const effect = signatureProcessingDefinitions[processing]
  const limit = picnicLimitNote(farm, processing)
  return `<div class="picnic-offer"><strong>Пикник · расход 1 порция</strong><p>${effect.use}</p><p>${effect.timing} ${picnicExpiryText}</p>${limit ? `<p class="picnic-limit">${limit}</p>` : ''}</div>`
}

export function renderPicnicStatus(farm: FarmState, beforeRest = false): string {
  const picnic = farm.culinary.picnic
  if (!picnic || picnic.day !== farm.day) return ''
  const effect = signatureProcessingDefinitions[picnic.processing]
  const limit = picnicLimitNote(farm, picnic.processing)
  return `<section class="picnic-status" aria-label="Эффект пикника"><h2>${beforeRest ? 'Перед отдыхом · пикник ещё действует' : 'Пикник ещё действует'}</h2>
    <p>${effect.use}</p><p>${effect.timing}</p>
    <p><strong>${picnicExpiryText}</strong>${beforeRest ? ' Можно отдохнуть сейчас, если бонус не нужен.' : ' Новый пикник станет доступен после использования эффекта или утром.'}</p>
    ${limit ? '<p class="picnic-limit">На открытых островах дневная рыбалка уже закончилась. Этот эффект не продлевает лимит улова.</p>' : ''}</section>`
}
