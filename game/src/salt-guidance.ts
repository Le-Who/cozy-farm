import { canSailTo, sail, type FarmState } from './farm.ts';
import { freightStock } from './bay-freight-model.ts';
import { getLocalWarehouseSupply } from './warehouse-guidance.ts';

/** Only redirect an exhausted gathering trip if one existing withdrawal fills the missing salt. */
export function getGroveSaltWithdrawal(farm: FarmState, total: number): number | undefined {
  const missing = total - farm.seaSalt;
  if (farm.island === 'grove' || !farm.saltGatheredToday || !Number.isSafeInteger(total) || missing < 1
      || !canSailTo(farm,'grove') || freightStock(farm.freight,'grove','seaSalt') < missing) return;
  const preview = structuredClone(farm);
  if (!sail(preview,'grove').ok) return;
  const quote = getLocalWarehouseSupply(preview,{kind:'seaSalt',quantity:total});
  return quote?.quantity === missing ? missing : undefined;
}

/** The current salt rule resets after an explicit night and gives two portions per collection. */
export function seaSaltRestNotice(farm: Pick<FarmState,'day'>): string {
  const next=farm.day+1;
  const when=Number.isSafeInteger(next)?`, в игровой день ${next},`:'';
  return `Сегодня морская соль уже собрана. После отдыха дома${when} снова можно вручную собрать 2 порции на солончаках. Сон и сбор нужно выбрать отдельно.`;
}
