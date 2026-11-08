import {
  boatPrice, buildingDefinitions, buildingIds, cropDefinitions, cropIds, dishDefinitions, eggsPerBasket, feedBagPrice,
  getBedAction, getBedStage, getCapeBloom, getCookAction, getFairGuest, getFishAction, getGoal, getHarborOrder,
  getMarketOrders, getProject, getSale, getVillageMeal, getVillageProject, ingredientCount, isProjectComplete,
  specializationDefinitions, treeDefinitions, workshopDefinitions, workshopShapes, type CropId, type DishId, type FarmState, type StockItem,
} from './farm.ts';

export type DiscoveryTask = {
  id: string; label: string; detail: string; icon: string; progress: number; target: number;
  reward?: number; action: { label: string; target: string; value?: string };
};
export type DiscoverySeen = { collections: boolean; islands: boolean };

export { supply as getSupplyGuidance, coins as getCoinGuidance };

function task(id: string, label: string, detail: string, icon: string, action: DiscoveryTask['action'], progress = 0, target = 1): DiscoveryTask {
  return { id, label, detail, icon, progress, target, action };
}

function home(farm: FarmState, next: DiscoveryTask): DiscoveryTask {
  return farm.island === 'home' ? next : { ...next, detail: `Return Home. ${next.detail}`, action: { label: 'Return Home', target: 'sail', value: 'home' } };
}

function bedTask(farm: FarmState, index: number, purpose: string): DiscoveryTask {
  const action = getBedAction(farm, index);
  const bed = farm.beds[index];
  if (action.kind === 'water' && !action.available) return task(`${purpose}-refill`, 'Refill the watering can', 'The well supplies water for the next crop.', 'tool-can', { label: 'Visit well', target: 'refill' });
  if (action.kind === 'plant' && !action.available) return task(`${purpose}-seeds`, 'Choose seeds to sow', 'Select an owned seed or buy a seed pack at the market.', 'tool-seeds', { label: 'Choose seeds', target: 'open-panel', value: 'seeds' });
  return task(`${purpose}-bed`, action.label, bed.kind === 'crop' ? `${cropDefinitions[bed.crop].name} · ${purpose}` : purpose,
    bed.kind === 'crop' ? bed.crop : 'tool-hoe', { label: action.label, target: 'focus-bed', value: String(index) });
}

function rest(farm: FarmState, purpose: string, teachFeed = false): DiscoveryTask {
  if (teachFeed && farm.progress.feed === 0 && !farm.chickensFed) return feed(farm, purpose);
  return home(farm, task(`${purpose}-rest`, 'Let tomorrow bring new supplies', 'Rest at the farmhouse. Watered crops grow and fed hens lay overnight.', 'sun', { label: 'Rest until morning', target: 'visit-rest' }));
}

function feed(farm: FarmState, purpose: string): DiscoveryTask {
  if (farm.feed === 0 && farm.coins < feedBagPrice) return coins(farm, feedBagPrice, 'hen feed');
  return home(farm, farm.feed > 0
    ? task(`${purpose}-feed`, 'Feed the hens before resting', 'Fed hens leave fresh eggs in the morning.', 'egg', { label: 'Visit coop', target: 'visit-coop' })
    : task(`${purpose}-feed`, 'Bring feed for the hens', 'Buy a feed bag at the market, then feed the coop before resting.', 'egg', { label: 'Buy feed', target: 'visit-market', value: 'buy' }));
}

function capeHoney(farm: FarmState, purpose: string): DiscoveryTask {
  const empty = farm.capeFlowers.findIndex(day => day === null);
  if (empty >= 0) return task('cape-flowers', 'Plant the Cape flower beds', 'Fill the three beds beside the hive. Local seeds are free and bloom after a night.', 'ui-honey',
    farm.island === 'cape' ? { label: 'Find the next flower bed', target: 'focus-flower', value: String(empty) }
      : { label: 'Set sail to Flower Cape', target: 'sail', value: 'cape' }, farm.capeFlowers.length - farm.capeFlowers.filter(day => day === null).length, farm.capeFlowers.length);
  if (farm.capeFlowers.some((_, i) => getCapeBloom(farm, i) !== 'bloom') || farm.capeHoneyOn === farm.day) return rest(farm, purpose);
  return task('cape-honey', 'Collect your first Cape honey', 'The flowers have bloomed. Visit the hive to collect honey before choosing your next project.', 'ui-honey', farm.island === 'cape'
    ? { label: 'Visit hive', target: 'visit-hive' } : { label: 'Return to Flower Cape', target: 'sail', value: 'cape' });
}

