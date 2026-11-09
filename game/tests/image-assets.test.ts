import test from 'node:test';
import assert from 'node:assert/strict';
import { loadImage } from '../src/image-assets.ts';
import { createRasterLibrary } from '../src/raster.ts';

const created = new Map<string, number>();
const decoded = new Map<string, number>();
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 4;
  naturalHeight = 2;
  decoding = 'auto';
  url = '';
  set src(url: string) {
    this.url = url;
    created.set(url, (created.get(url) ?? 0) + 1);
    if (url.startsWith('large')) { this.naturalWidth = 4096; this.naturalHeight = 2048; }
    queueMicrotask(() => this.onload?.());
  }
  async decode() {
    decoded.set(this.url, (decoded.get(this.url) ?? 0) + 1);
    if (this.url === 'retry' && decoded.get(this.url) === 1) throw new Error('Decode failed');
  }
}
Object.defineProperty(globalThis, 'Image', { value: FakeImage, configurable: true });
let scans = 0;
Object.defineProperty(globalThis, 'document', {
  value: { baseURI: 'http://farm.test/', createElement: () => ({ getContext: () => ({
    drawImage() {},
    getImageData() { scans++; return { width: 4, height: 2, data: new Uint8ClampedArray(32).fill(255) }; },
  }) }) }, configurable: true,
});

test('concurrent and later scene loads share one decoded source', async () => {
  const [first, second] = await Promise.all([loadImage('shared'), loadImage('shared')]);
  assert.equal(first, second);
  assert.equal(await loadImage('shared'), first);
  assert.equal(await loadImage('/art/../shared'), first);
  assert.equal(created.get('shared'), 1);
  assert.equal(decoded.get('shared'), 1);
});

test('failed decoding can be retried', async () => {
  await assert.rejects(loadImage('retry'));
  assert.ok(await loadImage('retry'));
  assert.equal(created.get('retry'), 2);
});

test('decoded sources beyond the budget evict the least recently used image', async () => {
  const first = await loadImage('large-first');
  const second = await loadImage('large-second');
  assert.equal(await loadImage('large-first'), first);
  await loadImage('large-third');
  assert.equal(await loadImage('large-first'), first);
  assert.notEqual(await loadImage('large-second'), second);
  assert.equal(created.get('large-second'), 2);
});

test('raster aliases reuse their scan and a destroyed scene does not receive late loads', async () => {
  const loaded: string[] = [];
  const abort = new AbortController();
  const art = createRasterLibrary(key => loaded.push(key), abort.signal);
  const scansBefore = scans;
  art.loadUrl('first', 'sheet', [2, 1]);
  art.loadUrl('alias', 'sheet', [2, 1]);
  art.loadUrl('first', 'sheet', [2, 1]);
  assert.equal(await art.ready(['first', 'alias']), true);
  assert.deepEqual(loaded, ['first', 'alias']);
  assert.equal(scans - scansBefore, 1);
  assert.equal(art.image('first'), art.image('alias'));
  art.loadUrl('late', 'late-sheet', [2, 1]);
  abort.abort();
  assert.equal(await art.ready(['late']), false);
  await loadImage('late-sheet');
  assert.equal(art.image('first'), undefined);
  assert.equal(art.image('late'), undefined);
  assert.deepEqual(loaded, ['first', 'alias']);
});
