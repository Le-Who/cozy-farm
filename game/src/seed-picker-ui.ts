import { cropIds, cropDefinitions, seedPackSize, type CropId, type FarmState } from './farm.ts'
import { activeGardenPlan } from './garden-plans.ts'
import { seedChoice } from './seed-choice.ts'
import { renderSeedSaving } from './seed-saving.ts'
import { ruCount } from './ru.ts'

type SeedPickerArt = {
  icon: (name: string) => string
  button: (label: string, action: string, enabled: boolean, options: { value?: string; crop?: CropId; cost?: { icon: 'coin'; amount: number } }) => string
}
const cropChoiceNames: Record<CropId, string> = { carrot:'морковь', cabbage:'капусту', beetroot:'свёклу', tomato:'помидор', pumpkin:'тыкву', wheat:'пшеницу', leafyGreens:'зелень', strawberry:'клубнику', blueberry:'чернику', raspberry:'малину' }

/** Browsing and the prominent action retain the existing separate selection contract. */
export function renderSeedPicker(farm: FarmState, previewSeed: CropId, bed: number | undefined, art: SeedPickerArt, mode = '', navigation = '') {
  const seed = cropDefinitions[previewSeed], choice = seedChoice(farm, previewSeed, bed)
  const label = choice.planned ? choice.label : `Выбрать ${cropChoiceNames[previewSeed]}${activeGardenPlan(farm) ? ' вручную' : ''}`
  return `<section class="seed-picker" aria-label="Выбор культуры">
    <section class="seed-picker-current" aria-label="Просмотр: ${seed.name}">${art.icon(previewSeed)}<div class="seed-picker-current-copy"><h2>${seed.name}</h2><p>${ruCount(seed.days, 'ночь', 'ночи', 'ночей')} · ${seed.retainsWater ? 'один полив' : 'полив каждый день'}</p></div>
      <div class="seed-picker-primary">${choice.available ? art.button(label, 'choose-seed', true, {value:choice.token}) : art.button(`Купить ×${seedPackSize}`, 'buy-seeds', farm.coins >= seed.seedPrice, {crop:previewSeed, cost:{icon:'coin',amount:seed.seedPrice}})}</div>
      <p class="seed-picker-contract">${choice.available ? choice.detail : 'Покупка пополнит запас. Выбор и посев — отдельно.'}</p>
    </section>
    ${mode}<div class="seed-picker-grid" role="group" aria-label="Все культуры">${cropIds.map(crop => `<button class="seed-picker-tile" type="button" data-action="preview-seed" data-value="${crop}" aria-pressed="${previewSeed === crop}" aria-label="Посмотреть семена: ${cropDefinitions[crop].name.toLowerCase()}, в наличии: ${farm.seeds[crop]}">${art.icon(`ui-seed-${crop}`)}<strong>${cropDefinitions[crop].name}</strong><span>×${farm.seeds[crop]}</span></button>`).join('')}</div>
    ${renderSeedSaving(farm, previewSeed, art.icon)}${navigation}
  </section>`
}
