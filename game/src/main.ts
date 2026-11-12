import { getHarbourFishRoute, renderHarbourFishChoice } from './harbour-fish-route'
import { BerryNurserySelection, renderBerryNursery, getBerryNurserySource } from './berry-nursery'
import { villageHomeProgress } from './village-home-art'
import './berry-nursery.css'
import { renderShopCommissions } from './shop-commissions-ui'
import { acceptShopCommission, deliverShopCommission, cancelShopCommission, finishShopCommission, getShopCommission } from './shop-commissions'
import { getFestivalShoreRoute } from './festival-shore-route.ts'
import { rememberRecipeDraft, resumeRecipeDraft, resetRecipeDraft } from './recipe-draft'
import { canReturnToDailyIntent, renderIntentDeadline, renderSelectedIntentRest, selectedDailyIntent } from './intent-deadline'
import { renderFacilityChoiceDetails } from './facility-choice'
import './facility-choice.css'
import { getWindHoneySource } from './wind-honey-guidance'
import { canVisitHarborRest, getNextHarborOrder, renderNextHarborOrder } from './harbor-return'
import './harbor-return.css'
import { renderVillageBudget } from './village-budget'
import { withdrawStoredSignature } from './stored-signature'
import './village-budget.css'
import { treeVariantCopy } from './ready-variant-guidance'
import { canVisitMarketRest, getNextMarketOrders, renderNextMarketOrder } from './market-return'
import './market-return.css'
import { renderFairReturn } from './fair-return'
import './fair-return.css'
import { getLocalWarehouseSupply, warehouseRequest, warehouseSupplyCopy, warehouseConfirmation, warehouseConfirmationValue, withdrawWarehouseSupply } from './warehouse-guidance'
import { getReadySignatureSuppers, renderSignatureSuppers } from './shared-supper'
import './shared-supper.css'
import { renderShopRest, closeShopBeforeRest } from './shop-rest'
import './shop-rest.css'
import { shoalReturnCopy } from './shoal-return'
import { getApiaryCopy } from './apiary-preview'
import './apiary-preview.css'
import { renderPicnicStatus } from './picnic-guidance'
import { renderCoopMorning, renderCoopCapacityWarning } from './coop-preview'
import { mixChickenFeed, renderChickenFeedMixes } from './chicken-feed'
import './coop-preview.css'
import { canConfirmRest } from './rest-preview'
import { renderRestPreview } from './rest-preview-ui'
import { renderFerryReturn } from './ferry-return'
import { nextFerryExploration } from './ferry-discovery'
import './rest-preview.css'
import { chooseDiscoveryIdea, setDiscoveryPace, resumeDiscoveryIdea, forgetDiscoveryIdea } from './discovery-preferences'
import { getGuidanceTask } from './discovery-guidance'
import { renderDiscoveryPreferences } from './discovery-preferences-ui'
import { getNeighborFoodRecovery, repeatNeighborFood, repeatRequestedSignature } from './neighbor-food-recovery'
import { BedTransplantSelection, renderBedTransplant } from './bed-transplant'
import './bed-transplant.css'
import { cancelCovePlan } from './farm'
import { renderFishingPracticeEntry } from './fishing-practice-ui'
import { canPracticeFishing, createFishingPractice } from './fishing-practice'
import { getEggUnpackAction, unpackEggBasket, unpackEggCrate, getHarborWithdrawal, withdrawHarborSupplies } from './farm'
import { installActionClickGuard } from './action-click-guard'
import { exactSaleQuote, saleStock, type SaleTarget } from './exact-sale'
import './exact-sale.css'
import { getBedHarvestPreview } from './farm'
import { fieldContextCopyMarkup, harvestPreviewCopy, updateFieldContextCopy } from './harvest-preview'
import { signatureBookCapacity } from './signature-book'
import { hasFarmhouseSpecialization, getFarmhouseSpecializationAction } from './farm'
import { VersionedSave, browserSaveLock } from './versioned-save'
import { farmSaveKeys } from './farm-save-keys'
import { mountSaveRecovery } from './save-recovery'
import { renderFestivalPanel } from './bay-festival-ui'
import { getFestivalConcertState } from './festival-concert-guidance'
import { getFestivalHarvestRoute } from './festival-harvest-route'
import { getFestivalFishingRoute } from './festival-fishing-route'
import { festivalTraditions, type FestivalTradition } from './bay-festival'
import { beginFestival, cancelFestival, contributeFestival, finishFestival, getFestivalChoices, getFestivalStatus, getShellAt } from './farm'
import { playBaySound } from './game-sound'
import { bedWorkSound, orchardPickSound } from './farm-sounds'
import { reconcileFreightPorts } from './bay-freight-model'
import { combinedExpeditionId, expeditionOfferIds, expeditionPorts, expeditionTrades, type ExpeditionPort } from './ferry-expeditions'
import { getFerryRestockPlan } from './ferry-restock'
import { bayAudio } from './bay-audio'
import { mountBayShop, type BayShopOptions } from './bay-shop'
import type { BayShopStock } from './bay-shop-model'
import { renderFreightPanel, freightControl } from './bay-freight-ui'
import { getMusicMaterialGuidance, musicMaterialItems, musicMaterialNames } from './music-material-guidance'
import { createBayMusic, type BayMusicViewState } from './bay-music'
import { describeFood } from './intent-orders'
import { bayProductId, installGardenInstrument, openedFreightPorts, reserveShopGoods, returnShopGoods, transferBayGoods, sendFerryExpedition, receiveFerryExpedition, expeditionWallet, getFerrySupplyRequirement, gardenMaterialStock } from './harbour-economy'
import { berryCropIds, foodDescriptors, marketStock, unitPrice, islandIds as allPorts } from './farm'
import './harbour-life.css'
import {applyIngredientFinishes} from './ingredient-finish'
import './style.css'
import './navigation.css'
import { ruPlural } from './ru'
import { archiveCards } from './archive'
import { getIslandJourneys } from './journey'
import { getDiscoveryTask } from './discovery-path'
import { getDiscoveryJournal } from './discovery-journal'
import { getFruitSource, nurseryFruitDetail } from './orchard-guidance'
import './discovery-journal.css'
import { getRequirementHint, type Requirement } from './requirement-guidance'
import { getClimate, weatherNames, type Trait } from './climate'
import {signatureBook,signatureStudio,coveControls,signaturePortionStock,signatureResultPicture,cookeryResultPicture,escapeRecipeText as escapeHtml} from './culinary-ui'
import {signatureFruitIds,signatureFruitNames,type SignatureDraft,type SignatureIngredient} from './culinary'
import { communityBoard, communityIntent, neighborDetail, neighborHelpCard, type CommunityArt } from './community-ui'
import { neighborHelpStatus } from './neighbor-help'
import { communityReturnRoute } from './community-return'
import {
  boatPrice,
  fishDailyLimit, villageGuestTarget,
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
  getCommunityOrders, getIntentOffers, deliverIntentOrder, getNeighborPlans, joinNeighborPlan, serveNeighborPlan, finishNeighborPlan, advanceNeighborPlan,
  collectEggs,
  collectShell,
  collectShoalFind,
  collectCapeHoney,
  cookDish,
  createFarm,
  getSignatureAction,completeSignature,repeatSignature,nameSignature,favoriteSignature,forgetSignature,sellSignature,useSignature,tasteSignature,deliverSignature,getCoveActions,changeCove,
  moveHen as moveFarmHen,
  cropDefinitions,
  cropIds,
  deliverHarborOrder,
  deliverMarketOrder,
  deliverProject,
  dishDefinitions,
  dishIds,
  isTartDish,
  endDay,
  eggsPerBasket,
  eggsPerCrate,
  expandedWaterCapacity,
  feedBagPrice,
  feedBagSize,
  feedChickens,
  fishDefinitions,
  fishIds, getGrillFish, getCookIngredients,
  facilitySpecializations,
  gardenRows,
  gatherSeaSalt,
  getBedAction,
  getBedStage,
  getCapeBloom,
  getCapeHoney,
  getCapeUpgrade,
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
  storeTree,
  returnNurseryTree,
  plantTree,
  plantCapeFlower,
  projectIds,
  refillWater,
  restoreFarm,
  restoreCurrentFarm,
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
  type FishId,
  type FacilityBranch,
  type ProjectId,
  type SpecializationId,
  type StockItem,
  type WorkshopShape,
  type ResidentId, type FoodOfferId, type NeighborAssembly, type PackingResult,
} from './farm'
import { lazyScene } from './lazy-scene'
const createFishingGame = lazyScene(() => import('./fishing').then(m => m.createFishingGame))
const createWorkshop = lazyScene(() => import('./workshop').then(m => m.createWorkshop))
const createCookery = lazyScene(() => import('./cookery').then(m => m.createCookery))
const createArrangement = lazyScene(() => import('./arrangement').then(m => m.createArrangement))
import { createIsland, type IslandTarget } from './island'
import { harbourViews, isHarbourView } from './harbour-view'
import { createHarbourControls } from './harbour-controls'
import { specializationStages } from './lavender-layout'
import { isLunarTide, shellDefinitions } from './tide'
import { shoalDefinitions, shoalFindIds, getShoalFindAt, hasShoal } from './shoal'

const saveStore = new VersionedSave(() => localStorage, farmSaveKeys, restoreCurrentFarm, createFarm, browserSaveLock(farmSaveKeys.lock), restoreFarm)
const farm = await saveStore.load() ?? createFarm()
let saveAvailable = !saveStore.blocked
let saveRecovery: ReturnType<typeof mountSaveRecovery> | undefined

let pendingSaves = 0
function saveFarm() {
  pendingSaves++
  void saveStore.save(farm).then(saved => {
    pendingSaves--
    saveAvailable = saved
    saveRecovery?.update()
  })
}
window.addEventListener('beforeunload', event => {
  if (pendingSaves > 0) { event.preventDefault(); event.returnValue = '' }
})

function iconUrl(name: string) {
  if (name.startsWith('bay/') || name.startsWith('festivals/')) return import.meta.env.BASE_URL+'art/lavender/'+name+'.webp'
  if(name==='fish-perch'||name==='fish-seaBass')return `${import.meta.env.BASE_URL}art/lavender/fishing-${name==='fish-perch'?'perch':'sea-bass'}-v1.webp`
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
  { id: 'hoe', label: 'Мотыга', image: 'hoe', key: '1' },
  { id: 'water', label: 'Лейка', image: 'can', key: '2' },
  { id: 'seeds', label: 'Семена', image: 'seeds', key: '3' },
  { id: 'feed', label: 'Корм для кур', image: 'feed', key: '4' },
  { id: 'basket', label: 'Корзина урожая', image: 'crate', key: '5' },
  { id: 'coop', label: 'Курятник', image: 'hen', key: '6' },
  { id: 'rod', label: 'Удочка', image: 'rod', key: '7' },
  { id: 'boat', label: 'Лодка', image: 'boat', key: '8' },
] as const

type Tool = (typeof tools)[number]['id']
type Panel = 'chicken-feed' | 'berry-nursery' | 'shop-commissions' | 'warehouse-supply' | 'music-supplies' | 'transplant' | 'sale' | 'festival' | 'bay-shop' | 'bay-freight' | 'bay-music' | 'market' | 'inventory' | 'archive' | 'settings' | 'journal' | 'coop' | 'rest' | 'guide' | 'seeds'
  | 'fishing' | 'boat' | 'orchard' | 'tree' | 'upgrades' | 'kitchen' | 'irrigation' | 'dock-project' | 'harbor' | 'specialize' | 'hive' | 'guest' | 'cape-upgrade' | 'honey-kitchen' | 'workshop' | 'cookery' | 'village-project' | 'village' | 'village-meal' | 'recipes' | 'signature' | 'cove'
  | 'intents' | 'intent' | 'neighbor' | 'request-food' | 'arrangement' | 'shoal'

const transplantSelection = new BedTransplantSelection()
const berryNurserySelection = new BerryNurserySelection()
let activeTool: Tool = 'seeds'
let panel: Panel | undefined
let celebratedFestival: FestivalTradition | undefined
let celebrationReceipt: {effect?:string; coins:number} | undefined
let treeSlot = 0
let marketTab: 'buy' | 'sell' | 'orders' | 'projects' = 'buy'
let marketCategory:'seeds'|'trees'|'care'|'buildings'='seeds'
let marketSellGroup:'all'|'harvest'|'kitchen'|'shore'='all'
let selectedSale: (SaleTarget & { name: string }) | undefined
let saleQuantity = '1'
let saleReceipt: { quantity: number; total: number; remaining: number } | undefined
let inventoryGroup: 'harvest'|'kitchen'|'shore' = 'harvest'
let boatIsland = farm.island
let journeyDetailsOpen = false
let journalDetailsOpen = false
let bagTab: 'seeds' | 'harvest' = 'harvest'
let archiveGroup: ArchiveGroup = 'crops'
let previewSeed: CropId = farm.selectedSeed
let seedPickerBed: number | undefined
let contextBed: number | undefined
let villageSlot = 0
let pastryShape: WorkshopShape = farm.workshopPatterns[0] ?? 'round'
let cookingDish: DishId = 'orchardTart'
let cookingFish: FishId = getGrillFish(farm)
let workshopRecipe: 'pastry' | 'bread' = 'pastry'
let signatureBase: SignatureDraft['base'] = 'preserves'
let signatureSlots: (SignatureIngredient|null)[] = [null,null]
let signatureSlot=0
let signatureRepeatId:string|undefined
function rememberCurrentRecipeDraft() {
  if (!signatureRepeatId && rememberRecipeDraft(farm, {base:signatureBase, slots:signatureSlots, activeSlot:signatureSlot})) saveFarm()
}

let expandedRepeatId:string|undefined
let cookingMode:'dish'|'signature'='dish'
type KitchenTart = 'orchardTart' | 'strawberryTart' | 'blueberryTart' | 'raspberryTart' | 'mixed'
type KitchenPreserves = 'appleJam' | 'orchardPreserves' | 'custom'
type SignatureFamily = 'berries' | 'preserves' | undefined
let kitchenTart: KitchenTart = 'orchardTart'
let kitchenPreserves: KitchenPreserves = 'appleJam'
let signatureFamily: SignatureFamily
type CommunityRequest = { kind: 'intent'; orderId: string } | { kind: 'neighbor'; resident: ResidentId; planId: string }
let communityRequest: CommunityRequest | undefined
let communityOrderId = ''
let communityResident: ResidentId = 'bea'
let requestedFood: FoodOfferId | undefined
let arrangementRequest: { kind: 'neighbor'; id: string } | { kind: 'packing'; mode: 'eggs' | 'crate' } | undefined
const communitySelectionKey = 'cozy-farm-community-selection-v1'
try {
  const saved: unknown = JSON.parse(localStorage.getItem(communitySelectionKey) ?? 'null')
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    const selection = saved as Record<string, unknown>, raw = selection.request
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const request = raw as Record<string, unknown>
      if (request.kind === 'intent') {
        const order = getCommunityOrders(farm).find(order => order.id === request.orderId && order.unlocked && !order.delivered)
        if (order) communityRequest = { kind: 'intent', orderId: order.id }
      } else if (request.kind === 'neighbor') {
        const plan = getNeighborPlans(farm).find(plan => plan.resident === request.resident)
        if (plan) communityRequest = { kind: 'neighbor', resident: plan.resident, planId: plan.id }
      }
      const active = communityRequest
      const current = active?.kind === 'intent' ? getCommunityOrders(farm).find(order => order.id === active.orderId)
        : active?.kind === 'neighbor' ? getNeighborPlans(farm).find(plan => plan.resident === active.resident) : undefined
      if (current && typeof selection.food === 'string') requestedFood = getIntentOffers(farm, current.intentId).find(offer => offer.id === selection.food && offer.eligible)?.id
    }
  }
} catch { /* A stale menu selection never prevents loading the farm. */ }
const requirementLinks = new Map<string, Requirement>()

function requirementLink(content: string, requirement: Requirement, className: string, name: string, ready = false) {
  if (ready) return `<li class="${className}" data-ready="true">${content}</li>`
  const key = String(requirementLinks.size)
  requirementLinks.set(key, requirement)
  const nursery = requirement.kind === 'stock' && getBerryNurserySource(farm, requirement.item) !== undefined
    ? `<button class="nursery-preserve" type="button" data-action="berry-nursery-ingredient" data-value="${key}" aria-label="Сохранить разновидность: ${name}">Сохранить разновидность</button>` : ''
  return `<li class="requirement-slot"><button type="button" class="${className} requirement-link" data-ready="false" data-action="show-requirement" data-value="${key}" aria-label="Где найти: ${name}">${content}</button>${nursery}</li>`
}
const islandNames = { home: 'Родной остров', grove: 'Солёная роща', cape: 'Цветочный мыс', village: 'Лавандовая гавань' }

function statusItem(id: string, image: string | undefined, label: string) {
  return `<div class="status-item status-${id}">
    ${image ? `<span class="status-icon" id="status-${id}-icon">${icon(image)}</span>` : ''}
    <span><span class="status-label sr-only">${label} </span><span class="status-value" id="status-${id}"></span></span>
  </div>`
}

const app = document.querySelector<HTMLElement>('#app')!
app.innerHTML = `
  <main class="game-shell" aria-label="Уютная ферма">
    <canvas class="island-canvas" tabindex="0" aria-label="Родной остров. Выберите место стрелками и нажмите Enter для действия."></canvas>
    <header class="hud-top">
      <div class="status-bar" role="group" aria-label="Состояние фермы">
        <div class="status-group">
          ${statusItem('day', 'sun', 'День на ферме')}
          ${statusItem('phase', undefined, 'Время и погода')}
        </div>
        <div class="status-group">
          ${statusItem('coins', 'coin', 'Монеты')}
          ${statusItem('water', 'drop', 'Вода')}
        </div>
        <span class="sr-only" id="status-seed"></span>
        <span class="sr-only" id="status-tool"></span>
      </div>
      <nav class="hud-actions" aria-label="Меню фермы">
        <button class="hud-button" type="button" data-panel="market" aria-label="Рынок" title="Рынок">${icon('shop')}</button>
        <button class="hud-button" type="button" data-panel="inventory" aria-label="Запасы" title="Запасы">${icon('pack')}</button>
        <button class="hud-button" type="button" data-panel="guide" aria-label="Открыть бухту" title="Открыть бухту">${icon('island')}</button>
      </nav>
    </header>
    <div class="island-context">
    <button class="task-card" type="button" data-panel="journal" aria-label="Текущее задание, открыть дневник" aria-describedby="task-name task-count task-reward" aria-keyshortcuts="J" title="Открыть дневник (J)">
      <span class="task-medallion">${icon('carrot')}</span>
      <span class="task-content">
        <strong class="task-name" id="task-name"></strong>
        <span class="task-count" id="task-count"></span>
        <progress class="task-progress" aria-labelledby="task-name" max="1" value="0"></progress>
        <span class="task-reward sr-only" id="task-reward"></span>
      </span>
    </button>
    <button class="island-location" type="button" data-panel="boat" aria-label="Острова и путешествия" hidden>${icon('island')}<span>Солёная роща</span></button>
    <nav class="harbour-views" aria-label="Виды гавани" hidden>${harbourViews.map(view => `<button type="button" data-action="harbour-view" data-harbour-view="${view.id}" data-value="${view.id}" aria-pressed="${view.id === 'overview'}">${view.label}</button>`).join('')}<span class="sr-only" aria-live="polite"></span></nav>
    </div>
    <button class="view-toggle" type="button" data-action="field-view" aria-pressed="false">${icon('field')}<span>Грядки</span></button>
    <button class="community-resume" type="button" data-action="resume-community" hidden>${icon('ui-signature-bright')}<span>К просьбе</span></button>
    <div class="hud-bottom">
      <button class="hud-hint" hidden type="button" data-panel="guide" aria-label="Открыть путеводитель" aria-describedby="farm-hint-text" aria-keyshortcuts="?" title="Открыть путеводитель">
        <span class="hint-icon">${icon('star')}</span><span class="hint-text" id="farm-hint-text"></span><kbd aria-hidden="true">?</kbd>
      </button>
      <div class="field-context" hidden>
        <img class="icon" src="${iconUrl('tool-hoe')}" alt="" draggable="false">
        ${fieldContextCopyMarkup}
        <button class="dialog-button" type="button" data-action="work-context" aria-describedby="context-copy"></button>
      </div>
      <div class="hotbar" role="group" aria-label="Инструменты">
        ${tools.map(({ id, label, image, key }) => `<button class="hotbar-slot" type="button" data-tool="${id}" aria-label="${label}" aria-describedby="slot-count-${id}" title="${label} (${key})" aria-pressed="false" aria-keyshortcuts="${key}">
          <span class="slot-icon">${icon(`tool-${image}`)}</span><kbd class="slot-key" aria-hidden="true">${key}</kbd><span class="slot-count" id="slot-count-${id}" hidden></span>
        </button>`).join('')}
      </div>
    </div>
    <p class="toast" role="status" aria-live="polite" hidden></p>
    <dialog class="farm-dialog" aria-labelledby="dialog-title">
      <section class="dialog-panel">
        <button class="scene-back" type="button" data-action="back" aria-label="Назад" hidden>‹</button>
        <header class="dialog-header">
          <button class="dialog-back" type="button" data-action="back" aria-label="Назад" hidden>‹</button>
          <img class="dialog-emblem" src="${iconUrl('pack')}" alt="" aria-hidden="true" draggable="false">
          <h1 class="dialog-title" id="dialog-title"></h1>
          <button class="dialog-close" type="button" aria-label="Закрыть меню">${icon('close')}</button>
        </header>
        <nav class="dialog-destinations" aria-label="Места бухты"><button type="button" data-panel="boat">${icon('tool-boat')}<span>Острова</span></button><button type="button" data-panel="archive">${icon('orchard')}<span>Коллекции</span></button><button type="button" data-panel="guide">${icon('island')}<span>Карта</span></button></nav>
        <p class="dialog-status dialog-feedback" role="status" hidden></p>
        <div class="dialog-content"></div>
      </section>
    </dialog>
  </main>
`

const canvas = app.querySelector<HTMLCanvasElement>('.island-canvas')!
let harbourControls: ReturnType<typeof createHarbourControls> | undefined
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
const communityResume = app.querySelector<HTMLButtonElement>('.community-resume')!
const hotbarButtons = Array.from(app.querySelectorAll<HTMLButtonElement>('.hotbar-slot'))
const marketButton = app.querySelector<HTMLButtonElement>('[data-panel="market"]')!
const islandLocation = app.querySelector<HTMLElement>('.island-location')!
const fieldViewButton = app.querySelector<HTMLButtonElement>('.view-toggle')!
const portraitView = window.matchMedia('(max-width: 680px) and (orientation: portrait)')
const fieldLayout = window.matchMedia(`${portraitView.media}, (max-width: 900px) and (max-height: 600px) and (orientation: landscape)`)
const numberFormat = new Intl.NumberFormat('ru-RU')
let toastTimer: number | undefined
let dialogFeedbackTimer:number|undefined

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
  if (farm.discoveryPreferences.quiet) return undefined
  const next = getGuidanceTask(farm.discoveryPreferences, getDiscoveryTask(farm, farm.orientation))
  if (next || farm.island === 'home') return next
  if (farm.island === 'village') return { label: 'Дом у гавани', detail: 'Приглашайте соседей и ужинайте вместе у воды.', progress: Math.min(2, farm.village.meals), target: 2, reward: undefined }
  if (farm.island === 'cape') {
    const planted = farm.capeFlowers.filter((day) => day !== null).length
    if (planted < capeFlowerSlotCount) return {
      label: 'Встречаем пчёл', detail: 'Засейте три клумбы. Цветы распустятся после ночи дома.',
      progress: planted, target: capeFlowerSlotCount, reward: undefined,
    }
    if (farm.capeHoneyOn === farm.day) {
      const upgrade = getCapeUpgrade(farm)
      if (upgrade) return {
        label: upgrade.name, detail: 'Откройте улей и выберите улучшение.',
        progress: Math.min(3, farm.capeLevel === 1 ? farm.honey : farm.beeswax), target: 3, reward: undefined,
      }
      return {
        label: 'Угощения мыса', detail: 'Приготовьте все блюда медовой кухни.',
        progress: capeDishIds.filter((dish) => farm.bayDiscoveries.includes(dish)).length, target: capeDishIds.length, reward: undefined,
      }
    }
    return {
      label: 'Мёд Цветочного мыса', detail: farm.capeHoneyOn === farm.day ? 'Завтра улей снова наполнится.'
        : getCapeHoney(farm).blooms ? 'Соберите сегодняшний мёд в улье.' : 'Переночуйте на Родном острове, чтобы цветы распустились.',
      progress: Number(farm.capeHoneyOn === farm.day), target: 1, reward: undefined,
    }
  }
  const limit = getFishLimit(farm)
  return {
    label: 'Исследуйте Солёную рощу',
    detail: `Сегодня: морской окунь — ${limit}, а ещё морская соль.`,
    progress: farm.fishCaughtToday.grove + Number(farm.saltGatheredToday),
    target: limit + 1,
    reward: undefined,
  }
}

