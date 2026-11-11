import {getGrowingVariantSource,growingVariantNotice} from './growing-variant-guidance.ts';
import { getNurseryVariantSource, nurseryVariantNotice } from './nursery-variant-guidance.ts';
import { getOrdinaryHoneyWait } from './ordinary-honey-guidance.ts';
import { seaSaltRestNotice } from './salt-guidance.ts';
import { getRegularShellSource } from './regular-shell-source.ts';
import { getReadyVariantSource, readyVariantNotice } from './ready-variant-guidance.ts';
import { getLocalWarehouseSupply } from './warehouse-guidance.ts';
import { bayProductId } from './bay-product-id.ts';
import { getFishSource, rareFishClue } from './fish-guidance.ts';
import { getPackedEggSource } from './packed-egg-guidance.ts';
import { getFruitSource } from './orchard-guidance.ts';
import { ruCount } from './ru.ts';
import { getCoinGuidance, getSupplyGuidance, type DiscoveryTask } from './discovery-path.ts';
import { getIslandJourneys } from './journey.ts';
import {
  boatPrice, buildingIds, canSailTo, cropIds, dishDefinitions, eggsPerCrate,
  getFairGuest, getFishAction, getShellAt, getVillageProject, hasFarmhouseSpecialization, ingredientCount, isProjectComplete,
  type BuildingId, type FarmState, type IslandId, type StockItem,
} from './farm.ts';
import { hasShoal, getShoalFindAt } from './shoal.ts';
import { shellSpotCount } from './tide.ts';

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
  if (!farm.boatOwned) return farm.coins < boatPrice ? {...safe(getCoinGuidance(farm, boatPrice, 'деревянная лодка')),notice:`Лодка стоит ${ruCount(boatPrice,'монета','монеты','монет')}. Продайте урожай на рынке.`}
    : atHome(farm, route('focus-place', 'boat'));
  const next = getIslandJourneys(farm).find(journey => journey.id === destination)?.nextAction;
  if (next?.target === 'upgrades') return route('show-upgrade',destination==='cape'?'farmhouse':buildingIds.find(building=>farm.buildingLevels[building]<2) ?? 'farmhouse');
  if (next?.target === 'visit-rest') return atHome(farm, { ...route('focus-place', 'farmhouse'), notice: 'Следующая поставка будет завтра.' });
  return next ? { action: next } : route('open-panel', 'boat');
}

