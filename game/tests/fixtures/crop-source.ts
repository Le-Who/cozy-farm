import { createFarm, restoreFarm } from '../../src/farm.ts';

export function cropSourceFixture() {
  const farm=createFarm();
  farm.day=3;farm.buildingLevels.farmhouse=2;
  farm.beds=farm.beds.map(()=>({kind:'tilled'}));
  farm.beds[0]={kind:'crop',crop:'wheat',growth:0,watered:false};
  farm.beds[1]={kind:'crop',crop:'wheat',growth:1,watered:true,wateredAt:1};
  farm.eggs=1;farm.water=2;
  farm.orientation={collections:true,islands:true};farm.discoveryPreferences.quiet=true;
  const checked=restoreFarm(farm);
  if(!checked)throw Error('Некорректная проверочная ферма');
  return checked;
}
