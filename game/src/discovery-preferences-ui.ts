import type { DiscoveryTask } from './discovery-path.ts';
import type { DiscoveryPreferences } from './discovery-preferences.ts';

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]!);
function button(label: string, action: string, value = ''): string {
  return `<button type="button" class="dialog-button" data-action="${action}" data-value="${escape(value)}">${label}</button>`;
}
export function renderDiscoveryPreferences(preferences: DiscoveryPreferences, suggested?: DiscoveryTask): string {
  const idea = preferences.idea;
  const current = idea && suggested?.id === idea.id ? suggested : undefined;
  const chosen = current ?? idea;
  return `<section class="discovery-preferences" aria-label="Подсказки и своя задумка">
    <h3>${preferences.quiet ? 'В своём ритме' : 'Подсказки и своя задумка'}</h3>
    <p>${preferences.quiet ? 'Подсказки на острове скрыты. Открытые занятия и выбранная задумка остаются доступны.' : 'Можно убрать подсказки с острова и вернуться к выбранной задумке позже.'}</p>
    <div class="dialog-grid dialog-nav">${button(preferences.quiet ? 'Показать подсказки' : 'В своём ритме', 'discovery-pace', preferences.quiet ? 'guided' : 'quiet')}</div>
    ${chosen ? `<article class="discovery-bookmark"><small>Выбранная задумка${preferences.quiet ? ' · сохранена' : ''}</small><h4>${escape(chosen.label)}</h4><p>${escape(chosen.detail)}</p>
      ${!current ? '<p class="discovery-bookmark-note">Это сохранённая запись. Доступные дела могли измениться.</p>' : ''}
      <div class="dialog-grid dialog-nav">${preferences.quiet ? button('Вернуться к задумке', 'discovery-resume') : current ? button(current.action.label, 'follow-task') : button('Доступные дела', 'open-panel', 'guide')}${button('Снять выбор', 'discovery-forget')}</div></article>` : ''}
    ${suggested && suggested.id !== idea?.id ? `<div class="discovery-choice"><small>Предложенная задумка</small><strong>${escape(suggested.label)}</strong>${button('Выбрать задумку', 'discovery-pin', suggested.id)}</div>` : ''}
  </section>`;
}
