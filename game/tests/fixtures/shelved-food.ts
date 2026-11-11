import {neighborTastingsFixture} from './neighbor-tastings.ts'
import {restoreFarm} from '../../src/farm.ts'

export function shelvedFoodFixture(){
  const {farm,recipeId}=neighborTastingsFixture()
  farm.eggs=0
  if(!restoreFarm(farm))throw Error('Некорректная проверочная ферма')
  return {farm,recipeId}
}
