import type { IslandWorld, SpriteOptions } from './world';
import { loadImage } from './image-assets.ts';

type Box = { x: number; y: number; w: number; h: number };
type Sheet = {
  image: HTMLImageElement;
  cells: Box[];
  frames: Box[];
  maxWidth: number;
  maxHeight: number;
};
const measuredSheets = new WeakMap<HTMLImageElement, Map<string, Sheet>>();

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

function readSheet(image: HTMLImageElement, cols: number, rows: number): Sheet {
  const grid = `${cols}:${rows}`;
  const previous = measuredSheets.get(image);
  const measured = previous?.get(grid);
  if (measured) return measured;
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
  const sheet = {
    image, frames, cells,
    maxWidth: Math.max(1, ...frames.map((box) => box.w)),
    maxHeight: Math.max(1, ...frames.map((box) => box.h)),
  };
  const grids = previous ?? new Map<string, Sheet>();
  grids.set(grid, sheet);
  measuredSheets.set(image, grids);
  return sheet;
}

export function createRasterLibrary(onLoad: (key: string) => void, signal: AbortSignal) {
  const images = new Map<string, HTMLImageElement>();
  const sheets = new Map<string, Sheet>();
  const requests = new Map<string, Promise<boolean>>();

  function loadUrl(key: string, url: string, grid?: readonly [number, number]): void {
    if (requests.has(key) || signal.aborted) return;
    const request = loadImage(url).then(image => {
      if (signal.aborted) return false;
      if (grid) sheets.set(key, readSheet(image, ...grid));
      images.set(key, image);
      onLoad(key);
      return true;
    }).catch(() => {
      // A failed source can be retried when the state is rendered again.
      requests.delete(key);
      return false;
    });
    requests.set(key, request);
  }
  signal.addEventListener('abort', () => { images.clear(); sheets.clear(); requests.clear(); }, { once: true });

  return {
    load(key: string, path: string, grid?: readonly [number, number]): void {
      loadUrl(key, `${import.meta.env.BASE_URL}art/${path}.webp`, grid);
    },
    loadUrl,
    async ready(keys: readonly string[]): Promise<boolean> {
      return (await Promise.all(keys.map(key => requests.get(key) ?? Promise.resolve(false)))).every(Boolean);
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
      const width = options.fullCell ? w : w * frame.w / sheet.maxWidth;
      const height = options.fullCell ? h : h * frame.h / sheet.maxHeight;
      world.sprite(sheet.image, src, x, y, width, height, options);
      return true;
    },
  };
}
