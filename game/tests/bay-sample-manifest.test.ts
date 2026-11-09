import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { BAY_INSTRUMENT_IDS } from '../src/bay-music-model.ts'
import type { BaySample } from '../src/bay-audio.ts'

test('the shipped audio manifest accounts for every MP3 and every playable instrument', async () => {
  const directory = new URL('../public/audio/', import.meta.url)
  const manifest: Record<string,BaySample[]> = JSON.parse(await readFile(new URL('bay-samples.json',directory),'utf8'))
  const files = (await readdir(directory)).filter(name => name.endsWith('.mp3')).sort()
  const registered: string[] = []
  for (const [event,takes] of Object.entries(manifest)) {
    assert.ok(takes.length > 0,event)
    for (const take of takes) {
      assert.match(take.url,/^\.\/[\w.@-]+\.mp3$/,event)
      registered.push(take.url.slice(2))
    }
  }
  assert.deepEqual(registered.sort(),files)
  for (const instrument of BAY_INSTRUMENT_IDS) {
    const takes = manifest[`instrument.${instrument}`]
    assert.ok(takes?.length,instrument)
    if (instrument !== 'ceramic' && instrument !== 'shaker') {
      assert.ok(takes.some(take => take.tuned && Number.isFinite(take.rootMidi)),instrument)
    }
  }
})
