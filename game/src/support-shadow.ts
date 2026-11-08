export type SupportShadow = {
  width: number;
  height: number;
  baseline: number;
  castHeight: number;
  contacts: readonly { x: number; y: number; rx: number; ry: number }[];
};

type Point = { x: number; y: number };

function hull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const turn = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lower: Point[] = [];
  const upper: Point[] = [];
  for (const point of sorted) {
    while (lower.length > 1 && turn(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop();
    lower.push(point);
  }
  for (const point of sorted.reverse()) {
    while (upper.length > 1 && turn(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// Authored feet occupy different ground depths in a painted 2.5D building.
// A cached ground mask keeps every contact at its actual source coordinate.
export function createSupportShadow(definition: SupportShadow) {
  const { width, height, baseline, castHeight, contacts } = definition;
  const footprint = hull(contacts);
  const cast = hull([...footprint, ...footprint.map(({ x, y }) => ({ x: x + castHeight * 0.24, y: y + castHeight * 0.13 }))]);
  const blur = Math.max(2, width * 0.019);
  const left = Math.floor(Math.min(0, ...cast.map(({ x }) => x)) - blur * 3);
  const top = Math.floor(Math.min(0, ...cast.map(({ y }) => y)) - blur * 3);
  const right = Math.ceil(Math.max(width, ...cast.map(({ x }) => x)) + blur * 3);
  const bottom = Math.ceil(Math.max(height, ...cast.map(({ y }) => y)) + blur * 3);
  const canvas = document.createElement('canvas');
  canvas.width = right - left;
  canvas.height = bottom - top;
  const context = canvas.getContext('2d')!;
  context.translate(-left, -top);
  context.fillStyle = '#595842';
  const fill = (points: readonly Point[], opacity: number, softness: number) => {
    context.filter = `blur(${softness}px)`;
    context.globalAlpha = opacity;
    context.beginPath();
    points.forEach(({ x, y }, index) => index === 0 ? context.moveTo(x, y) : context.lineTo(x, y));
    context.closePath();
    context.fill();
  };
  fill(cast, 0.11, blur);
  fill(footprint, 0.10, blur * 0.48);
  context.filter = `blur(${blur * 0.24}px)`;
  context.globalAlpha = 0.27;
  for (const { x, y, rx, ry } of contacts) {
    context.beginPath();
    context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
  }
  return {
    canvas, origin: (width / 2 - left) / canvas.width, baseline: (height * baseline - top) / canvas.height,
    widthRatio: canvas.width / width, heightRatio: canvas.height / height,
  };
}
