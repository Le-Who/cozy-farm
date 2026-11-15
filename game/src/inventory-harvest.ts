import { cropDefinitions, treeDefinitions, type CropId, type TreeId, type StockItem } from './farm.ts'
import { traitLabel } from './ru.ts'
import type { Trait } from './climate.ts'

export type InventoryStockEntry = { key:string; item:StockItem; count:number; name:string; image:string; trait?:Trait }
type Resource = CropId | TreeId | 'egg'
type ResourceGroup<T extends InventoryStockEntry> = { kind:'resource'; resource:Resource; ordinary?:T; variants:T[] }
type StockGroup<T extends InventoryStockEntry> = ResourceGroup<T> | { kind:'other'; entry:T }

/** Keep each exact stock line; grouping never pools ordinary and rare ingredients. */
export function groupHarvestStocks<T extends InventoryStockEntry>(entries:readonly T[]):StockGroup<T>[] {
  const result:StockGroup<T>[]=[], resources=new Map<Resource,ResourceGroup<T>>()
  for(const entry of entries){
    if(entry.count<=0)continue
    const item=entry.item, resource=item.kind==='produce'||item.kind==='fruit'||item.kind==='variants'?item.item:item.kind==='eggs'?'egg':undefined
    if(resource===undefined){result.push({kind:'other',entry});continue}
    let group=resources.get(resource)
    if(!group){group={kind:'resource',resource,variants:[]};resources.set(resource,group);result.push(group)}
    if(item.kind==='variants')group.variants.push(entry)
    else group.ordinary=entry
  }
  return result
}

export function renderHarvestStocks<T extends InventoryStockEntry>(entries:readonly T[], art:(image:string,trait?:Trait)=>string, other:(entry:T)=>string, leading='', trailing='') {
  const cards=groupHarvestStocks(entries).map(group=>{
    if(group.kind==='other')return other(group.entry)
    const {resource,ordinary,variants}=group, first=ordinary??variants[0]
    const name=resource==='egg'?'Яйцо':resource in cropDefinitions?cropDefinitions[resource as CropId].name:treeDefinitions[resource as TreeId].name
    return `<li class="inventory-resource" data-stock-resource="${resource}" aria-label="${name}"><header>${art(first.image)}<h3>${name}</h3></header>
      <p class="inventory-ordinary"${ordinary?` data-stock-key="${ordinary.key}" data-stock-count="${ordinary.count}"`:''}>${ordinary?`Обычных <strong>×${ordinary.count}</strong>`:'Обычных нет'}</p>
      ${variants.length?`<ul class="inventory-variants" aria-label="Необычные: ${name.toLowerCase()}">${variants.map(entry=>entry.item.kind==='variants'?`<li data-stock-key="${entry.key}" data-stock-count="${entry.count}" aria-label="${entry.name}, ${entry.count}">${art(entry.image,entry.item.trait)}<span>${traitLabel(entry.item.trait,resource)}</span><strong>×${entry.count}</strong></li>`:'').join('')}</ul>`:''}</li>`
  }).join('')
  return `<ul class="inventory-harvest-grid">${leading}${cards}${trailing}</ul>`
}
