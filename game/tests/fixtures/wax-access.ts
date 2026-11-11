import { restoreFarm } from '../../src/farm.ts';
import { shellReturnFixture } from './shell-return.ts';
export function waxAccessFixture(){
  const farm=shellReturnFixture();farm.coins=80;farm.shells.regular=8;farm.musicGarden.level=1;
  farm.projects.dock={'dishes:appleJam':1,'fruit:pear':2,seaSalt:2};
  farm.capeFlowers=[1,1,1];farm.capeHoneyOn=farm.day;farm.honey=3;
  const checked=restoreFarm(farm);if(!checked)throw Error('Некорректная проверочная ферма');return checked;
}
