import test from 'node:test'
import assert from 'node:assert/strict'
import { BayAudio } from '../src/bay-audio.ts'

class Parameter {
  value = 0
  targets: { value: number; time: number; constant: number }[] = []
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  setTargetAtTime(value: number, time: number, constant: number) { this.targets.push({value,time,constant}) }
  cancelScheduledValues() {}
}
class Node {
  gain = new Parameter()
  destination: Node | null = null
  disconnects = 0
  connect(destination: Node) { this.destination = destination }
  disconnect() { this.disconnects++ }
}
class Buffer {
  sampleRate = 1000; length = 1000; duration = 1; numberOfChannels = 2
  channels = [new Float32Array(1000).fill(.1), new Float32Array(1000).fill(.1)]
  getChannelData(index: number) { return this.channels[index] }
}
class Source extends Node {
  buffer: Buffer | null = null
  loop = false
  playbackRate = new Parameter()
  onended: (() => void) | null = null
  stops: number[] = []
  stopAt = Infinity
  ended = false
  context: Context
  constructor(context: Context) { super(); this.context = context }
  start() {}
  stop(when = this.context.currentTime) { this.stops.push(when); this.stopAt = when }
  finish() { if (!this.ended) { this.ended = true; this.onended?.() } }
}
class Context {
  static latest: Context
  state = 'running'; currentTime = 1; destination = new Node()
  sources: Source[] = []
  constructor() { Context.latest = this }
  advanceTo(time: number) {
    this.currentTime = time
    for (const source of this.sources) if (source.stopAt <= time) source.finish()
  }
  resume() { this.state = 'running'; return Promise.resolve() }
  suspend() { this.state = 'suspended'; return Promise.resolve() }
  createGain() { return new Node() }
  createDynamicsCompressor() { return Object.assign(new Node(), Object.fromEntries(['threshold','knee','ratio','attack','release'].map(id=>[id,new Parameter()]))) }
  createAnalyser() { return Object.assign(new Node(), {fftSize:1024,getFloatTimeDomainData(data: Float32Array) { data.fill(0) }}) }
  decodeAudioData() { return Promise.resolve(new Buffer()) }
  createBuffer(_channels: number, length: number) { const buffer = new Buffer(); buffer.length=length; buffer.channels=[new Float32Array(length),new Float32Array(length)]; return buffer }
  createBufferSource() { const source = new Source(this); this.sources.push(source); return source }
}

test('audio demand cache, stale contact, missing file, loop and mute lifecycle', async () => {
  const previous = { window:globalThis.window, document:globalThis.document, fetch:globalThis.fetch }
  const listeners = new Map<string, () => void>()
  const documentState = {hidden:false,addEventListener(id: string, listener: () => void) { listeners.set(id,listener) }}
  Object.assign(globalThis, {window:{AudioContext:Context},document:documentState})
  try {
    const audio = new BayAudio(); await audio.unlock()
    let requests = 0
    globalThis.fetch = async () => { requests++; return new Response(new Uint8Array(4)) }
    audio.loadSampleManifest({'cut':[{url:'cut-a'},{url:'cut-b'}], 'flow':[{url:'flow',loop:true}], 'missing':{url:'missing'}, 'muted':{url:'muted'}})
    await audio.primeEvents(['cut','flow'])
    assert.equal(requests,3)
    assert.equal(audio.getDiagnostics().loadedSamples,3)
    audio.playEvent('cut'); audio.playEvent('cut'); await audio.primeEvents(['cut'])
    assert.equal(requests,3,'revisits reuse decoded takes')
    assert.equal(audio.getDiagnostics().playedNotes,2)
    audio.setContact('flow',true); audio.setContact('flow',true)
    assert.deepEqual(audio.getDiagnostics().contacts,['flow'])
    assert.equal(audio.getDiagnostics().playedNotes,3,'one source for sustained contact')
    audio.setSettings({muted:true})
    await audio.primeEvents(['muted']);audio.playEvent('muted')
    assert.equal(requests,3,'muted scenes do not fetch their banks')
    assert.deepEqual(audio.getDiagnostics().contacts,[])
    assert.equal(audio.getDiagnostics().activeVoices,1,'muting preserves the contact release tail')
    Context.latest.advanceTo(1.061)
    assert.equal(audio.getDiagnostics().activeVoices,0)
    audio.setSettings({muted:false})
    audio.setSettings({effects:0});await audio.primeEvents(['muted']);audio.playEvent('muted');audio.setContact('flow',true)
    assert.equal(requests,3,'an inaudible effects bus does not fetch or start sources')
    assert.deepEqual(audio.getDiagnostics().contacts,[])
    audio.setSettings({effects:.8})
    globalThis.fetch=async()=>{requests++;return new Response(null,{status:404})}
    await audio.primeEvents(['missing']);await audio.primeEvents(['missing'])
    assert.equal(requests,4,'failed sample is not requested on every gesture')
    assert.equal(audio.getDiagnostics().failedSamples,1)
    globalThis.fetch=async()=>{await new Promise(resolve=>setTimeout(resolve,180));return new Response(new Uint8Array(4))}
    audio.loadSampleManifest({'slow':{url:'slow'},'cancelled':{url:'cancelled'}})
    audio.playEvent('slow');await new Promise(resolve=>setTimeout(resolve,210))
    assert.equal(audio.getDiagnostics().playedNotes,3,'late foley never plays after its contact')
    audio.playEvent('cancelled');audio.stopEffects();await new Promise(resolve=>setTimeout(resolve,210))
    assert.equal(audio.getDiagnostics().playedNotes,3,'scene exit cancels pending foley')
    audio.playEvent('slow')
    assert.equal(audio.getDiagnostics().playedNotes,4,'decoded late sample is available on the next real action')
    documentState.hidden=true;listeners.get('visibilitychange')?.();await Promise.resolve()
    assert.equal(audio.getDiagnostics().activeVoices,0)
    assert.equal(audio.getDiagnostics().state,'suspended')
  } finally { Object.assign(globalThis,previous) }
})

