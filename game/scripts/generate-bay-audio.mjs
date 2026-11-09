import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { createWriteStream, existsSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { execFileSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
const rows = (await readFile(join(root,'audio-design/sound-bank.txt'),'utf8')).trim().split(/\r?\n/).slice(1)
const wanted = new Set(process.argv.slice(2))
const client = new ElevenLabsClient()
const temp = await mkdtemp(join(tmpdir(), 'lavender-foley-'))
const prepare = (...args) => execFileSync('python',['scripts/prepare-bay-audio.py',...args],{cwd:root,stdio:'inherit'})
try {
  for (const row of rows) {
    const [id,duration,,direction] = row.split('|')
    if ((wanted.size && !wanted.has(id)) || existsSync(join(root,'public/audio',id+'.mp3'))) continue
    const modelId = id.includes('@') ? 'eleven_text_to_sound_v3' : 'eleven_text_to_sound_v2'
    const audio = await client.textToSoundEffects.convert({
      text: direction + ' Close natural stereo studio recording. A joyful hand-painted seaside farming game, soft transients, gentle high frequencies, no speech, no background music.',
      modelId, durationSeconds: Number(duration), promptInfluence: .55,
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
  prepare()
} catch (error) {
  // SDK errors may include request context. Log only the HTTP status and provider's error class.
  console.error('Sound generation stopped',error.statusCode ?? '', error.body?.detail?.status ?? error.name)
  process.exitCode = 1
} finally {
  await rm(temp,{force:true,recursive:true})
}
