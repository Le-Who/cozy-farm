export type FishingPhase = 'ready' | 'descending' | 'ascending' | 'done';
export const fishingSpecies = ['perch', 'seaBass', 'moonfish', 'lanternfish'] as const;
export type FishingSpecies = typeof fishingSpecies[number];
export type FishingLoot =
  | { kind: 'fish'; species: FishingSpecies; variant: 'regular' | 'rare' }
  | { kind: 'shell'; variant: 'regular' | 'moon' }
  | { kind: 'junk'; item: 'boot' | 'weed' | 'rock' };
export type FishingCatch = {
  id: number; x: number; depth: number; direction: number; rare: boolean;
  loot?: FishingLoot;
  dart?: { phase: 'warning' | 'lunging' | 'cooldown'; remaining: number; offset: number; distance: number };
};
export type FishingModel = {
  phase: FishingPhase; x: number; targetX: number; depth: number; deepest: number;
  contacts: number; immunity: number; capacity: number; resilience: number; time: number; ascentSpeed: number;
  fish: FishingCatch[]; caught: number[]; flash: number; nextDartAt: number; steeringLimit: number;
};
export const fishingDepth = 30;
export const fishingHalfWidth = 4.8;

/** Depth is measured in simulation units: four displayed metres per unit. */
export function fishingLootAtDepth(depth: number, roll: number, common: 'perch' | 'seaBass' = 'perch'): FishingLoot {
  const deep = Math.max(0, Math.min(1, depth / fishingDepth));
  const junkChance=.3-deep*.26;
  const shellChance=.1;
  if (roll < junkChance) return { kind: 'junk', item: deep < .35 ? 'weed' : deep < .7 ? 'boot' : 'rock' };
  if (roll < junkChance+shellChance) return { kind: 'shell', variant: deep > .7 && roll < junkChance+.04 ? 'moon' : 'regular' };
  if (deep >= .62 && roll > 1 - (deep - .55) * .8) return {
    kind: 'fish', species: deep > .84 ? 'lanternfish' : 'moonfish', variant: 'rare',
  };
  return { kind: 'fish', species: common, variant: 'regular' };
}

export function createFishingModel(capacity: number, resilience = 2, seed = 1, common: 'perch' | 'seaBass' = 'perch'): FishingModel {
  let state = seed >>> 0;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const fish = Array.from({ length: 18 }, (_, id): FishingCatch => {
    const depth = 3 + id / 18 * 25 + random() * .5;
    const loot = fishingLootAtDepth(depth, random(), common);
    return { id, x: (random() - .5) * 8.6, depth, direction: random() > .5 ? 1 : -1,
      rare: loot.kind === 'fish' && loot.variant === 'rare', loot };
  });
  return {
    phase: 'ready', x: 0, targetX: 0, depth: 0, deepest: 0, contacts: 0, immunity: 0,
    capacity: Math.min(12, Math.max(1, Math.round(Number.isFinite(capacity) ? capacity : 2))),
    resilience: Math.min(4, Math.max(1, Math.round(Number.isFinite(resilience) ? resilience : 2))),
    time: 0, ascentSpeed: fishingDepth / 9, caught: [], flash: 0, fish, nextDartAt: 1.4, steeringLimit: fishingHalfWidth,
  };
}

export function castFishing(model: FishingModel): void {
  if (model.phase === 'ready') model.phase = 'descending';
}

export function reelFishing(model: FishingModel): void {
  if (model.phase === 'descending') model.phase = 'ascending';
}

export function fishPosition(fish: FishingCatch, time: number): number {
  if (fish.loot && fish.loot.kind !== 'fish') return fish.x;
  const width = 15;
  const forward = fish.x + fish.direction * time * (.16 + fish.id % 4 * .02);
  return ((forward + width / 2) % width + width) % width - width / 2 + (fish.dart?.offset ?? 0);
}

export function fishingCatchLoot(fish: FishingCatch, common: 'perch' | 'seaBass' = 'perch'): FishingLoot {
  return fish.loot ?? { kind: 'fish', species: common, variant: 'regular' };
}

export function fishingCatchScale(fish: FishingCatch): number {
  return fish.rare ? 1.08 : fish.loot?.kind === 'fish' && fish.id % 3 === 0 ? .72 : 1;
}

// Coordinates follow the visible flesh, excluding fins and transparent sprite margins.
const fishBodies = {
  perch: { middle: .1, mouth: .74, depth: .035, halfHeight: .22 },
  seaBass: { middle: .1, mouth: .74, depth: .035, halfHeight: .22 },
  moonfish: { middle: .18, mouth: .82, depth: .12, halfHeight: .38 },
  lanternfish: { middle: .08, mouth: .68, depth: .12, halfHeight: .23 },
};

export function fishingCatchMouth(fish: FishingCatch): { x: number; depth: number } {
  const scale = fishingCatchScale(fish);
  if (fish.loot && fish.loot.kind !== 'fish') return { x: 0, depth: 0 };
  const body = fishBodies[fish.loot?.species ?? 'perch'];
  return { x: fish.direction * body.mouth * scale, depth: body.depth * scale };
}

