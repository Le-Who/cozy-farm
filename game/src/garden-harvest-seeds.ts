import { type FarmState, type ActionResult } from './farm.ts'
import { gardenSeedQuote, type GardenSeedScope } from './garden-seed-basket.ts'
import { saveCropSeeds, seedSavingQuote } from './seed-saving.ts'

/** Only show alternatives on an unaffordable current list. One explicit exchange,
 * at the existing seed-saving rate, never buys the remainder or sows a bed. */
export function gardenHarvestSeeds(farm:FarmState,slot:number,scope:GardenSeedScope) {
  const basket=gardenSeedQuote(farm,slot,scope)
  if(!basket||basket.affordable)return []
  return basket.lines.flatMap(line=>{
    if(!line.packs)return []
    const crop=seedSavingQuote(farm,line.crop)
    if(!crop?.available)return []
    const after=basket.total-crop.marketPrice
    return [{crop:line.crop,name:crop.name,remaining:crop.remaining,pack:crop.pack,after,
      token:[basket.token,farm.coins,crop.token].join('~'),exchange:crop.token}]
  })
}

export function saveGardenSeedPacket(farm:FarmState,slot:number,scope:GardenSeedScope,token:unknown):ActionResult {
  const choice=typeof token==='string'&&gardenHarvestSeeds(farm,slot,scope).find(item=>item.token===token)
  return choice?saveCropSeeds(farm,choice.exchange):{ok:false,message:'Список или запасы изменились. Проверьте семена заново.'}
}
