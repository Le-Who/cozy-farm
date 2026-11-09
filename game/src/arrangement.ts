import { playBaySound, prepareBaySoundScene } from './game-sound'
import * as THREE from 'three'
import { createArrangementPhysics, type ArrangementMode } from './arrangement-physics'
import { createArrangementProps } from './arrangement-props'
import type { FoodDescriptor } from './intent-orders'
import type { NeighborAssembly } from './neighbor-plans'
import type { PackingResult } from './farm'
import './arrangement.css'

export type ArrangementOptions = {
  mode: ArrangementMode; title: string; food?: FoodDescriptor;
  onComplete: (result: NeighborAssembly | PackingResult) => boolean; onCancel: () => void;
}
type Physics = Awaited<ReturnType<typeof createArrangementPhysics>>
type Props = Awaited<ReturnType<typeof createArrangementProps>>

/** A scene is a draft. Only a settled arrangement may cross the inventory boundary. */
export function createArrangement(host: HTMLElement, options: ArrangementOptions): { destroy(): void } {
  const abort = new AbortController(), signal = abort.signal, previousFocus = document.activeElement
  prepareBaySoundScene(['cook.table-ceramic','cook.table-food','cook.basket-place','cook.egg-place','cook.finish'], signal)
  const root = document.createElement('section'); root.className = 'arrangement-game'; root.dataset.mode = options.mode
  root.innerHTML = `<div class="arrangement-view" tabindex="0" role="application" aria-label="${options.mode === 'table' ? 'Сервировка стола' : 'Сбор корзинки'}" aria-describedby="assembly-controls"><img class="arrangement-room" alt="" fetchpriority="high" decoding="async"><h2 class="arrangement-title"></h2><button type="button" class="arrangement-close" aria-label="Вернуться">×</button><ul class="arrangement-checklist" aria-label="Для укладки"></ul><button type="button" class="arrangement-finish" disabled>Готово</button><div class="arrangement-status" role="status">Накрываем стол…</div><p class="arrangement-sr" id="assembly-controls">Перенесите предметы на салфетку или в корзинку. Берите за любую часть и отпускайте, когда предмет окажется на месте. Колесо мыши или Q и E поворачивают взятый предмет. Клавиатура: цифры от 1 до 5 выбирают предмет, пробел берёт и отпускает, стрелки перемещают, Enter завершает готовую сервировку, Escape возвращается.</p><p class="arrangement-sr" aria-live="polite"></p></div>`
  root.querySelector('h2')!.textContent = options.title; host.append(root)
  const view = root.querySelector<HTMLElement>('.arrangement-view')!, status = root.querySelector<HTMLElement>('.arrangement-status')!, finish = root.querySelector<HTMLButtonElement>('.arrangement-finish')!, live = root.querySelector<HTMLElement>('[aria-live]')!
  const room = root.querySelector<HTMLImageElement>('.arrangement-room')!
  const base = import.meta.env.BASE_URL, reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 60)
  camera.position.set(0, 7.8, 8); camera.lookAt(0, 0, 0)
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), hit = new THREE.Vector3(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2)
  const selectionGeometry = new THREE.TorusGeometry(.36, .014, 6, 80), selectionMaterial = new THREE.MeshBasicMaterial({ color: '#e9ca79', transparent: true, opacity: .72, depthWrite: false })
  const selection = new THREE.Mesh(selectionGeometry, selectionMaterial); selection.rotation.x = -Math.PI / 2; selection.visible = false; scene.add(selection)
  let renderer: THREE.WebGLRenderer, destroyed = false, loaded = false, lost = false, committed = false
  let physics: Physics | undefined, props: Props | undefined, animation = 0, previousTime = 0, width = 1, height = 1, focused = 0
  let activePointer: number | undefined, hovered = '', heldHeight = 1.4
  const pointers = new Map<number, { x: number; y: number }>(); let pinchAngle: number | undefined
  const keyboardPoint = new THREE.Vector3()
  const portraitSetup = view.clientWidth / Math.max(1, view.clientHeight) < .85
  function makeRenderer(canvas?: HTMLCanvasElement) {
    const next = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); next.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); next.outputColorSpace = THREE.SRGBColorSpace
    next.toneMapping = THREE.ACESFilmicToneMapping; next.toneMappingExposure = 1.1; next.domElement.setAttribute('aria-hidden', 'true'); return next
  }
  const cancel = () => { if (!destroyed) options.onCancel() }
  root.querySelector('.arrangement-close')!.addEventListener('click', cancel, { signal })
  try { renderer = makeRenderer(); view.prepend(renderer.domElement) } catch {
    status.textContent = 'Не удалось открыть стол. Вернитесь и попробуйте снова.'
    return { destroy() { destroyed = true; abort.abort(); selectionGeometry.dispose(); selectionMaterial.dispose(); root.remove() } }
  }
  function wake() {
    if (!animation && !destroyed && loaded && !lost && !document.hidden) animation = requestAnimationFrame(frame)
  }
  function layout() {
    const rect = view.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height)
    root.dataset.portrait = String(width / height < .85); root.dataset.compact = String(height < 480)
    view.style.setProperty('--assembly-room', `url("${base}art/lavender/${width / height < .85 ? 'assembly/room-portrait' : 'cookery/room'}.webp")`)
    const nextRoom = base + 'art/lavender/' + (width / height < .85 ? 'assembly/room-portrait.webp' : 'cookery/room.webp')
    if (room.getAttribute('src') !== nextRoom) room.src = nextRoom
    renderer.setSize(width, height, false)
    // Fit the complete physical workspace in usable CSS pixels, preserving object proportions.
    const aspect = width / height
    const pitch = THREE.MathUtils.degToRad(40)
    // Frame the tabletop relative to the painted rear edge. Only the receiving plane is transparent.
    const portrait = aspect < .85
    const roomAspect = portrait ? 941 / 1672 : 1.5
    const roomHeight = Math.max(height, width / roomAspect)
    const horizon = (height - roomHeight) / 2 + roomHeight * (portrait ? .495 : .445)
    const surfaceTop = Math.max(height * .22, horizon)
    const surfaceHeight = height - surfaceTop
    const workspaceWidth = portraitSetup && portrait ? 3.58 : 4.65
    const span = Math.min(width / workspaceWidth, surfaceHeight / (options.mode === 'table' ? 1.98 : options.mode === 'basket' ? 2.75 : 2.16))
    const halfH = height / (2 * span)
    const origin = surfaceTop + surfaceHeight * .57
    const shift = (origin / height - .5) * 2 * halfH
    camera.left = -halfH * aspect; camera.right = halfH * aspect
    camera.top = halfH + shift; camera.bottom = -halfH + shift
    camera.position.set(0, 10 * Math.sin(pitch), 10 * Math.cos(pitch))
    camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(); wake()

  }
  function pointerRay(x: number, y: number) { const rect = view.getBoundingClientRect(); pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera) }
  function pieceAt(x: number, y: number) {
    if (!props) return
    pointerRay(x, y); scene.updateMatrixWorld(true)
    const hits = ray.intersectObjects(props.pieces.map(piece => piece.mesh), true)
    for (const intersection of hits) {
      let node: THREE.Object3D | null = intersection.object
      while (node && !node.userData.pieceId) node = node.parent
      if (node) return { id: node.userData.pieceId as string, point: intersection.point }
    }
  }
  const gripOffset = new THREE.Vector2()
  function drag(x: number, y: number) {
    if (activePointer === undefined || !physics?.heldId()) return
    pointerRay(x, y); plane.constant = -heldHeight
    if (ray.ray.intersectPlane(plane, hit)) physics.followPointer({ x: hit.x + gripOffset.x, y: heldHeight, z: hit.z + gripOffset.y })
  }
  function release() { physics?.release(); activePointer = undefined; pinchAngle = undefined; selection.visible = false; view.style.cursor = '' }
  view.addEventListener('pointerdown', event => {
    if ((event.target as HTMLElement).closest('button') || !loaded || lost || committed) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); view.setPointerCapture(event.pointerId)
    if (activePointer !== undefined) return
    const selected = pieceAt(event.clientX, event.clientY); if (!selected || !physics) return
    const pose = physics.poses().find(item => item.id === selected.id)
    if (!pose || !physics.takePointer(selected.id)) return
    heldHeight = pose.position.y
    plane.constant = -heldHeight
    ray.ray.intersectPlane(plane, hit)
    gripOffset.set(pose.position.x - hit.x, pose.position.z - hit.z)
    event.preventDefault(); view.focus({ preventScroll: true }); activePointer = event.pointerId
    focused = props!.pieces.findIndex(piece => piece.id === selected.id); hovered = selected.id; drag(event.clientX, event.clientY); view.style.cursor = 'grabbing'
  }, { signal })
  view.addEventListener('pointermove', event => {
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size > 1 && physics?.heldId()) {
      const [a, b] = [...pointers.values()], angle = Math.atan2(b.y - a.y, b.x - a.x)
      if (pinchAngle !== undefined) physics.rotate(Math.atan2(Math.sin(angle - pinchAngle), Math.cos(angle - pinchAngle)) * 2)
      pinchAngle = angle
    }
    if (event.pointerId === activePointer) drag(event.clientX, event.clientY)
    else if (activePointer === undefined && loaded) { hovered = pieceAt(event.clientX, event.clientY)?.id ?? ''; view.style.cursor = hovered ? 'grab' : '' }
  }, { signal })
  const endPointer = (event: PointerEvent) => { pointers.delete(event.pointerId); if (event.pointerId === activePointer) release(); if (pointers.size < 2) pinchAngle = undefined }
  view.addEventListener('pointerup', endPointer, { signal }); view.addEventListener('pointercancel', endPointer, { signal }); view.addEventListener('lostpointercapture', endPointer, { signal })
  view.addEventListener('wheel', event => { if (!physics?.heldId()) return; event.preventDefault(); physics.rotate(Math.sign(event.deltaY) * .085) }, { passive: false, signal })
  view.addEventListener('keydown', event => {
    if ((event.target as HTMLElement).closest('button')) return
    if (event.key === 'Escape') { event.preventDefault(); cancel(); return }
    if (!loaded || committed || lost || !physics || !props) return
    if (/^[1-5]$/.test(event.key) && !physics.heldId()) { event.preventDefault(); focused = Math.min(props.pieces.length - 1, Number(event.key) - 1); hovered = props.pieces[focused].id; live.textContent = `${options.mode === 'eggs' || options.mode === 'crate' ? 'Яйцо' : ['Угощение', 'Чашка', options.mode === 'table' ? 'Цветы' : 'Салфетка'][focused]} ${focused + 1}` }
    else if (event.key === ' ') {
      event.preventDefault()
      if (physics.heldId()) release()
      else { const pose = physics.poses()[focused]; if (pose) { physics.grab(pose.id, { ...pose.position, y: pose.position.y + props.pieces[focused].half.y }); keyboardPoint.set(pose.position.x, 1.4, pose.position.z); physics.move(keyboardPoint) } }
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); if (!physics.heldId()) return
      keyboardPoint.x += event.key === 'ArrowLeft' ? -.12 : event.key === 'ArrowRight' ? .12 : 0; keyboardPoint.z += event.key === 'ArrowUp' ? -.12 : event.key === 'ArrowDown' ? .12 : 0; physics.move(keyboardPoint)
    } else if (event.key.toLowerCase() === 'q' || event.key.toLowerCase() === 'e') { event.preventDefault(); physics.rotate(event.key.toLowerCase() === 'q' ? -.12 : .12) }
    else if (event.key === 'Enter' && !finish.hidden) { event.preventDefault(); finish.click() }
  }, { signal })
  finish.addEventListener('click', () => {
    if (committed || !physics || lost) return
    const points = physics.result(); if (!points) return
    const packing = options.mode === 'eggs' || options.mode === 'crate'
    const result: NeighborAssembly | PackingResult = packing ? { kind: options.mode === 'crate' ? 'crate' : 'basket', placements: points.map(({ x, y }) => ({ x, y })), settled: true }
      : { kind: options.mode as 'table' | 'basket', placements: points.map(({ slot, x, y }) => ({ slot: slot as 'food' | 'cup' | 'flowers', x, y })), settled: true }
    if (options.onComplete(result)) { committed = true; playBaySound('cook.finish'); finish.hidden = true; live.textContent = 'Готово' }
    else { status.textContent = 'Не хватает угощения. Вернитесь к рецепту.'; status.hidden = false }
  }, { signal })
  const checklist = root.querySelector<HTMLUListElement>('.arrangement-checklist')!
  const badges = new Map<string, HTMLLIElement>()
  const contacts = new Map<string, THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>>()
  const facing = new THREE.Quaternion(), parentRotation = new THREE.Quaternion()
  const eggAxis = new THREE.Vector3(), viewRotation = new THREE.Quaternion()
  function faceCamera(node: THREE.Object3D) {
    if (!node.userData.billboard || !node.parent) return
    node.parent.getWorldQuaternion(parentRotation)
    node.quaternion.copy(facing.copy(parentRotation).invert().multiply(camera.quaternion))
  }
  const resize = new ResizeObserver(layout); resize.observe(view); layout()
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; release(); finish.disabled = true; status.textContent = 'Возвращаем стол…'; status.hidden = false }, { signal })
  renderer.domElement.addEventListener('webglcontextrestored', () => { lost = false; renderer.resetState(); layout(); status.hidden = loaded; finish.disabled = false }, { signal })
  for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture', 'wheel', 'keydown', 'focusin', 'focusout']) {
    view.addEventListener(name, wake, { capture: true, signal })
  }
  document.addEventListener('visibilitychange', () => { previousTime = 0; if (document.hidden) release(); else wake() }, { signal })
  Promise.resolve(createArrangementProps(options.mode, options.food)).then(async result => {
    if (destroyed) { result.dispose(); return }
    props = result; scene.add(result.target)
    const count = result.pieces.length
    const definitions = result.pieces.map((piece, i) => {
      const packedEggs = options.mode === 'eggs' || options.mode === 'crate'
      const positions = options.mode === 'table'
        ? portraitSetup ? [[-.75, 1.10], [1.18, -.48], [-.8, -.98]] : [[-1.63, .22], [1.38, -.36], [-.78, -.87]]
        : portraitSetup ? [[-1.04, 1.50], [.95, 1.4], [0, 1.58]] : [[-1.76, 1.05], [1.69, .98], [-.2, 1.42]]
      const rowZ = options.mode === 'crate' ? .78 : 1.22
      const [x, z] = packedEggs ? [(i - (count - 1) / 2) * .55, rowZ + (i % 2) * .10] : positions[i]
      const badge = document.createElement('li')
      const label = piece.slot === 'food' ? options.food?.name ?? 'Угощение' : piece.slot === 'cup' ? 'Чашка' : piece.slot === 'egg' ? 'Яйцо ' + (i+1) : options.mode === 'table' ? 'Цветы' : 'Салфетка'
      badge.title = label; badge.setAttribute('aria-label', label)
      piece.mesh.traverse(node => {
        if (!node.userData.rasterArt || badge.childElementCount || !(node instanceof THREE.Mesh)) return
        const image = node.material.map?.image
        if (!image) return
        const thumb = document.createElement('canvas'); thumb.width = thumb.height = 72
        const scale = 66 / Math.max(image.width, image.height)
        thumb.getContext('2d')?.drawImage(image,(72-image.width*scale)/2,(72-image.height*scale)/2,image.width*scale,image.height*scale)
        badge.append(thumb)
      })
      checklist.append(badge); badges.set(piece.id,badge)
      piece.mesh.userData.pieceId = piece.id; scene.add(piece.mesh)
      piece.mesh.traverse(node => { if (node.userData.billboard) node.castShadow = false })
      const contact = new THREE.Mesh(new THREE.PlaneGeometry(piece.half.x * 2.3, piece.half.z * 2.35), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, uniforms: { intensity: { value: .23 } },
        vertexShader: 'varying vec2 st;void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: 'varying vec2 st;uniform float intensity;void main(){float d=length(st*2.-1.);gl_FragColor=vec4(.28,.13,.085,intensity*(1.-smoothstep(.12,1.,d)));}'
      })); contact.rotation.x = -Math.PI/2; contact.renderOrder = 4; scene.add(contact); contacts.set(piece.id, contact)
      return { id: piece.id, slot: piece.slot, position: { x, y: piece.half.y + .06, z }, half: piece.half, vertices: piece.vertices, mass: piece.mass }
    })
    const physical = await createArrangementPhysics(options.mode, definitions)
    if (destroyed) { physical.dispose(); return }
    physics = physical
    while (!destroyed) {
      const source = room.src
      try { await room.decode() }
      catch (error) { if (room.src === source) throw error }
      if (room.src === source) break
    }
    if (destroyed) return
    loaded = true; status.hidden = true; view.focus({ preventScroll: true }); wake()
  }).catch(() => { if (!destroyed) { status.textContent = 'Не удалось накрыть стол. Вернитесь и попробуйте снова.'; status.hidden = false } })
  function frame(time: number) {
    if (destroyed) return
    animation = 0
    const dt = previousTime ? Math.min(.05, (time - previousTime) / 1000) : 1 / 60; previousTime = time
    if (!document.hidden && !lost) {
      for (const impact of physics?.step(dt) ?? []) {
        const slot=props?.pieces.find(piece=>piece.id===impact.id)?.slot
        const sound=slot==='egg'?'cook.egg-place':options.mode!=='table'?'cook.basket-place':slot==='food'?'cook.table-food':'cook.table-ceramic'
        if(loaded)playBaySound(sound,Math.max(.2,impact.strength)*.75,140)
      }
      if (props && physics) {
        const poses = physics.poses()
        for (const pose of poses) {
          const piece = props.pieces.find(value => value.id === pose.id)!
          piece.mesh.position.copy(pose.position); piece.mesh.quaternion.copy(pose.rotation)
          const held = physics.heldId() === pose.id
          const beforeRim = pose.position.z > physics.target.rz || held
          piece.mesh.traverse(node => {
            faceCamera(node)
            if (node.userData.billboard) {
              if (piece.slot === 'egg') {
                eggAxis.set(0, 1, 0).applyQuaternion(piece.mesh.quaternion).applyQuaternion(viewRotation.copy(camera.quaternion).invert())
                node.rotateZ(Math.atan2(-eggAxis.x, eggAxis.y))
                node.scale.y = .74 + .26 * Math.hypot(eggAxis.x, eggAxis.y)
              } else {
                const twist = 2 * Math.atan2(pose.rotation.y, pose.rotation.w)
                node.rotateZ(Math.sin(twist) * (held ? .14 : .07))
              }
            }
            if (node.userData.rasterArt) node.renderOrder = (beforeRim ? 45 : 10) + pose.position.z
          })
          const contact = contacts.get(piece.id)!
          const onMat = (pose.position.x / physics.target.rx) ** 2 + (pose.position.z / physics.target.rz) ** 2 < 1
          contact.position.set(pose.position.x, onMat ? .121 : .008, pose.position.z)
          const lift = Math.max(0, pose.position.y - piece.half.y - contact.position.y)
          contact.scale.setScalar(1 + lift * .30)
          contact.material.uniforms.intensity.value = .26 / (1 + lift * 2)
        }
        props.target.traverse(faceCamera)
        const selected = poses.find(pose => pose.id === hovered && view.matches(':focus-visible') && !physics!.heldId())
        selection.visible = !!selected && !committed; if (selected) { selection.position.set(selected.position.x, .12, selected.position.z); const piece = props.pieces.find(value => value.id === selected.id)!; selection.scale.set(piece.half.x * 2.8, piece.half.z * 2.8, 1); selectionMaterial.opacity = reduced.matches ? .65 : .60 + Math.sin(time / 430) * .06 }
        const proof = physics.result(), items = physics.progress()
        finish.hidden = committed
        finish.disabled = !proof
        for (const item of items) {
          const badge = badges.get(item.id)!
          if (badge.dataset.placed !== String(item.placed)) {
            badge.dataset.placed = String(item.placed)
            badge.setAttribute('aria-label', badge.title + (item.placed ? ' — на месте' : ' — положите на место'))
          }
        }
        const count = items.filter(item => item.placed).length
        const label = proof ? 'Готово' : count === items.length ? 'Укладывается…' : (options.mode === 'table' ? 'На салфетке' : options.mode === 'crate' ? 'В ящике' : 'В корзине') + ' · ' + count + '/' + items.length
        if (finish.textContent !== label) { finish.textContent = label; live.textContent = label }
        const selectedItem = items.find(item => item.id === physics!.heldId())
        root.dataset.overTarget = String(!!selectedItem?.inside)
      }
      renderer.render(scene, camera)
      if (physics && !physics.resting()) wake()
      else previousTime = 0
    }
  }
  return { destroy() {
    if (destroyed) return; destroyed = true; cancelAnimationFrame(animation); abort.abort(); resize.disconnect(); physics?.dispose(); for (const contact of contacts.values()) { contact.material.dispose(); contact.geometry.dispose() }; props?.dispose(); renderer.dispose(); selectionGeometry.dispose(); selectionMaterial.dispose(); root.remove(); if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
  } }
}
