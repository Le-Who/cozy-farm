import { createFarm, restoreFarm } from '../../src/farm.ts';
export function shellReturnFixture() {
  const farm=createFarm();farm.day=5;farm.boatOwned=true;farm.island='village';
  farm.buildingLevels={farmhouse:2,coop:2,well:2};
  farm.projects.fair={'dishes:appleJam':1,eggBaskets:1,'produce:carrot':4,'produce:wheat':3};
  farm.fairGuestsServed=3;farm.guestServedOn=3;
  farm.village={built:true,supplies:{'handmade:round':2,'fish:seaBass':2,honey:2},residents:[null,null],meals:0,mealOn:0,serviceOn:{bea:0,finn:0},scouting:false};
  farm.shellsCollectedToday=[0,1,2];farm.shells.regular=3;farm.shellDiscoveries=['regular'];farm.seaSalt=3;
  farm.discoveryPreferences.quiet=true;farm.orientation={collections:true,islands:true};
  const checked=restoreFarm(farm);if(!checked)throw Error('Некорректная проверочная ферма');return checked;
}
