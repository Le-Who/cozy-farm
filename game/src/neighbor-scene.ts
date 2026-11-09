type Point = { x: number; y: number };
export type NeighborScenePlan = {
  resident: 'bea' | 'finn';
  episode: 'beaTea' | 'beaBasket' | 'finnShore' | 'finnLantern';
  phase: 'preparing' | 'joined' | 'arranging' | 'celebrating' | 'remembered';
  memoryCount: number;
};

// All coordinates are authored native village pixels. The island applies its
// single shared scale to these contacts, sprites, routes and interaction stops.
export const neighborSceneAnchors = {
  beaTea: {
    prop: { x: 936, y: 607 }, stand: { x: 874, y: 650 }, source: { x: 597, y: 610 },
    guest: { x: 1072, y: 743 }, player: { x: 990, y: 744 }, frame: 0,
    width: 115, height: 115, groundY: 700,
  },
  beaBasket: {
    prop: { x: 691, y: 623 }, stand: { x: 640, y: 655 }, source: { x: 597, y: 610 },
    guest: { x: 759, y: 735 }, player: { x: 688, y: 706 }, frame: 1,
    width: 100, height: 100, groundY: 623,
  },
  finnShore: {
    prop: { x: 1242, y: 704 }, stand: { x: 1180, y: 690 }, source: { x: 1222, y: 561 },
    guest: { x: 1116, y: 744 }, player: { x: 1266, y: 750 }, frame: 1,
    width: 105, height: 105, groundY: 704,
  },
  finnLantern: {
    prop: { x: 1282, y: 628 }, stand: { x: 1220, y: 633 }, source: { x: 1222, y: 561 },
    guest: { x: 1166, y: 707 }, player: { x: 1265, y: 705 }, frame: 2,
    width: 105, height: 105, groundY: 628,
  },
} as const;

export function getNeighborSceneState(plan: NeighborScenePlan) {
  const anchors = neighborSceneAnchors[plan.episode];
  return {
    ...anchors,
    phase: plan.phase === 'preparing' ? 'preparing' : plan.phase === 'joined' ? 'ready'
      : plan.phase === 'arranging' ? 'gathering' : plan.phase === 'remembered' ? 'memory' : 'celebrating',
    // An earlier shared occasion stays in the physical village while another
    // plan is being prepared. It never depends on a transient celebration timer.
    keepsake: plan.memoryCount > 0 ? plan.resident === 'bea'
      ? { point: { x: 1038, y: 596 }, frame: 3, width: 61, height: 61, groundY: 700 }
      : { point: { x: 1368, y: 518 }, frame: 2, width: 57, height: 57, groundY: 561 } : null,
  };
}

export type NeighborWalker = {
  point: Point; route: Point[]; facingRight: boolean; stride: number;
};

export function stepNeighborWalker(actor: NeighborWalker, seconds: number, speed: number): number {
  let budget = Math.max(0, Math.min(seconds, .05)) * speed;
  let traveled = 0;
  while (actor.route.length && budget > 0) {
    const next = actor.route[0];
    const dx = next.x - actor.point.x, dy = next.y - actor.point.y;
    const gap = Math.hypot(dx, dy);
    if (gap < .001) { actor.route.shift(); continue; }
    const step = Math.min(budget, gap);
    if (Math.abs(dx) > .2) actor.facingRight = dx > 0;
    actor.point = { x: actor.point.x + dx / gap * step, y: actor.point.y + dy / gap * step };
    actor.stride += step / 38;
    traveled += step;
    budget -= step;
    if (step === gap) actor.route.shift();
  }
  return traveled;
}

export function neighborWorkFrame(secondsAtStation: number, celebrating = false): number {
  if (celebrating) return 5;
  const phase = Math.max(0, secondsAtStation) % 15;
  // One short reach/placement, then a quiet pause. Feet and body stay planted;
  // the authored arm poses perform the work instead of bending a whole card.
  if (phase < .65) return 0;
  if (phase < 1.1) return 1;
  if (phase < 1.65) return 2;
  if (phase < 2.2) return 3;
  if (phase < 3.3) return 4;
  return 0;
}

export function neighborPropSettle(secondsAtStation: number): { lift: number; angle: number } {
  const age = secondsAtStation - 1.1;
  if (age < 0 || age > .9) return { lift: 0, angle: 0 };
  const decay = Math.exp(-age * 7);
  return { lift: Math.sin(age * 17) * decay * 2.4, angle: Math.sin(age * 15) * decay * .025 };
}

export function neighborFoodArt(id: string, signature?: { base: 'tart' | 'preserves'; ingredients: readonly { id: string }[] }): string {
  if (id.startsWith('handmade:')) return `ui-handmade-${id.slice(9)}`;
  if (id.startsWith('dish:')) {
    const dish = id.slice(5);
    return dish === 'orchardTart' ? 'ui-tart' : `ui-${dish.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`;
  }
  if (signature?.base === 'preserves') return 'ui-orchard-preserves';
  const berry = ['strawberry', 'blueberry', 'raspberry'].find(id => signature?.ingredients.some(part => part.id === id));
  return berry ? `ui-${berry}-tart` : 'ui-tart';
}
