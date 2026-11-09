import { bayAudio } from './bay-audio'
import { BAY_INSTRUMENTS, BAY_MUSIC_EXPANSIONS, BAY_NOTE_NAMES, BAY_SCALE, bayActiveVoices, bayFestivalPattern, bayPerformanceQuality, cloneBayPattern, normalizeBayMusicState, type BayInstrumentId, type BayMusicState } from './bay-music-model'
import './bay-music.css'

export type BayMusicViewState = { selected: BayInstrumentId; note: number; preset: number; sheet: 'library' | 'settings' | 'materials' | null }

export type BayMusicOptions = {
  viewState?: Partial<BayMusicViewState>
  onViewChange?: (view: BayMusicViewState) => void
  onOpenFreight?: () => void
  state?: BayMusicState
  onSave?: (state: BayMusicState) => void
  onClose: () => void
  onPerformance?: (quality: number) => boolean | void
  onRequestMaterials?: () => number | void
  materialStock?: Readonly<Record<string, number>>
  expansionHint?: string
}

/** A garden visit owns its transport; the farm owns inventory and saved compositions. */
export function createBayMusic(host: HTMLElement, options: BayMusicOptions): { destroy(): void } {
  let state = normalizeBayMusicState(options.state)
  let selected: BayInstrumentId = BAY_INSTRUMENTS.some(item => item.id === options.viewState?.selected && item.level <= state.level) ? options.viewState!.selected! : 'marimba'
  let selectedNote = Math.max(-1, Math.min(7, Math.floor(options.viewState?.note ?? 0))), sheet: BayMusicViewState['sheet'] = null
  let sheetFocus: HTMLElement | null = null
  let running = false, preparing = false, recording = false, destroyed = false, nextStep = 0, nextTime = 0, currentStep = -1, stepsPerformed = 0, rewarded = false
  let timer = 0, frame = 0, transportRevision = 0, auditionRevision = 0
  const scheduled: { step: number; time: number }[] = [], abort = new AbortController(), signal = abort.signal
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const base = import.meta.env.BASE_URL, art = `${base}art/lavender/bay/`
  const root = document.createElement('section'); root.className = 'bay-music'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Музыкальный сад')
  root.innerHTML = `<div class="bay-music-shell">
    <header class="bay-music-heading"><button type="button" class="bay-music-close" aria-label="Назад">‹ <span>Назад</span></button><h1>Музыкальный сад</h1><nav aria-label="Действия сада"><button type="button" data-sheet="library" aria-label="Мои мелодии">♫<span>Мелодии</span></button><button type="button" data-sheet="settings" aria-label="Настроить звук и дорожки">⚙<span>Настроить</span></button><button type="button" data-sheet="materials" aria-label="Новые инструменты">＋<span>Инструменты</span></button></nav></header>
    <div class="bay-music-stage" aria-label="Инструменты в саду"><div class="bay-music-stage-caption"><span class="bay-music-status" role="status" aria-live="polite">Коснитесь инструмента — он зазвучит</span></div><div class="bay-music-instruments">${BAY_INSTRUMENTS.map(instrument => `<button type="button" class="bay-music-instrument" data-instrument="${instrument.id}" style="--instrument-color:${instrument.color}" aria-label="${instrument.name}"><img src="${art}music-${instrument.id}.webp" alt="" draggable="false"><span>${instrument.name}</span><kbd aria-hidden="true">${instrument.key}</kbd><i class="bay-music-lock" aria-hidden="true">＋</i></button>`).join('')}</div></div>
    <div class="bay-music-desk">
      <div class="bay-music-transport"><button type="button" class="bay-music-play" aria-pressed="false">▶ Играть</button><button type="button" class="bay-music-record" aria-pressed="false" aria-label="Записывать касания инструментов">● Запись</button><button type="button" class="bay-music-tempo-short" data-sheet="settings" aria-label="Изменить темп">${state.tempo} <small>уд/мин</small></button><span class="bay-music-playing-label"></span></div>
      <div class="bay-music-score" aria-label="Дорожка выбранного инструмента">${BAY_INSTRUMENTS.map(instrument => `<article class="bay-music-track" data-track="${instrument.id}" style="--instrument-color:${instrument.color}"><div class="bay-music-track-heading"><h2>${instrument.name}</h2><button type="button" class="bay-music-track-mute" data-mute="${instrument.id}" aria-label="Выключить ${instrument.name.toLocaleLowerCase('ru')}">Звучит</button><button type="button" class="bay-music-erase" aria-pressed="false" aria-label="Ластик: убирать ноты">⌫</button></div><div class="bay-music-steps" aria-label="Шестнадцать шагов мелодии">${Array.from({length:16}, (_, step) => `<button type="button" data-step="${step}" data-voice="${instrument.id}" class="${step % 4 === 0 ? 'is-beat' : ''}"><span></span><small aria-hidden="true">${step + 1}</small></button>`).join('')}</div></article>`).join('')}</div>
      <div class="bay-music-note-palette" role="group" aria-label="Высота следующей ноты">${BAY_NOTE_NAMES.map((name, index) => `<button type="button" data-note="${index}" aria-pressed="${index === 0}"><span>${name.replace(' ↑', '′')}</span><kbd aria-hidden="true">${index + 1}</kbd></button>`).join('')}</div>
    </div>
    <div class="bay-music-sheet-backdrop" hidden><section class="bay-music-sheet" role="dialog" aria-modal="true" aria-labelledby="bay-music-sheet-title"><header><h2 id="bay-music-sheet-title"></h2><button type="button" class="bay-music-sheet-close" aria-label="Вернуться к инструментам">×</button></header><div class="bay-music-sheet-body">
      <div data-sheet-content="library" hidden><p class="bay-music-sheet-intro">Изменения сохраняются сами. Здесь можно оставить три любимые версии.</p><div class="bay-music-presets"><label>Название мелодии<input class="bay-music-name" maxlength="40" aria-label="Название мелодии"></label><label>Место для записи<select aria-label="Ячейка сохранения"><option value="0">Запись 1</option><option value="1">Запись 2</option><option value="2">Запись 3</option></select></label><div class="bay-music-sheet-actions"><button type="button" class="bay-music-save">Сохранить версию</button><button type="button" class="bay-music-load">Открыть версию</button></div></div><div class="bay-music-festival-list">${state.festivalUnlocked ? Array.from({length:Math.max(1,state.festivalLevel ?? 1)},(_,i) => `<button type="button" class="bay-music-festival" data-edition="${i+1}">${bayFestivalPattern(i+1).name}</button>`).join('') : ''}</div></div>
      <div data-sheet-content="settings" hidden><div class="bay-music-settings"><label class="bay-music-tempo">Темп <input type="range" min="54" max="132" step="1" value="${state.tempo}" aria-label="Темп мелодии"><output>${state.tempo}</output></label><label class="bay-music-master">Общая громкость <input type="range" min="0" max="100" value="${Math.round(bayAudio.settings.volume * 100)}" aria-label="Общая громкость"></label><label class="bay-music-music-level">Музыка <input type="range" min="0" max="100" value="${Math.round(bayAudio.settings.music * 100)}" aria-label="Громкость музыки"></label><button type="button" class="bay-music-mute" aria-pressed="${bayAudio.settings.muted}" aria-label="${bayAudio.settings.muted ? 'Включить весь звук' : 'Выключить весь звук'}">${bayAudio.settings.muted ? 'Включить звук' : 'Выключить звук'}</button></div><h3>Громкость инструментов</h3><div class="bay-music-mixer">${BAY_INSTRUMENTS.map(instrument => `<label data-mixer="${instrument.id}"><span>${instrument.name}</span><input type="range" data-volume="${instrument.id}" min="0" max="100" aria-label="Громкость: ${instrument.name}"></label>`).join('')}</div><button type="button" class="bay-music-clear">Очистить выбранную дорожку</button><p class="bay-music-help">Пробел — играть и остановить. A S D F G H — инструменты. 1–8 — ноты. Выберите ноту и коснитесь шага, чтобы изменить мелодию. При включённой записи касания инструментов попадают в звучащую дорожку.</p></div>
      <div data-sheet-content="materials" hidden><div class="bay-music-expansion-preview"><img alt="" draggable="false"><div><h3></h3><p>Материалы на складе гавани</p></div></div><div class="bay-music-materials"></div><p class="bay-music-materials-hint"></p><div class="bay-music-sheet-actions"><button type="button" class="bay-music-expand">Собрать инструмент</button><button type="button" class="bay-music-freight">Открыть грузовой паром</button></div></div>
    </div><p class="bay-music-sheet-status" role="status" aria-live="polite"></p></section></div>
  </div>`
  const sheetFooter = document.createElement('footer'); sheetFooter.className = 'bay-music-sheet-footer'
  root.querySelectorAll<HTMLElement>('.bay-music-sheet-actions').forEach(actions => {
    actions.dataset.sheetFooter = actions.closest<HTMLElement>('[data-sheet-content]')!.dataset.sheetContent
    actions.hidden = true; sheetFooter.append(actions)
  })
  root.querySelector('.bay-music-sheet')!.append(sheetFooter)
  host.append(root)
  root.querySelector<HTMLElement>('.bay-music-stage')!.style.backgroundImage = `url("${art}garden.webp")`
  const query = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!
  const playButton = query<HTMLButtonElement>('.bay-music-play'), recordButton = query<HTMLButtonElement>('.bay-music-record'), status = query<HTMLElement>('.bay-music-status')
  const nameInput = query<HTMLInputElement>('.bay-music-name'), presetSelect = query<HTMLSelectElement>('.bay-music-presets select'), expand = query<HTMLButtonElement>('.bay-music-expand')
  presetSelect.value = String(Math.max(0,Math.min(2,Math.floor(options.viewState?.preset ?? 0))))
  const remember = () => options.onViewChange?.({selected,note:selectedNote,preset:Number(presetSelect.value),sheet})
  const save = () => options.onSave?.(normalizeBayMusicState(state))
  const say = (message: string) => { status.textContent = message; status.parentElement!.hidden = !message; query<HTMLElement>('.bay-music-sheet-status').textContent = message }
  const instrumentLevel = (id: BayInstrumentId) => BAY_INSTRUMENTS.find(instrument => instrument.id === id)!.level
  const available = (id: BayInstrumentId) => instrumentLevel(id) <= state.level
  const audible = () => !bayAudio.settings.muted && bayAudio.settings.volume > 0 && bayAudio.settings.music > 0
  function update(): void {
    nameInput.value = state.name
    for (const instrument of BAY_INSTRUMENTS) {
      const track = state.tracks[instrument.id], locked = !available(instrument.id), element = query<HTMLElement>(`[data-track="${instrument.id}"]`)
      element.hidden = selected !== instrument.id
      element.classList.toggle('is-selected', selected === instrument.id); element.classList.toggle('is-muted', track.muted); element.classList.toggle('is-locked', locked)
      query<HTMLButtonElement>(`[data-instrument="${instrument.id}"]`).classList.toggle('is-selected', selected === instrument.id)
      query<HTMLButtonElement>(`[data-instrument="${instrument.id}"]`).classList.toggle('is-locked', locked)
      query<HTMLButtonElement>(`[data-instrument="${instrument.id}"]`).setAttribute('aria-pressed', String(selected === instrument.id))
      query<HTMLButtonElement>(`[data-instrument="${instrument.id}"]`).setAttribute('aria-label', locked ? `${instrument.name}. Нужны материалы из других островов` : instrument.name)
      const mute = query<HTMLButtonElement>(`[data-mute="${instrument.id}"]`); mute.textContent = track.muted ? 'Тихо' : 'Звучит'; mute.setAttribute('aria-pressed', String(track.muted)); mute.setAttribute('aria-label', `${track.muted ? 'Включить' : 'Выключить'} звук: ${instrument.name}`); mute.disabled = locked
      const volume = query<HTMLInputElement>(`[data-volume="${instrument.id}"]`); volume.value = String(Math.round(track.volume * 100)); volume.disabled = locked
      query<HTMLElement>(`[data-mixer="${instrument.id}"]`).hidden = locked
      for (let step = 0; step < 16; step++) {
        const button = query<HTMLButtonElement>(`[data-voice="${instrument.id}"][data-step="${step}"]`), note = track.steps[step]
        button.classList.toggle('has-note', note >= 0); button.setAttribute('aria-pressed', String(note >= 0)); button.disabled = locked
        button.setAttribute('aria-label', `${instrument.name}, шаг ${step + 1}: ${note < 0 ? 'пауза' : BAY_NOTE_NAMES[note]}`)
        button.firstElementChild!.textContent = note >= 0 ? instrument.id === 'ceramic' || instrument.id === 'shaker' ? '●' : BAY_NOTE_NAMES[note].replace(' ↑', '′') : '·'
      }
    }
    root.querySelectorAll<HTMLButtonElement>('[data-note]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.note) === selectedNote)))
    root.querySelectorAll<HTMLButtonElement>('.bay-music-erase').forEach(button => button.setAttribute('aria-pressed', String(selectedNote === -1)))
    query<HTMLElement>('.bay-music-playing-label').textContent = state.name || 'Моя мелодия'
    query<HTMLElement>('.bay-music-tempo-short').innerHTML = `${state.tempo} <small>уд/мин</small>`
    const expansion = BAY_MUSIC_EXPANSIONS.find(item => item.level === state.level + 1)
    expand.hidden = !expansion; expand.textContent = 'Собрать инструмент'
    const materialNames: Record<string,string> = {shells:'Ракушки',seaSalt:'Морская соль',beeswax:'Пчелиный воск'}
    const sources: Record<string,string> = {shells:'Родной остров',seaSalt:'Солёная роща',beeswax:'Цветочный мыс'}
    const preview = query<HTMLElement>('.bay-music-expansion-preview')
    preview.hidden = !expansion
    if (expansion) {
      preview.querySelector('img')!.src = `${art}music-${expansion.level === 1 ? 'shaker' : 'bass'}.webp`
      preview.querySelector('h3')!.textContent = expansion.name
    }
    const ready = expansion?.materials.every(item => (options.materialStock?.[item.id] ?? 0) >= item.quantity) ?? false
    expand.disabled = !ready
    query<HTMLElement>('.bay-music-materials').innerHTML = expansion ? expansion.materials.map(item => { const stock = options.materialStock?.[item.id] ?? 0; return `<div class="${stock >= item.quantity ? 'is-ready' : ''}"><span>${materialNames[item.id]}<small>${sources[item.id]}</small></span><strong>${stock} / ${item.quantity}</strong></div>` }).join('') : '<p>Все шесть инструментов уже в саду.</p>'
    query<HTMLElement>('.bay-music-materials-hint').textContent = expansion ? options.expansionHint ?? (ready ? 'Материалы готовы. Можно собрать новый инструмент.' : 'Загрузите недостающее на островах и выгрузите здесь, в гавани.') : ''
    query<HTMLButtonElement>('.bay-music-freight').hidden = !options.onOpenFreight || !expansion
    query<HTMLButtonElement>('.bay-music-load').disabled = !state.saved[Number(presetSelect.value)]
    for (let i = 0; i < 3; i++) presetSelect.options[i].textContent = state.saved[i] ? `${i + 1} · ${state.saved[i]!.name}` : `Запись ${i + 1} · пусто`
    remember()
  }

  function showSheet(next: BayMusicViewState['sheet']): void {
    if (next && !sheet) sheetFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    sheet = next
    query<HTMLElement>('.bay-music-sheet-backdrop').hidden = !next
    query<HTMLElement>('.bay-music-heading').inert = !!next
    query<HTMLElement>('.bay-music-stage').inert = !!next
    query<HTMLElement>('.bay-music-desk').inert = !!next
    root.querySelectorAll<HTMLElement>('[data-sheet-content]').forEach(element => { element.hidden = element.dataset.sheetContent !== next })
    root.querySelectorAll<HTMLElement>('[data-sheet-footer]').forEach(element => { element.hidden = element.dataset.sheetFooter !== next })
    sheetFooter.hidden = next === 'settings'
    query<HTMLElement>('#bay-music-sheet-title').textContent = next === 'library' ? 'Мои мелодии' : next === 'settings' ? 'Настроить звучание' : 'Новые инструменты'
    query<HTMLElement>('.bay-music-sheet-status').textContent = ''
    remember()
    if (next) { query<HTMLElement>('.bay-music-sheet-body').scrollTop = 0; query<HTMLButtonElement>('.bay-music-sheet-close').focus() }
    else if (sheetFocus?.isConnected) sheetFocus.focus()
  }

  function pulse(id: BayInstrumentId): void {
    const button = query<HTMLElement>(`[data-instrument="${id}"]`)
    button.classList.remove('is-struck'); void button.offsetWidth; button.classList.add('is-struck')
  }
  function playStep(step: number, time: number): void {
    for (const instrument of BAY_INSTRUMENTS) {
      const track = state.tracks[instrument.id], note = track.steps[step]
      if (audible() && available(instrument.id) && !track.muted && track.volume > 0 && note >= 0) {
        bayAudio.playNote(instrument.id, BAY_SCALE[note], time, track.volume * (step % 4 === 0 ? 1 : .83))
        if (instrument.id === 'handpan') bayAudio.playNote(instrument.id, BAY_SCALE[(note + 2) % BAY_SCALE.length], time + .018, track.volume * .42)
      }
    }
    scheduled.push({ step, time })
  }
  function schedule(): void {
    if (!running || bayAudio.state !== 'running') return
    // After a long main-thread pause resume at the next beat, never burst stale notes.
    if (nextTime < bayAudio.currentTime - .12) { nextTime = bayAudio.currentTime + .035; scheduled.length = 0 }
    while (nextTime < bayAudio.currentTime + .12) { playStep(nextStep, nextTime); nextTime += 60 / state.tempo / 4; nextStep = (nextStep + 1) % 16 }
  }
  function draw(): void {
    if (destroyed || !running) return
    while (scheduled.length && scheduled[0].time <= bayAudio.currentTime) {
      const {step} = scheduled.shift()!; currentStep = step
      root.querySelectorAll('.is-current').forEach(element => element.classList.remove('is-current'))
      root.querySelectorAll(`[data-step="${step}"]`).forEach(element => element.classList.add('is-current'))
      for (const instrument of BAY_INSTRUMENTS) if (available(instrument.id) && !state.tracks[instrument.id].muted && state.tracks[instrument.id].steps[step] >= 0) pulse(instrument.id)
      if (bayActiveVoices(state) >= 2) stepsPerformed++; else stepsPerformed = 0
      if (!rewarded && stepsPerformed >= 64) {
        rewarded = true; state.performances++; save(); const attracted = options.onPerformance?.(bayPerformanceQuality(state)); if(attracted)say('Два слушателя зайдут в лавку.')
      }
    }
    frame = requestAnimationFrame(draw)
  }
  function stop(message?: string): void {
    transportRevision++; auditionRevision++; preparing = false; running = false; clearInterval(timer); cancelAnimationFrame(frame); frame = 0; bayAudio.stopMusic(); scheduled.length = 0; currentStep = -1; stepsPerformed = 0
    playButton.textContent = '▶ Играть'; playButton.setAttribute('aria-pressed', 'false'); root.classList.remove('is-playing', 'is-preparing')
    root.querySelectorAll('.is-current').forEach(element => element.classList.remove('is-current'))
    if (message !== undefined) say(message)
  }
  async function toggle(): Promise<void> {
    if (running || preparing) { stop(''); return }
    const revision = ++transportRevision
    auditionRevision++; preparing = true; root.classList.add('is-preparing'); playButton.textContent = '■ Отмена'; say('Готовим инструменты…')
    if (!await bayAudio.unlock()) { if (!destroyed && revision === transportRevision) stop('Коснитесь «Играть» ещё раз, чтобы включить звук.'); return }
    if (destroyed || revision !== transportRevision || document.hidden) return
    const ids = BAY_INSTRUMENTS.filter(instrument => available(instrument.id)).map(instrument => instrument.id)
    const ready = !audible() || await bayAudio.primeInstruments(ids, (loaded, total) => {
      if (!destroyed && revision === transportRevision) say(`Готовим инструменты · ${Math.round(loaded / total * 100)}%`)
    })
    if (destroyed || revision !== transportRevision || document.hidden) return
    if (!ready && audible()) { stop('Звуки инструментов ещё не прибыли. Попробуйте чуть позже.'); return }
    preparing = false; root.classList.remove('is-preparing')
    running = true; nextStep = 0; nextTime = bayAudio.currentTime + .045; stepsPerformed = 0; scheduled.length = 0
    root.classList.add('is-playing'); playButton.textContent = 'Ⅱ Пауза'; playButton.setAttribute('aria-pressed', 'true'); say('')
    schedule(); timer = window.setInterval(schedule, 25); frame = requestAnimationFrame(draw)
  }
  async function strike(id: BayInstrumentId): Promise<void> {
    if (!available(id)) { showSheet('materials'); if (id === 'bass' && state.level === 0) say('Сначала соберите погремушки, затем откроется бас.'); return }
    selected = id; update()
    const note = Math.max(0, selectedNote), track = state.tracks[id]
    pulse(id)
    if (recording && running) { track.steps[Math.max(0, currentStep)] = note; update(); save() }
    say('')
    if (!audible() || track.muted || track.volume <= 0) return
    const audition = ++auditionRevision, revision = transportRevision
    if (!await bayAudio.unlock() || destroyed) return
    const ready = await bayAudio.primeInstruments([id])
    if (destroyed || audition !== auditionRevision || revision !== transportRevision || document.hidden || !audible()) return
    if (!ready) { say('Звук инструмента ещё не прибыл.'); return }
    bayAudio.playNote(id, BAY_SCALE[note], bayAudio.currentTime, track.volume)
  }

  async function restoreSound(): Promise<void> {
    if (!running || !audible()) return
    const revision = transportRevision
    say('Готовим инструменты…')
    const ready = await bayAudio.primeInstruments(BAY_INSTRUMENTS.filter(instrument => available(instrument.id)).map(instrument => instrument.id))
    if (destroyed || revision !== transportRevision || !audible()) return
    say(ready ? '' : 'Звуки инструментов ещё не прибыли. Попробуйте чуть позже.')
  }

  root.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button) return
    if (button.dataset.sheet) { showSheet(button.dataset.sheet as BayMusicViewState['sheet']); return }
    if (button.classList.contains('bay-music-sheet-close')) { showSheet(null); return }
    if (button.classList.contains('bay-music-freight')) { remember(); options.onOpenFreight?.(); return }
    if (button.dataset.instrument) { void strike(button.dataset.instrument as BayInstrumentId); return }
    if (button.dataset.note !== undefined) { selectedNote = Number(button.dataset.note); update(); void strike(selected); return }
    if (button.dataset.mute) { const track = state.tracks[button.dataset.mute as BayInstrumentId]; track.muted = !track.muted; update(); save(); return }
    if (button.dataset.step !== undefined && button.dataset.voice) {
      const id = button.dataset.voice as BayInstrumentId, step = Number(button.dataset.step), track = state.tracks[id]
      selected = id; track.steps[step] = selectedNote < 0 || track.steps[step] === selectedNote ? -1 : selectedNote
      if (track.steps[step] >= 0 && !running) void strike(id)
      update(); save(); return
    }
    if (button.classList.contains('bay-music-close')) options.onClose()
    else if (button === playButton) void toggle()
    else if (button === recordButton) { recording = !recording; recordButton.setAttribute('aria-pressed', String(recording)); say(recording ? running ? 'Касания записываются в звучащую дорожку.' : 'Нажмите «Играть» и касайтесь инструментов для записи.' : '') }
    else if (button.classList.contains('bay-music-erase')) { selectedNote = selectedNote === -1 ? 0 : -1; update() }
    else if (button.classList.contains('bay-music-mute')) { bayAudio.setSettings({muted:!bayAudio.settings.muted}); button.textContent = bayAudio.settings.muted ? 'Включить звук' : 'Выключить звук'; button.setAttribute('aria-pressed', String(bayAudio.settings.muted)); button.setAttribute('aria-label', bayAudio.settings.muted ? 'Включить весь звук' : 'Выключить весь звук'); void restoreSound() }
    else if (button.classList.contains('bay-music-clear')) { state.tracks[selected].steps.fill(-1); update(); save(); say('Выбранная дорожка очищена.') }
    else if (button.classList.contains('bay-music-save')) { state.saved[Number(presetSelect.value)] = cloneBayPattern(state); update(); save(); say('Версия мелодии сохранена.') }
    else if (button.classList.contains('bay-music-load') || button.classList.contains('bay-music-festival')) {
      const pattern = button.classList.contains('bay-music-festival') && state.festivalUnlocked ? bayFestivalPattern(Number(button.dataset.edition)) : state.saved[Number(presetSelect.value)]; if (!pattern) return
      stop(); state = { ...state, ...cloneBayPattern(pattern) }; query<HTMLInputElement>('.bay-music-tempo input').value = String(state.tempo); query<HTMLOutputElement>('.bay-music-tempo output').value = String(state.tempo); update(); save(); say('Сохранённая мелодия открыта.')
    } else if (button === expand) {
      const level = options.onRequestMaterials?.()
      if (typeof level === 'number') { state.level = Math.max(0,Math.min(2,Math.floor(level))); selected = level === 1 ? 'shaker' : 'bass'; update(); save(); showSheet(null); say('Новый инструмент готов. Коснитесь его в саду.') }
    }
  }, {signal})
  root.addEventListener('input', event => {
    const input = event.target as HTMLInputElement
    if (input.matches('.bay-music-tempo input')) { state.tempo = Number(input.value); query<HTMLOutputElement>('.bay-music-tempo output').value = input.value; query<HTMLElement>('.bay-music-tempo-short').innerHTML = `${state.tempo} <small>уд/мин</small>`; save() }
    else if (input.dataset.volume) { state.tracks[input.dataset.volume as BayInstrumentId].volume = Number(input.value) / 100; save() }
    else if (input.matches('.bay-music-master input')) { const wasAudible = audible(); bayAudio.setSettings({volume:Number(input.value)/100}); if (!wasAudible) void restoreSound() }
    else if (input.matches('.bay-music-music-level input')) { const wasAudible = audible(); bayAudio.setSettings({music:Number(input.value)/100}); if (!wasAudible) void restoreSound() }
    else if (input === nameInput) { state.name = input.value; query<HTMLElement>('.bay-music-playing-label').textContent = state.name || 'Моя мелодия'; save() }
  }, {signal})
  presetSelect.addEventListener('change', update, {signal})
  root.addEventListener('keydown', event => {
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); if (sheet) showSheet(null); else options.onClose(); return }
    if (event.key === 'Tab') {
      const scope = sheet ? query<HTMLElement>('.bay-music-sheet') : root
      const focusable = [...scope.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select')].filter(element => !!element.getClientRects().length)
      const first = focusable[0], last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      return
    }
    if ((event.target as HTMLElement).matches('input,select,textarea') || sheet) return
    if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) void toggle(); return }
    const index = ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH'].indexOf(event.code)
    if (index >= 0 && !event.repeat) { event.preventDefault(); void strike(BAY_INSTRUMENTS[index].id) }
    if (/^Digit[1-8]$/.test(event.code)) { selectedNote = Number(event.code.slice(-1))-1; update(); void strike(selected) }

  }, {signal})
  document.addEventListener('visibilitychange', () => { if (document.hidden && (running || preparing)) stop('Нажмите «Играть», чтобы продолжить.') }, {signal})
  update(); query<HTMLButtonElement>('.bay-music-close').focus()
  if (options.viewState?.sheet) showSheet(options.viewState.sheet)
  return { destroy() { if (destroyed) return; destroyed = true; stop(); abort.abort(); cancelAnimationFrame(frame); save(); root.remove(); if (previousFocus?.isConnected) previousFocus.focus() } }
}
