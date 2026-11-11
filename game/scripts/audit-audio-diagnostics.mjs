/** Read-only measurements. Review flags are not a listening or approval verdict. */
import ts from 'typescript'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** Literal evidence is not proof that a gesture is reachable or plays this cue. */
export function scanCueCoverage(ids, sources, described) {
  const references = new Map(ids.map(id => [id, []]))
  for (const {file, text} of sources) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    const record = (id, node, kind) => references.get(id).push({
      file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, kind,
    })
    const visit = node => {
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && references.has(node.text)) {
        record(node.text, node, 'exact-literal')
      } else if (ts.isTemplateExpression(node)) {
        const prefix = node.head.text, suffix = node.templateSpans.at(-1).literal.text
        if (prefix || suffix) for (const id of ids) {
          if (id.startsWith(prefix) && id.endsWith(suffix)) record(id, node, 'dynamic-template')
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return ids.map(id => {
    const matches = references.get(id)
    return {
      id, hasRussianDescription: described.has(id),
      referenceKind: matches.some(match => match.kind === 'exact-literal') ? 'exact-literal' : matches.length ? 'dynamic-template' : 'none',
      references: matches,
    }
  })
}

function percentile(sorted, fraction) {
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position), upper = Math.ceil(position)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

const rounded = (value, places = 3) => Number(value.toFixed(places))

/** Stereo energy after the same 80 ms overlap as BayAudio.seamlessBuffer. */
export function analyzeLoop(stereo, sampleRate = 44100) {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0 || !stereo.length || stereo.length % 2 ||
      !stereo.every(Number.isFinite)) throw new Error('Expected finite nonempty interleaved stereo PCM and a positive integer sample rate')
  const frames = stereo.length / 2, overlap = Math.min(Math.floor(sampleRate * .08), Math.floor(frames / 4))
  const result = stereo.slice(overlap * 2)
  const length = frames - overlap
  for (let frame = 0; frame < overlap; frame++) {
    const t = frame / overlap
    for (let channel = 0; channel < 2; channel++) {
      result[(length - overlap + frame) * 2 + channel] =
        stereo[(frames - overlap + frame) * 2 + channel] * (1 - t) + stereo[frame * 2 + channel] * t
    }
  }
  const windowFrames = Math.max(1, Math.round(sampleRate * .1)), windows = []
  for (let start = 0; start < length; start += windowFrames) {
    const count = Math.min(windowFrames, length - start)
    let power = 0
    for (let i = start * 2; i < (start + count) * 2; i++) power += result[i] ** 2
    windows.push({ frames: count, rms: Math.sqrt(power / (count * 2)) })
  }
  const levels = windows.map(window => window.rms).sort((a, b) => a - b)
  const medianRms = percentile(levels, .5), threshold = Math.max(.001, medianRms * .15)
  const db = levels.map(level => 20 * Math.log10(Math.max(1e-9, level)))
  const spread = percentile(db, .95) - percentile(db, .05)
  // A dip can straddle the loop seam. Count at most one whole cycle.
  let run = 0, longest = 0
  for (let i = 0; i < windows.length * 2; i++) {
    const window = windows[i % windows.length]
    run = window.rms < threshold ? Math.min(length, run + window.frames) : 0
    longest = Math.max(longest, run)
  }
  const longestLowRunMs = longest / sampleRate * 1000
  const reviewReasons = []
  if (spread >= 12) reviewReasons.push('100-ms RMS P95-P5 is at least 12 dB')
  if (longestLowRunMs >= 200) reviewReasons.push('low-energy windows span at least 200 ms')
  return {
    loopSeconds: rounded(length / sampleRate), windowMs: 100,
    spreadDb: rounded(spread, 2), medianRms: rounded(medianRms, 6),
    lowThresholdRms: rounded(threshold, 6), longestLowRunMs: rounded(longestLowRunMs, 1),
    reviewReasons,
  }
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

async function sourceFiles(root, directory = join(root, 'src')) {
  const result = []
  for (const entry of (await readdir(directory, {withFileTypes:true})).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await sourceFiles(root, path))
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) result.push({file:relative(root, path).replaceAll('\\', '/'), text:await readFile(path, 'utf8')})
  }
  return result
}

function decodeStereo(file, ffmpeg) {
  let bytes
  try {
    bytes = execFileSync(ffmpeg, ['-v','error','-nostdin','-protocol_whitelist','file,pipe','-f','mp3','-i',file,'-f','f32le','-ac','2','-ar','44100','pipe:1'],
      {maxBuffer:64 * 1024 * 1024, timeout:30_000, stdio:['ignore','pipe','pipe']})
  } catch (error) {
    throw new Error(`Cannot decode ${file}: ${error.code ?? error.status ?? 'decoder failure'}. Supply an installed ffmpeg with --ffmpeg; no installation or network request is performed.`)
  }
  if (!bytes.length || bytes.length % 8) throw new Error(`Invalid stereo PCM from ${file}`)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const stereo = new Float32Array(bytes.byteLength / 4)
  for (let i = 0; i < stereo.length; i++) stereo[i] = view.getFloat32(i * 4, true)
  return {stereo, sampleRate:44100}
}

