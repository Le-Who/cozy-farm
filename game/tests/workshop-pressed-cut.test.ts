import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { Worker } from 'node:worker_threads'
import { test } from 'node:test'

for(const fixture of ['workshop-pressed-touch-cut.json.gz','workshop-near-ground-touch-cut.json.gz'])test(`actual touchscreen pancake ${fixture} cuts promptly into closed volume-preserving sections`, async () => {
  // Captured before clipping from a real CDP touch gesture at 390x844: the
  // almost coplanar underside used to subdivide cap slivers indefinitely.
  const captured=gunzipSync(readFileSync(new URL('./fixtures/'+fixture,import.meta.url))).toString()
  const worker=new Worker(`
    const {parentPort,workerData}=require('node:worker_threads');
    (async()=>{
      const THREE=await import(workerData.three),{cutDoughGeometry,doughVolume}=await import(workerData.geometry);
      const data=JSON.parse(workerData.captured),g=new THREE.BufferGeometryLoader().parse(data.geometry);
      const plane=new THREE.Plane(new THREE.Vector3().fromArray(data.plane.normal),data.plane.constant),sourceVolume=doughVolume(g),start=performance.now();
      const halves=cutDoughGeometry(g,plane),milliseconds=performance.now()-start;
      const sections=halves?.map(half=>{
        const p=half.getAttribute('position'),index=half.index,edges=new Map();
        const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*1e7)).join(',');
        for(let i=0;i<index.count;i+=3){
          const vertices=[index.getX(i),index.getX(i+1),index.getX(i+2)].map(key);
          if(new Set(vertices).size<3)continue;
          for(let j=0;j<3;j++){const a=vertices[j],b=vertices[(j+1)%3],edge=a<b?a+'|'+b:b+'|'+a;edges.set(edge,(edges.get(edge)??0)+1)}
        }
        return {volume:doughVolume(half),openEdges:[...edges.values()].filter(n=>n!==2).length,cap:half.groups.some(group=>group.materialIndex===1&&group.count>0),finite:[...p.array].every(Number.isFinite)};
      });
      parentPort.postMessage({sourceVolume,milliseconds,sections});
    })().catch(error=>{throw error});
  `,{eval:true,workerData:{captured,three:import.meta.resolve('three'),geometry:new URL('../src/workshop-geometry.ts',import.meta.url).href}})
  try {
    const result=await new Promise<any>((resolve,reject)=>{
      const deadline=setTimeout(()=>reject(Error('Pressed-section cut did not terminate within 10 seconds')),10000)
      worker.once('message',message=>{clearTimeout(deadline);resolve(message)})
      worker.once('error',error=>{clearTimeout(deadline);reject(error)})
    })
    assert.equal(result.sections?.length,2)
    for(const section of result.sections){assert.equal(section.openEdges,0);assert.ok(section.cap);assert.ok(section.finite)}
    assert.ok(Math.abs(result.sections.reduce((sum:number,section:any)=>sum+section.volume,0)-result.sourceVolume)<1e-5)
  } finally { await worker.terminate() }
})
