export type CoveChoices={flow:'open'|'sheltered';cover:'meadow'|'kelp';refuge:'stones'|'sand'}
export const coveObservationIds=['crab-refuge','crab-foraging','egret-wading','egret-watching','minnow-nursery','minnow-migration','meadow-wings'] as const
export type CoveObservationId=typeof coveObservationIds[number]
export const coveObservationDefinitions:Record<CoveObservationId,{name:string;description:string}>={
 'crab-refuge':{name:'Каменное укрытие',description:'Крабы отдыхают в безопасности между камнями.'},'crab-foraging':{name:'Открытый песок',description:'Крабы ищут пищу на песчаном берегу.'},'egret-wading':{name:'Путь по мелководью',description:'Цапля идёт вдоль открытого течения к кормовому мелководью.'},'egret-watching':{name:'Тихий дозор',description:'Цапля терпеливо наблюдает за тихим мелководьем.'},'minnow-nursery':{name:'Ясли мальков',description:'Мальки неторопливо плавают стайкой в защищённой бухте.'},'minnow-migration':{name:'Путь по течению',description:'Мальки движутся вдоль открытого протока.'},'meadow-wings':{name:'Гости луга',description:'Цветущий луг привлекает больше бабочек.'},
}
export type ShorelineState={settled:CoveChoices|null;pending:CoveChoices|null;changedOn:number;settledOn:number;revision:number;observations:CoveObservationId[]}
export type CoveFishingHabitat=CoveChoices&{profile:'nursery'|'channel';revision:number;current:number;shelter:number;seaBassWeight:number;perchWeight:number;rareWeight:number}
export const covePresets={nursery:{flow:'sheltered',cover:'kelp',refuge:'sand'},channel:{flow:'open',cover:'meadow',refuge:'stones'}} as const
export function createShoreline():ShorelineState{return {settled:null,pending:null,changedOn:0,settledOn:0,revision:0,observations:[]}}
export function isCoveChoices(v:unknown):v is CoveChoices{if(!v||typeof v!=='object')return false;const p=v as CoveChoices;return ['open','sheltered'].includes(p.flow)&&['meadow','kelp'].includes(p.cover)&&['stones','sand'].includes(p.refuge)}
export function sameCove(a:CoveChoices|null,b:CoveChoices|null):boolean{return a===b||!!a&&!!b&&a.flow===b.flow&&a.cover===b.cover&&a.refuge===b.refuge}
export function getCoveEcology(shoreline:ShorelineState,day:number){
 const source=shoreline.settled??{flow:'sheltered',cover:'meadow',refuge:'sand'} as CoveChoices
 const choices:CoveChoices={flow:source.flow,cover:source.cover,refuge:source.refuge}
 const channel=choices.flow==='open',kelp=choices.cover==='kelp',stones=choices.refuge==='stones'
 return {choices,active:shoreline.settled!==null,revision:shoreline.revision,phase:(day+shoreline.revision*3)%5,animals:{crab:{mode:stones?'shelter' as const:'forage' as const,speed:stones?.6:1.15,refuge:stones},egret:{mode:channel?'wade' as const:'watch' as const,speed:channel?.85:.45},minnows:{mode:channel?'migrate' as const:'school' as const,speed:channel?1.25:.65,count:kelp?7:4},butterflies:{mode:kelp?'edge' as const:'meadow' as const,count:kelp?2:5}},fishing:{profile:channel?'channel' as const:'nursery' as const,revision:shoreline.revision,...choices,current:channel?.8:.25,shelter:stones?.8:.35,seaBassWeight:kelp?.7:.45,perchWeight:kelp?.3:.55,rareWeight:channel?1.25:.75}}
}
export function settleCove(shoreline:ShorelineState,day:number):ShorelineState{
 if(!shoreline.pending)return shoreline
 const choices={...shoreline.pending},observations=[...shoreline.observations]
 const found:CoveObservationId[]=[choices.refuge==='stones'?'crab-refuge':'crab-foraging',choices.flow==='open'?'egret-wading':'egret-watching',choices.flow==='open'?'minnow-migration':'minnow-nursery',...(choices.cover==='meadow'?['meadow-wings' as const]:[])]
 for(const id of found)if(!observations.includes(id))observations.push(id)
 return {...shoreline,settled:choices,pending:null,settledOn:day,revision:shoreline.revision+1,observations}
}
/** Identifies the displayed pending plan without adding persisted fields. */
export function covePlanKey(shoreline: ShorelineState): string | null {
 const plan=shoreline.pending
 return plan ? `${shoreline.revision}:${shoreline.changedOn}:${plan.flow}:${plan.cover}:${plan.refuge}` : null
}
/** A detached preview of the next tide, never an early application or discovery. */
export function getCoveForecast(shoreline: ShorelineState, day: number) {
 if (!shoreline.pending) return null
 return { day: day + 1, ecology: getCoveEcology(settleCove(shoreline, day + 1), day + 1) }
}
export function restoreShoreline(value:unknown,day:number):ShorelineState|undefined{
 if(value===undefined)return createShoreline()
 if(!value||typeof value!=='object')return
 const v=value as ShorelineState,integer=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=day
 if(v.settled!==null&&!isCoveChoices(v.settled)||v.pending!==null&&!isCoveChoices(v.pending)||!integer(v.changedOn)||!integer(v.settledOn)||!integer(v.revision)||v.revision>0&&(!v.settled||v.settledOn===0)||v.revision===0&&(v.settled!==null||v.settledOn!==0)||v.pending!==null&&v.changedOn!==day||!Array.isArray(v.observations)||v.revision===0&&v.observations.length>0||new Set(v.observations).size!==v.observations.length||!v.observations.every(id=>(coveObservationIds as readonly string[]).includes(id)))return
 const choices=(p:CoveChoices)=>({flow:p.flow,cover:p.cover,refuge:p.refuge})
 return {settled:v.settled?choices(v.settled):null,pending:v.pending?choices(v.pending):null,changedOn:v.changedOn,settledOn:v.settledOn,revision:v.revision,observations:[...v.observations]}
}
export function isCoveFishingHabitat(value:unknown):value is CoveFishingHabitat{
 if(!isCoveChoices(value))return false
 const v=value as CoveFishingHabitat
 return v.profile===(v.flow==='open'?'channel':'nursery')&&Number.isSafeInteger(v.revision)&&v.revision>0&&v.current===(v.flow==='open'?.8:.25)&&v.shelter===(v.refuge==='stones'?.8:.35)&&v.seaBassWeight===(v.cover==='kelp'?.7:.45)&&v.perchWeight===(v.cover==='kelp'?.3:.55)&&v.rareWeight===(v.flow==='open'?1.25:.75)
}
export function copyCoveFishingHabitat(v:CoveFishingHabitat):CoveFishingHabitat{return {flow:v.flow,cover:v.cover,refuge:v.refuge,profile:v.profile,revision:v.revision,current:v.current,shelter:v.shelter,seaBassWeight:v.seaBassWeight,perchWeight:v.perchWeight,rareWeight:v.rareWeight}}
