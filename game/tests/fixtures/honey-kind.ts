import { createFarm, restoreFarm } from '../../src/farm.ts';
export function honeyKindFixture(){
  const farm=createFarm();farm.day=8;farm.boatOwned=true;farm.buildingLevels.farmhouse=2;
  farm.projects.dock={'dishes:appleJam':1,'fruit:pear':2,seaSalt:2};farm.capeFlowers=[1,null,null];
  farm.produce.wheat=2;farm.orientation={collections:true,islands:true};farm.discoveryPreferences.quiet=true;
  const checked=restoreFarm(farm);if(!checked)throw Error('Некорректная проверочная ферма');return checked;
}
