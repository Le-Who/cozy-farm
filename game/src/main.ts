import './style.css'
import { archiveCards } from './archive'
import { getIslandJourneys } from './journey'
import { getDiscoveryTask } from './discovery-path'
import { getRequirementHint, type Requirement } from './requirement-guidance'
import { getClimate, weatherNames, type Trait } from './climate'
import {
  boatPrice,
  bedsPerRow,
  buildingDefinitions,
  buildingIds,
  buyBoat,
  buyFeed,
  buySapling,
  buyAndPlantTree,
  buySeeds,
  canSailTo,
  capeFlowerSlotCount,
  capeDishIds,
  canUpgradePrice,
  beginFishingTrip,
  finishFishingTrip,
  cancelFishingTrip,
  getFishingTripConfig,
  bakeWorkshop,
  getWorkshopAction,
  workshopDefinitions,
  workshopShapes,
  getVillageProject,
  contributeVillage,
  getVillageHomeCount,
  inviteResident,
  getVillageMeal,
  serveVillageMeal,
  residentDefinitions,
  residentIds,
  getResidentService,
  runResidentService,
  collectEggs,
  collectShell,
  collectShoalFind,
  collectCapeHoney,
  cookDish,
  createFarm,
  moveHen as moveFarmHen,
  cropDefinitions,
  cropIds,
  deliverHarborOrder,
  deliverMarketOrder,
  deliverProject,
  dishDefinitions,
  dishIds,
  endDay,
  eggsPerBasket,
  eggsPerCrate,
  expandedWaterCapacity,
  feedBagPrice,
  feedBagSize,
  feedChickens,
  fishDefinitions,
  facilitySpecializations,
  gardenRows,
  gatherSeaSalt,
  getBedAction,
  getBedStage,
  getCapeBloom,
  getCapeHoney,
  getCapeUpgrade,
  getCapeWax,
  getCookAction,
  getDayPhase,
  getFishAction,
  getFishLimit,
  getFairGuest,
  getHarborOrder,
  getIrrigationRow,
  getIrrigationPair,
  getMarketOrders,
  getMarketStock,
  getProject,
  getSale,
  getShoreItem,
  getTreeAction,
  getWaterCapacity,
  ingredientCount,
  hasBayDisplay,
  incubateEgg,
  irrigateRow,
  irrigatePair,
  isProjectComplete,
  isHoneyWind,
  islandIds,
  maxChickenHappiness,
  maxFlockSize,
  needsSeedChoice,
  orderLanes,
  packEggBasket,
  packEggCrate,
  petChicken,
  pickFruit,
  plantTree,
  plantCapeFlower,
  projectIds,
  refillWater,
  restoreFarm,
  sail,
  seedPackSize,
  selectSeed,
  sellProduce,
  sellMarketItem,
  serveFairGuest,
  specializationDefinitions,
  specializationIds,
  specializeFarmhouse,
  specializeFacility,
  treeDefinitions,
  treeIds,
  upgradeBuilding,
  upgradeCape,
  upgradeCan,
  variantLabel,
  workBed,
  type ArchiveGroup,
  type CropId,
  type BuildingId,
  type DishId,
  type FacilityBranch,
  type ProjectId,
  type SpecializationId,
  type StockItem,
  type WorkshopShape,
} from './farm'
import { createFishingGame } from './fishing'
import { createWorkshop } from './workshop'
import { createCookery } from './cookery'
import { createIsland, type IslandTarget } from './island'
import { specializationStages } from './lavender-layout'
import { isLunarTide, shellDefinitions } from './tide'
import { shoalDefinitions } from './shoal'

const saveKey = 'cozy-farm-island-v1'

function loadFarm() {
  try {
    const saved = localStorage.getItem(saveKey)
    if (saved) return restoreFarm(JSON.parse(saved)) ?? createFarm()
  } catch {
    // The island is playable even when the browser cannot open its save.
  }
  return createFarm()
}

const farm = loadFarm()
let saveAvailable = true

function iconUrl(name: string) {
  const family = name.startsWith('tool-') || name.startsWith('ui-') || name.startsWith('upgrade-') || name.startsWith('cape-') || name.startsWith('village-') ? 'lavender' : 'icons'
  return `${import.meta.env.BASE_URL}art/${family}/${name}.webp`
}

function icon(name: string, className = '') {
  return `<img class="icon ${className}" src="${iconUrl(name)}" alt="" aria-hidden="true" draggable="false">`
}

function itemIcon(name: string, trait?: Trait) {
  if (!trait) return icon(name)
  const silhouette = new URL(iconUrl(name), document.baseURI).href
  return `<span class="variant-art" data-trait="${trait}" style="--item-silhouette:url('${silhouette}')">${icon(name)}</span>`
}

const tools = [
  { id: 'hoe', label: 'Hoe', image: 'hoe', key: '1' },
  { id: 'water', label: 'Watering Can', image: 'can', key: '2' },
  { id: 'seeds', label: 'Seed Pouch', image: 'seeds', key: '3' },
  { id: 'feed', label: 'Chicken Feed', image: 'feed', key: '4' },
  { id: 'basket', label: 'Harvest Basket', image: 'crate', key: '5' },
  { id: 'coop', label: 'Chicken Coop', image: 'hen', key: '6' },
  { id: 'rod', label: 'Fishing Rod', image: 'rod', key: '7' },
  { id: 'boat', label: 'Boat', image: 'boat', key: '8' },
] as const

type Tool = (typeof tools)[number]['id']
type Panel = 'market' | 'inventory' | 'archive' | 'settings' | 'journal' | 'coop' | 'rest' | 'guide' | 'seeds'
  | 'fishing' | 'boat' | 'orchard' | 'tree' | 'upgrades' | 'kitchen' | 'irrigation' | 'dock-project' | 'harbor' | 'specialize' | 'hive' | 'guest' | 'cape-upgrade' | 'honey-kitchen' | 'workshop' | 'cookery' | 'village-project' | 'village' | 'village-meal'

let activeTool: Tool = 'seeds'
let panel: Panel | undefined
let treeSlot = 0
let marketTab: 'buy' | 'sell' | 'orders' | 'projects' = 'buy'
let bagTab: 'seeds' | 'harvest' = 'harvest'
let archiveGroup: ArchiveGroup = 'crops'
let previewSeed: CropId = farm.selectedSeed
let seedPickerBed: number | undefined
let contextBed: number | undefined
let villageSlot = 0
let pastryShape: WorkshopShape = farm.workshopPatterns[0] ?? 'round'
let cookingDish: DishId = 'orchardTart'
let workshopRecipe: 'pastry' | 'bread' = 'pastry'
const requirementLinks = new Map<string, Requirement>()

function requirementLink(content: string, requirement: Requirement, className: string, name: string, ready = false) {
  if (ready) return `<li class="${className}" data-ready="true">${content}</li>`
  const key = String(requirementLinks.size)
  requirementLinks.set(key, requirement)
  return `<li class="requirement-slot"><button type="button" class="${className} requirement-link" data-ready="false" data-action="show-requirement" data-value="${key}" aria-label="Find: ${name}">${content}</button></li>`
}
const islandNames = { home: 'Cozy Farm', grove: 'Saltwind Grove', cape: 'Flower Cape', village: 'Lavender Harbour' }

function statusItem(id: string, image: string | undefined, label: string) {
  return `<div class="status-item status-${id}">
    ${image ? `<span class="status-icon" id="status-${id}-icon">${icon(image)}</span>` : ''}
    <span><span class="status-label sr-only">${label} </span><span class="status-value" id="status-${id}"></span></span>
  </div>`
}

const app = document.querySelector<HTMLElement>('#app')!
app.innerHTML = `
  <main class="game-shell" aria-label="Cozy Farm">
    <canvas class="island-canvas" tabindex="0" aria-label="Cozy Farm island. Use the arrow keys to select a farm location and Enter to interact."></canvas>
    <header class="hud-top">
      <div class="status-bar" role="group" aria-label="Farm status">
        <div class="status-group">
          ${statusItem('day', 'sun', 'Farm day')}
          ${statusItem('phase', undefined, 'Time or weather')}
        </div>
        <div class="status-group">
          ${statusItem('coins', 'coin', 'Coins')}
          ${statusItem('water', 'drop', 'Water')}
        </div>
        <span class="sr-only" id="status-seed"></span>
        <span class="sr-only" id="status-tool"></span>
      </div>
      <nav class="hud-actions" aria-label="Farm menus">
        <button class="hud-button" type="button" data-panel="market" aria-label="Market" title="Market">${icon('shop')}</button>
        <button class="hud-button" type="button" data-panel="inventory" aria-label="Inventory" title="Inventory">${icon('pack')}</button>
        <button class="hud-button" type="button" data-panel="guide" aria-label="Explore the bay" title="Explore the bay">${icon('island')}</button>
      </nav>
    </header>
    <button class="task-card" type="button" data-panel="journal" aria-label="Current task, open farm journal" aria-describedby="task-name task-count task-reward" aria-keyshortcuts="J" title="Open farm journal (J)">
      <span class="task-medallion">${icon('carrot')}</span>
      <span class="task-content">
        <strong class="task-name" id="task-name"></strong>
        <span class="task-count" id="task-count"></span>
        <progress class="task-progress" aria-labelledby="task-name" max="1" value="0"></progress>
        <span class="task-reward sr-only" id="task-reward"></span>
      </span>
    </button>
    <button class="island-location" type="button" data-panel="boat" aria-label="Islands and travel" hidden>${icon('island')}<span>Saltwind Grove</span></button>
    <button class="view-toggle" type="button" data-action="field-view" aria-pressed="false">${icon('field')}<span>Field view</span></button>
    <div class="hud-bottom">
      <button class="hud-hint" hidden type="button" data-panel="guide" aria-label="Open farm guide" aria-describedby="farm-hint-text" aria-keyshortcuts="?" title="Open farm guide">
        <span class="hint-icon">${icon('star')}</span><span class="hint-text" id="farm-hint-text"></span><kbd aria-hidden="true">?</kbd>
      </button>
      <div class="field-context" hidden>
        <img class="icon" src="${iconUrl('tool-hoe')}" alt="" draggable="false">
        <span class="context-copy" id="context-copy"></span>
        <button class="dialog-button" type="button" data-action="work-context" aria-describedby="context-copy"></button>
      </div>
      <div class="hotbar" role="group" aria-label="Tool belt">
        ${tools.map(({ id, label, image, key }) => `<button class="hotbar-slot" type="button" data-tool="${id}" aria-label="${label}" aria-describedby="slot-count-${id}" title="${label} (${key})" aria-pressed="false" aria-keyshortcuts="${key}">
          <span class="slot-icon">${icon(`tool-${image}`)}</span><kbd class="slot-key" aria-hidden="true">${key}</kbd><span class="slot-count" id="slot-count-${id}" hidden></span>
        </button>`).join('')}
      </div>
    </div>
    <p class="toast" role="status" aria-live="polite" hidden></p>
    <dialog class="farm-dialog" aria-labelledby="dialog-title">
      <section class="dialog-panel">
        <button class="scene-back" type="button" data-action="back" aria-label="Back" hidden>‹</button>
        <header class="dialog-header">
          <button class="dialog-back" type="button" data-action="back" aria-label="Back" hidden>‹</button>
          <img class="dialog-emblem" src="${iconUrl('pack')}" alt="" aria-hidden="true" draggable="false">
          <h1 class="dialog-title" id="dialog-title"></h1>
          <button class="dialog-close" type="button" aria-label="Close menu">${icon('close')}</button>
        </header>
        <nav class="dialog-destinations" aria-label="Bay destinations"><button type="button" data-panel="boat">${icon('tool-boat')}<span>Islands</span></button><button type="button" data-panel="archive">${icon('orchard')}<span>Collections</span></button><button type="button" data-panel="guide">${icon('island')}<span>Explore</span></button></nav>
        <p class="dialog-status dialog-feedback" role="status" hidden></p>
        <div class="dialog-content"></div>
      </section>
    </dialog>
  </main>
`

