import { playBaySound } from './game-sound'
import { bayAudio } from './bay-audio'
import { chickenCount, cropDefinitions, getCapeBloom, getCapeHoney, getDayPhase, getFairGuest, getGoal, getHarborOrder, getShoreItem, hasBayDisplay, isHoneyWind, isProjectComplete, treeDefinitions, type Bed, type BedAction, type BuildingId, type CropId, type FarmState, type ProjectId, type ShoreTarget, type ResidentId, residentIds, getVillageHomeCount } from './farm';
import { cookeryFinishTraits, type SignatureRecipe } from './culinary';
import { finishedIngredient } from './ingredient-finish';
import { createRasterLibrary } from './raster';
import { createWorld } from './world';
import { beach, buildingUpgrades, cape, capeBuildings, capeKitchenSteam, capeKitchenStop, docks, landscape, orchard, plots, projectStages, saltCove, scenePoint, sceneScale, shoal, shoalPlate, specializationStages, village, windmillSails } from './lavender-layout';
import { getClimate } from './climate';
import { createWeatherEffects } from './weather-effects';
import { isLunarTide } from './tide';
import { hasShoal, shoalFindIds } from './shoal';
import { createSupportShadow, type SupportShadow } from './support-shadow';
import { festivalRewardArt } from './festival-art';
import { defaultHenPositions, henIdlePoint, projectHenToGround, type HenNativePoint } from './hen-roaming';
import { getCoveEcology } from './shoreline';
import { createCoveMotion, stepCoveMotion, coveChannelPoint, coveSceneAnchors } from './shoreline-view';
import { getNeighborPlans } from './farm';
import { getNeighborSceneState, neighborWorkFrame, neighborPropSettle, neighborFoodArt, stepNeighborWalker, type NeighborScenePlan } from './neighbor-scene';
import { harbourCamera, harbourPointVisible, harbourViewForPoint, harbourRouteNeedsOverview, harbourFocus, type HarbourView, type HarbourViewport } from './harbour-view';
import { createVillageHomePlates, villageHomeArtKey, villageHomeStages } from './village-home-art';

export type IslandTarget =
  | { kind: 'bed' | 'tree' | 'hen' | 'flower' | 'village-home'; index: number }
  | ShoreTarget
  | { kind: 'neighbor'; resident: ResidentId }
  | { kind: 'well' | 'coop' | 'market' | 'farmhouse' | 'kitchen' | 'pier' | 'boat' | 'harbor' | 'salt' | 'cove' | 'tidepool' | 'hive' | 'honey-kitchen' | 'guest' | 'bay-display' | 'bay-shop' | 'bay-music' | 'bay-freight' | 'workshop' | 'village' | 'village-meal' };

type Point = { x: number; y: number };
type Area = { target: IslandTarget; center: Point; w: number; h: number; stop: Point };
type ShoreArea = Area & { target: ShoreTarget; foot: Point; angle: number };
type Prop = { art: string; x: number; y: number; w: number; h: number; frame?: number; baseline?: number; opacity?: number };
type WorkOrder = { index: number; next: () => BedAction['kind']; commit: () => void };
type GestureKind = Exclude<BedAction['kind'], 'wait'>;
type Gesture = { order: WorkOrder; kind: GestureKind; started: number; hit: boolean };
type Burst = { x: number; y: number; from: Point; kind: GestureKind; crop?: CropId; began: number };
type Footfall = { x: number; y: number; began: number; side: number };
type Spring = { value: number; speed: number };
type CapeWork = { target: { kind: 'flower'; index: number } | { kind: 'hive' | 'honey-kitchen' }; commit: () => boolean; reward?: string; began?: number; hit: boolean };

const servedJars = new WeakMap<SignatureRecipe, HTMLImageElement | HTMLCanvasElement>();
const WORLD = { w: 1440, h: 900 };
const HOME = scenePoint(1174, 585);
const sceneOrigin=scenePoint(0,0);
const nativeHenPoint=(point:Point):HenNativePoint=>({x:(point.x-sceneOrigin.x)/sceneScale,y:(point.y-sceneOrigin.y)/sceneScale});
const WORK_MS = { till: 510, plant: 500, water: 680, harvest: 550 } satisfies Record<GestureKind, number>;
const cropSizes: Record<CropId, [number, number]> = {
  carrot: [81, 89], cabbage: [118, 106], beetroot: [80, 91],
  tomato: [85, 109], pumpkin: [143, 123], wheat: [85, 107], leafyGreens: [93, 99],
  strawberry: [98, 98], blueberry: [118, 118], raspberry: [121, 121],
};

const areas: Area[] = [
  { target: { kind: 'farmhouse' }, center: scenePoint(353, 228), w: 216, h: 230, stop: scenePoint(353, 392) },
  { target: { kind: 'well' }, center: scenePoint(689, 260), w: 103, h: 138, stop: scenePoint(688, 367) },
  { target: { kind: 'market' }, center: scenePoint(1245, 281), w: 188, h: 148, stop: scenePoint(1242, 405) },
  { target: { kind: 'coop' }, center: scenePoint(280, 545), w: 135, h: 130, stop: scenePoint(445, 706) },
  ...plots.map((plot, index): Area => ({
    target: { kind: 'bed', index }, center: plot.center, w: plot.w, h: plot.h, stop: plot.stop,
  })),
];

function orchardAreas(island: 'home' | 'grove'): Area[] {
  const dock = docks[island];
  const middle = (dock.entry.y + dock.end.y) / 2;
  return [
    ...orchard[island].map((spot, index): Area => ({
      target: { kind: 'tree', index }, center: { x: spot.x, y: spot.y - 42 },
      w: 112, h: 112, stop: { x: spot.x - 23, y: spot.y + 15 },
    })),
    { target: { kind: 'pier' }, center: { x: dock.end.x, y: middle }, w: 83, h: 102, stop: dock.end },
    { target: { kind: 'boat' }, center: { x: dock.boat.x, y: dock.boat.y - 22 }, w: 116, h: 56, stop: dock.end },
  ];
}

const homeSites = [...areas, ...orchardAreas('home')];
const feedStation=scenePoint(345,650);
const feedStationSite:Area={target:{kind:'coop'},center:{x:feedStation.x,y:feedStation.y-14},stop:areas[3].stop,w:34,h:34};
const homeWorkshopSite: Area = { target: { kind: 'workshop' }, center: scenePoint(1153, 369),
  stop: scenePoint(1110, 429), w: 75, h: 64 };
const villageProjectSite: Area = { target: { kind: 'village' }, center: scenePoint(1249, 365),
  stop: scenePoint(1215, 432), w: 78, h: 64 };
const harbourPlacesOnMap = [
  {kind:'bay-shop',art:'bay-pavilion',x:1195,y:513,w:151,h:155,stop:village.lookout},
  {kind:'bay-music',art:'bay-pergola',x:790,y:381,w:210,h:195,stop:village.square},
] as const
const villageSites: Area[] = [
  ...harbourPlacesOnMap.map((place):Area=>({target:{kind:place.kind},center:scenePoint(place.x,place.y-place.h*.44),
    stop:place.stop,w:place.w*sceneScale,h:place.h*sceneScale})),
  ...village.homes.map((stop, index): Area => ({ target: { kind: 'village-home', index },
    center: { x: stop.x, y: stop.y - 100 }, stop, w: 191, h: 211 })),
  { target: { kind: 'workshop' }, center: scenePoint(382, 516), stop: village.workshop, w: 272, h: 185 },
  { target: { kind: 'village-meal' }, center: scenePoint(979, 604), stop: village.table, w: 228, h: 113 },
  { target: { kind: 'village' }, center: village.square, stop: village.square, w: 79, h: 54 },
  { target: { kind: 'boat' }, center: { x: docks.village.boat.x, y: docks.village.boat.y - 22 },
    stop: docks.village.end, w: 116, h: 56 },
];

// The graph follows the plate's front stone paths. No route crosses a building or the table.
const villageWalkNodes = [
  [439,357], [535,380], [632,419], [715,470], [803,470], [983,448], [1067,392], [1160,357],
  [644,520], [617,574], [597,610], [620,675], [787,704], [1012,738], [1158,680], [1200,614], [1222,561],
  [570,675], [452,700], [367,739], [367,877],
].map(([x,y]) => scenePoint(x,y));
const villageWalkEdges = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],
  [3,8],[8,9],[9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],[16,5],
  [11,17],[17,18],[18,19],[19,20]] as const;

function villagePath(from: Point, to: Point): Point[] {
  const nearest = (point: Point) => villageWalkNodes.reduce((best, entry, index) =>
    distance(point, entry) < distance(point, villageWalkNodes[best]) ? index : best, 0);
  const start = nearest(from), end = nearest(to);
  const costs = villageWalkNodes.map(() => Infinity);
  const previous = villageWalkNodes.map(() => -1);
  const remaining = new Set(villageWalkNodes.map((_, index) => index));
  costs[start] = 0;
  while (remaining.size) {
    const current = [...remaining].reduce((best, index) => costs[index] < costs[best] ? index : best);
    remaining.delete(current);
    if (current === end) break;
    for (const [a,b] of villageWalkEdges) {
      const next = a === current ? b : b === current ? a : -1;
      if (next < 0 || !remaining.has(next)) continue;
      const cost = costs[current] + distance(villageWalkNodes[current], villageWalkNodes[next]);
      if (cost < costs[next]) { costs[next] = cost; previous[next] = current; }
    }
  }
  const indices = [end];
  while (indices[0] !== start && previous[indices[0]] >= 0) indices.unshift(previous[indices[0]]);
  return [from, ...indices.map((index) => villageWalkNodes[index]), to];
}

type VillageActor = {
  id: ResidentId; slot: number; point: Point; route: Point[]; facingRight: boolean;
  stride: number; waitUntil: number; circuit: number; serviceRequested: boolean;
  serviceUntil: number; gathering: boolean; mealUntil: number;
  plan?: NeighborScenePlan; planKey: string; atStationSince: number; fetching: boolean;
};
const kitchenWingX = scenePoint(472, 0).x;
const kitchenSite: Area = {
  target: { kind: 'kitchen' }, center: scenePoint(538, 285), w: 93, h: 120, stop: scenePoint(528, 396),
};
const groveSites: Area[] = [
  ...orchardAreas('grove'),
  { target: { kind: 'salt' }, center: { x: saltCove.foot.x, y: saltCove.foot.y - 20 }, w: 99, h: 74, stop: saltCove.stop },
  { target: { kind: 'cove' }, center: scenePoint(1320, 700), stop: saltCove.stop, w: 70, h: 40 },
];
const harborSite: Area = {
  target: { kind: 'harbor' }, center: scenePoint(469, 810), w: 44, h: 44, stop: docks.grove.end,
};
const tidepoolSite: Area = { target: { kind: 'tidepool' }, center: shoal.pools[1], stop: shoal.look, w: 42, h: 24 };
const capeSites: Area[] = [
  ...cape.flowers.map((center, index): Area => ({ target: { kind: 'flower', index }, center,
    stop: { x: center.x + 12, y: center.y + 44 }, w: 131, h: 78 })),
  { target: { kind: 'hive' }, center: { x: cape.hive.x, y: cape.hive.y - 38 }, stop: cape.hiveStop, w: 174, h: 179 },
  { target: { kind: 'honey-kitchen' }, center: { x: capeBuildings.kitchen.x, y: capeBuildings.kitchen.y - capeBuildings.kitchen.h * 0.42 },
    stop: capeKitchenStop, w: capeBuildings.kitchen.w * 0.85, h: capeBuildings.kitchen.h * 0.9 },
  { target: { kind: 'boat' }, center: { x: docks.cape.boat.x, y: docks.cape.boat.y - 22 }, stop: docks.cape.end, w: 116, h: 56 },
];
const apiarySite: Area = { target: { kind: 'hive' },
  center: { x: capeBuildings.apiary.x, y: capeBuildings.apiary.y - capeBuildings.apiary.h * 0.42 },
  stop: scenePoint(995, 410), w: capeBuildings.apiary.w * 0.9, h: capeBuildings.apiary.h * 0.85 };
const guestSite: Area = { target: { kind: 'guest' }, center: scenePoint(1153, 438), stop: scenePoint(1116, 502), w: 55, h: 82 };
const guestFoot = scenePoint(1153, 478);
const displayFoot = scenePoint(545, 720);
const displayShadow: SupportShadow = {
  width: 128, height: 128, baseline: 118 / 128, castHeight: 76,
  contacts: [{ x: 40, y: 118, rx: 10, ry: 3 }, { x: 88.5, y: 112, rx: 10, ry: 3 }],
};
const displaySite: Area = { target: { kind: 'bay-display' }, center: { x: displayFoot.x, y: displayFoot.y - 26 },
  stop: { x: displayFoot.x + 24, y: displayFoot.y + 15 }, w: 46, h: 59 };
const shoreSites: ShoreArea[] = [
  ...beach.shells.map((point, index): ShoreArea => ({
    target: { kind: 'shell', index }, foot: point, center: { x: point.x, y: point.y - 9 },
    stop: { x: point.x - 17, y: point.y + 9 }, angle: (index - 1) * 0.15, w: 44, h: 34,
  })),
  ...shoalFindIds.map((id): ShoreArea => ({
    target: { kind: 'shoal-find', id }, foot: shoal[id], center: { x: shoal[id].x, y: shoal[id].y - 9 },
    stop: { x: shoal[id].x - 14, y: shoal[id].y + 8 }, angle: 0, w: 42, h: 34,
  })),
];
const pickupDuration = 370;

export const farmSoundEvents = [
  'field.till', 'field.seed', 'field.can-pour', 'field.can-soil', 'field.irrigation', 'field.root-pull',
  'field.firm-pick', 'field.pumpkin', 'field.leaf-pick', 'field.grain-pick', 'field.berry-pick',
  'field.refill', 'field.step', 'flock.stroke', 'flock.lift', 'flock.settle', 'flock.feed', 'flock.eggs',
  'flock.hatch', 'gather.shell', 'gather.find', 'gather.salt', 'orchard.sapling', 'orchard.firm-pick', 'orchard.soft-pick', 'apiary.frame',
] as const;

