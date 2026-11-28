import { freightPortNames } from './bay-freight-model';
import { storedSignatureValue } from './stored-signature';
import { renderIntentDeadline } from './intent-deadline';
import { getJoinedNeighborDishSupply, getNeighborFoodRecovery } from './neighbor-food-recovery';
import { neighborHelpStatus } from './neighbor-help';
import { canSailTo, getCommunityOrders, getIntentOffers, getNeighborPlans, type FarmState, type ResidentId } from './farm';
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

export function neighborHelpCard(farm: FarmState, resident: ResidentId, link = false): string {
  const help = neighborHelpStatus(farm, resident);
  if (!help) return '';
  return `<aside class="community-help" aria-label="${help.title}"><strong>${help.title}</strong><p>${help.detail}</p><p>${help.next}</p>${link ? control(`К помощи ${resident === 'bea' ? 'Беа' : 'Финна'}`, 'neighbor-help-house', resident, '', true) : ''}</aside>`;
}

function offerChoices(offers: Offer[], art: CommunityArt, context: { kind: 'intent'; id: string } | { kind: 'neighbor'; id: string },
  fundedCape?: ReadonlySet<Offer['id']>, storedDish?: (id: Offer['id']) => ReturnType<typeof getJoinedNeighborDishSupply>): string {
  const local = storedDish && new Map(offers.filter(offer=>offer.eligible && !offer.available).map(offer=>[offer.id,storedDish(offer.id)]))
  const choices = offers.filter(offer => offer.eligible).sort((left, right) =>
    Number(right.available) - Number(left.available)
    || Number(right.available && right.source === 'signature') - Number(left.available && left.source === 'signature')
    || Number(!!local?.get(right.id)) - Number(!!local?.get(left.id))
    || Number(right.canCook) - Number(left.canCook)
    || Number(!!fundedCape?.has(right.id)) - Number(!!fundedCape?.has(left.id)));
  const otherRecipes = offers.filter(o => o.source === 'signature' && o.count > 0 && !o.eligible)
  const other = otherRecipes.length ? `<details class="community-alternatives"><summary>Остальные мои блюда · ${otherRecipes.length}</summary>${otherRecipes.map(o => {
    const missing = o.requiredQualities.filter(q => !o.qualities.includes(q)).map(q => qualityNames[q]).join(', ')
    return `<p><strong>${escape(o.name)}</strong> · Нужно: ${escape(missing)}</p>`
  }).join('')}</details>` : ''
  return `<div class="community-foods" aria-label="Подходящие угощения">${choices.map(offer => {
    const storage = local?.get(offer.id)
    const action = storage ? 'neighbor-joined-warehouse' : offer.available ? context.kind === 'intent' ? 'deliver-intent' : 'choose-neighbor-food' : 'cook-intent-offer';
    const label = storage ? 'К складу' : offer.available ? context.kind === 'intent' ? `Передать · ${offer.reward}` : 'Взять на встречу' : offer.canCook ? 'Приготовить' : 'К рецепту';
    const attributes = context.kind === 'intent' ? `data-order="${escape(context.id)}"` : `data-plan="${escape(context.id)}"${storage?` data-storage="${escape(storage.token)}"`:''}`;
    const count = storage?.stored ?? offer.count, source = storage ? 'На складе' : 'В запасе'
    return `<button type="button" class="community-food" data-action="${action}" data-value="${escape(offer.id)}" ${attributes} data-stock="${count > 0}" data-ready="${offer.available || !!storage}" aria-label="${escape(offer.name)}. ${source}: ${count}. ${label}${offer.available && context.kind === 'intent' ? ' монет' : ''}">
      <span class="community-food-picture" aria-hidden="true">${art.offerIcon(offer)}</span><span class="community-food-count" aria-label="${source}">×${count}</span>
      <strong>${escape(offer.name)}</strong><span class="community-food-action">${label}${offer.available && context.kind === 'intent' ? '<span class="community-coin" aria-label="монет">●</span>' : ''}</span>
    </button>`;
  }).join('')}</div>${other}${offers.some(offer=>offer.requiredQualities.includes('savoury')) ? '' : control(`${art.icon('ui-signature-bright')}Свой рецепт`, 'intent-own-recipe', '', '', true)}`;
}

export function communityBoard(farm: FarmState, art: CommunityArt): string {
  const orders = getCommunityOrders(farm);
  return `<section class="community-board community-root" aria-label="Просьбы соседей">${orders.some(order => order.unlocked) ? renderIntentDeadline(farm) : ''}<div class="community-occasions">${orders.map(order => {
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
      : `${renderIntentDeadline(farm)}${offerChoices(order.offers, art, { kind: 'intent', id: order.id })}<p class="community-reward">Стоимость блюда + ${order.rewardBonus} монет за помощь</p>`}</section>`;
}

