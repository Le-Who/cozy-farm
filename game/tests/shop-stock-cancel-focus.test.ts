import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'

// Use the mounted scene's own cancel handler and focus restoration, replacing only its repaint.
const source=readFileSync(new URL('../src/bay-shop.ts',import.meta.url),'utf8')
const part=(first:string,end:string)=>{const a=source.indexOf(first),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b)}
const handler=stripTypeScriptTypes('(()=>{'+part("    if (button.hasAttribute('data-stock-cancel'))","    if (button.hasAttribute('data-return'))")+'})()')
const restore=stripTypeScriptTypes(part('    const focusAttribute =','    rendering = true;')+part("    const content = host.querySelector('.bay-shop-desk-content'); if (content) content.scrollTop = scroll;","\n  }\n  const dayGuidance"))
const product={id:'signature:s1',identity:'signature:s1',quantity:1}
const quote={...product,quantity:'1',listScroll:328}
function cancel(detail:number,productNow:typeof product,owned=true){
  const button={hasAttribute:(name:string)=>name==='data-stock-cancel',getAttribute:()=>''},document={activeElement:owned?button:null}
  const shelf={name:'shelf',matches:()=>false,focus:({preventScroll}:{preventScroll:boolean})=>{assert.ok(preventScroll);focused.push('shelf')}}
  const row={...shelf,focus:({preventScroll}:{preventScroll:boolean})=>{assert.ok(preventScroll);focused.push('original product')}}
  const content={scrollTop:23},focused:string[]=[],query=(s:string)=>s==='.bay-shop-desk-content'?content:s==='[data-slot="0"]'?shelf:s==='[data-stock="signature:s1"]'?row:null
  const room={pending:quote,event:{detail},document,button,options:{products:()=>[productNow]},render:(returnStock:typeof quote|undefined)=>{
    runInNewContext(restore,{returnStock,active:document.activeElement,selected:0,host:{querySelector:query},CSS:{escape:(s:string)=>s}})
  }}
  runInNewContext(handler,room)
  assert.equal(room.pending,undefined)
  return {focused,scroll:content.scrollTop}
}
test('owned keyboard Cancel returns directly to the original available product and its list position',()=>{
  assert.deepEqual(cancel(0,product),{focused:['original product'],scroll:328})
})
test('pointer, unrelated focus, gone product, or reused product id do not redirect to the row',()=>{
  for(const [detail,stock] of [[1,product],[0,{...product,quantity:0}],[0,{...product,identity:'signature:s2'}]] as const)
    assert.deepEqual(cancel(detail,stock),{focused:['shelf'],scroll:23})
  assert.deepEqual(cancel(0,product,false),{focused:[],scroll:23})
})
