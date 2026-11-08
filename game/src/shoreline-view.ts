import type { getCoveEcology } from './shoreline.ts';

type Ecology = ReturnType<typeof getCoveEcology>;
export type CovePoint = { x: number; y: number };
export type CovePose = CovePoint & { frame: number; flip: boolean; angle: number; opacity: number };
type Body = CovePose & { previousX: number; previousY: number; travel: number };
export const coveSceneAnchors = {
  focus: { x: 1320, y: 700 },
  refuge: { x: 1250, y: 707 },
  kelp: [{ x: 1292, y: 720 }, { x: 1372, y: 729 }],
  meadow: [{ x: 1235, y: 661 }, { x: 1324, y: 644 }],
  perch: { x: 1439, y: 657 },
  water: { x: 1340, y: 706, rx: 100, ry: 43 },
};

const body = (point: CovePoint): Body => ({ ...point, previousX: point.x, previousY: point.y, travel: 0, frame: 0, flip: false, angle: 0, opacity: 1 });
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const ease = (t: number) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
const mix = (a: CovePoint, b: CovePoint, t: number): CovePoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const distance = (a: CovePoint, b: CovePoint) => Math.hypot(a.x - b.x, a.y - b.y);

export function coveChannelPoint(t: number): CovePoint {
  const a = { x: 1271, y: 690 }, b = { x: 1453, y: 744 };
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * -8 };
}

export function createCoveMotion() {
  return { time: 0, quiet: 0, lastFarmer: { x: 0, y: 0 },
    crab: body({ x: 1210, y: 730 }), egret: body(coveSceneAnchors.perch),
    minnows: Array.from({ length: 7 }, (_, i) => body({ x: 1305 + i % 3 * 11, y: 705 + Math.floor(i / 3) * 5 })) };
}
export type CoveMotion = ReturnType<typeof createCoveMotion>;

function move(body: Body, target: CovePoint, dt: number, reduced: boolean, sharpness: number): void {
  body.previousX = body.x; body.previousY = body.y;
  const blend = reduced ? 1 : 1 - Math.exp(-dt * sharpness);
  body.x += (target.x - body.x) * blend; body.y += (target.y - body.y) * blend;
  const dx = body.x - body.previousX, dy = body.y - body.previousY;
  if (!reduced) body.travel += Math.hypot(dx, dy);
  if (Math.abs(dx) > .025) body.flip = dx < 0;
  if (Math.hypot(dx, dy) > .03) {
    const angle = clamp(Math.atan2(dy, Math.abs(dx)) * (body.flip ? -1 : 1), -.38, .38);
    body.angle += (angle - body.angle) * (reduced ? 1 : 1 - Math.exp(-dt * 9));
  }
}

/** Behaviours share the settled ecology; the farmer can startle them, then quietly watch them return. */
export function stepCoveMotion(state: CoveMotion, ecology: Ecology, elapsed: number, farmer: CovePoint, reduced = false): CoveMotion {
  const dt = clamp(elapsed, 0, .05);
  if (!reduced) state.time += dt;
  if (distance(farmer, state.lastFarmer) > .8) state.quiet = 0;
  else state.quiet += dt;
  state.lastFarmer = { ...farmer };
  const t = (reduced ? 0 : state.time) + ecology.phase * 1.7;
  const alert = !reduced && state.quiet < 2.8 && distance(farmer, coveSceneAnchors.water) < 160;

  const refuge = coveSceneAnchors.refuge;
  const crabCycle = t * ecology.animals.crab.speed % 18;
  const sheltered = ecology.animals.crab.refuge && (alert || crabCycle < 5);
  const crabTarget = sheltered ? { x: refuge.x - 6, y: refuge.y + 4 }
    : alert ? { x: 1200, y: 693 }
      : { x: 1222 + Math.sin(t * .38) * (ecology.animals.crab.refuge ? 22 : 39), y: 734 + Math.sin(t * .59) * 8 };
  move(state.crab, crabTarget, dt, reduced, alert ? 7 : 2.5);
  state.crab.frame = reduced ? 0 : Math.floor(state.crab.travel / 4.5) % 4;
  state.crab.angle = reduced ? 0 : Math.sin(t * 12) * .018;
  const crabOpacity = sheltered ? .35 + clamp(distance(state.crab, refuge) / 30, 0, .65) : 1;
  state.crab.opacity += (crabOpacity - state.crab.opacity) * (reduced ? 1 : 1 - Math.exp(-dt * 6));

  const wade = ecology.animals.egret.mode === 'wade';
  const birdCycle = t * ecology.animals.egret.speed % 22;
  const birdMove = birdCycle < 7 ? ease(birdCycle / 7) : birdCycle < 12 ? 1 : 1 - ease((birdCycle - 12) / 8);
  const birdTarget = alert ? { x: 1470, y: 654 } : wade
    ? mix(coveSceneAnchors.perch, { x: 1402, y: 711 }, birdMove)
    : { x: 1439 + Math.sin(t * .21) * 3, y: coveSceneAnchors.perch.y };
  move(state.egret, birdTarget, dt, reduced, alert ? 5 : 3.5);
  const walking = Math.hypot(state.egret.x - state.egret.previousX, state.egret.y - state.egret.previousY) > .07;
  state.egret.frame = reduced ? 0 : alert ? 3 : walking ? Math.floor(state.egret.travel / 11) % 2
    : wade && birdCycle >= 7 && birdCycle < 12 ? 2 : 0;
  state.egret.angle = 0; state.egret.opacity = 1;

  for (const [i, fish] of state.minnows.entries()) {
    if (i >= ecology.animals.minnows.count) { fish.opacity = 0; continue; }
    const migrating = ecology.animals.minnows.mode === 'migrate';
    const phase = (t * .042 * ecology.animals.minnows.speed + i * .137) % 1;
    const schoolCenter = alert && ecology.choices.cover === 'kelp' ? { x: 1295, y: 711 }
      : { x: 1321 + Math.sin(t * .33) * 27, y: 705 + Math.sin(t * .56) * 9 };
    const target = migrating ? coveChannelPoint(phase)
      : { x: schoolCenter.x + (i % 3 - 1) * 18, y: schoolCenter.y + (Math.floor(i / 3) - 1) * 9 };
    const opacity = migrating ? ease(phase / .12) * ease((1 - phase) / .12) : 1;
    if (migrating && distance(fish, target) > 90 && opacity < .1) { fish.x = target.x; fish.y = target.y; }
    move(fish, target, dt, reduced, migrating ? 9 : 4);
    fish.frame = reduced ? 0 : Math.floor(t * (4 + ecology.animals.minnows.speed * 3) + i) % 4;
    fish.opacity = opacity * .92;
  }
  return state;
}
