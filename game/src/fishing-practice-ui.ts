import type { FarmState } from './farm.ts';
import { canPracticeFishing } from './fishing-practice.ts';

export function renderFishingPracticeEntry(farm: FarmState): string {
  if (!canPracticeFishing(farm)) return '';
  return `<p class="dialog-intro">Можно потренироваться без улова, опыта и прогресса. Все находки останутся в воде.</p>
    <div class="dialog-grid dialog-nav"><button class="dialog-button" type="button" data-action="fishing-practice">Тренироваться без наград</button>
    <button class="dialog-button secondary" type="button" data-action="close">На берег</button></div>`;
}
