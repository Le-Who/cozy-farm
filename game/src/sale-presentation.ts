import type { SaleTarget } from './exact-sale.ts'
export type SalePlace = { index: number; scroll: number }
/** UI-only ownership. Old controls may never operate a newly selected product. */
export class SalePresentation {
  private revision = 0
  private target: SaleTarget | undefined
  place: SalePlace | undefined
  open(target: SaleTarget, place?: SalePlace) {
    this.revision++
    this.target = {...target}
    this.place = place && {...place}
  }
  reset() { this.revision++; this.target=undefined; this.place=undefined }
  get token() { return this.target ? JSON.stringify([this.revision,this.target.kind,this.target.key]) : '' }
  accepts(token: string | undefined, target: SaleTarget | undefined) {
    return Boolean(token && token===this.token && target && this.target?.kind===target.kind && this.target?.key===target.key)
  }
}
/** Index determines only receipt placement; the immutable product key owns every action. */
export function saleRowKeys(keys: readonly string[], key: string, place: SalePlace, receipt: boolean) {
  const rows=[...keys]
  if (receipt && !rows.includes(key)) rows.splice(Math.max(0,Math.min(place.index,rows.length)),0,key)
  return rows
}
