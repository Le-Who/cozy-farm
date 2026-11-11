import { createFarm, deliverHarborOrder, getProject, restoreFarm } from '../../src/farm.ts';

export function harborReturnFixture() {
  const farm=createFarm();
  farm.day=3;farm.boatOwned=true;farm.island='grove';
  farm.buildingLevels.farmhouse=3;farm.farmhouseSpecialization='bakery';
  for(const {item} of getProject(farm,'dock').items)farm.projects.dock['item' in item ? `${item.kind}:${item.item}`:item.kind]=item.quantity;
  farm.dishes.farmhouseBread=1;farm.fish.seaBass=1;
  farm.orientation={collections:true,islands:true};farm.discoveryPreferences.quiet=true;
  if(!deliverHarborOrder(farm).ok)throw Error('Посылка не принята');
  const checked=restoreFarm(farm);
  if(!checked)throw Error('Некорректная проверочная ферма');
  return checked;
}
