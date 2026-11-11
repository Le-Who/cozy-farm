import {neighborTastingsFixture} from './neighbor-tastings.ts'
import {transferBayGoods} from '../../src/harbour-economy.ts'
import {restoreFarm} from '../../src/farm.ts'

export function storedRecipesFixture(last=false){
  const {farm,recipeId}=neighborTastingsFixture()
  farm.island='home'
  if(!transferBayGoods(farm,'deposit','home',`signature:${recipeId}`,3).ok)throw Error('Не подготовлена складская партия')
  farm.eggs=0
  if(last){
    if(!transferBayGoods(farm,'withdraw','home',`signature:${recipeId}`,2).ok)throw Error('Не подготовлена последняя порция')
    farm.eggs=2
  }
  if(!restoreFarm(farm))throw Error('Некорректная проверочная ферма')
  return {farm,recipeId}
}
