import {getBedAction,type Bed,type BedAction,type FarmState} from './farm.ts'
import {seedForBed} from './garden-plans.ts'

export type BedWorkIntent={index:number;day:number;bed:Bed;kind:BedAction['kind'];available:boolean;seed?:string}

/** Queue the work the player actually saw, not whatever the same tile becomes later. */
export function planBedWork(farm:FarmState,index:number):BedWorkIntent|undefined{
  if(farm.island!=='home'||!Number.isInteger(index)||!farm.beds[index])return
  const action=getBedAction(farm,index)
  return {index,day:farm.day,bed:{...farm.beds[index]},kind:action.kind,available:action.available,
    ...(action.kind==='plant'?{seed:seedForBed(farm,index)}:{})}
}

export function isCurrentBedWork(farm:FarmState,intent:BedWorkIntent):boolean{
  if(farm.island!=='home'||farm.day!==intent.day||JSON.stringify(farm.beds[intent.index])!==JSON.stringify(intent.bed))return false
  const action=getBedAction(farm,intent.index)
  return action.kind===intent.kind&&action.available===intent.available
    &&(intent.kind!=='plant'||seedForBed(farm,intent.index)===intent.seed)
}

export function bedWorkKind(farm:FarmState,intent:BedWorkIntent):BedAction['kind']{
  return isCurrentBedWork(farm,intent)&&intent.available?intent.kind:'wait'
}

/** PointerEvent.detail is often zero; a canvas tap still owns its repeat gesture. */
export class BedPointerGuard {
  private previous:number|undefined
  private previousAt=0
  accepts(index:number|undefined,event:{timeStamp:number;clientX?:number;clientY?:number}):boolean{
    if(index===undefined){this.previous=undefined;return true}
    if(this.previous===index&&event.timeStamp>=this.previousAt&&event.timeStamp-this.previousAt<=500)return false
    this.previous=index;this.previousAt=event.timeStamp;return true
  }
}
