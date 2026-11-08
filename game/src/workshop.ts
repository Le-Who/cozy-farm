import * as THREE from 'three'
import { doughVolume } from './workshop-geometry'
import { doughTransferBuffers, executeDoughCut, packDoughGeometry, unpackDoughGeometry, type DoughCutRequest, type DoughCutResult } from './workshop-cut-transfer'
import { createWorkshopSurface } from './workshop-surface'
import { createSculptedDough, prewarmSculptedDough } from './workshop-sculpt'
import { latchDoughHandle, shapeDoughHandle, type DoughHandle, type DoughHandAction } from './workshop-deformation'
import { artworkToBoard, boardToArtwork, configureWorkshopCamera, containArtwork, containRaster, createArtworkProjector, getWorkshopLayout, type ArtBox } from './workshop-camera'
import './workshop.css'

export type WorkshopShape = 'round' | 'folded' | 'long'
export interface WorkshopOptions { onBake: (shape: WorkshopShape) => boolean | void; onCancel?: () => void }
type Stage = 'ingredients' | 'mixing' | 'transferring' | 'working' | 'baking' | 'finished'
type Tool = 'knead' | 'cup' | 'roll' | 'fold' | 'cut' | 'move'
type DoughPiece = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material[]>; rest: Float32Array; seed:number;
  offset: Float32Array; velocity: Float32Array; plastic: Float32Array; mass: number;
  stretch: number; fold: number; bounds: THREE.Box3;
  normalCorrection:Float32Array;dirty:boolean;
}
type DoughGrab={piece:DoughPiece;handle:DoughHandle;delta:THREE.Vector2;pressure:number;action:DoughHandAction;changed:boolean}
type Asset = { url: string; width: number; height: number; pivot: {x:number;y:number}; contact:{x:number;y:number}; supportContacts?:{name:string;x:number;y:number;rx:number;ry:number;rotation?:number}[];foregroundUrl?:string; innerRimEllipse?:{cx:number;cy:number;rx:number;ry:number;rotation:number}; mixSurfaceEllipse?:{cx:number;cy:number;rx:number;ry:number;rotation:number} }
type ArtSprite = { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; rect: ArtBox; asset?:Asset; rotation:number; opacity:number; glow:number; key:string }
type PropKey = 'bowl'|'spoon'|'pin'|'knife'|'scraper'|'hand'

