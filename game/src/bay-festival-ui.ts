import { getFestivalShoreRoute } from './festival-shore-route.ts';
import { getFestivalChoices, getFestivalStatus, type FarmState } from './farm.ts';
import { getFestivalHarvestRoute } from './festival-harvest-route.ts';
import { getFestivalFishingRoute } from './festival-fishing-route.ts';
import type { FestivalTradition } from './bay-festival.ts';
import { ruCount } from './ru.ts';
import './bay-festival.css';

export type FestivalViewOptions = {
  celebrated?: FestivalTradition;
  celebrationEffect?: string;
  celebrationCoins?: number;
  icon?: (name: string, className?: string) => string;
};
const escape = (value: string | number) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const artRoot = 'art/lavender/';
function asset(path: string): string { return `${import.meta.env.BASE_URL}${artRoot}${path}.webp`; }
function picture(tradition: FestivalTradition, className = ''): string {
  return `<div class="festival-picture ${className}" data-tradition="${tradition}" aria-hidden="true"><img class="festival-reward-art" src="${asset(`festivals/${tradition}`)}" alt="" draggable="false"></div>`;
}
function button(label: string, action: string, value = '', available = true, className = '', descriptionId = ''): string {
  return `<button type="button" class="dialog-button festival-button ${className}"${descriptionId ? ` aria-describedby="${escape(descriptionId)}"` : ''} data-action="${action}" data-value="${escape(value)}"${available ? '' : ' disabled'}>${label}</button>`;
}
const ingredientIcons: Record<string, string> = {
  carrot: 'carrot', cabbage: 'cabbage', beetroot: 'beetroot', tomato: 'tomato', pumpkin: 'pumpkin', wheat: 'wheat', leafyGreens: 'leafyGreens',
  apple: 'apple', pear: 'ui-pear', peach: 'ui-peach-fruit', strawberry: 'strawberry', blueberry: 'blueberry', raspberry: 'raspberry',
  honey: 'ui-honey', windHoney: 'ui-wind-honey', beeswax: 'ui-beeswax', seaSalt: 'ui-sea-salt', eggs: 'egg',
  perch: 'fish-perch', seaBass: 'fish-seaBass', moonfish: 'ui-moonfish', lanternfish: 'ui-lanternfish',
  round: 'ui-handmade-round', folded: 'ui-handmade-folded', long: 'ui-handmade-long',
  orchardTart: 'ui-tart', appleJam: 'ui-apple-jam', farmhouseBread: 'ui-farmhouse-bread', orchardPreserves: 'ui-orchard-preserves',
  honeyCake: 'ui-honey-cake', honeyBiscuits: 'ui-honey-biscuits', honeyPear: 'ui-honey-pear', windParfait: 'ui-wind-parfait',
  strawberryTart: 'ui-strawberry-tart', blueberryTart: 'ui-blueberry-tart', raspberryTart: 'ui-raspberry-tart', grilledFish: 'ui-grilled-fish',
};
function ingredientPicture(id: string, icon?: FestivalViewOptions['icon']): string {
  const name = ingredientIcons[id.split(':').at(-1)!];
  return name && icon ? icon(name, 'festival-ingredient-icon') : '';
}

/** Preview only the already chosen next step; availability is checked again when it opens. */
function nextPreparationPreview(active: NonNullable<ReturnType<typeof getFestivalStatus>['active']>): string {
  if (!active.waitingNight || active.stage >= 3 || !active.requirements.length) return '';
  return `<details class="festival-next-preview"><summary>Что подготовить к утру</summary>
    <p>Внести вклад можно с ${active.readyOn}-го игрового дня. Припасы не резервируются.</p>
    <p>Ниже — количество для всей оставшейся группы, если выбрать один вариант. Варианты можно сочетать.</p>
    <ul>${active.requirements.map(requirement => {
      const remaining = Math.max(0, requirement.quantity - requirement.delivered);
      return `<li><strong>${escape(requirement.label)} · ${ruCount(remaining, 'вклад', 'вклада', 'вкладов')}</strong>
        <p>${requirement.alternatives.map(alternative => `${escape(alternative.label)} <b>×${remaining * alternative.quantity}</b>`).join(' или ')}</p></li>`;
    }).join('')}</ul>
  </details>`;
}

