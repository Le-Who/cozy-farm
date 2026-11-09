import { getCommunityOrders, getIntentOffers, getNeighborPlans, type FarmState, type ResidentId } from './farm';
import { qualityNames, type IntentId } from './intent-orders';
import './community-ui.css';

type Offer = ReturnType<typeof getIntentOffers>[number];
export type CommunityArt = { icon(name: string, className?: string): string; offerIcon(offer: Offer): string };
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
const control = (label: string, action: string, value = '', extra = '', secondary = false) => `<button type="button" class="dialog-button community-button${secondary ? ' secondary' : ''}" data-action="${action}" data-value="${escape(value)}" ${extra}>${label}</button>`;
const chips = (values: readonly string[]) => `<span class="community-chips" aria-label="Два условия угощения">${values.map(value => `<span>${escape(value)}</span>`).join('')}</span>`;
const prop = (kind: 'table' | 'basket', className = '') => `<span class="community-prop ${className}" data-prop="${kind}" aria-hidden="true"></span>`;
const motif: Record<IntentId, { kind: 'table' | 'basket'; icon: string }> = {
  berry: { kind: 'table', icon: 'strawberry' }, fruit: { kind: 'basket', icon: 'apple' },
  delicate: { kind: 'table', icon: 'ui-signature-silky' }, hearty: { kind: 'basket', icon: 'ui-farmhouse-bread' },
  portable: { kind: 'basket', icon: 'ui-farmhouse-bread' }, sharing: { kind: 'table', icon: 'ui-honey-cake' },
};
const purpose = {
  beaTea: 'Устроим чаепитие с нежным сладким угощением?',
  beaBasket: 'Возьмём сытную выпечку на прогулку вдоль берега?',
  finnShore: 'Пообедаем у воды — хочется сытного и несладкого.',
  finnLantern: 'Соберём соседей под фонариками и поделимся сладким?',
} as const;
const phaseLabels = { preparing: 'Готовится к встрече', joined: 'Выберите угощение', arranging: 'Всё для встречи', celebrating: 'Хорошо вместе', remembered: 'Тёплое воспоминание' } as const;

function offerChoices(offers: Offer[], art: CommunityArt, context: { kind: 'intent'; id: string } | { kind: 'neighbor'; id: string }): string {
  const choices = offers.filter(offer => offer.eligible).sort((left, right) => Number(right.available) - Number(left.available) || Number(right.available && right.source === 'signature') - Number(left.available && left.source === 'signature') || Number(right.canCook) - Number(left.canCook));
  const otherRecipes = offers.filter(o => o.source === 'signature' && o.count > 0 && !o.eligible)
  const other = otherRecipes.length ? `<details class="community-alternatives"><summary>Остальные мои блюда · ${otherRecipes.length}</summary>${otherRecipes.map(o => {
    const missing = o.requiredQualities.filter(q => !o.qualities.includes(q)).map(q => qualityNames[q]).join(', ')
    return `<p><strong>${escape(o.name)}</strong> · Нужно: ${escape(missing)}</p>`
  }).join('')}</details>` : ''
  return `<div class="community-foods" aria-label="Подходящие угощения">${choices.map(offer => {
    const action = offer.available ? context.kind === 'intent' ? 'deliver-intent' : 'choose-neighbor-food' : 'cook-intent-offer';
    const label = offer.available ? context.kind === 'intent' ? `Передать · ${offer.reward}` : 'Взять на встречу' : offer.canCook ? 'Приготовить' : 'К рецепту';
    const attributes = context.kind === 'intent' ? `data-order="${escape(context.id)}"` : `data-plan="${escape(context.id)}"`;
    return `<button type="button" class="community-food" data-action="${action}" data-value="${escape(offer.id)}" ${attributes} data-stock="${offer.count > 0}" data-ready="${offer.available}" aria-label="${escape(offer.name)}. В запасе: ${offer.count}. ${label}${offer.available && context.kind === 'intent' ? ' монет' : ''}">
      <span class="community-food-picture" aria-hidden="true">${art.offerIcon(offer)}</span><span class="community-food-count" aria-label="В запасе">×${offer.count}</span>
      <strong>${escape(offer.name)}</strong><span class="community-food-action">${label}${offer.available && context.kind === 'intent' ? '<span class="community-coin" aria-label="монет">●</span>' : ''}</span>
    </button>`;
  }).join('')}</div>${other}${offers.some(offer=>offer.requiredQualities.includes('savoury')) ? '' : control(`${art.icon('ui-signature-bright')}Свой рецепт`, 'intent-own-recipe', '', '', true)}`;
}

