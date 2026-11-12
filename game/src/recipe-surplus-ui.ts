import type { FarmState, StockItem } from './farm.ts'
import { recipeSurplusQuote, sellRecipeSurplus } from './recipe-surplus.ts'
import { ruCount } from './ru.ts'

type Quote = NonNullable<ReturnType<typeof recipeSurplusQuote>>
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!))
const button = (label: string, action: string, value = '', enabled = true) => `<button type="button" class="dialog-button secondary" data-action="${action}" data-value="${escape(value)}"${enabled ? '' : ' disabled'}>${label}</button>`

/** A review of this one sale, not a persistent reservation of the pantry. */
export class RecipeSurplusSelection {
  quote: Quote | undefined
  receipt: Quote | undefined
  reset() { this.quote = undefined; this.receipt = undefined }
  choose(farm: FarmState, id: string, quantity: 1 | 3) {
    const quote = recipeSurplusQuote(farm, id, quantity)
    if (!quote) return false
    this.quote = quote; this.receipt = undefined; return true
  }
  confirm(farm: FarmState, token: string | undefined) {
    if (!this.quote || this.receipt || token !== this.quote.token) return { ok: false, message: 'Сначала проверьте состав продажи.' }
    const result = sellRecipeSurplus(farm, token)
    if (result.ok) this.receipt = this.quote
    return result
  }
}

export function renderRecipeSurplus(farm: FarmState, selection: RecipeSurplusSelection, label: (item: StockItem) => string): string {
  if (farm.island !== 'home') return '<p>Лишние ингредиенты можно продать на рынке Родного острова.</p>'
  const receipt = selection.receipt
  if (receipt) return `<section class="exact-sale recipe-surplus"><h2>${escape(receipt.recipeName)}</h2>
    <p class="exact-sale-receipt" role="status">Продано: ${ruCount(receipt.items, 'ингредиент', 'ингредиента', 'ингредиентов')}. Выручка: ${ruCount(receipt.total, 'монета', 'монеты', 'монет')}.</p>
    <h3>В припасах осталось</h3><ul class="dialog-list">${receipt.lines.map(line => `<li class="recipe-surplus-line"><strong>${escape(label(line.item))}</strong><span>Осталось: ${line.kept}${line.missing ? ` · ещё нужно: ${line.missing}` : ''}</span></li>`).join('')}</ul>
    <p>${receipt.missing ? 'Не все ингредиенты собраны. Вернитесь к рецепту, чтобы найти недостающие.' : `Ингредиенты на повтор ×${receipt.quantity} остались. Приготовление нужно выбрать отдельно.`}</p>
    ${button('К своему рецепту', 'recipe-surplus-recipe', receipt.recipeId)}${button('Другой рецепт', 'recipe-surplus-reset')}</section>`
  const quote = selection.quote
  if (!quote) return `<section class="exact-sale recipe-surplus"><h2>Оставить на свой рецепт</h2>
    <p>Выберите рецепт. Оставим ингредиенты на один повтор или партию ×3, а лишнее можно продать после проверки.</p>
    <p>Продаются только ингредиенты выбранного рецепта. Другие припасы, готовые блюда и семена остаются.</p>
    ${farm.culinary.recipes.length ? `<div class="dialog-actions">${farm.culinary.recipes.map(recipe => button(escape(recipe.name), 'recipe-surplus-choose', recipe.id)).join('')}</div>` : '<p>Сначала приготовьте и сохраните собственный рецепт.</p>'}
    ${button('Мои рецепты', 'open-panel', 'recipes')}</section>`
  const live = recipeSurplusQuote(farm, quote.recipeId, quote.quantity)
  if (!live || live.token !== quote.token) return `<section class="exact-sale recipe-surplus"><p role="alert">Рецепт, припасы или цена изменились. Проверьте состав продажи заново.</p>
    ${live ? button('Обновить состав', 'recipe-surplus-refresh') : ''}${button('Выбрать рецепт', 'recipe-surplus-reset')}</section>`
  return `<section class="exact-sale recipe-surplus"><h2>${escape(quote.recipeName)}</h2>
    <p>Оставить ингредиенты на:</p><div class="dialog-actions" role="group" aria-label="Сколько приготовить потом">${([1, 3] as const).map(quantity => `<button type="button" class="dialog-button secondary" data-action="recipe-surplus-quantity" data-value="${quantity}" aria-pressed="${quote.quantity === quantity}">${quantity === 1 ? 'Один повтор ×1' : 'Партию ×3'}</button>`).join('')}</div>
    <ul class="dialog-list">${quote.lines.map(line => `<li class="recipe-surplus-line"><strong>${escape(label(line.item))}</strong><span>В запасе: ${line.stock} · нужно: ${line.required}</span><span>Останется: ${line.kept} · продать: ${line.sell}${line.sell ? ` за ${line.total}` : ''}</span>${line.missing ? `<small>Ещё не хватает: ${line.missing}</small>` : ''}</li>`).join('')}</ul>
    <p>${quote.missing ? 'Не всё собрано. Недостающие ингредиенты не заменяются другими; имеющееся для рецепта останется.' : `Состав на повтор ×${quote.quantity} собран.`}</p>
    <p>Особенности ингредиентов сохраняются точно. Продаются только показанные излишки. Другие припасы, блюда и семена не затрагиваются.</p>
    <p>Это одна продажа, не постоянный резерв: оставшиеся припасы можно использовать как обычно.</p>
    <p class="exact-sale-summary">${quote.items ? `Продать: ${ruCount(quote.items, 'ингредиент', 'ингредиента', 'ингредиентов')} · ${ruCount(quote.total, 'монета', 'монеты', 'монет')}.` : 'Лишних ингредиентов нет. Ничего продавать не нужно.'}</p>
    <div class="dialog-actions">${button(`Продать лишнее · ${quote.total}`, 'recipe-surplus-confirm', quote.token, quote.items > 0)}${button('К рецепту без продажи', 'recipe-surplus-recipe', quote.recipeId)}${button('Другой рецепт', 'recipe-surplus-reset')}</div></section>`
}