const canvas = app.querySelector<HTMLCanvasElement>('.island-canvas')!
const dialog = app.querySelector<HTMLDialogElement>('.farm-dialog')!
const dialogTitle = app.querySelector<HTMLElement>('.dialog-title')!
const dialogEmblem = app.querySelector<HTMLImageElement>('.dialog-emblem')!
const dialogContent = app.querySelector<HTMLElement>('.dialog-content')!
const dialogFeedback = app.querySelector<HTMLElement>('.dialog-feedback')!
const closeButton = app.querySelector<HTMLButtonElement>('.dialog-close')!
const backButton = app.querySelector<HTMLButtonElement>('.dialog-back')!
const toast = app.querySelector<HTMLParagraphElement>('.toast')!
const taskCard = app.querySelector<HTMLButtonElement>('.task-card')!
const taskProgress = app.querySelector<HTMLProgressElement>('.task-progress')!
const taskReward = app.querySelector<HTMLElement>('.task-reward')!
const hintText = app.querySelector<HTMLElement>('.hint-text')!
const contextCard = app.querySelector<HTMLElement>('.field-context')!
const contextButton = contextCard.querySelector<HTMLButtonElement>('button')!
const contextIcon = contextCard.querySelector<HTMLImageElement>('img')!
const hotbarButtons = Array.from(app.querySelectorAll<HTMLButtonElement>('.hotbar-slot'))
const marketButton = app.querySelector<HTMLButtonElement>('[data-panel="market"]')!
const islandLocation = app.querySelector<HTMLElement>('.island-location')!
const fieldViewButton = app.querySelector<HTMLButtonElement>('.view-toggle')!
const portraitView = window.matchMedia('(max-width: 680px) and (orientation: portrait)')
const fieldLayout = window.matchMedia(`${portraitView.media}, (max-width: 900px) and (max-height: 600px) and (orientation: landscape)`)
const numberFormat = new Intl.NumberFormat('en')
let toastTimer: number | undefined

function textAt(id: string, value: string) {
  document.getElementById(id)!.textContent = value
}

function statusIcon(id: string, name: string) {
  const image = document.querySelector<HTMLImageElement>(`#status-${id}-icon img`)!
  const source = iconUrl(name)
  if (image.getAttribute('src') !== source) image.src = source
}

function notify(message: string, ok = true, resultVisible = false) {
  window.clearTimeout(toastTimer)
  toast.textContent = message
  toast.dataset.island = farm.island
  toast.dataset.tone = ok ? 'good' : 'bad'
  toast.classList.toggle('sr-only', resultVisible && ok)
  toast.hidden = false
  toastTimer = window.setTimeout(() => { toast.hidden = true }, 3200)
}

function currentTask() {
  const next = getDiscoveryTask(farm, farm.orientation)
  if (next || farm.island === 'home') return next
  if (farm.island === 'village') return { label: 'A place to belong', detail: 'Invite neighbours and share supper by the water.', progress: Math.min(2, farm.village.meals), target: 2, reward: undefined }
  if (farm.island === 'cape') {
    const planted = farm.capeFlowers.filter((day) => day !== null).length
    if (planted < capeFlowerSlotCount) return {
      label: 'Welcome the bees', detail: 'Plant the three flower beds. Flowers bloom after a night at home.',
      progress: planted, target: capeFlowerSlotCount, reward: undefined,
    }
    if (farm.capeHoneyOn === farm.day) {
      const upgrade = getCapeUpgrade(farm)
      if (upgrade) return {
        label: upgrade.name, detail: 'Open the hive to build the next upgrade.',
        progress: Math.min(3, farm.capeLevel === 1 ? farm.honey : farm.beeswax), target: 3, reward: undefined,
      }
      return {
        label: 'Cape tastings', detail: 'Cook the three Honey Kitchen recipes.',
        progress: capeDishIds.filter((dish) => farm.bayDiscoveries.includes(dish)).length, target: capeDishIds.length, reward: undefined,
      }
    }
    return {
      label: 'Flower Cape honey', detail: farm.capeHoneyOn === farm.day ? 'The hive will fill again tomorrow.'
        : getCapeHoney(farm).blooms ? 'Visit the hive to collect today’s honey.' : 'Rest at Cozy Farm to let the flowers bloom.',
      progress: Number(farm.capeHoneyOn === farm.day), target: 1, reward: undefined,
    }
  }
  const limit = getFishLimit(farm)
  return {
    label: 'Explore Saltwind Grove',
    detail: `Catch ${limit} sea bass and gather sea salt today.`,
    progress: farm.fishCaughtToday.grove + Number(farm.saltGatheredToday),
    target: limit + 1,
    reward: undefined,
  }
}

function status() {
  const tool = tools.find(({ id }) => id === activeTool)!
  const goal = currentTask()
  const atHome = farm.island === 'home'
  const taskArt = taskCard.querySelector<HTMLImageElement>('.task-medallion .icon')!
  const taskSource = iconUrl(goal && 'icon' in goal ? goal.icon : farm.island === 'cape' ? 'ui-honey' : farm.island === 'village' ? 'ui-bea' : 'carrot')
  if (taskArt.getAttribute('src') !== taskSource) taskArt.src = taskSource
  const counts: Partial<Record<Tool, number>> = {
    seeds: farm.seeds[farm.selectedSeed],
    feed: farm.feed,
    basket: getSale(farm).items,
    coop: farm.eggsReady,
    rod: farm.island === 'cape' || farm.island === 'village' ? undefined : getFishLimit(farm) - farm.fishCaughtToday[farm.island],
  }
  app.querySelector<HTMLElement>('.hotbar')!.dataset.island = farm.island

  textAt('status-day', `Day ${farm.day}`)
  const phase = getDayPhase(farm)
  const { weather } = getClimate(farm.day)
  const dayStatus = app.querySelector<HTMLElement>('.status-group')!
  dayStatus.dataset.weather = weather
  dayStatus.title = `${phase} · ${weatherNames[weather]}`
  textAt('status-phase', weather === 'sun' ? phase : weatherNames[weather])
  statusIcon('day', weather === 'rain' ? 'drop' : weather === 'stars' ? 'star' : phase === 'Evening' ? 'moon' : 'sun')
  textAt('status-coins', numberFormat.format(farm.coins))
  textAt('status-water', `${farm.water}/${getWaterCapacity(farm)}`)
  textAt('status-seed', `${cropDefinitions[farm.selectedSeed].name} Seeds`)
  textAt('status-tool', tool.label)

  textAt('task-name', goal?.label ?? 'Market orders')
  textAt('task-count', goal ? `${goal.progress}/${goal.target}` : '')
  textAt('task-reward', goal?.reward === undefined ? '' : `${numberFormat.format(goal.reward)} coins on completion`)
  taskReward.hidden = goal?.reward === undefined
  taskProgress.max = goal?.target ?? 1
  taskProgress.value = goal?.progress ?? 1
  taskProgress.hidden = !goal
  delete taskCard.dataset.panel
  taskCard.dataset.action = 'follow-task'
  taskCard.title = goal && 'action' in goal ? goal.action.label : 'Open farm journal (J)'
  taskCard.setAttribute('aria-label', goal && 'action' in goal ? `${goal.label}. ${goal.action.label}` : 'Open farm journal')
  taskCard.setAttribute('aria-keyshortcuts', 'J')
  marketButton.disabled = !atHome
  marketButton.title = atHome ? 'Market' : 'The market is back at Cozy Farm'
  islandLocation.hidden = atHome
  const tide = farm.island === 'grove' && isLunarTide(farm.day)
  const honeyWind = farm.island === 'cape' && isHoneyWind(farm.day)
  islandLocation.dataset.tide = String(tide)
  islandLocation.dataset.honeyWind = String(honeyWind)
  islandLocation.querySelector('span')!.textContent = tide ? 'Lunar tide' : honeyWind ? 'Honey Wind' : islandNames[farm.island]
  islandLocation.title = `${islandNames[farm.island]}${tide ? ' · Lunar tide' : honeyWind ? ' · Honey Wind' : ''}`
  fieldViewButton.hidden = !atHome
  hintText.textContent = farm.island === 'grove' && goal?.progress === goal?.target
    ? 'Explore the orchard or sail back to Cozy Farm.'
    : goal?.detail ?? 'Fish at the pier or sail to Saltwind Grove and Flower Cape.'

  for (const button of hotbarButtons) {
    const toolId = button.dataset.tool as Tool
    const definition = tools.find(tool => tool.id === toolId)!
    const atVillage = farm.island === 'village'
    button.hidden = atVillage && toolId !== 'basket' && toolId !== 'coop' && toolId !== 'boat'
    const label = atVillage && toolId === 'basket' ? 'Pastry workshop' : atVillage && toolId === 'coop' ? 'Neighbours' : definition.label
    button.setAttribute('aria-label', label)
    button.title = `${label} (${definition.key})`
    const image = button.querySelector<HTMLImageElement>('.slot-icon img')!
    const source = iconUrl(atVillage && toolId === 'basket' ? 'ui-handmade-round' : atVillage && toolId === 'coop' ? 'ui-bea' : `tool-${definition.image}`)
    if (image.getAttribute('src') !== source) image.src = source
    button.disabled = farm.island === 'cape' && toolId === 'rod'
    const count = counts[toolId]
    const badge = button.querySelector<HTMLElement>('.slot-count')!
    if (toolId === 'seeds') button.title = `Seed pouch · ${cropDefinitions[farm.selectedSeed].name} (3)`
    button.setAttribute('aria-pressed', String(toolId === activeTool))
    badge.hidden = atVillage || count === undefined
    badge.textContent = count === undefined ? '' : String(count)
  }
  updateFieldContext(contextBed)
}

const panelTitles: Record<Panel, string> = {
  market: 'Island Market',
  inventory: 'Farm Inventory',
  archive: 'Collections',
  settings: 'Settings',
  journal: 'Farm Journal',
  coop: 'Chicken Coop',
  rest: 'Farmhouse',
  guide: 'Explore the bay',
  seeds: 'Seed Pouch',
  fishing: 'Fishing',
  boat: 'Islands',
  orchard: 'Island Orchard',
  tree: 'Orchard Plot',
  upgrades: 'Building Upgrades',
  kitchen: 'Farmhouse Kitchen',
  irrigation: 'Irrigation',
  'dock-project': 'Grove landing',
  harbor: 'Harbor orders',
  specialize: 'Farmhouse Lv. 3',
  hive: 'Cape Hive',
  'cape-upgrade': 'Flower Apiary',
  'honey-kitchen': 'Honey Kitchen',
  guest: 'Fair Visitor',
  workshop: 'Pastry Workshop', cookery: 'Kitchen', 'village-project': 'Living Bay', village: 'Neighbours', 'village-meal': 'Supper by the water',
}

const panelEmblems: Record<Panel, string> = {
  market: 'ui-market', inventory: 'ui-bag', archive: 'orchard', settings: 'gear', journal: 'star', coop: 'tool-hen',
  rest: 'moon', guide: 'island', seeds: 'ui-bag', fishing: 'tool-rod', boat: 'tool-boat',
  orchard: 'orchard', tree: 'orchard', upgrades: 'hammer', kitchen: 'ui-kitchen',
  irrigation: 'tool-can',
  'dock-project': 'dock',
  harbor: 'dock',
  specialize: 'upgrade-farmhouse-card',
  hive: 'ui-honey',
  'cape-upgrade': 'ui-honey',
  'honey-kitchen': 'ui-honey-biscuits',
  guest: 'ui-market',
  workshop: 'ui-handmade-round', cookery: 'ui-tart', 'village-project': 'island', village: 'ui-bea', 'village-meal': 'ui-grilled-fish',
}

const panelBanners: Partial<Record<Panel, string>> = { inventory: 'Bag', market: 'Market', kitchen: 'Kitchen' }
const dishIcons: Record<DishId, string> = {
  orchardTart: 'ui-tart', grilledFish: 'ui-grilled-fish', appleJam: 'ui-apple-jam',
  farmhouseBread: 'ui-farmhouse-bread', orchardPreserves: 'ui-orchard-preserves',
  honeyCake: 'ui-honey-cake',
  honeyBiscuits: 'ui-honey-biscuits', honeyPear: 'ui-honey-pear', windParfait: 'ui-wind-parfait',
}
const pastryIcons = { round: 'ui-handmade-round', folded: 'ui-handmade-folded', long: 'ui-handmade-long' }
const archiveIcons: Record<string, string> = {
  ...dishIcons, honey: 'ui-honey', windHoney: 'ui-wind-honey', beeswax: 'ui-beeswax', pear: 'ui-pear', peach: 'ui-tree-peach',
}
type BuildingBranch = SpecializationId | FacilityBranch
const branchChoices: Record<BuildingId, readonly BuildingBranch[]> = {
  farmhouse: specializationIds, coop: ['hatchery', 'packing'], well: ['rain', 'pipes'],
}
const branchDefinitions = { ...specializationDefinitions, ...facilitySpecializations.coop, ...facilitySpecializations.well }
const facilityDetails: Record<FacilityBranch, readonly [string, string]> = {
  hatchery: ['tool-hen', 'Hatch a hen'], packing: ['ui-egg-crate', 'Pack egg crates'],
  rain: ['drop', 'Morning refill'], pipes: ['tool-can', 'Water two rows'],
}
let specializationBuilding: BuildingId = 'farmhouse'
let previewSpecialization: BuildingBranch | undefined
let irrigationMode: 'row' | 'pair' = 'row'

type ButtonOptions = { secondary?: boolean; crop?: CropId; value?: string | number; context?: string; cost?: { icon: 'coin' | 'drop'; amount: number } }

