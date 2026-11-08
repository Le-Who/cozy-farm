import * as THREE from 'three'
import {
  beginCookeryStroke, cancelCookery, completeCookery, cookeryParticle, cookeryProgress,
  cookeryViewport, createCookeryModel, endCookeryStroke, fillCookeryJar, inCookerySurface,
  moveCookeryStroke, placeCookeryFruit, rotateCookeryFruit, STIR_REQUIRED,
  type CookeryKind, type CookeryPoint,
} from './cookery-model'
import './cookery.css'

export type CookeryRecipe = {
  id: string; name: string; kind: CookeryKind; icon?: string;
  ingredients?: readonly { name: string; icon?: string; count?: number }[];
}
export type CookeryOptions = { recipe: CookeryRecipe; onComplete: () => boolean; onCancel: () => void }
type Ellipse = { cx: number; cy: number; rx: number; ry: number }
type Asset = { url: string; width: number; height: number; innerRimEllipse?: Ellipse; mixSurfaceEllipse?: Ellipse; foregroundUrl?: string }
type Rect = { x: number; y: number; width: number; height: number }
type Art = { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; shadow?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; asset: Asset; rect: Rect }
type Drag = { kind: 'fruit'; id: number; source: boolean } | { kind: 'spoon'; loaded: boolean } | { kind: 'shaker' }
type Fleck = { x: number; y: number; size: number; rotation: number }

