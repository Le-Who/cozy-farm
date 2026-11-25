import {cropIds,selectSeed,type FarmState,type CropId,type ActionResult} from './farm.ts'
import {activeGardenPlan,plannedCropAt,seedForBed} from './garden-plans.ts'

/** A depleted packet is not the only option for a manually prepared bed. Preview, never select. */
export function seedPickerBedPreview(farm:FarmState,bed:number):CropId{
  const current=seedForBed(farm,bed)
  if(farm.island!=='home'||farm.beds[bed]?.kind!=='tilled'||activeGardenPlan(farm)||farm.seeds[current]>0)return current
  const owned=cropIds.filter(crop=>farm.seeds[crop]>0)
  return owned.length===1?owned[0]:current
}

/** Browsing a packet is not permission to replace the player's sowing plan. */
export function seedChoice(farm:FarmState,crop:CropId,bed?:number){
  const planned=farm.island==='home'&&bed!==undefined&&plannedCropAt(farm,bed)===crop
  const token=['sc1',farm.island,farm.day,crop,bed??'',farm.gardenPlans.revision,planned?'plan':'manual',farm.seeds[crop]].join('|')
  return {available:farm.seeds[crop]>0,planned,
    token,
    label:planned?'К грядке по плану':activeGardenPlan(farm)?'Выбрать для ручного посева':'Сеять этой культурой',
    detail:planned?'План сохранится. Посев выполняется отдельным действием на грядке.':activeGardenPlan(farm)?'Этот выбор выключит посев по плану, но сохранит саму запись.':'Семена будут выбраны. Посев выполняется отдельно на грядке.'}
}

export function chooseSeedForBed(farm:FarmState,crop:unknown,bed:number|undefined,token:unknown):ActionResult{
  const id=cropIds.find(id=>id===crop)
  if(!id)return {ok:false,message:'Выберите семена.'}
  const choice=seedChoice(farm,id,bed)
  if(token!==choice.token)return {ok:false,message:'План или запас семян изменился. Посмотрите выбранную культуру ещё раз.'}
  if(choice.planned&&choice.available)return {ok:true,message:'План сохранён. Вернитесь к грядке для отдельного посева.'}
  return selectSeed(farm,id)
}
