import { getCoinGuidance, getSupplyGuidance, type DiscoveryTask } from './discovery-path.ts';
import { getIslandJourneys } from './journey.ts';
import {
  boatPrice, buildingIds, canSailTo, cropIds, dishDefinitions, eggsPerCrate,
  getFairGuest, getFishAction, getShellAt, getVillageProject, ingredientCount, isProjectComplete,
  type BuildingId, type FarmState, type IslandId, type StockItem,
} from './farm.ts';
import { hasShoal, getShoalFindAt } from './shoal.ts';
import { shellSpotCount } from './tide.ts';
import { traitNames } from './climate.ts';

export type Requirement = { kind: 'stock'; item: StockItem }
  | { kind: 'building'; building: BuildingId }
  | { kind: 'journey'; island: IslandId; id: string }
  | { kind: 'delivery' };
export type RequirementHint = { action: DiscoveryTask['action']; notice?: string; selector?: string };
const route = (target: string, value?: string): RequirementHint => ({ action: { label: '', target, value } });
const atHome = (farm: FarmState, hint: RequirementHint) => farm.island === 'home' ? hint : route('sail', 'home');

function safe(task: DiscoveryTask): RequirementHint {
  if (task.action.target === 'visit-rest') return { ...route('focus-place', 'farmhouse'), notice: task.detail };
  if (task.action.target === 'refill') return route('focus-place', 'well');
  if (task.action.target === 'gather-salt') return route('focus-place', 'salt');
  if (task.action.target === 'buy-boat' || task.action.target === 'visit-boat') return route('focus-place', 'boat');
  const crop = cropIds.find(crop => crop === task.icon);
  const selector = task.action.target === 'visit-market' ? crop ? `[data-action="buy-seeds"][data-crop="${crop}"]`
    : task.id.endsWith('-feed') ? '[data-action="buy-feed"]' : undefined
    : task.action.target === 'open-panel' && task.action.value === 'seeds' && crop ? `[data-action="preview-seed"][data-value="${crop}"]` : undefined;
  return { action: task.action, selector };
}

function access(farm: FarmState, destination: IslandId): RequirementHint {
  if (canSailTo(farm, destination)) return route('sail', destination);
  if (!farm.boatOwned) return farm.coins < boatPrice ? {...safe(getCoinGuidance(farm, boatPrice, 'a wooden boat')),notice:`A boat costs ${boatPrice} coins. Sell a harvest at the market.`}
    : atHome(farm, route('focus-place', 'boat'));
  const next = getIslandJourneys(farm).find(journey => journey.id === destination)?.nextAction;
  if (next?.target === 'upgrades') return route('show-upgrade',destination==='cape'?'farmhouse':buildingIds.find(building=>farm.buildingLevels[building]<2) ?? 'farmhouse');
  if (next?.target === 'visit-rest') return atHome(farm, { ...route('focus-place', 'farmhouse'), notice: 'The next delivery arrives tomorrow.' });
  return next ? { action: next } : route('open-panel', 'boat');
}

