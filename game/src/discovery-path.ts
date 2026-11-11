import { getOrdinaryHoneyWait } from './ordinary-honey-guidance.ts';
import { seaSaltRestNotice } from './salt-guidance.ts';
import { getWindHoneySource } from './wind-honey-guidance.ts';
import { getNextCropBed, getNextHarvestBed } from './crop-guidance.ts';
import { getLocalWarehouseSupply, warehouseRequestValue } from './warehouse-guidance.ts';
import { getReadySignatureSuppers } from './shared-supper.ts';
import { getFishSource, rareFishClue } from './fish-guidance.ts';
import { getPackedEggSource } from './packed-egg-guidance.ts';
import { getFruitSource, nurseryFruitDetail } from './orchard-guidance.ts';
import { freightStock } from './bay-freight-model.ts';
import { bayShopDailyLimit } from './bay-shop-model.ts';
import {
  boatPrice, buildingDefinitions, buildingIds, cropDefinitions, cropIds, dishDefinitions, eggsPerBasket, feedBagPrice,
  getBedAction, getBedStage, getCapeHoney, getCookAction, getFairGuest, getFishAction, getGoal, getHarborOrder,
  foodDescriptors, getFestivalStatus, getMarketOrders, getProject, getSale, getVillageMeal, getVillageProject, getResidentService, ingredientCount, isProjectComplete,
  treeDefinitions, villageGuestTarget, workshopDefinitions, workshopShapes, type CropId, type DishId, type FarmState, type StockItem,
} from './farm.ts';
import {ruCount} from './ru.ts';

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
  return farm.island === 'home' ? next : { ...next, detail: `Вернитесь домой. ${next.detail}`, action: { label: 'Домой', target: 'sail', value: 'home' } };
}

function bedTask(farm: FarmState, index: number, purpose: string): DiscoveryTask {
  const action = getBedAction(farm, index);
  const bed = farm.beds[index];
  if (action.kind === 'water' && !action.available) return task(`${purpose}-refill`, 'Наполните лейку', 'В колодце есть вода для полива.', 'tool-can', { label: 'К колодцу', target: 'refill' });
  if (action.kind === 'plant' && !action.available) return task(`${purpose}-seeds`, 'Выберите семена', 'Выберите семена из запасов или купите пакет на рынке.', 'tool-seeds', { label: 'Выбрать семена', target: 'open-panel', value: 'seeds' });
  return task(`${purpose}-bed`, action.label, bed.kind === 'crop' ? `${cropDefinitions[bed.crop].name} · ${purpose}` : purpose,
    bed.kind === 'crop' ? bed.crop : 'tool-hoe', { label: action.label, target: 'focus-bed', value: String(index) });
}

function rest(farm: FarmState, purpose: string, teachFeed = false): DiscoveryTask {
  if (teachFeed && farm.progress.feed === 0 && !farm.chickensFed) return feed(farm, purpose);
  return home(farm, task(`${purpose}-rest`, 'Дождитесь нового утра', 'Отдохните дома. Ночью политые растения растут, а сытые курочки несут яйца.', 'sun', { label: 'До утра', target: 'visit-rest' }));
}

function feed(farm: FarmState, purpose: string): DiscoveryTask {
  if (farm.feed === 0 && farm.coins < feedBagPrice) return coins(farm, feedBagPrice, 'корм для кур');
  return home(farm, farm.feed > 0
    ? task(`${purpose}-feed`, 'Покормите курочек до отдыха', 'Утром сытые курочки снесут свежие яйца.', 'egg', { label: 'К курятнику', target: 'visit-coop' })
    : task(`${purpose}-feed`, 'Запасите корм для курочек', 'Купите корм на рынке и покормите курочек перед отдыхом.', 'egg', { label: 'Купить корм', target: 'visit-market', value: 'buy' }));
}

