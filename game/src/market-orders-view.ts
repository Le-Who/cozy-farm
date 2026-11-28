import { getHarborOrder, getMarketOrders, ingredientCount, type FarmState, type StockItem } from './farm.ts'
import { getLocalWarehouseSupply, warehouseRequestValue } from './warehouse-guidance.ts'
import { ruCount } from './ru.ts'
import { quoteMarketOrderPickup } from './market-order-pickup.ts'
import { readyHarborOrderRoute } from './harbor-return.ts'

export type MarketOrderChoice = {
  id: string; name: string; reward: number;
  group: 'ready' | 'warehouse' | 'waiting' | 'delivered' | 'harbor'; note: string; warehouseRequest?:string; readyHarborRoute?: boolean
}

/** Only the visible portfolio is selectable. No duplicated menus, stock or reward calculation. */
export function getMarketOrderBoard(farm: FarmState, selected?: string) {
  const supply = new Map<string, ReturnType<typeof getLocalWarehouseSupply>>()
  const readSupply = (_farm:FarmState,item:StockItem) => {
    const key = warehouseRequestValue(item)
    if (!supply.has(key)) supply.set(key,getLocalWarehouseSupply(farm,item))
    return supply.get(key)
  }
  const locallyCovered = (item:StockItem) => {
    const view = readSupply(farm,item)
    return view && view.carried + view.quantity >= item.quantity
  }
  const orders = getMarketOrders(farm)
  const choices: MarketOrderChoice[] = orders.map(order => {
    const missing = farm.island === 'home' && farm.boatOwned && order.status === 'waiting'
      ? order.items.filter(item=>ingredientCount(farm,item)<item.quantity) : []
    const warehouseRequest = missing.length && missing.every(locallyCovered) ? warehouseRequestValue(missing[0]) : undefined
    return {id: order.lane, name: order.name, reward: order.reward,
      group: order.status === 'ready' ? 'ready' : warehouseRequest ? 'warehouse' : order.status === 'delivered' ? 'delivered' : 'waiting',
      note: order.status === 'upgrade' ? 'Нужно улучшить дом' : '', ...(warehouseRequest ? {warehouseRequest} : {})}
  })
  const harbor = getHarborOrder(farm)
  if (harbor) choices.push({ id: 'harbor', name: harbor.name, reward: harbor.reward, group: 'harbor',
    note: harbor.status === 'completed' ? 'Доставлено' : farm.island !== 'grove' ? 'Сдача в роще' : harbor.status === 'ready' ? 'Можно внести припасы' : 'Нужны припасы',
    readyHarborRoute: readyHarborOrderRoute(farm, harbor) !== undefined })
  // Keep deliveries that need no crossing first. An exact pier route still outranks waiting.
  const current = choices.find(order => order.id === selected) ?? choices.find(order => order.group === 'ready')
    ?? choices.find(order => order.group === 'warehouse') ?? choices.find(order => order.readyHarborRoute) ?? choices[0]
  const order = orders.find(order => order.lane === current?.id)
  const pickup = order && current?.group === 'warehouse' ? quoteMarketOrderPickup(farm, order, readSupply) : undefined
  // Each local withdrawal is useful information even if another line still needs supplies.
  const localWithdrawals = order?.status === 'waiting' && farm.island === 'home'
    ? order.items.map(item => readSupply(farm,item)?.quantity) : []
  return { choices, selected: current?.id, order, pickup, localWithdrawals }
}

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))
export function renderMarketOrderPicker(board: ReturnType<typeof getMarketOrderBoard>, icon: (name: string) => string) {
  const harbor = ['harbor', 'Причал рощи'] as const
  const remaining = [['waiting', 'Нужно подготовить'], ['delivered', 'Сегодня доставлены']] as const
  const groups = [['ready', 'Готовы к сдаче'], ['warehouse', 'Осталось забрать со склада'],
    ...(board.choices.some(order => order.readyHarborRoute) ? [harbor, ...remaining] : [...remaining, harbor])] as const
  return `<nav class="market-order-picker" aria-label="Выберите заказ">${groups.map(([group, title]) => {
    const choices = board.choices.filter(order => order.group === group)
    return choices.length ? `<section class="market-order-group" data-order-group="${group}"><h2>${title} <small>${choices.length}</small></h2>${choices.map(order =>
      `<button type="button" class="market-order-choice" data-action="market-order-select" data-value="${order.id}" aria-pressed="${order.id === board.selected}" aria-label="${escape(order.name)} · ${ruCount(order.reward, 'монета', 'монеты', 'монет')}${order.note ? ` · ${order.note}` : ''}"><span>${escape(order.name)}</span><strong>${icon('coin')}${order.reward}</strong>${order.note ? `<small>${order.note}</small>` : ''}</button>`).join('')}</section>` : ''
  }).join('')}</nav>`
}

/** Keep a ready hand-in or verified paired local pickup ahead of alternate orders in the stacked layout. */
export function placeReadyMarketOrder(content: HTMLElement, stacked: boolean) {
  const workspace = content.querySelector<HTMLElement>('.market-orders-workspace')
  const picker = workspace?.querySelector<HTMLElement>(':scope > .market-order-picker')
  const detail = workspace?.querySelector<HTMLElement>(':scope > .market-order-detail')
  const order = detail?.querySelector<HTMLElement>(':scope > .market-order[data-status="ready"]')
  const items = order?.querySelector<HTMLElement>(':scope > .order-items')
  const action = order?.querySelector<HTMLButtonElement>(':scope > [data-action="deliver-order"]:not(:disabled)')
  const pickup = detail?.querySelector<HTMLButtonElement>(':scope > .market-order[data-status="waiting"] > button[data-action="market-order-pickup"]:not(:disabled)')
  if (!workspace || !picker || !detail || (!(order && items && action) && !pickup)
    || (workspace.firstElementChild === detail) === stacked) return

  const focused = content.ownerDocument.activeElement
  if (stacked) {
    // Local pickup still follows the exact displayed ingredient quantities.
    if (order && items && action) order.insertBefore(action, items)
    workspace.insertBefore(detail, picker)
  } else {
    if (order && action) order.append(action)
    workspace.append(detail)
  }
  // Crossing the breakpoint may blur the moved node. Never focus a new action.
  if (focused instanceof HTMLElement && detail.contains(focused) && focused !== content.ownerDocument.activeElement)
    focused.focus({ preventScroll: true })
}
