import * as THREE from 'three';
import {
  castFishing, createFishingModel, fishPosition, fishingDepth, fishingHalfWidth,
  fishingCatchLoot, fishingCatchScale, fishingCatchMouth, reelFishing, stepFishing, type FishingLoot,
} from './fishing-model';
import './fishing.css';

export type FishingGameOptions = {
  capacity: number;
  maxDepth: number;
  resilience?: number;
  seed?: number;
  fish: 'perch' | 'seaBass';
  onCast?: () => boolean | void;
  /** Return false when the cast used the last available attempt. */
  onFinish: (result: { count: number; depth: number; catches: FishingLoot[] }) => boolean | void;
  onAgain?: () => void;
  onCancel?: () => void;
};

function lootName(loot: FishingLoot): string {
  return loot.kind === 'fish' ? ({ perch: 'Perch', seaBass: 'Sea bass', moonfish: 'Moonfish', lanternfish: 'Lanternfish' })[loot.species]
    : loot.kind === 'shell' ? loot.variant === 'moon' ? 'Moon shell' : 'Seashell'
      : ({ boot: 'Old boot', weed: 'Tangled weed', rock: 'Smooth rock' })[loot.item];
}

function lootArt(loot: FishingLoot): string {
  const name = loot.kind === 'fish' && (loot.species === 'perch' || loot.species === 'seaBass')
    ? loot.species === 'seaBass' ? 'fishing-sea-bass-v1.png' : 'fishing-perch-v1.png'
    : `fishing-depth/${loot.kind === 'fish' ? loot.species : loot.kind === 'shell' ? 'shell' : loot.item}.webp`;
  return `${import.meta.env.BASE_URL}art/lavender/${name}`;
}

type FishingBackgroundArt = { id: string; url: string; width: number; height: number; viewportAspect: number };

/** One uniform cover scale preserves the artwork's original proportions. */
export function fishingBackgroundCover(width: number, height: number, aspect: number): { scale: number; overflowX: number; overflowY: number } {
  const scale = Math.max(height, width / aspect) * 1.06;
  return { scale, overflowX: Math.max(0, (scale * aspect - width) / 2), overflowY: Math.max(0, (scale - height) / 2) };
}