function cropSource(farm: FarmState, crop: CropId, purpose: string): DiscoveryTask {
  if (farm.island !== 'home') return home(farm, task(`${purpose}-${crop}`, `Grow ${cropDefinitions[crop].name.toLowerCase()}`, `Grow ${cropDefinitions[crop].name.toLowerCase()} for ${purpose}.`, crop, { label: 'Return Home', target: 'sail', value: 'home' }));
  const ready = farm.beds.findIndex(bed => bed.kind === 'crop' && bed.crop === crop && getBedStage(bed) === 'ripe');
  if (ready >= 0) return bedTask(farm, ready, purpose);
  const growing = farm.beds.findIndex(bed => bed.kind === 'crop' && bed.crop === crop && !bed.watered);
  if (growing >= 0) return bedTask(farm, growing, purpose);
  if (farm.beds.some(bed => bed.kind === 'crop' && bed.crop === crop)) return rest(farm, purpose);
  const empty = farm.beds.findIndex(bed => bed.kind === 'empty');
  const tilled = farm.beds.findIndex(bed => bed.kind === 'tilled');
  if (tilled >= 0 && farm.selectedSeed === crop && farm.seeds[crop] > 0) return bedTask(farm, tilled, purpose);
  if (farm.seeds[crop] === 0) return farm.coins < cropDefinitions[crop].seedPrice ? coins(farm, cropDefinitions[crop].seedPrice, `${cropDefinitions[crop].name.toLowerCase()} seeds`)
    : task(`${purpose}-${crop}`, `Buy ${cropDefinitions[crop].name.toLowerCase()} seeds`, `A seed pack supplies the ${cropDefinitions[crop].name.toLowerCase()} needed for ${purpose}.`, crop, { label: 'Visit market', target: 'visit-market', value: 'buy' });
  if (tilled >= 0) return task(`${purpose}-${crop}`, `Choose ${cropDefinitions[crop].name.toLowerCase()} seeds`, `Select ${cropDefinitions[crop].name.toLowerCase()}, then sow the prepared bed.`, crop, { label: 'Choose seeds', target: 'open-panel', value: 'seeds' });
  if (empty >= 0) return bedTask(farm, empty, purpose);
  const ripe = farm.beds.findIndex(bed => getBedStage(bed) === 'ripe');
  if (ripe >= 0) return bedTask(farm, ripe, purpose);
  const thirsty = farm.beds.findIndex(bed => bed.kind === 'crop' && !bed.watered);
  return thirsty >= 0 ? bedTask(farm, thirsty, `freeing a bed for ${purpose}`) : rest(farm, purpose);
}

