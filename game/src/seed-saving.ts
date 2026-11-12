import {berryCropIds,cropIds,cropDefinitions,seedPackSize,type FarmState,type ActionResult} from './farm.ts'

export const seedSavingCrops=cropIds.filter(crop=>!berryCropIds.some(berry=>berry===crop))
const count=(value:number)=>Number.isSafeInteger(value)&&value>=0

/** The crop is spent, not planted. These are ordinary seeds, never an inherited rare trait. */
export function seedSavingQuote(farm:FarmState,value:unknown){
  const crop=seedSavingCrops.find(crop=>crop===value)
  if(!crop||farm.island!=='home')return undefined
  const produce=farm.produce[crop],seeds=farm.seeds[crop],total=seeds+seedPackSize
  const room=count(produce)&&count(seeds)&&count(total)&&count(farm.workToday+1)
  const token=['ss1',crop,farm.day,produce,seeds,farm.workToday].join('|')
  return {crop,name:cropDefinitions[crop].name,produce,seeds,total,remaining:Math.max(0,produce-1),room,
    available:room&&produce>=1,pack:seedPackSize,marketPrice:cropDefinitions[crop].seedPrice,token}
}

export function saveCropSeeds(farm:FarmState,token:unknown):ActionResult{
  const stale=()=>({ok:false,message:'Запас изменился. Проверьте урожай и семена перед сбором пакета.'})
  if(typeof token!=='string'||token.length>200)return stale()
  const quote=seedSavingQuote(farm,token.split('|')[1])
  if(!quote||quote.token!==token)return stale()
  if(!quote.room)return {ok:false,message:'Для нового пакета пока нет места в запасах или журнале работ.'}
  if(!quote.available)return {ok:false,message:'Нужен один обычный продукт выбранной культуры. Необычный урожай остаётся у вас.'}
  farm.produce[quote.crop]--
  farm.seeds[quote.crop]+=seedPackSize
  farm.workToday++
  return {ok:true,message:`${quote.name}: один продукт оставлен на семена. Получено семян: ${seedPackSize}. Посейте их отдельно.`}
}