function stock(farm: FarmState, item: StockItem): RequirementHint {
  const destination = item.kind === 'fruit' && item.item === 'pear' || item.kind === 'fish' && item.item !== 'perch'
    || item.kind === 'seaSalt' || item.kind === 'shells' || item.kind === 'shoalFinds' ? 'grove'
    : item.kind === 'honey' || item.kind === 'windHoney' || item.kind === 'beeswax'
      || item.kind === 'dishes' && dishDefinitions[item.item].capeLevel ? 'cape' : undefined;
  if (destination && !canSailTo(farm, destination)) return access(farm, destination);
  const tomorrow = (notice: string) => atHome(farm,{...route('focus-place','farmhouse'),notice});
  if (item.kind === 'fish' && !getFishAction({...farm,island:item.item==='perch'?'home':'grove'}).available) return tomorrow('These fishing waters renew tomorrow.');
  if (item.kind === 'seaSalt' && farm.saltGatheredToday) return tomorrow('The salt flats renew tomorrow.');
  if ((item.kind === 'honey' || item.kind === 'windHoney' || item.kind === 'beeswax') && farm.capeHoneyOn === farm.day) return tomorrow('The hive fills again tomorrow.');
  if (item.kind === 'fruit') {
    const orchard = farm.trees[item.item==='pear'?'grove':'home'].filter(tree=>tree?.tree===item.item);
    if (orchard.length && orchard.every(tree=>tree!.fruitReady===0)) return tomorrow('The orchard needs another morning before fruit can be picked.');
  }
  if (item.kind === 'shells' || item.kind === 'shoalFinds') {
    if (farm.island !== 'grove') return route('sail', 'grove');
    if (item.kind === 'shoalFinds' && !hasShoal(farm)) return {...stock(farm,{kind:'shells',item:farm.shellDiscoveries.includes('regular')?'moon':'regular',quantity:1}),notice:'Discover both shell varieties to reveal Moonpool Shoal.'};
    if (item.kind === 'shoalFinds' && getShoalFindAt(farm,item.item)) return route('focus-shoal',item.item);
    const spot = Array.from({length:shellSpotCount},(_,index)=>index).find(index=>getShellAt(farm,index)===(item.kind==='shells'?item.item:'regular'));
    if (spot !== undefined) return route('focus-shell',String(spot));
    return {...route('focus-place','harbor'),notice:item.kind === 'shells' && item.item === 'moon' ? 'Glowing shells may appear along this shore during a lunar tide.' : 'Shore finds renew on a new day; moon pearls need a lunar tide.'};
  }
  if (item.kind === 'variants') {
    const base: StockItem = item.item === 'egg' ? {kind:'eggs',quantity:item.quantity}
      : item.item === 'apple' || item.item === 'pear' || item.item === 'peach' ? {kind:'fruit',item:item.item,quantity:item.quantity}
      : {kind:'produce',item:item.item,quantity:item.quantity};
    const hint = stock(farm, base);
    return {...hint, notice: `${traitNames[item.trait]} varieties may appear under the matching sky.`};
  }
  if (item.kind === 'dishes') {
    const recipe = dishDefinitions[item.item];
    if (recipe.capeLevel && farm.capeLevel < recipe.capeLevel) return farm.island !== 'cape' ? route('sail','cape') : route('open-panel','cape-upgrade');
    if (!recipe.capeLevel && (farm.buildingLevels.farmhouse < recipe.requiredLevel || recipe.specialization && farm.farmhouseSpecialization !== recipe.specialization)) return atHome(farm,route('show-upgrade','farmhouse'));
    const missing = recipe.ingredients.find(ingredient=>ingredientCount(farm,ingredient)<ingredient.quantity);
    if (missing) return stock(farm,missing);
    return recipe.capeLevel ? farm.island==='cape'?route('open-panel','honey-kitchen'):route('sail','cape') : atHome(farm,route('kitchen'));
  }
  if (item.kind === 'beeswax' && farm.capeLevel < 2) return farm.island !== 'cape' ? route('sail','cape') : route('open-panel','cape-upgrade');
  if (item.kind === 'eggCrates') {
    if (farm.coopSpecialization !== 'packing') return atHome(farm, route('show-upgrade','coop'));
    if (farm.eggs >= eggsPerCrate) return atHome(farm, route('visit-coop'));
    return safe(getSupplyGuidance(farm,{kind:'eggs',quantity:eggsPerCrate},'an egg crate'));
  }
  if (item.kind === 'eggBaskets' && farm.buildingLevels.coop < 2) return atHome(farm, route('show-upgrade','coop'));
  if (item.kind === 'handmade' && !isProjectComplete(farm,'fair') && !farm.village.built) return getRequirementHint(farm,{kind:'journey',island:'village',id:'fair'});
  if (item.kind === 'windHoney') return {...safe(getSupplyGuidance(farm,item,'this requirement')),notice:'Wind honey is collected during Honey Wind.'};
  return safe(getSupplyGuidance(farm,item,'this requirement'));
}

/** Read-only wayfinding. Following a condition never purchases, harvests, rests or delivers. */
export function getRequirementHint(farm: FarmState, requirement: Requirement): RequirementHint {
  if (requirement.kind === 'stock') return stock(farm, requirement.item);
  if (requirement.kind === 'delivery') return route('guide-delivery');
  if (requirement.kind === 'building') return atHome(farm, route('show-upgrade',requirement.building));
  const id = requirement.id;
  if (id === 'boat') return access(farm,'grove');
  if (id === 'specialization') return atHome(farm,route('show-upgrade','farmhouse'));
  const building = buildingIds.find(building => id === `building-${building}`);
  if (building) return getRequirementHint(farm,{kind:'building',building});
  if (id === 'village-coins') return safe(getCoinGuidance(farm,getVillageProject(farm).coins,'Lavender Harbour'));
  if (id.startsWith('supply-')) {
    const supply = getVillageProject(farm).items.find(({item}) => `supply-${item.kind}` === id);
    if (supply) return ingredientCount(farm,supply.item) >= supply.item.quantity-supply.delivered
      ? atHome(farm,route('village-project')) : stock(farm,{...supply.item,quantity:supply.item.quantity-supply.delivered});
  }
  if (id === 'fair') {
    const building = buildingIds.find(building => farm.buildingLevels[building] < 2);
    return building ? getRequirementHint(farm,{kind:'building',building}) : atHome(farm,route('fair-project'));
  }
  if (id === 'visitors' && isProjectComplete(farm,'fair')) {
    return atHome(farm,getFairGuest(farm)?.served
      ? {...route('focus-place','farmhouse'),notice:'Another fair visitor arrives tomorrow.'} : route('visit-guest'));
  }
  if (id === 'pier' && farm.boatOwned) return farm.island === 'grove' ? route('project-dock') : route('sail','grove');
  return access(farm,requirement.island);
}
