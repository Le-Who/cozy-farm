import { recipeRepeatReturnFixture } from './recipe-repeat-return.ts'
import { restoreFarm } from '../../src/farm.ts'

export function recipeWarehouseReturnFixture() {
  const {farm,recipeId}=recipeRepeatReturnFixture('ready')
  farm.produce.wheat=0
  farm.freight.warehouses.home.wheat=3
  if(!restoreFarm(farm))throw Error('Некорректная проверочная ферма')
  return {farm,recipeId}
}
