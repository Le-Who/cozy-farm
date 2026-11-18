import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as THREE from 'three'
import { workshopTools, workshopToolGuide } from '../src/workshop-controls.ts'

// Actual loss/restore and hand callbacks with inert graphics/DOM adapters.
// This is a disabled-state unit gate, not native WebGL or keyboard acceptance.
const source = ts.createSourceFile('workshop.ts', readFileSync(new URL('../src/workshop.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
function find(predicate:(node:ts.Node)=>boolean) {
  let found:ts.Node|undefined
  function visit(node:ts.Node) { if (!found && predicate(node)) found=node; ts.forEachChild(node,visit) }
  visit(source); assert.ok(found); return found.getText(source)
}
const declaration=(name:string)=>find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name)
const listener=(target:string,event:string)=>find(node=>ts.isCallExpression(node)&&node.expression.getText(source)===`${target}.addEventListener`&&node.arguments[0]?.getText(source)===`'${event}'`)
const code=ts.transpileModule([
  declaration('closeHandMenu'), declaration('updateState'), declaration('cancelPendingCut'),
  listener('handButton','click'), listener('canvas','webglcontextlost'), listener('canvas','webglcontextrestored'),
].join('\n'), {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText

function fixture(expanded=true) {
  const callbacks=new Map<string,Function>()
  const element=(dataset:Record<string,string>={})=>({dataset,disabled:false,hidden:false,textContent:'',innerHTML:'',attributes:{} as Record<string,string>,setAttribute(name:string,value:string){this.attributes[name]=value},focus(){},addEventListener(type:string,handler:Function){callbacks.set(`hand:${type}`,handler)}})
  const tools=workshopTools.map(tool=>element({tool:tool.id})), hand=element({prop:'hand'})
  const position={needsUpdate:false,array:new Float32Array([.2,.3,.4])}
  const piece={mass:1.25,mesh:{geometry:{attributes:{position}}}}
  let rendererAttempts=0,failRestore=false,releases=0
  const state:any={stage:'working',activeTool:'roll',chosenShape:'long',options:{recipe:'bread'},dishDefinitions:{farmhouseBread:{name:'Домашний хлеб'}},shapeNames:{long:'Батон'},contextLost:false,cutPending:false,cutSerial:0,cutResolve:null,cutReject:null,destroyed:false,assetsReady:true,work:.2,mixed:1,selected:0,handMenuExpanded:expanded,hand:{down:false},pieces:[piece],
    root:element(),shapeButtons:[element({shape:'long'})],toolButtons:tools,handButton:hand,hotspots:[hand],handMenu:element(),resultLabel:element(),modeTitle:element(),hint:element(),bakeButton:element(),status:element(),signal:new AbortController().signal,workshopToolGuide,
    canvas:{addEventListener(type:string,handler:Function){callbacks.set(type,handler)}},sun:{shadow:{dispose(){},map:{},mapPass:{}}},resources:[],surface:{invalidateGraphics(){}},renderer:{dispose(){}},
    createRenderer(){rendererAttempts++;if(failRestore)throw new Error('fixture renderer unavailable');return {dispose(){}}},release(){releases++},updateSpriteBoxes(){},rebuildMixSurface(){},positionHandMenu(){},updateCue(){},fitBakeLabel(){}}
  runInNewContext(code,state);state.updateState()
  return {state,hand,tools,piece,position,rendererAttempts:()=>rendererAttempts,releases:()=>releases,failRestore(){failRestore=true},
    lose(){let prevented=false;callbacks.get('webglcontextlost')!({preventDefault(){prevented=true}});assert.equal(prevented,true)},
    restore(){callbacks.get('webglcontextrestored')!()},
    // Deliberately invoke a stale callback even when the button is disabled.
    activateHand(){callbacks.get('hand:click')!()}}
}

test('actual context-loss entry locks hand alongside Bake/tools without closing or changing the palette',()=>{
  for(const expanded of [false,true]) {
    const h=fixture(expanded),before={expanded:h.state.handMenuExpanded,hidden:h.state.handMenu.hidden,aria:h.hand.attributes['aria-expanded']}
    h.lose()
    assert.equal(h.state.contextLost,true);assert.equal(h.hand.disabled,true);assert.equal(h.state.bakeButton.disabled,true);assert.ok(h.tools.every(button=>button.disabled))
    assert.equal(h.state.status.hidden,false);assert.match(h.state.status.textContent,/Тесто сохранено/)
    assert.equal(h.state.stage,'working');assert.equal(h.state.activeTool,'roll');assert.equal(h.state.pieces[0],h.piece);assert.equal(h.releases(),1)
    h.activateHand()
    assert.deepEqual({expanded:h.state.handMenuExpanded,hidden:h.state.handMenu.hidden,aria:h.hand.attributes['aria-expanded']},before)
  }
})

test('stale hand activation respects the existing context/cut/stage locks',()=>{
  for(const lock of ['contextLost','cutPending','baking','finished'])for(const expanded of [false,true]) {
    const h=fixture(expanded)
    if(lock==='contextLost'||lock==='cutPending')h.state[lock]=true;else h.state.stage=lock
    h.state.updateState()
    const before={expanded:h.state.handMenuExpanded,hidden:h.state.handMenu.hidden,aria:h.hand.attributes['aria-expanded']}
    assert.equal(h.hand.disabled,true);h.activateHand()
    assert.deepEqual({expanded:h.state.handMenuExpanded,hidden:h.state.handMenu.hidden,aria:h.hand.attributes['aria-expanded']},before,lock)
    assert.equal(h.state.activeTool,'roll');assert.equal(h.releases(),0)
  }
})

test('existing successful restoration re-enables the hand with the same mode, dough and open state',()=>{
  for(const expanded of [false,true]) {
    const h=fixture(expanded),coordinates=Array.from(h.position.array)
    h.lose();h.restore()
    assert.equal(h.rendererAttempts(),1);assert.equal(h.state.contextLost,false);assert.equal(h.state.status.hidden,true)
    assert.equal(h.hand.disabled,false);assert.ok(h.tools.every(button=>!button.disabled));assert.equal(h.state.bakeButton.disabled,false)
    assert.equal(h.state.stage,'working');assert.equal(h.state.activeTool,'roll');assert.equal(h.state.pieces[0],h.piece);assert.equal(h.piece.mass,1.25);assert.deepEqual(Array.from(h.position.array),coordinates);assert.equal(h.position.needsUpdate,true)
    assert.equal(h.state.handMenuExpanded,expanded);assert.equal(h.state.handMenu.hidden,!expanded);assert.equal(h.hand.attributes['aria-expanded'],String(expanded))
    assert.equal(h.tools.filter(button=>button.attributes['aria-pressed']==='true').length,1);assert.equal(h.tools.find(button=>button.attributes['aria-pressed']==='true')!.dataset.tool,'roll')
    h.activateHand();assert.equal(h.state.handMenu.hidden,expanded);assert.equal(h.hand.attributes['aria-expanded'],String(!expanded));assert.equal(h.state.activeTool,'roll')
  }
})

test('failed or disposed restoration does not unlock the hand or change the palette',()=>{
  for(const failure of ['renderer','disposed']) {
    const h=fixture(false);h.lose()
    if(failure==='renderer')h.failRestore();else h.state.destroyed=true
    h.restore();h.activateHand()
    assert.equal(h.rendererAttempts(),failure==='renderer'?1:0);assert.equal(h.state.contextLost,true);assert.equal(h.hand.disabled,true);assert.ok(h.tools.every(button=>button.disabled))
    assert.equal(h.state.handMenu.hidden,true);assert.equal(h.state.handMenuExpanded,false);assert.equal(h.state.activeTool,'roll')
  }
})

test('the board only invites another cut while it is available, without hiding the in-flight stroke',()=>{
  const h=fixture(false),s=h.state as any, shown=s.cutPreview={hidden:true,dataset:{},toggleAttribute(_:string,hidden:boolean){this.hidden=hidden}}
  const node={setAttribute(){}}
  Object.assign(s,{cue:{},layout:{id:'portrait'},layoutChanging:false,activePiece:()=>h.piece,applyBox(){},
    cutPreviewKey:'',cutPaths:[],cutStart:node,cutEnd:node,width:370,height:582,artwork:{x:0,y:0,width:370,height:582},
    THREE,cutSurfacePoint:(x:number,z:number)=>new THREE.Vector3(x,0,z),boardToArtwork:(_:unknown,__:unknown,___:number,____:number,p:THREE.Vector3)=>({u:p.x,v:p.z}),camera:{},
    activeTool:'cut',hand:{down:false,start:new THREE.Vector2(-1,0),x:1,z:0}})
  Object.assign(h.piece,{seed:1,bounds:new THREE.Box3(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,1,1))})
  Object.assign(h.piece.mesh,{position:new THREE.Vector3(),geometry:new THREE.BoxGeometry(2,1,2)})
  runInNewContext(ts.transpileModule([declaration('updateCue'),declaration('updateCutPreview')].join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,s)
  const draw=()=>{s.updateState();s.updateCutPreview()}
  draw();assert.equal(s.cue.hidden,false);assert.match(s.cue.textContent,/Проведите/);assert.equal(shown.hidden,false)
  s.hand.down=true;draw();assert.match(s.cue.textContent,/Отпустите/)
  s.hand.down=false;s.cutPending=true;draw()
  assert.match(s.hint.textContent,/Дождитесь/);assert.equal(s.cue.hidden,true);assert.equal(shown.hidden,false)
  s.cutPending=false;s.pieces.push(h.piece);draw()
  assert.equal(s.cue.hidden,false);assert.match(s.cue.textContent,/Проведите/);assert.equal(shown.hidden,false)
  while(s.pieces.length<6)s.pieces.push(h.piece)
  draw();assert.match(s.hint.textContent,/шесть.*другой инструмент/);assert.equal(s.cue.hidden,true);assert.equal(shown.hidden,true)
  s.activeTool='move';draw();assert.equal(s.cue.hidden,false);assert.match(s.cue.textContent,/Перетащите/);assert.equal(shown.hidden,true)
})