function stock(farm: FarmState, item: StockItem): RequirementHint {
  if(item.kind === 'honey' && farm.honey >= item.quantity)return safe(getSupplyGuidance(farm,item,'нужные припасы'));
  if (item.kind === 'seaSalt' && farm.seaSalt >= item.quantity) return safe(getSupplyGuidance(farm,item,'нужные припасы'));
  if (item.kind === 'beeswax' && farm.beeswax >= item.quantity) return {...route('open-panel','inventory'),notice:`Пчелиный воск уже в припасах: ${farm.beeswax}. Дополнительный сбор не нужен.`};
  if (getLocalWarehouseSupply(farm, item)) return safe(getSupplyGuidance(farm, item, 'нужные припасы'));
  if (item.kind === 'eggs') {
    const packed = getPackedEggSource(farm, item.quantity);
    if (packed) {
      const task = getSupplyGuidance(farm, item, 'нужные припасы');
      return { action: task.action, notice: task.detail, selector: `[data-action="${packed.action}"]` };
    }
  }
  const destination = item.kind === 'fruit' ? getFruitSource(farm, item.item).island : item.kind === 'fish' ? getFishSource(farm, item.item) : item.kind === 'seaSalt' || item.kind === 'shells' || item.kind === 'shoalFinds' ? 'grove'
    : item.kind === 'honey' || item.kind === 'windHoney' || item.kind === 'beeswax'
      || item.kind === 'dishes' && dishDefinitions[item.item].capeLevel ? 'cape' : undefined;
  if (destination && destination !== 'home' && !canSailTo(farm, destination)) return access(farm, destination);
  if (item.kind === 'shells' && item.item === 'regular') {
    const source=getRegularShellSource(farm);
    if (source.status === 'available') return farm.island === 'grove'
      ? {...route('focus-shell',String(source.spots[0])),notice:source.detail} : route('sail','grove');
    if (source.status === 'waiting') return atHome(farm,{...route('open-panel','rest'),notice:source.detail});
    return {...route('open-panel','boat'),notice:source.detail};
  }
  if (item.kind === 'beeswax' && farm.capeLevel < 2) return farm.island !== 'cape' ? route('sail','cape')
    : {...route('open-panel','cape-upgrade'),notice:'Пчелиный воск появляется при сборе мёда после постройки Цветочной пасеки, уровня 2. Посмотрите условия улучшения; постройку нужно выбрать отдельно.'};
  const ordinary=item.kind === 'honey'?getOrdinaryHoneyWait(farm):undefined;
  if(ordinary)return atHome(farm,{...route('open-panel','rest'),notice:ordinary.detail});
  const tomorrow = (notice: string) => atHome(farm,{...route('focus-place','farmhouse'),notice});
  if (item.kind === 'fish' && !getFishAction({...farm,island:getFishSource(farm,item.item)}).available) return rareFishClue(item.item)
    ? atHome(farm, { ...route('open-panel', 'rest'), notice: getSupplyGuidance(farm,item,'нужные припасы').detail })
    : tomorrow('Рыба вернётся в эти воды завтра.');
  if (item.kind === 'seaSalt' && farm.saltGatheredToday) return atHome(farm,{...route('open-panel','rest'),notice:seaSaltRestNotice(farm)});
  if ((item.kind === 'honey' || item.kind === 'beeswax') && farm.capeHoneyOn === farm.day) return tomorrow('Улей снова наполнится завтра.');
  if (item.kind === 'fruit') {
    const source = getFruitSource(farm, item.item);
    if (source.kind === 'grow') return tomorrow(getSupplyGuidance(farm, item, 'нужные припасы').detail);
    if (source.kind === 'space' || source.kind === 'return') {
      const task = getSupplyGuidance(farm, item, 'нужные припасы');
      return { ...safe(task), notice: task.detail, ...(source.kind === 'return' ? { selector: `[data-action="return-nursery-tree"][data-value="${source.nurseryId}"]` } : {}) };
    }
  }
  if (item.kind === 'shells' || item.kind === 'shoalFinds') {
    if (farm.island !== 'grove') return route('sail', 'grove');
    if (item.kind === 'shoalFinds' && !hasShoal(farm)) return {...stock(farm,{kind:'shells',item:farm.shellDiscoveries.includes('regular')?'moon':'regular',quantity:1}),notice:'Найдите оба вида ракушек, чтобы открыть Лунную отмель.'};
    if (item.kind === 'shoalFinds' && getShoalFindAt(farm,item.item)) return route('focus-shoal',item.item);
    const spot = Array.from({length:shellSpotCount},(_,index)=>index).find(index=>getShellAt(farm,index)===(item.kind==='shells'?item.item:'regular'));
    if (spot !== undefined) return route('focus-shell',String(spot));
    return {...route('focus-place','harbor'),notice:item.kind === 'shells' && item.item === 'moon' ? 'Светящиеся ракушки могут появиться на этом берегу при лунном приливе.' : 'Новые находки появляются каждый день, а лунный жемчуг — при лунном приливе.'};
  }
  if (item.kind === 'variants') {
    const source = getReadyVariantSource(farm,item);
    if (source) {
      if (source.island !== farm.island) return route('sail',source.island);
      const hint = source.kind === 'tree' ? route('inspect-tree',String(source.index))
        : source.kind === 'bed' ? route('focus-bed',String(source.index)) : route('open-panel','coop');
      return {...hint,notice:readyVariantNotice(item),...(source.kind==='nest'?{selector:'[data-action="collect"]'}:source.kind==='tree'?{selector:'[data-action="pick-fruit"]'}:{})};
    }
    const stored = getNurseryVariantSource(farm,item);
    if (stored) {
      if (stored.island !== farm.island) return route('sail',stored.island);
      return {...route('orchard',String(stored.nurseryId)),notice:nurseryVariantNotice(item),
        selector:`[data-action="return-nursery-tree"][data-value="${stored.nurseryId}"]`};
    }
    const growing = getGrowingVariantSource(farm,item);
    if (growing) {
      const hint = growing.watered ? route('focus-place','farmhouse')
        : farm.water > 0 ? route('focus-bed',String(growing.index)) : route('focus-place','well');
      return atHome(farm,{...hint,notice:growingVariantNotice(item,growing)});
    }
    const base: StockItem = item.item === 'egg' ? {kind:'eggs',quantity:item.quantity}
      : item.item === 'apple' || item.item === 'pear' || item.item === 'peach' ? {kind:'fruit',item:item.item,quantity:item.quantity}
      : {kind:'produce',item:item.item,quantity:item.quantity};
    // The ordinary fallback only locates a place to grow or collect the resource.
    // Ordinary warehouse goods and egg packages cannot supply the requested trait.
    // Keep this projection read-only; exact warehouse stock was checked above.
    const sourceFarm = {
      ...farm,
      ...(base.kind === 'eggs' ? { eggBaskets: 0, eggCrates: 0 } : {}),
      freight: { ...farm.freight, warehouses: { ...farm.freight.warehouses,
        [farm.island]: { ...farm.freight.warehouses[farm.island], [bayProductId(base)]: 0 },
      } },
    };
    const hint = stock(sourceFarm, base);
    return {...hint, notice: `Редкие разновидности появляются при подходящей погоде.`};
  }
  if (item.kind === 'dishes') {
    const recipe = dishDefinitions[item.item];
    if (recipe.capeLevel && farm.capeLevel < recipe.capeLevel) return farm.island !== 'cape' ? route('sail','cape') : route('open-panel','cape-upgrade');
    if (!recipe.capeLevel && (farm.buildingLevels.farmhouse < recipe.requiredLevel || recipe.specialization && !hasFarmhouseSpecialization(farm, recipe.specialization))) return atHome(farm,route('show-upgrade','farmhouse'));
    const missing = recipe.ingredients.find(ingredient=>ingredientCount(farm,ingredient)<ingredient.quantity);
    if (missing) return stock(farm,missing);
    return recipe.capeLevel ? farm.island==='cape'?route('open-panel','honey-kitchen'):route('sail','cape') : atHome(farm,route('kitchen'));
  }
  if (item.kind === 'eggCrates') {
    if (farm.coopSpecialization !== 'packing') return atHome(farm, route('show-upgrade','coop'));
    if (farm.eggs >= eggsPerCrate) return atHome(farm, route('visit-coop'));
    return safe(getSupplyGuidance(farm,{kind:'eggs',quantity:eggsPerCrate},'ящик яиц'));
  }
  if (item.kind === 'eggBaskets' && farm.buildingLevels.coop < 2) return atHome(farm, route('show-upgrade','coop'));
  if (item.kind === 'handmade' && !isProjectComplete(farm,'fair') && !farm.village.built) return getRequirementHint(farm,{kind:'journey',island:'village',id:'fair'});
  if (item.kind === 'windHoney') {
    const task=getSupplyGuidance(farm,item,'нужные припасы');
    return {...safe(task),...(task.action.target === 'open-panel' ? {} : {notice:task.detail})};
  }
  if (item.kind === 'fish' && rareFishClue(item.item)) return { ...safe(getSupplyGuidance(farm,item,'нужные припасы')), notice: rareFishClue(item.item) };
  const task=getSupplyGuidance(farm,item,'нужные припасы');
  return {...safe(task),...(item.kind==='produce'&&task.id.endsWith('-crop-space')?{notice:task.detail}:{})};
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
  if (id === 'village-coins') return farm.coins >= getVillageProject(farm).coins ? atHome(farm,route('village-project')) : safe(getCoinGuidance(farm,getVillageProject(farm).coins,'Лавандовая гавань'));
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
      ? {...route('focus-place','farmhouse'),notice:'Следующий гость ярмарки придёт завтра.'} : route('visit-guest'));
  }
  if (id === 'pier' && farm.boatOwned) return farm.island === 'grove' ? route('project-dock') : route('sail','grove');
  return access(farm,requirement.island);
}
