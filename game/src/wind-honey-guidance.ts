import { canSailTo, getCapeHoney, type FarmState } from './farm.ts';
import { ruCount } from './ru.ts';

/** A read-only forecast of the requested honey, not the ordinary daily harvest. */
export function getWindHoneySource(farm: FarmState) {
  if (!canSailTo(farm, 'cape')) return { kind: 'locked' as const, detail: 'Сначала откройте путь на Цветочный мыс.' };
  const empty = farm.capeFlowers.findIndex(day => day === null);
  if (farm.capeFlowers.every(day => day === null)) return {
    kind: 'plant' as const, index: empty,
    detail: 'Посадите хотя бы одну клумбу мыса. Мёд ветров бывает при Медовом ветре; пустые клумбы не дадут его после отдыха.',
  };
  // Seven nights cover the first wind on day 8, and every later return.
  // Availability, bloom and the rare yield remain owned by the actual harvest rule.
  for (let nights = 0; nights <= 7; nights++) {
    const day = farm.day + nights;
    if (!Number.isSafeInteger(day) || day < 1) break;
    const harvest = getCapeHoney({ ...farm, day, island: 'cape' });
    if (!harvest.available || harvest.windHoney < 1) continue;
    if (nights === 0) return { kind: 'ready' as const, day, nights, quantity: harvest.windHoney,
      detail: `Сегодня, в игровой день ${day}, доступен мёд ветров ×${harvest.windHoney}. Соберите его в улье вручную. Редкая порция заменяет обычную.`,
    };
    return { kind: 'wait' as const, day, nights, quantity: harvest.windHoney,
      detail: `${farm.capeHoneyOn === farm.day ? 'Сегодня мёд уже собран.' : 'Сегодня мёд ветров недоступен.'} Ближайший мёд ветров ×${harvest.windHoney}: игровой день ${day}, через ${ruCount(nights, 'ночь', 'ночи', 'ночей')} отдыха дома. Прогноз по нынешним клумбам; сбор на мысе вручную.`,
    };
  }
  return { kind: 'unknown' as const, detail: 'Мёд ветров появляется при Медовом ветре. Сейчас нельзя определить следующий доступный сбор.' };
}