function supply(farm: FarmState, item: StockItem, purpose: string): DiscoveryTask {
  const id = `${purpose}-${item.kind}`;
  if (item.kind === 'produce') return cropSource(farm, item.item, purpose);
  if (item.kind === 'fruit') {
    const island = item.item === 'pear' ? 'grove' : 'home';
    if (farm.island !== island) return task(id, `Gather ${item.item} fruit`, `Visit the ${island === 'home' ? 'Home' : 'Grove'} orchard for ${purpose}.`, `ui-tree-${item.item}`, { label: island === 'home' ? 'Return Home' : 'Visit Grove', target: 'sail', value: island });
    const trees = farm.trees[island];
    const ripe = trees.findIndex(tree => tree?.tree === item.item && tree.fruitReady > 0);
    if (ripe >= 0) return task(id, `Pick ${item.item} fruit`, `Keep ${item.quantity} for ${purpose}.`, `ui-tree-${item.item}`, { label: 'Visit fruit tree', target: 'visit-tree', value: String(ripe) });
    if (trees.some(tree => tree?.tree === item.item)) return rest(farm, purpose);
    const empty = trees.findIndex(tree => tree === null);
    if (!farm.saplings[item.item] && farm.coins < treeDefinitions[item.item].saplingPrice) return coins(farm, treeDefinitions[item.item].saplingPrice, `a ${item.item} sapling`);
    return task(id, `Plant a ${item.item} tree`, `An orchard tree will supply fruit for ${purpose}.`, `ui-tree-${item.item}`, { label: 'Choose a sapling', target: 'visit-tree', value: String(Math.max(0, empty)) });
  }
  if (item.kind === 'eggs' || item.kind === 'eggBaskets') {
    if (farm.island !== 'home') return home(farm, task(id, 'Gather eggs from the coop', `Bring eggs for ${purpose}.`, 'egg', { label: 'Visit coop', target: 'visit-coop' }));
    if (item.kind === 'eggBaskets' && farm.eggs >= eggsPerBasket) return task(id, 'Pack an egg basket', `The upgraded coop packs ${eggsPerBasket} eggs into a basket for ${purpose}.`, 'egg', { label: 'Visit coop', target: 'visit-coop' });
    if (farm.eggsReady > 0) return task(id, 'Collect fresh eggs', `Keep eggs for ${purpose}.`, 'egg', { label: 'Visit coop', target: 'visit-coop' });
    return farm.chickensFed ? rest(farm, purpose) : feed(farm, purpose);
  }
  if (item.kind === 'dishes') return recipe(farm, item.item, purpose);
  if (item.kind === 'fish' || item.kind === 'seaSalt') {
    const destination = item.kind === 'seaSalt' || 'item' in item && item.item !== 'perch' ? 'grove' : 'home';
    if (farm.island !== destination) return task(id, 'Visit the fishing waters', `Gather ${item.kind === 'seaSalt' ? 'sea salt' : 'fish'} for ${purpose}.`, 'boat', { label: destination === 'grove' ? 'Visit Grove' : 'Return Home', target: 'sail', value: destination });
    if (item.kind === 'seaSalt') return farm.saltGatheredToday ? rest(farm, purpose)
      : task(id, 'Gather sea salt', `The Grove salt flats supply ${purpose}.`, 'ui-sea-salt', { label: 'Visit salt flats', target: 'gather-salt' });
    return getFishAction(farm).available ? task(id, 'Catch a fish', `Keep the fish needed for ${purpose}.`, 'fish', { label: 'Visit fishing pier', target: 'visit-pier' }) : rest(farm, purpose);
  }
  if (item.kind === 'handmade') {
    const missing = [{ kind: 'produce', item: 'wheat', quantity: 2 }, { kind: 'eggs', quantity: 1 }] as const;
    const ingredient = missing.find(value => ingredientCount(farm, value) < value.quantity);
    const next = task(id, 'Bake a handmade pastry', `Shape ${workshopDefinitions[item.item].name.toLowerCase()} in the workshop for ${purpose}.`, `ui-handmade-${item.item}`, { label: 'Visit workshop', target: 'workshop' });
    return ingredient ? supply(farm, ingredient, 'a handmade pastry') : farm.island === 'village' ? next : home(farm, next);
  }
  return capeHoney(farm, purpose);
}

function recipe(farm: FarmState, dish: DishId, purpose: string): DiscoveryTask {
  const definition = dishDefinitions[dish];
  if (farm.island !== 'home') return home(farm, task(`${purpose}-kitchen`, `Cook ${definition.name.toLowerCase()}`, `Prepare ${definition.name.toLowerCase()} for ${purpose}.`, 'upgrade-farmhouse-card', { label: 'Visit kitchen', target: 'kitchen' }));
  if (farm.buildingLevels.farmhouse < definition.requiredLevel) return task(`${purpose}-upgrade`, 'Upgrade the farmhouse kitchen', `The ${definition.name.toLowerCase()} recipe needs an upgraded kitchen.`, 'upgrade-farmhouse-card', { label: 'View upgrades', target: 'upgrades' });
  const missing = definition.ingredients.find(item => ingredientCount(farm, item) < item.quantity);
  return missing ? supply(farm, missing, definition.name.toLowerCase())
    : task(`${purpose}-cook`, `Cook ${definition.name.toLowerCase()}`, `${definition.ingredientLabel}. Prepare it in the farmhouse kitchen.`, 'upgrade-farmhouse-card', { label: 'Visit kitchen', target: 'kitchen' });
}

