import { canSailTo, ingredientCount, marketStock, restoreFarm, islandIds, type FarmState, type StockItem } from './farm.ts';
import { bayProductId, transferBayGoods } from './harbour-economy.ts';
import { freightStock } from './bay-freight-model.ts';

/** A request is a total bag requirement, never a stored command to transfer goods. */
export function warehouseRequestValue(item: StockItem): string {
  return `${bayProductId(item)}|${item.quantity}`;
}
export function warehouseRequest(value: string | undefined): StockItem | undefined {
  const parts = value?.split('|');
  if (parts?.length !== 2) return undefined;
  const item = marketStock.find(item => bayProductId(item) === parts[0]), quantity = Number(parts[1]);
  return item && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 999999 ? { ...item, quantity } : undefined;
}

/** Only a current, local, valid transfer is offered. Old warehouse goods can predate their unlock. */
export function getLocalWarehouseSupply(farm: FarmState, request: StockItem) {
  const item = warehouseRequest(warehouseRequestValue(request));
  if (!item || !canSailTo(farm, farm.island)) return undefined;
  const id = bayProductId(item), carried = ingredientCount(farm, item);
  const stored = freightStock(farm.freight, farm.island, id);
  const quantity = Math.min(stored, Math.max(0, item.quantity - carried));
  if (!quantity) return undefined;
  const preview = structuredClone(farm);
  if (!transferBayGoods(preview, 'withdraw', farm.island, id, quantity).ok || !restoreFarm(preview)) return undefined;
  return { id, port: farm.island, carried, stored, quantity, needed: item.quantity };
}

export type WarehouseConfirmation = { id: string; port: string; needed: number; quantity: number };
export function warehouseConfirmationValue(supply: WarehouseConfirmation): string {
  return `${supply.port}|${supply.id}|${supply.needed}|${supply.quantity}`;
}
export function warehouseConfirmation(value: string | undefined): WarehouseConfirmation | undefined {
  const parts = value?.split('|');
  if (parts?.length !== 4 || !islandIds.some(id => id === parts[0])) return undefined;
  const item = warehouseRequest(`${parts[1]}|${parts[2]}`), quantity = Number(parts[3]);
  return item && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= item.quantity
    ? {port:parts[0],id:parts[1],needed:item.quantity,quantity} : undefined;
}
export function withdrawWarehouseSupply(farm: FarmState, request: StockItem | undefined, expected: WarehouseConfirmation | undefined) {
  const supply = request && getLocalWarehouseSupply(farm, request);
  if (!supply || !expected || supply.quantity !== expected.quantity || supply.port !== expected.port || supply.id !== expected.id || supply.needed !== expected.needed)
    return { ok: false, message: 'Запас изменился. Проверьте количество перед переносом.' };
  return transferBayGoods(farm, 'withdraw', supply.port, supply.id, supply.quantity);
}

export function warehouseSupplyCopy(farm: FarmState, request: StockItem) {
  const supply = getLocalWarehouseSupply(farm, request), carried = ingredientCount(farm, request);
  return supply ? `В припасах: ${carried}/${request.quantity}. На местном складе: ${supply.stored}. Можно забрать недостающее: ${supply.quantity}.`
    : carried >= request.quantity ? 'Нужное количество уже в припасах. Можно вернуться к своему делу.'
    : 'На этом берегу сейчас нет доступной партии. Запасы на других островах не перемещаются автоматически.';
}