export function communityBoard(farm: FarmState, art: CommunityArt): string {
  const orders = getCommunityOrders(farm);
  return `<section class="community-board community-root" aria-label="Просьбы соседей"><div class="community-occasions">${orders.map(order => {
    const picture = motif[order.intentId];
    return `<button type="button" class="community-occasion" data-action="open-intent" data-value="${escape(order.id)}" data-complete="${order.delivered}" aria-label="${escape(order.title)}${order.delivered ? '. Выполнено' : ''}">
      <span class="community-occasion-picture">${prop(picture.kind)}${art.icon(picture.icon, 'community-occasion-ingredient')}</span>
      <span class="community-occasion-copy"><strong>${escape(order.title)}</strong>${chips(order.chips)}<span class="community-occasion-status">${order.delivered ? 'Спасибо за угощение!' : order.unlocked ? 'Выбрать угощение' : 'После открытия ярмарки'}</span></span>
      ${order.delivered ? '<span class="community-complete" aria-label="Выполнено">✓</span>' : ''}
    </button>`;
  }).join('')}</div></section>`;
}

export function communityIntent(farm: FarmState, orderId: string, art: CommunityArt): string {
  const order = getCommunityOrders(farm).find(order => order.id === orderId);
  if (!order) return '<p class="community-note">На ярмарке появились новые просьбы.</p>';
  const picture = motif[order.intentId];
  return `<section class="community-intent community-root" aria-label="${escape(order.title)}"><header class="community-brief">${prop(picture.kind)}<div><h2>${escape(order.title)}</h2>${chips(order.chips)}</div></header>
    ${order.delivered ? `<div class="community-thanks"><span aria-hidden="true">✓</span><p>Спасибо за угощение!</p><small>Новые просьбы — завтра.</small></div>`
      : !order.unlocked ? '<p class="community-note">Сначала откройте ярмарку в проектах Родного острова.</p>'
      : `${offerChoices(order.offers, art, { kind: 'intent', id: order.id })}<p class="community-reward">Стоимость блюда + ${order.rewardBonus} монет за помощь</p>`}</section>`;
}

export function neighborDetail(farm: FarmState, resident: ResidentId, art: CommunityArt): string {
  const plan = getNeighborPlans(farm).find(plan => plan.resident === resident);
  if (!plan) return `<div class="community-empty community-root">${art.icon(`ui-${resident}`)}<p>Пригласите ${resident === 'bea' ? 'Беа' : 'Финна'} в домик Лавандовой гавани.</p></div>`;
  const active = plan.phase === 'preparing' || plan.phase === 'joined' || plan.phase === 'arranging';
  const memory = plan.memory ? `<aside class="community-memory">${art.icon(`ui-${resident}`)}<p>${active ? 'Помню наше угощение:' : 'Угощение той встречи:'} «${escape(plan.memory.foodName)}».</p></aside>` : '';
  const header = `<header class="community-brief"><span class="community-portrait">${art.icon(`ui-${resident}`)}</span><div><h2>${escape(plan.title)}</h2>${active ? chips(plan.chips) : `<p class="community-phase">${phaseLabels[plan.phase]}</p>`}</div></header>`;
  let content: string;
  switch (plan.phase) {
    case 'preparing':
      content = `<p class="community-invitation">${purpose[plan.episode]}</p>${prop(plan.arrangement, 'community-preparation')}${control('Присоединиться', 'join-neighbor', plan.id)}`;
      break;
    case 'joined':
      content = offerChoices(getIntentOffers(farm, plan.intentId), art, { kind: 'neighbor', id: plan.id });
      break;
    case 'arranging': {
      const offer = getIntentOffers(farm, plan.intentId).find(offer => offer.id === plan.food?.id);
      content = `<div class="community-selected"><span class="community-selected-picture">${offer ? art.offerIcon(offer) : prop(plan.arrangement)}</span><strong>${escape(plan.food!.name)}</strong>${control(plan.arrangement === 'table' ? 'Накрыть стол' : 'Собрать корзинку', 'arrange-neighbor', plan.id)}</div>
        <details class="community-alternatives"><summary>Выбрать другое угощение</summary>${offerChoices(getIntentOffers(farm, plan.intentId), art, { kind: 'neighbor', id: plan.id })}</details>`;
      break;
    }
    case 'celebrating':
      content = `${prop(plan.arrangement, 'community-celebration')}<p class="community-invitation">${resident === 'bea' ? 'Как же уютно получилось!' : 'Вот ради таких вечеров и стоит собираться.'}</p>${control('До новой встречи', 'ack-neighbor', plan.id)}`;
      break;
    case 'remembered':
      content = `${prop(plan.arrangement, 'community-celebration')}${farm.day >= plan.nextAvailableOn ? control('Узнать новую затею', 'ack-neighbor', plan.id) : '<p class="community-note">Новая затея — завтра.</p>'}`;
      break;
  }
  return `<section class="community-neighbor community-root" data-phase="${plan.phase}" aria-label="${escape(plan.title)}">${header}${content}${memory}</section>`;
}

export function neighborPlanLinks(farm: FarmState, art: CommunityArt): string {
  const plans = getNeighborPlans(farm);
  if (!plans.length) return '';
  return `<div class="community-neighbor-links community-root">${plans.map(plan => `<button type="button" class="community-neighbor-link" data-action="open-neighbor" data-value="${plan.resident}"><span class="community-link-portrait">${art.icon(`ui-${plan.resident}`)}</span><span><strong>${escape(plan.title)}</strong><small>${phaseLabels[plan.phase]}</small></span>${prop(plan.arrangement)}</button>`).join('')}</div>`;
}
