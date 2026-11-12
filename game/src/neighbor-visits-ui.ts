import { cropDefinitions, getBedStage, getWorkshopAction, treeDefinitions, type FarmState } from './farm.ts'
import { henFriends } from './hen-friendship.ts'
import { canInviteNeighbor, visitActivities, visitActivityIds, visitName, type VisitActivityId } from './neighbor-visits.ts'
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const button=(label:string,action:string,value='',enabled=true)=>`<button type="button" class="dialog-button secondary" data-action="${action}" data-value="${value}"${enabled?'':' disabled'}>${label}</button>`
function readiness(farm:FarmState,id:VisitActivityId){
  switch(visitActivities[id].kind){
    case 'crop':{const bed=farm.beds.find(b=>b.kind==='crop'&&getBedStage(b)==='ripe');return bed?.kind==='crop'?`Можно показать: ${cropDefinitions[bed.crop].name.toLowerCase()}.`:'Зрелых грядок пока нет. Можно сначала вырастить урожай.'}
    case 'hen':return 'Можно познакомить с любой курочкой, даже уже поглаженной.'
    case 'pastry':return getWorkshopAction(farm).available?'Для одной выпечки есть 2 пшеницы и 1 яйцо. Дополнительных расходов нет.':'Для ручной выпечки нужны 2 пшеницы и 1 яйцо. Изделие останется у вас.'
    case 'fruit':{const tree=farm.trees.home.find(t=>t&&t.fruitReady>0);return tree?`Можно показать: ${treeDefinitions[tree.tree].treeName.toLowerCase()}.`:'Дождитесь спелых плодов домашнего дерева. Визит можно начать позднее.'}
  }
}
export function renderNeighborVisits(farm:FarmState,icon:(key:string)=>string){
  const active=farm.neighborVisits.active,activity=active&&visitActivities[active.activity]
  const memories=farm.neighborVisits.memories
  const present=active&&activity?`<article class="home-visit-active" aria-label="Гость на ферме"><header>${icon(`ui-${activity.resident}`)}<div><small>Сегодня в гостях</small><h2>${visitName(activity.resident)} · ${activity.title}</h2></div></header>
    ${active.observation?`<p>${activity.memory}</p><aside class="home-visit-memory"><strong>${escape(active.observation.subject)}</strong><p>${escape(active.observation.detail)}</p><small>Момент уже сохранён. Урожай, выпечка и припасы остались у вас.</small></aside><p>О чём поговорим перед уходом?</p>
      <div class="home-visit-replies">${button('О тихих радостях','visit-reply',`${active.serial}:quiet`)}<p>${activity.quiet}</p>${button('О новых идеях','visit-reply',`${active.serial}:curious`)}<p>${activity.curious}</p></div>`
      :`<p>${activity.invitation}</p><p class="home-visit-goal"><strong>${activity.goal}</strong></p><p>${readiness(farm,active.activity)}</p>
        ${activity.kind==='hen'?`<div class="home-visit-hens">${henFriends.slice(0,farm.flockSize).map((hen,id)=>button(`Познакомить: ${hen.name}`,'visit-introduce-hen',`${active.serial}:${id}`)).join('')}</div><small>Знакомство с гостем не даёт дополнительных шагов дружбы с курочкой.</small>`:button(activity.kind==='pastry'?'В кондитерскую':activity.kind==='fruit'?'К дереву':'К зрелой грядке','visit-do',String(active.serial))}`}
    <div class="dialog-actions">${button('Побыть на ферме','close')}${button(active.observation?'Попрощаться':'Завершить визит','visit-finish',String(active.serial))}</div></article>`:''
  return `<section class="home-visits"><p>Теперь соседи могут прийти к вам. Приглашения открываются после первой общей встречи в Лавандовой гавани. За визит не нужно платить или отдавать угощение.</p>
    <p class="home-visit-note">Один гость за раз. Он уйдёт после отдыха или поездки, а воспоминания останутся. Повторные визиты не дают монет, урожая или очков дружбы.</p>${present}${farm.island!=='home'?button('Вернуться домой к приглашениям','visit-book-home'):''}
    ${!active?`<div class="home-visit-invitations">${(['bea','finn'] as const).map(resident=>`<article><header>${icon(`ui-${resident}`)}<h2>${visitName(resident)}</h2></header>${!canInviteNeighbor(farm,resident)?`<p>${farm.island!=='home'?'Приглашайте соседей с Родного острова.':!farm.village.residents.includes(resident)?'Сначала пригласите этого соседа поселиться в гавани.':'Сначала устройте с этим соседом общую встречу в гавани.'}</p>`:''}
      ${visitActivityIds.filter(id=>visitActivities[id].resident===resident).map(id=>`<div class="home-visit-choice"><h3>${visitActivities[id].title}</h3><p>${visitActivities[id].goal}</p><small>${readiness(farm,id)}</small>${button(memories.some(m=>m.activity===id)?'Позвать снова':'Пригласить','visit-invite',id,canInviteNeighbor(farm,resident))}</div>`).join('')}</article>`).join('')}</div>`:''}
    <h2>Наши домашние встречи</h2>${memories.length?`<div class="home-visit-memories">${memories.map(m=>{const a=visitActivities[m.activity];return `<article><header>${icon(`ui-${a.resident}`)}<div><h3>${a.title}</h3><small>${visitName(a.resident)} · День ${m.day}</small></div></header><strong>${escape(m.subject)}</strong><p>${a.memory}</p><p>${escape(m.detail)}</p>${m.reply?`<p class="home-visit-note">${a[m.reply]}</p>`:''}</article>`}).join('')}</div>`:'<p>Здесь останутся первые встречи: урожай, выпечка и знакомства с вашими курочками. Можно собирать их в любом порядке.</p>'}</section>`
}
export function renderVisitRest(farm:FarmState){const visit=farm.neighborVisits.active;return visit?`<p class="dialog-status">${visitName(visitActivities[visit.activity].resident)} после отдыха вернётся в гавань. ${visit.observation?'Воспоминание уже в гостевой книге.':'Пригласить снова можно в любой день, ничего не потеряется.'}</p>`:''}