export function createWorkshop(host: HTMLElement, options: WorkshopOptions): { destroy(): void } {
  const abort = new AbortController(), signal = abort.signal
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const base = import.meta.env.BASE_URL
  const root = document.createElement('section')
  root.className = 'dough-workshop'
  root.setAttribute('aria-label', 'Handmade bakehouse')
  root.innerHTML = `
    <div class="workshop-view" tabindex="0" role="application" aria-label="Pastry workbench" aria-describedby="workshop-controls">
      <div class="workshop-render-status" role="status">Opening the bakehouse…</div>
      <svg class="workshop-cut-preview" aria-hidden="true" hidden><path class="workshop-cut-border"/><path class="workshop-cut-path"/><circle class="workshop-cut-start" r="5"/><path class="workshop-cut-end"/></svg>
      <div class="workshop-art-controls">
        <div class="workshop-ingredients" aria-label="Recipe: 2 wheat and 1 egg"><span><img src="${base}art/icons/wheat.webp" alt="">2</span><span><img src="${base}art/icons/egg.webp" alt="">1</span></div>
        <button class="workshop-close" type="button" aria-label="Close bakehouse"></button>
        <button class="workshop-bake" type="button" hidden><span>Bake</span></button>
        <button class="workshop-object" type="button" data-prop="bowl" aria-label="Mix dough" aria-keyshortcuts="Space"></button>
        <button class="workshop-object" type="button" data-prop="spoon" aria-label="Stir dough"></button>
        <button class="workshop-object" type="button" data-prop="pin" data-tool="roll" aria-label="Rolling pin" aria-keyshortcuts="R"></button>
        <button class="workshop-object" type="button" data-prop="knife" data-tool="cut" aria-label="Cut dough" aria-keyshortcuts="X"></button>
        <button class="workshop-object" type="button" data-prop="scraper" data-tool="move" aria-label="Lift and move dough" aria-keyshortcuts="M"></button>
        <button class="workshop-object" type="button" data-prop="hand" data-tool="knead" aria-label="Shape dough by hand" aria-keyshortcuts="Space" aria-expanded="false" aria-controls="workshop-hand-menu"></button>
        <div class="workshop-hand-menu" id="workshop-hand-menu" role="group" aria-label="Shape dough" hidden><button type="button" data-tool="cup" aria-label="Cup dough"><img src="${base}art/lavender/ui-handmade-round.webp" alt=""><span>Cup</span></button><button type="button" data-tool="fold" aria-label="Fold dough"><img src="${base}art/lavender/ui-handmade-folded.webp" alt=""><span>Fold</span></button><button type="button" data-tool="move" aria-label="Move a piece"><img class="workshop-menu-hand" alt=""><span>Move</span></button></div>
        <span class="workshop-gesture-cue" aria-hidden="true"></span>
      </div>
      <div class="workshop-accessible-tools" aria-label="Dough tools"><button type="button" data-tool="knead">Press</button><button type="button" data-tool="cup">Cup</button><button type="button" data-tool="roll">Roll</button><button type="button" data-tool="fold">Fold</button><button type="button" data-tool="cut">Cut</button><button type="button" data-tool="move">Move</button></div>
    </div>
    <p class="workshop-sr-only" id="workshop-controls">Stir in the bowl with a circular gesture or Space. On the board, press and drag to knead. R rolls, C cups, F folds, X cuts, M moves. Numbers 1 to 6 select pieces; Shift and arrows move one. One recipe uses 2 wheat and 1 egg.</p>
    <p class="workshop-sr-only workshop-hint"></p><p class="workshop-sr-only" aria-live="polite" aria-atomic="true"></p>`
  host.append(root)
  function fitViewport(){
    const availableWidth=Math.max(1,Math.min(window.innerWidth,window.visualViewport?.width??Infinity)-20),availableHeight=Math.max(1,Math.min(window.innerHeight,window.visualViewport?.height??Infinity)-20)
    const target=getWorkshopLayout(availableWidth,availableHeight),fit=containArtwork(target,availableWidth,availableHeight)
    root.style.width=`${fit.width}px`;root.style.height=`${fit.height}px`
  }
  fitViewport();window.addEventListener('resize',fitViewport,{signal});window.visualViewport?.addEventListener('resize',fitViewport,{signal})
  const view = root.querySelector<HTMLElement>('.workshop-view')!
  const bakeButton = root.querySelector<HTMLButtonElement>('.workshop-bake')!
  const cutPreview=root.querySelector<SVGSVGElement>('.workshop-cut-preview')!
  const cutPaths=[...cutPreview.querySelectorAll<SVGPathElement>('.workshop-cut-border,.workshop-cut-path')]
  const cutStart=cutPreview.querySelector<SVGCircleElement>('.workshop-cut-start')!
  const cutEnd=cutPreview.querySelector<SVGPathElement>('.workshop-cut-end')!
  let bakeFitKey=''
  let bakeFrameSize:{width:number;height:number}|undefined
  function fitBakeLabel(){
    const label=bakeButton.querySelector('span');if(!label||bakeButton.hidden)return
    if(bakeFrameSize){
      const box=bakeButton.getBoundingClientRect(),frame=containRaster(bakeFrameSize,box.width,box.height)
      label.style.left=`${frame.x+frame.width*.15}px`;label.style.top=`${frame.y+frame.height*.22}px`
      label.style.width=`${frame.width*.7}px`;label.style.height=`${frame.height*.42}px`
      label.style.right=label.style.bottom='auto'
    }
    const style=getComputedStyle(bakeButton),inner=label.getBoundingClientRect()
    const desired=Math.min(68,(layout.id==='portrait'?90:68)*artwork.scale)
    const key=[label.textContent,inner.width,inner.height,desired,style.fontFamily].join(',')
    if(key===bakeFitKey)return
    bakeFitKey=key
    let font=desired
    const range=document.createRange();range.selectNodeContents(label)
    for(let attempt=0;attempt<3;attempt++){
      bakeButton.style.fontSize=`${Math.max(1,font)}px`
      const text=range.getBoundingClientRect(),ratio=Math.min(1,Math.max(1,inner.width-6)/Math.max(1,text.width),Math.max(1,inner.height-4)/Math.max(1,text.height))
      if(ratio>=1)break
      font*=ratio
    }
  }
  const live = root.querySelector<HTMLElement>('[aria-live]')!
  const hint = root.querySelector<HTMLElement>('.workshop-hint')!
  const status = root.querySelector<HTMLElement>('.workshop-render-status')!
  const toolButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-tool]')]
  const hotspots = [...root.querySelectorAll<HTMLButtonElement>('[data-prop]')]
  const closeButton = root.querySelector<HTMLButtonElement>('.workshop-close')!
  closeButton.textContent='×'
  const handMenu = root.querySelector<HTMLElement>('.workshop-hand-menu')!
  const handButton=hotspots.find(button=>button.dataset.prop==='hand')!
  function closeHandMenu(restore=false){handMenu.hidden=true;handButton.setAttribute('aria-expanded','false');if(restore)handButton.focus({preventScroll:true})}
  let stage: Stage = 'ingredients', activeTool: Tool = 'knead'
  let work = 0, mixed = 0, stirring = 0, selected = 0, frame = 0, elapsed = 0, bakeElapsed = 0
  let transfer=0
  const transferOrigin=new THREE.Vector3()
  let destroyed = false, committed = false, contextLost = false, assetsReady = false, propsReady=false, backgroundReady=false, layoutChanging=false
  let cutPending=false,cutSerial=0,cutResolve:((result:DoughCutResult)=>void)|null=null,cutReject:((error:Error)=>void)|null=null
  let cutWorker:Worker|null=null
  try { if(typeof Worker!=='undefined')cutWorker=new Worker(new URL('./workshop-cut-worker.ts',import.meta.url),{type:'module'}) } catch {cutWorker=null}
  cutWorker?.addEventListener('message',(event:MessageEvent<DoughCutResult>)=>{
    if(event.data.id!==cutSerial)return
    const resolve=cutResolve;cutResolve=null;cutReject=null;resolve?.(event.data)
  },{signal})
  cutWorker?.addEventListener('error',()=>{
    cutWorker?.terminate();cutWorker=null
    const reject=cutReject;cutResolve=null;cutReject=null;reject?.(new Error('The cut could not be completed'))
  },{signal})
  function cancelPendingCut(){
    if(!cutPending)return
    cutSerial++;cutPending=false;const reject=cutReject;cutResolve=null;cutReject=null;reject?.(new Error('Cut cancelled'))
    root.setAttribute('aria-busy','false');root.dataset.cutting='false'
  }
  let lastTime = performance.now(), width = Math.max(1, view.clientWidth), height = Math.max(1, view.clientHeight)
  let layout = getWorkshopLayout(width, height), artwork = containArtwork(layout, width, height)
  let layoutSerial = 0
  const pieces: DoughPiece[] = []
  let pieceSerial=0
  const warmQueue:{seed:number;shape:'raw'|'folded'}[]=[],warmQueued=new Set<string>()
  let warmIdle:number|undefined,warmTimer:number|undefined
  function runWarmQueue(){
    if(destroyed||!warmQueue.length)return
    const execute=()=>{
      warmIdle=undefined;warmTimer=undefined
      if(destroyed)return
      if(hand.down||stage==='transferring'||stage==='baking'){warmTimer=window.setTimeout(runWarmQueue,180);return}
      const task=warmQueue.shift()!
      prewarmSculptedDough(task.seed,task.shape)
      if(warmQueue.length)warmTimer=window.setTimeout(runWarmQueue,80)
    }
    if('requestIdleCallback'in window)warmIdle=window.requestIdleCallback(execute,{timeout:1500})
    else warmTimer=setTimeout(execute,80)
  }
  function warmSculpt(seed:number,shape:'raw'|'folded'){
    const key=seed+shape;if(warmQueued.has(key))return;warmQueued.add(key);warmQueue.push({seed,shape})
    if(warmIdle===undefined&&warmTimer===undefined)warmTimer=window.setTimeout(runWarmQueue,120)
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const hand = { x:0, z:0, down:false, edge:false, pointerId:null as number|null, start:new THREE.Vector2(), angle:0 }
  let grab:DoughGrab|null=null
  let rollingOwner:DoughPiece|null=null,rollingLast:THREE.Vector3|null=null,rollingTravel=0
  const cue=root.querySelector<HTMLElement>('.workshop-gesture-cue')!
  const announce = (message:string) => { live.textContent = message }
  const close = () => { if (!destroyed) options.onCancel?.() }
  closeButton.addEventListener('click', close, {signal})
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#554031')
  const camera = new THREE.PerspectiveCamera(35, width/height, .01, 200)
  configureWorkshopCamera(camera, layout, width, height)
  let renderer: THREE.WebGLRenderer | null = null
  function createRenderer(canvas?:HTMLCanvasElement):THREE.WebGLRenderer {
    const next = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'})
    next.setPixelRatio(Math.min(window.devicePixelRatio,2))
    next.shadowMap.enabled = true; next.shadowMap.type = THREE.VSMShadowMap
    next.outputColorSpace = THREE.SRGBColorSpace
    next.toneMapping = THREE.ACESFilmicToneMapping
    next.toneMappingExposure = 1
    next.domElement.setAttribute('aria-hidden','true')
    next.setSize(width,height,false)
    return next
  }
  try {
    renderer = createRenderer()
    view.prepend(renderer.domElement)
  } catch {
    status.textContent = 'The bakehouse needs its 3D view. Close it and try again.'
    closeButton.textContent = '×'
    return {destroy(){cutWorker?.terminate();cutWorker=null;abort.abort();root.remove();previousFocus?.focus()}}
  }
  const canvas=renderer.domElement
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();contextLost=true;cancelPendingCut();release(undefined,true)
    // Retire this GL generation before restoration; Three's automatic reset leaves
    // old resource-disposal listeners and VSM targets attached to the CPU objects.
    sun.shadow.dispose();sun.shadow.map=null;sun.shadow.mapPass=null
    resources.forEach(resource=>resource.dispose());surface.invalidateGraphics()
    renderer?.dispose();renderer=null
    bakeButton.disabled=true;toolButtons.forEach(button=>{button.disabled=true})
    status.hidden=false;status.textContent='The view is resting. Your dough is safe.'
  },{signal})
  canvas.addEventListener('webglcontextrestored',()=>{
    if(destroyed)return
    try {renderer=createRenderer(canvas)} catch {
      status.textContent='The bakehouse needs its 3D view. Close it and try again.'
      return
    }
    contextLost=false;status.hidden=true;pieces.forEach(piece=>{piece.mesh.geometry.attributes.position.needsUpdate=true})
    updateState();bakeButton.disabled=stage==='baking'
  },{signal})
  scene.add(new THREE.HemisphereLight('#fff3d9','#cfb493',1.2))
  const sun = new THREE.DirectionalLight('#fff0d2',1.7)
  sun.position.set(-5,8,4);sun.castShadow=true;sun.shadow.mapSize.set(768,768)
  Object.assign(sun.shadow.camera,{left:-5,right:5,top:4,bottom:-4})
  sun.shadow.normalBias=.008;sun.shadow.radius=5;sun.shadow.blurSamples=16;scene.add(sun)
  const fill = new THREE.DirectionalLight('#e7d9f1',.55);fill.position.set(4,4,2);scene.add(fill)
  const ovenLight = new THREE.PointLight('#ffb65f',0,8);ovenLight.position.set(3,2,-2);scene.add(ovenLight)
  const resources:(THREE.BufferGeometry|THREE.Material|THREE.Texture)[]=[]
  const material=(color:string,roughness=.9)=>{const value=new THREE.MeshStandardMaterial({color,roughness,transparent:true});resources.push(value);return value}
  function mesh(geometry:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0){resources.push(geometry);const value=new THREE.Mesh(geometry,mat);value.position.set(x,y,z);scene.add(value);return value}
  let noiseSeed=57811
  const random=()=>{noiseSeed=(noiseSeed*1664525+1013904223)>>>0;return noiseSeed/4294967296}
  const textureCache=new Map<string,Promise<THREE.Texture>>()
  const artUrl=(url:string)=>`${base}${url.startsWith('art/')?url:`art/${url}`}`
  function loadTexture(url:string){
    let result=textureCache.get(url)
    if(!result){result=new Promise<THREE.Texture>((resolve,reject)=>{const texture=new THREE.TextureLoader().load(url,()=>{if(destroyed){texture.dispose();reject(new DOMException('Workbench closed','AbortError'));return}texture.colorSpace=THREE.SRGBColorSpace;resolve(texture)},undefined,reject);resources.push(texture)});textureCache.set(url,result)}
    return result
  }
  const quad=new THREE.PlaneGeometry(1,1);resources.push(quad)
  const sprites:ArtSprite[]=[]
  const vertexShader=`uniform vec4 artRect;uniform vec4 containRect;uniform vec2 artworkSize;uniform vec2 viewportSize;uniform vec2 pivot;uniform float rotation;varying vec2 vUv;void main(){vUv=uv;vec2 p=vec2(position.x+.5,.5-position.y);p=(p-pivot)*artRect.zw;float c=cos(rotation),s=sin(rotation);p=mat2(c,s,-s,c)*p+artRect.xy+pivot*artRect.zw;vec2 pixel=containRect.xy+p/artworkSize*containRect.zw;gl_Position=vec4(pixel.x/viewportSize.x*2.-1.,1.-pixel.y/viewportSize.y*2.,0.,1.);}`
  const fragmentShader=`uniform sampler2D map;uniform float opacity;uniform float selected;uniform vec2 texel;uniform float rolling;uniform float rollPhase;varying vec2 vUv;void main(){vec4 c=texture2D(map,vUv);if(rolling>.5){vec2 p=vec2(vUv.x*509.,(1.-vUv.y)*310.);vec2 axis=normalize(vec2(1.,-.5)),crossAxis=vec2(-axis.y,axis.x),d=p-vec2(285.,151.);float along=dot(d,axis),across=dot(d,crossAxis);float mask=(1.-smoothstep(119.,146.,abs(along)))*(1.-smoothstep(57.,73.,abs(across)));float spun=sin(asin(clamp(across/76.,-.99,.99))+rollPhase)*76.;vec2 samplePoint=p+crossAxis*(spun-across);vec4 spunSkin=texture2D(map,vec2(samplePoint.x/509.,1.-samplePoint.y/310.));vec3 luma=vec3(.2126,.7152,.0722);float fixedLight=dot(c.rgb,luma);vec3 skin=spunSkin.rgb*(fixedLight/max(.01,dot(spunSkin.rgb,luma)));c.rgb=mix(c.rgb,skin,mask*smoothstep(.85,.98,spunSkin.a));}float a=0.;a=max(a,texture2D(map,vUv+vec2(texel.x*3.,0.)).a);a=max(a,texture2D(map,vUv-vec2(texel.x*3.,0.)).a);a=max(a,texture2D(map,vUv+vec2(0.,texel.y*3.)).a);a=max(a,texture2D(map,vUv-vec2(0.,texel.y*3.)).a);float halo=max(0.,a-c.a)*selected*.65;vec3 col=mix(c.rgb,vec3(.69,.43,.81),halo);gl_FragColor=vec4(col,max(c.a,halo)*opacity);
  #include <colorspace_fragment>
  }`
  function artSprite(key:string,order:number):ArtSprite {
    const mat=new THREE.ShaderMaterial({uniforms:{map:{value:null},artRect:{value:new THREE.Vector4()},containRect:{value:new THREE.Vector4()},artworkSize:{value:new THREE.Vector2()},viewportSize:{value:new THREE.Vector2()},pivot:{value:new THREE.Vector2(.5,.5)},rotation:{value:0},opacity:{value:1},selected:{value:0},texel:{value:new THREE.Vector2(.001,.001)},rolling:{value:key==='pin'?1:0},rollPhase:{value:0}},vertexShader,fragmentShader,transparent:true,depthTest:false,depthWrite:false})
    resources.push(mat);const sprite:ArtSprite={mesh:new THREE.Mesh(quad,mat),rect:{u:0,v:0,width:1,height:1},rotation:0,opacity:1,glow:0,key}
    sprite.mesh.renderOrder=order;sprite.mesh.frustumCulled=false;sprite.mesh.visible=false;scene.add(sprite.mesh);sprites.push(sprite);return sprite
  }
  function placeSprite(sprite:ArtSprite){
    const uniforms=sprite.mesh.material.uniforms
    uniforms.artRect.value.set(sprite.rect.u*layout.art.width,sprite.rect.v*layout.art.height,sprite.rect.width*layout.art.width,sprite.rect.height*layout.art.height)
    uniforms.containRect.value.set(artwork.x,artwork.y,artwork.width,artwork.height);uniforms.artworkSize.value.set(layout.art.width,layout.art.height);uniforms.viewportSize.value.set(width,height)
    uniforms.rotation.value=sprite.rotation;uniforms.opacity.value=sprite.opacity;uniforms.selected.value=sprite.glow
    sprite.mesh.visible=!!uniforms.map.value&&sprite.opacity>.001
  }
  const background=artSprite('room',-100)
  const props=Object.fromEntries((['bowl','spoon','pin','knife','scraper','hand'] as PropKey[]).map(key=>[key,artSprite(key,key==='bowl'?1:8)])) as Record<PropKey,ArtSprite>
  const bowlFront=artSprite('bowlFront',6)
  const bowlContact=artSprite('bowlContact',0)
  const pinContacts=Array.from({length:3},(_,i)=>artSprite(`pinContact${i}`,7))
  const flatShadows={knife:artSprite('knifeContact',7),scraper:artSprite('scraperContact',7)}
  const contactCanvas=document.createElement('canvas');contactCanvas.width=256;contactCanvas.height=64
  const contactContext=contactCanvas.getContext('2d')!
  contactContext.scale(1,.25)
  const contactGradient=contactContext.createRadialGradient(128,128,8,128,128,127)
  contactGradient.addColorStop(0,'rgba(106,65,31,.28)');contactGradient.addColorStop(.35,'rgba(106,65,31,.2)');contactGradient.addColorStop(1,'rgba(106,65,31,0)')
  contactContext.fillStyle=contactGradient;contactContext.fillRect(0,0,256,256)
  const contactTexture=new THREE.CanvasTexture(contactCanvas);contactTexture.colorSpace=THREE.SRGBColorSpace;resources.push(contactTexture)
  ;[bowlContact,...pinContacts].forEach(sprite=>{sprite.mesh.material.uniforms.map.value=contactTexture})
  const assetKeys:Record<PropKey,string>={bowl:'bowl',spoon:'spoon',pin:'rollingPin',knife:'curvedKnife',scraper:'scraper',hand:'handMedallion'}
  function applyBox(element:HTMLElement,box:ArtBox){
    const minimum=element instanceof HTMLButtonElement?44:0
    const w=Math.max(element===bakeButton?90:minimum,box.width*artwork.width),h=Math.max(minimum,box.height*artwork.height)
    const x=artwork.x+box.u*artwork.width-(w-box.width*artwork.width)/2,y=artwork.y+box.v*artwork.height-(h-box.height*artwork.height)/2
    element.style.left=`${THREE.MathUtils.clamp(x,artwork.x,Math.min(width,artwork.x+artwork.width)-w)}px`
    element.style.top=`${THREE.MathUtils.clamp(y,artwork.y,Math.min(height,artwork.y+artwork.height)-h)}px`
    element.style.width=`${w}px`;element.style.height=`${h}px`
    if(element===bakeButton)fitBakeLabel()
  }
  function fitItem(item:Asset,box:ArtBox,rotate=false):ArtBox {
    const aw=layout.art.width,ah=layout.art.height
    const desiredW=box.width*aw,desiredH=box.height*ah,fit=containRaster(rotate?{width:item.height,height:item.width}:item,desiredW,desiredH)
    return{u:box.u+fit.x/aw,v:box.v+fit.y/ah,width:fit.width/aw,height:fit.height/ah}
  }
  const rotatedBounds=new Map<string,{minX:number;maxX:number;minY:number;maxY:number}>()
  function fitRotatedItem(item:Asset,box:ArtBox,rotation:number,texture:THREE.Texture){
    const key=item.url+rotation
    let bounds=rotatedBounds.get(key)
    if(!bounds){
      const canvas=document.createElement('canvas');canvas.width=item.width;canvas.height=item.height
      const context=canvas.getContext('2d')!;context.drawImage(texture.image as HTMLImageElement,0,0)
      const pixels=context.getImageData(0,0,item.width,item.height).data,c=Math.cos(rotation),s=Math.sin(rotation)
      bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity}
      for(let y=0;y<item.height;y+=3)for(let x=0;x<item.width;x+=3)if(pixels[(y*item.width+x)*4+3]>20){const dx=x-item.width/2,dy=y-item.height/2,rx=c*dx-s*dy,ry=s*dx+c*dy;bounds.minX=Math.min(bounds.minX,rx);bounds.maxX=Math.max(bounds.maxX,rx);bounds.minY=Math.min(bounds.minY,ry);bounds.maxY=Math.max(bounds.maxY,ry)}
      rotatedBounds.set(key,bounds)
    }
    const scale=Math.min(box.width*layout.art.width/(bounds.maxX-bounds.minX),box.height*layout.art.height/(bounds.maxY-bounds.minY))
    const cx=(box.u+box.width/2)*layout.art.width-(bounds.minX+bounds.maxX)/2*scale,cy=(box.v+box.height/2)*layout.art.height-(bounds.minY+bounds.maxY)/2*scale
    return{u:(cx-item.width*scale/2)/layout.art.width,v:(cy-item.height*scale/2)/layout.art.height,width:item.width*scale/layout.art.width,height:item.height*scale/layout.art.height}
  }
  function propBox(key:PropKey):ArtBox {
    if(key==='bowl'&&(stage==='ingredients'||stage==='mixing'||stage==='transferring')){
      const start=layout.id==='portrait'?{u:.17,v:.39,width:.66,height:.27}:layout.id==='landscape'?{u:.27,v:.35,width:.28,height:.44}:{u:.28,v:.43,width:.36,height:.34}
      if(stage!=='transferring')return start
      const end=layout.id==='desktop'?layout.props.bowl:{...start,u:-start.width-.08,v:start.v-.08}
      const t=transfer*transfer*(3-2*transfer),arc=Math.sin(t*Math.PI)*.035
      return{u:THREE.MathUtils.lerp(start.u,end.u,t),v:THREE.MathUtils.lerp(start.v,end.v,t)-arc,width:THREE.MathUtils.lerp(start.width,end.width,t),height:THREE.MathUtils.lerp(start.height,end.height,t)}
    }
    return layout.props[key]
  }
  function sourcePoint(sprite:ArtSprite,x:number,y:number){
    const item=sprite.asset!,pivot=sprite.mesh.material.uniforms.pivot.value as THREE.Vector2,c=Math.cos(sprite.rotation),s=Math.sin(sprite.rotation)
    const dx=(x/item.width-pivot.x)*sprite.rect.width*layout.art.width,dy=(y/item.height-pivot.y)*sprite.rect.height*layout.art.height
    return{u:sprite.rect.u+pivot.x*sprite.rect.width+(c*dx-s*dy)/layout.art.width,v:sprite.rect.v+pivot.y*sprite.rect.height+(s*dx+c*dy)/layout.art.height}
  }
  function ellipseContact(shadow:ArtSprite,sprite:ArtSprite,x:number,y:number,w:number,h:number,angle=0){
    const item=sprite.asset;if(!item)return
    const p=sourcePoint(sprite,x,y)
    shadow.rect={u:p.u-w/2,v:p.v-h/2+.0015,width:w,height:h};shadow.rotation=angle;shadow.opacity=sprite.opacity
    if(stage==='transferring')shadow.opacity*=.65+.35*Math.abs(transfer-.5)*2
    placeSprite(shadow)
  }
  function updateContactShadows(){
    const bowl=props.bowl,item=bowl.asset
    if(item)ellipseContact(bowlContact,bowl,item.contact.x,item.contact.y,bowl.rect.width*.42,bowl.rect.height*.055)
    const pin=props.pin,pinItem=pin.asset
    if(pinItem){
      const points=pinItem.supportContacts??[{name:'leftHandle',x:60,y:296,rx:32,ry:6},{name:'barrel',x:280,y:211,rx:130,ry:6,rotation:-.464},{name:'rightHandle',x:449,y:101,rx:25,ry:5}]
      points.forEach((p,i)=>ellipseContact(pinContacts[i],pin,p.x,p.y,pin.rect.width*p.rx*2/pinItem.width,pin.rect.height*p.ry*2/pinItem.height,p.rotation?pin.rotation+p.rotation:0))
    }
    for(const key of ['knife','scraper']as const){
      const sprite=props[key],shadow=flatShadows[key],item=sprite.asset;if(!item)continue
      const pad=12
      shadow.rect={u:sprite.rect.u-pad/item.width*sprite.rect.width+.001,v:sprite.rect.v-pad/item.height*sprite.rect.height+.002,width:sprite.rect.width*(1+pad*2/item.width),height:sprite.rect.height*(1+pad*2/item.height)}
      shadow.rotation=sprite.rotation;shadow.opacity=sprite.opacity;placeSprite(shadow)
    }
  }
  function makeFlatShadow(key:'knife'|'scraper',texture:THREE.Texture,item:Asset){
    const mask=document.createElement('canvas');mask.width=item.width+24;mask.height=item.height+24
    const context=mask.getContext('2d')!;context.drawImage(texture.image as HTMLImageElement,12,12)
    context.globalCompositeOperation='source-in';context.fillStyle='rgba(107,66,34,.2)';context.fillRect(0,0,mask.width,mask.height)
    const canvas=document.createElement('canvas');canvas.width=mask.width;canvas.height=mask.height
    const blurred=canvas.getContext('2d')!;blurred.filter='blur(5px)';blurred.drawImage(mask,0,0)
    const shadowTexture=new THREE.CanvasTexture(canvas);shadowTexture.colorSpace=THREE.SRGBColorSpace;resources.push(shadowTexture)
    flatShadows[key].mesh.material.uniforms.map.value=shadowTexture
  }
  function updateSpriteBoxes(){
    shadow.scale.set(layout.board.width/6.8,layout.board.depth/4.5,1)
    for(const key of Object.keys(props) as PropKey[]){
      const sprite=props[key],item=sprite.asset;if(!item)continue
      const target=fitItem(item,propBox(key))
      sprite.rotation=key==='pin'?(layout.id==='portrait'?Math.PI*2/3:Math.PI*.19):0
      sprite.rect=key==='pin'?fitRotatedItem(item,propBox(key),sprite.rotation,sprite.mesh.material.uniforms.map.value):target
      sprite.opacity=(key==='bowl'||key==='spoon')&&stage!=='ingredients'&&stage!=='mixing'&&stage!=='transferring'&&layout.id!=='desktop'?0:1
      if((key==='bowl'||key==='spoon')&&stage==='transferring'&&layout.id!=='desktop')sprite.opacity=1-THREE.MathUtils.smoothstep(transfer,.35,1)
      let hitBox=key==='pin'?{...propBox(key)}:target
      if(key==='pin'){
        const slot=propBox(key),contact=item.supportContacts?.find(p=>p.name==='barrel')??{x:280,y:211},p=sourcePoint(sprite,contact.x,contact.y)
        const du=slot.u+slot.width*.5-p.u,dv=slot.v+slot.height*(layout.id==='portrait'?.56:1)-p.v
        sprite.rect.u+=du;sprite.rect.v+=dv;hitBox={...slot,u:slot.u+du,v:slot.v+dv}
      }
      sprite.glow=(key==='pin'&&activeTool==='roll'||key==='knife'&&activeTool==='cut'||key==='scraper'&&activeTool==='move'||key==='hand'&&activeTool==='knead')&&stage==='working'?1:0
      placeSprite(sprite)
      const button=hotspots.find(button=>button.dataset.prop===key)!
      applyBox(button,hitBox);button.hidden=sprite.opacity===0
    }
    bowlFront.rect={...props.bowl.rect};bowlFront.opacity=props.bowl.opacity;placeSprite(bowlFront)
    applyBox(closeButton,layout.ui.close);applyBox(bakeButton,layout.ui.bake)
    applyBox(root.querySelector<HTMLElement>('.workshop-ingredients')!,layout.ui.ingredients)
    positionHandMenu()
    root.dataset.layout=layout.id
    updateContactShadows()
  }
  function positionHandMenu(){
    const handRect=handButton.getBoundingClientRect(),viewRect=view.getBoundingClientRect(),menuRect=handMenu.getBoundingClientRect(),w=menuRect.width||172,h=menuRect.height||62
    handMenu.style.left=`${THREE.MathUtils.clamp(handRect.right-viewRect.left+8,artwork.x,Math.min(width,artwork.x+artwork.width)-w)}px`
    handMenu.style.top=`${THREE.MathUtils.clamp(handRect.top-viewRect.top-h-8,artwork.y,Math.min(height,artwork.y+artwork.height)-h)}px`
  }
  function updateCue(){
    cue.hidden=!assetsReady||!handMenu.hidden||stage==='baking'||stage==='mixing'&&mixed>.2
    if(stage==='ingredients'||stage==='mixing')cue.textContent='↻ Stir in a circle'
    else if(stage==='transferring')cue.textContent='Onto the board…'
    else if(stage==='finished')cue.textContent='Freshly baked'
    else{
      const cues:Record<Tool,string>={knead:'Press and pull to shape',cup:'Hold to cup inward',fold:'Pull an edge over',roll:hand.down?'Roll across the dough':'Roll across to flatten',cut:hand.down?'Release to slice':'Drag across to slice',move:'Drag a piece to move it'}
      cue.textContent=cues[activeTool]
    }
    applyBox(cue,layout.id==='portrait'?{u:.17,v:.933,width:.44,height:.035}:layout.id==='landscape'?{u:.28,v:.943,width:.39,height:.04}:{u:.28,v:.94,width:.43,height:.035})
  }
  function activateReady(){
    assetsReady=propsReady&&backgroundReady
    if(assetsReady){status.hidden=!contextLost;root.dataset.ready='true';updateSpriteBoxes();rebuildMixSurface();updateState();warmSculpt(1,'raw');warmSculpt(1,'folded')}
  }
  async function loadLayout(target=layout,commit=false){
    const serial=++layoutSerial
    try{
      const texture=await loadTexture(`${base}art/${target.art.path}`)
      if(destroyed||serial!==layoutSerial)return
      if(commit){layout=target;artwork=containArtwork(layout,width,height);configureWorkshopCamera(camera,layout,width,height);root.style.setProperty('--workshop-art-scale',String(artwork.scale));root.style.setProperty('--workshop-bake-font',layout.id==='portrait'?'90px':'68px');updateSpriteBoxes();rebuildMixSurface()}
      background.mesh.material.uniforms.map.value=texture;background.rect={u:0,v:0,width:1,height:1};placeSprite(background)
      backgroundReady=true;layoutChanging=false;activateReady()
    }
    catch{if(!destroyed){status.hidden=false;status.textContent='The kitchen artwork could not load. Close and try again.'}}
  }
  const propTextures=fetch(`${base}art/lavender/workshop-authored/manifest.json`,{signal}).then(response=>{if(!response.ok)throw Error('Missing authored props');return response.json()}).then(async data=>{
    await Promise.all((Object.keys(props) as PropKey[]).map(async key=>{const item=data.items[assetKeys[key]] as Asset;const texture=await loadTexture(artUrl(item.url));if(destroyed)return;props[key].asset=item;props[key].mesh.material.uniforms.map.value=texture;props[key].mesh.material.uniforms.texel.value.set(1/item.width,1/item.height);if(key==='knife'||key==='scraper')makeFlatShadow(key,texture,item)}))
    if(destroyed)return
    const bowlItem=data.items.bowl as Asset
    if(bowlItem.foregroundUrl){bowlFront.mesh.material.uniforms.map.value=await loadTexture(artUrl(bowlItem.foregroundUrl));bowlFront.asset=bowlItem}
    await Promise.all(([['closeMedallion',closeButton],['bakeFrame',bakeButton]]as const).map(async([name,element])=>{const item=data.items[name];if(item){await loadTexture(artUrl(item.url));if(destroyed)return;element.style.backgroundImage=`url("${artUrl(item.url)}")`;if(name==='closeMedallion')element.textContent='';else bakeFrameSize={width:item.width,height:item.height}}}))
    root.querySelector<HTMLImageElement>('.workshop-menu-hand')!.src=artUrl(data.items.handMedallion.url)
    if(destroyed)return;propsReady=true;activateReady()
  }).catch(()=>{if(!destroyed){status.hidden=false;status.textContent='The bakehouse tools could not load. Close and try again.'}})
  void propTextures;void loadLayout()
  const shadowMaterial=new THREE.ShadowMaterial({color:'#916844',opacity:.29});resources.push(shadowMaterial)
  const shadow=mesh(new THREE.PlaneGeometry(6.8,4.5),shadowMaterial,0,.006,0);shadow.rotation.x=-Math.PI/2;shadow.receiveShadow=true;shadow.renderOrder=2
  const surface=createWorkshopSurface()
  const doughMaterial=surface.raw,cutMaterial=surface.cut
  const crumbCanvas=document.createElement('canvas');crumbCanvas.width=crumbCanvas.height=256;const crumb=crumbCanvas.getContext('2d')!
  crumb.fillStyle='#fff1d3';crumb.fillRect(0,0,256,256)
  for(let i=0;i<6000;i++){crumb.fillStyle=random()>.5?'#d2b98c20':'#ffffff66';crumb.fillRect(random()*256,random()*256,.6+random(),.5+random()*.5)}
  const crumbTexture=new THREE.CanvasTexture(crumbCanvas);crumbTexture.colorSpace=THREE.SRGBColorSpace;crumbTexture.wrapS=crumbTexture.wrapT=THREE.RepeatWrapping;resources.push(crumbTexture)
  const seamMaterial=doughMaterial
  const mixGeometry=new THREE.PlaneGeometry(1,1,44,44);resources.push(mixGeometry)
  const mixMaterial=material('#f8e8c4',.9);mixMaterial.emissive.set('#bca079');mixMaterial.emissiveIntensity=.08
  mixMaterial.vertexColors=true;mixMaterial.color.set('#ffffff');mixMaterial.bumpMap=crumbTexture;mixMaterial.bumpScale=.012
  mixMaterial.side=THREE.DoubleSide
  mixGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(mixGeometry.attributes.position.count*3).fill(1),3))
  const mixSurface=new THREE.Mesh(mixGeometry,mixMaterial);mixSurface.renderOrder=4;scene.add(mixSurface)
  let mixOriginal=new Float32Array(mixGeometry.attributes.position.array)
  const mixEllipse={cx:.5,cy:.5,rx:.1,ry:.05,rotation:0}
  let mixRegistration=''
  function rebuildMixSurface(){
    const item=props.bowl.asset;if(!item)return
    const e=item.mixSurfaceEllipse??item.innerRimEllipse;if(!e)return
    const rect=props.bowl.rect
    const working=stage==='working'||stage==='baking'||stage==='finished',draining=stage==='transferring'?1-transfer*.7:1
    const registration=[layout.id,width,height,rect.u,rect.v,rect.width,rect.height,working,draining].join(',')
    if(registration===mixRegistration)return
    mixRegistration=registration
    mixEllipse.cx=rect.u+e.cx/item.width*rect.width;mixEllipse.cy=rect.v+e.cy/item.height*rect.height+(working?.07*rect.height:0)
    mixEllipse.rx=e.rx/item.width*rect.width*(working?.55:draining);mixEllipse.ry=e.ry/item.height*rect.height*(working?.55:draining);mixEllipse.rotation=e.rotation??0
    root.dataset.mixCx=String(artwork.x+mixEllipse.cx*artwork.width);root.dataset.mixCy=String(artwork.y+mixEllipse.cy*artwork.height)
    root.dataset.mixRx=String(mixEllipse.rx*artwork.width);root.dataset.mixRy=String(mixEllipse.ry*artwork.height)
    const positions=mixGeometry.getAttribute('position')as THREE.BufferAttribute
    const projector=createArtworkProjector(camera,layout,width,height),target=new THREE.Vector3()
    for(let i=0;i<positions.count;i++){
      const ix=i%45,iy=Math.floor(i/45),sx=ix/44*2-1,sy=iy/44*2-1
      const dx=sx*Math.sqrt(Math.max(0,1-sy*sy/2)),dy=sy*Math.sqrt(Math.max(0,1-sx*sx/2))
      const p=projector.toBoard(mixEllipse.cx+dx*mixEllipse.rx,mixEllipse.cy+dy*mixEllipse.ry,.72,target)
      if(p)positions.setXYZ(i,p.x,p.y,p.z)
    }
    mixOriginal=new Float32Array(positions.array);positions.needsUpdate=true;mixGeometry.computeVertexNormals()
  }
  const handMarker=mesh(new THREE.TorusGeometry(.11,.012,8,40),material('#c4a6cd'),0,.025,0);handMarker.rotation.x=-Math.PI/2;handMarker.visible=false
  const selection=mesh(new THREE.TorusGeometry(1,.01,8,80),material('#cbb2d1'),0,.016,0);selection.rotation.x=-Math.PI/2;selection.visible=false
  handMarker.renderOrder=7;selection.renderOrder=7
  const surfaceRay=new THREE.Raycaster(),surfaceDown=new THREE.Vector3(0,-1,0)
  let cutPreviewKey=''
  function cutSurfacePoint(x:number,z:number){
    const piece=activePiece()
    if(piece){piece.mesh.updateMatrixWorld(true);surfaceRay.set(new THREE.Vector3(x,4,z),surfaceDown);const hit=surfaceRay.intersectObject(piece.mesh,false)[0];if(hit)return hit.point}
    return new THREE.Vector3(x,.025,z)
  }
  function updateCutPreview(){
    const piece=activePiece(),visible=assetsReady&&!contextLost&&!layoutChanging&&stage==='working'&&activeTool==='cut'&&!!piece
    cutPreview.toggleAttribute('hidden',!visible)
    if(!visible||!piece)return
    const positions=piece.mesh.geometry.getAttribute('position')as THREE.BufferAttribute
    const dragging=hand.down||cutPending
    const key=[piece.seed,piece.mesh.geometry.id,positions.version,piece.mesh.position.x,piece.mesh.position.z,dragging,hand.start.x,hand.start.y,hand.x,hand.z,width,height,layout.id].join(',')
    if(key===cutPreviewKey)return
    cutPreviewKey=key
    cutPreview.dataset.dragging=String(dragging)
    const center=piece.bounds.getCenter(new THREE.Vector3()).add(piece.mesh.position),size=piece.bounds.getSize(new THREE.Vector3())
    const start=dragging?hand.start:new THREE.Vector2(center.x-size.x*.43,center.z)
    const end=dragging?new THREE.Vector2(hand.x,hand.z):new THREE.Vector2(center.x+size.x*.43,center.z)
    const points:{x:number;y:number}[]=[]
    for(let i=0;i<=48;i++){
      const t=i/48,p=cutSurfacePoint(THREE.MathUtils.lerp(start.x,end.x,t),THREE.MathUtils.lerp(start.y,end.y,t)),art=boardToArtwork(camera,layout,width,height,p)
      points.push({x:artwork.x+art.u*artwork.width,y:artwork.y+art.v*artwork.height})
    }
    const path=points.map((point,i)=>`${i?'L':'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
    cutPaths.forEach(node=>node.setAttribute('d',path))
    const first=points[0],last=points[points.length-1],previous=points[points.length-3]
    cutStart.setAttribute('cx',String(first.x));cutStart.setAttribute('cy',String(first.y))
    const angle=Math.atan2(last.y-previous.y,last.x-previous.x),wing=8
    cutEnd.setAttribute('d',`M${last.x-Math.cos(angle-.6)*wing},${last.y-Math.sin(angle-.6)*wing} L${last.x},${last.y} L${last.x-Math.cos(angle+.6)*wing},${last.y-Math.sin(angle+.6)*wing}`)
  }
  const steamMaterial=new THREE.MeshBasicMaterial({color:'#fff4df',transparent:true,opacity:0,depthWrite:false});resources.push(steamMaterial)
  const steam=Array.from({length:9},()=>{const puff=mesh(new THREE.SphereGeometry(.06,12,8),steamMaterial);puff.visible=false;return puff})
  function preserveSculptNormals(geometry:THREE.BufferGeometry){
    const authored=new Float32Array(geometry.getAttribute('normal').array)
    geometry.computeVertexNormals()
    const normal=geometry.getAttribute('normal')as THREE.BufferAttribute,correction=new Float32Array(authored.length)
    for(let i=0;i<authored.length;i++)correction[i]=authored[i]-normal.array[i]
    normal.array.set(authored);normal.needsUpdate=true
    return correction
  }
  function makePiece(geometry: THREE.BufferGeometry, mass?: number): DoughPiece {
    if (!geometry.groups.length) geometry.addGroup(0, geometry.index?.count ?? geometry.attributes.position.count, 0)
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const center = box.getCenter(new THREE.Vector3())
    const minY = box.min.y
    geometry.translate(-center.x, -minY, -center.z)
    const source = new Float32Array(geometry.attributes.position.array)
    const dough = new THREE.Mesh(geometry, [doughMaterial, cutMaterial])
    dough.position.set(center.x, .018 + minY, center.z)
    dough.renderOrder=3
    dough.castShadow = true
    dough.receiveShadow = true
    scene.add(dough)

    resources.push(geometry)
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    const piece: DoughPiece = { mesh: dough, seed:++pieceSerial, rest: source, offset: new Float32Array(source.length), velocity: new Float32Array(source.length), plastic: new Float32Array(source.length), mass: mass ?? doughVolume(geometry), stretch: 1, fold: 0, bounds: geometry.boundingBox!.clone(),normalCorrection:preserveSculptNormals(geometry),dirty:false }
    pieces.push(piece)
    warmSculpt(piece.seed,'folded')
    return piece
  }
  function activePiece() { return pieces[selected] ?? pieces[0] }
  function recognize(piece = activePiece()): WorkshopShape {
    if (!piece) return 'round'
    if (piece.fold > .65) return 'folded'
    const size = piece.bounds.getSize(new THREE.Vector3())
    return size.x / Math.max(.1, size.z) > 1.65 ? 'long' : 'round'
  }
  function batchShape(): WorkshopShape {
    const masses: Record<WorkshopShape, number> = { round: 0, folded: 0, long: 0 }
    pieces.forEach(piece => { masses[recognize(piece)] += piece.mass })
    return (Object.entries(masses) as [WorkshopShape, number][]).sort((a, b) => b[1] - a[1])[0][0]
  }
  function refreshBounds(piece: DoughPiece) {
    piece.bounds.makeEmpty()
    const point = new THREE.Vector3()
    for (let i = 0; i < piece.rest.length; i += 3) piece.bounds.expandByPoint(point.set(piece.rest[i] + piece.plastic[i], piece.rest[i + 1] + piece.plastic[i + 1], piece.rest[i + 2] + piece.plastic[i + 2]))
    piece.mesh.geometry.boundingSphere = new THREE.Sphere(piece.bounds.getCenter(new THREE.Vector3()), piece.bounds.getSize(new THREE.Vector3()).length() * .6 + .4)
    piece.mesh.geometry.boundingBox = piece.bounds.clone().expandByScalar(.4)
  }
  function keepOnBoard(piece: DoughPiece) {
    // Pressing reserves a wider rim; newly cut sections can use that room to
    // separate visibly even when a pancake fills the hand-shaping workspace.
    const left = -layout.board.width/2+.06-piece.bounds.min.x, right = layout.board.width/2-.06-piece.bounds.max.x
    const back = -layout.board.depth/2+.06-piece.bounds.min.z, front = layout.board.depth/2-.06-piece.bounds.max.z
    piece.mesh.position.x = left <= right ? THREE.MathUtils.clamp(piece.mesh.position.x, left, right) : (left + right) / 2
    piece.mesh.position.z = back <= front ? THREE.MathUtils.clamp(piece.mesh.position.z, back, front) : (back + front) / 2
  }
  function discardGeometry(geometry:THREE.BufferGeometry){
    const index=resources.indexOf(geometry)
    if(index>=0)resources.splice(index,1)
    geometry.dispose()
  }
  function form(piece:DoughPiece,shape:WorkshopShape){
    const oldBounds=piece.bounds.clone(),oldSize=oldBounds.getSize(new THREE.Vector3()),oldCenter=oldBounds.getCenter(new THREE.Vector3())
    piece.stretch=shape==='long'?Math.min(1.25,piece.stretch+.1):1
    piece.fold=shape==='folded'?1:0
    const geometry=createSculptedDough({shape,mass:piece.mass,stretch:piece.stretch,seed:piece.seed})
    const source=new Float32Array(geometry.getAttribute('position').array),box=geometry.boundingBox!,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3())
    const offset=new Float32Array(source.length)
    for(let i=0;i<source.length;i+=3){
      offset[i]=(oldCenter.x+(source[i]-center.x)/Math.max(.01,size.x)*oldSize.x-source[i])*.8
      offset[i+1]=(oldCenter.y+(source[i+1]-center.y)/Math.max(.01,size.y)*oldSize.y-source[i+1])*.8
      offset[i+2]=(oldCenter.z+(source[i+2]-center.z)/Math.max(.01,size.z)*oldSize.z-source[i+2])*.8
    }
    discardGeometry(piece.mesh.geometry);resources.push(geometry);piece.mesh.geometry=geometry
    piece.rest=source;piece.offset=offset;piece.velocity=new Float32Array(source.length);piece.plastic=new Float32Array(source.length)
    piece.normalCorrection=preserveSculptNormals(geometry);piece.dirty=true
    piece.mesh.position.y=.018;refreshBounds(piece);keepOnBoard(piece)
  }  function updateState() {
    root.dataset.stage = stage
    root.dataset.shape = batchShape()
    root.dataset.worked = String(work > .05)
    root.dataset.mixed = mixed.toFixed(3)
    root.dataset.pieceCount = String(pieces.length)
    root.dataset.selectedPiece = String(selected + 1)
    root.dataset.tool = activeTool
    root.dataset.mass = pieces.reduce((sum, piece) => sum + piece.mass, 0).toFixed(5)
    root.dataset.cutting=String(cutPending);root.setAttribute('aria-busy',String(cutPending))
    bakeButton.hidden=stage==='ingredients'||stage==='mixing'||stage==='transferring'
    toolButtons.forEach(button => { button.disabled = contextLost || cutPending || stage !== 'working'; button.setAttribute('aria-pressed', String(button.dataset.tool === activeTool)) })
    hotspots.filter(button=>button.dataset.prop==='bowl'||button.dataset.prop==='spoon').forEach(button=>{button.disabled=stage!=='ingredients'&&stage!=='mixing'})
    if (stage === 'ingredients') hint.textContent = ''
    if (stage === 'mixing') { hint.textContent = 'Stir in a circle.' }
    if (stage === 'working') {
      const instructions: Record<Tool, string> = { knead: 'Press and stretch the dough.', cup: 'Cup the edges inward.', roll: 'Roll beneath both hands.', fold: 'Lift an edge over, then press the seam.', cut: pieces.length >= 6 ? 'Six pieces fit on this board.' : 'Draw a cut across the dough.', move: 'Pick up a piece and set it down.' }
      hint.textContent = instructions[activeTool]
      bakeButton.innerHTML = '<span>Bake</span>'
      bakeButton.disabled = contextLost||cutPending
    }
    if(assetsReady&&!hand.down&&!cutPending){updateSpriteBoxes();rebuildMixSurface()}
    updateCue()
    fitBakeLabel()
    closeHandMenu()
  }
  function mix(amount: number) {
    if(layoutChanging)return
    if (stage === 'ingredients') stage = 'mixing'
    if (stage !== 'mixing') return
    mixed = Math.min(1, mixed + amount)
    stirring += amount * Math.PI * 5
    if (mixed === 1) {
      const origin=artworkToBoard(camera,layout,width,height,mixEllipse.cx,mixEllipse.cy,.72)
      if(origin)transferOrigin.copy(origin)
      transfer=0;stage = reduced.matches?'working':'transferring'
      const geometry=createSculptedDough({shape:'raw',mass:1.93471,seed:1})
      const piece=makePiece(geometry)
      transferOrigin.y-=piece.bounds.max.y*.175
      if(reduced.matches)transfer=1
      release(undefined,true)
      announce(reduced.matches?'The dough is ready on the board.':'The dough is coming onto the board.')
      view.focus({ preventScroll: true })
    }
    updateState()
  }
  function knead(dx: number, dz: number, strength: number) {
    const piece = activePiece()
    if (!piece || stage !== 'working') return
    const handle=latchDoughHandle(piece.mesh.geometry,hand.x-piece.mesh.position.x,hand.z-piece.mesh.position.z)
    shapeDoughHandle(piece.mesh.geometry,handle,dx,dz,strength*.2,activeTool==='roll'?'roll':'knead',localBoard(piece))
    retainDeformation(piece)
    work += strength * .42 + Math.hypot(dx, dz)
    refreshBounds(piece)
    keepOnBoard(piece)
    updateState()
  }
  function localBoard(piece:DoughPiece){
    return new THREE.Box3(new THREE.Vector3(-layout.board.width/2+.22-piece.mesh.position.x,0,-layout.board.depth/2+.3-piece.mesh.position.z),new THREE.Vector3(layout.board.width/2-.22-piece.mesh.position.x,5,layout.board.depth/2-.3-piece.mesh.position.z))
  }
  function retainDeformation(piece:DoughPiece){
    const positions=piece.mesh.geometry.getAttribute('position').array
    for(let i=0;i<piece.rest.length;i++)piece.plastic[i]=positions[i]-piece.rest[i]
    piece.offset.fill(0);piece.velocity.fill(0);piece.dirty=true
    refreshBounds(piece)
  }
  function latchDough(point:THREE.Vector3){
    const piece=activePiece(),local=point.clone().sub(piece.mesh.position)
    grab={piece,handle:latchDoughHandle(piece.mesh.geometry,local.x,local.z),delta:new THREE.Vector2(),pressure:.035,action:activeTool as DoughHandAction,changed:true}
    piece.dirty=true
  }
  function pullDough(){
    if(!grab)return
    const delta=new THREE.Vector2(hand.x-hand.start.x,hand.z-hand.start.y)
    work+=delta.distanceTo(grab.delta);grab.delta.copy(delta);grab.changed=true;grab.piece.dirty=true
  }
  async function cutSelected(start: THREE.Vector2, end: THREE.Vector2) {
    if(cutPending||contextLost||destroyed)return
    if (pieces.length >= 6) { announce('Six pieces fit on this board.'); return }
    const piece = activePiece()
    if (!piece || start.distanceTo(end) < .28) return
    const normal = new THREE.Vector3(end.y - start.y, 0, start.x - end.x).normalize()
    const midpoint = new THREE.Vector3((start.x + end.x) / 2 - piece.mesh.position.x, 0, (start.y + end.y) / 2 - piece.mesh.position.z)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, midpoint)
    const id=++cutSerial,request:DoughCutRequest={id,geometry:packDoughGeometry(piece.mesh.geometry),normal:[normal.x,normal.y,normal.z],constant:plane.constant}
    cutPending=true;root.dataset.cutEngine=cutWorker?'worker':'local';updateState()
    let result:DoughCutResult
    try {
      if(cutWorker){result=await new Promise<DoughCutResult>((resolve,reject)=>{cutResolve=resolve;cutReject=reject;try{cutWorker!.postMessage(request,doughTransferBuffers(request.geometry))}catch(error){cutResolve=null;cutReject=null;reject(error)}})}
      else {await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));result=executeDoughCut(request)}
    }catch{
      if(id===cutSerial&&!destroyed)announce('The dough is safe. Try the cut again.')
      result={id}
    }
    if(id!==cutSerial||destroyed||contextLost)return
    cutPending=false;updateState()
    if(!result.halves||!result.volumes)return
    const halves=result.halves.map(unpackDoughGeometry),volumes=result.volumes,total=volumes[0]+volumes[1]
    if (volumes.some(volume => volume < total * .075)) { halves.forEach(half => half.dispose()); announce('Leave a little more dough on each side of the cut.'); return }
    const origin = piece.mesh.position.clone()
    const pieceIndex=pieces.indexOf(piece)
    if(pieceIndex<0){halves.forEach(half=>half.dispose());return}
    pieces.splice(pieceIndex, 1)
    scene.remove(piece.mesh);discardGeometry(piece.mesh.geometry)
    halves.forEach((half, index) => {
      const created = makePiece(half, piece.mass * volumes[index] / total)
      created.mesh.position.x += origin.x + normal.x * (index === 0 ? .14 : -.14)
      created.mesh.position.z += origin.z + normal.z * (index === 0 ? .14 : -.14)
      created.mesh.position.y = .018
      created.fold = piece.fold
      keepOnBoard(created)
    })
    selected = pieces.length - 2
    work += 1
    updateState()
    announce(`Cut into ${pieces.length} pieces. Pick a piece to shape it.`)
  }
  function tool(action: Tool, keyboard = false) {
    if (stage !== 'working'||layoutChanging||cutPending) return
    if(hand.down)release(undefined,true)
    activeTool = action
    const piece = activePiece()
    if (!piece) return
    if((action==='roll'||action==='cup'||action==='fold')&&!keyboard){updateState();announce(action==='roll'?'Rolling pin selected. Roll over the dough.':action==='cup'?'Cup the dough inward with a held press.':'Lift and pull an edge, then press the fold.');return}
    if (action === 'knead') { hand.x = piece.mesh.position.x + .1; hand.z = piece.mesh.position.z; knead(.025, .02, 1.6) }
    else if (action === 'cup' || action === 'roll' || action === 'fold') {
      const alreadyFolded=action==='fold'&&piece.fold>.65,alreadyRound=action==='cup'&&piece.mesh.geometry.userData.sculptedDough?.shape==='round'
      if(alreadyFolded||alreadyRound){
        const size=piece.bounds.getSize(new THREE.Vector3()),side=Math.sin(work*3.2)
        hand.x=piece.mesh.position.x+side*size.x*.28;hand.z=piece.mesh.position.z+(alreadyFolded?piece.bounds.max.z*.65:side*size.z*.25)
        knead(alreadyRound?-side*.09:0,-.025,1.15);work+=.5
      }else{form(piece, action === 'cup' ? 'round' : action === 'roll' ? 'long' : 'folded');work+=1}
      announce(action === 'cup' ? 'Cup inward into a round bun.' : action === 'roll' ? 'The dough stretches into a long roll.' : 'Lift the far edge over and seal the fold.')
    } else if (action === 'cut' && keyboard) {
      const center = piece.bounds.getCenter(new THREE.Vector3()).add(piece.mesh.position)
      cutSelected(new THREE.Vector2(center.x, center.z - 2), new THREE.Vector2(center.x, center.z + 2))
    }
    updateState()
  }
  toolButtons.filter(button=>button!==handButton).forEach(button => button.addEventListener('click', () => tool(button.dataset.tool as Tool), { signal }))
  hotspots.filter(button=>button.dataset.prop==='bowl'||button.dataset.prop==='spoon').forEach(button=>button.addEventListener('click',()=>{if(stage==='ingredients'||stage==='mixing'){mix(.1);view.focus({preventScroll:true})}},{signal}))
  handButton.addEventListener('click',()=>{if(stage!=='working')return;if(hand.down)release(undefined,true);if(!handMenu.hidden){closeHandMenu();updateCue();return}activeTool='knead';updateState();handMenu.hidden=false;handButton.setAttribute('aria-expanded','true');positionHandMenu();updateCue()},{signal})
  handMenu.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{closeHandMenu();view.focus({preventScroll:true})},{signal}))
  const raycaster = new THREE.Raycaster()
  const down=new THREE.Vector3(0,-1,0)
  const hitPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.75)
  const hit = new THREE.Vector3()
  function ray(event: PointerEvent) {
    const rect = view.getBoundingClientRect()
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera)
  }
  function pointerArt(event:PointerEvent){const rect=view.getBoundingClientRect();return{u:(event.clientX-rect.left-artwork.x)/artwork.width,v:(event.clientY-rect.top-artwork.y)/artwork.height}}
  function pickPiece(event:PointerEvent) {
    const intersection = raycaster.intersectObjects(pieces.map(piece => piece.mesh), false)[0]
    if(intersection){selected=pieces.findIndex(piece=>piece.mesh===intersection.object);hit.copy(intersection.point);hitPlane.constant=-hit.y;return true}
    const rect=view.getBoundingClientRect(),px=event.clientX-rect.left,py=event.clientY-rect.top,halo=event.pointerType==='touch'?24:16
    let best=halo*halo,chosen=-1
    const point=new THREE.Vector3(),worldPoint=new THREE.Vector3(),closest=new THREE.Vector3()
    pieces.forEach((piece,index)=>{
      piece.mesh.updateMatrixWorld(true)
      const positions=piece.mesh.geometry.getAttribute('position')
      for(let i=0;i<positions.count;i+=3){
        worldPoint.fromBufferAttribute(positions,i).applyMatrix4(piece.mesh.matrixWorld);point.copy(worldPoint).project(camera)
        if(point.z< -1||point.z>1)continue
        const dx=(point.x+1)*width/2-px,dy=(1-point.y)*height/2-py,distance=dx*dx+dy*dy
        if(distance<best){best=distance;chosen=index;closest.copy(worldPoint)}
      }
    })
    if(chosen<0)return false
    selected=chosen;hit.copy(closest);hitPlane.constant=-hit.y;return true
  }
  view.addEventListener('pointerdown', event => {
    if(event.button!==0)return
    if (!assetsReady || contextLost || cutPending || layoutChanging || committed || hand.pointerId !== null || stage === 'finished' || stage === 'baking'||stage==='transferring') return
    if(event.target instanceof Element&&event.target.closest('.workshop-close,.workshop-bake,.workshop-hand-menu,.workshop-accessible-tools'))return
    if(stage==='working'&&event.target instanceof Element&&event.target.closest('[data-prop="knife"],[data-prop="scraper"],[data-prop="hand"]'))return
    const pickedPin=stage==='working'&&event.target instanceof Element&&!!event.target.closest('[data-prop="pin"]')
    if(pickedPin){activeTool='roll';rollingOwner=null;rollingLast=null;rollingTravel=0;for(const sprite of Object.values(props)){sprite.glow=sprite===props.pin?1:0;placeSprite(sprite)}}
    ray(event)
    if (stage === 'ingredients' || stage === 'mixing') {
      const point=pointerArt(event),dx=(point.u-mixEllipse.cx)/mixEllipse.rx,dy=(point.v-mixEllipse.cy)/mixEllipse.ry
      hitPlane.constant = -.72
      if (!raycaster.ray.intersectPlane(hitPlane, hit) || Math.hypot(dx,dy)>1.2) return
      if (stage === 'ingredients') mix(0)
      hand.angle = Math.atan2(dy,dx)
    } else {
      const intersection = pickPiece(event)
      if (!intersection && activeTool !== 'cut'&&!pickedPin) return
      if (!intersection) { const piece=activePiece();hitPlane.constant=piece?-(piece.mesh.position.y+piece.bounds.getCenter(new THREE.Vector3()).y):-.025;if(!raycaster.ray.intersectPlane(hitPlane,hit))return }
    }
    event.preventDefault()
    view.focus({ preventScroll: true })
    const materialPoint=hit.clone()
    raycaster.ray.intersectPlane(hitPlane,hit)
    hand.x = hit.x; hand.z = hit.z
    hand.start.set(hit.x, hit.z)
    hand.down = true
    hand.pointerId = event.pointerId
    hand.edge = Math.abs(hit.x - (activePiece()?.mesh.position.x ?? 0)) > .65
    view.setPointerCapture(event.pointerId)
    if (stage === 'working' && (activeTool === 'knead' || activeTool === 'cup' || activeTool === 'fold'))latchDough(materialPoint)
    if(stage==='working'&&activeTool==='roll'&&!pickedPin){rollingOwner=activePiece();rollingLast=materialPoint.clone();rollingTravel=0}
    root.dataset.touching = 'true'
    updateState()
  }, { signal })
  view.addEventListener('pointermove', event => {
    if (hand.pointerId !== event.pointerId || !hand.down) return
    ray(event)
    if (!raycaster.ray.intersectPlane(hitPlane, hit)) return
    const x=hit.x,z=hit.z
    const dx = THREE.MathUtils.clamp(x - hand.x, -.22, .22), dz = THREE.MathUtils.clamp(z - hand.z, -.22, .22)
    hand.x = x; hand.z = z
    if (stage === 'mixing') {
      const point=pointerArt(event),dx=(point.u-mixEllipse.cx)/mixEllipse.rx,dy=(point.v-mixEllipse.cy)/mixEllipse.ry
      const radius = Math.hypot(dx,dy)
      if (radius > .15 && radius < 1.2) {
        const angle = Math.atan2(dy,dx)
        const delta = Math.atan2(Math.sin(angle - hand.angle), Math.cos(angle - hand.angle))
        if (Math.abs(delta) < .7) mix(Math.abs(delta) / (Math.PI * 4.5))
        hand.angle = angle
      }
    } else if (stage === 'working') {
      const piece = activePiece()
      if (activeTool === 'move' || event.shiftKey) {
        piece.mesh.position.x = THREE.MathUtils.clamp(piece.mesh.position.x + dx, -2.6, 2.6)
        piece.mesh.position.z = THREE.MathUtils.clamp(piece.mesh.position.z + dz, -layout.board.depth/2, layout.board.depth/2)
        work += Math.hypot(dx, dz) * .2
      } else if (activeTool === 'cut') {
        const p=boardToArtwork(camera,layout,width,height,cutSurfacePoint(x,z)),item=props.knife.asset
        if(item){props.knife.rect.u=p.u-props.knife.rect.width*item.contact.x/item.width;props.knife.rect.v=p.v-props.knife.rect.height*item.contact.y/item.height;props.knife.rotation=-Math.atan2(z-hand.start.y,x-hand.start.x)*.4;placeSprite(props.knife)}
      } else if (activeTool === 'roll') {
        const contactHit=raycaster.intersectObjects(pieces.map(piece=>piece.mesh),false)[0]
        let contactPoint:THREE.Vector3
        if(contactHit){
          selected=pieces.findIndex(piece=>piece.mesh===contactHit.object)
          const owner=activePiece(),point=contactHit.point
          if(rollingOwner!==owner)rollingTravel=0
          if(rollingOwner===owner&&rollingLast){
            const rollX=point.x-rollingLast.x,rollZ=point.z-rollingLast.z
            rollingTravel+=Math.hypot(rollX,rollZ)
            hand.x=point.x;hand.z=point.z;knead(rollX*.45,rollZ*.45,Math.hypot(rollX,rollZ)*2.8)
            props.pin.mesh.material.uniforms.rollPhase.value+=(rollZ+rollX*.3)/.18
            if(rollingTravel>.28){rollingTravel=0;work+=.5}
          }
          rollingOwner=owner;rollingLast=point.clone();contactPoint=point.clone()
        }else{
          rollingOwner=null;rollingLast=null;rollingTravel=0
          const floor=new THREE.Plane(down,.025)
          contactPoint=raycaster.ray.intersectPlane(floor,new THREE.Vector3())??new THREE.Vector3(x,.025,z)
        }
        contactPoint.y+=.012
        const p=boardToArtwork(camera,layout,width,height,contactPoint),item=props.pin.asset
        if(item){const contact=item.supportContacts?.find(point=>point.name==='barrel')??{x:280,y:211},current=sourcePoint(props.pin,contact.x,contact.y);props.pin.rect.u+=p.u-current.u;props.pin.rect.v+=p.v-current.v;placeSprite(props.pin)}
      } else if(grab)pullDough();else knead(dx,dz,.1)
      updateState()
    }
    event.preventDefault()
  }, { signal })
  function release(event?: PointerEvent, cancel = false) {
    if (event && event.pointerId !== hand.pointerId) return
    const wasDown = hand.down, pointerId = hand.pointerId
    hand.down = false
    props.pin.mesh.material.uniforms.rollPhase.value=0
    hand.pointerId = null
    grab=null
    rollingOwner=null;rollingLast=null;rollingTravel=0
    if (pointerId !== null && view.hasPointerCapture(pointerId)) view.releasePointerCapture(pointerId)
    if (!cancel && wasDown && stage === 'working' && activeTool === 'cut') cutSelected(hand.start, new THREE.Vector2(hand.x, hand.z))
    if(!cutPending)cutPreview.setAttribute('hidden','')
    root.dataset.touching = 'false'
    if(assetsReady&&!cutPending){updateSpriteBoxes();rebuildMixSurface()}
    updateCue()
  }
  view.addEventListener('pointerup', event => release(event), { signal })
  view.addEventListener('pointercancel', event => release(event, true), { signal })
  view.addEventListener('lostpointercapture', () => release(undefined, true), { signal })
  window.addEventListener('blur', () => release(undefined, true), { signal })
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault();if(!handMenu.hidden)closeHandMenu(true);else close();return }
    if(contextLost||cutPending)return
    if (event.target instanceof HTMLButtonElement) return
    if ((stage === 'mixing' || stage === 'ingredients') && (event.key === ' ' || event.key.startsWith('Arrow'))) {
      event.preventDefault(); mix(.095); return
    }
    if (stage !== 'working') return
    const movement: Record<string, [number, number]> = { ArrowLeft: [-.16, 0], ArrowRight: [.16, 0], ArrowUp: [0, -.16], ArrowDown: [0, .16] }
    if (movement[event.key]) {
      const [dx, dz] = movement[event.key], piece = activePiece()
      if (event.shiftKey || activeTool === 'move') {
        piece.mesh.position.x = THREE.MathUtils.clamp(piece.mesh.position.x + dx, -2.6, 2.6)
        piece.mesh.position.z = THREE.MathUtils.clamp(piece.mesh.position.z + dz, -layout.board.depth/2, layout.board.depth/2)
      } else {
        hand.x = THREE.MathUtils.clamp(hand.x + dx, -2.7, 2.7)
        hand.z = THREE.MathUtils.clamp(hand.z + dz, -1.6, 1.6)
        knead(dx, dz, .4)
      }
      event.preventDefault()
    } else if (/^[1-6]$/.test(event.key) && Number(event.key) <= pieces.length) {
      if(hand.down)release(undefined,true)
      selected = Number(event.key) - 1
      hand.x = activePiece().mesh.position.x; hand.z = activePiece().mesh.position.z
      updateState(); announce(`Piece ${selected + 1} selected.`); event.preventDefault()
    } else {
      const actions: Record<string, Tool> = { ' ': 'knead', c: 'cup', r: 'roll', f: 'fold', x: 'cut', m: 'move' }
      const action = actions[event.key.toLowerCase()]
      if (action) { event.preventDefault(); tool(action, true) }
    }
  }, { signal })
  bakeButton.addEventListener('click', () => {
    if(contextLost||cutPending)return
    if (stage === 'ingredients' || stage === 'mixing') { mix(.115); return }
    if (stage === 'finished') { close(); return }
    if (stage !== 'working' || committed) return
    stage = 'baking'; bakeButton.disabled = true; updateState()
    let accepted: boolean | void
    try { accepted = options.onBake(batchShape()) } catch { accepted = false }
    if (accepted === false) {
      stage = 'working'; updateState()
      hint.textContent = 'Bring 2 wheat and 1 egg, then try the oven again.'
      announce('Your dough is safe on the board. The oven needs 2 wheat and 1 egg.'); return
    }
    committed = true; release(undefined, true)
    hint.textContent = ''; bakeButton.innerHTML = '<span>Baking…</span>';fitBakeLabel()
    announce('Your whole batch is baking as one recipe.')
  }, { signal })
  const resize = new ResizeObserver(() => {
    if(destroyed)return
    width=Math.max(1,view.clientWidth);height=Math.max(1,view.clientHeight)
    const next=getWorkshopLayout(width,height),changed=next.id!==layout.id
    cancelPendingCut();release(undefined,true)
    artwork=containArtwork(layout,width,height)
    renderer?.setSize(width,height,false);configureWorkshopCamera(camera,layout,width,height)
    renderer?.setPixelRatio(Math.min(window.devicePixelRatio,2))
    root.style.setProperty('--workshop-art-scale',String(artwork.scale))
    root.style.setProperty('--workshop-bake-font',layout.id==='portrait'?'90px':'68px')
    if(changed){layoutChanging=true;void loadLayout(next,true)}else{layoutSerial++;layoutChanging=false;placeSprite(background);if(!backgroundReady)void loadLayout()}
    updateSpriteBoxes();rebuildMixSurface()
  })
  resize.observe(view)
  function animateSpoon(){
    const sprite=props.spoon,item=sprite.asset
    if(!item||!sprite.opacity)return
    const working=stage==='working'||stage==='baking'||stage==='finished'
    const w=(layout.id==='portrait'?.3:layout.id==='landscape'?.11:.15),h=w*layout.art.width/item.width*item.height/layout.art.height
    const angle=working?0:stirring,headX=mixEllipse.cx+Math.cos(angle)*mixEllipse.rx*(working?.1:.35),headY=mixEllipse.cy+Math.sin(angle)*mixEllipse.ry*.4
    sprite.rect={u:headX-item.contact.x/item.width*w,v:headY-item.contact.y/item.height*h,width:w,height:h}
    sprite.mesh.material.uniforms.pivot.value.set(item.contact.x/item.width,item.contact.y/item.height)
    sprite.rotation=working?-.12:Math.sin(stirring)*.12
    placeSprite(sprite)
    applyBox(hotspots.find(button=>button.dataset.prop==='spoon')!,sprite.rect)
  }
  function tick(now:number){
    if(destroyed)return
    const handDelta=Math.min((now-lastTime)/1000,.1),delta=Math.min(handDelta,.035);lastTime=now;elapsed+=delta
    const step=Math.min(1.8,delta*60)
    if(stage==='transferring'){
      transfer=Math.min(1,transfer+delta/.8)
      updateSpriteBoxes();rebuildMixSurface()
      if(transfer===1){stage='working';updateState();announce('The dough has landed. Press and drag to knead; use the tools or the hand menu to shape it.')}
    }
    if(assetsReady){
      animateSpoon()
      updateContactShadows()
      mixSurface.visible=props.bowl.opacity>.01
      mixMaterial.opacity=props.bowl.opacity
      const positions=mixGeometry.getAttribute('position')as THREE.BufferAttribute,colors=mixGeometry.getAttribute('color')as THREE.BufferAttribute
      const cream=new THREE.Color('#f4dfb9'),flour=new THREE.Color('#f5ead6'),egg=new THREE.Color('#c98517'),color=new THREE.Color()
      for(let i=0;i<positions.count;i++){
        const sx=i%45/44*2-1,sy=Math.floor(i/45)/44*2-1,r=Math.min(1,Math.hypot(sx,sy)),a=Math.atan2(sy,sx)
        const spiral=Math.sin(a*2+r*14-stirring*1.6),wave=(1-r*r)*Math.sin(a*3+r*17-stirring*1.5)*(.02+mixed*.045)
        const mound=Math.exp(-((sx+.35)**2/.18+(sy-.2)**2/.23))*.13*(1-mixed)
        const grain=Math.sin(sx*73+Math.sin(sy*51))*Math.sin(sy*67)*.009*(1-mixed)
        positions.setXYZ(i,mixOriginal[i*3],mixOriginal[i*3+1]+wave+mound+grain,mixOriginal[i*3+2])
        const yolk=Math.exp(-((sx+.43)**2+(sy-.08)**2)*7)*(1-mixed)*1.1+Math.max(0,spiral)*mixed*(1-mixed)*.9
        color.copy(flour).lerp(cream,mixed).lerp(egg,Math.min(1,yolk));colors.setXYZ(i,color.r,color.g,color.b)
      }
      positions.needsUpdate=true;colors.needsUpdate=true;mixGeometry.computeVertexNormals()
    }    if (stage === 'baking') {
      bakeElapsed += delta
      const amount = Math.min(1, bakeElapsed / 2)
      surface.setBaked(amount)
      ovenLight.intensity = Math.sin(amount * Math.PI) * 4
      pieces.forEach(piece => { piece.mesh.scale.y = 1 + Math.sin(amount * Math.PI / 2) * .08 })
      if (amount === 1) {
        stage = 'finished'; updateState(); hint.textContent = ''
        bakeButton.disabled = contextLost; bakeButton.innerHTML = '<span>Done</span>'
        fitBakeLabel()
        announce('Your handmade recipe is ready and added to your farm.')
      }
    }
    if(stage==='working'&&!cutPending&&hand.down&&activeTool==='roll'&&rollingOwner&&rollingLast){
      const piece=rollingOwner,handle=latchDoughHandle(piece.mesh.geometry,rollingLast.x-piece.mesh.position.x,rollingLast.z-piece.mesh.position.z)
      shapeDoughHandle(piece.mesh.geometry,handle,0,0,handDelta*.32,'roll',localBoard(piece))
      retainDeformation(piece);work+=handDelta*.12
    }
    pieces.forEach(piece=>{
      const held=hand.down&&grab?.piece===piece
      if(held&&grab){
        const nextPressure=Math.min(2.2,grab.pressure+handDelta*(grab.action==='cup'?.65:.58))
        if(grab.changed||nextPressure!==grab.pressure){
          grab.pressure=nextPressure
          shapeDoughHandle(piece.mesh.geometry,grab.handle,grab.delta.x,grab.delta.y,grab.pressure,grab.action,localBoard(piece))
          if(grab.action==='fold'&&grab.delta.length()>grab.handle.radius*.6)piece.fold=Math.max(piece.fold,.8)
          if(grab.action==='cup')piece.fold=Math.max(0,piece.fold-handDelta*.65)
          retainDeformation(piece);grab.changed=false;work+=delta*.15
        }
      }
      if(!cutPending&&(piece.dirty||held)){
        const positions=piece.mesh.geometry.getAttribute('position')as THREE.BufferAttribute
        const spring=reduced.matches?.5:.13,damping=reduced.matches?.28:.8
        let moving=false
        for(let i=0;i<piece.rest.length;i++){
          piece.velocity[i]=(piece.velocity[i]-piece.offset[i]*spring*step)*Math.pow(damping,step)
          piece.offset[i]+=piece.velocity[i]*step
          positions.array[i]=piece.rest[i]+piece.plastic[i]+piece.offset[i]
          if(Math.abs(piece.offset[i])>.00002||Math.abs(piece.velocity[i])>.00002)moving=true
        }
        positions.needsUpdate=true;piece.mesh.geometry.computeVertexNormals()
        const normals=piece.mesh.geometry.getAttribute('normal')as THREE.BufferAttribute,normal=new THREE.Vector3()
        for(let i=0;i<normals.count;i++){
          const k=i*3
          normal.set(normals.getX(i)+piece.normalCorrection[k],normals.getY(i)+piece.normalCorrection[k+1],normals.getZ(i)+piece.normalCorrection[k+2]).normalize()
          normals.setXYZ(i,normal.x,normal.y,normal.z)
        }
        normals.needsUpdate=true;piece.mesh.geometry.computeBoundingBox();piece.mesh.geometry.computeBoundingSphere()
        piece.dirty=moving||held
      }
      if(stage==='transferring'){
        const t=transfer*transfer*(3-2*transfer)
        piece.mesh.position.lerpVectors(transferOrigin,new THREE.Vector3(0,.018,0),t)
        piece.mesh.position.y+=Math.sin(t*Math.PI)*.3;piece.mesh.scale.setScalar(.35+.65*t)
      }else{piece.mesh.scale.x=piece.mesh.scale.z=1;piece.mesh.position.y=.018;if(stage!=='baking'&&stage!=='finished')piece.mesh.scale.y=1}
    })
    if (stage === 'working' && !cutPending && pieces.length > 1) {
      for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
        const a = pieces[i], b = pieces[j], dx = b.mesh.position.x - a.mesh.position.x, dz = b.mesh.position.z - a.mesh.position.z
        const distance = Math.hypot(dx, dz), minimum = (Math.cbrt(a.mass) + Math.cbrt(b.mass)) * .38
        if (distance < minimum) {
          const push = Math.min(.025, (minimum - distance) * .08), nx = distance > .001 ? dx / distance : 1, nz = distance > .001 ? dz / distance : 0
          a.mesh.position.x -= nx * push; a.mesh.position.z -= nz * push
          b.mesh.position.x += nx * push; b.mesh.position.z += nz * push
        }
      }
    }
    if(stage!=='transferring')pieces.forEach(keepOnBoard)
    const active = activePiece()
    selection.visible = stage === 'working' && pieces.length > 1
    if (active) {
      const size = active.bounds.getSize(new THREE.Vector3())
      selection.position.set(active.mesh.position.x, .025, active.mesh.position.z)
      selection.scale.set(Math.max(.3, size.x * .56), Math.max(.3, size.z * .56), 1)
    }
    handMarker.visible = stage === 'working' && activeTool === 'knead' && document.activeElement === view
    handMarker.position.set(hand.x, .03, hand.z)


    if ((stage === 'finished' || stage === 'baking') && !reduced.matches && pieces.length) {
      steamMaterial.opacity = stage === 'finished' ? .14 : .07
      steam.forEach((puff, i) => {
        puff.visible = true
        const piece = pieces[i % pieces.length], life = (elapsed * .4 + i / steam.length) % 1
        puff.position.set(piece.mesh.position.x + Math.sin(i * 5 + life) * .25, piece.bounds.max.y + .3 + life * .9, piece.mesh.position.z + Math.cos(i * 3) * .2)
        puff.scale.setScalar(Math.sin(life * Math.PI) * 1.5)
      })
    } else steam.forEach(puff => { puff.visible = false })
    updateCutPreview()
    cutPaths.forEach(path=>{path.style.opacity=cutPending?(reduced.matches?'.7':String(.68+Math.sin(elapsed*7)*.25)):''})
    if (!contextLost&&renderer){
      const pixelRatio=Math.min(window.devicePixelRatio,2)
      if(renderer.getPixelRatio()!==pixelRatio)renderer.setPixelRatio(pixelRatio)
      renderer.render(scene,camera)
    }
    frame = requestAnimationFrame(tick)
  }
  updateState(); frame = requestAnimationFrame(tick); view.focus({ preventScroll: true })
  return { destroy() {
    if (destroyed) return
    destroyed = true;cancelPendingCut();cutWorker?.terminate();cutWorker=null; release(undefined, true); abort.abort(); cancelAnimationFrame(frame); resize.disconnect(); sun.shadow.dispose()
    if(warmIdle!==undefined)window.cancelIdleCallback(warmIdle);if(warmTimer!==undefined)window.clearTimeout(warmTimer);warmQueue.length=0
    resources.forEach(resource => resource.dispose()); surface.dispose(); renderer?.dispose(); renderer?.forceContextLoss(); renderer = null; root.remove()
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
  } }
}
