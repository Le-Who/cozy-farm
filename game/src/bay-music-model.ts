export const BAY_INSTRUMENT_IDS = ['ceramic', 'marimba', 'handpan', 'harp', 'shaker', 'bass'] as const
export type BayInstrumentId = typeof BAY_INSTRUMENT_IDS[number]
export type BayTrack = { steps: number[]; muted: boolean; volume: number }
export type BayPattern = { name: string; tempo: number; tracks: Record<BayInstrumentId, BayTrack> }
export type BayMusicState = BayPattern & { level: number; saved: (BayPattern | null)[]; performances: number }
export const BAY_SCALE = [60, 62, 64, 67, 69, 72, 74, 76] as const
export const BAY_NOTE_NAMES = ['До', 'Ре', 'Ми', 'Соль', 'Ля', 'До ↑', 'Ре ↑', 'Ми ↑'] as const
export const BAY_INSTRUMENTS: readonly { id: BayInstrumentId; name: string; level: number; key: string; color: string }[] = [
  { id: 'ceramic', name: 'Глиняный барабан', level: 0, key: 'A', color: '#b97959' },
  { id: 'marimba', name: 'Деревянная маримба', level: 0, key: 'S', color: '#c9954e' },
  { id: 'handpan', name: 'Медный хэндпан', level: 0, key: 'D', color: '#719c9c' },
  { id: 'harp', name: 'Ивовая арфа', level: 0, key: 'F', color: '#a78db8' },
  { id: 'shaker', name: 'Погремушки из семян', level: 1, key: 'G', color: '#87a66c' },
  { id: 'bass', name: 'Деревянный бас', level: 2, key: 'H', color: '#8b7398' },
]
export const BAY_MUSIC_EXPANSIONS = [
  { level: 1, name: 'Погремушки из семян', materials: [{ id: 'shells', quantity: 6 }, { id: 'seaSalt', quantity: 3 }] },
  { level: 2, name: 'Деревянный бас', materials: [{ id: 'shells', quantity: 8 }, { id: 'beeswax', quantity: 4 }] },
] as const
const clamp = (n: unknown, min: number, max: number, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
export const cloneBayPattern = (pattern: BayPattern): BayPattern => ({ name: pattern.name, tempo: pattern.tempo, tracks: Object.fromEntries(BAY_INSTRUMENT_IDS.map(id => [id, { ...pattern.tracks[id], steps: [...pattern.tracks[id].steps] }])) as Record<BayInstrumentId, BayTrack> })

export function createBayMusicState(): BayMusicState {
  const phrase: Record<BayInstrumentId, number[]> = {
    ceramic: [0,-1,-1,-1,2,-1,-1,-1,0,-1,-1,1,2,-1,-1,-1],
    marimba: [0,-1,-1,2,-1,-1,3,-1,4,-1,-1,3,-1,-1,2,-1],
    handpan: [0,-1,-1,-1,-1,-1,-1,-1,3,-1,-1,-1,-1,-1,-1,-1],
    harp: [-1,-1,0,-1,-1,-1,2,-1,-1,-1,4,-1,-1,-1,3,-1],
    shaker: [0,-1,0,-1,1,-1,0,-1,0,-1,0,-1,1,-1,0,-1],
    bass: [0,-1,-1,-1,-1,-1,0,-1,3,-1,-1,-1,-1,-1,3,-1],
  }
  return { name: 'Утро у причала', tempo: 88, level: 0, saved: [null, null, null], performances: 0, tracks: Object.fromEntries(BAY_INSTRUMENT_IDS.map(id => [id, { steps: phrase[id], muted: false, volume: id === 'handpan' ? .48 : .7 }])) as Record<BayInstrumentId, BayTrack> }
}

/** Save files and local presets are untrusted; keep the scheduler's musical domain bounded. */
export function normalizeBayMusicState(value: unknown): BayMusicState {
  const fallback = createBayMusicState()
  if (!value || typeof value !== 'object') return fallback
  const source = value as Partial<BayMusicState>
  const normalizePattern = (candidate: Partial<BayPattern>, defaults: BayPattern): BayPattern => ({
    name: typeof candidate.name === 'string' ? candidate.name.slice(0, 40) : defaults.name,
    tempo: Math.round(clamp(candidate.tempo, 54, 132, defaults.tempo)),
    tracks: Object.fromEntries(BAY_INSTRUMENT_IDS.map(id => {
      const track = candidate.tracks?.[id], original = defaults.tracks[id]
      return [id, { muted: track?.muted === true, volume: clamp(track?.volume, 0, 1, original.volume), steps: Array.from({ length: 16 }, (_, i) => Math.round(clamp(track?.steps?.[i], -1, 7, original.steps[i]))) }]
    })) as Record<BayInstrumentId, BayTrack>,
  })
  return { ...normalizePattern(source, fallback), level: Math.round(clamp(source.level, 0, 2, 0)), performances: Math.floor(clamp(source.performances, 0, 1e9, 0)), saved: Array.from({ length: 3 }, (_, i) => {
    const saved = source.saved?.[i]
    return saved && typeof saved === 'object' ? normalizePattern(saved, fallback) : null
  }) }
}

export function bayActiveVoices(state: BayMusicState): number {
  return BAY_INSTRUMENTS.filter(({ id, level }) => level <= state.level && !state.tracks[id].muted && state.tracks[id].volume > 0 && state.tracks[id].steps.some(note => note >= 0)).length
}

export function bayPerformanceQuality(state: BayMusicState): number {
  return Math.min(1, bayActiveVoices(state) / 4)
}
