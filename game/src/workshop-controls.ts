/** The palette and the persistent hint share the same action names. */
export const workshopTools = [
  { id: 'knead', label: 'Размять', image: 'workshop-authored/hand-medallion', hint: 'Нажмите и тяните тесто, чтобы размять и вытянуть его.' },
  { id: 'cup', label: 'Округлить', image: 'ui-handmade-round', hint: 'Удерживайте нажатие на тесте, чтобы собрать края в булочку.' },
  { id: 'roll', label: 'Раскатать', image: 'workshop-authored/rolling-pin', hint: 'Ведите по тесту: скалка раскатает его в более плоскую форму.' },
  { id: 'fold', label: 'Сложить', image: 'ui-handmade-folded', hint: 'Потяните край к середине, чтобы сложить тесто.' },
  { id: 'cut', label: 'Разрезать', image: 'workshop-authored/curved-knife', hint: 'Проведите через тесто и отпустите: получится два кусочка.' },
  { id: 'move', label: 'Перенести', image: 'workshop-authored/scraper', hint: 'Перетащите кусочек целиком на свободное место доски.' },
] as const
export type WorkshopTool = typeof workshopTools[number]['id']
export type WorkshopStage = 'ingredients' | 'mixing' | 'transferring' | 'working' | 'baking' | 'finished'

export function workshopToolGuide(stage: WorkshopStage, tool: WorkshopTool, pieces: number, cutting = false) {
  if (stage === 'ingredients' || stage === 'mixing') return { title: 'Замесить тесто', hint: 'Мешайте в миске по кругу или нажимайте пробел.' }
  if (stage === 'transferring') return { title: 'Тесто на доску', hint: 'Сейчас можно будет выбрать инструмент и придать форму.' }
  if (stage === 'baking') return { title: 'Выпекаем', hint: 'Вся партия готовится вместе. Подождите, пока она подрумянится.' }
  if (stage === 'finished') return { title: 'Выпечка готова', hint: 'Партия уже в запасах. Нажмите «Готово», чтобы вернуться.' }
  const selected = workshopTools.find(item => item.id === tool)!
  return { title: `Режим: ${selected.label}`, hint: cutting ? 'Разделяем тесто. Дождитесь появления двух кусочков.' : tool === 'cut' && pieces >= 6 ? 'На доске уже шесть кусочков. Выберите другой инструмент.' : selected.hint }
}

type Rect = { x: number; y: number; width: number; height: number }
/** Keep the existing hand and bake controls free. Compact palettes close after selection. */
export function workshopToolPalette(view: { width: number; height: number }, hand: Rect, bake: Rect) {
  const gap = 6, margin = 6
  const buttonWidth = Math.ceil(Math.max(76, hand.width)), buttonHeight = Math.ceil(Math.max(64, hand.height))
  const rowWidth = buttonWidth * 6 + gap * 5
  const besideLeft = hand.x + hand.width + gap
  const beside = bake.x - gap - besideLeft >= rowWidth
  const columns = beside || rowWidth <= view.width - margin * 2 ? 6 : 3
  const width = columns * buttonWidth + (columns - 1) * gap
  const height = Math.ceil(6 / columns) * buttonHeight + (Math.ceil(6 / columns) - 1) * gap
  const left = beside ? besideLeft : Math.max(margin, Math.min(hand.x + hand.width + gap, view.width - width - margin))
  const top = beside ? Math.min(view.height - height - margin, hand.y) : Math.max(margin, Math.min(hand.y, bake.y) - height - gap)
  return { buttonWidth, buttonHeight, columns, width, height, left, top, compact: !beside }
}
