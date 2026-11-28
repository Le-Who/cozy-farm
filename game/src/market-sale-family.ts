import { berryCropIds, cropDefinitions, treeDefinitions } from './farm.ts'

const harvestTypeLabels = { 'type:fruit':'Фрукты', 'type:berries':'Ягоды' } as const
function harvestType(family: string): keyof typeof harvestTypeLabels | undefined {
  if (family.startsWith('fruit:')) return 'type:fruit'
  if (berryCropIds.some(crop => family === `produce:${crop}`)) return 'type:berries'
}

/** Semantic inventory identity, never a localized name or visible row index. */
export function marketFamilyId(key: string): string | undefined {
  const [kind,resource] = key.split(':')
  if (kind==='produce' && Object.hasOwn(cropDefinitions,resource)) return `produce:${resource}`
  if (kind==='fruit' && Object.hasOwn(treeDefinitions,resource)) return `fruit:${resource}`
  if (kind==='variants') {
    if (Object.hasOwn(cropDefinitions,resource)) return `produce:${resource}`
    if (Object.hasOwn(treeDefinitions,resource)) return `fruit:${resource}`
    if (resource==='egg') return 'eggs'
  }
  if (['eggs','honey','windHoney','beeswax'].includes(key)) return key
}
/** A named product still includes its ordinary stock and exact rare rows. */
export function marketFamilyMatches(key: string, scope: string): boolean {
  const family = marketFamilyId(key)
  return !!family && (family === scope || harvestType(family) === scope)
}
export function marketFamilyLabel(id: string): string | undefined {
  const [kind,resource] = id.split(':')
  if (kind==='produce' && Object.hasOwn(cropDefinitions,resource)) return cropDefinitions[resource as keyof typeof cropDefinitions].name
  if (kind==='fruit' && Object.hasOwn(treeDefinitions,resource)) return treeDefinitions[resource as keyof typeof treeDefinitions].name
  const labels: Record<string,string>={eggs:'Яйцо',honey:'Мёд',windHoney:'Мёд ветров',beeswax:'Пчелиный воск'}
  return Object.hasOwn(labels,id)?labels[id]:undefined
}
export function marketSaleFamilies(stock: readonly {key:string;count:number;group:string}[], selected?: string) {
  const families = new Map<string,{id:string;label:string;rows:number}>()
  for (const item of stock) {
    if (item.count<=0 || item.group!=='harvest') continue
    const id=marketFamilyId(item.key), label=id && marketFamilyLabel(id)
    if (!id || !label) continue
    const family=families.get(id) ?? {id,label,rows:0}
    family.rows++;families.set(id,family)
  }
  // An exhausted family remains an explicit empty selection, never falls onto its neighbour.
  const label=selected && marketFamilyLabel(selected)
  if (selected && label && !families.has(selected)) families.set(selected,{id:selected,label,rows:0})
  // A useful type spans at least two live product families. Keep an explicitly
  // selected type, even if the stock changes before the player clears it.
  const types = Object.entries(harvestTypeLabels).flatMap(([id,label]) => {
    const members = [...families.values()].filter(family => family.rows > 0 && harvestType(family.id) === id)
    return members.length >= 2 || selected === id
      ? [{id,label,rows:members.reduce((total,family)=>total+family.rows,0)}] : []
  })
  return [...types,...families.values()]
}
