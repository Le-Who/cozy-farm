import { createFarm, completeSignature, getNeighborPlans, joinNeighborPlan, serveNeighborPlan, tasteSignature, forgetSignature, restoreFarm } from '../../src/farm.ts'

export function neighborFoodFixture(deleted = false) {
  const farm = createFarm(); farm.day = 5; farm.boatOwned = true; farm.buildingLevels.farmhouse = 2; farm.buildingLevels.coop = 2
  farm.projects.fair = { 'dishes:appleJam': 1, eggBaskets: 1, 'produce:carrot': 4, 'produce:wheat': 3 }
  farm.fairGuestsServed = 3; farm.guestServedOn = 3
  farm.projects.dock = { 'dishes:appleJam': 1, 'fruit:pear': 2, seaSalt: 2 }
  farm.village = { built:true, supplies:{'handmade:round':2,'fish:seaBass':2,honey:2}, residents:['bea','finn'], meals:2, mealOn:2, serviceOn:{bea:0,finn:0}, scouting:false }
  farm.fruit.apple = farm.produce.wheat = farm.eggs = 100; farm.dishes.strawberryTart = 2
  farm.island = 'village'
  const made = completeSignature(farm, {base:'tart',ingredients:[{id:'apple',quantity:2}]}, {family:'decorate',processing:'chunky',fruit:[{ingredientId:'apple',x:.2,y:-.3,angle:.4}],steps:['fruit','bake'],baking:{method:'oven',finish:'golden',seconds:90}})
  const plan = getNeighborPlans(farm).find(plan=>plan.resident==='bea')!
  if (!made.ok || !joinNeighborPlan(farm,plan.id).ok || !serveNeighborPlan(farm,plan.id,`signature:${made.recipeId}`).ok || !tasteSignature(farm,made.recipeId!,'bea').ok) throw Error('Не создана проверочная встреча')
  if(deleted && !forgetSignature(farm,made.recipeId!).ok)throw Error('Не удалён проверочный рецепт')
  if(!restoreFarm(farm))throw Error('Некорректная проверочная ферма')
  return { farm, planId: plan.id, recipeId: made.recipeId! }
}