export function renderFestivalPanel(farm: FarmState, options: FestivalViewOptions = {}): string {
  const choices = getFestivalChoices(farm), status = getFestivalStatus(farm), active = status.active;
  const celebrated = options.celebrated && choices.find(choice => choice.id === options.celebrated);
  if (celebrated) return `<section class="bay-festival festival-celebration" aria-labelledby="festival-celebration-title">
    ${picture(celebrated.id, 'festival-celebration-picture')}
    <div class="festival-celebration-copy" role="status"><span class="festival-seal" aria-hidden="true">✓</span><h2 id="festival-celebration-title">${escape({ harvest: 'Праздник урожая состоялся', lights: 'Огни причала зажглись', stage: 'Садовая сцена открыта' }[celebrated.id])}</h2>
    <strong class="festival-effect">${escape(options.celebrationEffect ?? celebrated.effect)}</strong>${options.celebrationCoins !== undefined ? `<p class="festival-payout" aria-label="${escape(ruCount(options.celebrationCoins, 'монета', 'монеты', 'монет'))}">${options.icon ? options.icon('coin') : `<img class="icon" src="${import.meta.env.BASE_URL}art/icons/coin.webp" alt="">`}<strong>${options.celebrationCoins}</strong></p>` : ''}</div>
    <div class="festival-celebration-actions">${button('В гавань', 'close')}${button('К традициям', 'festival-continue', '', true, 'festival-secondary')}</div>
  </section>`;
  if (!active) return `<section class="bay-festival" aria-label="Традиции гавани">
    ${farm.village.meals < 1 ? `<div class="festival-unlock"><p>${farm.village.built ? 'Начнём традиции после первого общего ужина.' : 'Общие праздники появятся в Лавандовой гавани.'}</p>${button(farm.village.built ? 'К общему ужину' : 'Открыть гавань', farm.village.built ? 'festival-meal' : 'festival-village')}</div>` : ''}
    <div class="festival-choices">${choices.map(choice => `<article class="festival-choice" data-completed="${choice.completed > 0}">
      ${picture(choice.id)}
      <div class="festival-choice-copy"><h2>${escape(choice.name)}</h2><p class="festival-effect">${escape(choice.effect)}</p>
      ${choice.completed > 0 ? `<small class="festival-history">✓ Отмечено: ${choice.completed}</small>` : ''}</div>
      ${button(choice.completed > 0 ? `Выбрать выпуск ${choice.completed + 1}` : 'Выбрать программу', 'festival-begin', choice.id, choice.available)}
    </article>`).join('')}</div>
  </section>`;
  const choice = choices.find(item => item.id === active.tradition)!;
  const stageNumber = Math.min(3, active.stage + 1), finale = active.stage >= 3;
  const requirements = active.requirements.map(requirement => {
    const remaining = Math.max(0, requirement.quantity - requirement.delivered), done = remaining === 0;
    const activityLabels: Record<string, string> = { harvest: 'Собрать урожай', bake: 'Приготовить угощение', fish: 'Отправиться на рыбалку', shore: 'Поискать на берегу' };
    const contribution = (alternative: typeof requirement.alternatives[number]): string => {
      if (alternative.available === 0) {
        if (alternative.id === 'concert') return button('Сыграть в саду', 'festival-music', '', !active.waitingNight, 'festival-contribution');
        if (alternative.id === 'delivery') return button('Отправить паром', 'festival-freight', '', !active.waitingNight, 'festival-contribution');
        if (alternative.id === 'harvest') {
          const route = getFestivalHarvestRoute(farm);
          return button(route?.label ?? activityLabels.harvest, 'festival-activity', 'harvest', !!route, 'festival-contribution');
        }
        if (alternative.id === 'shore') {
          const route = getFestivalShoreRoute(farm);
          return button(route?.label ?? activityLabels.shore, 'festival-activity', 'shore', !!route, 'festival-contribution')
            + (route?.panel === 'rest' ? '<p class="festival-note">Доступные ракушки и находки отмели сегодня собраны. Дома можно отдельно отдохнуть до следующего игрового дня.</p>' : '');
        }
        if (alternative.id === 'fish') {
          const route = getFestivalFishingRoute(farm);
          return button(route?.label ?? activityLabels.fish, 'festival-activity', 'fish', !!route, 'festival-contribution')
            + (route?.panel === 'rest' ? '<p class="festival-note">На доступных берегах сегодняшняя квота исчерпана. Дома можно отдельно отдохнуть до следующего игрового дня.</p>' : '');
        }
        if (activityLabels[alternative.id]) return button(activityLabels[alternative.id], 'festival-activity', alternative.id, !active.waitingNight, 'festival-contribution');
      }
      return button(`${ingredientPicture(alternative.id, options.icon)}<span>${escape(alternative.label)} <b>×${alternative.quantity}</b>${alternative.available === 0 ? '<small>Где найти</small>' : ''}</span>`,
        alternative.available > 0 ? 'festival-contribute' : 'festival-source', `${requirement.id}|${alternative.id}`,
        !active.waitingNight && (alternative.available === 0 || active.canContribute), 'festival-contribution');
    };
    const alternatives = requirement.alternatives.map(contribution);
    return `<li class="festival-requirement" data-complete="${done}"><div class="festival-requirement-heading"><strong>${escape(requirement.label)}</strong><span>${done ? '✓ ' : ''}${requirement.delivered}/${requirement.quantity}</span></div>
      ${done ? '' : `<div class="festival-contributions" aria-label="Выберите вклад: ${escape(requirement.label)}">${alternatives.slice(0, 4).join('')}</div>${alternatives.length > 4 ? `<details class="festival-alternatives"><summary>Другие угощения (${alternatives.length - 4})</summary><div class="festival-contributions">${alternatives.slice(4).join('')}</div></details>` : ''}<small class="festival-remaining">Осталось: ${remaining}</small>`}
    </li>`;
  }).join('');
  return `<section class="bay-festival festival-active" aria-label="${escape(active.name)}">
    <header class="festival-active-heading">${picture(active.tradition)}<div><small>Выбранная программа · выпуск ${active.edition} · ${escape(active.editionName)}</small><h2>${escape(active.name)}</h2><p class="festival-effect">${escape(choice.effect)}</p></div></header>
    <div class="festival-selection"><p class="festival-note" id="festival-cancel-reason">${escape(active.canCancel ? 'Пока вы не внесли припасы и не участвовали в делах бухты, выбор можно отменить.' : active.cancelReason)}</p>
      ${button('Отменить выбор', 'festival-cancel', active.tradition, active.canCancel, 'festival-secondary', 'festival-cancel-reason')}</div>
    <ol class="festival-stages" aria-label="Подготовка праздника">${['1', '2', '3', 'Праздник'].map((label, index) => `<li data-complete="${index < active.stage}"${index === active.stage ? ' aria-current="step"' : ''}><span>${index < active.stage ? '✓' : label}</span></li>`).join('')}</ol>
    <div class="festival-stage-heading"><span>${finale ? 'Всё готово к встрече' : `Подготовка ${stageNumber}/3`}</span><h3>${escape(active.label)}</h3><p>${escape(active.detail)}</p></div>
    ${requirements && !active.waitingNight ? `<ul class="festival-requirements">${requirements}</ul>` : nextPreparationPreview(active)}
    <p class="festival-return">Припасы: ${active.materialValue} + организация: ${ruCount(active.honorarium, 'монета', 'монеты', 'монет')}</p>
    ${active.waitingNight ? `<div class="festival-night"><p class="festival-wait" role="status"><span aria-hidden="true">☾</span><span>На сегодня всё<small>Утро ${active.readyOn}-го дня</small></span></p>${button('Отдохнуть дома', 'festival-rest', '', true, 'festival-secondary')}</div>` : finale ? button('Провести праздник', 'festival-finish', '', active.canFinish) : active.requirements.every(item => item.delivered >= item.quantity) ? button('Собрать подготовку', 'festival-contribute', '', active.canContribute) : ''}
  </section>`;
}
