import { createFarm, getProject, restoreFarm } from '../../src/farm.ts';

export function villageBudgetFixture(ready = false) {
  const farm=createFarm();
  farm.day=3;farm.boatOwned=true;farm.buildingLevels={farmhouse:2,coop:2,well:2};
  for (const id of ['fair','dock'] as const) for (const {item} of getProject(farm,id).items) {
    farm.projects[id]['item' in item ? `${item.kind}:${item.item}` : item.kind]=item.quantity;
  }
  farm.guestServedOn=1;farm.fairGuestsServed=1;
  farm.capeFlowers=[1,null,null];farm.capeHoneyOn=2;
  farm.handmade.round=1;farm.fish.seaBass=2;farm.honey=2;
  farm.fruit.apple=10;farm.coins=ready ? 50 : 20;
  if (ready) farm.handmade.round=2;
  farm.orientation={collections:true,islands:true};farm.discoveryPreferences.quiet=true;
  const checked=restoreFarm(farm);
  if (!checked) throw Error('Некорректная проверочная ферма');
  return checked;
}
