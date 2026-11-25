import { standingVisitCrop } from './standing-crop-visit.ts'
import { cropDefinitions, getBedStage, getWorkshopAction, treeDefinitions, type FarmState } from './farm.ts'
import { henFriends } from './hen-friendship.ts'
import { canInviteNeighbor, getActiveVisitMemory, visitActivities, visitActivityIds, visitName, type VisitActivityId } from './neighbor-visits.ts'
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const button=(label:string,action:string,value='',enabled=true)=>`<button type="button" class="dialog-button secondary" data-action="${action}" data-value="${value}"${enabled?'':' disabled'}>${label}</button>`
const ripeHomeTree=(farm:FarmState)=>farm.trees.home.find(tree=>tree&&tree.fruitReady>0)
function readiness(farm:FarmState,id:VisitActivityId){
  switch(visitActivities[id].kind){
    case 'crop':{const bed=farm.beds.find(b=>b.kind==='crop'&&getBedStage(b)==='ripe');return bed?.kind==='crop'?`Можно показать: ${cropDefinitions[bed.crop].name.toLowerCase()}.`:'Зрелых грядок пока нет. Можно сначала вырастить урожай.'}
    case 'hen':return 'Можно познакомить с любой курочкой, даже уже поглаженной.'
    case 'pastry':return getWorkshopAction(farm).available?'Для одной выпечки есть 2 пшеницы и 1 яйцо. Дополнительных расходов нет.':'Для ручной выпечки нужны 2 пшеницы и 1 яйцо. Изделие останется у вас.'
    case 'fruit':{
      const tree=ripeHomeTree(farm)
      if(tree)return `Можно показать: ${treeDefinitions[tree.tree].treeName.toLowerCase()}.`
      return farm.neighborVisits.active?.activity===id?'Гостя можно позвать снова, когда в саду созреют плоды.':'Дождитесь спелых плодов домашнего дерева. Визит можно начать позднее.'
    }
  }
}
export function renderNeighborVisits(farm:FarmState,icon:(key:string)=>string, pastrySupplies?:()=>string){
  const active=farm.neighborVisits.active,activity=active&&visitActivities[active.activity]
  const standing=standingVisitCrop(farm)
  const waitingForPastry=active?.activity==='beaHands' && !active.observation && !getWorkshopAction(farm).available
  const harvestReady=activity?.kind==='fruit'?!!ripeHomeTree(farm):activity?.kind!=='crop'||farm.beds.some(b=>b.kind==='crop'&&getBedStage(b)==='ripe')
  const targetLabel=activity?.kind==='pastry'?'В кондитерскую'
    :activity?.kind==='fruit'?(harvestReady?'К дереву':'Нет спелых плодов')
    :harvestReady?'К зрелой грядке':'Нет зрелых грядок'
  const nextStep=!active || !activity || active.observation ? '' : waitingForPastry ? (pastrySupplies?.() ?? `<p>${readiness(farm,active.activity)}</p>`) : `<p>${readiness(farm,active.activity)}</p>
        ${activity.kind==='hen'?`<div class="home-visit-hens">${henFriends.slice(0,farm.flockSize).map((hen,id)=>button(`Познакомить: ${hen.name}`,'visit-introduce-hen',`${active.serial}:${id}`)).join('')}</div><small>Знакомство с гостем не даёт дополнительных шагов дружбы с курочкой.</small>`:button(targetLabel,'visit-do',String(active.serial),harvestReady)}${standing?button(`Показать на грядке · ${escape(standing.name)}`,'visit-show-crop',standing.token):''}`
  const memories=farm.neighborVisits.memories,recordedThisVisit=active?.observation && getActiveVisitMemory(farm)
  const archived=recordedThisVisit ? memories.filter(memory=>memory.serial!==recordedThisVisit.serial) : memories
  const present=active&&activity?`<article class="home-visit-active" aria-label="Гость на ферме"><header>${icon(`ui-${activity.resident}`)}<div><small>Сегодня в гостях</small><h2>${visitName(activity.resident)} · ${activity.title}</h2></div></header>
    ${active.observation?`${recordedThisVisit?`<p>${activity.memory}</p>`:''}<aside class="home-visit-memory"><strong>${recordedThisVisit?'':'Сегодня: '}${escape(active.observation.subject)}</strong><p>${escape(active.observation.detail)}</p><small>${recordedThisVisit?'Воспоминание добавлено в книгу.':'В книге осталась ваша первая встреча за этим занятием.'} Урожай, выпечка и припасы остались у вас.</small></aside><p>О чём поговорим перед уходом?</p>
      <div class="home-visit-replies">${button('О тихих радостях','visit-reply',`${active.serial}:quiet`)}<p>${activity.quiet}</p>${button('О новых идеях','visit-reply',`${active.serial}:curious`)}<p>${activity.curious}</p></div>`
      :`<p>${activity.invitation}</p><p class="home-visit-goal"><strong>${standing?'Покажите растение или соберите урожай.':activity.goal}</strong></p>
        ${nextStep}`}
    <p class="home-visit-note">После отдыха или поездки гость уйдёт, а записи в книге останутся.</p>
    <div class="dialog-actions">${button('Побыть на ферме','close')}${button(active.observation?'Попрощаться':'Завершить визит','visit-finish',String(active.serial))}</div></article>`:''
  const history=archived.length?`<div class="home-visit-memories">${archived.map(m=>{const a=visitActivities[m.activity];return `<article><header>${icon(`ui-${a.resident}`)}<div><h3>${a.title}</h3><small>${visitName(a.resident)} · День ${m.day}</small></div></header><strong>${escape(m.subject)}</strong><p>${a.memory}</p><p>${escape(m.detail)}</p>${m.reply?`<p class="home-visit-note">${a[m.reply]}</p>`:''}</article>`}).join('')}</div>`:memories.length?'':'<p>Здесь останутся первые встречи: урожай, выпечка и знакомства с вашими курочками. Можно собирать их в любом порядке.</p>'
  const settled=farm.village.residents.filter(id=>id!==null)
  const canHostAtHome=settled.some(id=>farm.neighbors[id].completed>0)
  const localStep=!active&&farm.island==='village'&&farm.village.built&&!canHostAtHome
    ? settled.length ? button(settled[0]==='bea'?'К встрече с Беа':'К встрече с Финном','open-neighbor',settled[0])
      : button('Выбрать соседа для домика','visit-cottage','0') : ''
  const home=farm.island==='home'?'':button(canHostAtHome?'Вернуться домой к приглашениям':'Вернуться домой','visit-book-home')
  const introduction=`<p>Приглашения открываются после первой общей встречи в Лавандовой гавани. За визит не нужно платить или отдавать угощение.</p>${localStep}
    <p class="home-visit-note">Один гость за раз. Он уйдёт после отдыха или поездки, а воспоминания останутся. Повторные визиты не дают монет, урожая или очков дружбы.</p>`
  return `<section class="home-visits">${active?present:introduction}${localStep?'':home}
    ${!active?`<div class="home-visit-invitations">${(['bea','finn'] as const).map(resident=>`<article><header>${icon(`ui-${resident}`)}<h2 data-visit-resident="${resident}" tabindex="-1">${visitName(resident)}</h2></header>${!canInviteNeighbor(farm,resident)?`<p>${!farm.village.residents.includes(resident)?'Сначала пригласите этого соседа поселиться в гавани.':!farm.neighbors[resident].completed?'Сначала устройте с этим соседом общую встречу в гавани.':'Приглашайте соседей с Родного острова.'}</p>`:''}
      ${visitActivityIds.filter(id=>visitActivities[id].resident===resident).map(id=>`<div class="home-visit-choice"><h3>${visitActivities[id].title}</h3><p>${visitActivities[id].goal}</p><small>${readiness(farm,id)}</small>${button(memories.some(m=>m.activity===id)?'Позвать снова':'Пригласить','visit-invite',id,canInviteNeighbor(farm,resident))}</div>`).join('')}</article>`).join('')}</div>`:''}
    ${history?`<h2>Наши домашние встречи</h2>${history}`:''}${localStep?home:''}</section>`
}
export function renderVisitRest(farm:FarmState){
  const visit=farm.neighborVisits.active
  return visit?`<p class="dialog-status">${visitName(visitActivities[visit.activity].resident)} после отдыха вернётся в гавань. ${visit.observation?getActiveVisitMemory(farm)?'Воспоминание уже в гостевой книге.':'В гостевой книге останется первая встреча за этим занятием.':'Пригласить снова можно в любой день, ничего не потеряется.'}</p>`:''
}