function capeHoney(farm: FarmState, purpose: string): DiscoveryTask {
  const ordinary=getOrdinaryHoneyWait(farm);
  if(ordinary)return home(farm,task('cape-ordinary-honey-rest','Цветочный мёд после отдыха',ordinary.detail,'ui-honey',{label:'К отдыху дома',target:'visit-rest'}));
  if (farm.capeHoneyOn === farm.day) return rest(farm, purpose);
  if (getCapeHoney({ ...farm, island: 'cape' }).available) return task('cape-honey', 'Соберите мёд мыса', 'На мысе уже есть цветущая клумба. Соберите доступный мёд в улье.', 'ui-honey', farm.island === 'cape'
    ? { label: 'К улью', target: 'visit-hive' } : { label: 'На Цветочный мыс', target: 'sail', value: 'cape' });
  const empty = farm.capeFlowers.findIndex(day => day === null);
  if (empty >= 0) return task('cape-flowers', 'Засейте клумбы мыса', 'Засейте три клумбы рядом с ульем. Местные семена бесплатны; цветы распустятся после ночи.', 'ui-honey',
    farm.island === 'cape' ? { label: 'К свободной клумбе', target: 'focus-flower', value: String(empty) }
      : { label: 'На Цветочный мыс', target: 'sail', value: 'cape' }, farm.capeFlowers.length - farm.capeFlowers.filter(day => day === null).length, farm.capeFlowers.length);
  return rest(farm, purpose);
}

function cropSource(farm: FarmState, crop: CropId, purpose: string): DiscoveryTask {
  if (farm.island !== 'home') return home(farm, task(`${purpose}-${crop}`, `Урожай: ${cropDefinitions[crop].name.toLowerCase()}`, `Вырастите урожай: ${cropDefinitions[crop].name.toLowerCase()}. Цель: ${purpose}.`, crop, { label: 'Домой', target: 'sail', value: 'home' }));
  const next = getNextCropBed(farm,crop);
  if (next !== undefined) {
    const bed=farm.beds[next];
    if (getBedStage(bed)==='ripe' || bed.kind==='crop'&&!bed.watered) return bedTask(farm,next,purpose);
    return {...rest(farm,purpose),detail:`Ближайшая посадка (${cropDefinitions[crop].name.toLowerCase()}) уже полита и подрастёт этой ночью. Цель: ${purpose}.`};
  }
  const empty = farm.beds.findIndex(bed => bed.kind === 'empty');
  const tilled = farm.beds.findIndex(bed => bed.kind === 'tilled');
  if (tilled >= 0 && farm.selectedSeed === crop && farm.seeds[crop] > 0) return bedTask(farm, tilled, purpose);
  if (farm.seeds[crop] === 0) return farm.coins < cropDefinitions[crop].seedPrice ? coins(farm, cropDefinitions[crop].seedPrice, `семена: ${cropDefinitions[crop].name.toLowerCase()}`)
    : task(`${purpose}-${crop}`, `Купите семена: ${cropDefinitions[crop].name.toLowerCase()}`, `Купите семена, чтобы получить нужный урожай. Цель: ${purpose}.`, crop, { label: 'На рынок', target: 'visit-market', value: 'buy' });
  if (tilled >= 0) return task(`${purpose}-${crop}`, `Выберите семена: ${cropDefinitions[crop].name.toLowerCase()}`, `Выберите семена: ${cropDefinitions[crop].name.toLowerCase()}, затем засейте подготовленную грядку.`, crop, { label: 'Выбрать семена', target: 'open-panel', value: 'seeds' });
  if (empty >= 0) return bedTask(farm, empty, purpose);
  const space = getNextHarvestBed(farm);
  const bed = space === undefined ? undefined : farm.beds[space];
  if (space !== undefined && bed?.kind === 'crop') {
    const name=cropDefinitions[bed.crop].name.toLowerCase(), nights=Math.max(0,cropDefinitions[bed.crop].days-bed.growth);
    const care=nights===0 ? `Урожай уже готов: ${name}. Соберите его отдельным действием.`
      : `Грядка ${space+1} (${name}): ${bed.watered?'уже полита':'сначала нужен полив'}. До зрелости: ${ruCount(nights,'ночь','ночи','ночей')} при политой грядке перед каждой ночью роста. Затем отдельно соберите урожай.`;
    const next=nights===0||!bed.watered?bedTask(farm,space,purpose):rest(farm,purpose);
    return {...next,id:`${purpose}-${crop}-crop-space`,detail:`Все грядки заняты. ${care} После сбора появится место для посева: ${cropDefinitions[crop].name.toLowerCase()}. Нужная культура пока не посеяна.`};
  }
  return rest(farm,purpose);
}

