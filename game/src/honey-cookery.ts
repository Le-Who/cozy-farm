import { showCookeryRecovery } from './cookery-recovery'
import { playBaySound, prepareBaySoundScene, setBaySoundContact } from './game-sound'
import { loadArtTexture } from './art-texture';
import * as THREE from 'three'
import type { CookeryOptions } from './cookery'
import type { CookeryResult } from './culinary'
import { cookeryViewport } from './cookery-model'
import { advanceHoneyBake, beginHoneyStroke, depositHoneyPiece, cancelHoney, completeHoney, createHoneyModel, endHoneyStroke, honeyBiscuitCenters, honeyPearCenters, honeyProgress, moveHoneyStroke, onHoneySurface, placeHoneyFruit, workHoneyPiece, recordHoneyKnife, settleHoney, startHoneyBake, type HoneyFamily, type HoneyPoint, type HoneyTool } from './honey-cookery-model'
import { createFruitLanding, createViscousFollower, stepFruitLanding, stepSpring, stepViscousFollower, type FruitLanding, type ViscousFollower } from './food-motion'
import { createFoodDeformation } from './food-deformation'
import {createHoneyPears} from './honey-pear-view'
import {createHoneyStream} from './honey-stream'
import {createParfaitTransfer} from './parfait-transfer'
import {depositParfaitCustard,depositParfaitHoney} from './honey-cookery-model'
import './honey-cookery.css'

type Asset = { url: string; width: number; height: number; mixSurfaceEllipse?: { cx: number; cy: number; rx: number; ry: number } }
type Rect = { x: number; y: number; width: number; height: number }
type Shadow = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
type Part = { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; shadow?: Shadow; asset: Asset; texture: THREE.Texture; rect: Rect }
type Food = { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>; shadow?: Shadow; rect: Rect; asset: Asset; mask: HTMLCanvasElement; context: CanvasRenderingContext2D; texture: THREE.CanvasTexture; dough?: ReturnType<typeof createFoodDeformation> }
type Held = { tool: HoneyTool } | { fruit: number }
const angle = (value: number) => Math.atan2(Math.sin(value), Math.cos(value))

