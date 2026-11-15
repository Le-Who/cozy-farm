import { restoreFarm, type IslandId } from '../../src/farm.ts'
import { communityReturnFixture } from './community-return.ts'

/** Synthetic, save-valid navigation fixture; not a claim about earned progression. */
export function cookingReturnFixture(at: IslandId = 'home') {
  const fixture = communityReturnFixture('meeting'), farm = fixture.farm
  farm.island = at
  farm.capeLevel = 3; farm.capeFlowers = [1, 1, 1]; farm.capeHoneyOn = 5
  farm.honey = 10; farm.fruit.pear = 10
  if (!restoreFarm(farm)) throw Error('Некорректная ферма проверки возврата')
  return fixture
}
