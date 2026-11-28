import { canSailTo, dishDefinitions, fishDefinitions, getFishAction, getHarborOrder, getOrchardPreservesSupper, getSignatureStock, getVillageHomeCount, getVillageMeal, islandIds, orchardIslandIds, sail, workshopShapes, type FarmState, type SupperFish } from './farm.ts'
import { freightStock } from './bay-freight-model.ts'
import { bayProductId } from './bay-product-id.ts'
import { getFishSource } from './fish-guidance.ts'
import { getLocalWarehouseSupply } from './warehouse-guidance.ts'
import { ruCount } from './ru.ts'
import type { SignatureRecipe } from './culinary.ts'

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))

const supperFishItem = (item: 'perch' | 'seaBass') => ({ kind: 'fish', item, quantity: 1 } as const)

/** One ordinary fish is interchangeable at supper; a charter's exact fish are not. */
export function getSupperFishRecovery(farm: FarmState) {
  const preferred = getVillageMeal(farm).fish
  const items = [supperFishItem(preferred), supperFishItem(preferred === 'perch' ? 'seaBass' : 'perch')] as const
  for (const item of items) {
    if (getLocalWarehouseSupply(farm, item)) return { kind: 'warehouse', port: farm.island, item } as const
  }
  const shore = orchardIslandIds.find(island => island === farm.island && getFishAction(farm).available)
    ?? [getFishSource(farm, preferred), ...orchardIslandIds].find(island =>
      canSailTo(farm, island) && getFishAction({ ...farm, island }).available)
  if (shore) return { kind: 'shore', shore, item: supperFishItem(shore === 'home' ? 'perch' : 'seaBass') } as const
  // A full catch limit does not mean tomorrow if a warehouse already has today's fish.
  for (const port of islandIds) {
    if (port === farm.island || !canSailTo(farm, port)) continue
    const stored = items.filter(item => freightStock(farm.freight, port, item.item) > 0)
    if (!stored.length) continue
    const arrival = structuredClone(farm)
    if (!sail(arrival, port).ok) continue
    for (const item of stored) {
      if (getLocalWarehouseSupply(arrival, item)) return { kind: 'warehouse', port, item } as const
    }
  }
  return { kind: 'rest' } as const
}

/** Show a choice only when the stock default would break a fully supplied, different job. */
export function getSupperFishFork(farm: FarmState) {
  const meal = getVillageMeal(farm)
  if (farm.island !== 'village' || !farm.village.built || meal.served || meal.fish !== 'seaBass'
    || farm.fish.seaBass !== 1 || !farm.fish.perch) return
  const order = getHarborOrder(farm)
  if (!order || order.status === 'completed'
    || !order.items.some(({item,available}) => item.kind === 'fish' && item.item === 'seaBass' && available > 0)
    || !order.items.every(({item,delivered,available}) => delivered + available === item.quantity)) return
  const otherMeal = workshopShapes.some(shape => farm.handmade[shape] > 0) || getSignatureStock(farm).some(({count}) => count > 0)
  const preserves = getOrchardPreservesSupper(farm, 'perch')
  // Choosing perch only protects this order if serving preserves leaves its jar covered.
  const keepsParcelJar = preserves && order.items.every(({item,delivered}) =>
    item.kind !== 'dishes' || item.item !== 'orchardPreserves' || delivered + preserves.count > item.quantity)
  if (!otherMeal && !keepsParcelJar) return
  return { key: `${farm.day}:${farm.orders.harbor.completed}`, reward: order.reward }
}
type SupperFishFork = NonNullable<ReturnType<typeof getSupperFishFork>>
const species = (value?: string): SupperFish | undefined => value === 'perch' || value === 'seaBass' ? value : undefined
export function tableSupperFish(root: HTMLElement, fork: SupperFishFork): SupperFish | undefined {
  return species(root.querySelector<HTMLButtonElement>(`[data-supper-fish="${fork.key}"] button[aria-pressed="true"]`)?.dataset.value)
}
const delayedOrderCopy = (reward: number) => `Отложит заказ на ${ruCount(reward,'монету','монеты','монет')}`
export function renderSupperFishFork(farm: FarmState, fork: SupperFishFork, selected: SupperFish, picture: (fish: SupperFish) => string) {
  const delay = delayedOrderCopy(fork.reward)
  return `<div class="recipe-fish-choices shared-supper-fish" role="group" aria-label="Рыба к ужину" data-supper-fish="${fork.key}">${(['seaBass','perch'] as const).map(fish =>
    `<button type="button" data-action="supper-fish" data-value="${fish}" aria-pressed="${selected===fish}">${picture(fish)}<span>${fishDefinitions[fish].name} ×${farm.fish[fish]}</span>${fish==='seaBass'?`<small>${delay}</small>`:''}</button>`).join('')}</div>`
}
export function reviewedSupperFish(farm: FarmState, root: HTMLElement, value: string) {
  const [,day,order,fish,id] = /^supper:(\d+):(\d+):(perch|seaBass)(?::(s[1-9]\d{0,5}))?$/.exec(value) ?? []
  const selected = species(fish), fork = getSupperFishFork(farm)
  // Recheck the same open table, not merely an earlier rendered count or order price.
  if (!fork || fork.key !== `${day}:${order}` || !selected || selected !== tableSupperFish(root, fork)) return
  return {fish:selected,id}
}

