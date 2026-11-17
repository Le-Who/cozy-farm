import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Exercise the actual workshop Escape branch; native replay covers trusted keys,
// focus restoration, the parent dialog and uncommitted inventory preservation.
const source=ts.createSourceFile('workshop.ts',readFileSync(new URL('../src/workshop.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true)
let escape:ts.IfStatement|undefined
function visit(node:ts.Node){
 if(ts.isCallExpression(node)&&node.expression.getText(source)==='root.addEventListener'&&node.arguments[0]?.getText(source)==="'keydown'"){
  const handler=node.arguments[1] as ts.ArrowFunction
  const first=(handler.body as ts.Block).statements[0]
  assert.ok(ts.isIfStatement(first));assert.equal(first.expression.getText(source),"event.key === 'Escape'");escape=first
 }
 ts.forEachChild(node,visit)
}
visit(source);assert.ok(escape)
const script=ts.transpileModule(`function keydown(event){${escape.getText(source)}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
function harness(open=true){
 let closes=0,restores=0
 const state={handMenu:{hidden:!open},closeHandMenu(restore:boolean){state.handMenu.hidden=true;if(restore)restores++},close(){closes++}}
 const context=runInNewContext(`${script};keydown`,state) as (event:{key:string;repeat:boolean;preventDefault():void})=>void
 return {state,closes:()=>closes,restores:()=>restores,key(key='Escape',repeat=false){let prevented=false;context({key,repeat,preventDefault(){prevented=true}});return prevented}}
}

test('one held Escape collapses tools and restores hand focus without leaving the workshop',()=>{
 const h=harness();assert.equal(h.key(),true);assert.equal(h.state.handMenu.hidden,true);assert.equal(h.restores(),1)
 for(let i=0;i<8;i++)assert.equal(h.key('Escape',true),true)
 assert.equal(h.closes(),0,'key repeats must not discard unbaked dough after the palette closes');assert.equal(h.restores(),1)
 assert.equal(h.key(),true);assert.equal(h.closes(),1,'a separately pressed Escape still leaves the workshop')
})

test('a closed palette exits once per Escape press and always prevents the parent native cancel',()=>{
 const h=harness(false);assert.equal(h.key(),true);assert.equal(h.closes(),1)
 for(let i=0;i<8;i++)assert.equal(h.key('Escape',true),true)
 assert.equal(h.closes(),1);assert.equal(h.restores(),0)
})

test('other repeating workshop keys are not swallowed by the Escape branch',()=>{
 const h=harness();for(const key of [' ','Enter','ArrowRight','r'])assert.equal(h.key(key,true),false)
 assert.equal(h.state.handMenu.hidden,false);assert.equal(h.closes(),0)
})
