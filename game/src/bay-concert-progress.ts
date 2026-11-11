import type { FestivalConcertState } from './festival-concert-guidance.ts'
import { bayActiveVoices, type BayMusicState } from './bay-music-model.ts'

/** The existing four sixteen-step rounds, shared by the reward and its display. */
export const BAY_CONCERT_STEPS = 64

export function bayConcertProgress(state: BayMusicState, steps: number, running: boolean, completedToday: boolean, festival?: FestivalConcertState) {
  const voices = bayActiveVoices(state)
  const completed = festival ? festival === 'ready' : completedToday
  const value = completed ? BAY_CONCERT_STEPS
    : running && voices >= 2 && Number.isFinite(steps) ? Math.max(0, Math.min(BAY_CONCERT_STEPS, Math.floor(steps))) : 0
  let title = completedToday ? 'Сегодня приглашены два слушателя.'
    : voices < 2 ? 'Для концерта нужны две дорожки с нотами.'
    : running ? `Концерт: ${Math.floor(value / 16)} из 4 кругов.` : 'Пригласите двух слушателей в лавку.'
  let detail = completedToday ? 'Бонус действует до нового утра. Повторная игра сегодня не добавит гостей.'
    : voices < 2 ? 'Включите хотя бы два инструмента с ненулевой громкостью. Затем сыграйте 4 круга без остановки.'
    : 'Сыграйте 4 круга без остановки: минимум две дорожки с нотами. Пауза начинает отсчёт заново.'
  if (festival) {
    title = festival === 'ready' ? 'Концерт для праздника готов.'
      : voices < 2 ? 'Для праздника нужны две дорожки с нотами.'
      : running ? `Для праздника: ${Math.floor(value / 16)} из 4 кругов.` : 'Празднику нужен новый концерт.'
    detail = festival === 'ready' ? 'Концерт сыгран после выбора программы. Вернитесь к празднику и отдельно внесите вклад.'
      : 'Сыграйте 4 круга после выбора программы: минимум две дорожки с нотами и ненулевой громкостью. Пауза начинает отсчёт заново.'
    if (completedToday) detail += ' Сегодня два слушателя уже приглашены. Повторная игра не добавит гостей.'
  }
  return { value, maximum: BAY_CONCERT_STEPS, title, detail, completedToday }
}