function coins(farm: FarmState, amount: number, purpose: string): DiscoveryTask {
  const readyOrder = getMarketOrders(farm).find(order => order.status === 'ready');
  if (readyOrder) return home(farm, task(`${purpose}-coins`, 'Deliver a market order', `${readyOrder.name} earns ${readyOrder.reward} coins toward ${purpose}.`, 'coin', { label: 'Visit market', target: 'visit-market', value: 'orders' }, farm.coins, amount));
  if (getSale(farm).items > 0) return home(farm, task(`${purpose}-coins`, `Save for ${purpose}`, `Sell spare produce at the market. You need ${amount} coins.`, 'coin', { label: 'Visit market', target: 'visit-market', value: 'sell' }, farm.coins, amount));
  const ripe = farm.beds.findIndex(bed => getBedStage(bed) === 'ripe');
  if (ripe >= 0) return home(farm, bedTask(farm, ripe, `selling toward ${purpose}`));
  const growing = farm.beds.find(bed => bed.kind === 'crop');
  if (growing?.kind === 'crop') return cropSource(farm, growing.crop, `selling toward ${purpose}`);
  const owned = cropIds.find(crop => farm.seeds[crop] > 0);
  if (owned) return cropSource(farm, owned, `selling toward ${purpose}`);
  const fruit = farm.trees.home.find(tree => tree !== null);
  if (fruit) return supply(farm, { kind: 'fruit', item: fruit.tree, quantity: 1 }, `selling toward ${purpose}`);
  return home(farm, task('earn-by-fishing', 'Fish for market supplies', `Sell a catch to earn coins for ${purpose}.`, 'fish', {label:'Visit fishing pier',target:'visit-pier'}));
}

function starter(farm: FarmState): DiscoveryTask | undefined {
  const goal = getGoal(farm);
  if (!goal) return undefined;
  if (farm.island !== 'home') return home(farm, task(goal.id, goal.label, goal.detail, 'island', { label: 'Return Home', target: 'sail', value: 'home' }, goal.progress, goal.target));
  let next: DiscoveryTask;
  if (goal.id === 'rest') return farm.progress.feed === 0 && !farm.chickensFed ? feed(farm, 'first-morning')
    : { ...goal, icon: 'sun', action: { label: 'Rest until morning', target: 'visit-rest' } };
  if (goal.id === 'feed') return feed(farm, 'starter');
  if (goal.id === 'collect') return supply(farm, { kind: 'eggs', quantity: 1 }, 'starter');
  if (goal.id === 'sell') return getSale(farm).items > 0 ? { ...goal, icon: 'coin', action: { label: 'Visit market', target: 'visit-market', value: 'sell' } }
    : cropSource(farm, 'carrot', 'your first sale');
  const index = farm.beds.findIndex((_, i) => getBedAction(farm, i).kind === goal.id);
  if (index >= 0) next = bedTask(farm, index, goal.label.toLowerCase());
  else if (goal.id === 'harvest') {
    const thirsty = farm.beds.findIndex(bed => bed.kind === 'crop' && !bed.watered);
    return thirsty >= 0 ? bedTask(farm, thirsty, 'the first harvest') : rest(farm, 'first-harvest', true);
  } else if (goal.id === 'plant') {
    const empty = farm.beds.findIndex(bed => bed.kind === 'empty');
    return empty >= 0 ? bedTask(farm, empty, 'sowing seeds') : rest(farm, 'sowing-seeds', true);
  } else if (goal.id === 'till') {
    const ripe = farm.beds.findIndex(bed => getBedStage(bed) === 'ripe');
    if (ripe >= 0) return bedTask(farm, ripe, 'freeing soil to prepare a bed');
    const thirsty = farm.beds.findIndex(bed => bed.kind === 'crop' && !bed.watered);
    return thirsty >= 0 ? bedTask(farm, thirsty, 'growing a crop to free a bed') : rest(farm, goal.id, true);
  } else return rest(farm, goal.id, true);
  return { ...next, id: goal.id, label: goal.label, detail: next.action.target === 'focus-bed' ? goal.detail : next.detail, progress: goal.progress, target: goal.target, reward: goal.reward };
}