export function neighborDetail(farm: FarmState, resident: ResidentId, art: CommunityArt): string {
  const plan = getNeighborPlans(farm).find(plan => plan.resident === resident);
  if (!plan) return `<div class="community-empty community-root">${art.icon(`ui-${resident}`)}<p>Пригласите ${resident === 'bea' ? 'Беа' : 'Финна'} в домик Лавандовой гавани.</p></div>`;
  const active = plan.phase === 'preparing' || plan.phase === 'joined' || plan.phase === 'arranging';
  const memory = plan.memory ? `<aside class="community-memory">${art.icon(`ui-${resident}`)}<p>${active ? 'Помню наше угощение:' : 'Угощение той встречи:'} «${escape(plan.memory.foodName)}».</p></aside>` : '';
  const header = `<header class="community-brief"><span class="community-portrait">${art.icon(`ui-${resident}`)}</span><div><h2>${escape(plan.title)}</h2>${active ? chips(plan.chips) : `<p class="community-phase">${phaseLabels[plan.phase]}</p>`}</div></header>`;
  const choices = () => {
    // Funded travel is a useful alternative, not a finished dish or local cooking.
    const fundedCape = farm.island === 'village' && farm.capeLevel === 3 && canSailTo(farm, 'cape')
      ? new Set(getIntentOffers({ ...farm, island: 'cape' }, plan.intentId)
        .filter(offer => offer.source === 'dish' && offer.eligible && !offer.available && offer.canCook).map(offer => offer.id))
      : undefined;
    const storedDish = plan.phase === 'joined' && farm.island === 'village'
      ? (id: Offer['id']) => farm.freight.warehouses.village[id] > 0 ? getJoinedNeighborDishSupply(farm,plan.id,id) : undefined
      : undefined
    return offerChoices(getIntentOffers(farm, plan.intentId), art, { kind: 'neighbor', id: plan.id }, fundedCape, storedDish);
  };
  let content: string;
  switch (plan.phase) {
    case 'preparing':
      content = `<p class="community-invitation">${purpose[plan.episode]}</p>${prop(plan.arrangement, 'community-preparation')}${control('Присоединиться', 'join-neighbor', plan.id)}`;
      break;
    case 'joined':
      content = choices();
      break;
    case 'arranging': {
      const offer = getIntentOffers(farm, plan.intentId).find(offer => offer.id === plan.food?.id);
      const recovery = getNeighborFoodRecovery(farm, plan.id)!;
      const ready = recovery.state === 'ready';
      const remote = recovery.remoteSignature ?? recovery.remoteStock;
      const storage = recovery.remoteSignature ? storedSignatureValue(recovery.remoteSignature) : recovery.remoteStock?.token;
      const stored = remote && storage && offer
        ? control(`К складу: ${freightPortNames[remote.port]}`, 'neighbor-stored-food', plan.id, `data-food="${escape(offer.id)}" data-storage="${escape(storage)}"`) : '';
      const repair = recovery.warehouse && offer ? control('К готовой порции на складе', 'neighbor-stored-food', plan.id, `data-food="${escape(offer.id)}"`)
        : recovery.shelved && offer ? control('В лавку за угощением', 'neighbor-shelf-food', plan.id, `data-food="${escape(offer.id)}"`)
        : recovery.state === 'spent' && offer ? offer.source === 'signature' && offer.canCook
        ? control('Повторить точно ×1', 'neighbor-repeat-food', plan.id, '', !!remote)
        : control(offer.canCook ? 'Приготовить ещё' : 'К рецепту', 'cook-intent-offer', offer.id, `data-plan="${escape(plan.id)}"`, !!remote) : '';
      const arrangeLabel = plan.episode === 'beaTea' ? 'Накрыть стол к чаю'
        : plan.episode === 'finnLantern' ? 'К столу у фонариков'
        : plan.arrangement === 'table' ? 'Накрыть стол' : 'Собрать корзинку';
      content = `<div class="community-selected"><span class="community-selected-picture">${offer ? art.offerIcon(offer) : prop(plan.arrangement)}</span><strong>${escape(plan.food!.name)}</strong>${ready ? control(arrangeLabel, 'arrange-neighbor', plan.id) : `${recovery.message ? `<p class="community-note" role="status">${recovery.message}</p>` : ''}${stored}${repair}`}</div>
        <details class="community-alternatives" ${!ready && !recovery.warehouse && !recovery.shelved && !remote ? 'open' : ''}><summary>Выбрать другое угощение</summary>${choices()}</details>`;
      break;
    }
    case 'celebrating':
      content = `${prop(plan.arrangement, 'community-celebration')}<p class="community-invitation">${resident === 'bea' ? 'Как же уютно получилось!' : 'Вот ради таких вечеров и стоит собираться.'}</p>${control('До новой встречи', 'ack-neighbor', plan.id)}`;
      break;
    case 'remembered':
      content = `${prop(plan.arrangement, 'community-celebration')}${farm.day >= plan.nextAvailableOn ? control('Узнать новую затею', 'ack-neighbor', plan.id) : '<p class="community-note">Новая затея — завтра.</p>'}`;
      break;
  }
  return `<section class="community-neighbor community-root" data-phase="${plan.phase}" aria-label="${escape(plan.title)}">${header}${content}${neighborHelpCard(farm, resident, true)}${memory}</section>`;
}

export function neighborPlanLinks(farm: FarmState, art: CommunityArt): string {
  const plans = getNeighborPlans(farm);
  if (!plans.length) return '';
  return `<div class="community-neighbor-links community-root">${plans.map(plan => `<button type="button" class="community-neighbor-link" data-action="open-neighbor" data-value="${plan.resident}"><span class="community-link-portrait">${art.icon(`ui-${plan.resident}`)}</span><span><strong>${escape(plan.title)}</strong><small>${phaseLabels[plan.phase]}</small></span>${prop(plan.arrangement)}</button>`).join('')}</div>`;
}
