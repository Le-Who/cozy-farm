import { gardenHarvestSeeds } from './garden-harvest-seeds.ts'
import { cropDefinitions, cropIds, seedPackSize, type CropId, type FarmState } from './farm.ts'
import { gardenSeedQuote, type GardenSeedScope } from './garden-seed-basket.ts'
import { ruCount } from './ru.ts'
import { activeGardenPlan, gardenPlanPreview, saveGardenPlan, snapshotGarden, type GardenPlan } from './garden-plans.ts'
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!))
const button = (label: string, action: string, value = '', enabled = true) => `<button class="dialog-button secondary" type="button" data-action="${action}" data-value="${value}"${enabled ? '' : ' disabled'}>${label}</button>`

/** Detached UI draft. Saving uses the revision captured on entry, never a newer one. */
export class GardenPlanEditor {
  slot = 0
  draft: GardenPlan | undefined
  revision = 0
  brush: CropId | null = 'carrot'
  deleting: string | undefined
  shopping: GardenSeedScope | undefined
  reset() { this.draft = undefined; this.deleting = undefined; this.shopping = undefined }
  choose(slot: number) {
    if (this.draft || !Number.isInteger(slot) || slot < 0 || slot > 3) return false
    this.slot = slot; this.deleting = undefined; this.shopping = undefined; return true
  }
  begin(farm: FarmState, copyGarden = false) {
    if (farm.island !== 'home') return false
    const page = farm.gardenPlans.pages[this.slot]
    this.revision = farm.gardenPlans.revision
    this.draft = { name: page?.name ?? `Мой огород ${this.slot + 1}`, crops: copyGarden ? snapshotGarden(farm) : page ? [...page.crops] : Array(16).fill(null) }
    this.deleting = undefined; return true
  }
  paint(index: number) {
    if (!this.draft || !Number.isInteger(index) || index < 0 || index > 15) return false
    this.draft.crops[index] = this.brush; return true
  }
  save(farm: FarmState) {
    const result = saveGardenPlan(farm, this.slot, this.draft && { ...this.draft, name: this.draft.name.trim() }, this.revision)
    if (result.ok) this.reset()
    return result
  }
}
export function gardenPlanToken(value: string | undefined) {
  const match = /^(0|[1-9]\d{0,6}):(none|[0-3])$/.exec(value ?? '')
  return match ? { revision: Number(match[1]), slot: match[2] === 'none' ? null : Number(match[2]) } : undefined
}
const gardenModeGuidance = 'Выбор другой культуры вручную выключит этот режим. Покупка семян сама по себе план не меняет.'
const occupiedBedsGuidance = 'Занятые растения остаются на месте. Соберите их, когда созреют, или сохраните пересадкой. План не ускоряет рост и не выполняет работу за вас.'
export function renderGardenMode(farm: FarmState, compactGuidance = false) {
  const plan = activeGardenPlan(farm)
  return plan && farm.island === 'home' ? `<p class="garden-mode-note"><strong>Посев по плану: ${escape(plan.name)}</strong>${compactGuidance ? '<span class="garden-plan-guidance-compact">' : ''}<br>${gardenModeGuidance}${compactGuidance ? '</span>' : ''}</p>` : ''
}
export function renderGardenPlans(farm: FarmState, editor: GardenPlanEditor, icon: (key: string) => string) {
  if (farm.island !== 'home') return '<p>Свои планы огорода доступны на Родном острове.</p>'
  const book = farm.gardenPlans, page = book.pages[editor.slot], plan = editor.draft ?? page
  const token = `${book.revision}:${editor.slot}`
  const tabs = `<nav class="garden-pages" aria-label="Четыре личных плана">${book.pages.map((p, i) => `<button type="button" data-action="garden-slot" data-value="${i}" aria-pressed="${editor.slot === i}"${editor.draft ? ' disabled' : ''}><small>План ${i + 1}${book.active === i ? ' · Сеем' : ''}</small><strong>${escape(p?.name ?? 'Новая запись')}</strong></button>`).join('')}</nav>`
  const intro = '<p>Придумайте огород для кухни, ягодный уголок или любимый набор. Это только записи: растения, семена и монеты не меняются.</p>'
  const manualMode = book.active !== null ? button('Вернуться к ручному посеву', 'garden-follow', `${book.revision}:none`) : ''
  const mode = renderGardenMode(farm) + manualMode
  if (!plan) return `<section class="garden-plans">${intro}${tabs}${mode}<p>Начните с пустой раскладки или скопируйте культуры, которые уже растут. Для каждой грядки можно выбрать свою культуру.</p><div class="dialog-actions">${button('Нарисовать план','garden-edit')}${button('Скопировать огород','garden-copy')}</div></section>`
  if (editor.shopping && !editor.draft) return renderGardenSeedBasket(farm, editor.slot, editor.shopping)
  const preview = gardenPlanPreview(farm, plan)
  const grid = `<p class="garden-grid-caption">4 ряда по 4 грядки, в том же порядке, что на поле. ${editor.draft ? 'Выберите семена ниже и нажимайте на клетки.' : 'Нажмите клетку, чтобы найти эту грядку на острове.'}</p>`
  const cells = `<div class="garden-beds" role="group" aria-label="Раскладка грядок">${preview.beds.map(b => {
    const cropName = b.crop ? cropDefinitions[b.crop].name : 'Вручную'
    const state = b.status === 'matching' ? b.ripe ? 'Совпало · Созрело' : 'Уже растёт' : b.status === 'occupied' ? `Занято: ${b.current.kind === 'crop' ? cropDefinitions[b.current.crop].name.toLowerCase() : ''}` : b.status === 'free' ? 'Без указания' : b.status === 'till' ? 'Сначала вскопать' : b.status === 'seeds' ? 'Нет семян' : 'Можно сеять'
    return `<button type="button" class="garden-bed" data-state="${b.status}" data-action="${editor.draft ? 'garden-paint' : 'garden-bed'}" data-value="${b.index}" aria-label="Грядка ${b.index + 1}: ${cropName}. ${editor.draft ? `Нарисовать: ${editor.brush ? cropDefinitions[editor.brush].name : 'вручную'}` : state}"><small>${b.index + 1}</small>${icon(b.crop ? `ui-seed-${b.crop}` : 'tool-hoe')}<strong>${cropName}</strong>${editor.draft ? '' : `<span>${state}</span>`}</button>`
  }).join('')}</div>`
  const supply = `<details class="garden-supplies"><summary>Семена для свободных грядок${preview.missingCoins ? ` · Докупить на ${preview.missingCoins} монет` : ' · Всё есть'}</summary><p>Покупок и резервирования нет. Занятые другой культурой места не включены в закупку. Цена за пакет из ${seedPackSize} семян.</p><ul>${preview.supplies.map(s => `<li><strong>${cropDefinitions[s.crop].name}</strong>: свободных мест ${s.empty}, семян ${s.stock}${s.missing ? `, не хватает ${s.missing} · пакетов ${s.packs} за ${s.packs * s.price} монет` : ''}. Рост: ${s.nights} ${s.nights === 1 ? 'ночь' : 'ночи'}.</li>`).join('')}</ul><div class="dialog-actions">${button('Собрать список семян','garden-shop')}${button('Посмотреть рынок','travel-panel','market')}</div></details>`
  if (editor.draft) {
    const stale = book.revision !== editor.revision
    return `<section class="garden-plans">${tabs}<p class="garden-mode-note">Редактируется только запись.${book.active === editor.slot ? ' Если изменить раскладку грядок, посев по плану выключится.' : ''}</p><label class="garden-name">Название<input data-garden-name maxlength="36" value="${escape(editor.draft.name)}" autocomplete="off"></label>
      ${stale ? '<p role="alert">Запись уже изменилась. Отмените черновик и откройте план заново.</p>' : ''}
      <div class="dialog-actions">${button('Сохранить план','garden-save','',!stale)}${button('Отменить изменения','garden-cancel')}</div>${grid}
      <div class="garden-brushes" role="group" aria-label="Что нарисовать">${[...cropIds, null].map(c => `<button type="button" data-action="garden-brush" data-value="${c ?? 'none'}" aria-pressed="${editor.brush === c}">${icon(c ? `ui-seed-${c}` : 'tool-hoe')}<span>${c ? cropDefinitions[c].name : 'Вручную'}</span></button>`).join('')}</div>${cells}<p>«Вручную» оставляет обычный выбор семян на этой грядке.</p></section>`
  }
  const desktopGuidance = `<div class="garden-plan-guidance-desktop">${activeGardenPlan(farm) ? `<p>${gardenModeGuidance}</p>` : ''}<p>${occupiedBedsGuidance}</p></div>`
  return `<section class="garden-plans garden-plan-preview"><div class="garden-plan-controls">${tabs}${renderGardenMode(farm,true)}${manualMode}<h2>${escape(plan.name)}</h2><p>Совпало: ${preview.matching}/${preview.planned} · Свободно: ${preview.empty} · Занято другой культурой: ${preview.waiting}.</p><p class="garden-plan-guidance-compact">${occupiedBedsGuidance}</p>
    <div class="dialog-actions">${button(book.active === editor.slot ? 'Сеем по этому плану' : 'Сеять по плану','garden-follow',token,book.active !== editor.slot)}${button('Изменить запись','garden-edit')}${button('Пересадить культуру','open-panel','transplant')}</div>${desktopGuidance}</div><div class="garden-plan-board">${grid}${cells}${supply}</div>
    <div class="garden-plan-footer">${editor.deleting === token ? `<p>Удалить только запись «${escape(plan.name)}»? Посадки останутся. Если план активен, включится ручной посев.</p><div class="dialog-actions">${button('Да, удалить запись','garden-remove',token)}${button('Оставить запись','garden-cancel')}</div>` : button('Удалить запись','garden-delete',token)}</div></section>`
}