function button(label: string, action: string, enabled = true, options: ButtonOptions = {}) {
  const { secondary, crop, value, cost, context = crop ? `${cropDefinitions[crop].name} seeds` : undefined } = options
  return `<button class="dialog-button${secondary ? ' secondary' : ''}" type="button" data-action="${action}"
    ${crop ? `data-crop="${crop}"` : ''} ${value !== undefined ? `data-value="${value}"` : ''}
    ${context ? `aria-label="${label}, ${context}"` : ''} ${enabled ? '' : 'disabled'}>${label}
    ${cost ? `<span class="button-cost" aria-hidden="true">${icon(cost.icon)} ${numberFormat.format(cost.amount)}</span>` : ''}</button>`
}

function quantity(count: number, noun: string) {
  return `${numberFormat.format(count)} ${noun}${count === 1 ? '' : 's'}`
}

function row(image: string, name: string, detail: string, actions = '', trait?: Trait) {
  return `<li class="dialog-row"${trait ? ` data-trait="${trait}"` : ''}><span class="dialog-icon">${itemIcon(image, trait)}</span>
    <span class="dialog-row-copy"><strong>${name}</strong>${detail ? `<small>${detail}</small>` : ''}</span>
    ${actions ? `<span class="dialog-row-actions">${actions}</span>` : ''}
  </li>`
}

function nav(...buttons: string[]) {
  return `<div class="dialog-grid dialog-nav">${buttons.join('')}</div>`
}

function panelTabs(action: string, active: string, tabs: ReadonlyArray<readonly [string, string]>) {
  return `<div class="panel-tabs" role="group" aria-label="Categories">${tabs.map(([id, label]) =>
    `<button type="button" data-action="${action}" data-value="${id}" aria-pressed="${id === active}">${label}</button>`).join('')}</div>`
}

function goods() {
  return getMarketStock(farm).filter(({ item, count }) => {
    if (item.kind === 'eggCrates') return farm.coopSpecialization === 'packing'
    if (count > 0 || item.kind !== 'dishes') return true
    const branch = dishDefinitions[item.item].specialization
    return !branch || farm.farmhouseSpecialization === branch
  })
    .map(({ item, ...listing }) => ({ ...listing, ...stockLabel(item), trait: item.kind === 'variants' ? item.trait : undefined }))
}

function specializationCards() {
  const choice = previewSpecialization ? branchDefinitions[previewSpecialization] : undefined
  return `<p class="coin-balance">${icon('coin')} ${numberFormat.format(farm.coins)}<span class="sr-only"> coins</span></p>
    <div class="specialization-grid">${branchChoices[specializationBuilding].map((id) => {
      const definition = branchDefinitions[id]
      const [image, benefit] = id === 'bakery' || id === 'preserves'
        ? [dishIcons[specializationDefinitions[id].dish], dishDefinitions[specializationDefinitions[id].dish].name]
        : facilityDetails[id]
      const path = specializationStages[id].mask.path
      return `<button class="specialization-option" type="button" data-action="preview-specialization" data-value="${id}"
        aria-pressed="${id === previewSpecialization}">
        <img class="specialization-preview" src="${import.meta.env.BASE_URL}art/${path}.webp" alt="" draggable="false">
        <strong>${definition.name}</strong><span>${icon(image)}${benefit}</span>
      </button>`
    }).join('')}</div>
    <footer class="specialization-footer"><p>Permanent choice</p>
      ${button('Build', 'build-specialization', choice !== undefined && farm.coins >= choice.price,
        choice ? { value: previewSpecialization, context: `${choice.name}, ${quantity(choice.price, 'coin')}`,
          cost: { icon: 'coin', amount: choice.price } } : {})}</footer>`
}

function flockFeedRow() {
  return row('tool-feed', 'Hen feed', farm.chickensFed ? 'Fed today' : 'Feed for morning eggs', farm.chickensFed ? ''
    : farm.feed > 0 ? button('Feed flock', 'feed')
      : button('Buy feed', 'buy-feed', farm.coins >= feedBagPrice, {cost:{icon:'coin',amount:feedBagPrice}}))
}

function seedCards() {
  const seed = cropDefinitions[previewSeed]
  return `<div class="seed-grid">${cropIds.map((crop) =>
    `<button class="seed-tile" type="button" data-action="preview-seed" data-value="${crop}" aria-pressed="${farm.selectedSeed === crop}" aria-label="${cropDefinitions[crop].name} seeds, ${farm.seeds[crop]} available">
      ${icon(`ui-seed-${crop}`)}<strong>${cropDefinitions[crop].name}</strong><span>×${farm.seeds[crop]}</span>
    </button>`).join('')}</div>
    <section class="seed-detail">${icon(previewSeed)}<div><h2>${seed.name} seeds</h2><p>${quantity(seed.days, 'watered night')}</p>
      ${farm.seeds[previewSeed]===0?button('Buy seeds','buy-seeds',farm.coins>=seed.seedPrice,{crop:previewSeed,cost:{icon:'coin',amount:seed.seedPrice}}):''}</div></section>`
}

function stockLabel(item: StockItem): { name: string; image: string } {
  switch (item.kind) {
    case 'produce': return { name: cropDefinitions[item.item].name, image: item.item }
    case 'fruit': return { name: treeDefinitions[item.item].name, image: item.item === 'apple' ? 'apple' : item.item === 'pear' ? 'ui-pear' : 'ui-tree-peach' }
    case 'fish': return { name: fishDefinitions[item.item].name, image: item.item==='moonfish'||item.item==='lanternfish'?`ui-${item.item}`:'fish' }
    case 'handmade': return { name: workshopDefinitions[item.item].name, image: pastryIcons[item.item] }
    case 'dishes': return { name: dishDefinitions[item.item].name, image: dishIcons[item.item] }
    case 'eggs': return { name: 'Egg', image: 'egg' }
    case 'eggBaskets': return { name: 'Egg basket', image: 'ui-egg-basket' }
    case 'eggCrates': return { name: 'Egg crate', image: 'ui-egg-crate' }
    case 'seaSalt': return { name: 'Sea salt', image: 'ui-sea-salt' }
    case 'honey': return { name: 'Flower honey', image: 'ui-honey' }
    case 'windHoney': return { name: 'Wind honey', image: 'ui-wind-honey' }
    case 'beeswax': return { name: 'Beeswax', image: 'ui-beeswax' }
    case 'shells': return { name: shellDefinitions[item.item].name, image: shellDefinitions[item.item].icon }
    case 'shoalFinds': return { name: shoalDefinitions[item.item].name, image: shoalDefinitions[item.item].icon }
    case 'variants': return variantLabel(item.item, item.trait)
  }
}

function stockTile(item: StockItem) {
  const stock = ingredientCount(farm, item)
  const label = stockLabel(item)
  const resource = item.kind === 'produce' || item.kind === 'fruit' ? item.item : item.kind === 'eggs' ? 'egg' : undefined
  const specialStock = resource !== undefined && Object.values(farm.variants[resource] ?? {}).some(count => count > 0)
  const name = stock < item.quantity && specialStock ? `Regular ${label.name.toLowerCase()}` : label.name
  const image = label.image
  return requirementLink(`${icon(image)}<span>${name}</span><strong>${stock}/${item.quantity}</strong>`, {kind:'stock',item}, 'ingredient', `${name}, ${stock} of ${item.quantity}`, stock >= item.quantity)
}

function recipeCards(recipes: readonly DishId[]) {
  return `<div class="recipe-list">${recipes.map((dish) => {
    const recipe = dishDefinitions[dish]
    const action = getCookAction(farm, dish)
    const locked = recipe.capeLevel ? farm.capeLevel < recipe.capeLevel : farm.buildingLevels.farmhouse < recipe.requiredLevel
    return `<section class="recipe${locked ? ' recipe-locked' : ''}">${icon(dishIcons[dish], 'recipe-art')}
      <h2>${recipe.name}</h2>${locked ? '' : `<ul class="ingredients">${recipe.ingredients.map(stockTile).join('')}</ul>`}
      <p class="recipe-value">${icon('coin')} ${recipe.sellPrice}<span class="sr-only"> coins</span></p>
      ${locked ? `<p class="recipe-reason">${action.label}</p>${button('Upgrades','upgrades',true,{secondary:true})}`
        : !action.available&&farm.island!==(recipe.capeLevel?'cape':'home')?button(recipe.capeLevel?'Visit Flower Cape':'Return Home','sail',canSailTo(farm,recipe.capeLevel?'cape':'home'),{value:recipe.capeLevel?'cape':'home'}):button('Cook', 'cook', action.available, { value: dish, context: recipe.name })}</section>`
  }).join('')}</div>`
}

function marketOrders() {
  const rank = { ready: 0, waiting: 1, upgrade: 1, delivered: 2 }
  const orders = getMarketOrders(farm).sort((a, b) => rank[a.status] - rank[b.status])
  const cards = orders.map((order) => {
    const delivered = order.status === 'delivered'
    return `<section class="market-order" data-status="${order.status}" aria-labelledby="order-${order.lane}">
      <header class="order-header"><h2 id="order-${order.lane}">${order.name}</h2>
        <span class="order-reward">${icon('coin')} ${numberFormat.format(order.reward)}<span class="sr-only"> coins</span></span></header>
      ${delivered ? '<p class="order-done">✓ Delivered</p>'
        : `<ul class="ingredients order-items">${order.items.map(stockTile).join('')}</ul>
          ${order.status === 'upgrade' ? button('Upgrade farmhouse', 'upgrades', true, { secondary: true })
            : button('Deliver', 'deliver-order', order.status === 'ready', { value: order.lane, context: order.name })}`}
    </section>`
  })
  const waiting = orders.findIndex(({ status }) => status !== 'ready')
  cards.splice(waiting < 0 ? cards.length : waiting, 0, harborCard())
  return `<div class="order-list">${cards.join('')}</div>`
}

function deliveryItems(items: ReturnType<typeof getProject>['items']) {
  return items.map(({ item, delivered, available }) => {
    const { name, image } = stockLabel(item)
    return requirementLink(`${icon(image)}<span>${name}</span>
      <strong><span class="sr-only">Delivered </span>${delivered}/${item.quantity}</strong>
      ${available ? `<span class="project-available">+${available}<span class="sr-only"> available</span></span>` : ''}`, available >= item.quantity-delivered ? {kind:'delivery'} : {kind:'stock',item:{...item,quantity:item.quantity-delivered}}, 'ingredient', name, delivered === item.quantity)
  }).join('')
}

function harborCard() {
  const order = getHarborOrder(farm)
  if (!order) return ''
  return `<section class="market-order project-card" aria-labelledby="harbor-order">
    <header class="order-header"><h2 id="harbor-order">${order.name}</h2>
      <span class="order-reward">${icon('coin')} ${order.reward}<span class="sr-only"> coins</span></span></header>
    <ul class="ingredients project-items">${deliveryItems(order.items)}</ul>
    ${order.status === 'completed' ? '<p class="order-done">✓ Delivered</p>'
      : farm.island !== 'grove' ? button('Sail to Grove', 'sail',canSailTo(farm,'grove'), {value:'grove',secondary:true})
      : button('Deliver', 'deliver-harbor', order.status === 'ready', { context: order.name })}
  </section>`
}

function groveDockActions() {
  if (farm.island !== 'grove') return ''
  return nav(button('Pier project', 'project-dock', true, { secondary: true }),
    getHarborOrder(farm) ? button('Harbor orders', 'visit-harbor') : '')
}

function projectCard(id: ProjectId) {
  const project = getProject(farm, id)
  const fair = id === 'fair'
  const complete = project.status === 'completed'
  const requirements = fair && project.status === 'locked'
    ? buildingIds.map((building) => {
      const ready = farm.buildingLevels[building] >= 2
      return requirementLink(`${icon(`upgrade-${building}-card`)}<span>${buildingDefinitions[building].name}</span><strong>${Math.min(2, farm.buildingLevels[building])}/2</strong>`, {kind:'building',building}, 'ingredient', buildingDefinitions[building].name, ready)
    }).join('')
    : deliveryItems(project.items)
  const reward = `<span class="order-reward">${icon('coin')} ${project.reward}<span class="sr-only"> coins</span></span>`
  const away=farm.island!==(fair?'home':'grove')
  const action = !complete&&away ? button(`Visit ${fair?'Home':'Grove'}`,'sail',farm.boatOwned,{value:fair?'home':'grove'}) : complete
    ? `<p class="order-done">✓ ${fair ? '+1 coin per crop sold' : '4 catches a day in Grove'}</p>`
    : project.status === 'locked' && fair
      ? button('Upgrades', 'upgrades', true, { secondary: true })
      : button('Deliver', 'deliver-project', project.status === 'ready', { value: id, context: project.name })
  return `<section class="market-order project-card" aria-labelledby="${fair ? 'project-fair' : 'dialog-title'}">
    ${fair ? `<header class="order-header"><h2 id="project-fair">${project.name}</h2>${reward}</header>` : ''}
    <ul class="ingredients project-items">${requirements}</ul>
    ${fair || complete ? action : `<footer class="project-footer">${reward}${action}</footer>`}
  </section>`
}

