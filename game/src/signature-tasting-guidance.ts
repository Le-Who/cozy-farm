import type {FarmState,ResidentId} from './farm.ts'

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
  return {
    available:hasPortion&&!servedToday&&!full,
    label:`Угостить ${resident==='bea'?'Беа':'Финна'} · 1 порция`,reason,knownFavorite,
    favoriteNote:knownFavorite?`Это блюдо уже понравилось ${resident==='bea'?'Беа':'Финну'}.`:'',
  }
}
