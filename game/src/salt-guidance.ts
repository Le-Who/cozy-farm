import type { FarmState } from './farm.ts';

/** The current salt rule resets after an explicit night and gives two portions per collection. */
export function seaSaltRestNotice(farm: Pick<FarmState,'day'>): string {
  const next=farm.day+1;
  const when=Number.isSafeInteger(next)?`, в игровой день ${next},`:'';
  return `Сегодня морская соль уже собрана. После отдыха дома${when} снова можно вручную собрать 2 порции на солончаках. Сон и сбор нужно выбрать отдельно.`;
}
