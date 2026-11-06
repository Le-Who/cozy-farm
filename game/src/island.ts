import { cropDefinitions, getDayPhase, getGoal, treeDefinitions, type Bed, type BedAction, type CropId, type FarmState } from './farm';
import { createRasterLibrary } from './raster';
import { createWorld } from './world';
import { occluders } from './occlusion';

export type IslandTarget =
  | { kind: 'bed' | 'tree' | 'hen'; index: number }
  | { kind: 'well' | 'coop' | 'market' | 'farmhouse' | 'pier' | 'boat' | 'salt' };

type Point = { x: number; y: number };
type Area = { target: IslandTarget; center: Point; w: number; h: number; stop: Point };
type Prop = { art: string; x: number; y: number; w: number; h: number; frame?: number; flip?: boolean; opacity?: number };
type WorkOrder = { index: number; next: () => BedAction['kind']; commit: () => void };
type GestureKind = Exclude<BedAction['kind'], 'wait'>;
type Gesture = { order: WorkOrder; kind: GestureKind; started: number; hit: boolean };
type Burst = { x: number; y: number; from: Point; kind: GestureKind; crop?: CropId; began: number };
type Footfall = { x: number; y: number; began: number; side: number };
type Spring = { value: number; speed: number };

const WORLD = { w: 1440, h: 900 };
const PLATES = {
  home: { x: 51, y: 85, w: 1338, h: 753 },
  grove: { x: 126, y: 153, w: 1188, h: 668 },
};
const BED = { x: 487, y: 402, w: 111, h: 49, dx: 116, dy: 70 };
const HOME = { x: 700, y: 695 };
const WORK_MS = { till: 510, plant: 500, water: 680, harvest: 550 } satisfies Record<GestureKind, number>;
const sprites = [
  'windmill-sails', 'farmer', 'hen', 'boat', 'salt', 'fisher', 'heart', 'stake', 'harvest-marker',
] as const;

const treeSpots = {
  home: [{ x: 1180, y: 513 }, { x: 1245, y: 594 }, { x: 1125, y: 660 }],
  grove: [{ x: 443, y: 439 }, { x: 706, y: 443 }, { x: 895, y: 502 }],
};

const moorings = {
  home: { x: 298, y: 745, boatX: 390, boatY: 832 },
  grove: { x: 459, y: 696, boatX: 349, boatY: 812 },
};
const saltCove = { x: 1125, y: 676 };

const crops: Record<CropId, { w: number; h: number }> = {
  carrot: { w: 94, h: 65 }, cabbage: { w: 95, h: 58 }, beetroot: { w: 92, h: 61 },
  tomato: { w: 93, h: 74 }, pumpkin: { w: 97, h: 59 }, wheat: { w: 90, h: 72 },
  leafyGreens: { w: 92, h: 61 },
};

const areas: Area[] = [
  { target: { kind: 'farmhouse' }, center: { x: 337, y: 268 }, w: 236, h: 217, stop: { x: 337, y: 397 } },
  { target: { kind: 'well' }, center: { x: 629, y: 284 }, w: 106, h: 135, stop: { x: 629, y: 372 } },
  { target: { kind: 'market' }, center: { x: 1105, y: 309 }, w: 190, h: 164, stop: { x: 1105, y: 403 } },
  { target: { kind: 'coop' }, center: { x: 292, y: 556 }, w: 239, h: 218, stop: { x: 298, y: 691 } },
  ...Array.from({ length: 16 }, (_, index): Area => {
    const x = BED.x + (index % 4) * BED.dx + BED.w / 2;
    const y = BED.y + Math.floor(index / 4) * BED.dy + BED.h / 2;
    return {
      target: { kind: 'bed', index },
      center: { x, y: y - 5 },
      w: BED.dx - 4,
      h: BED.dy - 2,
      stop: { x: x + BED.w * 0.34, y: y + BED.h / 2 + 9 },
    };
  }),
];

function orchardAreas(island: 'home' | 'grove'): Area[] {
  const dock = moorings[island];
  return [
    ...treeSpots[island].map((spot, index): Area => ({
      target: { kind: 'tree', index }, center: { x: spot.x, y: spot.y - 36 },
      w: 98, h: 113, stop: { x: spot.x - 13, y: spot.y + 14 },
    })),
    { target: { kind: 'pier' }, center: { x: dock.x, y: dock.y + 30 }, w: 72, h: 80,
      stop: { x: dock.x, y: dock.y + 19 } },
    { target: { kind: 'boat' }, center: { x: dock.boatX, y: dock.boatY - 22 }, w: 115, h: 67,
      stop: { x: dock.x, y: dock.y + 19 } },
  ];
}

const homeSites = [...areas, ...orchardAreas('home')];
const groveSites: Area[] = [
  ...orchardAreas('grove'),
  { target: { kind: 'salt' }, center: { x: saltCove.x, y: saltCove.y - 24 }, w: 99, h: 74,
    stop: { x: saltCove.x - 37, y: saltCove.y + 8 } },
];

function sameTarget(a: IslandTarget, b: IslandTarget): boolean {
  return a.kind === b.kind && (!('index' in a) || ('index' in b && a.index === b.index));
}

