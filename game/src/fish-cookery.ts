import { playBaySound, prepareBaySoundScene, setBaySoundContact } from './game-sound'
import * as THREE from 'three'
import {createFishPanView} from './fish-pan-view'

import type { CookeryOptions } from './cookery'
import type { CookeryResult } from './culinary'
import { cookeryViewport } from './cookery-model'
import { stepSpring } from './food-motion'
import { createFishPhysics } from './fish-cookery-physics'
import { cancelFish, completeFish, createFishModel, fishProgress, fishSaltCoverage, fishSideDone, finishFishSeason, heatFish, placeFishGarnish, placeFishInPan, plateFish, seasonFish, settleFish, turnFish } from './fish-cookery-model'
import './fish-cookery.css'

type Art = { image: HTMLImageElement; texture: THREE.Texture; data: Uint8ClampedArray; width: number; height: number }
type DecodedArt = Omit<Art, 'texture'>
const decodedArt = new Map<string, Promise<DecodedArt>>()
const reliefCache = new Map<string, THREE.BufferGeometry>()

type Body = { mesh: THREE.Mesh; x: { value: number; velocity: number }; z: { value: number; velocity: number }; y: { value: number; velocity: number }; roll: { value: number; velocity: number }; tx: number; tz: number; ty: number; tr: number }
type Held = { kind: 'fish' | 'salt' | 'spatula' | 'carrot'; body: Body; id: number; lastX: number; lastZ: number; startZ: number; startRoll: number; turn: boolean; grip: THREE.Vector3 }
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const spring = (value: number) => ({ value, velocity: 0 })

