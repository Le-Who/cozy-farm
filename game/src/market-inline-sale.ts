import { exactSaleQuote, stepSaleQuantity } from './exact-sale.ts'
import { ruCount } from './ru.ts'
import { SalePresentation } from './sale-presentation.ts'
import { getMarketOrders, marketKey, type FarmState } from './farm.ts'
import { getLocalWarehouseSupply } from './warehouse-guidance.ts'

type Receipt = { quantity: number; total: number; remaining: number; goalRewardText?: string }
export function inlineReceiptText(receipt: Receipt) {
  return `Продано: ${receipt.quantity} · ${ruCount(receipt.total, 'монета', 'монеты', 'монет')}. Осталось: ${receipt.remaining}.${receipt.goalRewardText ? '\n' + receipt.goalRewardText : ''}`
}
type Draft = { owner: SalePresentation; raw: string; count: number; price: number; pending: boolean; receipt?: Receipt }
/** Per-row presentation only. Exact quote and the existing farm reducer remain authoritative. */
export class MarketInlineSales {
  private drafts = new Map<string, Draft>()
  private readonly farm: (() => FarmState) | undefined
  constructor(farm?: () => FarmState) { this.farm=farm }
  private draft(key: string, count: number, price: number) {
    let draft = this.drafts.get(key)
    if (!draft) {
      draft = { owner: new SalePresentation(), raw: '1', count, price, pending: false }
      draft.owner.open({kind:'market',key}); this.drafts.set(key,draft)
    } else if (draft.count !== count || draft.price !== price) {
      // Do not keep a sale's old remaining count beside a new live stock count.
      if (draft.receipt && draft.receipt.remaining !== count) { draft.raw='1'; draft.receipt=undefined }
      draft.count=count; draft.price=price; draft.owner.open({kind:'market',key})
    }
    return draft
  }
  view(key: string, count: number, price: number) {
    const draft=this.draft(key,count,price)
    const quote=exactSaleQuote(draft.raw,count,price)
    const farm=quote.valid&&!draft.pending&&!draft.receipt ? this.farm?.() : undefined
    // Count distinct alternatives ready before this sale, never a plan to deliver them together.
    const lost=farm?.island==='home' ? getMarketOrders(farm).filter(order=>order.status==='ready'
      && order.items.some(item=>{
        if (item.quantity<=quote.remaining || marketKey(item)!==key) return false
        const shortage=item.quantity-quote.remaining
        // Offset the required total so the existing owned-stock authority sees
        // exactly the deficit after this proposed sale, without changing the bag.
        const supply=getLocalWarehouseSupply(farm,{...item,quantity:item.quantity+quote.quantity})
        return supply?.quantity!==shortage
      })).length : 0
    const orderImpact=lost ? `После продажи не хватит для ${ruCount(lost,'заказа','заказов','заказов')}` : ''
    return { token:draft.owner.token, raw:draft.raw, quote, receipt:draft.receipt, pending:draft.pending, orderImpact }
  }
  private current(key: string, token: string | undefined, count: number, price: number) {
    const draft=this.draft(key,count,price)
    return draft.owner.accepts(token,{kind:'market',key}) ? draft : undefined
  }
  edit(key: string, token: string | undefined, raw: string, count: number, price: number) {
    const draft=this.current(key,token,count,price)
    if(!draft || draft.pending || draft.receipt)return false
    draft.raw=raw; draft.owner.open({kind:'market',key}); return true
  }
  step(key: string, token: string | undefined, direction: 'less'|'more', count: number, price: number) {
    const draft=this.current(key,token,count,price)
    return Boolean(draft && this.edit(key,token,stepSaleQuantity(draft.raw,count,direction),count,price))
  }
  take(key: string, token: string | undefined, count: number, price: number) {
    const draft=this.current(key,token,count,price)
    if(!draft || draft.pending || draft.receipt)return undefined
    const quote=exactSaleQuote(draft.raw,count,price)
    if(!quote.valid)return undefined
    draft.pending=true; draft.owner.open({kind:'market',key})
    return {quantity:quote.quantity,total:quote.total,remaining:quote.remaining}
  }
  finish(key: string, receipt?: Receipt, goalRewardText?: string) {
    const draft=this.drafts.get(key)
    if(!draft)return
    draft.pending=false; draft.receipt=receipt && goalRewardText ? {...receipt,goalRewardText} : receipt
    if(receipt)draft.count=receipt.remaining
    draft.owner.open({kind:'market',key})
  }
  rearm(key: string, token: string | undefined, count: number, price: number) {
    const draft=this.current(key,token,count,price)
    if(!draft || draft.pending || !draft.receipt || count<1)return false
    draft.raw='1'; draft.receipt=undefined; draft.owner.open({kind:'market',key}); return true
  }
}
