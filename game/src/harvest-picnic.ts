import { cropDefinitions, getBedHarvestPreview, getBedStage, type FarmState } from './farm.ts'

/** A saved portion does not make a crop ripen. Preview the same field rule used on harvest,
 * including climate traits; the first ripe bed is one suggestion, never a reserved target. */
export function harvestPicnicBed(farm:FarmState) {
  const index=farm.beds.findIndex(bed=>getBedStage(bed)==='ripe')
  if(index<0)return
  const home={...farm,island:'home' as const}
  const normal=getBedHarvestPreview({...home,culinary:{...home.culinary,picnic:null}},index)!
  const bonus=getBedHarvestPreview({...home,culinary:{...home.culinary,picnic:{processing:'chunky',day:farm.day}}},index)!
  return {index,name:cropDefinitions[normal.crop].name,normal:normal.total,total:bonus.total,
    token:[farm.day,index,normal.crop,normal.trait??'-',bonus.total].join(':')}
}

export function harvestPicnicOffer(farm:FarmState) {
  const bed=harvestPicnicBed(farm)
  return bed ? `Грядка №${bed.index+1} · ${bed.name}: сейчас ×${bed.normal}, с пикником ×${bed.total}.`
    : 'На домашних грядках пока ничего не созрело. Оставьте порцию до урожая: после сна бонус исчезнет.'
}

export function activeHarvestPicnic(farm:FarmState) {
  const picnic=farm.culinary.picnic
  return picnic?.processing==='chunky'&&picnic.day===farm.day ? harvestPicnicBed(farm) : undefined
}

/** Generated only from game-owned crop names, bounded numeric fields and trait ids. */
export function renderHarvestPicnicRoute(farm:FarmState) {
  const bed=activeHarvestPicnic(farm)
  if(!bed)return ''
  return `<button type="button" class="dialog-button secondary" data-action="picnic-field" data-value="${bed.token}">${farm.island==='home'?'Показать грядку':'Плыть домой · грядка'} №${bed.index+1} · ${bed.name} ×${bed.total}</button>`
}
