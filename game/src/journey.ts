import { ruCount } from './ru.ts';
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
  villageGuestTarget,
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
    : { label: 'Цветочный мёд', icon: 'ui-honey' };
  return { ...requirement(`supply-${item.kind}`, detail.label, detail.icon, delivered, item.quantity), available };
}

/** The route's permission comes from the farm; this model explains the next reachable step. */
export function getIslandJourneys(farm: FarmState): IslandJourney[] {
  const boat = requirement('boat', 'Деревянная лодка', 'boat', Number(farm.boatOwned));
  const buyBoat: JourneyAction = {
    target: 'buy-boat', label: `Купить лодку · ${ruCount(boatPrice, 'монета', 'монеты', 'монет')}`, enabled: farm.coins >= boatPrice,
  };
  const pier = getProject(farm, 'dock');
  const fair = getProject(farm, 'fair');
  const village = getVillageProject(farm);
  const pierComplete = isProjectComplete(farm, 'dock');
  const fairComplete = isProjectComplete(farm, 'fair');
  const kitchen = requirement('building-farmhouse', 'Домашняя кухня · варенье для причала', 'upgrade-farmhouse-card', farm.buildingLevels.farmhouse, 2);
  const pierRequirement = requirement('pier', pier.name, 'boat',
    pier.items.reduce((sum, item) => sum + item.delivered, 0),
    pier.items.reduce((sum, { item }) => sum + item.quantity, 0));

  let capeAction: JourneyAction;
  if (!farm.boatOwned) capeAction = buyBoat;
  else if (!kitchen.complete) capeAction = farm.island === 'home'
    ? open('upgrades', 'Улучшить домашнюю кухню') : sailTo('home', 'Вернуться на Родной остров');
  else if (!pierComplete) capeAction = farm.island === 'grove'
    ? open('project-dock', 'Завершить причал Солёной рощи') : sailTo('grove', 'Посетить Солёную рощу');
  else capeAction = sailTo('cape', 'В путь · Цветочный мыс');

  let villageAction: JourneyAction;
  if (!farm.boatOwned) villageAction = buyBoat;
  else if (farm.island !== 'home') villageAction = sailTo('home', 'Вернуться на Родной остров');
  else if (!fairComplete) villageAction = buildingIds.some(id => farm.buildingLevels[id] < 2)
    ? open('upgrades', 'Улучшить постройки') : open('fair-project', 'Завершить сельскую ярмарку');
  else if (!village.unlocked) villageAction = getFairGuest(farm)?.served
    ? open('visit-rest', 'Отдохнуть до утра') : open('visit-guest', 'Обслужить гостя ярмарки');
  else villageAction = open('village-project', 'Открыть припасы Живой бухты');

  const destinations: Pick<IslandJourney, 'id' | 'name' | 'icon' | 'description' | 'requirements' | 'nextAction'>[] = [
    { id: 'home', name: 'Родной остров', icon: 'island', description: 'Выращивайте урожай, ухаживайте за курами, готовьте и торгуйте.', requirements: farm.island === 'home' ? [] : [boat], nextAction: buyBoat },
    { id: 'grove', name: 'Солёная роща', icon: 'island', description: 'Ловите морского окуня, собирайте соль и выполняйте заказы причала.', requirements: [boat], nextAction: buyBoat },
    {
      id: 'cape', name: 'Цветочный мыс', icon: 'ui-honey', description: 'Выращивайте цветы, собирайте мёд и стройте пасеку.',
      requirements: [boat, kitchen, pierRequirement],
      nextAction: capeAction,
    },
    {
      id: 'village', name: 'Лавандовая гавань', icon: 'ui-bea', description: 'Приглашайте соседей, лепите выпечку и ужинайте вместе.',
      requirements: [
        boat,
        ...(!fairComplete ? buildingIds.map(id => requirement(`building-${id}`, `Уровень: ${buildingDefinitions[id].name.toLowerCase()}`, `upgrade-${id}-card`, farm.buildingLevels[id], 2)) : []),
        requirement('fair', fair.name, 'ui-market', Number(fairComplete)),
        requirement('visitors', 'Первый гость ярмарки', 'ui-market', farm.fairGuestsServed, villageGuestTarget),
        ...village.items.map(({ item, delivered, available }) => villageSupply(item, delivered, available)),
        requirement('village-coins', 'Стоимость строительства Живой бухты', 'coin', farm.village.built ? village.coins : farm.coins, village.coins),
      ],
      nextAction: villageAction,
    },
  ];
  return destinations.map(destination => {
    const current = farm.island === destination.id;
    const unlocked = canSailTo(farm, destination.id);
    return {
      ...destination, current, unlocked,
      nextAction: current ? undefined : unlocked ? sailTo(destination.id, `В путь · ${destination.name}`) : destination.nextAction,
    };
  });
}