/** Existing notebook components, with a separate priced review before a real purchase. */
export function renderGardenSeedBasket(farm: FarmState, slot: number, scope: GardenSeedScope) {
  const quote = gardenSeedQuote(farm, slot, scope), plan = farm.gardenPlans.pages[slot]
  if (!quote || !plan) return `<section class="garden-plans"><p>Откройте сохранённый план заново.</p>${button('К плану', 'garden-shop-back')}</section>`
  const missing = Math.max(0, quote.total - farm.coins)
  const harvest = missing ? gardenHarvestSeeds(farm,slot,scope) : []
  return `<section class="garden-plans garden-shopping"><h2>Семена для «${escape(plan.name)}»</h2>
    <div class="garden-brushes" role="group" aria-label="Для какого посева купить семена">
    <button type="button" data-action="garden-shop-scope" data-value="open" aria-pressed="${scope === 'open'}">Для свободных грядок</button>
    <button type="button" data-action="garden-shop-scope" data-value="all" aria-pressed="${scope === 'all'}">На полный посев</button></div>
    <p>${scope === 'open' ? 'Только места плана без растущих культур. Занятые грядки в список не входят.' : 'На один полный посев всей раскладки, включая занятые места. Растущие культуры остаются на месте; новые семена подождут в запасе.'}</p>
    <p>Имеющиеся семена уже учтены. Обычная цена рынка: пакет содержит ${ruCount(seedPackSize, 'семя', 'семени', 'семян')}. Лишние семена из целого пакета останутся у вас.</p>
    <ul class="garden-shopping-list">${quote.lines.map(line => `<li><strong>${escape(cropDefinitions[line.crop].name)}</strong><span>Мест: ${line.required} · Семян в запасе: ${line.stock}</span><span>${line.packs ? `Докупить: ${ruCount(line.packs, 'пакет', 'пакета', 'пакетов')} (+${ruCount(line.seeds, 'семя', 'семени', 'семян')}) · ${ruCount(line.cost, 'монета', 'монеты', 'монет')}` : 'Докупить не нужно'}</span></li>`).join('')}</ul>
    <p class="garden-mode-note" data-garden-basket-total tabindex="-1"><strong>${quote.packs ? `Весь список: ${ruCount(quote.packs, 'пакет', 'пакета', 'пакетов')} · ${ruCount(quote.total, 'монета', 'монеты', 'монет')}` : 'Все семена уже есть'}</strong><br>У вас: ${ruCount(farm.coins, 'монета', 'монеты', 'монет')}.${missing ? `<span>Не хватает ${ruCount(missing, 'монеты', 'монет', 'монет')}. Частичной покупки не будет.</span>` : ''}</p>
    <p>Оплата только по кнопке ниже. Покупка не сеет, не освобождает грядки и не меняет выбранный режим посева.</p>
    ${harvest.length ? `<section class="garden-harvest-seeds" aria-label="Семена из своего урожая"><h3>Вместо покупки пакета</h3>${harvest.map(item=>`<div>${button(`Обменять: ${item.name.toLowerCase()} ×1 → ${ruCount(item.pack,'семя','семени','семян')}`,'garden-save-seeds',item.token)}<small>Останется обычного урожая: ${item.remaining}. ${item.after?`Затем к покупке: ${ruCount(item.after,'монета','монеты','монет')}.`:'После обмена весь список собран.'}</small></div>`).join('')}</section>` : ''}
    <div class="dialog-actions">${quote.packs ? button(`Купить список за ${ruCount(quote.total, 'монету', 'монеты', 'монет')}`, 'garden-buy-seeds', quote.token, quote.affordable) : ''}${button('К плану', 'garden-shop-back')}</div></section>`
}