function supply(farm: FarmState, item: StockItem, purpose: string): DiscoveryTask {
  const id = `${purpose}-${item.kind}`;
  const stored = getLocalWarehouseSupply(farm, item);
  if (stored) return task(id, 'Припасы уже на местном складе', `Заберите недостающее: ${stored.quantity}. Перенос нужно подтвердить отдельно. Цель: ${purpose}.`, 'ui-bag', { label: 'Посмотреть запас', target: 'warehouse-supply', value: warehouseRequestValue(item) });
  if(item.kind === 'honey' && farm.honey >= item.quantity)return task(id,'Цветочный мёд уже в припасах',`В припасах: ${farm.honey}. Дополнительный сбор не нужен.`,'ui-honey',{label:'Открыть запасы',target:'open-panel',value:'inventory'});
  if (item.kind === 'produce') return cropSource(farm, item.item, purpose);
  if (item.kind === 'fruit') {
    const source = getFruitSource(farm, item.item), { island, slot } = source;
    if (source.kind === 'grow' && (island === 'home' || farm.boatOwned)) return home(farm, task(id, 'Дождитесь плодов в саду', `До плодов: ${ruCount(source.nights!, 'ночь', 'ночи', 'ночей')}. Дерево растёт во время отдыха дома. Цель: ${purpose}.`, `ui-tree-${item.item}`, { label: 'К отдыху дома', target: 'visit-rest' }));
    if (farm.island !== island) return task(id, `Соберите плоды: ${treeDefinitions[item.item].name.toLowerCase()}`, `Загляните в сад: ${island === 'home' ? 'Родной остров' : 'Солёная роща'}. Цель: ${purpose}.`, `ui-tree-${item.item}`, { label: island === 'home' ? 'Домой' : 'В рощу', target: 'sail', value: island });
    if (source.kind === 'pick') return task(id, `Соберите плоды: ${treeDefinitions[item.item].name.toLowerCase()}`, `Отложите плоды: ${item.quantity}. Цель: ${purpose}.`, `ui-tree-${item.item}`, { label: 'К плодовому дереву', target: 'visit-tree', value: String(slot) });
    if (source.kind === 'space') return task(id, 'Освободите место в саду', 'Перенесите любое дерево в питомник: возраст и плоды сохранятся. Затем верните нужное дерево из питомника или посадите саженец на свободное место.', `ui-tree-${item.item}`, { label: 'Открыть сад', target: 'orchard' });
    if (source.kind === 'return') {
      const tree = farm.treeNursery.find(entry => entry.id === source.nurseryId)!.tree;
      return task(id, `Верните дерево: ${treeDefinitions[item.item].name.toLowerCase()}`, `Верните выделенное дерево из питомника бесплатно. ${nurseryFruitDetail(tree)} В питомнике рост на паузе.`, `ui-tree-${item.item}`, { label: 'К дереву в питомнике', target: 'orchard', value: String(source.nurseryId) });
    }
    if (!farm.saplings[item.item] && farm.coins < treeDefinitions[item.item].saplingPrice) return coins(farm, treeDefinitions[item.item].saplingPrice, `саженец: ${treeDefinitions[item.item].name.toLowerCase()}`);
    return task(id, `Посадите дерево: ${treeDefinitions[item.item].name.toLowerCase()}`, `Садовое дерево даст нужные плоды. Цель: ${purpose}.`, `ui-tree-${item.item}`, { label: 'Выбрать саженец', target: 'visit-tree', value: String(slot) });
  }
  if (item.kind === 'eggs' || item.kind === 'eggBaskets') {
    const packed = item.kind === 'eggs' && getPackedEggSource(farm, item.quantity);
    if (packed) return home(farm, task(`${id}-unpack-${packed.kind}`, packed.kind === 'basket' ? 'Распакуйте корзину яиц' : 'Распакуйте ящик яиц',
      `В запасе уже есть ${packed.kind === 'basket' ? 'корзина' : 'ящик'}: ${ruCount(packed.eggs, 'яйцо', 'яйца', 'яиц')}. Распакуйте бесплатно в курятнике. Цель: ${purpose}.`,
      'egg', { label: 'К готовым яйцам', target: 'open-panel', value: 'coop' }));
    if (farm.island !== 'home') return home(farm, task(id, 'Соберите яйца в курятнике', `Запасите яйца. Цель: ${purpose}.`, 'egg', { label: 'К курятнику', target: 'visit-coop' }));
    if (item.kind === 'eggBaskets' && farm.eggs >= eggsPerBasket) return task(id, 'Упакуйте корзину яиц', `В улучшенном курятнике можно упаковать ${eggsPerBasket} яиц в корзину. Цель: ${purpose}.`, 'egg', { label: 'К курятнику', target: 'visit-coop' });
    if (farm.eggsReady > 0) return task(id, 'Соберите свежие яйца', `Отложите яйца. Цель: ${purpose}.`, 'egg', { label: 'К курятнику', target: 'visit-coop' });
    return farm.chickensFed ? rest(farm, purpose) : feed(farm, purpose);
  }
  if (item.kind === 'dishes') return recipe(farm, item.item, purpose);
  if (item.kind === 'fish' || item.kind === 'seaSalt') {
    if (item.kind === 'seaSalt' && farm.seaSalt >= item.quantity) return task(id, 'Морская соль уже в припасах', `В припасах: ${farm.seaSalt}. Цель: ${purpose}. Дополнительный сбор не нужен.`, 'ui-sea-salt', {label:'Открыть запасы',target:'open-panel',value:'inventory'});
    if (item.kind === 'seaSalt' && farm.saltGatheredToday) return home(farm, task(id, 'Морская соль после отдыха', seaSaltRestNotice(farm), 'ui-sea-salt', {label:'К отдыху дома',target:'visit-rest'}));
    const destination = item.kind === 'fish' ? getFishSource(farm, item.item) : 'grove';
    const clue = item.kind === 'fish' && rareFishClue(item.item);
    if (item.kind === 'fish' && !getFishAction({ ...farm, island: destination }).available) return clue
      ? home(farm, task(id, 'Рыбалка после отдыха', `Дневной улов на доступных берегах уже собран. Новый день начнётся после отдыха дома. ${clue}`, 'sun', { label: 'К отдыху дома', target: 'visit-rest' }))
      : rest(farm, purpose);
    if (farm.island !== destination) return task(id, 'Отправьтесь к воде', `${clue || `Запасите ${item.kind === 'seaSalt' ? 'морскую соль' : 'рыбу'}.`} Цель: ${purpose}.`, 'boat', { label: destination === 'grove' ? 'В рощу' : 'Домой', target: 'sail', value: destination });
    if (clue) return task(id, 'Ищите рыбу на глубине', `${clue} Цель: ${purpose}.`, 'boat', { label: 'К рыбалке', target: 'open-panel', value: 'fishing' });
    if (item.kind === 'seaSalt') return task(id, 'Соберите морскую соль', `Соберите соль на солончаках рощи. Цель: ${purpose}.`, 'ui-sea-salt', { label: 'К солончакам', target: 'gather-salt' });
    return getFishAction(farm).available ? task(id, 'Поймайте рыбу', `Отложите нужную рыбу. Цель: ${purpose}.`, 'fish', { label: 'К рыбацкому причалу', target: 'visit-pier' }) : rest(farm, purpose);
  }
  if (item.kind === 'handmade') {
    const missing = [{ kind: 'produce', item: 'wheat', quantity: 2 }, { kind: 'eggs', quantity: 1 }] as const;
    const ingredient = missing.find(value => ingredientCount(farm, value) < value.quantity);
    const next = task(id, 'Испеките булочку вручную', `Слепите изделие «${workshopDefinitions[item.item].name}» в кондитерской. Цель: ${purpose}.`, `ui-handmade-${item.item}`, { label: 'В кондитерскую', target: 'workshop', value: item.item });
    return ingredient ? supply(farm, ingredient, 'ручная выпечка') : farm.island === 'village' ? next : home(farm, next);
  }
  if (item.kind === 'windHoney') {
    const source = getWindHoneySource(farm);
    const action: DiscoveryTask['action'] = source.kind === 'locked' ? {label:'Путь на мыс',target:'open-panel',value:'boat'}
      : farm.island !== 'cape' ? {label:'На Цветочный мыс',target:'sail',value:'cape'}
      : source.kind === 'plant' ? {label:'К свободной клумбе',target:'focus-flower',value:String(source.index)}
      : {label:source.kind === 'ready' ? 'К редкому мёду' : 'Посмотреть прогноз',target:'open-panel',value:'hive'};
    return task(id, source.kind === 'ready' ? 'Соберите мёд ветров' : 'Мёд ветров: следующий сбор', source.detail, 'ui-wind-honey', action);
  }
  return capeHoney(farm, purpose);
}

