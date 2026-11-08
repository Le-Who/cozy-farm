import { doughTransferBuffers, executeDoughCut, type DoughCutRequest } from './workshop-cut-transfer'

const worker=self as unknown as {onmessage:((event:MessageEvent<DoughCutRequest>)=>void)|null;postMessage(message:unknown,transfer:ArrayBuffer[]):void}
worker.onmessage=event=>{
  const result=executeDoughCut(event.data)
  worker.postMessage(result,result.halves?.flatMap(doughTransferBuffers)??[])
}
