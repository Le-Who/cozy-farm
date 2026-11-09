import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { createWriteStream, existsSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { execFileSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
const banks = (await readdir(join(root,'audio-design'))).filter(file=>file.endsWith('-bank.txt')).sort()
const rows = (await Promise.all(banks.map(async file=>(await readFile(join(root,'audio-design',file),'utf8')).trim().split(/\r?\n/).slice(1)))).flat()
const wanted = new Set(process.argv.slice(2))
for (const id of wanted) if (!rows.some(row=>row.split('|')[0]===id)) throw new Error('Unknown bank entry: '+id)
const client = new ElevenLabsClient()
const temp = await mkdtemp(join(tmpdir(), 'lavender-foley-'))
const prepare = (...args) => execFileSync('python',['scripts/prepare-bay-audio.py',...args],{cwd:root,stdio:'inherit'})
try {
  for (const row of rows) {
    const [id,duration,,direction,mode] = row.split('|')
    if ((wanted.size && !wanted.has(id)) || existsSync(join(root,'public/audio',id+'.mp3'))) continue
    const loop = mode?.trim() === 'loop'
    const modelId = loop || id.startsWith('instrument.') && !id.includes('@') ? 'eleven_text_to_sound_v2' : 'eleven_text_to_sound_v3'
    const audio = await client.textToSoundEffects.convert({
      text: direction,
      modelId, ...(loop ? {loop:true} : {}), durationSeconds: Number(duration), promptInfluence: .55,
    })
    const source = join(temp,id+'.mp3')
    await pipeline(audio,createWriteStream(source))
    const sources = join(root, 'audio-design/provider-takes')
    await mkdir(sources, { recursive: true })
    await copyFile(source, join(sources, id+'.mp3'))
    await writeFile(join(sources,id+'.json'), JSON.stringify({ id, provider: 'ElevenLabs', modelId, requestedSeconds: Number(duration), direction, generatedAt: new Date().toISOString(), sha256: createHash('sha256').update(await readFile(source)).digest('hex') }, null, 2)+'\n')
    prepare('--take',id,'--source',source)
    console.log('Prepared '+id)
  }
  if (!process.env.BAY_DEFER_MANIFEST) prepare()
} catch (error) {
  // SDK errors may include request context. Log only the HTTP status and provider's error class.
  console.error('Sound generation stopped',error.statusCode ?? '', error.body?.detail?.status ?? error.name)
  process.exitCode = 1
} finally {
  await rm(temp,{force:true,recursive:true})
}