function recipe(farm: FarmState, dish: DishId, purpose: string): DiscoveryTask {
  const definition = dishDefinitions[dish];
  if (farm.island !== 'home') return home(farm, task(`${purpose}-kitchen`, `Приготовьте: ${definition.name.toLowerCase()}`, `Приготовьте блюдо «${definition.name}». Цель: ${purpose}.`, 'upgrade-farmhouse-card', { label: 'На кухню', target: 'kitchen' }));
  if (farm.buildingLevels.farmhouse < definition.requiredLevel) return task(`${purpose}-upgrade`, 'Улучшите домашнюю кухню', `Для блюда «${definition.name}» нужна улучшенная кухня.`, 'upgrade-farmhouse-card', { label: 'Улучшения', target: 'upgrades' });
  const missing = definition.ingredients.find(item => ingredientCount(farm, item) < item.quantity);
  return missing ? supply(farm, missing, definition.name.toLowerCase())
    : task(`${purpose}-cook`, `Приготовьте: ${definition.name.toLowerCase()}`, `${definition.ingredientLabel}. Приготовьте на домашней кухне.`, 'upgrade-farmhouse-card', { label: 'На кухню', target: 'kitchen' });
}

function coins(farm: FarmState, amount: number, purpose: string): DiscoveryTask {
  const readyOrder = getMarketOrders(farm).find(order => order.status === 'ready');
  if (readyOrder) return home(farm, task(`${purpose}-coins`, 'Выполните заказ рынка', `Заказ «${readyOrder.name}» принесёт ${ruCount(readyOrder.reward, 'монету', 'монеты', 'монет')}. Цель: ${purpose}.`, 'coin', { label: 'На рынок', target: 'visit-market', value: 'orders' }, farm.coins, amount));
  if (getSale(farm).items > 0) return home(farm, task(`${purpose}-coins`, `Накопите монеты`, `Продайте лишний урожай на рынке. Нужно монет: ${amount}. Цель: ${purpose}.`, 'coin', { label: 'На рынок', target: 'visit-market', value: 'sell' }, farm.coins, amount));
  const ripe = farm.beds.findIndex(bed => getBedStage(bed) === 'ripe');
  if (ripe >= 0) return home(farm, bedTask(farm, ripe, `продажа · ${purpose}`));
  if (farm.eggsReady > 0) return home(farm, task(`${purpose}-eggs`, 'Соберите готовые яйца для рынка',
    `В курятнике уже ${ruCount(farm.eggsReady,'яйцо','яйца','яиц')}. Соберите их и продайте на рынке. Цель: ${purpose}.`, 'egg', {label:'К курятнику',target:'visit-coop'}));
  const orchards = farm.boatOwned ? farm.island === 'grove' ? ['grove','home'] as const : ['home','grove'] as const : ['home'] as const;
  for (const island of orchards) {
    const ready = farm.trees[island].find(tree => tree !== null && tree.fruitReady > 0);
    if (ready) return supply(farm, {kind:'fruit',item:ready.tree,quantity:ready.fruitReady}, `продажа · ${purpose}`);
  }
  const stored = farm.treeNursery.find(entry => entry.tree.fruitReady > 0);
  if (stored) return supply(farm, {kind:'fruit',item:stored.tree.tree,quantity:stored.tree.fruitReady}, `продажа · ${purpose}`);
  const growing = farm.beds.find(bed => bed.kind === 'crop');
  if (growing?.kind === 'crop') return cropSource(farm, growing.crop, `продажа · ${purpose}`);
  const owned = cropIds.find(crop => farm.seeds[crop] > 0);
  if (owned) return cropSource(farm, owned, `продажа · ${purpose}`);
  const fruit = farm.trees.home.find(tree => tree !== null);
  if (fruit) return supply(farm, { kind: 'fruit', item: fruit.tree, quantity: 1 }, `продажа · ${purpose}`);
  if (!getFishAction({ ...farm, island: 'home' }).available) return rest(farm, purpose);
  return home(farm, task('earn-by-fishing', 'Наловите рыбы для рынка', `Продайте улов. Цель: ${purpose}.`, 'fish', {label:'К рыбацкому причалу',target:'visit-pier'}));
}