/** Reads project inputs and prints nothing. Optional decode is the PCM adapter for tests. */
export async function auditAudio({root, coverageOnly = false, ffmpeg = 'ffmpeg', decode = file => decodeStereo(file, ffmpeg)}) {
  const manifestBytes = await readFile(join(root, 'public/audio/bay-samples.json'))
  const manifest = JSON.parse(manifestBytes.toString('utf8'))
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Expected a cue manifest object')
  const entries = []
  for (const [id, value] of Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))) {
    const takes = Array.isArray(value) ? value : [value]
    if (!takes.length) throw new Error(`Cue ${id} has no takes`)
    for (const take of takes) {
      if (!take || typeof take.url !== 'string' || !/^\.\/[a-zA-Z0-9][\w.@-]*\.mp3$/.test(take.url)) {
        throw new Error(`Cue ${id} must reference a local audio filename, never a URL or parent path`)
      }
      if (take.loop !== undefined && typeof take.loop !== 'boolean') throw new Error(`Invalid loop flag for ${take.url}`)
      const path = join(root, 'public/audio', take.url), bytes = await readFile(path), digest = sha256(bytes)
      if (take.revision !== undefined && take.revision !== digest.slice(0, 12)) throw new Error(`Stale revision for ${take.url}`)
      entries.push({id, take, path, sha256:digest})
    }
  }
  const events = (await readFile(join(root, 'audio-design/events-ru.txt'), 'utf8')).replace(/^\uFEFF/, '').trim().split(/\r?\n/).slice(1)
  const described = new Set(events.filter(row => row.split('|').length >= 4 && row.split('|').at(-1).trim()).map(row => row.split('|')[0]))
  const coverage = scanCueCoverage(Object.keys(manifest).sort(), await sourceFiles(root), described)
  const loopEntries = entries.filter(entry => entry.take.loop === true), loops = []
  if (!coverageOnly) for (const entry of loopEntries) {
    const {stereo, sampleRate} = await decode(entry.path)
    loops.push({id:entry.id, take:entry.take.url.slice(2), sha256:entry.sha256, ...analyzeLoop(stereo, sampleRate)})
  }
  return {
    version:1, manifestSha256:sha256(manifestBytes), loopAnalysis:coverageOnly ? 'not-requested' : 'completed',
    limits:[
      'Static literals or possible dynamic templates are evidence, not proof of reachable playback; other computed keys may be missed.',
      'Loop metrics describe decoded stereo energy after the current 80 ms overlap, before gain, compressor, sound card or live gestures.',
      'Review flags are informational, not subjective quality findings, human approval or permission to change a take.',
    ],
    summary:{
      cues:coverage.length, takes:entries.length, loopCues:new Set(loopEntries.map(entry => entry.id)).size,
      loopTakes:loopEntries.length, analyzedLoopTakes:loops.length,
      noStaticReferences:coverage.filter(cue => cue.referenceKind === 'none').map(cue => cue.id),
      dynamicReferenceOnly:coverage.filter(cue => cue.referenceKind === 'dynamic-template').map(cue => cue.id),
      missingDescriptions:coverage.filter(cue => !cue.hasRussianDescription).map(cue => cue.id),
      loopReviewTakes:loops.filter(loop => loop.reviewReasons.length).map(loop => loop.take),
    },
    coverage, loops,
  }
}

async function main(args) {
  const options = {root:resolve(dirname(fileURLToPath(import.meta.url)), '..')}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help') {
      process.stdout.write('Usage: node scripts/audit-audio-diagnostics.mjs [--root GAME_DIRECTORY] [--ffmpeg EXECUTABLE] [--coverage-only]\nReads local sources and audio; JSON goes to stdout. Does not install, generate, modify or upload anything.\nDefault: decode all manifest loop takes with an installed ffmpeg. Coverage-only explicitly skips loop measurements.\nInformational review flags do not fail the command. Missing/invalid inputs or decoder failures exit 1.\n')
      return
    }
    if (args[i] === '--coverage-only') options.coverageOnly = true
    else if (args[i] === '--root' || args[i] === '--ffmpeg') {
      const key = args[i].slice(2), value = args[++i]
      if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`)
      options[key] = key === 'root' ? resolve(value) : value
    } else throw new Error(`Unknown argument: ${args[i]}`)
  }
  process.stdout.write(`${JSON.stringify(await auditAudio(options), null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`Audio diagnostic audit failed: ${error.message}\n`)
    process.exitCode = 1
  })
}
