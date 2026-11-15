import { cropDefinitions, treeDefinitions } from './farm.ts'

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
  return [...families.values()]
}
