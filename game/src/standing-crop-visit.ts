import { cropDefinitions, getBedStage, variantLabel, type ActionResult, type FarmState } from './farm.ts'
import { noteNeighborVisit } from './neighbor-visits.ts'

/** Only a live, ripe weather-grown plant can be shown instead of harvested. */
export function standingVisitCrop(farm:FarmState) {
  const visit=farm.neighborVisits.active
  if(farm.island!=='home'||visit?.activity!=='beaHarvest'||visit.startedOn!==farm.day||visit.observation)return
  for(const [index,bed] of farm.beds.entries()){
    if(bed.kind!=='crop'||!bed.trait||getBedStage(bed)!=='ripe')continue
    return {index, crop:bed.crop, name:variantLabel(bed.crop,bed.trait).name,
      token:[visit.serial,farm.day,farm.workToday,index,bed.crop,bed.trait].join(':')}
  }
}

export function showStandingVisitCrop(farm:FarmState,token:string):ActionResult {
  const plant=standingVisitCrop(farm)
  if(!plant||plant.token!==token)return {ok:false,message:'Эту грядку сейчас нельзя показать.'}
  const memory=noteNeighborVisit(farm,'crop',cropDefinitions[plant.crop].name,`${plant.name} на грядке №${plant.index+1}. Урожай не срывали.`)
  return {ok:true,message:`Урожай остался на грядке.${memory}`}
}
