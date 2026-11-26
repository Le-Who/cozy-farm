import test from 'node:test'
import assert from 'node:assert/strict'
import { captureFerryPanelView, restoreFerryPanelView } from '../src/ferry-panel-view.ts'
import { ferryCommissionUse } from '../src/ferry-commission-use.ts'
import { createServer } from './fixtures/ssr-vite.ts'
import { fileURLToPath } from 'node:url'
import { orchardCustomerReturn } from './fixtures/ferry-commission-return.ts'

test('after the last portion is cooked, Back returns to that paid receipt instead of Close, but never to another voyage',()=>{
  const {p,id}=orchardCustomerReturn();p.act('receiveFerryExpedition')
  const key=ferryCommissionUse(p.state)!.key, calls:string[]=[]
  const common={matches:()=>false,closest:()=>null,parentElement:null,scrollIntoView(){calls.push('reveal')},getBoundingClientRect:()=>({top:250,bottom:285})}
  const link={...common,dataset:{action:'expedition-order-recipe',value:key},matches:(s:string)=>s==='button[data-action]',focus:()=>calls.push('same action')}
  const close={...common,focus:()=>calls.push('close')}
  const receipt={...common,focus:()=>calls.push('same receipt')}
  const desk={scrollTop:73,getBoundingClientRect:()=>({top:40,bottom:460})}, workspace={scrollTop:12,getBoundingClientRect:()=>({top:10,bottom:200})}
  const panel={dataset:{receiptVoyage:String(p.state.freight.expeditions.serial)},contains:(el:unknown)=>el===link,
    querySelector:(q:string)=>q==='.bay-freight-close'?close:q==='.expedition-receipt'?receipt:q==='.expedition-card-scroll'?desk:q==='.bay-freight-workspace'?workspace:null,
    querySelectorAll:()=>ferryCommissionUse(p.state)?[link]:[]}
  const host={ownerDocument:{activeElement:link},querySelector:()=>panel} as unknown as HTMLElement
  const captured=captureFerryPanelView(host)!
  assert.deepEqual(captured.focus,{action:'expedition-order-recipe',area:'panel',value:key})
  p.act('repeatSignature',id)
  restoreFerryPanelView(host,captured);assert.deepEqual(calls,['same action'])
  p.act('repeatSignature',id);assert.equal(ferryCommissionUse(p.state),undefined)
  const before=structuredClone(p.state);calls.length=0
  restoreFerryPanelView(host,captured)
  assert.deepEqual(calls,['same receipt','reveal']);assert.equal(desk.scrollTop,73)
  calls.length=0;panel.dataset.receiptVoyage='999'
  restoreFerryPanelView(host,captured);assert.deepEqual(calls,['close'])
  assert.deepEqual(p.state,before)
})


test('only an actual settled receipt exposes its voyage identity in the ferry panel',async()=>{
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'})
  try{
    const {renderFreightPanel}=await server.ssrLoadModule('/src/bay-freight-ui.ts')
    const {p}=orchardCustomerReturn()
    const render=()=>renderFreightPanel(p.state.freight,{day:p.state.day,coins:p.state.coins,boatOwned:true,playerPort:'home',openedPorts:['home'],products:[],carried:{},icon:()=>''})
    assert.doesNotMatch(render(),/data-receipt-voyage=/)
    p.act('receiveFerryExpedition')
    assert.ok(render().includes('data-receipt-voyage="'+p.state.freight.expeditions.serial+'"'))
    p.act('sendFerryExpedition','orchard-pears')
    assert.doesNotMatch(render(),/data-receipt-voyage=/)
  }finally{await server.close()}
})
