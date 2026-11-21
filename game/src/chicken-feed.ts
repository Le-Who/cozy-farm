import { feedBagPrice, feedBagSize, type ActionResult, type FarmState } from './farm.ts'
import { ruCount } from './ru.ts'

/** Feed is the existing ordinary stock: neither a special diet nor a production bonus. */
export const chickenFeedRecipes = {
  garden: { name: 'Огородная смесь', extra: 'carrot', extraName: 'Морковь', portions: 3 },
  orchard: { name: 'Садовая смесь', extra: 'apple', extraName: 'Яблоко', portions: 4 },
} as const
export type ChickenFeedRecipe = keyof typeof chickenFeedRecipes

export function getChickenFeedMix(farm: FarmState, recipe: ChickenFeedRecipe) {
  const definition = chickenFeedRecipes[recipe]
  const extra = definition.extra === 'apple' ? farm.fruit.apple : farm.produce.carrot
  const unlocked = farm.island === 'home' && farm.buildingLevels.coop >= 2
  const room = Number.isSafeInteger(farm.feed + definition.portions) && Number.isSafeInteger(farm.workToday + 1)
  return { ...definition, wheat: farm.produce.wheat, extraCount: extra, unlocked, room,
    available: unlocked && farm.produce.wheat >= 1 && extra >= 1 && room,
    remainingWheat: Math.max(0, farm.produce.wheat - 1), remainingExtra: Math.max(0, extra - 1),
    total: farm.feed + definition.portions }
}

// A choice at bedtime only when today's flock still needs feed and the harvest can actually supply it.
export function canMixBedtimeFeed(farm: FarmState): boolean {
  return farm.feed === 0 && !farm.chickensFed
    && (getChickenFeedMix(farm, 'garden').available || getChickenFeedMix(farm, 'orchard').available)
}

export function mixChickenFeed(farm: FarmState, recipe: unknown): ActionResult {
  if (recipe !== 'garden' && recipe !== 'orchard') return { ok: false, message: 'Выберите кормовую смесь.' }
  const mix = getChickenFeedMix(farm, recipe)
  if (!mix.unlocked) return { ok: false, message: 'Смешивать корм можно дома, в улучшенном курятнике.' }
  if (!mix.room) return { ok: false, message: 'В кладовой пока нет места для новой смеси.' }
  if (!mix.available) return { ok: false, message: 'Для смеси нужны одна обычная пшеница и одна обычная морковь или яблоко по выбранному рецепту. Проверьте запасы.' }
  farm.produce.wheat -= 1
  if (mix.extra === 'apple') farm.fruit.apple -= 1
  else farm.produce.carrot -= 1
  farm.feed += mix.portions
  farm.workToday += 1
  return { ok: true, message: `${mix.name} готова: ${ruCount(mix.portions, 'порция', 'порции', 'порций')} корма. Кормление — отдельное действие.` }
}

export function renderChickenFeedMixes(farm: FarmState, icon: (name: string) => string = () => '', fromRest = false) {
  if (farm.island !== 'home') return ''
  if (farm.buildingLevels.coop < 2) return '<section class="feed-choice"><p>Смеси откроются после улучшения курятника. Покупной корм остаётся доступен.</p></section>'
  // The compact cards stack in reading order: lead with a mix the harvest can supply.
  const mixes = (Object.keys(chickenFeedRecipes) as ChickenFeedRecipe[])
    .map(recipe => ({ recipe, mix: getChickenFeedMix(farm, recipe) }))
    .sort((a, b) => Number(b.mix.available) - Number(a.mix.available))
  return `<section class="feed-choice" aria-label="Домашние кормовые смеси">
    <div class="feed-choice-summary"><p>1 порция — вся стая на 1 утро</p><strong data-feed-stock tabindex="-1">В запасе ${farm.feed}</strong></div>
    <div class="feed-choice-grid">${mixes.map(({ recipe, mix }) => {
      const ingredient = (name: string, image: string, stock: number, remaining: number) => `<li data-missing="${stock < 1}">${icon(image)}<span><strong>${name} ×1</strong><small>${stock < 1 ? 'Нет в запасе' : `Есть ${stock} → ${remaining}`}</small></span></li>`
      const result = !mix.room ? 'Нет места для новой смеси' : mix.available ? `Запас: ${farm.feed} → ${mix.total}` : ''
      return `<article class="feed-choice-card" aria-label="${mix.name}"><h2>${recipe === 'garden' ? 'Огородная' : 'Садовая'}</h2>
        <ul class="feed-choice-cost" aria-label="Расход обычных продуктов">${ingredient('Пшеница', 'wheat', mix.wheat, mix.remainingWheat)}${ingredient(mix.extraName, mix.extra, mix.extraCount, mix.remainingExtra)}</ul>
        <div class="feed-choice-result"><strong>${ruCount(mix.portions, 'порция', 'порции', 'порций')}</strong>${result ? `<span>${result}</span>` : ''}</div>
        <button type="button" class="dialog-button" data-action="mix-chicken-feed" data-value="${recipe}" aria-label="${mix.name}: смешать ${ruCount(mix.portions, 'порцию', 'порции', 'порций')}"${mix.available ? '' : ' disabled'}>Смешать</button></article>`
    }).join('')}</div>
    <div class="feed-choice-next"><p>${farm.chickensFed ? 'Стая уже накормлена. Новый корм останется на следующие дни.' : fromRest ? 'Смешивание не кормит стаю. Дома можно дать корм перед сном.' : 'Смешивание не кормит стаю. Дайте корм в курятнике.'}</p><button type="button" class="dialog-button secondary" data-action="back">${fromRest ? 'К отдыху' : 'К курятнику'}</button></div>
    <details class="feed-choice-notes"><summary>О корме</summary><p>Используются только обычные продукты: необычный урожай сохранится. Количество яиц от вида смеси не меняется.</p><p>Покупной корм: ${feedBagSize} порции за ${feedBagPrice} монеты. Смешивание не требует ежедневного повтора.</p></details></section>`
}
