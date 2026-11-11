import { getCommunityOrders, type FarmState } from './farm.ts'

type Selection = { kind: 'intent'; orderId: string } | { kind: 'neighbor' } | undefined
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))

/** Only the selected, unfinished daily fair request expires with the next morning. */
export function selectedDailyIntent(farm: FarmState, selection: Selection) {
  return selection?.kind === 'intent'
    ? getCommunityOrders(farm).find(order => order.id === selection.orderId && order.unlocked && !order.delivered)
    : undefined
}

export function renderIntentDeadline(farm: FarmState): string {
  return `<p class="community-deadline">Просьбы на игровой день ${farm.day}. После «До утра» они сменятся. Блюда в сумке останутся.</p>`
}

export function renderSelectedIntentRest(farm: FarmState, selection: Selection): string {
  const order = selectedDailyIntent(farm, selection)
  if (!order) return ''
  return `<aside class="community-help intent-rest" aria-label="Выбранная просьба перед отдыхом"><strong>Ещё не выполнено: «${escape(order.title)}»</strong>
    <p>После «До утра» эта просьба сменится. Можно вернуться к ней сейчас или отдохнуть и выбрать новую утром. Блюда в сумке останутся.</p>
    <button type="button" class="dialog-button secondary" data-action="rest-intent-request" data-value="${escape(order.id)}">К выбранной просьбе</button></aside>`
}

export function canReturnToDailyIntent(farm: FarmState, selection: Selection, expectedId: string | undefined, context: { panel: string | undefined; open: boolean }): boolean {
  return context.open && context.panel === 'rest' && farm.island === 'home'
    && !!expectedId && selectedDailyIntent(farm, selection)?.id === expectedId
}
