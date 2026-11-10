import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { BAY_INSTRUMENT_IDS } from '../src/bay-music-model.ts'
import type { BaySample } from '../src/bay-audio.ts'

const directory = new URL('../public/audio/', import.meta.url)
const design = new URL('../audio-design/', import.meta.url)
const loadManifest = async (): Promise<Record<string,BaySample[]>> => JSON.parse(await readFile(new URL('bay-samples.json',directory),'utf8'))

test('the shipped audio manifest accounts for every MP3 and every playable instrument', async () => {
  const manifest = await loadManifest()
  const files = (await readdir(directory)).filter(name => name.endsWith('.mp3')).sort()
  const registered: string[] = []
  for (const [event,takes] of Object.entries(manifest)) {
    assert.ok(takes.length > 0,event)
    for (const take of takes) {
      assert.match(take.url,/^\.\/[\w.@-]+\.mp3$/,event)
      registered.push(take.url.slice(2))
      const digest = createHash('sha256').update(await readFile(new URL(take.url,directory))).digest('hex')
      assert.equal(take.revision,digest.slice(0,12),`stale revision: ${take.url}`)
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

test('the runtime manifest contains exactly the takes listed in the sound banks', async () => {
  const manifest = await loadManifest()
  const registered = Object.values(manifest).flat().map(take => take.url.slice(2)).sort()
  const banks = (await readdir(design)).filter(name => name.endsWith('-bank.txt'))
  const listed: string[] = []
  for (const bank of banks) {
    const rows = (await readFile(new URL(bank,design),'utf8')).trim().split(/\r?\n/).slice(1)
    for (const row of rows) listed.push(`${row.split('|')[0]}.mp3`)
  }
  assert.deepEqual(registered,listed.sort())
})

test('review-rejected kitchen takes are neither registered nor shipped', async () => {
  const review = JSON.parse(await readFile(new URL('kitchen-review.json',design),'utf8'))
  const files = new Set(await readdir(directory))
  const registered = new Set(Object.values(await loadManifest()).flat().map(take => take.url.slice(2)))
  for (const id of Object.keys(review.rejected)) {
    assert.equal(registered.has(`${id}.mp3`),false,`rejected take in manifest: ${id}`)
    assert.equal(files.has(`${id}.mp3`),false,`rejected take shipped: ${id}`)
  }
})

test('retired prepared takes are preserved outside public with verified provenance', async () => {
  const archive = new URL('retired-takes/',design)
  const inventory = JSON.parse(await readFile(new URL('inventory.json',archive),'utf8'))
  const files = (await readdir(archive)).filter(name => name.endsWith('.mp3')).sort()
  const publicFiles = new Set(await readdir(directory))
  assert.equal(inventory.version,1)
  assert.ok(inventory.takes.length > 0)
  assert.deepEqual(inventory.takes.map((take: {file: string}) => take.file).sort(),files)
  for (const take of inventory.takes) {
    assert.match(take.file,/^[\w.@-]+\.mp3$/)
    assert.equal(take.originalPath,`game/public/audio/${take.file}`)
    const bytes = await readFile(new URL(take.file,archive))
    assert.equal(bytes.byteLength,take.bytes,take.file)
    assert.equal(createHash('sha256').update(bytes).digest('hex'),take.sha256,take.file)
    assert.equal(publicFiles.has(take.file),false,`retired take shipped: ${take.file}`)
    assert.match(take.source.path,/^(source-takes|provider-takes)\/[\w.@-]+\.mp3$/)
    const source = await readFile(new URL(take.source.path,design))
    assert.equal(createHash('sha256').update(source).digest('hex'),take.source.sha256,take.source.path)
    if (take.source.path.startsWith('provider-takes/')) {
      const metadata = JSON.parse(await readFile(new URL(take.source.path.replace(/\.mp3$/,'.json'),design),'utf8'))
      assert.equal(metadata.sha256,take.source.sha256,take.source.path)
    }
  }
})