/** Four honey recipes share one tactile worktop; inventory is committed only by the caller. */
export function createHoneyCookery(host: HTMLElement, options: CookeryOptions): { destroy(): void } {
  const family = options.recipe.kind as HoneyFamily, model = createHoneyModel(family), abort = new AbortController(), signal = abort.signal
  const sounds: Record<HoneyFamily, string[]> = {
    honeyPear:['cook.pear-cut','cook.honey-flow','cook.honey-end'], honeyBiscuits:['cook.dough-knead','cook.dough-release','cook.honey-brush','cook.oven-in','cook.oven-out'],
    honeyCake:['cook.batter-stir','cook.honey-brush','cook.oven-in','cook.oven-out'], windParfait:['cook.cream-scoop','cook.cream-flow','cook.fruit-cream','cook.honey-flow','cook.honey-end'],
  }
  prepareBaySoundScene([...sounds[family],'cook.finish'], signal)
  const honeySound = family === 'honeyPear' || family === 'windParfait' ? 'cook.honey-flow' : 'cook.honey-brush'
  const base = import.meta.env.BASE_URL, artBase = `${base}art/lavender/cookery/`, previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const root = document.createElement('section'); root.className = 'cookery-game honey-cookery'; root.dataset.kind = family; root.setAttribute('aria-label', options.recipe.name)
  root.innerHTML = `<div class="cookery-view" tabindex="0" role="application" aria-label="Стол медовой кухни" aria-describedby="honey-controls">
    <div class="cookery-heading"><span class="cookery-recipe-name"></span><div class="cookery-ingredients"></div></div>
    <button class="cookery-close" type="button" aria-label="На кухню">×</button>
    <div class="cookery-caption"><p class="cookery-hint"></p><div class="cookery-progress" role="progressbar" aria-label="Приготовление" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>
    <button class="cookery-finish" type="button" hidden><span>Готово</span></button>
    <button class="cookery-rotate" type="button" aria-label="Повернуть выбранный фрукт" title="Повернуть фрукт · Q / E" hidden>↻</button>
    <div class="cookery-render-status" role="status">Открываем медовую кухню…</div><div class="cookery-keyboard-cursor" hidden aria-hidden="true"></div>
    </div><p id="honey-controls" class="cookery-sr-only">Возьмите нож, ложку или мёд и проведите по продуктам. Тесто для печенья можно мять и тянуть рукой. Клавиатура: S — взять инструмент, F — взять дольку персика, стрелки — переместить, пробел — отпустить, Q и E — повернуть фрукт, Enter — испечь или завершить готовку, Escape — вернуться на кухню.</p><p class="cookery-live cookery-sr-only" aria-live="polite" aria-atomic="true"></p>`
  host.append(root)
  if (family === 'honeyPear') root.querySelector('#honey-controls')!.textContent = 'Проведите пальцем или мышью по каждой груше от края до края. Можно взять нож из держателя и подвести к груше. Клавиатура: S — нож у верхнего края следующей груши, стрелка вниз — вести разрез, пробел — отпустить. После разрезания S берёт мёд, стрелки ведут струю по срезам. Enter — завершить, Escape — вернуться на кухню.'
  if(family==='windParfait')root.querySelector('#honey-controls')!.textContent='Зачерпните крем из миски слева, перенесите ложку к открытому краю бокала и подержите. Повторите три раза. Затем перетащите три дольки персика в бокал и полейте мёдом. Клавиатура: S — взять крем, повторное S — перенести к бокалу; F — взять персик, стрелки — переместить, пробел — отпустить. На этапе мёда S подносит кувшин к бокалу. Enter — завершить.'
  const view = root.querySelector<HTMLElement>('.cookery-view')!, status = root.querySelector<HTMLElement>('.cookery-render-status')!, hint = root.querySelector<HTMLElement>('.cookery-hint')!, live = root.querySelector<HTMLElement>('.cookery-live')!
  const finish = root.querySelector<HTMLButtonElement>('.cookery-finish')!, close = root.querySelector<HTMLButtonElement>('.cookery-close')!, progress = root.querySelector<HTMLElement>('.cookery-progress')!, fill = progress.querySelector<HTMLElement>('i')!, cursorElement = root.querySelector<HTMLElement>('.cookery-keyboard-cursor')!, rotate = root.querySelector<HTMLButtonElement>('.cookery-rotate')!
  root.querySelector<HTMLElement>('.cookery-recipe-name')!.textContent = options.recipe.name
  for (const value of options.recipe.ingredients ?? []) { const item = document.createElement('span'); item.title = value.name; if (value.icon) { const image = document.createElement('img'); image.src = value.icon; image.alt = value.name; item.append(image) } else item.textContent = value.name; if (value.count && value.count > 1) { const count = document.createElement('b'); count.textContent = String(value.count); item.append(count) }; root.querySelector('.cookery-ingredients')!.append(item) }
  close.style.backgroundImage = `url("${base}art/lavender/workshop-authored/close-medallion.webp")`; finish.style.backgroundImage = `url("${base}art/lavender/workshop-authored/bake-frame.webp")`
  let destroyed = false, lost = false, loaded = false, frame = 0, width = 1, height = 1, elapsed = 0, lastTime = performance.now(), previousStage = '', previousProgress = -1
  let held: Held | null = null, pointer: number | null = null, cursor: HoneyPoint = { x: 0, y: 0 }, selected = -1, fruitAngle = 0, keyboard = false
  let surface = { x: 0, y: 0, rx: 1, ry: 1 }
  const toolReturns=new Map<string,{x:{value:number;velocity:number};y:{value:number;velocity:number};width:{value:number;velocity:number};angle:{value:number;velocity:number};target:{x:number;y:number;width:number;angle:number}}>(),knifeAngle={value:-Math.PI*.29,velocity:0},pitcherTilt={value:0,velocity:0}
  const contact = createViscousFollower(), fruitFollow = createViscousFollower(), coating = { value: 0, velocity: 0 }, swirl = { value: 0, velocity: 0 }
  const fruitLayer = {value:0,velocity:0},custardLevel={value:0,velocity:0},incorporated = new Map<number,number>()
  const parfaitTransfer=createParfaitTransfer()
  const parfaitTopping={value:0,velocity:0}
  let previousCreamUi=-1
  let creamRelease:HoneyPoint|null=null
  let creamFlow=0,creamStream:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>|null=null,creamTube:ReturnType<typeof createHoneyStream>|null=null
  const landings = new Map<number, FruitLanding>(), landingXY = new Map<number,ViscousFollower>()
  const raycaster = new THREE.Raycaster(), rayPoint = new THREE.Vector2()
  let knifeTransport=false
  let grippedDough: Food | null = null, gripMaterial: { indices: number[]; weights: number[] } | null = null
  let pointerPressure = .9, contactReady = false, lastContact: HoneyPoint | null = null, swirlTarget = 0, swirlAngle = 0, strandTail = 0, strandTip = { x: 0, y: 0 }, physicalQuiet = true
  let honeyDrop:{body:FruitLanding;x:number;targetY:number;hit:boolean;fade:number}|null=null
  let pearView:ReturnType<typeof createHoneyPears>|null=null
  let honeyTube:ReturnType<typeof createHoneyStream>|null=null
  let spoutTube:ReturnType<typeof createHoneyStream>|null=null,spoutFlow:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>|null=null,pitcherSurface:THREE.Mesh<THREE.CircleGeometry,THREE.ShaderMaterial>|null=null
  let streamGeometry: THREE.BufferGeometry | null = null, drop: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(0, 1, 0, 1, .1, 2000); camera.position.z = 1000
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>()
  const plane = new THREE.PlaneGeometry(1, 1); geometries.add(plane)
  const parts = new Map<string, Part>(), foods: Food[] = [], fruitParts = new Map<number, Part>(), assets = new Map<string, { asset: Asset; texture: THREE.Texture }>()
  let stream: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null, batter: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial> | null = null
  let custardSpoon: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> | null = null
  const announce = (message: string) => { live.textContent = message }
  const cancel = () => { if (!destroyed) { cancelHoney(model); options.onCancel() } }
  close.addEventListener('click', cancel, { signal })
  function makeRenderer(canvas?: HTMLCanvasElement) { const value = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' }); value.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); value.outputColorSpace = THREE.SRGBColorSpace; value.setClearColor('#aa7852'); value.domElement.setAttribute('aria-hidden', 'true'); return value }
  let renderer: THREE.WebGLRenderer
  try { renderer = makeRenderer(); view.prepend(renderer.domElement) } catch { showCookeryRecovery(root, { ...options, signal, onCancel: cancel }); return { destroy() { destroyed = true; abort.abort(); plane.dispose(); root.remove(); previousFocus?.focus({ preventScroll: true }) } } }
  function texture(url: string): Promise<THREE.Texture> { return new Promise((resolve, reject) => { const value = loadArtTexture(url, loaded => { if (destroyed) { loaded.dispose(); reject(new DOMException('Кухня закрыта', 'AbortError')); return }; loaded.colorSpace = THREE.SRGBColorSpace; resolve(loaded) }, reject); textures.add(value) }) }
  const url = (path: string) => /^(?:https?:|data:|\/)/.test(path) ? path : path.startsWith('art/') ? base + path : artBase + path
  function shadow(map: THREE.Texture, geometry?: THREE.BufferGeometry): Shadow {
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { map: { value: map }, solid: { value: geometry ? 1 : 0 } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform sampler2D map;uniform float solid;varying vec2 vUv;void main(){if(solid>.5){gl_FragColor=vec4(.24,.11,.045,.065);return;}float a=texture2D(map,vUv).a*.4;a+=texture2D(map,vUv+vec2(.006,0.)).a*.15+texture2D(map,vUv-vec2(.006,0.)).a*.15+texture2D(map,vUv+vec2(0.,.006)).a*.15+texture2D(map,vUv-vec2(0.,.006)).a*.15;gl_FragColor=vec4(.27,.12,.055,a*.19);}` }); materials.add(material)
    const mesh = new THREE.Mesh(geometry ?? plane, material); mesh.position.z = mesh.renderOrder = 1; scene.add(mesh); return mesh
  }
  function part(key: string, source: string, order: number): Part {
    const value = assets.get(source)!, material = new THREE.MeshBasicMaterial({ map: value.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); materials.add(material)
    material.depthTest = false; const mesh = new THREE.Mesh(plane, material); mesh.renderOrder = order; mesh.position.z = order; scene.add(mesh)
    const result = { mesh, ...(key.startsWith('room') ? {} : { shadow: shadow(value.texture) }), asset: value.asset, texture: value.texture, rect: { x: 0, y: 0, width: 1, height: 1 } }; parts.set(key, result); return result
  }
  function rect(object: Part | Food, value: Rect, rotation = 0) { object.rect = value; object.mesh.position.x = value.x + value.width / 2; object.mesh.position.y = value.y + value.height / 2; object.mesh.scale.set(value.width, -value.height, 1); object.mesh.rotation.z = rotation; if (object.shadow) { object.shadow.position.x = object.mesh.position.x + 3; object.shadow.position.y = object.mesh.position.y + 6; object.shadow.scale.copy(object.mesh.scale); object.shadow.rotation.z = rotation } }
  function locate(object: Part | Food, x: number, y: number, size: number, rotation = 0) { const h = size * object.asset.height / object.asset.width; rect(object, { x: x - size / 2, y: y - h / 2, width: size, height: h }, rotation) }
  function imagePoint(object: Part | Food, u: number, v: number): HoneyPoint { const dx = (u - .5) * object.rect.width, dy = (v - .5) * object.rect.height, a = object.mesh.rotation.z; return { x: object.mesh.position.x + Math.cos(a) * dx - Math.sin(a) * dy, y: object.mesh.position.y + Math.sin(a) * dx + Math.cos(a) * dy } }
  function contains(object: Part | Food, point: HoneyPoint, padding = 0) { return point.x >= object.rect.x - padding && point.x <= object.rect.x + object.rect.width + padding && point.y >= object.rect.y - padding && point.y <= object.rect.y + object.rect.height + padding }
  const normalized = (point: HoneyPoint): HoneyPoint => ({ x: (point.x - surface.x) / surface.rx, y: (point.y - surface.y) / surface.ry })
  const pixel = (point: HoneyPoint): HoneyPoint => ({ x: surface.x + point.x * surface.rx, y: surface.y + point.y * surface.ry })
  function food(source: string, finishSource: string): Food {
    const value = assets.get(source)!, finished = assets.get(finishSource)!, mask = document.createElement('canvas'); mask.width = mask.height = 192
    const context = mask.getContext('2d')!; context.fillStyle = '#000'; context.fillRect(0, 0, 192, 192)
    const maskTexture = new THREE.CanvasTexture(mask); textures.add(maskTexture)
    const dough = family === 'honeyBiscuits' ? createFoodDeformation({ radiusX: .46, radiusZ: .34, height: .30 }) : undefined
    const geometry = dough?.geometry ?? new THREE.PlaneGeometry(1, 1, 20, 20); geometries.add(geometry)
    if(family==='windParfait'){
      const positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv')
      for(let i=0;i<positions.count;i++){const y=(positions.getY(i)+.5)*1.16-.5;positions.setY(i,y);uv.setY(i,y+.5)}
      geometry.computeBoundingBox();geometry.computeBoundingSphere()
    }
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: !!dough, side: THREE.DoubleSide,
      uniforms: { rawMap: { value: value.texture }, bakeMap: { value: assets.get(family === 'honeyBiscuits' ? 'dough-baked-surface' : 'honey-cake-baked')?.texture ?? value.texture }, finishMap: { value: finished.texture }, glazeAngle: { value: foods.length * 1.13 }, bake: { value: 0 }, volume: { value: dough ? 1 : 0 }, glassMap: { value: value.texture }, glassMode: { value: family === 'windParfait' ? 1 : 0 }, fruitMap: {value:assets.get('honey-parfait-fruit')?.texture??value.texture},fruitFill:{value:0},layerMap: { value: assets.get('honey-parfait-custard')?.texture ?? value.texture }, layerFill: { value: 0 }, paint: { value: maskTexture }, glaze: { value: 0 } },
      vertexShader: `varying vec2 vUv;varying vec3 vNormal;varying float vHeight;uniform float volume;uniform float bake;uniform sampler2D paint;void main(){vUv=uv;vHeight=position.y;vNormal=normalize(normalMatrix*(volume>.5?normalize(normal/vec3(1.,1.+bake*.12,1.)):normal));vec3 p=position;if(volume>.5)p.y*=1.+bake*.12;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `varying vec2 vUv;varying vec3 vNormal;varying float vHeight;uniform sampler2D rawMap;uniform sampler2D bakeMap;uniform sampler2D finishMap;uniform sampler2D glassMap;uniform sampler2D layerMap;uniform sampler2D fruitMap;uniform float fruitFill;uniform sampler2D paint;uniform float volume;uniform float bake;uniform float glazeAngle;uniform float glassMode;uniform float layerFill;uniform float glaze;uniform float parfaitFinish;
      void main(){vec2 uv=vUv;vec4 a=mix(texture2D(rawMap,uv),texture2D(bakeMap,uv),smoothstep(.05,.97,bake));
      vec2 filledUV=uv,custardUV=uv;if(glassMode>.5){float down=1.-uv.y;filledUV.y=1.-(.135+(down-.12)*1.24);custardUV.y=1.-(.12+(down-.12)*1.10);}vec2 finishUV=filledUV;if(glassMode>.5)finishUV.y*=.8;vec4 b=texture2D(finishMap,finishUV);if(layerFill>.001){float reveal=1.-smoothstep(mix(.14,.8,layerFill)-.01,mix(.14,.8,layerFill)+.01,vUv.y);a=mix(a,texture2D(layerMap,custardUV),reveal);}if(glassMode>.5)a=mix(a,texture2D(fruitMap,filledUV),fruitFill);float coat=texture2D(paint,vUv).r;float m=glassMode>.5?smoothstep(0.,.98,parfaitFinish):coat*glaze;vec4 food=mix(a,b,m);
      float ridge=length(vec2(dFdx(coat),dFdy(coat)));food.rgb+=vec3(.17,.105,.018)*smoothstep(.005,.05,ridge)*m;food.rgb+=vec3(.12,.09,.035)*pow(clamp(1.-ridge*14.,0.,1.),12.)*m*.2;
      if(volume>.5){vec3 rawVariation=clamp(texture2D(rawMap,uv).rgb/vec3(.865,.68,.48),vec3(.72),vec3(1.35));vec3 crustVariation=clamp(texture2D(bakeMap,uv).rgb/vec3(.88,.285,.028),vec3(.72),vec3(1.45));vec3 dough=vec3(.93,.72,.40)*mix(vec3(1.),rawVariation,.10),crust=vec3(.86,.47,.15)*mix(vec3(1.),crustVariation,.12);food.rgb=mix(dough,crust,smoothstep(.05,.95,bake));vec2 honeyUV=.5+mat2(cos(glazeAngle),-sin(glazeAngle),sin(glazeAngle),cos(glazeAngle))*(uv-.5)*.65;vec3 honey=texture2D(finishMap,honeyUV).rgb;food.rgb=mix(food.rgb,honey,m*.72);vec3 N=normalize(vNormal),L=normalize(vec3(-.4,-.8,1.));float light=.70+.30*max(0.,dot(N,L));food.rgb*=light;food.rgb=mix(food.rgb*vec3(1.,.96,.88),food.rgb,smoothstep(0.,.16,vHeight));food.rgb+=vec3(.12,.09,.035)*pow(max(0.,dot(reflect(-L,N),vec3(0.,0.,1.))),18.)*m;food.a=1.;}
      if(glassMode>.5){vec4 glass=texture2D(glassMap,vUv);float down=1.-vUv.y;
      // The empty master has a bowl ending at .58; the pedestal begins below it.
      float bowlY=clamp((down-.12)/.46,0.,1.);float halfWidth=.395*sqrt(max(0.,1.-bowlY*bowlY))+.012;
      float interior=(1.-smoothstep(halfWidth-.012,halfWidth,abs(vUv.x-.5)))*smoothstep(.085,.135,down)*(1.-smoothstep(.535,.575,down));
      float cap=(1.-smoothstep(.12,.20,down))*(1.-smoothstep(.27,.35,abs(vUv.x-.5)))*m;
      float region=max(interior,cap);float reflection=smoothstep(.75,.97,dot(glass.rgb,vec3(.2126,.7152,.0722)))*.26;
      float foodAlpha=food.a*region;
      float compositeAlpha=max(glass.a,foodAlpha);
      // Unassociated RGB outside the painted dessert is undefined. Only visible food can tint the rim.
      vec3 surfaceColor=mix(food.rgb,glass.rgb,reflection*glass.a);
      gl_FragColor=vec4(mix(glass.rgb,surfaceColor,foodAlpha/max(compositeAlpha,.0001)),compositeAlpha);}else gl_FragColor=food;
      #include <colorspace_fragment>
      }` });material.uniforms.parfaitFinish={value:0}; materials.add(material)
    const mesh = new THREE.Mesh(geometry, material); mesh.position.z = 4; mesh.renderOrder = 4; scene.add(mesh)
    const result: Food = { mesh, shadow: shadow(value.texture, dough?.geometry), asset: value.asset, rect: { x: 0, y: 0, width: 1, height: 1 }, mask, context, texture: maskTexture, dough }; foods.push(result); return result
  }
  function updateFoodState() {
    if (!loaded) return
    const baked = model.baked / 2.4, glazed = ['glaze', 'settling', 'ready', 'committing', 'finished'].includes(model.stage)
    foods.forEach((object, index) => {
      const source = family === 'honeyBiscuits' ? 'dough-raw-surface' : family === 'honeyCake' ? 'honey-cake-bowl' : 'honey-parfait-empty'
      const value = assets.get(source)!, uniforms = object.mesh.material.uniforms; uniforms.rawMap.value = value.texture; object.asset = value.asset
      if (object.shadow && !object.dough) object.shadow.material.uniforms.map.value = value.texture
      uniforms.glaze.value = glazed ? 1 : 0; uniforms.bake.value = family === 'honeyBiscuits' || family === 'honeyCake' ? baked : 0
      uniforms.layerFill.value = family === 'windParfait' ? custardLevel.value : 0;uniforms.fruitFill.value=fruitLayer.value
      if(family==='windParfait')uniforms.parfaitFinish.value=parfaitTopping.value

      object.dough?.setBaked(baked)
    })
    if (batter) batter.visible = family === 'honeyCake' && baked < .95
  }
  function layout() {
    if (!loaded) return
    const portrait = width / height < .85, compact = height < 420 || height < 600 && width > height, room = parts.get(portrait ? 'room-portrait' : 'room')!
    parts.get('room')!.mesh.visible = !portrait; parts.get('room-portrait')!.mesh.visible = portrait
    const scale = Math.max(width / room.asset.width, height / room.asset.height); rect(room, { x: (width - room.asset.width * scale) / 2, y: (height - room.asset.height * scale) / 2, width: room.asset.width * scale, height: room.asset.height * scale })
    const size = Math.min(width * (portrait ? .91 : compact ? .48 : .59), height * (portrait ? .87 : .73)), center = { x: width * (portrait ? .48 : .52), y: height * (portrait ? .51 : compact ? .65 : .66) }
    surface = { x: center.x, y: center.y, rx: size * .39, ry: size * .25 }
    if (family === 'honeyBiscuits') { surface.rx = size * .42; surface.ry = size * .36 }
    if (family === 'honeyPear' || family === 'honeyBiscuits') {
      if (parts.has('dish')) { locate(parts.get('dish')!, center.x, center.y + size * .16, Math.min(width*.98,size*1.35)); parts.get('dish')!.mesh.visible = family === 'honeyPear' }
      const centers = family === 'honeyPear' ? honeyPearCenters : honeyBiscuitCenters
      foods.forEach((object, i) => { const p = pixel(centers[i]); locate(object, p.x, p.y, surface.rx * (family === 'honeyPear' ? .93 : .86), family === 'honeyPear' ? (i ? .10 : -.12) : 0); if (object.dough) { object.mesh.scale.set(object.rect.width, object.rect.width, object.rect.width); object.mesh.rotation.x = Math.PI - .95; object.mesh.position.y += object.rect.width * .05; if(object.shadow){object.shadow.scale.set(object.rect.width,object.rect.width*.025,object.rect.width);object.shadow.rotation.x=Math.PI-.95;object.shadow.position.set(object.mesh.position.x+1,object.mesh.position.y+2,1)} } })
    } else {
      locate(foods[0], center.x, center.y, size * (family === 'windParfait' ? .90 : 1))
      const r = foods[0].rect, baked = ['glaze', 'settling', 'ready', 'committing', 'finished'].includes(model.stage), ellipse = foods[0].asset.mixSurfaceEllipse ?? { cx: foods[0].asset.width * .5, cy: foods[0].asset.height * (family === 'windParfait' ? .16 : baked ? .255 : .455), rx: foods[0].asset.width * (family === 'windParfait' ? .36 : .35), ry: foods[0].asset.height * (family === 'windParfait' ? .105 : baked ? .20 : .19) }
      surface = { x: r.x + ellipse.cx / foods[0].asset.width * r.width, y: r.y + ellipse.cy / foods[0].asset.height * r.height, rx: ellipse.rx / foods[0].asset.width * r.width, ry: ellipse.ry / foods[0].asset.height * r.height }
    }
    const toolWidth = Math.min(width * (portrait ? .27 : .17), height * .30), toolX = width * (portrait ? .82 : family==='honeyPear'?.92:.84), toolY = height * (portrait ? .74 : family==='honeyPear'?.60:.63)
    for (const key of ['knife', 'spoon', 'honey'] as const) if (parts.has(key) && !(held && 'tool' in held && held.tool === key)&&!(creamRelease&&key==='spoon')) {const object=parts.get(key)!,returning=toolReturns.get(key),a=key==='knife'?-.12:0;if(returning){returning.target={x:toolX,y:toolY,width:toolWidth,angle:returning.angle.value+angle(a-returning.angle.value)};locate(object,returning.x.value,returning.y.value,returning.width.value,returning.angle.value)}else locate(object,toolX,toolY,toolWidth,a)}
    const current = currentTool(); for (const key of ['knife', 'spoon', 'honey'] as const) if (parts.has(key)) parts.get(key)!.mesh.visible = current === key || toolReturns.has(key) || !!held && 'tool' in held && held.tool === key
    if (parts.has('fruit-dish')) locate(parts.get('fruit-dish')!, width * (portrait ? .23 : .18), height * (portrait ? .79 : .79), Math.min(width * .38, height * .36))
    if (parts.has('custard-bowl')) { locate(parts.get('custard-bowl')!, width * (portrait ? .23 : .18), height * .77, Math.min(width * (portrait ? .38 : .27), height * .34)); parts.get('custard-bowl')!.mesh.visible = model.stage === 'custard'; parts.get('fruit-dish')!.mesh.visible = model.stage !== 'custard' }
    fruitParts.forEach((object, id) => { if (held && 'fruit' in held && held.fruit === id) return; const placed = model.fruit.find(value => value.id === id); const point = placed ? landingXY.get(id) ?? pixel(placed) : fruitSource(id), sink=incorporated.get(id)??0; locate(object, point.x, point.y - (landings.get(id)?.height ?? 0)*surface.ry + sink * foods[0].rect.height*.26, placed ? surface.rx * .70 : parts.get('fruit-dish')!.rect.width * .29, placed?.angle ?? (id % 3 - 1) * .12); object.mesh.renderOrder = placed ? 8 : 12; object.mesh.position.z = object.mesh.renderOrder; object.mesh.material.opacity=placed?1-sink:1;object.mesh.visible = family === 'windParfait' && model.stage !== 'custard' && (!placed || sink<.995) })
    if (batter) { batter.position.set(surface.x, surface.y, 5); batter.scale.set(surface.rx * .98, -surface.ry * .94, 1) }
    pearView?.layout(surface,width,height);positionRotation(); updateCursor()
  }
  function resize() {
    const fit = cookeryViewport(Math.min(innerWidth, visualViewport?.width ?? Infinity), Math.min(innerHeight, visualViewport?.height ?? Infinity)); root.style.width = `${fit.width}px`; root.style.height = `${fit.height}px`
    width = Math.max(1, view.clientWidth); height = Math.max(1, view.clientHeight); root.dataset.portrait = String(width / height < .85); root.dataset.compact = String(fit.compact)
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(width, height, false); camera.left = 0; camera.right = width; camera.top = 0; camera.bottom = height; camera.updateProjectionMatrix(); layout()
  }
  window.addEventListener('resize', resize, { signal }); visualViewport?.addEventListener('resize', resize, { signal }); const observer = new ResizeObserver(() => { if (!destroyed) resize() }); observer.observe(host)
  function currentTool(): HoneyTool { return model.stage === 'cut' ? 'knife' : ['shape', 'bake-ready'].includes(model.stage) && family === 'honeyBiscuits' ? 'hand' : ['mix', 'custard', 'bake-ready'].includes(model.stage) ? 'spoon' : 'honey' }
  function parfaitBowlContact(point:HoneyPoint){const bowl=parts.get('custard-bowl');if(!bowl)return false;const p=imagePoint(bowl,.5,.43);return((point.x-p.x)/(bowl.rect.width*.39))**2+((point.y-p.y)/(bowl.rect.height*.24))**2<=1}
  function parfaitReceivingPoint(point:HoneyPoint){
    const r=foods[0].rect,n=normalized(point),x=THREE.MathUtils.clamp(n.x,-.83,.83),finish=THREE.MathUtils.smoothstep(parfaitTopping.value,0,.98)
    const level=model.stage==='custard'?.56-.16*custardLevel.value:.27-.215*finish+Math.abs(x)**1.4*.10*finish
    const bowlY=(level-.12)/.46,insideWidth=Math.max(.08,.395*Math.sqrt(Math.max(0,1-bowlY*bowlY)))*r.width*.88
    return{x:surface.x+THREE.MathUtils.clamp(x*surface.rx,-insideWidth,insideWidth),y:r.y+r.height*level}
  }
  function fruitSource(id: number): HoneyPoint { const r = parts.get('fruit-dish')!.rect; return { x: r.x + r.width * (.27 + id % 3 * .22), y: r.y + r.height * (.46 + Math.floor(id / 3) * .13) } }
  function updateCursor() { cursorElement.hidden = !keyboard; cursorElement.style.left = `${cursor.x}px`; cursorElement.style.top = `${cursor.y}px` }
  function positionRotation() { const object = fruitParts.get(selected), placed = model.fruit.find(value => value.id === selected); rotate.hidden = !object || !placed || (incorporated.get(selected)??0)>.3 || ['finished', 'committing', 'cancelled'].includes(model.stage); if (!rotate.hidden && object) { rotate.style.left = `${Math.max(4, Math.min(width - 48, object.rect.x + object.rect.width - 5))}px`; rotate.style.top = `${Math.max(70, Math.min(height - 100, object.rect.y - 30))}px` } }
  function sync() {
    if (destroyed) return
    root.dataset.stage = model.stage
    const messages: Record<string, string> = { cut: 'Проведите ножом через каждую грушу', shape: 'Разомните и растяните тесто для печенья', mix: 'Медленно размешайте тесто по кругу', 'bake-ready': '', baking: 'Выпекаем до золотистой корочки…', custard: 'Переложите крем ложкой в бокал', fruit: 'Уложите дольки персика в бокал', glaze: family === 'honeyPear' ? 'Полейте срезы груш мёдом' : family === 'windParfait' ? 'Полейте слои мёдом' : 'Смажьте выпечку мёдом', settling: '', ready: '', committing: '', finished: '', cancelled: '' }
    if(family==='windParfait')messages.custard=parfaitTransfer.load>.025?'Перенесите ложку к открытому бокалу':'Зачерпните крем из миски слева'
    if (model.stage === 'cut') messages.cut = knifeTransport && held
      ? 'Подведите нож к груше и проведите через неё'
      : `Проведите по груше от края до края · ${model.cuts.size}/2`;
    const message=messages[model.stage]??'';if(hint.textContent!==message)hint.textContent=message; if (model.stage !== previousStage) { announce(model.stage === 'ready' ? 'Блюдо готово. Можно завершить приготовление.' : hint.textContent); if(previousStage==='baking')playBaySound('cook.oven-out'); previousStage = model.stage; updateFoodState(); layout() }
    const value = Math.round(honeyProgress(model) * 100); previousProgress=value; progress.setAttribute('aria-valuenow', String(value)); fill.style.width = `${value}%`; progress.hidden = ['ready', 'finished'].includes(model.stage)
    if(family==='windParfait'){previousCreamUi=Math.round(parfaitTransfer.load*10);root.dataset.creamLoad=parfaitTransfer.load.toFixed(3);root.dataset.custard=model.parfaitCustard.toFixed(3);root.dataset.honey=model.parfaitHoney.toFixed(3)}
    finish.hidden = !['bake-ready', 'ready', 'finished'].includes(model.stage); finish.disabled = lost || !loaded || model.stage !== 'finished' && (!!held || !physicalQuiet)
    finish.querySelector('span')!.textContent = model.stage === 'bake-ready' ? 'Испечь' : model.stage === 'finished' ? options.returnLabel ?? 'На кухню' : 'Готово'; positionRotation()
  }
  function finishRecipe() {
    if (destroyed || lost || !loaded) return
    if (model.stage === 'finished') { options.onCancel(); return }
    if (held || !physicalQuiet) return
    if (model.stage === 'bake-ready') { foods.forEach(object => object.dough?.release()); if(startHoneyBake(model))playBaySound('cook.oven-in'); sync(); return }
    const result: CookeryResult = { family, fruit: family === 'honeyPear' ? honeyPearCenters.map((point, index) => ({ ingredientId: 'pear', ...point, angle: index ? .10 : -.12 })) : model.fruit.map(value => ({ ingredientId: value.ingredientId, x: value.x, y: value.y, angle: angle(value.angle) })), steps: [...model.steps],
      ...(family === 'honeyCake' || family === 'honeyBiscuits' ? { baking: { method: 'oven' as const, finish: 'golden' as const, seconds: model.baked } } : family === 'windParfait' ? { baking: { method: 'chilled' as const, finish: 'set' as const, seconds: 0 } } : {}) }
    try { if(completeHoney(model, () => options.onComplete(result)))playBaySound('cook.finish') } catch { announce('Не удалось сохранить блюдо. Нажмите «Готово» ещё раз.') }; sync()
  }
  finish.addEventListener('click', finishRecipe, { signal })
  function paintGlaze(from: HoneyPoint, to: HoneyPoint, amount: number) {
    if(family==='windParfait')return
    if(pearView){pearView.paint(from,to,amount,coating.value);return}
    for (const object of foods) {
      const local = (point: HoneyPoint) => { const dx = point.x - object.mesh.position.x, dy = point.y - object.mesh.position.y, a = -object.mesh.rotation.z; return { x: (Math.cos(a) * dx - Math.sin(a) * dy) / object.rect.width + .5, y: (Math.sin(a) * dx + Math.cos(a) * dy) / object.rect.height + .5 } }
      const onMesh = (point: HoneyPoint) => { rayPoint.set(point.x/width*2-1,1-point.y/height*2);raycaster.setFromCamera(rayPoint,camera);const uv=raycaster.intersectObject(object.mesh,false)[0]?.uv;return uv ? {x:uv.x,y:1-uv.y} : null }
      const b = object.dough ? onMesh(to) : local(to); if(!b)continue
      const a = object.dough ? onMesh(from) ?? b : local(from), context = object.context; if(object.dough)depositHoneyPiece(model,foods.indexOf(object),a,b,amount); context.strokeStyle = '#fff'; context.lineCap = context.lineJoin = 'round'; context.globalAlpha = amount; context.lineWidth = Math.max(9, surface.rx / object.rect.width * 192 * (object.dough ? .07 + .11 * coating.value : .10 + .18 * coating.value)); context.shadowColor = '#fff'; context.shadowBlur = 5; context.beginPath(); context.moveTo(a.x * 192, a.y * 192); context.lineTo(b.x * 192, b.y * 192); context.stroke(); context.globalAlpha = 1; object.texture.needsUpdate = true
    }
  }
  function moveHeld(point: HoneyPoint) {
    cursor = point; updateCursor(); if (!held) return
    if ('tool' in held && (held.tool === 'honey' || held.tool === 'spoon') && contactReady) point = { x: contact.x, y: contact.y }
    if ('fruit' in held) { const object = fruitParts.get(held.fruit)!; locate(object, fruitFollow.x, fruitFollow.y - (reduced.matches?2:8), surface.rx * .70, fruitAngle); object.mesh.position.z = object.mesh.renderOrder = 22; return }
    if (held.tool === 'hand') return
    const object = parts.get(held.tool)!, size = Math.min(surface.rx * (held.tool === 'honey' ? 1.1 : 1.25), height * .36)
    const pouring = held.tool === 'honey' && (family === 'honeyPear' || family === 'windParfait')
    const brushing = held.tool === 'honey' && !pouring
    const creamOverGlass=family==='windParfait'&&model.stage==='custard'&&held.tool==='spoon'&&onHoneySurface(normalized(point),1.12)
    const lift=pouring?(family==='windParfait'?Math.max(48,surface.rx*.7):Math.max(24,surface.ry*.65)):creamOverGlass?Math.max(22,surface.rx*.22):0
    const tip = { x: point.x, y: point.y - lift }, rotation = held.tool === 'knife' ? knifeAngle.value+Math.PI*.25 : pouring ? -.25-pitcherTilt.value*.58 : brushing ? Math.PI - .35 : -.5
    locate(object, tip.x, tip.y, size, rotation); const toolContact = imagePoint(object, held.tool === 'knife' ? .887 : pouring ? .105 : brushing ? .77 : .285, held.tool === 'knife' ? .098 : pouring ? .219 : brushing ? .15 : .745)
    rect(object, { ...object.rect, x: object.rect.x + tip.x - toolContact.x, y: object.rect.y + tip.y - toolContact.y }, rotation); object.mesh.position.z = object.mesh.renderOrder = 20
    if (stream && pouring) strandTip = tip
  }
  function start(point: HoneyPoint) {
    if (!loaded || lost || destroyed || ['baking', 'committing', 'finished', 'cancelled'].includes(model.stage)) return
    knifeSounded.clear()
    if(creamRelease){depositParfaitCustard(model,parfaitTransfer.finishDeposit());creamRelease=null;endHoneyStroke(model)}
    if(family==='windParfait'&&model.stage==='custard'&&parfaitBowlContact(point)){parfaitTransfer.scoop();playBaySound('cook.cream-scoop')}
    cursor = point
    if (family === 'windParfait' && ['fruit', 'glaze', 'ready'].includes(model.stage)) for (const [id, object] of [...fruitParts].reverse()) if ((model.stage==='fruit'||!model.fruit.some(fruit=>fruit.id===id))&&object.mesh.visible && contains(object, point, 5)) { held = { fruit: id }; fruitFollow.x = point.x; fruitFollow.y = point.y; fruitFollow.vx = fruitFollow.vy = 0; selected = id; fruitAngle = model.fruit.find(value => value.id === id)?.angle ?? 0; moveHeld(point); return }
    const tool = currentTool(), object = parts.get(tool)
    if (tool === 'hand' ? !!pickDough(point) : tool==='knife' ? !!pearView?.wholeHit(point) || !!object&&contains(object,point,8) : object && contains(object, point, 8) || tool === 'spoon' && (onHoneySurface(normalized(point))||family==='windParfait'&&model.stage==='custard'&&parfaitBowlContact(point))||family==='windParfait'&&tool==='honey'&&onHoneySurface(normalized(point))) { held = { tool };knifeTransport=tool==='knife'&&!pearView?.wholeHit(point);toolReturns.delete(tool);if(tool==='knife'&&object){knifeAngle.value=object.mesh.rotation.z-Math.PI*.25;knifeAngle.velocity=0} if(tool === 'hand') {grippedDough=pickDough(point);latchDough(point)} contact.x = point.x; contact.y = point.y; contact.vx = contact.vy = 0; contactReady = true; lastContact = null; beginHoneyStroke(model, tool, normalized(point));if(tool==='knife'&&!knifeTransport)pearView?.trace(point,point,(index,angle,bins,offset)=>recordKnifeContact(index,angle,bins,offset)); moveHeld(point) }
  }
  const knifeSounded = new Set<number>()
  function recordKnifeContact(index:number,angle:number,bins:Iterable<number>,offset:number) {
    const before=model.cutTracks[index].bins.size
    if(recordHoneyKnife(model,index,angle,bins,offset)&&model.cutTracks[index].bins.size>before&&!knifeSounded.has(index)){knifeSounded.add(index);playBaySound('cook.pear-cut',.7)}
  }
  function move(point: HoneyPoint) {
    if (!held || lost || destroyed) return
    const before = cursor; moveHeld(point)
    if ('fruit' in held) return
    if(held.tool==='knife'&&pearView){
      // Arriving from the holder positions the blade. Cutting starts with the
      // next movement on the fruit, so the outside approach cannot cut a pear.
      if(knifeTransport){if(pearView.wholeHit(point)){knifeTransport=false;pearView.releaseTrace();pearView.trace(point,point,(index,angle,bins,offset)=>recordKnifeContact(index,angle,bins,offset))}}
      else pearView.trace(before,point,(index,angle,bins,offset)=>recordKnifeContact(index,angle,bins,offset))
    }
    else if (held.tool !== 'knife' && held.tool !== 'honey' && held.tool !== 'spoon' && held.tool !== 'hand') moveHoneyStroke(model, normalized(point))
    if (held.tool === 'hand') sculpt(point, { x: point.x - before.x, y: point.y - before.y })
    // The animation frame synchronizes progress and stage layout once after
    // processing every coalesced contact sample.
  }
  function pickDough(point: HoneyPoint): Food | null {
    rayPoint.set(point.x/width*2-1,1-point.y/height*2);camera.updateMatrixWorld();scene.updateMatrixWorld(true);raycaster.setFromCamera(rayPoint,camera)
    const hit=raycaster.intersectObjects(foods.filter(object=>object.dough).map(object=>object.mesh),false)[0]
    return hit ? foods.find(object=>object.mesh===hit.object) ?? null : null
  }
  function latchDough(point: HoneyPoint) {
    gripMaterial=null;if(!grippedDough)return
    rayPoint.set(point.x/width*2-1,1-point.y/height*2);raycaster.setFromCamera(rayPoint,camera)
    const hit=raycaster.intersectObject(grippedDough.mesh,false)[0];if(!hit?.face||!hit.uv)return
    const uv=grippedDough.mesh.geometry.getAttribute('uv'),indices=[hit.face.a,hit.face.b,hit.face.c],a={x:uv.getX(indices[0]),y:uv.getY(indices[0])},b={x:uv.getX(indices[1]),y:uv.getY(indices[1])},c={x:uv.getX(indices[2]),y:uv.getY(indices[2])},d=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y)
    if(Math.abs(d)<1e-8)return
    const u=((b.y-c.y)*(hit.uv.x-c.x)+(c.x-b.x)*(hit.uv.y-c.y))/d,v=((c.y-a.y)*(hit.uv.x-c.x)+(a.x-c.x)*(hit.uv.y-c.y))/d
    gripMaterial={indices,weights:[u,v,1-u-v]}
  }
  function sculpt(_point: HoneyPoint, delta: HoneyPoint,seconds=0) {
    const object=grippedDough;if(!object?.dough||!gripMaterial)return
    const positions=object.mesh.geometry.getAttribute('position');let x=0,z=0
    gripMaterial.indices.forEach((index,i)=>{x+=positions.getX(index)*gripMaterial!.weights[i];z+=positions.getZ(index)*gripMaterial!.weights[i]})
    if(Math.hypot(delta.x,delta.y)>2)playBaySound('cook.dough-knead',.6,430)
    const w=object.rect.width
    workHoneyPiece(model,foods.indexOf(object),Math.hypot(delta.x,delta.y)/Math.max(1,surface.rx),seconds,pointerPressure)
    object.dough.applyStroke({point:{x:x/.46,y:-z/.34},delta:{x:delta.x*1.4/(w*.46),y:delta.y*1.4/(w*.34*Math.sin(.95))},pressure:pointerPressure,radius:.58})
  }
  function release(commit = true) {
    if(commit&&creamRelease&&!held)return
    const drainCream=commit&&family==='windParfait'&&model.stage==='custard'&&held&&'tool'in held&&held.tool==='spoon'&&parfaitTransfer.load>.001&&onHoneySurface(normalized(cursor),1.12)
    if(drainCream){creamRelease={...cursor};contact.x=cursor.x;contact.y=cursor.y;contact.vx=contact.vy=0;moveHeld(cursor)}
    if(!commit)creamRelease=null
    if(held&&'tool' in held&&held.tool!=='hand'&&!drainCream)returnTool(held.tool)
    if (held && 'fruit' in held && commit) { if (placeHoneyFruit(model, held.fruit, normalized(cursor), 'peach', fruitAngle)) {playBaySound('cook.fruit-cream');landings.set(held.fruit, createFruitLanding((reduced.matches?2:8)/surface.ry,0));landingXY.set(held.fruit,{...fruitFollow});incorporated.set(held.fruit,0)} }
    if(commit&&held&&'tool' in held&&held.tool==='hand')playBaySound('cook.dough-release',.65)
    pearView?.releaseTrace();foods.forEach(object => object.dough?.release()); grippedDough=null; gripMaterial=null; if(held&&'tool' in held&&held.tool==='honey'&&(family==='honeyPear'||family==='windParfait')){const target=family==='windParfait'?parfaitReceivingPoint(contact):contact;honeyDrop={body:createFruitLanding(Math.max(.02,(target.y-strandTip.y)*.55/surface.ry),0),x:target.x,targetY:target.y,hit:false,fade:0}};strandTail = held && 'tool' in held && held.tool === 'honey' ? 1 : strandTail
    if(!commit)setBaySoundContact(honeySound,false);setBaySoundContact('cook.batter-stir',false);if(!drainCream)setBaySoundContact('cook.cream-flow',false)
    held = null; lastContact = null;if(!drainCream)endHoneyStroke(model); updateFoodState(); layout(); sync()
  }
  function returnTool(tool:HoneyTool){const object=parts.get(tool)!;toolReturns.set(tool,{x:{value:object.mesh.position.x,velocity:0},y:{value:object.mesh.position.y,velocity:0},width:{value:object.rect.width,velocity:0},angle:{value:object.mesh.rotation.z,velocity:0},target:{x:object.mesh.position.x,y:object.mesh.position.y,width:object.rect.width,angle:object.mesh.rotation.z}})}
  const eventPoint = (event: PointerEvent) => { const r = view.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top } }
  view.addEventListener('pointerdown', event => { if ((event.target as HTMLElement).closest('button') || pointer !== null || event.button !== 0) return; pointer = event.pointerId; pointerPressure = event.pointerType === 'mouse' ? .9 : Math.max(.25,event.pressure); keyboard = false; view.setPointerCapture(pointer); view.focus({ preventScroll: true }); start(eventPoint(event)); updateCursor() }, { signal })
  view.addEventListener('pointermove', event => { if (pointer !== event.pointerId) return; pointerPressure = event.pointerType === 'mouse' ? .9 : Math.max(.25,event.pressure); const samples = event.getCoalescedEvents?.(); for (const sample of samples?.length ? samples : [event]) move(eventPoint(sample)) }, { signal })
  view.addEventListener('pointerup', event => { if (pointer !== event.pointerId) return; move(eventPoint(event)); release(); pointer = null; if (view.hasPointerCapture(event.pointerId)) view.releasePointerCapture(event.pointerId) }, { signal })
  const abandon = () => { pointer = null; release(false) }; view.addEventListener('pointercancel', abandon, { signal }); view.addEventListener('lostpointercapture', () => { if (pointer !== null) abandon() }, { signal }); window.addEventListener('blur', abandon, { signal })
  function rotateFruit(delta: number) { if((incorporated.get(selected)??0)>.3)return;const fruit = model.fruit.find(value => value.id === selected); if (!fruit) return; placeHoneyFruit(model, fruit.id, fruit, fruit.ingredientId, angle(fruit.angle + delta)); layout() }
  rotate.addEventListener('click', () => rotateFruit(Math.PI / 12), { signal }); view.addEventListener('wheel', event => { if (model.fruit.some(value => value.id === selected) && !['finished', 'cancelled'].includes(model.stage)) { event.preventDefault(); rotateFruit(Math.sign(event.deltaY) * .13) } }, { signal, passive: false })
  view.addEventListener('keydown', event => {
    if ((event.target as HTMLElement).closest('button')) return
    if (event.key === 'Escape') { event.preventDefault(); cancel(); return }
    if (!loaded || lost) return
    const key = /^Key[SFQE]$/.test(event.code) ? event.code.slice(3).toLowerCase() : event.key.toLowerCase(); if (!['s', 'f', ' ', 'enter', 'q', 'e', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) return
    event.preventDefault(); keyboard = true
    if (key === 'enter') finishRecipe()
    else if (key === 'q' || key === 'e') rotateFruit(key === 'q' ? -.13 : .13)
    else if (key === 'f' && family === 'windParfait') { release(); const id = [...fruitParts.keys()].find(value => !model.fruit.some(fruit => fruit.id === value)) ?? 0; cursor = fruitSource(id); start(cursor) }
    else if (key === 's') { release(); const tool = currentTool(), object = parts.get(tool); cursor = family==='windParfait'&&model.stage==='custard'?(parfaitTransfer.load>.025?pixel({x:0,y:0}):imagePoint(parts.get('custard-bowl')!,.5,.43)):family==='windParfait'&&model.stage==='glaze'?pixel({x:0,y:0}):tool === 'knife' ? pearView?.knifeStart() ?? cursor : object ? { x: object.mesh.position.x, y: object.mesh.position.y } : pixel(honeyBiscuitCenters[0]); start(cursor) }
    else if (key === ' ') { if (held) release(); else start(cursor.x || cursor.y ? cursor : pixel({ x: 0, y: 0 })) }
    else { const step = Math.max(5, Math.min(surface.rx, surface.ry) * .18); const next = { x: Math.max(8, Math.min(width - 8, cursor.x + (key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0))), y: Math.max(65, Math.min(height - 65, cursor.y + (key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0))) }; if (held) move(next); else cursor = next }
    updateCursor()
  }, { signal })
  async function load() {
    const response = await fetch(`${artBase}manifest.json`, { signal }); if (!response.ok) throw new Error('Kitchen artwork unavailable')
    const manifest = await response.json() as { items: Record<string, Asset> }
    const familyKeys = family === 'honeyPear' ? ['honey-knife'] : family === 'honeyBiscuits' ? ['honey-brush'] : family === 'honeyCake' ? ['honey-cake-bowl', 'honey-cake-batter', 'honey-cake-baked', 'honey-cake-glazed', 'honey-brush'] : ['honey-parfait-empty', 'honey-parfait-custard', 'honey-parfait-fruit', 'honey-parfait-full', 'peach-slice', 'honey-cake-bowl', 'honey-cake-batter']
    await Promise.all(['room', 'room-portrait', 'honey-glaze', ...(family === 'honeyPear' ? ['honey-pitcher'] : family === 'honeyBiscuits' ? [] : family === 'honeyCake' ? ['spoon'] : ['spoon','dish','honey-pitcher']), ...familyKeys].map(async key => { const asset = manifest.items[key]; if (!asset) throw new Error(`Missing ${key}`); assets.set(key, { asset, texture: await texture(url(asset.url)) }) }))
    if (destroyed) return
    if(family === 'honeyBiscuits') await Promise.all(['dough-raw-surface','dough-baked-surface'].map(async key=>{const path=`${base}art/lavender/workshop-authored/${key}.webp`;assets.set(key,{asset:{url:path,width:1024,height:1024},texture:await texture(path)})}))
    if(family === 'honeyPear') await Promise.all(['pear-skin-surface','pear-flesh-surface','pear-crown','pear-platter'].map(async key=>{const path=`${artBase}${key}.webp`;assets.set(key,{asset:{url:path,width:key==='pear-crown'?512:768,height:key==='pear-crown'||key==='pear-platter'?512:768},texture:await texture(path)})}))
    part('room', 'room', -10); part('room-portrait', 'room-portrait', -10)
    if (family === 'honeyPear') { part('dish', 'pear-platter', 2); pearView=createHoneyPears(scene,camera,{skin:assets.get('pear-skin-surface')!.texture,flesh:assets.get('pear-flesh-surface')!.texture,honey:assets.get('honey-glaze')!.texture,crown:assets.get('pear-crown')!.texture},{geometries,materials,textures});part('knife', 'honey-knife', 15) }
    else if (family === 'honeyBiscuits') honeyBiscuitCenters.forEach(() => food('dough-raw-surface', 'honey-glaze'))
    else if (family === 'honeyCake') food('honey-cake-bowl', 'honey-cake-glazed')
    else { food('honey-parfait-empty', 'honey-parfait-full'); part('fruit-dish', 'dish', 2); part('custard-bowl', 'honey-cake-bowl', 3); for (let i = 0; i < 6; i++) fruitParts.set(i, part(`peach-${i}`, 'peach-slice', 12)) }
    if(assets.has('spoon'))part('spoon', 'spoon', 15); part('honey', family === 'honeyCake' || family === 'honeyBiscuits' ? 'honey-brush' : 'honey-pitcher', 15)
    const material = new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide,uniforms:{map:{value:assets.get('honey-glaze')!.texture},time:{value:0},alpha:{value:1}},vertexShader:`varying vec2 vUv;varying vec3 N;void main(){vUv=uv;N=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;varying vec3 N;uniform sampler2D map;uniform float time;uniform float alpha;void main(){vec3 light=normalize(vec3(-.4,-.6,1.)),normal=normalize(N);float along=vUv.y;float travel=along*2.8-time*2.1;float packet=sin(travel*6.28318);vec3 syrup=texture2D(map,vec2(.40+vUv.x*.15,.3+fract(along*.35-time*.20)*.36)).rgb;vec3 honey=mix(vec3(.90,.42,.055),syrup,.56);float shade=.76+.24*max(0.,dot(normal,light));float shine=pow(max(0.,dot(reflect(-light,normal),vec3(0.,0.,1.))),26.);float thread=pow(max(0.,sin(vUv.x*6.28318+packet*.13)),18.)*(.55+.45*sin(travel*3.14159));gl_FragColor=vec4(honey*shade+vec3(.36,.28,.12)*shine+vec3(.13,.09,.025)*thread,alpha);
 #include <colorspace_fragment>
 }`});materials.add(material)
    honeyTube=createHoneyStream();streamGeometry=honeyTube.geometry;geometries.add(streamGeometry);stream=new THREE.Mesh(streamGeometry,material);stream.renderOrder=21;stream.visible=false;stream.frustumCulled=false;scene.add(stream)
    if(family==='honeyPear'||family==='windParfait'){
      spoutTube=createHoneyStream({longitudinalSegments:12});geometries.add(spoutTube.geometry);spoutFlow=new THREE.Mesh(spoutTube.geometry,material);spoutFlow.renderOrder=21;spoutFlow.visible=false;spoutFlow.frustumCulled=false;scene.add(spoutFlow)
      const geometry=new THREE.CircleGeometry(1,48);geometries.add(geometry)
      const surfaceMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide,uniforms:{map:{value:assets.get('honey-glaze')!.texture},time:{value:0},flow:{value:0}},vertexShader:`varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 uv0;uniform sampler2D map;uniform float time;uniform float flow;void main(){vec2 p=uv0*2.-1.;float rim=1.-smoothstep(.86,1.,length(p));float sink=exp(-dot(p-vec2(-.75,0.),p-vec2(-.75,0.))*2.);float wake=sin((p.x+time*.8)*9.+p.y*3.)*.025*flow*sink;vec3 gold=texture2D(map,.5+p*.23+vec2(sink*sin(time*.7)*.008,0.)).rgb;float gloss=exp(-pow((p.y+.24+sin(p.x*2.+time*.65)*.06)/.12,2.))*smoothstep(-.9,-.45,p.x)*(1.-smoothstep(.35,.85,p.x));gl_FragColor=vec4(gold+vec3(.30,.24,.12)*gloss+vec3(wake),rim*.98);\n#include <colorspace_fragment>\n}`});materials.add(surfaceMaterial);pitcherSurface=new THREE.Mesh(geometry,surfaceMaterial);pitcherSurface.renderOrder=21;pitcherSurface.visible=false;scene.add(pitcherSurface)
    }
    const dropGeometry=new THREE.SphereGeometry(1,12,8);geometries.add(dropGeometry);const dropMaterial=material.clone();materials.add(dropMaterial);drop=new THREE.Mesh(dropGeometry,dropMaterial);drop.renderOrder=22;drop.visible=false;scene.add(drop)
    if (family === 'honeyCake') { const geo = new THREE.CircleGeometry(1, 64); geometries.add(geo); const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { map: { value: assets.get('honey-cake-batter')!.texture }, phase: { value: 0 }, work: { value: 0 }, brush: { value: new THREE.Vector2() }, ripple: { value: 0 }, fade: { value: 1 } }, vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`, fragmentShader: `varying vec2 vUv;uniform sampler2D map;uniform float phase;uniform float work;uniform vec2 brush;uniform float ripple;uniform float fade;void main(){vec2 p=vUv*2.-1.;float r=length(p);if(r>.99)discard;float local=exp(-dot(p-brush,p-brush)*4.);float turn=phase*(1.-r)*.25;vec2 q=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*p;vec2 uv=.5+q*.5+vec2(-p.y,p.x)*work*.025*(1.-r)+vec2(local,-local)*ripple*.015;vec4 batter=texture2D(map,uv);float ridge=sin((length(p-brush)*24.-phase*3.))*local*ripple;gl_FragColor=vec4(batter.rgb+vec3(.06,.04,.01)*ridge,batter.a*(1.-smoothstep(.95,.99,r))*fade);
    #include <colorspace_fragment>
    }` }); materials.add(mat); batter = new THREE.Mesh(geo, mat); batter.renderOrder = 5; scene.add(batter) }
    if (family === 'windParfait') {
      const geometry = new THREE.CircleGeometry(1, 48); geometries.add(geometry); const material = new THREE.MeshBasicMaterial({ map: assets.get('honey-cake-batter')!.texture, transparent: true, depthWrite: false,depthTest:false, side: THREE.DoubleSide, toneMapped: false }); materials.add(material); custardSpoon = new THREE.Mesh(geometry, material); custardSpoon.position.z = custardSpoon.renderOrder = 21; custardSpoon.visible = false; scene.add(custardSpoon)
      creamTube=createHoneyStream({longitudinalSegments:12});geometries.add(creamTube.geometry)
      const skin=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide,uniforms:{map:{value:assets.get('honey-cake-batter')!.texture},time:{value:0}},vertexShader:`varying vec2 uv0;varying vec3 N;void main(){uv0=uv;N=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 uv0;varying vec3 N;uniform sampler2D map;uniform float time;void main(){vec3 light=normalize(vec3(-.4,-.7,1.)),n=normalize(N);vec3 cream=texture2D(map,.5+vec2((uv0.x-.5)*.34,sin(uv0.y*4.-time*3.)*.12)).rgb;float shade=.82+.18*max(0.,dot(n,light)),gloss=pow(max(0.,dot(reflect(-light,n),vec3(0.,0.,1.))),18.);gl_FragColor=vec4(cream*shade+vec3(.09,.07,.03)*gloss,1.);
#include <colorspace_fragment>
}`});materials.add(skin);creamStream=new THREE.Mesh(creamTube.geometry,skin);creamStream.position.z=creamStream.renderOrder=21;creamStream.frustumCulled=false;creamStream.visible=false;scene.add(creamStream)
    }
    loaded = true; status.hidden = true; updateFoodState(); resize(); sync(); view.focus({ preventScroll: true })
  }
  const canvas = renderer.domElement
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; abandon(); cancelAnimationFrame(frame); geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose()); renderer.dispose(); status.hidden = false; status.textContent = 'Медовая кухня приостановлена. Восстанавливаем приготовление…' }, { signal })
  canvas.addEventListener('webglcontextrestored', () => { if (destroyed) return; try { renderer = makeRenderer(canvas) } catch { status.textContent = 'Не удалось восстановить медовую кухню. Вернитесь на кухню и попробуйте снова.'; return }; textures.forEach(value => { value.needsUpdate = true }); lost = false; status.hidden = loaded; lastTime = performance.now(); resize(); sync(); frame = requestAnimationFrame(animate) }, { signal })
  function advanceMaterial(dt: number) {
    let quiet = pearView?.update(model,dt) ?? true
    for(const[key,motion]of toolReturns){stepSpring(motion.x,motion.target.x,dt,{frequency:5,damping:.85});stepSpring(motion.y,motion.target.y,dt,{frequency:5,damping:.85});stepSpring(motion.width,motion.target.width,dt,{frequency:5,damping:.85});stepSpring(motion.angle,motion.target.angle,dt,{frequency:5,damping:.85});if(Math.hypot(motion.x.velocity,motion.y.velocity,motion.width.velocity)<.25&&Math.abs(motion.angle.velocity)<.01&&Math.hypot(motion.x.value-motion.target.x,motion.y.value-motion.target.y)<.25)toolReturns.delete(key);else quiet=false}
    if(held&&'tool' in held&&held.tool==='knife'){const desired=pearView?.bladeAngle();if(desired!==null&&desired!==undefined)stepSpring(knifeAngle,knifeAngle.value+angle(desired-knifeAngle.value),dt,{frequency:5,damping:.9});moveHeld(cursor)}

    if (held && 'fruit' in held) { stepViscousFollower(fruitFollow,cursor.x,cursor.y,dt,26); moveHeld(cursor); quiet = false }
    for (const [id,landing] of landings) { const placed=model.fruit.find(p=>p.id===id),xy=landingXY.get(id);if(placed&&xy){const target=pixel(placed);stepViscousFollower(xy,target.x,target.y,dt,24)}stepFruitLanding(landing,dt);if(landing.settled)incorporated.set(id,Math.min(1,(incorporated.get(id)??0)+dt*1.65));quiet &&= landing.settled }
    if(family==='windParfait'){stepSpring(custardLevel,model.stage==='custard'?honeyProgress(model):1,dt,{frequency:2,damping:1});stepSpring(fruitLayer,Math.min(1,[...incorporated.values()].reduce((sum,value)=>sum+value,0)/3),dt,{frequency:2,damping:1});stepSpring(parfaitTopping,model.parfaitHoney,dt,{frequency:2,damping:1});quiet=quiet&&Math.abs(fruitLayer.velocity)<.02&&Math.abs(custardLevel.velocity)<.02&&Math.abs(parfaitTopping.velocity)<.02}
    let honeyContact=false
    const painting = !!held && 'tool' in held && held.tool === 'honey', pouring = painting && (family === 'honeyPear' || family === 'windParfait');stepSpring(pitcherTilt,pouring?1:0,dt,{frequency:2.2,damping:.88})
    if (held && 'tool' in held && (held.tool === 'honey' || held.tool === 'spoon')) {
      stepViscousFollower(contact,cursor.x,cursor.y,dt,painting ? 17 : 20)
      const point = { x: contact.x, y: contact.y }, n = normalized(point), previousContact = lastContact
      const contacting = model.stage === 'glaze' && pearView ? pearView.hit(point) : family === 'honeyBiscuits' && model.stage === 'glaze' ? !!pickDough(point) : onHoneySurface(n,family==='windParfait'?1.12:1.03)
      stepSpring(coating, painting || contacting ? pointerPressure : 0, dt, { frequency: 2.3, damping: .9 })
      if(family==='windParfait'&&model.stage==='custard'&&held.tool==='spoon'){
        const amount=parfaitTransfer.step(dt,parfaitBowlContact(point),contacting)
        depositParfaitCustard(model,amount);creamFlow=amount/Math.max(.001,dt)
      }else creamFlow=0
      if (contacting && (model.stage === 'glaze' || model.stage === 'custard' || model.stage === 'mix')) {
        if(model.stage === 'mix' && lastContact){const old=normalized(lastContact),turn=angle(Math.atan2(n.y,n.x)-Math.atan2(old.y,old.x));swirlTarget=THREE.MathUtils.clamp(turn/Math.max(.001,dt),-5,5)}
        if(family==='windParfait'&&model.stage==='glaze')depositParfaitHoney(model,n,dt*Math.max(0,coating.value))
        else if(family!=='windParfait'||model.stage!=='custard')if((family!=='honeyBiscuits'&&family!=='honeyPear')||model.stage!=='glaze')moveHoneyStroke(model,n,dt*Math.max(.12,coating.value)*6)
        if (painting && !pearView) paintGlaze(lastContact ?? point, point, Math.min(.6,dt*9) * Math.max(.12,coating.value))
        lastContact = point
      } else lastContact = null
      honeyContact=painting && contacting && model.stage==='glaze'
      setBaySoundContact('cook.batter-stir',held.tool==='spoon'&&model.stage==='mix'&&contacting&&Math.abs(swirlTarget)>.2,.65)
      if (painting && pearView && model.stage === 'glaze') {
        paintGlaze(previousContact ?? point, point, Math.min(.6,dt*18) * Math.max(.12,coating.value))
        lastContact = point
      }
      moveHeld(cursor); if (pouring) strandTail = 1
      quiet = false
    } else if(creamRelease){
      contact.x=creamRelease.x;contact.y=creamRelease.y
      const amount=parfaitTransfer.step(dt,false,true);depositParfaitCustard(model,amount);creamFlow=amount/Math.max(.001,dt);quiet=false
      if(parfaitTransfer.load<=.001||model.pending==='fruit'){creamRelease=null;endHoneyStroke(model);returnTool('spoon')}
    } else {
      creamFlow=0
      stepSpring(coating,0,dt,{frequency:2.3,damping:.9}); strandTail = Math.max(0,strandTail-dt*3.5)
      if(strandTail>0){stepViscousFollower(contact,cursor.x,cursor.y,dt,17);const point={x:contact.x,y:contact.y};if(pearView||onHoneySurface(normalized(point)))paintGlaze(lastContact??point,point,Math.min(.3,dt*6)*Math.max(0,coating.value));lastContact=point}
    }
    const honeyTail=strandTail>0&&coating.value>.02&&model.stage==='glaze'&&(pearView?pearView.hit(contact):onHoneySurface(normalized(contact),1.05))
    setBaySoundContact(honeySound,honeyContact||honeyTail,.7)
    setBaySoundContact('cook.cream-flow',family==='windParfait'&&creamFlow>.001&&model.stage==='custard',.8)
    if (held && 'tool' in held && held.tool === 'hand') { sculpt(cursor,{x:0,y:0},dt); quiet = false }
    foods.forEach(object => { if (object.dough) { const state = object.dough.update(dt); quiet = quiet && state.settled } })
    if (!held || !('tool' in held) || held.tool !== 'spoon') swirlTarget *= Math.exp(-dt*3)
    stepSpring(swirl,swirlTarget,dt,{frequency:1.4,damping:.72}); swirlAngle += swirl.value*dt; quiet &&= Math.abs(swirl.value) < .035 && coating.value < .035 && strandTail === 0
    if (batter) { const u=batter.material.uniforms; u.phase.value=swirlAngle;u.work.value=Math.abs(swirl.value);u.ripple.value=Math.min(1,Math.abs(swirl.velocity)*.04+Math.abs(swirl.value)*.15);u.brush.value.set(normalized(cursor).x,-normalized(cursor).y);u.fade.value=1-smoothBake() }
    quiet=quiet&&honeyDrop===null&&creamRelease===null;physicalQuiet = quiet; settleHoney(model,dt,quiet)
    updateFoodState(); layout()
    if (stream && streamGeometry) {
      const show = (family === 'honeyPear' || family === 'windParfait') && (pouring || strandTail > 0) && coating.value > .005
      stream.visible = show; stream.position.set(0,0,21);stream.scale.set(1,1,1)
      const strength=painting?1:strandTail,bottom=family==='windParfait'?parfaitReceivingPoint(contact):{x:contact.x,y:contact.y}
      honeyTube?.update({from:{...strandTip,z:0},to:{...bottom,z:0},velocity:{x:contact.vx,y:contact.vy},radius:Math.max(2,surface.rx*.025),tail:1-strength,flow:coating.value,time:elapsed})
      if(pitcherSurface&&spoutFlow&&spoutTube){const jug=parts.get('honey')!,mouth=imagePoint(jug,.47,.265),inside=imagePoint(jug,.31,.245);pitcherSurface.visible=jug.mesh.visible;pitcherSurface.position.set(mouth.x,mouth.y,21);pitcherSurface.scale.set(jug.rect.width*.205,-jug.rect.height*.075,1);pitcherSurface.rotation.z=jug.mesh.rotation.z;pitcherSurface.material.uniforms.time.value=elapsed;pitcherSurface.material.uniforms.flow.value=pitcherTilt.value;spoutFlow.visible=pouring&&coating.value>.03;spoutFlow.position.z=21;spoutTube.update({from:{...inside,z:0},to:{...strandTip,z:0},velocity:{x:0,y:0},radius:Math.max(1.8,surface.rx*.022),tail:0,flow:pouring?coating.value:0,time:elapsed})}

      if(drop){drop.visible=show||honeyDrop!==null;drop.material.uniforms.alpha.value=1;const radius=Math.max(2,surface.rx*.028)*Math.sqrt(Math.max(.05,coating.value));drop.position.set(bottom.x,bottom.y,22);drop.scale.set(radius,radius*(1.05+(1-strength)*1.6),radius*.7);if(honeyDrop){stepFruitLanding(honeyDrop.body,dt,{gravity:4,restitution:.04,settleSpeed:.04});drop.position.set(honeyDrop.x,honeyDrop.targetY-honeyDrop.body.height*surface.ry,22);const r=Math.max(2,surface.rx*.03);drop.scale.set(r*(1+honeyDrop.fade*5),r*Math.max(.25,1.45-honeyDrop.fade*7),r*.7);if(honeyDrop.body.settled){if(!honeyDrop.hit){const point={x:honeyDrop.x,y:honeyDrop.targetY};paintGlaze(point,point,.38);honeyDrop.hit=true;playBaySound('cook.honey-end',.7);if(model.pending&&!held)endHoneyStroke(model)}honeyDrop.fade+=dt;drop.material.uniforms.alpha.value=Math.max(0,1-honeyDrop.fade/.16);if(honeyDrop.fade>=.16)honeyDrop=null}}}


    }
    if (model.stage !== previousStage || Math.round(honeyProgress(model)*100)!==previousProgress ||family==='windParfait'&&Math.round(parfaitTransfer.load*10)!==previousCreamUi|| finish.disabled !== (lost || !loaded || model.stage !== 'finished' && (!!held || !physicalQuiet))) sync()
  }
  function smoothBake() { const p=Math.max(0,Math.min(1,model.baked/2.4));return p*p*(3-2*p) }
  function animate(now: number) {
    if (destroyed || lost) return
    if (renderer.getPixelRatio() !== Math.min(devicePixelRatio || 1, 2)) resize()
    const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000)); lastTime = now; elapsed += dt
    if (model.stage === 'baking') advanceHoneyBake(model,dt * (reduced.matches ? 3 : 1))
    if(loaded) advanceMaterial(dt)
    if (stream) stream.material.uniforms.time.value = reduced.matches ? 0 : elapsed
    if (custardSpoon) {
      const spoon=parts.get('spoon')!,point=imagePoint(spoon,.285,.745),amount=Math.sqrt(parfaitTransfer.load/parfaitTransfer.capacity)
      custardSpoon.visible=spoon.mesh.visible&&model.stage==='custard'&&amount>.025;custardSpoon.position.set(point.x,point.y,21);custardSpoon.scale.set(spoon.rect.width*.14*amount,-spoon.rect.height*.10*amount,1);custardSpoon.rotation.z=spoon.mesh.rotation.z-.77
      if(creamStream&&creamTube){const time=reduced.matches?0:elapsed;creamStream.visible=creamFlow>.001&&model.stage==='custard';creamStream.material.uniforms.time.value=time;creamTube.update({from:{...point,z:0},to:{...parfaitReceivingPoint(contact),z:0},velocity:{x:contact.vx,y:contact.vy},radius:Math.max(2.5,surface.rx*.032),tail:0,flow:Math.min(1,creamFlow/.85),time})}
    }
    for (const object of [...parts.values(), ...foods]) if (object.shadow) object.shadow.visible = object.mesh.visible
    renderer.render(scene, camera); frame = requestAnimationFrame(animate)
  }
  resize(); sync(); void load().catch(error => { if (destroyed || error instanceof DOMException && error.name === 'AbortError') return; status.hidden = false; status.textContent = 'Не удалось загрузить медовую кухню. Вернитесь на кухню и попробуйте снова.' }); frame = requestAnimationFrame(animate)
  return { destroy() { if (destroyed) return; destroyed = true; cancelHoney(model); cancelAnimationFrame(frame); abort.abort(); observer.disconnect(); geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose()); renderer.dispose(); renderer.forceContextLoss(); scene.clear(); root.remove(); previousFocus?.focus({ preventScroll: true }) } }
}
