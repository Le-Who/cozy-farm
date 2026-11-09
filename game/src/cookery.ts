import { preserveFillMask } from './preserve-mask'
import {finishedIngredient, applyIngredientFinishes} from './ingredient-finish'
import {traitIds, type Trait} from './climate'
import { loadArtTexture } from './art-texture';
import * as THREE from 'three'
import { createFruitLanding, createViscousFollower, stepFruitLanding, stepSpring, stepViscousFollower, type FruitLanding, type ViscousFollower } from './food-motion'
import {
  beginCookeryStroke, cancelCookery, completeCookery, cookeryParticle, cookeryProgress,
  cookeryViewport, createCookeryModel, endCookeryStroke, fillCookeryJar, inCookerySurface,
  moveCookeryStroke, placeCookeryFruit, rotateCookeryFruit, STIR_REQUIRED,
  choosePreserveProcessing, type CookeryKind, type CookeryPoint,
} from './cookery-model'
import { lazyScene } from './lazy-scene'
import type { HoneyFamily } from './honey-cookery-model'
import type { CookeryResult, SignatureProcessing } from './culinary'
import { signatureProcessingDefinitions } from './culinary'
import type { FishingSpecies } from './fishing-model'
import './cookery.css'

export type CookeryRecipe = {
  id: string; name: string; kind: CookeryKind | HoneyFamily | 'grilledFish'; icon?: string; signature?: boolean; processing?: SignatureProcessing;
  ingredients?: readonly { name: string; icon?: string; count?: number; trait?: Trait }[];
  fruitOptions?: readonly { id: string; name: string; art?: string; color?: string }[];
  selectedFruit?: readonly { id: string; quantity: number; trait?: string }[];
  fishSpecies?: FishingSpecies;
}
export type CookeryOptions = { recipe: CookeryRecipe; onComplete: (result: CookeryResult) => boolean; onCancel: () => void; returnLabel?: string }
type Ellipse = { cx: number; cy: number; rx: number; ry: number }
type Asset = { url: string; width: number; height: number; innerRimEllipse?: Ellipse; mixSurfaceEllipse?: Ellipse; foregroundUrl?: string }
type Rect = { x: number; y: number; width: number; height: number }
type Art = { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; shadow?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; asset: Asset; rect: Rect }
type Drag = { kind: 'fruit'; id: number; source: boolean } | { kind: 'spoon'; loaded: boolean } | { kind: 'shaker' }
type Fleck = { x: number; y: number; size: number; rotation: number }

const createHoneyCookery = lazyScene(() => import('./honey-cookery').then(m => m.createHoneyCookery))
const createFishCookery = lazyScene(() => import('./fish-cookery').then(m => m.createFishCookery))

