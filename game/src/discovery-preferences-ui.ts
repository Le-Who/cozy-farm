import type { DiscoveryTask } from './discovery-path.ts';
import type { DiscoveryPreferences } from './discovery-preferences.ts';
import { ruCount } from './ru.ts';

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]!);
function button(label: string, action: string, value = '', secondary = false): string {
  return `<button type="button" class="dialog-button${secondary ? ' secondary' : ''}" data-action="${action}" data-value="${escape(value)}">${escape(label)}</button>`;
}
type JournalGoal = Pick<DiscoveryTask, 'label' | 'detail' | 'progress' | 'target' | 'reward'> & {
  id?: string; action?: Pick<DiscoveryTask['action'], 'label'>;
};
function progress(goal: JournalGoal): string {
  return goal.target > 1 || goal.reward !== undefined
    ? `<small>${goal.progress}/${goal.target}${goal.reward === undefined ? '' : ` · Награда: ${ruCount(goal.reward, 'монета', 'монеты', 'монет')}`}</small>` : '';
}

/** Keep the selected/current action ahead of context without repeating it as a suggestion. */
export function renderDiscoveryGuidance(preferences: DiscoveryPreferences, suggested?: DiscoveryTask, goal?: JournalGoal): { focus: string; settings: string } {
  const idea = preferences.idea;
  const current = idea && suggested?.id === idea.id ? suggested : undefined;
  const chosen = current ?? idea;
  const active = preferences.quiet ? undefined : goal;
  const pinId = !idea && active && suggested && active.id === suggested.id ? suggested.id : undefined;
  const focus = chosen ? `<section class="discovery-now" aria-label="Выбранная задумка"><small>Выбранная задумка${preferences.quiet ? ' · сохранена' : ''}</small><h3>${escape(chosen.label)}</h3><p>${escape(chosen.detail)}</p>
      ${current ? progress(current) : '<p class="discovery-bookmark-note">Это сохранённая запись. Доступные дела могли измениться.</p>'}
      <div class="dialog-grid dialog-nav">${preferences.quiet ? button('Вернуться к задумке', 'discovery-resume') : current ? button(current.action.label, 'follow-task') : button('Доступные дела', 'open-panel', 'guide')}${button('Снять выбор', 'discovery-forget', '', true)}</div></section>`
    : active ? `<section class="discovery-now" aria-label="Ближайший шаг"><h3>${escape(active.label)}</h3><p>${escape(active.detail)}</p>${progress(active)}
      ${active.action || pinId ? `<div class="dialog-grid dialog-nav">${active.action ? button(active.action.label, 'follow-task') : ''}${pinId ? button('Выбрать задумку', 'discovery-pin', pinId, true) : ''}</div>` : ''}</section>` : '';
  const settings = `<section class="discovery-preferences" aria-label="Подсказки и своя задумка">
    <h3>${preferences.quiet ? 'В своём ритме' : 'Подсказки и своя задумка'}</h3>
    <p>${preferences.quiet ? 'Подсказки на острове скрыты. Открытые занятия и выбранная задумка остаются доступны.' : 'Можно убрать подсказки с острова и вернуться к выбранной задумке позже.'}</p>
    <div class="dialog-grid dialog-nav">${button(preferences.quiet ? 'Показать подсказки' : 'В своём ритме', 'discovery-pace', preferences.quiet ? 'guided' : 'quiet', true)}</div>
    ${suggested && suggested.id !== idea?.id && !pinId ? `<div class="discovery-choice"><small>Предложенная задумка</small><strong>${escape(suggested.label)}</strong>${button('Выбрать задумку', 'discovery-pin', suggested.id, true)}</div>` : ''}
  </section>`;
  return { focus, settings };
}
