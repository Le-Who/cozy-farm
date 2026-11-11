import { createFarm, restoreFarm } from '../../src/farm.ts'
export function supplyPurchasesFixture() {
  const farm=createFarm()
  farm.day=2; farm.coins=50; farm.feed=0; farm.eggsReady=6; farm.chickensFed=false
  farm.beds=farm.beds.map(()=>({kind:'empty'}))
  farm.discoveryPreferences.quiet=true
  if(!restoreFarm(farm))throw Error('Некорректная проверочная ферма')
  return {farm}
}
