import { createFarm, restoreFarm } from '../../src/farm.ts';
export function facilityChoiceFixture(scarce = false) {
  const farm=createFarm();farm.coins=150;farm.buildingLevels.coop=2;farm.buildingLevels.well=2;
  farm.water=3;farm.eggs=scarce?0:5;if(scarce)farm.coins=20;farm.discoveryPreferences.quiet=true;farm.orientation={collections:true,islands:true};
  const valid=restoreFarm(farm);if(!valid)throw Error('Некорректная ферма');return valid;
}
