import {neighborFoodFixture} from './neighbor-food.ts'
import {createCulinary} from '../../src/culinary.ts'
import {repeatSignature,restoreFarm} from '../../src/farm.ts'

export function neighborTastingsFixture(){
  const {farm,recipeId}=neighborFoodFixture()
  farm.culinary.tastings=createCulinary().tastings
  if(!repeatSignature(farm,recipeId,undefined,3).ok||!restoreFarm(farm))throw Error('Некорректная проверочная ферма')
  return {farm,recipeId}
}
