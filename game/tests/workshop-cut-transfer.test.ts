import assert from 'node:assert/strict'
import { Worker } from 'node:worker_threads'
import { test } from 'node:test'
import * as THREE from 'three'
import { doughTransferBuffers, packDoughGeometry, unpackDoughGeometry, type DoughCutResult } from '../src/workshop-cut-transfer.ts'
import { createSculptedDough } from '../src/workshop-sculpt.ts'
import { doughVolume } from '../src/workshop-geometry.ts'

test('worker transfer cuts copied buffers and returns complete closed cap geometry without detaching the live mesh',async()=>{
  const source=createSculptedDough({shape:'raw',mass:1.93471,seed:12}),position=source.getAttribute('position').array,index=source.index!.array
  const originalPosition=new Float32Array(position),positionBytes=position.byteLength,indexBytes=index.byteLength,packet=packDoughGeometry(source)
  assert.notEqual(packet.position.buffer,position.buffer)
  const worker=new Worker(`
    const {parentPort,workerData}=require('node:worker_threads');
    parentPort.on('message',async request=>{
      const api=await import(workerData.module),result=api.executeDoughCut(request);
      parentPort.postMessage(result,result.halves?.flatMap(api.doughTransferBuffers)??[]);
    });
  `,{eval:true,workerData:{module:new URL('../src/workshop-cut-transfer.ts',import.meta.url).href}})
  const request=(id:number,constant:number,geometry=packDoughGeometry(source))=>new Promise<DoughCutResult>((resolve,reject)=>{
    const deadline=setTimeout(()=>reject(Error('Worker cut response timed out')),10000)
    worker.once('message',result=>{clearTimeout(deadline);resolve(result)})
    worker.once('error',error=>{clearTimeout(deadline);reject(error)})
    worker.postMessage({id,geometry,normal:[1,0,0],constant},doughTransferBuffers(geometry))
  })
  try {
    const pending=request(73,0,packet)
    assert.equal(packet.position.byteLength,0,'only the copied packet is detached')
    assert.equal(position.byteLength,positionBytes);assert.equal(index.byteLength,indexBytes)
    assert.deepEqual(position,originalPosition)
    const result=await pending
    assert.equal(result.id,73);assert.equal(result.error,undefined);assert.equal(result.halves?.length,2)
    const geometries=result.halves!.map(unpackDoughGeometry)
    assert.ok(Math.abs(geometries.reduce((sum,g)=>sum+doughVolume(g),0)-doughVolume(source))<1e-5)
    for(const geometry of geometries){
      assert.ok(geometry.groups.some(group=>group.materialIndex===1&&group.count>0))
      assert.equal(geometry.getAttribute('normal').count,geometry.getAttribute('position').count)
      assert.equal(geometry.getAttribute('uv').count,geometry.getAttribute('position').count)
      const p=geometry.getAttribute('position'),edges=new Map<string,number>(),ids=geometry.index!,key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*1e7)).join(',')
      for(let i=0;i<ids.count;i+=3){const v=[ids.getX(i),ids.getX(i+1),ids.getX(i+2)].map(key);if(new Set(v).size<3)continue;for(let j=0;j<3;j++){const a=v[j],b=v[(j+1)%3],edge=a<b?a+'|'+b:b+'|'+a;edges.set(edge,(edges.get(edge)??0)+1)}}
      assert.ok([...edges.values()].every(count=>count===2))
      geometry.dispose()
    }
    const outside=await request(74,-100)
    assert.deepEqual(outside,{id:74})
    assert.equal(position.byteLength,positionBytes);assert.deepEqual(position,originalPosition)
  }finally{await worker.terminate();source.dispose()}
})
