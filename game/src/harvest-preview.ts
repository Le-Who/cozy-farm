import { cropDefinitions, type BedHarvestPreview } from './farm.ts'
import { traitLabel } from './ru.ts'

export function harvestPreviewCopy(preview: BedHarvestPreview) {
  const action = `Собрать +${preview.total}`
  const detail = [
    preview.ordinary ? `Обычные ×${preview.ordinary}` : '',
    preview.special && preview.trait ? `${traitLabel(preview.trait, preview.crop)} ×${preview.special}` : '',
  ].filter(Boolean).join(' · ')
  const bonus = preview.picnicBonus ? 'Пикник +1 уже учтён' : ''
  const hint = [cropDefinitions[preview.crop].name, action, detail, bonus].filter(Boolean).join(' · ')
  return { action, detail, bonus, hint }
}

/** Shared by the field card and its isolated layout check. All copy is text. */
export const fieldContextCopyMarkup = '<span class="context-copy" id="context-copy"><span class="context-title"></span><small class="context-detail" hidden></small><small class="context-bonus" hidden></small></span>'

export function updateFieldContextCopy(root: HTMLElement, title: string, detail = '', bonus = '') {
  for (const [selector, value] of [['.context-title', title], ['.context-detail', detail], ['.context-bonus', bonus]]) {
    const element = root.querySelector<HTMLElement>(selector)!
    if (element.textContent !== value) element.textContent = value
    element.hidden = !value
  }
}
