import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { createFarm, workBed, deliverMarketOrder, orderLanes } from '../src/farm.ts'

const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const branch=source.slice(source.indexOf("    case 'deliver-order':"),source.indexOf("    case 'project-boat':"))
test('successful current Orders delivery focuses its existing receipt without an extra action, save, or rest',()=>{
 for(const options of [{},{failed:true},{value:'retired'},{panel:'rest'},{marketTab:'sell'},{dialog:{open:false}}]){
  const farm=createFarm();assert.ok(workBed(farm,2).ok);assert.ok(workBed(farm,3).ok)
  const before=structuredClone(farm),expected=structuredClone(farm),events:string[]=[],writes:typeof farm[]=[]
  const context={farm,orderLanes,deliverMarketOrder,value:'garden',panel:'market',marketTab:'orders',dialog:{open:true},
   perform:(action:()=>ReturnType<typeof deliverMarketOrder>)=>{events.push('perform');if('failed'in options)return false;const result=action();if(result.ok){writes.push(structuredClone(farm));events.push('redraw')}return result.ok},
   dialogContent:{querySelector:(selector:string)=>{
    assert.equal(selector,'.market-order-detail')
    return{
     focus:(options:{preventScroll:boolean})=>{assert.equal(options.preventScroll,true);events.push('focus')},
     querySelector:(selector:string)=>{
      assert.equal(selector,'.order-done')
      return{scrollIntoView:(options:{block:string})=>{assert.equal(options.block,'nearest');events.push('receipt')}}
     },
    }
   }},...options}
  runInNewContext(stripTypeScriptTypes(`switch('deliver-order'){${branch}}`),context)
  const performed=options.value!=='retired',successful=performed&&!('failed'in options),focused=successful&&Object.keys(options).length===0
  if(successful){assert.ok(deliverMarketOrder(expected,'garden').ok);assert.deepEqual(farm,expected);assert.deepEqual(writes,[expected])}else{assert.deepEqual(farm,before);assert.deepEqual(writes,[])}
  assert.deepEqual(events,[...(performed?['perform']:[]),...(successful?['redraw']:[]),...(focused?['focus','receipt']:[])])
 }
 assert.doesNotMatch(branch,/saveFarm|endDay|market-next-rest|\.click\(/)
})