/** Inventory stays in the parent. One scene owns one uncommitted recipe. */
export function createCookery(host: HTMLElement, options: CookeryOptions): { destroy(): void } {
  if (options.recipe.kind === 'grilledFish') return createFishCookery(host, options)
  if (options.recipe.kind !== 'preserves' && options.recipe.kind !== 'decorate') return createHoneyCookery(host, options)
  const model = createCookeryModel(options.recipe.kind, options.recipe.processing)
  const portions: { id: string; trait?: string }[] = options.recipe.selectedFruit?.length
    ? options.recipe.selectedFruit.flatMap(p => Array.from({length:Math.max(1,Math.min(3,p.quantity))},()=>p))
    : (options.recipe.id === 'orchardPreserves' ? ['apple','pear'] : ['apple']).map(id=>({id}))
  const fruitMix = portions.map(part=>part.id)
  const fruitId = (id:number)=>portions[id % portions.length].id
  const fruitTrait = (id:number)=>traitIds.find(t=>t===portions[id % portions.length].trait)
  const mixture = portions.map((_,index)=>fruitTrait(index)).filter((t):t is Trait=>!!t)
  const berryMix = fruitMix.filter(id => ['strawberry', 'blueberry', 'raspberry'].includes(id))
  const tartBase = berryMix.length === fruitMix.length && new Set(berryMix).size === 1 ? `tart-${berryMix[0]}` : 'tart'
  const fruitTint = new THREE.Color(berryMix.includes('blueberry') ? '#7460a3' : berryMix.includes('raspberry') ? '#c33c66' : '#d94c42')
  const fruitAsset = (id: number) => {
    const requested = options.recipe.fruitOptions?.find(value => value.id === fruitId(id))?.art
    if (model.kind === 'preserves' && requested === 'apple-slice') return 'apple-piece'
    return requested ?? (fruitId(id) === 'apple' ? model.kind === 'decorate' ? 'apple-slice' : 'apple-piece' : fruitId(id) === 'pear' ? 'pear-piece' : fruitId(id) === 'peach' ? 'peach-slice' : fruitId(id))
  }
  const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
  const abort = new AbortController(), signal = abort.signal
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const base = import.meta.env.BASE_URL
  const artBase = `${base}art/lavender/cookery/`
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const root = document.createElement('section')
  root.className = 'cookery-game'
  root.dataset.kind = model.kind
  root.setAttribute('aria-label', options.recipe.name)
  root.innerHTML = `<div class="cookery-view" tabindex="0" role="application" aria-label="Кухонный стол" aria-describedby="cookery-instructions">
    <div class="cookery-heading"><span class="cookery-recipe-name"></span><div class="cookery-ingredients"></div></div>
    <button type="button" class="cookery-close" aria-label="На кухню">×</button>
    <div class="cookery-source-cue" aria-hidden="true"></div><div class="cookery-tool-cue" aria-hidden="true"></div>
    <div class="cookery-caption"><p class="cookery-hint"></p><div class="cookery-progress" role="progressbar" aria-label="Приготовление" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>
    <button type="button" class="cookery-finish" hidden><span>Готово</span></button>
    <button type="button" class="cookery-rotate" aria-label="Повернуть выбранный фрукт" title="Потяните, чтобы повернуть · колёсико · Q / E" hidden>↻</button>
    <div class="cookery-processing" role="group" aria-label="Густота конфитюра" hidden><button type="button" data-processing="chunky">С кусочками</button><button type="button" data-processing="bright">Свежее</button><button type="button" data-processing="silky">Нежное</button></div>
    <div class="cookery-render-status" role="status">Открываем кухню…</div>
    <div class="cookery-keyboard-cursor" hidden aria-hidden="true"></div>
    </div><p id="cookery-instructions" class="cookery-sr-only">Переносите фрукты с тарелки. Ложкой перемешивайте конфитюр, сахарницей посыпайте тарт. Клавиатура: F — следующий фрукт, S — ложка или сахарница, стрелки — перемещение, пробел — взять или положить, Q и E — поворот дольки, Esc — на кухню, Enter — завершить готовое блюдо.</p><p class="cookery-live cookery-sr-only" aria-live="polite" aria-atomic="true"></p>`
  host.append(root)
  root.querySelector('.cookery-close')!.setAttribute('aria-label', options.returnLabel ?? 'На кухню')
  const view = root.querySelector<HTMLElement>('.cookery-view')!
  const status = root.querySelector<HTMLElement>('.cookery-render-status')!
  const hint = root.querySelector<HTMLElement>('.cookery-hint')!
  const live = root.querySelector<HTMLElement>('.cookery-live')!
  const finish = root.querySelector<HTMLButtonElement>('.cookery-finish')!
  const close = root.querySelector<HTMLButtonElement>('.cookery-close')!
  const rotateHandle = root.querySelector<HTMLButtonElement>('.cookery-rotate')!
  const processingControls = root.querySelector<HTMLElement>('.cookery-processing')!
  let dragAngle = 0
  const progress = root.querySelector<HTMLElement>('.cookery-progress')!
  const progressFill = progress.querySelector<HTMLElement>('i')!
  const sourceCue = root.querySelector<HTMLElement>('.cookery-source-cue')!
  const toolCue = root.querySelector<HTMLElement>('.cookery-tool-cue')!
  const keyboardCursor = root.querySelector<HTMLElement>('.cookery-keyboard-cursor')!
  root.querySelector<HTMLElement>('.cookery-recipe-name')!.textContent = options.recipe.name
  const ingredients = root.querySelector<HTMLElement>('.cookery-ingredients')!
  for (const ingredient of options.recipe.ingredients ?? []) {
    const item = document.createElement('span')
    item.title = ingredient.name
    if (ingredient.icon) { const image = document.createElement('img'); image.src = ingredient.icon; image.alt = ingredient.name; if (ingredient.trait) image.dataset.finish = ingredient.trait; item.append(image) }
    else item.textContent = ingredient.name
    if (ingredient.count && ingredient.count > 1) { const count = document.createElement('b'); count.textContent = String(ingredient.count); item.append(count) }
    ingredients.append(item)
  }
  applyIngredientFinishes(ingredients)
  close.style.backgroundImage = `url("${base}art/lavender/workshop-authored/close-medallion.webp")`
  finish.style.backgroundImage = `url("${base}art/lavender/workshop-authored/bake-frame.webp")`
  let destroyed = false, contextLost = false, loaded = false, frame = 0
  let width = 1, height = 1, elapsed = 0, lastTime = performance.now(), renderedStage = ''
  let pointerId: number | null = null, drag: Drag | null = null, keyboard = false
  let cursor: CookeryPoint = { x: 0, y: 0 }, selectedFruit = -1, lastDust: CookeryPoint | null = null
  let surface: Ellipse = { cx: 0, cy: 0, rx: 1, ry: 1 }
  let jarFill = 0, pour = 0, flowPhase = 0, flowVelocity = 0, flowTarget = 0, fruitTurn = 0, fruitTurnTarget = 0
  let lastStirAt = 0, lastStirPoint: CookeryPoint | null = null
  const heldFruit = createViscousFollower(), landings = new Map<number, { body: FruitLanding; follow: ViscousFollower }>()
  const toolReturns=new Map<string,{x:{value:number;velocity:number};y:{value:number;velocity:number};width:{value:number;velocity:number};angle:{value:number;velocity:number};target:{x:number;y:number;width:number;angle:number}}>()
  let physicallySettled = true
  const brush = new THREE.Vector2(), brushTarget = new THREE.Vector2()
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(0, 1, 0, 1, .1, 200)
  camera.position.z = 100
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>()
  const plane = new THREE.PlaneGeometry(1, 1); geometries.add(plane)
  const artwork = new Map<string, Art>(), fruitArt = new Map<number, Art>()
  const flecks: Fleck[] = []
  let liquid: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial> | null = null
  let sugar: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null
  let jarLiquid: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null
  let spoonful: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial> | null = null
  let pourStream: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null
  let renderer: THREE.WebGLRenderer
  const announce = (text: string) => { live.textContent = text }
  const cancel = () => { if (!destroyed) { cancelCookery(model); options.onCancel() } }
  close.addEventListener('click', cancel, { signal })
  function makeRenderer(canvas?: HTMLCanvasElement) {
    const next = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' })
    next.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); next.outputColorSpace = THREE.SRGBColorSpace; next.setClearColor('#aa7852')
    next.domElement.setAttribute('aria-hidden', 'true'); return next
  }
  try {
    renderer = makeRenderer()
    view.prepend(renderer.domElement)
  } catch {
    status.textContent = 'Не удалось открыть стол. Вернитесь на кухню и попробуйте снова.'
    return { destroy() { destroyed = true; abort.abort(); plane.dispose(); root.remove(); previousFocus?.focus({ preventScroll: true }) } }
  }

  function loadTexture(url: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const texture = loadArtTexture(url, result => {
        if (destroyed) { result.dispose(); reject(new DOMException('Кухня закрыта', 'AbortError')); return }
        result.colorSpace = THREE.SRGBColorSpace; resolve(result)
      }, reject)
      textures.add(texture)
    })
  }
  function resolveUrl(url: string) { return /^(?:https?:|data:|blob:|\/)/.test(url) ? url : url.startsWith('art/') ? `${base}${url}` : `${artBase}${url}` }
  function addArt(key: string, asset: Asset, texture: THREE.Texture, z: number): Art {
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    materials.add(material)
    const mesh = new THREE.Mesh(plane, material); mesh.position.z = z; mesh.renderOrder = z; scene.add(mesh)
    const art: Art = { mesh, asset, rect: { x: 0, y: 0, width: 1, height: 1 } }
    if (['pot', 'tart', 'dish', 'jar', 'spoon', 'shaker'].includes(key)) {
      const shadowMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { map: { value: texture }, texel: { value: new THREE.Vector2(3 / asset.width, 3 / asset.height) } },
        vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform sampler2D map;uniform vec2 texel;varying vec2 vUv;void main(){float a=texture2D(map,vUv).a*.28;
        a+=texture2D(map,vUv+vec2(texel.x,0.)).a*.12+texture2D(map,vUv-vec2(texel.x,0.)).a*.12;
        a+=texture2D(map,vUv+vec2(0.,texel.y)).a*.12+texture2D(map,vUv-vec2(0.,texel.y)).a*.12;
        a+=texture2D(map,vUv+texel).a*.06+texture2D(map,vUv-texel).a*.06;
        gl_FragColor=vec4(.27,.12,.055,a*.23);}` })
      materials.add(shadowMaterial); art.shadow = new THREE.Mesh(plane, shadowMaterial); art.shadow.renderOrder = 1; art.shadow.position.z = 1; scene.add(art.shadow)
    }
    artwork.set(key, art); return art
  }
  function setRect(art: Art, rect: Rect, rotation = 0) {
    art.rect = rect; art.mesh.position.x = rect.x + rect.width / 2; art.mesh.position.y = rect.y + rect.height / 2
    art.mesh.scale.set(rect.width, -rect.height, 1); art.mesh.rotation.z = rotation
    if (art.shadow) { art.shadow.visible = art.mesh.visible; art.shadow.position.x = art.mesh.position.x + 4; art.shadow.position.y = art.mesh.position.y + 7; art.shadow.scale.copy(art.mesh.scale); art.shadow.rotation.z = rotation }
  }
  function locate(art: Art, x: number, y: number, size: number, rotation = 0) {
    const h = size * art.asset.height / art.asset.width
    setRect(art, { x: x - size / 2, y: y - h / 2, width: size, height: h }, rotation)
  }
  function artPoint(art: Art, u: number, v: number): CookeryPoint {
    const dx = (u - .5) * art.rect.width, dy = (v - .5) * art.rect.height, angle = art.mesh.rotation.z
    return { x: art.rect.x + art.rect.width / 2 + Math.cos(angle) * dx - Math.sin(angle) * dy,
      y: art.rect.y + art.rect.height / 2 + Math.sin(angle) * dx + Math.cos(angle) * dy }
  }
  function resize() {
    const bounds = cookeryViewport(Math.min(window.innerWidth, window.visualViewport?.width ?? Infinity), Math.min(window.innerHeight, window.visualViewport?.height ?? Infinity))
    root.style.width = `${bounds.width}px`; root.style.height = `${bounds.height}px`
    width = Math.max(1, view.clientWidth); height = Math.max(1, view.clientHeight)
    root.dataset.compact = String(bounds.compact)
    root.dataset.portrait = String(width / height < .85)
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(pixelRatio)
    if (sugar) sugar.material.uniforms.pixelRatio.value = pixelRatio
    renderer.setSize(width, height, false)
    camera.left = 0; camera.right = width; camera.top = 0; camera.bottom = height; camera.updateProjectionMatrix()
    layoutArt(); updateSugar()
  }
  window.addEventListener('resize', resize, { signal })
  window.visualViewport?.addEventListener('resize', resize, { signal })
  const observer = new ResizeObserver(() => { if (!destroyed) resize() }); observer.observe(host)
  function layoutArt() {
    if (!loaded) return
    const portrait = width / height < .85, compact = height < 420 || height < 600 && width > height
    const narrowCompact = compact && width / height < 1.3
    const room = artwork.get(portrait ? 'room-portrait' : 'room')!
    artwork.get('room')!.mesh.visible = !portrait; artwork.get('room-portrait')!.mesh.visible = portrait
    const roomScale = Math.max(width / room.asset.width, height / room.asset.height)
    setRect(room, { x: (width - room.asset.width * roomScale) / 2, y: (height - room.asset.height * roomScale) / 2, width: room.asset.width * roomScale, height: room.asset.height * roomScale })
    const main = artwork.get(model.kind === 'preserves' ? 'pot' : 'tart')!
    const mainWidth = Math.min(width * (portrait ? .94 : narrowCompact ? .47 : compact ? .53 : .63), height * (portrait ? 1 : compact ? .73 : .75))
    const mainX = width * (portrait ? .49 : narrowCompact ? .50 : .53), mainY = height * (narrowCompact ? .62 : compact ? .67 : portrait ? .50 : .69)
    locate(main, mainX, mainY, mainWidth)
    const ellipse = main.asset.mixSurfaceEllipse ?? main.asset.innerRimEllipse ?? { cx: main.asset.width * .5, cy: main.asset.height * (model.kind === 'preserves' ? .33 : .42), rx: main.asset.width * .39, ry: main.asset.height * (model.kind === 'preserves' ? .18 : .30) }
    surface = { cx: main.rect.x + ellipse.cx / main.asset.width * main.rect.width, cy: main.rect.y + ellipse.cy / main.asset.height * main.rect.height,
      rx: ellipse.rx / main.asset.width * main.rect.width, ry: ellipse.ry / main.asset.height * main.rect.height }
    if (model.kind === 'preserves') { surface.cy += main.rect.height * .025; surface.rx *= .97; surface.ry *= .84 }
    const front = artwork.get('pot-front'); if (front) setRect(front, main.rect)
    const dish = artwork.get('dish')!
    locate(dish, width * (portrait ? .24 : compact ? .16 : .18), height * (portrait ? .79 : compact ? .65 : .81), Math.min(width * (portrait ? .43 : .25), height * .43))
    const jar = artwork.get('jar')!
    locate(jar, width * (portrait ? .83 : .86), height * (portrait ? .75 : compact ? .65 : .77), Math.min(width * (portrait ? .28 : .18), height * .29))
    jar.mesh.visible = model.kind === 'preserves'
    const spoon = artwork.get('spoon')!
    if (drag?.kind !== 'spoon') restTool('spoon',width * (portrait ? .70 : .81), height * (portrait ? .84 : compact ? .61 : .58), Math.min(width * (portrait ? .29 : .21), height * .36), -.25)
    spoon.mesh.visible = model.kind === 'preserves'
    const shaker = artwork.get('shaker')!
    if (drag?.kind !== 'shaker') restTool('shaker',width * (portrait ? .86 : .85), height * (portrait ? .35 : compact ? .60 : .60), Math.min(width * (portrait ? .25 : .15), height * .32),0)
    shaker.mesh.visible = model.kind === 'decorate'
    for (const art of artwork.values()) if (art.shadow) art.shadow.visible = art.mesh.visible
    if (liquid) { liquid.position.set(surface.cx, surface.cy, 4); liquid.scale.set(surface.rx, -surface.ry, 1) }
    if (jarLiquid) { const r = jar.rect; jarLiquid.position.set(r.x + r.width * .5, r.y + r.height * .5, 8.5); jarLiquid.scale.set(r.width, -r.height, 1); jarLiquid.visible = model.kind === 'preserves' }
    if (pourStream) { const r = jar.rect; pourStream.position.set(r.x + r.width * .5, r.y + r.height * .31, 21); pourStream.scale.set(r.width * .12, -r.height * .30, 1) }
    positionFruit()
    sourceCue.style.left = `${dish.rect.x + dish.rect.width * .5}px`; sourceCue.style.top = `${dish.rect.y + dish.rect.height * .5}px`
    updateToolCue(); updateCursor()
  }
  function restTool(key:string,x:number,y:number,size:number,rotation:number){const art=artwork.get(key)!,motion=toolReturns.get(key);if(motion){motion.target={x,y,width:size,angle:motion.angle.value+normalizeAngle(rotation-motion.angle.value)};locate(art,motion.x.value,motion.y.value,motion.width.value,motion.angle.value)}else locate(art,x,y,size,rotation)}
  function sourcePoint(id: number): CookeryPoint {
    const dish = artwork.get('dish')!, r = dish.rect
    const row = Math.floor(id / 3) % 2, column = id % 3
    return { x: r.x + r.width * (.28 + column * .21), y: r.y + r.height * (.46 + row * .13) }
  }
  function positionFruit() {
    const stirred = Math.min(1, model.stirred / model.stirRequired) * (model.processing === 'chunky' ? .45 : model.processing === 'bright' ? .8 : 1)
    fruitArt.forEach((art, id) => {
      const fruit = model.fruit.find(value => value.id === id), held = drag?.kind === 'fruit' && drag.id === id
      if (held) return
      art.mesh.visible = model.kind === 'decorate' ? id < Math.min(12, Math.max(6, model.fruit.length + 2)) : true
      if (fruit) {
        let x = fruit.x, y = fruit.y
        if (model.kind === 'preserves') {
          const angle = Math.atan2(y, x) + fruitTurn, radius = Math.hypot(x, y) * (1 - stirred * .12)
          x = Math.cos(angle) * radius; y = Math.sin(angle) * radius
        }
        locate(art, surface.cx + x * surface.rx, surface.cy + y * surface.ry, surface.rx * (model.kind === 'preserves' ? .47 * (1 - stirred * .38) : .65), fruit.angle + (model.kind === 'preserves' ? fruitTurn * .55 : 0))
        const impact = landings.get(id); if (impact) { art.mesh.position.x = impact.follow.x; art.mesh.position.y = impact.follow.y - impact.body.height * surface.ry; art.mesh.scale.x *= 1 + Math.max(0,-impact.body.velocity) * .025; art.mesh.scale.y *= 1 - Math.max(0,-impact.body.velocity) * .018; art.mesh.rotation.z += impact.body.velocity * .025 }
        art.mesh.material.opacity = model.kind === 'preserves' ? 1 - stirred * .18 : 1
        if (model.kind === 'preserves') art.mesh.material.color.setRGB(1, 1 - stirred * .035, 1 - stirred * .09)
        art.mesh.position.z = model.kind === 'preserves' ? 5 : 5 + id * .01; art.mesh.renderOrder = art.mesh.position.z
      } else {
        const position = sourcePoint(id)
        locate(art, position.x, position.y, artwork.get('dish')!.rect.width * .30, (id % 3 - 1) * .12)
        art.mesh.material.opacity = 1; art.mesh.position.z = 9 + id * .01; art.mesh.renderOrder = art.mesh.position.z
      }
    })
    positionRotateHandle()
  }
  function positionRotateHandle() {
    const fruit = model.fruit.find(value => value.id === selectedFruit), art = fruitArt.get(selectedFruit)
    rotateHandle.hidden = model.kind !== 'decorate' || !fruit || !art || ['finished', 'committing', 'cancelled'].includes(model.stage)
    if (rotateHandle.hidden || !art) return
    rotateHandle.style.left = `${Math.max(4, Math.min(width - 48, art.rect.x + art.rect.width - 6))}px`
    rotateHandle.style.top = `${Math.max(75, Math.min(height - 100, art.rect.y - 30))}px`
  }
  function normalized(point: CookeryPoint): CookeryPoint { return { x: (point.x - surface.cx) / surface.rx, y: (point.y - surface.cy) / surface.ry } }
  function pixel(point: CookeryPoint): CookeryPoint { return { x: surface.cx + point.x * surface.rx, y: surface.cy + point.y * surface.ry } }
  function contains(art: Art, point: CookeryPoint, tolerance = 0) { const r = art.rect; return point.x >= r.x - tolerance && point.x <= r.x + r.width + tolerance && point.y >= r.y - tolerance && point.y <= r.y + r.height + tolerance }
  function moveHeld(point: CookeryPoint) {
    cursor = point
    if (!drag) return
    if (drag.kind === 'fruit') {
      const art = fruitArt.get(drag.id)!
      locate(art, heldFruit.x, heldFruit.y - (reduced.matches?2:9), surface.rx * (model.kind === 'preserves' ? .48 : .65), dragAngle)
      art.mesh.position.z = 18; art.mesh.renderOrder = 18; art.mesh.material.opacity = 1
    } else {
      const art = artwork.get(drag.kind)!
      const size = drag.kind === 'spoon' ? Math.min(surface.rx * 1.05, height * .36) : Math.min(surface.rx * .65, height * .25)
      if (drag.kind === 'spoon') {
        const jar = artwork.get('jar')!, pouring = !drag.loaded && pour > 0 && contains(jar, point, 5)
        const tip = pouring ? artPoint(jar, .5, .13) : point
        locate(art, tip.x, tip.y, size, -.55)
        const bowl = artPoint(art, .285, .745)
        setRect(art, { ...art.rect, x: art.rect.x + tip.x - bowl.x, y: art.rect.y + tip.y - bowl.y }, -.55)
      } else locate(art, point.x + size * .15, point.y - size * .28, size, -.4 + Math.sin(elapsed * 20) * (reduced.matches ? 0 : .06))
      art.mesh.position.z = 20; art.mesh.renderOrder = 20
    }
    updateCursor()
  }
  function updateCursor() {
    keyboardCursor.hidden = !keyboard
    keyboardCursor.style.left = `${cursor.x}px`; keyboardCursor.style.top = `${cursor.y}px`
  }
  function updateToolCue() {
    const key = model.kind === 'preserves' ? 'spoon' : 'shaker', art = artwork.get(key)
    if (!art) return
    toolCue.style.left = `${art.rect.x + art.rect.width / 2}px`; toolCue.style.top = `${art.rect.y + art.rect.height * .57}px`
    toolCue.hidden = !!drag || !['stir', 'fill', 'sprinkle'].includes(model.stage)
  }
  function sync() {
    if (destroyed) return
    root.dataset.stage = model.stage
    const changed = renderedStage !== model.stage
    renderedStage = model.stage
    const messages: Record<string, string> = {
      fruit: model.kind === 'preserves' ? 'Добавьте фрукты в кастрюлю' : 'Разложите фрукты по своему вкусу',
      stir: 'Возьмите ложку и перемешайте', fill: 'Переложите конфитюр ложкой в банку',
      sprinkle: 'Посыпьте тарт сахаром', ready: '',
      committing: 'Подаём…', finished: '', cancelled: '',
    }
    hint.textContent = messages[model.stage] ?? ''
    if (changed) announce(model.stage === 'ready' ? 'Всё готово. Можно подавать.' : hint.textContent)
    const value = Math.round(cookeryProgress(model) * 100)
    progress.setAttribute('aria-valuenow', String(value)); progressFill.style.width = `${value}%`
    progress.hidden = model.stage === 'ready' || model.stage === 'finished'
    finish.hidden = model.stage !== 'ready' && model.stage !== 'finished'; finish.disabled = contextLost || !loaded || !physicallySettled || !!drag
    finish.querySelector('span')!.textContent = model.stage === 'finished' ? options.returnLabel ?? 'На кухню' : 'Готово'
    sourceCue.hidden = model.stage !== 'fruit' || !!drag
    updateToolCue()
    processingControls.hidden = !options.recipe.signature || model.kind !== 'preserves' || model.stage !== 'fruit'
    processingControls.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.processing === model.processing)); button.title = signatureProcessingDefinitions[button.dataset.processing as SignatureProcessing].use })
    positionRotateHandle()
  }
  function doFinish() {
    if (contextLost || destroyed || !loaded || !physicallySettled || drag) return
    if (model.stage === 'finished') { options.onCancel(); return }
    try {
      const result: CookeryResult = { family: model.kind, processing: model.kind === 'preserves' ? model.processing : options.recipe.processing ?? 'chunky',
        fruitTraitsVersion: 1, fruit: model.fruit.map(fruit => ({ ingredientId: fruitId(fruit.id), ...(fruitTrait(fruit.id) ? {trait:fruitTrait(fruit.id)} : {}), x: fruit.x, y: fruit.y, angle: normalizeAngle(fruit.angle) })),
        steps: model.kind === 'preserves' ? ['add-fruit', `stir-${model.processing}`, 'fill-jar'] : ['arrange-fruit', 'dust-sugar'],
        ...(model.kind === 'preserves' ? { baking: { method: 'stovetop' as const, finish: 'set' as const, seconds: Math.min(1800, elapsed) } } : {}) }
      if (!completeCookery(model, () => options.onComplete(result)) && model.stage === 'ready') announce('Не хватает ингредиентов. Выберите другой рецепт на кухне.')
    } catch { announce('Не удалось сохранить блюдо. Попробуйте ещё раз.') }
    sync()
  }
  finish.addEventListener('click', doFinish, { signal })
  processingControls.addEventListener('click', event => {
    const value = (event.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.processing
    if (value === 'bright' || value === 'chunky' || value === 'silky') { choosePreserveProcessing(model, value); sync() }
  }, { signal })
  function rotateSelection(angle: number) {
    if (model.kind !== 'decorate' || selectedFruit < 0) return
    if (drag?.kind === 'fruit' && drag.id === selectedFruit) { dragAngle = normalizeAngle(angle); moveHeld(cursor) }
    else if (rotateCookeryFruit(model, selectedFruit, normalizeAngle(angle))) positionFruit()
  }
  let handleGrip: { id: number; bearing: number; angle: number; moved: boolean } | null = null
  rotateHandle.addEventListener('pointerdown', event => {
    const art = fruitArt.get(selectedFruit), fruit = model.fruit.find(value => value.id === selectedFruit)
    if (!art || !fruit) return
    event.preventDefault(); event.stopPropagation(); const bounds = view.getBoundingClientRect()
    handleGrip = { id: event.pointerId, bearing: Math.atan2(event.clientY - bounds.top - art.mesh.position.y, event.clientX - bounds.left - art.mesh.position.x), angle: fruit.angle, moved: false }
    rotateHandle.setPointerCapture(event.pointerId)
  }, { signal })
  rotateHandle.addEventListener('pointermove', event => {
    if (!handleGrip || handleGrip.id !== event.pointerId) return
    const art = fruitArt.get(selectedFruit)!, bounds = view.getBoundingClientRect()
    const bearing = Math.atan2(event.clientY - bounds.top - art.mesh.position.y, event.clientX - bounds.left - art.mesh.position.x)
    const change = normalizeAngle(bearing - handleGrip.bearing); if (Math.abs(change) > .03) handleGrip.moved = true
    rotateSelection(handleGrip.angle + change)
  }, { signal })
  const releaseHandle = () => { if (handleGrip && !handleGrip.moved) { const fruit = model.fruit.find(value => value.id === selectedFruit); if (fruit) rotateSelection(fruit.angle + Math.PI / 12) }; handleGrip = null }
  rotateHandle.addEventListener('pointerup', releaseHandle, { signal }); rotateHandle.addEventListener('pointercancel', () => { handleGrip = null }, { signal })
  rotateHandle.addEventListener('click', event => { if (event.detail === 0) { const fruit = model.fruit.find(value => value.id === selectedFruit); if (fruit) rotateSelection(fruit.angle + Math.PI / 12) } }, { signal })
  view.addEventListener('wheel', event => {
    const fruit = model.fruit.find(value => value.id === selectedFruit)
    if (model.kind !== 'decorate' || !fruit || ['finished', 'cancelled'].includes(model.stage)) return
    event.preventDefault(); rotateSelection(fruit.angle + Math.sign(event.deltaY) * .13)
  }, { signal, passive: false })

  function start(point: CookeryPoint) {
    if (!loaded || contextLost || destroyed || ['committing', 'finished', 'cancelled'].includes(model.stage)) return
    cursor = point; lastDust = null; lastStirPoint = null
    const canFruit = model.stage === 'fruit' || model.kind === 'decorate'
    if (canFruit) {
      const ordered = [...fruitArt].reverse()
      for (const [id, art] of ordered) {
        if (!art.mesh.visible || !contains(art, point, 6)) continue
        const placed = model.fruit.some(fruit => fruit.id === id)
        if (placed && Math.hypot((point.x - (art.rect.x + art.rect.width / 2)) / (art.rect.width / 2), (point.y - (art.rect.y + art.rect.height / 2)) / (art.rect.height / 2)) > 1.1) continue
        drag = { kind: 'fruit', id, source: !placed }; landings.delete(id); heldFruit.x = point.x; heldFruit.y = point.y; heldFruit.vx = heldFruit.vy = 0; selectedFruit = id; dragAngle = model.fruit.find(value => value.id === id)?.angle ?? 0; moveHeld(point); sync(); return
      }
    }
    if (model.kind === 'preserves' && ['stir', 'fill'].includes(model.stage) && (contains(artwork.get('spoon')!, point, 8) || inCookerySurface(normalized(point)))) {
      drag = { kind: 'spoon', loaded: model.stage === 'fill' && inCookerySurface(normalized(point)) }
    } else if (model.kind === 'decorate' && ['sprinkle', 'ready'].includes(model.stage) && contains(artwork.get('shaker')!, point, 8)) drag = { kind: 'shaker' }
    if (drag) { toolReturns.delete(drag.kind); beginCookeryStroke(model, normalized(point)); moveHeld(point); sync() }
  }
  function emitDust(from: CookeryPoint, to: CookeryPoint) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y), count = Math.max(1, Math.ceil(distance * 80))
    for (let i = 0; i < count; i++) {
      const variation = cookeryParticle(model.particleSerial++), t = i / count
      const x = from.x + (to.x - from.x) * t + variation.x * .13, y = from.y + (to.y - from.y) * t + variation.y * .13
      if (inCookerySurface({ x, y }, .96)) flecks.push({ x, y, size: variation.size, rotation: variation.rotation })
    }
    if (flecks.length > 2200) flecks.splice(0, flecks.length - 2200)
    updateSugar()
  }
  function move(point: CookeryPoint) {
    if (!drag || contextLost || destroyed) return
    moveHeld(point)
    const normalizedPoint = normalized(point)
    if (drag.kind === 'spoon') {
      if (model.stage === 'stir') {
        const now = performance.now(), previous = lastStirPoint
        if (previous && inCookerySurface(normalizedPoint, 1.05) && Math.hypot(normalizedPoint.x, normalizedPoint.y) > .2) {
          const angle = Math.atan2(normalizedPoint.y, normalizedPoint.x) - Math.atan2(previous.y, previous.x)
          const turn = Math.atan2(Math.sin(angle), Math.cos(angle))
          if (Math.abs(turn) < .65) { flowTarget = THREE.MathUtils.clamp(turn / Math.max(.016, (now - lastStirAt) / 1000), -4, 4); fruitTurnTarget += turn * .38 }
        }
        lastStirPoint = inCookerySurface(normalizedPoint, 1.05) ? { ...normalizedPoint } : null
        lastStirAt = now; brushTarget.set(normalizedPoint.x, -normalizedPoint.y)
        moveCookeryStroke(model, normalizedPoint)
      }
      if (model.stage === 'fill') {
        if (inCookerySurface(normalizedPoint, .85)) { drag.loaded = true; pour = 0 }
        if (drag.loaded && contains(artwork.get('jar')!, point, 0)) {
          fillCookeryJar(model); drag.loaded = false; pour = 1
          announce(model.scoops >= 3 ? 'Банка полна. Конфитюр готов.' : 'Ложка конфитюра в банке')
        }
      }
    } else if (drag.kind === 'shaker' && ['sprinkle', 'ready'].includes(model.stage)) {
      const previous = lastDust ?? normalizedPoint
      if (inCookerySurface(normalizedPoint, 1.02)) {
        moveCookeryStroke(model, normalizedPoint)
        if (Math.hypot(normalizedPoint.x - previous.x, normalizedPoint.y - previous.y) >= .007) emitDust(previous, normalizedPoint)
        lastDust = normalizedPoint
      } else { lastDust = null; beginCookeryStroke(model, normalizedPoint) }
    }
    sync()
  }
  function release() {
    if (!drag) return
    if(drag.kind!=='fruit'){const art=artwork.get(drag.kind)!;toolReturns.set(drag.kind,{x:{value:art.mesh.position.x,velocity:0},y:{value:art.mesh.position.y,velocity:0},width:{value:art.rect.width,velocity:0},angle:{value:art.mesh.rotation.z,velocity:0},target:{x:art.mesh.position.x,y:art.mesh.position.y,width:art.rect.width,angle:art.mesh.rotation.z}})}
    if (drag.kind === 'fruit') {
      const drop = normalized(cursor)
      // Accept the full painted pot mouth, including its deeper rear rim. Keep fruit on the liquid.
      if (model.kind === 'preserves') {
        const rimY = (cursor.y - (surface.cy - artwork.get('pot')!.rect.height * .025)) / (surface.ry / .84)
        if (Math.hypot(drop.x*.97,rimY) <= 1.035) {
          const length=Math.hypot(drop.x,drop.y)
          if(length>.975) {drop.x*=.975/length;drop.y*=.975/length}
        }
      }
      if (placeCookeryFruit(model, drag.id, drop)) { landings.set(drag.id, { body: createFruitLanding((reduced.matches?2:9)/surface.ry,0), follow: {...heldFruit} }); rotateCookeryFruit(model, drag.id, dragAngle); announce(model.kind === 'preserves' ? 'Фрукт в кастрюле' : 'Фрукт на тарте') }
    }
    drag = null; lastDust = null; lastStirPoint = null; endCookeryStroke(model); layoutArt(); sync()
  }
  function eventPoint(event: PointerEvent): CookeryPoint { const bounds = view.getBoundingClientRect(); return { x: event.clientX - bounds.left, y: event.clientY - bounds.top } }
  const touches = new Map<number, CookeryPoint>()
  let twist: { bearing: number; angle: number } | null = null, twistedGesture = false
  function updateTwist() {
    if (touches.size < 2 || drag?.kind !== 'fruit') return
    const [a, b] = [...touches.values()], bearing = Math.atan2(b.y - a.y, b.x - a.x)
    if (!twist) twist = { bearing, angle: dragAngle }
    twistedGesture = true
    rotateSelection(twist.angle + normalizeAngle(bearing - twist.bearing)); moveHeld({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  }
  view.addEventListener('pointerdown', event => {
    if ((event.target as HTMLElement).closest('button') || event.button !== 0) return
    if (event.pointerType === 'touch' && model.kind === 'decorate') {
      if (!touches.size) twistedGesture = false
      touches.set(event.pointerId, eventPoint(event)); view.setPointerCapture(event.pointerId)
      if (touches.size > 1) { updateTwist(); return }
    }
    if (pointerId !== null) return
    keyboard = false; pointerId = event.pointerId; view.setPointerCapture(event.pointerId); view.focus({ preventScroll: true }); start(eventPoint(event)); updateCursor()
  }, { signal })
  view.addEventListener('pointermove', event => {
    if (touches.has(event.pointerId)) { touches.set(event.pointerId, eventPoint(event)); if (touches.size > 1) { updateTwist(); return } }
    if (pointerId !== event.pointerId) return
    const samples = event.getCoalescedEvents?.()
    for (const sample of samples?.length ? samples : [event]) move(eventPoint(sample))
  }, { signal })
  view.addEventListener('pointerup', event => {
    if (touches.has(event.pointerId)) { touches.delete(event.pointerId); twist = null; if (touches.size) { pointerId = touches.keys().next().value!; return } }
    if (event.pointerId === pointerId) { if (!twistedGesture) move(eventPoint(event)); release(); pointerId = null; twistedGesture = false; if (view.hasPointerCapture(event.pointerId)) view.releasePointerCapture(event.pointerId) }
  }, { signal })
  const abandon = () => { drag = null; pointerId = null; touches.clear(); twist = null; twistedGesture = false; lastDust = null; lastStirPoint = null; endCookeryStroke(model); layoutArt(); sync() }
  view.addEventListener('pointercancel', abandon, { signal }); view.addEventListener('lostpointercapture', event => { if (pointerId === event.pointerId && touches.size <= 1) abandon() }, { signal })
  window.addEventListener('blur', abandon, { signal })
  view.addEventListener('keydown', event => {
    if ((event.target as HTMLElement).closest('button')) return
    if (event.key === 'Escape') { event.preventDefault(); cancel(); return }
    if (!loaded || contextLost) return
    const key = /^Key[FSQE]$/.test(event.code) ? event.code.slice(3).toLowerCase() : event.key.toLowerCase()
    if (key === 'enter') { event.preventDefault(); doFinish(); return }
    if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'f', 's', 'q', 'e'].includes(key)) return
    event.preventDefault(); keyboard = true
    if (key === 'f') {
      release()
      const next = [...fruitArt.keys()].find(id => !model.fruit.some(fruit => fruit.id === id)) ?? 0
      selectedFruit = next; cursor = sourcePoint(next); start(cursor)
    } else if (key === 's') {
      release(); const art = artwork.get(model.kind === 'preserves' ? 'spoon' : 'shaker')!
      cursor = { x: art.rect.x + art.rect.width / 2, y: art.rect.y + art.rect.height / 2 }; start(cursor)
    } else if (key === ' ') { if (drag) release(); else start(cursor.x || cursor.y ? cursor : pixel({ x: 0, y: 0 })) }
    else if (key === 'q' || key === 'e') {
      const fruit = model.fruit.find(value => value.id === selectedFruit)
      if (fruit) { rotateCookeryFruit(model, fruit.id, fruit.angle + (key === 'q' ? -.12 : .12)); positionFruit() }
    } else {
      const step = Math.max(6, Math.min(surface.rx, surface.ry) * (event.shiftKey ? .08 : .18))
      cursor = { x: Math.max(12, Math.min(width - 12, cursor.x + (key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0))),
        y: Math.max(60, Math.min(height - 60, cursor.y + (key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0))) }
      if (drag) move(cursor)
    }
    updateCursor(); sync()
  }, { signal })

  function updateSugar() {
    if (!sugar) return
    const position = sugar.geometry.getAttribute('position') as THREE.BufferAttribute
    const size = sugar.geometry.getAttribute('aSize') as THREE.BufferAttribute
    flecks.forEach((fleck, i) => { position.setXYZ(i, surface.cx + fleck.x * surface.rx, surface.cy + fleck.y * surface.ry, 10); size.setX(i, fleck.size * Math.max(1.1, surface.rx / 100)) })
    position.needsUpdate = true; size.needsUpdate = true; sugar.geometry.setDrawRange(0, flecks.length)
  }
  async function loadArt() {
    const response = await fetch(`${artBase}manifest.json`, { signal })
    if (!response.ok) throw new Error('Kitchen art unavailable')
    const manifest = await response.json() as { items: Record<string, Asset> }
    const preserveNames = ['syrup-surface', 'jam-surface', 'jar-full']
    const fruitNames = [...new Set(Array.from({ length: model.kind === 'decorate' ? 12 : model.fruitRequired }, (_, id) => fruitAsset(id)))]
    const names = ['room', 'room-portrait', 'pot', 'tart', 'jar', 'spoon', 'shaker', 'dish', ...fruitNames, ...(model.kind === 'preserves' ? preserveNames : [])]
    const assets = await Promise.all(names.map(async name => {
      const asset = name === 'jar-full' && berryMix.length && manifest.items['berry-jar-full'] ? manifest.items['berry-jar-full']
        : name === 'tart' && manifest.items[tartBase] ? manifest.items[tartBase] : manifest.items[name]
      if (!asset) throw new Error(`Missing kitchen art: ${name}`)
      return { name, asset, texture: await loadTexture(resolveUrl(asset.url)) }
    }))
    if (destroyed) return
    for (const { name, asset, texture } of assets) {
      if (fruitNames.includes(name) || preserveNames.includes(name)) continue
      const z = name.startsWith('room') ? -10 : name === 'pot' || name === 'tart' ? 3 : name === 'dish' ? 8 : name === 'jar' ? 8 : 15
      addArt(name, asset, texture, z)
    }
    artwork.get(model.kind === 'preserves' ? 'tart' : 'pot')!.mesh.visible = false
    const finishes = new Map<string,THREE.Texture>()
    function materialTexture(texture:THREE.Texture,traits:readonly Trait[],surface:'fruit'|'jar'|'jam'='fruit') {
      if(!traits.length)return texture
      const key = texture.uuid + ':' + traits.join(',') + surface
      const cached=finishes.get(key);if(cached)return cached
      const image=texture.image
      if (!(image instanceof HTMLImageElement || image instanceof HTMLCanvasElement)) return texture
      const source=finishedIngredient(image,traits,surface)
      const mapped=new THREE.Texture(source)
      mapped.colorSpace=texture.colorSpace; mapped.anisotropy=texture.anisotropy
      mapped.needsUpdate=true; textures.add(mapped); finishes.set(key,mapped)
      return mapped
    }
    for (let id = 0; id < (model.kind === 'decorate' ? 12 : model.fruitRequired); id++) {
      const name = fruitAsset(id)
      const value = assets.find(asset => asset.name === name)!
      fruitArt.set(id, addArt(`fruit-${id}`, value.asset, materialTexture(value.texture,fruitTrait(id)?[fruitTrait(id)!]:[]), 9))
    }
    const pot = manifest.items.pot
    if (model.kind === 'preserves' && pot.foregroundUrl) {
      const texture = await loadTexture(resolveUrl(pot.foregroundUrl)); if (destroyed) return
      addArt('pot-front', pot, texture, 6)
    }
    const liquidGeometry = new THREE.CircleGeometry(1, 96); geometries.add(liquidGeometry)
    if (model.kind === 'preserves') {
      const syrupMap = assets.find(value => value.name === 'syrup-surface')!.texture, jamMap = materialTexture(assets.find(value => value.name === 'jam-surface')!.texture,mixture,'jam')
      const vertexShader = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
      const skin = `uniform sampler2D syrupMap;uniform sampler2D jamMap;uniform float cooked;uniform vec3 fruitTint;uniform float tintStrength;varying vec2 vUv;
        vec4 preserves(vec2 uv){vec4 art=mix(texture2D(syrupMap,clamp(uv,.025,.975)),texture2D(jamMap,clamp(uv,.025,.975)),smoothstep(.08,.92,cooked));float light=dot(art.rgb,vec3(.2126,.7152,.0722));vec3 fruit=fruitTint*(.5+light*1.7);fruit=mix(fruit,art.rgb,smoothstep(.55,.9,light));art.rgb=mix(art.rgb,fruit,tintStrength);return art;}`
      const liquidMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { syrupMap: { value: syrupMap }, jamMap: { value: jamMap }, cooked: { value: 0 }, fruitTint: { value: fruitTint }, tintStrength: { value: berryMix.length ? .88 : 0 }, brush: { value: brush }, flow: { value: 0 }, phase: { value: 0 }, contact: { value: 0 } },
        vertexShader,
        fragmentShader: `${skin}uniform vec2 brush;uniform float flow;uniform float phase;uniform float contact;
          void main(){vec2 p=vUv*2.-1.;float r=length(p);if(r>.995)discard;
          float interior=1.-smoothstep(.7,.99,r);float nearby=1.-smoothstep(.12,.85,length(p-brush));
          vec2 tangent=vec2(-p.y,p.x);vec2 drag=tangent*flow*.009*(.25+nearby*.75)*interior;
          vec2 fold=vec2(sin(p.y*5.1+p.x*2.3+phase),cos(p.x*4.3-p.y*1.7-phase*.63))*min(abs(flow),1.)*.006*interior;
          vec4 glaze=preserves(vUv-drag+fold);float furrow=exp(-dot((p-brush)*vec2(7.,10.),(p-brush)*vec2(7.,10.)))*contact;
          glaze.rgb*=1.-r*r*.045-furrow*.045;gl_FragColor=vec4(glaze.rgb,glaze.a*(1.-smoothstep(.965,.995,r)));
          #include <colorspace_fragment>
        }` })
      materials.add(liquidMaterial); liquid = new THREE.Mesh(liquidGeometry, liquidMaterial); liquid.renderOrder = 4; scene.add(liquid)
      const spoonfulMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { syrupMap: { value: syrupMap }, jamMap: { value: jamMap }, cooked: { value: 1 }, fruitTint: { value: fruitTint }, tintStrength: { value: berryMix.length ? .88 : 0 } }, vertexShader,
        fragmentShader: `${skin}void main(){vec2 p=vUv*2.-1.;float r=length(p);if(r>.99)discard;vec4 glaze=preserves(.5+(vUv-.5)*.45);gl_FragColor=vec4(glaze.rgb*(1.-pow(r,3.)*.16),1.-smoothstep(.88,.99,r));
        #include <colorspace_fragment>
        }` })
      materials.add(spoonfulMaterial); spoonful = new THREE.Mesh(liquidGeometry, spoonfulMaterial); spoonful.renderOrder = 21; spoonful.visible = false; scene.add(spoonful)
      const streamMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { syrupMap: { value: syrupMap }, jamMap: { value: jamMap }, cooked: { value: 1 }, fruitTint: { value: fruitTint }, tintStrength: { value: berryMix.length ? .88 : 0 }, amount: { value: 0 }, phase: { value: 0 } }, vertexShader,
        fragmentShader: `${skin}uniform float amount;uniform float phase;void main(){float x=abs(vUv.x-.5)*2.;float width=.34+sin(vUv.y*11.+phase*2.)*.055+pow(1.-vUv.y,3.)*.15;
        float edge=1.-smoothstep(width-.12,width,x);vec4 glaze=preserves(vec2(.46+vUv.x*.09,.48+sin(vUv.y*2.-phase*.75)*.11));
        gl_FragColor=vec4(glaze.rgb,edge*smoothstep(0.,.12,vUv.y)*min(1.,amount*3.));
        #include <colorspace_fragment>
        }` })
      materials.add(streamMaterial); pourStream = new THREE.Mesh(plane, streamMaterial); pourStream.renderOrder = 21; pourStream.visible = false; scene.add(pourStream)
      const jarTexture = assets.find(value => value.name === 'jar-full')!.texture
      const jarMask = new THREE.CanvasTexture(preserveFillMask(jarTexture.image as HTMLImageElement)!)
      textures.add(jarMask)
      const jarMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { filledJar: { value: materialTexture(jarTexture,mixture,'jar') }, fillMask: { value: jarMask }, fill: { value: 0 }, fruitTint: { value: fruitTint }, tintStrength: { value: berryMix.length ? .72 : 0 } }, vertexShader,
        fragmentShader: `uniform sampler2D filledJar;uniform sampler2D fillMask;uniform float fill;uniform vec3 fruitTint;uniform float tintStrength;varying vec2 vUv;void main(){if(fill<.005)discard;vec4 jar=texture2D(filledJar,vUv);float light=dot(jar.rgb,vec3(.2126,.7152,.0722));vec3 fruit=fruitTint*(.5+light*1.7);jar.rgb=mix(jar.rgb,mix(fruit,jar.rgb,smoothstep(.55,.9,light)),tintStrength * texture2D(fillMask,vUv).a);float level=mix(.14,.78,fill);float reveal=1.-smoothstep(level-.008,level+.008,vUv.y);gl_FragColor=vec4(jar.rgb,jar.a*reveal);
        #include <colorspace_fragment>
        }` })
      materials.add(jarMaterial); jarLiquid = new THREE.Mesh(plane, jarMaterial); jarLiquid.renderOrder = 8.5; scene.add(jarLiquid)
    }
    const sugarGeometry = new THREE.BufferGeometry()
    sugarGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2200 * 3), 3)); sugarGeometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(2200), 1)); sugarGeometry.setDrawRange(0, 0)
    geometries.add(sugarGeometry)
    const sugarMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      uniforms: { pixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) } },
      vertexShader: `attribute float aSize;uniform float pixelRatio;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*pixelRatio;}`,
      fragmentShader: `void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(1.,.98,.89,(1.-r*r)*.93);}` })
    materials.add(sugarMaterial); sugar = new THREE.Points(sugarGeometry, sugarMaterial); sugar.renderOrder = 10; sugar.frustumCulled = false; scene.add(sugar)
    loaded = true; status.hidden = true; resize(); sync(); view.focus({ preventScroll: true })
  }
  const eventCanvas = renderer.domElement
  eventCanvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextLost = true; abandon(); cancelAnimationFrame(frame)
    status.hidden = false; status.textContent = 'Восстанавливаем кухонный стол…'; finish.disabled = true
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose()); renderer.dispose()
  }, { signal })
  eventCanvas.addEventListener('webglcontextrestored', () => {
    if (destroyed) return
    try { renderer = makeRenderer(eventCanvas) } catch { status.textContent = 'Не удалось восстановить стол. Вернитесь на кухню и попробуйте снова.'; return }
    textures.forEach(value => { value.needsUpdate = true })
    contextLost = false; status.hidden = loaded; if (!loaded) status.textContent = 'Открываем кухню…'
    lastTime = performance.now(); updateSugar(); resize(); sync(); frame = requestAnimationFrame(animate)
  }, { signal })
  function animate(now: number) {
    if (destroyed || contextLost) return
    if (renderer.getPixelRatio() !== Math.min(window.devicePixelRatio || 1, 2)) resize()
    const dt = Math.min(.04, Math.max(0, (now - lastTime) / 1000)); lastTime = now; elapsed += dt
    physicallySettled = !drag&&toolReturns.size===0
    for(const[key,motion]of toolReturns){for(const axis of ['x','y','width','angle'] as const)stepSpring(motion[axis],motion.target[axis],dt,{frequency:5,damping:.85});if(Math.hypot(motion.x.velocity,motion.y.velocity,motion.width.velocity)<.25&&Math.abs(motion.angle.velocity)<.01&&Math.hypot(motion.x.value-motion.target.x,motion.y.value-motion.target.y)<.25)toolReturns.delete(key)}
    if(loaded&&toolReturns.size)layoutArt()
    if (drag?.kind === 'fruit') { stepViscousFollower(heldFruit,cursor.x,cursor.y,dt,26);moveHeld(cursor) }
    for (const [id, impact] of landings) { const fruit=model.fruit.find(value=>value.id===id); if (!fruit) continue;let point={x:fruit.x,y:fruit.y};if(model.kind==='preserves'){const cooked=Math.min(1,model.stirred/model.stirRequired)*(model.processing==='chunky'?.45:model.processing==='bright'?.8:1),turn=Math.atan2(fruit.y,fruit.x)+fruitTurn,radius=Math.hypot(fruit.x,fruit.y)*(1-cooked*.12);point={x:Math.cos(turn)*radius,y:Math.sin(turn)*radius}}const target=pixel(point);stepViscousFollower(impact.follow,target.x,target.y,dt,24);stepFruitLanding(impact.body,dt);const settled=impact.body.settled&&Math.hypot(impact.follow.vx,impact.follow.vy)<.2;physicallySettled=physicallySettled&&settled;if(settled&&Math.hypot(impact.follow.x-target.x,impact.follow.y-target.y)<.02)landings.delete(id) }
    if (loaded) positionFruit()
    if (finish.disabled !== (contextLost || !loaded || !physicallySettled || !!drag)) sync()
    const stirring = drag?.kind === 'spoon' && model.stage === 'stir' && now - lastStirAt < 140
    const flowGoal = stirring ? flowTarget : 0
    flowVelocity += (flowGoal - flowVelocity) * (1 - Math.exp(-dt * (stirring ? 5 : 2.7)))
    flowPhase += flowVelocity * dt * .55
    fruitTurn += (fruitTurnTarget - fruitTurn) * (reduced.matches ? 1 : 1 - Math.exp(-dt * 5))
    brush.lerp(brushTarget, 1 - Math.exp(-dt * 8))
    if (liquid) {
      liquid.material.uniforms.cooked.value = Math.min(1, model.stirred / model.stirRequired) * (model.processing === 'chunky' ? .45 : model.processing === 'bright' ? .8 : 1)
      liquid.material.uniforms.flow.value = reduced.matches ? 0 : -flowVelocity
      liquid.material.uniforms.phase.value = reduced.matches ? 0 : -flowPhase
      liquid.material.uniforms.contact.value = stirring ? 1 : 0
      positionFruit()
    }
    if (jarLiquid) {
      jarFill += (model.scoops / 3 - jarFill) * (reduced.matches ? 1 : Math.min(1, dt * 5))
      jarLiquid.material.uniforms.fill.value = jarFill
    }
    if (spoonful) {
      spoonful.visible = drag?.kind === 'spoon' && drag.loaded
      const spoon = artwork.get('spoon')!, bowl = artPoint(spoon, .285, .745)
      spoonful.position.set(bowl.x, bowl.y, 21); spoonful.scale.set(spoon.rect.width * .125, -spoon.rect.height * .085, 1); spoonful.rotation.z = spoon.mesh.rotation.z - .77
    }
    if (pourStream) { pourStream.visible = pour > 0; pourStream.material.uniforms.amount.value = reduced.matches ? 0 : pour; pourStream.material.uniforms.phase.value = reduced.matches ? 0 : elapsed }
    pour = Math.max(0, pour - dt * 2)
    if (drag?.kind === 'shaker' || drag?.kind === 'spoon' && pour > 0) moveHeld(cursor)
    renderer.render(scene, camera); frame = requestAnimationFrame(animate)
  }
  resize(); sync()
  void loadArt().catch(error => {
    if (destroyed || error instanceof DOMException && error.name === 'AbortError') return
    status.hidden = false; status.textContent = 'Не удалось загрузить кухню. Вернитесь и попробуйте снова.'
  })
  frame = requestAnimationFrame(animate)
  return { destroy() {
    if (destroyed) return
    destroyed = true; cancelCookery(model); cancelAnimationFrame(frame); abort.abort(); observer.disconnect()
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose())
    renderer.dispose(); renderer.forceContextLoss(); scene.clear(); root.remove(); previousFocus?.focus({ preventScroll: true })
  } }
}
