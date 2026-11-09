export type HoneyFamily = 'honeyPear' | 'honeyBiscuits' | 'windParfait' | 'honeyCake'
export type HoneyPoint = { x: number; y: number }
/** A retained viscous film in food coordinates. Each exchange conserves material,
 * including the no-flux boundary of the cut face. Heights never depend on opacity. */
export function createHoneyFilm(size:number,region:ArrayLike<number>,edgeDistance?:ArrayLike<number>){
 const height=new Float32Array(size*size),scratch=new Float32Array(height.length),boundary:number[]=[],capacity=new Float32Array(height.length)
 if(!edgeDistance)for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x;if(region[i]>128&&(x===0||y===0||x===size-1||y===size-1||region[i-1]<=128||region[i+1]<=128||region[i-size]<=128||region[i+size]<=128))boundary.push(i)}
 // A pinned wet edge has a rounded contact profile. Pressure redistributes the
 // same retained volume inward instead of cutting a raised sheet off at the rim.
 for(let i=0;i<height.length;i++){if(region[i]<=128)continue;const x=i%size,y=Math.floor(i/size);let distance=36;for(const j of boundary)distance=Math.min(distance,(x-j%size)**2+(y-Math.floor(j/size))**2);const t=Math.min(1,(edgeDistance?edgeDistance[i]:Math.sqrt(distance)+.5)/6);capacity[i]=Math.max(.035,t*t*(3-2*t))}
 let active=false,dirty=false
 return {height,
  deposit(point:HoneyPoint,amount:number,radius=.045){
   if(![point.x,point.y,amount,radius].every(Number.isFinite)||amount<=0||radius<=0)return
   const cx=point.x*size,cy=point.y*size,r=radius*size,reach=Math.ceil(r*3)
   for(let y=Math.max(0,Math.floor(cy-reach));y<Math.min(size,Math.ceil(cy+reach));y++)for(let x=Math.max(0,Math.floor(cx-reach));x<Math.min(size,Math.ceil(cx+reach));x++){
    const i=y*size+x;if(region[i]<=128)continue
    const d=((x+.5-cx)**2+(y+.5-cy)**2)/(r*r)
    height[i]+=amount*Math.exp(-d*.5)/(2*Math.PI*r*r);active=true;dirty=true
   }
  },
  step(seconds:number,gravity:HoneyPoint={x:0,y:0}){
   if(!active||!Number.isFinite(seconds)||seconds<=0)return false
   const dt=Math.min(seconds,.05),steps=Math.ceil(dt/(1/120)),k=dt/steps*6
   let moved=0
   for(let step=0;step<steps;step++){
    scratch.fill(0)
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
     const i=y*size+x;if(region[i]<=128)continue
     for(let axis=0;axis<2;axis++){
      const j=axis===0?(x+1<size?i+1:-1):(y+1<size?i+size:-1),slope=axis===0?gravity.x:gravity.y
      if(j<0||region[j]<=128)continue
      const a=height[i],b=height[j],depth=(a+b)*.5,mobility=(.003+.12*Math.min(14,depth**3))*Math.min(capacity[i],capacity[j]),pressure=(a/capacity[i]-b/capacity[j])+slope*.075*Math.min(a,b)
      const flux=Math.max(-b*.20,Math.min(a*.20,pressure*mobility*k))
      scratch[i]-=flux;scratch[j]+=flux;moved+=Math.abs(flux)
     }
    }
    for(let i=0;i<height.length;i++)height[i]=Math.max(0,height[i]+scratch[i])
   }
   const changed = dirty; dirty = false; active = moved > .0001;
   return active || changed
  },
  coverage(){let total=0,wet=0;for(let i=0;i<height.length;i++)if(region[i]>128){total++;if(height[i]>=.30)wet++}return total?wet/total:0},
  maxPressure(){let maximum=0;for(let i=0;i<height.length;i++)if(region[i]>128)maximum=Math.max(maximum,height[i]/capacity[i]);return maximum},
 }
}
export type HoneyStage = 'cut' | 'shape' | 'mix' | 'bake-ready' | 'baking' | 'custard' | 'fruit' | 'glaze' | 'settling' | 'ready' | 'committing' | 'finished' | 'cancelled'
export type HoneyTool = 'knife' | 'hand' | 'spoon' | 'honey'
export type HoneyFruit = HoneyPoint & { id: number; angle: number; ingredientId: string }
export type HoneyPiece = { work: number; pressure: number }
export type HoneyModel = {
  family: HoneyFamily; stage: HoneyStage; cuts: Set<number>; pieces: HoneyPiece[];
  mixed: number; sectors: Set<number>; coverage: Set<number>; travel: number; fruit: HoneyFruit[];
  last: HoneyPoint | null; start: HoneyPoint | null; tool: HoneyTool | null; baked: number; steps: string[];
  cutTracks: { angle: number; bins: Set<number>; progress: number; offset: number }[]; pending: HoneyStage | null; settledFor: number; deposited: Map<number, number>; coated: Map<number,number>;
  parfaitCustard:number; parfaitHoney:number;
}
export const honeyPearCenters: readonly HoneyPoint[] = [{ x: -.44, y: 0 }, { x: .44, y: 0 }]
export const honeyBiscuitCenters: readonly HoneyPoint[] = [{ x: -.48, y: -.39 }, { x: .48, y: -.39 }, { x: -.48, y: .39 }, { x: .48, y: .39 }]
export const HONEY_MIX_REQUIRED = Math.PI * 4
export const HONEY_BAKE_SECONDS = 2.4
export const HONEY_PEAR_DRIZZLE = .25
export const HONEY_PEAR_EACH_HALF = .15
const disk = (radius: number, count: number): HoneyPoint[] => Array.from({ length: count }, (_, i) => ({ x: Math.cos(i / count * Math.PI * 2) * radius, y: Math.sin(i / count * Math.PI * 2) * radius }))
export function honeyCoverageTargets(family: HoneyFamily, stage: HoneyStage): HoneyPoint[] {
  if (family === 'honeyBiscuits') return honeyBiscuitCenters.flatMap(center => [{ ...center }, ...disk(.27, 8).map(point => ({ x: center.x + point.x, y: center.y + point.y * .8 }))])
  if (family === 'honeyPear') return honeyPearCenters.flatMap(center => [{ ...center }, ...disk(.19, 7).map(point => ({ x: center.x + point.x, y: center.y + point.y }))])
  return [{ x: 0, y: 0 }, ...disk(.36, 8), ...disk(stage === 'custard' ? .65 : .72, 14)]
}
export function createHoneyModel(family: HoneyFamily): HoneyModel {
  return { family, stage: family === 'honeyPear' ? 'cut' : family === 'honeyBiscuits' ? 'shape' : family === 'honeyCake' ? 'mix' : 'custard',
    cuts: new Set(), pieces: honeyBiscuitCenters.map(() => ({ work: 0, pressure: 0 })),
    mixed: 0, sectors: new Set(), coverage: new Set(), travel: 0, fruit: [], last: null, start: null, tool: null, baked: 0, steps: [],
    cutTracks: honeyPearCenters.map(() => ({ angle: 0, bins: new Set<number>(), progress: 0, offset: 0 })), pending: null, settledFor: 0, deposited: new Map(),coated:new Map(),parfaitCustard:0,parfaitHoney:0 }
}
export function onHoneySurface(point: HoneyPoint, radius = 1.03): boolean { return Number.isFinite(point.x) && Number.isFinite(point.y) && Math.hypot(point.x, point.y) <= radius }
function distance(point: HoneyPoint, a: HoneyPoint, b: HoneyPoint): number {
  const x = b.x - a.x, y = b.y - a.y, d = x * x + y * y, t = d ? Math.max(0, Math.min(1, ((point.x - a.x) * x + (point.y - a.y) * y) / d)) : 0
  return Math.hypot(point.x - a.x - x * t, point.y - a.y - y * t)
}
function stage(model: HoneyModel, next: HoneyStage, step: string): void {
  model.stage = next; model.steps.push(step); model.last = null; model.start = null; model.coverage.clear(); model.deposited.clear(); model.travel = 0
}
export function beginHoneyStroke(model: HoneyModel, tool: HoneyTool, point: HoneyPoint): void {
  model.tool = tool; model.start = { ...point }; model.last = { ...point }
}
export function endHoneyStroke(model: HoneyModel): void {
  model.last = null; model.start = null; model.tool = null
  if (model.pending) { const next = model.pending; model.pending = null; stage(model, next, next === 'glaze' ? 'cut-pears' : next === 'fruit' ? 'layer-custard' : 'pour-honey'); model.settledFor = 0 }
}
/** View supplies a real surface trace; recipe state owns the resulting irreversible cut. */
export function recordHoneyKnife(model: HoneyModel, piece: number, localAngle: number, bins: Iterable<number>, offset = 0): boolean {
  if(model.family!=='honeyPear'||model.stage!=='cut'||model.tool!=='knife'||!Number.isInteger(piece)||piece<0||piece>1||!Number.isFinite(localAngle))return false
  const track=model.cutTracks[piece];track.angle=localAngle;track.offset=Number.isFinite(offset)?offset:0
  track.bins=new Set([...bins].filter(bin=>Number.isInteger(bin)&&bin>=0&&bin<16))
  track.progress=track.bins.size/16
  if(track.progress>=.875)model.cuts.add(piece)
  if(model.cuts.size===2)model.pending='glaze'
  return true
}
/** Readiness follows release and a physically quiet worktop, never a pointer event alone. */
export function settleHoney(model: HoneyModel, seconds: number, stable: boolean): void {
  if (model.stage !== 'settling' || !Number.isFinite(seconds) || seconds <= 0) return
  model.settledFor = stable ? model.settledFor + Math.min(seconds, .1) : 0
  if (model.settledFor >= .12) model.stage = 'ready'
}
/** The view has already hit the deformed solid; work belongs to that material piece, not an old screen circle. */
export function workHoneyPiece(model:HoneyModel,index:number,distanceMoved:number,seconds:number,pressure:number):boolean{
 if(!['shape','bake-ready'].includes(model.stage)||!Number.isInteger(index)||index<0||index>=model.pieces.length||![distanceMoved,seconds,pressure].every(Number.isFinite)||distanceMoved<0||seconds<0)return false
 const piece=model.pieces[index],force=Math.max(0,Math.min(1,pressure))
 piece.pressure=Math.max(piece.pressure,force);piece.work+=Math.min(.4,distanceMoved)*force+Math.min(.05,seconds)*.18*force
 if(model.stage==='shape'&&model.pieces.filter(p=>p.work>=.36).length>=2&&model.pieces.reduce((sum,p)=>sum+p.work,0)>=1.5)stage(model,'bake-ready','shape-biscuits')
 return true
}
export function moveHoneyStroke(model: HoneyModel, point: HoneyPoint, depositedAmount = 1): number {
  if(model.family==='windParfait'&&(model.stage==='custard'||model.stage==='glaze'))return 0
  const previous = model.last, start = model.start, tool = model.tool
  model.last = { ...point }
  if (!previous || !start || !tool || !onHoneySurface(point, 1.2)) return 0
  const length = Math.hypot(point.x - previous.x, point.y - previous.y)
  if (length < .004 && model.stage !== 'glaze' && model.stage !== 'custard') return 0
  if (model.stage === 'mix' && tool === 'spoon' && length < .85 && Math.hypot(point.x, point.y) > .2 && Math.hypot(previous.x, previous.y) > .2) {
    const angle = Math.atan2(point.y, point.x), old = Math.atan2(previous.y, previous.x), turn = Math.atan2(Math.sin(angle - old), Math.cos(angle - old))
    model.mixed += Math.abs(turn)
    model.sectors.add(Math.floor(((angle + Math.PI * 4) % (Math.PI * 2)) / (Math.PI * 2) * 16))
    if (model.mixed >= HONEY_MIX_REQUIRED && model.sectors.size >= 14) stage(model, 'bake-ready', 'mix-batter')
  } else if ((model.stage === 'custard' && tool === 'spoon' || model.stage === 'glaze' && tool === 'honey' && model.family !== 'honeyPear' && model.family !== 'honeyBiscuits') && onHoneySurface(point)) {
    model.travel += length
    honeyCoverageTargets(model.family, model.stage).forEach((target, index) => {
      if (distance(target, previous, point) >= .2) return
      const amount = Math.min(1, (model.deposited.get(index) ?? 0) + Math.max(0,Math.min(1,Number.isFinite(depositedAmount) ? depositedAmount : 0)))
      model.deposited.set(index,amount);if(amount >= .45)model.coverage.add(index)
    })
    const required = Math.ceil(honeyCoverageTargets(model.family, model.stage).length * .72)
    if (model.coverage.size >= required && model.travel >= (model.stage === 'custard' ? 1.3 : 2.2)) {
      model.pending = model.stage === 'custard' ? 'fruit' : 'settling'
    }
  }
  return length
}
/** The glass receives a finite spoonful, rather than credit for an empty sweep. */
export function depositParfaitCustard(model:HoneyModel,amount:number):void{
  if(model.family!=='windParfait'||model.stage!=='custard'||model.tool!=='spoon'||!Number.isFinite(amount)||amount<=0)return
  model.parfaitCustard=Math.min(1,model.parfaitCustard+amount)
  if(model.parfaitCustard>=.999)model.pending='fruit'
}
/** A continuous pour inside this single vessel spreads over its contained top. */
export function depositParfaitHoney(model:HoneyModel,point:HoneyPoint,seconds:number):void{
  if(model.family!=='windParfait'||model.stage!=='glaze'||model.tool!=='honey'||!onHoneySurface(point,1.12)||!Number.isFinite(seconds)||seconds<=0)return
  model.parfaitHoney=Math.min(1,model.parfaitHoney+Math.min(seconds,.05)/2.1)
  if(model.parfaitHoney>=.999)model.pending='settling'
}
/** Material coordinates attach coating to the worked biscuit rather than its original screen position. */
export function depositHoneyPiece(model: HoneyModel, piece: number, from: HoneyPoint, to: HoneyPoint, amount: number): boolean {
  if(model.family!=='honeyBiscuits'||model.stage!=='glaze'||model.tool!==null&&model.tool!=='honey'||!Number.isInteger(piece)||piece<0||piece>3||!Number.isFinite(amount)||amount<=0||![from.x,from.y,to.x,to.y].every(v=>Number.isFinite(v)&&v>=0&&v<=1))return false
  model.travel+=Math.hypot(to.x-from.x,to.y-from.y)
  const targets=[{x:.5,y:.5},...disk(.32,8).map(p=>({x:.5+p.x,y:.5+p.y}))]
  targets.forEach((target,index)=>{if(distance(target,from,to)>.17)return;const key=piece*targets.length+index,dose=Math.min(1,(model.deposited.get(key)??0)+Math.min(1,amount));model.deposited.set(key,dose);if(dose>=.45)model.coverage.add(key)})
  if(model.coverage.size>=Math.ceil(targets.length*4*.72)&&model.travel>=2.2)model.pending='settling'
  return true
}
export function measuredHoneyCoverage(region:ArrayLike<number>,rgba:ArrayLike<number>):number {
  let covered=0,total=0
  for(let i=0;i<region.length;i++)if(region[i]>128){total++;if(rgba[i*4]>=96)covered++}
  return total?covered/total:0
}
export function reportHoneyCoating(model:HoneyModel,piece:number,coverage:number):void{
  if(model.family!=='honeyPear'||model.stage!=='glaze'||!Number.isInteger(piece)||piece<0||piece>3||!Number.isFinite(coverage))return
  model.coated.set(piece,Math.max(model.coated.get(piece)??0,Math.min(1,Math.max(0,coverage))))
  const portions=Array.from({length:4},(_,i)=>model.coated.get(i)??0)
  if(portions.every(p=>p>=HONEY_PEAR_EACH_HALF)&&portions.reduce((sum,p)=>sum+p,0)/4>=HONEY_PEAR_DRIZZLE)model.pending='settling'
}
/** Synchronize one complete physical frame, including hands-off spreading.
 * The view never turns past peak coverage into permanent preparation credit. */