/** Inventory stays in the parent. One scene owns one uncommitted recipe. */
export function createCookery(host: HTMLElement, options: CookeryOptions): { destroy(): void } {
  const model = createCookeryModel(options.recipe.kind)
  const abort = new AbortController(), signal = abort.signal
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const base = import.meta.env.BASE_URL
  const artBase = `${base}art/lavender/cookery/`
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const root = document.createElement('section')
  root.className = 'cookery-game'
  root.dataset.kind = model.kind
  root.setAttribute('aria-label', options.recipe.name)
  root.innerHTML = `<div class="cookery-view" tabindex="0" role="application" aria-label="Kitchen worktop" aria-describedby="cookery-instructions">
    <div class="cookery-heading"><span class="cookery-recipe-name"></span><div class="cookery-ingredients"></div></div>
    <button type="button" class="cookery-close" aria-label="Return to kitchen">×</button>
    <div class="cookery-source-cue" aria-hidden="true"></div><div class="cookery-tool-cue" aria-hidden="true"></div>
    <div class="cookery-caption"><p class="cookery-hint"></p><div class="cookery-progress" role="progressbar" aria-label="Preparation" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>
    <button type="button" class="cookery-finish" hidden><span>Finish</span></button>
    <div class="cookery-render-status" role="status">Opening the kitchen…</div>
    <div class="cookery-keyboard-cursor" hidden aria-hidden="true"></div>
    </div><p id="cookery-instructions" class="cookery-sr-only">Drag fruit from the dish onto the work surface. Pick up the spoon to stir, or the sugar shaker to dust the pastry. Keyboard: F selects the next fruit, S picks up the spoon or shaker. Arrow keys move it; Space picks up or puts down. Q and E rotate a placed slice. Escape returns to the kitchen. Enter finishes a prepared recipe.</p><p class="cookery-live cookery-sr-only" aria-live="polite" aria-atomic="true"></p>`
  host.append(root)
  const view = root.querySelector<HTMLElement>('.cookery-view')!
  const status = root.querySelector<HTMLElement>('.cookery-render-status')!
  const hint = root.querySelector<HTMLElement>('.cookery-hint')!
  const live = root.querySelector<HTMLElement>('.cookery-live')!
  const finish = root.querySelector<HTMLButtonElement>('.cookery-finish')!
  const close = root.querySelector<HTMLButtonElement>('.cookery-close')!
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
    if (ingredient.icon) { const image = document.createElement('img'); image.src = ingredient.icon; image.alt = ingredient.name; item.append(image) }
    else item.textContent = ingredient.name
    if (ingredient.count && ingredient.count > 1) { const count = document.createElement('b'); count.textContent = String(ingredient.count); item.append(count) }
    ingredients.append(item)
  }
  close.style.backgroundImage = `url("${base}art/lavender/workshop-authored/close-medallion.webp")`
  finish.style.backgroundImage = `url("${base}art/lavender/workshop-authored/bake-frame.webp")`
  let destroyed = false, contextLost = false, loaded = false, frame = 0
  let width = 1, height = 1, elapsed = 0, lastTime = performance.now(), renderedStage = ''
  let pointerId: number | null = null, drag: Drag | null = null, keyboard = false
  let cursor: CookeryPoint = { x: 0, y: 0 }, selectedFruit = -1, lastDust: CookeryPoint | null = null
  let surface: Ellipse = { cx: 0, cy: 0, rx: 1, ry: 1 }
  let jarFill = 0, pour = 0
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(0, 1, 0, 1, .1, 200)
  camera.position.z = 100
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>()
  const plane = new THREE.PlaneGeometry(1, 1); geometries.add(plane)
  const artwork = new Map<string, Art>(), fruitArt = new Map<number, Art>()
  const flecks: Fleck[] = []
  let liquid: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial> | null = null
  let sugar: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null
  let jarLiquid: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null
  let spoonful: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> | null = null
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
    status.textContent = 'The kitchen view could not open. Return to the kitchen and try again.'
    return { destroy() { destroyed = true; abort.abort(); plane.dispose(); root.remove(); previousFocus?.focus({ preventScroll: true }) } }
  }

  function loadTexture(url: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const texture = new THREE.TextureLoader().load(url, result => {
        if (destroyed) { result.dispose(); return }
        result.colorSpace = THREE.SRGBColorSpace; resolve(result)
      }, undefined, reject)
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
    if (drag?.kind !== 'spoon') locate(spoon, width * (portrait ? .70 : .81), height * (portrait ? .84 : compact ? .61 : .58), Math.min(width * (portrait ? .29 : .21), height * .36), -.25)
    spoon.mesh.visible = model.kind === 'preserves'
    const shaker = artwork.get('shaker')!
    if (drag?.kind !== 'shaker') locate(shaker, width * (portrait ? .86 : .85), height * (portrait ? .35 : compact ? .60 : .60), Math.min(width * (portrait ? .25 : .15), height * .32))
    shaker.mesh.visible = model.kind === 'decorate'
    for (const art of artwork.values()) if (art.shadow) art.shadow.visible = art.mesh.visible
    if (liquid) { liquid.position.set(surface.cx, surface.cy, 4); liquid.scale.set(surface.rx, -surface.ry, 1) }
    if (jarLiquid) { const r = jar.rect; jarLiquid.position.set(r.x + r.width * .5, r.y + r.height * .63, 8.5); jarLiquid.scale.set(r.width * .56, -r.height * .43, 1); jarLiquid.visible = model.kind === 'preserves' }
    if (pourStream) { const r = jar.rect; pourStream.position.set(r.x + r.width * .5, r.y + r.height * .31, 21); pourStream.scale.set(r.width * .12, -r.height * .42, 1) }
    positionFruit()
    sourceCue.style.left = `${dish.rect.x + dish.rect.width * .5}px`; sourceCue.style.top = `${dish.rect.y + dish.rect.height * .5}px`
    updateToolCue(); updateCursor()
  }
  function sourcePoint(id: number): CookeryPoint {
    const dish = artwork.get('dish')!, r = dish.rect
    const row = Math.floor(id / 3) % 2, column = id % 3
    return { x: r.x + r.width * (.28 + column * .21), y: r.y + r.height * (.46 + row * .13) }
  }
  function positionFruit() {
    const stirred = Math.min(1, model.stirred / STIR_REQUIRED)
    fruitArt.forEach((art, id) => {
      const fruit = model.fruit.find(value => value.id === id), held = drag?.kind === 'fruit' && drag.id === id
      if (held) return
      art.mesh.visible = model.kind === 'decorate' ? id < Math.min(12, Math.max(6, model.fruit.length + 2)) : true
      if (fruit) {
        let x = fruit.x, y = fruit.y
        if (model.kind === 'preserves') {
          const angle = Math.atan2(y, x) + model.stirred * .6, radius = Math.hypot(x, y) * (1 - stirred * .22)
          x = Math.cos(angle) * radius; y = Math.sin(angle) * radius
        }
        locate(art, surface.cx + x * surface.rx, surface.cy + y * surface.ry, surface.rx * (model.kind === 'preserves' ? .47 * (1 - stirred * .58) : .65), fruit.angle + (model.kind === 'preserves' ? model.stirred * .35 : 0))
        art.mesh.material.opacity = model.kind === 'preserves' ? 1 - stirred * .58 : 1
        art.mesh.position.z = model.kind === 'preserves' ? 5 : 5 + id * .01; art.mesh.renderOrder = art.mesh.position.z
      } else {
        const position = sourcePoint(id)
        locate(art, position.x, position.y, artwork.get('dish')!.rect.width * .30, (id % 3 - 1) * .12)
        art.mesh.material.opacity = 1; art.mesh.position.z = 9 + id * .01; art.mesh.renderOrder = art.mesh.position.z
      }
    })
  }
  function normalized(point: CookeryPoint): CookeryPoint { return { x: (point.x - surface.cx) / surface.rx, y: (point.y - surface.cy) / surface.ry } }
  function pixel(point: CookeryPoint): CookeryPoint { return { x: surface.cx + point.x * surface.rx, y: surface.cy + point.y * surface.ry } }
  function contains(art: Art, point: CookeryPoint, tolerance = 0) { const r = art.rect; return point.x >= r.x - tolerance && point.x <= r.x + r.width + tolerance && point.y >= r.y - tolerance && point.y <= r.y + r.height + tolerance }
  function moveHeld(point: CookeryPoint) {
    cursor = point
    if (!drag) return
    if (drag.kind === 'fruit') {
      const art = fruitArt.get(drag.id)!
      locate(art, point.x, point.y - 9, surface.rx * (model.kind === 'preserves' ? .48 : .65), model.fruit.find(value => value.id === (drag as { id: number }).id)?.angle ?? 0)
      art.mesh.position.z = 18; art.mesh.renderOrder = 18; art.mesh.material.opacity = 1
    } else {
      const art = artwork.get(drag.kind)!
      const size = drag.kind === 'spoon' ? Math.min(surface.rx * 1.05, height * .36) : Math.min(surface.rx * .65, height * .25)
      locate(art, point.x + (drag.kind === 'spoon' ? size * .24 : size * .15), point.y - size * .28, size, drag.kind === 'spoon' ? -.55 : -.4 + Math.sin(elapsed * 20) * (reduced.matches ? 0 : .06))
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
      fruit: model.kind === 'preserves' ? 'Drop the fruit into the copper pot' : 'Arrange fruit just as you like',
      stir: 'Pick up the spoon and stir in circles', fill: 'Scoop from the pot into the jar',
      sprinkle: 'Sweep the sugar over your pastry', ready: '',
      committing: 'Serving…', finished: '', cancelled: '',
    }
    hint.textContent = messages[model.stage] ?? ''
    if (changed) announce(model.stage === 'ready' ? 'Recipe prepared. Finish when you are happy with it.' : hint.textContent)
    const value = Math.round(cookeryProgress(model) * 100)
    progress.setAttribute('aria-valuenow', String(value)); progressFill.style.width = `${value}%`
    progress.hidden = model.stage === 'ready' || model.stage === 'finished'
    finish.hidden = model.stage !== 'ready' && model.stage !== 'finished'; finish.disabled = contextLost || !loaded
    finish.querySelector('span')!.textContent = model.stage === 'finished' ? 'Return to kitchen' : model.kind === 'preserves' ? 'Jar' : 'Finish'
    sourceCue.hidden = model.stage !== 'fruit' || !!drag
    updateToolCue()
  }
  function doFinish() {
    if (contextLost || destroyed || !loaded) return
    if (model.stage === 'finished') { options.onCancel(); return }
    try {
      if (!completeCookery(model, options.onComplete) && model.stage === 'ready') announce('The ingredients are no longer available. Return to the kitchen to choose a recipe.')
    } catch { announce('The recipe could not be saved. You can try finishing again.') }
    sync()
  }
  finish.addEventListener('click', doFinish, { signal })

  function start(point: CookeryPoint) {
    if (!loaded || contextLost || destroyed || ['committing', 'finished', 'cancelled'].includes(model.stage)) return
    cursor = point; lastDust = null
    const canFruit = model.stage === 'fruit' || model.kind === 'decorate'
    if (canFruit) {
      const ordered = [...fruitArt].reverse()
      for (const [id, art] of ordered) {
        if (!art.mesh.visible || !contains(art, point, 6)) continue
        const placed = model.fruit.some(fruit => fruit.id === id)
        if (placed && Math.hypot((point.x - (art.rect.x + art.rect.width / 2)) / (art.rect.width / 2), (point.y - (art.rect.y + art.rect.height / 2)) / (art.rect.height / 2)) > 1.1) continue
        drag = { kind: 'fruit', id, source: !placed }; selectedFruit = id; moveHeld(point); sync(); return
      }
    }
    if (model.kind === 'preserves' && ['stir', 'fill'].includes(model.stage) && (contains(artwork.get('spoon')!, point, 8) || inCookerySurface(normalized(point)))) {
      drag = { kind: 'spoon', loaded: model.stage === 'fill' && inCookerySurface(normalized(point)) }
    } else if (model.kind === 'decorate' && ['sprinkle', 'ready'].includes(model.stage) && contains(artwork.get('shaker')!, point, 8)) drag = { kind: 'shaker' }
    if (drag) { beginCookeryStroke(model, normalized(point)); moveHeld(point); sync() }
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
      if (model.stage === 'stir') { moveCookeryStroke(model, normalizedPoint); positionFruit() }
      if (model.stage === 'fill') {
        if (inCookerySurface(normalizedPoint, .85)) drag.loaded = true
        if (drag.loaded && contains(artwork.get('jar')!, point, 0)) {
          fillCookeryJar(model); drag.loaded = false; pour = 1
          announce(model.scoops >= 3 ? 'The jar is full. Your preserves are ready.' : 'A spoonful in the jar')
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
    if (drag.kind === 'fruit') {
      if (placeCookeryFruit(model, drag.id, normalized(cursor))) announce(model.kind === 'preserves' ? 'Fruit added to the pot' : 'Fruit arranged on the pastry')
    }
    drag = null; lastDust = null; endCookeryStroke(model); layoutArt(); sync()
  }
  function eventPoint(event: PointerEvent): CookeryPoint { const bounds = view.getBoundingClientRect(); return { x: event.clientX - bounds.left, y: event.clientY - bounds.top } }
  view.addEventListener('pointerdown', event => {
    if ((event.target as HTMLElement).closest('button') || pointerId !== null || event.button !== 0) return
    keyboard = false; pointerId = event.pointerId; view.setPointerCapture(event.pointerId); view.focus({ preventScroll: true }); start(eventPoint(event)); updateCursor()
  }, { signal })
  view.addEventListener('pointermove', event => {
    if (pointerId !== event.pointerId) return
    const samples = event.getCoalescedEvents?.()
    for (const sample of samples?.length ? samples : [event]) move(eventPoint(sample))
  }, { signal })
  view.addEventListener('pointerup', event => { if (event.pointerId === pointerId) { move(eventPoint(event)); release(); pointerId = null; if (view.hasPointerCapture(event.pointerId)) view.releasePointerCapture(event.pointerId) } }, { signal })
  const abandon = () => { drag = null; pointerId = null; lastDust = null; endCookeryStroke(model); layoutArt(); sync() }
  view.addEventListener('pointercancel', abandon, { signal }); view.addEventListener('lostpointercapture', () => { if (pointerId !== null) abandon() }, { signal })
  window.addEventListener('blur', abandon, { signal })
  view.addEventListener('keydown', event => {
    if ((event.target as HTMLElement).closest('button')) return
    if (event.key === 'Escape') { event.preventDefault(); cancel(); return }
    if (!loaded || contextLost) return
    const key = event.key.toLowerCase()
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
    const names = ['room', 'room-portrait', 'pot', 'tart', 'jar', 'spoon', 'shaker', 'dish', 'apple-slice', 'apple-piece', 'pear-piece']
    const assets = await Promise.all(names.map(async name => {
      const asset = manifest.items[name]
      if (!asset) throw new Error(`Missing kitchen art: ${name}`)
      return { name, asset, texture: await loadTexture(resolveUrl(asset.url)) }
    }))
    if (destroyed) return
    for (const { name, asset, texture } of assets) {
      if (name === 'apple-slice' || name === 'apple-piece' || name === 'pear-piece') continue
      const z = name.startsWith('room') ? -10 : name === 'pot' || name === 'tart' ? 3 : name === 'dish' ? 8 : name === 'jar' ? 8 : 15
      addArt(name, asset, texture, z)
    }
    artwork.get(model.kind === 'preserves' ? 'tart' : 'pot')!.mesh.visible = false
    for (let id = 0; id < (model.kind === 'decorate' ? 12 : model.fruitRequired); id++) {
      const name = model.kind === 'decorate' ? 'apple-slice' : options.recipe.id === 'orchardPreserves' && id % 2 ? 'pear-piece' : 'apple-piece'
      const value = assets.find(asset => asset.name === name)!
      fruitArt.set(id, addArt(`fruit-${id}`, value.asset, value.texture, 9))
    }
    const pot = manifest.items.pot
    if (model.kind === 'preserves' && pot.foregroundUrl) {
      const texture = await loadTexture(resolveUrl(pot.foregroundUrl)); if (destroyed) return
      addArt('pot-front', pot, texture, 6)
    }
    const liquidMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { time: { value: 0 }, stirred: { value: 0 }, stirring: { value: 0 } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv;uniform float time;uniform float stirred;uniform float stirring;
        void main(){vec2 p=vUv*2.-1.;float r=length(p);if(r>.99)discard;float a=atan(p.y,p.x);float swirl=sin(a*3.+r*23.-time*(.6+stirring*2.));
        vec3 amber=mix(vec3(.78,.245,.012),vec3(.54,.105,.006),stirred*.65);float light=(1.-r)*.026+swirl*.009;
        float ribbon=pow(max(0.,sin(a*2.+r*17.-time*.55)),28.)*.065;float bubble=pow(max(0.,sin(p.x*75.+time)*sin(p.y*67.-time*.4)),25.)*smoothstep(.5,.96,r)*.11;
        gl_FragColor=vec4(amber+light*vec3(1.,.5,.05)+vec3(1.,.64,.18)*(ribbon+bubble),smoothstep(.995,.95,r)*.97);
        #include <colorspace_fragment>
      }` })
    materials.add(liquidMaterial)
    const liquidGeometry = new THREE.CircleGeometry(1, 96); geometries.add(liquidGeometry)
    liquid = new THREE.Mesh(liquidGeometry, liquidMaterial); liquid.renderOrder = 4; liquid.visible = model.kind === 'preserves'; scene.add(liquid)
    const spoonfulMaterial = new THREE.MeshBasicMaterial({ color: '#f5a02d', transparent: true, opacity: .94, depthWrite: false, side: THREE.DoubleSide })
    materials.add(spoonfulMaterial); spoonful = new THREE.Mesh(liquidGeometry, spoonfulMaterial); spoonful.renderOrder = 21; spoonful.visible = false; scene.add(spoonful)
    const streamMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { amount: { value: 0 } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv;uniform float amount;void main(){float w=.38+.08*sin(vUv.y*14.+amount*12.);float a=(1.-smoothstep(w-.15,w,abs(vUv.x-.5)))*smoothstep(0.,.12,vUv.y)*amount;gl_FragColor=vec4(1.,.62,.14,a);}` })
    materials.add(streamMaterial); pourStream = new THREE.Mesh(plane, streamMaterial); pourStream.renderOrder = 21; pourStream.visible = false; scene.add(pourStream)
    const jarMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { fill: { value: 0 }, time: { value: 0 } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv;uniform float fill;uniform float time;void main(){float top=fill*.92;float x=abs(vUv.x-.5)*2.;
      if(vUv.y>top+sin(vUv.x*9.+time*2.)*.008||x>.97||fill<.01)discard;
      if(vUv.y<.13&&length(vec2((vUv.x-.5)/.5,(vUv.y-.13)/.13))>1.)discard;
      float edge=smoothstep(.99,.86,x);float gleam=pow(max(0.,1.-abs(vUv.x-.16)*13.),4.)*.22;
      gl_FragColor=vec4(vec3(.73,.23,.018)+vec3(.16,.09,.02)*(1.-x)+gleam,edge*.84);
      #include <colorspace_fragment>
      }` })
    materials.add(jarMaterial); jarLiquid = new THREE.Mesh(plane, jarMaterial); jarLiquid.renderOrder = 8.5; scene.add(jarLiquid)
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
    status.hidden = false; status.textContent = 'The kitchen view is paused. Restoring your work…'; finish.disabled = true
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose()); renderer.dispose()
  }, { signal })
  eventCanvas.addEventListener('webglcontextrestored', () => {
    if (destroyed) return
    try { renderer = makeRenderer(eventCanvas) } catch { status.textContent = 'The kitchen view could not restore. Return to the kitchen and try again.'; return }
    textures.forEach(value => { value.needsUpdate = true })
    contextLost = false; status.hidden = loaded; if (!loaded) status.textContent = 'Opening the kitchen…'
    lastTime = performance.now(); updateSugar(); resize(); sync(); frame = requestAnimationFrame(animate)
  }, { signal })
  function animate(now: number) {
    if (destroyed || contextLost) return
    if (renderer.getPixelRatio() !== Math.min(window.devicePixelRatio || 1, 2)) resize()
    const dt = Math.min(.04, Math.max(0, (now - lastTime) / 1000)); lastTime = now; elapsed += dt
    if (liquid) {
      liquid.material.uniforms.time.value = reduced.matches ? 0 : elapsed
      liquid.material.uniforms.stirred.value = model.stirred / STIR_REQUIRED
      liquid.material.uniforms.stirring.value = drag?.kind === 'spoon' && model.stage === 'stir' ? 1 : 0
    }
    if (jarLiquid) {
      jarFill += (model.scoops / 3 - jarFill) * (reduced.matches ? 1 : Math.min(1, dt * 5))
      jarLiquid.material.uniforms.fill.value = jarFill; jarLiquid.material.uniforms.time.value = reduced.matches ? 0 : elapsed
    }
    if (spoonful) {
      spoonful.visible = drag?.kind === 'spoon' && drag.loaded
      spoonful.position.set(cursor.x, cursor.y - 3, 21); spoonful.scale.set(surface.rx * .11, -surface.ry * .12, 1)
    }
    if (pourStream) { pourStream.visible = pour > 0; pourStream.material.uniforms.amount.value = reduced.matches ? 0 : pour }
    pour = Math.max(0, pour - dt * 2)
    if (drag?.kind === 'shaker') moveHeld(cursor)
    renderer.render(scene, camera); frame = requestAnimationFrame(animate)
  }
  resize(); sync()
  void loadArt().catch(error => {
    if (destroyed || error instanceof DOMException && error.name === 'AbortError') return
    status.hidden = false; status.textContent = 'The kitchen artwork could not open. Return to the kitchen and try again.'
  })
  frame = requestAnimationFrame(animate)
  return { destroy() {
    if (destroyed) return
    destroyed = true; cancelCookery(model); cancelAnimationFrame(frame); abort.abort(); observer.disconnect()
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose())
    renderer.dispose(); renderer.forceContextLoss(); scene.clear(); root.remove(); previousFocus?.focus({ preventScroll: true })
  } }
}
