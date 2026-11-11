import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { analyzeLoop, scanCueCoverage, auditAudio } from '../scripts/audit-audio-diagnostics.mjs'

async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'cozy-audio-diagnostics-'))
  try {
    for (const dir of ['src/nested','public/audio','audio-design']) await mkdir(join(root, dir), {recursive:true})
    await writeFile(join(root,'src/nested/example.ts'), "playBaySound('field.hit'); setBaySoundContact('field.flow', true)")
    await writeFile(join(root,'audio-design/events-ru.txt'), 'id|где|действие|что слышит игрок\nfield.hit|Тест|Касание|Тихий контакт\n')
    await writeFile(join(root,'public/audio/bay-samples.json'), JSON.stringify({
      'field.hit': [{url:'./hit.mp3'}], 'field.flow': [{url:'./flow.mp3',loop:true}],
    }))
    await writeFile(join(root,'public/audio/hit.mp3'), 'one-shot fixture')
    await writeFile(join(root,'public/audio/flow.mp3'), 'loop fixture')
    await run(root)
  } finally { await rm(root, {recursive:true,force:true}) }
}

test('a constant stereo contact remains level after the runtime overlap and is not mutated', () => {
  const input = new Float32Array(2000).fill(.1)
  const before = input.slice()
  const result = analyzeLoop(input, 1000)
  assert.equal(result.loopSeconds, .92)
  assert.equal(result.windowMs, 100)
  assert.equal(result.spreadDb, 0)
  assert.equal(result.longestLowRunMs, 0)
  assert.deepEqual(result.reviewReasons, [])
  assert.deepEqual(input, before)
})

test('the CLI labels coverage-only runs explicitly and fails instead of claiming a missing decoder ran', async () => {
  await fixture(async root => {
    const script = fileURLToPath(new URL('../scripts/audit-audio-diagnostics.mjs', import.meta.url))
    const coverage = spawnSync(process.execPath, [script,'--root',root,'--coverage-only','--ffmpeg',join(root,'missing-decoder')], {encoding:'utf8'})
    assert.equal(coverage.status, 0, coverage.stderr)
    const report = JSON.parse(coverage.stdout)
    assert.equal(report.loopAnalysis, 'not-requested')
    assert.equal(report.summary.analyzedLoopTakes, 0)
    assert.equal(report.summary.loopTakes, 1)
    const full = spawnSync(process.execPath, [script,'--root',root,'--ffmpeg',join(root,'missing-decoder')], {encoding:'utf8'})
    assert.equal(full.status, 1)
    assert.equal(full.stdout, '')
    assert.match(full.stderr, /Cannot decode.*ENOENT/)
  })
})

test('coverage distinguishes exact literals, possible dynamic templates and absent references without reading comments', () => {
  const source = `playBaySound('field.water');
    // playBaySound('field.unused')
    const longer = 'field.unused-extra';
    const instrument = bank[\`instrument.\${id}\`];`
  const coverage = scanCueCoverage(['field.water','field.unused','instrument.harp'],
    [{file:'src/example.ts', text:source}], new Set(['field.water','instrument.harp']))
  assert.equal(coverage[0].referenceKind, 'exact-literal')
  assert.deepEqual(coverage[0].references, [{file:'src/example.ts', line:1, kind:'exact-literal'}])
  assert.equal(coverage[1].referenceKind, 'none')
  assert.equal(coverage[1].hasRussianDescription, false)
  assert.equal(coverage[2].referenceKind, 'dynamic-template')
})