function irrigationRows() {
  const pair = farm.wellSpecialization === 'pipes' && irrigationMode === 'pair'
  const rowCount = pair ? 2 : 1
  const modes = farm.wellSpecialization === 'pipes'
    ? panelTabs('irrigation-mode', irrigationMode, [['row', 'One row'], ['pair', 'Two rows']])
    : ''
  return `<div class="irrigation-tools">
    <p class="coin-balance">${icon('drop')} ${farm.water}/${getWaterCapacity(farm)}<span class="sr-only"> water</span></p>
    ${button('Refill', 'refill', farm.water < getWaterCapacity(farm), { secondary: true })}
    </div>${modes}<ol class="dialog-list irrigation-rows">${Array.from({ length: gardenRows - rowCount + 1 }, (_, rowIndex) => {
      const { available, targets } = pair ? getIrrigationPair(farm, rowIndex) : getIrrigationRow(farm, rowIndex)
      const range = pair ? `${rowIndex + 1}–${rowIndex + 2}` : String(rowIndex + 1)
      const label = `${pair ? 'rows' : 'row'} ${range}`
      const plots = farm.beds.slice(rowIndex * bedsPerRow, (rowIndex + rowCount) * bedsPerRow)
      return `<li class="dialog-row"><strong class="irrigation-number">${range}</strong>
        <div class="irrigation-plots" aria-label="${label}, ${targets.length} need water">
          ${plots.map((bed, column) => {
            const needsWater = targets.includes(rowIndex * bedsPerRow + column)
            return `<span data-plot="${bed.kind === 'crop' && bed.watered ? 'wet' : needsWater ? 'dry' : 'rest'}">${bed.kind === 'crop' ? icon(bed.crop) : ''}</span>`
          }).join('')}</div>
        ${button('Water', pair ? 'irrigate-pair' : 'irrigate-row', available, { value: rowIndex,
          context: `${label}${targets.length ? `, ${targets.length} water` : ''}`,
          cost: targets.length ? { icon: 'drop', amount: targets.length } : undefined })}</li>`
    }).join('')}</ol>`
}

function marketCards() {
  const balance = `<p class="coin-balance" aria-label="${quantity(farm.coins, 'coin')}">${icon('coin')} ${numberFormat.format(farm.coins)}</p>`
  const tabs = panelTabs('market-tab', marketTab, [['buy', 'Buy'], ['sell', 'Sell'], ['orders', 'Orders'], ['projects', 'Projects']])
  const controls = `<div class="market-controls">${balance}${tabs}</div>`
  if (marketTab === 'orders') return controls + marketOrders()
  if (marketTab === 'projects') return controls + projectCard('fair') + nav(button('Pastry workshop', 'workshop', isProjectComplete(farm, 'fair')), button('Living Bay', 'village-project', true, { secondary: true }))
  if (marketTab === 'sell') {
    const sale = getSale(farm)
    return `${controls}
      <ul class="dialog-list">${goods().filter(({ count }) => count > 0).map(({ image, name, count, price, key, trait }) =>
        row(image, name, `×${count}`, button(`Sell 1 · ${price}`, 'sell-item', true, { value: key, context: `${name}, ${quantity(price, 'coin')}` }), trait)).join('')}</ul>
      <section class="market-total">${icon('tool-crate')}<div><strong>${sale.items ? `${quantity(sale.items, 'item')} · ${quantity(sale.coins, 'coin')}` : 'Basket is empty'}</strong>
      ${button('Sell all', 'sell', sale.items > 0)}</div></section>`
  }
  return `${controls}<ul class="dialog-list">
    ${cropIds.map((crop) => {
      const definition = cropDefinitions[crop]
      return row(`ui-seed-${crop}`, `${definition.name} seeds`, `${quantity(seedPackSize, 'seed')} · ${quantity(definition.seedPrice, 'coin')}`,
        button('Buy', 'buy-seeds', farm.coins >= definition.seedPrice, { crop }))
    }).join('')}
    ${row('tool-feed', 'Chicken feed', `${quantity(feedBagSize, 'serving')} per bag · ${quantity(feedBagPrice, 'coin')}`, button('Buy', 'buy-feed', farm.coins >= feedBagPrice))}
    ${row('tool-can', 'Large watering can', `Holds ${expandedWaterCapacity} servings of water`, button(farm.canUpgraded ? 'Owned' : `Upgrade · ${quantity(canUpgradePrice, 'coin')}`, 'upgrade-can', !farm.canUpgraded && farm.coins >= canUpgradePrice))}
    ${treeIds.map((tree) => {
      const definition = treeDefinitions[tree]
      return row('orchard', `${definition.name} sapling`, `${quantity(definition.days, 'night')} to mature`,
        button(`Buy · ${quantity(definition.saplingPrice, 'coin')}`, 'buy-sapling', farm.coins >= definition.saplingPrice, { value: tree, context: `${definition.name} sapling` }))
    }).join('')}
    </ul>${nav(button('Boat dock', 'visit-boat', true, { secondary: true }), button('Building upgrades', 'upgrades', true, { secondary: true }))}`
}

function treeRow(index: number) {
  if (farm.island !== 'home' && farm.island !== 'grove') return ''
  const slot = farm.trees[farm.island][index]
  const definition = slot && treeDefinitions[slot.tree]
  const action = getTreeAction(farm, index)
  const detail = slot && definition
    ? slot.age >= definition.days
      ? `${slot.fruitReady} ready to pick`
      : `${quantity(definition.days - slot.age, 'night')} until maturity`
    : 'Room to plant a sapling'
  return row(slot?.tree === 'apple' ? 'apple' : 'orchard', definition?.name ?? `Open plot ${index + 1}`, detail,
    button(action.kind === 'pick' ? 'Pick fruit' : slot ? 'Inspect' : 'Plant a tree', 'visit-tree', true, { value: index }))
}

let fishingGame: ReturnType<typeof createFishingGame> | undefined
let fishingToken: number | undefined
let workshopGame: ReturnType<typeof createWorkshop> | undefined
let cookeryGame: ReturnType<typeof createCookery> | undefined

function stopFishing() {
  fishingGame?.destroy()
  fishingGame = undefined
  if (fishingToken !== undefined) {
    cancelFishingTrip(farm, fishingToken)
    fishingToken = undefined
    try { localStorage.setItem(saveKey, JSON.stringify(farm)) } catch { saveAvailable = false }
  }
  island.setFishing(false)
}

function stopWorkshop() { workshopGame?.destroy(); workshopGame = undefined }
function stopCookery() { cookeryGame?.destroy(); cookeryGame = undefined }

function mountFishing() {
  stopFishing()
  if (!getFishAction(farm).available) return
  const config = getFishingTripConfig(farm)
  const remaining = getFishLimit(farm) - (farm.island === 'grove' ? farm.fishCaughtToday.grove : farm.fishCaughtToday.home)
  dialogContent.innerHTML = '<div class="fishing-host"></div>'
  const host = dialogContent.querySelector<HTMLElement>('.fishing-host')!
  fishingGame = createFishingGame(host, {
    seed: farm.day*1009+(farm.fishingTripSerial+1)*9176+(farm.island==='grove'?71:17),
    capacity: Math.min(config.capacity, remaining), maxDepth: config.depth, resilience: config.resilience,
    fish: farm.island === 'grove' ? 'seaBass' : 'perch',
    onCast() {
      const trip = beginFishingTrip(farm)
      if (!trip.ok || trip.token === undefined) { notify(trip.message, false); return false }
      fishingToken = trip.token
      island.setFishing(true)
      try { localStorage.setItem(saveKey, JSON.stringify(farm)) } catch { saveAvailable = false }
      return true
    },
    onCancel: closeDialog,
    onAgain: mountFishing,
    onFinish({ catches }) {
      const token = fishingToken
      fishingToken = undefined
      island.setFishing(false)
      if (token === undefined) return false
      perform(() => finishFishingTrip(farm, token, catches), false, true)
      return getFishAction(farm).available
    },
  })
  host.querySelector<HTMLButtonElement>('.fishing-controls .fishing-action')?.focus({ preventScroll: true })
}

function pastryChoices() {
  return panelTabs('pastry-shape', pastryShape, workshopShapes.map(shape => [shape, workshopDefinitions[shape].name]))
}

function villageProjectCard() {
  const project = getVillageProject(farm)
  if (project.status === 'completed') return nav(button('Set sail', 'sail', farm.boatOwned, { value: 'village' }))
  const unlocked = project.unlocked
  const finishing = unlocked && farm.coins >= project.coins && project.items.every(({item, delivered, available}) => delivered + available >= item.quantity)
  const buildAction = finishing || project.items.every(({item, delivered}) => delivered >= item.quantity)
  return `<div class="harbour-preview"><img src="${iconUrl('village-plate')}" alt="Lavender Harbour cottages, workshop and supper table"></div>
    ${unlocked ? '' : `<ul class="dialog-list">${row('ui-market', 'Fair visitors', `${Math.min(3, farm.fairGuestsServed)}/3`)}${isProjectComplete(farm, 'fair') ? '' : row('ui-market', 'Market fair', '', button('Projects', 'fair-project'))}</ul>`}
    <ul class="ingredients">${deliveryItems(project.items)}</ul>
    ${nav(button(buildAction ? 'Build' : 'Deliver', 'build-village', project.status === 'ready', buildAction ? { cost: { icon: 'coin', amount: project.coins } } : {}), button('Pastry workshop', 'workshop', isProjectComplete(farm, 'fair'), { secondary: true }))}`
}

function neighboursCard() {
  const homes = getVillageHomeCount(farm)
  const resident = farm.village.residents[villageSlot]
  return `${panelTabs('village-slot', String(villageSlot), [['0', 'Cottage 1'], ['1', 'Cottage 2']])}
    ${villageSlot >= homes ? `<p class="dialog-status">Shared suppers · ${Math.min(2, farm.village.meals)}/2 · one per day</p>${nav(button('Set the table', 'village-meal'))}` : `
    <div class="resident-cards">${residentIds.map(id => {
      const def = residentDefinitions[id]
      const service = getResidentService(farm, id, pastryShape)
      const here = resident === id
      return `<section class="resident-card" data-present="${here}">${icon(`ui-${id}`, 'resident-portrait')}<h2>${def.name}</h2><p>${def.role}</p>
        ${here ? (id === 'bea' ? `<div class="resident-patterns">${pastryChoices()}</div><ul class="ingredients">${[{ kind: 'produce', item: 'wheat', quantity: 4 }, { kind: 'eggs', quantity: 2 }].map(item => stockTile(item as StockItem)).join('')}</ul>${button('Bake ×3', 'resident-service', service.available, { value: id })}`
          : button(farm.village.scouting ? 'Route ready · +1 catch' : 'Scout · +1 catch', 'resident-service', service.available, { value: id }))
        : button('Invite', 'invite-resident', true, { value: id })}
        ${here&&!service.available?`<p class="dialog-status">${service.label}</p>`:''}
      </section>`
    }).join('')}</div>`}
    ${nav(button('Pastry workshop', 'workshop'), button('Supper table', 'village-meal', true, { secondary: true }))}`
}

