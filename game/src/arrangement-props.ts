import * as THREE from 'three';
import { loadImage } from './image-assets';
import type { FoodDescriptor } from './intent-orders';
import {resolvedCookeryFruit,cookeryFinishTraits} from './culinary';
import {finishedIngredient} from './ingredient-finish';

type Mode = 'table' | 'basket' | 'eggs' | 'crate';
type Slot = 'food' | 'cup' | 'flowers' | 'egg';
type Piece = { id: string; slot: Slot; mesh: THREE.Group; half: { x: number; y: number; z: number }; mass: number; vertices?: Float32Array };
type Source = {
  image: HTMLImageElement | HTMLCanvasElement; pixels: ImageData;
  width: number; height: number; bounds: { left: number; top: number; right: number; bottom: number };
};
const pitch = Math.PI * 40 / 180;

/** Painted art owns the appearance; Rapier owns the actual weight and contacts. */
export async function createArrangementProps(mode: Mode, food?: FoodDescriptor): Promise<{
  pieces: Piece[]; target: THREE.Group; dispose(): void;
}> {
  const textures: THREE.Texture[] = [], geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const images = new Map<string, Promise<Source>>();
  const base = `${import.meta.env.BASE_URL}art/lavender/`;
  function inspect(image: HTMLImageElement | HTMLCanvasElement): Source {
    const width = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
    const height = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true })!; context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, width, height);
    const bounds = { left: width, top: height, right: 0, bottom: 0 };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (pixels.data[(y * width + x) * 4 + 3] < 40) continue;
      bounds.left = Math.min(bounds.left, x); bounds.top = Math.min(bounds.top, y);
      bounds.right = Math.max(bounds.right, x + 1); bounds.bottom = Math.max(bounds.bottom, y + 1);
    }
    if (bounds.right <= bounds.left) throw new Error('Empty authored arrangement image');
    return { image, pixels, width, height, bounds };
  }
  function load(path: string): Promise<Source> {
    let promise = images.get(path);
    if (!promise) {
      promise = loadImage(`${base}${path}`).then(inspect);
      images.set(path, promise);
    }
    return promise;
  }
  function sprite(source: Source, visibleWidth: number, centerY: number, order: number): { pivot: THREE.Group; plane: THREE.Mesh; visibleHeight: number } {
    const { bounds: box, width, height } = source;
    const unit = visibleWidth / (box.right - box.left);
    const fullW = width * unit, fullH = height * unit;
    const map = new THREE.Texture(source.image); map.colorSpace = THREE.SRGBColorSpace;
    map.minFilter = map.magFilter = THREE.LinearFilter; map.generateMipmaps = false; map.needsUpdate = true; textures.push(map);
    const geometry = new THREE.PlaneGeometry(fullW, fullH); geometries.push(geometry);
    const skin = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: .012, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }); materials.push(skin);
    const plane = new THREE.Mesh(geometry, skin); plane.castShadow = false; plane.receiveShadow = false;
    plane.position.set((width / 2 - (box.left + box.right) / 2) * unit,
      centerY - (height / 2 - (box.top + box.bottom) / 2) * unit, 0);
    plane.renderOrder = order; plane.userData.rasterArt = true;
    const standardRaycast = plane.raycast.bind(plane);
    plane.raycast = (raycaster, hits) => {
      const candidates: THREE.Intersection[] = []; standardRaycast(raycaster, candidates);
      for (const hit of candidates) {
        if (!hit.uv) continue;
        const x = Math.min(width - 1, Math.max(0, Math.floor(hit.uv.x * width)));
        const y = Math.min(height - 1, Math.max(0, Math.floor((1 - hit.uv.y) * height)));
        if (source.pixels.data[(y * width + x) * 4 + 3] > 35) hits.push(hit);
      }
    };
    const pivot = new THREE.Group(); pivot.userData.billboard = true;
    // Correct before the first frame too; the renderer counter-rotates this
    // child after applying each new physical body pose.
    pivot.rotation.x = -pitch; pivot.add(plane);
    return { pivot, plane, visibleHeight: (box.bottom - box.top) * unit };
  }
  function hull(half: Piece['half'], slot: Slot): Float32Array {
    const points: number[] = [];
    const rings = slot === 'food' ? [.94, 1, .72, .27] : slot === 'cup' ? [.68, .82, 1, .83] : slot === 'flowers' ? [.43, .62, .8, 1] : [.1, .87, 1, .68, .08];
    for (let row = 0; row < rings.length; row++) for (let i = 0; i < 24; i++) {
      const angle = i / 24 * Math.PI * 2;
      const y = -half.y + row / (rings.length - 1) * half.y * 2;
      points.push(Math.cos(angle) * half.x * rings[row], y, Math.sin(angle) * half.z * rings[row]);
    }
    return new Float32Array(points);
  }
  function piece(id: string, slot: Slot, source: Source, width: number, depth: number, mass: number): Piece {
    const projectedHeight = width * (source.bounds.bottom - source.bounds.top) / (source.bounds.right - source.bounds.left);
    const half = { x: width / 2, z: depth / 2,
      y: Math.max(.055, (projectedHeight - depth * Math.sin(pitch)) / (2 * Math.cos(pitch))) };
    // The lowest painted foreground contact lies at the physical front edge,
    // rather than floating at an arbitrary sprite cell baseline.
    const centerY = projectedHeight / 2 - half.y * Math.cos(pitch) - half.z * Math.sin(pitch);
    const art = sprite(source, width, centerY, 10);
    const group = new THREE.Group(); group.add(art.pivot);
    group.userData.shadowFootprint = { x: half.x, z: half.z };
    group.userData.rasterPiece = true;
    return { id, slot, mesh: group, half, mass, vertices: hull(half, slot) };
  }

  async function composedTart(): Promise<Source> {
    const fruits = food?.preparation ? resolvedCookeryFruit(food.preparation,food.recipeIngredients) : [];
    const types = [...new Set(fruits.map(fruit => fruit.ingredientId))];
    const berryOnly = types.length === 1 && ['strawberry', 'blueberry', 'raspberry'].includes(types[0]);
    const tart = await load(`cookery/${berryOnly ? `tart-${types[0]}` : 'tart'}.webp`);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
    const context = canvas.getContext('2d')!; context.drawImage(tart.image, 0, 0, 1024, 1024);
    const fruitAssets = await Promise.all(fruits.map(fruit => load(`cookery/${fruit.ingredientId === 'apple' ? 'apple-slice' : fruit.ingredientId === 'pear' ? 'pear-piece' : fruit.ingredientId === 'peach' ? 'peach-slice' : fruit.ingredientId}.webp`)));
    for (let i = 0; i < fruits.length; i++) {
      const fruit = fruits[i], source = fruitAssets[i], size = 146 * .65 * 2;
      context.save(); context.translate((257 + fruit.x * 146) * 2, (240 + fruit.y * 110) * 2);
      context.rotate(fruit.angle); context.drawImage(finishedIngredient(source.image,fruit.trait?[fruit.trait]:[]), -size / 2, -size * source.height / source.width / 2, size, size * source.height / source.width); context.restore();
    }
    return inspect(canvas);
  }
  async function composedFish(): Promise<Source> {
    const species = food?.preparation?.fishSpecies ?? 'seaBass';
    const skin = species === 'seaBass' ? 'fish-grilled' : `${species}-grilled`;
    const [plate, fish] = await Promise.all([load('fish-cookery/plate.webp'), load(`fish-cookery/${skin}.webp`)]);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
    const context = canvas.getContext('2d')!;
    const paint = (source: Source, x: number, y: number, width: number, angle = 0) => {
      context.save(); context.translate(x, y); context.rotate(-angle);
      context.drawImage(source.image, -width / 2, -width * source.height / source.width / 2, width, width * source.height / source.width); context.restore();
    };
    paint(plate, 512, 590, 940); paint(fish, 512, 510, 730);
    const garnish = food?.preparation?.garnish ?? [{ ingredientId: 'carrot', x: -.36, y: .48, angle: -.15 }, { ingredientId: 'carrot', x: 0, y: .48, angle: 0 }, { ingredientId: 'carrot', x: .36, y: .48, angle: .15 }];
    for (let i = 0; i < garnish.length; i++) paint(await load(`fish-cookery/carrot-${i % 3}.webp`), 512 + garnish[i].x * 360, 512 + garnish[i].y * 250, 130, garnish[i].angle);
    return inspect(canvas);
  }
  async function foodArt(): Promise<Source> {
    const identity = food?.identity ?? 'strawberryTart';
    if (food?.preparation?.family === 'decorate' && food.preparation.fruit.length) return composedTart();
    if (identity === 'grilledFish') return composedFish();
    if (food?.source === 'handmade') return load(`ui-handmade-${identity}.webp`);
    if (identity === 'strawberryTart') return load('assembly/raster/tea-tart.webp');
    if (identity === 'tart') return load('ui-tart.webp');
    if (identity === 'preserves'||food?.preparation?.family==='preserves') { const source=await load(identity==='preserves'?'ui-orchard-preserves.webp':`ui-${identity.replace(/([a-z])([A-Z])/g,'$1-$2').toLowerCase()}.webp`);return inspect(finishedIngredient(source.image,cookeryFinishTraits(food?.preparation,food?.recipeIngredients),'jar')); }
    return load(`ui-${identity === 'orchardTart' ? 'tart' : identity.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}.webp`);
  }

  const target = new THREE.Group(), pieces: Piece[] = [];
  if (mode === 'table') {
    const art = sprite(await load('assembly/raster/tea-mat.webp'), 3.04, 0, 1);
    art.pivot.position.y = .10; target.add(art.pivot);
  } else {
    const source = await load(`assembly/raster/${mode === 'crate' ? 'egg-crate' : 'picnic-basket'}.webp`);
    const art = sprite(source, 3.24, 0, 2);
    // These are source-image contacts, registered from the accepted cutout.
    // The floor centre is lower than the visual centre because the open lid
    // rises above the rear wall. The physics support stays at y=.10.
    const floorV = mode === 'crate' ? .495 : .64;
    const unit = 3.24 / (source.bounds.right - source.bounds.left);
    art.plane.position.y += (floorV * source.height - (source.bounds.top + source.bounds.bottom) / 2) * unit;
    art.pivot.position.y = .10; target.add(art.pivot);
    const foreground = document.createElement('canvas'); foreground.width = source.width; foreground.height = source.height;
    const context = foreground.getContext('2d')!;
    const edge = mode === 'crate' ? .565 : .57, middle = mode === 'crate' ? .585 : .805;
    context.beginPath(); context.moveTo(0, source.height * edge);
    context.bezierCurveTo(source.width * .20, source.height * middle, source.width * .8, source.height * middle, source.width, source.height * edge);
    context.lineTo(source.width, source.height); context.lineTo(0, source.height); context.closePath(); context.clip(); context.drawImage(source.image, 0, 0);
    const front = sprite(inspect(foreground), 3.24 * (inspect(foreground).bounds.right - inspect(foreground).bounds.left) / (source.bounds.right - source.bounds.left), 0, 40);
    // Preserve the original full-image registration, not the cropped mask's
    // visual centre. The front wall is an occluder from the same painted source.
    front.plane.geometry.dispose(); geometries.pop();
    front.plane.geometry = art.plane.geometry;
    front.plane.position.copy(art.plane.position); front.plane.userData.containerFront = true;
    front.pivot.position.y = .10; target.add(front.pivot);
    target.userData.containerFront = front.pivot;
  }
  if (mode === 'eggs' || mode === 'crate') {
    const egg = await load('../icons/egg.webp');
    for (let i = 0; i < (mode === 'eggs' ? 3 : 5); i++) pieces.push(piece(`egg-${i}`, 'egg', egg, mode === 'crate' ? .39 : .36, .29, .065));
  } else {
    const [meal, cup, flowers] = await Promise.all([foodArt(), load(`assembly/raster/${mode === 'table' ? 'tea-cup' : 'picnic-cup'}.webp`), load(`assembly/raster/${mode === 'table' ? 'tea-flowers' : 'picnic-napkin'}.webp`)]);
    pieces.push(piece('food', 'food', meal, food?.source === 'handmade' ? .88 : 1.04, .62, .48));
    pieces.push(piece('cup', 'cup', cup, mode === 'table' ? .83 : .65, .50, .24));
    pieces.push(piece('flowers', 'flowers', flowers, mode === 'table' ? .63 : .58, mode === 'table' ? .36 : .43, .20));
  }
  return { pieces, target, dispose() { for (const geometry of geometries) geometry.dispose(); for (const skin of materials) skin.dispose(); for (const map of textures) map.dispose(); } };
}