/** One optional next discovery, derived only from real progress and reachable supplies. */
export function getDiscoveryTask(farm: FarmState, seen: DiscoverySeen): DiscoveryTask | undefined {
  if (farm.village.built) {
    const arrive = (next: DiscoveryTask): DiscoveryTask => farm.island === 'village' ? next : {
      ...next, action: { label: 'Set sail to Lavender Harbour', target: 'sail', value: 'village' },
    };
    if (!farm.village.residents.some(Boolean)) return arrive(task('first-neighbour', 'Welcome your first neighbour', 'Choose a neighbour for the cottage beside the harbour.', 'ui-bea', { label: 'Visit the first cottage', target: 'visit-cottage', value: '0' }));
    if (farm.village.meals < 2) {
      const shape = workshopShapes.find(shape => farm.handmade[shape] > 0) ?? farm.workshopPatterns[0] ?? 'round';
      const meal = getVillageMeal(farm, shape);
      if (meal.served) return rest(farm, 'the next shared supper');
      const missing = meal.items.find(item => ingredientCount(farm, item) < item.quantity);
      if (missing) return supply(farm, missing, 'a shared supper');
      return arrive(task('shared-suppers', 'Share supper by the water', 'Two shared suppers on different days open the second cottage.', 'ui-handmade-round', { label: 'Set the supper table', target: 'village-meal', value: shape }, farm.village.meals, 2));
    }
    const empty = farm.village.residents.findIndex(resident => resident === null);
    if (empty >= 0) return arrive(task('second-neighbour', 'Welcome another neighbour', 'The second cottage is ready for someone new.', 'ui-finn', { label: 'Visit the empty cottage', target: 'visit-cottage', value: String(empty) }));
    return undefined;
  }
  const established = farm.farmhouseSpecialization !== null || farm.orders.harbor.completed > 0 || isProjectComplete(farm, 'fair');
  const pastStarter = established || farm.boatOwned || buildingIds.some(id => farm.buildingLevels[id] > 1);
  if (!seen.collections && farm.progress.harvest > 0 && !established) return task('collections', 'See your first discoveries', 'Your harvest records crops and their unusual varieties in Collections.', 'tool-crate', { label: 'Open Collections', target: 'open-panel', value: 'archive' });
  if (!pastStarter) { const first = starter(farm); if (first) return first; }
  if (!seen.islands) return task('islands', 'Discover the bay', 'The boat map shows each island and the next step that opens its route.', 'island', { label: 'Explore islands', target: 'open-panel', value: 'boat' });
  const cooked = farm.bayDiscoveries.some(id => id in dishDefinitions) || Object.values(farm.dishes).some(count => count > 0);
  if (!cooked && !established) return getCookAction(farm, 'orchardTart').available
    ? task('first-cooking', 'Bake your first orchard tart', 'Use 2 apples, 1 wheat and 1 egg in the farmhouse kitchen.', 'ui-tree-apple', { label: 'Visit kitchen', target: 'kitchen' })
    : recipe(farm, 'orchardTart', 'your first meal');
  if (!farm.boatOwned) return farm.coins < boatPrice ? coins(farm, boatPrice, 'a wooden boat')
    : task('boat', 'Launch a wooden boat', 'A boat opens Saltwind Grove and its orchard, salt flats and harbor.', 'boat', { label: 'Visit boat dock', target: 'visit-boat' });
  if (!established && !farm.bayDiscoveries.includes('pear') && farm.fruit.pear === 0) return supply(farm, { kind: 'fruit', item: 'pear', quantity: 1 }, 'discovering Saltwind Grove');
  if (farm.buildingLevels.farmhouse < 2) return farm.coins < buildingDefinitions.farmhouse.upgradePrice ? coins(farm, buildingDefinitions.farmhouse.upgradePrice, 'the farmhouse kitchen')
    : home(farm, task('farmhouse-upgrade', 'Upgrade the farmhouse', 'A larger kitchen introduces new recipes and a choice of specialization.', 'upgrade-farmhouse-card', { label: 'View upgrades', target: 'upgrades' }));
  if (!farm.farmhouseSpecialization) {
    const minimum = Math.min(...Object.values(specializationDefinitions).map(value => value.price));
    return farm.coins < minimum ? coins(farm, minimum, 'a farmhouse specialization')
      : home(farm, task('specialization', 'Choose a kitchen specialization', 'Choose a Bakery or Preserves kitchen; each opens its own dishes and orders.', 'upgrade-farmhouse-card', { label: 'Choose specialization', target: 'specialize', value: 'farmhouse' }));
  }
  const dock = getProject(farm, 'dock');
  if (!isProjectComplete(farm, 'dock')) {
    if (dock.items.some(item => item.available > 0)) return farm.island !== 'grove'
      ? task('grove', 'Visit Saltwind Grove', 'Bring your supplies to the Grove landing.', 'boat', { label: 'Set sail to Grove', target: 'sail', value: 'grove' })
      : task('dock', 'Build the Grove landing', 'Deliver your supplies to open harbor orders.', 'boat', { label: 'View landing supplies', target: 'project-dock' });
    const missing = dock.items.find(({ item, delivered }) => delivered < item.quantity)!;
    return supply(farm, { ...missing.item, quantity: missing.item.quantity - missing.delivered }, 'the Grove landing');
  }
  if (farm.orders.harbor.completed < 2) {
    const harbor = getHarborOrder(farm)!;
    if (harbor.status === 'completed') return rest(farm, 'the next harbor order');
    if (harbor.items.some(item => item.available > 0)) return farm.island !== 'grove'
      ? task('harbor-route', 'Return to Grove harbor', 'Complete two harbor orders to open Flower Cape.', 'boat', { label: 'Visit Grove', target: 'sail', value: 'grove' }, farm.orders.harbor.completed, 2)
      : task('harbor', 'Supply the harbor', 'Complete two harbor orders, one per day, to open Flower Cape.', 'boat', { label: 'View harbor order', target: 'visit-harbor' }, farm.orders.harbor.completed, 2);
    const missing = harbor.items.find(({ item, delivered }) => delivered < item.quantity)!;
    return supply(farm, { ...missing.item, quantity: missing.item.quantity - missing.delivered }, 'the harbor order');
  }
  if (!farm.bayDiscoveries.includes('honey') && farm.honey === 0 && farm.capeLevel === 1) return capeHoney(farm, 'the first Cape honey');
  const nextBuilding = buildingIds.find(id => farm.buildingLevels[id] < 2);
  if (nextBuilding) return farm.coins < buildingDefinitions[nextBuilding].upgradePrice ? coins(farm, buildingDefinitions[nextBuilding].upgradePrice, `the ${nextBuilding} upgrade`)
    : home(farm, task(`upgrade-${nextBuilding}`, `Upgrade the ${nextBuilding}`, 'Bring all three Home buildings to level 2 to open the Market fair project.', `upgrade-${nextBuilding}-card`, { label: 'View upgrades', target: 'upgrades' }));
  const fair = getProject(farm, 'fair');
  if (!isProjectComplete(farm, 'fair')) {
    if (farm.island !== 'home') return home(farm, task('fair', 'Build the Market fair', 'Bring supplies to the Home market project.', 'ui-market', { label: 'View fair project', target: 'fair-project' }));
    if (fair.status === 'ready') return task('fair', 'Build the Market fair', 'Deliver supplies to welcome visitors and open the pastry workshop.', 'ui-market', { label: 'View fair project', target: 'fair-project' });
    const missing = fair.items.find(({ item, delivered }) => delivered < item.quantity)!;
    return supply(farm, { ...missing.item, quantity: missing.item.quantity - missing.delivered }, 'the Market fair');
  }
  if (farm.fairGuestsServed < 3) {
    const guest = getFairGuest(farm)!;
    if (guest.served) return rest(farm, 'the next fair visitor');
    if (ingredientCount(farm, guest.item) < guest.item.quantity) return supply(farm, guest.item, `${guest.name}'s visit`);
    return home(farm, task('visitors', 'Welcome fair visitors', 'Serve three visitors on different days to begin Lavender Harbour.', 'ui-market', { label: 'Meet today’s visitor', target: 'visit-guest' }, farm.fairGuestsServed, 3));
  }
  const village = getVillageProject(farm);
  if (village.items.some(item => item.available > 0) || village.items.every(({ item, delivered }) => delivered === item.quantity) && farm.coins >= village.coins) return home(farm, task('village', 'Build Lavender Harbour', 'Deliver handmade buns, sea bass and honey; then invest 80 coins in Living Bay.', 'ui-bea', { label: 'View Living Bay', target: 'village-project' }));
  const missing = village.items.find(({ item, delivered }) => delivered < item.quantity);
  return missing ? supply(farm, { ...missing.item, quantity: missing.item.quantity - missing.delivered }, 'Lavender Harbour') : coins(farm, village.coins, 'Lavender Harbour');
}
