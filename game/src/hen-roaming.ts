/** Coordinates are native pixels on the authored 1586 × 992 Home plate. */
export type HenNativePoint = {x:number;y:number}
export type HenBuildingLevels = {farmhouse:number;well:number;coop:number}
type Polygon=readonly HenNativePoint[]
const polygon=(pairs:readonly (readonly [number,number])[]):Polygon=>pairs.map(([x,y])=>({x,y}))

// Inside the grass lip, leaving the cliff/water and dock outside the walking area.
export const homeHenGround=polygon([[104,364],[173,301],[260,258],[392,230],[557,208],[728,197],[879,200],[1032,204],[1180,214],[1320,240],[1415,291],[1464,352],[1485,428],[1495,499],[1471,560],[1489,645],[1500,716],[1451,764],[1332,795],[1210,808],[1098,790],[966,804],[861,808],[754,818],[653,792],[543,791],[423,796],[304,785],[193,780],[112,755],[81,708],[84,641],[110,570],[86,510],[74,460],[89,407]])
export const defaultHenPositions:readonly HenNativePoint[]=[[209,643],[250,682],[325,672],[365,641],[292,637]].map(([x,y])=>({x,y}))

const farmhouse=polygon([[233,280],[468,280],[482,360],[451,390],[257,390],[229,354]])
const kitchen=polygon([[468,288],[600,288],[611,369],[574,390],[468,379]])
const coop=polygon([[224,522],[344,522],[362,596],[343,620],[220,618],[207,590]])
const largerCoop=polygon([[204,516],[355,516],[374,606],[346,634],[203,628],[192,590]])
const well=polygon([[624,288],[742,288],[756,328],[720,352],[646,350],[615,328]])
const largerWell=polygon([[594,280],[777,280],[799,324],[758,357],[621,357],[578,326]])
const mill=polygon([[846,250],[962,250],[988,280],[970,311],[844,311],[825,283]])
const market=polygon([[1128,301],[1365,301],[1380,368],[1352,392],[1120,387],[1110,348]])
function plank(a:HenNativePoint,b:HenNativePoint,radius:number):Polygon{
 const length=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/length*radius,ny=(b.x-a.x)/length*radius
 return [{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}]
}
const fence=[plank({x:157,y:532},{x:150,y:711},12),plank({x:398,y:528},{x:405,y:666},12),plank({x:160,y:718},{x:366,y:719},14),plank({x:178,y:527},{x:391,y:527},10),plank({x:377,y:701},{x:416,y:674},12)]
const defaults:HenBuildingLevels={farmhouse:1,well:1,coop:1}
const obstacles=(levels:HenBuildingLevels)=>[farmhouse,...(levels.farmhouse>=2?[kitchen]:[]),levels.coop>=2?largerCoop:coop,levels.well>=2?largerWell:well,mill,market,...fence]

function closest(point:HenNativePoint,a:HenNativePoint,b:HenNativePoint):HenNativePoint{
 const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy)))
 return {x:a.x+dx*t,y:a.y+dy*t}
}
function contains(point:HenNativePoint,shape:Polygon):boolean{
 let inside=false
 for(let i=0,j=shape.length-1;i<shape.length;j=i++){
  const a=shape[j],b=shape[i],near=closest(point,a,b)
  if(Math.hypot(near.x-point.x,near.y-point.y)<1e-7)return true
  if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside
 }
 return inside
}
export function isHenGround(point:HenNativePoint,levels:HenBuildingLevels=defaults):boolean{
 return Number.isFinite(point.x)&&Number.isFinite(point.y)&&contains(point,homeHenGround)&&!obstacles(levels).some(shape=>contains(point,shape))
}

/** Keep valid drops exactly where released; otherwise choose the nearest free edge. */
export function projectHenToGround(point:HenNativePoint,levels:HenBuildingLevels=defaults):HenNativePoint{
 if(isHenGround(point,levels))return {...point}
 if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return {...defaultHenPositions[1]}
 let best={...defaultHenPositions[1]},bestDistance=Infinity
 const consider=(candidate:HenNativePoint)=>{
  const distance=Math.hypot(candidate.x-point.x,candidate.y-point.y)
  if(distance<bestDistance&&isHenGround(candidate,levels)){best=candidate;bestDistance=distance}
 }
 for(const shape of [homeHenGround,...obstacles(levels)])for(let i=0;i<shape.length;i++){
  const a=shape[i],b=shape[(i+1)%shape.length],near=closest(point,a,b),length=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length
  for(const sign of [-1,1])consider({x:near.x+nx*sign,y:near.y+ny*sign})
  for(let angle=0;angle<8;angle++)consider({x:a.x+Math.cos(angle*Math.PI/4),y:a.y+Math.sin(angle*Math.PI/4)})
 }
 return best
}

export function henIdlePoint(anchor:HenNativePoint,time:number,index:number,levels:HenBuildingLevels=defaults):HenNativePoint{
 return projectHenToGround({x:anchor.x+Math.sin(time*.83+index*2)*17,y:anchor.y+Math.cos(time*.89+index)*11},levels)
}
