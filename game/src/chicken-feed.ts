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

export function renderChickenFeedMixes(farm: FarmState) {
  if (farm.island !== 'home') return ''
  if (farm.buildingLevels.coop < 2) return '<section class="coop-morning chicken-feed"><h2>Корм со своей фермы</h2><p>В улучшенном курятнике можно смешивать пшеницу с морковью или яблоком. Покупной корм остаётся доступен.</p></section>'
  return `<section class="coop-morning chicken-feed" aria-label="Домашние кормовые смеси"><h2>Корм со своей фермы</h2>
    <p>В запасе ${ruCount(farm.feed, 'порция', 'порции', 'порций')}. Одной порции хватает всей стае на одно утро. Смесь нужно отдельно дать курам.</p>
    <p>Используются только обычные продукты, необычный урожай сохранится. Количество яиц от вида смеси не меняется.</p>
    <div class="chicken-feed-recipes">${(Object.keys(chickenFeedRecipes) as ChickenFeedRecipe[]).map(recipe => {
      const mix = getChickenFeedMix(farm, recipe)
      return `<article class="chicken-feed-recipe"><h3>${mix.name}</h3>
        <p>Пшеница ×1 · есть ${mix.wheat}, останется ${mix.remainingWheat}<br>${mix.extraName} ×1 · есть ${mix.extraCount}, останется ${mix.remainingExtra}</p>
        <p>${!mix.room ? 'В кладовой пока нет места для новой смеси.' : mix.available ? `После смешивания в запасе: ${ruCount(mix.total, 'порция', 'порции', 'порций')}.` : 'Нужны оба обычных продукта в запасах.'}</p>
        <button type="button" class="dialog-button" data-action="mix-chicken-feed" data-value="${recipe}"${mix.available ? '' : ' disabled'}>Смешать · +${ruCount(mix.portions, 'порция', 'порции', 'порций')}</button></article>`
    }).join('')}</div><p class="coop-morning-detail">Можно по-прежнему покупать корм: ${feedBagSize} порции за ${feedBagPrice} монеты. Смешивание не кормит автоматически и не требует ежедневного повтора.</p></section>`
}
