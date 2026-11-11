import { createFarm, getProject, restoreFarm } from '../../src/farm.ts';
export function windHoneyFixture(day: 9 | 12 = 9) {
  const farm=createFarm();farm.day=day;farm.boatOwned=true;farm.island='cape';
  farm.buildingLevels.farmhouse=2;farm.capeLevel=3;farm.capeFlowers=[1,1,1];farm.capeHoneyOn=8;
  for(const {item} of getProject(farm,'dock').items)farm.projects.dock['item' in item?`${item.kind}:${item.item}`:item.kind]=item.quantity;
  farm.fruit.peach=1;farm.eggs=1;farm.orientation={collections:true,islands:true};farm.discoveryPreferences.quiet=true;
  const checked=restoreFarm(farm);if(!checked)throw Error('Некорректная ферма');return checked;
}
