import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as THREE from 'three'
import ts from 'typescript'
import {getWorkshopLayout,containArtwork,containRaster} from '../src/workshop-camera.ts'
import * as controls from '../src/workshop-controls.ts'

const read=(file:string)=>readFileSync(new URL(file,import.meta.url),'utf8')
const source=read('../src/workshop.ts'), css=read('../src/workshop.css'), dialogCss=read('../src/style.css')
const methods=new Map<string,string>(), wanted=['fitViewport','applyBox','fitItem','positionHandMenu','updateState']
const ast=ts.createSourceFile('workshop.ts',source,ts.ScriptTarget.Latest,true)
function visit(node:ts.Node) {
  if(ts.isFunctionDeclaration(node)&&node.name&&wanted.includes(node.name.text))methods.set(node.name.text,node.getText(ast))
  ts.forEachChild(node,visit)
}
visit(ast);assert.equal(methods.size,wanted.length)
const compile=(code:string)=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
const fit=compile(methods.get('fitViewport')!+'\nfitViewport()')
const place=compile(['applyBox','fitItem','positionHandMenu'].map(name=>methods.get(name)!).join('\n')+
  '\napplyBox(handButton,fitItem(handAsset,layout.props.hand));applyBox(bakeButton,layout.ui.bake);applyBox(ingredients,layout.ui.ingredients);positionHandMenu()')
