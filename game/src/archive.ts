import './archive.css'
import type { Trait } from './climate'
import { getArchive, type ArchiveGroup, type FarmState } from './farm'

export function archiveCards(farm: FarmState, group: ArchiveGroup, itemIcon: (name: string, trait?: Trait) => string) {
  const sources:Record<ArchiveGroup,string>={crops:'Harvest each crop. Rain, snow, rainbows and starlight can leave rare variants.',orchard:'Pick fruit from your trees. Unusual skies can leave rare variants.',coop:'Collect eggs after feeding your hens. Unusual skies can mark the nest.',shore:'Find shells on Saltwind Grove. Both shell discoveries open Moonpool Shoal.',bay:'Catch, pick, cook or collect each resource once. Discoveries stay after selling.'}
  const clue=(id:string,series:string)=>{
    if(id==='dew')return 'A chance during rain'
    if(id==='frost')return 'A chance during snow'
    if(id==='rainbow')return 'A chance on rainbow days'
    if(id==='star')return 'A chance under starlight'
    if(id==='moon'||id==='pearl')return 'A chance during the Grove lunar tide'
    if(id==='moonfish')return 'Fish below 75 m'
    if(id==='lanternfish')return 'Fish below 100 m'
    if(id==='perch')return 'Fish at Cozy Farm'
    if(id==='seaBass')return 'Fish at Saltwind Grove'
    if(id==='glass')return 'Explore Moonpool Shoal'
    if(id==='windHoney')return 'Collect honey during Honey Wind'
    if(id==='beeswax')return 'Collect at an upgraded apiary'
    if(group==='shore')return 'Search the Grove shore'
    if(series==='dishes')return 'Cook this recipe'
    if(series==='honey')return 'Collect at Flower Cape'
    return group==='coop'?'Feed hens and collect eggs':group==='orchard'||series==='fruit'?'Pick ripe fruit':'Harvest this crop'
  }
  return `<p class="collection-source">${sources[group]}</p><ul class="archive-series-list" role="list">
    ${getArchive(farm, group).map(series => {
      const count = series.items.filter(item => item.discovered).length
      return `<li class="archive-series" data-series="${series.id}">
        <h2 class="archive-series-name">${series.name}</h2>
        <span class="archive-series-count">${count}/${series.items.length}<span class="sr-only"> discovered</span></span>
        <ul class="archive-slots"${group === 'shore' ? ' data-shore' : ''} role="list">
          ${series.items.map(item => `<li class="archive-slot" data-variant="${item.id}" data-discovered="${item.discovered}">
            ${item.discovered ? `<span class="archive-slot-art" aria-hidden="true">${itemIcon(item.id==='moonfish'||item.id==='lanternfish'?`ui-${item.id}`:item.icon,item.trait)}</span><span class="archive-slot-name">${item.name}</span>` : `<details class="collection-clue"><summary aria-label="How to discover ${item.name}"><span class="archive-slot-art" aria-hidden="true">?</span></summary><span><strong>${item.name}</strong>${clue(item.id,series.id)}</span></details>`}
          </li>`).join('')}
        </ul>
      </li>`
    }).join('')}
  </ul>`
}
