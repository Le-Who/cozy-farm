import './archive.css'
import type { Trait } from './climate'
import { getArchive, type ArchiveGroup, type FarmState } from './farm'

export function archiveCards(farm: FarmState, group: ArchiveGroup, itemIcon: (name: string, trait?: Trait) => string) {
  const sources:Record<ArchiveGroup,string>={crops:'Собирайте урожай. Дождь, снег, радуга и звёзды могут подарить редкие разновидности.',orchard:'Собирайте плоды в саду. Необычная погода может подарить редкие разновидности.',coop:'Кормите курочек и собирайте яйца. При необычной погоде встречаются особые яйца.',shore:'Ищите ракушки в Солёной роще. Найдите оба вида, чтобы открыть Лунную отмель.',bay:'Поймайте, вырастите, приготовьте или найдите каждый предмет. Продажа не стирает находку.'}
  const clue=(id:string,series:string)=>{
    if(id==='dew')return 'Может появиться в дождь'
    if(id==='frost')return 'Может появиться в снег'
    if(id==='rainbow')return 'Может появиться в день радуги'
    if(id==='star')return 'Может появиться под звёздами'
    if(id==='moon'||id==='pearl')return 'Может появиться в роще при лунном приливе'
    if(id==='moonfish')return 'Рыбачьте глубже 75 м'
    if(id==='lanternfish')return 'Рыбачьте глубже 100 м'
    if(id==='perch')return 'Рыбачьте на Родном острове'
    if(id==='seaBass')return 'Рыбачьте в Солёной роще'
    if(id==='glass')return 'Исследуйте Лунную отмель'
    if(id==='windHoney')return 'Собирайте мёд при Медовом ветре'
    if(id==='beeswax')return 'Собирайте на улучшенной пасеке'
    if(group==='shore')return 'Ищите на берегу рощи'
    if(series==='dishes')return 'Приготовьте это блюдо'
    if(series==='honey')return 'Собирайте на Цветочном мысе'
    return group==='coop'?'Кормите курочек и собирайте яйца':group==='orchard'||series==='fruit'?'Собирайте спелые плоды':'Соберите этот урожай'
  }
  return `<p class="collection-source">${sources[group]}</p><ul class="archive-series-list" role="list">
    ${getArchive(farm, group).map(series => {
      const count = series.items.filter(item => item.discovered).length
      return `<li class="archive-series" data-series="${series.id}">
        <h2 class="archive-series-name">${series.name}</h2>
        <span class="archive-series-count">${count}/${series.items.length}<span class="sr-only"> найдено</span></span>
        <ul class="archive-slots"${group === 'shore' ? ' data-shore' : ''} role="list">
          ${series.items.map(item => `<li class="archive-slot" data-variant="${item.id}" data-discovered="${item.discovered}">
            ${item.discovered ? `<span class="archive-slot-art" aria-hidden="true">${itemIcon(item.id==='moonfish'||item.id==='lanternfish'?`ui-${item.id}`:item.icon,item.trait)}</span><span class="archive-slot-name">${item.name}</span>` : `<details class="collection-clue"><summary aria-label="Как найти: ${item.name}"><span class="archive-slot-art" aria-hidden="true">?</span></summary><span><strong>${item.name}</strong>${clue(item.id,series.id)}</span></details>`}
          </li>`).join('')}
        </ul>
      </li>`
    }).join('')}
  </ul>`
}
