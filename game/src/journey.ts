import {
  boatPrice,
  buildingDefinitions,
  buildingIds,
  canSailTo,
  fishDefinitions,
  getFairGuest,
  getHarborOrder,
  getProject,
  getVillageProject,
  isProjectComplete,
  workshopDefinitions,
  type FarmState,
  type IslandId,
  type StockItem,
} from './farm.ts';

export type JourneyAction = {
  label: string;
  target: 'buy-boat' | 'sail' | 'upgrades' | 'project-dock' | 'visit-harbor'
    | 'fair-project' | 'visit-guest' | 'village-project' | 'visit-rest';
  value?: IslandId;
  enabled: boolean;
};

export type JourneyRequirement = {
  id: string;
  label: string;
  icon: string;
  current: number;
  target: number;
  complete: boolean;
  available?: number;
};

export type IslandJourney = {
  id: IslandId;
  name: string;
  icon: string;
  description: string;
  current: boolean;
  unlocked: boolean;
  requirements: JourneyRequirement[];
  nextAction?: JourneyAction;
};

function requirement(id: string, label: string, icon: string, current: number, target = 1): JourneyRequirement {
  return { id, label, icon, current: Math.min(current, target), target, complete: current >= target };
}

function sailTo(destination: IslandId, label: string): JourneyAction {
  return { target: 'sail', value: destination, label, enabled: true };
}

function open(target: JourneyAction['target'], label: string): JourneyAction {
  return { target, label, enabled: true };
}

function villageSupply(item: StockItem, delivered: number, available: number): JourneyRequirement {
  const detail = item.kind === 'handmade' ? { label: workshopDefinitions[item.item].name, icon: `ui-handmade-${item.item}` }
    : item.kind === 'fish' ? { label: fishDefinitions[item.item].name, icon: 'fish' }
    : { label: 'Flower honey', icon: 'ui-honey' };
  return { ...requirement(`supply-${item.kind}`, detail.label, detail.icon, delivered, item.quantity), available };
}

/** The route's permission comes from the farm; this model explains the next reachable step. */
export function getIslandJourneys(farm: FarmState): IslandJourney[] {
  const boat = requirement('boat', 'Wooden boat', 'boat', Number(farm.boatOwned));
  const buyBoat: JourneyAction = {
    target: 'buy-boat', label: `Buy boat · ${boatPrice} coins`, enabled: farm.coins >= boatPrice,
  };
  const pier = getProject(farm, 'dock');
  const fair = getProject(farm, 'fair');
  const village = getVillageProject(farm);
  const harbor = getHarborOrder(farm);
  const pierComplete = isProjectComplete(farm, 'dock');
  const fairComplete = isProjectComplete(farm, 'fair');
  const specialization = requirement('specialization', 'Farmhouse specialization', 'upgrade-farmhouse-card', Number(farm.farmhouseSpecialization !== null));
  const pierRequirement = requirement('pier', pier.name, 'boat',
    pier.items.reduce((sum, item) => sum + item.delivered, 0),
    pier.items.reduce((sum, { item }) => sum + item.quantity, 0));

  let capeAction: JourneyAction;
  if (!farm.boatOwned) capeAction = buyBoat;
  else if (!specialization.complete) capeAction = farm.island === 'home'
    ? open('upgrades', 'Specialize the farmhouse') : sailTo('home', 'Return Home');
  else if (!pierComplete) capeAction = farm.island === 'grove'
    ? open('project-dock', 'Complete the Grove pier') : sailTo('grove', 'Visit Grove');
  else if (harbor?.status === 'completed') capeAction = farm.island === 'home'
    ? open('visit-rest', 'Rest until morning') : sailTo('home', 'Return Home');
  else capeAction = farm.island === 'grove'
    ? open('visit-harbor', 'View Grove harbor order') : sailTo('grove', 'Visit Grove');

  let villageAction: JourneyAction;
  if (!farm.boatOwned) villageAction = buyBoat;
  else if (farm.island !== 'home') villageAction = sailTo('home', 'Return Home');
  else if (!fairComplete) villageAction = buildingIds.some(id => farm.buildingLevels[id] < 2)
    ? open('upgrades', 'Upgrade buildings') : open('fair-project', 'Complete the Market fair');
  else if (!village.unlocked) villageAction = getFairGuest(farm)?.served
    ? open('visit-rest', 'Rest until morning') : open('visit-guest', 'Serve a fair visitor');
  else villageAction = open('village-project', 'View Living Bay supplies');

  const destinations: Pick<IslandJourney, 'id' | 'name' | 'icon' | 'description' | 'requirements' | 'nextAction'>[] = [
    { id: 'home', name: 'Cozy Farm', icon: 'island', description: 'Grow crops, care for hens, cook and visit the market.', requirements: farm.island === 'home' ? [] : [boat], nextAction: buyBoat },
    { id: 'grove', name: 'Saltwind Grove', icon: 'island', description: 'Catch sea bass, gather sea salt and fulfil harbor orders.', requirements: [boat], nextAction: buyBoat },
    {
      id: 'cape', name: 'Flower Cape', icon: 'ui-honey', description: 'Grow flowers, collect honey and build an apiary.',
      requirements: [boat, specialization, pierRequirement, requirement('harbor-orders', 'Grove harbor orders · one per day', 'boat', farm.orders.harbor.completed, 2)],
      nextAction: capeAction,
    },
    {
      id: 'village', name: 'Lavender Harbour', icon: 'ui-bea', description: 'Invite neighbours, shape pastries and share supper.',
      requirements: [
        boat,
        ...(!fairComplete ? buildingIds.map(id => requirement(`building-${id}`, `${buildingDefinitions[id].name} level`, `upgrade-${id}-card`, farm.buildingLevels[id], 2)) : []),
        requirement('fair', fair.name, 'ui-market', Number(fairComplete)),
        requirement('visitors', 'Fair visitors served · one per day', 'ui-market', farm.fairGuestsServed, 3),
        ...village.items.map(({ item, delivered, available }) => villageSupply(item, delivered, available)),
        requirement('village-coins', 'Living Bay building cost', 'coin', farm.village.built ? village.coins : farm.coins, village.coins),
      ],
      nextAction: villageAction,
    },
  ];
  return destinations.map(destination => {
    const current = farm.island === destination.id;
    const unlocked = canSailTo(farm, destination.id);
    return {
      ...destination, current, unlocked,
      nextAction: current ? undefined : unlocked ? sailTo(destination.id, `Set sail · ${destination.name}`) : destination.nextAction,
    };
  });
}
