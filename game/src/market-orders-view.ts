import { getHarborOrder, getMarketOrders, type FarmState } from './farm.ts'
import { ruCount } from './ru.ts'

export type MarketOrderChoice = {
  id: string; name: string; reward: number;
  group: 'ready' | 'waiting' | 'delivered' | 'harbor'; note: string
}

/** Only the visible portfolio is selectable. No duplicated menus, stock or reward calculation. */
export function getMarketOrderBoard(farm: FarmState, selected?: string) {
  const choices: MarketOrderChoice[] = getMarketOrders(farm).map(order => ({
    id: order.lane, name: order.name, reward: order.reward,
    group: order.status === 'ready' ? 'ready' : order.status === 'delivered' ? 'delivered' : 'waiting',
    note: order.status === 'upgrade' ? 'Нужно улучшить дом' : '',
  }))
  const harbor = getHarborOrder(farm)
  if (harbor) choices.push({ id: 'harbor', name: harbor.name, reward: harbor.reward, group: 'harbor',
    note: harbor.status === 'completed' ? 'Доставлено' : farm.island !== 'grove' ? 'Сдача в роще' : harbor.status === 'ready' ? 'Можно внести припасы' : 'Нужны припасы' })
  const current = choices.find(order => order.id === selected) ?? choices.find(order => order.group === 'ready') ?? choices[0]
  return { choices, selected: current?.id }
}

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))
export function renderMarketOrderPicker(board: ReturnType<typeof getMarketOrderBoard>, icon: (name: string) => string) {
  const groups = [['ready', 'Готовы к сдаче'], ['waiting', 'Нужно подготовить'], ['delivered', 'Сегодня доставлены'], ['harbor', 'Причал рощи']] as const
  return `<nav class="market-order-picker" aria-label="Выберите заказ">${groups.map(([group, title]) => {
    const choices = board.choices.filter(order => order.group === group)
    return choices.length ? `<section class="market-order-group" data-order-group="${group}"><h2>${title} <small>${choices.length}</small></h2>${choices.map(order =>
      `<button type="button" class="market-order-choice" data-action="market-order-select" data-value="${order.id}" aria-pressed="${order.id === board.selected}" aria-label="${escape(order.name)} · ${ruCount(order.reward, 'монета', 'монеты', 'монет')}${order.note ? ` · ${order.note}` : ''}"><span>${escape(order.name)}</span><strong>${icon('coin')}${order.reward}</strong>${order.note ? `<small>${order.note}</small>` : ''}</button>`).join('')}</section>` : ''
  }).join('')}</nav>`
}