test('a later real action recovers a failed manifest once its backoff expires', async () => {
  const previous = { window:globalThis.window, document:globalThis.document, fetch:globalThis.fetch, now:performance.now }
  let clock=10_000, requests=0
  Object.assign(globalThis,{window:{AudioContext:Context},document:{addEventListener() {}}})
  performance.now=()=>clock
  try {
    const audio=new BayAudio();await audio.unlock()
    globalThis.fetch=async()=>{requests++;return new Response(null,{status:503})}
    assert.equal(await audio.preload('https://example.test/bank.json'),false)
    audio.playEvent('cut');await audio.primeEvents(['cut'])
    assert.equal(requests,1,'failed manifest does not produce background or per-frame retries')
    clock+=30_001
    globalThis.fetch=async url=>{
      requests++
      if(String(url).endsWith('.json')) {
        const response=new Response(JSON.stringify({cut:{url:'./cut.mp3'}}),{headers:{'Content-Type':'application/json'}})
        Object.defineProperty(response,'url',{value:'https://example.test/bank.json'})
        return response
      }
      return new Response(new Uint8Array(4))
    }
    audio.playEvent('cut');await new Promise(resolve=>setTimeout(resolve,20))
    assert.equal(requests,3,'one successful manifest retry and one demanded sample')
    assert.equal(audio.getDiagnostics().playedNotes,1)
    audio.playEvent('cut');await audio.primeEvents(['cut'])
    assert.equal(requests,3,'recovered manifest and sample remain cached')
  } finally { performance.now=previous.now;Object.assign(globalThis,{window:previous.window,document:previous.document,fetch:previous.fetch}) }
})

async function withAudio(run: (audio: BayAudio, context: Context) => Promise<void>) {
  const previous = { window:globalThis.window, document:globalThis.document, fetch:globalThis.fetch }
  Object.assign(globalThis, {window:{AudioContext:Context},document:{addEventListener() {}}})
  globalThis.fetch = async () => new Response(new Uint8Array(4))
  const audio = new BayAudio()
  try { await audio.unlock(); await run(audio, Context.latest) }
  finally { await audio.suspend(); Object.assign(globalThis,previous) }
}

test('stopping effects lets contact audio finish its 60 ms release before disconnecting', async () => {
  await withAudio(async (audio, context) => {
    audio.loadSampleManifest({flow:{url:'flow',loop:true}})
    await audio.primeEvents(['flow'])
    audio.setContact('flow',true)
    const source = context.sources[0], envelope = source.destination!
    audio.stopEffects()
    assert.deepEqual(audio.getDiagnostics().contacts,[])
    assert.equal(audio.getDiagnostics().activeVoices,1,'release remains owned until the scheduled source end')
    assert.deepEqual(source.stops,[1.06],'the scheduled fade is not overwritten by an immediate stop')
    assert.deepEqual(envelope.gain.targets.at(-1),{value:0,time:1,constant:.012})
    assert.equal(source.disconnects,0)
    assert.equal(envelope.disconnects,0)
    context.advanceTo(1.059)
    assert.equal(audio.getDiagnostics().activeVoices,1)
    context.advanceTo(1.061)
    assert.equal(audio.getDiagnostics().activeVoices,0)
    assert.equal(source.disconnects,1)
    assert.equal(envelope.disconnects,1)
  })
})

