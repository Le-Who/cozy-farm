import {getBeaPastryCount, getResidentService, residentIds, type FarmState, type ResidentId} from './farm.ts'
import { freightStock } from './bay-freight-model.ts'
import { shopStockSlot } from './bay-shop-quantity.ts'

/** Describe only the existing tasting history, never predict an undiscovered preference. */
export function signatureTastingGuide(farm:FarmState,recipeId:string,resident:ResidentId){
  if(farm.island!=='village'||!farm.village.built||!farm.village.residents.includes(resident)
    ||!farm.culinary.recipes.some(recipe=>recipe.id===recipeId))return undefined
  const memory=farm.culinary.tastings[resident],servedToday=memory.servedOn===farm.day
  const hasPortion=(farm.culinary.stock[recipeId]??0)>0,full=memory.visits>=1_000_000
  const reason=full?'Журнал угощений заполнен.':servedToday
    ? `Сегодня уже ${resident==='bea'?'пробовала':'пробовал'}. Снова на следующий игровой день.`
    : !hasPortion?'Нет готовой порции. Сначала повторите рецепт.':''
  const knownFavorite=memory.favoriteIds.includes(recipeId)
  const available=hasPortion&&!servedToday&&!full
  const bake=resident==='bea'&&available&&knownFavorite&&getBeaPastryCount(farm)===4 ? getResidentService(farm,'bea') : undefined
  return {
    available,
    ...(bake?.available?{bakeFirst:{slot:farm.village.residents.indexOf('bea'),shape:bake.shape}}:{}),
    label:`Угостить ${resident==='bea'?'Беа':'Финна'} · 1 порция`,reason,knownFavorite,
    favoriteNote:knownFavorite?`Это блюдо уже понравилось ${resident==='bea'?'Беа':'Финну'}.`:'',
  }
}

/** Expose only a real last-portion decision, not a new sale or reserve. */
export function lastPortionShopStock(farm: FarmState, recipeId: string): string | undefined {
  if (farm.island !== 'village' || !farm.village.built || farm.culinary.stock[recipeId] !== 1) return
  const id = 'signature:' + recipeId
  // Stocking draws from the local warehouse first; that would not use this jar.
  if (!farm.bayShop.reputation[id]?.sold || freightStock(farm.freight, 'village', id) > 0
    || shopStockSlot(farm.bayShop, { id, identity: id }) < 0
    || !residentIds.some(resident => signatureTastingGuide(farm, recipeId, resident)?.available)) return
  return id
}
