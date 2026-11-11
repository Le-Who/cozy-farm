import { createFarm, restoreFarm } from '../../src/farm.ts';
export function saltReturnFixture(){
  const farm=createFarm();farm.day=5;farm.boatOwned=true;farm.buildingLevels.farmhouse=2;
  farm.projects.dock={'dishes:appleJam':1,'fruit:pear':2};farm.bayDiscoveries=['appleJam','pear'];
  farm.seaSalt=0;farm.saltGatheredToday=true;
  farm.discoveryPreferences.quiet=false;farm.orientation={collections:true,islands:true};
  const checked=restoreFarm(farm);if(!checked)throw Error('Некорректная проверочная ферма');return checked;
}