function status() {
  updateCommunityReturn()
  const tool = tools.find(({ id }) => id === activeTool)!
  const goal = currentTask()
  const bookmarkOnly = !!goal && 'bookmarkOnly' in goal && goal.bookmarkOnly
  taskCard.hidden = farm.discoveryPreferences.quiet
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

  textAt('status-day', `День ${farm.day}`)
  const phase = getDayPhase(farm)
  const phaseName = {Morning:'Утро',Afternoon:'День',Evening:'Вечер'}[phase]
  const { weather } = getClimate(farm.day)
  const dayStatus = app.querySelector<HTMLElement>('.status-group')!
  dayStatus.dataset.weather = weather
  dayStatus.title = `${phaseName} · ${weatherNames[weather]}`
  textAt('status-phase', weather === 'sun' ? phaseName : weatherNames[weather])
  statusIcon('day', weather === 'rain' ? 'drop' : weather === 'stars' ? 'star' : phase === 'Evening' ? 'moon' : 'sun')
  textAt('status-coins', numberFormat.format(farm.coins))
  textAt('status-water', `${farm.water}/${getWaterCapacity(farm)}`)
  textAt('status-seed', `Семена: ${cropDefinitions[farm.selectedSeed].name.toLowerCase()}`)
  textAt('status-tool', tool.label)

  textAt('task-name', goal?.label ?? 'Заказы рынка')
  textAt('task-count', goal && !bookmarkOnly ? `${goal.progress}/${goal.target}` : '')
  textAt('task-reward', goal?.reward === undefined ? '' : `Награда: ${quantity(goal.reward, 'монета')}`)
  taskReward.hidden = goal?.reward === undefined
  taskProgress.max = goal?.target ?? 1
  taskProgress.value = goal?.progress ?? 1
  taskProgress.hidden = !goal || !!bookmarkOnly
  delete taskCard.dataset.panel
  taskCard.dataset.action = 'follow-task'
  taskCard.title = goal && 'action' in goal ? goal.action.label : 'Открыть дневник (J)'
  taskCard.setAttribute('aria-label', goal && 'action' in goal ? `${goal.label}. ${goal.action.label}` : 'Открыть дневник')
  taskCard.setAttribute('aria-keyshortcuts', 'J')
  marketButton.disabled = !atHome
  marketButton.title = atHome ? 'Рынок' : 'Рынок находится на Родном острове'
  islandLocation.hidden = atHome
  const tide = farm.island === 'grove' && isLunarTide(farm.day)
  const honeyWind = farm.island === 'cape' && isHoneyWind(farm.day)
  islandLocation.dataset.tide = String(tide)
  islandLocation.dataset.honeyWind = String(honeyWind)
  islandLocation.querySelector('span')!.textContent = tide ? 'Лунный прилив' : honeyWind ? 'Медовый ветер' : islandNames[farm.island]
  islandLocation.title = `${islandNames[farm.island]}${tide ? ' · Лунный прилив' : honeyWind ? ' · Медовый ветер' : ''}`
  fieldViewButton.hidden = !atHome
  hintText.textContent = farm.discoveryPreferences.quiet ? '' : farm.island === 'grove' && goal?.progress === goal?.target
    ? 'Загляните в сад или вернитесь на Родной остров.'
    : goal?.detail ?? 'Порыбачьте у причала или отправьтесь на Солёную рощу и Цветочный мыс.'

  for (const button of hotbarButtons) {
    const toolId = button.dataset.tool as Tool
    const definition = tools.find(tool => tool.id === toolId)!
    const atVillage = farm.island === 'village'
    button.hidden = atVillage && toolId !== 'basket' && toolId !== 'coop' && toolId !== 'boat'
    const label = atVillage && toolId === 'basket' ? 'Кондитерская' : atVillage && toolId === 'coop' ? 'Соседи' : definition.label
    button.setAttribute('aria-label', label)
    button.title = `${label} (${definition.key})`
    const image = button.querySelector<HTMLImageElement>('.slot-icon img')!
    const source = iconUrl(atVillage && toolId === 'basket' ? 'ui-handmade-round' : atVillage && toolId === 'coop' ? 'ui-bea' : `tool-${definition.image}`)
    if (image.getAttribute('src') !== source) image.src = source
    button.disabled = farm.island === 'cape' && toolId === 'rod'
    const count = counts[toolId]
    const badge = button.querySelector<HTMLElement>('.slot-count')!
    if (toolId === 'seeds') button.title = `Семена · ${cropDefinitions[farm.selectedSeed].name} (3)`
    button.setAttribute('aria-pressed', String(toolId === activeTool))
    badge.hidden = atVillage || count === undefined
    badge.textContent = count === undefined ? '' : String(count)
  }
  updateFieldContext(contextBed)
  harbourControls?.sync(farm.island)
}

const panelTitles: Record<Panel, string> = {
  'warehouse-supply': 'Местный склад',
  transplant: 'Пересадка культур',
  sale: 'Продажа товара',
  'berry-nursery':'Ягодный питомник', 'shop-commissions':'Заказы лавки', 'music-supplies':'Материалы музыки', festival:'Праздники гавани', 'bay-shop':'Своя лавка', 'bay-freight':'Паром «Ласточка»', 'bay-music':'Музыкальный сад',
  market: 'Рынок',
  inventory: 'Запасы',
  archive: 'Коллекции',
  settings: 'Настройки',
  journal: 'Дневник',
  coop: 'Курятник',
  'chicken-feed': 'Корм со своей фермы',
  rest: 'Дом',
  guide: 'Карта бухты',
  seeds: 'Семена',
  fishing: 'Рыбалка',
  boat: 'Острова',
  orchard: 'Сад',
  tree: 'Место для дерева',
  upgrades: 'Улучшения',
  kitchen: 'Кухня',
  irrigation: 'Полив',
  'dock-project': 'Причал рощи',
  harbor: 'Заказы гавани',
  specialize: 'Дом · ур. 3',
  hive: 'Улей мыса',
  'cape-upgrade': 'Цветочная пасека',
  'honey-kitchen': 'Медовая кухня',
  guest: 'Гость ярмарки',
  workshop: 'Кондитерская', cookery: 'Кухня', 'village-project': 'Живая бухта', village: 'Соседи', 'village-meal': 'Ужин у воды',
  recipes:'Мои рецепты',signature:'Мой рецепт',cove:'Живая заводь',shoal:'Лунная отмель',
  intents: 'Просьбы соседей', intent: 'Угощение для соседей', neighbor: 'Соседская встреча', 'request-food': 'Рецепт угощения', arrangement: 'Готовимся к встрече',
}

const panelEmblems: Record<Panel, string> = {
  'chicken-feed': 'tool-feed',
  'warehouse-supply': 'ui-bag',
  transplant: 'tool-seeds',
  sale: 'ui-market',
  'berry-nursery':'ui-seed-blueberry', 'shop-commissions':'ui-signature-bright', 'music-supplies':'bay/music-harp', festival:'festivals/lights', 'bay-shop':'ui-market', 'bay-freight':'tool-boat', 'bay-music':'bay/music-harp',
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
  recipes:'ui-signature-bright',signature:'ui-apple-jam',cove:'ui-shell',shoal:'ui-moon-pearl',
  intents: 'ui-market', intent: 'ui-handmade-round', neighbor: 'ui-bea', 'request-food': 'ui-kitchen', arrangement: 'ui-egg-basket',
}

const panelBanners: Partial<Record<Panel, string>> = { inventory: 'Запасы', market: 'Рынок', kitchen: 'Кухня' }
const dishIcons: Record<DishId, string> = {
  orchardTart: 'ui-tart', strawberryTart: 'ui-strawberry-tart', blueberryTart: 'ui-blueberry-tart', raspberryTart: 'ui-raspberry-tart', grilledFish: 'ui-grilled-fish', appleJam: 'ui-apple-jam',
  farmhouseBread: 'ui-farmhouse-bread', orchardPreserves: 'ui-orchard-preserves',
  honeyCake: 'ui-honey-cake',
  honeyBiscuits: 'ui-honey-biscuits', honeyPear: 'ui-honey-pear', windParfait: 'ui-wind-parfait',
}
const pastryIcons = { round: 'ui-handmade-round', folded: 'ui-handmade-folded', long: 'ui-handmade-long' }
const communityArt: CommunityArt = {
  icon,
  offerIcon(offer) {
    if (offer.source === 'signature') {
      const recipe = farm.culinary.recipes.find(recipe => `signature:${recipe.id}` === offer.id)
      if (recipe) return signatureResultPicture(recipe,{icon})
    }
    if (offer.preparation && (offer.preparation.family==='decorate'||offer.preparation.family==='preserves')) return cookeryResultPicture(offer.preparation,offer.recipeIngredients??[],{icon})
    return icon(offer.source === 'dish' ? dishIcons[offer.identity as DishId] : pastryIcons[offer.identity as WorkshopShape])

  },
}
const archiveIcons: Record<string, string> = {
  perch: 'fish-perch', seaBass: 'fish-seaBass',
  ...dishIcons, honey: 'ui-honey', windHoney: 'ui-wind-honey', beeswax: 'ui-beeswax', pear: 'ui-pear', peach: 'ui-peach-fruit',
}
type BuildingBranch = SpecializationId | FacilityBranch
const branchChoices: Record<BuildingId, readonly BuildingBranch[]> = {
  farmhouse: specializationIds, coop: ['hatchery', 'packing'], well: ['rain', 'pipes'],
}
const branchDefinitions = { ...specializationDefinitions, ...facilitySpecializations.coop, ...facilitySpecializations.well }
const facilityDetails: Record<FacilityBranch, readonly [string, string]> = {
  hatchery: ['tool-hen', 'Вывести курочку'], packing: ['ui-egg-crate', 'Упаковать яйца'],
  rain: ['drop', 'Вода каждое утро'], pipes: ['tool-can', 'Полив двух рядов'],
}
let specializationBuilding: BuildingId = 'farmhouse'
let previewSpecialization: BuildingBranch | undefined
let irrigationMode: 'row' | 'pair' = 'row'

type ButtonOptions = { secondary?: boolean; crop?: CropId; value?: string | number; context?: string; cost?: { icon: 'coin' | 'drop'; amount: number } }

function button(label: string, action: string, enabled = true, options: ButtonOptions = {}) {
  const { secondary, crop, value, cost, context = crop ? `Семена: ${cropDefinitions[crop].name.toLowerCase()}` : undefined } = options
  return `<button class="dialog-button${secondary ? ' secondary' : ''}" type="button" data-action="${action}"
    ${crop ? `data-crop="${crop}"` : ''} ${value !== undefined ? `data-value="${value}"` : ''}
    ${context ? `aria-label="${label}, ${context}"` : ''} ${enabled ? '' : 'disabled'}>${label}
    ${cost ? `<span class="button-cost" aria-hidden="true">${icon(cost.icon)} ${numberFormat.format(cost.amount)}</span>` : ''}</button>`
}

