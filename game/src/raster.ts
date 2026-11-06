import type { IslandWorld, SpriteOptions } from './world';

type Box = { x: number; y: number; w: number; h: number };
type Sheet = {
  image: HTMLCanvasElement;
  cells: Box[];
  frames: Box[];
  maxWidth: number;
  maxHeight: number;
};

function measureFrame(pixels: ImageData, cell: Box): Box {
  let left = cell.x + cell.w;
  let right = cell.x;
  let top = cell.y + cell.h;
  let bottom = cell.y;
  for (let y = cell.y; y < cell.y + cell.h; y++) {
    for (let x = cell.x; x < cell.x + cell.w; x++) {
      if (pixels.data[(y * pixels.width + x) * 4 + 3] < 100) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return { ...cell, w: 0, h: 0 };
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

function readSheet(image: HTMLImageElement, cols: number, rows: number, palette: string): Sheet {
  const scratch = document.createElement('canvas');
  const w = scratch.width = image.naturalWidth;
  const h = scratch.height = image.naturalHeight;
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, w, h);
  const cells = Array.from({ length: cols * rows }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = Math.floor(col * w / cols);
    const y = Math.floor(row * h / rows);
    return {
      x, y, w: Math.floor((col + 1) * w / cols) - x, h: Math.floor((row + 1) * h / rows) - y,
    };
  });
  const frames = cells.map((cell) => measureFrame(pixels, cell));
  const graded = document.createElement('canvas');
  graded.width = w;
  graded.height = h;
  const grade = graded.getContext('2d')!;
  grade.filter = palette;
  grade.drawImage(image, 0, 0);
  return {
    image: graded, frames, cells,
    maxWidth: Math.max(1, ...frames.map((box) => box.w)),
    maxHeight: Math.max(1, ...frames.map((box) => box.h)),
  };
}

export function createRasterLibrary(onLoad: (key: string) => void, signal: AbortSignal) {
  const images = new Map<string, HTMLImageElement>();
  const sheets = new Map<string, Sheet>();

  return {
    load(key: string, path: string, grid?: readonly [number, number],
      palette = 'saturate(0.87) contrast(0.93) brightness(0.98)'): void {
      const image = new Image();
      image.addEventListener('load', () => {
        if (grid) sheets.set(key, readSheet(image, ...grid, palette));
        images.set(key, image);
        onLoad(key);
      }, { signal, once: true });
      image.src = `${import.meta.env.BASE_URL}art/${path}.webp`;
    },
    image(key: string): HTMLImageElement | undefined {
      return images.get(key);
    },
    draw(
      world: IslandWorld, key: string, x: number, y: number, w: number, h: number,
      options: SpriteOptions = {},
    ): boolean {
      const sheet = sheets.get(key);
      const index = options.frame ?? 0;
      const frame = sheet?.frames[index];
      const cell = sheet?.cells[index];
      if (!sheet || !frame?.w || !frame.h || !cell) return false;
      const src = options.fullCell ? cell : frame;
      const width = options.fullCell ? w
        : options.fixedRoot ? h * frame.w / sheet.maxHeight : w * frame.w / sheet.maxWidth;
      const height = options.fullCell ? h : h * frame.h / sheet.maxHeight;
      const xOrigin = options.fixedRoot ? (cell.x + cell.w / 2 - src.x) / src.w : 0.5;
      world.sprite(sheet.image, src, x, y, width, height, options, xOrigin);
      return true;
    },
  };
}
