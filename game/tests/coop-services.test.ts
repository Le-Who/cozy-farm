import test from 'node:test'
import assert from 'node:assert/strict'
import { groupCoopServices } from '../src/coop-services.ts'
import { readFileSync } from 'node:fs'

test('care group moves intact, once, without adding a disclosure or replacing controls',()=>{
 const care={buttons:[{action:'hen-friendship-open'},{action:'chicken-feed-open'}]},primary={},forecast={},packing={},hens={}
 const panel={dataset:{} as Record<string,string>,children:[primary,forecast,care,packing,hens],querySelector:()=>care,prepend(node:typeof care){this.children=this.children.filter(child=>child!==node);this.children.unshift(node)}}
 const root={querySelector:()=>panel};groupCoopServices(root as unknown as HTMLElement)
 assert.deepEqual(panel.children,[care,primary,forecast,packing,hens]);assert.equal(panel.children[0],care)
 groupCoopServices(root as unknown as HTMLElement);assert.equal(panel.children.length,5);assert.equal(care.buttons.length,2)
})

test('non-coop and incomplete roots are untouched',()=>{
 groupCoopServices({querySelector:()=>null} as unknown as HTMLElement)
 const panel={dataset:{},querySelector:()=>null,prepend(){throw Error('must not move')}}
 groupCoopServices({querySelector:()=>panel} as unknown as HTMLElement);assert.deepEqual(panel.dataset,{})
})

test('presentation has no save/action/copy mutation or hidden controls and is scoped to the normal coop render',()=>{
 const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8'),source=read('../src/coop-services.ts'),css=read('../src/coop-services.css'),main=read('../src/main.ts')
 assert.doesNotMatch(source,/innerHTML|createElement|textContent|addEventListener|localStorage|\.click\(/)
 assert.doesNotMatch(css,/display:\s*none|overflow|visibility|font-size:\s*(?:[0-9]|1[01])px/)
 assert.match(main,/import \{ groupCoopServices \} from '\.\/coop-services'/)
 assert.match(main,/import '\.\/coop-services\.css'/)
 assert.doesNotMatch(main,/coopServicesDev|coopServices['"]|coop-services-entry/)
 assert.match(main,/renderCoopPanel\(farm, \{icon,row,button,feedRow:flockFeedRow\}\)\s*groupCoopServices\(dialogContent\)/)
 assert.equal((main.match(/groupCoopServices\(dialogContent\)/g)??[]).length,1)
})