function quantity(count: number, noun: string) {
  const forms: Record<string, readonly [string,string,string]> = { 'монета':['монета','монеты','монет'], 'ночь':['ночь','ночи','ночей'], 'порция':['порция','порции','порций'], 'предмет':['предмет','предмета','предметов'], 'политая ночь':['политая ночь','политые ночи','политых ночей'] }
  return `${numberFormat.format(count)} ${ruPlural(count, forms[noun] ?? [noun,noun,noun])}`
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

function panelTabs(action: string, active: string, tabs: ReadonlyArray<readonly [string, string]>, name = 'Категории') {
  return `<div class="panel-tabs" role="group" aria-label="${name}">${tabs.map(([id, label]) =>
    `<button type="button" data-action="${action}" data-value="${id}" aria-pressed="${id === active}">${label}</button>`).join('')}</div>`
}

function goods() {
  return getMarketStock(farm).filter(({ item, count }) => {
    if (item.kind === 'eggCrates') return farm.coopSpecialization === 'packing'
    if (count > 0 || item.kind !== 'dishes') return true
    const branch = dishDefinitions[item.item].specialization
    return !branch || hasFarmhouseSpecialization(farm, branch)
  })
    .map(({ item, ...listing }) => ({ ...listing, item, ...stockLabel(item), group:['dishes','handmade','eggBaskets','eggCrates'].includes(item.kind)?'kitchen':['fish','shells','shoalFinds','seaSalt'].includes(item.kind)?'shore':'harvest', trait: item.kind === 'variants' ? item.trait : undefined }))
}

function fishImage(id: FishId): string { return id === 'perch' || id === 'seaBass' ? `fish-${id}` : `ui-${id}` }
function fishSource(id: FishId): string {
  return {perch:'Родной остров · рыбалка',seaBass:'Солёная роща · рыбалка',moonfish:'Глубже 75 м · редкий улов',lanternfish:'Глубже 100 м · редкий улов'}[id]
}

function inventoryStockRow(listing: ReturnType<typeof goods>[number]): string {
  const { image, name, count, trait, item, key, price } = listing
  if(item.kind==='eggBaskets'||item.kind==='eggCrates'){
    const kind=item.kind==='eggBaskets'?'basket':'crate',action=getEggUnpackAction(farm,kind)
    return row(image,name,`×${count}`,button(farm.island==='home'?`Распаковать · +${action.eggs}`:'Распаковать дома',kind==='basket'?'unpack-egg-basket':'unpack-egg-crate',action.available,{secondary:true}),trait)
  }
  if(item.kind!=='fish')return row(image,name,`×${count}`,'',trait)
  return row(image,name,`×${count} · ${fishSource(item.item)}`,button('На гриль','fish-kitchen',true,{value:item.item})+button(`Продать 1 · ${price}`,farm.island==='home'?'sell-item':'fish-market',true,{value:key,secondary:true}))
}

function specializationCards() {
  const choice = previewSpecialization ? branchDefinitions[previewSpecialization] : undefined
  const houseChoice = previewSpecialization === 'bakery' || previewSpecialization === 'preserves'
    ? getFarmhouseSpecializationAction(farm, previewSpecialization) : undefined
  return `<p class="coin-balance">${icon('coin')} ${numberFormat.format(farm.coins)}<span class="sr-only"> ${ruPlural(farm.coins, ['монета','монеты','монет'])}</span></p>
    <div class="specialization-grid">${branchChoices[specializationBuilding].map((id) => {
      const definition = branchDefinitions[id]
      const [image, benefit] = id === 'bakery' || id === 'preserves'
        ? [dishIcons[specializationDefinitions[id].dish], dishDefinitions[specializationDefinitions[id].dish].name]
        : facilityDetails[id]
      const path = specializationStages[id].mask.path
      return `<button class="specialization-option" type="button" data-action="preview-specialization" data-value="${id}"
        aria-pressed="${id === previewSpecialization}">
        <img class="specialization-preview" src="${import.meta.env.BASE_URL}art/${path}.webp" alt="" draggable="false">
        <strong>${definition.name}</strong><span>${icon(image)}${benefit}</span>${(id==='bakery'||id==='preserves')&&hasFarmhouseSpecialization(farm,id)?'<span>Уже освоено</span>':''}
      </button>`
    }).join('')}</div>
    ${specializationBuilding !== 'farmhouse' ? previewSpecialization && previewSpecialization !== 'bakery' && previewSpecialization !== 'preserves'
      ? renderFacilityChoiceDetails(farm,previewSpecialization) : '<p class="facility-choice-help">Выберите карточку, чтобы прочитать условия. Просмотр вариантов бесплатный.</p>' : ''}
    <footer class="specialization-footer"><p>${specializationBuilding==='farmhouse'?(houseChoice?.label??'Освойте направление кухни. Позже можно изучить второе, сохранив прежние рецепты и заказы.'):'После постройки направление нельзя сменить или добавить второе.'}</p>
      ${button(specializationBuilding==='farmhouse'?'Освоить':'Построить', 'build-specialization', houseChoice?houseChoice.available:choice !== undefined && farm.coins >= choice.price,
        choice ? { value: previewSpecialization, context: `${choice.name}, ${quantity(choice.price, 'монета')}`,
          cost: { icon: 'coin', amount: choice.price } } : {})}</footer>`
}

function flockFeedRow() {
  return row('tool-feed', 'Корм для кур', farm.chickensFed ? 'Сегодня накормлены' : 'Корм к утренней кладке', farm.chickensFed ? ''
    : farm.feed > 0 ? button('Покормить', 'feed')
      : button('Купить корм', 'buy-feed', farm.coins >= feedBagPrice, {cost:{icon:'coin',amount:feedBagPrice}}))
}

function seedCards() {
  const seed = cropDefinitions[previewSeed]
  return `<div class="seed-grid">${cropIds.map((crop) =>
    `<button class="seed-tile" type="button" data-action="preview-seed" data-value="${crop}" aria-pressed="${farm.selectedSeed === crop}" aria-label="Семена: ${cropDefinitions[crop].name.toLowerCase()}, в наличии: ${farm.seeds[crop]}">
      ${icon(`ui-seed-${crop}`)}<strong>${cropDefinitions[crop].name}</strong><span>×${farm.seeds[crop]}</span>
    </button>`).join('')}</div>
    <section class="seed-detail">${icon(previewSeed)}<div><h2>Семена: ${seed.name.toLowerCase()}</h2><p>${quantity(seed.days, 'ночь')} · ${seed.retainsWater ? 'один полив' : 'полив каждый день'}</p>
      ${farm.seeds[previewSeed]===0?button('Купить семена','buy-seeds',farm.coins>=seed.seedPrice,{crop:previewSeed,cost:{icon:'coin',amount:seed.seedPrice}}):''}</div></section>`
}

function stockLabel(item: StockItem): { name: string; image: string } {
  switch (item.kind) {
    case 'produce': return { name: cropDefinitions[item.item].name, image: item.item }
    case 'fruit': return { name: treeDefinitions[item.item].name, image: item.item === 'apple' ? 'apple' : item.item === 'pear' ? 'ui-pear' : 'ui-peach-fruit' }
    case 'fish': return { name: fishDefinitions[item.item].name, image: fishImage(item.item) }
    case 'handmade': return { name: workshopDefinitions[item.item].name, image: pastryIcons[item.item] }
    case 'dishes': return { name: dishDefinitions[item.item].name, image: dishIcons[item.item] }
    case 'eggs': return { name: 'Яйцо', image: 'egg' }
    case 'eggBaskets': return { name: 'Корзина яиц', image: 'ui-egg-basket' }
    case 'eggCrates': return { name: 'Ящик яиц', image: 'ui-egg-crate' }
    case 'seaSalt': return { name: 'Морская соль', image: 'ui-sea-salt' }
    case 'honey': return { name: 'Цветочный мёд', image: 'ui-honey' }
    case 'windHoney': return { name: 'Мёд ветров', image: 'ui-wind-honey' }
    case 'beeswax': return { name: 'Пчелиный воск', image: 'ui-beeswax' }
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
  const name = stock < item.quantity && specialStock ? `${label.name} (обычный урожай)` : label.name
  const image = label.image
  return requirementLink(`${icon(image)}<span>${name}</span><strong>${stock}/${item.quantity}</strong>`, {kind:'stock',item}, 'ingredient', `${name}, ${stock} из ${item.quantity}`, stock >= item.quantity)
}

function recipeDestination(dish: DishId) {
  if (dishDefinitions[dish].capeLevel) return 'cape' as const
  return farm.island === 'village' && farm.village.built ? 'village' as const : 'home' as const
}

function recipeCards(recipes: readonly DishId[]) {
  return `<div class="recipe-list">${recipes.map((dish) => {
    const recipe = dishDefinitions[dish]
    const destination = recipeDestination(dish)
    const action = getCookAction(farm, dish, cookingFish)
    const ingredients = getCookIngredients(farm, dish, cookingFish)
    const rawValue = ingredients.reduce((sum,item)=>sum+item.quantity*unitPrice(item,farm),0)
    const fishChoices = dish === 'grilledFish' ? `<div class="recipe-fish-choices" role="group" aria-label="Рыба для гриля">${fishIds.map(id=>`<button type="button" data-action="grill-fish" data-value="${id}" aria-pressed="${cookingFish===id}" aria-label="${fishDefinitions[id].name}, в наличии ${farm.fish[id]}" title="${fishDefinitions[id].name}">${icon(fishImage(id))}<span>×${farm.fish[id]}</span></button>`).join('')}</div>` : ''
    const locked = recipe.capeLevel ? farm.capeLevel < recipe.capeLevel : farm.buildingLevels.farmhouse < recipe.requiredLevel || !!recipe.specialization && !hasFarmhouseSpecialization(farm, recipe.specialization)
    return `<section class="recipe${locked ? ' recipe-locked' : ''}">
      <header class="recipe-summary">${icon(dishIcons[dish], 'recipe-art')}<div><h2>${recipe.name}</h2>
        <p class="recipe-value" title="Стоимость ингредиентов → цена блюда">${icon('tool-crate')} <span class="sr-only">Сырьё: </span>${rawValue} <span aria-hidden="true">→</span> ${icon('coin')} <span class="sr-only">Блюдо: </span><strong>${recipe.sellPrice}</strong></p></div></header>
      ${fishChoices}${locked ? '' : `<ul class="ingredients">${ingredients.map(stockTile).join('')}</ul>`}
      ${locked ? `<p class="recipe-reason">${action.label}</p>${button('Улучшения','upgrades',true,{secondary:true})}`
        : farm.island !== destination ? button(destination === 'cape' ? 'На Цветочный мыс' : 'На кухню', 'sail', canSailTo(farm, destination), {value:destination}):button('Готовить', 'cook', action.available, { value: dish, context: recipe.name })}${dish==='orchardTart'?button('Выбрать фрукты','new-signature',true,{value:'tart',secondary:true}):''}</section>`
  }).join('')}</div>`
}

function kitchenFamilies() {
  const familyChoices = (group: 'tart' | 'preserves', selected: string, choices: readonly { id: string; image: string; name: string }[]) => `<div class="recipe-family-choices" role="group" aria-label="${group === 'tart' ? 'Фрукты для пирога' : 'Фрукты для варенья'}">${choices.map(choice => `<button type="button" data-action="recipe-family" data-family="${group}" data-value="${choice.id}" aria-pressed="${selected === choice.id}" aria-label="${choice.name}" title="${choice.name}">${icon(choice.image)}</button>`).join('')}</div>`
  const tarts = familyChoices('tart', kitchenTart, [{ id: 'orchardTart', image: 'apple', name: 'Яблочный пирог' }, { id: 'strawberryTart', image: 'strawberry', name: 'Клубничный тарт' }, { id: 'blueberryTart', image: 'blueberry', name: 'Черничный тарт' }, { id: 'raspberryTart', image: 'raspberry', name: 'Малиновый тарт' }, { id: 'mixed', image: 'ui-tart', name: 'Ягодный тарт: выбрать сочетание' }])
  const preserves = familyChoices('preserves', kitchenPreserves, [{ id: 'appleJam', image: 'apple', name: 'Яблочное варенье' }, { id: 'orchardPreserves', image: 'ui-pear', name: 'Садовый конфитюр' }, { id: 'custom', image: 'ui-signature-bright', name: 'Варенье: выбрать фрукты' }])
  const tartCard = kitchenTart === 'mixed' ? `<section class="recipe">${icon('ui-tart', 'recipe-art')}<h2>Ягодный тарт</h2>${button('Выбрать ягоды', 'family-signature', true, { value: 'berries' })}</section>` : recipeCards([kitchenTart])
  const preservesCard = kitchenPreserves === 'custom' ? `<section class="recipe">${icon('ui-apple-jam', 'recipe-art')}<h2>Фруктовое варенье</h2>${button('Выбрать фрукты', 'family-signature', true, { value: 'preserves' })}</section>` : recipeCards([kitchenPreserves])
  const others = dishIds.filter(dish => !isTartDish(dish) && dish !== 'appleJam' && dish !== 'orchardPreserves' && !dishDefinitions[dish].capeLevel && (dish !== 'honeyCake' || canSailTo(farm, 'cape')) && (!dishDefinitions[dish].specialization || hasFarmhouseSpecialization(farm, dishDefinitions[dish].specialization!)))
  return `<div class="kitchen-family-list"><div class="recipe-family">${tarts}${tartCard}</div><div class="recipe-family">${preserves}${preservesCard}</div>${recipeCards(others)}</div>`
}
function familyRecipeName(draft: SignatureDraft, family: typeof signatureFamily): string | undefined {
  if (!family) return undefined
  const fruits = [...new Set(draft.ingredients.map(part => part.id))]
  const berry = fruits.every(id => ['strawberry', 'blueberry', 'raspberry'].includes(id))
  const names = draft.base === 'tart' ? { apple: 'Яблочный тарт', pear: 'Грушевый тарт', peach: 'Персиковый тарт', strawberry: 'Клубничный тарт', blueberry: 'Черничный тарт', raspberry: 'Малиновый тарт' }
    : { apple: 'Яблочное варенье', pear: 'Грушевый конфитюр', peach: 'Персиковое варенье', strawberry: 'Клубничное варенье', blueberry: 'Черничное варенье', raspberry: 'Малиновое варенье' }
  return fruits.length === 1 ? names[fruits[0]] : draft.base === 'tart' ? berry ? 'Ягодный тарт' : 'Фруктовый тарт' : berry ? 'Ягодное варенье' : 'Фруктовый конфитюр'
}

function marketOrders() {
  const next = getNextMarketOrders(farm)
  const rank = { ready: 0, waiting: 1, upgrade: 1, delivered: 2 }
  const orders = getMarketOrders(farm).sort((a, b) => rank[a.status] - rank[b.status])
  const cards = orders.map((order) => {
    const delivered = order.status === 'delivered'
    return `<section class="market-order" data-status="${order.status}" aria-labelledby="order-${order.lane}">
      <header class="order-header"><h2 id="order-${order.lane}">${order.name}</h2>
        <span class="order-reward">${icon('coin')} ${numberFormat.format(order.reward)}<span class="sr-only"> ${ruPlural(order.reward, ['монета','монеты','монет'])}</span></span></header>
      ${delivered ? `<p class="order-done">✓ Доставлено</p>${next.filter(item=>item.lane===order.lane).map(item=>renderNextMarketOrder(item,stockTile)).join('')}`
        : `<ul class="ingredients order-items">${order.items.map(stockTile).join('')}</ul>
          ${order.status === 'upgrade' ? button('Улучшить дом', 'upgrades', true, { secondary: true })
            : button('Доставить', 'deliver-order', order.status === 'ready', { value: order.lane, context: order.name })}`}
    </section>`
  })
  const waiting = orders.findIndex(({ status }) => status !== 'ready')
  cards.splice(waiting < 0 ? cards.length : waiting, 0, harborCard())
  return `<p class="market-return-help">После доставки следующий заказ появится после отдыха дома. Несданные заказы не сгорают от сна.</p><div class="order-list">${cards.join('')}</div>${next.length ? nav(button('К отдыху дома', 'market-next-rest', true, {secondary:true,value:String(farm.day)})) : ''}`
}

function deliveryItems(items: ReturnType<typeof getProject>['items']) {
  return items.map(({ item, delivered, available }) => {
    const { name, image } = stockLabel(item)
    return requirementLink(`${icon(image)}<span>${name}</span>
      <strong><span class="sr-only">Доставлено </span>${delivered}/${item.quantity}</strong>
      ${available ? `<span class="project-available">+${available}<span class="sr-only"> в наличии</span></span>` : ''}`, available >= item.quantity-delivered ? {kind:'delivery'} : {kind:'stock',item:{...item,quantity:item.quantity-delivered}}, 'ingredient', name, delivered === item.quantity)
  }).join('')
}

function harborCard() {
  const order = getHarborOrder(farm)
  if (!order) return ''
  const withdrawal=getHarborWithdrawal(farm)
  const next=getNextHarborOrder(farm)
  return `<section class="market-order project-card" aria-labelledby="harbor-order">
    <header class="order-header"><h2 id="harbor-order">${order.name}</h2>
      <span class="order-reward">${icon('coin')} ${order.reward}<span class="sr-only"> ${ruPlural(order.reward, ['монета','монеты','монет'])}</span></span></header>
    <ul class="ingredients project-items">${deliveryItems(order.items)}</ul>
    ${order.status === 'completed' ? `<p class="order-done">✓ Доставлено</p>${next ? renderNextHarborOrder(next,stockTile)+button('К отдыху дома','harbor-next-rest',true,{secondary:true,value:String(farm.day)}) : ''}`
      : farm.island !== 'grove' ? button('В рощу', 'sail',canSailTo(farm,'grove'), {value:'grove',secondary:true})
      : button('Доставить', 'deliver-harbor', order.status === 'ready', { context: order.name })}
    ${order.status!=='completed'&&withdrawal.items.length?`<p class="dialog-status">Неполную посылку можно забрать у причала. Припасы вернутся в запас, заказ и дневной лимит не изменятся.</p>${button('Вернуть припасы','withdraw-harbor',withdrawal.available,{secondary:true})}`:''}
  </section>`
}

function groveDockActions() {
  if (farm.island !== 'grove') return ''
  return nav(button('Причал рощи', 'project-dock', true, { secondary: true }),
    getHarborOrder(farm) ? button('Заказы гавани', 'visit-harbor') : '')
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
  const reward = `<span class="order-reward">${icon('coin')} ${project.reward}<span class="sr-only"> ${ruPlural(project.reward, ['монета','монеты','монет'])}</span></span>`
  const away=farm.island!==(fair?'home':'grove')
  const benefit = fair
    ? (complete ? 'Кондитерская открыта. Урожай на рынке стоит на 1 монету дороже.' : 'Откроет кондитерскую и прибавит 1 монету к цене урожая на рынке.')
    : (complete ? `Теперь в роще можно поймать до ${getFishLimit(farm,'grove')} рыб за день. Раньше — ${fishDailyLimit}.` : `Откроет путь на Цветочный мыс. В роще можно будет ловить до ${fishDailyLimit+1} рыб за день вместо ${fishDailyLimit}.`)
  const action = !complete && away && !farm.boatOwned ? button('Как получить лодку','project-boat')
    : !complete&&away ? button(fair?'К стройке дома':'К причалу рощи','sail',farm.boatOwned,{value:fair?'home':'grove'}) : complete
    ? (!fair && farm.island === 'grove' ? button('На Цветочный мыс','sail',true,{value:'cape'}) : '')
    : project.status === 'locked' && fair
      ? button('Улучшения', 'upgrades', true, { secondary: true })
      : button('Внести припасы', 'deliver-project', project.status === 'ready', { value: id, context: project.name })
  return `<section class="market-order project-card" aria-labelledby="${fair ? 'project-fair' : 'dialog-title'}">
    ${fair ? `<header class="order-header"><h2 id="project-fair">${project.name}</h2>${reward}</header>` : ''}
    <p class="project-benefit">${complete ? '<b>✓ Построено</b> · ' : ''}${benefit}</p>
    ${complete ? '' : `<ul class="ingredients project-items">${requirements}</ul>`}
    ${fair || complete ? action : `<footer class="project-footer">${reward}${action}</footer>`}
  </section>`
}

function irrigationRows() {
  const pair = farm.wellSpecialization === 'pipes' && irrigationMode === 'pair'
  const rowCount = pair ? 2 : 1
  const modes = farm.wellSpecialization === 'pipes'
    ? panelTabs('irrigation-mode', irrigationMode, [['row', 'Один ряд'], ['pair', 'Два ряда']])
    : ''
  return `<div class="irrigation-tools">
    <p class="coin-balance">${icon('drop')} ${farm.water}/${getWaterCapacity(farm)}<span class="sr-only"> воды</span></p>
    ${button('Набрать воды', 'refill', farm.water < getWaterCapacity(farm), { secondary: true })}
    </div>${modes}<ol class="dialog-list irrigation-rows">${Array.from({ length: gardenRows - rowCount + 1 }, (_, rowIndex) => {
      const { available, targets } = pair ? getIrrigationPair(farm, rowIndex) : getIrrigationRow(farm, rowIndex)
      const range = pair ? `${rowIndex + 1}–${rowIndex + 2}` : String(rowIndex + 1)
      const label = `${pair ? 'Ряды' : 'Ряд'} ${range}`
      const plots = farm.beds.slice(rowIndex * bedsPerRow, (rowIndex + rowCount) * bedsPerRow)
      return `<li class="dialog-row"><strong class="irrigation-number">${range}</strong>
        <div class="irrigation-plots" aria-label="${label}, нужен полив: ${targets.length}">
          ${plots.map((bed, column) => {
            const needsWater = targets.includes(rowIndex * bedsPerRow + column)
            return `<span data-plot="${bed.kind === 'crop' && bed.watered ? 'wet' : needsWater ? 'dry' : 'rest'}">${bed.kind === 'crop' ? icon(bed.crop) : ''}</span>`
          }).join('')}</div>
        ${button('Полить', pair ? 'irrigate-pair' : 'irrigate-row', available, { value: rowIndex,
          context: `${label}${targets.length ? `, воды: ${targets.length}` : ''}`,
          cost: targets.length ? { icon: 'drop', amount: targets.length } : undefined })}</li>`
    }).join('')}</ol>`
}

function marketCards() {
  const balance = `<p class="coin-balance" aria-label="${quantity(farm.coins, 'монета')}">${icon('coin')} ${numberFormat.format(farm.coins)}</p>`
  const tabs = panelTabs('market-tab', marketTab, [['buy', 'Купить'], ['sell', 'Продать'], ['orders', 'Заказы'], ['projects', 'Строить']])
  const controls = `<div class="market-controls">${balance}${tabs}</div>`
  if (marketTab === 'orders') return controls + (isProjectComplete(farm, 'fair') ? nav(button('Просьбы соседей', 'open-panel', true, { value: 'intents' })) : '') + marketOrders()
  if (marketTab === 'projects') {
    const dockBuilt=isProjectComplete(farm,'dock')
    return controls + projectCard('fair') + `<ul class="dialog-list building-destinations">
      ${row('tool-boat','Причал рощи',dockBuilt ? 'Путь на Цветочный мыс открыт' : 'Откроет путь на Цветочный мыс',button(dockBuilt?'К причалу':'Что внести','project-dock',true,{secondary:true}))}
      ${row('ui-bea','Лавандовая гавань',farm.village.built ? 'Домики соседей построены' : 'Домики для Беа и Финна',button(farm.village.built?'В гавань':'Что внести',farm.village.built?'sail':'village-project',true,{value:farm.village.built?'village':undefined,secondary:true}))}
    </ul>` + (isProjectComplete(farm,'fair') ? nav(button('Кондитерская','workshop',true,{secondary:true})) : '')
  }
  if (marketTab === 'sell') {
    const sale = getSale(farm)
    const listings=goods().filter(({count,group})=>count>0&&(marketSellGroup==='all'||group===marketSellGroup))
    return `${controls}
      ${panelTabs('market-sell-group',marketSellGroup,[['all','Всё'],['harvest','Урожай'],['kitchen','Кухня'],['shore','Берег']])}
      <ul class="dialog-list">${listings.map(({ image, name, count, price, key, trait }) =>
        row(image, name, `×${count} · ${price} за 1`, button('Выбрать количество', 'sell-item', true, { value: key, context: name }), trait)).join('')}</ul>
      ${!listings.length&&marketSellGroup!=='all'?`<div class="market-empty">${icon('tool-crate')}<span>Пусто</span></div>`:''}
      ${marketSellGroup==='all'?`<section class="market-total">${icon('tool-crate')}<div><strong>${sale.items ? `${quantity(sale.items, 'предмет')} · ${quantity(sale.coins, 'монета')}` : 'Корзина пуста'}</strong>${button('Продать всё', 'sell', sale.items > 0)}</div></section>`:''}
      ${farm.culinary.recipes.length?nav(button('Мои рецепты','open-panel',true,{value:'recipes',secondary:true})):''}`
  }
  const categories=`<nav class="market-category-icons" aria-label="Что купить">${([{id:'seeds',image:'ui-seed-carrot',name:'Семена'},{id:'trees',image:'ui-tree-apple',name:'Деревья'},{id:'care',image:'tool-feed',name:'Уход'},{id:'buildings',image:'upgrade-farmhouse-card',name:'Постройки'}] as const).map(category=>`<button type="button" data-action="market-category" data-value="${category.id}" aria-pressed="${marketCategory===category.id}" aria-label="${category.name}" title="${category.name}">${icon(category.image)}</button>`).join('')}</nav>`
  if(marketCategory==='seeds')return controls+categories+`<div class="market-seed-grid">${cropIds.map(crop=>{const definition=cropDefinitions[crop];return `<section>${icon('ui-seed-'+crop)}<strong>${definition.name}</strong><span>×${seedPackSize}</span>${button('Купить','buy-seeds',farm.coins>=definition.seedPrice,{crop,cost:{icon:'coin',amount:definition.seedPrice}})}</section>`}).join('')}</div>`
  if(marketCategory==='trees')return controls+categories+(!farm.trees.home.includes(null)?`<p class="dialog-intro">Родной сад заполнен. Перенесите дерево в питомник бесплатно, чтобы посадить другое.</p>${nav(button('Освободить место','orchard',true,{secondary:true}))}`:'')+`<ul class="dialog-list market-shop">${treeIds.map(tree=>{const definition=treeDefinitions[tree];return row('ui-tree-'+tree,definition.saplingName,quantity(definition.days,'ночь')+' до зрелости',button('Купить','buy-sapling',farm.coins>=definition.saplingPrice,{value:tree,cost:{icon:'coin',amount:definition.saplingPrice}}))}).join('')}</ul>`
  if(marketCategory==='care')return controls+categories+`<ul class="dialog-list market-shop">${row('tool-feed','Корм для кур',quantity(feedBagSize,'порция'),button('Купить','buy-feed',farm.coins>=feedBagPrice,{cost:{icon:'coin',amount:feedBagPrice}}))}${row('tool-can','Большая лейка',`Объём: ${expandedWaterCapacity}`,button(farm.canUpgraded?'Куплено':'Улучшить','upgrade-can',!farm.canUpgraded&&farm.coins>=canUpgradePrice,{cost:farm.canUpgraded?undefined:{icon:'coin',amount:canUpgradePrice}}))}</ul>`
  return controls+categories+`<ul class="dialog-list market-shop">${buildingIds.map(building=>row('upgrade-'+building+'-card',buildingDefinitions[building].name,buildingDefinitions[building].benefit,button(farm.buildingLevels[building]>=2?'Посмотреть':'Улучшить',farm.buildingLevels[building]>=2?'upgrades':'upgrade-building',farm.buildingLevels[building]>=2||farm.coins>=buildingDefinitions[building].upgradePrice,{value:building,...(farm.buildingLevels[building]<2?{cost:{icon:'coin' as const,amount:buildingDefinitions[building].upgradePrice}}:{})}))).join('')}</ul>`+nav(button('Причал','visit-boat',true,{secondary:true}))
}

function treeSelector() {
  if (farm.island !== 'home' && farm.island !== 'grove') return ''
  const choices = farm.trees[farm.island].flatMap((slot,index) => {
    const name = slot ? treeDefinitions[slot.tree].treeName : 'Свободное место'
    const label = name + ', место ' + (index + 1) + (slot?.fruitReady ? ', плодов: ' + slot.fruitReady : '')
    return [`<button type="button" data-action="tree-slot" data-value="${index}" aria-pressed="${index === treeSlot}" aria-label="${label}" title="${label}">
      ${icon(slot ? 'ui-tree-' + slot.tree : 'orchard')}<small>${index + 1}</small>
    </button>`]
  })
  return choices.length > 1 ? `<nav class="tree-selector" aria-label="Деревья этого острова">${choices.join('')}</nav>` : ''
}

function treeRow(index: number) {
  if (farm.island !== 'home' && farm.island !== 'grove') return ''
  const slot = farm.trees[farm.island][index]
  const definition = slot && treeDefinitions[slot.tree]
  const action = getTreeAction(farm, index)
  const detail = slot && definition
    ? slot.age >= definition.days
      ? `Плодов к сбору: ${slot.fruitReady}`
      : `${quantity(definition.days - slot.age, 'ночь')} до зрелости`
    : 'Место для саженца'
  return row(slot?.tree === 'apple' ? 'apple' : 'orchard', definition?.treeName ?? `Свободное место ${index + 1}`, detail,
    button(action.kind === 'pick' ? 'Собрать плоды' : slot ? 'Осмотреть' : 'Посадить дерево', 'visit-tree', true, { value: index }))
}

function nurseryCard(slot?: number) {
  if (farm.island !== 'home' && farm.island !== 'grove' || !farm.treeNursery.length) return ''
  const target = slot ?? farm.trees[farm.island].findIndex(tree => tree === null)
  const available = farm.trees[farm.island][target] === null
  return `<section aria-label="Питомник"><h2>Питомник · ${farm.treeNursery.length}</h2>
    <p class="dialog-intro">Перенос бесплатный. Возраст и созревшие плоды сохраняются. В питомнике рост и новые плоды на паузе.${available ? '' : ' Чтобы вернуть дерево, сначала освободите место в саду.'}</p>
    <ul class="dialog-list">${farm.treeNursery.map(({ id, tree }) => {
      const definition = treeDefinitions[tree.tree]
      const detail = [nurseryFruitDetail(tree), treeVariantCopy(tree)].filter(Boolean).join(' ')
      return row('ui-tree-' + tree.tree, definition.treeName, detail, button(slot === undefined ? 'Вернуть в сад' : 'Посадить здесь', 'return-nursery-tree', available, { value: id, context: definition.treeName }), tree.trait)
    }).join('')}</ul></section>`
}

let fishingGame: ReturnType<typeof createFishingGame> | undefined
let fishingToken: number | undefined
let fishingPractice: ReturnType<typeof createFishingPractice>
let workshopGame: ReturnType<typeof createWorkshop> | undefined
let cookeryGame: ReturnType<typeof createCookery> | undefined
let arrangementGame: ReturnType<typeof createArrangement> | undefined

function stopFishing() {
  fishingPractice?.cancel()
  fishingPractice = undefined
  fishingGame?.destroy()
  fishingGame = undefined
  if (fishingToken !== undefined) {
    cancelFishingTrip(farm, fishingToken)
    fishingToken = undefined
    saveFarm()
  }
  island.setFishing(false)
}

function stopWorkshop() { workshopGame?.destroy(); workshopGame = undefined }
function stopCookery() { cookeryGame?.destroy(); cookeryGame = undefined }
function stopArrangement() { arrangementGame?.destroy(); arrangementGame = undefined }

function currentCommunityRequest() {
  if (!communityRequest) return undefined
  if (communityRequest.kind === 'intent') {
    const request = communityRequest
    return getCommunityOrders(farm).find(order => order.id === request.orderId)
  }
  const request = communityRequest
  return getNeighborPlans(farm).find(plan => plan.id === request.planId && plan.resident === request.resident)
}
function communityOffers() {
  const request = currentCommunityRequest()
  return request ? getIntentOffers(farm, request.intentId) : []
}
function updateCommunityReturn() {
  try {
    if (!saveStore.issue) {
      if (communityRequest) localStorage.setItem(communitySelectionKey, JSON.stringify({ request: communityRequest, food: requestedFood }))
      else localStorage.removeItem(communitySelectionKey)
    }
  } catch { /* The current menu also works without browser storage. */ }
  const request = currentCommunityRequest()
  const route = communityReturnRoute(communityRequest?.kind ?? 'intent', farm.island, 'recipe',
    requestedFood ? communityOffers().find(offer => offer.id === requestedFood)?.count : undefined)
  communityResume.hidden = !communityRequest || dialog.open || island.isCrossing()
  communityResume.querySelector('span')!.textContent = route.label
  communityResume.setAttribute('aria-label', request ? `Вернуться: ${request.title}. ${route.label}` : 'Вернуться к соседям')
}
async function resumeCommunityRequest(mode: 'request' | 'recipe' = 'request') {
  const request = communityRequest
  if (!request || island.isCrossing()) return
  const route = communityReturnRoute(request.kind, farm.island, mode,
    requestedFood ? communityOffers().find(offer => offer.id === requestedFood)?.count : undefined)
  if (route.mode === 'recipe') { panelHistory.length = 0; openPanel('request-food', false); return }
  const destination = route.destination
  if (route.travel) {
    if (!canSailTo(farm, destination)) { openPanel('boat', true, destination); return }
    if (fieldViewButton.getAttribute('aria-pressed') === 'true') toggleFieldView()
    closeDialog()
    await island.crossIsland(() => perform(() => sail(farm, destination), false, true))
    if (farm.island !== destination) return
  }
  panelHistory.length = 0
  requestedFood = undefined
  if (request.kind === 'intent') {
    communityOrderId = request.orderId
    openPanel(getCommunityOrders(farm).some(order => order.id === request.orderId) ? 'intent' : 'intents', false)
  } else {
    communityResident = request.resident
    const current = getNeighborPlans(farm).find(plan => plan.resident === request.resident)
    communityRequest = current ? { kind: 'neighbor', resident: request.resident, planId: current.id } : undefined
    openPanel('neighbor', false)
  }
}
function requestedRecipe() {
  const offer = communityOffers().find(offer => offer.id === requestedFood)
  if (!offer) return undefined
  if (offer.source === 'dish') {
    const dish = offer.identity as DishId
    return { offer, ingredients: getCookIngredients(farm, dish), action: getCookAction(farm, dish), destination: recipeDestination(dish) }
  }
  if (offer.source === 'handmade') return { offer, ingredients: [{ kind: 'produce', item: 'wheat', quantity: 2 }, { kind: 'eggs', quantity: 1 }] as StockItem[], action: getWorkshopAction(farm), destination: farm.island === 'village' ? 'village' as const : 'home' as const }
  const recipe = farm.culinary.recipes.find(recipe => `signature:${recipe.id}` === offer.id)
  if (!recipe) return undefined
  const action = getSignatureAction(farm, recipe)
  return { offer, ingredients: action.items, action, destination: farm.island === 'village' ? 'village' as const : 'home' as const }
}
function requestedRecipeCard() {
  const source = requestedRecipe()
  const deadline = selectedDailyIntent(farm, communityRequest) ? renderIntentDeadline(farm) : ''
  if (!source) {
    const recovery = communityRequest?.kind === 'neighbor' ? getNeighborFoodRecovery(farm, communityRequest.planId) : undefined
    return `<p class="dialog-status">${recovery?.message || 'Этот рецепт больше недоступен. Выберите другое угощение.'}</p>${button('Выбрать другое угощение', 'resume-community')}`
  }
  const { offer, ingredients, action } = source
  if (offer.available) return `${deadline}<section class="community-source community-root"><div class="community-source-picture">${communityArt.offerIcon(offer)}</div><h2>${escapeHtml(offer.name)}</h2><p class="dialog-intro">Угощение готово. В запасе: ${offer.count}.</p>${button(communityRequest?.kind === 'neighbor' ? 'К встрече' : 'К просьбе', 'resume-community')}</section>`
  const sourceLabel = farm.island !== source.destination ? 'К месту готовки' : ingredients.some(item => ingredientCount(farm, item) < item.quantity) ? 'Найти ингредиенты' : 'Что нужно для рецепта'
  return `${deadline}<section class="community-source community-root"><div class="community-source-picture">${communityArt.offerIcon(offer)}</div><h2>${escapeHtml(offer.name)}</h2><ul class="ingredients">${ingredients.map(stockTile).join('')}</ul>
    ${action.available ? button(offer.source === 'signature' ? 'Повторить точно ×1' : 'Готовить', offer.source === 'signature' ? 'request-repeat-exact' : 'request-start-cook') : `${button(sourceLabel, 'request-food-source')}<p class="recipe-reason">${action.label}</p>`}${nav(button('Другое угощение', 'resume-community', true, { secondary: true }))}</section>`
}
async function guideRequestedFood() {
  const source = requestedRecipe()
  if (!source) { await resumeCommunityRequest(); return }
  if (source.offer.source === 'dish') {
    const dish = source.offer.identity as DishId, definition = dishDefinitions[dish]
    if (definition.capeLevel && (!canSailTo(farm, 'cape') || farm.capeLevel < definition.capeLevel)
      || !definition.capeLevel && (farm.buildingLevels.farmhouse < definition.requiredLevel || definition.specialization && !hasFarmhouseSpecialization(farm, definition.specialization))) {
      await showRequirement({ kind: 'stock', item: { kind: 'dishes', item: dish, quantity: 1 } }); return
    }
  } else if (source.offer.source === 'signature' && source.offer.identity === 'preserves' && farm.buildingLevels.farmhouse < 2) {
    await showRequirement({ kind: 'building', building: 'farmhouse' }); return
  }
  const missing = source.ingredients.find(item => ingredientCount(farm, item) < item.quantity)
  if (missing) { await showRequirement({ kind: 'stock', item: missing }); return }
  if (farm.island !== source.destination) {
    if (!canSailTo(farm, source.destination)) { openPanel('boat'); return }
    closeDialog(); await island.crossIsland(() => perform(() => sail(farm, source.destination), false, true)); openPanel('request-food', false); return
  }
  if (source.offer.source === 'handmade' && !isProjectComplete(farm, 'fair')) { marketTab = 'projects'; openPanel('market'); return }
  if (!source.action.available) notify(source.action.label, false)
}
function startRequestedFood() {
  const source = requestedRecipe()
  if (!source || !source.action.available) { void guideRequestedFood(); return }
  if (source.offer.source === 'handmade') {
    pastryShape = source.offer.identity as WorkshopShape
    workshopRecipe = 'pastry'; openPanel('workshop'); return
  }
  if (source.offer.source === 'dish') {
    cookingDish = source.offer.identity as DishId; cookingMode = 'dish'
    if(cookingDish==='grilledFish')cookingFish=getGrillFish(farm)
    if (cookingDish === 'farmhouseBread') { workshopRecipe = 'bread'; openPanel('workshop') } else openPanel('cookery')
    return
  }
  repeatRequestedFood()
}
function repeatRequestedFood() {
  const request = currentCommunityRequest()
  if (panel !== 'request-food' || !request || !requestedFood) return
  perform(() => repeatRequestedSignature(farm, request.intentId, requestedFood!), false, true)
}

function mountFishing(practiceOnly = false) {
  stopFishing()
  const practice = practiceOnly ? createFishingPractice(farm) : undefined
  if (practiceOnly ? !practice : !getFishAction(farm).available) return
  fishingPractice = practice
  const config = practice?.config ?? getFishingTripConfig(farm)
  const remaining = getFishLimit(farm) - (farm.island === 'grove' ? farm.fishCaughtToday.grove : farm.fishCaughtToday.home)
  dialogContent.innerHTML = '<div class="fishing-host"></div>'
  const host = dialogContent.querySelector<HTMLElement>('.fishing-host')!
  fishingGame = createFishingGame(host, {
    practiceOnly,
    seed: practice?.seed ?? farm.day*1009+(farm.fishingTripSerial+1)*9176+(farm.island==='grove'?71:17),
    capacity: practice ? config.capacity : Math.min(config.capacity, remaining), maxDepth: config.depth, resilience: config.resilience,
    habitat:config.habitat,
    fish: practice?.fish ?? (farm.island === 'grove' ? 'seaBass' : 'perch'),
    onCast() {
      if (practice) {
        if (practice !== fishingPractice || !practice.cast()) return false
        island.setFishing(true)
        return true
      }
      const trip = beginFishingTrip(farm)
      if (!trip.ok || trip.token === undefined) { notify(trip.message, false); return false }
      fishingToken = trip.token
      island.setFishing(true)
      saveFarm()
      return true
    },
    onCancel: () => { if (!practice || practice === fishingPractice) closeDialog() },
    onAgain: () => { if (!practice || practice === fishingPractice) mountFishing(practiceOnly) },
    onPractice: practiceOnly ? undefined : () => mountFishing(true),
    onFinish({ catches }) {
      if (practice) {
        if (practice !== fishingPractice) return false
        island.setFishing(false)
        return practice.finish(catches)
      }
      const token = fishingToken
      fishingToken = undefined
      island.setFishing(false)
      if (token === undefined) return false
      perform(() => finishFishingTrip(farm, token, catches), false, true)
      return getFishAction(farm).available
    },
  })
  host.querySelector<HTMLButtonElement>('.fishing-practice-shore, .fishing-controls .fishing-action')?.focus({ preventScroll: true })
}

function pastryChoices() {
  return `<div class="pastry-pattern-choices">${workshopShapes.map(shape => `<button type="button" data-action="pastry-shape" data-value="${shape}" aria-pressed="${pastryShape===shape}">${icon(pastryIcons[shape])}<span>${workshopDefinitions[shape].name}</span><small>${farm.workshopPatterns.includes(shape)?'Освоено':'Освоить в мастерской'}</small></button>`).join('')}</div>`
}

function villageProjectCard() {
  const project = getVillageProject(farm)
  if (project.status === 'completed') return nav(button('Отправиться', 'sail', farm.boatOwned, { value: 'village' }))
  const unlocked = project.unlocked
  const finishing = unlocked && farm.coins >= project.coins && project.items.every(({item, delivered, available}) => delivered + available >= item.quantity)
  const buildAction = finishing || project.items.every(({item, delivered}) => delivered >= item.quantity)
  return `<div class="harbour-preview"><img src="${iconUrl('village-plate')}" alt="Домики, мастерская и стол для ужина в Лавандовой гавани"></div>
    ${unlocked ? '' : `<ul class="dialog-list">${row('ui-market', 'Гости ярмарки', `${Math.min(villageGuestTarget, farm.fairGuestsServed)}/${villageGuestTarget}`)}${isProjectComplete(farm, 'fair') ? '' : row('ui-market', 'Ярмарка', '', button('К стройке', 'fair-project'))}</ul>`}
    <ul class="ingredients">${deliveryItems(project.items)}</ul>
    ${renderHarbourFishChoice(farm)}
    ${renderVillageBudget(farm,icon('coin'),(content,ready)=>requirementLink(content,{kind:'journey',island:'village',id:'village-coins'},'ingredient','Монеты для постройки Живой бухты',ready))}
    ${nav(button(buildAction ? 'Построить' : 'Внести припасы', 'build-village', project.status === 'ready', buildAction ? { cost: { icon: 'coin', amount: project.coins } } : {}), button('Кондитерская', 'workshop', isProjectComplete(farm, 'fair'), { secondary: true }))}`
}

function neighboursCard() {
  const homes = getVillageHomeCount(farm)
  const resident = farm.village.residents[villageSlot]
  const houseTabs = `<nav class="house-selector" aria-label="Домики соседей">${[0, 1].map(slot => {
    const occupant = farm.village.residents[slot]
    return `<button type="button" data-action="village-slot" data-value="${slot}" aria-pressed="${villageSlot === slot}">${icon(occupant ? `ui-${occupant}` : 'upgrade-farmhouse-card')}<span>Домик ${slot + 1}</span><small>${slot >= homes ? villageHomeProgress(farm) : occupant ? residentDefinitions[occupant].name : 'Свободен'}</small></button>`
  }).join('')}</nav>`
  const dinner = `<div class="harbour-next">${icon('ui-grilled-fish')}<div><strong>${homes < 2 ? `Общие ужины · ${Math.min(2, farm.village.meals)}/2` : 'Общий ужин'}</strong>${homes < 2 ? '<small>Второй домик после двух ужинов</small>' : ''}</div>${button('Накрыть стол', 'village-meal')}</div>`
  return `${houseTabs}${villageSlot >= homes ? dinner : `
    <div class="resident-cards" data-occupied="${Boolean(resident)}">${residentIds.filter(id => resident ? id === resident : !farm.village.residents.includes(id)).map(id => {
      const def = residentDefinitions[id]
      const service = getResidentService(farm, id, pastryShape)
      const here = resident === id
      return `<section class="resident-card" data-present="${here}">${icon(`ui-${id}`, 'resident-portrait')}<h2>${def.name}</h2><div class="neighbour-promise">${icon(id==='bea'?'ui-handmade-round':'tool-rod')}<span>${neighborHelpStatus(farm,id)?.summary ?? (id==='bea'?'3 изделия в день':'+1 рыба · крепче снасть')}</span></div>
        ${here ? button('Замысел соседа', 'open-neighbor', true, { value: id, secondary: true }) : ''}
        ${here ? (id === 'bea' ? `<div class="resident-patterns">${pastryChoices()}</div><ul class="ingredients">${[{ kind: 'produce', item: 'wheat', quantity: 4 }, { kind: 'eggs', quantity: 2 }].map(item => stockTile(item as StockItem)).join('')}</ul>${button(farm.culinary.tastings.bea.bonus||farm.neighbors.bea.helpReady?'Испечь ×4':'Испечь ×3', 'resident-service', service.available, { value: id })}`
          : button(farm.village.scouting ? 'Маршрут готов · +1 рыба' : 'Разведать · +1 рыба', 'resident-service', service.available, { value: id }))
        : button('Пригласить', 'invite-resident', true, { value: id })}
        ${here ? neighborHelpCard(farm,id) : ''}
        ${here&&!service.available?`<p class="dialog-status">${service.label}</p>${id==='bea'&&!farm.workshopPatterns.includes(pastryShape)?button(`Освоить: ${workshopDefinitions[pastryShape].name.toLowerCase()}`,'practice-pattern',true,{value:pastryShape}):''}`:''}
      </section>`
    }).join('')}</div>`}
    ${villageSlot < homes ? dinner : ''}
    ${nav(button('Кухня', 'kitchen'),button('Кондитерская', 'workshop', true, {secondary:true}))}`
}

let selectedWarehouseRequest: StockItem | undefined
type PanelVisit = {
  marketNextOpen: string[];
  warehouseRequest: StockItem | undefined;
  expeditionPort: ExpeditionPort; expeditionOffer: string;
  warehouse: typeof selectedWarehouse; freightPlanOpen: boolean; journeyDetailsOpen: boolean; journalDetailsOpen: boolean;
  inventoryGroup: 'harvest'|'kitchen'|'shore'; boatIsland: (typeof islandIds)[number];
  panel: Panel; marketTab: 'buy'|'sell'|'orders'|'projects'; marketCategory:'seeds'|'trees'|'care'|'buildings';marketSellGroup:'all'|'harvest'|'kitchen'|'shore';bagTab: 'seeds'|'harvest'; archiveGroup: ArchiveGroup;
  treeSlot: number; previewSeed: CropId; specializationBuilding: BuildingId; previewSpecialization: BuildingBranch | undefined;
  irrigationMode: 'row'|'pair'; villageSlot: number; pastryShape: WorkshopShape;
  workshopRecipe: 'pastry'|'bread'; cookingDish: DishId; cookingFish: FishId; seedPickerBed: number | undefined; scroll: number; focus: string | undefined;
  signatureBase:SignatureDraft['base'];signatureSlots:(SignatureIngredient|null)[];signatureSlot:number;signatureRepeatId:string|undefined;expandedRepeatId:string|undefined;cookingMode:'dish'|'signature';
  communityOrderId:string;communityResident:ResidentId;requestedFood:FoodOfferId|undefined;
  kitchenTart:KitchenTart;kitchenPreserves:KitchenPreserves;signatureFamily:SignatureFamily;
}
const panelHistory: PanelVisit[] = []
let panelRenderVersion = 0
function focusKey(button: HTMLButtonElement) {
  const controls = Object.entries(button.dataset).filter(([key])=> !['selected','active','ready'].includes(key))
  return JSON.stringify(controls.length ? controls : [button.className,button.getAttribute('aria-label') ?? button.textContent?.trim()])
}
function leaveScene(){if(panelHistory.length)goBack();else closeDialog()}
function rememberPanel(): PanelVisit {
  const focused = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null
  return {marketNextOpen:[...dialogContent.querySelectorAll<HTMLDetailsElement>('[data-market-next][open]')].map(item=>item.dataset.marketNext!),warehouseRequest:selectedWarehouseRequest,expeditionPort:selectedExpeditionPort,expeditionOffer:selectedExpeditionOffer,panel:panel!,journalDetailsOpen:dialogContent.querySelector<HTMLDetailsElement>('.discovery-roadmap')?.open ?? false,journeyDetailsOpen:dialogContent.querySelector<HTMLDetailsElement>('.journey-details')?.open ?? false,warehouse:selectedWarehouse,freightPlanOpen:dialogContent.querySelector<HTMLDetailsElement>('.bay-freight-plan')?.open ?? false,inventoryGroup,boatIsland,marketTab,marketCategory,marketSellGroup,bagTab,archiveGroup,treeSlot,previewSeed,specializationBuilding,previewSpecialization,
    irrigationMode,villageSlot,pastryShape,workshopRecipe,cookingDish,cookingFish,seedPickerBed,signatureBase,signatureSlots:signatureSlots.map(part=>part?{...part}:null),signatureSlot,signatureRepeatId,expandedRepeatId,cookingMode,communityOrderId,communityResident,requestedFood,kitchenTart,kitchenPreserves,signatureFamily,scroll:dialogContent.scrollTop,focus:focused?focusKey(focused):undefined}
}
function goBack() {
  const previous=panelHistory.pop()
  if(!previous)return
  journeyDetailsOpen=previous.journeyDetailsOpen
  journalDetailsOpen=previous.journalDetailsOpen
  selectedExpeditionPort=previous.expeditionPort; selectedExpeditionOffer=previous.expeditionOffer
  selectedWarehouseRequest=previous.warehouseRequest
  selectedWarehouse=previous.warehouse; freightPlanOpen=previous.freightPlanOpen
  inventoryGroup=previous.inventoryGroup;boatIsland=previous.boatIsland
  marketTab=previous.marketTab;marketCategory=previous.marketCategory;marketSellGroup=previous.marketSellGroup;bagTab=previous.bagTab;archiveGroup=previous.archiveGroup;treeSlot=previous.treeSlot
  previewSeed=previous.previewSeed;specializationBuilding=previous.specializationBuilding;previewSpecialization=previous.previewSpecialization
  irrigationMode=previous.irrigationMode;villageSlot=previous.villageSlot;pastryShape=previous.pastryShape
  workshopRecipe=previous.workshopRecipe;cookingDish=previous.cookingDish;cookingFish=previous.cookingFish
  seedPickerBed=previous.seedPickerBed
  signatureBase=previous.signatureBase;signatureSlots=previous.signatureSlots.map(part=>part?{...part}:null);signatureSlot=previous.signatureSlot;signatureRepeatId=previous.signatureRepeatId;expandedRepeatId=previous.expandedRepeatId;cookingMode=previous.cookingMode
  communityOrderId=previous.communityOrderId;communityResident=previous.communityResident;requestedFood=previous.requestedFood
  kitchenTart=previous.kitchenTart;kitchenPreserves=previous.kitchenPreserves;signatureFamily=previous.signatureFamily
  openPanel(previous.panel,false,farm.island,'page.fold')
  dialogContent.querySelectorAll<HTMLDetailsElement>('[data-market-next]').forEach(item=>item.open=previous.marketNextOpen.includes(item.dataset.marketNext!))
  const restoredVersion = panelRenderVersion
  requestAnimationFrame(()=>{
    // A newer selection or dismissal must not receive an old page’s scroll or focus.
    if (!dialog.open || panel !== previous.panel || panelRenderVersion !== restoredVersion) return
    dialogContent.scrollTop=previous.scroll
    const target=Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).find(button=>focusKey(button)===previous.focus&&button.getClientRects().length>0)
    if (target) target.focus({preventScroll:true})
  })
}
let harbourScene: {destroy():void} | undefined
let selectedWarehouse = farm.island
let selectedExpeditionPort: ExpeditionPort = 'mill'
let selectedExpeditionOffer = 'mill-grain'
let freightPlanOpen = false
let musicView: BayMusicViewState | undefined
function stopHarbour() {
  if (!harbourScene) return
  harbourScene.destroy()
  harbourScene = undefined
  status()
  island.render(farm)
}
function saveHarbour() {
  saveFarm()
}

function harbourGoods() {
  const foods = new Map<string, ReturnType<typeof foodDescriptors>[number]>(foodDescriptors(farm).map(food => [food.id,food]))
  const goods = marketStock.map(item => {
    const id = bayProductId(item), label = stockLabel(item), food = foods.get(id)
    const tags = food ? [...food.ingredients,...describeFood(food)] : [id]
    if (item.kind === 'fruit') tags.push('fruit','sweet')
    if (item.kind === 'produce' && berryCropIds.includes(item.item as typeof berryCropIds[number])) tags.push('fruit','berry','sweet')
    return {id,identity:id,name:label.name,image:iconUrl(label.image).replace(import.meta.env.BASE_URL,'/'),icon:label.image,
      quantity:ingredientCount(farm,item),basePrice:unitPrice(item,farm),tags,food,item}
  })
  const signatures = [...foods.values()].filter(food => food.source === 'signature').map(food => {
    const image = food.identity === 'tart' ? 'ui-tart' : 'ui-signature-' + food.processing
    return {id:String(food.id),identity:String(food.id),name:food.name,image:iconUrl(image).replace(import.meta.env.BASE_URL,'/'),icon:image,
      quantity:food.count,basePrice:food.sellPrice,tags:[...food.ingredients,...describeFood(food),food.processing ?? 'bright'],signature:true,food,item:undefined}
  })
  return [...goods,...signatures]
}
function openShopScene(host:HTMLElement) {
  const catalog = harbourGoods(), byId = new Map(catalog.map(row => [row.id,row]))
  const products = ():BayShopStock[] => harbourGoods().map(row => ({...row,
    quantity:row.quantity+(farm.freight.warehouses.village[row.id] ?? 0)})).filter(row => row.quantity>0)
  const options:BayShopOptions = {state:farm.bayShop,products,catalog,
    takeStock:(id,n)=>{ const reserved=reserveShopGoods(farm,id,n); if(reserved)status(); return reserved },
    returnStock:(id,n)=>{returnShopGoods(farm,id,n);status()},
    onEarn:n=>{farm.coins+=n;textAt('status-coins',numberFormat.format(farm.coins));bayAudio.playEvent('trade.receive')},onChange:saveHarbour,onClose:leaveScene,
    onOpenFreight:()=>openPanel('bay-freight'),
    onOpenCommissions:()=>openPanel('shop-commissions'),
    onOpenMusic:()=>openPanel('bay-music'),
    onGoRest:()=>{void visitPanelAt('home','rest')},
    performanceBonus:()=>Number(farm.concertDay === farm.day),
    renderProduct(product,cls) {
      const entry=byId.get(product.id)
      if(entry?.food?.source==='signature') {
        const recipe=farm.culinary.recipes.find(r=>'signature:'+r.id===product.id)
        if(recipe)return `<span class="${cls}">${signatureResultPicture(recipe,{icon})}</span>`
      }
      const cooked=entry?.food?.preparation
      if(cooked && (cooked.family==='preserves'||cooked.family==='decorate'))return `<span class="${cls}">${cookeryResultPicture(cooked,entry?.food?.recipeIngredients??[],{icon})}</span>`
      if(entry?.item?.kind==='variants') return `<span class="${cls}">${itemIcon(entry.icon,entry.item.trait)}</span>`
      return icon(entry?.icon ?? 'ui-market',cls)
    },
  }
  harbourScene=mountBayShop(host,options)
  applyIngredientFinishes(host)
}
function openMusicScene(host:HTMLElement) {
  harbourScene=createBayMusic(host,{state:farm.musicGarden,viewState:musicView,onViewChange:view=>{ musicView=view },getMaterialStock:()=>gardenMaterialStock(farm),getMaterialSources:()=>getMusicMaterialGuidance(farm).sources,
    onSave:state=>{farm.musicGarden=state;saveHarbour()},onClose:leaveScene,
    onPerformance:()=>{
      if(farm.concertDay===farm.day)return false
      farm.concertDay=farm.day
      saveHarbour()
      return true
    },
    isConcertDone:()=>farm.concertDay===farm.day,
    getFestivalConcertState:()=>getFestivalConcertState(farm),
    onOpenShop:()=>openPanel('bay-shop'),
    onRequestMaterials:()=>{const level=installGardenInstrument(farm);if(level!==undefined){saveHarbour();bayAudio.playEvent('menu.accept')}return level},
    onOpenSupplies:()=>openPanel('music-supplies'),
  })
}
function harbourPlaces() {
  return nav(button('Праздники гавани','open-panel',true,{value:'festival'})+button('Своя лавка','open-panel',true,{value:'bay-shop'})+
    button('Грузовой паром','open-panel',true,{value:'bay-freight'})+
    button('Музыкальный сад','open-panel',true,{value:'bay-music'}))
}

function beginExactSale(target: SaleTarget) {
  const stock = saleStock(farm, target)
  if (!stock || stock.count < 1) return
  const name = target.kind === 'signature' ? farm.culinary.recipes.find(recipe => recipe.id === target.key)!.name
    : goods().find(item => item.key === target.key)!.name
  selectedSale = { ...target, name }; saleQuantity = '1'; saleReceipt = undefined
  openPanel('sale')
  const input = dialogContent.querySelector<HTMLInputElement>('[data-sale-quantity]')
  input?.focus({ preventScroll: true }); input?.select()
}

function updateSaleQuote() {
  if (panel !== 'sale' || !selectedSale || saleReceipt) return
  const stock = saleStock(farm, selectedSale)
  const quote = stock && exactSaleQuote(saleQuantity, stock.count, stock.price)
  const summary = dialogContent.querySelector<HTMLElement>('.exact-sale-summary')
  const confirm = dialogContent.querySelector<HTMLButtonElement>('[data-action="confirm-sale"]')
  if (summary) summary.textContent = quote?.valid ? `Цена: ${quantity(quote.total, 'монета')}. Останется: ${quote.remaining}.`
    : `Введите целое число от 1 до ${stock?.count ?? 0}.`
  if (confirm) { confirm.disabled = !quote?.valid; confirm.textContent = quote?.valid ? `Продать ${quote.quantity} · ${quote.total}` : 'Продать выбранное' }
}

function confirmExactSale() {
  if (panel !== 'sale' || !selectedSale || saleReceipt) return
  const stock = saleStock(farm, selectedSale)
  const quote = stock && exactSaleQuote(saleQuantity, stock.count, stock.price)
  if (!quote?.valid) { updateSaleQuote(); return }
  const result = selectedSale.kind === 'signature' ? sellSignature(farm, selectedSale.key, quote.quantity)
    : sellMarketItem(farm, selectedSale.key, quote.quantity)
  if (result.ok) saleReceipt = { quantity: quote.quantity, total: quote.total, remaining: quote.remaining }
  if (perform(() => result, false, true)) playBaySound('trade.receive')
}


function drawPanel() {
  if (!panel || harbourScene) return
  if (panel === 'fishing' && fishingGame || panel === 'workshop' && workshopGame || panel === 'cookery' && cookeryGame || panel === 'arrangement' && arrangementGame) return
  panelRenderVersion++
  requirementLinks.clear()
  const sceneBack=dialog.querySelector<HTMLButtonElement>('.scene-back')!
  sceneBack.hidden=panelHistory.length===0||panel!=='fishing'&&panel!=='workshop'&&panel!=='cookery'&&panel!=='arrangement'
  sceneBack.setAttribute('aria-label',panelHistory.length?`Назад: ${panelTitles[panelHistory.at(-1)!.panel]}`:'Назад')
  backButton.hidden=panelHistory.length===0
  backButton.setAttribute('aria-label',panelHistory.length?`Назад: ${panelTitles[panelHistory.at(-1)!.panel]}`:'Назад')
  for (const back of [backButton, sceneBack]) {
    back.title = `${back.getAttribute('aria-label')} (Esc / Alt + ←)`
    back.setAttribute('aria-keyshortcuts', 'Escape Alt+ArrowLeft')
  }
  closeButton.title = panelHistory.length ? 'Закрыть все меню' : 'Закрыть меню (Esc)'
  dialog.querySelectorAll<HTMLButtonElement>('.dialog-destinations [data-panel]').forEach(button=>button.setAttribute('aria-current',String(button.dataset.panel===panel)))
  const title = panel === 'specialize' ? `${buildingDefinitions[specializationBuilding].name} · ур. 3`
    : panel === 'workshop' && workshopRecipe === 'bread' ? 'Домашний хлеб' : panel === 'neighbor' ? residentDefinitions[communityResident].name : panelTitles[panel]
  dialogTitle.textContent = panelBanners[panel] ?? title
  dialogTitle.setAttribute('aria-label', title)
  dialog.dataset.panel = panel
  dialog.dataset.marketTab = marketTab
  dialogEmblem.src = iconUrl(panel === 'specialize' ? `upgrade-${specializationBuilding}-card` : panelEmblems[panel])
  const focused = document.activeElement instanceof HTMLButtonElement && dialogContent.contains(document.activeElement)
    ? document.activeElement
    : undefined

  switch (panel) {
    case 'sale': {
      const stock = selectedSale && saleStock(farm, selectedSale)
      if (!selectedSale || !stock) { dialogContent.innerHTML = '<p class="dialog-intro">Товар недоступен.</p>'; break }
      dialogContent.innerHTML = `<section class="exact-sale"><h2>${escapeHtml(selectedSale.name)}</h2>${saleReceipt
        ? `<p class="exact-sale-receipt" role="status">Продано: ${saleReceipt.quantity}. Цена: ${quantity(saleReceipt.total, 'монета')}. Осталось: ${saleReceipt.remaining}.</p>${nav(button('Продать ещё', 'sale-again', stock.count > 0), button('Назад', 'back', true, { secondary: true }))}`
        : `<p>В запасе: ${stock.count}. За 1: ${quantity(stock.price, 'монета')}.</p><label for="sale-quantity">Количество</label><input id="sale-quantity" data-sale-quantity type="number" min="1" max="${stock.count}" step="1" inputmode="numeric" value="${escapeHtml(saleQuantity)}" aria-describedby="sale-quote"><p id="sale-quote" class="exact-sale-summary" aria-live="polite"></p>${nav(button('Продать выбранное', 'confirm-sale', false), button('Отмена', 'back', true, { secondary: true }))}`}</section>`
      updateSaleQuote()
      break
    }
    case 'festival':
      dialogContent.innerHTML=renderFestivalPanel(farm,{celebrated:celebratedFestival,celebrationEffect:celebrationReceipt?.effect,celebrationCoins:celebrationReceipt?.coins,icon})
      break
    case 'bay-shop':
    case 'bay-music': {
      const host=document.createElement('section')
      dialogContent.replaceChildren(host)
      if(panel==='bay-shop')openShopScene(host);else openMusicScene(host)
      break
    }
    case 'shop-commissions':
      dialogContent.innerHTML = renderShopCommissions(farm, id => { const recipe = farm.culinary.recipes.find(recipe => recipe.id === id); return recipe ? signatureResultPicture(recipe,{icon}) : '' })
      break
    case 'warehouse-supply': {
      const request = selectedWarehouseRequest, supply = request && getLocalWarehouseSupply(farm, request)
      dialogContent.innerHTML = request ? `<section class="music-supply"><h2>${itemIcon(stockLabel(request).image)} ${escapeHtml(stockLabel(request).name)}</h2><p>${escapeHtml(warehouseSupplyCopy(farm, request))}</p><p>Перенос только в припасы. Ничего не готовится и не вносится в проект.</p>${supply ? button(`Забрать в припасы ×${supply.quantity}`, 'warehouse-supply-withdraw', true, {value:warehouseConfirmationValue(supply)}) : ''}</section>${nav(button('Назад', 'back', panelHistory.length > 0, {secondary:true}))}` : '<p>Выберите нужный запас через подсказку ингредиента.</p>'
      break
    }
    case 'music-supplies': {
      const guide = getMusicMaterialGuidance(farm), stock = gardenMaterialStock(farm)
      dialogContent.innerHTML = `<p class="dialog-intro">Инструмент использует припасы и склад Лавандовой гавани. С других складов материалы нужно забрать лично.</p>${guide.materials.map(item => {
        const missing = Math.max(0,item.quantity-stock[item.id]), name = musicMaterialNames[item.id]
        const warehouses = islandIds.filter(port => (farm.freight.warehouses[port][item.id] ?? 0) > 0)
          .sort((a,b) => Number(b === guide.warehouse)-Number(a === guide.warehouse))
        return `<section class="music-supply"><h2>${name} · ${stock[item.id]}/${item.quantity}</h2><p>${guide.sources[item.id]}</p>${warehouses.map(port => {
          const amount = farm.freight.warehouses[port][item.id]!, count = Math.min(missing,amount)
          return `<p>${islandNames[port]}: ${amount}</p>${count && port !== 'village' ? nav(port === farm.island
            ? button(`Забрать в припасы ×${count}`,'freight-withdraw',true,{value:`${port}|${item.id}|${count}`})
            : button(`К складу: ${islandNames[port]}`,'music-warehouse-visit',canSailTo(farm,port),{value:port})) : ''}`
        }).join('')}${missing ? `<ul class="ingredients">${requirementLink(`<span>Где собрать: ${name}</span>`,{kind:'stock',item:{...musicMaterialItems[item.id],quantity:missing}},'ingredient',name)}</ul>` : '<p>Материалы готовы для инструмента.</p>'}</section>`
      }).join('')}${nav(button('Вернуться в музыкальный сад','open-panel',true,{value:'bay-music'}))}`
      break
    }
    case 'bay-freight': {
      reconcileFreightPorts(farm.freight,openedFreightPorts(farm))
      const goods=harbourGoods()
      dialogContent.innerHTML=renderFreightPanel(farm.freight,{day:farm.day,harvestTier:farm.festivals.completed.harvest,coins:farm.coins,boatOwned:farm.boatOwned,villageBuilt:farm.village.built,expeditionPort:selectedExpeditionPort,expeditionOffer:selectedExpeditionOffer,playerPort:farm.island,selectedPort:selectedWarehouse,waxAvailable:farm.capeLevel>=2,routeEditorOpen:dialogContent.querySelector<HTMLDetailsElement>('.bay-freight-plan')?.open ?? freightPlanOpen,
        openedPorts:openedFreightPorts(farm),products:goods,carried:Object.fromEntries(goods.map(g=>[g.id,g.quantity])),icon})
      break
    }
    case 'intents': dialogContent.innerHTML = communityBoard(farm, communityArt); break
    case 'intent': dialogContent.innerHTML = communityIntent(farm, communityOrderId, communityArt); break
    case 'neighbor': dialogContent.innerHTML = neighborDetail(farm, communityResident, communityArt); break
    case 'request-food': dialogContent.innerHTML = requestedRecipeCard(); break
    case 'arrangement': {
      const request = arrangementRequest
      const plan = request?.kind === 'neighbor' ? getNeighborPlans(farm).find(plan => plan.id === request.id) : undefined
      if (!request || request.kind === 'neighbor' && (!plan || plan.phase !== 'arranging')) {
        dialogContent.innerHTML = `<p class="dialog-status">Выберите угощение перед встречей.</p>${button('К просьбе', 'resume-community')}`; break
      }
      const food = plan?.food ? getIntentOffers(farm, plan.intentId).find(offer => offer.id === plan.food!.id) : undefined
      if (plan && !food?.available) {
        dialogContent.innerHTML = `<p class="dialog-status">${getNeighborFoodRecovery(farm, plan.id)?.message ?? 'Угощение недоступно.'}</p>${button('Вернуться к встрече', 'resume-community')}`
        break
      }
      let completed = false
      dialogContent.innerHTML = '<div class="arrangement-host"></div>'
      arrangementGame = createArrangement(dialogContent.querySelector<HTMLElement>('.arrangement-host')!, {
        mode: request.kind === 'neighbor' ? plan!.arrangement : request.mode,
        title: request.kind === 'neighbor' ? plan!.title : request.mode === 'eggs' ? 'Корзинка яиц' : 'Ящик яиц', food,
        onComplete(result) {
          if (completed) return true
          if (panel !== 'arrangement' || arrangementRequest !== request) return false
          completed = perform(() => request.kind === 'neighbor' ? finishNeighborPlan(farm, request.id, result as NeighborAssembly)
            : request.mode === 'eggs' ? packEggBasket(farm, result as PackingResult) : packEggCrate(farm, result as PackingResult), false, true)
          if (completed) queueMicrotask(() => {
            if (panel !== 'arrangement' || arrangementRequest !== request) return
            if (request.kind === 'neighbor') closeDialog()
            else { panelHistory.length = 0; openPanel('coop', false) }
          })
          return completed
        },
        onCancel() { if (request.kind === 'neighbor') void resumeCommunityRequest(); else leaveScene() },
      })
      break
    }
    case 'market':
      dialogContent.innerHTML = marketCards() + (farm.village.built ? nav(button('Своя лавка','open-panel',true,{value:'bay-shop'})) : '')
      break
    case 'berry-nursery':
      dialogContent.innerHTML = renderBerryNursery(farm, berryNurserySelection, icon)
      break
    case 'transplant':
      dialogContent.innerHTML = renderBedTransplant(farm, transplantSelection)
      break
    case 'inventory':
    case 'seeds': {
      const inventory = panel === 'inventory'
      const harvest = inventory && bagTab === 'harvest'
      dialogContent.innerHTML = `${inventory ? panelTabs('bag-tab', bagTab, [['seeds', 'Семена'], ['harvest', 'Припасы'], ['archive', 'Коллекции']], 'Разделы запасов') : ''}
        ${harvest ? `${panelTabs('inventory-group',inventoryGroup,[['harvest','Ферма'],['kitchen','Кухня'],['shore','Берег']], 'Продукты')}<ul class="dialog-list inventory-stock">
          ${inventoryGroup==='kitchen'?row('ui-signature-bright','Мои рецепты',`×${Object.values(farm.culinary.stock).reduce((sum,count)=>sum+count,0)}`,button('Открыть','open-panel',true,{value:'recipes'})):''}
          ${inventoryGroup==='harvest'?row('tool-feed', 'Корм для кур', quantity(farm.feed, 'порция')):''}
          ${goods().filter(({count,group})=>count>0&&group===inventoryGroup).map(inventoryStockRow).join('')}
          ${inventoryGroup==='harvest'?treeIds.filter(tree=>farm.saplings[tree]>0).map((tree) => row('ui-tree-'+tree, treeDefinitions[tree].saplingName, `×${farm.saplings[tree]}`)).join(''):''}
          ${inventoryGroup==='shore'&&!goods().some(({count,group})=>count>0&&group==='shore')?'<li class="dialog-status">Пока пусто</li>':''}
        </ul>` : seedCards() + (farm.island === 'home' ? nav(button('Пересадить культуру', 'open-panel', true, {value:'transplant', secondary:true}),button('Ягодный питомник','open-panel',true,{value:'berry-nursery',secondary:true})) : '')}`
      break
    }
    case 'archive':
      dialogContent.innerHTML = panelTabs('archive-group', archiveGroup, [['crops', 'Грядки'], ['orchard', 'Сад'], ['coop', 'Курятник'], ['shore', 'Берег'], ['bay', 'Бухта']])
        + archiveCards(farm, archiveGroup, (name, trait) => itemIcon(archiveIcons[name] ?? name, trait))
      break
    case 'hive': {
      const preview = getApiaryCopy(farm)
      const wind = getWindHoneySource(farm)
      const harvest = preview.harvest
      const upgrade = getCapeUpgrade(farm)
      dialogTitle.textContent = farm.capeLevel >= 2 ? 'Цветочная пасека' : 'Улей мыса'
      dialogTitle.setAttribute('aria-label', dialogTitle.textContent)
      dialogContent.innerHTML = `<div class="apiary-preview"><p class="dialog-intro">${preview.summary}</p>
        ${harvest ? `<section aria-label="${preview.heading}"><h2 class="dialog-status">${preview.heading}</h2>
          <ul class="dialog-list">${row('ui-honey', 'Цветочный мёд', `×${harvest.honey}`)}
            ${harvest.windHoney ? row('ui-wind-honey', 'Мёд ветров', `×${harvest.windHoney}`) : ''}
            ${harvest.wax ? row('ui-beeswax', 'Пчелиный воск', `×${harvest.wax}`) : ''}</ul>
          ${harvest.windHoney ? '<p class="dialog-intro">Мёд ветров заменяет одну обычную порцию.</p>' : ''}</section>` : ''}
        ${preview.note ? `<p class="dialog-intro">${preview.note}</p>` : ''}
        <section aria-label="Мёд ветров"><h2 class="dialog-status">Мёд ветров</h2><p class="dialog-intro">${wind.detail}</p></section>
        ${wind.kind === 'wait' && !preview.waiting ? nav(button('Домой к отдыху', 'visit-rest', true, {secondary:true})) : ''}
        ${nav(preview.planted && preview.waiting ? button('Домой к отдыху', 'visit-rest')
          : button(preview.harvested ? 'Собрано' : 'Собрать мёд', 'collect-honey', preview.now.available),
          upgrade ? button('Улучшить', 'cape-upgrade', true, { secondary: true }) : button('Медовая кухня', 'visit-honey-kitchen', true, { secondary: true }))}</div>`
      break
    }
    case 'cape-upgrade': {
      const upgrade = getCapeUpgrade(farm)
      if (!upgrade) { dialogContent.innerHTML = ''; break }
      dialogTitle.textContent = upgrade.name
      dialogTitle.setAttribute('aria-label', upgrade.name)
      dialogContent.innerHTML = `<div class="cape-upgrade-art">${icon(upgrade.nextLevel === 2 ? 'cape-apiary' : 'cape-honey-kitchen')}</div>
        ${upgrade.nextLevel === 2 ? `<ul class="dialog-list">${row('ui-honey', 'Цветочный мёд', '+1 за три цветущие клумбы')}${row('ui-beeswax', 'Пчелиный воск', '+1 за каждый сбор')}</ul>`
          : `<div class="cape-unlocks">${capeDishIds.map((dish) => icon(dishIcons[dish])).join('')}</div>`}
        <ul class="ingredients">${upgrade.items.map(stockTile).join('')}</ul>
        ${upgrade.nextLevel === 2 && getCapeHoney(farm).blooms < capeFlowerSlotCount ? '<p class="dialog-status">Нужны три цветущие клумбы</p>' : ''}
        ${nav(button('Построить', 'build-cape-upgrade', upgrade.available, { context: upgrade.name, cost: { icon: 'coin', amount: upgrade.coins } }))}`
      break
    }
    case 'honey-kitchen': {
      dialogContent.innerHTML = recipeCards(capeDishIds)
      break
    }
    case 'recipes': dialogContent.innerHTML=signatureBook(farm,{icon,stock:stockTile},expandedRepeatId);break
    case 'signature': dialogContent.innerHTML=signatureStudio(farm,signatureBase,signatureSlots,signatureSlot,{icon,stock:stockTile},currentCommunityRequest()?.intentId);break
    case 'cove': {
      const action=getCoveActions(farm)
      dialogContent.innerHTML=action.available?coveControls(farm):`<div class="cove-locked">${icon('ui-shell')}<p>Найдите ракушку, чтобы обустроить берег.</p>${button('Найти ракушки','cove-shells')}</div>`
      break
    }
    case 'shoal': {
      const available = shoalFindIds.filter(id=>getShoalFindAt(farm,id))
      dialogContent.innerHTML = `<p class="dialog-intro">Не каждый лунный прилив приносит жемчужину. Здесь указаны дни фермы: новый день начинается после отдыха дома.</p><ul class="dialog-list">${shoalFindIds.map(id=>row(shoalDefinitions[id].icon,shoalDefinitions[id].name,
        shoalReturnCopy(farm,id),
        available.includes(id)?button('Собрать','shoal-pick',true,{value:id}):'')).join('')}</ul>${!available.length?nav(button('Домой','sail',true,{value:'home'})):''}`
      break
    }
    case 'guest': {
      const guest = getFairGuest(farm)
      if (!guest) { dialogContent.innerHTML = ''; break }
      dialogTitle.textContent = guest.name
      dialogTitle.setAttribute('aria-label', `${guest.name}, гость ярмарки`)
      const ready = ingredientCount(farm, guest.item) >= guest.item.quantity
      dialogContent.innerHTML = (guest.served ? `<p class="dialog-status">Сегодняшний гость уже угощён.</p>${button('К отдыху дома','visit-rest')}`
        : `<ul class="ingredients">${stockTile(guest.item)}</ul>
          <ul class="dialog-list">${row('coin', 'Монеты', `+${guest.reward}`)}
            ${row(`ui-seed-${guest.seeds.crop}`, `Семена: ${cropDefinitions[guest.seeds.crop].name.toLowerCase()}`, `+${guest.seeds.count}`)}</ul>
          ${nav(button('Угостить', 'serve-guest', ready))}`) + renderFairReturn(farm,stockTile)
      break
    }
    case 'chicken-feed':
      dialogContent.innerHTML = renderChickenFeedMixes(farm)
      break
    case 'coop':
      void bayAudio.primeEvents(['flock.stroke', 'flock.feed', 'flock.eggs', 'flock.hatch'])
      dialogContent.innerHTML = `${renderCoopMorning(farm)}<div class="coop-tools"><span title="Счастье курочек">${icon('tool-hen')} Забота · ${farm.chickenHappiness}/${maxChickenHappiness}</span>
        ${button('Улучшения', 'upgrades', true, { secondary: true })}</div>
        <ul class="dialog-list">
          ${flockFeedRow()}
          ${farm.buildingLevels.coop >= 2 ? row('tool-feed', 'Домашние кормовые смеси', 'Пшеница с морковью или яблоком', button('Выбрать смесь', 'chicken-feed-open', true, {secondary:true})) : row('tool-feed', 'Домашние кормовые смеси', 'Откроются после улучшения курятника')}
          ${row('egg', 'Яйца', `×${farm.eggsReady}`, button('Собрать', 'collect', farm.eggsReady > 0, {context:'яйца'}))}
          ${farm.coopSpecialization === 'hatchery' && farm.flockSize < maxFlockSize
            ? row('egg', 'Инкубатор', farm.hatchDay === null ? `Нужно 1 · в запасе ${farm.eggs}` : quantity(farm.hatchDay - farm.day, 'ночь'),
              farm.hatchDay === null ? button('Положить яйцо', 'incubate-egg', farm.eggs > 0) : '') : ''}
          ${farm.coopSpecialization === 'packing' ? row('ui-egg-crate', `Ящики яиц · ${farm.eggCrates}`, `Нужно ${eggsPerCrate} · в запасе ${farm.eggs}`,
            button('Упаковать', 'pack-egg-crate', farm.eggs >= eggsPerCrate, { context: 'ящик яиц' })+button(`Распаковать · +${eggsPerCrate}`, 'unpack-egg-crate', getEggUnpackAction(farm,'crate').available, {secondary:true})) : ''}
          ${farm.buildingLevels.coop >= 2 || farm.eggBaskets > 0 ? row('ui-egg-basket', `Корзины яиц · ${farm.eggBaskets}`, `Нужно ${eggsPerBasket} · в запасе ${farm.eggs}`,
            button('Упаковать', 'pack-egg-basket', farm.buildingLevels.coop >= 2 && farm.eggs >= eggsPerBasket, { context: 'корзина яиц' })+button(`Распаковать · +${eggsPerBasket}`, 'unpack-egg-basket', getEggUnpackAction(farm,'basket').available, {secondary:true})) : ''}
        </ul><div class="hen-grid" role="group" aria-label="Курочки">${Array.from({ length: farm.flockSize }, (_, index) => {
            const petted = farm.pettedChickens.includes(index)
            return `<button type="button" class="hen-card" data-action="pet" data-value="${index}" aria-label="Курочка ${index+1}, ${petted?'сегодня поглажена, погладить снова':'погладить'}">${icon('tool-hen')}<span>${index+1}</span><small>${petted?'Поглажена':'Погладить'}</small></button>`
          }).join('')}
        </div>`
      break
    case 'rest':
      dialogContent.innerHTML = `${renderSelectedIntentRest(farm,communityRequest)}${renderPicnicStatus(farm,true)}${renderFerryReturn(farm,harbourGoods())}${renderRestPreview(farm)}${renderCoopCapacityWarning(farm,true)}${!farm.chickensFed ? `<ul class="dialog-list">${flockFeedRow()}</ul>` : ''}
        ${renderShopRest(farm)}<ul class="dialog-list">${row('moon', `День ${farm.day + 1} · ${weatherNames[getClimate(farm.day + 1).weather]}`, '', button('До утра', 'sleep', true, {value:farm.day}))}</ul>
        ${nav(button('Открыть кухню', 'kitchen'), button('Улучшения', 'upgrades', true, { secondary: true }))}`
      break
    case 'journal': {
      const goal = currentTask(), journal = getDiscoveryJournal(farm)
      const chapter = journal.current
      const groveActivities = farm.island === 'grove'
        ? row('tool-rod', 'Рыбалка в роще', `Сегодня поймано: ${farm.fishCaughtToday.grove} / ${getFishLimit(farm, 'grove')}`)
          + row('ui-sea-salt', 'Морская соль', farm.saltGatheredToday ? 'Сегодня собрано' : 'Можно собрать на солончаках')
        : ''
      dialogContent.innerHTML = `${renderFerryReturn(farm,harbourGoods())}<section class="discovery-chapter">
          ${icon(chapter?.icon ?? 'star')}<div><small>Знакомство с бухтой · ${journal.completed}/${journal.chapters.length}</small><h2>${chapter?.title ?? 'Бухта живёт дальше'}</h2></div>
          <p>${chapter?.detail ?? 'Продолжайте свои рецепты, встречи с соседями и новые праздники. Каждая традиция может расти дальше.'}</p>
        </section>
        ${goal && !farm.discoveryPreferences.idea ? `<section class="discovery-now" aria-label="Ближайший шаг"><h3>${goal.label}</h3><p>${goal.detail}</p>
          ${goal.target > 1 || goal.reward !== undefined ? `<small>${goal.progress}/${goal.target}${goal.reward === undefined ? '' : ` · Награда: ${quantity(goal.reward, 'монета')}`}</small>` : ''}
          ${'action' in goal ? nav(button(goal.action.label, 'follow-task')) : ''}</section>` : ''}
        ${renderDiscoveryPreferences(farm.discoveryPreferences, getDiscoveryTask(farm, farm.orientation))}
        <p class="discovery-tip">${journal.tip}</p>
        ${journal.next ? `<section class="discovery-next"><strong>Впереди: ${journal.next.title.toLowerCase()}</strong><p>${journal.next.detail}</p></section>` : ''}
        <details class="discovery-roadmap"${journalDetailsOpen ? ' open' : ''}><summary>Все открытия бухты</summary><ol>${journal.chapters.map(chapter => `<li data-current="${chapter.id === journal.current?.id}" data-complete="${chapter.complete}">${icon(chapter.icon)}<strong>${chapter.title}</strong><small>${chapter.complete ? 'Открыто' : chapter.id === journal.current?.id ? 'Сейчас' : 'Впереди'}</small></li>`).join('')}</ol></details>
        ${groveActivities ? `<ul class="dialog-list">${groveActivities}</ul>` : ''}
        ${journal.activities.length ? `<nav class="discovery-activities" aria-label="Другие занятия">${journal.activities.map(activity => `<button type="button" data-action="open-panel" data-value="${activity.panel}">${icon(activity.icon)}<strong>${activity.label}</strong><small>${activity.detail}</small></button>`).join('')}</nav>` : ''}`
      break
    }
    case 'settings':
      dialogContent.innerHTML = `<fieldset class="bay-sound-settings"><legend>Звук</legend>
          <label><input type="checkbox" data-sound="muted" ${bayAudio.settings.muted?'checked':''}> Без звука</label>
          ${([['volume','Громкость'],['music','Музыка'],['effects','Эффекты']] as const).map(([key,name])=>`<label>${name}<input type="range" data-sound="${key}" min="0" max="100" value="${Math.round(bayAudio.settings[key]*100)}"></label>`).join('')}</fieldset>
        <details class="controls-help"><summary>Управление</summary><p>Нажмите на место или выберите его стрелками и нажмите Enter. Курочек можно переносить. Золотая отметка показывает спелый урожай.</p></details>
        <p class="settings-save">${saveAvailable ? 'Прогресс сохраняется в этом браузере.' : saveStore.blocked ? 'Сохранение защищено от перезаписи. Игра идёт только в этой сессии.' : 'Браузер не смог сохранить ферму. Можно продолжать до закрытия страницы.'}</p>${saveStore.issue ? button('Восстановление сохранения', 'save-recovery') : ''}`
      break
    case 'guide': {
      const home = farm.island === 'home', village = farm.island === 'village'
      const places: string[] = []
      const tile = (name: string, image: string, value: Panel, action = 'open-panel') =>
        `<button class="explore-tile" type="button" data-action="${action}" data-value="${value}">${icon(image)}<strong>${name}</strong></button>`
      if (home || farm.island === 'grove') places.push(tile('Сад','ui-tree-apple','orchard'),tile('Рыбалка','tool-rod','fishing'))
      if (home) {
        places.push(tile('Пересадка культур','tool-seeds','transplant'),tile('Ягодный питомник','ui-seed-blueberry','berry-nursery'),tile('Дом','upgrade-farmhouse-card','rest'),tile('Курятник','tool-hen','coop'),tile('Рынок','ui-market','market'),tile('Улучшения','hammer','upgrades'))
        if (isProjectComplete(farm,'fair')) places.push(tile('Гость ярмарки','ui-market','guest'),tile('Просьбы соседей','ui-bea','intents'))
      }
      if (village) places.push(tile('Своя лавка','bay/pavilion','bay-shop'),tile('Музыкальный сад','bay/music-harp','bay-music'),tile('Соседи','ui-bea','village'),tile('Общий ужин','ui-grilled-fish','village-meal'))
      if (farm.island === 'cape') {
        places.push(tile('Пасека','ui-honey','hive'))
        if (farm.capeLevel >= 3) places.push(tile('Медовая кухня','ui-honey-biscuits','honey-kitchen'))
      }
      if (farm.island === 'grove') {
        places.push(tile('Живая заводь','ui-shell','cove'))
        if (hasShoal(farm)) places.push(tile('Лунная отмель','ui-moon-pearl','shoal'))
      }
      if (village || home && isProjectComplete(farm,'fair')) places.push(tile('Кондитерская','ui-handmade-round','workshop'))
      if (village) places.push(tile('Заказы лавки','ui-signature-bright','shop-commissions'),tile('Праздники гавани','festivals/lights','festival'))
      if (farm.boatOwned) places.push(tile('Грузовой паром','bay/ferry','bay-freight'))
      const away = [
        ...(!home ? [tile('Рынок дома','ui-market','market','travel-panel')] : []),
        ...(!village && farm.festivals.active ? [tile('Праздники гавани','festivals/lights','festival')] : []),
        ...(!village && farm.village.built ? [tile('Своя лавка','bay/pavilion','bay-shop'),tile('Музыкальный сад','bay/music-harp','bay-music')] : []),
      ]
      dialogContent.innerHTML = `<section class="explore-section"><h2>${islandNames[farm.island]}</h2><div class="explore-grid">${places.join('')}</div></section>
        ${away.length ? `<section class="explore-section"><h2>На других островах</h2><div class="explore-grid">${away.join('')}</div></section>` : ''}
        <div class="explore-personal">${tile('Дневник','star','journal')}${tile('Запасы','ui-bag','inventory')}${home || village ? tile('Мои рецепты','ui-signature-bright','recipes') : ''}${button('Настройки','open-panel',true,{value:'settings',secondary:true})}</div>`
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
      let made = false
      workshopGame = createWorkshop(dialogContent.querySelector<HTMLElement>('.workshop-host')!, {
        initialShape: bread ? 'long' : pastryShape, recipe: bread ? 'bread' : 'pastry',
        onBake(shape) { if (made) return true; if (panel !== 'workshop') return false; made = perform(() => bread ? cookDish(farm, 'farmhouseBread') : bakeWorkshop(farm, shape), false, true);  return made },
        onCancel() { if (communityRequest) void resumeCommunityRequest(); else leaveScene() },
      })
      break
    }
    case 'cookery': {
      const recipe = dishDefinitions[cookingDish], preparedFish = cookingFish, ingredients = getCookIngredients(farm,cookingDish,preparedFish)
      const signature=cookingMode==='signature',draft:SignatureDraft={base:signatureBase,ingredients:signatureSlots.filter((part):part is SignatureIngredient=>part!==null).map(part=>({...part}))},repeatId=signatureRepeatId,preparedDish=cookingDish
      const savedRecipe=signature&&repeatId?farm.culinary.recipes.find(recipe=>recipe.id===repeatId):undefined, familyName=signature?familyRecipeName(draft,signatureFamily):undefined
      const capacity=signatureBookCapacity(farm.culinary)
      if(signature&&!capacity.canCreate){
        dialogContent.innerHTML=`<p class="signature-capacity" role="status">${capacity.message}</p>${nav(button('Мои рецепты','open-panel',true,{value:'recipes'}))}`
        break
      }
      const action=signature?getSignatureAction(farm,draft):getCookAction(farm,preparedDish,preparedFish)
      if (!action.available) {
        dialogContent.innerHTML = `<ul class="ingredients">${(signature?getSignatureAction(farm,draft).items:ingredients).map(stockTile).join('')}</ul>${nav(button(signature?'Мои рецепты':'Кухня',signature?'open-panel':'kitchen',true,signature?{value:'recipes'}:{}))}`
        break
      }
      const selectedFruit=signature?draft.ingredients:recipe.ingredients.flatMap(part=>'item' in part&&signatureFruitIds.includes(part.item as typeof signatureFruitIds[number])?[{id:part.item,quantity:part.quantity}]:[])
      const kind=signature?draft.base==='tart'?'decorate':'preserves':(['honeyPear','honeyBiscuits','windParfait','honeyCake','grilledFish'] as const).find(id=>id===preparedDish)??(isTartDish(preparedDish)?'decorate':'preserves')
      let made=false
      dialogContent.innerHTML = '<div class="cookery-host"></div>'
      cookeryGame = createCookery(dialogContent.querySelector<HTMLElement>('.cookery-host')!, {
        recipe: { id: signature?repeatId??'signature':preparedDish, name:signature?savedRecipe?.name??familyName??'Мой рецепт':preparedDish==='grilledFish'?`${fishDefinitions[preparedFish].name} на гриле`:recipe.name, kind, signature,processing:savedRecipe?.processing,fishSpecies:preparedDish==='grilledFish'?preparedFish:undefined,
          selectedFruit,fruitOptions:selectedFruit.map(part=>({id:part.id,name:signatureFruitNames[part.id as typeof signatureFruitIds[number]],art:part.id==='apple'?'apple-slice':part.id==='pear'?'pear-piece':part.id==='peach'?'peach-slice':part.id})),
          ingredients:(signature?getSignatureAction(farm,draft).items:ingredients).map(item=>({name:stockLabel(item).name,icon:iconUrl(stockLabel(item).image),count:item.quantity,...(item.kind==='variants'?{trait:item.trait}:{})})) },
        returnLabel: communityRequest ? 'К просьбе' : signature ? 'Мои рецепты' : 'На кухню',
        onComplete(result) {if(made)return true;if(panel!=='cookery')return false;made=perform(()=>{
          const known = new Set(farm.culinary.recipes.map(recipe=>recipe.id))
          const receipt=signature?repeatId?repeatSignature(farm,repeatId,result):completeSignature(farm,draft,result):cookDish(farm,preparedDish,result)
          if(receipt.ok&&familyName&&'recipeId' in receipt&&typeof receipt.recipeId==='string'&&!known.has(receipt.recipeId))nameSignature(farm,receipt.recipeId,familyName)
          return receipt
        },false,true);return made},
        onCancel(){if(communityRequest)void resumeCommunityRequest();else if(signature){panelHistory.length=0;openPanel('recipes',false)}else leaveScene()},
      })
      break
    }
    case 'village-project': dialogContent.innerHTML = villageProjectCard(); break
    case 'village': dialogContent.innerHTML = neighboursCard() + harbourPlaces(); break
    case 'village-meal': {
      const meal = getVillageMeal(farm, pastryShape)
      const signatures = getReadySignatureSuppers(farm)
      dialogContent.innerHTML = meal.served ? `<p class="dialog-status">Сегодня общий ужин уже состоялся. Следующий ужин завтра.</p>${button('Домой','sail',true,{value:'home'})}`
        : `<p class="shared-supper-intro">Выберите одно угощение: ручную выпечку или готовое авторское блюдо. Ужин расходует 1 порцию выбранного угощения и 1 рыбу.</p>
          <ul class="ingredients">${meal.items.filter(item=>item.kind==='fish').map(stockTile).join('')}</ul>
          ${farm.fish.perch + farm.fish.seaBass === 0 ? renderHarbourFishChoice(farm,'supper') : '<p>Подойдёт обычный окунь или морской окунь. Выше показано, какая рыба пойдёт к столу.</p>'}
          ${renderSignatureSuppers(farm,recipe=>signatureResultPicture(recipe,{icon}))}
          <details class="shared-supper-pastry" ${!signatures.length || meal.available ? 'open' : ''}><summary>Ручная выпечка</summary>${pastryChoices()}<ul class="ingredients">${meal.items.filter(item=>item.kind==='handmade').map(stockTile).join('')}</ul>${nav(button('Подать выпечку · 1 порция','share-meal',meal.available))}</details>`
      break
    }
    case 'fishing': {
      const action = getFishAction(farm)
      if (action.available) mountFishing()
      else dialogContent.innerHTML = `<p class="dialog-status">${action.label}</p>
        ${renderFishingPracticeEntry(farm)}${groveDockActions()}`
      break
    }
    case 'boat': {
      const journeys = getIslandJourneys(farm)
      const destination = journeys.find(place => place.id === boatIsland) ?? journeys[0]
      const selectors = journeys.map(place => {
        const status = place.current ? ', вы здесь' : place.unlocked ? '' : ', пока закрыт'
        return `<button type="button" data-action="boat-island" data-value="${place.id}" aria-pressed="${place.id===destination.id}" aria-label="${place.name}${status}" title="${place.name}${status}">${icon({home:'upgrade-farmhouse-card',grove:'ui-tree-apple',cape:'ui-honey',village:'ui-bea'}[place.id])}<span>${place.name}</span></button>`
      }).join('')
      const action = destination.nextAction
      const requirements = destination.requirements.filter(item => !item.complete)
      const unpaidBoat = action?.target === 'buy-boat' && !action.enabled
      const nextStep = unpaidBoat
        ? button(`Накопить на лодку · ещё ${quantity(boatPrice-farm.coins,'монета')}`,'boat-funds',true,{value:destination.id})
        : action ? button(action.target==='sail' && action.value===destination.id ? 'Отправиться' : action.label,action.target,action.enabled,{value:action.value,context:destination.name}) : ''
      const checklist = `<ul class="journey-requirements">${requirements.map(r=>requirementLink(`${icon(r.icon)}<span>${r.label}</span><strong>${r.current}/${r.target}</strong>`,{kind:'journey',island:destination.id,id:r.id},'journey-requirement',r.label,false)).join('')}</ul>`
      const localPlaces = farm.island === 'home'
        ? button('Кухня','kitchen',true,{secondary:true}) + (isProjectComplete(farm,'fair') ? button('Просьбы соседей','open-panel',true,{value:'intents',secondary:true}) : '')
        : farm.island === 'grove' ? button('Живая заводь','open-panel',true,{value:'cove',secondary:true}) + (getHarborOrder(farm) ? button('Заказ гавани','visit-harbor',true,{secondary:true}) : '')
        : farm.island === 'cape' ? button(farm.capeLevel>=3?'Медовая кухня':'Пасека','open-panel',true,{value:farm.capeLevel>=3?'honey-kitchen':'hive',secondary:true})
        : button('Соседи','open-village',true,{secondary:true}) + button('Общий ужин','village-meal',true,{secondary:true})
      dialogContent.innerHTML = `<nav class="island-selector" aria-label="Острова">${selectors}</nav>
        <article class="journey-card" data-island="${destination.id}" data-unlocked="${destination.unlocked}">
          <div class="journey-overview">
            <div class="journey-picture"><img src="${import.meta.env.BASE_URL}art/lavender/${destination.id}-plate.webp" alt="" draggable="false"></div>
            <div class="journey-caption"><div class="journey-heading"><h2>${destination.name}</h2></div>
              <p>${destination.description}</p>${destination.current ? '<span class="journey-here">Вы здесь</span>' : ''}
            </div>
          </div>
          <nav class="island-places" aria-label="Действия на острове">
            ${nextStep || localPlaces}
            ${destination.current && farm.boatOwned ? button('Грузовой паром','open-panel',true,{value:'bay-freight',secondary:true}) : ''}
          </nav>
          ${destination.unlocked || !requirements.length ? '' : requirements.length <= 2 ? checklist : `<details class="journey-details"${journeyDetailsOpen ? ' open' : ''}><summary>Условия открытия <span>${requirements.length}</span></summary>${checklist}</details>`}
        </article>`
      break
    }
    case 'dock-project':
      dialogContent.innerHTML = projectCard('dock')
      break
    case 'harbor':
      dialogContent.innerHTML = harborCard()
      break
    case 'orchard':
      if (farm.island !== 'home' && farm.island !== 'grove') break
      dialogContent.innerHTML = `<p class="dialog-intro">Деревья растут ночью. После отдыха взрослые деревья снова приносят плоды.</p>
        <p class="dialog-intro">Нужно место? Откройте дерево и перенесите его в питомник. Позже его можно бесплатно вернуть.</p>
        <ul class="dialog-list">${farm.trees[farm.island].map((_, index) => treeRow(index)).join('')}</ul>${nurseryCard()}`
      break
    case 'tree': {
      if(farm.island!=='home'&&farm.island!=='grove')break
      const slot=farm.trees[farm.island][treeSlot],action=getTreeAction(farm,treeSlot)
      dialogEmblem.src = iconUrl(slot ? 'ui-tree-' + slot.tree : 'orchard')
      dialogTitle.textContent=slot?`${treeDefinitions[slot.tree].treeName}`:'Посадить дерево'
      dialogTitle.setAttribute('aria-label',dialogTitle.textContent)
      if(slot){
        const definition=treeDefinitions[slot.tree],growing=slot.age<definition.days
        dialogContent.innerHTML=treeSelector()+`<div class="tree-focus">${icon(`ui-tree-${slot.tree}`)}${slot.fruitReady ? '' : `<strong>${growing ? 'До зрелости: ' + quantity(definition.days-slot.age,'ночь') : 'Новые плоды завтра'}</strong>`}
          ${treeVariantCopy(slot)?`<p class="dialog-intro">${treeVariantCopy(slot)}</p>`:''}${slot.fruitReady?button(`Собрать · ${slot.fruitReady}`,'pick-fruit',action.available):''}</div>
          <p class="dialog-intro">Освободите место бесплатно: дерево, его возраст и созревшие плоды сохранятся в питомнике. Там рост и новые плоды на паузе. Вернуть дерево можно на любое свободное место.</p>
          ${nav(button('Перенести в питомник','store-tree',true,{value:treeSlot,secondary:true}))}`
      }else{
        dialogContent.innerHTML=treeSelector()+nurseryCard(treeSlot)+`<div class="sapling-options">${treeIds.map(tree=>{
          const definition=treeDefinitions[tree],owned=farm.saplings[tree]>0
          return `<article class="sapling-option">${icon(`ui-tree-${tree}`)}<h2>${definition.treeName}</h2><span>До зрелости: ${quantity(definition.days, 'ночь')}</span>${button(owned?'Посадить':'Купить и посадить','buy-plant-tree',owned||farm.coins>=definition.saplingPrice,{value:tree,context:`${definition.treeName}`,cost:owned?undefined:{icon:'coin',amount:definition.saplingPrice}})}</article>`
        }).join('')}</div>`
      }
      break
    }
    case 'upgrades': {
      const actions = {
        farmhouse: ['Кухня', 'kitchen'], coop: ['Курятник', 'visit-coop'], well: ['Полив', 'visit-well'],
      } as const
      dialogContent.innerHTML = `<p class="coin-balance">${icon('coin')} ${numberFormat.format(farm.coins)}<span class="sr-only"> ${ruPlural(farm.coins, ['монета','монеты','монет'])}</span></p>
        <ul class="dialog-list">${buildingIds.map((building) => {
          const definition = buildingDefinitions[building]
          const level = farm.buildingLevels[building]
          const [label, action] = actions[building]
          const branch = farm[`${building}Specialization`]
          return row(`upgrade-${building}-card`, branch ? branchDefinitions[branch].name : definition.name,
            level === 1 ? definition.benefit : `Ур. ${level}`,
            level >= 2 ? button(label, action, true, { secondary: true }) +
              (level === 2 || building === 'farmhouse' && level === 3 && !farm.farmhouseSecondarySpecialization ? button(level===3?'Освоить второе направление':'Выбрать направление', 'specialize', true, { value: building, context: definition.name }) : '')
              : button('Улучшить', 'upgrade-building', farm.coins >= definition.upgradePrice, {
                value: building, context: `${definition.name}, ${quantity(definition.upgradePrice, 'монета')}`,
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
      dialogContent.innerHTML = nav(button('Мои рецепты','open-panel',true,{value:'recipes'}))+kitchenFamilies()
      break
    }
  }

  applyIngredientFinishes(dialogContent)
  if (focused) {
    const replacement = Array.from(dialogContent.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      .find(candidate => focusKey(candidate) === focusKey(focused))
    const nextFocus = replacement ?? closeButton
    nextFocus.focus({ preventScroll: true })
  }
}

// A map shortcut continues at the chosen place after the crossing. Only global
// pages can be revisited on the new island; a local building belongs to its shore.
async function visitPanelAt(destination: typeof farm.island, next: Panel) {
  if (island.isCrossing()) return
  if (farm.island === destination) { openPanel(next); return }
  if (!canSailTo(farm,destination)) return
  const returnPath = dialog.open && panel ? [...panelHistory,rememberPanel()].filter(visit =>
    ['guide','boat','archive','bay-freight','inventory','journal'].includes(visit.panel)) : []
  if (fieldViewButton.getAttribute('aria-pressed') === 'true') toggleFieldView()
  closeDialog()
  await island.crossIsland(()=>perform(()=>sail(farm,destination),false,true))
  if (farm.island !== destination) return
  panelHistory.push(...returnPath)
  openPanel(next,false)
}

function openPanel(next: Panel, remember = true, destinationIsland = farm.island, cue = 'page.unfold') {
  if (island.isCrossing()) return
  if (next === 'berry-nursery' && farm.island !== 'home') { void visitPanelAt('home',next); return }
  if (next === 'shoal' && (farm.island !== 'grove' || !hasShoal(farm))) return
  if ((next==='bay-shop'||next==='bay-music'||next==='festival'||next==='shop-commissions') && !farm.village.built || next==='bay-freight'&&!farm.boatOwned) return
  if ((next==='bay-shop'||next==='bay-music'||next==='festival'||next==='shop-commissions') && farm.island!=='village') {
    void visitPanelAt('village',next)
    return
  }
  if ((farm.island === 'cape' || farm.island === 'village') && (next === 'orchard' || next === 'tree' || next === 'fishing')) return
  if ((next === 'hive' && farm.island !== 'cape') || (next === 'guest' && (farm.island !== 'home' || !getFairGuest(farm)))) return
  if ((next === 'cape-upgrade' || next === 'honey-kitchen') && farm.island !== 'cape') return
  if (next === 'honey-kitchen' && farm.capeLevel < 3) return
  if(next==='cove'&&farm.island!=='grove')return
  if (next === 'transplant' && farm.island !== 'home') return
  if(remember&&next!==panel){if(dialog.open&&panel)panelHistory.push(rememberPanel());else panelHistory.length=0}
  if (next !== panel) { transplantSelection.reset(); berryNurserySelection.reset() }
  if (next !== 'seeds') seedPickerBed = undefined
  if (remember && next==='bay-freight' && next!==panel) {
    freightPlanOpen=false
    if (panel!=='bay-music') selectedWarehouse=farm.island
  }
  if (next !== panel) { stopHarbour(); stopFishing(); stopWorkshop(); stopCookery(); stopArrangement() }
  if (remember && next !== panel && (next === 'inventory' || next === 'seeds')) previewSeed = farm.selectedSeed
  if (remember && next !== panel && next === 'irrigation') irrigationMode = farm.wellSpecialization === 'pipes' ? 'pair' : 'row'
  if (remember && next !== panel && next === 'boat') { boatIsland = destinationIsland; journeyDetailsOpen=false }
  if (next === 'archive' || next === 'boat') {
    farm.orientation[next === 'archive' ? 'collections' : 'islands'] = true
    saveFarm()
    status()
  }
  if (next !== panel && next !== 'festival') celebratedFestival=undefined
  if (panel !== next) playBaySound(cue==='page.unfold' && (next==='guide' || next==='boat') ? 'page.map' : cue,.76,0)
  panel = next
  const miniature = next.startsWith('bay-') || next === 'cookery' || next === 'workshop' || next === 'fishing' || next === 'arrangement'
  island.setViewMode(miniature ? 'minigame' : next === 'cove' ? 'world' : 'dialog')
  app.dataset.scene=next==='cove'?'cove':''
  island.setCoveFocus(next==='cove')
  toast.hidden = true
  dialogFeedback.hidden = true
  dialogFeedback.textContent = ''
  drawPanel()
  dialogContent.scrollTop = 0
  if (!dialog.open) dialog.showModal()
  updateCommunityReturn()
  const sceneEntry = next === 'bay-shop' ? dialogContent.querySelector<HTMLElement>('.bay-shop-close')
    : next === 'bay-freight' ? dialogContent.querySelector<HTMLElement>('.bay-freight [data-action="close"]')
    : next === 'bay-music' ? dialogContent.querySelector<HTMLElement>(musicView?.sheet ? '.bay-music-sheet-close' : '.bay-music-close')
    : next === 'workshop' ? dialogContent.querySelector<HTMLElement>('.workshop-close')
    : next === 'fishing' ? dialogContent.querySelector<HTMLElement>('.fishing-controls .fishing-action')
    : next === 'cookery' ? dialogContent.querySelector<HTMLElement>('.cookery-view') : next === 'arrangement' ? dialogContent.querySelector<HTMLElement>('.arrangement-view') : null
  ;(sceneEntry ?? closeButton).focus({ preventScroll: true })
}

function closeDialog() {
  transplantSelection.reset()
  berryNurserySelection.reset()
  celebratedFestival=undefined
  island.setViewMode('world')
  app.dataset.scene=''
  island.setCoveFocus(false)
  seedPickerBed = undefined
  stopHarbour()
  stopFishing()
  stopWorkshop()
  stopCookery()
  stopArrangement()
  panel = undefined
  panelHistory.length=0
  if (dialog.open) dialog.close()
  updateCommunityReturn()
}

function refresh() {
  status()
  island.render(farm)
  if (dialog.open) drawPanel()
}

function perform(action: () => { ok: boolean; message: string }, dismiss = false, resultVisible = false) {
  const result = action()
  if (!result.ok)playBaySound('menu.blocked')
  if (result.ok) {
    if (dismiss && dialog.open) dialog.close()
    saveFarm()
    refresh()
  }
  if (dialog.open) {
    window.clearTimeout(dialogFeedbackTimer)
    dialogFeedback.classList.toggle('sr-only', resultVisible && result.ok)
    dialogFeedback.hidden = false
    dialogFeedback.textContent = result.message
    dialogFeedback.dataset.tone=result.ok?'good':'bad'
    dialogFeedbackTimer=window.setTimeout(()=>{dialogFeedback.hidden=true},result.ok?3200:4800)
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
  well: 'Колодец · Набрать воды',
  coop: 'Курятник · Корм и яйца',
  market: 'Рынок · Покупки и продажи',
  farmhouse: 'Дом · Отдых, кухня и улучшения',
  kitchen: 'Садовая кухня',
  pier: 'Рыбацкий причал · Забросить удочку',
  boat: 'Причал · Лодка и путешествия',
  harbor: 'Заказы гавани',
  salt: 'Солончаки · Собрать соль',
  tidepool: 'Лунная отмель · Находки',
  cove:'Живая заводь',
  hive: 'Улей мыса · Собрать мёд',
  'honey-kitchen': 'Медовая кухня · Готовить',
  guest: 'Гость ярмарки · Сегодняшний заказ',
  'bay-display': 'Витрина бухты · Находки',
  workshop: 'Кондитерская', village: 'Соседи', 'village-meal': 'Стол для ужина',
}
const upgradedLocationLabels = { farmhouse: 'Дом · Отдых и улучшения', coop: 'Курятник с упаковкой', well: 'Поливной колодец' } as const

function updateFieldContext(index: number | undefined) {
  contextBed = index
  const bed = index === undefined || farm.island !== 'home' ? undefined : farm.beds[index]
  const hidden = !bed || !portraitView.matches || fieldViewButton.getAttribute('aria-pressed') !== 'true'
  if (contextCard.hidden !== hidden) contextCard.hidden = hidden
  if (hidden || !bed || index === undefined) return
  const action = getBedAction(farm, index)
  const label = bed.kind === 'crop' ? cropDefinitions[bed.crop].name : bed.kind === 'tilled' ? 'Вспаханная земля' : 'Целина'
  const refill = !action.available && action.kind === 'water'
  const chooseSeeds = !action.available && action.kind === 'plant'
  const harvest = getBedHarvestPreview(farm, index)
  const preview = harvest && harvestPreviewCopy(harvest)
  const title = refill ? 'Лейка пуста' : !action.available ? action.label : label
  const cta = refill ? 'К колодцу' : chooseSeeds ? 'Выбрать семена'
    : preview ? preview.action : action.label
  const source = iconUrl(bed.kind === 'crop' ? bed.crop : bed.kind === 'tilled' ? 'tool-seeds' : 'tool-hoe')
  updateFieldContextCopy(contextCard, title, preview?.detail, preview?.bonus)
  if (contextButton.textContent !== cta) contextButton.textContent = cta
  const command = refill ? 'refill' : chooseSeeds ? 'context-seeds' : 'work-context'
  if (contextButton.dataset.action !== command) contextButton.dataset.action = command
  contextButton.hidden = !action.available && !refill && !chooseSeeds
  if (contextIcon.getAttribute('src') !== source) contextIcon.src = source
}

const island = createIsland(canvas, {
  harbourViewChanged: (view, traveling) => harbourControls?.select(view, traveling),
  moveHen(index, point) {
    perform(() => moveFarmHen(farm, index, point), false, true)
  },
  inspect(target) {
    updateFieldContext(target.kind === 'bed' ? target.index : undefined)
    if (target.kind === 'hen') return `Курочка ${target.index + 1} · ${farm.pettedChickens.includes(target.index) ? 'Сегодня поглажена' : 'Погладить курочку'}`
    if (target.kind === 'shell' || target.kind === 'shoal-find') {
      const item = getShoreItem(farm, target)
      return item ? `${item.name} · Подобрать` : ''
    }
    if (target.kind === 'tree') {
      if (farm.island !== 'home' && farm.island !== 'grove') return ''
      const slot = farm.trees[farm.island][target.index]
      const name = slot ? treeDefinitions[slot.tree].treeName : `Место для дерева ${target.index + 1}`
      const action = getTreeAction(farm, target.index)
      return action.kind === 'pick' ? `${name} · Собрать плоды` : `${name} · ${action.label}`
    }
    if (target.kind === 'village-home') {
      const resident = farm.village.residents[target.index]
      return `Домик ${target.index + 1} · ${target.index >= getVillageHomeCount(farm) ? villageHomeProgress(farm) : resident ? residentDefinitions[resident].name : 'Пригласить соседа'}`
    }
    if (target.kind === 'flower') {
      const bloom = getCapeBloom(farm, target.index)
      return `Клумба ${target.index + 1} · ${bloom === 'empty' ? 'Посадить цветы' : bloom === 'growing' ? 'Расцветут завтра' : 'Цветут'}`
    }
    if (target.kind === 'neighbor') return `${residentDefinitions[target.resident].name} · Замысел соседа`
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
      if(kind==='bay-music'||kind==='bay-shop'||kind==='bay-freight')return panelTitles[kind]
      return locationLabels[kind]
    }
    const bed = farm.beds[target.index]
    if (!bed) return 'Грядка'
    const action = getBedAction(farm, target.index)
    if (bed.kind !== 'crop') {
      const soil = bed.kind === 'empty' ? 'Целина' : 'Вспаханная земля'
      return `${soil} · ${action.label}`
    }
    const name = cropDefinitions[bed.crop].name
    const stage = getBedStage(bed)
    const harvest = getBedHarvestPreview(farm, target.index)
    if (harvest) return harvestPreviewCopy(harvest).hint
    const growth = stage === 'seedling' && !bed.watered ? 'Новый посев' : 'Растёт'
    const moisture = bed.watered ? 'Сегодня полито' : action.available ? 'Нужна вода' : 'Нужна вода (лейка пуста)'
    return `${name} · ${growth} · ${moisture}`
  },
  activate: activateTarget,
})

harbourControls = createHarbourControls(canvas, app.querySelector('.island-context')!,
  app.querySelector('.harbour-views')!, app.querySelector('.hud-bottom')!, communityResume,
  viewport => island.setHarbourViewport(viewport))
window.addEventListener('pagehide', event => { if (!event.persisted) harbourControls?.destroy() })
window.addEventListener('pageshow', event => { if (event.persisted) harbourControls?.sync(farm.island) })

function toggleFieldView() {
  const fieldView = island.toggleFieldView()
  fieldViewButton.setAttribute('aria-pressed', String(fieldView))
  fieldViewButton.querySelector('span')!.textContent = fieldView ? 'Остров' : 'Грядки'
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

function activateTarget(target: IslandTarget, henGesture: 'stroke' | 'settle' = 'stroke') {
  if (island.isCrossing()) return
  if ((farm.island === 'cape' || farm.island === 'village') && (target.kind === 'tree' || target.kind === 'pier' || target.kind === 'salt')) return
  if ((target.kind === 'shell' || target.kind === 'shoal-find' || target.kind === 'salt') && farm.island !== 'grove') return
  if (target.kind === 'flower') {
    if (farm.island !== 'cape') return
    if (getCapeBloom(farm, target.index) === 'empty') {
      island.workCape({ kind: 'flower', index: target.index }, () => { const done = perform(() => plantCapeFlower(farm, target.index)); if (done) playBaySound('field.seed', 1, 0); return done })
    } else {
      island.visit(target)
      openPanel('hive')
    }
    return
  }
  if (target.kind === 'shell' || target.kind === 'shoal-find') {
    island.pickShore(target, () => {const done=perform(() => target.kind === 'shell' ? collectShell(farm, target.index) : collectShoalFind(farm, target.id));if(done)playBaySound(target.kind === 'shell' ? 'gather.shell' : 'gather.find', 1, 0);return done})
    return
  }
  if (target.kind === 'bed') {
    const index = target.index
    const upcomingSound = bedWorkSound(farm.beds[index], getBedAction(farm, index).kind)
    if (upcomingSound) void bayAudio.primeEvents([upcomingSound])
    if (needsSeedChoice(farm,index)) { requestSeedChoice(index); return }
    island.workBed(index, () => {
      const action = getBedAction(farm, index)
      return farm.island === 'home' && action.available ? action.kind : 'wait'
    }, () => {
      if (farm.island !== 'home') return
      if (needsSeedChoice(farm,index)) { requestSeedChoice(index); return }
      const action = getBedAction(farm, index)
      if (action.kind !== 'wait' && action.available) activeTool = bedTools[action.kind]
      const sound = bedWorkSound(farm.beds[index], action.kind)
      if(perform(() => workBed(farm,index)) && sound)playBaySound(sound, 1, 0)
    })
    return
  }
  island.visit(target)
  switch (target.kind) {
    case 'well':
      void bayAudio.primeEvents(['field.refill', 'field.irrigation'])
      activeTool = 'water'
      status()
      if (farm.buildingLevels.well >= 2) openPanel('irrigation')
      else perform(() => refillWater(farm)) && playBaySound('field.refill', 1, 0)
      break
    case 'coop':
      activeTool = 'coop'
      status()
      openPanel('coop')
      break
    case 'bay-shop': case 'bay-music': case 'bay-freight': openPanel(target.kind); break
    case 'market': openPanel('market'); break
    case 'farmhouse': openPanel('rest'); break
    case 'kitchen': openPanel('kitchen'); break
    case 'hive': openPanel('hive'); break
    case 'honey-kitchen': openPanel('honey-kitchen'); break
    case 'guest': openPanel('guest'); break
    case 'workshop': workshopRecipe = 'pastry'; openPanel('workshop'); break
    case 'neighbor': communityResident = target.resident; requestedFood = undefined; communityRequest = { kind: 'neighbor', resident: target.resident, planId: getNeighborPlans(farm).find(plan => plan.resident === target.resident)?.id ?? '' }; openPanel('neighbor'); break
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
    case 'tidepool': openPanel('shoal'); break
    case 'cove': openPanel('cove');break
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
      void bayAudio.primeEvents(['orchard.sapling', 'orchard.firm-pick', 'orchard.soft-pick'])
      treeSlot = target.index
      openPanel('tree')
      break
    case 'hen':
      if (farm.pettedChickens.includes(target.index)) {
        playBaySound(henGesture === 'settle' ? 'flock.settle' : 'flock.stroke', 1, 0)
        notify('Курочка снова радостно кудахчет.')
      } else {
        perform(() => petChicken(farm, target.index), false, true) && playBaySound(henGesture === 'settle' ? 'flock.settle' : 'flock.stroke', 1, 0)
      }
      break
    case 'salt': if (perform(() => gatherSeaSalt(farm))) playBaySound('gather.salt', 1, 0); break
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
      notify(tool === 'seeds' ? 'Выберите пустую клумбу и посадите цветы.' : 'Подойдите к клумбам или улью.')
      return
    }
  }
  if (farm.island === 'grove' && tool !== 'rod' && tool !== 'boat' && tool !== 'basket') {
    notify('Вернитесь на Родной остров к грядкам и курочкам.')
    return
  }
  activeTool = tool
  status()
  switch (tool) {
    case 'hoe':
      canvas.focus({ preventScroll: true })
      notify('Выберите пустую грядку, чтобы вскопать её.')
      break
    case 'water':
      if (farm.buildingLevels.well >= 2) {
        activateTarget({ kind: 'well' })
        break
      }
      canvas.focus({ preventScroll: true })
      notify(farm.water ? 'Выберите растение, которому нужна вода.' : 'Наберите воду в колодце.')
      break
    case 'seeds':
      openPanel('seeds')
      break
    case 'feed':
      island.visit({ kind: 'coop' })
      if(perform(() => feedChickens(farm)))playBaySound('flock.feed', 1, 0)
      break
    case 'basket':
      if (farm.island === 'grove') {
        openPanel('orchard')
      } else {
        canvas.focus({ preventScroll: true })
        notify('Выберите грядку с золотой отметкой и соберите урожай.')
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
    if (target === 'workshop') {
      const shape = workshopShapes.find(shape => shape === value)
      if (shape) pastryShape = shape
    }
    closeDialog()
    if (place.kind !== 'bed' && fieldViewButton.getAttribute('aria-pressed') === 'true') toggleFieldView()
    island.focusTarget(place)
    if (hint.notice) notify(hint.notice)
    return
  }
  if (target === 'visit-market') {
    if(value==='buy'||value==='sell'||value==='orders')marketTab=value
    if(marketTab==='buy')marketCategory=hint.selector?.includes('buy-feed')?'care':hint.selector?.includes('buy-sapling')?'trees':'seeds'
    openPanel('market')
  }
  else if (target === 'show-upgrade') { openPanel('upgrades');highlightControl(dialogContent.querySelector<HTMLElement>(`[data-value="${value}"]`));return }
  else if (target === 'upgrades') openPanel('upgrades')
  else if (target === 'inspect-tree') {
    const index=Number(value)
    if((farm.island!=='home'&&farm.island!=='grove')||!Number.isInteger(index)||!farm.trees[farm.island][index]?.fruitReady)return
    treeSlot=index
    openPanel('tree')
  }
  else if (target === 'orchard') openPanel('orchard')
  else if (target === 'project-dock') openPanel('dock-project')
  else if (target === 'visit-harbor') openPanel('harbor')
  else if (target === 'fair-project') {marketTab='projects';openPanel('market')}
  else if (target === 'village-project') openPanel('village-project')
  else if (target === 'warehouse-supply') { selectedWarehouseRequest=warehouseRequest(value);openPanel('warehouse-supply') }
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

// Scene handlers own material sounds. Fill in a quiet control cue only when the
// completed gesture has produced neither a sound nor a transition of its own.
installActionClickGuard(app)
app.addEventListener('click',event=>{
  if (!(event.target instanceof Element) || island.isCrossing()) return
  const control=event.target.closest<HTMLElement>('button,summary')
  if (!control || control.matches(':disabled,[data-instrument],[data-note],[data-step],.bay-music-play')) return
  const serial=bayAudio.cueSequence, opened=dialog.open, currentPanel=panel
  const choice=control.matches('[aria-pressed],[role="tab"],[role="checkbox"],summary,[data-slot],[data-tool]')
  window.setTimeout(()=>{
    if (serial===bayAudio.cueSequence && opened===dialog.open && currentPanel===panel && !island.isCrossing())
      playBaySound(choice?'menu.choose':'menu.press',.8,0)
  },0)
},true)
app.addEventListener('change',event=>{
  if (event.target instanceof Element && event.target.matches('select,input[type="checkbox"],input[type="range"]'))
    playBaySound('menu.choose',.7)
})
let blockedControl: {button: HTMLButtonElement; id:number; x:number; y:number} | undefined
app.addEventListener('pointerdown',event=>{
  const button=event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button:disabled') : null
  blockedControl=button ? {button,id:event.pointerId,x:event.clientX,y:event.clientY} : undefined
},true)
app.addEventListener('pointerup',event=>{
  const tap=blockedControl
  blockedControl=undefined
  if(tap && tap.id===event.pointerId && event.target instanceof Node && tap.button.contains(event.target) &&
      Math.hypot(event.clientX-tap.x,event.clientY-tap.y)<7)playBaySound('menu.blocked',.65,200)
},true)
app.addEventListener('pointercancel',()=>{blockedControl=undefined},true)

app.addEventListener('click', async (event) => {
  if (island.isCrossing()) return
  if (!(event.target instanceof Element)) return
  const control = event.target.closest<HTMLButtonElement>('button')
  if (!control || control.disabled) return
  if (control.dataset.panel) {
    if (control === taskCard && control.dataset.panel === 'market') marketTab = 'orders'
    const next = control.dataset.panel as Panel
    if (control.closest('.dialog-destinations')) {
      if (next === panel) return
      const index = panelHistory.map(visit => visit.panel).lastIndexOf(next)
      if (index >= 0) { panelHistory.length=index+1; goBack(); return }
    }
    openPanel(next)
    return
  }
  if (control.dataset.tool && control.closest('.hotbar')) {
    useHotbar(control.dataset.tool as Tool)
    return
  }
  if (control.dataset.action === 'save-recovery') { saveRecovery?.show(); return }
  const crop = cropIds.find((id) => id === control.dataset.crop)
  let value = control.dataset.value
  let action = control.dataset.action
  if (action === 'follow-task') {
    const task = currentTask()
    if (!task || !('action' in task)) { openPanel('journal'); return }
    action = task.action.target; value = task.action.value
    if (action === 'visit-market' && (value === 'buy' || value === 'sell' || value === 'orders')) {marketTab=value;if(value==='buy')marketCategory=('id' in task && task.id.includes('feed'))?'care':'seeds'}
  }
  switch (action) {
    case 'discovery-pace':
      if (value === 'quiet' || value === 'guided') { setDiscoveryPace(farm.discoveryPreferences, value === 'quiet'); saveFarm(); refresh() }
      break
    case 'discovery-pin': {
      const suggested = getDiscoveryTask(farm, farm.orientation)
      if (suggested && value && chooseDiscoveryIdea(farm.discoveryPreferences, suggested, value)) { saveFarm(); refresh() }
      else { notify('Подсказка обновилась. Выберите актуальную задумку.', false); if (panel === 'journal') drawPanel() }
      break
    }
    case 'discovery-resume':
      if (resumeDiscoveryIdea(farm.discoveryPreferences)) { saveFarm(); refresh() }
      break
    case 'discovery-forget':
      forgetDiscoveryIdea(farm.discoveryPreferences); saveFarm(); refresh()
      break
    case 'berry-nursery-ingredient': {
      const requirement = value === undefined ? undefined : requirementLinks.get(value)
      if (requirement?.kind !== 'stock' || getBerryNurserySource(farm, requirement.item) === undefined) break
      await visitPanelAt('home', 'berry-nursery')
      const source = getBerryNurserySource(farm, requirement.item)
      if (panel === 'berry-nursery' && dialog.open && source !== undefined && berryNurserySelection.choose(farm, source)) { drawPanel(); dialogContent.scrollTop = 0; dialogContent.querySelector<HTMLElement>('.transplant-step')?.focus({preventScroll:true}) }
      break
    }
    case 'berry-nursery-source':
      if(panel==='berry-nursery' && berryNurserySelection.choose(farm,Number(value))){drawPanel();dialogContent.scrollTop=0;dialogContent.querySelector<HTMLElement>('.transplant-step')?.focus({preventScroll:true})}
      break
    case 'berry-nursery-destination':
      if(panel==='berry-nursery' && berryNurserySelection.destination(farm,Number(value))){drawPanel();dialogContent.scrollTop=0;dialogContent.querySelector<HTMLElement>('.transplant-step')?.focus({preventScroll:true})}
      break
    case 'berry-nursery-confirm':
      if(panel==='berry-nursery'&&dialog.open&&perform(()=>berryNurserySelection.divide(farm),false,true))playBaySound('orchard.sapling')
      break
    case 'berry-nursery-reset':
      if(panel==='berry-nursery'){berryNurserySelection.reset();drawPanel();dialogContent.scrollTop=0;dialogContent.querySelector<HTMLElement>('.transplant-step')?.focus({preventScroll:true})}
      break
    case 'transplant-source':
      if (panel === 'transplant' && transplantSelection.choose(farm, Number(value))) {
        drawPanel(); dialogContent.scrollTop = 0; dialogContent.querySelector<HTMLElement>('.transplant-step')?.focus({preventScroll:true})
      }
      break
    case 'transplant-destination':
      if (panel === 'transplant') perform(() => transplantSelection.move(farm, Number(value)), false, true)
      break
    case 'transplant-reset':
      if (panel === 'transplant') { transplantSelection.reset(); drawPanel(); dialogContent.scrollTop = 0; dialogContent.querySelector<HTMLElement>('.transplant-step')?.focus({preventScroll:true}) }
      break
    case 'commission-accept':
      if(panel==='shop-commissions'&&dialog.open)perform(()=>acceptShopCommission(farm,value),false,true)
      break
    case 'commission-deliver':
      if(panel==='shop-commissions'&&dialog.open&&perform(()=>deliverShopCommission(farm,value),false,true))playBaySound('harbour.crate',.65)
      break
    case 'commission-cancel':
      if(panel==='shop-commissions'&&dialog.open)perform(()=>cancelShopCommission(farm,value),false,true)
      break
    case 'commission-finish':
      if(panel==='shop-commissions'&&dialog.open&&perform(()=>finishShopCommission(farm,value),false,true))playBaySound('trade.receive')
      break
    case 'commission-recipe': {
      const order=getShopCommission(farm)
      if(panel==='shop-commissions'&&order&&value===String(order.serial)){
        expandedRepeatId=order.recipeId;openPanel('recipes')
        highlightControl(dialogContent.querySelector(`[data-repeat-guide="${CSS.escape(order.recipeId)}"]`))
      }
      break
    }
    case 'commission-rest':
      if(panel==='shop-commissions'&&dialog.open)await visitPanelAt('home','rest')
      break
    case 'festival-begin': {
      const tradition=festivalTraditions.find(id=>id===value)
      if(tradition){celebratedFestival=undefined; if(perform(()=>beginFestival(farm,tradition),false,true)) playBaySound('menu.accept')}
      break
    }
    case 'festival-cancel': {
      const tradition=festivalTraditions.find(id=>id===value)
      if(tradition){celebratedFestival=undefined;perform(()=>cancelFestival(farm,tradition),false,true)}
      break
    }
    case 'festival-contribute': {
      const [requirement,alternative]=(value??'').split('|')
      if(perform(()=>contributeFestival(farm,requirement,alternative),false,true)) playBaySound('harbour.crate',.65)
      break
    }
    case 'festival-finish': {
      const current=farm.festivals.active
      if(!current)break
      const effect=getFestivalChoices(farm).find(choice=>choice.id===current.tradition)?.effect
      const coinsBefore= farm.coins
      const result=finishFestival(farm)
      if(result.ok){ celebratedFestival=current.tradition; celebrationReceipt={effect,coins:farm.coins-coinsBefore} }
      if(perform(()=>result,false,true)) playBaySound('menu.accept')
      break
    }
    case 'festival-continue': celebratedFestival=undefined;drawPanel();break
    case 'festival-rest': await visitPanelAt('home','rest');break
    case 'festival-music': openPanel('bay-music');break
    case 'festival-freight': openPanel('bay-freight');break
    case 'festival-source': {
      const [requirement,id]=(value??'').split('|')
      const source=getFestivalStatus(farm).active?.requirements.find(row=>row.id===requirement)?.alternatives.find(alt=>alt.id===id)
      if(source?.item) await showRequirement({kind:'stock',item:{...source.item,quantity:source.quantity}},control)
      else if(source?.signature) { openPanel('recipes');highlightControl(dialogContent.querySelector(`[data-action="make-signature"][data-value="${CSS.escape(source.signature)}"]`)) }
      break
    }
    case 'festival-activity': {
      if(value==='bake'){ openPanel('kitchen'); break }
      if(value==='fish'){
        if (panel !== 'festival' || !dialog.open) break
        const route = getFestivalFishingRoute(farm)
        if (route) await visitPanelAt(route.island, route.panel)
        break
      }
      if(value==='harvest'){
        if(panel!=='festival'||!dialog.open)break
        const program=farm.festivals.active,route=getFestivalHarvestRoute(farm)
        if(!route)break
        closeDialog()
        if(farm.island!==route.island)await island.crossIsland(()=>perform(()=>sail(farm,route.island),false,true))
        const current=getFestivalHarvestRoute(farm)
        if(farm.festivals.active===program && current?.island===farm.island)island.focusTarget(current.target)
        break
      }
      if(value!=='shore'||panel!=='festival'||!dialog.open)break
      const program=farm.festivals.active,route=getFestivalShoreRoute(farm)
      if(!route)break
      closeDialog()
      if(farm.island!==route.island)await island.crossIsland(()=>perform(()=>sail(farm,route.island),false,true))
      const current=getFestivalShoreRoute(farm)
      if(farm.festivals.active!==program||current?.island!==farm.island)break
      if(current.panel==='rest')openPanel('rest')
      else island.focusTarget(current.target)
      break
    }
    case 'festival-village': openPanel('village-project');break
    case 'festival-meal': openPanel('village-meal');break
    case 'ferry-return': {
      const voyage = farm.freight.expeditions.active
      if ((panel === 'journal' || panel === 'rest') && voyage && String(voyage.serial) === value) openPanel('bay-freight')
      break
    }
    case 'expedition-rest': {
      const voyage = farm.freight.expeditions.active
      if (panel === 'bay-freight' && voyage?.phase === 'sailing' && String(voyage.serial) === value) await visitPanelAt('home','rest')
      break
    }
    case 'harbour-fish-catch': {
      if (panel !== 'village-project' && panel !== 'village-meal') break
      const fish = panel === 'village-project' ? 'seaBass' : getVillageMeal(farm).fish
      await showRequirement({kind:'stock',item:{kind:'fish',item:fish,quantity:panel==='village-project'?2:1}},control)
      break
    }
    case 'harbour-fish-trade': {
      if (panel !== 'village-project' && panel !== 'village-meal') break
      if (!farm.boatOwned) { openPanel('boat'); break }
      const route = getHarbourFishRoute(farm)
      selectedExpeditionPort = route.port
      selectedExpeditionOffer = route.offer
      openPanel('bay-freight')
      break
    }
    case 'expedition-discovery': {
      if (panel !== 'bay-freight') break
      const next = nextFerryExploration(farm.freight.expeditions, expeditionWallet(farm))
      if (!next || next.port !== value) break
      selectedExpeditionPort = next.port
      selectedExpeditionOffer = expeditionTrades(farm.freight.expeditions, next.port)[0].id
      drawPanel()
      dialogContent.querySelector<HTMLElement>('.bay-freight-close')?.focus({preventScroll:true})
      break
    }
    case 'expedition-restock': {
      if (panel !== 'bay-freight' || value !== selectedExpeditionOffer) break
      const plan = getFerryRestockPlan(farm.freight.expeditions,value,farm.day,expeditionWallet(farm))
      if (!plan || plan.port !== selectedExpeditionPort) break
      if (plan.kind === 'rest') await visitPanelAt('home','rest')
      else {
        selectedExpeditionOffer = plan.offer.id
        drawPanel()
        dialogContent.querySelector<HTMLElement>('.bay-freight-close')?.focus({preventScroll:true})
      }
      break
    }
    case 'expedition-source': {
      if (panel !== 'bay-freight') break
      const [offerId,itemId] = (value ?? '').split('|')
      const requirement = getFerrySupplyRequirement(farm,offerId,itemId)
      if (requirement) await showRequirement(requirement,control)
      break
    }
    case 'expedition-port': {
      if (farm.freight.expeditions.active) break
      const port=expeditionPorts.find(id=>id===value)
      if(port){selectedExpeditionPort=port;selectedExpeditionOffer=expeditionTrades(farm.freight.expeditions,port)[0].id;drawPanel()}
      break
    }
    case 'expedition-offer': {
      if(farm.freight.expeditions.active)break
      const offer=expeditionTrades(farm.freight.expeditions,selectedExpeditionPort).find(entry=>entry.id===value)
      if(offer){selectedExpeditionOffer=offer.id;drawPanel()}
      break
    }
    case 'expedition-pair': {
      if (farm.freight.expeditions.active || panel !== 'bay-freight') break
      const offers = expeditionTrades(farm.freight.expeditions, selectedExpeditionPort)
      const current = expeditionOfferIds(selectedExpeditionOffer)
      const first = offers.find(offer => offer.id === current[0])?.id ?? offers[0].id
      if (value && offers.some(offer => offer.id === value)) {
        const next = current[1] === value ? first : combinedExpeditionId(first, value)
        if (next) { selectedExpeditionOffer = next; drawPanel() }
      }
      break
    }
    case 'expedition-send': {
      if(perform(()=>sendFerryExpedition(farm,value??'')))bayAudio.playEvent('harbour.castoff')
      break
    }
    case 'expedition-claim': {
      const voyage=farm.freight.expeditions.active
      if(voyage){selectedExpeditionPort=voyage.port;selectedExpeditionOffer=expeditionTrades(farm.freight.expeditions,voyage.port)[0].id}
      if(perform(()=>receiveFerryExpedition(farm)))bayAudio.playEvent('harbour.crate')
      break
    }
    case 'music-warehouse-visit': {
      const port = islandIds.find(id => id === value)
      if (port && panel === 'music-supplies') await visitPanelAt(port,'music-supplies')
      break
    }
    case 'freight-unlock': {
      const port=allPorts.find(id=>id===value)
      if(port)openPanel('boat',true,port)
      break
    }
    case 'freight-port': {
      const port=allPorts.find(id=>id===value)
      if(port && openedFreightPorts(farm).includes(port)){selectedWarehouse=port;drawPanel()}
      break
    }
    case 'freight-deposit':
    case 'freight-withdraw': {
      const [port,id,n]=(value ?? '').split('|')
      if(perform(()=>transferBayGoods(farm,action==='freight-deposit'?'deposit':'withdraw',port,id,Number(n))))bayAudio.playEvent('harbour.crate')
      break
    }
    case 'freight-start': case 'freight-pause': case 'freight-mode': case 'freight-route-port':
    case 'freight-load': case 'freight-priority': case 'freight-destination': {
      if(perform(()=>freightControl(farm.freight,action!,value??'',farm.day,openedFreightPorts(farm))??{ok:false,message:'Выберите рейс.'}) && action==='freight-start')bayAudio.playEvent('harbour.castoff')
      break
    }
    case 'open-intent': {
      const order = getCommunityOrders(farm).find(order => order.id === value)
      if (order) { communityOrderId = order.id; requestedFood = undefined; communityRequest = { kind: 'intent', orderId: order.id }; openPanel('intent') }
      break
    }
    case 'open-neighbor': {
      const resident = residentIds.find(resident => resident === value), plan = getNeighborPlans(farm).find(plan => plan.resident === resident)
      if (resident && plan) { communityResident = resident; requestedFood = undefined; communityRequest = { kind: 'neighbor', resident, planId: plan.id }; openPanel('neighbor') }
      break
    }
    case 'neighbor-help-house': {
      const resident = residentIds.find(resident => resident === value)
      if (resident && neighborHelpStatus(farm, resident)) {
        villageSlot = farm.village.residents.indexOf(resident)
        await visitPanelAt('village', 'village')
      }
      break
    }
    case 'join-neighbor': {
      const plan = getNeighborPlans(farm).find(plan => plan.id === value)
      if (plan) { communityRequest = { kind: 'neighbor', resident: plan.resident, planId: plan.id }; perform(() => joinNeighborPlan(farm, plan.id), false, true) }
      break
    }
    case 'choose-neighbor-food': {
      const plan = getNeighborPlans(farm).find(plan => plan.id === control.dataset.plan), offer = plan ? getIntentOffers(farm, plan.intentId).find(offer => offer.id === value) : undefined
      if (plan && offer) {
        communityResident = plan.resident; communityRequest = { kind: 'neighbor', resident: plan.resident, planId: plan.id }
        perform(() => serveNeighborPlan(farm, plan.id, offer.id), false, true)
      }
      break
    }
    case 'neighbor-shelf-food': {
      if(!dialog.open||panel!=='neighbor')break
      const recovery=value?getNeighborFoodRecovery(farm,value):undefined
      if(!recovery||recovery.plan.resident!==communityResident)break
      if(!recovery.shelved||!recovery.offer||recovery.offer.id!==control.dataset.food){drawPanel();break}
      communityRequest={kind:'neighbor',resident:recovery.plan.resident,planId:recovery.plan.id}
      requestedFood=undefined
      await visitPanelAt('village','bay-shop')
      break
    }
    case 'neighbor-repeat-food': {
      const recovery = value ? getNeighborFoodRecovery(farm, value) : undefined
      if (panel === 'neighbor' && recovery?.plan.resident === communityResident) {
        communityRequest = { kind: 'neighbor', resident: recovery.plan.resident, planId: recovery.plan.id }
        perform(() => repeatNeighborFood(farm, recovery.plan.id), false, true)
      }
      break
    }
    case 'arrange-neighbor': {
      const plan = getNeighborPlans(farm).find(plan => plan.id === value)
      if (plan?.phase === 'arranging') {
        communityResident = plan.resident
        communityRequest = { kind: 'neighbor', resident: plan.resident, planId: plan.id }
        if (getNeighborFoodRecovery(farm, plan.id)?.state !== 'ready') { openPanel('neighbor'); break }
        arrangementRequest = { kind: 'neighbor', id: plan.id }; openPanel('arrangement')
      }
      break
    }
    case 'ack-neighbor': {
      const plan = getNeighborPlans(farm).find(plan => plan.id === value)
      if (plan && perform(() => advanceNeighborPlan(farm, plan.id), false, true)) {
        const next = getNeighborPlans(farm).find(next => next.resident === plan.resident)
        communityRequest = next ? { kind: 'neighbor', resident: plan.resident, planId: next.id } : undefined
        drawPanel()
      }
      break
    }
    case 'deliver-intent': {
      const order = getCommunityOrders(farm).find(order => order.id === control.dataset.order), offer = order?.offers.find(offer => offer.id === value)
      if (order && offer && perform(() => deliverIntentOrder(farm, order.id, offer.id), false, true)) { requestedFood = undefined; communityRequest = undefined; updateCommunityReturn() }
      break
    }
    case 'cook-intent-offer': {
      const order = getCommunityOrders(farm).find(order => order.id === control.dataset.order), plan = getNeighborPlans(farm).find(plan => plan.id === control.dataset.plan)
      if (order) communityRequest = { kind: 'intent', orderId: order.id }
      else if (plan) communityRequest = { kind: 'neighbor', resident: plan.resident, planId: plan.id }
      const offer = communityOffers().find(offer => offer.id === value)
      if (offer) { requestedFood = offer.id; openPanel('request-food') }
      break
    }
    case 'request-start-cook': startRequestedFood(); break
    case 'request-repeat-exact': repeatRequestedFood(); break
    case 'request-food-source': await guideRequestedFood(); break
    case 'rest-intent-request':
      if (canReturnToDailyIntent(farm,communityRequest,value,{panel,open:dialog.open})) await resumeCommunityRequest('request')
      break
    case 'resume-community': await resumeCommunityRequest(control === communityResume ? 'recipe' : 'request'); break
    case 'intent-own-recipe': signatureBase = 'tart'; signatureSlots = [null, null]; signatureSlot = 0; signatureRepeatId = undefined; signatureFamily = undefined; openPanel('signature'); break
    case 'recipe-family': {
      if (control.dataset.family === 'tart' && (value === 'mixed' || dishIds.some(dish=>dish===value&&isTartDish(dish)))) kitchenTart = value as KitchenTart
      if (control.dataset.family === 'preserves' && (value === 'appleJam' || value === 'orchardPreserves' || value === 'custom')) kitchenPreserves = value
      drawPanel(); break
    }
    case 'family-signature': {
      signatureFamily = value === 'berries' ? 'berries' : 'preserves'; signatureBase = signatureFamily === 'berries' ? 'tart' : 'preserves'
      signatureSlots = signatureFamily === 'berries' ? [{ id:'strawberry',quantity:1 },{ id:'blueberry',quantity:1 }] : [null,null]
      signatureSlot = 0; signatureRepeatId = undefined; openPanel('signature'); break
    }
    case 'market-category':if(value==='seeds'||value==='trees'||value==='care'||value==='buildings'){marketCategory=value;drawPanel();dialogContent.scrollTop=0}break
    case 'inventory-group':
      if(value==='harvest'||value==='kitchen'||value==='shore'){inventoryGroup=value;drawPanel();dialogContent.scrollTop=0;dialogContent.querySelector<HTMLButtonElement>(`[data-action="inventory-group"][data-value="${value}"]`)?.focus({preventScroll:true})}break
    case 'boat-funds': {
      const destination=islandIds.find(id=>id===value)
      if(destination)await showRequirement({kind:'journey',island:destination,id:'boat'},control)
      break
    }
    case 'boat-island':
      journeyDetailsOpen=false
      if(islandIds.some(id=>id===value)){boatIsland=value as typeof boatIsland;drawPanel();dialogContent.scrollTop=0;dialogContent.querySelector<HTMLButtonElement>(`[data-action="boat-island"][data-value="${value}"]`)?.focus({preventScroll:true})}break
    case 'market-sell-group':if(value==='all'||value==='harvest'||value==='kitchen'||value==='shore'){marketSellGroup=value;drawPanel();dialogContent.scrollTop=0}break
    case 'resume-recipe-draft': {
      if (!dialog.open || panel !== 'recipes') break
      const draft = resumeRecipeDraft(farm, value)
      if (!draft) break
      signatureBase = draft.base; signatureSlots = draft.slots; signatureSlot = draft.activeSlot
      signatureRepeatId = undefined; signatureFamily = undefined; cookingMode = 'signature'
      openPanel('signature')
      break
    }
    case 'reset-recipe-draft':
      if (dialog.open && panel === 'recipes' && resetRecipeDraft(farm, value)) {
        saveFarm(); drawPanel()
      }
      break
    case 'new-signature':
      signatureBase=value==='tart'?'tart':'preserves';signatureSlots=[null,null];signatureSlot=0;signatureRepeatId=undefined;signatureFamily=undefined;openPanel('signature');break
    case 'signature-base':
      if(value==='preserves'||value==='tart'){signatureBase=value;signatureRepeatId=undefined;rememberCurrentRecipeDraft();drawPanel()}break
    case 'signature-slot':signatureSlot=value==='1'?1:0;rememberCurrentRecipeDraft();drawPanel();break
    case 'signature-fruit':{
      const id=signatureFruitIds.find(id=>id===value)
      if(!id)break
      const trait=control.dataset.trait as Trait|undefined,part:SignatureIngredient={id,quantity:1,...(trait?{trait}:{})}
      if(signaturePortionStock(farm,part)===0){const item:StockItem=trait?{kind:'variants',item:id,trait,quantity:1}:id==='apple'||id==='pear'||id==='peach'?{kind:'fruit',item:id,quantity:1}:{kind:'produce',item:id,quantity:1};await showRequirement({kind:'stock',item},control);break}
      signatureSlots[signatureSlot]=part;signatureSlot=signatureSlot===0?1:0;signatureRepeatId=undefined;rememberCurrentRecipeDraft();drawPanel();break
    }
    case 'start-signature':cookingMode='signature';openPanel('cookery');break
    case 'signature-home':
      if(canSailTo(farm,'home')){closeDialog();await island.crossIsland(()=>perform(()=>sail(farm,'home'),false,true));openPanel('recipes',false);openPanel('signature')}
      break
    case 'recipe-repeat-home': {
      const recipe=farm.culinary.recipes.find(recipe=>recipe.id===value)
      if(!recipe)break
      expandedRepeatId=recipe.id
      await visitPanelAt('home','recipes')
      if(panel==='recipes'&&farm.island==='home')highlightControl(dialogContent.querySelector(`[data-repeat-guide="${CSS.escape(recipe.id)}"]`))
      break
    }
    case 'recipe-warehouse-withdraw':
      if(dialog.open&&panel==='recipes'&&perform(()=>withdrawStoredSignature(farm,value),false,true))bayAudio.playEvent('harbour.crate')
      break
    case 'make-signature':if(value)perform(()=>repeatSignature(farm,value!,undefined,1),false,true);break
    case 'manual-signature':{
      signatureFamily=undefined
      const recipe=farm.culinary.recipes.find(recipe=>recipe.id===value)
      if(recipe){signatureBase=recipe.base;signatureSlots=recipe.ingredients.flatMap(part=>Array.from({length:part.quantity},()=>({...part,quantity:1})));signatureRepeatId=recipe.id;cookingMode='signature';if(getSignatureAction(farm,recipe).available)openPanel('cookery');else openPanel('signature')}
      break
    }
    case 'batch-signature':if(value)perform(()=>repeatSignature(farm,value!,undefined,3),false,true);break
    case 'favorite-signature':if(value)perform(()=>favoriteSignature(farm,value!),false,true);break
    case 'forget-signature':if(value)perform(()=>forgetSignature(farm,value!),false,true);break
    case 'sell-signature':if(value)beginExactSale({kind:'signature',key:value});break
    case 'use-signature':if(value)perform(()=>useSignature(farm,value!),false);break
    case 'taste-signature':{const id=residentIds.find(id=>id===control.dataset.resident);if(value&&id)perform(()=>tasteSignature(farm,value!,id),false);break}
    case 'supper-signature':if(value)perform(()=>deliverSignature(farm,value!),false);break
    case 'cove-choice':{
      const [key,choice]=(value??'').split(':')
      if((key==='flow'&&['open','sheltered'].includes(choice))||(key==='cover'&&['kelp','meadow'].includes(choice))||(key==='refuge'&&['sand','stones'].includes(choice)))perform(()=>changeCove(farm,{[key]:choice}),false,true)
      break
    }
    case 'cove-cancel': if (panel === 'cove' && value) perform(() => cancelCovePlan(farm, value), false, true); break
    case 'cove-fish':openPanel('fishing');break
    case 'shoal-pick': {
      const id=shoalFindIds.find(id=>id===value)
      if(id&&getShoalFindAt(farm,id)){closeDialog();activateTarget({kind:'shoal-find',id})}
      break
    }
    case 'grill-fish': {
      const id=fishIds.find(id=>id===value)
      if(id){cookingFish=id;drawPanel()}
      break
    }
    case 'fish-kitchen': {
      const id=fishIds.find(id=>id===value)
      if(!id)break
      cookingFish=id
      if(farm.island!=='home') {closeDialog();await island.crossIsland(()=>perform(()=>sail(farm,'home'),false,true))}
      openPanel('kitchen')
      break
    }
    case 'fish-market':
      marketTab='sell';marketSellGroup='shore'
      if(farm.island!=='home'){closeDialog();await island.crossIsland(()=>perform(()=>sail(farm,'home'),false,true))}
      openPanel('market');break
    case 'cove-shells':closeDialog();island.focusTarget({kind:'shell',index:[0,1,2].find(index=>!farm.shellsCollectedToday.includes(index))??0});break
    case 'warehouse-supply': {
      selectedWarehouseRequest=warehouseRequest(value)
      if(selectedWarehouseRequest)openPanel('warehouse-supply')
      break
    }
    case 'warehouse-supply-withdraw': {
      if(panel!=='warehouse-supply'||!dialog.open)break
      if(perform(()=>withdrawWarehouseSupply(farm,selectedWarehouseRequest,warehouseConfirmation(value))))bayAudio.playEvent('harbour.crate')
      break
    }
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
    case 'travel-panel': if(value==='market') await visitPanelAt('home','market'); break
    case 'back': goBack(); break
    case 'open-panel': if(value&&value in panelTitles)openPanel(value as Panel);break
    case 'harbour-view': if (value && isHarbourView(value)) island.setHarbourView(value); break
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
    case 'project-boat': openPanel('boat',true,'grove');break
    case 'project-dock': openPanel('dock-project');break
    case 'visit-harbor': openPanel('harbor');break
    case 'harbor-next-rest':
      if(canVisitHarborRest(farm,value,{panel,open:dialog.open,tab:marketTab}))await visitPanelAt('home','rest')
      break
    case 'withdraw-harbor':perform(()=>withdrawHarborSupplies(farm),false,true);break
    case 'deliver-harbor': if(perform(()=>deliverHarborOrder(farm),false,true))playBaySound(getHarborOrder(farm)?.status==='completed'?'trade.receive':'harbour.crate'); break
    case 'deliver-project': {
      const id = projectIds.find((project) => project === value)
      if (!id) break
      const project = getProject(farm, id)
      const finishing = project.status === 'ready' && project.items.every(({ item, delivered, available }) =>
        delivered + available === item.quantity)
      if (perform(() => deliverProject(farm,id),false,!finishing)) {
        playBaySound(finishing?'build.finish':'harbour.crate')
        if(finishing)island.showProject(id)
      }
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
    case 'sell': if(perform(() => sellProduce(farm), false, farm.progress.sell > 0))playBaySound('trade.receive'); break
    case 'sell-item': if(value)beginExactSale({kind:'market',key:value}); break
    case 'confirm-sale': confirmExactSale(); break
    case 'sale-again': if(selectedSale)beginExactSale(selectedSale); break
    case 'buy-feed': if(perform(() => buyFeed(farm)))playBaySound('trade.pay'); break
    case 'upgrade-can': perform(() => upgradeCan(farm), false, true); break
    case 'buy-seeds':
      if (crop && perform(() => buySeeds(farm,crop))){playBaySound('trade.pay');if(panel==='seeds')chooseSeed(crop)}
      break
    case 'chicken-feed-open':
      if (panel === 'coop' && dialog.open && farm.island === 'home' && farm.buildingLevels.coop >= 2) openPanel('chicken-feed')
      break
    case 'mix-chicken-feed': if(panel === 'chicken-feed' && dialog.open)perform(() => mixChickenFeed(farm, value), false, true); break
    case 'feed': if(perform(() => feedChickens(farm), false, farm.progress.feed > 0))playBaySound('flock.feed', 1, 0); break
    case 'collect': if(perform(() => collectEggs(farm)))playBaySound('flock.eggs', 1, 0); break
    case 'unpack-egg-basket':perform(()=>unpackEggBasket(farm),false,true);break
    case 'unpack-egg-crate':perform(()=>unpackEggCrate(farm),false,true);break
    case 'pack-egg-basket': arrangementRequest = { kind: 'packing', mode: 'eggs' }; openPanel('arrangement'); break
    case 'pack-egg-crate': arrangementRequest = { kind: 'packing', mode: 'crate' }; openPanel('arrangement'); break
    case 'incubate-egg': perform(() => incubateEgg(farm)); break
    case 'rest-close-shop':
      if (panel === 'rest' && dialog.open) perform(() => closeShopBeforeRest(farm, value), false, true)
      break
    case 'market-next-rest':
      if(canVisitMarketRest(farm,value,{panel,open:dialog.open,tab:marketTab}))await visitPanelAt('home','rest')
      break
    case 'visit-rest': await visitPanelAt('home','rest'); break
    case 'sleep': {
      if (panel !== 'rest' || !dialog.open || !canConfirmRest(farm,value)) break
      const flockSize = farm.flockSize
      const oldShip=farm.freight.ship
      const expeditionWasSailing=farm.freight.expeditions.active?.phase==='sailing'
      const rested=perform(() => endDay(farm),true)
      if(rested){playBaySound(expeditionWasSailing&&farm.freight.expeditions.active?.phase==='ready'||oldShip.phase==='sailing'&&farm.freight.ship.phase==='docked'?'harbour.berth':'daybreak.shutters')}
      if (rested && farm.flockSize > flockSize) {
        playBaySound('flock.hatch', 1, 0);island.showHatch()
        notify('В стае появилась новая курочка.')
      }
      break
    }
    case 'refill':
      island.visit({ kind: 'well' })
      activeTool = 'water'
      perform(() => refillWater(farm)) && playBaySound('field.refill', 1, 0)
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
      if (perform(() => pair ? irrigatePair(farm, row) : irrigateRow(farm, row), true)) { island.showIrrigation(targets); playBaySound('field.irrigation', 1, 0) }
      break
    }
    case 'visit-coop': activateTarget({ kind: 'coop' }); break
    case 'visit-market': activateTarget({ kind: 'market' }); break
    case 'fishing-practice': if (panel === 'fishing' && canPracticeFishing(farm)) mountFishing(true); break
    case 'visit-pier': activateTarget({ kind: 'pier' }); break
    case 'visit-hive': activateTarget({ kind: 'hive' }); break
    case 'visit-honey-kitchen': activateTarget({ kind: 'honey-kitchen' }); break
    case 'cape-upgrade': openPanel('cape-upgrade'); break
    case 'build-cape-upgrade': if(perform(()=>upgradeCape(farm),true))playBaySound('build.finish'); break
    case 'visit-guest': activateTarget({ kind: 'guest' }); break
    case 'bay-display': activateTarget({ kind: 'bay-display' }); break
    case 'collect-honey':
      closeDialog()
      island.workCape({ kind: 'hive' }, () => {const done=perform(() => collectCapeHoney(farm));if(done)playBaySound('apiary.frame', 1, 0);return done})
      break
    case 'serve-guest': perform(() => serveFairGuest(farm), true); break
    case 'visit-boat': activateTarget({ kind: 'boat' }); break
    case 'tree-slot': {
      if (panel !== 'tree' || (farm.island !== 'home' && farm.island !== 'grove')) break
      const index = Number(value)
      if (!Number.isInteger(index) || farm.trees[farm.island][index] === undefined) break
      treeSlot = index
      island.visit({kind:'tree',index})
      drawPanel()
      dialogContent.querySelector<HTMLButtonElement>('.tree-selector [aria-pressed="true"]')?.focus({preventScroll:true})
      break
    }
    case 'visit-tree': activateTarget({ kind: 'tree', index: Number(value) }); break
    case 'pet': activateTarget({ kind: 'hen', index: Number(value) }); break
    case 'gather-salt': activateTarget({ kind: 'salt' }); break
    case 'guide': openPanel('guide'); break
    case 'orchard':
      openPanel('orchard')
      if (value && farm.treeNursery.some(entry => entry.id === Number(value))) highlightControl(dialogContent.querySelector<HTMLElement>(`[data-action="return-nursery-tree"][data-value="${Number(value)}"]`))
      break
    case 'upgrades': openPanel('upgrades'); break
    case 'specialize': {
      const building = buildingIds.find((id) => id === value)
      if (building && farm.island === 'home' && (farm.buildingLevels[building] === 2 || building === 'farmhouse' && farm.buildingLevels.farmhouse === 3 && !farm.farmhouseSecondarySpecialization)) {
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
    case 'workshop': {
      const shape = workshopShapes.find(shape => shape === value)
      if (shape) pastryShape = shape
      workshopRecipe = 'pastry'; openPanel('workshop'); break
    }
    case 'open-village': openPanel('village'); break
    case 'village-project': openPanel('village-project'); break
    case 'fair-project': marketTab = 'projects'; openPanel('market'); break
    case 'visit-cottage': if (value !== undefined && Number.isInteger(Number(value))) activateTarget({ kind: 'village-home', index: Number(value) }); break
    case 'village-meal':
      if (value && workshopShapes.includes(value as WorkshopShape)) pastryShape = value as WorkshopShape
      openPanel('village-meal'); break
    case 'build-village': if(perform(()=>contributeVillage(farm),false,true))playBaySound(farm.village.built?'build.finish':'harbour.crate'); break
    case 'village-slot': villageSlot = Number(value) === 1 ? 1 : 0; drawPanel(); dialogContent.scrollTop=0; dialogContent.querySelector<HTMLButtonElement>(`[data-action="village-slot"][data-value="${villageSlot}"]`)?.focus({preventScroll:true}); break
    case 'invite-resident': {
      const id = residentIds.find(id => id === value)
      if (id) perform(() => inviteResident(farm, id, villageSlot), false, true)
      break
    }
    case 'practice-pattern': {
      const shape = workshopShapes.find(shape => shape === value)
      if (shape) { pastryShape = shape; workshopRecipe = 'pastry'; openPanel('workshop') }
      break
    }
    case 'pastry-shape': {
      const shape = workshopShapes.find(shape => shape === value)
      const keepPastryOpen = dialogContent.querySelector<HTMLDetailsElement>('.shared-supper-pastry')?.open
      if (shape) {
        pastryShape = shape; drawPanel()
        const choices = dialogContent.querySelector<HTMLDetailsElement>('.shared-supper-pastry')
        if (keepPastryOpen && choices) {
          choices.open = true
          choices.querySelector<HTMLButtonElement>(`[data-action="pastry-shape"][data-value="${shape}"]`)?.focus({preventScroll:true})
        }
      }
      break
    }
    case 'share-meal': perform(() => serveVillageMeal(farm, pastryShape), true, true); break
    case 'resident-service': {
      const id = residentIds.find(id => id === value)
      if (id) perform(() => runResidentService(farm, id, pastryShape), true, true)
      break
    }
    case 'buy-boat': if(perform(()=>buyBoat(farm),false,true))playBaySound('trade.pay'); break
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
        if(destination==='village'&&!farm.village.residents.some(Boolean)){villageSlot=0;openPanel('village')}
      }
      break
    }
    case 'store-tree': {
      if (panel === 'tree' && Number(value) === treeSlot && perform(() => storeTree(farm, treeSlot))) {
        dialogContent.scrollTop = 0
        dialogContent.querySelector<HTMLButtonElement>('[data-action="return-nursery-tree"]')?.focus({ preventScroll: true })
      }
      break
    }
    case 'return-nursery-tree': {
      if ((panel !== 'tree' && panel !== 'orchard') || (farm.island !== 'home' && farm.island !== 'grove')) break
      const slot = panel === 'tree' ? treeSlot : farm.trees[farm.island].findIndex(tree => tree === null)
      if (perform(() => returnNurseryTree(farm, slot, Number(value)))) {
        dialogContent.scrollTop = 0
        dialogContent.querySelector<HTMLButtonElement>(panel === 'tree' ? '[data-action="pick-fruit"], [data-action="store-tree"]' : `[data-action="visit-tree"][data-value="${slot}"]`)?.focus({ preventScroll: true })
      }
      break
    }
    case 'buy-plant-tree': {const tree=treeIds.find(id=>id===value);if(tree && perform(()=>buyAndPlantTree(farm,treeSlot,tree)))playBaySound('orchard.sapling', 1, 0);break}
    case 'buy-sapling': {
      const tree = treeIds.find((id) => id === value)
      if (tree) perform(() => buySapling(farm, tree))
      break
    }
    case 'plant-tree': {
      const tree = treeIds.find((id) => id === value)
      if (tree && perform(() => plantTree(farm, treeSlot, tree))) playBaySound('orchard.sapling', 1, 0)
      break
    }
    case 'pick-fruit': {
      const tree = (farm.island === 'home' || farm.island === 'grove') && farm.trees[farm.island][treeSlot]
      if(tree && perform(() => pickFruit(farm, treeSlot)))playBaySound(orchardPickSound(tree.tree), 1, 0)
      break
    }
    case 'upgrade-building': {
      const building = buildingIds.find((id) => id === value)
      if (building && perform(() => upgradeBuilding(farm, building), true)) { island.showUpgrade(building); playBaySound('build.finish') }
      break
    }
    case 'cook': {
      const dish = dishIds.find((id) => id === value)
      cookingMode='dish'
      if (dish === 'farmhouseBread' && getCookAction(farm, dish).available) {
        workshopRecipe = 'bread'
        openPanel('workshop')
      } else if (dish && (isTartDish(dish)||['appleJam','orchardPreserves','honeyPear','honeyBiscuits','windParfait','honeyCake','grilledFish'].includes(dish)) && getCookAction(farm, dish, cookingFish).available) {
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

function closeCurrentPanel() {
  if (communityRequest && (panel === 'cookery' || panel === 'workshop' || panel === 'arrangement')) void resumeCommunityRequest()
  else closeDialog()
}
closeButton.addEventListener('click', closeCurrentPanel)
function returnFromPanel(event: Event) {
  if (event.defaultPrevented) return
  if (communityRequest && (panel === 'cookery' || panel === 'workshop' || panel === 'arrangement')) {
    event.preventDefault()
    void resumeCommunityRequest()
  } else if (panelHistory.length) {
    event.preventDefault()
    goBack()
  }
}
dialog.addEventListener('cancel', returnFromPanel)
dialog.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  // Handle keyboard return before the native dialog close request. Browsers may
  // make repeated native cancel events non-cancelable between user activations.
  if (event.repeat) event.preventDefault()
  else returnFromPanel(event)
})
dialog.addEventListener('keydown',event=>{if(event.altKey&&event.key==='ArrowLeft'&&panelHistory.length){event.preventDefault();goBack()}})
dialog.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !(event.target instanceof HTMLButtonElement)) return
  const selector = event.target.closest('.island-selector,.house-selector,.tree-selector,.panel-tabs,.market-category-icons,.recipe-family-choices,.recipe-fish-choices')
  if (!selector || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return
  const choices = [...selector.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    .filter(choice => choice.getClientRects().length > 0)
  const index = choices.indexOf(event.target)
  if (index < 0) return
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + choices.length) % choices.length
  event.preventDefault()
  if (next === index) return
  // Focus before the action: drawPanel replaces these buttons and restores the
  // focused choice. Clicking first would keep keyboard focus on the old choice.
  choices[next].focus({ preventScroll: true })
  choices[next].click()
})
dialogContent.addEventListener('toggle',event=>{
  const details=event.target
  if(details instanceof HTMLDetailsElement&&details.isConnected&&panel==='recipes'&&details.dataset.repeatGuide){
    if(details.open)expandedRepeatId=details.dataset.repeatGuide
    else if(expandedRepeatId===details.dataset.repeatGuide)expandedRepeatId=undefined
  }
  const detail=event.target
  if(detail instanceof HTMLDetailsElement && detail.classList.contains('journey-details')) journeyDetailsOpen=detail.open
  if(detail instanceof HTMLDetailsElement && detail.classList.contains('discovery-roadmap')) journalDetailsOpen=detail.open
},true)
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) closeDialog()
})
dialog.addEventListener('close', () => {
  if (!dialog.open) {
    transplantSelection.reset()
  berryNurserySelection.reset()
    playBaySound('page.fold',.72,0)
    island.setViewMode('world')
    app.dataset.scene=''
    island.setCoveFocus(false)
    stopHarbour()
    stopFishing()
    stopWorkshop()
    stopCookery()
    stopArrangement()
    panel = undefined
      seedPickerBed = undefined
    panelHistory.length=0
    updateCommunityReturn()
  }
})

app.addEventListener('change',event=>{
  const input=event.target
  if(input instanceof HTMLInputElement&&input.dataset.recipeName)perform(()=>nameSignature(farm,input.dataset.recipeName!,input.value),false,true)
})
app.addEventListener('input', event => {
  if (event.target instanceof HTMLInputElement && event.target.matches('[data-sale-quantity]')) {
    saleQuantity = event.target.value; updateSaleQuote()
  }
})
app.addEventListener('keydown', event => {
  if (!event.defaultPrevented && event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.matches('[data-sale-quantity]')) {
    event.preventDefault()
    if (!event.repeat) dialogContent.querySelector<HTMLButtonElement>('[data-action="confirm-sale"]')?.click()
  }
})
app.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target instanceof HTMLInputElement&&event.target.dataset.recipeName){event.preventDefault();event.target.blur()}})

window.addEventListener('keydown', (event) => {
  if (island.isCrossing()) { event.preventDefault(); return }
  if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || dialog.open) return
  const key = event.key.toLowerCase()
  if (event.code === 'KeyJ' || key === 'j' || key === '?') {
    event.preventDefault()
    openPanel(event.code === 'KeyJ' || key === 'j' ? 'journal' : 'guide')
    return
  }
  const tool = tools.find((entry) => entry.key === key)?.id
  if (tool) {
    event.preventDefault()
    useHotbar(tool)
  }
})

saveRecovery = mountSaveRecovery(saveStore)
if (saveStore.issue) saveRecovery.show()

refresh()
if (fieldLayout.matches && farm.island === 'home') toggleFieldView()


void bayAudio.preload()
let firstSoundsPrepared = false
function activateSound() {
  if (bayAudio.state==='running' && firstSoundsPrepared) return
  void bayAudio.unlock().then(ready => {
    if (!ready || firstSoundsPrepared || bayAudio.settings.muted || !bayAudio.settings.effects) return
    firstSoundsPrepared = true
    return bayAudio.primeEvents(['menu.press','menu.choose','page.unfold','page.fold','page.map','menu.blocked','field.step'])
  })
}
document.addEventListener('pointerdown',activateSound,{capture:true})
document.addEventListener('keydown',activateSound,{capture:true})
app.addEventListener('input',event=>{
  const input=event.target
  if(!(input instanceof HTMLInputElement))return
  const key=input.dataset.sound
  if(key==='muted')bayAudio.setSettings({muted:input.checked})
  if(key==='volume'||key==='music'||key==='effects')bayAudio.setSettings({[key]:Number(input.value)/100})
})
