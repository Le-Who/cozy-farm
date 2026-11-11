import { villageBudgetFixture } from './village-budget.ts';
import { sharedSupperFixture } from './shared-supper.ts';
import { restoreFarm, type WorkshopShape } from '../../src/farm.ts';
export function pastryGuidanceFixture(shape:WorkshopShape='folded'){
  const farm=sharedSupperFixture('spent');
  farm.workshopPatterns=[shape];farm.produce.wheat=4;farm.eggs=2;
  farm.orientation={collections:true,islands:true};farm.discoveryPreferences.quiet=false;
  const checked=restoreFarm(farm);if(!checked)throw Error('Некорректная проверочная ферма');return checked;
}

export function pastryProjectFixture(){
  const farm=villageBudgetFixture();farm.workshopPatterns=['folded'];farm.handmade.round=0;
  farm.fish.seaBass=0;farm.honey=0;farm.bayDiscoveries=['honey'];farm.village.supplies={'fish:seaBass':2,honey:2};
  farm.produce.wheat=4;farm.eggs=2;farm.discoveryPreferences.quiet=false;
  const checked=restoreFarm(farm);if(!checked)throw Error('Некорректная проверочная ферма');return checked;
}