/** The whole front half can be hooked, with a small allowance at its outline. */
export function fishingCatchRegion(fish: FishingCatch): { minX: number; maxX: number; minDepth: number; maxDepth: number } {
  if (fish.loot && fish.loot.kind !== 'fish') return { minX: -.38, maxX: .38, minDepth: -.43, maxDepth: .43 };
  const scale = fishingCatchScale(fish);
  const body = fishBodies[fish.loot?.species ?? 'perch'];
  const back = (body.middle - .08) * scale;
  const front = (body.mouth + .08) * scale;
  return {
    minX: fish.direction > 0 ? back : -front, maxX: fish.direction > 0 ? front : -back,
    minDepth: (body.depth - body.halfHeight - .075) * scale,
    maxDepth: (body.depth + body.halfHeight + .075) * scale,
  };
}

function captureTime(fromX: number, fromDepth: number, toX: number, toDepth: number, fish: FishingCatch): number | null {
  const region = fishingCatchRegion(fish);
  let entry = 0, exit = 1;
  for (const [from, to, min, max] of [[fromX, toX, region.minX, region.maxX], [fromDepth, toDepth, region.minDepth, region.maxDepth]]) {
    const delta = to - from;
    if (Math.abs(delta) < 1e-10) { if (from < min || from > max) return null; }
    else {
      const a = (min - from) / delta, b = (max - from) / delta;
      entry = Math.max(entry, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
      if (entry > exit) return null;
    }
  }
  return entry;
}

function stepDarts(model: FishingModel, dt: number): void {
  for (const fish of model.fish) {
    if (fish.dart) {
      const dart = fish.dart;
      dart.remaining = Math.max(0, dart.remaining - dt);
      if (dart.phase === 'warning' && dart.remaining === 0) { dart.phase = 'lunging'; dart.remaining = .34; }
      else if (dart.phase === 'lunging') {
        dart.offset += dart.distance * dt / .34;
        if (dart.remaining === 0) { dart.phase = 'cooldown'; dart.remaining = 3; }
      } else if (dart.phase === 'cooldown') {
        if (dart.remaining === 0) { fish.x += dart.offset; fish.dart = undefined; }
      }
    }
  }
  if (model.phase !== 'descending' || model.time < model.nextDartAt) return;
  const candidate = model.fish.find(fish => fish.loot?.kind === 'fish' && fish.id % 3 === 0 && !fish.rare && !fish.dart
    && fish.depth - model.depth > 2.6 && fish.depth - model.depth < 3.7
    && Math.abs(fishPosition(fish, model.time) - model.x) > .9
    && Math.abs(fishPosition(fish, model.time) - model.x) < 2.2
    && Math.sign(model.x - fishPosition(fish, model.time)) === fish.direction);
  if (!candidate) return;
  candidate.dart = { phase: 'warning', remaining: .8, offset: 0,
    distance: candidate.direction * Math.min(1.2, Math.abs(model.x - fishPosition(candidate, model.time))) };
  model.nextDartAt = model.time + 4.5;
}

/** A bounded simulation step prevents background tabs skipping collision/capture windows. */
export function stepFishing(model: FishingModel, elapsed: number): void {
  const dt = Math.max(0, Math.min(.05, Number.isFinite(elapsed) ? elapsed : 0));
  if (model.phase === 'done') return;
  const previousX = model.x, previousDepth = model.depth;
  const previousFishX = model.fish.map(fish => fishPosition(fish, model.time));
  model.time += dt;
  model.immunity = Math.max(0, model.immunity - dt);
  model.flash = Math.max(0, model.flash - dt);
  model.targetX = Math.min(model.steeringLimit, Math.max(-model.steeringLimit, model.targetX));
  model.x += (model.targetX - model.x) * (1 - Math.exp(-dt * 14));
  if (model.phase === 'ready') return;
  stepDarts(model, dt);
  const baseSpeed = fishingDepth / 9;
  const targetSpeed = model.caught.length >= model.capacity ? baseSpeed * 3.4 : baseSpeed;
  model.ascentSpeed += (targetSpeed - model.ascentSpeed) * (1 - Math.exp(-dt * 5));
  model.depth = Math.max(0, Math.min(fishingDepth, model.depth + dt * (model.phase === 'descending' ? baseSpeed : -model.ascentSpeed)));
  model.deepest = Math.max(model.deepest, model.depth);
  if (model.phase === 'descending') {
    const hitFish = model.fish.some(fish => (!fish.loot || fish.loot.kind === 'fish')
      && Math.abs(model.x - fishPosition(fish, model.time)) < .5 * fishingCatchScale(fish) && Math.abs(model.depth - fish.depth) < .28);
    if (model.immunity === 0 && hitFish) {
      model.contacts++;
      model.immunity = .9;
      model.flash = .55;
      if (model.contacts >= model.resilience) reelFishing(model);
    }
    if (model.depth >= fishingDepth) reelFishing(model);
  } else {
    const crossed = model.fish.flatMap((fish, i) => {
      if (model.caught.includes(fish.id)) return [];
      const currentX = fishPosition(fish, model.time);
      // Wrapping happens beyond the play field; never sweep a fish across its entire width.
      const oldX = Math.abs(currentX - previousFishX[i]) > 7.5 ? currentX : previousFishX[i];
      const at = captureTime(previousX - oldX, previousDepth - fish.depth,
        model.x - currentX, model.depth - fish.depth, fish);
      return at === null ? [] : [{ id: fish.id, at }];
    }).sort((a, b) => a.at - b.at);
    for (const fish of crossed) {
      if (model.caught.length >= model.capacity) break;
      model.caught.push(fish.id);
    }
    if (model.depth <= 0) model.phase = 'done';
  }
}
