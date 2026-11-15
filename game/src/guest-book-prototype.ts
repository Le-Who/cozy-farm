import type { FarmState } from './farm.ts'
import { GuestBookView, type GuestBookCommand } from './guest-book-view.ts'
import { visitActivities, visitActivityIds, visitName } from './neighbor-visits.ts'

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
const choice = (part: string, value: string, label: string, selected?: boolean) => `<button type="button" class="dialog-button secondary" data-guest-choice="${part}" data-value="${value}"${selected === undefined ? '' : ` aria-pressed="${selected}"`}>${escape(label)}</button>`
const command = (item: GuestBookCommand) => `<button type="button" class="dialog-button${item.action === 'visit-invite' ? '' : ' secondary'}" data-guest-command="${item.action}" data-value="${escape(item.value)}" data-context="${escape(item.context)}"${item.enabled ? '' : ' disabled'}>${escape(item.label)}</button>`

/** Semantic review only. No production import, event listener, focus/scroll action or stylesheet. */
export function renderGuestBookPrototype(farm: FarmState, view: GuestBookView, icon: (key: string) => string): string {
  const screen = view.current(farm), selection = view.snapshot(), activity = visitActivities[screen.activity]
  let body = ''
  if (screen.kind === 'invitation') {
    body = `<nav aria-label="Кого пригласить">${(['bea', 'finn'] as const).map(resident => choice('resident', resident, visitName(resident), selection.resident === resident)).join('')}</nav>
      <label for="guest-book-activity">Чем займёмся</label><select id="guest-book-activity" data-guest-choice="activity">${visitActivityIds.filter(id => visitActivities[id].resident === screen.resident).map(id => `<option value="${id}"${id === screen.activity ? ' selected' : ''}>${escape(visitActivities[id].title)}</option>`).join('')}</select>
      <article aria-label="Выбранная встреча"><header>${icon(`ui-${screen.resident}`)}<h2>${visitName(screen.resident)} · ${escape(activity.title)}</h2></header>
      <p>${escape(activity.goal)}</p><p>${escape(screen.readiness!)}</p>${screen.gate ? `<p class="dialog-status">${escape(screen.gate)}</p>` : ''}
      ${screen.commands.map(command).join('')}<p class="home-visit-note">Бесплатно. Один гость; уйдёт после отдыха или поездки.</p><p>${escape(activity.invitation)}</p></article>`
  } else if (screen.kind === 'active') {
    const active = screen.active!
    const content = active.observation
      ? `<p>${escape(activity.memory)}</p><aside class="home-visit-memory"><strong>${escape(active.observation.subject)}</strong><p>${escape(active.observation.detail)}</p><small>Момент уже сохранён. Урожай, выпечка и припасы остались у вас.</small></aside><p>О чём поговорим перед уходом?</p>`
      : `<p>${escape(activity.invitation)}</p><p><strong>${escape(activity.goal)}</strong></p><p>${escape(screen.readiness!)}</p>`
    body = `<article class="home-visit-active" aria-label="Гость на ферме"><header>${icon(`ui-${screen.resident}`)}<div><small>Сегодня в гостях</small><h2>${visitName(screen.resident)} · ${escape(activity.title)}</h2></div></header>${content}
      ${screen.commands.map(item => command(item) + (item.action === 'visit-reply' ? `<p>${escape(item.value.endsWith(':quiet') ? activity.quiet : activity.curious)}</p>` : '')).join('')}
      ${!active.observation && activity.kind === 'hen' ? '<small>Знакомство с гостем не даёт дополнительных шагов дружбы с курочкой.</small>' : ''}</article>`
  } else if (screen.kind === 'memories') {
    const memory = screen.memory
    body = `<h2>Наши домашние встречи · ${screen.memories.length}/${visitActivityIds.length}</h2>`
    if (memory) {
      const remembered = visitActivities[memory.activity]
      body += `<label for="guest-book-memory">Выберите встречу</label><select id="guest-book-memory" data-guest-choice="memory">${screen.memories.map(item => `<option value="${item.activity}"${item.activity === memory.activity ? ' selected' : ''}>${visitName(visitActivities[item.activity].resident)} · ${escape(visitActivities[item.activity].title)} · День ${item.day}</option>`).join('')}</select>
        <article class="home-visit-memory"><header>${icon(`ui-${remembered.resident}`)}<div><h3>${escape(remembered.title)}</h3><small>${visitName(remembered.resident)} · День ${memory.day}</small></div></header><strong>${escape(memory.subject)}</strong><p>${escape(remembered.memory)}</p><p>${escape(memory.detail)}</p>${memory.reply ? `<p>${escape(remembered[memory.reply])}</p>` : ''}</article>`
    } else body += '<p>Здесь останутся первые встречи: урожай, выпечка и знакомства с вашими курочками. Можно собирать их в любом порядке.</p>'
  } else {
    body = '<h2>О визитах</h2><p>Теперь соседи могут прийти к вам. Приглашения открываются после первой общей встречи в Лавандовой гавани. За визит не нужно платить или отдавать угощение.</p><p>Один гость за раз. Он уйдёт после отдыха или поездки, а воспоминания останутся. Повторные визиты не дают монет, урожая или очков дружбы.</p>'
  }
  const navigation = `${screen.kind !== 'memories' ? choice('page', 'memories', `Наши встречи · ${screen.memories.length}/${visitActivityIds.length}`) : ''}${screen.kind !== 'rules' ? choice('page', 'rules', 'О визитах') : ''}${screen.kind === 'rules' || screen.kind === 'memories' ? `<button type="button" class="dialog-button secondary" data-guest-back>${farm.neighborVisits.active ? 'К гостю' : 'К приглашениям'}</button>` : ''}`
  return `<section class="home-visits" aria-label="Гостевая книга: семантический прототип">${body}<nav aria-label="Разделы гостевой книги">${navigation}</nav></section>`
}