/** Owns one cast and its renderer; rewards remain the caller's responsibility. */
export function createFishingGame(host: HTMLElement, options: FishingGameOptions): { destroy(): void } {
  const model = createFishingModel(options.capacity, options.resilience, options.seed ?? Date.now(), options.fish);
  const maxDepth = Math.max(1, Number.isFinite(options.maxDepth) ? options.maxDepth : 30);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.createElement('section');
  root.className = 'fishing-game';
  root.dataset.phase = model.phase;
  root.setAttribute('aria-label', 'Underwater fishing');
  root.innerHTML = `
    <div class="fishing-stage" tabindex="0" role="application" aria-label="Steer the hook with left and right arrow keys or drag. Space casts, then reels in early.">
      <div class="fishing-hud">
        <div class="fishing-depth"><span class="fishing-direction" aria-hidden="true">↓</span><strong>0</strong><span>m</span></div>
        <div class="fishing-slots" role="img" aria-label="Empty hook"></div>
      </div>
      <div class="fishing-depth-track" aria-hidden="true"><i></i><span>${maxDepth} m</span></div>
      <div class="fishing-contacts" aria-hidden="true"></div>
      <div class="fishing-zone" aria-hidden="true">Sunlit shallows</div>
      <div class="fishing-intro"><p>Guide down. Catch the front half coming up.</p><span>Drag or ← → · Space to reel early</span></div>
      <div class="fishing-callout" aria-hidden="true"></div>
      <div class="fishing-render-status" role="status" hidden></div>
      <section class="fishing-result" aria-labelledby="fishing-result-title" hidden>
        <h2 id="fishing-result-title">Your catch</h2>
        <p class="fishing-result-summary"></p>
        <ul class="fishing-result-catches"></ul>
        <p class="fishing-result-quota" hidden>No casts left today</p>
        <div class="fishing-result-actions"><button class="fishing-again fishing-action" type="button">Cast again</button><button class="fishing-leave" type="button">Return to shore</button></div>
      </section>
    </div>
    <p class="fishing-live" role="status" aria-live="polite"></p><div class="fishing-controls"><button class="fishing-action" type="button">Cast line <span aria-hidden="true">↓</span></button></div>`;
  host.append(root);
  const stage = root.querySelector<HTMLElement>('.fishing-stage')!;
  const action = root.querySelector<HTMLButtonElement>('.fishing-controls .fishing-action')!;
  const controls = root.querySelector<HTMLElement>('.fishing-controls')!;
  const depthLabel = root.querySelector<HTMLElement>('.fishing-depth strong')!;
  const directionLabel = root.querySelector<HTMLElement>('.fishing-direction')!;
  const slots = root.querySelector<HTMLElement>('.fishing-slots')!;
  const contacts = root.querySelector<HTMLElement>('.fishing-contacts')!;
  const intro = root.querySelector<HTMLElement>('.fishing-intro')!;
  const live = root.querySelector<HTMLElement>('.fishing-live')!;
  const callout = root.querySelector<HTMLElement>('.fishing-callout')!;
  const renderStatus = root.querySelector<HTMLElement>('.fishing-render-status')!;
  const depthMarker = root.querySelector<HTMLElement>('.fishing-depth-track i')!;
  const zone = root.querySelector<HTMLElement>('.fishing-zone')!;
  const result = root.querySelector<HTMLElement>('.fishing-result')!;
  const resultTitle = root.querySelector<HTMLElement>('#fishing-result-title')!;
  const resultSummary = root.querySelector<HTMLElement>('.fishing-result-summary')!;
  const resultCatches = root.querySelector<HTMLElement>('.fishing-result-catches')!;
  const resultQuota = root.querySelector<HTMLElement>('.fishing-result-quota')!;
  const again = root.querySelector<HTMLButtonElement>('.fishing-again')!;
  const leave = root.querySelector<HTMLButtonElement>('.fishing-leave')!;
  for (let i = 0; i < model.capacity; i++) {
    const slot = document.createElement('i'); slot.className = 'fishing-slot'; slots.append(slot);
  }
  slots.setAttribute('aria-label', `0 of ${model.capacity} hook spaces filled`);
  for (let i = 0; i < model.resilience; i++) {
    const contact = document.createElement('i'); contacts.append(contact);
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch {
    renderStatus.hidden = false;
    renderStatus.textContent = 'The water view could not open. Please return to shore and try again.';
    action.textContent = 'Return to shore';
    const cancel = () => options.onCancel?.();
    action.addEventListener('click', cancel);
    return { destroy() { action.removeEventListener('click', cancel); root.remove(); } };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor('#a9dcd9');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b7e1dc');
  scene.fog = new THREE.Fog('#a0d4d5', 18, 44);
  const camera = new THREE.OrthographicCamera(-5.5, 5.5, 5.5, -5.5, .1, 80);
  camera.position.set(0, -2, 24);
  scene.add(new THREE.HemisphereLight('#fffae9', '#74a9bd', 2.3));
  const sun = new THREE.DirectionalLight('#fff2d5', 2.6);
  sun.position.set(-5, 8, 10); scene.add(sun);
  const fill = new THREE.DirectionalLight('#c1c8f1', .7);
  fill.position.set(7, -9, 4); scene.add(fill);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const textureLoader = new THREE.TextureLoader();
  const texture = (name: string, onLoad?: (value: THREE.Texture) => void) => {
    const value = textureLoader.load(`${import.meta.env.BASE_URL}art/lavender/${name}`, onLoad);
    value.colorSpace = THREE.SRGBColorSpace; textures.add(value); return value;
  };
  const ownGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => { geometries.add(geometry); return geometry; };
  const material = (color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: .83, metalness: 0, ...extra });
    materials.add(value); return value;
  };
  const sphere = ownGeometry(new THREE.SphereGeometry(1, 16, 10));
  const pearl = material('#fff0c8');
  const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, position: number[], scale: number[]) => {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(position[0], position[1], position[2]);
    object.scale.set(scale[0], scale[1], scale[2]); parent.add(object); return object;
  };

  const waterTime = { value: 0 };
  const fallbackBackground: FishingBackgroundArt = { id: 'master', url: 'fishing-underwater-v1.png', width: 749, height: 2098, viewportAspect: .667 };
  let activeBackground = fallbackBackground;
  let requestedBackground = fallbackBackground.id;
  let backgroundArts: FishingBackgroundArt[] = [];
  const backgroundCache = new Map<string, { art: FishingBackgroundArt; texture: THREE.Texture }>();
  let backgroundCover = fishingBackgroundCover(10.6, 10.6, fallbackBackground.width / fallbackBackground.height);
  const fallbackTexture = texture(fallbackBackground.url, value => {
    const art = intrinsicBackground(fallbackBackground, value);
    backgroundCache.set(art.id, { art, texture: value });
    if (requestedBackground === art.id) applyBackground(art, value);
  });
  const backdropMaterial = new THREE.ShaderMaterial({
    uniforms: { map: { value: fallbackTexture }, time: waterTime },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D map; uniform float time; varying vec2 vUv;
      void main(){vec2 p=vUv; p.x+=sin(p.y*37.+time*.38)*sin(p.y*13.-time*.24)*.0012;
      p.y+=sin(p.x*31.+time*.21)*.0005; vec4 art=texture2D(map,p);
      float caustic=pow(max(0.,sin(p.x*38.+sin(p.y*28.+time*.24)*2.4)*sin(p.y*34.-time*.32)),10.);
      float luminance=dot(art.rgb,vec3(.2126,.7152,.0722));
      vec3 color=mix(art.rgb,vec3(luminance),.12);
      color=mix(color,vec3(.84,.89,.77),.025);
      gl_FragColor=vec4(color+vec3(.07,.055,.025)*caustic,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    depthWrite: false,
  }); materials.add(backdropMaterial);
  const backdrop = mesh(ownGeometry(new THREE.PlaneGeometry(activeBackground.width / activeBackground.height, 1)), backdropMaterial, scene, [0, -18, -7], [1, 1, 1]);
  const backgroundForward = new THREE.Vector3(), backgroundUp = new THREE.Vector3(), backgroundRight = new THREE.Vector3();

  function intrinsicBackground(art: FishingBackgroundArt, value: THREE.Texture): FishingBackgroundArt {
    const image = value.image as HTMLImageElement;
    return { ...art, width: image.naturalWidth || image.width || art.width, height: image.naturalHeight || image.height || art.height };
  }

  function fitBackground(): void {
    const aspect = activeBackground.width / activeBackground.height;
    backgroundCover = fishingBackgroundCover(halfWidth * 2, halfHeight * 2, aspect);
    backdrop.scale.setScalar(backgroundCover.scale);
    stage.dataset.backgroundFrame = JSON.stringify({
      variant: activeBackground.id, native: [activeBackground.width, activeBackground.height],
      plane: [aspect * backgroundCover.scale, backgroundCover.scale],
      scale: backdrop.scale.toArray(), view: [halfWidth * 2, halfHeight * 2],
      depthPan: [-backgroundCover.overflowY * .9, backgroundCover.overflowY * .9],
    });
  }

  function applyBackground(art: FishingBackgroundArt, value: THREE.Texture): void {
    if (destroyed) return;
    activeBackground = art;
    const oldGeometry = backdrop.geometry;
    backdrop.geometry = ownGeometry(new THREE.PlaneGeometry(art.width / art.height, 1));
    geometries.delete(oldGeometry); oldGeometry.dispose();
    backdropMaterial.uniforms.map.value = value;
    fitBackground();
  }

  function selectBackground(): void {
    const bounds = stage.getBoundingClientRect();
    const viewportAspect = bounds.width / bounds.height;
    const composition = (aspect: number) => aspect <= .85 ? 'portrait' : aspect >= 2 ? 'ultrawide' : 'landscape';
    const kind = composition(viewportAspect);
    const art = backgroundArts.find(value => composition(value.viewportAspect) === kind) ?? fallbackBackground;
    requestedBackground = art.id;
    if (activeBackground.id === art.id) return;
    const cached = backgroundCache.get(art.id);
    if (cached) { applyBackground(cached.art, cached.texture); return; }
    // Keep the current complete artwork while the next orientation loads.
    if (backgroundCache.has(`loading:${art.id}`)) return;
    const value = texture(`fishing-backgrounds/${art.url}`, loaded => {
      const actual = intrinsicBackground(art, loaded);
      backgroundCache.delete(`loading:${art.id}`);
      backgroundCache.set(art.id, { art: actual, texture: loaded });
      if (requestedBackground === art.id) applyBackground(actual, loaded);
    });
    backgroundCache.set(`loading:${art.id}`, { art, texture: value });
  }
  const beamGeometry = ownGeometry(new THREE.PlaneGeometry(1, 52));
  const beamMaterial = new THREE.MeshBasicMaterial({ color: '#f6f6cf', transparent: true, opacity: .07, depthWrite: false });
  materials.add(beamMaterial);
  for (let i = 0; i < 5; i++) {
    const beam = mesh(beamGeometry, beamMaterial, scene, [-8 + i * 4, -15, -6], [1.1 + i * .1, 1, 1]);
    beam.rotation.z = -.24;
  }
  const plantTime = { value: 0 };
  const plantMaterial = new THREE.MeshBasicMaterial({ map: texture('fishing-kelp-v1.png'), transparent: true, alphaTest: .02, depthWrite: false, fog: false });
  plantMaterial.onBeforeCompile = shader => {
    shader.uniforms.plantTime = plantTime;
    shader.vertexShader = 'uniform float plantTime;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n transformed.x += sin(plantTime*.85+position.y*1.7)*pow(uv.y,2.)*.12;');
  }; materials.add(plantMaterial);
  const plantGeometry = ownGeometry(new THREE.PlaneGeometry(1.65, 3, 12, 20));
  const kelps = Array.from({ length: 12 }, (_, i) => {
    const plant = mesh(plantGeometry, plantMaterial, scene,
      [(i % 2 ? 1 : -1) * (4.9 + Math.sin(i) * .15), -3 - Math.floor(i / 2) * 5.2, i % 3 ? -.9 : 1.8],
      [i % 2 ? -1 : 1, .8 + i % 3 * .15, 1]);
    return plant;
  });
  const finMaterials = [material('#d48f91')];
  const fishTime = { value: 0 };
  const catchMaterials = new Map<string, THREE.MeshBasicMaterial>();
  function catchMaterial(loot: FishingLoot): THREE.MeshBasicMaterial {
    const key = loot.kind === 'fish' ? loot.species : loot.kind === 'shell' ? `shell-${loot.variant}` : loot.item;
    const cached = catchMaterials.get(key);
    if (cached) return cached;
    const name = loot.kind === 'fish' && (loot.species === 'perch' || loot.species === 'seaBass')
      ? loot.species === 'seaBass' ? 'fishing-sea-bass-v1.png' : 'fishing-perch-v1.png'
      : `fishing-depth/${loot.kind === 'fish' ? loot.species : loot.kind === 'shell' ? 'shell' : loot.item}.webp`;
    const value = new THREE.MeshBasicMaterial({ map: texture(name),
      color: loot.kind === 'shell' && loot.variant === 'moon' ? '#d8c3ff' : '#ffffff',
      transparent: true, alphaTest: .04, depthWrite: false, fog: false });
    if (loot.kind === 'fish') value.onBeforeCompile = shader => {
      shader.uniforms.fishTime = fishTime;
      shader.vertexShader = 'uniform float fishTime;\n' + shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n float tail = 1.-smoothstep(-.6,.2,position.x); transformed.y += sin(fishTime*5.3+position.x*5.)*tail*.045; transformed.x += cos(fishTime*5.3)*tail*.018;');
    };
    materials.add(value); catchMaterials.set(key, value); return value;
  }
  const fishGeometry = ownGeometry(new THREE.PlaneGeometry(1.6, .8, 24, 10));
  const deepFishGeometry = ownGeometry(new THREE.PlaneGeometry(2, 2, 24, 16));
  const findGeometry = ownGeometry(new THREE.PlaneGeometry(1.18, 1.18));
  const warningGeometry = ownGeometry(new THREE.TorusGeometry(.84, .025, 5, 40));
  const warningMaterial = new THREE.MeshBasicMaterial({ color: '#ffe7a2', transparent: true, opacity: .85, depthWrite: false });
  materials.add(warningMaterial);
  const fishMeshes = model.fish.map((fish) => {
    const group = new THREE.Group(); scene.add(group);
    const loot = fishingCatchLoot(fish, options.fish);
    const isFish = loot.kind === 'fish';
    mesh(isFish ? fish.rare ? deepFishGeometry : fishGeometry : findGeometry, catchMaterial(loot), group, [0, 0, .2], [1, 1, 1]);
    const warning = mesh(warningGeometry, warningMaterial, group, [0, 0, .15], [1, .7, 1]);
    warning.visible = false;
    group.scale.set(isFish ? fish.direction * fishingCatchScale(fish) : 1, fishingCatchScale(fish), 1);
    return { group, warning, isFish };
  });

  const hook = new THREE.Group(); scene.add(hook);
  const hookMetal = material('#d1a268', { roughness: .35, metalness: .28, emissive: '#bba678', emissiveIntensity: .1 });
  const hookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, .7, 0), new THREE.Vector3(0, .3, 0), new THREE.Vector3(-.02, -.02, 0),
    new THREE.Vector3(.14, -.17, 0), new THREE.Vector3(.35, -.12, 0), new THREE.Vector3(.4, .1, 0),
  ]);
  mesh(ownGeometry(new THREE.TubeGeometry(hookCurve, 28, .075, 8, false)), material('#948372'), hook, [0, 0, -.035], [1, 1, 1]);
  mesh(ownGeometry(new THREE.TubeGeometry(hookCurve, 28, .055, 8, false)), hookMetal, hook, [0, 0, .02], [1, 1, 1]);
  const barb = mesh(ownGeometry(new THREE.ConeGeometry(.085, .2, 8)), hookMetal, hook, [.4, .13, 0], [1, 1, 1]); barb.rotation.z = -.15;
  mesh(ownGeometry(new THREE.TorusGeometry(.1, .035, 6, 16)), hookMetal, hook, [0, .76, 0], [1, 1, 1]);
  const bait = mesh(sphere, material('#eea693'), hook, [.3, -.03, .05], [.08, .12, .08]); bait.rotation.z = .3;
  const hookHalo = mesh(ownGeometry(new THREE.TorusGeometry(.5, .016, 5, 32)), material('#fff4c7', { transparent: true, opacity: .65, depthWrite: false }), hook, [.4, .1, -.06], [1, 1, 1]);
  const lineGeometry = ownGeometry(new THREE.BufferGeometry());
  const linePositions = new Float32Array(20 * 3);
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  const lineMaterial = new THREE.LineBasicMaterial({ color: '#fff3d0', transparent: true, opacity: .9 }); materials.add(lineMaterial);
  scene.add(new THREE.Line(lineGeometry, lineMaterial));
  const surface = new THREE.Group(); scene.add(surface);
  const foamMaterial = material('#eff5da', { transparent: true, opacity: .7 });
  for (let i = 0; i < 14; i++) mesh(sphere, foamMaterial, surface, [-6 + i * .9, .9 + Math.sin(i) * .08, -1], [.64, .045, .2]);
  // The little float marks the connection back to the island at the surface.
  const float = new THREE.Group(); surface.add(float);
  mesh(sphere, pearl, float, [0, .95, .7], [.16, .27, .16]);
  mesh(sphere, finMaterials[0], float, [0, 1.08, .7], [.163, .14, .163]);

  const bubbleMaterial = new THREE.MeshBasicMaterial({ color: '#e2f6e5', transparent: true, opacity: .35, depthWrite: false }); materials.add(bubbleMaterial);
  const bubbleGeometry = ownGeometry(new THREE.SphereGeometry(1, 6, 5));
  const bubbles = new THREE.InstancedMesh(bubbleGeometry, bubbleMaterial, 64); scene.add(bubbles);
  const dummy = new THREE.Object3D();
  let destroyed = false, contextLost = false, finished = false, frame = 0, previous = 0;
  let lastPhase = model.phase, lastCount = 0, lastContacts = 0, lastWarning = -1;
  let pointer: number | undefined;
  let right = false, left = false;
  let halfWidth = 5.3;
  let halfHeight = 5.3;
  let calloutUntil = 0;
  const abort = new AbortController();
  const signal = abort.signal;

  function announce(text: string): void { live.textContent = text; }
  function showCallout(text: string): void {
    callout.textContent = text; callout.classList.add('visible'); calloutUntil = model.time + 1.7;
  }
  function performAction(): void {
    if (contextLost || destroyed) return;
    if (model.phase === 'ready') {
      if (options.onCast?.() === false) return;
      castFishing(model); intro.hidden = true; stage.focus({ preventScroll: true });
    } else if (model.phase === 'descending') reelFishing(model);
  }
  action.addEventListener('click', performAction, { signal });
  again.addEventListener('click', () => { if (finished && !again.disabled) { again.disabled = true; options.onAgain?.(); } }, { signal });
  leave.addEventListener('click', () => options.onCancel?.(), { signal });
  const keyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); options.onCancel?.(); return; }
    if ((event.target as HTMLElement).closest('button') || model.phase === 'done') return;
    if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D', ' ', 'Enter', 'Escape'].includes(event.key)) event.preventDefault();
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') left = true;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') right = true;
    if (!event.repeat && (event.key === ' ' || event.key === 'Enter')) performAction();
  };
  const keyUp = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') left = false;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') right = false;
  };
  root.addEventListener('keydown', keyDown, { signal });
  root.addEventListener('keyup', keyUp, { signal });
  const clearKeys = () => { left = right = false; };
  window.addEventListener('blur', clearKeys, { signal });
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget as Node | null)) clearKeys(); }, { signal });
  function point(event: PointerEvent): void {
    const bounds = stage.getBoundingClientRect();
    model.targetX = ((event.clientX - bounds.left) / bounds.width * 2 - 1) * halfWidth;
  }
  stage.addEventListener('pointerdown', (event) => {
    if (model.phase === 'done' || pointer !== undefined || event.button !== 0) return;
    pointer = event.pointerId; stage.setPointerCapture(pointer); point(event); stage.focus({ preventScroll: true });
    if (model.phase === 'ready') performAction();
  }, { signal });
  stage.addEventListener('pointermove', event => { if (event.pointerId === pointer) point(event); }, { signal });
  const releasePointer = (event?: PointerEvent) => {
    if (event && event.pointerId !== pointer) return;
    if (pointer !== undefined && stage.hasPointerCapture(pointer)) stage.releasePointerCapture(pointer);
    pointer = undefined;
  };
  stage.addEventListener('pointerup', releasePointer, { signal });
  stage.addEventListener('pointercancel', releasePointer, { signal });
  stage.addEventListener('lostpointercapture', () => { pointer = undefined; }, { signal });
  document.addEventListener('visibilitychange', () => { previous = 0; clearKeys(); releasePointer(); }, { signal });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextLost = true; clearKeys(); releasePointer();
    // Release listeners tied to the lost GL generation while retaining all CPU art/model data.
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
    renderStatus.textContent = 'The water view paused. Waiting for the graphics to recover…'; renderStatus.hidden = false;
    action.disabled = true;
  }, { signal });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    contextLost = false; previous = 0; renderStatus.hidden = true;
    action.disabled = model.phase === 'ascending';
  }, { signal });
  const resize = new ResizeObserver(() => {
    if (destroyed) return;
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    halfWidth = Math.max(3.1, Math.min(6.4, 6.8 * width / height));
    halfHeight = halfWidth * height / width;
    model.steeringLimit = Math.min(fishingHalfWidth, halfWidth - .65);
    camera.left = -halfWidth; camera.right = halfWidth; camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    selectBackground(); fitBackground();
    kelps.forEach((kelp, i) => { kelp.position.x = (i % 2 ? 1 : -1) * (halfWidth - .25 + Math.sin(i) * .15); });
  }); resize.observe(stage);
  void fetch(`${import.meta.env.BASE_URL}art/lavender/fishing-backgrounds/manifest.json`, { signal }).then(async response => {
    if (!response.ok) return;
    const manifest = await response.json() as { items?: Record<string, Omit<FishingBackgroundArt, 'id'>> };
    backgroundArts = Object.entries(manifest.items ?? {}).flatMap(([id, art]) =>
      typeof art.url === 'string' && Number.isFinite(art.width) && art.width > 0 && Number.isFinite(art.height) && art.height > 0
        && Number.isFinite(art.viewportAspect) && art.viewportAspect > 0 ? [{ id, ...art }] : []);
    if (!destroyed) selectBackground();
  }).catch(() => { /* The accepted master remains a proportionate fallback. */ });

  function updateInterface(): void {
    depthLabel.textContent = String(Math.round(model.depth / fishingDepth * maxDepth));
    zone.textContent = model.depth > 25.2 ? 'Lantern depths' : model.depth > 18.6 ? 'Moonlit water' : model.depth > 9 ? 'Kelp gardens' : 'Sunlit shallows';
    depthMarker.style.top = `${model.depth / fishingDepth * 92}%`;
    if (lastPhase !== model.phase) {
      lastPhase = model.phase; root.dataset.phase = model.phase;
      if (model.phase === 'descending') {
        action.innerHTML = 'Reel in <span aria-hidden="true">↑</span>';
        showCallout('↓ Steer around fish');
        announce('Steer around fish. Space reels in early.');
      } else if (model.phase === 'ascending') {
        action.textContent = 'Reeling in…'; action.disabled = true; directionLabel.textContent = '↑';
        showCallout('↑ Aim for the front half');
        announce('Coming up. Guide the hook through the front half of fish to catch them.');
      } else if (model.phase === 'done') {
        controls.hidden = true; directionLabel.textContent = '✓';
        const message = model.caught.length ? `${model.caught.length} finds brought ashore` : 'The hook returned empty. Aim for the front half on the way up.';
        announce(message); callout.classList.remove('visible');
      }
    }
    if (lastContacts !== model.contacts) {
      lastContacts = model.contacts;
      Array.from(contacts.children).forEach((item, i) => item.classList.toggle('used', i < model.contacts));
      showCallout(model.phase === 'descending' ? 'Careful — steer around' : 'Time to bring it up');
      announce(`${model.contacts} of ${model.resilience} contacts. ${model.phase === 'ascending' ? 'The hook is coming up.' : 'Steer around fish.'}`);
    }
    if (lastCount !== model.caught.length) {
      lastCount = model.caught.length;
      Array.from(slots.children).forEach((slot, i) => {
        slot.classList.toggle('filled',i<lastCount);
        const found=model.fish.find(fish=>fish.id===model.caught[i]);
        if(!found)return;
        const loot=fishingCatchLoot(found,options.fish);
        const img=document.createElement('img');img.src=lootArt(loot);img.alt='';slot.replaceChildren(img);
      });
      const latest = model.fish.find(fish => fish.id === model.caught.at(-1));
      const loot = latest && fishingCatchLoot(latest, options.fish);
      const name = loot ? lootName(loot) : 'Caught!';
      slots.setAttribute('aria-label', `${lastCount} of ${model.capacity} hook spaces filled`);
      showCallout(lastCount === model.capacity ? `${name} · Hook full — reeling up!` : name);
      announce(`${name}. ${lastCount} of ${model.capacity} hook spaces filled.`);
    }
    const warning = model.fish.find(fish => fish.dart?.phase === 'warning');
    if (warning && warning.id !== lastWarning) {
      lastWarning = warning.id; showCallout('Little fish is eyeing the bait — steer aside');
      announce('A little fish is preparing to dart. Steer aside.');
    }
    if (model.time > calloutUntil) callout.classList.remove('visible');
  }

  const nearColor = new THREE.Color('#b7e1dc'), deepColor = new THREE.Color('#92b8c9');
  function animate(now: number): void {
    frame = requestAnimationFrame(animate);
    if (destroyed || document.hidden || contextLost) { previous = 0; return; }
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    if (Math.abs(renderer.getPixelRatio() - pixelRatio) > .001) renderer.setPixelRatio(pixelRatio);
    const dt = previous ? Math.min((now - previous) / 1000, .05) : 0;
    previous = now;
    if (left !== right) model.targetX += (right ? 1 : -1) * dt * 7;
    stepFishing(model, dt);
    updateInterface();
    const viewDepth = model.depth + Math.min(1.8, halfHeight * .25);
    camera.position.y = -viewDepth;
    camera.lookAt(0, -viewDepth - .12, 0);
    (scene.background as THREE.Color).copy(nearColor).lerp(deepColor, model.depth / fishingDepth);
    hook.position.set(model.x - .4, -model.depth, 1.1);
    hook.rotation.z = reducedMotion.matches ? 0 : (model.targetX - model.x) * -.12 + Math.sin(model.time * 2) * .025;
    hookHalo.visible = model.phase === 'ascending' && model.caught.length < model.capacity;
    hookHalo.scale.setScalar(1 + Math.sin(model.time * 4) * .06);
    hookMetal.color.set(model.flash > 0 ? '#de8990' : '#d1a268');
    for (let i = 0; i < 20; i++) {
      const t = i / 19;
      const anchorX = (model.x - .4) * .12;
      linePositions[i * 3] = anchorX + (model.x - .4 - anchorX) * t + Math.sin(t * Math.PI) * (reducedMotion.matches ? 0 : Math.sin(model.time * 2) * .13);
      linePositions[i * 3 + 1] = .8 + (-model.depth + .76 - .8) * t;
      linePositions[i * 3 + 2] = 1.1;
    }
    lineGeometry.attributes.position.needsUpdate = true;
    lineGeometry.computeBoundingSphere();
    float.position.x = (model.x - .4) * .12;
    if (!reducedMotion.matches) float.position.y = Math.sin(model.time * 2) * .045;
    fishTime.value = reducedMotion.matches ? 0 : model.time;
    waterTime.value = plantTime.value = reducedMotion.matches ? 0 : model.time;
    // Follow the physical camera; depth only pans through the artwork's safe cover overflow.
    camera.getWorldDirection(backgroundForward);
    backgroundUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    backgroundRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const backgroundPanY = (model.depth / fishingDepth * 2 - 1) * backgroundCover.overflowY * .9;
    const backgroundPanX = reducedMotion.matches ? 0 : -model.x / fishingHalfWidth * Math.min(.18, backgroundCover.overflowX * .6);
    backdrop.quaternion.copy(camera.quaternion);
    backdrop.position.copy(camera.position).addScaledVector(backgroundForward, 31)
      .addScaledVector(backgroundUp, backgroundPanY).addScaledVector(backgroundRight, backgroundPanX);
    fishMeshes.forEach(({ group, warning, isFish }, i) => {
      const fish = model.fish[i];
      const caughtIndex = model.caught.indexOf(fish.id);
      const bodyScale = fishingCatchScale(fish);
      warning.visible = caughtIndex < 0 && fish.dart?.phase === 'warning';
      warning.scale.setScalar(reducedMotion.matches ? 1 : 1 + Math.sin(model.time * 9) * .09);
      if (caughtIndex >= 0) {
        const angle = isFish ? fish.direction * (.95 + Math.sin(model.time * 3 + i) * (reducedMotion.matches ? 0 : .05)) : -.12;
        const mouth = fishingCatchMouth(fish);
        const headX = mouth.x * .66, headY = -mouth.depth * .66;
        const clusterX = (caughtIndex - (model.caught.length - 1) / 2) * .28;
        group.position.set(model.x + clusterX - Math.cos(angle) * headX + Math.sin(angle) * headY,
          -model.depth + .1 - Math.sin(angle) * headX - Math.cos(angle) * headY, 1.25 + caughtIndex * .015);
        group.scale.set((isFish ? fish.direction : 1) * .66 * bodyScale, .66 * bodyScale, .66);
        group.rotation.z = angle;
      } else {
        group.position.set(fishPosition(fish, model.time), -fish.depth + (reducedMotion.matches || !isFish ? 0 : Math.sin(model.time * 2 + i) * .035), .25);
        group.rotation.z = 0;
      }
    });
    kelps.forEach((kelp, i) => { kelp.rotation.z = reducedMotion.matches ? 0 : Math.sin(model.time * .9 + i * 1.2) * .065; });
    for (let i = 0; i < 64; i++) {
      const t = reducedMotion.matches ? 0 : model.time;
      dummy.position.set(Math.sin(i * 13.71) * 5.1 + Math.sin(t * .5 + i) * .12,
        2 - ((i * 1.713 - t * (.12 + i % 4 * .04)) % 35 + 35) % 35, -1 + i % 5 * .3);
      dummy.scale.setScalar(.017 + i % 4 * .012); dummy.updateMatrix(); bubbles.setMatrixAt(i, dummy.matrix);
    }
    bubbles.instanceMatrix.needsUpdate = true;
    if (model.flash > 0 && !reducedMotion.matches) camera.position.x = Math.sin(model.time * 60) * model.flash * .07;
    else camera.position.x = 0;
    renderer.render(scene, camera);
    if (model.phase === 'done' && !finished) {
      finished = true;
      clearKeys(); releasePointer();
      const catches = model.caught.map(id => fishingCatchLoot(model.fish.find(fish => fish.id === id)!, options.fish));
      const depth = Math.round(model.deepest / fishingDepth * maxDepth);
      const canRecast = options.onFinish({ count: catches.length, depth, catches }) !== false;
      if (destroyed) return;
      resultTitle.textContent = catches.length ? 'Your catch' : 'An empty hook';
      resultSummary.textContent = catches.length
        ? `${depth} m reached`
        : `${depth} m reached · Try steering through the front half of a fish`;
      for (const loot of catches) {
        const item = document.createElement('li');
        const img = document.createElement('img'); img.src = lootArt(loot); img.alt = '';
        if (loot.kind === 'shell' && loot.variant === 'moon') img.className = 'moon-shell';
        const label = document.createElement('span'); label.textContent = lootName(loot);
        item.append(img, label); resultCatches.append(item);
      }
      again.hidden = !canRecast || !options.onAgain;
      resultQuota.hidden = canRecast;
      controls.hidden = true; callout.classList.remove('visible'); result.hidden = false;
      stage.removeAttribute('role'); stage.tabIndex = -1;
      announce(`${resultTitle.textContent}. ${resultSummary.textContent}. ${canRecast ? 'Cast again or return to shore.' : 'No casts left today. Return to shore.'}`);
      (again.hidden ? leave : again).focus({ preventScroll: true });
    }
  }
  frame = requestAnimationFrame(animate);
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true; cancelAnimationFrame(frame); releasePointer(); abort.abort(); resize.disconnect();
      scene.clear(); geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
      renderer.dispose(); renderer.forceContextLoss(); root.remove();
    },
  };
}
