import {neighborFoodFixture} from './neighbor-food.ts'
import {restoreFarm} from '../../src/farm.ts'
export function requestedPastryFixture(missingEgg=false){
  const {farm}=neighborFoodFixture()
  farm.island='home';farm.handmade={round:0,long:0,folded:0};farm.produce.wheat=4;farm.eggs=missingEgg?0:2
  if(!restoreFarm(farm))throw Error('Некорректная проверочная ферма')
  return {farm}
}