test('the project report decodes only loop takes, fingerprints inputs and leaves their bytes unchanged', async () => {
  await fixture(async root => {
    const files = ['public/audio/bay-samples.json','public/audio/hit.mp3','public/audio/flow.mp3','src/nested/example.ts','audio-design/events-ru.txt']
    const before = await Promise.all(files.map(file => readFile(join(root,file))))
    const decoded: string[] = []
    const report = await auditAudio({root, decode: file => {
      decoded.push(file)
      return {stereo:new Float32Array(2000).fill(.1),sampleRate:1000}
    }})
    assert.deepEqual(decoded, [join(root,'public/audio/flow.mp3')])
    assert.equal(report.loopAnalysis, 'completed')
    assert.equal(report.summary.takes, 2)
    assert.equal(report.summary.loopTakes, 1)
    assert.deepEqual(report.summary.missingDescriptions, ['field.flow'])
    assert.match(report.manifestSha256, /^[a-f0-9]{64}$/)
    assert.match(report.loops[0].sha256, /^[a-f0-9]{64}$/)
    assert.deepEqual(await Promise.all(files.map(file => readFile(join(root,file)))), before)
  })
})

test('energy keeps opposite-phase and single-channel signals rather than cancelling them in a mono mix', () => {
  const opposite = new Float32Array(2160), rightOnly = new Float32Array(2160)
  for (let i = 0; i < opposite.length; i += 2) {
    opposite[i] = .1; opposite[i + 1] = -.1; rightOnly[i + 1] = .1
  }
  assert.equal(analyzeLoop(opposite, 1000).medianRms, .1)
  assert.equal(analyzeLoop(opposite, 1000).longestLowRunMs, 0)
  assert.equal(analyzeLoop(rightOnly, 1000).medianRms, .070711)
})

test('a known 40 dB, 300 ms dip is measured separately from the overlap', () => {
  const input = new Float32Array(2160).fill(.1)
  input.fill(.001, 280 * 2, 580 * 2)
  const result = analyzeLoop(input, 1000)
  assert.equal(result.loopSeconds, 1)
  assert.equal(result.spreadDb, 40)
  assert.equal(result.longestLowRunMs, 300)
  assert.equal(result.reviewReasons.length, 2)
})

test('low windows on opposite sides of a seam count as one circular dip, never two cycles', () => {
  const input = new Float32Array(2160).fill(.1)
  input.fill(.001, 0, 180 * 2)
  input.fill(.001, 980 * 2)
  assert.equal(analyzeLoop(input, 1000).longestLowRunMs, 200)
  const silent = analyzeLoop(new Float32Array(2160), 1000)
  assert.equal(silent.longestLowRunMs, 1000)
  assert.equal(silent.spreadDb, 0)
  assert.equal(silent.reviewReasons.length, 1)
})

test('empty, malformed or nonfinite PCM cannot produce a successful report', () => {
  for (const input of [new Float32Array(), new Float32Array(3), new Float32Array([NaN,0]), new Float32Array([0,Infinity])]) {
    assert.throws(() => analyzeLoop(input), /finite nonempty interleaved stereo/)
  }
  assert.throws(() => analyzeLoop(new Float32Array(2), 0), /sample rate/)
  assert.throws(() => analyzeLoop(new Float32Array(2), 1.5), /sample rate/)
})

test('manifest errors and decoder failures stop the audit before a success result', async () => {
  await fixture(async root => {
    const path = join(root,'public/audio/bay-samples.json')
    const original = await readFile(path)
    for (const url of ['https://example.test/audio.mp3','../outside.mp3','./nested/clip.mp3']) {
      await writeFile(path, JSON.stringify({'bad.cue':{url}}))
      await assert.rejects(auditAudio({root,coverageOnly:true}), /local audio filename/)
    }
    await writeFile(path, JSON.stringify({'bad.cue':{url:'./hit.mp3',revision:'000000000000'}}))
    await assert.rejects(auditAudio({root,coverageOnly:true}), /Stale revision/)
    await writeFile(path, JSON.stringify({'bad.cue':{url:'./hit.mp3',loop:'true'}}))
    await assert.rejects(auditAudio({root,coverageOnly:true}), /loop flag/)
    await writeFile(path, original)
    await assert.rejects(auditAudio({root,decode:() => { throw new Error('synthetic decode failure') }}), /synthetic decode failure/)
  })
})