/** Inventory belongs to the caller. Every visible contact and retained garnish belongs to this scene. */
export function createFishCookery(host: HTMLElement, options: CookeryOptions): { destroy(): void } {
  const model = createFishModel(), abort = new AbortController(), signal = abort.signal
  prepareBaySoundScene(['kitchen.salt','kitchen.grill','kitchen.flip','kitchen.fruit','table.place','workshop.complete'], signal)
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const base = import.meta.env.BASE_URL, artBase = `${base}art/lavender/fish-cookery/`
  const species = options.recipe.fishSpecies ?? 'seaBass'
  const root = document.createElement('section'); root.className = 'cookery-game fish-cookery'; root.dataset.kind = 'grilledFish'
  root.dataset.species = species
  root.setAttribute('aria-label', options.recipe.name)
  root.innerHTML = `<div class="cookery-view fish-view" tabindex="0" role="application" aria-label="Стол рыбной кухни" aria-describedby="fish-controls"><img class="fish-room" alt="" aria-hidden="true">
    <div class="cookery-heading"><span class="cookery-recipe-name"></span><div class="cookery-ingredients"></div></div>
    <button class="cookery-close" type="button" aria-label="На кухню">×</button>
    <div class="cookery-caption"><p class="cookery-hint"></p><div class="cookery-progress" role="progressbar" aria-label="Приготовление" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>
    <button class="cookery-finish" type="button" hidden><span>Готово</span></button>
    <div class="cookery-render-status" role="status">Открываем рыбную кухню…</div>
    <div class="cookery-keyboard-cursor" hidden aria-hidden="true"></div></div>
    <p id="fish-controls" class="cookery-sr-only">Возьмите соль и разотрите её по рыбе. Перенесите рыбу в сковороду. Для переворота подведите лопатку или потяните рыбу поперёк сковороды. Обжарьте обе стороны, перенесите на блюдо и разложите три дольки моркови. Клавиатура: S — соль, F — рыба, T — лопатка, C — следующая морковь. Стрелки перемещают предмет, пробел берёт или отпускает, Q и E поворачивают, Enter завершает готовое блюдо, Escape возвращает на кухню.</p>
    <p class="fish-live cookery-sr-only" aria-live="polite"></p>`
  host.append(root)
  const view = root.querySelector<HTMLElement>('.fish-view')!, status = root.querySelector<HTMLElement>('.cookery-render-status')!, hint = root.querySelector<HTMLElement>('.cookery-hint')!
  const live = root.querySelector<HTMLElement>('.fish-live')!, finish = root.querySelector<HTMLButtonElement>('.cookery-finish')!, close = root.querySelector<HTMLButtonElement>('.cookery-close')!
  const fill = root.querySelector<HTMLElement>('.cookery-progress i')!, progress = root.querySelector<HTMLElement>('.cookery-progress')!, cursorElement = root.querySelector<HTMLElement>('.cookery-keyboard-cursor')!
  const roomImage=root.querySelector<HTMLImageElement>('.fish-room')!
  Object.assign(roomImage.style,{position:'absolute',maxWidth:'none',maxHeight:'none',pointerEvents:'none',zIndex:'0'})
  root.querySelector<HTMLElement>('.cookery-recipe-name')!.textContent = options.recipe.name
  close.style.backgroundImage = `url("${base}art/lavender/workshop-authored/close-medallion.webp")`
  finish.style.backgroundImage = `url("${base}art/lavender/workshop-authored/bake-frame.webp")`
  for (const ingredient of options.recipe.ingredients ?? []) {
    const item = document.createElement('span'); item.title = ingredient.name
    if (ingredient.icon) { const img = document.createElement('img'); img.src = ingredient.icon; img.alt = ingredient.name; item.append(img) } else item.textContent = ingredient.name
    root.querySelector('.cookery-ingredients')!.append(item)
  }
  let destroyed = false, loaded = false, lost = false, frame = 0, width = 1, height = 1, portrait = false, compact = false, last = performance.now(), elapsed = 0
  let held: Held | null = null, pointerId: number | null = null, keyboard = false, selectedCarrot = 0, lastStage = '', fishWidth = 4.3, rotation = 0
  const cursor = new THREE.Vector3(), raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), floor = new THREE.Plane(new THREE.Vector3(0,1,0), -.42)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-8,8,5,-5,.1,100)
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), bodies: Body[] = []
  const assets = new Map<string, Art>(), pickables: THREE.Object3D[] = [], bodyOf = new Map<THREE.Object3D, { kind: Held['kind']; body: Body; id: number }>()
  const objectArt=new Map<THREE.Object3D,Art>()
  const cooking = [{ value: new Float32Array(12) }, { value: new Float32Array(12) }], saltUniform = { value: model.salt }
  const flexUniform={value:0}
  let fish: Body, salt: Body, spatula: Body, board: THREE.Mesh, pan: THREE.Mesh, plate: THREE.Mesh
  const carrots: Body[] = []
  let saltGrains: THREE.InstancedMesh | null = null, saltCount=0
  const saltTransform = new THREE.Object3D()
  let physics: Awaited<ReturnType<typeof createFishPhysics>> | null = null
  let fishVertices = new Float32Array()
  let panView:ReturnType<typeof createFishPanView>|null=null
  let panTouching=false, nextSync=0
  let boardPoint = new THREE.Vector3(-2.7,.34,.3), panPoint = new THREE.Vector3(2.4,.44,-.4), platePoint = new THREE.Vector3(2.5,.18,2.6)
  let renderer: THREE.WebGLRenderer
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }) }
  catch { status.textContent = 'Не удалось открыть кухню. Вернитесь и попробуйте снова.'; close.addEventListener('click', () => { if (cancelFish(model)) options.onCancel() }, { signal }); return { destroy() { abort.abort(); root.remove(); previousFocus?.focus() } } }
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0,0); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95
  view.prepend(renderer.domElement)
  scene.add(new THREE.HemisphereLight('#fff3da','#9c86a7',1.35))
  const sunlight = new THREE.DirectionalLight('#ffe1c3',1.8); sunlight.position.set(-5,10,5); sunlight.castShadow = true
  sunlight.shadow.mapSize.set(1024,1024); sunlight.shadow.camera.left = -11; sunlight.shadow.camera.right = 11; sunlight.shadow.camera.top = 11; sunlight.shadow.camera.bottom = -11
  sunlight.shadow.normalBias = .015; sunlight.shadow.bias = -.0003; sunlight.shadow.radius = 4; scene.add(sunlight)
  const bounce = new THREE.DirectionalLight('#d5c9ff',.65); bounce.position.set(4,5,-6); scene.add(bounce)
  const shadowGeo = new THREE.PlaneGeometry(40,40), shadowMat = new THREE.ShadowMaterial({ opacity: .19, color: '#513323' }); geometries.add(shadowGeo); materials.add(shadowMat)
  shadowMat.depthWrite=false
  const receiver = new THREE.Mesh(shadowGeo,shadowMat); receiver.rotation.x = -Math.PI/2; receiver.position.y = .015; receiver.receiveShadow = true; scene.add(receiver)
  function texture(image: HTMLImageElement) { const t = new THREE.Texture(image); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8,renderer.capabilities.getMaxAnisotropy()); t.needsUpdate = true; textures.add(t); return t }
  async function load(name: string) {
    const url = (name==='fish-raw'||name==='fish-grilled')&&species!=='seaBass'
      ? `${artBase}${species}-${name==='fish-raw'?'raw':'grilled'}.webp`
      : `${artBase}${name==='pan'?'pan-front-wall':name}.webp`
    let pending = decodedArt.get(url)
    if (!pending) {
      pending = (async () => {
        const image = new Image(); image.src = url; await image.decode()
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
        const context = canvas.getContext('2d', {willReadFrequently:true})!; context.drawImage(image,0,0)
        return {image, data:context.getImageData(0,0,canvas.width,canvas.height).data, width:canvas.width, height:canvas.height}
      })()
      decodedArt.set(url,pending)
      void pending.catch(() => decodedArt.delete(url))
    }
    const source = await pending
    if (destroyed) return
    const art = {...source, texture:texture(source.image)}; assets.set(name,art); return art
  }

  /** Closed, alpha-conforming volume: fins taper to their real silhouette; each side retains its own heat. */
  function relief(art: Art, size: number, depth: number, fishSurface = false, bottom = false): THREE.BufferGeometry {
    const key = `${art.image.src}:${size}:${depth}:${fishSurface}:${bottom}`
    let template = reliefCache.get(key)
    if (!template) {
      template = buildRelief(art,size,depth,fishSurface,bottom)
      geometries.delete(template)
      reliefCache.set(key,template)
      if (reliefCache.size>24) { const oldest=reliefCache.keys().next().value!; reliefCache.get(oldest)!.dispose(); reliefCache.delete(oldest) }
    }
    const geometry=template.clone(); geometries.add(geometry); return geometry
  }
  function buildRelief(art: Art, size: number, depth: number, fishSurface = false, bottom = false): THREE.BufferGeometry {
    if(art===assets.get('plate')){
      const positions:number[]=[],uv:number[]=[],indices:number[]=[],rings=28,segments=256,ar=art.height/art.width
      for(let ring=0;ring<=rings;ring++)for(let j=0;j<=segments;j++){const r=ring/rings,a=j/segments*Math.PI*2,x=Math.cos(a)*r,z=Math.sin(a)*r;positions.push(x*size/2,.035+Math.pow(clamp((r-.62)/.38),1.7)*.10,z*size/2*ar);uv.push(.5+x*.5,.5-z*.5)}
      for(let r=0;r<rings;r++)for(let j=0;j<segments;j++){const a=r*(segments+1)+j,b=a+1,c=a+segments+1,d=c+1;indices.push(a,c,b,b,c,d)}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.userData.surfaceCount=indices.length;geometries.add(g);return g
    }
    if(fishSurface){
      const nx=240,nz=88,positions:number[]=[],uv:number[]=[],indices:number[]=[],bounds:{min:number;max:number}[]=[]
      for(let i=0;i<=nx;i++){const px=Math.min(art.width-1,Math.round(i/nx*(art.width-1)));let min=art.height,max=0;for(let y=0;y<art.height;y++)if(art.data[(y*art.width+px)*4+3]>90){min=Math.min(min,y);max=Math.max(max,y)}bounds.push(min<=max?{min,max}:{min:art.height/2,max:art.height/2})}
      for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){const u=i/nx,t=j/nz,b=bounds[i],v=(b.min+(b.max-b.min)*t)/art.height,h=depth*Math.sqrt(Math.max(0,1-(t*2-1)**2))*(.68+.32*Math.sin(u*Math.PI));positions.push((u-.5)*size,(bottom?-1:1)*h,(v-.5)*size*art.height/art.width*1.32);uv.push(u,1-v)}
      for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const a=i*(nz+1)+j,b=a+nz+1,c=a+1,d=b+1;if(bottom)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d)}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();geometries.add(g);return g
    }
    const nx = 96, nz = 56, ar = art.height/art.width, positions: number[] = [], uv: number[] = [], indices: number[] = []

    for (let j=0;j<=nz;j++) for(let i=0;i<=nx;i++) {
      const u=i/nx,v=j/nz, px=Math.min(art.width-1,Math.round(u*(art.width-1))),py=Math.min(art.height-1,Math.round(v*(art.height-1)))
      const a=art.data[(py*art.width+px)*4+3]/255
      let d=0
      if (a>.1) { for(let r=1;r<=24;r++){let edge=false;for(const [dx,dy] of [[r,0],[-r,0],[0,r],[0,-r]]){const x=px+dx*art.width/nx,y=py+dy*art.height/nz;if(x<0||x>=art.width||y<0||y>=art.height||art.data[(Math.floor(y)*art.width+Math.floor(x))*4+3]<90){edge=true;break}}if(edge)break;d=r} }
      let h=fishSurface ? Math.sqrt(Math.min(1,d/19))*depth : depth*(.55+.45*Math.min(1,d/3))
      if (!fishSurface && art===assets.get('plate')) { const r=Math.hypot((u-.5)*2,(v-.5)*2); h=.045+Math.pow(clamp((r-.65)/.30),1.4)*.10 }
      if (!fishSurface && art===assets.get('pan')) { const rim=Math.max(Math.abs((u-.395)/.355),Math.abs((v-.56)/.43));h=.10+.27*Math.pow(clamp((rim-.78)/.2),1.6);if(u>.79||v<.13)h=.15;else if(rim<.8)h+=Math.pow(Math.max(0,Math.cos(u*116)),14)*.028 }
      positions.push((u-.5)*size,(bottom?-1:1)*h,(v-.5)*size*ar);uv.push(u,1-v)
    }
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;if(bottom)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d)}
    const surfaceCount=indices.length
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.userData.surfaceCount=surfaceCount;geometries.add(g);return g
  }
  function physical(art: Art, metal=0, rough=.55) { const m=new THREE.MeshPhysicalMaterial({map:art.texture,alphaTest:.16,roughness:rough,metalness:metal,clearcoat:metal?.15:.18,clearcoatRoughness:.4,side:THREE.DoubleSide});materials.add(m);return m }
  function prop(name: string, size: number, depth: number, metal=0) {if(name==='pan'){const a=assets.get('pan')!;panView=createFishPanView(a.texture,a.width,a.height);geometries.add(panView.geometry);materials.add(panView.material);scene.add(panView.mesh);return panView.mesh} const a=assets.get(name)!, m=physical(a,metal,metal?.55:.63),g=relief(a,size,depth),edge=new THREE.MeshStandardMaterial({color:name==='board'?'#bd7b3d':name.startsWith('carrot')?'#d88836':name==='spatula'?'#9a6648':'#f0dac0',roughness:.65});materials.add(edge);g.addGroup(0,g.userData.surfaceCount,0);if(g.index!.count>g.userData.surfaceCount)g.addGroup(g.userData.surfaceCount,g.index!.count-g.userData.surfaceCount,1);const mesh=new THREE.Mesh(g,[m,edge]);objectArt.set(mesh,a);mesh.castShadow=true;mesh.receiveShadow=true;
    if(name==='plate'){
      const profile=[new THREE.Vector2(0,.0),new THREE.Vector2(size*.30,.0),new THREE.Vector2(size*.44,.055),new THREE.Vector2(size*.49,.11),new THREE.Vector2(size*.50,.12)],ceramic=new THREE.LatheGeometry(profile,128);ceramic.scale(1,1,a.height/a.width);geometries.add(ceramic);const underside=new THREE.Mesh(ceramic,edge);underside.position.y=-.035;underside.castShadow=true;mesh.add(underside)
    }
    scene.add(mesh);return mesh }
  function body(mesh: THREE.Mesh, point: THREE.Vector3): Body { const b={mesh,x:spring(point.x),y:spring(point.y),z:spring(point.z),roll:spring(0),tx:point.x,ty:point.y,tz:point.z,tr:0};bodies.push(b);mesh.position.copy(point);return b }
  function register(b: Body,kind: Held['kind'],id=0) {pickables.push(b.mesh);bodyOf.set(b.mesh,{body:b,kind,id})}
  function fishMaterial(side: 0|1) {
    const m=physical(assets.get('fish-raw')!,.08,.43);m.clearcoat=.45;m.clearcoatRoughness=.32
    m.bumpMap=assets.get('fish-raw')!.texture;m.bumpScale=.018
    m.onBeforeCompile = shader => {
      shader.uniforms.fishCooked={value:assets.get('fish-grilled')!.texture};shader.uniforms.fishHeat=cooking[side===0?1:0];shader.uniforms.fishSalt=saltUniform
      shader.uniforms.fishFlex=flexUniform
      shader.vertexShader=`uniform float fishFlex;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y+=fishFlex*pow(abs(position.x)/2.5,2.)*sin(position.x*.8);').replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal.x-=fishFlex*(2.*position.x/6.25*sin(position.x*.8)+position.x*position.x/6.25*.8*cos(position.x*.8));')
      shader.fragmentShader=`uniform sampler2D fishCooked;uniform float fishHeat[12];uniform float fishSalt[12];\n${shader.fragmentShader}`
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float warmth=0.;float dose=0.;float weights=0.;
        for(int k=0;k<12;k++){vec2 center=vec2(.15+float(k-6*(k/6))*.14,.36+float(k/6)*.27);float w=exp(-dot((vMapUv-center)*vec2(5.,4.),(vMapUv-center)*vec2(5.,4.)));warmth+=fishHeat[k]*w;dose+=fishSalt[k]*w;weights+=w;}
        warmth/=max(.001,weights);dose/=max(.001,weights);
        vec4 cooked=texture2D(fishCooked,vMapUv);
        diffuseColor.rgb=mix(diffuseColor.rgb,cooked.rgb,smoothstep(.08,.88,warmth));
        float grain=fract(sin(dot(floor(vMapUv*vec2(390.,155.)),vec2(12.9898,78.233)))*43758.5453);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.92,.88,.79),step(.985-dose*.045,grain)*dose*.65);`)
    };m.customProgramCacheKey=()=>`fish-surface-${side}`;return m
  }
  function makeFish() {
    const group=new THREE.Group(),raw=assets.get('fish-raw')!,g=relief(raw,fishWidth,.22,true),gb=relief(raw,fishWidth,.22,true,true)
    const top=new THREE.Mesh(g,fishMaterial(0)),bottom=new THREE.Mesh(gb,fishMaterial(1));top.castShadow=bottom.castShadow=true;top.receiveShadow=bottom.receiveShadow=true;group.add(top,bottom)
    // Thin perimeter closes the two sculpted skins instead of exposing a paper plane on turns.
    const p=g.getAttribute('position'),u=g.getAttribute('uv'),edge:[number,number][]=[],nx=240,nz=88,stride=nz+1
    // The sculpted skin is a regular grid; its perimeter is known without scanning every triangle.
    for(let j=0;j<nz;j++)edge.push([j,j+1])
    for(let i=0;i<nx;i++)edge.push([i*stride+nz,(i+1)*stride+nz])
    for(let j=nz;j>0;j--)edge.push([nx*stride+j,nx*stride+j-1])
    for(let i=nx;i>0;i--)edge.push([i*stride,(i-1)*stride])
    const ps:number[]=[],us:number[]=[],ids:number[]=[];for(const[a,b]of edge){const start=ps.length/3;for(const[k,s]of [[a,1],[b,1],[a,-1],[b,-1]]){ps.push(p.getX(k),p.getY(k)*s,p.getZ(k));us.push(u.getX(k),u.getY(k))}ids.push(start,start+1,start+2,start+1,start+3,start+2)}
    const sideGeo=new THREE.BufferGeometry();sideGeo.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));sideGeo.setAttribute('uv',new THREE.Float32BufferAttribute(us,2));sideGeo.setIndex(ids);sideGeo.computeVertexNormals();geometries.add(sideGeo)
    const wall=new THREE.Mesh(sideGeo,fishMaterial(0));wall.castShadow=true;group.add(wall);scene.add(group)
    const hull:number[]=[];for(let i=0;i<p.count;i+=5){if(p.getY(i)>.015){hull.push(p.getX(i),p.getY(i),p.getZ(i),p.getX(i),-p.getY(i),p.getZ(i))}}fishVertices=new Float32Array(hull)
    // A mesh root retains shared body dynamics while its two skins remain independently heated.
    const holder=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({visible:false}));geometries.add(holder.geometry);materials.add(holder.material);scene.add(holder);holder.add(group)
    fish=body(holder,boardPoint);for(const mesh of[top,bottom,wall]){pickables.push(mesh);bodyOf.set(mesh,{kind:'fish',body:fish,id:0})}
    for(const mesh of[top,bottom,wall])objectArt.set(mesh,raw)
  }
  function arrange() {
    if(!loaded)return
    const wasPortrait=portrait;portrait=width/height<.85;compact=height<410;root.dataset.portrait=String(portrait);root.dataset.compact=String(compact)
    root.style.setProperty('--fish-room',`url("${base}art/lavender/cookery/${portrait?'room-portrait':'room'}.webp")`)
    const roomWidth=portrait?1024:1536,roomHeight=portrait?1536:1024,roomScale=Math.max(width/roomWidth,height/roomHeight)*(portrait?1.08:1.30)
    view.style.backgroundSize=`${roomWidth*roomScale}px ${roomHeight*roomScale}px`;view.style.backgroundPosition='center bottom'
    const roomUrl=`${base}art/lavender/cookery/${portrait?'room-portrait':'room'}.webp`;if(roomImage.getAttribute('src')!==roomUrl)roomImage.src=roomUrl
    Object.assign(roomImage.style,{width:`${roomWidth*roomScale}px`,height:`${roomHeight*roomScale}px`,left:`${(width-roomWidth*roomScale)/2}px`,top:`${height-roomHeight*roomScale}px`})
    const worldWidth=portrait?9:15.3,worldHeight=worldWidth*height/width
    camera.left=-worldWidth/2;camera.right=worldWidth/2;camera.top=worldHeight/2;camera.bottom=-worldHeight/2
    const targetZ=portrait?-.65:compact?-.3:-1.05
    camera.position.set(0,12,15+targetZ);camera.lookAt(0,0,targetZ);camera.updateProjectionMatrix()
    if(portrait){boardPoint.set(0,.3,.85);panPoint.set(0,.42,-4.4);platePoint.set(0,.19,5.8)}
    else{boardPoint.set(-3.8,.30,.0);panPoint.set(3.3,.42,-.2);platePoint.set(.6,.19,5.7)}
    const boardScale=portrait?1.28:1,panScale=portrait?1.06:1,plateScale=portrait?1.22:1
    board.position.copy(boardPoint).y=.06;board.scale.setScalar(boardScale)
    panView?.layout(camera,new THREE.Vector3(panPoint.x-.68,.16,panPoint.z+.1),6.8*panScale)
    plate.position.copy(platePoint).y=.05;plate.scale.setScalar(plateScale)
    const source=portrait?new THREE.Vector3(-3.15,.5,4.1):new THREE.Vector3(-5.95,.5,2.4)
    salt.mesh.scale.setScalar(portrait?1.25:1.15)
    if(held?.body!==salt){salt.tx=source.x;salt.tz=source.z;salt.ty=source.y}
    const tool=portrait?new THREE.Vector3(3.3,.2,2.7):new THREE.Vector3(5.8,.2,3.0)
    if(held?.body!==spatula){spatula.tx=tool.x;spatula.tz=tool.z;spatula.ty=tool.y}
    const scale=portrait?1.32:1;fish.mesh.scale.setScalar(scale)
    if(!held||held.body!==fish){const point=['garnish','ready','committing','finished'].includes(model.stage)?platePoint:['grill','plate'].includes(model.stage)?panPoint:boardPoint;fish.tx=point.x-(point===panPoint?.68:0);fish.tz=point.z;fish.ty=(point===platePoint?.09:point===panPoint?.16:.22)+.22*scale}
    carrots.forEach((b,i)=>{if(held?.body===b)return;const placed=model.garnish.find(p=>p.id===i);b.tx=placed?platePoint.x+placed.x*2.8*plateScale:(portrait?1.25+i*.85:-5.0+i*.8);b.tz=placed?platePoint.z+placed.y*2.1*plateScale:(portrait?8.1:4.7);b.ty=placed?.33:.16;b.tr=0;if(placed)b.mesh.rotation.y=placed.angle})
    receiver.position.z=0
    physics?.layout(boardPoint,panPoint,platePoint,scale)
    physics?.support(model.stage)
    if(wasPortrait!==portrait&&held?.body!==fish){physics?.reset({x:fish.tx,y:fish.ty,z:fish.tz},rotation);fish.x.value=fish.tx;fish.y.value=fish.ty;fish.z.value=fish.tz;fish.mesh.position.set(fish.tx,fish.ty,fish.tz)}
    // Fit complete authored silhouettes, including handles and tail, inside the actual playable rectangle.
    camera.zoom=1;camera.updateProjectionMatrix();camera.updateMatrixWorld(true)
    const saved=bodies.map(b=>b.mesh.position.clone())
    bodies.forEach(b=>b.mesh.position.set(b.tx,b.ty,b.tz))
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
    for(const object of[board,pan,plate,...bodies.map(b=>b.mesh)]){object.updateMatrixWorld(true);object.traverse(child=>{if(!(child instanceof THREE.Mesh)||!child.geometry.getAttribute('position'))return;if(child instanceof THREE.InstancedMesh)child.computeBoundingBox();else if(!child.geometry.boundingBox)child.geometry.computeBoundingBox();const b=(child instanceof THREE.InstancedMesh?child.boundingBox:child.geometry.boundingBox)!;for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z]){const p=new THREE.Vector3(x,y,z).applyMatrix4(child.matrixWorld).project(camera);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)}})}
    bodies.forEach((b,i)=>b.mesh.position.copy(saved[i]))
    const zoom=1/Math.max(1,(maxX-minX)/1.84,(maxY-minY)/(compact?1.16:1.24)),offsetX=(minX+maxX)*worldWidth/4,offsetY=(minY+maxY)*worldHeight/4+.17*worldHeight/(2*zoom)
    camera.zoom=zoom;camera.left=-worldWidth/2+offsetX;camera.right=worldWidth/2+offsetX;camera.top=worldHeight/2+offsetY;camera.bottom=-worldHeight/2+offsetY;camera.updateProjectionMatrix()
  }
  function resize() {
    // The parent's fit-content box is an output of this size, never an input.
    const fit=cookeryViewport(Math.min(innerWidth,visualViewport?.width??Infinity),Math.min(innerHeight,visualViewport?.height??Infinity))
    const inDialog=!!host.closest('.farm-dialog[data-panel="cookery"]')
    root.style.width=inDialog?'100%':`${fit.width}px`;root.style.height=inDialog?'100%':`${fit.height}px`;width=Math.max(1,view.clientWidth);height=Math.max(1,view.clientHeight)
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(width,height,false);arrange()
  }
  const resizeObserver=new ResizeObserver(()=>{if(!destroyed)resize()});resizeObserver.observe(host)
  window.addEventListener('resize',resize,{signal});visualViewport?.addEventListener('resize',resize,{signal})
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;setBaySoundContact('kitchen.grill',false);status.hidden=false;status.textContent='Восстанавливаем свет на кухне…';release(false)},{signal})
  renderer.domElement.addEventListener('webglcontextrestored',()=>{lost=false;for(const t of textures)t.needsUpdate=true;status.hidden=true;last=performance.now();resize()},{signal})
  function point(clientX: number,clientY: number) {const r=view.getBoundingClientRect();ndc.set((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);raycaster.setFromCamera(ndc,camera);raycaster.ray.intersectPlane(floor,cursor);return cursor}
  function fishHalfDepth() { const raw=assets.get('fish-raw')!;return fishWidth*raw.height/raw.width*.66 }
  function localFish(p: THREE.Vector3) {return {x:(p.x-fish.x.value)/(fishWidth*.5*fish.mesh.scale.x),y:(p.z-fish.z.value)/(fishHalfDepth()*fish.mesh.scale.x)}}
  function hit(clientX:number,clientY:number) {point(clientX,clientY);const h=raycaster.intersectObjects(pickables,false).find(h=>{if(!bodyOf.has(h.object))return false;const a=objectArt.get(h.object);if(!a||!h.uv)return true;const x=clamp(Math.floor(h.uv.x*a.width),0,a.width-1),y=clamp(Math.floor((1-h.uv.y)*a.height),0,a.height-1);return a.data[(y*a.width+x)*4+3]>70});return h?bodyOf.get(h.object):undefined}
  function take(kind:Held['kind'],b:Body,id=0) {
    if(!loaded||lost||['committing','finished','cancelled'].includes(model.stage))return
    if(kind==='fish'&&model.stage==='season')return
    if(kind==='carrot'&&!['garnish','ready'].includes(model.stage))return
    held={kind,body:b,id,lastX:cursor.x,lastZ:cursor.z,startZ:cursor.z,startRoll:b.roll.value,turn:false,grip:new THREE.Vector3(cursor.x-b.x.value,0,cursor.z-b.z.value)};b.ty=kind==='fish'?.95:.8
    view.style.cursor='grabbing'
  }
  function move() {
    if(!held)return
    const b=held.body,dx=cursor.x-held.lastX,dz=cursor.z-held.lastZ
    b.tx=clamp(cursor.x,-8,8);b.tz=clamp(cursor.z,-7,9)
    if(held.kind==='salt') {
      const l=localFish(cursor);if(model.stage==='season'&&Math.abs(l.x)<1&&Math.abs(l.y)<.85){b.ty=fish.y.value+.65;if(seasonFish(model,l,.035,Math.hypot(dx,dz))){scatterSalt(l);playBaySound('kitchen.salt',.8,300)}}else b.ty=.9
    }
    if((held.kind==='fish'||held.kind==='spatula')&&model.stage==='grill') {
      if(held.kind==='spatula'&&!held.turn&&Math.abs(cursor.x-fish.x.value)<2.4&&Math.abs(cursor.z-fish.z.value)<.35){held.turn=true;held.startZ=cursor.z;held.startRoll=fish.roll.value;fish.ty=1.1}
      if(held.kind==='fish')held.turn=true
      if(held.turn){const amount=(cursor.z-held.startZ)/.85,assisted=clamp(Math.abs(amount));fish.tr=held.startRoll+Math.sign(amount)*assisted*assisted*(3-2*assisted)*Math.PI;fish.ty=2.05+Math.sin(assisted*Math.PI)*.20;if(held.kind==='fish'){fish.tx=panPoint.x-.68+(cursor.x-panPoint.x+.68)*.15;fish.tz=panPoint.z+(cursor.z-panPoint.z)*.15}}
    }
    held.lastX=cursor.x;held.lastZ=cursor.z
  }
  function release(commit=true) {
    if(!held)return
    const h=held,b=h.body;held=null;view.style.cursor='grab'
    if(h.kind==='salt'&&commit)finishFishSeason(model)
    if(h.kind==='fish'){
      const overPan=Math.hypot(b.tx-panPoint.x,(b.tz-panPoint.z)*.7)<3.0,overPlate=Math.hypot(b.tx-platePoint.x,(b.tz-platePoint.z)*.8)<3
      if(commit&&model.stage==='transfer'&&overPan){placeFishInPan(model)}
      if(commit&&model.stage==='plate'&&overPlate&&plateFish(model))playBaySound('table.place',.65)
    }
    if((h.kind==='fish'||h.kind==='spatula')&&h.turn&&model.stage==='grill'){
      const delta=fish.tr-h.startRoll
      if(commit&&Math.abs(delta)>Math.PI*.40){if(turnFish(model))playBaySound('kitchen.flip',.8);rotation=model.side*Math.PI}
      fish.tr=rotation
    }
    if(h.kind==='carrot'&&commit){const scale=portrait?1.22:1;if(placeFishGarnish(model,h.id,{x:(b.tx-platePoint.x)/(2.8*scale),y:(b.tz-platePoint.z)/(2.1*scale)},b.mesh.rotation.y))playBaySound('kitchen.fruit',.65)}
    arrange();sync()
  }
  view.addEventListener('pointerdown',e=>{
    if((e.target as HTMLElement).closest('button')||!loaded||lost||pointerId!==null)return
    keyboard=false;cursorElement.hidden=true;view.focus({preventScroll:true});const target=hit(e.clientX,e.clientY)
    if(!target)return
    take(target.kind,target.body,target.id);if(held){pointerId=e.pointerId;view.setPointerCapture(e.pointerId);move();e.preventDefault()}
  },{signal})
  view.addEventListener('pointermove',e=>{if(e.pointerId!==pointerId)return;point(e.clientX,e.clientY);move();e.preventDefault()},{signal})
  view.addEventListener('pointerup',e=>{if(e.pointerId!==pointerId)return;point(e.clientX,e.clientY);move();release();pointerId=null;if(view.hasPointerCapture(e.pointerId))view.releasePointerCapture(e.pointerId)},{signal})
  view.addEventListener('pointercancel',e=>{if(e.pointerId===pointerId){release(false);pointerId=null}},{signal})
  view.addEventListener('lostpointercapture',()=>{if(pointerId!==null){release(false);pointerId=null}},{signal})
  function cancel(){release(false);if(cancelFish(model))options.onCancel()}
  function complete(){if(model.stage==='finished'){options.onCancel();return}completeFish(model,()=>{const result:CookeryResult={family:'grilledFish',fishSpecies:species,fruit:[],steps:[...model.steps],baking:{method:'grill',finish:'golden',seconds:model.seconds},garnish:model.garnish.map(p=>({ingredientId:'carrot',x:p.x,y:p.y,angle:p.angle}))};return options.onComplete(result)});sync()}
  close.addEventListener('click',cancel,{signal});finish.addEventListener('click',complete,{signal})
  view.addEventListener('keydown',e=>{
    if(!loaded)return
    const keys=['Escape','Enter','Space','KeyF','KeyS','KeyT','KeyC','KeyQ','KeyE','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];if(!keys.includes(e.code))return
    e.preventDefault();keyboard=true;cursorElement.hidden=false
    if(e.code==='Escape'){cancel();return}if(e.code==='Enter'){complete();return}
    const choose=(kind:Held['kind'],b:Body,id=0)=>{release();cursor.set(b.x.value,.42,b.z.value);take(kind,b,id)}
    if(e.code==='KeyF')choose('fish',fish)
    else if(e.code==='KeyS')choose('salt',salt)
    else if(e.code==='KeyT')choose('spatula',spatula)
    else if(e.code==='KeyC'){selectedCarrot=(selectedCarrot+1)%3;choose('carrot',carrots[selectedCarrot],selectedCarrot)}
    else if(e.code==='Space'){if(held)release();else{const near=[{kind:'fish' as const,body:fish,id:0},{kind:'salt' as const,body:salt,id:0},{kind:'spatula' as const,body:spatula,id:0},...carrots.map((b,id)=>({kind:'carrot' as const,body:b,id}))].sort((a,b)=>Math.hypot(a.body.x.value-cursor.x,a.body.z.value-cursor.z)-Math.hypot(b.body.x.value-cursor.x,b.body.z.value-cursor.z))[0];take(near.kind,near.body,near.id)}}
    else if(e.code==='KeyQ'||e.code==='KeyE'){if(held?.kind==='carrot')held.body.mesh.rotation.y+=(e.code==='KeyQ'?-.12:.12);else if(held&&(held.kind==='fish'||held.kind==='spatula')&&model.stage==='grill'){cursor.z+=(e.code==='KeyQ'?-.18:.18);move()}}
    else{const s=e.shiftKey?.35:.18;if(e.code==='ArrowLeft')cursor.x-=s;if(e.code==='ArrowRight')cursor.x+=s;if(e.code==='ArrowUp')cursor.z-=s;if(e.code==='ArrowDown')cursor.z+=s;move()}
  },{signal})
  view.addEventListener('wheel',e=>{if(held?.kind==='carrot'){e.preventDefault();held.body.mesh.rotation.y+=Math.sign(e.deltaY)*.1}},{signal,passive:false})
  function scatterSalt(l:{x:number;y:number}) {
    if(saltCount>=126)return
    if(!saltGrains){const geometry=new THREE.OctahedronGeometry(1),material=new THREE.MeshPhysicalMaterial({color:'#fff1dc',roughness:.28,transmission:.12,thickness:.03});geometries.add(geometry);materials.add(material);saltGrains=new THREE.InstancedMesh(geometry,material,126);saltGrains.count=0;saltGrains.frustumCulled=false;fish.mesh.add(saltGrains)}
    for(let i=0;i<3&&saltCount<126;i++){saltTransform.position.set(l.x*fishWidth*.5+(Math.random()-.5)*.30,.28,l.y*fishHalfDepth()+(Math.random()-.5)*.24);saltTransform.scale.setScalar(.018+Math.random()*.012);saltTransform.updateMatrix();saltGrains.setMatrixAt(saltCount++,saltTransform.matrix)}
    saltGrains.count=saltCount;saltGrains.instanceMatrix.needsUpdate=true
  }
  const steamGeo=new THREE.PlaneGeometry(1,1);geometries.add(steamGeo)
  const steam:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>[]=[]
  for(let i=0;i<12;i++){
    const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{age:{value:0},alpha:{value:0},seed:{value:i*.63}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float age;uniform float alpha;uniform float seed;void main(){vec2 p=vUv-.5;float d=dot(p*vec2(2.5,1.7),p*vec2(2.5,1.7));float curl=.82+.18*sin(vUv.y*15.+seed+age*2.);gl_FragColor=vec4(.96,.88,.78,exp(-d*5.)*curl*alpha);}' });materials.add(m);const mesh=new THREE.Mesh(steamGeo,m);scene.add(mesh);steam.push(mesh)
  }
  const oilGeo=new THREE.SphereGeometry(.025,8,6),oilMat=new THREE.MeshPhysicalMaterial({color:'#dda545',roughness:.13,metalness:.08,transparent:true,opacity:.6});geometries.add(oilGeo);materials.add(oilMat)
  const droplets=Array.from({length:22},()=>{const mesh=new THREE.Mesh(oilGeo,oilMat);scene.add(mesh);return mesh})
  function sync(){
    const stage=model.stage
    const messages:Record<string,string>={season:'Возьмите соль и разотрите по рыбе',transfer:'Перенесите рыбу на сковороду',grill:model.steps.includes('grill-first-side')&&!model.flipped?'Подденьте лопаткой и переверните рыбу':model.flipped?'Обжарьте вторую сторону':'Рыба мягко подрумянивается',plate:'Перенесите рыбу на блюдо',garnish:'Разложите три дольки моркови на блюде',ready:'Можно подавать',committing:'Подаём…',finished:'Блюдо готово',cancelled:''}
    if(hint.textContent!==messages[stage]){hint.textContent=messages[stage];live.textContent=messages[stage]}
    if(lastStage!==stage){lastStage=stage;root.dataset.stage=stage;arrange()}
    const p=Math.round(fishProgress(model)*100);fill.style.width=`${p}%`;progress.setAttribute('aria-valuenow',String(p));finish.hidden=!['ready','committing','finished'].includes(stage);finish.disabled=!['ready','finished'].includes(stage);finish.querySelector('span')!.textContent=stage==='finished'?options.returnLabel??'На кухню':'Готово'
    root.dataset.salted=String(Math.round(fishSaltCoverage(model)*100));root.dataset.side=String(model.side);root.dataset.firstSide=String(Math.round(fishSideDone(model,0)*100));root.dataset.secondSide=String(Math.round(fishSideDone(model,1)*100))
    if(fish){root.dataset.roll=fish.roll.value.toFixed(2);root.dataset.targetRoll=fish.tr.toFixed(2);root.dataset.held=held?.kind??'';root.dataset.panContact=String(panTouching);root.dataset.height=fish.y.value.toFixed(2)}
    if(loaded){const rect=view.getBoundingClientRect(),screen=(p:THREE.Vector3)=>{p.project(camera);return{x:rect.x+(p.x+1)*width/2,y:rect.y+(1-p.y)*height/2}};root.dataset.targets=JSON.stringify({fish:screen(fish.mesh.position.clone()),salt:screen(salt.mesh.position.clone()),spatula:screen(spatula.mesh.position.clone()),carrots:carrots.map(b=>screen(b.mesh.position.clone())),pan:screen(panPoint.clone().add(new THREE.Vector3(-.68,.1,0))),plate:screen(platePoint.clone()),season:[-.55,0,.55].flatMap(x=>[-.30,.30].map(z=>screen(new THREE.Vector3(fish.x.value+x*fishWidth*.5*fish.mesh.scale.x,fish.y.value+.22,fish.z.value+z*fishHalfDepth()*fish.mesh.scale.x)))),garnish:[-.40,0,.40].map(x=>screen(new THREE.Vector3(platePoint.x+x*2.8*(portrait?1.22:1),.33,platePoint.z+.48*2.1*(portrait?1.22:1))))})}
  }
  function animate(now:number){
    if(destroyed)return;frame=requestAnimationFrame(animate);const dt=Math.min(.045,Math.max(0,(now-last)/1000));last=now;if(!loaded||lost)return;elapsed+=dt
    for(const b of bodies){if(b===fish&&physics)continue;const active=held?.body===b;stepSpring(b.x,b.tx,dt,{frequency:active?4.1:3.7,damping:.78});stepSpring(b.z,b.tz,dt,{frequency:active?4.1:3.7,damping:.78});stepSpring(b.y,b.ty,dt,{frequency:active?4.5:3.8,damping:.68});stepSpring(b.roll,b.tr,dt,{frequency:3.3,damping:.72});b.mesh.position.set(b.x.value,b.y.value,b.z.value);b.mesh.rotation.x=b.roll.value}
    if(physics){const grip=held?.kind==='fish'?held.grip:held?.kind==='spatula'&&held.turn?new THREE.Vector3(.4,0,.3):null,p=physics.step(dt,{x:fish.tx,y:fish.ty,z:fish.tz},fish.tr,grip,!!grip);panTouching=p.panContact;fish.mesh.position.copy(p.position);fish.mesh.quaternion.copy(p.rotation);fish.x.value=p.position.x;fish.y.value=p.position.y;fish.z.value=p.position.z;fish.x.velocity=p.velocity.x;fish.y.velocity=p.velocity.y;fish.z.velocity=p.velocity.z;fish.roll.value=2*Math.atan2(p.rotation.x,p.rotation.w)}
    const q=fish.mesh.quaternion,angleContact=Math.pow(Math.abs(1-2*(q.x*q.x+q.z*q.z)),8)
    setBaySoundContact('kitchen.grill',model.stage==='grill'&&panTouching&&angleContact>.65,.65)
    if(model.stage==='grill'){
      heatFish(model,dt,angleContact*(panTouching?1:0),{x:(fish.x.value-panPoint.x+.68)*.25,y:(fish.z.value-panPoint.z)*.3})
    }
    cooking[0].value.set(model.heat[0]);cooking[1].value.set(model.heat[1]);settleFish(model,dt,!held&&bodies.every(b=>Math.abs(b.x.velocity)+Math.abs(b.z.velocity)+Math.abs(b.y.velocity)<.08))
    const flexTarget=held&&(held.kind==='fish'||held.turn)?clamp(fish.x.velocity*.018+(fish.tr-fish.roll.value)*.035,-.10,.10):0;flexUniform.value+=(flexTarget-flexUniform.value)*(1-Math.exp(-dt*10))
    const sizzling=['grill','plate'].includes(model.stage),intensity=sizzling?.07:0
    steam.forEach((s,i)=>{const a=(elapsed*.29+i/12)%1;s.visible=sizzling&&!reduced.matches;s.material.uniforms.age.value=a;s.material.uniforms.alpha.value=Math.sin(a*Math.PI)*intensity;s.position.set(panPoint.x+Math.sin(i*2.4)*1.75+Math.sin(a*4+i)*.20,.6+a*1.7,panPoint.z+Math.cos(i*1.7)*.6);s.scale.set(.55+a*.9,.7+a*1.5,1);s.quaternion.copy(camera.quaternion)})
    droplets.forEach((d,i)=>{const phase=(elapsed*(.9+i*.017)+i*.17)%1;d.visible=sizzling&&!reduced.matches&&phase<.55;d.position.set(panPoint.x+Math.sin(i*3.9)*(1.3+phase*.35),.20+Math.sin(phase/.55*Math.PI)*(.12+i%3*.05),panPoint.z+Math.cos(i*1.8)*.65);d.scale.setScalar(.65+Math.sin(i)*.28)})
    if(held?.turn&&fish&&held.kind==='spatula'){spatula.mesh.rotation.z=clamp(fish.roll.value-held.startRoll,-.6,.6);spatula.ty=fish.y.value-.20}else if(spatula)spatula.mesh.rotation.z*=Math.exp(-dt*8)
    if(keyboard){const p=cursor.clone().project(camera);cursorElement.style.left=`${(p.x+1)*width/2}px`;cursorElement.style.top=`${(1-p.y)*height/2}px`}
    if(model.stage!==lastStage||elapsed>=nextSync){nextSync=elapsed+.10;sync()}renderer.render(scene,camera)
  }
  async function init(){
    try{
      await Promise.all(['fish-raw','fish-grilled','pan','plate','board','salt','spatula','carrot-0','carrot-1','carrot-2'].map(load));if(destroyed)return
      const raw=assets.get('fish-raw')!;fishWidth=Math.min(4.3,2.7/(raw.height/raw.width*1.32))
      board=prop('board',6.3,.12);pan=prop('pan',6.8,.25,.18);plate=prop('plate',5.9,.12)
      makeFish();salt=body(prop('salt',1.6,.12),new THREE.Vector3(-5.65,.3,2.9));salt.mesh.geometry.rotateX(.85);register(salt,'salt')
      spatula=body(prop('spatula',2.5,.035,.40),new THREE.Vector3(5.55,.2,2.5));register(spatula,'spatula')
      for(let i=0;i<3;i++){const b=body(prop(`carrot-${i}`,1.02,.13),new THREE.Vector3(-1.3+i*.8,.16,3.4));carrots.push(b);register(b,'carrot',i)}
      physics=await createFishPhysics(fishVertices);if(destroyed){physics.destroy();return}loaded=true;status.hidden=true;resize();for(const b of bodies){b.x.value=b.tx;b.y.value=b.ty;b.z.value=b.tz}physics.reset({x:fish.tx,y:fish.ty,z:fish.tz});view.focus({preventScroll:true});sync()
    }catch{if(!destroyed){status.hidden=false;status.textContent='Не удалось открыть кухню. Вернитесь и попробуйте снова.'}}
  }
  resize();frame=requestAnimationFrame(animate);void init()
  return {destroy(){if(destroyed)return;destroyed=true;cancelAnimationFrame(frame);abort.abort();resizeObserver.disconnect();physics?.destroy();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();renderer.dispose();root.remove();previousFocus?.focus({preventScroll:true})}}
}




