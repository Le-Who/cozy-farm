import type { ActionResult, FarmState, ResidentId } from './farm.ts'

export const visitActivityIds = ['beaHarvest', 'beaHands', 'beaFlock', 'finnGarden', 'finnOrchard', 'finnFlock'] as const
export type VisitActivityId = typeof visitActivityIds[number]
export type VisitMoment = 'crop' | 'pastry' | 'hen' | 'fruit'
export const visitActivities: Record<VisitActivityId, { resident: ResidentId; title: string; kind: VisitMoment; invitation: string; goal: string; memory: string; quiet: string; curious: string; point: {x:number;y:number} }> = {
  beaHarvest: { resident:'bea',title:'От грядки до кухни',kind:'crop',invitation:'В гостях всегда замечаю запахи. Покажешь, что у тебя сегодня созрело? Угощение не нужно: урожай оставь себе.',goal:'Соберите любой зрелый урожай на домашней грядке.',memory:'Беа вспоминает, как вы выбирали урожай прямо с грядки. «Теперь я знаю, с чего начинается твоя кухня».',quiet:'«Мне тоже нравится готовить из того, что уже поспело. Тогда день сам подсказывает рецепт».',curious:'«Я бы сначала попробовала маленький кусочек. У каждого урожая свой характер, не будем его прятать».',point:{x:1090,y:460}},
  beaHands: { resident:'bea',title:'Печём рядом',kind:'pastry',invitation:'Сегодня я не пекарь за прилавком, а гость. Хочу посмотреть, как ты лепишь свою выпечку. Готовое изделие останется у тебя.',goal:'Испеките вручную булочку, слойку или батон в кондитерской.',memory:'Беа помнит вашу домашнюю выпечку и следы муки на столе. «У каждого руки работают по-своему. Вот это мне и интересно».',quiet:'«Не стану выравнивать твою булочку. Такие складочки и делают её домашней».',curious:'«В следующий раз можно попробовать другой силуэт. Только если захочется, а не ради образца».',point:{x:1090,y:420}},
  beaFlock: { resident:'bea',title:'Знакомство со стаей',kind:'hen',invitation:'Слышно, как тебя встречают курочки. Познакомишь меня с одной? Можно просто назвать её, не нужно лишних угощений.',goal:'Погладьте курочку или представьте её гостю здесь.',memory:'Беа выучила имя вашей курочки. «Теперь, когда буду печь с домашними яйцами, вспомню не корзинку, а вашу стаю».',quiet:'«Посидим немного у калитки. Пусть она сама решит, подойти ли поближе».',curious:'«Забавно, как быстро начинаешь различать их привычки. Я бы ещё послушала твои истории».',point:{x:452,y:680}},
  finnGarden: { resident:'finn',title:'Огород после рыбалки',kind:'crop',invitation:'У воды я умею ждать. А вот как понять, что овощ созрел, лучше покажешь ты. Соберём что-нибудь для твоих запасов?',goal:'Соберите любой зрелый урожай на домашней грядке.',memory:'Финн вспоминает ваш огород. «Урожай, как хороший улов: его приятно дождаться, но ещё приятнее знать, откуда он».',quiet:'«Мне нравится, что здесь можно не торопиться. Посмотрим, как шевелятся листья».',curious:'«Когда-нибудь я расскажу, что сейчас ловится у берега, а ты покажешь, что поспевает здесь».',point:{x:1100,y:625}},
  finnOrchard: { resident:'finn',title:'Под фруктовым деревом',kind:'fruit',invitation:'На ферме берег слышится совсем иначе. Покажешь дерево со спелыми плодами? Срывай для себя, мне достаточно компании.',goal:'Соберите плоды домашнего дерева.',memory:'Финн запомнил тень вашего фруктового дерева. «Хорошее место, чтобы вернуться с берега и немного посидеть».',quiet:'«Подождём, пока ветер утихнет. Так лучше слышно и сад, и море».',curious:'«Саженец однажды становится целым местом для встреч. Люблю такие долгие перемены».',point:{x:1300,y:555}},
  finnFlock: { resident:'finn',title:'Кто встречает у калитки',kind:'hen',invitation:'На пристани все узнают лодки, а здесь, кажется, курочки узнают шаги. Кто обычно встречает тебя первым?',goal:'Погладьте курочку или представьте её гостю здесь.',memory:'Финн познакомился с вашей курочкой. «Здорово возвращаться туда, где тебя уже ждут».',quiet:'«Не будем шуметь. У каждой стаи свой спокойный распорядок».',curious:'«В следующий раз я попробую узнать её сам. Проверишь, не перепутал ли?»',point:{x:450,y:685}},
}
export type VisitObservation = { subject: string; detail: string }
export type VisitMemory = VisitObservation & { activity: VisitActivityId; day: number; serial: number; reply: 'quiet'|'curious'|null }
export type NeighborVisit = { serial: number; activity: VisitActivityId; startedOn: number; observation: VisitObservation|null }
export type NeighborVisits = { serial: number; active: NeighborVisit|null; memories: VisitMemory[] }
export const createNeighborVisits = (): NeighborVisits => ({serial:0,active:null,memories:[]})
export const isVisitActivity = (id: unknown): id is VisitActivityId => typeof id==='string' && visitActivityIds.includes(id as VisitActivityId)
export const visitName = (resident: ResidentId) => resident==='bea'?'Беа':'Финн'
export function canInviteNeighbor(farm: FarmState, resident: ResidentId) {
  return farm.island==='home' && farm.village.built && farm.village.residents.includes(resident) && farm.neighbors[resident].completed>0
}
export function inviteNeighborVisit(farm: FarmState, activity: unknown): ActionResult {
  if(!isVisitActivity(activity)||!canInviteNeighbor(farm,visitActivities[activity].resident))return {ok:false,message:'Сначала устройте хотя бы одну встречу с этим соседом в Лавандовой гавани, затем вернитесь домой.'}
  if(farm.neighborVisits.active)return {ok:false,message:'На ферме уже есть гость. Сначала попрощайтесь с ним.'}
  if(farm.neighborVisits.serial>=1_000_000)return {ok:false,message:'Гостевая книга заполнена.'}
  farm.neighborVisits.active={serial:++farm.neighborVisits.serial,activity,startedOn:farm.day,observation:null}
  return {ok:true,message:`${visitName(visitActivities[activity].resident)} идёт к вам в гости. ${visitActivities[activity].goal}`}
}
/** Called only by successful ordinary farm work. The visit never takes its produce or grants a bonus. */
export function noteNeighborVisit(farm: FarmState, kind: VisitMoment, subject: string, detail: string): string {
  const visit=farm.neighborVisits.active
  if(farm.island!=='home'||!visit||visit.startedOn!==farm.day||visit.observation||visitActivities[visit.activity].kind!==kind)return ''
  visit.observation={subject,detail}
  if(!farm.neighborVisits.memories.some(m=>m.activity===visit.activity))farm.neighborVisits.memories.push({activity:visit.activity,day:farm.day,serial:visit.serial,subject,detail,reply:null})
  return ` ${visitName(visitActivities[visit.activity].resident)} запомнил${visitActivities[visit.activity].resident==='bea'?'а':''} этот момент. Загляните в гостевую книгу.`
}
export function finishNeighborVisit(farm: FarmState, serial: number, reply?: unknown): ActionResult {
  const visit=farm.neighborVisits.active
  if(farm.island!=='home'||!visit||visit.serial!==serial)return {ok:false,message:'Этот визит уже закончился.'}
  if(reply!==undefined&&(!visit.observation||(reply!=='quiet'&&reply!=='curious')))return {ok:false,message:'Сначала проведите время с гостем.'}
  const name=visitName(visitActivities[visit.activity].resident)
  const memory=farm.neighborVisits.memories.find(m=>m.serial===visit.serial)
  if(memory&&reply!==undefined)memory.reply=reply as 'quiet'|'curious'
  farm.neighborVisits.active=null
  return {ok:true,message:`${name} возвращается в гавань. ${visit.observation?'Воспоминание осталось в гостевой книге.':'Можно пригласить снова, когда будет удобно.'}`}
}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const count=(v:unknown,max=1_000_000):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=180&&!/[<>\x00-\x1f]/.test(v)
const observation=(v:unknown):v is VisitObservation=>record(v)&&Object.keys(v).length===2&&text(v.subject)&&text(v.detail)
export function restoreNeighborVisits(value:unknown,day:number,island:string):NeighborVisits|undefined {
  if(value===undefined)return createNeighborVisits()
  if(!record(value)||!count(value.serial)||!Array.isArray(value.memories)||value.memories.length>visitActivityIds.length)return
  const result=createNeighborVisits();result.serial=value.serial
  for(const m of value.memories){
    if(!record(m)||!isVisitActivity(m.activity)||!count(m.day,day)||m.day===0||!count(m.serial,value.serial)||m.serial===0||!text(m.subject)||!text(m.detail)||![null,'quiet','curious'].includes(m.reply as null)
      ||result.memories.some(other=>other.activity===m.activity||other.serial===m.serial)||m.serial<=(result.memories.at(-1)?.serial??0)||m.day<(result.memories.at(-1)?.day??0))return
    result.memories.push({activity:m.activity,day:m.day,serial:m.serial,subject:m.subject,detail:m.detail,reply:m.reply as VisitMemory['reply']})
  }
  if(value.active!==null){
    const v=value.active
    if(!record(v)||!isVisitActivity(v.activity)||v.startedOn!==day||island!=='home'||v.serial!==value.serial||v.serial===0||v.observation!==null&&!observation(v.observation))return
    if(v.observation!==null&&!result.memories.some(m=>m.activity===v.activity))return
    if(result.memories.some(m=>m.serial===v.serial&&(m.activity!==v.activity||m.day!==day||!v.observation||m.subject!==(v.observation as VisitObservation).subject||m.detail!==(v.observation as VisitObservation).detail||m.reply!==null)))return
    result.active={serial:v.serial,activity:v.activity,startedOn:day,observation:v.observation?{...v.observation as VisitObservation}:null}
  }
  return result
}