function sameTarget(a: IslandTarget, b: IslandTarget): boolean {
  if (a.kind === 'neighbor') return b.kind === 'neighbor' && a.resident === b.resident;
  if (a.kind === 'shoal-find') return b.kind === 'shoal-find' && a.id === b.id;
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

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function walkingPath(from: Point, to: Point): Point[] {
  const left = scenePoint(460, 0).x;
  const right = scenePoint(1118, 0).x;
  const top = scenePoint(0, 392).y;
  const bottom = scenePoint(0, 766).y;
  const dock = docks.home;
  const onDock = (p: Point) => p.y > bottom && Math.abs(p.x - dock.end.x) < 34;
  const start = onDock(from) ? dock.entry : from;
  const end = onDock(to) ? dock.entry : to;
  const exits = (p: Point): Point[] => {
    if (p.x <= left + 8) return [{ x: left, y: p.y }];
    if (p.x >= right - 8) return [{ x: right, y: p.y }];
    return [{ x: left, y: p.y }, { x: right, y: p.y }];
  };
  const candidates: Point[][] = [];
  if (Math.abs(start.y - end.y) < 4 || (start.x > right && end.x > right)) candidates.push([start, end]);
  for (const a of exits(start)) for (const b of exits(end)) {
    if (a.x === b.x) candidates.push([start, a, b, end]);
    else for (const y of [top, bottom]) candidates.push([start, a, { x: a.x, y }, { x: b.x, y }, b, end]);
  }
  const length = (points: Point[]) => points.slice(1).reduce((total, point, i) => total + distance(points[i], point), 0);
  candidates.sort((a, b) => length(a) - length(b));
  return [from, ...candidates[0], to];
}

function grovePath(from: Point, to: Point): Point[] {
  const dock = docks.grove;
  const onDock = (p: Point) => p.y > dock.entry.y && Math.abs(p.x - dock.end.x) < 32;
  const onShoal = (p: Point) => p.x > shoal.entry.x + 21 && p.y > shoal.entry.y - 8;
  const fromShoal = onShoal(from);
  const toShoal = onShoal(to);
  if (fromShoal && toShoal) {
    const turns = shoal.path.filter(({ x }) => x > Math.min(from.x, to.x) && x < Math.max(from.x, to.x));
    return [from, ...(from.x < to.x ? turns : turns.reverse()), to];
  }
  const start = fromShoal ? shoal.entry : onDock(from) ? dock.entry : from;
  const end = toShoal ? shoal.entry : onDock(to) ? dock.entry : to;
  const exit = fromShoal ? shoal.path.filter(({ x }) => x < from.x).reverse() : [];
  const enter = toShoal ? shoal.path.filter(({ x }) => x < to.x) : [];
  const pool = scenePoint(1328, 694);
  const turn = scenePoint(1224, 747);
  const path = clearsEllipse(start, end, pool, 72, 28) ? groveLandPath(start, end)
    : [...groveLandPath(start, turn), ...groveLandPath(turn, end).slice(1)];
  return [from, ...exit, ...path, ...enter, to];
}

function clearsEllipse(a: Point, b: Point, center: Point, radiusX: number, radiusY: number): boolean {
  const x = (a.x - center.x) / radiusX;
  const y = (a.y - center.y) / radiusY;
  const dx = (b.x - a.x) / radiusX;
  const dy = (b.y - a.y) / radiusY;
  const length = dx * dx + dy * dy;
  const t = length ? clamp(-(x * dx + y * dy) / length, 0, 1) : 0;
  return (x + dx * t) ** 2 + (y + dy * t) ** 2 >= 1;
}

function groveLandPath(from: Point, to: Point): Point[] {
  // The central rocks sit across the direct route from the pier to the salt cove.
  const rock = scenePoint(731, 723);
  const radiusX = 98 * sceneScale;
  const radiusY = 39 * sceneScale;
  const clearsRocks = (a: Point, b: Point) => clearsEllipse(a, b, rock, radiusX, radiusY);
  if (clearsRocks(from, to)) return [from, to];
  const routes: { points: Point[]; length: number }[] = [];
  for (const y of [651, 775]) {
    const left = scenePoint(603, y);
    const right = scenePoint(865, y);
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
  { inspect, activate, moveHen, harbourViewChanged }: { harbourViewChanged?: (view: HarbourView, traveling: boolean) => void; inspect: (target: IslandTarget) => string; activate: (target: IslandTarget, henGesture?: 'stroke' | 'settle') => void; moveHen?: (index:number,point:HenNativePoint)=>void },
) {
  const hint = document.createElement('div');
  hint.className = 'island-hint';
  hint.hidden = true;
  hint.setAttribute('aria-hidden', 'true');
  const unavailable = document.createElement('div');
  unavailable.className = 'island-render-status';
  unavailable.setAttribute('role', 'status');
  const crossingVeil = document.createElement('div');
  crossingVeil.className = 'island-crossing';
  crossingVeil.hidden = true;
  crossingVeil.setAttribute('aria-hidden', 'true');
  canvas.after(hint, unavailable, crossingVeil);
  const world = createWorld(canvas, (ready) => {
    unavailable.hidden = ready;
    canvas.setAttribute('aria-disabled', String(!ready));
    if (ready) requestPaint();
  });
  const water = world.water;
  const weatherEffects = createWeatherEffects(world);
  unavailable.hidden = world.available;
  canvas.setAttribute('aria-disabled', String(!world.available));
  unavailable.textContent = 'Для отображения острова нужен WebGL2. При временном сбое графики сцена восстановится после подключения.';
  const cutouts = { home: [], grove: [], cape: [], village: [] } as Record<FarmState['island'], { image: HTMLImageElement; bounds: typeof landscape.home.occluders[number] }[]>;
  let scale = 1;
  let offset: Point = { x: 0, y: 0 };
  let viewport = { width: 1, height: 1 };
  let state: FarmState | undefined;
  let currentIsland: FarmState['island'] | undefined;
  let focused: Area | undefined;
  let guidance: { target: IslandTarget; island: FarmState['island'] } | undefined;
  let hovered: Area | undefined;
  let showFocus = false;
  let fieldView = false;
  let harbourView: HarbourView = 'overview';
  let harbourJourney = false;
  let harbourInsets = { top: 210, bottom: 100 };
  const harbourViewport = (): HarbourViewport => ({ ...viewport, ...harbourInsets });
  let coveFocus = false;
  let coveBlend = 0;
  let pointerStart: { id: number; x: number; y: number } | undefined;
  let heldHen: { index: number; point: Point; offset:Point; dragging: boolean } | undefined;
  let shorePickup: { site: ShoreArea; began?: number; commit: () => boolean } | undefined;
  let shoreReward: { point: Point; icon: string; began: number } | undefined;
  let shoalRequested = false;
  let shoalKnown = false;
  let shoalReveal = 0;
  let shoalRevealPending = false;
  const villageActors = new Map<ResidentId, VillageActor>();
  let villageMealSeen = 0;
  const residentServiceSeen: Record<ResidentId, number> = { bea: 0, finn: 0 };
  let villageWelcome = 0;
  let villageBuiltSeen = false;
  let villageMealCelebration = 0;
  let residentClock = 0;
  let villageTableCutout: HTMLCanvasElement | undefined;
  const villageHomePlate = createVillageHomePlates();
  let guestServed = false;
  let guestDeparture = 0;
  let honeyReward = 0;
  let kitchenReward: { icon: string; began: number } | undefined;
  let capeLevelSeen = 1;
  let capeBuild: { level: number; began: number } | undefined;
  let capeWork: CapeWork | undefined;
  const flowerPlanted = new Map<number, number>();
  let crossing = false;
  let departure = 0;
  const coveMotion = createCoveMotion();
  const hens = defaultHenPositions.map((point) => {
    const { x, y } = scenePoint(point.x,point.y);
    return { x, y, px: spring(x), py: spring(y), lift: spring(0), excited: 0, gait: 0, facingRight: true, saved:undefined as HenNativePoint|null|undefined };
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
  const celebrationSparks: { x: number; y: number; spread: number; began: number }[] = [];
  const maskPixels = new Map<HTMLImageElement, ImageData>();
  const supportShadows = new Map<string, ReturnType<typeof createSupportShadow>>();
  const footfalls: Footfall[] = [];
  let workOrders: WorkOrder[] = [];
  let gesture: Gesture | undefined;
  let lastTime = 0;
  let frameId = 0;
  let viewMode: 'world' | 'dialog' | 'minigame' = 'world';
  const canAnimate = () => !document.hidden && (viewMode !== 'minigame' || !!gesture || workOrders.length > 0 || !!capeWork || !!shorePickup);
  function scheduleFrame() {
    if (!frameId && !abort.signal.aborted && !motion.matches && canAnimate()) frameId = requestAnimationFrame(tick);
  }
  function reconcileFrames() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0; lastTime = 0; lastPhysics = 0;
    if (motion.matches) requestPaint();
    else scheduleFrame();
  }
  let pixelDensity = window.devicePixelRatio || 1;
  let farmer = { ...HOME };
  let destination = farmer;
  let depart = 0;
  let duration = 0;
  let facingRight = false;
  let travelingUp = false;
  let stride = 0;
  let previousStep = -1;
  let lean = 0;
  let path: { from: Point; to: Point; distance: number }[] = [];
  let pathDistance = 0;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  const art = createRasterLibrary((key) => {
    const occluder = /^(home|grove|cape|village)-occluder-(\d+)$/.exec(key);
    if (occluder) {
      const island = occluder[1] as FarmState['island'];
      const image = art.image(key);
      if (image) cutouts[island].push({ image, bounds: landscape[island].occluders[Number(occluder[2])] });
    }
    if (key === 'village-plate') {
      const plate = art.image(key);
      if (plate) {
        const mask = document.createElement('canvas');
        mask.width = 365; mask.height = 240;
        const context = mask.getContext('2d')!;
        context.translate(-790, -485);
        // Extract the authored foreground, preserving its painted edge and
        // texture. Residents prepare behind the table instead of through it.
        const table = new Path2D();
        table.moveTo(866, 578);
        table.bezierCurveTo(877, 564, 919, 553, 962, 546);
        table.bezierCurveTo(1003, 540, 1054, 542, 1073, 557);
        table.bezierCurveTo(1096, 573, 1088, 594, 1070, 604);
        table.lineTo(1056, 609); table.lineTo(1067, 621);
        table.bezierCurveTo(1071, 628, 1065, 637, 1052, 637);
        table.lineTo(1040, 617); table.lineTo(952, 636);
        table.lineTo(948, 665);
        table.bezierCurveTo(944, 674, 921, 675, 919, 663);
        table.lineTo(921, 631); table.lineTo(897, 627);
        table.lineTo(894, 645);
        table.bezierCurveTo(892, 654, 868, 652, 869, 643);
        table.lineTo(872, 620);
        table.bezierCurveTo(861, 613, 861, 591, 866, 578);
        table.closePath();
        context.clip(table);
        context.drawImage(plate, 0, 0);
        villageTableCutout = mask;
      }
    }
    if (key === shoalPlate.key && shoalRevealPending && currentIsland === 'grove') {
      shoalReveal = performance.now();
      shoalRevealPending = false;
    }
    if (key === `${state?.island ?? 'home'}-plate` || key === shoalPlate.key) syncShore();
    requestPaint();
  }, abort.signal);

  function loadedStage(stage: typeof buildingUpgrades[number]) {
    const patchImage = art.image(stage.patch.key);
    const maskImage = art.image(stage.mask.key);
    return patchImage && maskImage ? { ...stage, patchImage, maskImage } : undefined;
  }

  function visibleUpgrades() {
    if (state?.island !== 'home') return [];
    return buildingUpgrades.flatMap((asset) => {
      if (!state || state.buildingLevels[asset.building] < 2) return [];
      const branch = state[`${asset.building}Specialization`];
      const specialized = branch
        ? loadedStage({ building: asset.building, ...specializationStages[branch] })
        : undefined;
      const stage = specialized ?? loadedStage(asset);
      return stage ? [stage] : [];
    });
  }

  function maskHit(maskImage: HTMLImageElement, mask: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean {
    const u = (x - mask.x) / mask.w;
    const v = (y - mask.y) / mask.h;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
    let pixels = maskPixels.get(maskImage);
    if (!pixels) {
      const scratch = document.createElement('canvas');
      scratch.width = maskImage.naturalWidth;
      scratch.height = maskImage.naturalHeight;
      const context = scratch.getContext('2d', { willReadFrequently: true });
      if (!context) return false;
      context.drawImage(maskImage, 0, 0);
      pixels = context.getImageData(0, 0, scratch.width, scratch.height);
      maskPixels.set(maskImage, pixels);
    }
    const offset = (Math.floor(v * pixels.height) * pixels.width + Math.floor(u * pixels.width)) * 4 + 3;
    return pixels.data[offset] >= 128;
  }

  function upgradeHit(x: number, y: number): Area | undefined {
    for (const { building, mask, maskImage } of visibleUpgrades()) {
      if (maskHit(maskImage, mask, x, y)) {
        if (building === 'farmhouse' && x >= kitchenWingX) return kitchenSite;
        return areas.find(({ target }) => target.kind === building);
      }
    }
    return undefined;
  }

  function islandPlate() {
    const island = state?.island ?? 'home';
    const expanded = island === 'grove' && state && hasShoal(state) ? art.image(shoalPlate.key) : undefined;
    if (expanded) return { image: expanded, bounds: shoalPlate.bounds, expanded: true };
    return { image: art.image(`${island}-plate`), bounds: landscape[island].bounds, expanded: false };
  }

  function syncShore(): void {
    const island = state?.island ?? 'home';
    const { image, bounds } = islandPlate();
    if (!image) return;
    const { shoreY } = landscape[island];
    water.setShore(image, {
      x: offset.x + bounds.x * scale, y: offset.y + bounds.y * scale,
      w: bounds.w * scale, h: bounds.h * scale,
    }, offset.y + shoreY * scale);
  }

  function mooredFerry(farm:FarmState): Area[] {
    const ship=farm.freight.ship
    if(farm.freight.expeditions.active?.phase==='sailing')return []
    if(!farm.boatOwned || ship.phase!=='docked' || ship.port!==farm.island)return []
    const dock=docks[farm.island]
    const side=dock.boat.x>=dock.end.x?-1:1
    return [{target:{kind:'bay-freight'},center:{x:dock.end.x+side*184*sceneScale,y:Math.max(dock.boat.y,dock.end.y+44*sceneScale)-42*sceneScale},stop:dock.end,w:170*sceneScale,h:105*sceneScale}]
  }

  function currentSites(): Area[] {
    if (state?.island === 'village') return [
      ...[...villageActors.values()].map((actor): Area => ({
        target: { kind: 'neighbor', resident: actor.id },
        center: { x: actor.point.x, y: actor.point.y - 46 },
        stop: { x: actor.point.x + (actor.facingRight ? 35 : -35), y: actor.point.y + 16 }, w: 47, h: 89,
      })),
      ...getNeighborPlans(state).flatMap((plan): Area[] => {
        const scene = getNeighborSceneState(plan), prop = scenePoint(scene.prop.x, scene.prop.y);
        const site: Area = { target: { kind: 'neighbor', resident: plan.resident },
          center: { x: prop.x, y: prop.y - scene.height * sceneScale * .38 },
          stop: scenePoint(scene.player.x, scene.player.y), w: scene.width * sceneScale, h: scene.height * sceneScale };
        if (!scene.keepsake) return [site];
        const keep = scene.keepsake, point = scenePoint(keep.point.x, keep.point.y);
        return [site, { target: site.target, center: { x: point.x, y: point.y - keep.height * sceneScale * .38 },
          stop: site.stop, w: keep.width * sceneScale, h: keep.height * sceneScale }];
      }),
      ...mooredFerry(state), ...villageSites,
    ];
    if (state?.island === 'cape') {
      const level = state.capeLevel;
      return [...mooredFerry(state),...(level >= 2 ? [apiarySite] : []),
        ...capeSites.filter(({ target }) => target.kind !== 'honey-kitchen' || level >= 3)];
    }
    if (state?.island === 'grove') {
      const farm = state;
      const expanded = islandPlate().expanded && (!shoalReveal || performance.now() - shoalReveal > 720);
      const sites = [...mooredFerry(farm), ...groveSites, ...shoreSites.filter(({ target }) =>
        (target.kind === 'shell' || expanded) && getShoreItem(farm, target))];
      if (expanded) sites.push(tidepoolSite);
      if (hasBayDisplay(farm)) sites.push(displaySite);
      return getHarborOrder(farm) ? [harborSite, ...sites] : sites;
    }
    const sites = [...(state?mooredFerry(state):[]),...(state&&!state.chickensFed?[feedStationSite]:[]),...henSites, ...homeSites];
    if (state && state.buildingLevels.farmhouse >= 2) sites.push(kitchenSite);
    if (state && getFairGuest(state)?.served === false) sites.unshift(guestSite);
    if (state && isProjectComplete(state, 'fair')) sites.push(homeWorkshopSite, villageProjectSite);
    return sites;
  }

  function paintProp(prop: Prop, time: number): void {
    const bend = prop.art.startsWith('tree-') ? Math.sin(time * 1.4 + prop.x * 0.021) * 0.013 : 0;
    const options = { frame: prop.frame, opacity: prop.opacity, bend,
      fullCell: prop.baseline !== undefined, baseline: prop.baseline };
    art.draw(world, prop.art, prop.x, prop.y, prop.w, prop.h, { ...options, shadow: true });
    art.draw(world, prop.art, prop.x, prop.y, prop.w, prop.h, options);
  }

  function paintSupportShadow(key: string, definition: SupportShadow, x: number, y: number, w: number, h: number,
    options: { opacity?: number; scaleY?: number } = {}): void {
    let shadow = supportShadows.get(key);
    if (!shadow) {
      shadow = createSupportShadow(definition);
      supportShadows.set(key, shadow);
    }
    const { canvas, origin, baseline, widthRatio, heightRatio } = shadow;
    world.sprite(canvas, { x: 0, y: 0, w: canvas.width, h: canvas.height },
      x, y, w * widthRatio, h * heightRatio, { ...options, baseline, layer: world.decals }, origin);
  }

  function paintApiary(farm: FarmState, time: number, moment: number): void {
    for (const asset of Object.values(capeBuildings)) {
      if (farm.capeLevel < asset.level || !art.image(asset.key)) continue;
      const phase = capeBuild?.level === asset.level ? clamp((moment - capeBuild.began) / 780, 0, 1) : 1;
      const options = { fullCell: true, baseline: asset.baseline, footY: asset.y,
        opacity: Math.min(1, phase * 4), scaleY: phase < 1 ? 1 + Math.sin(phase * Math.PI * 3) * (1 - phase) * 0.075 : 1 };
      paintSupportShadow(asset.key, asset.shadow, asset.x, asset.y, asset.w, asset.h, options);
      art.draw(world, asset.key, asset.x, asset.y, asset.w, asset.h, options);
    }
    if (farm.capeLevel >= 2) for (let index = 0; index < 3; index++) {
      const flower = cape.flowers[index];
      const phase = time * 0.73 + index * 2.1;
      const t = (1 - Math.cos(phase)) / 2;
      const dx = capeBuildings.apiary.x - 20 - flower.x;
      const dy = capeBuildings.apiary.y - 48 - flower.y + 34;
      const x = flower.x + dx * t;
      const y = flower.y - 43 + dy * t - Math.sin(phase * 2) * 9;
      const heading = Math.atan2(dy * Math.sin(phase) / 2 - Math.cos(phase * 2) * 18, dx * Math.sin(phase) / 2);
      art.draw(world, 'cape-bee', x, y, 14, 14, { angle: heading + Math.PI / 6,
        scaleY: 1 + Math.sin(time * 31 + index) * 0.065, footY: y + 35 });
    }
    const kitchen = capeBuildings.kitchen;
    if (farm.capeLevel >= 3 && !motion.matches) for (let index = 0; index < 3; index++) {
      const phase = (time * 0.52 + index / 3) % 1;
      world.shape('shade', capeKitchenSteam.x + Math.sin(phase * 3 + index) * 5, capeKitchenSteam.y - phase * 28,
        3 + phase * 7, 2 + phase * 4, '#fff7de', (1 - phase) * 0.22, kitchen.y + 1);
    }
    if (kitchenReward) {
      const phase = (moment - kitchenReward.began) / 1050;
      if (phase >= 1) kitchenReward = undefined;
      else art.draw(world, kitchenReward.icon, kitchen.x, kitchen.y - 54 - phase * 63, 47, 47,
        { opacity: Math.min(1, (1 - phase) * 3), angle: Math.sin(phase * Math.PI * 2) * 0.09, layer: world.overlay });
    }
  }

  function routeResident(actor: VillageActor, target: Point): void {
    actor.route = roundTurns(villagePath(actor.point, target)).slice(1)
      .filter((point) => distance(point, actor.point) > 0.2);
  }

  function syncVillageResidents(next: FarmState, moment: number): void {
    const plans = getNeighborPlans(next);
    for (const id of residentIds) {
      const slot = next.village.residents.indexOf(id);
      if (slot < 0) { villageActors.delete(id); continue; }
      let actor = villageActors.get(id);
      if (!actor) {
        actor = { id, slot, point: { ...village.homes[slot] }, route: [], facingRight: slot === 0,
          stride: 0, waitUntil: moment + 1800 + slot * 1500, circuit: 0, serviceRequested: false,
          serviceUntil: 0, gathering: false, mealUntil: 0,
          planKey: '', atStationSince: 0, fetching: false };
        villageActors.set(id, actor);
      } else if (actor.slot !== slot) {
        actor.slot = slot;
        actor.gathering = false;
        actor.serviceRequested = false;
        routeResident(actor, village.homes[slot]);
        actor.waitUntil = moment + 2000;
      }
      const plan = plans.find((entry) => entry.resident === id);
      actor.plan = plan;
      const key = plan ? `${plan.id}:${plan.phase}` : '';
      if (plan && actor.planKey !== key) {
        actor.planKey = key;
        actor.atStationSince = 0;
        actor.fetching = false;
        if (!actor.serviceRequested && !actor.gathering) {
          const scene = getNeighborSceneState(plan);
          routeResident(actor, scenePoint(scene.stand.x, scene.stand.y));
          actor.waitUntil = moment + 1800;
        }
      }
      if (currentIsland === 'village' && next.island === 'village'
        && next.village.serviceOn[id] > residentServiceSeen[id] && !motion.matches) {
        actor.gathering = false;
        actor.serviceRequested = true;
        actor.serviceUntil = 0;
        routeResident(actor, id === 'bea' ? village.workshop : village.lookout);
      }
    }
    if (currentIsland === 'village' && next.island === 'village'
      && next.village.mealOn > villageMealSeen && !motion.matches
      && !plans.some(plan => plan.phase === 'celebrating')) {
      villageMealCelebration = moment;
      for (const actor of villageActors.values()) {
        actor.gathering = true;
        actor.mealUntil = 0;
        actor.serviceRequested = false;
        actor.serviceUntil = 0;
        routeResident(actor, scenePoint(actor.id === 'bea' ? 939 : 1068, 743));
      }
    }
    villageMealSeen = next.village.mealOn;
    for (const id of residentIds) residentServiceSeen[id] = next.village.serviceOn[id];
  }

  function paintVillage(farm: FarmState, time: number, moment: number): void {
    const elapsed = motion.matches ? 0 : clamp((moment - (residentClock || moment)) / 1000, 0, 0.05);
    residentClock = moment;
    for (const place of harbourPlacesOnMap) {
      const anchor=scenePoint(place.x,place.y)
      world.shape('shade',anchor.x,anchor.y-3,place.w*sceneScale*.35,place.h*sceneScale*.065,'#686044',.14)
      art.draw(world,place.art,anchor.x,anchor.y,place.w*sceneScale,place.h*sceneScale,{mipmaps:true,baseline:.98,footY:anchor.y})
    }
    for (const tradition of ['harvest', 'lights', 'stage'] as const) {
      const tier = Math.min(3, farm.festivals.completed[tradition]);
      if (!tier) continue;
      const prop = festivalRewardArt[tradition], key = `festival-${tradition}`;
      const drawReward = (x: number, y: number, size = 1) => {
        const anchor = scenePoint(x, y), w = prop.w * sceneScale * size, h = prop.h * sceneScale * size;
        if (!art.image(key)) return;
        paintSupportShadow(key, prop.shadow, anchor.x, anchor.y, w, h);
        art.draw(world, key, anchor.x, anchor.y, w, h, { mipmaps: true, fullCell: true, baseline: 1, footY: anchor.y });
      };
      drawReward(prop.x, prop.y);
      if (tradition === 'harvest') {
        if (tier >= 2) drawReward(470, 705, .6);
        if (tier >= 3) drawReward(590, 705, .55);
      } else if (tradition === 'lights') {
        if (tier >= 2) drawReward(1190, 566, .67);
        if (tier >= 3) drawReward(1010, 757, .7);
      } else {
        for (const [level, instrument, x, y, w, h] of [[2, 'handpan', 715, 418, 46, 39], [3, 'bass', 897, 421, 42, 50]] as const) {
          if (tier < level) continue;
          const anchor = scenePoint(x, y);
          art.draw(world, `festival-${instrument}`, anchor.x, anchor.y, w * sceneScale, h * sceneScale,
            { mipmaps: true, baseline: 1, footY: anchor.y, shadow: true });
          art.draw(world, `festival-${instrument}`, anchor.x, anchor.y, w * sceneScale, h * sceneScale,
            { mipmaps: true, baseline: 1, footY: anchor.y });
        }
      }
    }
    const gatheringPlan = getNeighborPlans(farm).find(plan => plan.phase === 'celebrating' || plan.phase === 'arranging');
    const mealActive = villageMealCelebration && moment - villageMealCelebration < 24000;
    if (farm.village.mealOn === farm.day && !getNeighborPlans(farm).some(plan => plan.memory?.day === farm.day)) {
      const shape = farm.workshopPatterns.find((id) => farm.handmade[id] > 0) ?? farm.workshopPatterns[0] ?? 'round';
      const meal = [
        { key: `ui-handmade-${shape}`, point: scenePoint(930, 607), width: 24, height: 22 },
        { key: 'ui-grilled-fish', point: scenePoint(1020, 597), width: 27, height: 22 },
      ];
      for (const { key, point, width, height } of meal) {
        art.draw(world, key, point.x, point.y, width, height, { footY: village.table.y });
      }
    }
    for (const [slot, home] of village.homes.entries()) {
      const occupied = farm.village.residents[slot] !== null;
      if (occupied) {
        // Small amber highlights sit inside the two authored window panes.
        for (const dx of [-72, 62]) {
          world.shape('shade', home.x + dx * sceneScale, home.y - 111 * sceneScale,
            13 * sceneScale, 16 * sceneScale, '#ffd286', 0.28 + Math.sin(time * 0.85 + slot) * 0.025, 0, 0, home.y - 8);
        }
      } else if (slot >= getVillageHomeCount(farm)) {
        world.shape('shade', home.x, home.y - 6, 19, 4.7, '#e2c5f6', 0.23);
      }
    }
    const actors = [...villageActors.values()];
    for (const actor of actors) {
      const scene = actor.plan && getNeighborSceneState(actor.plan);
      const guestScene = gatheringPlan && gatheringPlan.resident !== actor.id && getNeighborSceneState(gatheringPlan);
      if (guestScene && !actor.gathering && !actor.serviceRequested && !actor.fetching) {
        const guest = scenePoint(guestScene.guest.x, guestScene.guest.y);
        if (distance(actor.point, guest) > 4 && !actor.route.length) routeResident(actor, guest);
      }
      if (motion.matches) {
        actor.point = guestScene ? scenePoint(guestScene.guest.x, guestScene.guest.y)
          : scene ? scenePoint(scene.stand.x, scene.stand.y) : { ...village.homes[actor.slot] };
        if (guestScene) actor.facingRight = guestScene.stand.x > guestScene.guest.x;
        else if (scene) actor.facingRight = scene.prop.x > scene.stand.x;
        actor.route = [];
      } else if (actor.route.length) {
        stepNeighborWalker(actor, elapsed, actor.id === 'bea' ? 32 : 35);
        if (!actor.route.length) {
          if (actor.gathering) actor.mealUntil = moment + 7200;
          else if (actor.serviceRequested) actor.serviceUntil = moment + 5100;
          actor.waitUntil = moment + (actor.id === 'bea' ? 4200 : 5600);
          actor.atStationSince = moment;
          if (guestScene) actor.facingRight = guestScene.stand.x > guestScene.guest.x;
          else if (scene) actor.facingRight = scene.prop.x > scene.stand.x;
        }
      } else if (actor.gathering && actor.mealUntil && moment >= actor.mealUntil) {
        actor.gathering = false;
        actor.mealUntil = 0;
        actor.waitUntil = moment + 1200;
      } else if (actor.serviceRequested && actor.serviceUntil && moment >= actor.serviceUntil) {
        actor.serviceRequested = false;
        actor.serviceUntil = 0;
        actor.waitUntil = moment + 1300;
      } else if (!actor.gathering && !actor.serviceRequested && !guestScene && scene && moment >= actor.waitUntil) {
        const stand = scenePoint(scene.stand.x, scene.stand.y);
        if (distance(actor.point, stand) > 4) {
          routeResident(actor, stand);
          actor.fetching = false;
        } else if (scene.phase === 'preparing' && moment - actor.atStationSince > 18500) {
          routeResident(actor, scenePoint(scene.source.x, scene.source.y));
          actor.fetching = true;
        } else if (scene.phase === 'memory' && moment - actor.atStationSince > 14000) {
          routeResident(actor, actor.circuit++ % 2 ? stand : village.homes[actor.slot]);
        }
      } else if (!actor.gathering && !actor.serviceRequested && !scene && moment >= actor.waitUntil) {
        const destinations = actor.id === 'bea'
          ? [scenePoint(770, 466), village.workshop, scenePoint(939, 743), village.homes[actor.slot]]
          : [scenePoint(845, 466), village.lookout, scenePoint(1068, 743), village.homes[actor.slot]];
        routeResident(actor, destinations[actor.circuit++ % destinations.length]);
      }
    }
    for (const plan of getNeighborPlans(farm)) {
      const scene = getNeighborSceneState(plan);
      const actor = villageActors.get(plan.resident);
      const point = scenePoint(scene.prop.x, scene.prop.y);
      const age = actor?.atStationSince ? (moment - actor.atStationSince) / 1000 : 9;
      const settled = !motion.matches && scene.phase === 'preparing' ? neighborPropSettle(age % 15) : { lift: 0, angle: 0 };
      art.draw(world, 'neighbor-props', point.x, point.y - settled.lift, scene.width * sceneScale, scene.height * sceneScale,
        { frame: scene.frame, fullCell: true, baseline: .94, footY: scenePoint(0, scene.groundY).y, angle: settled.angle });
      if (plan.food && (plan.phase === 'celebrating' || plan.phase === 'remembered')) {
        const signature = plan.food.id.startsWith('signature:')
          ? farm.culinary.recipes.find(recipe => `signature:${recipe.id}` === plan.food!.id) : undefined;
        const food = neighborFoodArt(plan.food.id, signature);
        let jar = signature && servedJars.get(signature);
        if (signature?.base === 'preserves' && !jar) {
          const artwork = art.image(food);
          if (artwork) {
            jar = finishedIngredient(artwork, cookeryFinishTraits(signature.result, signature.ingredients), 'jar');
            servedJars.set(signature, jar);
          }
        }
        const native = plan.episode === 'beaTea' ? { x: 1004, y: 618 }
          : { x: scene.prop.x + 4, y: scene.prop.y - 24 };
        const contact = scenePoint(native.x, native.y);
        art.draw(world, food, contact.x, contact.y, 33 * sceneScale, 33 * sceneScale,
          { baseline: .9, footY: scenePoint(0, scene.groundY + 1).y }, jar);
      }
      if (scene.keepsake) {
        const keep = scene.keepsake, contact = scenePoint(keep.point.x, keep.point.y);
        art.draw(world, 'neighbor-props', contact.x, contact.y, keep.width * sceneScale, keep.height * sceneScale,
          { frame: keep.frame, fullCell: true, baseline: .94, footY: scenePoint(0, keep.groundY).y });
      }
    }
    actors.sort((a,b) => a.point.y - b.point.y);
    for (const actor of actors) {
      const walking = actor.route.length > 0 && !motion.matches;
      const serving = !walking && (actor.serviceRequested && actor.serviceUntil > moment || actor.gathering && actor.mealUntil > moment);
      const scene = actor.plan && getNeighborSceneState(actor.plan);
      const atStation = scene && distance(actor.point, scenePoint(scene.stand.x, scene.stand.y)) < 5;
      const social = Boolean(gatheringPlan || scene?.phase === 'celebrating');
      const workArt = !walking && !serving && (atStation || gatheringPlan) && art.image(`neighbor-${actor.id}-work`);
      const key = workArt ? `neighbor-${actor.id}-work` : `village-${actor.id}`;
      const frame = walking ? 1 + Math.floor(actor.stride * 4) % 4 : serving ? 5
        : workArt ? neighborWorkFrame(motion.matches ? 0 : Math.max(0, (moment - actor.atStationSince) / 1000), social) : 0;
      const options = { frame, fullCell: true, baseline: 236 / 256, flip: !actor.facingRight,
        scaleY: 1,
        footY: actor.point.y };
      // A 110px cell contains approximately 94px of visible character, versus the farmer's 88px.
      const size = 110;
      world.shape('shade', actor.point.x, actor.point.y, 12, 4, '#62543b', 0.18);
      art.draw(world, key, actor.point.x, actor.point.y, size, size, { ...options, shadow: true });
      art.draw(world, key, actor.point.x, actor.point.y, size, size, options);
      if (!motion.matches && (actor.gathering && actor.mealUntil > moment || actor.serviceUntil > moment)) {
        const cycle = ((moment / 1650) + actor.slot * 0.5) % 1;
        art.draw(world, 'heart', actor.point.x + Math.sin(cycle * Math.PI * 2) * 6,
          actor.point.y - 91 - cycle * 22, 14, 16,
          { opacity: Math.sin(cycle * Math.PI) * 0.85, layer: world.overlay });
      }
    }
    if (mealActive && !motion.matches) {
      const phase = (moment - villageMealCelebration) / 24000;
      const alpha = Math.min(1, phase * 6, (1 - phase) * 7);
      const table = scenePoint(969, 623);
      // Warmth around the shared table lingers while residents walk over from across the quarter.
      world.shape('shade', village.table.x, village.table.y - 22, 88, 23, '#ffe8b4', alpha * 0.14);
      for (let index = 0; index < 3; index++) {
        const cycle = (moment / 2300 + index / 3) % 1;
        world.shape('shade', table.x - 35 + index * 31 + Math.sin(cycle * 4) * 3,
          table.y - 28 - cycle * 17, 2 + cycle * 3.5, 2 + cycle * 3,
          '#fff2d6', alpha * (1 - cycle) * 0.38, world.overlay - 1);
      }
    }
    if (villageWelcome && moment - villageWelcome < 3000 && !motion.matches) {
      const phase = (moment - villageWelcome) / 3000;
      const point = village.square;
      world.shape('ripple', point.x, point.y, 15 + phase * 63, 5 + phase * 18,
        '#ffefd3', (1 - phase) * 0.65);
    }
  }

  function paintBed(bed: Bed, index: number, highlit: boolean, now: number): void {
    const { center: { x, y }, w, h } = plots[index];
    const watered = bed.kind === 'crop' && bed.watered;
    const age = now - (impactByBed.get(index) ?? -1000);
    const recoil = !motion.matches && age >= 0 && age < 330 ? Math.sin(age * Math.PI / 330) : 0;
    const tint = watered ? '#6c4c40' : bed.kind === 'empty' ? '#f4c386' : '#875a42';
    const alpha = watered ? 0.54 : bed.kind === 'empty' ? 0.12 : bed.kind === 'tilled' ? 0.24 : 0.07;
    world.shape('shade', x, y, w * 0.54, h * 0.54, tint, alpha + 0.14 * recoil);
    if (watered) {
      for (let i = 0; i < 4; i++) {
        world.shape('ellipse', x - w * 0.36 + i * w * 0.24, y + h * 0.27 - random(i + index) * 12,
          2.1, 1, '#b6dfd2', 0.52);
      }
    }
    if (highlit) world.shape('plot', x, y, w * 0.47, h * 0.48, '#fff1c4', 0.96);
  }

  function growthFrame(bed: Extract<Bed, { kind: 'crop' }>, index: number, now: number): number {
    const readyAfter = cropDefinitions[bed.crop].days;
    const wateredAge = bed.watered && bed.wateredAt !== undefined
      ? Math.min(0.9, Math.max(0, (now - bed.wateredAt) / 45_000))
      : 0;
    const target = bed.growth >= readyAfter ? 3 : Math.min(2.94, (bed.growth + wateredAge) * 3 / readyAfter);
    const prior = growthFrames.get(index);
    const frame = motion.matches || target === 3 || prior?.crop !== bed.crop
      ? target
      : Math.min(target, prior.frame + Math.max(0, now - prior.time) / 420);
    growthFrames.set(index, { crop: bed.crop, frame, time: now });
    return frame;
  }

  function paintCrop(bed: Extract<Bed, { kind: 'crop' }>, index: number, progress: number, time: number): void {
    const frame = Math.floor(progress);
    const [width, height] = cropSizes[bed.crop];
    const { foot } = plots[index];
    const key = `crop-${bed.crop}`;
    const single = frame > 1 && (bed.crop === 'cabbage' || bed.crop === 'pumpkin');
    const plants = single ? [[0, -2]] : frame === 0 ? [[-22, -13], [20, -14], [-24, 1], [19, 2]] : [[-21, -3], [21, 1]];
    const size = frame === 3 ? 1 : 0.9 + 0.14 * (progress - frame);
    plants.forEach(([dx, dy], i) => {
      const x = foot.x + dx * sceneScale;
      const y = foot.y + dy * sceneScale;
      const variety = i % 2 ? 0.93 : 1;
      const w = width * sceneScale * size * variety;
      const h = height * sceneScale * size * variety;
      const bend = Math.sin(time * 1.7 + index * 0.7 + i) * 0.022;
      const berry = bed.crop === 'strawberry' || bed.crop === 'blueberry' || bed.crop === 'raspberry';
      const options = { frame, fullCell: true, baseline: berry ? 480 / 512 : 122 / 136, bend };
      art.draw(world, key, x, y, w, h, { ...options, shadow: true });
      art.draw(world, key, x, y, w, h, options);
    });
  }

  function paintHint(area: Area | undefined): void {
    const label = area && inspect(area.target);
    hint.hidden = !label;
    if (!area || !label) return;
    if (hint.textContent !== label) hint.textContent = label;
    const x = offset.x + area.center.x * scale;
    const y = offset.y + (area.center.y - Math.min(area.h * 0.54, 57) - 10) * scale;
    hint.style.left = `${clamp(x, hint.offsetWidth / 2 + 10, viewport.width - hint.offsetWidth / 2 - 10)}px`;
    const framed = state?.island === 'village' && harbourCamera(harbourViewport(), harbourJourney ? 'overview' : harbourView).close;
    hint.style.top = `${framed ? clamp(y, harbourInsets.top + hint.offsetHeight + 8, viewport.height - harbourInsets.bottom - 8) : Math.max(hint.offsetHeight + 8, y)}px`;
  }

  function paintWaypoint(x: number, y: number, time: number, color: string): void {
    const lift = Math.sin(time * 2.3) * 3;
    world.shape('diamond', x, y + lift, 8, 8, '#614231', 1, world.overlay);
    world.shape('diamond', x, y + lift, 5.6, 5.6, color, 1, world.overlay + 1);
  }

  function moveTo(stop: Point): void {
    destination = stop;
    const capePath = () => {
      const dock = docks.cape;
      const aisle = scenePoint(0, 566).y;
      const start = farmer.y > dock.entry.y ? dock.entry : farmer;
      const end = stop.y > dock.entry.y ? dock.entry : stop;
      if (start.y < cape.flowers[0].y - 15 && end.y < cape.flowers[0].y - 15) return [farmer, start, end, stop];
      const gaps = [391, 650, 910, 1160].map((x) => scenePoint(x, 0).x);
      const exit = (point: Point) => point.y < cape.flowers[0].y - 15
        ? { x: gaps.reduce((nearest, x) => Math.abs(x - point.x) < Math.abs(nearest - point.x) ? x : nearest), y: point.y }
        : point;
      const from = exit(start);
      const to = exit(end);
      return [farmer, start, from, { x: from.x, y: aisle }, { x: to.x, y: aisle }, to, end, stop];
    };
    const points = roundTurns(state?.island === 'grove' ? grovePath(farmer, stop)
      : state?.island === 'cape' ? capePath() : state?.island === 'village' ? villagePath(farmer, stop) : walkingPath(farmer, stop));
    path = points.slice(1).map((to, i) => {
      const from = points[i];
      return { from, to, distance: Math.hypot(to.x - from.x, to.y - from.y) };
    }).filter((segment) => segment.distance > 0);
    pathDistance = path.reduce((distance, segment) => distance + segment.distance, 0);
    depart = performance.now();
    previousStep = -1;
    duration = motion.matches || !pathDistance ? 0 : Math.min(1550, 160 + pathDistance * 1.65);
    if (state?.island === 'village' && harbourView !== 'overview') {
      harbourView = harbourViewForPoint(harbourViewport(), harbourView, stop);
      harbourJourney = duration > 0 && harbourRouteNeedsOverview(harbourViewport(), harbourView, points);
      pointerStart = undefined; hovered = undefined;
      updateCameraView();
      harbourViewChanged?.(harbourView, harbourJourney);
    }
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
      if (age < 0) continue;
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

  function celebrate(bounds: { x: number; w: number; h: number; footY: number }): void {
    if (motion.matches) return;
    celebrationSparks.push({ x: bounds.x + bounds.w / 2, y: bounds.footY - bounds.h * 0.23,
      spread: bounds.w * 0.43, began: performance.now() });
  }

  function paintCelebration(now: number): void {
    for (let i = celebrationSparks.length - 1; i >= 0; i--) {
      const spark = celebrationSparks[i];
      const t = (now - spark.began) / 1050;
      if (t >= 1) {
        celebrationSparks.splice(i, 1);
        continue;
      }
      for (let n = 0; n < 10; n++) {
        const angle = n * Math.PI * 0.2;
        const distance = spark.spread * (0.4 + t * 0.67);
        const x = spark.x + Math.cos(angle) * distance;
        const y = spark.y + Math.sin(angle) * distance * 0.44 - 38 * t;
        const size = 2.5 + random(n + 86) * 3;
        world.shape('diamond', x, y, size, size * 1.25, n % 2 ? '#fff4cb' : '#e7c3ee',
          (1 - t) * Math.min(1, t * 10), world.overlay);
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
    const centers = atHome ? [scenePoint(516, 366), scenePoint(1162, 614), scenePoint(1375, 738)]
      : [scenePoint(410, 412), scenePoint(879, 484)];
    centers.forEach(({ x, y }, i) => {
      const phase = time * (0.72 + i * 0.09) + i * 3.1;
      const px = x + 35 * Math.sin(phase);
      const py = y + 13 * Math.sin(phase * 1.78) + 4 * Math.cos(time * 5 + i);
      const speed = 0.72 + i * 0.09;
      const dx = 35 * Math.cos(phase) * speed;
      const dy = 13 * Math.cos(phase * 1.78) * 1.78 * speed - 20 * Math.sin(time * 5 + i);
      art.draw(world, 'butterfly', px, py, 14 + i * 2, 12 + i, {
        frame: Math.floor(time * 8 + i) % 4, angle: Math.atan2(dy, dx) + Math.PI / 3, footY: y + 33,
      });
    });
  }

  function paintCove(farm: FarmState, dt: number, time: number): void {
    const ecology = getCoveEcology(farm.shoreline, farm.day);
    const choices = farm.shoreline.pending ?? ecology.choices;
    const actors = stepCoveMotion(coveMotion, ecology, dt, nativeHenPoint(farmer), motion.matches);
    // Physical choices preview immediately; animals and fishing keep the last settled tide.
    const draw = (key: string, point: Point, size: number, options: Parameters<typeof art.draw>[6] = {}) => {
      const spot = scenePoint(point.x, point.y);
      art.draw(world, key, spot.x, spot.y, size * sceneScale, size * sceneScale,
        { fullCell: true, baseline: .82, footY: spot.y, ...options });
    };
    if (choices.flow === 'sheltered') draw('cove-rock', { x: 1451, y: 742 }, 65);
    if (!motion.matches) for (let i = 0; i < 7; i++) {
      const phase = (time * (choices.flow === 'open' ? .075 : .022) + i / 7) % 1;
      const p = choices.flow === 'open' ? coveChannelPoint(phase)
        : { x: 1330 + Math.cos(phase * Math.PI * 2) * 47, y: 709 + Math.sin(phase * Math.PI * 2) * 16 };
      const spot = scenePoint(p.x, p.y);
      const fade = Math.sin(phase * Math.PI) ** 2;
      world.shape('shade', spot.x, spot.y, (choices.flow === 'open' ? 9 : 5) * sceneScale,
        1.2 * sceneScale, '#c0e6cb', fade * .27, -24, choices.flow === 'open' ? .25 : -.2);
    }
    for (const fish of actors.minnows) draw('cove-minnow', fish, 25,
      { frame: fish.frame, flip: fish.flip, angle: fish.angle, opacity: fish.opacity, baseline: .5, layer: -20 });
    if (choices.cover === 'kelp') coveSceneAnchors.kelp.forEach((point, i) => draw(i ? 'cove-kelp-left' : 'cove-kelp-right', point, 84,
      { bend: motion.matches ? 0 : Math.sin(time * .8 + i) * .018 }));
    else coveSceneAnchors.meadow.forEach(point => draw('cove-meadow', point, 76));
    const crab = actors.crab, crabPoint = scenePoint(crab.x, crab.y);
    world.shape('shade', crabPoint.x, crabPoint.y, 8, 2.5, '#9c734d', .21 * crab.opacity);
    const crabWalk = Boolean(art.image('shore-crab-walk'));
    art.draw(world, crabWalk ? 'shore-crab-walk' : 'shore-crab', crabPoint.x, crabPoint.y, 26, 26,
      { frame: crabWalk ? crab.frame : 0, fullCell: true, baseline: 118 / 128, footY: crabPoint.y, angle: crab.angle, flip: crab.flip, opacity: crab.opacity });
    if (choices.refuge === 'stones') draw('cove-refuge', { x: coveSceneAnchors.refuge.x, y: coveSceneAnchors.refuge.y + 9 }, 95);
    draw('cove-perch', { x: 1440, y: 680 }, 77, { footY: scenePoint(1440, 640).y });
    const birdFoot = scenePoint(actors.egret.x, actors.egret.y);
    world.shape('shade', birdFoot.x, birdFoot.y, 7, 2.2, '#646a59', .16, -1);
    draw('cove-egret', actors.egret, 73,
      { frame: actors.egret.frame, flip: actors.egret.flip, baseline: .78 });
    if (getClimate(farm.day).weather === 'sun' || getClimate(farm.day).weather === 'rainbow') {
      for (let i = 0; i < ecology.animals.butterflies.count; i++) {
        const point = choices.cover === 'kelp' ? coveSceneAnchors.meadow[0] : coveSceneAnchors.meadow[i % 2];
        const p = scenePoint(point.x + Math.sin(time * .8 + i * 2.3) * 25,
          point.y - 12 + Math.sin(time * 1.5 + i) * 8);
        art.draw(world, 'butterfly', p.x, p.y, 10, 9,
          { frame: motion.matches ? 0 : Math.floor(time * 8 + i) % 4, angle: -.2 + Math.sin(time + i) * .25 });
      }
    }
  }

  function paint(time: number): void {
    const island = state?.island ?? 'home';
    const atHome = island === 'home';
    const atGrove = island === 'grove';
    const atCape = island === 'cape';
    const honeyWind = atCape && isHoneyWind(state?.day ?? 1);
    const lunarTide = atGrove && isLunarTide(state?.day ?? 1);
    const { weather } = getClimate(state?.day ?? 1);
    const dock = docks[island];
    const now = Date.now();
    const moment = performance.now();
    if (harbourJourney && moment >= depart + duration) {
      harbourJourney = false;
      harbourView = harbourViewForPoint(harbourViewport(), harbourView, destination);
      pointerStart = undefined; hovered = undefined;
      updateCameraView();
      harbourViewChanged?.(harbourView, false);
    }
    const dt = motion.matches ? 0 : clamp((moment - (lastPhysics || moment - 16)) / 1000, 0.001, 0.05);
    lastPhysics = moment;
    const coveTarget = coveFocus && atGrove ? 1 : 0;
    if (Math.abs(coveBlend - coveTarget) > .0001) {
      coveBlend = motion.matches ? coveTarget : coveBlend + (coveTarget - coveBlend) * (1 - Math.exp(-dt * 9));
      if (Math.abs(coveBlend - coveTarget) < .0001) coveBlend = coveTarget;
      updateCameraView();
    }
    const traveling = arrival ? clamp(1 - (moment - arrival) / 950, 0, 1) : 0;
    const leaving = departure ? clamp((moment - departure) / 420, 0, 1) : 0;
    const boatX = dock.boat.x + 191 * traveling * traveling + 150 * leaving * leaving;
    const swell = time ? Math.sin(time * 1.7 + dock.boat.x * 0.03) * 2.2 + Math.sin(time * 2.36 + 1) * 0.8 : 0;
    const boatY = dock.boat.y + 37 * traveling + 27 * leaving + driveSpring(boatFloat, swell, dt, 8, 0.76);
    const boatAngle = driveSpring(boatRoll, time ? Math.cos(time * 1.7 + dock.boat.x * 0.03) * 0.033 : 0, dt, 10, 0.73);
    world.begin();
    const { image: plate, bounds, expanded } = islandPlate();
    const reveal = shoalReveal ? clamp((moment - shoalReveal) / 980, 0, 1) : 1;
    if (plate) {
      const original = atGrove && expanded && reveal < 1 ? art.image('grove-plate') : undefined;
      if (original) world.plate(original, landscape.grove.bounds);
      const houseKey = island === 'village' && state ? villageHomeArtKey(state) : 'village-plate';
      const housePatch = houseKey !== 'village-plate' ? art.image(houseKey) : undefined;
      // A missing optional patch degrades to the accepted base, never an empty
      // ocean with floating actors. Loading completion requests a fresh paint.
      world.plate(houseKey !== 'village-plate' ? villageHomePlate(plate, housePatch) : plate, bounds,
        Boolean(original), expanded ? reveal * reveal * (3 - 2 * reveal) : 1);
    }
    const coveTerrain = atGrove && art.image('cove-terrain');
    if (coveTerrain) world.plate(coveTerrain, { ...scenePoint(1110, 590), w: 430 * sceneScale, h: 430 * 975 / 1613 * sceneScale }, true, 1, { top: .1, left: .08 });
    const upgraded = plate ? visibleUpgrades() : [];
    const project = atHome ? 'fair' : 'dock';
    const stage = projectStages[project];
    const complete = (atHome || atGrove) && plate && state && isProjectComplete(state, project);
    const projectPatch = complete && art.image(stage.patch.key);
    const projectMask = complete && art.image(stage.mask.key);
    for (const { patch, patchImage } of upgraded) world.plate(patchImage, patch, true);
    if (projectPatch && projectMask) world.plate(projectPatch, stage.patch, true);
    for (const { image, bounds } of cutouts[island]) {
      if (projectPatch && projectMask && bounds.project === project) continue;
      if (bounds.building && upgraded.some(({ building }) => building === bounds.building)) continue;
      world.occluder(image, bounds);
    }
    if (island === 'village' && villageTableCutout) {
      const top = scenePoint(790, 485);
      world.sprite(villageTableCutout, { x: 0, y: 0, w: 365, h: 240 },
        top.x + 365 * sceneScale / 2, top.y, 365 * sceneScale, 240 * sceneScale,
        { baseline: 0, footY: scenePoint(0, 690).y });
    }
    for (const { mask, maskImage } of upgraded) world.occluder(maskImage, mask);
    if (projectPatch && projectMask) world.occluder(projectMask, stage.mask);
    const well = upgraded.find(({ building }) => building === 'well');
    if (well && !motion.matches) {
      const pools = state?.wellSpecialization === 'pipes' ? [[748, 316, 9], [773, 315, 6]]
        : state?.wellSpecialization === 'rain' ? [[754, 317, 9], [773, 232, 9]] : [[754, 317, 9]];
      pools.forEach(([x, y, spread], index) => {
        const basin = scenePoint(x, y);
        const phase = (time * 0.9 + index * 0.42) % 1;
        world.shape('ripple', basin.x, basin.y, 4 + spread * phase, 1.5 + 2 * phase,
          '#e6f8ef', (1 - phase) * 0.56, 0, 0, well.mask.footY + 0.1);
      });
    }
    const sails = atHome && art.image('windmill-sails');
    if (sails) {
      const { pivot, w, h, footY, origin, baseline } = windmillSails;
      world.sprite(sails, { x: 0, y: 0, w: sails.naturalWidth, h: sails.naturalHeight },
        pivot.x, pivot.y, w, h, { angle: time * 0.39, baseline, footY }, origin);
    }
    const ferrySite=state && mooredFerry(state)[0]
    if(ferrySite){
      const {center,w,h}=ferrySite
      const bob=motion.matches?0:Math.sin(time*1.1)*1.2
      art.draw(world,'bay-ferry',center.x,center.y+h*.5+bob,w,h,{baseline:1})
    }
    art.draw(world, 'boat', boatX, boatY, 160 * sceneScale, 87 * sceneScale, { fullCell: true, angle: boatAngle });
    const selected = hovered ?? (showFocus && focused
      ? currentSites().find((area) => sameTarget(area.target, focused!.target))
      : undefined);
    if (atHome) state?.beds.forEach((bed, index) => {
      paintBed(bed, index, selected?.target.kind === 'bed' && selected.target.index === index, moment);
    });
    if (atGrove && !state?.saltGatheredToday) {
      paintProp({ art: 'salt', ...saltCove.foot, w: 56, h: 35 }, time);
    }
    if (island === 'home' || island === 'grove') orchard[island].forEach(({ x, y }, index) => {
      const tree = state?.trees[island][index];
      const age = tree ? Math.min(1, tree.age / treeDefinitions[tree.tree].days) : 0;
      if (atHome) world.shape('shade', x, y - 2, 36, 11, '#936342', tree ? 0.50 : 0.31);
      if (!tree || age < 0.55) {
        paintProp({ art: 'orchard-start', x, y, w: 65, h: 70,
          frame: tree ? 1 : 0, baseline: 112 / 128 }, time);
        return;
      }
      const size = (atHome ? 150 : 193) * (age < 1 ? 0.72 : 1);
      paintProp({ art: `tree-${tree.tree}`, x, y, w: size * 220 / 230, h: size,
        frame: tree.fruitReady > 0 ? 0 : 1, baseline: 212 / 230 }, time);
      if (tree.fruitReady > 0 && tree.trait) weatherEffects.glint(tree.trait, x + size * 0.32, y - size * 0.54, time);
    });
    if (atCape && state) {
      const farm = state;
      paintApiary(farm, time, moment);
      const harvest = farm.capeLevel >= 2 ? { x: capeBuildings.apiary.x, y: capeBuildings.apiary.y + 12 } : cape.hive;
      cape.flowers.forEach(({ x, y }, index) => {
        const bloom = getCapeBloom(farm, index);
        if (bloom === 'empty') {
          if (selected?.target.kind === 'flower' && selected.target.index === index) {
            world.shape('ripple', x, y, 47, 15, '#ffefc2', 0.9, y);
          }
          return;
        }
        const planted = flowerPlanted.get(index);
        const phase = planted ? clamp((moment - planted) / 580, 0, 1) : 1;
        const pop = 1 - Math.cos(phase * Math.PI * 2.2) * Math.exp(-phase * 6);
        const size = (bloom === 'bloom' ? 82 : 47) * (planted && phase < 1 ? pop : 1);
        const sway = Math.sin(time * (honeyWind ? 2.3 : 1.3) + index * 1.7) * (honeyWind ? 0.07 : 0.025);
        for (const [dx, dy, factor] of [[-27, -4, 0.77], [25, -3, 0.83], [0, 12, 1]]) {
          const options = { fullCell: true, baseline: 118 / 128, bend: sway, footY: y + dy };
          art.draw(world, 'cape-flowers', x + dx, y + dy, size * factor, size * factor, { ...options, shadow: true });
          art.draw(world, 'cape-flowers', x + dx, y + dy, size * factor, size * factor, options);
        }
      });
      if (getCapeHoney(farm).available) {
        art.draw(world, honeyWind ? 'ui-wind-honey' : 'ui-honey', harvest.x + 18,
          harvest.y - 131 + Math.sin(time * 2) * 2, 30, 34, { layer: world.overlay });
      }
      const reward = honeyReward ? (moment - honeyReward) / 850 : 1;
      if (reward < 1) art.draw(world, honeyWind ? 'ui-wind-honey' : 'ui-honey', harvest.x,
        harvest.y - 90 - reward * 64, 42, 46, { opacity: Math.min(1, (1 - reward) * 3), layer: world.overlay });
      if (reward < 1 && farm.capeLevel >= 2) art.draw(world, 'ui-beeswax', harvest.x + 37,
        harvest.y - 78 - reward * 54, 33, 33, { opacity: Math.min(1, (1 - reward) * 3), layer: world.overlay });
      if (honeyWind) for (let i = 0; i < 15; i++) {
        const drift = (time * 43 + i * 71) % 810;
        const p = scenePoint(360 + drift, 410 + random(i + 29) * 270);
        world.shape('ellipse', p.x, p.y + Math.sin(time * 2 + i) * 7, 2.1, 1.2, '#ffefb2', 0.7, p.y + 90);
      }
    }
    if (atGrove && state && hasBayDisplay(state)) {
      if (art.image('bay-display')) paintSupportShadow('bay-display', displayShadow, displayFoot.x, displayFoot.y, 69, 75);
      art.draw(world, 'bay-display', displayFoot.x, displayFoot.y, 69, 75, { fullCell: true, baseline: 118 / 128 });
    }
    if (atHome && state) {
      const guest = getFairGuest(state);
      const progress = guestDeparture ? clamp((moment - guestDeparture) / 1400, 0, 1) : 0;
      if (guest && (!guest.served || guestDeparture && progress < 1)) {
        const travel = progress * progress * (3 - 2 * progress);
        const x = guestFoot.x + travel * 54;
        const y = guestFoot.y - travel * 35;
        const walking = guest.served && Boolean(art.image('fair-guest-walk'));
        const key = walking ? 'fair-guest-walk' : 'fair-guest';
        const lift = walking ? Math.abs(Math.sin(travel * Math.PI * 4)) * 2.3 : 0;
        const options = { fullCell: true, baseline: 118 / 128, opacity: Math.min(1, (1 - progress) * 3),
          footY: y, frame: walking ? Math.floor(travel * 8) % 4 : 0,
          scaleY: 1 + Math.sin(walking ? travel * Math.PI * 8 : time * 2.1) * 0.01,
          angle: walking ? 0.025 : Math.sin(time * 1.3) * 0.009 };
        art.draw(world, key, x, y, 108, 108, { ...options, shadow: true, lift });
        art.draw(world, key, x, y - lift, 108, 108, options);
        if (!guest.served) {
          const requestIcon = guest.item.kind === 'fruit' ? 'guest-apple'
            : guest.item.kind === 'dishes' ? guest.item.item === 'appleJam' ? 'guest-jam' : 'guest-cake' : 'item-wheat';
          const floatY = y - 115 + Math.sin(time * 2) * 2;
          world.shape('ellipse', x, floatY - 11, 22, 21, '#fff7dc', 0.95, world.overlay);
          art.draw(world, requestIcon, x, floatY + 4, 28, 32, { layer: world.overlay + 1 });
        }
        if (guest.served) art.draw(world, 'heart', x, y - 95 - progress * 22, 21, 23,
          { opacity: 1 - progress, layer: world.overlay });
      }
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
          if (Math.abs(dx) > 2) facingRight = dx > 0;
          travelingUp = dy < -Math.abs(dx) * (travelingUp ? .15 : .42);
          lean += (0.065 * dx / segment.distance - lean) * (1 - Math.exp(-dt * 13));
          break;
        }
        traveled -= segment.distance;
      }
    } else {
      farmer = destination;
      lean *= Math.exp(-dt * 24);
    }
    if (moving && traveling <= 0.12) {
      const step = Math.floor(stride * 2);
      if (step !== previousStep && stride > 0.15) {
        const side = step % 2 ? -1 : 1;
        playBaySound('field.step',.4,210)
        footfalls.push({ x: farmer.x + side * 5, y: farmer.y, began: moment, side });
        previousStep = step;
      }
    }
    if (atHome) advanceWork(moment, moving);
    let capeProgress = 0;
    if (capeWork && atCape && !moving && !crossing && traveling <= 0.12) {
      const work = capeWork;
      work.began ??= moment;
      capeProgress = clamp((moment - work.began) / 560, 0, 1);
      if (!work.hit && capeProgress >= 0.55) {
        work.hit = true;
        if (work.commit() && !motion.matches) {
          if (work.target.kind === 'hive') honeyReward = moment;
          else if (work.target.kind === 'flower') flowerPlanted.set(work.target.index, moment);
          else if (work.reward) kitchenReward = { icon: work.reward, began: moment };
        }
      }
      if (capeProgress >= 1) {
        capeWork = undefined;
        capeProgress = 0;
      }
    }
    let pickupProgress = 0;
    if (shorePickup && !moving && traveling <= 0.12 && state) {
      shorePickup.began ??= moment;
      pickupProgress = clamp((moment - shorePickup.began) / pickupDuration, 0, 1);
      if (pickupProgress >= 0.52) {
        const { site, commit } = shorePickup;
        shorePickup = undefined;
        const item = getShoreItem(state, site.target);
        if (item && commit()) shoreReward = { point: site.foot, icon: item.icon, began: moment };
      }
    }
    const biteAge = biteSince ? (moment - biteSince) / 1000 : 0;
    const bite = biteSince && !motion.matches ? Math.sin(Math.min(1, biteAge / 0.62) * Math.PI) ** 2 : 0;
    const bobber = fishing && !moving
      ? { x: dock.float.x + 3 * bite, y: dock.float.y + Math.sin(time * 2.5) * 2 + 4 * bite }
      : undefined;
    if (bobber && biteSince && biteAge < 0.72 && !motion.matches) {
      const spread = 8 + biteAge * 33;
      world.shape('ripple', bobber.x, bobber.y + 1, spread, spread * 0.39, '#e8fff1', 0.8 * (1 - biteAge / 0.72), -90);
    }
    water.paint(time, {
      x: offset.x + boatX * scale, y: offset.y + boatY * scale, speed: Math.min(1, Math.max(traveling, leaving) * 1.65),
    }, bobber && { x: offset.x + bobber.x * scale, y: offset.y + bobber.y * scale }, lunarTide);
    function paintFarmer(): void {
      if (traveling > 0.12 || leaving > 0.02) return;
      const bob = moving ? Math.abs(Math.sin(stride * Math.PI * 2)) * 2.8 : 0;
      if (bobber) {
        world.fishingLine(farmer.x - 64, farmer.y - 76, bobber.x, bobber.y);
        world.float(bobber.x, bobber.y, time, bite);
      }
      const pose = gesture && !moving ? gesture : undefined;
      const progress = pose ? clamp((moment - pose.started) / WORK_MS[pose.kind], 0, 0.999) : 0;
      const impactPose = Boolean(pose && progress > 0.19 && progress < 0.91);
      const animated = pose?.kind === 'water' || pose?.kind === 'till';
      const walkKey = travelingUp ? 'walk-back' : facingRight ? 'walk-right' : 'walk-left';
      const smoothWalk = Boolean(art.image(`${walkKey}-smooth`));
      const key = moving ? smoothWalk ? `${walkKey}-smooth` : walkKey
        : animated ? `work-${pose.kind}` : 'farmer-actions';
      const frame = moving ? Math.floor(stride * (smoothWalk ? 8 : 4)) % (smoothWalk ? 8 : 4)
        : animated ? Math.min(3, Math.floor(progress * 4))
        : bobber ? 5 : impactPose && pose?.kind === 'plant' ? 2
        : capeProgress > 0.18 && capeWork?.target.kind === 'flower' ? 2
        : capeProgress > 0.18 || pickupProgress > 0.18 || impactPose && pose?.kind === 'harvest' ? 4 : 0;
      const scaleY = moving ? 1 + Math.sin(stride * Math.PI * 4) * 0.016
        : pose || pickupProgress || capeProgress ? 1 - Math.sin((progress || pickupProgress || capeProgress) * Math.PI) * 0.029 : 1 + Math.sin(time * 2.4) * 0.009;
      const options = { frame, fullCell: true, baseline: 0.9, angle: moving ? lean : 0, scaleY };
      const height = 105;
      const width = height * (moving ? 192 : 224) / 160;
      world.shape('shade', farmer.x, farmer.y, 14, 5, '#63523f', 0.22);
      art.draw(world, key, farmer.x, farmer.y, width, height, { ...options, shadow: true, lift: bob });
      if (!art.draw(world, key, farmer.x, farmer.y - bob, width, height, { ...options, footY: farmer.y })) {
        const fallback = animated ? pose.kind === 'water' ? 3 : 1 : 0;
        art.draw(world, 'farmer-actions', farmer.x, farmer.y - bob, height * 224 / 160, height,
          { ...options, frame: fallback, footY: farmer.y });
      }
    }
    if (island === 'village' && state) paintVillage(state, time, moment);
    paintFarmer();
    if (atGrove && state) {
      if (lunarTide) world.wash('#49497a12');
      const farm = state;
      for (const { target, foot: { x, y }, angle } of shoreSites) {
        if (target.kind === 'shoal-find' && (!expanded || reveal < 0.8)) continue;
        const item = getShoreItem(farm, target);
        if (!item) continue;
        world.shape('shade', x, y, 12, 4, '#9c734d', 0.23);
        if (item.luminous) {
          const glimmer = 0.79 + Math.sin(time * 2.7) * 0.19;
          world.shape('shade', x, y - 9, 22, 15, '#c5b7ff', glimmer * 0.57, y - 1);
          world.shape('diamond', x + 13, y - 23, 3, 7, '#f1eeff', glimmer, y);
          world.shape('diamond', x - 13, y - 16, 2.5, 4.5, '#c6faff', glimmer, y);
        }
        art.draw(world, item.icon, x, y, 39, 36, { fullCell: true, baseline: 118 / 128, footY: y, angle });
      }
      paintCove(farm, dt, time);
      if (expanded && reveal > 0.8) {
        const { x, y } = shoal.starfish;
        const drift = Math.sin(time * 0.73) * 2.8;
        art.draw(world, 'shoal-starfish', x + drift, y, 31, 25, {
          fullCell: true, baseline: 118 / 128, footY: y, angle: -0.15 + drift * 0.023, opacity: 0.87,
        });
        shoal.pools.forEach((pool, index) => {
          const ring = time ? (time * 0.46 + index * 0.43) % 1 : 0.42;
          world.shape('ripple', pool.x, pool.y, 5 + ring * 15, 2 + ring * 4,
            '#caffef', (1 - ring) * 0.52, pool.y + 0.1);
        });
      }
      if (shoreReward) {
        const progress = (moment - shoreReward.began) / 690;
        if (progress >= 1) shoreReward = undefined;
        else {
          const { point: { x, y }, icon } = shoreReward;
          art.draw(world, icon, x, y - 6 - progress * 47, 39, 36,
            { fullCell: true, baseline: 118 / 128, opacity: Math.min(1, (1 - progress) * 3), layer: world.overlay });
        }
      }
    }
    if(atHome&&state&&!state.chickensFed){
      const strong=state.eggsReady===0,size=strong?31:26,bob=motion.matches?0:(1+Math.sin(time*2.5))*(strong?.85:.5);
      world.shape('shade',feedStation.x,feedStation.y,9,3.5,'#725531',.24);
      art.draw(world,'feed-station',feedStation.x,feedStation.y-bob,size,size,{fullCell:true,baseline:140/144,footY:feedStation.y});
    }
    henSites = [];
    if (atHome) hens.forEach((hen, index) => {
      if (index >= (state?.flockSize ?? chickenCount)) return;
      const held = heldHen?.index === index && heldHen.dragging ? heldHen : undefined;
      const previous = { x: hen.px.value, y: hen.py.value };
      const idle=henIdlePoint(nativeHenPoint(hen),time,index,state?.buildingLevels),target=held?.point??scenePoint(idle.x,idle.y);
      let x = driveSpring(hen.px, target.x, dt, held ? 23 : 14, 0.82);
      let y = driveSpring(hen.py, target.y, dt, held ? 23 : 14, 0.82);
      if(!held&&hen.lift.value<2){
        const ground=projectHenToGround(nativeHenPoint({x,y}),state?.buildingLevels),safe=scenePoint(ground.x,ground.y);
        if(Math.abs(safe.x-x)>.001){hen.px.value=x=safe.x;hen.px.speed=0}
        if(Math.abs(safe.y-y)>.001){hen.py.value=y=safe.y;hen.py.speed=0}
      }
      const joy = Math.max(0, hen.excited - moment);
      const playful = Boolean(held) || joy > 0;
      const lift = driveSpring(hen.lift, held && !motion.matches ? 20 : 0, dt, 16, 0.61);
      if (hen.lift.value < 0) {
        hen.lift.value = 0;
        hen.lift.speed = Math.abs(hen.lift.speed) > 8 ? Math.abs(hen.lift.speed) * 0.29 : 0;
      }
      if (!held && !motion.matches) hen.gait += Math.hypot(x - previous.x, y - previous.y) / 15;
      if (Math.abs(hen.px.speed) > 2) hen.facingRight = hen.px.speed > 0;
      const facing = hen.facingRight;
      const walking = !held && !playful && !motion.matches && Math.hypot(hen.px.speed, hen.py.speed) > 1.8 && Boolean(art.image('hen-walk-smooth'));
      const frame = held ? 5 + Math.floor(time * 8) % 2 : playful ? Math.min(7, 5 + Math.floor((950 - joy) / 280))
        : walking ? Math.floor(hen.gait * 8) % 8 : !facing ? 4 : motion.matches ? 0 : Math.floor(time * 7 + index) % 4;
      const pose = { frame, fullCell: true, baseline: 112 / 128, flip: walking && !facing };
      const henArt = walking ? 'hen-walk-smooth' : 'hen-poses';
      const angle = clamp(hen.px.speed * 0.001, -0.13, 0.13);
      const scaleY = clamp(1 - hen.lift.speed * 0.001, 0.91, 1.07);
      henSites.push({ target: { kind: 'hen', index }, center: { x, y: y - 17 - Math.max(0, lift) }, stop: { x, y }, w: 40, h: 43 });
      const elevation = Math.max(0, lift);
      world.shape('shade', x, y, 10 + elevation * 0.12, 3.9, '#47462a', 0.25 / (1 + elevation * 0.04));
      art.draw(world, henArt, x, y, 47, 47, { ...pose, angle, scaleY, shadow: true, lift: elevation });
      art.draw(world, henArt, x, y - elevation, 47, 47, { ...pose, angle, scaleY, footY: y,layer:held?world.overlay:undefined });
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
      if (bed.trait) {
        const { foot, w } = plots[index];
        weatherEffects.glint(bed.trait, foot.x - w * 0.35, foot.y - 13, time);
      }
    });
    if (atHome) state?.beds.forEach((bed, index) => {
      if (bed.kind !== 'crop' || bed.growth < cropDefinitions[bed.crop].days) return;
      const { foot, w } = plots[index];
      const x = foot.x + w * 0.41;
      art.draw(world, 'harvest-marker', x, foot.y + 4 + Math.sin(time * 2.1 + index) * 0.8,
        15, 15, { layer: world.overlay });
    });
    if ((atHome || atGrove) && (weather === 'sun' || weather === 'rainbow')) paintButterflies(time, atHome);
    weatherEffects.paint(weather, time, motion.matches);
    if (!motion.matches) paintFootfalls(moment);
    paintBursts(moment);
    paintCelebration(moment);
    const phase = state && getDayPhase(state);
    const wash = phase === 'Evening' ? '#6f49662b' : phase === 'Afternoon' ? '#e9b24c12' : undefined;
    if (wash) world.wash(wash);
    if (!guidance && atHome && state && getGoal(state)?.id === 'till' && state.beds[0]?.kind === 'empty' && selected !== areas[4]) {
      const { center, h } = plots[0];
      paintWaypoint(center.x, center.y - h / 2 - 11, time, '#fff0a4');
    }
    if (atHome && state?.eggsReady && !fieldView) {
      const egg = scenePoint(340, 626);
      art.draw(world, 'egg', egg.x, egg.y, 12, 15, { shadow: true });
      art.draw(world, 'egg', egg.x, egg.y, 12, 15);
      if (state.eggTrait) weatherEffects.glint(state.eggTrait, egg.x + 12, egg.y - 15, time);
    }
    if (guidance && guidance.island !== state?.island) guidance = undefined;
    const guided = guidance && currentSites().find(area => sameTarget(area.target, guidance!.target));
    if (guided) paintWaypoint(guided.center.x, guided.center.y - guided.h / 2 - 12, time, '#ffeaae');
    paintHint(guided || selected);
    world.render();
  }

  function tick(now: number): void {
    frameId = 0;
    if (abort.signal.aborted || !canAnimate()) return;
    if (pixelDensity !== (window.devicePixelRatio || 1)) resize();
    const interval = 1000 / (viewMode === 'dialog' ? 15 : 60);
    const elapsed = now - lastTime;
    if (!motion.matches && elapsed >= interval - 0.5) {
      lastTime = elapsed > 100 ? now : now - Math.max(0, elapsed - interval);
      paint(now / 1000);
    }
    scheduleFrame();
  }

  function requestPaint(): void {
    if (abort.signal.aborted) return;
    if (motion.matches && canAnimate()) paint(0);
  }

  function frameHarbourTarget(point: Point, explicit = false): void {
    if (state?.island !== 'village' || harbourView === 'overview') return;
    const next = harbourFocus(harbourViewport(), harbourView, point, harbourJourney, explicit);
    if (next.view === harbourView && next.traveling === harbourJourney) return;
    harbourView = next.view; harbourJourney = next.traveling;
    pointerStart = undefined; hovered = undefined;
    updateCameraView();
    harbourViewChanged?.(harbourView, false);
  }

  function cameraView(): { scale: number; center: Point } {
    if (state?.island === 'village') return harbourCamera(harbourViewport(), harbourJourney ? 'overview' : harbourView);
    const wide = Math.min(viewport.width / WORLD.w, viewport.height / WORLD.h);
    const closeUp = fieldView && state?.island === 'home';
    const shortLandscape = viewport.width > viewport.height && viewport.height < 480;
    const fieldHeight = Math.max(140, viewport.height - (shortLandscape ? 123 : 190));
    const baseScale = closeUp ? Math.min(viewport.width / 486, fieldHeight / 278) : wide;
    const baseCenter = closeUp ? scenePoint(784, 577) : { x: WORLD.w / 2, y: WORLD.h / 2 };
    const coveHeight = Math.max(120, viewport.height - (shortLandscape ? 110 : 200));
    const coveScale = Math.min(viewport.width / (430 * sceneScale), coveHeight / (280 * sceneScale));
    const focus = scenePoint(1320, 700);
    const coveCenter = { x: focus.x, y: focus.y + viewport.height * .1 / coveScale };
    return { scale: baseScale + (coveScale - baseScale) * coveBlend,
      center: { x: baseCenter.x + (coveCenter.x - baseCenter.x) * coveBlend,
        y: baseCenter.y + (coveCenter.y - baseCenter.y) * coveBlend } };
  }

  function updateCameraView(): void {
    const view = cameraView(); scale = view.scale;
    const center = view.center;
    offset = { x: viewport.width / 2 - center.x * scale, y: viewport.height / 2 - center.y * scale };
    world.setView(viewport.width, viewport.height, scale, center);
    syncShore();
  }

  function resize(): void {
    if (state?.island === 'village') pointerStart = undefined;
    pixelDensity = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect();
    viewport = { width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) };
    if (showFocus && focused) frameHarbourTarget(focused.center);
    const { scale: nextScale, center } = cameraView(); scale = nextScale;
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
    if (!world.available || crossing) return undefined;
    const { x, y } = location(event);
    if(state?.island==='home'){
      const minimum=event.pointerType==='touch'?44/scale:0;
      const hen=henSites.filter(area=>Math.abs(x-area.center.x)<=Math.max(area.w,minimum)/2&&Math.abs(y-area.center.y)<=Math.max(area.h,minimum)/2)
        .sort((a,b)=>distance(a.center,{x,y})-distance(b.center,{x,y}))[0];
      const feed=!state.chickensFed&&Math.abs(x-feedStationSite.center.x)<=Math.max(feedStationSite.w,minimum)/2&&Math.abs(y-feedStationSite.center.y)<=Math.max(feedStationSite.h,minimum)/2;
      if(feed&&(!hen||distance(feedStationSite.center,{x,y})<distance(hen.center,{x,y})))return feedStationSite;
      if(hen)return hen;
    }
    if (fieldView && event.pointerType === 'touch' && state?.island === 'home') {
      const minimum = 44 / scale;
      return areas.slice(4).filter((area) =>
        Math.abs(x - area.center.x) <= Math.max(area.w, minimum) / 2
        && Math.abs(y - area.center.y) <= Math.max(area.h, minimum) / 2)
        .sort((a, b) => distance(a.center, { x, y }) - distance(b.center, { x, y }))[0];
    }
    const sites = currentSites();
    if ((state?.island === 'cape' || state?.island === 'village') && event.pointerType === 'touch') {
      const minimum = 44 / scale;
      return sites.filter((area) => Math.abs(x - area.center.x) <= Math.max(area.w, minimum) / 2
        && Math.abs(y - area.center.y) <= Math.max(area.h, minimum) / 2)
        .sort((a, b) => distance(a.center, { x, y }) - distance(b.center, { x, y }))[0];
    }
    if (sites.includes(harborSite)) {
      const { mask } = projectStages.dock;
      const image = art.image(mask.key);
      if (image && maskHit(image, mask, x, y)) return harborSite;
    }
    const target = sites.find((area) => area !== kitchenSite && area !== harborSite && (!(fieldView && state?.island === 'home') || area.target.kind === 'bed')
      && Math.abs(x - area.center.x) <= area.w / 2 && Math.abs(y - area.center.y) <= area.h / 2);
    if (target) return target;
    if (state?.island === 'grove' && event.pointerType === 'touch') {
      const point = { x, y };
      return sites.filter(({ target, center }) =>
        (target.kind === 'shell' || target.kind === 'shoal-find' || target.kind === 'tidepool' || target.kind === 'cove') && distance(center, point) < 22 / scale)
        .sort((a, b) => distance(a.center, point) - distance(b.center, point))[0];
    }
    return fieldView && state?.island === 'home' ? undefined : upgradeHit(x, y);
  }

  function describeFocus(): void {
    const label = focused && inspect(focused.target);
    canvas.setAttribute('aria-label', label
      ? `Остров. ${label}. Выберите другое место стрелками и нажмите Enter для действия.`
      : 'Остров. Выберите место стрелками и нажмите Enter для действия.');
  }

  const listeners = { signal: abort.signal };
  function cancelHenGrip():void{
    const id=pointerStart?.id;
    if(id===undefined&&!heldHen)return;
    pointerStart=undefined;heldHen=undefined;canvas.style.cursor='default';
    bayAudio.stopEffects(['flock.lift']);
    if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    requestPaint();
  }
  canvas.tabIndex = 0;
  canvas.addEventListener('pointermove', (event) => {
    if (heldHen && pointerStart?.id === event.pointerId) {
      const point = location(event);
      heldHen.point = { x: point.x+heldHen.offset.x, y:point.y+heldHen.offset.y };
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) {
        if (!heldHen.dragging) playBaySound('flock.lift', 1, 0);
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
    guidance = undefined;
    if (!event.isPrimary || event.button !== 0) return;
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    const target = hit(event)?.target;
    if (target?.kind === 'hen') {
      void bayAudio.primeEvents(['flock.stroke', 'flock.lift', 'flock.settle']);
      const point=location(event),hen=hens[target.index],foot={x:hen.px.value,y:hen.py.value};
      heldHen = { index: target.index, point:foot,offset:{x:foot.x-point.x,y:foot.y-point.y}, dragging: false };
      canvas.setPointerCapture(event.pointerId);
    }
  }, listeners);
  canvas.addEventListener('pointercancel', (event) => {
    if (pointerStart?.id !== event.pointerId) return;
    cancelHenGrip();
  }, listeners);
  canvas.addEventListener('lostpointercapture',cancelHenGrip,listeners);
  window.addEventListener('blur',cancelHenGrip,listeners);
  canvas.addEventListener('pointerup', (event) => {
    const start = pointerStart;
    if (start?.id !== event.pointerId) return;
    const held = heldHen;
    pointerStart = undefined;
    heldHen = undefined;
    if (held) {
      const hen = hens[held.index];
      if (held.dragging) {
        const ground=projectHenToGround(nativeHenPoint(held.point),state?.buildingLevels);
        Object.assign(hen,scenePoint(ground.x,ground.y));moveHen?.(held.index,ground);
      }
      activate({ kind: 'hen', index: held.index }, held.dragging ? 'settle' : 'stroke');
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
    focused ??= state?.island === 'home' ? areas[4] : currentSites()[0];
    if (showFocus && focused) frameHarbourTarget(focused.center);
    describeFocus();
    requestPaint();
  }, listeners);
  canvas.addEventListener('blur', () => {
    showFocus = false;
    requestPaint();
  }, listeners);
  canvas.addEventListener('keydown', (event) => {
    if (!world.available || crossing) return;
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction && event.key !== 'Enter' && event.key !== ' ') return;
    guidance = undefined;
    event.preventDefault();
    hovered = undefined;
    showFocus = true;
    focused ??= state?.island === 'home' ? areas[4] : currentSites()[0];
    if (direction) {
      const origin = focused.center;
      const [dx, dy] = direction;
      let score = Infinity;
      for (const area of currentSites()) {
        if (fieldView && state?.island === 'home' && area.target.kind !== 'bed') continue;
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
      frameHarbourTarget(focused.center, true);
      activate(focused.target);
    }
    if (direction) frameHarbourTarget(focused.center, true);
    describeFocus();
    requestPaint();
  }, listeners);
  motion.addEventListener('change', () => {
    cancelAnimationFrame(frameId);
    if (motion.matches) {
      arrival = 0;
      shoalReveal = 0;
      shoalRevealPending = false;
      guestDeparture = 0;
      honeyReward = 0;
      kitchenReward = undefined;
      capeBuild = undefined;
      flowerPlanted.clear();
      crossingVeil.getAnimations().forEach((animation) => animation.finish());
      duration = 0;
      const pickup = shorePickup;
      shorePickup = undefined;
      shoreReward = undefined;
      pickup?.commit();
      const cape = capeWork;
      capeWork = undefined;
      if (cape && !cape.hit) cape.commit();
      const active = gesture;
      const queued = workOrders;
      gesture = undefined;
      workOrders = [];
      if (active && !active.hit) active.order.commit();
      for (const order of queued) order.commit();
      requestPaint();
    }
    reconcileFrames();
  }, listeners);
  document.addEventListener('visibilitychange', reconcileFrames, listeners);

  const load = (key: string, frames: number, path = key) =>
    art.load(key, `lavender/${path}`, [frames, 1]);
  function loadStage(stage: typeof projectStages.fair): void {
    art.load(stage.patch.key, stage.patch.path);
    art.load(stage.mask.key, stage.mask.path);
  }
  function loadIslandAssets(next: FarmState): void {
    const island = next.island;
    if(next.boatOwned)art.load('bay-ferry','lavender/bay/ferry',[1,1])
    art.load(`${island}-plate`, landscape[island].path);
    landscape[island].occluders.forEach((bounds, index) => art.loadUrl(`${island}-occluder-${index}`, bounds.url));
    load('boat', 1, 'home-boat');
    load('farmer-actions', 6);
    for (const direction of ['left', 'right', 'back']) {
      load(`walk-${direction}`, 4);
      load(`walk-${direction}-smooth`, 8);
    }
    art.load('butterfly', 'butterfly', [2, 2]);
    art.load('heart', 'heart', [1, 1]);
    if (island === 'home' || island === 'grove') {
      load('orchard-start', 2);
      for (const tree of ['apple', 'pear', 'peach']) load(`tree-${tree}`, 2);
      const project = island === 'home' ? 'fair' : 'dock';
      if (isProjectComplete(next, project)) loadStage(projectStages[project]);
    }
    if (island === 'home') {
      art.load('windmill-sails', 'lavender/home-mill-sails');
      load('hen-poses', 8);
      load('hen-walk-smooth', 8);
      load('feed-station', 1, 'tool-feed');
      for (const action of ['water', 'till']) load(`work-${action}`, 4);
      for (const crop of new Set(next.beds.flatMap(bed => bed.kind === 'crop' ? [bed.crop] : []))) {
        load(`crop-${crop}`, 4);
        art.load(`item-${crop}`, `icons/${crop}`, [1, 1]);
      }
      art.load('harvest-marker', 'harvest-marker', [1, 1]);
      art.load('egg', 'icons/egg', [1, 1]);
      for (const asset of buildingUpgrades) {
        if (next.buildingLevels[asset.building] < 2) continue;
        const branch = next[`${asset.building}Specialization`];
        loadStage(branch ? specializationStages[branch] : asset);
      }
      if (getFairGuest(next)) {
        load('fair-guest', 1);
        load('fair-guest-walk', 4);
        art.load('guest-apple', 'icons/apple', [1, 1]);
        load('guest-jam', 1, 'ui-apple-jam');
        load('guest-cake', 1, 'ui-honey-cake');
        art.load('item-wheat', 'icons/wheat', [1, 1]);
      }
    } else if (island === 'grove') {
      if (hasBayDisplay(next)) load('bay-display', 1);
      for (const key of ['ui-shell', 'ui-moon-shell', 'shore-crab', 'ui-sea-glass', 'ui-moon-pearl', 'shoal-starfish']) load(key, 1);
      load('shore-crab-walk', 4);
      load('cove-minnow', 4);
      load('cove-egret', 4);
      for (const key of ['cove-kelp-right', 'cove-kelp-left', 'cove-meadow', 'cove-rock', 'cove-refuge', 'cove-perch']) load(key, 1);
      art.load('cove-terrain', 'lavender/cove-terrain');
      art.load('salt', 'salt', [1, 1]);
    } else if (island === 'cape') {
      for (const key of ['cape-flowers', 'ui-honey', 'ui-wind-honey', 'cape-bee', 'ui-beeswax', 'ui-honey-biscuits', 'ui-honey-pear', 'ui-wind-parfait']) load(key, 1);
      if (next.capeLevel >= 2) load('cape-apiary', 1);
      if (next.capeLevel >= 3) load('cape-honey-kitchen', 1);
    } else {
      // Warm both small patches so the first supper changes the scene at once.
      if (villageHomeArtKey(next) !== 'village-plate') {
        for (const stage of villageHomeStages) art.load(stage.key, stage.path);
      }
      art.load('bay-pavilion','lavender/bay/pavilion',[1,1])
      art.load('bay-pergola','lavender/bay/pergola',[1,1])
      for (const tradition of ['harvest', 'lights', 'stage'] as const) {
        if (next.festivals.completed[tradition] > 0) art.load(`festival-${tradition}`, `lavender/festivals/${tradition}`, [1, 1]);
      }
      for (const instrument of ['handpan', 'bass']) art.load(`festival-${instrument}`, `lavender/bay/music-${instrument}`, [1, 1]);
      load('village-bea', 6);
      load('village-finn', 6);
      art.load('neighbor-bea-work', 'lavender/community/bea-work', [3, 2]);
      art.load('neighbor-finn-work', 'lavender/community/finn-work', [3, 2]);
      art.load('neighbor-props', 'lavender/community/props', [2, 2]);
      for (const key of ['ui-tart', 'ui-strawberry-tart', 'ui-blueberry-tart', 'ui-raspberry-tart',
        'ui-orchard-preserves', 'ui-apple-jam', 'ui-farmhouse-bread', 'ui-honey-cake',
        'ui-handmade-round', 'ui-handmade-folded', 'ui-handmade-long', 'ui-grilled-fish']) load(key, 1);
    }
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  describeFocus();
  resize();
  scheduleFrame();
  return {
    setViewMode(next: typeof viewMode) {
      if (next === viewMode) return;
      if (next === 'minigame') { cancelHenGrip(); bayAudio.stopEffects(farmSoundEvents); }
      viewMode = next;
      reconcileFrames();
    },
    focusTarget(target: IslandTarget): void {
      const site = currentSites().find(area => sameTarget(area.target, target));
      if (!site) return;
      focused = site;
      if (state) guidance = {target, island: state.island};
      hovered = undefined;
      showFocus = true;
      canvas.focus({ preventScroll: true });
      showFocus = true;
      frameHarbourTarget(site.center, true);
      describeFocus();
      requestPaint();
    },
    isCrossing(): boolean { return crossing; },
    workCape(target: CapeWork['target'], commit: CapeWork['commit'], reward?: string): void {
      if (state?.island !== 'cape' || crossing || !world.available || capeWork && sameTarget(capeWork.target, target)) return;
      if (target.kind === 'honey-kitchen' && state.capeLevel < 3) return;
      const site = currentSites().find((area) => sameTarget(area.target, target));
      if (!site) return;
      moveTo(site.stop);
      if (motion.matches) commit();
      else capeWork = { target, commit, reward, hit: false };
    },
    async crossIsland(commit: () => boolean): Promise<void> {
      if (crossing || abort.signal.aborted) return;
      cancelHenGrip();
      bayAudio.stopEffects(farmSoundEvents);
      if (motion.matches) { commit(); return; }
      crossing = true;
      capeWork = undefined;
      departure = performance.now();
      hovered = undefined;
      crossingVeil.hidden = false;
      let fade: Animation | undefined;
      try {
        fade = crossingVeil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-in-out', fill: 'forwards' });
        await fade.finished;
        if (abort.signal.aborted) return;
        commit();
        departure = 0;
        if (state) {
          const island = state.island;
          const keys = [`${island}-plate`, ...landscape[island].occluders.map((_, index) => `${island}-occluder-${index}`)];
          if (island === 'village') keys.push(villageHomeArtKey(state));
          let timeout: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([art.ready(keys), new Promise(resolve => { timeout = setTimeout(resolve, 6000); })]);
          } finally {
            clearTimeout(timeout);
          }
        }
        if (abort.signal.aborted) return;
        if (motion.matches) return;
        fade.cancel();
        fade = crossingVeil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, easing: 'ease-in-out', fill: 'forwards' });
        await fade.finished;
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
      } finally {
        fade?.cancel();
        crossing = false;
        departure = 0;
        crossingVeil.hidden = true;
        requestPaint();
      }
    },
    render(next: FarmState): void {
      loadIslandAssets(next);
      const moment = performance.now();
      hens.forEach((hen,index)=>{
        const saved=next.henPositions?.[index]??null;
        const changed=hen.saved===undefined||saved?.x!==hen.saved?.x||saved?.y!==hen.saved?.y;
        if(changed){
          const point=projectHenToGround(saved??defaultHenPositions[index],next.buildingLevels),anchor=scenePoint(point.x,point.y);
          Object.assign(hen,anchor);
          if(hen.saved===undefined){hen.px.value=anchor.x;hen.py.value=anchor.y;hen.px.speed=hen.py.speed=0}
          hen.saved=saved?{...saved}:null;
        }else{
          const safe=projectHenToGround(nativeHenPoint(hen),next.buildingLevels);Object.assign(hen,scenePoint(safe.x,safe.y));
        }
      });
      syncVillageResidents(next, moment);
      if (next.village.built && !villageBuiltSeen && state && !motion.matches) villageWelcome = moment;
      villageBuiltSeen = next.village.built;
      if (currentIsland === 'cape' && next.island === 'cape' && next.capeLevel > capeLevelSeen && !motion.matches) {
        capeBuild = { level: next.capeLevel, began: performance.now() };
        const asset = next.capeLevel === 2 ? capeBuildings.apiary : capeBuildings.kitchen;
        celebrate({ x: asset.x - asset.w / 2, w: asset.w, h: asset.h, footY: asset.y });
      }
      capeLevelSeen = next.capeLevel;
      const expanded = hasShoal(next);
      if (expanded && !shoalKnown && currentIsland === 'grove' && !motion.matches) {
        shoalRevealPending = !art.image(shoalPlate.key);
        if (!shoalRevealPending) shoalReveal = performance.now();
      }
      shoalKnown = expanded;
      const served = getFairGuest(next)?.served ?? false;
      if (served && !guestServed && currentIsland === 'home' && next.island === 'home' && !motion.matches) guestDeparture = performance.now();
      if (!served) guestDeparture = 0;
      guestServed = served;
      if (next.island === 'grove' && !shoalRequested) {
        shoalRequested = true;
        art.load(shoalPlate.key, shoalPlate.path);
      }
      if (currentIsland !== next.island) {
        bayAudio.stopEffects(farmSoundEvents);
        if (next.island !== 'grove') { coveFocus = false; coveBlend = 0; }
        heldHen=undefined;pointerStart=undefined;
        harbourView = 'overview'; harbourJourney = false;
        harbourViewChanged?.(harbourView, false);
        residentClock = 0;
        villageMealCelebration = 0;
        if (next.island === 'village' && !motion.matches) villageWelcome = performance.now();
        shoalReveal = 0;
        shoalRevealPending = false;
        guestDeparture = 0;
        kitchenReward = undefined;
        capeBuild = undefined;
        arrival = currentIsland && !motion.matches ? performance.now() : 0;
        currentIsland = next.island;
        const dock = docks[next.island];
        farmer = destination = next.island === 'home' && !state ? HOME : dock.entry;
        duration = 0;
        workOrders = [];
        gesture = undefined;
        shorePickup = undefined;
        capeWork = undefined;
        shoreReward = undefined;
        footfalls.length = 0;
        celebrationSparks.length = 0;
        focused = undefined;
        hovered = undefined;
      }
      state = next;
      updateCameraView();
      syncShore();
      describeFocus();
      requestPaint();
    },
    visit(target: IslandTarget): void {
      workOrders = [];
      gesture = undefined;
      shorePickup = undefined;
      capeWork = undefined;
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
    pickShore(target: ShoreTarget, commit: () => boolean): void {
      const site = shoreSites.find((area) => sameTarget(area.target, target));
      if (!site || state?.island !== 'grove' || target.kind === 'shoal-find' && !islandPlate().expanded
        || !getShoreItem(state, target) || shorePickup?.site === site) return;
      void bayAudio.primeEvents([target.kind === 'shell' ? 'gather.shell' : 'gather.find']);
      moveTo(site.stop);
      if (motion.matches) commit();
      else shorePickup = { site, commit };
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
    showIrrigation(targets: readonly number[]): void {
      if (motion.matches) return;
      const now = performance.now();
      for (const [offset, index] of targets.entries()) {
        const { center, foot } = plots[index];
        const began = now + offset * 42;
        impactByBed.set(index, began);
        bursts.push({ ...foot, from: { x: center.x - 18, y: center.y - 16 }, kind: 'water', began });
      }
    },
    showUpgrade(building: BuildingId): void {
      const branch = state?.[`${building}Specialization`];
      const bounds = branch ? specializationStages[branch].mask
        : buildingUpgrades.find((asset) => asset.building === building)!.mask;
      celebrate(bounds);
    },
    showHatch(): void {
      if (motion.matches || !state) return;
      const hen = hens[state.flockSize - 1];
      hen.excited = performance.now() + 950;
      hen.lift.speed = 245;
      celebrate(specializationStages.hatchery.mask);
    },
    showProject(id: ProjectId): void {
      celebrate(projectStages[id].mask);
    },
    setHarbourViewport(next: HarbourViewport): void {
      if (next.top === harbourInsets.top && next.bottom === harbourInsets.bottom) return;
      harbourInsets = { top: next.top, bottom: next.bottom };
      if (state?.island !== 'village') return;
      pointerStart = undefined; hovered = undefined;
      if (showFocus && focused) frameHarbourTarget(focused.center);
      updateCameraView(); requestPaint();
    },
    setHarbourView(next: HarbourView): void {
      if (state?.island !== 'village' || crossing) return;
      harbourView = next; harbourJourney = false;
      pointerStart = undefined; hovered = undefined; guidance = undefined; showFocus = false;
      focused = currentSites().find(site => harbourPointVisible(harbourViewport(), next, site.center));
      updateCameraView();
      harbourViewChanged?.(harbourView, false);
      describeFocus(); requestPaint();
    },
    toggleFieldView(): boolean {
      fieldView = !fieldView;
      if (fieldView && focused?.target.kind !== 'bed') focused = areas[4];
      resize();
      describeFocus();
      return fieldView;
    },
    setCoveFocus(active: boolean): void {
      coveFocus = active;
      if (motion.matches) { coveBlend = active && state?.island === 'grove' ? 1 : 0; updateCameraView(); }
      hovered = undefined;
      requestPaint();
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
      bayAudio.stopEffects(farmSoundEvents);
      cancelAnimationFrame(frameId);
      observer.disconnect();
      abort.abort();
      world.dispose();
      supportShadows.clear();
      hint.remove();
      unavailable.remove();
      crossingVeil.getAnimations().forEach((animation) => animation.cancel());
      crossingVeil.remove();
    },
  };
}
