import { cropIds, cropDefinitions, seedPackSize, type CropId, type FarmState } from './farm.ts'
import { seedChoice } from './seed-choice.ts'
import { renderSeedSaving, seedSavingQuote } from './seed-saving.ts'
import { ruCount } from './ru.ts'

type SeedPickerArt = {
  icon: (name: string) => string
  button: (label: string, action: string, enabled: boolean, options: { context?: string; value?: string; crop?: CropId; cost?: { icon: 'coin'; amount: number } }) => string
}
const cropChoiceNames: Record<CropId, string> = { carrot:'морковь', cabbage:'капусту', beetroot:'свёклу', tomato:'помидор', pumpkin:'тыкву', wheat:'пшеницу', leafyGreens:'зелень', strawberry:'клубнику', blueberry:'чернику', raspberry:'малину' }

/** Browsing and the prominent action retain the existing separate selection contract. */
export function renderSeedPicker(farm: FarmState, previewSeed: CropId, bed: number | undefined, art: SeedPickerArt, mode = '', navigation = '') {
  const seed = cropDefinitions[previewSeed], choice = seedChoice(farm, previewSeed, bed)
  const label = choice.planned ? choice.label : `Выбрать ${cropChoiceNames[previewSeed]}${choice.pausesPlan ? ' вручную' : ''}`
  const affordable = farm.coins >= seed.seedPrice
  const quote = !choice.available ? seedSavingQuote(farm,previewSeed) : undefined
  const exchange = !affordable && quote?.available ? quote : undefined
  // Keep both ways to refill the empty packet before the other crops.
  const showBoth = affordable && quote?.available
  const buy = !choice.available ? art.button(`Купить ×${seedPackSize}`, 'buy-seeds', affordable, {crop:previewSeed, context:`Семена: ${seed.name.toLowerCase()}, цена: ${ruCount(seed.seedPrice,'монета','монеты','монет')}`, cost:{icon:'coin',amount:seed.seedPrice}}) : ''
  const primary = choice.available ? art.button(label, 'choose-seed', choice.validTarget, {value:choice.token, crop:previewSeed, context:''})
    : exchange ? art.button(`Обменять на ${ruCount(exchange.pack,'семя','семени','семян')}`,'save-crop-seeds',true,{value:exchange.token,context:`цена, обычный урожай: ${seed.name.toLowerCase()} ×1`}) : buy
  const detail = choice.available ? choice.detail
    : exchange ? `Цена: ${seed.name.toLowerCase()} ×1 из обычного урожая. Посев отдельно.`
      : !affordable ? `У вас: ${ruCount(farm.coins,'монета','монеты','монет')} · не хватает ${seed.seedPrice - farm.coins}.`
        : 'Покупка пополнит запас. Выбор и посев — отдельно.'
  const saving = renderSeedSaving(farm, previewSeed, art.icon, exchange ? buy : undefined)
  return `<section class="seed-picker" aria-label="Выбор культуры">
    <section class="seed-picker-current" aria-label="Просмотр: ${seed.name}">${art.icon(previewSeed)}<div class="seed-picker-current-copy"><h2>${seed.name}</h2><p>${ruCount(seed.days, 'ночь', 'ночи', 'ночей')} · ${seed.retainsWater ? 'один полив' : 'полив каждый день'}</p></div>
      <div class="seed-picker-primary">${primary}</div>
      <p class="seed-picker-contract">${detail}</p>
    </section>
    ${showBoth ? saving : ''}${mode}<div class="seed-picker-grid" role="group" aria-label="Все культуры">${cropIds.map(crop => `<button class="seed-picker-tile" type="button" data-action="preview-seed" data-value="${crop}" aria-pressed="${previewSeed === crop}" aria-label="Посмотреть семена: ${cropDefinitions[crop].name.toLowerCase()}, в наличии: ${farm.seeds[crop]}">${art.icon(`ui-seed-${crop}`)}<strong>${cropDefinitions[crop].name}</strong><span>×${farm.seeds[crop]}</span></button>`).join('')}</div>
    ${showBoth ? '' : saving}${navigation}
  </section>`
}