type PanelVisit = {
  panel: Panel; marketTab: 'buy'|'sell'|'orders'|'projects'; bagTab: 'seeds'|'harvest'; archiveGroup: ArchiveGroup;
  treeSlot: number; previewSeed: CropId; specializationBuilding: BuildingId; previewSpecialization: BuildingBranch | undefined;
  irrigationMode: 'row'|'pair'; villageSlot: number; pastryShape: WorkshopShape;
  workshopRecipe: 'pastry'|'bread'; cookingDish: DishId; seedPickerBed: number | undefined; scroll: number; focus: string | undefined;
}
const panelHistory: PanelVisit[] = []
function focusKey(button:HTMLButtonElement){return ['data-action','data-value','data-crop','data-panel','aria-label'].map(name=>button.getAttribute(name)??'').join('\u001f')}
function leaveScene(){if(panelHistory.length)goBack();else closeDialog()}
function rememberPanel(): PanelVisit {
  const focused = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null
  return {panel:panel!,marketTab,bagTab,archiveGroup,treeSlot,previewSeed,specializationBuilding,previewSpecialization,
    irrigationMode,villageSlot,pastryShape,workshopRecipe,cookingDish,seedPickerBed,scroll:dialogContent.scrollTop,focus:focused?focusKey(focused):undefined}
}
function goBack() {
  const previous=panelHistory.pop()
  if(!previous)return
  marketTab=previous.marketTab;bagTab=previous.bagTab;archiveGroup=previous.archiveGroup;treeSlot=previous.treeSlot
  previewSeed=previous.previewSeed;specializationBuilding=previous.specializationBuilding;previewSpecialization=previous.previewSpecialization
  irrigationMode=previous.irrigationMode;villageSlot=previous.villageSlot;pastryShape=previous.pastryShape
  workshopRecipe=previous.workshopRecipe;cookingDish=previous.cookingDish
  seedPickerBed=previous.seedPickerBed
  openPanel(previous.panel,false)
  requestAnimationFrame(()=>{
    dialogContent.scrollTop=previous.scroll
    const target=Array.from(dialogContent.querySelectorAll<HTMLButtonElement>('button')).find(button=>focusKey(button)===previous.focus&&!button.disabled)
    ;(target??backButton).focus({preventScroll:true})
  })
}
function drawPanel() {
  if (!panel) return
  if (panel === 'fishing' && fishingGame || panel === 'workshop' && workshopGame || panel === 'cookery' && cookeryGame) return
  requirementLinks.clear()
  const sceneBack=dialog.querySelector<HTMLButtonElement>('.scene-back')!
  sceneBack.hidden=panelHistory.length===0||panel!=='fishing'&&panel!=='workshop'&&panel!=='cookery'
  sceneBack.setAttribute('aria-label',panelHistory.length?`Back to ${panelTitles[panelHistory.at(-1)!.panel]}`:'Back')
  backButton.hidden=panelHistory.length===0
  backButton.setAttribute('aria-label',panelHistory.length?`Back to ${panelTitles[panelHistory.at(-1)!.panel]}`:'Back')
  dialog.querySelectorAll<HTMLButtonElement>('.dialog-destinations [data-panel]').forEach(button=>button.setAttribute('aria-current',String(button.dataset.panel===panel)))
  const title = panel === 'specialize' ? `${buildingDefinitions[specializationBuilding].name} Lv. 3`
    : panel === 'workshop' && workshopRecipe === 'bread' ? 'Farmhouse bread' : panelTitles[panel]
  dialogTitle.textContent = panelBanners[panel] ?? title
  dialogTitle.setAttribute('aria-label', title)
  dialog.dataset.panel = panel
  dialogEmblem.src = iconUrl(panel === 'specialize' ? `upgrade-${specializationBuilding}-card` : panelEmblems[panel])
  const focused = document.activeElement instanceof HTMLButtonElement && dialogContent.contains(document.activeElement)
    ? document.activeElement
    : undefined

  switch (panel) {
    case 'market':
      dialogContent.innerHTML = marketCards()
      break
    case 'inventory':
    case 'seeds': {
      const inventory = panel === 'inventory'
      const harvest = inventory && bagTab === 'harvest'
      dialogContent.innerHTML = `${inventory ? panelTabs('bag-tab', bagTab, [['seeds', 'Seeds'], ['harvest', 'Goods'], ['archive', 'Archive']]) : ''}
        ${harvest ? `<ul class="dialog-list">
          ${row('tool-feed', 'Chicken feed', quantity(farm.feed, 'serving'))}
          ${goods().map(({ image, name, count, trait }) => row(image, name, `×${count}`, '', trait)).join('')}
          ${treeIds.map((tree) => row('orchard', `${treeDefinitions[tree].name} saplings`, `×${farm.saplings[tree]}`)).join('')}
        </ul>` : seedCards()}`
      break
    }
    case 'archive':
      dialogContent.innerHTML = panelTabs('archive-group', archiveGroup, [['crops', 'Crops'], ['orchard', 'Orchard'], ['coop', 'Coop'], ['shore', 'Shore'], ['bay', 'Bay']])
        + archiveCards(farm, archiveGroup, (name, trait) => itemIcon(archiveIcons[name] ?? name, trait))
      break
    case 'hive': {
      const honey = getCapeHoney(farm)
      const harvested = farm.capeHoneyOn === farm.day
      const upgrade = getCapeUpgrade(farm)
      dialogTitle.textContent = farm.capeLevel >= 2 ? 'Flower Apiary' : 'Cape Hive'
      dialogTitle.setAttribute('aria-label', dialogTitle.textContent)
      dialogContent.innerHTML = `<p class="dialog-intro">${harvested ? 'More honey tomorrow.'
        : honey.blooms ? `${honey.blooms}/${capeFlowerSlotCount} flower beds in bloom.` : 'Flowers bloom after a night at Cozy Farm.'}</p>
        <ul class="dialog-list">${row('ui-honey', 'Flower honey', `×${honey.honey}`)}
          ${honey.windHoney ? row('ui-wind-honey', 'Wind honey', `×${honey.windHoney}`) : ''}
          ${getCapeWax(farm) ? row('ui-beeswax', 'Beeswax', `×${getCapeWax(farm)}`) : ''}</ul>
        ${nav(button(harvested ? 'Collected' : 'Collect honey', 'collect-honey', honey.available),
          upgrade ? button('Upgrade', 'cape-upgrade', true, { secondary: true }) : button('Honey kitchen', 'visit-honey-kitchen', true, { secondary: true }))}`
      break
    }
    case 'cape-upgrade': {
      const upgrade = getCapeUpgrade(farm)
      if (!upgrade) { dialogContent.innerHTML = ''; break }
      dialogTitle.textContent = upgrade.name
      dialogTitle.setAttribute('aria-label', upgrade.name)
      dialogContent.innerHTML = `<div class="cape-upgrade-art">${icon(upgrade.nextLevel === 2 ? 'cape-apiary' : 'cape-honey-kitchen')}</div>
        ${upgrade.nextLevel === 2 ? `<ul class="dialog-list">${row('ui-honey', 'Flower honey', '+1 with three blooms')}${row('ui-beeswax', 'Beeswax', '+1 per harvest')}</ul>`
          : `<div class="cape-unlocks">${capeDishIds.map((dish) => icon(dishIcons[dish])).join('')}</div>`}
        <ul class="ingredients">${upgrade.items.map(stockTile).join('')}</ul>
        ${upgrade.nextLevel === 2 && getCapeHoney(farm).blooms < capeFlowerSlotCount ? '<p class="dialog-status">Three flower beds in bloom</p>' : ''}
        ${nav(button('Build', 'build-cape-upgrade', upgrade.available, { context: upgrade.name, cost: { icon: 'coin', amount: upgrade.coins } }))}`
      break
    }
    case 'honey-kitchen': {
      dialogContent.innerHTML = recipeCards(capeDishIds)
      break
    }
    case 'guest': {
      const guest = getFairGuest(farm)
      if (!guest) { dialogContent.innerHTML = ''; break }
      dialogTitle.textContent = guest.name
      dialogTitle.setAttribute('aria-label', `${guest.name}, fair visitor`)
      const ready = ingredientCount(farm, guest.item) >= guest.item.quantity
      dialogContent.innerHTML = guest.served ? `<p class="dialog-status">Another visitor arrives tomorrow.</p>${button('Rest until morning','visit-rest')}`
        : `<ul class="ingredients">${stockTile(guest.item)}</ul>
          <ul class="dialog-list">${row('coin', 'Coins', `+${guest.reward}`)}
            ${row(`ui-seed-${guest.seeds.crop}`, `${cropDefinitions[guest.seeds.crop].name} seeds`, `+${guest.seeds.count}`)}</ul>
          ${nav(button('Serve', 'serve-guest', ready))}`
      break
    }
    case 'coop':
      dialogContent.innerHTML = `<div class="coop-tools"><span aria-label="Flock happiness">${icon('tool-hen')} ${farm.chickenHappiness}/${maxChickenHappiness}</span>
        ${button('Upgrades', 'upgrades', true, { secondary: true })}</div>
        <ul class="dialog-list">
          ${flockFeedRow()}
          ${row('egg', 'Eggs', `×${farm.eggsReady}`, button('Collect eggs', 'collect', farm.eggsReady > 0))}
          ${farm.coopSpecialization === 'hatchery' && farm.flockSize < maxFlockSize
            ? row('egg', 'Incubator', farm.hatchDay === null ? `${farm.eggs}/1 egg` : quantity(farm.hatchDay - farm.day, 'night'),
              farm.hatchDay === null ? button('Set egg', 'incubate-egg', farm.eggs > 0) : '') : ''}
          ${farm.coopSpecialization === 'packing' ? row('ui-egg-crate', `Egg crates · ${farm.eggCrates}`, `${farm.eggs}/${eggsPerCrate} eggs`,
            button('Pack', 'pack-egg-crate', farm.eggs >= eggsPerCrate, { context: 'egg crate' })) : ''}
          ${farm.buildingLevels.coop >= 2 ? row('ui-egg-basket', `Egg baskets · ${farm.eggBaskets}`, `${farm.eggs}/${eggsPerBasket} eggs`,
            button('Pack', 'pack-egg-basket', farm.eggs >= eggsPerBasket, { context: 'egg basket' })) : ''}
          ${Array.from({ length: farm.flockSize }, (_, index) => {
            const petted = farm.pettedChickens.includes(index)
            return row('tool-hen', `Hen ${index + 1}`, '',
              button(petted ? 'Petted' : 'Pet', 'pet', !petted, { value: index, context: `hen ${index + 1}` }))
          }).join('')}
        </ul>`
      break
    case 'rest':
      dialogContent.innerHTML = `${!farm.chickensFed ? `<ul class="dialog-list">${flockFeedRow()}</ul>` : ''}
        ${nav(button('Open kitchen', 'kitchen'), button('Building upgrades', 'upgrades', true, { secondary: true }))}
        <ul class="dialog-list">${row('moon', `Day ${farm.day + 1}`, '', button('Rest until morning', 'sleep'))}</ul>`
      break
    case 'journal': {
      const goal = currentTask()
      const groveActivities = farm.island === 'grove'
        ? row('fish', 'Sea bass', `${farm.fishCaughtToday.grove} / ${getFishLimit(farm, 'grove')} caught today`)
          + row('ui-sea-salt', 'Sea salt', farm.saltGatheredToday ? 'Gathered today' : 'Ready to gather at the salt flats')
        : ''
      dialogContent.innerHTML = goal
        ? `<p class="dialog-intro">${goal.detail}</p>
          <ul class="dialog-list">
            ${row('star', goal.label, `${goal.progress} / ${goal.target}${goal.reward === undefined ? '' : ` · ${goal.reward} coins on completion`}`)}
            ${groveActivities}
          </ul>${'action' in goal ? nav(button(goal.action.label, 'follow-task')) : ''}`
        : '<p class="dialog-status">All journal tasks complete.</p>'
      break
    }
    case 'settings':
      dialogContent.innerHTML = `<ul class="dialog-list">
          ${row('pack', 'Local save', saveAvailable ? 'Your farm saves in this browser after every action.' : 'This browser could not save your farm. You can keep playing for this session.')}
          ${row('gear', 'Controls', '', button('Farm guide', 'guide', true, { secondary: true }))}
        </ul>`
      break
    case 'guide': {
      const home=farm.island==='home',orchard=home||farm.island==='grove'
      const tile=(name:string,image:string,target:string,value?:string)=>`<button class="explore-tile" type="button" data-action="${target}"${value?` data-value="${value}"`:''}>${icon(image)}<strong>${name}</strong></button>`
      dialogContent.innerHTML=`<div class="explore-grid">
        ${tile('Islands','tool-boat','open-panel','boat')}${tile('Collections','orchard','open-panel','archive')}
        ${tile('Goods','ui-bag','open-panel','inventory')}${tile(home?'Market':'Home market','ui-market',home?'open-panel':'sail',home?'market':'home')}
        ${orchard?tile('Orchard','ui-tree-apple','open-panel','orchard')+tile('Fishing','tool-rod','open-panel','fishing'):''}
        ${home?tile('Farmhouse','upgrade-farmhouse-card','open-panel','rest')+tile('Coop','tool-hen','open-panel','coop')+tile('Upgrades','hammer','open-panel','upgrades'):''}
        ${home&&isProjectComplete(farm,'fair')||farm.island==='village'?tile('Pastry workshop','ui-handmade-round','open-panel','workshop'):''}
        ${farm.island==='cape'?tile('Apiary','ui-honey','open-panel','hive')+(farm.capeLevel>=3?tile('Honey kitchen','ui-honey-biscuits','open-panel','honey-kitchen'):''):''}
        ${farm.island==='village'?tile('Neighbours','ui-bea','open-panel','village')+tile('Supper','ui-grilled-fish','open-panel','village-meal'):''}
      </div><details class="controls-help"><summary>Controls</summary><p>Tap a place or use the arrow keys and Enter. Drag hens to play with them. Gold markers show ripe crops.</p></details>
      ${nav(button('Settings','open-panel',true,{value:'settings',secondary:true}))}`
      break
    }
    case 'workshop': {
      const bread = workshopRecipe === 'bread'
      const action = bread ? getCookAction(farm, 'farmhouseBread') : getWorkshopAction(farm)
      if (!action.available) {
        dialogContent.innerHTML = `<ul class="ingredients">${stockTile({ kind: 'produce', item: 'wheat', quantity: 2 })}${stockTile({ kind: 'eggs', quantity: 1 })}</ul><p class="dialog-status">${action.label}</p>`
        break
      }
      dialogContent.innerHTML = '<div class="workshop-host"></div>'
      workshopGame = createWorkshop(dialogContent.querySelector<HTMLElement>('.workshop-host')!, {
        onBake(shape) { return perform(() => bread ? cookDish(farm, 'farmhouseBread') : bakeWorkshop(farm, shape), false, true) }, onCancel: leaveScene,
      })
      break
    }
    case 'cookery': {
      const recipe = dishDefinitions[cookingDish]
      if (!getCookAction(farm, cookingDish).available) {
        dialogContent.innerHTML = `<ul class="ingredients">${recipe.ingredients.map(stockTile).join('')}</ul>${nav(button('Kitchen', 'kitchen'))}`
        break
      }
      dialogContent.innerHTML = '<div class="cookery-host"></div>'
      cookeryGame = createCookery(dialogContent.querySelector<HTMLElement>('.cookery-host')!, {
        recipe: { id: cookingDish, name: recipe.name, kind: cookingDish === 'orchardTart' ? 'decorate' : 'preserves', icon: iconUrl(dishIcons[cookingDish]),
          ingredients: recipe.ingredients.map(item => ({name: stockLabel(item).name, icon: iconUrl(stockLabel(item).image), count: item.quantity})) },
        onComplete() { return perform(() => cookDish(farm, cookingDish), false, true) },
        onCancel: leaveScene,
      })
      break
    }
    case 'village-project': dialogContent.innerHTML = villageProjectCard(); break
    case 'village': dialogContent.innerHTML = neighboursCard(); break
    case 'village-meal': {
      const meal = getVillageMeal(farm, pastryShape)
      dialogContent.innerHTML = `${pastryChoices()}<ul class="ingredients">${meal.items.map(stockTile).join('')}</ul>
        ${meal.served?`<p class="dialog-status">Next supper tomorrow</p>${button('Return Home','sail',true,{value:'home'})}`:nav(button('Share supper','share-meal',meal.available))}`
      break
    }
    case 'fishing': {
      const action = getFishAction(farm)
      if (action.available) mountFishing()
      else dialogContent.innerHTML = `<p class="dialog-status">${action.label}</p>${groveDockActions()}`
      break
    }
    case 'boat':
      dialogContent.innerHTML = `<div class="journey-list">${getIslandJourneys(farm).map(destination=>{
        const action=destination.nextAction,requirements=destination.requirements
        return `<article class="journey-card" data-island="${destination.id}" data-unlocked="${destination.unlocked}">
          <div class="journey-picture"><img src="${import.meta.env.BASE_URL}art/lavender/${destination.id==='grove'?'grove':destination.id==='cape'?'cape':destination.id==='village'?'village':'home'}-plate.webp" alt="" draggable="false"></div>
          <div class="journey-heading"><h2>${destination.name}</h2>${destination.current?'<span class="journey-here">Here</span>':destination.unlocked?'<span class="journey-open">✓</span>':''}</div>
          <p>${destination.description}</p>
          ${!destination.unlocked&&requirements.length?`<ul class="journey-requirements">${requirements.map(r=>requirementLink(`${icon(r.icon)}<span>${r.label}</span><strong>${r.complete?'✓':`${r.current}/${r.target}`}</strong>`,{kind:'journey',island:destination.id,id:r.id},'journey-requirement',r.label,r.complete)).join('')}</ul>`:''}
          ${action?button(action.label,action.target,action.enabled,{value:action.value,context:destination.name}):''}
        </article>`
      }).join('')}</div>`
      break
    case 'dock-project':
      dialogContent.innerHTML = projectCard('dock')
      break
    case 'harbor':
      dialogContent.innerHTML = harborCard()
      break
    case 'orchard':
      if (farm.island !== 'home' && farm.island !== 'grove') break
      dialogContent.innerHTML = `<p class="dialog-intro">Trees grow overnight. Mature trees bear fruit after you rest.</p>
        <ul class="dialog-list">${farm.trees[farm.island].map((_, index) => treeRow(index)).join('')}</ul>`
      break
    case 'tree': {
      if(farm.island!=='home'&&farm.island!=='grove')break
      const slot=farm.trees[farm.island][treeSlot],action=getTreeAction(farm,treeSlot)
      dialogTitle.textContent=slot?`${treeDefinitions[slot.tree].name} tree`:'Plant a tree'
      dialogTitle.setAttribute('aria-label',dialogTitle.textContent)
      if(slot){
        const definition=treeDefinitions[slot.tree],growing=slot.age<definition.days
        dialogContent.innerHTML=`<div class="tree-focus">${icon(`ui-tree-${slot.tree}`)}<strong>${growing?`${definition.days-slot.age} ${definition.days-slot.age===1?'night':'nights'} to grow`:slot.fruitReady?`${slot.fruitReady} fruit ready`:'More fruit tomorrow'}</strong>
          ${slot.fruitReady?button(`Pick ${slot.fruitReady} fruit`,'pick-fruit',action.available):button(farm.island==='home'?'Rest until morning':'Return Home',farm.island==='home'?'sleep':'sail',true,{value:farm.island==='home'?undefined:'home',secondary:true})}</div>`
      }else{
        dialogContent.innerHTML=`<div class="sapling-options">${treeIds.map(tree=>{
          const definition=treeDefinitions[tree],owned=farm.saplings[tree]>0
          return `<article class="sapling-option">${icon(`ui-tree-${tree}`)}<h2>${definition.name}</h2><span>${definition.days} nights to grow</span>${button(owned?'Plant':'Buy & plant','buy-plant-tree',owned||farm.coins>=definition.saplingPrice,{value:tree,context:`${definition.name} tree`,cost:owned?undefined:{icon:'coin',amount:definition.saplingPrice}})}</article>`
        }).join('')}</div>`
      }
      break
    }
    case 'upgrades': {
      const actions = {
        farmhouse: ['Kitchen', 'kitchen'], coop: ['Coop', 'visit-coop'], well: ['Irrigate', 'visit-well'],
      } as const
      dialogContent.innerHTML = `<p class="coin-balance">${icon('coin')} ${numberFormat.format(farm.coins)}<span class="sr-only"> coins</span></p>
        <ul class="dialog-list">${buildingIds.map((building) => {
          const definition = buildingDefinitions[building]
          const level = farm.buildingLevels[building]
          const [label, action] = actions[building]
          const branch = farm[`${building}Specialization`]
          return row(`upgrade-${building}-card`, branch ? branchDefinitions[branch].name : definition.name,
            level === 1 ? definition.benefit : `Lv. ${level}`,
            level >= 2 ? button(label, action, true, { secondary: true }) +
              (level === 2 ? button('Specialize', 'specialize', true, { value: building, context: definition.name }) : '')
              : button('Upgrade', 'upgrade-building', farm.coins >= definition.upgradePrice, {
                value: building, context: `${definition.name}, ${quantity(definition.upgradePrice, 'coin')}`,
                cost: { icon: 'coin', amount: definition.upgradePrice },
              }))
        }).join('')}</ul>`
      break
    }
    case 'specialize':
      dialogContent.innerHTML = specializationCards()
      break
    case 'irrigation':
      dialogContent.innerHTML = irrigationRows()
      break
    case 'kitchen': {
      const recipes = dishIds.filter((dish) => !dishDefinitions[dish].specialization && !dishDefinitions[dish].capeLevel
        && (dish !== 'honeyCake' || canSailTo(farm, 'cape')))
      const branch = farm.farmhouseSpecialization
      if (branch) recipes.unshift(specializationDefinitions[branch].dish)
      dialogContent.innerHTML = recipeCards(recipes)
      break
    }
  }

  if (focused) {
    const replacement = Array.from(dialogContent.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      .find((candidate) => candidate.dataset.action === focused.dataset.action && candidate.dataset.crop === focused.dataset.crop && candidate.dataset.value === focused.dataset.value)
    const nextFocus = replacement ?? closeButton
    nextFocus.focus({ preventScroll: true })
  }
}

function openPanel(next: Panel, remember = true) {
  if (island.isCrossing()) return
  if ((farm.island === 'cape' || farm.island === 'village') && (next === 'orchard' || next === 'tree' || next === 'fishing')) return
  if ((next === 'hive' && farm.island !== 'cape') || (next === 'guest' && (farm.island !== 'home' || !getFairGuest(farm)))) return
  if ((next === 'cape-upgrade' || next === 'honey-kitchen') && farm.island !== 'cape') return
  if (next === 'honey-kitchen' && farm.capeLevel < 3) return
  if(remember&&next!==panel){if(dialog.open&&panel)panelHistory.push(rememberPanel());else panelHistory.length=0}
  if (next !== 'seeds') seedPickerBed = undefined
  if (next !== panel) { stopFishing(); stopWorkshop(); stopCookery() }
  if (remember && next !== panel && (next === 'inventory' || next === 'seeds')) previewSeed = farm.selectedSeed
  if (remember && next !== panel && next === 'irrigation') irrigationMode = farm.wellSpecialization === 'pipes' ? 'pair' : 'row'
  if (next === 'archive' || next === 'boat') {
    farm.orientation[next === 'archive' ? 'collections' : 'islands'] = true
    try { localStorage.setItem(saveKey, JSON.stringify(farm)) } catch { saveAvailable = false }
    status()
  }
  panel = next
  toast.hidden = true
  dialogFeedback.hidden = true
  dialogFeedback.textContent = ''
  drawPanel()
  dialogContent.scrollTop = 0
  if (!dialog.open) dialog.showModal()
  const sceneEntry = next === 'workshop' ? dialogContent.querySelector<HTMLElement>('.workshop-close')
    : next === 'fishing' ? dialogContent.querySelector<HTMLElement>('.fishing-controls .fishing-action')
    : next === 'cookery' ? dialogContent.querySelector<HTMLElement>('.cookery-view') : null
  ;(sceneEntry ?? closeButton).focus({ preventScroll: true })
}

function closeDialog() {
  seedPickerBed = undefined
  stopFishing()
  stopWorkshop()
  stopCookery()
  panel = undefined
  panelHistory.length=0
  if (dialog.open) dialog.close()
}

function refresh() {
  status()
  island.render(farm)
  if (dialog.open) drawPanel()
}

function perform(action: () => { ok: boolean; message: string }, dismiss = false, resultVisible = false) {
  const result = action()
  if (result.ok) {
    if (dismiss && dialog.open) dialog.close()
    try {
      localStorage.setItem(saveKey, JSON.stringify(farm))
      saveAvailable = true
    } catch {
      saveAvailable = false
    }
    refresh()
  }
  if (dialog.open) {
    dialogFeedback.classList.toggle('sr-only', resultVisible && result.ok)
    dialogFeedback.hidden = false
    dialogFeedback.textContent = result.message
  } else {
    notify(result.message, result.ok, resultVisible)
  }
  return result.ok
}

const bedTools = {
  till: 'hoe',
  plant: 'seeds',
  water: 'water',
  harvest: 'basket',
} as const

const locationLabels = {
  well: 'Well · Refill watering can',
  coop: 'Chicken Coop · Feed and gather eggs',
  market: 'Island Market · Buy and sell',
  farmhouse: 'Farmhouse · Rest, cook, or upgrade',
  kitchen: 'Orchard kitchen',
  pier: 'Fishing Pier · Cast a line',
  boat: 'Boat Dock · Buy a boat or set sail',
  harbor: 'Harbor orders',
  salt: 'Salt Flats · Gather sea salt',
  tidepool: 'Tidepool · Look closer',
  hive: 'Cape Hive · Collect honey',
  'honey-kitchen': 'Honey Kitchen · Cook',
  guest: 'Fair visitor · See today’s request',
  'bay-display': 'Bay display · View discoveries',
  workshop: 'Pastry workshop', village: 'Neighbours', 'village-meal': 'Supper table',
}
const upgradedLocationLabels = { farmhouse: 'Farmhouse · Rest or upgrade', coop: 'Packing coop', well: 'Irrigation well' } as const

function updateFieldContext(index: number | undefined) {
  contextBed = index
  const bed = index === undefined || farm.island !== 'home' ? undefined : farm.beds[index]
  const hidden = !bed || !portraitView.matches || fieldViewButton.getAttribute('aria-pressed') !== 'true'
  if (contextCard.hidden !== hidden) contextCard.hidden = hidden
  if (hidden || !bed || index === undefined) return
  const action = getBedAction(farm, index)
  const label = bed.kind === 'crop' ? cropDefinitions[bed.crop].name : bed.kind === 'tilled' ? 'Tilled soil' : 'Bare soil'
  const refill = !action.available && action.kind === 'water'
  const chooseSeeds = !action.available && action.kind === 'plant'
  const title = action.kind === 'harvest' ? `${label} is ready` : refill ? 'Watering can is empty' : !action.available ? action.label : label
  const cta = refill ? 'Refill at well' : chooseSeeds ? 'Choose seeds'
    : action.kind === 'harvest' && bed.kind === 'crop' ? `Harvest +${cropDefinitions[bed.crop].yield}` : action.label
  const source = iconUrl(bed.kind === 'crop' ? bed.crop : bed.kind === 'tilled' ? 'tool-seeds' : 'tool-hoe')
  const copy = contextCard.querySelector<HTMLElement>('.context-copy')!
  if (copy.textContent !== title) copy.textContent = title
  if (contextButton.textContent !== cta) contextButton.textContent = cta
  const command = refill ? 'refill' : chooseSeeds ? 'context-seeds' : 'work-context'
  if (contextButton.dataset.action !== command) contextButton.dataset.action = command
  contextButton.hidden = !action.available && !refill && !chooseSeeds
  if (contextIcon.getAttribute('src') !== source) contextIcon.src = source
}

const island = createIsland(canvas, {
  moveHen(index, point) {
    perform(() => moveFarmHen(farm, index, point), false, true)
  },
  inspect(target) {
    updateFieldContext(target.kind === 'bed' ? target.index : undefined)
    if (target.kind === 'hen') return `Hen ${target.index + 1} · ${farm.pettedChickens.includes(target.index) ? 'Petted today' : 'Pet the hen'}`
    if (target.kind === 'shell' || target.kind === 'shoal-find') {
      const item = getShoreItem(farm, target)
      return item ? `${item.name} · Pick up` : ''
    }
    if (target.kind === 'tree') {
      if (farm.island !== 'home' && farm.island !== 'grove') return ''
      const slot = farm.trees[farm.island][target.index]
      const name = slot ? treeDefinitions[slot.tree].name : `Orchard Plot ${target.index + 1}`
      return `${name} · ${getTreeAction(farm, target.index).label}`
    }
    if (target.kind === 'village-home') return `Cottage ${target.index + 1} · ${target.index < getVillageHomeCount(farm) ? 'Invite a neighbour' : 'Share two suppers to open'}`
    if (target.kind === 'flower') {
      const bloom = getCapeBloom(farm, target.index)
      return `Flower bed ${target.index + 1} · ${bloom === 'empty' ? 'Plant flowers' : bloom === 'growing' ? 'Blooms tomorrow' : 'In bloom'}`
    }
    if (target.kind !== 'bed') {
      const kind = target.kind
      if (kind === 'kitchen' && farm.farmhouseSpecialization) {
        return specializationDefinitions[farm.farmhouseSpecialization].name
      }
      if (kind === 'coop' || kind === 'well') {
        const branch = farm[`${kind}Specialization`]
        if (branch) return branchDefinitions[branch].name
      }
      if ((kind === 'farmhouse' || kind === 'coop' || kind === 'well') && farm.buildingLevels[kind] >= 2) {
        return upgradedLocationLabels[kind]
      }
      return locationLabels[kind]
    }
    const bed = farm.beds[target.index]
    if (!bed) return 'Garden bed'
    const action = getBedAction(farm, target.index)
    if (bed.kind !== 'crop') {
      const soil = bed.kind === 'empty' ? 'Bare soil' : 'Tilled soil'
      return `${soil} · ${action.label}`
    }
    const name = cropDefinitions[bed.crop].name
    const stage = getBedStage(bed)
    if (stage === 'ripe') return `${name} · Ready to harvest`
    const growth = stage === 'seedling' && !bed.watered ? 'Freshly sown' : 'Growing'
    const moisture = bed.watered ? 'Watered today' : action.available ? 'Needs water' : 'Needs water (can empty)'
    return `${name} · ${growth} · ${moisture}`
  },
  activate: activateTarget,
})

function toggleFieldView() {
  const fieldView = island.toggleFieldView()
  fieldViewButton.setAttribute('aria-pressed', String(fieldView))
  fieldViewButton.querySelector('span')!.textContent = fieldView ? 'Island view' : 'Field view'
  fieldViewButton.querySelector('img')!.src = iconUrl(fieldView ? 'island' : 'field')
  updateFieldContext(contextBed)
}

fieldLayout.addEventListener('change', ({ matches }) => {
  if ((matches && farm.island === 'home') !== (fieldViewButton.getAttribute('aria-pressed') === 'true')) toggleFieldView()
})

function requestSeedChoice(index: number) {
  island.visit({kind:'bed',index})
  seedPickerBed = index
  activeTool = 'seeds'
  openPanel('seeds')
}

function chooseSeed(crop: CropId) {
  previewSeed = crop
  if (farm.seeds[crop] === 0) { drawPanel(); return }
  const bed = seedPickerBed
  activeTool = 'seeds'
  if (perform(() => selectSeed(farm,crop),false,true) && bed !== undefined) {
    closeDialog()
    island.focusTarget({kind:'bed',index:bed})
  }
}

function activateTarget(target: IslandTarget) {
  if (island.isCrossing()) return
  if ((farm.island === 'cape' || farm.island === 'village') && (target.kind === 'tree' || target.kind === 'pier' || target.kind === 'salt')) return
  if ((target.kind === 'shell' || target.kind === 'shoal-find' || target.kind === 'salt') && farm.island !== 'grove') return
  if (target.kind === 'flower') {
    if (farm.island !== 'cape') return
    if (getCapeBloom(farm, target.index) === 'empty') {
      island.workCape({ kind: 'flower', index: target.index }, () => perform(() => plantCapeFlower(farm, target.index)))
    } else {
      island.visit(target)
      openPanel('hive')
    }
    return
  }
  if (target.kind === 'shell' || target.kind === 'shoal-find') {
    island.pickShore(target, () => perform(() =>
      target.kind === 'shell' ? collectShell(farm, target.index) : collectShoalFind(farm, target.id)))
    return
  }
  if (target.kind === 'bed') {
    const index = target.index
    if (needsSeedChoice(farm,index)) { requestSeedChoice(index); return }
    island.workBed(index, () => {
      const action = getBedAction(farm, index)
      return farm.island === 'home' && action.available ? action.kind : 'wait'
    }, () => {
      if (farm.island !== 'home') return
      if (needsSeedChoice(farm,index)) { requestSeedChoice(index); return }
      const action = getBedAction(farm, index)
      if (action.kind !== 'wait' && action.available) activeTool = bedTools[action.kind]
      perform(() => workBed(farm, index))
    })
    return
  }
  island.visit(target)
  switch (target.kind) {
    case 'well':
      activeTool = 'water'
      status()
      if (farm.buildingLevels.well >= 2) openPanel('irrigation')
      else perform(() => refillWater(farm))
      break
    case 'coop':
      activeTool = 'coop'
      status()
      openPanel('coop')
      break
    case 'market': openPanel('market'); break
    case 'farmhouse': openPanel('rest'); break
    case 'kitchen': openPanel('kitchen'); break
    case 'hive': openPanel('hive'); break
    case 'honey-kitchen': openPanel('honey-kitchen'); break
    case 'guest': openPanel('guest'); break
    case 'workshop': workshopRecipe = 'pastry'; openPanel('workshop'); break
    case 'village': openPanel(farm.island === 'home' ? 'village-project' : 'village'); break
    case 'village-meal': openPanel('village-meal'); break
    case 'village-home': villageSlot = target.index; openPanel('village'); break
    case 'bay-display':
      if (hasBayDisplay(farm)) {
        archiveGroup = 'bay'
        openPanel('archive')
      }
      break
    case 'harbor': if (farm.island === 'grove' && getHarborOrder(farm)) openPanel('harbor'); break
    case 'tidepool': break
    case 'pier':
      activeTool = 'rod'
      status()
      openPanel('fishing')
      break
    case 'boat':
      activeTool = 'boat'
      status()
      openPanel('boat')
      break
    case 'tree':
      treeSlot = target.index
      openPanel('tree')
      break
    case 'hen':
      if (farm.pettedChickens.includes(target.index)) {
        notify('Your hen gives another happy cluck.')
      } else {
        perform(() => petChicken(farm, target.index), false, true)
      }
      break
    case 'salt': perform(() => gatherSeaSalt(farm)); break
  }
}

function useHotbar(tool: Tool) {
  if (farm.island === 'village' && tool !== 'boat') {
    workshopRecipe = 'pastry'
    openPanel(tool === 'basket' || tool === 'seeds' ? 'workshop' : 'village')
    return
  }
  if (farm.island === 'cape') {
    if (tool === 'basket') { activeTool = tool; status(); activateTarget({ kind: 'hive' }); return }
    if (tool !== 'boat') {
      notify(tool === 'seeds' ? 'Select an empty meadow bed to plant flowers.' : 'Visit the flower beds or the hive.')
      return
    }
  }
  if (farm.island === 'grove' && tool !== 'rod' && tool !== 'boat' && tool !== 'basket') {
    notify('Sail back to Cozy Farm to tend your crops and chickens.')
    return
  }
  activeTool = tool
  status()
  switch (tool) {
    case 'hoe':
      canvas.focus({ preventScroll: true })
      notify('Select an empty garden bed to till it.')
      break
    case 'water':
      if (farm.buildingLevels.well >= 2) {
        activateTarget({ kind: 'well' })
        break
      }
      canvas.focus({ preventScroll: true })
      notify(farm.water ? 'Select a dry crop to water it.' : 'Visit the well to refill your watering can.')
      break
    case 'seeds':
      openPanel('seeds')
      break
    case 'feed':
      island.visit({ kind: 'coop' })
      perform(() => feedChickens(farm))
      break
    case 'basket':
      if (farm.island === 'grove') {
        openPanel('orchard')
      } else {
        canvas.focus({ preventScroll: true })
        notify('Select a bed with a gold marker to harvest it.')
      }
      break
    case 'coop':
      activateTarget({ kind: 'coop' })
      break
    case 'rod': activateTarget({ kind: 'pier' }); break
    case 'boat': activateTarget({ kind: 'boat' }); break
  }
}

function highlightControl(element: HTMLElement | null) {
  if (!element) return
  dialogContent.querySelectorAll('.guidance-target').forEach(node => node.classList.remove('guidance-target'))
  const target = element instanceof HTMLButtonElement && element.disabled ? element.closest<HTMLElement>('.dialog-row') ?? element : element
  if (!target.matches('button:not(:disabled),[tabindex]')) target.tabIndex = -1
  target.classList.add('guidance-target')
  target.scrollIntoView({block:'center',behavior:'instant'})
  target.focus({preventScroll:true})
}

async function showRequirement(requirement: Requirement, origin?: HTMLElement, depth = 0): Promise<void> {
  const hint = getRequirementHint(farm, requirement)
  const {target,value} = hint.action
  if (target === 'sail') {
    const destination = islandIds.find(id => id === value)
    if (!destination || !canSailTo(farm,destination) || destination === farm.island || depth >= 3) { openPanel('boat'); return }
    if (fieldViewButton.getAttribute('aria-pressed') === 'true') toggleFieldView()
    closeDialog()
    await island.crossIsland(() => perform(() => sail(farm,destination),false,true))
    await showRequirement(requirement,undefined,depth+1)
    return
  }
  if (target === 'guide-delivery') {
    const container = origin?.closest('section,article') ?? dialogContent
    const delivery = container.querySelector<HTMLElement>('[data-action="deliver-project"],[data-action="deliver-harbor"],[data-action="build-village"]')
    if (delivery?.dataset.action === 'build-village' && !getVillageProject(farm).unlocked) {
      await showRequirement({kind:'journey',island:'village',id:'visitors'},undefined,depth+1)
      return
    }
    highlightControl(delivery)
    return
  }
  let place: IslandTarget | undefined
  if (target === 'focus-bed' || target === 'focus-flower' || target === 'focus-shell' || target === 'visit-tree') {
    place = {kind:target==='focus-bed'?'bed':target==='focus-flower'?'flower':target==='focus-shell'?'shell':'tree',index:Number(value)}
  } else if (target === 'focus-shoal' && (value === 'glass' || value === 'pearl')) place = {kind:'shoal-find',id:value}
  else if (target === 'focus-place') place = {kind:value as 'farmhouse'|'well'|'boat'|'salt'|'harbor'}
  else {
    const places: Record<string, IslandTarget['kind']> = {'visit-coop':'coop','visit-pier':'pier','visit-hive':'hive','visit-guest':'guest',kitchen:'farmhouse',workshop:'workshop'}
    if (places[target]) place = {kind:places[target]} as IslandTarget
  }
  if (place) {
    closeDialog()
    if (place.kind !== 'bed' && fieldViewButton.getAttribute('aria-pressed') === 'true') toggleFieldView()
    island.focusTarget(place)
    if (hint.notice) notify(hint.notice)
    return
  }
  if (target === 'visit-market') { if(value==='buy'||value==='sell'||value==='orders')marketTab=value;openPanel('market') }
  else if (target === 'show-upgrade') { openPanel('upgrades');highlightControl(dialogContent.querySelector<HTMLElement>(`[data-value="${value}"]`));return }
  else if (target === 'upgrades') openPanel('upgrades')
  else if (target === 'project-dock') openPanel('dock-project')
  else if (target === 'visit-harbor') openPanel('harbor')
  else if (target === 'fair-project') {marketTab='projects';openPanel('market')}
  else if (target === 'village-project') openPanel('village-project')
  else if (target === 'open-panel' && value && value in panelTitles) openPanel(value as Panel)
  else {openPanel('boat');return}
  const selector = hint.selector ?? (target === 'visit-market' ? marketTab === 'sell' ? '[data-action="sell-item"]'
    : marketTab === 'orders' ? '[data-action="deliver-order"]:not(:disabled)' : '[data-action="buy-seeds"],[data-action="buy-feed"]'
    : target === 'project-dock' || target === 'fair-project' ? '[data-action="deliver-project"]'
    : target === 'visit-harbor' ? '[data-action="deliver-harbor"]'
    : target === 'village-project' ? '[data-action="build-village"]' : 'button[data-action]:not(:disabled)')
  highlightControl(dialogContent.querySelector<HTMLElement>(selector))
  if (hint.notice) notify(hint.notice)
}

app.addEventListener('click', async (event) => {
  if (island.isCrossing()) return
  if (!(event.target instanceof Element)) return
  const control = event.target.closest<HTMLButtonElement>('button')
  if (!control || control.disabled) return
  if (control.dataset.panel) {
    if (control === taskCard && control.dataset.panel === 'market') marketTab = 'orders'
    openPanel(control.dataset.panel as Panel)
    return
  }
  if (control.dataset.tool && control.closest('.hotbar')) {
    useHotbar(control.dataset.tool as Tool)
    return
  }
  const crop = cropIds.find((id) => id === control.dataset.crop)
  let value = control.dataset.value
  let action = control.dataset.action
  if (action === 'follow-task') {
    const task = getDiscoveryTask(farm, farm.orientation)
    if (!task) { openPanel('journal'); return }
    action = task.action.target; value = task.action.value
    if (action === 'visit-market' && (value === 'buy' || value === 'sell' || value === 'orders')) marketTab = value
  }
  switch (action) {
    case 'show-requirement': {
      const requirement = value === undefined ? undefined : requirementLinks.get(value)
      if (requirement) await showRequirement(requirement,control)
      break
    }
    case 'focus-bed':
    case 'focus-flower': {
      const index = Number(value)
      if (!Number.isInteger(index)) break
      closeDialog()
      island.focusTarget({kind: action === 'focus-bed' ? 'bed' : 'flower', index})
      break
    }
    case 'back': goBack(); break
    case 'open-panel': if(value&&value in panelTitles)openPanel(value as Panel);break
    case 'field-view': toggleFieldView(); break
    case 'work-context': if (contextBed !== undefined) activateTarget({ kind: 'bed', index: contextBed }); break
    case 'context-seeds':
      if (contextBed !== undefined) requestSeedChoice(contextBed)
      else openPanel('seeds')
      break
    case 'market-tab':
      if ((value === 'buy' || value === 'sell' || value === 'orders' || value === 'projects') && value !== marketTab) {
        marketTab = value
        dialogFeedback.hidden = true
        dialogFeedback.textContent = ''
        drawPanel()
        dialogContent.scrollTop = 0
      }
      break
    case 'deliver-order': {
      const lane = orderLanes.find((id) => id === value)
      if (lane) perform(() => deliverMarketOrder(farm, lane), false, farm.progress.sell > 0)
      break
    }
    case 'project-dock': openPanel('dock-project');break
    case 'visit-harbor': openPanel('harbor');break
    case 'deliver-harbor': perform(() => deliverHarborOrder(farm), false, true); break
    case 'deliver-project': {
      const id = projectIds.find((project) => project === value)
      if (!id) break
      const project = getProject(farm, id)
      const finishing = project.status === 'ready' && project.items.every(({ item, delivered, available }) =>
        delivered + available === item.quantity)
      if (perform(() => deliverProject(farm, id), finishing, true) && isProjectComplete(farm, id)) island.showProject(id)
      break
    }
    case 'bag-tab':
      if (value === 'archive') { openPanel('archive'); break }
      if (value === 'seeds' || value === 'harvest') { bagTab = value; drawPanel(); dialogContent.scrollTop = 0 }
      break
    case 'archive-group':
      if (value === 'crops' || value === 'orchard' || value === 'coop' || value === 'shore' || value === 'bay') {
        archiveGroup = value
        drawPanel()
        dialogContent.scrollTop = 0
      }
      break
    case 'preview-seed':
      if (value && cropIds.includes(value as CropId)) chooseSeed(value as CropId)
      break
    case 'sell': perform(() => sellProduce(farm), false, farm.progress.sell > 0); break
    case 'sell-item': if (value) perform(() => sellMarketItem(farm, value), false, farm.progress.sell > 0); break
    case 'buy-feed': perform(() => buyFeed(farm)); break
    case 'upgrade-can': perform(() => upgradeCan(farm), false, true); break
    case 'buy-seeds':
      if (crop && perform(() => buySeeds(farm,crop)) && panel === 'seeds') chooseSeed(crop)
      break
    case 'feed': perform(() => feedChickens(farm), false, farm.progress.feed > 0); break
    case 'collect': perform(() => collectEggs(farm)); break
    case 'pack-egg-basket': perform(() => packEggBasket(farm), false, true); break
    case 'pack-egg-crate': perform(() => packEggCrate(farm), false, true); break
    case 'incubate-egg': perform(() => incubateEgg(farm)); break
    case 'visit-rest':
    case 'sleep': {
      const flockSize = farm.flockSize
      if (perform(() => endDay(farm), true) && farm.flockSize > flockSize) {
        island.showHatch()
        notify('A new hen joined the flock.')
      }
      break
    }
    case 'refill':
      island.visit({ kind: 'well' })
      activeTool = 'water'
      perform(() => refillWater(farm))
      break
    case 'visit-well': activateTarget({ kind: 'well' }); break
    case 'irrigation-mode':
      if (value === 'row' || value === 'pair') { irrigationMode = value; drawPanel() }
      break
    case 'irrigate-row':
    case 'irrigate-pair': {
      const row = Number(value)
      const pair = control.dataset.action === 'irrigate-pair'
      const { targets } = pair ? getIrrigationPair(farm, row) : getIrrigationRow(farm, row)
      if (perform(() => pair ? irrigatePair(farm, row) : irrigateRow(farm, row), true)) island.showIrrigation(targets)
      break
    }
    case 'visit-coop': activateTarget({ kind: 'coop' }); break
    case 'visit-market': activateTarget({ kind: 'market' }); break
    case 'visit-pier': activateTarget({ kind: 'pier' }); break
    case 'visit-hive': activateTarget({ kind: 'hive' }); break
    case 'visit-honey-kitchen': activateTarget({ kind: 'honey-kitchen' }); break
    case 'cape-upgrade': openPanel('cape-upgrade'); break
    case 'build-cape-upgrade': perform(() => upgradeCape(farm), true); break
    case 'visit-guest': activateTarget({ kind: 'guest' }); break
    case 'bay-display': activateTarget({ kind: 'bay-display' }); break
    case 'collect-honey':
      closeDialog()
      island.workCape({ kind: 'hive' }, () => perform(() => collectCapeHoney(farm)))
      break
    case 'serve-guest': perform(() => serveFairGuest(farm), true); break
    case 'visit-boat': activateTarget({ kind: 'boat' }); break
    case 'visit-tree': activateTarget({ kind: 'tree', index: Number(value) }); break
    case 'pet': activateTarget({ kind: 'hen', index: Number(value) }); break
    case 'gather-salt': activateTarget({ kind: 'salt' }); break
    case 'guide': openPanel('guide'); break
    case 'orchard': openPanel('orchard'); break
    case 'upgrades': openPanel('upgrades'); break
    case 'specialize': {
      const building = buildingIds.find((id) => id === value)
      if (building && farm.island === 'home' && farm.buildingLevels[building] === 2) {
        specializationBuilding = building
        previewSpecialization = undefined
        openPanel('specialize')
      }
      break
    }
    case 'preview-specialization':
      previewSpecialization = branchChoices[specializationBuilding].find((id) => id === value)
      drawPanel()
      break
    case 'build-specialization': {
      const branch = branchChoices[specializationBuilding].find((id) => id === value)
      if (branch && perform(() => branch === 'bakery' || branch === 'preserves'
        ? specializeFarmhouse(farm, branch) : specializeFacility(farm, branch), true)) {
        island.showUpgrade(specializationBuilding)
      }
      break
    }
    case 'kitchen':
      island.visit({ kind: farm.buildingLevels.farmhouse >= 2 ? 'kitchen' : 'farmhouse' })
      openPanel('kitchen')
      break
    case 'close': closeDialog(); break
    case 'workshop': workshopRecipe = 'pastry'; openPanel('workshop'); break
    case 'open-village': openPanel('village'); break
    case 'village-project': openPanel('village-project'); break
    case 'fair-project': marketTab = 'projects'; openPanel('market'); break
    case 'visit-cottage': if (value !== undefined && Number.isInteger(Number(value))) activateTarget({ kind: 'village-home', index: Number(value) }); break
    case 'village-meal':
      if (value && workshopShapes.includes(value as WorkshopShape)) pastryShape = value as WorkshopShape
      openPanel('village-meal'); break
    case 'build-village': perform(() => contributeVillage(farm), false, true); break
    case 'village-slot': villageSlot = Number(value) === 1 ? 1 : 0; drawPanel(); break
    case 'invite-resident': {
      const id = residentIds.find(id => id === value)
      if (id) perform(() => inviteResident(farm, id, villageSlot), true, true)
      break
    }
    case 'pastry-shape': {
      const shape = workshopShapes.find(shape => shape === value)
      if (shape) { pastryShape = shape; drawPanel() }
      break
    }
    case 'share-meal': perform(() => serveVillageMeal(farm, pastryShape), true, true); break
    case 'resident-service': {
      const id = residentIds.find(id => id === value)
      if (id) perform(() => runResidentService(farm, id, pastryShape), true, true)
      break
    }
    case 'buy-boat': perform(() => buyBoat(farm), false, true); break
    case 'sail': {
      const destination = islandIds.find((id) => id === value)
      if (destination && destination !== farm.island && canSailTo(farm, destination)) {
        if (fieldViewButton.getAttribute('aria-pressed') === 'true') toggleFieldView()
        closeDialog()
        await island.crossIsland(() => {
          const sailed = perform(() => sail(farm, destination), false, true)
          if (sailed && destination === 'home' && fieldLayout.matches) toggleFieldView()
          return sailed
        })
        canvas.focus({ preventScroll: true })
      }
      break
    }
    case 'buy-plant-tree': {const tree=treeIds.find(id=>id===value);if(tree)perform(()=>buyAndPlantTree(farm,treeSlot,tree));break}
    case 'buy-sapling': {
      const tree = treeIds.find((id) => id === value)
      if (tree) perform(() => buySapling(farm, tree))
      break
    }
    case 'plant-tree': {
      const tree = treeIds.find((id) => id === value)
      if (tree) perform(() => plantTree(farm, treeSlot, tree))
      break
    }
    case 'pick-fruit': perform(() => pickFruit(farm, treeSlot)); break
    case 'upgrade-building': {
      const building = buildingIds.find((id) => id === value)
      if (building && perform(() => upgradeBuilding(farm, building), true)) island.showUpgrade(building)
      break
    }
    case 'cook': {
      const dish = dishIds.find((id) => id === value)
      if (dish === 'farmhouseBread' && getCookAction(farm, dish).available) {
        workshopRecipe = 'bread'
        openPanel('workshop')
      } else if (dish && ['orchardTart', 'appleJam', 'orchardPreserves'].includes(dish) && getCookAction(farm, dish).available) {
        cookingDish = dish
        openPanel('cookery')
      } else if (dish && farm.island === 'cape' && dishDefinitions[dish].capeLevel) {
        closeDialog()
        island.workCape({ kind: 'honey-kitchen' }, () => perform(() => cookDish(farm, dish)), dishIcons[dish])
      } else if (dish) perform(() => cookDish(farm, dish))
      break
    }
  }
})

closeButton.addEventListener('click', closeDialog)
dialog.addEventListener('keydown',event=>{if(event.altKey&&event.key==='ArrowLeft'&&panelHistory.length){event.preventDefault();goBack()}})
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) closeDialog()
})
dialog.addEventListener('close', () => {
  if (!dialog.open) {
    stopFishing()
    stopWorkshop()
    stopCookery()
    panel = undefined
    seedPickerBed = undefined
    panelHistory.length=0
  }
})

window.addEventListener('keydown', (event) => {
  if (island.isCrossing()) { event.preventDefault(); return }
  if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || dialog.open) return
  const key = event.key.toLowerCase()
  if (key === 'j' || key === '?') {
    event.preventDefault()
    openPanel(key === 'j' ? 'journal' : 'guide')
    return
  }
  const tool = tools.find((entry) => entry.key === key)?.id
  if (tool) {
    event.preventDefault()
    useHotbar(tool)
  }
})

refresh()
if (fieldLayout.matches && farm.island === 'home') toggleFieldView()