test('ended or evicted contact sources do not leave an orphaned contact blocking the next gesture', async () => {
  await withAudio(async (audio, context) => {
    audio.loadSampleManifest({flow:{url:'flow',loop:true},cut:{url:'cut'}})
    await audio.primeEvents(['flow','cut'])
    audio.setContact('flow',true)
    const ended = context.sources[0]
    ended.finish()
    assert.deepEqual(audio.getDiagnostics().contacts,[],'a native source end releases its contact as well as its voice')
    assert.equal(ended.onended,null,'cleanup detaches the source callback')
    audio.setContact('flow',true)
    const evicted = context.sources[1]
    for (let i=0;i<56;i++) audio.playEvent('cut')
    assert.equal(evicted.disconnects,1,'voice budget evicts the oldest contact source')
    assert.deepEqual(audio.getDiagnostics().contacts,[],'eviction does not leave a dead contact attached')
    audio.setContact('flow',true)
    assert.deepEqual(audio.getDiagnostics().contacts,['flow'])
    assert.equal(context.sources.at(-1)?.loop,true,'a later real gesture starts a fresh loop')
    assert.equal(audio.getDiagnostics().activeVoices,56)
  })
})

test('selective and repeated stops preserve release tails, replacement contacts and music', async () => {
  await withAudio(async (audio, context) => {
    audio.loadSampleManifest({flow:{url:'flow',loop:true},other:{url:'other',loop:true},cut:{url:'cut'},'instrument.shaker':{url:'shaker'}})
    await audio.primeEvents(['flow','other','cut','instrument.shaker'])
    audio.setContact('flow',true)
    audio.setContact('other',true)
    audio.playEvent('cut')
    audio.playNote('shaker',60)
    const [old,other,cut,music] = context.sources
    audio.stopEffects(['flow','cut'])
    assert.deepEqual(audio.getDiagnostics().contacts,['other'])
    assert.equal(cut.disconnects,1,'one-shot cleanup remains immediate')
    assert.equal(other.disconnects,0,'another scene contact is untouched')
    assert.equal(music.disconnects,0,'effect cancellation does not stop music')
    context.advanceTo(1.02)
    audio.stopEffects(['flow','cut'])
    assert.deepEqual(old.stops,[1.06],'another stop does not cut short or extend an existing release')
    audio.setContact('flow',true)
    const replacement = context.sources.at(-1)!
    context.advanceTo(1.061)
    assert.equal(old.disconnects,1)
    assert.equal(replacement.disconnects,0)
    assert.deepEqual(audio.getDiagnostics().contacts,['other','flow'],'the old end callback does not erase the replacement')
    audio.setContact('flow',false)
    audio.stopEffects()
    audio.stopEffects()
    assert.equal(replacement.stops.length,1,'a release begun by loss of contact survives scene cleanup')
    context.advanceTo(1.122)
    assert.deepEqual(audio.getDiagnostics().contacts,[])
    assert.equal(audio.getDiagnostics().activeVoices,1,'only the music source remains')
    audio.stopMusic()
    context.advanceTo(3)
    assert.equal(audio.getDiagnostics().activeVoices,0)
    for (const source of context.sources) {
      assert.equal(source.disconnects,1)
      assert.equal(source.destination?.disconnects,1)
      assert.equal(source.onended,null)
    }
  })
})

test('cancelled pending contacts never start and suspend immediately clears releasing voices', async () => {
  await withAudio(async (audio, context) => {
    let finishFetch!: (value: Response) => void
    globalThis.fetch = () => new Promise(resolve => { finishFetch = resolve })
    audio.loadSampleManifest({flow:{url:'slow-flow',loop:true}})
    audio.setContact('flow',true)
    audio.stopEffects()
    finishFetch(new Response(new Uint8Array(4)))
    await audio.primeEvents(['flow'])
    assert.deepEqual(audio.getDiagnostics().contacts,[])
    assert.equal(audio.getDiagnostics().playedNotes,0,'late decoded audio cannot revive a cancelled gesture')
    audio.setContact('flow',true)
    const source = context.sources[0]
    audio.stopEffects()
    assert.equal(audio.getDiagnostics().activeVoices,1)
    await audio.suspend()
    assert.equal(audio.getDiagnostics().state,'suspended')
    assert.equal(audio.getDiagnostics().activeVoices,0,'a suspended audio clock cannot strand a release tail')
    assert.deepEqual(audio.getDiagnostics().contacts,[])
    assert.equal(source.disconnects,1)
    assert.equal(source.onended,null)
    await audio.unlock()
    context.advanceTo(2)
    assert.equal(audio.getDiagnostics().activeVoices,0,'resume does not resurrect the old source')
    audio.setContact('flow',true)
    assert.equal(audio.getDiagnostics().activeVoices,1,'a new gesture still starts normally after resuming')
  })
})
