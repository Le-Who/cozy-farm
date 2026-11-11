import { islandIds, type FarmState, type StockItem } from './farm.ts'
import { freightStock, freightPortNames } from './bay-freight-model.ts'
import { BAY_MUSIC_EXPANSIONS } from './bay-music-model.ts'
import { gardenMaterialStock } from './harbour-economy.ts'

export const musicMaterialNames: Record<string, string> = {shells:'Ракушки',seaSalt:'Морская соль',beeswax:'Пчелиный воск'}
export const musicMaterialItems: Record<string, StockItem> = {shells:{kind:'shells',item:'regular',quantity:1},seaSalt:{kind:'seaSalt',quantity:1},beeswax:{kind:'beeswax',quantity:1}}
export const musicMaterialSources: Record<string, string> = {
  shells: 'Солёная роща: обычные ракушки на берегу.',
  seaSalt: 'Солёная роща: солончаки. Соль также можно привезти торговым рейсом.',
  beeswax: 'Цветочный мыс: сбор мёда после улучшения пасеки.',
}

/** Guidance reads existing goods first; it never gathers, upgrades or transfers. */
export function getMusicMaterialGuidance(farm: FarmState) {
  const stock = gardenMaterialStock(farm)
  const sources = Object.fromEntries(Object.entries(musicMaterialSources).map(([id, source]) => {
    const local = freightStock(farm.freight, 'village', id), bag = stock[id] - local
    const remote = islandIds.filter(port => port !== 'village' && freightStock(farm.freight, port, id) > 0)
      .map(port => `${freightPortNames[port]}: ${freightStock(farm.freight, port, id)}`).join('; ')
    return [id, `${bag + local > 0 ? `Уже готово: в припасах ${bag}, на складе гавани ${local}. ` : ''}${remote ? `На других складах — ${remote}. Заберите оттуда готовые материалы. ` : ''}${source}`]
  }))
  const expansion = BAY_MUSIC_EXPANSIONS.find(item => item.level === farm.musicGarden.level + 1)
  const missing = expansion?.materials.filter(item => stock[item.id] < item.quantity) ?? []
  const warehouse = islandIds.find(port => port !== 'village' && missing.some(item => freightStock(farm.freight, port, item.id) > 0)) ?? 'village'
  return { sources, warehouse, materials: expansion?.materials ?? [] }
}
