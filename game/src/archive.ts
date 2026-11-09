import './archive.css'
import { nextWeatherDay, weatherNames, type Trait, type Weather } from './climate'
import { isLunarTide } from './tide'
import { getArchive, isHoneyWind, type ArchiveGroup, type FarmState } from './farm'

export function archiveCards(farm: FarmState, group: ArchiveGroup, itemIcon: (name: string, trait?: Trait) => string) {
  const skyFor: Partial<Record<string,Exclude<Weather,'sun'>>> = {dew:'rain',frost:'snow',rainbow:'rainbow',star:'stars'}
  const when = (day:number) => day===farm.day ? 'сегодня' : day===farm.day+1 ? 'завтра' : `день ${day}`
  const nextEvent = (onDay:(day:number)=>boolean) => {
    let day=farm.day
    for (let offset=0;offset<=15;offset++,day++) if (onDay(day)) return when(day)
    return 'в один из следующих дней'
  }
  const clue=(id:string,series:string)=>{
    const sky=skyFor[id]
    if(sky) return `${weatherNames[sky]} · ${when(nextWeatherDay(farm.day,sky))}`
    if(id==='pearl') return `Лунная отмель · прилив ${nextEvent(isLunarTide)}`
    if(id==='moon') return `Лунный прилив в роще · ${nextEvent(isLunarTide)}`
    if(id==='moonfish')return 'Рыбачьте глубже 75 м'
    if(id==='lanternfish')return 'Рыбачьте глубже 100 м'
    if(id==='perch')return 'Рыбачьте на Родном острове'
    if(id==='seaBass')return 'Рыбачьте в Солёной роще'
    if(id==='glass')return 'Найдите оба вида ракушек и загляните на отмель'
    if(id==='windHoney')return `Медовый ветер на мысе · ${nextEvent(isHoneyWind)}`
    if(id==='beeswax')return 'Собирайте на улучшенной пасеке'
    if(group==='shore')return 'Ищите на берегу рощи'
    if(series==='dishes')return 'Приготовьте это блюдо'
    if(series==='honey')return 'Собирайте на Цветочном мысе'
    return group==='coop'?'Кормите курочек и собирайте яйца':group==='orchard'||series==='fruit'?'Собирайте спелые плоды':'Соберите этот урожай'
  }
  return `<ul class="archive-series-list" role="list">
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