function starter(farm: FarmState): DiscoveryTask | undefined {
  const goal = getGoal(farm);
  if (!goal) return undefined;
  if (farm.island !== 'home') return home(farm, task(goal.id, goal.label, goal.detail, 'island', { label: 'Домой', target: 'sail', value: 'home' }, goal.progress, goal.target));
  let next: DiscoveryTask;
  if (goal.id === 'rest') return farm.progress.feed === 0 && !farm.chickensFed ? feed(farm, 'first-morning')
    : { ...goal, icon: 'sun', action: { label: 'До утра', target: 'visit-rest' } };
  if (goal.id === 'feed') return feed(farm, 'первые шаги');
  if (goal.id === 'collect') return supply(farm, { kind: 'eggs', quantity: 1 }, 'первые шаги');
  if (goal.id === 'sell') return getSale(farm).items > 0 ? { ...goal, icon: 'coin', action: { label: 'На рынок', target: 'visit-market', value: 'sell' } }
    : cropSource(farm, 'carrot', 'первая продажа');
  const index = farm.beds.findIndex((_, i) => getBedAction(farm, i).kind === goal.id);
  if (index >= 0) next = bedTask(farm, index, goal.label.toLowerCase());
  else if (goal.id === 'harvest') {
    const thirsty = farm.beds.findIndex(bed => bed.kind === 'crop' && !bed.watered);
    return thirsty >= 0 ? bedTask(farm, thirsty, 'первый урожай') : rest(farm, 'first-harvest', true);
  } else if (goal.id === 'plant') {
    const empty = farm.beds.findIndex(bed => bed.kind === 'empty');
    return empty >= 0 ? bedTask(farm, empty, 'посев') : rest(farm, 'sowing-seeds', true);
  } else if (goal.id === 'till') {
    const ripe = farm.beds.findIndex(bed => getBedStage(bed) === 'ripe');
    if (ripe >= 0) return bedTask(farm, ripe, 'подготовка свободной грядки');
    const thirsty = farm.beds.findIndex(bed => bed.kind === 'crop' && !bed.watered);
    return thirsty >= 0 ? bedTask(farm, thirsty, 'урожай и свободная грядка') : rest(farm, goal.id, true);
  } else return rest(farm, goal.id, true);
  return { ...next, id: goal.id, label: goal.label, detail: next.action.target === 'focus-bed' ? goal.detail : next.detail, progress: goal.progress, target: goal.target, reward: goal.reward };
}