export function syncHoneyCoating(model:HoneyModel,coverage:readonly number[]):void{
 if(model.family!=='honeyPear'||!['glaze','settling'].includes(model.stage)||coverage.length!==4||!coverage.every(Number.isFinite))return
 coverage.forEach((value,index)=>model.coated.set(index,Math.max(0,Math.min(1,value))))
 const complete=coverage.every(p=>p>=HONEY_PEAR_EACH_HALF)&&coverage.reduce((sum,p)=>sum+p,0)/4>=HONEY_PEAR_DRIZZLE
 if(!complete){if(model.pending==='settling')model.pending=null;if(model.stage==='settling'){model.stage='glaze';model.settledFor=0;if(model.steps.at(-1)==='pour-honey')model.steps.pop()}return}
 if(model.stage==='glaze'){model.pending='settling';if(model.tool===null)endHoneyStroke(model)}
}
export function placeHoneyFruit(model: HoneyModel, id: number, point: HoneyPoint, ingredientId = 'peach', angle = 0): boolean {
  if (model.family !== 'windParfait' || !['fruit', 'glaze', 'ready'].includes(model.stage) || !Number.isInteger(id) || id < 0 || id >= 6 || !onHoneySurface(point, 1.12) || !Number.isFinite(angle)) return false
  // Accept a release on the painted rim and let the landing settle the slice
  // into the bowl, keeping its centre within the contained fruit layer.
  const distance = Math.hypot(point.x, point.y), inset = distance > .8 ? .8 / distance : 1;
  point = { x: point.x * inset, y: point.y * inset };
  const existing = model.fruit.find(value => value.id === id)
  if (existing) Object.assign(existing, point, { angle })
  else model.fruit.push({ ...point, id, ingredientId, angle })
  if (model.stage === 'fruit' && model.fruit.length >= 3) stage(model, 'glaze', 'layer-fruit')
  return true
}
export function startHoneyBake(model: HoneyModel): boolean {
  if (model.stage !== 'bake-ready') return false
  model.stage = 'baking'; model.baked = 0; return true
}
export function advanceHoneyBake(model: HoneyModel, seconds: number): void {
  if (model.stage !== 'baking' || !Number.isFinite(seconds) || seconds <= 0) return
  model.baked = Math.min(HONEY_BAKE_SECONDS, model.baked + seconds)
  if (model.baked >= HONEY_BAKE_SECONDS) stage(model, 'glaze', 'bake-golden')
}
export function honeyProgress(model: HoneyModel): number {
  if(model.family==='windParfait'&&model.stage==='custard')return model.parfaitCustard
  if(model.family==='windParfait'&&model.stage==='glaze')return model.parfaitHoney
  if (model.stage === 'cut') return model.cutTracks.reduce((sum,track)=>sum+track.progress,0) / 2
  if (model.stage === 'shape') return Math.min(1, model.pieces.reduce((sum, piece) => sum + piece.work, 0) / 1.5, model.pieces.filter(piece => piece.work >= .36).length / 2)
  if (model.stage === 'mix') return Math.min(1, model.mixed / HONEY_MIX_REQUIRED, model.sectors.size / 14)
  if(model.stage==='glaze'&&model.family==='honeyPear')return Math.min(1,[...model.coated.values()].reduce((sum,p)=>sum+p,0)/(4*HONEY_PEAR_DRIZZLE))
  if(model.stage==='glaze'&&model.family==='honeyBiscuits')return Math.min(1,model.coverage.size/Math.ceil(36*.72))
  if (model.stage === 'custard' || model.stage === 'glaze') return Math.min(1, model.coverage.size / Math.ceil(honeyCoverageTargets(model.family, model.stage).length * .72))
  if (model.stage === 'fruit') return Math.min(1, model.fruit.length / 3)
  if (model.stage === 'baking') return model.baked / HONEY_BAKE_SECONDS
  return model.stage === 'bake-ready' || model.stage === 'settling' || model.stage === 'ready' || model.stage === 'finished' ? 1 : 0
}
export function completeHoney(model: HoneyModel, commit: () => boolean): boolean {
  if (model.stage !== 'ready') return false
  model.stage = 'committing'
  try { const accepted = commit(); model.stage = accepted ? 'finished' : 'ready'; return accepted }
  catch (error) { model.stage = 'ready'; throw error }
}
export function cancelHoney(model: HoneyModel): void { if (!['finished', 'committing'].includes(model.stage)) { model.stage = 'cancelled'; endHoneyStroke(model) } }
