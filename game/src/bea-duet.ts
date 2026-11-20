import type { FarmState } from './farm.ts'

export function canPlayWithBea(farm:Pick<FarmState,'island'|'village'|'neighbors'>) {
  return farm.island==='village'&&farm.village.built&&farm.village.residents.includes('bea')&&farm.neighbors.bea.completed>0
}

/** One cancellable live reply. No audio-clock lookahead, score writes, or interval. */
export class BeaDuet {
  private last?:{note:number;at:number}
  private timer?:number
  private serial=0
  private now:()=>number
  private later:(cb:()=>void,ms:number)=>number
  private clear:(id:number)=>void
  private answer:(note:number,last:boolean)=>void
  constructor(now:()=>number,later:(cb:()=>void,ms:number)=>number,clear:(id:number)=>void,answer:(note:number,last:boolean)=>void){
    this.now=now;this.later=later;this.clear=clear;this.answer=answer
  }
  cancel(){if(this.timer!==undefined)this.clear(this.timer);this.timer=undefined;this.last=undefined;this.serial++}
  tap(note:number){
    const at=this.now(),prior=this.last
    this.cancel();this.last={note,at}
    const gap=prior?at-prior.at:0
    if(!prior||gap<100||gap>1200)return
    const serial=this.serial
    const after=(when:number,cb:()=>void)=>{
      this.timer=this.later(()=>{
        if(serial!==this.serial)return
        this.timer=undefined
        if(this.now()-when>140){this.last=undefined;return} // never burst a throttled phrase
        cb()
      },Math.max(0,when-this.now()))
    }
    const first=at+Math.max(290,Math.min(720,gap*1.15))
    after(first,()=>{
      this.last=undefined
      // Mirror the contour back to the player's opening note, even for a single-pitch call.
      this.answer(prior.note===note?(note<=5?note+2:note-2):note,false)
      if(serial===this.serial)after(this.now()+gap,()=>this.answer(prior.note,true))
    })
  }
}
