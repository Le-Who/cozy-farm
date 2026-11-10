import type { BayInstrumentId } from './bay-music-model'

export type BaySample = { url: string; revision?: string; rootMidi?: number; gain?: number; tuned?: boolean; loop?: boolean }
export type BaySampleManifest = Record<string, BaySample | BaySample[]>
export type BayAudioSettings = { muted: boolean; volume: number; music: number; effects: number }
type Voice = { sources: AudioScheduledSourceNode[]; envelope: GainNode; end: number; music: boolean; event?: string; releasing?: boolean }
const settingsKey = 'cozy-bay-audio-v1'
const finiteLevel = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback

/** One gesture-unlocked audio graph serves the whole bay; transport scheduling uses audio time. */
export class BayAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private musicBus: GainNode | null = null
  private effectsBus: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private manifest: BaySampleManifest = {}
  private samples = new Map<string, AudioBuffer>()
  private pending = new Map<string, Promise<void>>()
  private pendingEvents = new Set<string>()
  private contacts = new Map<string, { intensity: number; gain?: number; voice?: Voice }>()
  private failed = new Map<string, number>()
  private voices = new Set<Voice>()
  private recentTakes = new Map<string, string[]>()
  private cueSerial = 0
  get cueSequence(): number { return this.cueSerial }
  private played = 0
  private eventRevision = 0
  private manifestPromise: Promise<boolean> | null = null
  private manifestUrl: string | undefined
  private manifestRetryAt = 0
  settings: BayAudioSettings = { muted: false, volume: .7, music: .8, effects: .8 }

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(settingsKey) ?? 'null') as Partial<BayAudioSettings> | null
      if (saved) this.settings = { muted: saved.muted === true, volume: finiteLevel(saved.volume, .7), music: finiteLevel(saved.music, .8), effects: finiteLevel(saved.effects, .8) }
    } catch { /* A private browsing session still has a complete audio graph. */ }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.suspend()
    })
  }

  get currentTime(): number { return this.context?.currentTime ?? 0 }
  get state(): AudioContextState | 'locked' { return this.context?.state ?? 'locked' }

  async unlock(): Promise<boolean> {
    try {
      if (!this.context || this.context.state === 'closed') this.createGraph()
      if (this.context!.state !== 'running') await this.context!.resume()
      return this.context!.state === 'running'
    } catch { return false }
  }

  private createGraph(): void {
    const AudioConstructor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = this.context = new AudioConstructor({ latencyHint: 'interactive' })
    const master = this.master = ctx.createGain(), music = this.musicBus = ctx.createGain(), effects = this.effectsBus = ctx.createGain()
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -16; compressor.knee.value = 16; compressor.ratio.value = 3; compressor.attack.value = .006; compressor.release.value = .2
    const analyser = this.analyser = ctx.createAnalyser(); analyser.fftSize = 1024
    music.connect(master); effects.connect(master)
    master.connect(compressor); compressor.connect(analyser); analyser.connect(ctx.destination)
    this.applyLevels()
    if (this.settings.muted || this.settings.effects === 0 || this.settings.volume === 0) this.stopEffects()
  }

  setSettings(update: Partial<BayAudioSettings>): void {
    this.settings = { muted: typeof update.muted === 'boolean' ? update.muted : this.settings.muted, volume: finiteLevel(update.volume, this.settings.volume), music: finiteLevel(update.music, this.settings.music), effects: finiteLevel(update.effects, this.settings.effects) }
    this.applyLevels()
    if (this.settings.muted || this.settings.effects === 0 || this.settings.volume === 0) this.stopEffects()
    try { localStorage.setItem(settingsKey, JSON.stringify(this.settings)) } catch { /* Audio preferences remain in memory. */ }
  }

  private applyLevels(): void {
    if (!this.context) return
    this.master?.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.volume, this.currentTime, .025)
    this.musicBus?.gain.setTargetAtTime(this.settings.music, this.currentTime, .025)
    this.effectsBus?.gain.setTargetAtTime(this.settings.effects, this.currentTime, .025)
  }

  loadSampleManifest(manifest: BaySampleManifest): void {
    this.manifest = { ...manifest }
  }

  preload(url = `${import.meta.env.BASE_URL}audio/bay-samples.json`): Promise<boolean> {
    if (this.manifestPromise && this.manifestUrl === url && (!this.manifestRetryAt || performance.now() < this.manifestRetryAt)) return this.manifestPromise
    this.manifestUrl = url
    this.manifestRetryAt = 0
    return this.manifestPromise = this.fetchManifest(url).then(ready => {
      if (this.manifestUrl === url) this.manifestRetryAt = ready ? 0 : performance.now() + 30_000
      return ready
    })
  }

  private async fetchManifest(url: string): Promise<boolean> {
    try {
      const result = await fetch(url,{cache:'no-cache'})
      if (!result.ok) return false
      const value: unknown = await result.json()
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false
      const valid: BaySampleManifest = {}
      for (const [id, entry] of Object.entries(value)) {
        const entries = (Array.isArray(entry) ? entry : [entry]).filter((sample): sample is BaySample => !!sample && typeof sample === 'object' && typeof sample.url === 'string').map(sample => {
          const address=new URL(sample.url, result.url || new URL(url, location.href).href)
          if(sample.revision)address.searchParams.set('v',sample.revision)
          return {...sample,url:address.href}
        })
        if (entries.length) valid[id] = entries
      }
      this.loadSampleManifest(valid)
      return true
    } catch { return false }
  }

  private async prepareSamples(id: string, firstOnly = false): Promise<void> {
    if (!this.context) return
    const entry = this.manifest[id], promises: Promise<void>[] = []
    const takes = Array.isArray(entry) ? entry : entry ? [entry] : []
    for (const sample of firstOnly ? takes.slice(0, 1) : takes) {
      if (this.pending.has(sample.url)) { promises.push(this.pending.get(sample.url)!); continue }
      if (this.samples.has(sample.url) || performance.now() - (this.failed.get(sample.url) ?? -Infinity) < 30_000) continue
      const context = this.context!
      const promise = fetch(sample.url).then(response => { if (!response.ok) throw new Error('sample unavailable'); return response.arrayBuffer() }).then(buffer => context.decodeAudioData(buffer)).then(buffer => { this.samples.set(sample.url, sample.loop ? this.seamlessBuffer(buffer) : buffer); this.failed.delete(sample.url) }).catch(() => { this.failed.set(sample.url, performance.now()) }).finally(() => this.pending.delete(sample.url))
      this.pending.set(sample.url, promise)
      promises.push(promise)
    }
    await Promise.all(promises)
  }

  async primeEvents(ids: readonly string[]): Promise<void> {
    if (!this.context || this.settings.muted || this.settings.effects === 0 || this.settings.volume === 0) return
    if (this.manifestPromise) await this.preload(this.manifestUrl)
    else if (!Object.keys(this.manifest).length) await this.preload()
    if (this.settings.muted || this.settings.effects === 0 || this.settings.volume === 0) return
    await Promise.all(ids.map(id => this.prepareSamples(id)))
  }

  private seamlessBuffer(buffer: AudioBuffer): AudioBuffer {
    const overlap = Math.min(Math.floor(buffer.sampleRate * .08), Math.floor(buffer.length / 4))
    const length = buffer.length - overlap, result = this.context!.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate)
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const input = buffer.getChannelData(channel), output = result.getChannelData(channel)
      output.set(input.subarray(overlap))
      for (let i = 0; i < overlap; i++) { const t = i / overlap; output[length - overlap + i] = input[buffer.length - overlap + i] * (1 - t) + input[i] * t }
    }
    return result
  }

  /** A sustained texture exists only while real material contact is requested. */
  setContact(id: string, active: boolean, intensity = 1): void {
    if (!active || this.settings.muted || this.settings.effects === 0 || this.settings.volume === 0 || this.context?.state !== 'running') {
      const contact = this.contacts.get(id)
      this.contacts.delete(id)
      if (contact?.voice && this.context) {
        const voice = contact.voice, now = this.currentTime
        voice.releasing = true
        voice.envelope.gain.cancelScheduledValues(now); voice.envelope.gain.setTargetAtTime(0, now, .012)
        voice.end = now + .06; for (const source of voice.sources) source.stop(voice.end)
      }
      return
    }
    const existing = this.contacts.get(id)
    if (existing) {
      const next = finiteLevel(intensity,1)
      if (!existing.voice || existing.gain === undefined) existing.intensity = next
      else if (Math.abs(next-existing.intensity) > .015) {
        existing.voice.envelope.gain.setTargetAtTime(next * existing.gain,this.currentTime,.035)
        existing.intensity = next
      }
      return
    }
    const contact: { intensity: number; gain?: number; voice?: Voice } = { intensity: finiteLevel(intensity, 1) }
    this.contacts.set(id, contact)
    const begin = () => {
      if (this.contacts.get(id) !== contact || this.context?.state !== 'running' || this.settings.muted) return
      const entry = this.manifest[id], takes = (Array.isArray(entry) ? entry : entry ? [entry] : []).filter(sample => sample.loop && this.samples.has(sample.url))
      if (!takes.length) return
      const sample = this.eventTake(id, takes), voice = this.makeVoice(this.currentTime, 8, contact.intensity * .7 * finiteLevel(sample.gain, 1), false)
      contact.gain = .7 * finiteLevel(sample.gain, 1)
      voice.end = Infinity; voice.event = id; voice.envelope.gain.cancelScheduledValues(this.currentTime)
      voice.envelope.gain.setValueAtTime(0, this.currentTime); voice.envelope.gain.linearRampToValueAtTime(contact.intensity * .7 * finiteLevel(sample.gain, 1), this.currentTime + .035)
      const source = this.context.createBufferSource(); source.buffer = this.samples.get(sample.url)!; source.loop = true
      source.connect(voice.envelope); voice.sources.push(source); source.onended = () => this.releaseVoice(voice); source.start(); contact.voice = voice
    }
    const entry = this.manifest[id], takes = Array.isArray(entry) ? entry : entry ? [entry] : []
    if (takes.some(sample => sample.loop && this.samples.has(sample.url))) begin()
    else void this.primeEvents([id]).then(begin)
  }

  stopEffects(ids?: readonly string[]): void {
    this.eventRevision++
    for (const id of this.contacts.keys()) if (!ids || ids.includes(id)) this.setContact(id, false)
    // Keep contact tails connected until onended; repeated scene cleanup must not cut them off.
    for (const voice of this.voices) if (!voice.music && !voice.releasing && (!ids || voice.event && ids.includes(voice.event))) this.releaseVoice(voice)
  }

  private instrumentSamples(id: BayInstrumentId): BaySample[] {
    const entry = this.manifest[`instrument.${id}`]
    return (Array.isArray(entry) ? entry : entry ? [entry] : []).filter(sample => this.samples.has(sample.url) && (id === 'shaker' || id === 'ceramic' || sample.tuned === true && Number.isFinite(sample.rootMidi)))
  }

  async primeInstruments(ids: readonly BayInstrumentId[], progress?: (ready: number, total: number) => void): Promise<boolean> {
    if (!this.context) return false
    if (this.manifestPromise) await this.manifestPromise
    if (ids.some(id => !this.manifest[`instrument.${id}`])) await this.preload(this.manifestUrl)
    let ready = 0
    await Promise.all(ids.map(async id => { await this.prepareSamples(`instrument.${id}`); progress?.(++ready, ids.length) }))
    return ids.every(id => this.instrumentSamples(id).length > 0)
  }

  playNote(id: BayInstrumentId, midi: number, time = this.currentTime, velocity = .7): void {
    if (!this.context || this.context.state !== 'running') return
    const at = Math.max(time, this.currentTime), level = Math.max(.01, Math.min(1, velocity))
    const choices = this.instrumentSamples(id), targetMidi = id === 'bass' ? midi - 24 : midi
    if (choices.length) {
      const sample = choices.reduce((best, next) => Math.abs(next.rootMidi! - targetMidi) < Math.abs(best.rootMidi! - targetMidi) ? next : best)
      this.sampleVoice(sample, at, level, true, id === 'shaker' || id === 'ceramic' ? undefined : targetMidi)
    }
  }

  private eventTake(id: string, takes: BaySample[]): BaySample {
    if (takes.length === 1) return takes[0]
    const recent=this.recentTakes.get(id) ?? []
    const excluded=recent.slice(takes.length >= 4 ? -2 : -1)
    const pool=takes.filter(take=>!excluded.includes(take.url))
    const next=pool[Math.floor(Math.random()*pool.length)] ?? takes[0]
    this.recentTakes.set(id,[...recent.slice(-1),next.url])
    return next
  }

  playEvent(id: string, intensity = 1, deadline = performance.now() + 160): void {
    this.cueSerial++
    if (!this.context || this.context.state !== 'running' || this.settings.muted || this.settings.effects === 0 || this.settings.volume === 0) return
    const entry = this.manifest[id], choices = (Array.isArray(entry) ? entry : entry ? [entry] : []).filter(sample => !sample.loop && this.samples.has(sample.url))
    if (choices.length) {
      this.sampleVoice(this.eventTake(id,choices), this.currentTime, finiteLevel(intensity, 1) * .7, false, undefined, id)
      if ((Array.isArray(entry) ? entry : [entry]).some(sample => !this.samples.has(sample.url))) void this.prepareSamples(id)
      return
    }
    if (entry) {
      if (this.pendingEvents.has(id)) return
      this.pendingEvents.add(id)
      const revision = this.eventRevision
      void this.prepareSamples(id, true).then(async () => {
        if (!(Array.isArray(entry) ? entry : [entry]).some(sample => this.samples.has(sample.url))) await this.prepareSamples(id)
        this.pendingEvents.delete(id)
        if (revision !== this.eventRevision || performance.now() > deadline || this.context?.state !== 'running' || this.settings.muted || this.settings.effects === 0 || this.settings.volume === 0) return
        const ready = (Array.isArray(entry) ? entry : [entry]).filter(sample => !sample.loop && this.samples.has(sample.url))
        if (ready.length) this.sampleVoice(this.eventTake(id,ready), this.currentTime, finiteLevel(intensity, 1) * .7, false, undefined, id)
        void this.prepareSamples(id)
      })
      return
    }
    if (this.manifestRetryAt && performance.now() >= this.manifestRetryAt && !this.pendingEvents.has(id)) {
      const revision = this.eventRevision
      this.pendingEvents.add(id)
      void this.preload(this.manifestUrl).then(ready => {
        this.pendingEvents.delete(id)
        if (ready && revision === this.eventRevision && performance.now() <= deadline) this.playEvent(id, intensity, deadline)
      })
    }
  }

  private makeVoice(time: number, duration: number, velocity: number, music: boolean): Voice {
    const ctx = this.context!, envelope = ctx.createGain()
    const voice: Voice = { sources: [], envelope, end: time + duration + .08, music }
    envelope.gain.setValueAtTime(0, time); envelope.gain.linearRampToValueAtTime(velocity, time + Math.min(.004, duration / 4)); envelope.gain.setValueAtTime(velocity, time + Math.max(.004, duration - .035)); envelope.gain.linearRampToValueAtTime(0, time + duration)
    envelope.connect(music ? this.musicBus! : this.effectsBus!)
    for (const old of this.voices) if (old.end < this.currentTime) this.releaseVoice(old)
    if (this.voices.size >= 56) this.releaseVoice(this.voices.values().next().value!)
    this.voices.add(voice); this.played++
    return voice
  }

  private sampleVoice(sample: BaySample, time: number, velocity: number, music: boolean, midi?: number, event?: string): void {
    const ctx = this.context!, buffer = this.samples.get(sample.url)!
    const rate = midi !== undefined && sample.rootMidi !== undefined ? Math.pow(2, (midi - sample.rootMidi) / 12) : 1
    const organic = !music && event && /^(flock\.|field\.|gather\.|orchard\.)/.test(event)
    const speed = organic ? rate*(.965 + Math.random()*.07) : rate
    const duration = Math.min(8, buffer.duration / speed), voice = this.makeVoice(time, duration, velocity * finiteLevel(sample.gain, 1), music)
    if (event?.startsWith('flock.')) {
      const sounding = [...this.voices].filter(v=>v.event?.startsWith('flock.') && v.end > time+.025)
      if (sounding.length >= 3) {
        const oldest=sounding[0]
        oldest.end=time+.024
        oldest.envelope.gain.cancelScheduledValues(time)
        oldest.envelope.gain.setTargetAtTime(0,time,.005)
        for(const node of oldest.sources) node.stop(oldest.end)
      }
    }
    voice.event = event
    const source = ctx.createBufferSource(); source.buffer = buffer; source.playbackRate.value = speed
    source.connect(voice.envelope); voice.sources.push(source); source.start(time); source.stop(voice.end)
    source.onended = () => this.releaseVoice(voice)
  }

  private releaseVoice(voice: Voice): void {
    if (!this.voices.delete(voice)) return
    for (const [id, contact] of this.contacts) if (contact.voice === voice) this.contacts.delete(id)
    for (const source of voice.sources) {
      source.onended = null
      try { source.stop() } catch { /* Already ended. */ }
      source.disconnect()
    }
    voice.envelope.disconnect()
  }

  stopMusic(): void { this.eventRevision++; for (const voice of this.voices) if (voice.music) this.releaseVoice(voice) }
  async suspend(): Promise<void> {
    this.eventRevision++
    this.contacts.clear()
    for (const voice of this.voices) this.releaseVoice(voice)
    if (this.context?.state === 'running') await this.context.suspend()
  }
  getDiagnostics(): { state: string; activeVoices: number; playedNotes: number; loadedSamples: number; decodedBytes: number; pendingSamples: number; failedSamples: number; contacts: string[]; rms: number; peak: number } {
    let rms = 0, peak = 0
    if (this.analyser) { const data = new Float32Array(this.analyser.fftSize); this.analyser.getFloatTimeDomainData(data); for (const value of data) { rms += value * value; peak = Math.max(peak, Math.abs(value)) } rms = Math.sqrt(rms / data.length) }
    return { state: this.state, activeVoices: this.voices.size, playedNotes: this.played, loadedSamples: this.samples.size, decodedBytes: [...this.samples.values()].reduce((sum, buffer) => sum + buffer.length * buffer.numberOfChannels * 4, 0), pendingSamples: this.pending.size, failedSamples: this.failed.size, contacts: [...this.contacts.keys()], rms, peak }
  }
}

export const bayAudio = new BayAudio()
