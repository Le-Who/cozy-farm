import test from 'node:test'
import assert from 'node:assert/strict'
import { BayAudio } from '../src/bay-audio.ts'

class Parameter { value = 0; setValueAtTime() {} linearRampToValueAtTime() {} setTargetAtTime() {} cancelScheduledValues() {} }
class Node { gain = new Parameter(); connect() {} disconnect() {} }
class Buffer {
  sampleRate = 1000; length = 1000; duration = 1; numberOfChannels = 2
  channels = [new Float32Array(1000).fill(.1), new Float32Array(1000).fill(.1)]
  getChannelData(index: number) { return this.channels[index] }
}
class Context {
  state = 'running'; currentTime = 1; destination = new Node()
  resume() { this.state = 'running'; return Promise.resolve() }
  suspend() { this.state = 'suspended'; return Promise.resolve() }
  createGain() { return new Node() }
  createDynamicsCompressor() { return Object.assign(new Node(), Object.fromEntries(['threshold','knee','ratio','attack','release'].map(id=>[id,new Parameter()]))) }
  createAnalyser() { return Object.assign(new Node(), {fftSize:1024,getFloatTimeDomainData(data: Float32Array) { data.fill(0) }}) }
  decodeAudioData() { return Promise.resolve(new Buffer()) }
  createBuffer(_channels: number, length: number) { const buffer = new Buffer(); buffer.length=length; buffer.channels=[new Float32Array(length),new Float32Array(length)]; return buffer }
  createBufferSource() { return Object.assign(new Node(), { buffer:null, loop:false, playbackRate:new Parameter(), start() {}, stop() {} }) }
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
