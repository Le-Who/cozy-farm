import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createKnifeTrace,traceKnife,releaseKnifeTrace} from '../src/knife-trace.ts'

test('outside tool approach cannot choose the cut plane; real contact preserves the first edge',()=>{
 const t=createKnifeTrace(),extent=()=>({min:0,max:100})
 for(const p of [{x:200,y:200},{x:130,y:50},{x:-10,y:0}])traceKnife(t,{point:p,contact:false,extent})
 for(let x=0;x<=100;x+=2)traceKnife(t,{point:{x,y:0},contact:true,extent})
 assert.equal(t.angle,0);assert.equal(t.progress,1);assert.ok(t.bins.has(0)&&t.bins.has(15))
})

test('a buffered stable entry replays its early samples instead of losing their coverage',()=>{
 const t=createKnifeTrace(),extent=()=>({min:0,max:100})
 for(let x=0;x<14;x++)traceKnife(t,{point:{x,y:10},contact:true,extent})
 assert.equal(t.axis,null)
 traceKnife(t,{point:{x:16,y:10},contact:true,extent})
 assert.ok(t.axis);assert.ok(t.bins.has(0));assert.ok(t.progress>0&&t.progress<.5)
})

test('partial cuts survive release and resume without counting a new outside approach',()=>{
 const t=createKnifeTrace(),extent=()=>({min:0,max:100})
 for(let x=0;x<=40;x+=2)traceKnife(t,{point:{x,y:0},contact:true,extent})
 const old=t.progress;assert.ok(old>0&&old<.6);releaseKnifeTrace(t)
 traceKnife(t,{point:{x:90,y:180},contact:false,extent});assert.equal(t.progress,old)
 for(let x=35;x<=100;x+=2)traceKnife(t,{point:{x,y:0},contact:true,extent})
 assert.equal(t.progress,1);assert.equal(t.angle,0)
})

test('jitter and off-line rubbing do not invent a complete slice',()=>{
 const t=createKnifeTrace(),extent=()=>({min:0,max:100})
 for(let i=0;i<80;i++)traceKnife(t,{point:{x:i%2,y:i%3*.2},contact:true,extent})
 assert.equal(t.axis,null);assert.equal(t.progress,0)
 releaseKnifeTrace(t)
 for(let x=0;x<=16;x+=2)traceKnife(t,{point:{x,y:0},contact:true,extent})
 const before=t.progress
 for(let y=20;y<100;y+=2)traceKnife(t,{point:{x:16,y},contact:true,extent})
 assert.ok(t.progress<.3);assert.ok(t.progress>=before)
})

test('diagonal and reversed visible cuts use their own direction and projected extent',()=>{
 for(const direction of [1,-1]){
  const t=createKnifeTrace(),root=Math.SQRT1_2,extent=()=>({min:direction>0?0:-100,max:direction>0?100:0})
  for(let s=0;s<=100;s+=2){const v=direction>0?s:100-s;traceKnife(t,{point:{x:v*root,y:v*root},contact:true,extent})}
  assert.equal(t.progress,1);assert.ok(Math.abs(t.angle!-(direction>0?Math.PI/4:-3*Math.PI/4))<1e-8)
 }
})

test('an exit segment covers the actual last edge, but isolated outside movement does not',()=>{
 const t=createKnifeTrace(),extent=()=>({min:0,max:100})
 for(let x=0;x<=88;x+=4)traceKnife(t,{point:{x,y:0},contact:true,extent})
 traceKnife(t,{point:{x:110,y:0},contact:false,extent});assert.equal(t.progress,1)
 const empty=createKnifeTrace();traceKnife(empty,{point:{x:-10,y:0},contact:false,extent});traceKnife(empty,{point:{x:110,y:0},contact:false,extent});assert.equal(empty.progress,0)
 const before=structuredClone(t);traceKnife(t,{point:{x:NaN,y:Infinity},contact:true,extent});assert.deepEqual(t,before)
})

test('a narrow crosscut uses the actual silhouette at its stroke line',()=>{
 const t=createKnifeTrace(),extent=(_axis:{x:number;y:number},origin:{x:number;y:number})=>{
  assert.equal(origin.y,60)
  const halfWidth=100*Math.sqrt(1-(origin.y/100)**2)
  return {min:-halfWidth,max:halfWidth}
 }
 for(let x=-80;x<=80;x+=2)traceKnife(t,{point:{x,y:60},contact:true,extent})
 assert.equal(t.progress,1);assert.equal(t.origin!.y,60)
})

test('ordinary hand wobble is fitted across contact rather than locking to its first few pixels',()=>{
 const t=createKnifeTrace(),extent=()=>({min:0,max:100})
 for(let x=0;x<=100;x+=2)traceKnife(t,{point:{x,y:Math.sin(x*.2)*2},contact:true,extent})
 assert.ok(Math.abs(t.angle!)<.06);assert.equal(t.progress,1)
})

test('very slow dense input and coarse samples describe the same completed visible cut',()=>{
 for(const step of [.05,.25,2,5]){
  const t=createKnifeTrace(),extent=()=>({min:0,max:200})
  for(let x=0;x<=200+1e-6;x+=step)traceKnife(t,{point:{x,y:Math.sin(x*.1)*2},contact:true,extent})
  assert.equal(t.progress,1,`sample spacing ${step}`);assert.ok(t.samples.length<=128)
 }
})