/** One optional next discovery, derived only from real progress and reachable supplies. */
export function getDiscoveryTask(farm: FarmState, seen: DiscoverySeen): DiscoveryTask | undefined {
  if (farm.village.built) {
    const arrive = (next: DiscoveryTask): DiscoveryTask => farm.island === 'village' ? next : {
      ...next, action: { label: 'В Лавандовую гавань', target: 'sail', value: 'village' },
    };
    if (farm.festivals.active) {
      const festival=getFestivalStatus(farm).active!;
      const label=festival.waitingNight ? `${festival.name} · день ${festival.readyOn}`
        : festival.stage===3 ? `Провести: ${festival.name}` : festival.label;
      return task('festival-preparation',label,festival.editionName,`festivals/${festival.tradition}`,
        {label:'К программе праздника',target:'open-panel',value:'festival'},festival.stage,3);
    }
    if (!farm.village.residents.some(Boolean)) return arrive(task('first-neighbour', 'Встретьте первого соседа', 'Пригласите соседа в домик у гавани.', 'ui-bea', { label: 'К первому домику', target: 'visit-cottage', value: '0' }));
    if (farm.village.meals < 2) {
      const shape = workshopShapes.find(shape => farm.handmade[shape] > 0) ?? farm.workshopPatterns[0] ?? 'round';
      const meal = getVillageMeal(farm, shape);
      if (meal.served) return rest(farm, 'следующий общий ужин');
      const signature = getReadySignatureSuppers(farm)[0];
      const missing = meal.items.find(item => (item.kind !== 'handmade' || !signature) && ingredientCount(farm, item) < item.quantity);
      if (missing) return supply(farm, missing, 'общий ужин');
      if (signature && !farm.handmade[shape]) return arrive(task('shared-suppers', 'Принесите готовое блюдо к общему столу',
        `Авторское блюдо уже есть. Выберите у стола 1 порцию и подайте с 1 рыбой. Два ужина в разные дни откроют второй домик.`,
        'ui-signature-bright', { label: 'Выбрать блюдо к ужину', target: 'village-meal' }, farm.village.meals, 2));
      return arrive(task('shared-suppers', 'Поужинайте вместе у воды', 'Два общих ужина в разные дни откроют второй домик.', 'ui-handmade-round', { label: 'Накрыть стол', target: 'village-meal', value: shape }, farm.village.meals, 2));
    }
    const empty = farm.village.residents.findIndex(resident => resident === null);
    if (empty >= 0) return arrive(task('second-neighbour', 'Встретьте ещё одного соседа', 'Второй домик готов к заселению.', 'ui-finn', { label: 'К свободному домику', target: 'visit-cottage', value: String(empty) }));
    const shopFood = farm.bayShop.sold === 0 && foodDescriptors(farm).find(food => food.count > 0
      || freightStock(farm.freight, 'village', food.id) > 0
      || farm.bayShop.slots.some(slot => slot?.product.id === food.id && slot.quantity > 0));
    if (shopFood && farm.bayShop.visitsToday < bayShopDailyLimit(Number(farm.concertDay === farm.day), farm.bayShop.festivalVisitors)) {
      return arrive(task('first-shop', 'Предложите готовое угощение в лавке', `«${shopFood.name}» уже готово. Выставьте его на прилавок и откройте лавку.`, 'bay/pavilion',
        { label: 'В свою лавку', target: 'open-panel', value: 'bay-shop' }));
    }
    if(farm.culinary.recipes.length===0)return arrive(task('own-recipe','Создайте своё угощение','Выберите фрукты, приготовьте угощение вручную и предложите соседям.','ui-signature-bright',{label:'Мои рецепты',target:'open-panel',value:'recipes'}));
    const untasted=farm.village.residents.find(id=>id&&farm.culinary.tastings[id].visits===0);
    if(untasted&&Object.values(farm.culinary.stock).some(count=>count>0))return arrive(task('first-tasting','Угостите соседей по своему рецепту','Соседи запоминают любимые фрукты и способы приготовления.','ui-'+untasted,{label:'Угостить',target:'open-panel',value:'recipes'}));
    if (!Object.values(farm.festivals.completed).some(Boolean)) return task('first-festival','Выберите праздник гавани','Выберите, что построить вместе с соседями.', 'festivals/lights', {label:'К традициям',target:'open-panel',value:'festival'});
    const service=farm.village.residents.findIndex(id=>id&&getResidentService(farm,id).available);
    if(service>=0){const id=farm.village.residents[service]!;return arrive(task('neighbour-service',id==='bea'?'Испеките вместе с Беа':'Попросите Финна разведать маршрут',id==='bea'?'Принесите продукты, и Беа испечёт целую партию.':'Финн подготовит более вместительную и крепкую снасть к следующей рыбалке.','ui-'+id,{label:'В гости: '+(id==='bea'?'Беа':'Финн'),target:'visit-cottage',value:String(service)}));}
    return undefined;
  }
  const established = farm.farmhouseSpecialization !== null || farm.orders.harbor.completed > 0 || isProjectComplete(farm, 'dock') || isProjectComplete(farm, 'fair');
  const pastStarter = established || farm.boatOwned || buildingIds.some(id => farm.buildingLevels[id] > 1);
  if (!seen.collections && farm.progress.harvest > 0 && !established) return task('collections', 'Посмотрите первые находки', 'В коллекциях записаны собранный урожай и его необычные разновидности.', 'tool-crate', { label: 'Открыть коллекции', target: 'open-panel', value: 'archive' });
  if (!pastStarter) { const first = starter(farm); if (first) return first; }
  if (!seen.islands) return task('islands', 'Откройте бухту', 'Карта показывает острова и ближайший шаг к открытию каждого маршрута.', 'island', { label: 'К островам', target: 'open-panel', value: 'boat' });
  const cooked = farm.bayDiscoveries.some(id => id in dishDefinitions) || Object.values(farm.dishes).some(count => count > 0);
  if (!cooked && !established) return getCookAction(farm, 'orchardTart').available
    ? task('first-cooking', 'Испеките первый садовый тарт', 'На домашней кухне нужны 2 яблока, 1 пшеница и 1 яйцо.', 'ui-tree-apple', { label: 'На кухню', target: 'kitchen' })
    : recipe(farm, 'orchardTart', 'первое блюдо');
  if (!farm.boatOwned) return farm.coins < boatPrice ? coins(farm, boatPrice, 'деревянная лодка')
    : task('boat', 'Спустите лодку на воду', 'Лодка открывает Солёную рощу с садом, солончаками и гаванью.', 'boat', { label: 'К причалу', target: 'visit-boat' });
  if (!established && !farm.bayDiscoveries.includes('pear') && farm.fruit.pear === 0) return supply(farm, { kind: 'fruit', item: 'pear', quantity: 1 }, 'знакомство с Солёной рощей');
  if (farm.buildingLevels.farmhouse < 2) return farm.coins < buildingDefinitions.farmhouse.upgradePrice ? coins(farm, buildingDefinitions.farmhouse.upgradePrice, 'домашняя кухня')
    : home(farm, task('farmhouse-upgrade', 'Улучшите дом', 'Большая кухня открывает новые блюда и выбор специализации.', 'upgrade-farmhouse-card', { label: 'Улучшения', target: 'upgrades' }));
  const dock = getProject(farm, 'dock');
  if (!isProjectComplete(farm, 'dock')) {
    if (dock.items.some(item => item.available > 0)) return farm.island !== 'grove'
      ? task('grove', 'Посетите Солёную рощу', 'Привезите припасы к причалу рощи.', 'boat', { label: 'В рощу', target: 'sail', value: 'grove' })
      : task('dock', 'Постройте причал рощи', 'Доставьте припасы, чтобы открыть путь к цветам и мёду. Специализация кухни позже добавит заказы гавани.', 'boat', { label: 'Припасы для причала', target: 'project-dock' });
    const missing = dock.items.find(({ item, delivered }) => delivered < item.quantity)!;
    return supply(farm, { ...missing.item, quantity: missing.item.quantity - missing.delivered }, 'причал рощи');
  }
  if (!farm.bayDiscoveries.includes('honey') && farm.honey === 0 && farm.capeLevel === 1) return capeHoney(farm, 'первый мёд мыса');
  const nextBuilding = buildingIds.find(id => farm.buildingLevels[id] < 2);
  if (nextBuilding) return farm.coins < buildingDefinitions[nextBuilding].upgradePrice ? coins(farm, buildingDefinitions[nextBuilding].upgradePrice, `улучшение: ${buildingDefinitions[nextBuilding].name.toLowerCase()}`)
    : home(farm, task(`upgrade-${nextBuilding}`, `Улучшите: ${buildingDefinitions[nextBuilding].name.toLowerCase()}`, 'Улучшите три домашние постройки до 2 уровня, чтобы открыть проект ярмарки.', `upgrade-${nextBuilding}-card`, { label: 'Улучшения', target: 'upgrades' }));
  const fair = getProject(farm, 'fair');
  if (!isProjectComplete(farm, 'fair')) {
    if (farm.island !== 'home') return home(farm, task('fair', 'Постройте ярмарку', 'Привезите припасы на домашний рынок.', 'ui-market', { label: 'Проект ярмарки', target: 'fair-project' }));
    if (fair.status === 'ready') return task('fair', 'Постройте ярмарку', 'Доставьте припасы, чтобы встречать гостей и открыть кондитерскую.', 'ui-market', { label: 'Проект ярмарки', target: 'fair-project' });
    const missing = fair.items.find(({ item, delivered }) => delivered < item.quantity)!;
    return supply(farm, { ...missing.item, quantity: missing.item.quantity - missing.delivered }, 'ярмарка');
  }
  if (farm.fairGuestsServed < villageGuestTarget) {
    const guest = getFairGuest(farm)!;
    if (guest.served) return rest(farm, 'следующий гость ярмарки');
    if (ingredientCount(farm, guest.item) < guest.item.quantity) return supply(farm, guest.item, `гость: ${guest.name}`);
    return home(farm, task('visitors', 'Угостите первого гостя ярмарки', 'Первое знакомство откроет проект Лавандовой гавани. Остальные гости будут приходить каждый день.', 'ui-market', { label: 'К сегодняшнему гостю', target: 'visit-guest' }, farm.fairGuestsServed, villageGuestTarget));
  }
  const village = getVillageProject(farm);
  if (village.items.some(item => item.available > 0) || village.items.every(({ item, delivered }) => delivered === item.quantity) && farm.coins >= village.coins) return home(farm, task('village', 'Постройте Лавандовую гавань', `Доставьте ручную выпечку, сибаса и мёд, а затем вложите ${village.coins} монет в Живую бухту.`, 'ui-bea', { label: 'Живая бухта', target: 'village-project' }));
  const missing = village.items.find(({ item, delivered }) => delivered < item.quantity);
  return missing ? supply(farm, { ...missing.item, quantity: missing.item.quantity - missing.delivered }, 'Лавандовая гавань') : coins(farm, village.coins, 'Лавандовая гавань');
}
