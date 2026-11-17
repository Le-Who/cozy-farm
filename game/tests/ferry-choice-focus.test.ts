import test from 'node:test'
import assert from 'node:assert/strict'
import { restoreFerryPanelView, type FerryPanelView } from '../src/ferry-panel-view.ts'

function restore(top: number, bottom: number, kind: 'choice'|'receipt'|'closed'|'missing' = 'choice') {
 const calls: string[] = [], regions = ['.bay-freight-workspace','.expedition-card-scroll','.expedition-overview']
 const summary = {focus:()=>calls.push('summary'),matches:()=>false,closest:()=>null,parentElement:null,contains:(e:unknown)=>e===summary}
 const offers = {tagName:'DETAILS',open:kind!=='closed',parentElement:null,querySelector:()=>summary}
 const choice = {dataset:{action:'expedition-offer',value:'mill-buy'},parentElement:offers,
  matches:()=>false,closest:(s:string)=>s==='[hidden]'?null:offers,focus:()=>calls.push('choice'),
  getBoundingClientRect:()=>({top,bottom}),scrollIntoView:(options:{block:string})=>{assert.equal(options.block,'nearest');calls.push('reveal')}}
 const receipt = {...choice,parentElement:null,focus:()=>calls.push('receipt')}
 const close = {...summary,focus:()=>calls.push('close')}
 const scroll = regions.map(()=>({scrollTop:0,getBoundingClientRect:()=>({top:50,bottom:200})}))
 const panel = {querySelector:(s:string)=>s==='.expedition-offers'?offers:s==='.expedition-receipt'?receipt:s==='.bay-freight-close'?close:scroll[regions.indexOf(s)]??null,
  querySelectorAll:()=>kind==='missing'?[]:[choice]}
 const host={querySelector:()=>panel} as unknown as HTMLElement
 const view:FerryPanelView={offersOpen:kind!=='closed',scroll:[7,93,11],focus:kind==='receipt'?{receipt:true}:{action:'expedition-offer',value:'mill-buy',area:'offers'}}
 restoreFerryPanelView(host,view)
 assert.deepEqual(scroll.map(area=>area.scrollTop),view.scroll,'ordinary stored positions are restored before any necessary reveal')
 return calls
}

test('only a clipped restored order choice is revealed after its card changes size',()=>{
 assert.deepEqual(restore(80,160),['choice'])
 assert.deepEqual(restore(150,230),['choice','reveal'])
 assert.deepEqual(restore(20,100),['choice','reveal'])
 assert.deepEqual(restore(150,230,'receipt'),['receipt'],'the separately owned receipt-route reveal is unchanged')
 assert.deepEqual(restore(150,230,'closed'),['summary'],'restoring focus must not reopen a closed picker')
 assert.deepEqual(restore(150,230,'missing'),['summary'],'a vanished choice keeps its established summary fallback')
})