function random(index: number): number {
  const n = Math.sin(index * 79.439 + 5.723) * 43758.5453;
  return n - Math.floor(n);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function spring(value: number): Spring {
  return { value, speed: 0 };
}

function driveSpring(body: Spring, target: number, dt: number, frequency: number, damping: number): number {
  if (dt === 0) {
    body.value = target;
    body.speed = 0;
    return target;
  }
  const decay = damping * frequency;
  const oscillation = frequency * Math.sqrt(1 - damping * damping);
  const offset = body.value - target;
  const impulse = (body.speed + decay * offset) / oscillation;
  const angle = oscillation * dt;
  const envelope = Math.exp(-decay * dt);
  const wave = offset * Math.cos(angle) + impulse * Math.sin(angle);
  body.value = target + wave * envelope;
  body.speed = envelope * (oscillation * (-offset * Math.sin(angle) + impulse * Math.cos(angle)) - decay * wave);
  return body.value;
}

function walkingPath(from: Point, to: Point): Point[] {
  if (Math.abs(from.y - to.y) < 8) return [from, to];
  const entry = (point: Point): Point => {
    if (point.y < 395) return { x: point.x, y: 382 };
    if (point.y > 675) return { x: point.x, y: 695 };
    if (point.x < 466) return { x: 460, y: point.x < 412 && point.y > 500 ? 695 : point.y };
    if (point.x > 976) return { x: 976, y: point.y };
    return { x: point.x < 724 ? 464 : 976, y: point.y };
  };
  const a = entry(from);
  const b = entry(to);
  const points = [from];
  if (from.x < 412 && from.y > 500 && from.y < 675) points.push({ x: 298, y: 690 });
  points.push(a);
  if (a.x !== b.x && a.y !== b.y) {
    const edgeY = a.y + b.y < 1077 ? 382 : 695;
    const ax = a.y < 395 || a.y > 675 ? b.x : a.x;
    const bx = b.y < 395 || b.y > 675 ? a.x : b.x;
    if (a.y < 395 || a.y > 675) points.push({ x: ax, y: a.y });
    else if (b.y < 395 || b.y > 675) points.push({ x: bx, y: b.y });
    else points.push({ x: a.x, y: edgeY }, { x: b.x, y: edgeY });
  }
  points.push(b);
  if (to.x < 412 && to.y > 500 && to.y < 675) points.push({ x: 298, y: 690 });
  points.push(to);
  return points;
}

function grovePath(from: Point, to: Point): Point[] {
  // The central rocks sit across the direct route from the pier to the salt cove.
  function clearsRocks(a: Point, b: Point): boolean {
    const x = (a.x - 675) / 69;
    const y = (a.y - 659) / 29;
    const dx = (b.x - a.x) / 69;
    const dy = (b.y - a.y) / 29;
    const length = dx * dx + dy * dy;
    const t = length ? clamp(-(x * dx + y * dy) / length, 0, 1) : 0;
    return (x + dx * t) ** 2 + (y + dy * t) ** 2 >= 1;
  }
  if (clearsRocks(from, to)) return [from, to];
  const routes: { points: Point[]; length: number }[] = [];
  for (const y of [620, 702]) {
    const left = { x: 587, y };
    const right = { x: 760, y };
    const pair = from.x < to.x ? [left, right] : [right, left];
    for (const points of [[from, left, to], [from, right, to], [from, ...pair, to]]) {
      if (points.slice(1).every((point, index) => clearsRocks(points[index], point))) {
        const length = points.slice(1).reduce((sum, point, index) =>
          sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
        routes.push({ points, length });
      }
    }
  }
  routes.sort((a, b) => a.length - b.length);
  return routes[0]?.points ?? [from, to];
}

function roundTurns(points: Point[]): Point[] {
  const distinct = points.filter((point, index) => index === 0
    || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
  const rounded: Point[] = [distinct[0]];
  for (let i = 1; i < distinct.length - 1; i++) {
    const before = distinct[i - 1];
    const turn = distinct[i];
    const after = distinct[i + 1];
    const back = Math.hypot(before.x - turn.x, before.y - turn.y);
    const next = Math.hypot(after.x - turn.x, after.y - turn.y);
    const radius = Math.min(13, back / 3, next / 3);
    const entry = { x: turn.x + (before.x - turn.x) * radius / back, y: turn.y + (before.y - turn.y) * radius / back };
    const exit = { x: turn.x + (after.x - turn.x) * radius / next, y: turn.y + (after.y - turn.y) * radius / next };
    rounded.push(entry);
    for (const t of [0.33, 0.66, 1]) {
      const s = 1 - t;
      rounded.push({ x: s * s * entry.x + 2 * s * t * turn.x + t * t * exit.x,
        y: s * s * entry.y + 2 * s * t * turn.y + t * t * exit.y });
    }
  }
  rounded.push(distinct[distinct.length - 1]);
  return rounded;
}

export function createIsland(
  canvas: HTMLCanvasElement,
  { inspect, activate }: { inspect: (target: IslandTarget) => string; activate: (target: IslandTarget) => void },
) {
  const hint = document.createElement('div');
  hint.className = 'island-hint';
  hint.hidden = true;
  hint.setAttribute('aria-hidden', 'true');
  const unavailable = document.createElement('div');
  unavailable.className = 'island-render-status';
  unavailable.setAttribute('role', 'status');
  canvas.after(hint, unavailable);
  const world = createWorld(canvas, (ready) => {
    unavailable.hidden = ready;
    canvas.setAttribute('aria-disabled', String(!ready));
    if (ready) requestPaint();
  });
  const water = world.water;
  unavailable.hidden = world.available;
  canvas.setAttribute('aria-disabled', String(!world.available));
  unavailable.textContent = 'The island needs WebGL2 to display. If the graphics context was interrupted, the scene will return when it reconnects.';
  const cutouts = { home: [], grove: [] } as Record<FarmState['island'], { image: HTMLImageElement; bounds: typeof occluders.home[number] }[]>;
  let scale = 1;
  let offset: Point = { x: 0, y: 0 };
  let viewport = { width: 1, height: 1 };
  let state: FarmState | undefined;
  let currentIsland: FarmState['island'] | undefined;
  let focused: Area | undefined;
  let hovered: Area | undefined;
  let showFocus = false;
  let fieldView = false;
  let pointerStart: { id: number; x: number; y: number } | undefined;
  let heldHen: { index: number; point: Point; dragging: boolean } | undefined;
  const hens = Array.from({ length: 4 }, (_, i) => {
    const x = 218 + i * 49;
    const y = 599 + (i % 3) * 27;
    return { x, y, px: spring(x), py: spring(y), lift: spring(0), excited: 0 };
  });
  const boatFloat = spring(0);
  const boatRoll = spring(0);
  let lastPhysics = 0;
  let henSites: Area[] = [];
  let fishing = false;
  let biteSince = 0;
  let arrival = 0;
  const growthFrames = new Map<number, { crop: CropId; frame: number; time: number }>();
  const impactByBed = new Map<number, number>();
  const bursts: Burst[] = [];
  const footfalls: Footfall[] = [];
  let workOrders: WorkOrder[] = [];
  let gesture: Gesture | undefined;
  let lastTime = 0;
  let frameId = 0;
  let farmer = { ...HOME };
  let destination = farmer;
  let depart = 0;
  let duration = 0;
  let flip = false;
  let travelingUp = false;
  let stride = 0;
  let previousStep = -1;
  let lean = 0;
  let path: { from: Point; to: Point; distance: number }[] = [];
  let pathDistance = 0;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  const art = createRasterLibrary((key) => {
    if (key === 'water') {
      const image = art.image(key);
      if (image) water.setTexture(image);
    }
    if (key === `${state?.island ?? 'home'}-plate`) syncShore();
    requestPaint();
  }, abort.signal);

  function syncShore(): void {
    const island = state?.island ?? 'home';
    const image = art.image(`${island}-plate`);
    if (!image) return;
    const bounds = PLATES[island];
    water.setShore(image, {
      x: offset.x + bounds.x * scale, y: offset.y + bounds.y * scale,
      w: bounds.w * scale, h: bounds.h * scale,
    }, offset.y + (island === 'home' ? 330 : 390) * scale);
  }

  function currentSites(): Area[] {
    return state?.island === 'grove' ? groveSites : [...henSites, ...homeSites];
  }

  function paintProp(prop: Prop, shadow = false, time = 0): void {
    const bend = prop.art.endsWith('tree') ? Math.sin(time * 1.5 + prop.x * 0.021) * 0.022 : 0;
    art.draw(world, prop.art, prop.x, prop.y, prop.w, prop.h, {
      shadow, frame: prop.frame, flip: prop.flip, opacity: prop.opacity, bend,
    });
  }

  function paintShore(time: number, island: 'home' | 'grove'): void {
    const near = island === 'home'
      ? [[138, 813, 33, 3], [1380, 713, 31, 3]]
      : [[187, 704, 35, 3], [1203, 779, 37, 3]];
    for (const [x, y, w, frame] of near) {
      const bob = frame === 3 ? Math.sin(time * 1.4 + x) * 3 : 0;
      ripple(x, y + 1, w * 0.64, time + x);
      art.draw(world, 'shore', x, y + bob, w, w * 0.65, { frame, layer: -89 });
    }
  }

  function ripple(x: number, y: number, width: number, time: number): void {
    for (let i = 0; i < 2; i++) {
      const phase = (time * 0.57 + i * 0.5) % 1;
      world.shape('ripple', x, y, width * (0.62 + phase * 0.52), width * (0.15 + phase * 0.09),
        '#c0f9eb', 0.42 * (1 - phase), -90);
    }
  }

  function paintBed(bed: Bed, index: number, highlit: boolean, now: number): void {
    const x = BED.x + (index % 4) * BED.dx;
    const y = BED.y + Math.floor(index / 4) * BED.dy;
    const watered = bed.kind === 'crop' && bed.watered;
    const age = now - (impactByBed.get(index) ?? -1_000);
    const recoil = !motion.matches && age < 330 ? Math.sin(age * Math.PI / 330) : 0;
    const tint = watered ? '#422d25' : bed.kind === 'empty' ? '#fcd390' : '#683d24';
    const alpha = watered ? 0.40 : bed.kind === 'empty' ? 0.14 : bed.kind === 'tilled' ? 0.19 : 0.10;
    world.shape('shade', x + BED.w / 2, y + BED.h / 2, BED.w * 0.56, BED.h * 0.52, tint, alpha + 0.12 * recoil);
    if (watered) {
      for (let i = 0; i < 5; i++) {
        world.shape('ellipse', x + 10 + i * (BED.w - 20) / 4, y + BED.h * 0.75 - random(i + index) * 16,
          2.4, 0.9, '#c4e5e19b');
      }
    }
    if (highlit) {
      world.shape('outline', x + BED.w / 2, y + BED.h / 2 + 1, BED.w * 0.45, BED.h * 0.46, '#fff0b9b5');
    }
  }

  function growthFrame(bed: Extract<Bed, { kind: 'crop' }>, index: number, now: number): number {
    const readyAfter = cropDefinitions[bed.crop].days;
    const wateredAge = bed.watered && bed.wateredAt !== undefined
      ? Math.min(0.9, Math.max(0, (now - bed.wateredAt) / 45_000))
      : 0;
    const target = bed.growth >= readyAfter ? 8 : Math.min(7, (bed.growth + wateredAge) * 8 / readyAfter);
    const prior = growthFrames.get(index);
    const frame = motion.matches || prior?.crop !== bed.crop
      ? target
      : Math.min(target, prior.frame + Math.max(0, now - prior.time) / 420);
    growthFrames.set(index, { crop: bed.crop, frame, time: now });
    return frame;
  }

  function paintCrop(bed: Extract<Bed, { kind: 'crop' }>, index: number, progress: number, time: number): void {
    const frame = Math.floor(progress);
    const blend = progress - frame;
    const style = crops[bed.crop];
    const x = BED.x + (index % 4) * BED.dx + BED.w / 2;
    const y = BED.y + Math.floor(index / 4) * BED.dy + BED.h - 5;
    const key = `growth-${bed.crop}`;
    const flip = index % 2 === 0;
    const bend = Math.sin(time * 1.9 + index * 0.63) * 0.027;
    art.draw(world, key, x, y, style.w, style.h, { frame, flip, shadow: true, bend });
    art.draw(world, key, x, y, style.w, style.h, { frame, flip, bend });
    if (blend > 0) art.draw(world, key, x, y, style.w, style.h, { frame: frame + 1, flip, opacity: blend, bend });
  }

  function paintHint(area: Area | undefined): void {
    const label = area && inspect(area.target);
    hint.hidden = !label;
    if (!area || !label) return;
    if (hint.textContent !== label) hint.textContent = label;
    const x = offset.x + area.center.x * scale;
    const y = offset.y + (area.center.y - Math.min(area.h * 0.54, 57) - 10) * scale;
    hint.style.left = `${clamp(x, hint.offsetWidth / 2 + 10, viewport.width - hint.offsetWidth / 2 - 10)}px`;
    hint.style.top = `${Math.max(36, y)}px`;
  }

  function paintWaypoint(x: number, y: number, time: number, color: string): void {
    const lift = Math.sin(time * 2.3) * 3;
    world.shape('diamond', x, y + lift, 8, 8, '#614231', 1, world.overlay);
    world.shape('diamond', x, y + lift, 5.6, 5.6, color, 1, world.overlay + 1);
  }

  function moveTo(stop: Point): void {
    destination = stop;
    const points = roundTurns(state?.island === 'grove' ? grovePath(farmer, stop) : walkingPath(farmer, stop));
    path = points.slice(1).map((to, i) => {
      const from = points[i];
      return { from, to, distance: Math.hypot(to.x - from.x, to.y - from.y) };
    }).filter((segment) => segment.distance > 0);
    pathDistance = path.reduce((distance, segment) => distance + segment.distance, 0);
    depart = performance.now();
    previousStep = -1;
    duration = motion.matches || !pathDistance ? 0 : Math.min(1550, 160 + pathDistance * 1.65);
  }

  function advanceWork(now: number, moving: boolean): void {
    if (gesture) {
      const age = now - gesture.started;
      if (!gesture.hit && age >= WORK_MS[gesture.kind] * 0.55) {
        const { index, commit } = gesture.order;
        const bed = state?.beds[index];
        const { center } = areas[index + 4];
        gesture.hit = true;
        bursts.push({
          x: center.x, y: center.y + 16, from: { x: farmer.x - 23, y: farmer.y - 25 },
          kind: gesture.kind, crop: bed?.kind === 'crop' ? bed.crop : undefined, began: now,
        });
        impactByBed.set(index, now);
        commit();
      }
      if (age < WORK_MS[gesture.kind]) return;
      gesture = undefined;
    }
    const order = workOrders[0];
    if (moving || !order) return;
    const stop = areas[order.index + 4].stop;
    if (Math.hypot(farmer.x - stop.x, farmer.y - stop.y) > 1) {
      moveTo(stop);
      return;
    }
    workOrders.shift();
    const kind = order.next();
    if (kind === 'wait') order.commit();
    else gesture = { order, kind, started: now, hit: false };
  }

  function paintBursts(now: number): void {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const burst = bursts[i];
      const age = (now - burst.began) / 1000;
      if (age > 0.85) {
        bursts.splice(i, 1);
        continue;
      }
      const opacity = clamp((0.86 - age) / 0.53, 0, 1);
      const pulse = Math.min(1, age / 0.48);
      const size = 7 + (1 - (1 - pulse) ** 3) * 43;
      world.shape('outline', burst.x, burst.y, size, size * 0.30,
        burst.kind === 'water' ? '#c6fbef' : '#ffe69e', (1 - pulse) * 0.58);

      if (burst.kind === 'water') {
        for (let n = 0; n < 11; n++) {
          const flight = age * 2.65 - n * 0.047;
          if (flight < 0 || flight > 1) continue;
          const dx = burst.x + (random(n + 53) - 0.5) * 46 - burst.from.x;
          const dy = burst.y + (random(n + 18) - 0.5) * 19 - burst.from.y;
          world.shape('ellipse', burst.from.x + dx * flight, burst.from.y + dy * flight - 30 * flight * (1 - flight),
            1.7, 2.5, '#c3f9f1', opacity, world.overlay);
        }
      } else {
        const color = burst.kind === 'till' ? '#edc188' : '#f3daa4';
        for (let n = 0; n < 7; n++) {
          const direction = (random(n + 9) - 0.5) * 87;
          const lift = 10 + random(n + 41) * 43;
          world.shape(n % 3 === 0 ? 'diamond' : 'ellipse', burst.x + direction * age, burst.y - lift * age + 32 * age ** 2,
            1.4 + random(n) * 2.8, 1 + random(n) * 1.7, color, opacity, world.overlay);
        }
      }
      if (burst.kind === 'harvest' && burst.crop) {
        const x = burst.x + Math.sin(age * 4) * 9;
        const y = burst.y - Math.sin(Math.min(1, age / 0.76) * Math.PI * 0.58) * 54;
        art.draw(world, `item-${burst.crop}`, x, y, 25, 27, { opacity: clamp((0.85 - age) * 3, 0, 1), angle: age * 0.32, layer: world.overlay });
      }
    }
  }

  function paintFootfalls(now: number): void {
    for (let i = footfalls.length - 1; i >= 0; i--) {
      const step = footfalls[i];
      const t = (now - step.began) / 360;
      if (t >= 1) {
        footfalls.splice(i, 1);
        continue;
      }
      const alpha = (1 - t) ** 1.6;
      world.shape('shade', step.x, step.y, 5 + t * 8, 2 + t * 2, '#ffe1a3', 0.52 * alpha);
      world.shape('ellipse', step.x + step.side * (3 + t * 9), step.y - 2 - 9 * t + 5 * t * t,
        1.9, 1.5, '#ffedb0', 0.60 * alpha, 0, 0, step.y - 1);
    }
  }

  function paintButterflies(time: number, atHome: boolean): void {
    const centers = atHome ? [[472, 378], [1068, 566], [1135, 680]] : [[451, 392], [822, 444]];
    centers.forEach(([x, y], i) => {
      const phase = time * (0.72 + i * 0.09) + i * 3.1;
      const px = x + 35 * Math.sin(phase);
      const py = y + 13 * Math.sin(phase * 1.78) + 4 * Math.cos(time * 5 + i);
      art.draw(world, 'butterfly', px, py, 14 + i * 2, 12 + i, {
        frame: Math.floor(time * 8 + i) % 4, flip: Math.cos(phase) > 0, angle: 0.2 * Math.sin(phase), footY: y + 33,
      });
    });
  }

  function paint(time: number): void {
    const island = state?.island ?? 'home';
    const atHome = island === 'home';
    const dock = moorings[island];
    const now = Date.now();
    const moment = performance.now();
    const dt = motion.matches ? 0 : clamp((moment - (lastPhysics || moment - 16)) / 1000, 0.001, 0.05);
    lastPhysics = moment;
    const traveling = arrival ? clamp(1 - (moment - arrival) / 950, 0, 1) : 0;
    const boatX = dock.boatX - 255 * traveling * traveling;
    const swell = Math.sin(time * 1.7 + dock.boatX * 0.03) * 3.8 + Math.sin(time * 2.36 + 1) * 1.6;
    const boatY = dock.boatY + 80 * traveling + driveSpring(boatFloat, swell, dt, 8, 0.76);
    const boatAngle = driveSpring(boatRoll, Math.cos(time * 1.7 + dock.boatX * 0.03) * 0.051, dt, 10, 0.73);
    world.begin();
    paintShore(time, island);
    const plate = art.image(`${island}-plate`);
    if (plate) world.plate(plate, PLATES[island]);
    for (const { image, bounds } of cutouts[island]) world.occluder(image, bounds);
    if (atHome) art.draw(world, 'windmill-sails', 821, 213, 108, 108,
      { angle: time * 0.62, baseline: 0.5, footY: 326 });
    art.draw(world, 'boat', boatX, boatY, 105, 59, { flip: atHome, angle: boatAngle });
    const selected = hovered ?? (showFocus && focused
      ? currentSites().find((area) => sameTarget(area.target, focused!.target))
      : undefined);
    if (atHome) state?.beds.forEach((bed, index) => {
      paintBed(bed, index, selected?.target.kind === 'bed' && selected.target.index === index, moment);
    });
    const props: Prop[] = atHome ? [] : [{
      art: 'salt', ...saltCove, w: 68, h: 48, opacity: state?.saltGatheredToday ? 0.36 : 1,
    }];
    treeSpots[island].forEach(({ x, y }, index) => {
      const tree = state?.trees[island][index];
      if (!tree) {
        props.push({ art: 'stake', x, y, w: 26, h: 39 });
        return;
      }
      const age = Math.min(1, tree.age / treeDefinitions[tree.tree].days);
      const frame = age < 0.45 ? 0 : age < 1 ? 1 : tree.fruitReady > 0 ? 3 : 2;
      props.push({ art: `${tree.tree}tree`, x, y, w: 121, h: 127, frame, flip: index % 2 > 0 });
      if (tree.fruitReady > 0) {
        const color = tree.tree === 'apple' ? '#ffe998' : '#fff2af';
        paintWaypoint(x, y - 146, time + index * 0.4, color);
      }
    });
    for (const prop of props) {
      paintProp(prop, true, time);
      paintProp(prop, false, time);
    }
    const moving = duration > 0 && moment < depart + duration;
    if (moving) {
      const fraction = clamp((moment - depart) / duration, 0, 1);
      const distance = fraction * fraction * (3 - 2 * fraction) * pathDistance;
      stride = distance / 58;
      let traveled = distance;
      for (const segment of path) {
        if (traveled <= segment.distance) {
          const t = traveled / segment.distance;
          farmer = { x: segment.from.x + (segment.to.x - segment.from.x) * t, y: segment.from.y + (segment.to.y - segment.from.y) * t };
          const dx = segment.to.x - segment.from.x;
          const dy = segment.to.y - segment.from.y;
          if (Math.abs(dx) > 2) flip = dx > 0;
          travelingUp = dy < -Math.abs(dx) * 0.28;
          lean += (0.065 * dx / segment.distance - lean) * 0.19;
          break;
        }
        traveled -= segment.distance;
      }
    } else {
      farmer = destination;
      lean *= 0.67;
    }
    if (moving && traveling <= 0.12) {
      const step = Math.floor(stride * 2);
      if (step !== previousStep && stride > 0.15) {
        const side = step % 2 ? -1 : 1;
        footfalls.push({ x: farmer.x + side * 5, y: farmer.y, began: moment, side });
        previousStep = step;
      }
    }
    if (atHome) advanceWork(moment, moving);
    const biteAge = biteSince ? (moment - biteSince) / 1000 : 0;
    const bite = biteSince && !motion.matches ? Math.sin(Math.min(1, biteAge / 0.62) * Math.PI) ** 2 : 0;
    const bobber = fishing && !moving
      ? { x: farmer.x - 56 + 3 * bite, y: farmer.y + 35 + Math.sin(time * 2.5) * 3 + 5 * bite }
      : undefined;
    if (bobber && biteSince && biteAge < 0.72 && !motion.matches) {
      const spread = 8 + biteAge * 33;
      world.shape('ripple', bobber.x, bobber.y + 1, spread, spread * 0.39, '#e8fff1', 0.8 * (1 - biteAge / 0.72), -90);
    }
    water.paint(time, {
      x: offset.x + boatX * scale, y: offset.y + boatY * scale, speed: Math.min(1, traveling * 1.65),
    }, bobber && { x: offset.x + bobber.x * scale, y: offset.y + bobber.y * scale });
    function paintFarmer(): void {
      if (traveling > 0.12) return;
      const bob = moving ? Math.abs(Math.sin(stride * Math.PI * 2)) * 2.8 : 0;
      if (bobber) {
        world.fishingLine(farmer.x - 28, farmer.y - 25, bobber.x, bobber.y);
        world.float(bobber.x, bobber.y, time, bite);
        art.draw(world, 'fisher', farmer.x - 12, farmer.y, 74, 68, { shadow: true });
        art.draw(world, 'fisher', farmer.x - 12, farmer.y, 74, 68);
        return;
      }
      const pose = gesture && !moving ? gesture : undefined;
      const progress = pose ? clamp((moment - pose.started) / WORK_MS[pose.kind], 0, 0.999) : 0;
      const scaleY = moving ? 1 + Math.sin(stride * Math.PI * 4) * 0.018
        : pose ? 1 - Math.sin(progress * Math.PI) * 0.045 : 1 + Math.sin(time * 2.4) * 0.009;
      const key = pose ? (pose.kind === 'till' ? 'farmer-hoe' : `farmer-${pose.kind}`)
        : moving ? (travelingUp ? 'farmer-back' : 'farmer-walk')
        : motion.matches ? 'farmer' : 'farmer-idle';
      const rest = time % 3.8;
      const idleFrame = rest < 1.15 ? 0 : rest < 2.35 ? 1 : rest < 2.46 ? 2 : 3;
      const frame = pose ? Math.floor(progress * 6) : moving ? Math.floor(stride * 6) % 6 : idleFrame;
      const wholeCell = !pose && key !== 'farmer';
      const options = {
        frame: key === 'farmer' ? 0 : frame, flip: !pose && flip,
        fullCell: wholeCell, baseline: wholeCell ? 216 / 224 : 1,
        fixedRoot: Boolean(pose), angle: pose ? Math.sin(progress * Math.PI) * -0.035 : lean, scaleY,
      };
      const width = wholeCell ? 63 : pose ? 76 : 45;
      const height = wholeCell ? 74 : 67;
      world.shape('shade', farmer.x, farmer.y, 12, 4.8, '#4a4729', 0.26);
      art.draw(world, key, farmer.x, farmer.y, width, height, { ...options, shadow: true, lift: bob });
      if (!art.draw(world, key, farmer.x, farmer.y - bob, width, height, { ...options, footY: farmer.y })) {
        art.draw(world, 'farmer', farmer.x, farmer.y - bob, 45, 67, { flip, scaleY, footY: farmer.y });
      }
    }
    paintFarmer();
    henSites = [];
    if (atHome) hens.forEach((hen, index) => {
      const held = heldHen?.index === index && heldHen.dragging ? heldHen : undefined;
      const targetX = held?.point.x ?? clamp(hen.x + Math.sin(time * 0.83 + index * 2) * 13, 207, 378);
      const targetY = held?.point.y ?? clamp(hen.y + Math.cos(time * 0.89 + index) * 8, 594, 649);
      const x = clamp(driveSpring(hen.px, targetX, dt, held ? 23 : 14, 0.82), 207, 378);
      const y = clamp(driveSpring(hen.py, targetY, dt, held ? 23 : 14, 0.82), 594, 649);
      const joy = Math.max(0, hen.excited - moment);
      const playful = Boolean(held) || joy > 0;
      const key = playful ? 'henplay' : motion.matches ? 'hen' : 'henwalk';
      const frame = held ? Math.floor(time * 7) % 4
        : playful ? Math.min(3, Math.floor((950 - joy) / 238)) : motion.matches ? 0 : Math.floor(time * 7 + index) % 4;
      const lift = driveSpring(hen.lift, held && !motion.matches ? 20 : 0, dt, 16, 0.61);
      if (hen.lift.value < 0) {
        hen.lift.value = 0;
        hen.lift.speed = Math.abs(hen.lift.speed) > 8 ? Math.abs(hen.lift.speed) * 0.29 : 0;
      }
      const facing = Math.abs(hen.px.speed) > 1 ? hen.px.speed > 0 : Math.cos(time * 0.83 + index * 2) > 0;
      const angle = clamp(hen.px.speed * 0.001, -0.13, 0.13);
      const scaleY = clamp(1 - hen.lift.speed * 0.001, 0.91, 1.07);
      henSites.push({ target: { kind: 'hen', index }, center: { x, y: y - 14 - Math.max(0, lift) }, stop: { x, y }, w: 34, h: 38 });
      const elevation = Math.max(0, lift);
      world.shape('shade', x, y, 10 + elevation * 0.12, 3.9, '#47462a', 0.25 / (1 + elevation * 0.04));
      art.draw(world, key, x, y, 30, 34, { frame, flip: facing, shadow: true, lift: elevation });
      art.draw(world, key, x, y - elevation, 30, 34, { frame, flip: facing, angle, scaleY, footY: y });
      if (joy) {
        const progress = 1 - joy / 950;
        const pop = 0.72 + 0.42 * Math.sin(Math.min(1, progress * 3.7) * Math.PI * 0.73);
        art.draw(world, 'heart', x + 10, y - 44 - progress * 19, 18 * pop, 17 * pop,
          { opacity: Math.min(1, joy / 260), angle: -0.17 + progress * 0.28, layer: world.overlay });
      }
    });
    if (atHome) state?.beds.forEach((bed, index) => {
      if (bed.kind !== 'crop') {
        growthFrames.delete(index);
        return;
      }
      const frame = growthFrame(bed, index, now);
      paintCrop(bed, index, frame, time);
    });
    if (atHome) state?.beds.forEach((bed, index) => {
      if (bed.kind !== 'crop' || bed.growth < cropDefinitions[bed.crop].days) return;
      const x = BED.x + (index % 4) * BED.dx + BED.w - 5;
      const y = BED.y + Math.floor(index / 4) * BED.dy + BED.h - 1;
      art.draw(world, 'harvest-marker', x, y + Math.sin(time * 2.1 + index) * 1.1, 18, 18, { layer: world.overlay });
    });
    paintButterflies(time, atHome);
    if (!motion.matches) paintFootfalls(moment);
    paintBursts(moment);
    const phase = state && getDayPhase(state);
    const wash = phase === 'Evening' ? '#6f49662b' : phase === 'Afternoon' ? '#e9b24c12' : undefined;
    if (wash) world.wash(wash);
    if (atHome && state && getGoal(state)?.id === 'till' && state.beds[0]?.kind === 'empty' && selected !== areas[4]) {
      paintWaypoint(BED.x + BED.w / 2, BED.y - 10, time, '#fff0a4');
    }
    if (atHome && state?.eggsReady && !fieldView) {
      art.draw(world, 'egg', 348, 598, 13, 17, { shadow: true });
      art.draw(world, 'egg', 348, 598, 13, 17);
    }
    paintHint(selected);
    world.render();
  }

  function tick(now: number): void {
    const interval = 1000 / 60;
    const elapsed = now - lastTime;
    if (elapsed >= interval - 0.5) {
      lastTime = elapsed > 100 ? now : now - Math.max(0, elapsed - interval);
      paint(motion.matches ? 0 : now / 1000);
    }
    if (!motion.matches) frameId = requestAnimationFrame(tick);
  }

  function requestPaint(): void {
    if (motion.matches) paint(0);
  }

  function resize(): void {
    viewport = { width: Math.max(1, canvas.clientWidth), height: Math.max(1, canvas.clientHeight) };
    const wide = Math.min(viewport.width / WORLD.w, viewport.height / WORLD.h);
    scale = fieldView ? Math.min(viewport.width / 575, viewport.height / 580) : wide;
    const center = fieldView ? { x: 720, y: 531 } : { x: WORLD.w / 2, y: WORLD.h / 2 };
    offset = { x: viewport.width / 2 - center.x * scale, y: viewport.height / 2 - center.y * scale };
    world.resize(viewport.width, viewport.height, window.devicePixelRatio || 1, scale, center);
    syncShore();
    hovered = undefined;
    requestPaint();
  }

  function location(event: PointerEvent): Point {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left - offset.x) / scale;
    const y = (event.clientY - bounds.top - offset.y) / scale;
    return { x, y };
  }

  function hit(event: PointerEvent): Area | undefined {
    if (!world.available) return undefined;
    const { x, y } = location(event);
    return currentSites().find((area) => (!fieldView || area.target.kind === 'bed')
      && Math.abs(x - area.center.x) <= area.w / 2 && Math.abs(y - area.center.y) <= area.h / 2);
  }

  function describeFocus(): void {
    canvas.setAttribute('aria-label', focused
      ? `Island. ${inspect(focused.target)}. Use arrow keys to choose another spot and Enter to act.`
      : 'Island. Use arrow keys to choose a spot and Enter to act.');
  }

  const listeners = { signal: abort.signal };
  canvas.tabIndex = 0;
  canvas.addEventListener('pointermove', (event) => {
    if (heldHen && pointerStart?.id === event.pointerId) {
      const point = location(event);
      heldHen.point = { x: clamp(point.x, 207, 378), y: clamp(point.y + 12, 594, 649) };
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) {
        heldHen.dragging = true;
        hovered = undefined;
        canvas.style.cursor = 'grabbing';
        requestPaint();
      }
      return;
    }
    if (event.pointerType === 'touch') return;
    hovered = hit(event);
    canvas.style.cursor = hovered?.target.kind === 'hen' ? 'grab' : hovered ? 'pointer' : 'default';
    requestPaint();
  }, listeners);
  canvas.addEventListener('pointerleave', () => {
    hovered = undefined;
    requestPaint();
  }, listeners);
  canvas.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    const target = hit(event)?.target;
    if (target?.kind === 'hen') {
      heldHen = { index: target.index, point: location(event), dragging: false };
      canvas.setPointerCapture(event.pointerId);
    }
  }, listeners);
  canvas.addEventListener('pointercancel', (event) => {
    if (pointerStart?.id !== event.pointerId) return;
    pointerStart = undefined;
    heldHen = undefined;
    requestPaint();
  }, listeners);
  canvas.addEventListener('pointerup', (event) => {
    const start = pointerStart;
    if (start?.id !== event.pointerId) return;
    const held = heldHen;
    pointerStart = undefined;
    heldHen = undefined;
    if (held) {
      const hen = hens[held.index];
      if (held.dragging) Object.assign(hen, held.point);
      activate({ kind: 'hen', index: held.index });
      canvas.style.cursor = 'grab';
      requestPaint();
      return;
    }
    if (Math.hypot(start.x - event.clientX, start.y - event.clientY) > 12) return;
    const target = hit(event);
    if (target) {
      focused = target;
      showFocus = false;
      activate(target.target);
    }
  }, listeners);
  canvas.addEventListener('focus', () => {
    showFocus = canvas.matches(':focus-visible');
    focused ??= state?.island === 'grove' ? groveSites[0] : areas[4];
    describeFocus();
    requestPaint();
  }, listeners);
  canvas.addEventListener('blur', () => {
    showFocus = false;
    requestPaint();
  }, listeners);
  canvas.addEventListener('keydown', (event) => {
    if (!world.available) return;
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    hovered = undefined;
    showFocus = true;
    focused ??= state?.island === 'grove' ? groveSites[0] : areas[4];
    if (direction) {
      const origin = focused.center;
      const [dx, dy] = direction;
      let score = Infinity;
      for (const area of currentSites()) {
        if (fieldView && area.target.kind !== 'bed') continue;
        const x = area.center.x - origin.x;
        const y = area.center.y - origin.y;
        const forward = x * dx + y * dy;
        const sideways = Math.abs(x * dy - y * dx);
        const distance = forward + 2.7 * sideways;
        if (forward > 0 && distance < score) {
          focused = area;
          score = distance;
        }
      }
    } else if (!event.repeat) {
      activate(focused.target);
    }
    describeFocus();
    requestPaint();
  }, listeners);
  motion.addEventListener('change', () => {
    cancelAnimationFrame(frameId);
    if (motion.matches) {
      duration = 0;
      const active = gesture;
      const queued = workOrders;
      gesture = undefined;
      workOrders = [];
      if (active && !active.hit) active.order.commit();
      for (const order of queued) order.commit();
      paint(0);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }, listeners);

  for (const key of ['home-plate', 'grove-plate', 'water']) art.load(key, key);
  for (const island of ['home', 'grove'] as const) {
    for (const bounds of occluders[island]) {
      const image = new Image();
      image.addEventListener('load', () => {
        cutouts[island].push({ image, bounds });
        requestPaint();
      }, { ...listeners, once: true });
      image.src = bounds.url;
    }
  }
  for (const key of sprites) art.load(key, key, [1, 1]);
  for (const key of ['henwalk', 'henplay', 'shore', 'butterfly', 'farmer-idle']) art.load(key, key, [2, 2]);
  for (const tree of ['apple', 'pear', 'peach']) art.load(`${tree}tree`, `${tree}tree-v2`, [2, 2], 'none');
  for (const key of ['farmer-walk', 'farmer-back', 'farmer-hoe', 'farmer-plant', 'farmer-water', 'farmer-harvest']) art.load(key, key, [3, 2]);
  for (const crop of Object.keys(crops)) art.load(`growth-${crop}`, `growth-${crop}-v2`, [3, 3], 'saturate(0.96) contrast(0.98)');
  for (const crop of Object.keys(crops)) art.load(`item-${crop}`, `icons/${crop}`, [1, 1]);
  art.load('egg', 'icons/egg', [1, 1]);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  describeFocus();
  resize();
  frameId = requestAnimationFrame(tick);
  return {
    render(next: FarmState): void {
      if (currentIsland !== next.island) {
        arrival = currentIsland && !motion.matches ? performance.now() : 0;
        currentIsland = next.island;
        const dock = moorings[next.island];
        farmer = destination = next.island === 'home' && !state ? HOME : { x: dock.x, y: dock.y - 10 };
        duration = 0;
        workOrders = [];
        gesture = undefined;
        footfalls.length = 0;
        focused = undefined;
        hovered = undefined;
      }
      state = next;
      syncShore();
      describeFocus();
      requestPaint();
    },
    visit(target: IslandTarget): void {
      workOrders = [];
      gesture = undefined;
      if (target.kind === 'hen') {
        const hen = hens[target.index];
        hen.excited = performance.now() + 950;
        if (!motion.matches && hen.lift.value < 2) hen.lift.speed = 240;
        requestPaint();
        return;
      }
      const stop = currentSites().find((area) => sameTarget(area.target, target))?.stop;
      if (!stop) return;
      moveTo(stop);
      requestPaint();
    },
    workBed(index: number, next: WorkOrder['next'], commit: WorkOrder['commit']): void {
      const area = areas[index + 4];
      if (area?.target.kind !== 'bed' || state?.island !== 'home') return;
      if (motion.matches) {
        moveTo(area.stop);
        commit();
        return;
      }
      if (workOrders[0]?.index !== index) {
        workOrders = [];
        if (!gesture) moveTo(area.stop);
      }
      if (workOrders.length < 3) workOrders.push({ index, next, commit });
    },
    toggleFieldView(): boolean {
      fieldView = !fieldView;
      if (fieldView && focused?.target.kind !== 'bed') focused = areas[4];
      resize();
      describeFocus();
      return fieldView;
    },
    setFishing(active: boolean): void {
      fishing = active;
      if (!active) biteSince = 0;
      requestPaint();
    },
    setFishingBite(ready: boolean): void {
      biteSince = ready ? performance.now() : 0;
      requestPaint();
    },
    destroy(): void {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      abort.abort();
      world.dispose();
      hint.remove();
      unavailable.remove();
    },
  };
}