const markup=compile(source.slice(source.indexOf('  const shapeNames'),source.indexOf('  host.append(root)'))+'\nroot.innerHTML')
const handAsset=JSON.parse(read('../public/art/lavender/workshop-authored/manifest.json')).items.handMedallion
type Rect={x:number;y:number;width:number;height:number}
const overlap=(a:Rect,b:Rect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y
const num=(s:string)=>Number.parseFloat(s)
const rule=(sheet:string,selector:string)=>sheet.split(selector+' {')[1]?.split('}')[0]??''
const prop=(s:string,key:string)=>new RegExp('(?:^|;)\\s*'+key+':\\s*([^;]+)').exec(s)?.[1].trim()??''
function box(style:Record<string,string>) { return {x:num(style.left),y:num(style.top),width:num(style.width),height:num(style.height)} }
class Button {
  style:Record<string,string>={}
  getBoundingClientRect(){const b=box(this.style);return {...b,left:b.x,top:b.y}}
}

// Run the shipped DOM writer and positioning functions. Only CSS geometry
// for the named boxes and browser client dimensions are calculated here.
function workshop(windowWidth:number,windowHeight:number) {
  const style:Record<string,string>&{setProperty(key:string,value:string):void}={setProperty(k,v){this[k]=v}}
  const root={style,dataset:{modeRail:undefined as string|undefined}}
  const html=runInNewContext(markup,{root,options:{recipe:'pastry'},base:'/',workshopTools:controls.workshopTools}) as string
  assert.equal((html.match(/data-tool=/g)??[]).length,6)
  assert.equal((html.match(/data-shape=/g)??[]).length,3)
  assert.match(html,/class="workshop-mode" role="status"/)
  assert.match(html,/data-prop="hand"[^>]+aria-controls="workshop-hand-menu"/)
  const context={...controls,root,window:{innerWidth:windowWidth,innerHeight:windowHeight},getWorkshopLayout,containArtwork}
  runInNewContext(fit,context)
  const width=Math.round(num(style.width)),height=Math.round(num(style.height))
  const layout=getWorkshopLayout(width,height),artwork=containArtwork(layout,width,height)
  const handButton=new Button(),bakeButton=new Button(),ingredients=new Button()
  // Real ingredients is a div, so applyBox must not enforce the button minimum on it.
  const ingredientNode={style:ingredients.style}
  const attrs={compact:undefined as string|undefined}
  const menuStyle:Record<string,string>&{setProperty(k:string,v:string):void}={setProperty(k,v){this[k]=v}}
  const handMenu={style:menuStyle,dataset:attrs}
  runInNewContext(place,{...context,THREE,HTMLButtonElement:Button,handButton,bakeButton,ingredients:ingredientNode,handMenu,
    view:{getBoundingClientRect:()=>({left:0,top:0})},width,height,layout,artwork,handAsset,containRaster,fitBakeLabel(){}})
  const rail=root.dataset.modeRail==='true'
  const modeRailSelector='.dough-workshop[data-stage="working"][data-mode-rail="true"]'
  const railStyle=rule(css,modeRailSelector)
  const modeStyle=rule(css,modeRailSelector+' .workshop-mode')
  const shapeRailStyle=rule(css,modeRailSelector+' .workshop-shape-picker')
  const landscapeShape=rule(css,'.dough-workshop[data-layout="landscape"] .workshop-shape-picker')
  const landscapeMode=rule(css,'.dough-workshop[data-layout="landscape"] .workshop-mode')
  const shapeHeight=num(prop(rule(css,'.dough-workshop .workshop-shape-picker button'),'min-height'))
  const shapeCss=layout.id==='landscape'?{top:num(prop(landscapeShape,'top'))/100,width:.55}:layout.id==='portrait'?{top:.09,width:.94}:{top:.02,width:.60}
  const shapeWidth=Math.min(300,width*shapeCss.width)
  const offset=rail?num(/-\s*(\d+)px/.exec(prop(shapeRailStyle,'left'))?.[1]??'0'):0
  const shape={x:(width-shapeWidth)/2-offset,y:shapeCss.top*height,width:shapeWidth,height:shapeHeight}
  const backCss=rule(dialogCss,'.scene-back')
  const back={x:width-num(prop(backCss,'right'))-num(prop(backCss,'width')),y:num(prop(backCss,'top')),
    width:num(prop(backCss,'width')),height:num(prop(backCss,'height'))}
  const reserve=rail?num(style['--workshop-mode-rail']):0
  const railTop=+(/\+\s*(\d+)px/.exec(prop(modeStyle,'top'))?.[1]??0)
  const guideTop=rail?height+railTop:layout.id==='landscape'?shape.y+Number(/\+\s*(\d+)px/.exec(prop(landscapeMode,'top'))?.[1]):shape.y+52
  const columns=+menuStyle.gridTemplateColumns.match(/repeat\((\d+)/)![1]
  const toolWidth=num(menuStyle['--workshop-tool-width']),toolHeight=num(menuStyle['--workshop-tool-height'])
  const gap=num(prop(rule(css,'.workshop-hand-menu'),'gap'))
  const tiles=Array.from({length:6},(_,i)=>({x:num(menuStyle.left)+(i%columns)*(toolWidth+gap),y:num(menuStyle.top)+Math.floor(i/columns)*(toolHeight+gap),width:toolWidth,height:toolHeight}))
  return {width,height,layout:layout.id,rail,reserve,guideTop,shape,back,ingredients:box(ingredients.style),railStyle,modeRailSelector,modeStyle,tiles,columns,
    hand:box(handButton.style),bake:box(bakeButton.style),authored:{width:num(style.width),height:num(style.height)},compact:attrs.compact}
}

for(const [w,h] of [[460,360],[480,360],[500,360]])test(`short landscape ${w}×${h} keeps all tools and controls clear`,()=>{
  const p=workshop(w,h)
  assert.equal(p.layout,'landscape')
  assert.ok(p.tiles.every(tile=>!overlap(tile,p.shape)),'the shape picker must not mask part of the six tool targets')
  assert.ok(p.tiles.every(tile=>!overlap(tile,p.bake)&&!overlap(tile,p.hand)&&!overlap(tile,p.back)))
  assert.ok(!overlap(p.shape,p.back)&&p.shape.x>p.ingredients.x+p.ingredients.width)
  assert.ok(p.tiles.every(tile=>tile.x>=0&&tile.y>=0&&tile.x+tile.width<=p.width&&tile.y+tile.height<=p.height))
  assert.ok(p.tiles.every(tile=>tile.width>=76&&tile.height>=64),'no shrinking the controls to fit')
  assert.ok(p.rail&&p.reserve>=64)
  assert.equal(prop(p.railStyle,'box-sizing'),'content-box','reserve space outside the authored worktop')
  assert.equal(prop(p.railStyle,'padding-bottom'),'var(--workshop-mode-rail)')
  assert.equal(prop(rule(css,'.workshop-view'),'height'),'100%','canvas still uses the root content height, not its new padding')
  assert.equal(prop(rule(css,p.modeRailSelector+' .workshop-view'),'overflow'),'visible')
  assert.ok(p.guideTop>p.height&&p.guideTop+56<=p.height+p.reserve,'room for the guide without hiding a control')
  assert.ok(p.authored.height+p.reserve<=h-20&&p.authored.width<=w-20,'fit inside the existing safe viewport')
  assert.equal(p.columns,3);assert.equal(p.compact,'true')
})

test('portrait, desktop, known wide landscape and a too-shallow viewport keep their old recipe surface sizing',()=>{
  for(const [w,h,layout,columns,tw,th] of [
    [360,480,'portrait',3,76,64], [1440,900,'desktop',6,99,101],
    [520,480,'landscape',6,76,64], [480,270,'landscape',3,76,64],
  ] as const){
    const p=workshop(w,h)
    assert.equal(p.layout,layout); assert.equal(p.rail,false)
    assert.equal(p.reserve,0);assert.equal(p.columns,columns)
    assert.ok(p.tiles.every(tile=>tile.width===tw&&tile.height===th))
    const before=containArtwork(getWorkshopLayout(w-20,h-20),w-20,h-20)
    assert.equal(p.authored.height,before.height);assert.equal(p.authored.width,before.width)
  }
})

test('resizing the live worktop clears the rail without moving focus or rebuilding controls',()=>{
  const vars:Record<string,string>={},root={dataset:{},style:{setProperty:(k:string,v:string)=>{vars[k]=v}}}
  const window={innerWidth:460,innerHeight:360}
  const geometryWrites={...controls,window,root,getWorkshopLayout,containArtwork}
  runInNewContext(fit,geometryWrites)
  assert.equal(vars['--workshop-mode-rail'],'72px')
  window.innerWidth=520;window.innerHeight=480
  runInNewContext(fit,geometryWrites)
  assert.equal(vars['--workshop-mode-rail'],'0px')
  assert.doesNotMatch(methods.get('fitViewport')!,/focus\(|innerHTML|replaceChildren|handMenuExpanded/)
  assert.doesNotMatch(methods.get('positionHandMenu')!,/focus\(|innerHTML|replaceChildren|handMenuExpanded/)
})

test('the existing selected mode remains named and keyboard focus/close routes are unchanged',()=>{
  const update=methods.get('updateState')!
  const report=compile('{\n'+update.slice(update.indexOf('    toolButtons.forEach'),update.indexOf("    if (stage === 'working')"))+'\n'+
    update.slice(update.indexOf('    handMenu.hidden'),update.indexOf('    positionHandMenu();'))+'\n}')
  for(const selected of controls.workshopTools){
    const button=(tool:string)=>({dataset:{tool},attrs:{} as Record<string,string>,setAttribute(k:string,v:string){this.attrs[k]=v}})
    const toolButtons=controls.workshopTools.map(item=>button(item.id)),handButton=button('hand'),modeTitle={textContent:''},handMenu={hidden:false}
    const ctx={...controls,toolButtons,modeTitle,hint:{},handButton,hotspots:[],handMenu,stage:'working',activeTool:selected.id,
      contextLost:false,cutPending:false,pieces:[{}],handMenuExpanded:true}
    runInNewContext(report,ctx)
    assert.deepEqual(toolButtons.filter(b=>b.attrs['aria-pressed']==='true').map(b=>b.dataset.tool),[selected.id])
    assert.equal(modeTitle.textContent,'Режим: '+selected.label)
    ctx.handMenuExpanded=false;runInNewContext(report,ctx)
    assert.equal(handMenu.hidden,true);assert.equal(modeTitle.textContent,'Режим: '+selected.label)
  }
  assert.match(css,/\[aria-pressed="true"\]>\.workshop-tool-selected \{ display:block; \}/)
  assert.match(css,/button:focus-visible \{ outline:3px/)
  assert.match(source,/function closeHandMenu\(restore=false\).*if\(restore\)handButton.focus\(\{preventScroll:true\}\)/)
  assert.match(source,/handMenu\.querySelectorAll\('button'\).*view.focus\(\{preventScroll:true\}\)/)
})
