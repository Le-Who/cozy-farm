import { type FarmState, type ActionResult } from './farm.ts'
import { gardenSeedQuote, type GardenSeedScope } from './garden-seed-basket.ts'
import { saveCropSeeds, seedSavingQuote } from './seed-saving.ts'
import { getMarketOrderReservedStock } from './market-order-surplus.ts'

/** Keep the existing underfunded recovery. With sufficient coins, show only
 * strictly cheaper ordinary surplus, never a unit needed by a local order. */
export function gardenHarvestSeeds(farm:FarmState,slot:number,scope:GardenSeedScope) {
  const basket=gardenSeedQuote(farm,slot,scope)
  if(!basket?.packs)return []
  const retained=basket.affordable ? getMarketOrderReservedStock(farm) : undefined
  if(basket.affordable && !retained)return []
  return basket.lines.flatMap(line=>{
    if(!line.packs)return []
    const crop=seedSavingQuote(farm,line.crop)
    if(!crop?.available)return []
    if(retained && (crop.saleValue>=crop.marketPrice || crop.produce<=Math.max(1,retained.get('produce:'+crop.crop)??0)))return []
    const after=basket.total-crop.marketPrice
    return [{crop:line.crop,name:crop.name,remaining:crop.remaining,pack:crop.pack,after,
      token:[basket.token,farm.coins,crop.token].join('~'),exchange:crop.token}]
  })
}

export function saveGardenSeedPacket(farm:FarmState,slot:number,scope:GardenSeedScope,token:unknown):ActionResult {
  const choice=typeof token==='string'&&gardenHarvestSeeds(farm,slot,scope).find(item=>item.token===token)
  return choice?saveCropSeeds(farm,choice.exchange):{ok:false,message:'Список или запасы изменились. Проверьте семена заново.'}
}
