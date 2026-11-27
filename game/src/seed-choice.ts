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
  const plot=bed===undefined?undefined:farm.beds[bed]
  const validTarget=bed===undefined||farm.island==='home'&&Number.isInteger(bed)&&(plot?.kind==='empty'||plot?.kind==='tilled')
  const assigned=validTarget&&bed!==undefined?plannedCropAt(farm,bed):undefined
  const plan=activeGardenPlan(farm)
  const planned=assigned===crop
  // The notebook explicitly leaves this live plot to the player's usual seed choice.
  const manualBed=validTarget&&bed!==undefined&&!!plan&&assigned===undefined
  const pausesPlan=!!plan&&!planned&&!manualBed
  const token=['sc1',farm.island,farm.day,crop,bed??'',farm.gardenPlans.revision,planned?'plan':manualBed?`manual-bed:${plot?.kind}`:'manual',farm.seeds[crop]].join('|')
  return {available:farm.seeds[crop]>0,planned,manualBed,pausesPlan,validTarget,token,
    label:planned?'К грядке по плану':pausesPlan?'Выбрать для ручного посева':'Сеять этой культурой',
    detail:!validTarget?'Грядка изменилась. Выберите её снова.'
      :planned||manualBed?'План сохранится. Посев выполняется отдельным действием на грядке.'
        :pausesPlan?'Этот выбор выключит посев по плану, но сохранит саму запись.':'Семена будут выбраны. Посев выполняется отдельно на грядке.'}
}

export function chooseSeedForBed(farm:FarmState,crop:unknown,bed:number|undefined,token:unknown):ActionResult{
  const id=cropIds.find(id=>id===crop)
  if(!id)return {ok:false,message:'Выберите семена.'}
  const choice=seedChoice(farm,id,bed)
  if(!choice.validTarget||token!==choice.token)return {ok:false,message:'План, грядка или запас семян изменились. Посмотрите выбранную культуру ещё раз.'}
  if(choice.planned&&choice.available)return {ok:true,message:'План сохранён. Вернитесь к грядке для отдельного посева.'}
  return selectSeed(farm,id,choice.manualBed?'keep-plan':'manual')
}