/** Existing signature supper rules, exposed without reserving or spending anything. */
export function getReadySignatureSuppers(farm: FarmState, fish?: SupperFish) {
  const meal = getVillageMeal(farm,undefined,fish)
  const available = farm.island === 'village' && farm.village.built && !meal.served && farm.fish[meal.fish] >= 1
    && Number.isSafeInteger(farm.workToday + 1) && Number.isSafeInteger(farm.village.meals + 1)
  return getSignatureStock(farm).filter(({ count }) => count > 0).map(({ recipe, count }) => ({ recipe, count, fish: meal.fish, available }))
}

const orchardJar = {kind:'dishes',item:'orchardPreserves',quantity:1} as const

/** Report a real foregone ready order, not merely a recipe or a theoretical market value. */
export function getSupperPreservesChoice(farm: FarmState, fish?: SupperFish) {
  const meal = getOrchardPreservesSupper(farm,fish)
  if (!meal) return
  const order = meal.count === 1 && canSailTo(farm,'grove') ? getHarborOrder(farm) : undefined
  let reward: number | undefined
  if (order && order.status !== 'completed'
    && order.items.some(({item,available}) => item.kind === orchardJar.kind && item.item === orchardJar.item && available === 1)
    && order.items.every(({item,delivered,available}) => delivered + available === item.quantity)) {
    const id = bayProductId(orchardJar)
    const hasSpare = islandIds.some(port => freightStock(farm.freight,port,id) > 0
      && getLocalWarehouseSupply({...farm,island:port,dishes:{...farm.dishes,orchardPreserves:0}},orchardJar))
    if (!hasSpare) reward = order.reward
  }
  // Bind the visible fish, bag count and exact economic consequence to this day's deliberate click.
  const value = `${farm.day}:${meal.fish}:${meal.count}:${reward ?? ''}`
  return {...meal,value,delay:reward === undefined ? '' : delayedOrderCopy(reward)}
}

function renderSupperPreserves(choice: NonNullable<ReturnType<typeof getSupperPreservesChoice>>, picture: string) {
  const name = dishDefinitions.orchardPreserves.name, fish = fishDefinitions[choice.fish].name.toLowerCase()
  return `<button type="button" class="shared-supper-choice" data-action="supper-preserves" data-value="${choice.value}" aria-label="Подать ${name}. Расход: 1 порция и 1 рыба — ${fish}. В запасе: ${ruCount(choice.count,'порция','порции','порций')}.${choice.delay?` ${choice.delay}.`:''}">
    <span class="shared-supper-picture" aria-hidden="true">${picture}</span><strong>${name}</strong><span>В запасе: ×${choice.count}</span><small>Подать 1 порцию</small>${choice.delay?`<small>${choice.delay}</small>`:''}
  </button>`
}

export function renderSignatureSuppers(farm: FarmState, picture: (recipe: SignatureRecipe) => string,
  selection?: {fork: SupperFishFork;fish: SupperFish}, preservesPicture?: () => string): string {
  if (!farm.village.built || getVillageMeal(farm).served) return ''
  const choices = getReadySignatureSuppers(farm,selection?.fish)
  const preserves = preservesPicture && getSupperPreservesChoice(farm,selection?.fish)
  const jar = preserves && preservesPicture ? renderSupperPreserves(preserves,preservesPicture()) : ''
  if (!choices.length && !jar) return ''
  return `<section class="shared-supper-recipes" aria-label="Готовые блюда к ужину"><h2>Готовое блюдо вместо выпечки</h2>
    <div class="shared-supper-choices">${jar}${choices.map(({recipe,count,fish,available}) => `<button type="button" class="shared-supper-choice" data-action="supper-signature" data-value="${escape(selection ? `supper:${selection.fork.key}:${fish}:${recipe.id}` : recipe.id)}" ${available?'':'disabled'} aria-label="Подать ${escape(recipe.name)}. Расход: 1 порция и 1 рыба — ${fishDefinitions[fish].name.toLowerCase()}. В запасе: ${ruCount(count, 'порция', 'порции', 'порций')}.">
      <span class="shared-supper-picture" aria-hidden="true">${picture(recipe)}</span><strong>${escape(recipe.name)}</strong><span>В запасе: ×${count}</span><small>Подать 1 порцию</small>
    </button>`).join('')}</div></section>`
}

/** A shared table can point at a free house. Opening it is never an invitation. */
export function supperCottageReady(farm: FarmState): boolean {
  return farm.island === 'village' && getVillageMeal(farm).served && getVillageHomeCount(farm) === 2 && !farm.village.residents[1]
}

export function renderSupperResult(farm: FarmState, cottageArt: string, homeButton: string): string {
  if (farm.island !== 'village' || !getVillageMeal(farm).served) return ''
  if (farm.village.meals === 1) return `<p class="dialog-status" tabindex="-1" data-supper-result>До второго домика: 1 из 2 ужинов. Следующий ужин завтра.</p>${homeButton}`
  if (!supperCottageReady(farm)) return `<p class="dialog-status">Сегодня общий ужин уже состоялся. Следующий ужин завтра.</p>${homeButton}`
  return `<section class="supper-result"><div class="supper-result-head"><span aria-hidden="true">${cottageArt}</span><div><small>Общий ужин состоялся</small><h2 tabindex="-1" data-supper-result>Второй домик свободен</h2></div></div><div class="supper-result-actions"><button type="button" class="dialog-button" data-action="supper-cottage">К домику 2</button>${homeButton}</div></section>`
}
