import { canPlayWithBea } from './bea-duet'
import { finnPicnicRide, sailHomeWithFinn } from './finn-picnic-ride'
import { standingVisitCrop, showStandingVisitCrop } from './standing-crop-visit'
import { standingVisitTree, showStandingVisitTree } from './standing-tree-visit'
import { projectContributionCopy, projectLevelCopy, projectRewardLabel } from './project-readiness-copy'
import './market-project-readiness.css'
import { MarketInlineSales, inlineReceiptText } from './market-inline-sale'
import { getMarketOrderSurplusQuote, sellMarketOrderSurplus } from './market-order-surplus'
import { MarketSaleBrowseMemory } from './market-sale-browse'
import { marketSaleFamilies } from './market-sale-family'
import { SalePresentation } from './sale-presentation'
import { searchMarketSales, searchMarketSaleView } from './market-sale-search'
import './market-sale-search.css'
import { recipePlanningIngredient } from './recipe-planning'
import {seedSavingQuote,saveCropSeeds} from './seed-saving'
import {seedProductionFocus} from './seed-production-focus'
import {renderSeedPicker} from './seed-picker-ui'
import {revealSeedPickerFocus} from './seed-picker-focus'
import './seed-picker.css'
import {seedChoice,chooseSeedForBed,seedPickerBedPreview} from './seed-choice'
import {planBedWork,isCurrentBedWork,bedWorkKind} from './bed-work-intent'
import { basketHotbarIcons, basketHotbarLabels } from './basket-hotbar'
import { renderHarvestStocks } from './inventory-harvest'
import './inventory-supplies.css'
import { RecipeSurplusSelection, renderRecipeSurplus } from './recipe-surplus-ui'
import './recipe-surplus.css'
import { BerryRenewalSelection, renderBerryRenewal, restoreBerryRenewalFocus, berrySeedPreview, revealBerrySeedPreview } from './berry-renewal-ui'
import { getBerryPropagation, getBerryRenewalPreview, harvestBerryAndKeep } from './farm'
import { saveGardenSeedPacket } from './garden-harvest-seeds'
import { buyGardenSeeds, gardenSeedQuote } from './garden-seed-basket'
import { activeGardenPlan, plannedCropAt, followGardenPlan, removeGardenPlan } from './garden-plans'
import { GardenPlanEditor, renderGardenPlans, renderGardenMode, gardenPlanToken } from './garden-plans-ui'
import './garden-plans.css'
import { canInviteNeighbor, inviteNeighborVisit, finishNeighborVisit, visitActivities } from './neighbor-visits'
import { renderNeighborVisits, renderVisitRest } from './neighbor-visits-ui'
import { canIntroduceHenToVisitor, introduceHenToVisitor } from './farm'
import './neighbor-visits.css'
import { restoreLegacyFarm } from './farm-save-migration'
import { getHarbourFishRoute, getVillageFishWarehouse, renderHarbourFishChoice } from './harbour-fish-route'
import { BerryNurserySelection, renderBerryNursery, getBerryNurserySource } from './berry-nursery'
import { villageHomeProgress } from './village-home-art'
import './berry-nursery.css'
import { compactShopCommissionOffers, renderShopCommissions } from './shop-commissions-ui'
import { ShopAssortmentChoice } from './shop-assortment-choice'
import { ShopCommissionView } from './shop-commission-view'
import './shop-commissions.css'
import { acceptShopCommission, deliverShopCommission, cancelShopCommission, finishShopCommission, getShopCommissionLine, getShopCommissionOffers } from './shop-commissions'
import { getFestivalCargoRoute } from './festival-cargo-route.ts'
import { getFestivalShoreRoute } from './festival-shore-route.ts'
import { rememberRecipeDraft, resumeRecipeDraft, resetRecipeDraft } from './recipe-draft'
import { canReturnToDailyIntent, renderIntentDeadline, renderSelectedIntentRest, selectedDailyIntent } from './intent-deadline'
import { renderFacilityChoiceDetails } from './facility-choice'
import './facility-choice.css'
import { getWindHoneySource } from './wind-honey-guidance'
import { canVisitHarborRest, getNextHarborOrder, readyHarborOrderRoute, renderNextHarborOrder } from './harbor-return'
import './harbor-return.css'
import { renderVillageBudget } from './village-budget'
import { getStoredSignature, storedSignatureValue, withdrawStoredSignature } from './stored-signature'
import './village-budget.css'
import { treeVariantCopy } from './ready-variant-guidance'
import { canVisitMarketRest, getNextMarketOrders, renderNextMarketOrder } from './market-return'
import { getMarketOrderBoard, placeReadyMarketOrder, renderMarketOrderPicker } from './market-orders-view'
import { pickUpMarketOrderStock } from './market-order-pickup'
import './market-orders-view.css'
import './market-return.css'
import { fairJamPicnicChoice, renderFairReturn } from './fair-return'
import './fair-return.css'
import { getLocalWarehouseSupply, warehouseRequest, warehouseSupplyCopy, warehouseConfirmation, warehouseConfirmationValue, withdrawWarehouseSupply } from './warehouse-guidance'
import { getReadySignatureSuppers, getSupperFishRecovery, getSupperFishFork, renderSupperFishFork, reviewedSupperFish, tableSupperFish, renderSignatureSuppers, renderSupperResult, supperCottageReady } from './shared-supper'
import './shared-supper.css'
import { renderShopRest, closeShopBeforeRest } from './shop-rest'
import './shop-rest.css'
import { shoalReturnCopy } from './shoal-return'
import { getApiaryCopy } from './apiary-preview'
import { getCapeJourneyStatus } from './cape-journey-status'
import './apiary-preview.css'
import { activeHarvestPicnic } from './harvest-picnic'
import { renderPicnicStatus } from './picnic-guidance'
import { renderCoopCapacityWarning } from './coop-preview'
import { getIncubatorNewHen, getIncubatorWarehouseBasket, getIncubatorWarehouseEgg, hasIncubatorBasketSource, renderCoopPanel } from './coop-panel'
import { groupCoopServices } from './coop-services'
import './coop-services.css'
import './coop-panel.css'
import { canMixBedtimeFeed, mixChickenFeed, renderChickenFeedMixes } from './chicken-feed'
import './chicken-feed.css'
import { henFriends, henFriendshipStage, refreshHenWalkChoice, renderHenFriendship, treatHen } from './hen-friendship'
import { henCareResultFocus } from './hen-care-focus'
import './hen-friendship.css'
import './coop-preview.css'
import { canConfirmRest } from './rest-preview'
import { renderRestPreview } from './rest-preview-ui'
import { renderFerryReturn } from './ferry-return'
import { nextFerryExploration } from './ferry-discovery'
import './rest-preview.css'
import { chooseDiscoveryIdea, setDiscoveryPace, resumeDiscoveryIdea, forgetDiscoveryIdea } from './discovery-preferences'
import { getGuidanceTask } from './discovery-guidance'
import { renderDiscoveryGuidance } from './discovery-preferences-ui'
import { getNeighborFoodRecovery, repeatNeighborFood, repeatRequestedSignature } from './neighbor-food-recovery'
import { BedTransplantSelection, renderBedTransplant } from './bed-transplant'
import './bed-transplant.css'
import { cancelCovePlan } from './farm'
import { renderFishingPracticeEntry } from './fishing-practice-ui'
import { canPracticeFishing, createFishingPractice } from './fishing-practice'
import { getEggUnpackAction, unpackEggBasket, unpackEggCrate, nextContractCrateQuote, getHarborWithdrawal, withdrawHarborSupplies } from './farm'
import { installActionClickGuard } from './action-click-guard'
import { grovePearlCabinet, setGrovePearlCabinet } from './farm'
import { exactSaleQuote, saleStock, stepSaleQuantity, type SaleTarget } from './exact-sale'
import './exact-sale.css'
import { getBedHarvestPreview } from './farm'
import { fieldContextCopyMarkup, harvestPreviewCopy, updateFieldContextCopy } from './harvest-preview'
import { signatureBookCapacity } from './signature-book'
import { hasFarmhouseSpecialization, getFarmhouseSpecializationAction, getFirstFarmhouseOrderPreview } from './farm'
import { VersionedSave, browserSaveLock } from './versioned-save'
import { farmSaveKeys } from './farm-save-keys'
import { mountSaveRecovery } from './save-recovery'
import { renderFestivalPanel, renderHomeFestivalPreparation } from './bay-festival-ui'
import { getFestivalConcertState } from './festival-concert-guidance'
import { getFestivalHarvestRoute } from './festival-harvest-route'
import { getFinnFishingRoute } from './finn-fishing-route'
import { getFestivalFishingRoute } from './festival-fishing-route'
import { festivalTraditions, type FestivalTradition } from './bay-festival'
import { beginFestival, cancelFestival, contributeFestival, finishFestival, getFestivalChoices, getFestivalStatus, getShellAt } from './farm'
import { playBaySound } from './game-sound'
import { bedWorkSound, orchardPickSound } from './farm-sounds'
import { reconcileFreightPorts } from './bay-freight-model'
import { combinedExpeditionId, expeditionOfferAfterClaim, initialExpeditionPreview, expeditionOfferIds, expeditionPorts, expeditionTrades, type ExpeditionPort } from './ferry-expeditions'
import { getFerryRestockPlan } from './ferry-restock'
import { firstFerryCargoOffer } from './ferry-smaller-cargo'
import { bayAudio } from './bay-audio'
import { mountBayShop, type BayShopCommissionPreview, type BayShopOptions, type BayShopStockGroup } from './bay-shop'
import { renderFreightPanelInto, presentFerryDeparture, presentFerryArrival, freightControl } from './bay-freight-ui'
import { FerryArrivalPresentation } from './ferry-arrival-presentation'
import { captureFerryPanelView, restoreFerryPanelView, type FerryPanelView } from './ferry-panel-view'
import { getMusicMaterialGuidance, getMusicSaltRequirement, musicMaterialItems, musicMaterialNames } from './music-material-guidance'
import { createBayMusic, type BayMusicViewState } from './bay-music'
import { describeFood } from './intent-orders'
import { bayProductId, installGardenInstrument, openedFreightPorts, reserveShopGoods, returnShopGoods, transferBayGoods, sendFerryExpedition, expeditionWallet, getFerrySupplyRequirement, getFerryReadyHarvest, gardenMaterialStock } from './harbour-economy'
import { berryCropIds, foodDescriptors, marketKey, marketStock, unitPrice, islandIds as allPorts } from './farm'
import './harbour-life.css'
import {applyIngredientFinishes} from './ingredient-finish'
import './style.css'
import './navigation.css'
import './guide-garden-group.css'
import './kitchen-neighbours.css'
import { chooseHoneyKitchenRecipe, renderHoneyKitchenMenu, type HoneyKitchenRecipe } from './honey-kitchen-menu'
import './honey-kitchen-menu.css'
import './neighbor-house.css'
import { ruPlural } from './ru'
import { archiveCards } from './archive'
import { getIslandJourneys } from './journey'
import { getDiscoveryTask } from './discovery-path'
import { getDiscoveryJournal } from './discovery-journal'
import { getFruitSource, nurseryFruitDetail } from './orchard-guidance'
import {TreeStorageChoice,storedTreeChoiceLabel,revealTreeStorageReturn} from './tree-storage-choice'
import './tree-storage-choice.css'
import { orchardMarketReturnIndex } from './orchard-market-return'
import './orchard-market-return.css'
import './discovery-journal.css'
import { getRequirementHint, type Requirement } from './requirement-guidance'
import { getClimate, weatherNames, type Trait } from './climate'
import { ferryCommissionUse, openFerryCommissionRecipe } from './ferry-commission-use'
import { FerryPeachPlanting } from './ferry-peach-planting'
import { getFerryGroveBunSource } from './ferry-grove-bun-source'
import { lastPortionShopStock, signatureTastingGuide } from './signature-tasting-guidance'
import { RecipeBookNavigation, recipeBookNarrow, selectedBookId, sortedBookRecipes, type RecipeBookView } from './recipe-book-view'
import {recipeBookResults,recipeBookSearchStatus,signatureBook,signatureStudio,coveControls,signatureResultPicture,cookeryResultPicture,escapeRecipeText as escapeHtml} from './culinary-ui'
import {signatureFruitIds,signatureFruitNames,type SignatureDraft,type SignatureIngredient} from './culinary'
import { communityBoard, communityIntent, neighborDetail, neighborHelpCard, type CommunityArt } from './community-ui'
import { bakeRequestedBeaBatch, getRequestedBeaBatch } from './request-bea-batch'
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
  finishFishingTrip, type LandedFish,
  cancelFishingTrip,
  getFishingTripConfig, getOtherShoreFishingTrip, getResumableFishingTrip,
  bakeWorkshop,
  getWorkshopAction,
  workshopIngredients,
  getBeaPastryCount,
  workshopDefinitions,
  workshopShapes,
  getVillageProject,
  contributeVillage, contributeVillageSupply, getVillageContributionChoices,
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
  getSignatureAction,completeSignature,repeatSignature,getCommissionRecipePair,repeatCommissionRecipePair,nameSignature,favoriteSignature,forgetSignature,sellSignature,useSignature,tasteSignature,deliverSignature,getCoveActions,changeCove,
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
  getCapeBloom, getCapeBouquetPreview, cutCapeBouquet,
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
  getHomeBreadBasket,
  getMarketStock,
  getProject,
  getSale,
  getShoreItem,
  getTreeAction,
  getFruitTreeSeed,
  plantFruitTreeSeed,
  treeNightsToFruit,
  getWaterCapacity,
  ingredientCount,
  hasBayDisplay,
  incubateEgg,
  incubateRareEgg,
  irrigateRow,
  irrigatePair,
  isProjectComplete,
  isHoneyWind,
  islandIds,
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
  restoreCurrentFarm,
  sail,
  seedPackSize,
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
import './market-sale-grid.css'
import './market-buy-seeds.css'
import './market-buy-trees.css'
import './market-buy-care.css'

const saveStore = new VersionedSave(() => localStorage, farmSaveKeys, restoreCurrentFarm, createFarm, browserSaveLock(farmSaveKeys.lock), restoreLegacyFarm)
const farm = await saveStore.load() ?? createFarm()
let saveAvailable = !saveStore.blocked
let saveRecovery: ReturnType<typeof mountSaveRecovery> | undefined

let fishingLanding: LandedFish | undefined
let pendingSaves = 0
function saveFarm() {
  pendingSaves++
  return saveStore.save(fishingLanding?.saveSnapshot() ?? farm).then(saved => {
    pendingSaves--
    const changed = saveAvailable !== saved
    saveAvailable = saved
    if (changed && panel === 'settings' && dialog.open) drawPanel()
    saveRecovery?.update()
    return saved
  })
}
window.addEventListener('beforeunload', event => {
  if (pendingSaves > 0 || !saveStore.blocked && saveStore.issue === 'write-failed') { event.preventDefault(); event.returnValue = '' }
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
  { id: 'basket', label: basketHotbarLabels[farm.island], image: 'crate', key: '5', inGrove: true },
  { id: 'coop', label: 'Курятник', image: 'hen', key: '6' },
  { id: 'rod', label: 'Удочка', image: 'rod', key: '7', inGrove: true },
  { id: 'boat', label: 'Лодка', image: 'boat', key: '8', inGrove: true },
] as const

type Tool = (typeof tools)[number]['id']
type Panel = 'recipe-surplus' | 'berry-renewal' | 'garden-plans' | 'neighbor-visits' | 'hen-friendship' | 'chicken-feed' | 'berry-nursery' | 'shop-commissions' | 'warehouse-supply' | 'music-supplies' | 'transplant' | 'sale' | 'festival' | 'bay-shop' | 'bay-freight' | 'bay-music' | 'market' | 'inventory' | 'archive' | 'settings' | 'journal' | 'coop' | 'rest' | 'guide' | 'seeds'
  | 'fishing' | 'boat' | 'orchard' | 'tree' | 'upgrades' | 'kitchen' | 'irrigation' | 'dock-project' | 'harbor' | 'specialize' | 'hive' | 'guest' | 'cape-upgrade' | 'honey-kitchen' | 'workshop' | 'cookery' | 'village-project' | 'village' | 'village-meal' | 'recipes' | 'signature' | 'cove'
  | 'intents' | 'intent' | 'neighbor' | 'request-food' | 'arrangement' | 'shoal' | 'grove-display'

const transplantSelection = new BedTransplantSelection()
const berryNurserySelection = new BerryNurserySelection()
const berryRenewalSelection = new BerryRenewalSelection()
const recipeSurplusSelection = new RecipeSurplusSelection()
let activeTool: Tool = 'seeds'
let hiveFlower: number | undefined
let panel: Panel | undefined
// Consume the successful sleep close once; ordinary close/back keeps its cue.
let committedRestClose = false
let celebratedFestival: FestivalTradition | undefined
let celebrationReceipt: {effect?:string; coins:number} | undefined
let treeSlot = 0
const ferryPeachPlanting = new FerryPeachPlanting()
let marketTab: 'buy' | 'sell' | 'orders' | 'projects' = 'buy'
let marketCategory:'seeds'|'trees'|'care'|'buildings'='seeds'
let marketSellGroup:'all'|'harvest'|'kitchen'|'shore'='all'
let marketSaleQuery = ''
let marketSaleFamily: string | undefined
const marketSaleBrowse = new MarketSaleBrowseMemory()
let selectedSale: (SaleTarget & { name: string; image?: string; trait?: Trait }) | undefined
const salePresentation = new SalePresentation()
const marketInlineSales = new MarketInlineSales(() => farm)
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
const gardenEditor = new GardenPlanEditor()
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
function rememberRecipeDraftFocus() {
  const draft = farm.recipeDraft
  // Switching the active portion can remember focus, but not replace a different composition.
  if (draft && draft.base === signatureBase && draft.activeSlot !== signatureSlot
    && JSON.stringify(draft.slots) === JSON.stringify(signatureSlots)) rememberCurrentRecipeDraft()
}

const recipeBook = new RecipeBookNavigation()
let expandedRepeatId:string|undefined
let cookingMode:'dish'|'signature'='dish'
const kitchenGroups = ['tart', 'preserves', 'dishes'] as const
type KitchenGroup = typeof kitchenGroups[number]
// Unset until a workbench opens; explicit selections and Back retain their own group.
type KitchenSelection = KitchenGroup | { ready?: DishId; returned?: boolean; guidedFrom?: KitchenSelection }
let kitchenGroup: KitchenSelection | undefined
let kitchenDish: DishId = 'grilledFish'
let honeyKitchenDish: HoneyKitchenRecipe = 'honeyBiscuits'
let pickedHoneyKitchenDish: HoneyKitchenRecipe = honeyKitchenDish
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
let freshFinnRide:string|undefined
let selectedFriendHen = 0
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
      // Keep the neighbour shortcut across meetings, but never carry the previous meeting’s recipe.
      if (current && typeof selection.food === 'string' && (request.kind !== 'neighbor' || request.planId === current.id)) {
        requestedFood = getIntentOffers(farm, current.intentId).find(offer => offer.id === selection.food && offer.eligible)?.id
      }
    }
  }
} catch { /* A stale menu selection never prevents loading the farm. */ }
const requirementLinks = new Map<string, Requirement>()

function requirementLink(content: string, requirement: Requirement, className: string, name: string, ready = false, description = '', presentation?: {key:string;label:string}) {
  if (ready) return `<li class="${className}" data-ready="true">${content}</li>`
  const key = presentation?.key ?? String(requirementLinks.size)
  requirementLinks.set(key, requirement)
  const recipeIngredient = panel === 'recipes' && requirement.kind === 'stock'
    ? ` data-recipe-ingredient="${bayProductId(requirement.item)}"` : ''
  const nursery = requirement.kind === 'stock' && getBerryNurserySource(farm, requirement.item) !== undefined
    ? `<button class="nursery-preserve" type="button" data-action="berry-nursery-ingredient" data-value="${key}" aria-label="Сохранить разновидность: ${name}">Сохранить разновидность</button>` : ''
  return `<li class="requirement-slot"><button type="button" class="${className} requirement-link" data-ready="false" data-action="show-requirement" data-value="${key}"${recipeIngredient} aria-label="${presentation?.label ?? `Где найти: ${name}`}"${description ? ` aria-describedby="requirement-source-${key}"` : ''}>${content}${description ? `<small id="requirement-source-${key}">${escapeHtml(description)}</small>` : ''}</button>${nursery}</li>`
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
    <button class="garden-mode" type="button" data-panel="garden-plans" hidden></button>
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
          <span class="slot-icon">${icon(id === 'basket' ? basketHotbarIcons[farm.island] : `tool-${image}`)}</span><kbd class="slot-key" aria-hidden="true">${key}</kbd><span class="slot-count" id="slot-count-${id}" hidden></span>
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
const stackedMarketOrders = window.matchMedia('(max-width: 600px)')
const portraitView = window.matchMedia('(max-width: 680px) and (orientation: portrait)')
const fieldLayout = window.matchMedia(`${portraitView.media}, (max-width: 900px) and (max-height: 600px) and (orientation: landscape)`)
const numberFormat = new Intl.NumberFormat('ru-RU')
let toastTimer: number | undefined
let dialogFeedbackTimer:number|undefined
let fieldHintCache: { key: string; value: ReturnType<typeof readFieldHintBands> } | undefined

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
  fieldHintCache = undefined
  updateCommunityReturn()
  const tool = tools.find(({ id }) => id === activeTool)!
  const goal = currentTask()
  const bookmarkOnly = !!goal && 'bookmarkOnly' in goal && goal.bookmarkOnly
  taskCard.hidden = farm.discoveryPreferences.quiet
  const atHome = farm.island === 'home'
  const sowingPlan = activeGardenPlan(farm)
  const modeBadge = app.querySelector<HTMLButtonElement>('.garden-mode')!
  modeBadge.hidden = !atHome || !sowingPlan
  if (atHome && sowingPlan) modeBadge.dataset.plan = `${farm.gardenPlans.revision}:${farm.gardenPlans.active}`
  else delete modeBadge.dataset.plan
  modeBadge.textContent = sowingPlan ? `План: ${sowingPlan.name}` : ''
  modeBadge.title = sowingPlan ? `Посев по плану «${sowingPlan.name}». Открыть планы огорода` : ''
  const taskArt = taskCard.querySelector<HTMLImageElement>('.task-medallion .icon')!
  const taskSource = iconUrl(goal && 'icon' in goal ? goal.icon : farm.island === 'cape' ? 'ui-honey' : farm.island === 'village' ? 'ui-bea' : 'carrot')
  if (taskArt.getAttribute('src') !== taskSource) taskArt.src = taskSource
  const counts: Partial<Record<Tool, number>> = {
    seeds: atHome && sowingPlan ? undefined : farm.seeds[farm.selectedSeed],
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
  textAt('status-seed', sowingPlan && atHome ? `Посев по плану: ${sowingPlan.name}` : `Семена: ${cropDefinitions[farm.selectedSeed].name.toLowerCase()}`)
  textAt('status-tool', activeTool === 'basket' ? basketHotbarLabels[farm.island] : tool.label)

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
    const capeFlowers = farm.island === 'cape' && toolId === 'seeds'
    const label = capeFlowers ? 'Клумбы мыса' : toolId === 'basket' ? basketHotbarLabels[farm.island] : atVillage && toolId === 'coop' ? 'Соседи' : definition.label
    const homeOnly = (farm.island === 'grove' && !('inGrove' in definition)) || (farm.island === 'cape' && toolId === 'coop')
    const title = toolId === 'seeds' && !capeFlowers ? atHome && sowingPlan ? `Посев по плану: ${sowingPlan.name}` : `${label} · ${cropDefinitions[farm.selectedSeed].name}` : label
    button.setAttribute('aria-label', label)
    button.title = homeOnly ? `${title} · Родной остров` : `${title} (${definition.key})`
    if (homeOnly) button.removeAttribute('aria-keyshortcuts')
    else button.setAttribute('aria-keyshortcuts', definition.key)
    const image = button.querySelector<HTMLImageElement>('.slot-icon img')!
    const source = iconUrl(toolId === 'basket' ? basketHotbarIcons[farm.island] : atVillage && toolId === 'coop' ? 'ui-bea' : `tool-${definition.image}`)
    if (image.getAttribute('src') !== source) image.src = source
    button.disabled = homeOnly || farm.island === 'cape' && toolId === 'rod'
    const count = capeFlowers ? undefined : counts[toolId]
    const badge = button.querySelector<HTMLElement>('.slot-count')!
    if (toolId === 'basket' && atHome) {
      button.removeAttribute('aria-pressed')
      button.setAttribute('aria-haspopup', 'dialog')
    } else {
      button.setAttribute('aria-pressed', String(!homeOnly && toolId === activeTool))
      if (toolId === 'basket') button.removeAttribute('aria-haspopup')
    }
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
  'recipe-surplus': 'Припасы для рецепта',
  'berry-renewal':'Свой ягодник', 'berry-nursery':'Размножить ягодный куст', 'shop-commissions':'Заказы лавки', 'music-supplies':'Материалы музыки', festival:'Праздники гавани', 'bay-shop':'Своя лавка', 'bay-freight':'Паром «Ласточка»', 'bay-music':'Музыкальный сад',
  market: 'Рынок',
  inventory: 'Запасы',
  archive: 'Коллекции',
  'grove-display': 'Витрина бухты',
  settings: 'Настройки',
  journal: 'Дневник',
  coop: 'Курятник',
  'chicken-feed': 'Корм для стаи',
  'garden-plans': 'Свои планы огорода',
  'neighbor-visits': 'Гостевая книга',
  'hen-friendship': 'Дружба со стаей',
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
  'garden-plans': 'field',
  'neighbor-visits': 'ui-bea',
  'hen-friendship': 'tool-hen',
  'warehouse-supply': 'ui-bag',
  transplant: 'tool-seeds',
  sale: 'ui-market',
  'recipe-surplus': 'ui-bag',
  'berry-renewal':'ui-seed-strawberry', 'berry-nursery':'ui-seed-blueberry', 'shop-commissions':'ui-signature-bright', 'music-supplies':'bay/music-harp', festival:'festivals/lights', 'bay-shop':'ui-market', 'bay-freight':'tool-boat', 'bay-music':'bay/music-harp',
  market: 'ui-market', inventory: 'ui-bag', archive: 'orchard', 'grove-display': 'orchard', settings: 'gear', journal: 'star', coop: 'tool-hen',
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

function firstGroveCatchOrder() {
  if (farm.island !== 'home' && (farm.island !== 'grove' || !canSailTo(farm, 'home'))) return
  if (farm.orders.grove.completed !== 0) return
  const order = getMarketOrders(farm).find(order => order.lane === 'grove')
  if (order?.status !== 'ready' || order.items.length !== 2
    || !order.items.some(item => item.kind === 'fish' && item.item === 'seaBass' && item.quantity === 1)
    || !order.items.some(item => item.kind === 'seaSalt' && item.quantity === 1)) return
  return { lane:order.lane, reward:order.reward, token:`${farm.day}:${order.lane}:${order.reward}` }
}

function inventoryStockRow(listing: ReturnType<typeof goods>[number] & { groveCatch?: ReturnType<typeof firstGroveCatchOrder> }): string {
  const { image, name, count, trait, item, key, price, groveCatch } = listing
  const identified = (html:string) => html.replace(/^<li\b[^>]*>/, tag => tag.replace(/>$/, ` data-stock-key="${key}" data-stock-count="${count}">`))
  if(item.kind==='eggBaskets'||item.kind==='eggCrates'){
    const kind=item.kind==='eggBaskets'?'basket':'crate',action=getEggUnpackAction(farm,kind)
    return identified(row(image,name,`×${count}`,button(farm.island==='home'?`Распаковать · +${action.eggs}`:'Распаковать дома',kind==='basket'?'unpack-egg-basket':'unpack-egg-crate',action.available,{secondary:true}),trait))
  }
  if(item.kind!=='fish')return identified(row(image,name,`×${count}`,'',trait))
  const review = item.item === 'seaBass' && groveCatch
    ? button(`${farm.island === 'home' ? 'К заказу' : 'На рынок домой'} · ${groveCatch.reward}`,'first-grove-catch-review',true,{value:groveCatch.token,secondary:true}) : ''
  return identified(row(image,name,`×${count} · ${fishSource(item.item)}`,button('На гриль','fish-kitchen',true,{value:item.item})+button(`Продать 1${farm.island==='home'?'':' дома'} · ${price}`,farm.island==='home'?'sell-item':'fish-market',true,{value:key,secondary:true})+review))
}

function inventorySupplies() {
  const stock = goods().filter(({count,group})=>count>0&&group===inventoryGroup)
  const groveCatch = inventoryGroup === 'shore' ? firstGroveCatchOrder() : undefined
  const tabs = panelTabs('inventory-group',inventoryGroup,[['harvest','Ферма'],['kitchen','Кухня'],['shore','Берег']], 'Продукты')
  const contents = inventoryGroup==='harvest'
    ? renderHarvestStocks(stock,itemIcon,inventoryStockRow,
      row('tool-feed', 'Корм для кур', quantity(farm.feed, 'порция')),
      treeIds.filter(tree=>farm.saplings[tree]>0).map(tree=>row('ui-tree-'+tree,treeDefinitions[tree].saplingName,`×${farm.saplings[tree]}`)).join(''))
    : `<ul class="dialog-list inventory-stock">${inventoryGroup==='kitchen'?row('ui-signature-bright','Мои рецепты',`×${Object.values(farm.culinary.stock).reduce((sum,count)=>sum+count,0)}`,button('Открыть','open-panel',true,{value:'recipes'})):''}${(groveCatch ? stock.map(listing=>inventoryStockRow({...listing,groveCatch})) : stock.map(inventoryStockRow)).join('')}${inventoryGroup==='shore'&&!stock.length?'<li class="dialog-status">Пока пусто</li>':''}</ul>`
  return `<section class="inventory-supplies" aria-label="Припасы"><div class="inventory-supplies-tabs">${tabs}</div>${farm.island==='home'&&inventoryGroup==='harvest'?`<div class="inventory-use">${button('На кухню','kitchen',true,{secondary:true})}</div>`:''}${contents}</section>`
}

function specializationCards() {
  const choice = previewSpecialization ? branchDefinitions[previewSpecialization] : undefined
  const houseChoice = previewSpecialization === 'bakery' || previewSpecialization === 'preserves'
    ? getFarmhouseSpecializationAction(farm, previewSpecialization) : undefined
  const firstHouseChoice = specializationBuilding === 'farmhouse' && farm.island === 'home'
    && farm.buildingLevels.farmhouse === 2 && !farm.farmhouseSpecialization
  return `<p class="coin-balance">${icon('coin')} ${numberFormat.format(farm.coins)}<span class="sr-only"> ${ruPlural(farm.coins, ['монета','монеты','монет'])}</span></p>
    <div class="specialization-grid">${branchChoices[specializationBuilding].map((id) => {
      const definition = branchDefinitions[id]
      const houseBranch = id === 'bakery' || id === 'preserves'
      const [image, benefit] = houseBranch
        ? [dishIcons[specializationDefinitions[id].dish], dishDefinitions[specializationDefinitions[id].dish].name]
        : facilityDetails[id]
      const order = houseBranch ? getFirstFarmhouseOrderPreview(farm, id) : undefined
      const path = specializationStages[id].mask.path
      return `<button class="specialization-option" type="button" data-action="preview-specialization" data-value="${id}"
        aria-pressed="${id === previewSpecialization}"${id === previewSpecialization && (id === 'hatchery' || id === 'packing') ? ' aria-describedby="coop-first-order"' : ''}>
        <img class="specialization-preview" src="${import.meta.env.BASE_URL}art/${path}.webp" alt="" draggable="false">
        <strong>${definition.name}</strong>
        ${order ? `<span>Первый заказ: «${order.name}» · ${quantity(order.reward, 'монета')}</span>
          <span>${icon(image)}${order.items.map(item => `${stockLabel(item).name} ×${numberFormat.format(item.quantity)}`).join(' · ')}</span>`
          : `<span>${icon(image)}${benefit}</span>${houseBranch && hasFarmhouseSpecialization(farm, id) ? '<span>Уже освоено</span>' : ''}`}
      </button>`
    }).join('')}</div>
    ${specializationBuilding !== 'farmhouse' ? previewSpecialization && previewSpecialization !== 'bakery' && previewSpecialization !== 'preserves'
      ? renderFacilityChoiceDetails(farm,previewSpecialization) : '<p class="facility-choice-help">Выберите карточку, чтобы прочитать условия. Просмотр вариантов бесплатный.</p>' : ''}
    <footer class="specialization-footer"><p>${specializationBuilding === 'farmhouse'
      ? firstHouseChoice && houseChoice?.available !== false ? 'Первое направление задаёт заказы. Второе можно освоить позже.'
        : houseChoice?.label ?? 'Освойте направление кухни. Позже можно изучить второе, сохранив прежние рецепты и заказы.'
      : 'После постройки направление нельзя сменить или добавить второе.'}</p>
      ${button(specializationBuilding==='farmhouse'?'Освоить':'Построить', 'build-specialization', houseChoice?houseChoice.available:choice !== undefined && farm.coins >= choice.price,
        choice ? { value: previewSpecialization, context: `${choice.name}, ${quantity(choice.price, 'монета')}`,
          cost: { icon: 'coin', amount: choice.price } } : {})}</footer>`
}

function flockFeedRow(alternate = '') {
  return row('tool-feed', 'Корм для кур', farm.chickensFed ? 'Сегодня накормлены' : 'Корм к утренней кладке', farm.chickensFed ? ''
    : farm.feed > 0 ? button('Покормить', 'feed')
      : button('Купить корм', 'buy-feed', farm.coins >= feedBagPrice, {cost:{icon:'coin',amount:feedBagPrice}})
        + (panel === 'rest' && canMixBedtimeFeed(farm) ? button('Смешать из урожая', 'chicken-feed-open', true, {secondary:true}) : alternate))
}

function seedCards() {
  return renderSeedPicker(farm, previewSeed, seedPickerBed, {icon, button}, renderGardenMode(farm, false, !seedChoice(farm, previewSeed, seedPickerBed).manualBed), (farm.island === 'home' ? nav(button('Свои планы огорода', 'open-panel', true, {value:'garden-plans', secondary:true}),button('Пересадить культуру', 'open-panel', true, {value:'transplant', secondary:true}),button('Размножить ягодный куст','open-panel',true,{value:'berry-nursery',secondary:true}),button('Свой ягодник','open-panel',true,{value:'berry-renewal',secondary:true})) : ''))
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
  const source = item.kind === 'fruit' && panel === 'kitchen' && farm.island === 'home' && ingredientCount(farm, item) < item.quantity
    ? getRequirementHint(farm, {kind:'stock',item}, 'home-kitchen').sourceLabel
    : item.kind === 'variants' && panel === 'recipes' ? getRequirementHint(farm,{kind:'stock',item}).sourceLabel : undefined
  return stockTileWithSource(item,source)
}
function stockTileWithSource(item: StockItem, source = '') {
  const stock = ingredientCount(farm, item)
  const label = stockLabel(item)
  const resource = item.kind === 'produce' || item.kind === 'fruit' ? item.item : item.kind === 'eggs' ? 'egg' : undefined
  const specialStock = resource !== undefined && Object.values(farm.variants[resource] ?? {}).some(count => count > 0)
  const name = stock < item.quantity && specialStock ? `${label.name} (обычный урожай)` : label.name
  const image = label.image
  return requirementLink(`${icon(image)}<span>${name}</span><strong>${stock}/${item.quantity}</strong>`, {kind:'stock',item}, 'ingredient', `${name}, ${stock} из ${item.quantity}`, stock >= item.quantity, source)
}

function recipeDestination(dish: DishId) {
  if (dishDefinitions[dish].capeLevel) return 'cape' as const
  return farm.island === 'village' && farm.village.built ? 'village' as const : 'home' as const
}

function recipeCards(recipes: readonly DishId[], returnedDish?: DishId) {
  return `<div class="recipe-list">${recipes.map((dish) => {
    const recipe = dishDefinitions[dish]
    const destination = recipeDestination(dish)
    const action = getCookAction(farm, dish, cookingFish)
    const ingredients = getCookIngredients(farm, dish, cookingFish)
    const rawValue = ingredients.reduce((sum,item)=>sum+item.quantity*unitPrice(item,farm),0)
    const fishChoices = dish === 'grilledFish' ? `<div class="recipe-fish-choices" role="group" aria-label="Рыба для гриля">${fishIds.map(id=>`<button type="button" data-action="grill-fish" data-value="${id}" aria-pressed="${cookingFish===id}" aria-label="${fishDefinitions[id].name}, в наличии ${farm.fish[id]}" title="${fishDefinitions[id].name}">${icon(fishImage(id))}<span>×${farm.fish[id]}</span></button>`).join('')}</div>` : ''
    const locked = recipe.capeLevel ? farm.capeLevel < recipe.capeLevel : farm.buildingLevels.farmhouse < recipe.requiredLevel || !!recipe.specialization && !hasFarmhouseSpecialization(farm, recipe.specialization)
    const missing = !locked && dish === 'grilledFish' && farm.island === 'home' ? ingredients.filter(item => ingredientCount(farm,item) < item.quantity) : []
    const salt = missing.length === 1 && missing[0].kind === 'seaSalt' ? missing[0] : undefined
    const route = salt && getRequirementHint(farm, {kind:'stock',item:salt}).action
    const source = route?.target === 'warehouse-supply' ? 'На местном складе' : route?.target === 'sail' && route.value === 'grove' ? 'Плыть в Солёную рощу' : ''
    return `<section class="recipe${locked ? ' recipe-locked' : ''}">
      <header class="recipe-summary">${icon(dishIcons[dish], 'recipe-art')}<div><h2${dish === returnedDish ? ' data-kitchen-return-dish tabindex="-1"' : ''}>${recipe.name}</h2>
        <p class="recipe-value" title="Стоимость ингредиентов → цена блюда">${icon('tool-crate')} <span class="sr-only">Сырьё: </span>${rawValue} <span aria-hidden="true">→</span> ${icon('coin')} <span class="sr-only">Блюдо: </span><strong>${recipe.sellPrice}</strong></p></div></header>
      ${fishChoices}${locked ? '' : `<ul class="ingredients">${ingredients.map(item => item === salt && source ? stockTileWithSource(item,source) : stockTile(item)).join('')}</ul>`}
      ${locked ? `<p class="recipe-reason">${action.label}</p>${button('Улучшения','upgrades',true,{secondary:true})}`
        : farm.island !== destination ? button(destination === 'cape' ? 'На Цветочный мыс' : 'На кухню', 'sail', canSailTo(farm, destination), {value:destination}):button('Готовить', 'cook', action.available, { value: dish, context: recipe.name })}</section>`
  }).join('')}</div>`
}

function kitchenReadyDishes() {
  const ready = dishIds.filter(dish => getCookAction(farm, dish, cookingFish).available)
  return farm.island === 'home' ? ready : ready.slice(0, 3)
}

function kitchenFamilies() {
  // KitchenSelection is local navigation, never saved to the farm. A landing
  // visit follows live stock; an explicitly browsed category stays put on Back.
  const landing = farm.island === 'home' && typeof kitchenGroup === 'object' ? kitchenGroup : undefined
  const origin = panelHistory.at(-1)
  const festivalJam = farm.island === 'village' && origin?.panel === 'festival' && typeof kitchenGroup === 'object'
    && 'guidedFrom' in kitchenGroup && kitchenGroup.ready === 'appleJam' ? kitchenGroup.ready : undefined
  const cottage = kitchenGroup === undefined && farm.island === 'village' && farm.village.built && origin?.panel === 'village' ? origin : undefined
  const cottageChoice = cottage?.cottageKitchenShelf
  const available = farm.island === 'home' || cottageChoice ? kitchenReadyDishes() : []
  const ready = landing || cottageChoice ? available : []
  const showReadyTab = farm.island === 'home' && available.length > 1
  // Keep a spent Home recipe only on its cooking return. The existing ready
  // shelf can offer what's left without changing the user's selection.
  const spentHomeChoice = landing?.returned && landing.ready && !getCookAction(farm,landing.ready,cookingFish).available ? landing.ready : undefined
  const picked = festivalJam ?? cottage?.cottageKitchenDish ?? cottageChoice ?? spentHomeChoice ?? ready.find(dish => dish === landing?.ready) ?? ready[0]
  const readyShelf = (ready.length > 1 || !!spentHomeChoice && ready.length > 0) && (!cottageChoice || ready.includes(cottageChoice))
  const group = readyShelf ? 'ready' : picked
    ? isTartDish(picked) ? 'tart' : picked === 'appleJam' || picked === 'orchardPreserves' ? 'preserves' : 'dishes'
    : typeof kitchenGroup === 'string' ? kitchenGroup : 'tart'
  const tart = picked && isTartDish(picked) ? picked : kitchenTart
  const preserves = picked === 'appleJam' || picked === 'orchardPreserves' ? picked : kitchenPreserves
  const labels = { tart: 'Тарты', preserves: 'Варенье', dishes: 'Блюда', ready: 'Можно приготовить' }
  const tabs = (showReadyTab ? ['ready',...kitchenGroups] as const : kitchenGroups).map(id => `<button type="button" class="dialog-button${group === id ? '' : ' secondary'}" data-action="kitchen-group" data-value="${id}" aria-pressed="${group === id}">${labels[id]}</button>`).join('')
  const familyChoices = (group: KitchenGroup | 'ready', selected: string, choices: readonly { id: string; image: string; name: string; short?:string }[], extra = '') => `<div class="recipe-family-choices kitchen-menu-choices" role="group" aria-label="${labels[group]}">${group === 'ready' && !showReadyTab ? `<strong class="kitchen-ready-heading" aria-hidden="true">${labels.ready}</strong>` : ''}${choices.map(choice => `<button type="button" data-action="recipe-family" data-family="${group}" data-value="${choice.id}" aria-pressed="${selected === choice.id}" aria-label="${choice.name}" title="${choice.name}">${icon(choice.image)}<span>${choice.short ?? choice.name}</span></button>`).join('')}${extra}</div>`
  const otherDishes = dishIds.filter(dish => !isTartDish(dish) && dish !== 'appleJam' && dish !== 'orchardPreserves' && !dishDefinitions[dish].capeLevel && (dish !== 'honeyCake' || canSailTo(farm, 'cape')) && (!dishDefinitions[dish].specialization || hasFarmhouseSpecialization(farm, dishDefinitions[dish].specialization!)))
  const other = otherDishes.find(dish => dish === (picked ?? kitchenDish)) ?? otherDishes[0]
  const choices = readyShelf && picked ? familyChoices('ready', picked, ready.map(id => ({ id, image: dishIcons[id], name: dishDefinitions[id].name }))) : group === 'tart'
    ? familyChoices('tart', tart, [
      { id: 'orchardTart', image: dishIcons.orchardTart, name: 'Яблочный пирог', short:'Яблоко' },
      { id: 'strawberryTart', image: dishIcons.strawberryTart, name: 'Клубничный тарт', short:'Клубника' },
      { id: 'blueberryTart', image: dishIcons.blueberryTart, name: 'Черничный тарт', short:'Черника' },
      { id: 'raspberryTart', image: dishIcons.raspberryTart, name: 'Малиновый тарт', short:'Малина' },
      { id: 'mixed', image: 'ui-tart', name: 'Ягодный тарт: выбрать сочетание', short:'Смесь ягод' }
    ], tart === 'orchardTart' ? button('Выбрать фрукты','new-signature',true,{value:'tart',secondary:true}) : '') : group === 'preserves'
      ? familyChoices('preserves', preserves, [
        { id: 'appleJam', image: dishIcons.appleJam, name: 'Яблочное варенье', short:'Яблочное' },
        { id: 'orchardPreserves', image: dishIcons.orchardPreserves, name: 'Садовый конфитюр', short:'Конфитюр' },
        { id: 'custom', image: 'ui-signature-bright', name: 'Варенье: выбрать фрукты', short:'Своя смесь' }
      ])
      : familyChoices('dishes', other, otherDishes.map(id=>({ id, image:dishIcons[id], name:dishDefinitions[id].name })))
  const recipe = picked ? recipeCards([picked],spentHomeChoice) : group === 'tart'
    ? kitchenTart === 'mixed' ? `<section class="recipe kitchen-custom"><h2>Ягодный тарт</h2>${button('Выбрать ягоды', 'family-signature', true, { value: 'berries' })}</section>` : recipeCards([kitchenTart])
    : group === 'preserves'
      ? kitchenPreserves === 'custom' ? `<section class="recipe kitchen-custom"><h2>Фруктовое варенье</h2>${button('Выбрать фрукты', 'family-signature', true, { value: 'preserves' })}</section>` : recipeCards([kitchenPreserves])
      : recipeCards(other ? [other] : [])
  const browse = `<nav class="kitchen-menu-tabs panel-tabs${showReadyTab ? ' kitchen-menu-tabs-ready' : ''}" aria-label="Разделы кухни">${tabs}</nav>
    <div class="kitchen-menu-book">${button('Мои рецепты','open-panel',true,{value:'recipes',secondary:true})}</div>`
  const bench = choices + `<div class="kitchen-menu-recipe">${recipe}</div>`
  return readyShelf ? `<div class="kitchen-workbench kitchen-ready-workbench">${bench}${browse}</div>`
    : `<div class="kitchen-workbench">${browse}${bench}</div>`
}
function familyRecipeName(draft: SignatureDraft, family: typeof signatureFamily): string | undefined {
  if (!family) return undefined
  const fruits = [...new Set(draft.ingredients.map(part => part.id))]
  const berry = fruits.every(id => ['strawberry', 'blueberry', 'raspberry'].includes(id))
  const names = draft.base === 'tart' ? { apple: 'Яблочный тарт', pear: 'Грушевый тарт', peach: 'Персиковый тарт', strawberry: 'Клубничный тарт', blueberry: 'Черничный тарт', raspberry: 'Малиновый тарт' }
    : { apple: 'Яблочное варенье', pear: 'Грушевый конфитюр', peach: 'Персиковое варенье', strawberry: 'Клубничное варенье', blueberry: 'Черничное варенье', raspberry: 'Малиновое варенье' }
  return fruits.length === 1 ? names[fruits[0]] : draft.base === 'tart' ? berry ? 'Ягодный тарт' : 'Фруктовый тарт' : berry ? 'Ягодное варенье' : 'Фруктовый конфитюр'
}

function marketOrderStockTile(item: StockItem, pickup?: number) {
  const stock = ingredientCount(farm, item), label = stockLabel(item)
  const resource = item.kind === 'produce' || item.kind === 'fruit' ? item.item : item.kind === 'eggs' ? 'egg' : undefined
  const specialStock = resource !== undefined && Object.values(farm.variants[resource] ?? {}).some(count => count > 0)
  const name = stock < item.quantity && specialStock ? `${label.name} (обычный урожай)` : label.name
  return requirementLink(`${icon(label.image)}<span class="order-item-name">${name}</span><strong class="order-item-needed">Нужно: ${item.quantity}</strong><small class="order-item-stock">В запасе: ${stock}${pickup ? ` · со склада +${pickup}` : ''}</small>`,
    {kind:'stock',item}, 'ingredient order-requirement', `${name}, нужно ${item.quantity}, в запасе ${stock}${pickup ? `, со склада ещё ${pickup}` : ''}`, stock >= item.quantity)
}

let selectedMarketOrder: string | undefined
let pickedMarketOrder: string | undefined
function marketOrders() {
  const board = getMarketOrderBoard(farm, selectedMarketOrder)
  selectedMarketOrder = board.selected
  const order = board.order
  const next = getNextMarketOrders(farm).find(order => order.lane === board.selected)
  const warehouse = board.choices.find(choice=>choice.id===board.selected)?.warehouseRequest
  const pickup = board.pickup
  const detail = board.selected === 'harbor' ? `<p class="market-order-location">Причал рощи · можно вносить частями</p>${harborCard(true)}` : order
    ? `<section class="market-order" data-status="${order.status}" aria-labelledby="order-${order.lane}">
      <header class="order-header"><h2 id="order-${order.lane}">${order.name}</h2>
        <span class="order-reward"><small>Награда</small><span>${icon('coin')} ${numberFormat.format(order.reward)}<span class="sr-only"> ${ruPlural(order.reward, ['монета','монеты','монет'])}</span></span></span></header>
      ${order.status === 'delivered' ? `<p class="order-done">✓ Сегодня доставлено</p>${next ? renderNextMarketOrder(next,marketOrderStockTile)+button('К отдыху дома', 'market-next-rest', true, {secondary:true,value:String(farm.day)}) : ''}`
        : `<ul class="ingredients order-items">${order.items.map(item => marketOrderStockTile(item, pickup?.lines.find(line => line.item === item)?.supply.quantity)).join('')}</ul>
          ${order.status === 'upgrade' ? button('Улучшить дом', 'upgrades', true, { secondary: true })
            : pickup ? button('Забрать со склада', 'market-order-pickup', true, {value:pickup.token,context:order.name})
            : warehouse ? button('К домашнему складу', 'warehouse-supply', true, {value:warehouse,context:order.name})
            : button('Доставить', 'deliver-order', order.status === 'ready', { value: order.lane, context: order.name })}`}
    </section>` : ''
  return `<div class="market-orders-workspace">${renderMarketOrderPicker(board,icon)}<div class="market-order-detail" tabindex="-1" role="region" aria-labelledby="${board.selected==='harbor'?'harbor-order':`order-${board.selected}`}">${detail}</div></div>
    <details class="market-orders-timing"><summary>Когда появится следующий заказ</summary><p>После доставки следующий заказ появится после отдыха дома. Несданные заказы не сгорают от сна.</p></details>`
}

function deliveryItems(items: ReturnType<typeof getProject>['items'], explicit = false,
  contributions?: ReadonlyMap<string, { token: string; available: number }>) {
  return items.map(({ item, delivered, available }) => {
    const { name, image } = stockLabel(item)
    const contribution = contributions?.get(marketKey(item))
    if (contribution) return `<li class="requirement-slot"><button type="button" class="ingredient requirement-link" data-action="village-supply-pledge" data-value="${contribution.token}" aria-label="Внести: ${name} ×${contribution.available}">${icon(image)}<span>${name}</span>
      <strong><span class="sr-only">Доставлено </span>${delivered}/${item.quantity}</strong><span class="project-available">Внести ×${contribution.available}</span></button></li>`
    if (explicit) {
      const copy = projectContributionCopy({ item, delivered, available })
      return requirementLink(`${icon(image)}<span>${name}</span><strong class="project-fair-count">${copy.delivered}</strong><span class="project-fair-contribution${available ? ' is-available' : ''}">${copy.available}</span>`, available >= item.quantity-delivered ? {kind:'delivery'} : {kind:'stock',item:{...item,quantity:item.quantity-delivered}}, 'ingredient', `${name}, ${copy.delivered}, ${copy.available}`, delivered === item.quantity)
    }
    // The construction card and island checklist share the same source for this exact roll.
    const missing: Requirement = contributions && item.kind === 'handmade' && item.item === 'round'
      ? {kind:'journey',island:'village',id:'supply-handmade'}
      : {kind:'stock',item:{...item,quantity:item.quantity-delivered}}
    return requirementLink(`${icon(image)}<span>${name}</span>
      <strong><span class="sr-only">Доставлено </span>${delivered}/${item.quantity}</strong>
      ${available ? `<span class="project-available">+${available}<span class="sr-only"> в наличии</span></span>` : ''}`, available >= item.quantity-delivered ? {kind:'delivery'} : missing, 'ingredient', name, delivered === item.quantity)
  }).join('')
}

function harborCard(fromMarket = false) {
  const order = getHarborOrder(farm)
  if (!order) return ''
  const withdrawal=getHarborWithdrawal(farm)
  const next=getNextHarborOrder(farm)
  const route=fromMarket ? readyHarborOrderRoute(farm,order) : undefined
  return `<section class="market-order project-card" aria-labelledby="harbor-order">
    <header class="order-header"><h2 id="harbor-order">${order.name}</h2>
      <span class="order-reward">${icon('coin')} ${order.reward}<span class="sr-only"> ${ruPlural(order.reward, ['монета','монеты','монет'])}</span></span></header>
    <ul class="ingredients project-items">${deliveryItems(order.items)}</ul>
    ${order.status === 'completed' ? `<p class="order-done">✓ Доставлено</p>${next ? renderNextHarborOrder(next,stockTile)+button('К отдыху дома','harbor-next-rest',true,{secondary:true,value:String(farm.day)}) : ''}`
      : route ? button('К заказу в роще','harbor-order-route',true,{value:route})
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
      const level = projectLevelCopy(farm.buildingLevels[building])
      return requirementLink(`${icon(`upgrade-${building}-card`)}<span>${buildingDefinitions[building].name}</span><strong>${level}</strong>`, {kind:'building',building}, 'ingredient', `${buildingDefinitions[building].name}, ${level}`, ready)
    }).join('')
    : deliveryItems(project.items, fair)
  const reward = fair ? `<span class="order-reward project-fair-reward"><small>${projectRewardLabel(project.status)}</small><span>${icon('coin')} ${project.reward}<span class="sr-only"> ${ruPlural(project.reward, ['монета','монеты','монет'])}</span></span></span>`
    : `<span class="order-reward">${icon('coin')} ${project.reward}<span class="sr-only"> ${ruPlural(project.reward, ['монета','монеты','монет'])}</span></span>`
  const away=farm.island!==(fair?'home':'grove')
  const benefit = fair
    ? (complete ? 'Кондитерская открыта. Урожай на рынке стоит на 1 монету дороже.' : 'Откроет кондитерскую и прибавит 1 монету к цене урожая на рынке.')
    : (complete ? `Теперь в роще можно поймать до ${getFishLimit(farm,'grove')} рыб за день. Раньше — ${fishDailyLimit}.` : `Откроет путь на Цветочный мыс. В роще можно будет ловить до ${fishDailyLimit+1} рыб за день вместо ${fishDailyLimit}.`)
  const action = !complete && away && !farm.boatOwned ? button('Как получить лодку','project-boat')
    : !complete&&away ? button(fair?'К стройке дома':'К причалу рощи','sail',farm.boatOwned,{value:fair?'home':'grove'}) : complete
    ? (!fair ? farm.island === 'grove' ? button('На Цветочный мыс','sail',true,{value:'cape'})
      : button('В рощу к причалу','sail',canSailTo(farm,'grove'),{value:'grove'}) : '')
    : project.status === 'locked' && fair
      ? button('Улучшения', 'upgrades', true, { secondary: true })
      : button('Внести припасы', 'deliver-project', project.status === 'ready', { value: id, context: project.name })
  return `<section class="market-order project-card${fair ? ' market-fair-readiness' : ''}" aria-labelledby="${fair ? 'project-fair' : 'dialog-title'}">
    ${fair ? `<header class="order-header"><h2 id="project-fair">${project.name}</h2>${reward}</header>` : ''}
    <p class="project-benefit">${complete ? '<b>✓ Построено</b> · ' : ''}${benefit}</p>
    ${complete ? '' : `<ul class="ingredients project-items">${requirements}</ul>`}
    ${fair || complete ? action : `<footer class="project-footer">${reward}${action}</footer>`}
  </section>`
}

function freshIrrigationMode(): typeof irrigationMode {
  if (farm.wellSpecialization !== 'pipes') return 'row'
  for (let index = 0; index < gardenRows - 1; index++) {
    if (getIrrigationPair(farm, index).available) return 'pair'
  }
  for (let index = 0; index < gardenRows; index++) {
    if (getIrrigationRow(farm, index).available) return 'row'
  }
  return 'pair'
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

function marketFamilyOptions(selected: string | undefined) {
  return marketSaleFamilies(goods(),selected).map(family=>`<option value="family:${family.id}"${selected===family.id?' selected':''}>${escapeHtml(family.label)} · ${family.rows} ${ruPlural(family.rows,['вид','вида','видов'])}</option>`).join('')
}
function marketSellView() {
  return { island: farm.island, group: marketSellGroup, family: marketSaleFamily, query: marketSaleQuery }
}
function marketSaleGridKey(grid: HTMLElement) {
  return JSON.stringify([marketSellView(), Array.from(grid.querySelectorAll<HTMLElement>('[data-inline-key]'), card => card.dataset.inlineKey)])
}
function marketBuySeedGridKey(grid: HTMLElement) {
  return JSON.stringify([farm.island, grid.clientWidth, grid.scrollHeight,
    Array.from(grid.querySelectorAll<HTMLElement>('[data-seed-pack]'), pack => pack.dataset.seedPack)])
}
function rememberClosedMarketSell() {
  if (!dialog.open || panel !== 'market' || marketTab !== 'sell' || salePresentation.place) return
  const grid = dialogContent.querySelector<HTMLElement>('#market-sale-results')
  if (grid) marketSaleBrowse.rememberClosed(marketSellView(), grid.scrollTop)
}
function selectMarketSaleGroup(group: typeof marketSellGroup) {
  if (panel !== 'market' || marketTab !== 'sell' || !dialog.open) return false
  closeContextualSale(false)
  const previous = { family: marketSaleFamily, scroll: dialogContent.querySelector<HTMLElement>('#market-sale-results')?.scrollTop ?? 0 }
  const next = marketSaleBrowse.change(marketSellGroup, group, previous)
  marketSaleBrowse.refineSearch()
  marketSellGroup = group; marketSaleFamily = next.family
  drawPanel()
  const results = dialogContent.querySelector<HTMLElement>('#market-sale-results')
  if (results) results.scrollTop = next.scroll
  // Keep the existing group-navigation focus and outer-shell position.
  dialogContent.scrollTop = 0
  return true
}
function resetMarketSaleBrowsePosition() {
  marketSaleBrowse.resetPositions()
  const results = dialogContent.querySelector<HTMLElement>('#market-sale-results')
  if (results) results.scrollTop = 0
}
function selectMarketFamily(value: string) {
  const id=value.startsWith('family:')?value.slice(7):undefined
  if(id&&!marketSaleFamilies(goods(),marketSaleFamily).some(family=>family.id===id))return false
  if(!id&&value!=='harvest')return false
  closeContextualSale(false);marketSaleBrowse.refineSearch();marketSellGroup='harvest';marketSaleFamily=id;drawPanel();dialogContent.scrollTop=0
  return true
}

function setMarketSaleQuery(query: string) {
  if (query === marketSaleQuery) return
  const grid = dialogContent.querySelector<HTMLElement>('#market-sale-results')
  if (query.trim()) {
    marketSaleBrowse.beginSearch(!marketSaleQuery.trim() && grid ? { key: marketSaleGridKey(grid), scroll: grid.scrollTop } : undefined)
  }
  const origin = !query.trim() ? marketSaleBrowse.finishSearch() : undefined
  closeContextualSale(false)
  marketSaleQuery = query
  updateMarketSaleSearch()
  resetMarketSaleBrowsePosition()
  if (origin && grid && marketSaleGridKey(grid) === origin.key) grid.scrollTop = origin.scroll
}
function marketSaleSearchView() {
  return searchMarketSaleView(goods(), marketSellGroup, marketSaleQuery, marketSaleFamily, marketSaleBrowse.crossCategorySearch)
}
function marketSaleSearchStatus() {
  const result = marketSaleSearchView()
  return result.wholeSearch ? `Поиск · Всё: ${result.items.length}` : `Товары: ${result.items.length} из ${result.total}`
}
function wholeInventorySaleView() {
  return marketSellGroup === 'all' && !marketSaleQuery.trim()
}
function marketBulkSaleControls() {
  if (!wholeInventorySaleView()) return ''
  const sale = getSale(farm)
  if (!sale.items) return ''
  const surplus = salePresentation.place ? undefined : getMarketOrderSurplusQuote(farm)
  const reserve = surplus?.includesWarehouse ? 'доступных заказов' : 'готовых заказов'
  return `<span>Всего: ${quantity(sale.items,'предмет')} · ${quantity(sale.coins,'монета')}</span>${button('Продать всё','sell',!salePresentation.place)}${surplus
    ? `<div class="market-order-surplus"><span>Оставить для ${reserve}: ${quantity(surplus.kept,'предмет')}</span>${button(
      `Продать остальное · ${quantity(surplus.total,'монета')}`,'sell-order-surplus',true,
      {value:escapeHtml(surplus.token), secondary:true, context:`останется для ${reserve}: ${quantity(surplus.kept,'предмет')}`})}</div>` : ''}`
}
function marketInlineCard(item: ReturnType<typeof goods>[number]) {
  const view=marketInlineSales.view(item.key,item.count,item.price), quote=view.quote, receipt=view.receipt
  // A single item has one quantity. Keep the editor only if an older draft needs correction.
  const showQuantity = item.count > 1 || (!receipt && !quote.valid)
  const id=`inline-sale-${encodeURIComponent(item.key)}`
  return `<li class="market-inline-card" data-inline-key="${escapeHtml(item.key)}" data-inline-token="${escapeHtml(view.token)}">
    <span class="market-inline-art" aria-hidden="true">${itemIcon(item.image,item.trait)}</span>
    <div class="market-inline-copy"><h2 class="market-inline-name" tabindex="-1">${escapeHtml(item.name)}</h2><p class="market-inline-stock">В запасе: ${item.count}</p><p class="market-inline-price"><span aria-hidden="true">${item.price}</span> ${icon('coin')} <span class="sr-only">${quantity(item.price,'монета')} </span>за штуку</p></div>
    <div class="market-inline-footer">${showQuantity ? `<div class="market-inline-stepper" role="group" aria-label="Количество: ${escapeHtml(item.name)}">
      <span class="market-step-limit" tabindex="-1" role="group" aria-label="Минимум: 1"><button type="button" data-action="inline-sale-step" data-value="${escapeHtml(item.key)}" data-step="less" aria-label="Уменьшить количество: ${escapeHtml(item.name)}"${receipt||view.pending||quote.valid&&quote.quantity<=1?' disabled':''}>−</button></span>
      <input data-inline-quantity type="number" min="1" max="${item.count}" step="1" inputmode="numeric" value="${escapeHtml(view.raw)}" aria-label="Количество: ${escapeHtml(item.name)}" aria-describedby="${id}"${receipt||view.pending?' disabled':''}>
      <span class="market-step-limit" tabindex="-1" role="group" aria-label="Максимум: ${item.count}"><button type="button" data-action="inline-sale-step" data-value="${escapeHtml(item.key)}" data-step="more" aria-label="Увеличить количество: ${escapeHtml(item.name)}"${receipt||view.pending||quote.valid&&quote.quantity>=item.count?' disabled':''}>+</button></span>
    </div>` : ''}<button type="button" class="market-inline-sell" aria-describedby="${id}" aria-label="${escapeHtml(receipt?`Продать ещё: ${item.name}`:quote.valid?`Продать ${quote.quantity}: ${item.name}, ${quantity(quote.total,'монета')}`:`Продать: ${item.name}`)}" data-action="${receipt?'inline-sale-again':'inline-sale-confirm'}" data-value="${escapeHtml(item.key)}"${view.pending||!receipt&&!quote.valid?' disabled':''}>${receipt?'Продать ещё':`Продать${quote.valid?` ${numberFormat.format(quote.quantity)} · ${numberFormat.format(quote.total)}`:' · —'} ${icon('coin')}`}</button></div>
    <p class="market-inline-status" id="${id}" role="status" aria-live="${receipt?'off':'polite'}">${receipt?escapeHtml(inlineReceiptText(receipt)):quote.valid?view.orderImpact:`Введите целое число от 1 до ${item.count}.`}</p>
  </li>`
}
function marketSaleResults() {
  const {items,total,wholeSearch} = marketSaleSearchView()
  if (!items.length) return `<p class="market-sale-search-empty">${total ? 'По этому запросу в выбранной группе ничего нет. Измените запрос или очистите поиск.' : 'В этой группе пока нет товаров для продажи.'}</p>`
  return `<ul class="market-inline-grid"${wholeSearch ? ' aria-label="Поиск · Всё"' : ''}>${items.map(marketInlineCard).join('')}</ul>`
}
function inlineSaleContext(control: Element) {
  if(island.isCrossing() || !dialog.open || panel!=='market' || marketTab!=='sell' || !dialogContent.contains(control))return
  const card=control.closest<HTMLElement>('[data-inline-key]'), key=card?.dataset.inlineKey
  const item=key&&goods().find(item=>item.key===key&&item.count>0)
  return card&&item ? {card,item,token:card.dataset.inlineToken} : undefined
}
function updateInlineSaleCard(card: HTMLElement) {
  const context=inlineSaleContext(card)
  if(!context)return
  const {item}=context, view=marketInlineSales.view(item.key,item.count,item.price), quote=view.quote
  card.dataset.inlineToken=view.token
  const input=card.querySelector<HTMLInputElement>('[data-inline-quantity]')
  if (input) { input.value=view.raw; input.max=String(item.count); input.disabled=Boolean(view.receipt||view.pending) }
  card.querySelectorAll<HTMLButtonElement>('[data-action="inline-sale-step"]').forEach(button=>button.disabled=Boolean(view.receipt||view.pending||quote.valid&&(button.dataset.step==='less'?quote.quantity<=1:quote.quantity>=item.count)))
  const sell=card.querySelector<HTMLButtonElement>('.market-inline-sell')!
  sell.dataset.action=view.receipt?'inline-sale-again':'inline-sale-confirm'
  sell.disabled=view.pending||!view.receipt&&!quote.valid
  sell.setAttribute('aria-label',view.receipt?`Продать ещё: ${item.name}`:quote.valid?`Продать ${quote.quantity}: ${item.name}, ${quantity(quote.total,'монета')}`:`Продать: ${item.name}`)
  sell.innerHTML=view.receipt?'Продать ещё':`Продать${quote.valid?` ${numberFormat.format(quote.quantity)} · ${numberFormat.format(quote.total)}`:' · —'} ${icon('coin')}`
  const status=card.querySelector<HTMLElement>('.market-inline-status')!
  // The dialog already announces a completed sale. Keep this persistent receipt readable, not a second live event.
  status.ariaLive=view.receipt?'off':'polite'
  status.textContent=view.receipt?inlineReceiptText(view.receipt):quote.valid?view.orderImpact:`Введите целое число от 1 до ${item.count}.`
}
function confirmInlineSale(control: Element, keyboard = false) {
  const context=inlineSaleContext(control)
  if(!context)return
  const {item,token}=context, quote=marketInlineSales.take(item.key,token,item.count,item.price)
  if(!quote){updateInlineSaleCard(context.card);return}
  const scroll=dialogContent.querySelector<HTMLElement>('#market-sale-results')?.scrollTop??0
  const position=keyboard && quote.remaining===0
    ? Array.from(dialogContent.querySelectorAll<HTMLElement>('[data-inline-key]')).indexOf(context.card) : -1
  const result=sellMarketItem(farm,item.key,quote.quantity)
  marketInlineSales.finish(item.key,result.ok?quote:undefined,result.goalRewardText)
  if(perform(()=>result,false,quote.remaining>0))playBaySound('trade.receive')
  const grid=dialogContent.querySelector<HTMLElement>('#market-sale-results');if(grid)grid.scrollTop=scroll
  const cards=Array.from(dialogContent.querySelectorAll<HTMLElement>('[data-inline-key]'))
  const next=cards.find(card=>card.dataset.inlineKey===item.key)
  let focus=next?.querySelector<HTMLElement>('.market-inline-sell')
  // Stay where the row disappeared without arming a different product's sale button.
  if (!next && result.ok && position>=0) focus=cards[Math.min(position,cards.length-1)]?.querySelector<HTMLElement>('.market-inline-name')
  if (!next && !focus && result.ok && quote.remaining===0 && marketSellGroup==='harvest' && marketSaleFamily) {
    const stock=goods()
    if (stock.some(row=>row.count>0) && searchMarketSales(stock,'harvest','',marketSaleFamily).total===0)
      focus=dialogContent.querySelector<HTMLElement>('[data-action="market-sell-group"][data-value="all"]')
  }
  focus??=dialogContent.querySelector<HTMLElement>('[data-market-sale-empty]') ?? dialogContent.querySelector<HTMLInputElement>('[data-market-sale-query]')
  focus?.focus({preventScroll:true})
  if(!next)focus?.scrollIntoView({block:'nearest',inline:'nearest'})
}
function updateMarketSaleSearch() {
  if (panel !== 'market' || marketTab !== 'sell' || !dialog.open) return
  const results = dialogContent.querySelector<HTMLElement>('#market-sale-results')
  const status = dialogContent.querySelector<HTMLElement>('.market-sale-search-status')
  const clear = dialogContent.querySelector<HTMLButtonElement>('[data-action="market-sale-clear"]')
  if (results) { results.innerHTML = marketSaleResults(); applyIngredientFinishes(results) }
  if (status) {status.textContent=marketSaleSearchStatus();status.classList.toggle('sr-only',!marketSaleQuery&&marketSellGroup==='all')}
  if (clear) clear.disabled = !marketSaleQuery
  const total=dialogContent.querySelector<HTMLElement>('.market-total')
  if(total){
    const bulk=marketBulkSaleControls()
    total.hidden=!bulk; total.innerHTML=bulk
    if(salePresentation.place)total.querySelector('button')?.setAttribute('title','Сначала закройте выбор отдельного товара')
  }
  if(salePresentation.place)updateSaleQuote()
}

function marketCareProducts(tabs: string, categories: string, stall: string) {
  const capacity=getWaterCapacity(farm),upgradedCapacity=getWaterCapacity({...farm,canUpgraded:true})
  return `<section data-market-care-browser><div class="market-controls">${tabs}</div>${categories}${stall?`<div class="market-care-tools">${stall}</div>`:''}<div class="market-care-grid">
    <section data-care-product="feed"><div class="market-care-art">${icon('tool-feed')}</div><div class="market-care-copy"><h2>Корм для кур</h2><p>В мешке: ${quantity(feedBagSize,'порция')}</p><p>В запасе: ${quantity(farm.feed,'порция')}</p><p class="market-care-price" aria-label="${quantity(feedBagPrice,'монета')} за мешок">${feedBagPrice} ${icon('coin')} за мешок</p></div>${button('Купить','buy-feed',farm.coins>=feedBagPrice,{context:'Корм для кур'})}</section>
    <section data-care-product="can"><div class="market-care-art">${icon('tool-can')}</div><div class="market-care-copy"><h2>Большая лейка</h2><p class="market-care-capacity" aria-label="Объём лейки: ${farm.canUpgraded?quantity(capacity,'порция'):`${quantity(capacity,'порция')} → ${quantity(upgradedCapacity,'порция')}`} воды">Объём: ${farm.canUpgraded?capacity:`${capacity} → ${upgradedCapacity}`} ${icon('drop')}</p>${farm.canUpgraded?'':`<p class="market-care-price" aria-label="${quantity(canUpgradePrice,'монета')} за улучшение">${canUpgradePrice} ${icon('coin')} за улучшение</p>`}</div>${button(farm.canUpgraded?'Куплено':'Улучшить','upgrade-can',!farm.canUpgraded&&farm.coins>=canUpgradePrice,{context:'Большая лейка'})}</section>
  </div></section>`
}

function marketCards() {
  const balance = `<p class="coin-balance" aria-label="${quantity(farm.coins, 'монета')}">${icon('coin')} ${numberFormat.format(farm.coins)}</p>`
  const tabs = panelTabs('market-tab', marketTab, [['buy', 'Купить'], ['sell', 'Продать'], ['orders', 'Заказы'], ['projects', 'Строить']])
  const stall = farm.village.built ? button(farm.island === 'village' ? 'Своя лавка' : 'В лавку в гавань', 'open-panel', true, { value: 'bay-shop', secondary: true }) : ''
  const controls = `<div class="market-controls"><div class="market-header">${balance}${stall}</div>${tabs}</div>`
  if (marketTab === 'orders') return `<section data-market-orders-browser><div class="market-controls">${tabs}</div>${stall ? `<div class="market-orders-shop">${stall}</div>` : ''}${marketOrders()}${isProjectComplete(farm, 'fair') ? nav(button('Просьбы соседей', 'open-panel', true, { value: 'intents' })) : ''}</section>`
  if (marketTab === 'projects') {
    const dockBuilt=isProjectComplete(farm,'dock')
    return controls + projectCard('fair') + `<ul class="dialog-list building-destinations">
      ${row('tool-boat','Причал рощи',dockBuilt ? 'Путь на Цветочный мыс открыт' : 'Откроет путь на Цветочный мыс',button(dockBuilt?'К причалу':'Что внести','project-dock',true,{secondary:true}))}
      ${row('ui-bea','Лавандовая гавань',farm.village.built ? 'Домики соседей построены' : 'Домики для Беа и Финна',button(farm.village.built?'В гавань':'Что внести',farm.village.built?'sail':'village-project',true,{value:farm.village.built?'village':undefined,secondary:true}))}
    </ul>` + (isProjectComplete(farm,'fair') ? nav(button('Кондитерская','workshop',true,{secondary:true})) : '')
  }
  if (marketTab === 'sell') {
    const sellControls = `<div class="market-controls">${tabs}${stall ? `<div class="market-header">${stall}</div>` : ''}</div>`
    const destinations = farm.culinary.recipes.length ? nav(button('Оставить на свой рецепт','open-panel',true,{value:'recipe-surplus',secondary:true})+button('Мои рецепты','open-panel',true,{value:'recipes',secondary:true})) : ''
    // A zero-result filter can still have stock elsewhere. Only suppress browsing when the entire market is empty.
    if (getSale(farm).items === 0) return `<section data-market-sale-browser>${sellControls}
      <p class="market-sale-search-empty" data-market-sale-empty tabindex="-1" role="status">Пока нет товаров для продажи.</p>
      ${destinations ? `<footer class="market-inline-tools">${destinations}</footer>` : ''}</section>`
    const bulk = marketBulkSaleControls()
    return `<section data-market-sale-browser>${sellControls}
      <div class="market-sale-filters"><div class="market-sale-search"><label for="market-sale-query"><span class="sr-only">Найти товар</span><input id="market-sale-query" data-market-sale-query type="search" maxlength="100" value="${escapeHtml(marketSaleQuery)}" placeholder="Найти товар" aria-controls="market-sale-results" autocomplete="off"></label><button type="button" class="dialog-button secondary" data-action="market-sale-clear" aria-label="Очистить"${marketSaleQuery?'':' disabled'}><span aria-hidden="true">×</span></button></div>
      <nav class="market-inline-groups" aria-label="Группа товаров">${panelTabs('market-sell-group',marketSellGroup,[['all','Всё'],['harvest','Урожай'],['kitchen','Кухня'],['shore','Берег']])}</nav></div>
      ${marketSellGroup==='harvest'?`<div class="market-inline-family"><select data-market-sale-family aria-label="Товар и его варианты"><option value="harvest"${!marketSaleFamily?' selected':''}>Весь урожай</option>${marketFamilyOptions(marketSaleFamily)}</select></div>`:''}
      <p class="market-sale-search-status${marketSaleQuery||marketSellGroup!=='all'?'':' sr-only'}" role="status" aria-live="polite">${marketSaleSearchStatus()}</p>
      <div id="market-sale-results">${marketSaleResults()}</div>
      ${marketSellGroup==='all'||destinations?`<footer class="market-inline-tools">${marketSellGroup==='all'?`<div class="market-total" tabindex="-1"${bulk?'':' hidden'}>${bulk}</div>`:''}${destinations}</footer>`:''}</section>`
  }

  const categories=`<nav class="market-category-icons${marketCategory==='buildings'?' market-building-categories':''}" aria-label="Что купить">${([{id:'seeds',image:'ui-seed-carrot',name:'Семена'},{id:'trees',image:'ui-tree-apple',name:'Деревья'},{id:'care',image:'tool-feed',name:'Уход'},{id:'buildings',image:'upgrade-farmhouse-card',name:'Постройки'}] as const).map(category=>`<button type="button" data-action="market-category" data-value="${category.id}" aria-pressed="${marketCategory===category.id}" aria-label="${category.name}" title="${category.name}">${icon(category.image)}<span>${category.name}</span></button>`).join('')}</nav>`
  if(marketCategory==='seeds')return `<section data-market-seed-browser><div class="market-controls">${tabs}</div>${categories}${stall?`<div class="market-seed-tools">${stall}</div>`:''}<div class="market-seed-grid">${cropIds.map(crop=>{
    const definition=cropDefinitions[crop]
    const stock=`В запасе: ${numberFormat.format(farm.seeds[crop])} ${ruPlural(farm.seeds[crop],['семя','семени','семян'])}`, affordable=farm.coins>=definition.seedPrice
    const buy=button('Купить пакет','buy-seeds',affordable,{crop,context:`${definition.name}, ${seedPackSize} семени за ${quantity(definition.seedPrice,'монета')}`})
    return `<section data-seed-pack="${crop}"><div class="market-seed-art">${icon('ui-seed-'+crop)}</div><div class="market-seed-copy"><h2>${definition.name}</h2><p>В пакете: ${seedPackSize} ${ruPlural(seedPackSize,['семя','семени','семян'])}</p><p class="market-seed-stock">${stock}</p><p class="market-seed-price" aria-label="${quantity(definition.seedPrice,'монета')} за пакет">${definition.seedPrice} ${icon('coin')} за пакет</p></div>${affordable?buy:`<div class="market-seed-limit" role="group" tabindex="-1" aria-label="${definition.name}. ${stock}">${buy}</div>`}</section>`
  }).join('')}</div></section>`
  if(marketCategory==='trees')return `<section data-market-tree-browser><div class="market-controls">${tabs}</div>${categories}${stall?`<div class="market-tree-tools">${stall}</div>`:''}${!farm.trees.home.includes(null)?`<div class="market-tree-space"><p class="dialog-intro">Родной сад заполнен. Бесплатно уберите дерево на хранение, чтобы освободить место для другого.</p>${nav(button('Освободить место','market-orchard-space',true,{secondary:true}))}</div>`:''}<div class="market-tree-grid">${treeIds.map(tree=>{
    const definition=treeDefinitions[tree]
    return `<section data-tree-product="${tree}"><div class="market-tree-art">${icon('ui-tree-'+tree)}</div><div class="market-tree-copy"><h2>${definition.saplingName}</h2><p>${quantity(definition.days,'ночь')} до зрелости</p><p>В запасе: ${farm.saplings[tree]}</p><p class="market-tree-price" aria-label="${quantity(definition.saplingPrice,'монета')} за саженец">${definition.saplingPrice} ${icon('coin')} за саженец</p></div>${button('Купить','buy-sapling',farm.coins>=definition.saplingPrice,{value:tree,context:definition.saplingName})}</section>`
  }).join('')}</div></section>`
  if(marketCategory==='care')return marketCareProducts(tabs,categories,stall)
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
  const detail = slot && definition
    ? slot.age >= definition.days
      ? slot.fruitReady > 0 ? `Плодов к сбору: ${slot.fruitReady}` : 'Новые плоды завтра'
      : `${quantity(definition.days - slot.age, 'ночь')} до зрелости`
    : 'Место для саженца'
  return row(slot?.tree === 'apple' ? 'apple' : 'orchard', definition?.treeName ?? `Свободное место ${index + 1}`, detail,
    button(slot ? 'Осмотреть дерево' : 'Посадить дерево', 'visit-tree', true, { value: index,
      context: definition ? `${definition.treeName}, место ${index + 1}` : `место ${index + 1}` }))
}

const treeStorageChoice = new TreeStorageChoice()
function nurseryCard(slot?: number) {
  if (farm.island !== 'home' && farm.island !== 'grove' || !farm.treeNursery.length) return ''
  const target = slot ?? farm.trees[farm.island].findIndex(tree => tree === null)
  const available = farm.trees[farm.island][target] === null
  const crossing = treeStorageChoice.otherPlot(farm)
  const entry = treeStorageChoice.current(farm)!
  const {id,tree} = entry, definition = treeDefinitions[tree.tree]
  const detail = [nurseryFruitDetail(tree), treeVariantCopy(tree)].filter(Boolean).join(' ')
  return `<section class="tree-storage" aria-label="Деревья на хранении">
    <label class="tree-storage-picker">Деревья на хранении · ${farm.treeNursery.length}<select data-tree-storage-choice aria-label="Выберите дерево на хранении">${farm.treeNursery.map(item=>`<option value="${item.id}"${item.id===id?' selected':''}>${escapeHtml(storedTreeChoiceLabel(item))}</option>`).join('')}</select></label>
    <ul class="dialog-list">${row('ui-tree-' + tree.tree, `${definition.treeName} · №${id}`, detail, button(available ? `Вернуть · место ${target + 1}` : 'Нет места в саду', 'return-nursery-tree', available, { value: id, context: definition.treeName }), tree.trait)}</ul>
    ${available ? '' : `<p class="tree-storage-availability">${crossing
      ? `Освободите место здесь или верните дерево ${crossing.to === 'grove' ? 'в Солёной роще' : 'на Родном острове'}.`
      : 'Сначала освободите место в этом саду.'}</p>`}
    ${crossing ? button(`Плыть ${crossing.to==='grove'?'в Солёную рощу':'на Родной остров'} · место ${crossing.slot+1}`,'nursery-sail-plot',true,{value:crossing.key,secondary:true}) : ''}
    <details class="tree-storage-rules"><summary>Бесплатное хранение: правила</summary><p>Перенос бесплатный. Возраст, готовые плоды и особенность сохраняются. На хранении рост и новые плоды на паузе. После возврата плоды собираются отдельно.</p></details>
  </section>`
}

let fishingGame: ReturnType<typeof createFishingGame> | undefined
let fishingToken: number | undefined
let fishingPractice: ReturnType<typeof createFishingPractice>
let workshopGame: ReturnType<typeof createWorkshop> | undefined
let cookeryGame: ReturnType<typeof createCookery> | undefined
let arrangementGame: ReturnType<typeof createArrangement> | undefined

function stopFishing() {
  // The save snapshot includes this default keep. Move it from the hook to the live bag.
  if (fishingLanding) {
    fishingLanding.keep()
    fishingLanding = undefined
    status()
  }
  fishingPractice?.cancel()
  fishingPractice = undefined
  fishingGame?.destroy()
  fishingGame = undefined
  if (fishingToken !== undefined) {
    const cancelled = cancelFishingTrip(farm, fishingToken)
    fishingToken = undefined
    if (cancelled.ok) saveFarm()
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
function currentCommunityRoute(preferred: 'request' | 'recipe', request = currentCommunityRequest()) {
  const count = requestedFood && request ? getIntentOffers(farm, request.intentId).find(offer => offer.id === requestedFood)?.count : undefined
  return communityReturnRoute(communityRequest?.kind ?? 'intent', farm.island, preferred, count,
    request && 'phase' in request ? request.phase : undefined)
}
function updateCommunityReturn() {
  try {
    if (!saveStore.issue) {
      if (communityRequest) localStorage.setItem(communitySelectionKey, JSON.stringify({ request: communityRequest, food: requestedFood }))
      else localStorage.removeItem(communitySelectionKey)
    }
  } catch { /* The current menu also works without browser storage. */ }
  const request = currentCommunityRequest()
  const route = currentCommunityRoute('recipe', request)
  communityResume.hidden = !communityRequest || dialog.open || island.isCrossing()
  if(freshFinnRide&&(dialog.open||communityRequest?.kind!=='neighbor'||communityRequest.resident!=='finn'||finnPicnicRide(farm)!==freshFinnRide))freshFinnRide=undefined
  communityResume.dataset.action=freshFinnRide?'finn-picnic-ride':'resume-community'
  if(freshFinnRide)communityResume.dataset.value=freshFinnRide
  else delete communityResume.dataset.value
  communityResume.querySelector('span')!.textContent = freshFinnRide?'Домой с Финном':route.label
  communityResume.setAttribute('aria-label', freshFinnRide?'Домой с Финном':request ? `Вернуться: ${request.title}. ${route.label}` : 'Вернуться к соседям')
}
async function resumeCommunityRequest(mode: 'request' | 'recipe' = 'request') {
  const request = communityRequest
  if (!request || island.isCrossing()) return
  const route = currentCommunityRoute(mode)
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
  if (offer.available) return `${deadline}<section class="community-source community-root"><div class="community-source-picture">${communityArt.offerIcon(offer)}</div><h2 tabindex="-1" data-request-ready>${escapeHtml(offer.name)}</h2><p class="dialog-intro">Угощение готово. В запасе: ${offer.count}.</p>${button(communityRequest?.kind === 'neighbor' ? 'К встрече' : 'К просьбе', 'resume-community')}</section>`
  const batch = communityRequest?.kind === 'neighbor' ? getRequestedBeaBatch(farm,communityRequest.planId,offer.id) : undefined
  const sourceLabel = farm.island !== source.destination ? 'К месту готовки' : ingredients.some(item => ingredientCount(farm, item) < item.quantity) ? 'Найти ингредиенты' : 'Что нужно для рецепта'
  return `${deadline}<section class="community-source community-root"><div class="community-source-picture">${communityArt.offerIcon(offer)}</div><h2>${escapeHtml(offer.name)}</h2><ul class="ingredients">${ingredients.map(stockTile).join('')}</ul>
    ${action.available ? button(offer.source === 'signature' ? 'Повторить точно ×1' : batch ? 'Испечь вручную ×1' : 'Готовить', offer.source === 'signature' ? 'request-repeat-exact' : 'request-start-cook') : `${button(sourceLabel, 'request-food-source')}<p class="recipe-reason">${action.label}</p>`}${batch ? `<div class="request-bea-batch">${icon('ui-bea')}<div><strong>Помощь Беа</strong><small>4 пшеницы · 2 яйца · раз в день</small></div>${button('Испечь ×'+batch.count,'request-bea-batch',true,{value:batch.key,secondary:true,context:'помощь Беа на сегодня, 4 пшеницы и 2 яйца'})}</div>` : ''}${nav(button('Другое угощение', 'resume-community', true, { secondary: true }))}</section>`
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
  let castToken: number | undefined, finished = false
  const practice = practiceOnly ? createFishingPractice(farm) : undefined
  if (practiceOnly ? !practice : !getFishAction(farm).available) return
  fishingPractice = practice
  const paid = practice ? undefined : getResumableFishingTrip(farm)
  const config = practice?.config ?? paid?.config ?? getFishingTripConfig(farm)
  const remaining = () => getFishLimit(farm) - (farm.island === 'grove' ? farm.fishCaughtToday.grove : farm.fishCaughtToday.home)
  const capacity = practice ? config.capacity : Math.min(config.capacity, remaining())
  const layoutToken = paid?.token ?? farm.fishingTripSerial + 1
  dialogContent.innerHTML = '<div class="fishing-host"></div>'
  const host = dialogContent.querySelector<HTMLElement>('.fishing-host')!
  // A result can outlive its token. Use the mounted scene, not a token, to own its controls.
  const current = (): boolean => fishingGame === scene
  const scene: ReturnType<typeof createFishingGame> = createFishingGame(host, {
    practiceOnly, resumed: !!paid,
    seed: practice?.seed ?? farm.day*1009+layoutToken*9176+(farm.island==='grove'?71:17),
    capacity, maxDepth: config.depth, resilience: config.resilience,
    habitat: config.habitat && { ...config.habitat },
    fish: practice?.fish ?? (farm.island === 'grove' ? 'seaBass' : 'perch'),
    onCast() {
      if (!current() || castToken !== undefined || finished) return false
      if (practice) {
        if (!practice.cast()) return false
      } else if (paid) {
        if (getResumableFishingTrip(farm) !== paid || Math.min(config.capacity, remaining()) !== capacity) return false
        castToken = fishingToken = paid.token
      } else {
        const trip = beginFishingTrip(farm)
        if (!trip.ok || trip.token === undefined) { notify(trip.message, false); return false }
        castToken = fishingToken = trip.token
        saveFarm()
      }
      island.setFishing(true)
      return true
    },
    onCancel: () => { if (current()) closeDialog() },
    onBack: () => {
      if (!current() || !dialog.open || panel !== 'fishing' || farm.island !== 'grove' || panelHistory.at(-1)?.panel !== 'cove') return false
      goBack(true)
      return true
    },
    onAgain: () => { if (current() && finished) mountFishing(practiceOnly) },
    onPractice: practiceOnly ? undefined : () => { if (current() && finished) mountFishing(true) },
    onFinish({ catches }) {
      if (!current() || finished) return false
      if (practice) {
        if (!practice.finish(catches)) return false
        finished = true
        island.setFishing(false)
        return true
      }
      const token = castToken
      if (token === undefined || fishingToken !== token || getResumableFishingTrip(farm)?.token !== token) return false
      const settled = perform(() => {
        const result = finishFishingTrip(farm, token, catches, true)
        if (result.ok) fishingLanding = result.landed
        return result
      }, false, true)
      if (!settled) return false
      castToken = fishingToken = undefined
      finished = true
      island.setFishing(false)
      const landed = fishingLanding, canRecast = getFishAction(farm).available
      if (!landed) return canRecast
      return { canRecast, index: landed.index, release() {
        if (!current() || landed !== fishingLanding || !landed.release()) return false
        fishingLanding = undefined
        saveFarm()
        return true
      } }
    },
  })
  fishingGame = scene
  host.querySelector<HTMLButtonElement>('.fishing-practice-shore, .fishing-controls .fishing-action')?.focus({ preventScroll: true })
}

function pastryChoices() { return pastryChoicesFor(pastryShape) }

function pastryChoicesFor(selected: WorkshopShape) {
  const labels = { round:'Булочка', long:'Батон', folded:'Слойка' } satisfies Record<WorkshopShape,string>
  const order: readonly WorkshopShape[] = ['round','long','folded']
  return `<div class="pastry-pattern-choices" role="group" aria-label="Форма выпечки">${order.map(shape => {
    const learned=farm.workshopPatterns.includes(shape)
    return `<button type="button" data-action="pastry-shape" data-value="${shape}" aria-pressed="${selected===shape}" aria-label="${workshopDefinitions[shape].name}, ${learned?'освоено':'можно освоить в мастерской'}">${icon(pastryIcons[shape])}<span>${labels[shape]}</span>${learned?'<b class="pastry-mastered" aria-hidden="true">✓</b>':''}</button>`
  }).join('')}</div>`
}

function villageProjectCard() {
  const project = getVillageProject(farm)
  if (project.status === 'completed') return nav(button('Отправиться', 'sail', farm.boatOwned, { value: 'village' }))
  const unlocked = project.unlocked
  const finishing = unlocked && farm.coins >= project.coins && project.items.every(({item, delivered, available}) => delivered + available >= item.quantity)
  const buildAction = finishing || project.items.every(({item, delivered}) => delivered >= item.quantity)
  const contributions = new Map(getVillageContributionChoices(farm).map(choice => [choice.key,choice]))
  return `<div class="harbour-preview"><img src="${iconUrl('village-plate')}" alt="Домики, мастерская и стол для ужина в Лавандовой гавани"></div>
    ${unlocked ? '' : `<ul class="dialog-list">${row('ui-market', 'Гости ярмарки', `${Math.min(villageGuestTarget, farm.fairGuestsServed)}/${villageGuestTarget}`)}${isProjectComplete(farm, 'fair') ? '' : row('ui-market', 'Ярмарка', '', button('К стройке', 'fair-project'))}</ul>`}
    <ul class="ingredients">${deliveryItems(project.items,false,contributions)}</ul>
    ${renderHarbourFishChoice(farm)}
    ${renderVillageBudget(farm,icon('coin'),(content,ready)=>requirementLink(content,{kind:'journey',island:'village',id:'village-coins'},'ingredient','Монеты для постройки Живой бухты',ready))}
    ${nav(button(buildAction ? 'Построить' : contributions.size ? 'Внести всё' : 'Внести припасы', 'build-village', project.status === 'ready', buildAction ? { cost: { icon: 'coin', amount: project.coins } } : {}), button('Кондитерская', 'workshop', isProjectComplete(farm, 'fair'), { secondary: true }))}`
}

function finishSharedSupper(action: () => { ok: boolean; message: string }, pastry = false) {
  // Keep the earned decision visible. Other cooking/recipe-book contexts retain their own return path.
  const table = panel === 'village-meal' && farm.island === 'village'
  const first = table && farm.village.meals === 0
  const handoff = table && farm.village.meals >= 1 && !farm.village.residents[1]
  if (perform(action, pastry && !first && !handoff, pastry || first || handoff)
    && (first || handoff && supperCottageReady(farm))) {
    dialogContent.scrollTop = 0
    dialogContent.querySelector<HTMLElement>('[data-supper-result]')?.focus({ preventScroll: true })
  }
}

function neighboursCard() { return renderNeighboursCard(pastryShape) }

function renderNeighboursCard(shape: WorkshopShape, guided = false) {
  const homes = getVillageHomeCount(farm)
  const resident = farm.village.residents[villageSlot]
  const houseTabs = `<nav class="house-selector" aria-label="Домики соседей">${[0, 1].map(slot => {
    const occupant = farm.village.residents[slot]
    return `<button type="button" data-action="village-slot" data-value="${slot}" aria-pressed="${villageSlot === slot}">${icon('upgrade-farmhouse-card')}<span><strong>Домик ${slot + 1}</strong><small>${slot >= homes ? villageHomeProgress(farm) : occupant ? residentDefinitions[occupant].name : 'Свободен'}</small></span></button>`
  }).join('')}</nav>`
  const dinnerServed = getVillageMeal(farm, pastryShape).served
  const dinner = `<div class="harbour-next">${icon('ui-grilled-fish')}<div><strong>${dinnerServed ? 'Ужин завтра' : 'Общий ужин'}</strong>${homes < 2 ? `<small>До второго домика: ${farm.village.meals}/2 ужина</small>` : ''}</div>${dinnerServed ? '' : button('Накрыть стол', 'village-meal')}</div>`
  return `<section class="neighbor-house-page">${houseTabs}${villageSlot >= homes ? dinner : `
    <div class="resident-cards" data-occupied="${Boolean(resident)}">${residentIds.filter(id => resident ? id === resident : !farm.village.residents.includes(id)).map(id => {
      const def = residentDefinitions[id]
      const service = getResidentService(farm, id, shape)
      const here = resident === id
      const practice = here && id === 'bea' && !farm.workshopPatterns.includes(shape)
      const ingredients: readonly StockItem[] = practice ? workshopIngredients : [{ kind: 'produce', item: 'wheat', quantity: 4 }, { kind: 'eggs', quantity: 2 }]
      const pier = here && id === 'finn' ? getFinnFishingRoute(farm) : undefined
      const pierButton = (route: { label: string; value: string }) => button(route.label, 'finn-pier', true, { value: route.value })
      return `<section class="resident-card" data-present="${here}"><header class="resident-heading">${icon(`ui-${id}`, 'resident-portrait')}<h2>${def.name}</h2></header>
        ${here ? '' : `<div class="neighbour-promise">${icon(id==='bea'?'ui-handmade-round':'tool-rod')}<span>${id==='bea'?'3 изделия в день':'+1 место на крючке · крепче снасть'}</span></div>`}
        <div class="resident-service">${here ? (id === 'bea' ? `<div class="resident-patterns"><div class="resident-pattern-heading"><h3>Форма выпечки</h3><small>✓ Освоено</small></div>${guided ? pastryChoicesFor(shape) : pastryChoices()}</div><ul class="ingredients">${ingredients.map(stockTile).join('')}</ul>${practice
          ? button(`Освоить вручную: ${workshopDefinitions[shape].name.toLowerCase()}`, 'practice-pattern', getWorkshopAction(farm).available, { value: shape })
          : button(`Испечь ×${getBeaPastryCount(farm)}`, 'resident-service', service.available, { value: guided ? `bea:${shape}` : id, context: workshopDefinitions[shape].name })}`
          : pier ? `<div class="finn-hook-ready" tabindex="-1" data-finn-hook>${icon('tool-rod')}<strong>Крючок готов${pier.addsSlot ? ' · +1 место' : ''}</strong></div>${pier.alternate ? nav(pierButton(pier),pierButton(pier.alternate)) : pierButton(pier)}`
          : button('Разведать · +1 место на крючке', 'resident-service', service.available, { value: id }))
        : button('Пригласить', 'invite-resident', true, { value: id })}
        ${here&&!service.available&&!practice&&!pier?`<p class="dialog-status">${service.label}</p>`:''}
        </div>${here ? `<div class="resident-gatherings">${dinner}${nav(button(`Замысел: ${def.name}`, 'open-neighbor', true, { value: id, secondary: true }))}${neighborHelpCard(farm,id)}</div>` : ''}
      </section>`
    }).join('')}</div>`}
    ${villageSlot < homes && !resident ? dinner : ''}
    <section class="resident-self-cook" aria-label="Приготовить самому"><h3>Приготовить самому</h3>${nav(button('Кухня', 'kitchen',true,{secondary:true}),button('Кондитерская', 'workshop', true, {secondary:true}))}</section></section>`
}

let selectedWarehouseRequest: StockItem | undefined
type PanelVisit = {
  cottageKitchenDish?: DishId; // Sole ready dish for this ordinary cottage visit; not a session preference.
  cottageKitchenShelf?: DishId; // Same visit owns the selected live dish when the default card was blocked.
  harbourRecipe?: {id: string; preview: boolean}; // Only carried by this recipe's explicit crossing.
  commissionRecipe?: { line:string; prepared:boolean }; // This exact order line opened the book.
  tastingBakery?: string; // An explicit stop from this particular saved recipe.
  neighborComposerPlan?: string; // Only set by this visit's explicit “Свой рецепт” button.
  dailyIntentComposerOrder?: string; // Owns an exact draft from a daily request, not the last global selection.
  ferryMorning?: number; // This ferry visit's explicit trip to the Home forecast.
  festivalCargoPreview?: { port: ExpeditionPort; offer: string; serial: number };
  restFeedMixDay?: number; // Keyboard entered from today's actual Rest mix button.
  recipeBook: RecipeBookView;
  kitchenSourceItem?: string;
  ferryView: FerryPanelView | undefined;
  marketNextOpen: string[];
  marketOrder?: {lane:string; pickerScroll:number; source?:string; warehouse:boolean};
  marketSaleGrid?: {key:string; scroll:number};
  guideGardenOpen: boolean;
  homeServicesOpen: boolean;
  gardenSupplies: {slot: number; revision: number; open: boolean} | undefined;
  warehouseRequest: StockItem | undefined;
  expeditionPort: ExpeditionPort; expeditionOffer: string;
  warehouse: typeof selectedWarehouse; freightPlanOpen: boolean; journeyDetailsOpen: boolean; journalDetailsOpen: boolean;
  inventoryGroup: 'harvest'|'kitchen'|'shore'; boatIsland: (typeof islandIds)[number];
  marketSaleFamily: string | undefined; marketSaleQuery: string; panel: Panel; marketTab: 'buy'|'sell'|'orders'|'projects'; marketCategory:'seeds'|'trees'|'care'|'buildings';marketSellGroup:'all'|'harvest'|'kitchen'|'shore';bagTab: 'seeds'|'harvest'; archiveGroup: ArchiveGroup;
  treeSlot: number; previewSeed: CropId; specializationBuilding: BuildingId; previewSpecialization: BuildingBranch | undefined;
  irrigationMode: 'row'|'pair'; villageSlot: number; pastryShape: WorkshopShape;
  workshopRecipe: 'pastry'|'bread'; cookingDish: DishId; cookingFish: FishId; seedPickerBed: number | undefined; scroll: number; focus: string | undefined;
  signatureBase:SignatureDraft['base'];signatureSlots:(SignatureIngredient|null)[];signatureSlot:number;signatureRepeatId:string|undefined;expandedRepeatId:string|undefined;cookingMode:'dish'|'signature';
  communityOrderId:string;communityResident:ResidentId;requestedFood:FoodOfferId|undefined;
  neighborRecipeOrigin?: {island:typeof farm.island; request:Extract<CommunityRequest,{kind:'neighbor'}>};
  kitchenTart:KitchenTart;kitchenPreserves:KitchenPreserves;kitchenGroup:KitchenSelection|undefined;kitchenDish:DishId;honeyKitchenDish:HoneyKitchenRecipe;signatureFamily:SignatureFamily;
}
const panelHistory: PanelVisit[] = []
// Identity ties this shortcut to its exact Market visit, never another Orchard entry.
let marketTreeSpaceVisit: PanelVisit | undefined
function marketTreeReturnIndex() {
  return orchardMarketReturnIndex(panelHistory, marketTreeSpaceVisit, panel, farm.island)
}
function marketTreeContinuation() {
  if (marketTreeReturnIndex() < 0 || !farm.trees.home.includes(null)) return ''
  return `<section class="orchard-market-return"><p>Место для нового дерева свободно.</p>${button('К саженцам','market-trees-return')}</section>`
}
let panelRenderVersion = 0
function focusKey(button: HTMLButtonElement) {
  const controls = Object.entries(button.dataset).filter(([key])=> !['selected','active','ready'].includes(key))
  return JSON.stringify(controls.length ? controls : [button.className,button.getAttribute('aria-label') ?? button.textContent?.trim()])
}
// The route key is rebuilt per render; only the product ID survives a warehouse withdrawal.
function stockSourceItem(button: HTMLButtonElement | null) {
  const requirement = button?.dataset.action === 'show-requirement' ? requirementLinks.get(button.dataset.value ?? '') : undefined
  return requirement?.kind === 'stock' ? bayProductId(requirement.item) : undefined
}
function leaveScene(){if(panelHistory.length)goBack();else closeDialog()}
function returnFromNeighborArrangement(keyboard = false) {
  const request = arrangementRequest, origin = panelHistory.at(-1)
  // Cancel belongs to this local visit, not the separately available travel shortcut.
  if (panel === 'arrangement' && dialog.open && farm.island === 'village' && request?.kind === 'neighbor'
    && origin?.panel === 'neighbor' && getNeighborPlans(farm).some(plan =>
      plan.id === request.id && plan.resident === origin.communityResident && plan.phase === 'arranging')) goBack(keyboard)
  else closeDialog()
}
function rememberPanel(): PanelVisit {
  const focused = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null
  const supplies = panel === 'garden-plans' ? dialogContent.querySelector<HTMLDetailsElement>('.garden-supplies') : null
  const homeServicesOpen = panel === 'rest' && dialogContent.querySelector<HTMLDetailsElement>('.home-rest-services')?.open === true
  const marketOrder = panel === 'market' && marketTab === 'orders' && selectedMarketOrder
    ? {lane:selectedMarketOrder, pickerScroll:dialogContent.querySelector<HTMLElement>('.market-order-picker')?.scrollTop ?? 0,
       source:stockSourceItem(focused), warehouse:focused?.dataset.action === 'warehouse-supply'} : undefined
  const sellGrid = panel === 'market' && marketTab === 'sell' ? dialogContent.querySelector<HTMLElement>('#market-sale-results') : null
  const marketSaleGrid = sellGrid ? {key:marketSaleGridKey(sellGrid), scroll:sellGrid.scrollTop} : undefined
  const neighborRecipeOrigin = panel === 'request-food' && requestedFood && communityRequest?.kind === 'neighbor'
    ? {island:farm.island, request:communityRequest} : undefined
  return {marketOrder,marketSaleGrid,homeServicesOpen,neighborRecipeOrigin,kitchenSourceItem:panel === 'kitchen' || panel === 'recipes' || panel === 'signature' && focused?.dataset.action === 'show-requirement' ? stockSourceItem(focused) : undefined, gardenSupplies:supplies?{slot:gardenEditor.slot,revision:farm.gardenPlans.revision,open:supplies.open}:undefined,guideGardenOpen:dialogContent.querySelector<HTMLDetailsElement>('[data-guide-garden]')?.open ?? false,recipeBook:recipeBook.snapshot(dialogContent),ferryView:panel==='bay-freight'?captureFerryPanelView(dialogContent):undefined,marketNextOpen:[...dialogContent.querySelectorAll<HTMLDetailsElement>('[data-market-next][open]')].map(item=>item.dataset.marketNext!),warehouseRequest:selectedWarehouseRequest,expeditionPort:selectedExpeditionPort,expeditionOffer:selectedExpeditionOffer,panel:panel!,journalDetailsOpen:dialogContent.querySelector<HTMLDetailsElement>('.discovery-roadmap')?.open ?? false,journeyDetailsOpen:dialogContent.querySelector<HTMLDetailsElement>('.journey-details')?.open ?? false,warehouse:selectedWarehouse,freightPlanOpen:dialogContent.querySelector<HTMLDetailsElement>('.bay-freight-plan')?.open ?? false,inventoryGroup,boatIsland,marketSaleFamily,marketSaleQuery,marketTab,marketCategory,marketSellGroup,bagTab,archiveGroup,treeSlot,previewSeed,specializationBuilding,previewSpecialization,
    irrigationMode,villageSlot,pastryShape,workshopRecipe,cookingDish,cookingFish,seedPickerBed,signatureBase,signatureSlots:signatureSlots.map(part=>part?{...part}:null),signatureSlot,signatureRepeatId,expandedRepeatId,cookingMode,communityOrderId,communityResident,requestedFood,kitchenTart,kitchenPreserves,kitchenGroup,kitchenDish,honeyKitchenDish,signatureFamily,scroll:dialogContent.scrollTop,focus:focused?focusKey(focused):undefined}
}
function goBack(keyboard = false) {
  const previous=panelHistory.pop()
  if(!previous)return
  const homeKitchenReturn = panel === 'cookery' && previous.panel === 'kitchen'
    && typeof previous.kitchenGroup === 'object' && previous.kitchenGroup.ready
    && farm.island === 'home' && cookingMode === 'dish' && previous.kitchenGroup.ready === cookingDish
    && !getCookAction(farm,cookingDish,previous.cookingFish).available ? cookingDish : undefined
  const restFeedReturn = keyboard && panel === 'chicken-feed' && previous.panel === 'rest'
    && previous.restFeedMixDay === farm.day && farm.island === 'home' && farm.feed > 0 && !farm.chickensFed
  // Today's table button is gone after supper; return focus to the same cottage.
  const supperCottage = previous.panel === 'village' && panel === 'village-meal' && getVillageMeal(farm).served
  const suppliedRecipe = keyboard && previous.panel === 'recipes' && (panel === 'tree' || panel === 'warehouse-supply' &&
    selectedWarehouseRequest && previous.kitchenSourceItem === bayProductId(selectedWarehouseRequest)) ? previous.recipeBook.selectedId : undefined
  const preparedLine = keyboard && panel === 'recipes' && previous.panel === 'shop-commissions' && previous.commissionRecipe?.prepared
    ? getShopCommissionLine(farm,previous.commissionRecipe.line) : undefined
  const reserveOnReturn = preparedLine?.canDeliver && preparedLine.recipeId === recipeBook.view.selectedId && recipeBook.view.mode === 'detail'
    && preparedLine.inBag + preparedLine.warehouse >= preparedLine.remaining ? preparedLine.actionValue : undefined
  recipeBook.load(previous.recipeBook)
  journeyDetailsOpen=previous.journeyDetailsOpen
  journalDetailsOpen=previous.journalDetailsOpen
  selectedExpeditionPort=previous.expeditionPort; selectedExpeditionOffer=previous.expeditionOffer
  selectedWarehouseRequest=previous.warehouseRequest
  selectedWarehouse=previous.warehouse; freightPlanOpen=previous.freightPlanOpen
  inventoryGroup=previous.inventoryGroup;boatIsland=previous.boatIsland
  marketSaleFamily=previous.marketSaleFamily;marketSaleQuery=previous.marketSaleQuery;marketTab=previous.marketTab;marketCategory=previous.marketCategory;marketSellGroup=previous.marketSellGroup;bagTab=previous.bagTab;archiveGroup=previous.archiveGroup;treeSlot=previous.treeSlot
  previewSeed=previous.previewSeed;specializationBuilding=previous.specializationBuilding;previewSpecialization=previous.previewSpecialization
  irrigationMode=previous.irrigationMode;villageSlot=previous.villageSlot;pastryShape=previous.pastryShape
  workshopRecipe=previous.workshopRecipe;cookingDish=previous.cookingDish;cookingFish=previous.cookingFish
  // A side trip can fill the plot. Restore browsing, not a dead-end bed return.
  const seedBed = previous.seedPickerBed === undefined ? undefined : farm.beds[previous.seedPickerBed]
  seedPickerBed = farm.island === 'home' && seedBed && seedBed.kind !== 'crop' ? previous.seedPickerBed : undefined
  signatureBase=previous.signatureBase;signatureSlots=previous.signatureSlots.map(part=>part?{...part}:null);signatureSlot=previous.signatureSlot;signatureRepeatId=previous.signatureRepeatId;expandedRepeatId=previous.expandedRepeatId;cookingMode=previous.cookingMode
  communityOrderId=previous.communityOrderId;communityResident=previous.communityResident;requestedFood=previous.requestedFood
  let destinationPanel=previous.panel
  const recipeOrigin=previous.panel==='request-food' ? previous.neighborRecipeOrigin : undefined
  if(recipeOrigin){
    const {request,island:shore}=recipeOrigin
    const plan=shore===farm.island ? getNeighborPlans(farm).find(plan=>plan.id===request.planId && plan.resident===request.resident
      && (plan.phase==='joined'||plan.phase==='arranging')) : undefined
    // Back owns only this live preview, never a newer or different gathering.
    if(plan && requestedFood && getIntentOffers(farm,plan.intentId).some(offer=>offer.id===requestedFood && offer.eligible))
      communityRequest=request
    else {
      requestedFood=undefined
      destinationPanel=shore===farm.island && farm.island==='village' ? 'neighbor' : 'guide'
    }
  }
  kitchenTart=previous.kitchenTart;kitchenPreserves=previous.kitchenPreserves;kitchenGroup=previous.kitchenGroup;kitchenDish=previous.kitchenDish;honeyKitchenDish=previous.honeyKitchenDish;signatureFamily=previous.signatureFamily
  if (homeKitchenReturn) kitchenGroup = { ready:homeKitchenReturn, returned:true }
  if (previous.marketOrder) selectedMarketOrder = previous.marketOrder.lane
  openPanel(destinationPanel,false,farm.island,'page.fold')
  if (previous.marketSaleGrid && dialog.open && panel === 'market' && marketTab === 'sell') {
    const grid = dialogContent.querySelector<HTMLElement>('#market-sale-results')
    // Apply only to this exact result set; the browser clamps to its live geometry.
    if (grid && marketSaleGridKey(grid) === previous.marketSaleGrid.key) grid.scrollTop = previous.marketSaleGrid.scroll
  }
  restoreFerryPanelView(dialogContent,previous.ferryView)
  const gardenGroup = dialogContent.querySelector<HTMLDetailsElement>('[data-guide-garden]')
  if (gardenGroup) gardenGroup.open = previous.guideGardenOpen
  // Expand this visit's source before restoring its scroll and checking focus visibility.
  if (previous.panel === 'rest' && previous.homeServicesOpen) {
    const services = dialogContent.querySelector<HTMLDetailsElement>('.home-rest-services')
    if (services) services.open = true
  }
  const supplies = previous.panel === 'garden-plans' ? previous.gardenSupplies : undefined
  if (supplies && supplies.slot === gardenEditor.slot && supplies.revision === farm.gardenPlans.revision) {
    const disclosure = dialogContent.querySelector<HTMLDetailsElement>('.garden-supplies')
    if (disclosure) disclosure.open = supplies.open
  }
  if(previous.panel==='festival') {
    const source=[...dialogContent.querySelectorAll<HTMLButtonElement>('[data-action="festival-source"]')].find(button=>focusKey(button)===previous.focus)
    const alternatives=source?.closest<HTMLDetailsElement>('details.festival-alternatives')
    if(alternatives)alternatives.open=true
  }
  dialogContent.querySelectorAll<HTMLDetailsElement>('[data-market-next]').forEach(item=>item.open=previous.marketNextOpen.includes(item.dataset.marketNext!))
  const restoredVersion = panelRenderVersion
  requestAnimationFrame(()=>{
    // A newer selection or dismissal must not receive an old page’s scroll or focus.
    if (!dialog.open || panel !== previous.panel || panelRenderVersion !== restoredVersion) return
    dialogContent.scrollTop=previous.scroll
    if (previous.marketOrder) {
      const picker = dialogContent.querySelector<HTMLElement>('.market-order-picker')
      if (picker) picker.scrollTop = previous.marketOrder.pickerScroll
    }
    const sourceItem = previous.marketOrder?.source ?? previous.kitchenSourceItem
    const target=Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).find(button=>
      (sourceItem ? stockSourceItem(button)===sourceItem : focusKey(button)===previous.focus) && button.getClientRects().length>0)
    if (previous.panel === 'recipes') {
      recipeBook.restore(dialogContent,true,suppliedRecipe)
      const offer = previous.tastingBakery && signatureTastingGuide(farm,previous.tastingBakery,'bea')
      if (offer && offer.available && !offer.bakeFirst) {
        const taste = dialogContent.querySelector<HTMLButtonElement>('[data-action="taste-signature"][data-resident="bea"]:not(:disabled)')
        if (taste && taste.dataset.value === previous.tastingBakery && taste.getClientRects().length) {
          taste.focus({preventScroll:true}); taste.scrollIntoView({block:'nearest'})
        }
      }
    }
    else if (reserveOnReturn) {
      const reserve = Array.from(dialogContent.querySelectorAll<HTMLButtonElement>('[data-action="commission-deliver"]:not(:disabled)')).find(button=>button.dataset.value===reserveOnReturn)
      ;(reserve ?? target)?.focus({preventScroll:true})
      reserve?.scrollIntoView({block:'nearest'})
    }
    else if (target && previous.panel !== 'bay-freight') target.focus({preventScroll:true})
    else if (homeKitchenReturn) {
      // Do not put a repeated Enter on the next available Cook action.
      const recipe = dialogContent.querySelector<HTMLElement>('[data-kitchen-return-dish]')
      recipe?.focus({preventScroll:true}); recipe?.scrollIntoView({block:'nearest'})
    }
    else if (restFeedReturn) {
      const feed = dialogContent.querySelector<HTMLButtonElement>('.rest-before-morning [data-action="feed"]:not(:disabled)')
      const row = feed?.closest<HTMLElement>('.dialog-row')
      if (feed?.getClientRects().length && row?.getClientRects().length) {
        // The Mix button was replaced. Reveal the same row, not a spend control
        // that the same held key could activate. Feed still takes its own action.
        row.tabIndex = -1
        row.focus({preventScroll:true})
        row.scrollIntoView({block:'nearest'})
      }
    }
    else if (previous.marketOrder?.source || previous.marketOrder?.warehouse) {
      // Satisfied row or changed withdrawal: read the same crate, never arm a new ingredient or delivery.
      const ready = dialogContent.querySelector<HTMLElement>('.market-orders-workspace > .market-order-detail:first-child')
      ;(ready ?? dialogContent.querySelector<HTMLElement>('.market-order-detail'))?.focus({preventScroll:true})
      ready?.scrollIntoView({block:'nearest'})
    }
    else if (supperCottage) dialogContent.querySelector<HTMLButtonElement>('[data-action="village-slot"][aria-pressed="true"]')?.focus({preventScroll:true})
    else if (previous.kitchenSourceItem) {
      const selector = previous.panel === 'signature' ? '.recipe-portion[aria-pressed="true"]' : '[data-action="recipe-family"][aria-pressed="true"]'
      dialogContent.querySelector<HTMLButtonElement>(selector)?.focus({preventScroll:true})
    }
    else if (previous.panel === 'market' && marketTab === 'sell') {
      const search = dialogContent.querySelector<HTMLInputElement>('[data-market-sale-query]')
      search?.focus({preventScroll:true}); search?.scrollIntoView({block:'nearest'})
    }
  })
}
let harbourScene: {destroy():void; focusListing?(id:string):void} | undefined
let nextShopStock: string | undefined
let nextShopMarketVisit: PanelVisit | undefined
let selectedWarehouse = farm.island
const ferryArrival = new FerryArrivalPresentation()
let {port:selectedExpeditionPort,offer:selectedExpeditionOffer} = initialExpeditionPreview(farm.freight.expeditions)
const shopAssortmentChoice = new ShopAssortmentChoice()
const shopCommissionView = new ShopCommissionView()
let freightPlanOpen = false
let musicView: BayMusicViewState | undefined
// An unpaid supply quote belongs to this rendered ferry only, not the next visit or receipt.
const ferrySupplyOrigins = new WeakMap<Element, {day:number; island:typeof farm.island; serial:number;
  port:ExpeditionPort; offer:string; supply:string; view:FerryPanelView|undefined}>()
function returnToFerrySupplyOrigin() {
  if (panel !== 'bay-freight' || !dialog.open) return false
  const owner = dialogContent.querySelector('.bay-freight')
  const origin = owner && ferrySupplyOrigins.get(owner)
  if (!owner || !origin) return false
  ferrySupplyOrigins.delete(owner)
  const world = farm.freight.expeditions
  if (origin.day !== farm.day || origin.island !== farm.island || origin.serial !== world.serial
    || origin.port !== selectedExpeditionPort || origin.supply !== selectedExpeditionOffer) return false
  const plan = getFerryRestockPlan(world,origin.offer,farm.day,expeditionWallet(farm))
  if (plan?.kind !== 'supply' || plan.port !== origin.port || plan.offer.id !== origin.supply) return false
  selectedExpeditionOffer = origin.offer
  drawPanel()
  restoreFerryPanelView(dialogContent,origin.view)
  return true
}
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
function openShopScene(host:HTMLElement, marketVisit?: PanelVisit) {
  const catalog = harbourGoods(), byId = new Map(catalog.map(row => [row.id,row]))
  const products = ():ReturnType<BayShopOptions['products']> => harbourGoods().map(row => {
    const kind = row.item?.kind
    const group:BayShopStockGroup = !kind || ['dishes','handmade','eggBaskets','eggCrates'].includes(kind) ? 'kitchen'
      : ['fish','shells','shoalFinds','seaSalt'].includes(kind) ? 'shore' : 'harvest'
    return {...row,group,quantity:row.quantity+(farm.freight.warehouses.village[row.id] ?? 0)}
  }).filter(row => row.quantity>0)
  const source = panelHistory.at(-1)
  const recipe = source?.panel === 'recipes' ? source.harbourRecipe : undefined
  const recipeProduct = recipe?.preview ? 'signature:' + recipe.id : undefined
  if (recipe) recipe.preview = false
  const readyCommission = (customer: BayShopCommissionPreview['customer'], recipeId: string): BayShopCommissionPreview | undefined => {
    if (farm.island !== 'village') return
    const offer = getShopCommissionOffers(farm).find(row => row.customer === customer && row.recipeId === recipeId)
    const ready = (farm.culinary.stock[recipeId] ?? 0) + (farm.freight.warehouses.village[`signature:${recipeId}`] ?? 0)
    return offer && ready >= offer.quantity ? { customer, recipeId, key: offer.key } : undefined
  }
  const options:BayShopOptions = {state:farm.bayShop,products,catalog,stockProduct:nextShopStock,recipeProduct,returnToRecipe:!!recipe,
    takeStock:(id,n)=>{ const reserved=reserveShopGoods(farm,id,n); if(reserved)status(); return reserved },
    returnStock:(id,n)=>{returnShopGoods(farm,id,n);status()},
    onEarn:n=>{farm.coins+=n;textAt('status-coins',numberFormat.format(farm.coins));bayAudio.playEvent('trade.receive')},onChange:saveHarbour,onClose:leaveScene,
    onOpenFreight:()=>openPanel('bay-freight'),
    ...(marketVisit ? {onReturnMarket() {
      if (!dialog.open || panel !== 'bay-shop' || farm.island !== 'village' ||
        !dialogContent.contains(host) || island.isCrossing()) return
      void visitPanelAt('home','market',undefined,undefined,marketVisit)
    }} : {}),
    commissionCustomers:()=>getShopCommissionOffers(farm).map(offer=>offer.customer),
    readyCommission,
    onOpenCommissions:(customer,preview)=>{
      const exact = preview && readyCommission(preview.customer, preview.recipeId)?.key === preview.key ? preview : undefined
      const target = preview ? exact?.customer : customer
      if(target && (exact || shopCommissionView.current(farm).customer!==target)) shopCommissionView.choose(farm,'customer',target)
      if(exact) shopCommissionView.choose(farm,'recipe',exact.recipeId)
      openPanel('shop-commissions')
      if(target)dialogContent.querySelector<HTMLElement>('[data-commission-view="customer"], [data-commission-customer]')?.focus({preventScroll:true})
    },
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
  harbourScene=createBayMusic(host,{beaAvailable:canPlayWithBea(farm),state:farm.musicGarden,viewState:musicView,onViewChange:view=>{ musicView=view },getMaterialStock:()=>gardenMaterialStock(farm),getMaterialSources:()=>getMusicMaterialGuidance(farm).sources,
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
function exactSaleCard(contextual: boolean) {
      const stock = selectedSale && (saleStock(farm, selectedSale) ?? (saleReceipt ? {count:0,price:saleReceipt.total/saleReceipt.quantity} : undefined))
      if (!selectedSale || !stock) return '<p class="dialog-intro">Товар недоступен.</p>'
      const recipe = selectedSale.kind==='signature' ? farm.culinary.recipes.find(item=>item.id===selectedSale!.key) : undefined
      const art = selectedSale.image ? itemIcon(selectedSale.image,selectedSale.trait) : recipe ? signatureResultPicture(recipe,{icon}) : ''
      return `<section class="exact-sale" data-sale-token="${escapeHtml(salePresentation.token)}"><div class="exact-sale-product"><span class="exact-sale-art" aria-hidden="true">${art}</span><h2 tabindex="-1">${escapeHtml(selectedSale.name)}</h2><p>В запасе: ${stock.count}</p><p>За 1: ${quantity(stock.price,'монета')}</p></div><div class="exact-sale-editor">${saleReceipt
        ? `<p class="exact-sale-receipt" role="status" tabindex="-1">Продано: ${saleReceipt.quantity}. Получено: ${quantity(saleReceipt.total, 'монета')}. Осталось: ${saleReceipt.remaining}.</p>${nav(button('Продать ещё', 'sale-again', stock.count > 0), button(contextual?'К товарам':'Назад', contextual?'sale-context-close':'back', true, { secondary: true }))}`
        : `<label for="sale-quantity">Количество</label><div class="exact-sale-stepper"><button class="dialog-button secondary" type="button" data-action="sale-step" data-value="less" aria-label="Уменьшить количество на 1">−</button><input id="sale-quantity" data-sale-quantity type="number" min="1" max="${stock.count}" step="1" inputmode="numeric" value="${escapeHtml(saleQuantity)}" aria-describedby="sale-quote"><button class="dialog-button secondary" type="button" data-action="sale-step" data-value="more" aria-label="Увеличить количество на 1">+</button><button class="dialog-button secondary" type="button" data-action="sale-step" data-value="all" aria-label="Весь этот товар: ${stock.count}">Всё</button></div><p id="sale-quote" class="exact-sale-summary" aria-live="polite"></p>${nav(button('Продать выбранное', 'confirm-sale', false), button(contextual?'Закрыть выбор':'Отмена', contextual?'sale-context-close':'back', true, { secondary: true }))}`}</div></section>`

}
function isSaleSurface() { return panel==='sale'||panel==='market'&&marketTab==='sell'&&Boolean(salePresentation.place) }
function currentSaleControl(control: Element) { return dialog.open && isSaleSurface() && salePresentation.accepts(control.closest<HTMLElement>('.exact-sale')?.dataset.saleToken,selectedSale) }
function closeContextualSale(restoreFocus=true) {
  const place=salePresentation.place,key=selectedSale?.key
  if(!place)return false
  salePresentation.reset()
  if(panel==='market'&&marketTab==='sell'){
    updateMarketSaleSearch()
    if(restoreFocus){dialogContent.scrollTop=place.scroll;const source=[...dialogContent.querySelectorAll<HTMLButtonElement>('[data-action="sell-item"]')].find(item=>item.dataset.value===key);const target=source??dialogContent.querySelector<HTMLInputElement>('[data-market-sale-query]');target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest'})}
  }
  return true
}

function beginExactSale(target: SaleTarget) {
  const stock = saleStock(farm, target)
  if (!stock || stock.count < 1) return
  const listing = target.kind==='market' ? goods().find(item=>item.key===target.key) : undefined
  const name = target.kind === 'signature' ? farm.culinary.recipes.find(recipe => recipe.id === target.key)!.name
    : listing!.name
  const contextual = panel==='market'&&marketTab==='sell'&&target.kind==='market'
  const position = contextual ? searchMarketSales(goods(),marketSellGroup,marketSaleQuery,marketSaleFamily).items.findIndex(item=>item.key===target.key) : -1
  if(contextual&&position<0)return
  const scroll = salePresentation.place && selectedSale?.key===target.key ? salePresentation.place.scroll : dialogContent.scrollTop
  salePresentation.open(target,contextual?{index:position,scroll}:undefined)
  selectedSale = { ...target, name, image:listing?.image, trait:listing?.trait }; saleQuantity = '1'; saleReceipt = undefined
  if(contextual){updateMarketSaleSearch();dialogContent.querySelector<HTMLElement>('.market-sale-expanded')?.scrollIntoView({block:matchMedia('(max-height:400px) and (orientation:landscape)').matches?'start':'nearest'})}
  else openPanel('sale')
  dialogContent.querySelector<HTMLElement>('.exact-sale h2')?.focus({preventScroll:true})
}

function updateSaleQuote() {
  if (!isSaleSurface() || !selectedSale || saleReceipt) return
  const stock = saleStock(farm, selectedSale)
  const quote = stock && exactSaleQuote(saleQuantity, stock.count, stock.price)
  const summary = dialogContent.querySelector<HTMLElement>('.exact-sale-summary')
  const confirm = dialogContent.querySelector<HTMLButtonElement>('[data-action="confirm-sale"]')
  if (summary) summary.textContent = quote?.valid ? `Итого: ${quantity(quote.total, 'монета')}. Останется: ${quote.remaining}.`
    : `Введите целое число от 1 до ${stock?.count ?? 0}.`
  if (confirm) {
    confirm.disabled = !quote?.valid
    confirm.textContent = quote?.valid ? `Продать ${quote.quantity} · ${quote.total}` : 'Продать выбранное'
    confirm.setAttribute('aria-label',quote?.valid ? `${confirm.textContent} ${ruPlural(quote.total,['монета','монеты','монет'])}` : 'Продать выбранное')
  }
  dialogContent.querySelectorAll<HTMLButtonElement>('[data-action="sale-step"]').forEach(control=>{
    control.disabled = !stock?.count || Boolean(quote?.valid && (control.dataset.value==='less' ? quote.quantity<=1 : quote.quantity>=stock.count))
  })
}

function confirmExactSale(focusReceipt = false) {
  if (!isSaleSurface() || !selectedSale || saleReceipt) return
  const stock = saleStock(farm, selectedSale)
  const quote = stock && exactSaleQuote(saleQuantity, stock.count, stock.price)
  if (!quote?.valid) { updateSaleQuote(); return }
  const result = selectedSale.kind === 'signature' ? sellSignature(farm, selectedSale.key, quote.quantity)
    : sellMarketItem(farm, selectedSale.key, quote.quantity)
  if (result.ok) saleReceipt = { quantity: quote.quantity, total: quote.total, remaining: quote.remaining }
  if (perform(() => result, false, true)) {
    playBaySound('trade.receive')
    if(focusReceipt)dialogContent.querySelector<HTMLElement>('.exact-sale-receipt')?.focus({preventScroll:true})
  }
}


let disposeCoopServices: (() => void) | undefined
function stopCoopServices() {
  const dispose = disposeCoopServices
  disposeCoopServices = undefined
  dispose?.()
}

function drawPanel() {
  if (!panel || harbourScene) return
  if (panel === 'fishing' && fishingGame || panel === 'workshop' && workshopGame || panel === 'cookery' && cookeryGame || panel === 'arrangement' && arrangementGame) return
  stopCoopServices()
  if (panel === 'recipes') { recipeBook.capture(dialogContent); recipeBook.reconcile(farm) }
  const guideGardenOpen = panel === 'guide' && (dialogContent.querySelector<HTMLDetailsElement>('[data-guide-garden]')?.open ?? false)
  // Keep an open note only on the same hen's mounted card, not on a new visit.
  const henNotesOpen = panel === 'hen-friendship' && dialog.open
    && dialogContent.querySelector<HTMLButtonElement>('.hen-friend-select[aria-pressed="true"]')?.dataset.value === String(selectedFriendHen)
    && dialogContent.querySelector<HTMLDetailsElement>('.hen-friend-notes')?.open
  panelRenderVersion++
  requirementLinks.clear()
  const sceneBack=dialog.querySelector<HTMLButtonElement>('.scene-back')!
  sceneBack.hidden=panelHistory.length===0||panel!=='fishing'&&panel!=='workshop'&&panel!=='cookery'&&panel!=='arrangement'
  sceneBack.setAttribute('aria-label',panelHistory.length?`Назад: ${panelTitles[panelHistory.at(-1)!.panel]}`:'Назад')
  const recipeBack = panel === 'recipes' && recipeBook.view.mode === 'detail' && recipeBookNarrow() && (recipeBook.view.fromIndex || panelHistory.length===0)
  backButton.hidden=!recipeBack&&panelHistory.length===0
  backButton.textContent=recipeBack?'‹ К списку':'‹'
  backButton.dataset.recipeIndex=String(recipeBack)
  backButton.setAttribute('aria-label',recipeBack?'К списку рецептов':panelHistory.length?`Назад: ${panelTitles[panelHistory.at(-1)!.panel]}`:'Назад')
  for (const back of [backButton, sceneBack]) {
    back.title = `${back.getAttribute('aria-label')} (Esc / Alt + ←)`
    back.setAttribute('aria-keyshortcuts', 'Escape Alt+ArrowLeft')
  }
  closeButton.title = panelHistory.length ? 'Закрыть все меню' : 'Закрыть меню (Esc)'
  const destinations = dialog.querySelector<HTMLElement>('.dialog-destinations')!
  const destinationHeader = dialog.querySelector<HTMLElement>('.dialog-header')!
  const inlineMarket=panel==='market'&&(marketTab==='sell'||marketTab==='orders'||marketTab==='buy'&&(marketCategory==='seeds'||marketCategory==='trees'||marketCategory==='care'))
  if(inlineMarket){
    if(destinations.nextElementSibling!==destinationHeader)destinationHeader.before(destinations)
  }else if(destinationHeader.nextElementSibling!==destinations)destinationHeader.after(destinations)
  let marketWallet=destinationHeader.querySelector<HTMLElement>('.market-inline-wallet')
  if(inlineMarket){
    if(!marketWallet){marketWallet=document.createElement('p');marketWallet.className='market-inline-wallet';destinationHeader.insertBefore(marketWallet,closeButton)}
    marketWallet.innerHTML=`${icon('coin')} ${numberFormat.format(farm.coins)}`
    marketWallet.setAttribute('aria-label',quantity(farm.coins,'монета'))
  }else marketWallet?.remove()
  dialog.querySelectorAll<HTMLButtonElement>('.dialog-destinations [data-panel]').forEach(button=>button.setAttribute('aria-current',String(button.dataset.panel===panel)))
  const title = panel === 'specialize' ? `${buildingDefinitions[specializationBuilding].name} · ур. 3`
    : panel === 'workshop' && workshopRecipe === 'bread' ? 'Домашний хлеб' : panel === 'neighbor' ? residentDefinitions[communityResident].name : panelTitles[panel]
  dialogTitle.textContent = recipeBack?'Рецепт':panelBanners[panel] ?? title
  dialogTitle.setAttribute('aria-label', title)
  // A different rendered panel ends the Buy shelf's same-Market tab visit.
  if (panel === 'market' && dialog.dataset.panel !== 'market') marketSaleBrowse.resetBuySeeds()
  dialog.dataset.panel = panel
  dialog.dataset.marketTab = marketTab
  dialogEmblem.src = iconUrl(panel === 'specialize' ? `upgrade-${specializationBuilding}-card` : panelEmblems[panel])
  const activeInput = document.activeElement
  const focusedSaleSearch = panel === 'market' && marketTab === 'sell' && activeInput instanceof HTMLInputElement
    && activeInput.matches('[data-market-sale-query]') && dialogContent.contains(activeInput)
    ? {start:activeInput.selectionStart, end:activeInput.selectionEnd, direction:activeInput.selectionDirection} : undefined
  const focusedInlineKey = panel === 'market' && marketTab === 'sell' && activeInput instanceof HTMLInputElement
    && activeInput.matches('[data-inline-quantity]') && dialogContent.contains(activeInput)
    ? activeInput.closest<HTMLElement>('[data-inline-key]')?.dataset.inlineKey : undefined
  const oldSaleGrid = focusedInlineKey ? dialogContent.querySelector<HTMLElement>('#market-sale-results') : null
  const inlineEditorTop = oldSaleGrid && activeInput ? activeInput.getBoundingClientRect().top - oldSaleGrid.getBoundingClientRect().top : undefined
  const focusedStorageChoice = document.activeElement instanceof HTMLSelectElement && document.activeElement.matches('[data-tree-storage-choice]') && dialogContent.contains(document.activeElement)
  const focused = document.activeElement instanceof HTMLButtonElement && dialogContent.contains(document.activeElement)
    ? document.activeElement
    : undefined

  const focusedSeedCrop = focused?.matches('[data-seed-pack] [data-action="buy-seeds"]:focus-visible') ? focused.dataset.crop : undefined

  switch (panel) {
    case 'recipe-surplus':
      dialogContent.innerHTML = renderRecipeSurplus(farm, recipeSurplusSelection, item => stockLabel(item).name)
      break
    case 'sale': {
      dialogContent.innerHTML = exactSaleCard(false)
      updateSaleQuote()
      break
    }
    case 'festival':
      dialogContent.innerHTML=renderFestivalPanel(farm,{celebrated:celebratedFestival,celebrationEffect:celebrationReceipt?.effect,celebrationCoins:celebrationReceipt?.coins,icon,itemIcon})
      break
    case 'bay-shop':
    case 'bay-music': {
      const host=document.createElement('section')
      dialogContent.replaceChildren(host)
      if(panel==='bay-shop')openShopScene(host,nextShopMarketVisit);else openMusicScene(host)
      break
    }
    case 'shop-commissions':
      dialogContent.innerHTML = renderShopCommissions(farm, id => { const recipe = farm.culinary.recipes.find(recipe => recipe.id === id); return recipe ? signatureResultPicture(recipe,{icon}) : '' }, shopAssortmentChoice, shopCommissionView)
      break
    case 'warehouse-supply': {
      const request = selectedWarehouseRequest, supply = request && getLocalWarehouseSupply(farm, request)
      dialogContent.innerHTML = request ? `<section class="music-supply"><h2>${itemIcon(stockLabel(request).image)} ${escapeHtml(stockLabel(request).name)}</h2><p>${escapeHtml(warehouseSupplyCopy(farm, request))}</p><p>Перенос только в припасы. Ничего не готовится и не вносится в проект.</p>${supply ? button(`Забрать в припасы ×${supply.quantity}`, 'warehouse-supply-withdraw', true, {value:warehouseConfirmationValue(supply)}) : ''}</section>${nav(button('Назад', 'back', panelHistory.length > 0, {secondary:true}))}` : '<p>Выберите нужный запас через подсказку ингредиента.</p>'
      break
    }
    case 'music-supplies': {
      const guide = getMusicMaterialGuidance(farm), stock = gardenMaterialStock(farm)
      type Port = typeof islandIds[number]
      type Place = { balances:string[]; pickups:string[]; sources:string[]; visit:boolean; saltTrade:boolean }
      const places = new Map<Port, Place>()
      const otherSources: string[] = []
      const at = (port: Port): Place => {
        const found = places.get(port)
        if (found) return found
        const place = {balances:[],pickups:[],sources:[],visit:false,saltTrade:false}
        places.set(port,place)
        return place
      }
      const materials = guide.materials.map(item => {
        const name = musicMaterialNames[item.id], material = musicMaterialItems[item.id]
        const reserve = farm.freight.warehouses.village[item.id] ?? 0, bag = stock[item.id] - reserve
        const missing = Math.max(0,item.quantity-stock[item.id])
        if (item.id === 'seaSalt') at('grove').saltTrade = true
        for (const port of islandIds) {
          const amount = farm.freight.warehouses[port][item.id] ?? 0
          if (port === 'village' || amount <= 0) continue
          const place = at(port), count = Math.min(missing,amount)
          place.balances.push(`${name} ×${amount}`)
          if (count && port === farm.island)
            place.pickups.push(button(`Забрать в припасы ×${count}`,'freight-withdraw',true,{value:`${port}|${item.id}|${count}`,context:name}))
          if (count && port !== farm.island) place.visit = true
        }
        if (missing) {
          // Display groups, never replace routes: the same request is resolved again at actual arrival.
          const saltSource = item.id === 'seaSalt' && getMusicSaltRequirement(farm)
          const requirement: Requirement = saltSource || {kind:'stock',item:{...material,quantity:item.quantity-reserve}}
          const {action} = getRequirementHint(farm,requirement)
          const port = action.target === 'sail' ? islandIds.find(id => id === action.value)
            : action.target === 'focus-shell' || action.target === 'visit-hive' || action.target === 'warehouse-supply'
              || action.target === 'focus-place' && (action.value === 'salt' || action.value === 'farmhouse')
              || action.target === 'open-panel' && (action.value === 'cape-upgrade' || action.value === 'rest') ? farm.island : undefined
          const arrival = port && port !== farm.island ? getRequirementHint({...farm,island:port},requirement).action : action
          const label = arrival.target === 'focus-shell' ? 'К ракушкам' : arrival.target === 'focus-place' && arrival.value === 'salt' ? 'К солончаку'
            : arrival.target === 'visit-hive' ? 'К улью' : arrival.target === 'warehouse-supply' ? `Посмотреть запас: ${name}`
            : `Где взять: ${name}`
          const link = requirementLink(`<span>${label}</span>`,requirement,'ingredient',name,false,'',{key:`music-${item.id}`,label:label.includes(name) ? label : `${label} · ${name}`})
          ;(port ? at(port).sources : otherSources).push(link)
        }
        return row(stockLabel(material).image,`${name} · ${stock[item.id]}/${item.quantity}${missing ? '' : ' ✓'}`,
          `В припасах ${bag} · На складе Гавани ${reserve}`)
      }).join('')
      const ranked = [...places].sort(([,a],[,b]) => Number(!!b.sources.length)-Number(!!a.sources.length))
      const active = (place: Place) => place.visit || place.pickups.length > 0 || place.sources.length > 0
      const sources = (links:string[]) => links.length ? `<ul class="ingredients music-source-links">${links.join('')}</ul>` : ''
      const region = ([port,place]: [Port,Place]) =>
        `<section class="music-supply" data-music-port="${port}"><h2>${islandNames[port]}</h2>
        ${place.balances.length ? `<small>${place.balances.join(' · ')}</small>` : ''}
        ${place.visit || place.pickups.length || place.sources.length ? nav(place.visit
          ? button('К складу','music-warehouse-visit',canSailTo(farm,port),{value:port,context:islandNames[port]}) : '',
          ...place.pickups,sources(place.sources)) : ''}
        ${place.saltTrade ? '<small>Торговый рейс: морская соль</small>' : ''}</section>`
      dialogContent.innerHTML = `<div class="music-stock-sheet"><ul class="dialog-list" aria-label="Материалы инструмента">${materials}</ul>
        ${ranked.filter(([,place])=>active(place)).map(region).join('')}${sources(otherSources)}
        ${ranked.filter(([,place])=>!active(place)).map(region).join('')}${nav(button('Вернуться в музыкальный сад','open-panel',true,{value:'bay-music'}))}</div>`
      break
    }
    case 'bay-freight': {
      reconcileFreightPorts(farm.freight,openedFreightPorts(farm))
      const goods=harbourGoods()
      renderFreightPanelInto(dialogContent,farm.freight,{day:farm.day,harvestTier:farm.festivals.completed.harvest,coins:farm.coins,boatOwned:farm.boatOwned,villageBuilt:farm.village.built,expeditionPort:selectedExpeditionPort,expeditionOffer:selectedExpeditionOffer,playerPort:farm.island,selectedPort:selectedWarehouse,waxAvailable:farm.capeLevel>=2,routeEditorOpen:dialogContent.querySelector<HTMLDetailsElement>('.bay-freight-plan')?.open ?? freightPlanOpen,
        openedPorts:openedFreightPorts(farm),products:goods,carried:Object.fromEntries(goods.map(g=>[g.id,g.quantity])),commissionUse:ferryCommissionUse(farm),peachPlanting:ferryPeachPlanting.current(farm),readyHarvest:offer=>getFerryReadyHarvest(farm,offer),groveBun:offer=>getFerryGroveBunSource(farm,offer),icon})
      break
    }
    case 'intents': dialogContent.innerHTML = communityBoard(farm, communityArt); break
    case 'intent': dialogContent.innerHTML = communityIntent(farm, communityOrderId, communityArt); break
    case 'neighbor': dialogContent.innerHTML = neighborDetail(farm, communityResident, communityArt) + (farm.neighbors[communityResident].completed>0?nav(button('Пригласить к себе на ферму','visit-book-home',true,{value:communityResident,secondary:true})): ''); break
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
      let completed = false, continuing = false, nextCrateQuote: string | undefined
      const sameBench = () => panel === 'arrangement' && arrangementRequest === request
      dialogContent.innerHTML = '<div class="arrangement-host"></div>'
      arrangementGame = createArrangement(dialogContent.querySelector<HTMLElement>('.arrangement-host')!, {
        mode: request.kind === 'neighbor' ? plan!.arrangement : request.mode,
        title: request.kind === 'neighbor' ? plan!.title : request.mode === 'eggs' ? 'Корзинка яиц' : 'Ящик яиц', food,
        onNextCrate: request.kind === 'packing' && request.mode === 'crate' ? () => {
          if (!sameBench() || !completed || continuing || !nextCrateQuote || nextContractCrateQuote(farm) !== nextCrateQuote) return false
          continuing = true; completed = false
          return true
        } : undefined,
        onComplete(result) {
          if (completed) return true
          if (!sameBench() || continuing && nextContractCrateQuote(farm) !== nextCrateQuote) return false
          completed = true
          if (!perform(() => request.kind === 'neighbor' ? finishNeighborPlan(farm, request.id, result as NeighborAssembly)
            : request.mode === 'eggs' ? packEggBasket(farm, result as PackingResult) : packEggCrate(farm, result as PackingResult), false, true)) {
            completed = false
            return false
          }
          if (request.kind === 'packing' && request.mode === 'crate' && !continuing) {
            nextCrateQuote = nextContractCrateQuote(farm)
            if (nextCrateQuote) return 'next-crate'
          }
          queueMicrotask(() => {
            if (!sameBench()) return
            if (request.kind === 'neighbor') {
              freshFinnRide=plan!.resident==='finn'?finnPicnicRide(farm):undefined
              closeDialog()
            }
            else { panelHistory.length = 0; openPanel('coop', false) }
          })
          return true
        },
        onCancel() {
          if (request.kind === 'neighbor') { if (sameBench()) returnFromNeighborArrangement() }
          else leaveScene()
        },
      })
      break
    }
    case 'market':
      dialogContent.innerHTML = marketCards()
      if (marketTab === 'orders') placeReadyMarketOrder(dialogContent, stackedMarketOrders.matches)
      break
    case 'berry-renewal':
      dialogContent.innerHTML = renderBerryRenewal(farm, berryRenewalSelection, icon)
      break
    case 'berry-nursery':
      dialogContent.innerHTML = renderBerryNursery(farm, berryNurserySelection, icon)
      break
    case 'garden-plans':
      dialogContent.innerHTML = renderGardenPlans(farm, gardenEditor, icon)
      break
    case 'transplant':
      dialogContent.innerHTML = renderBedTransplant(farm, transplantSelection)
      break
    case 'inventory':
    case 'seeds': {
      const inventory = panel === 'inventory'
      const harvest = inventory && bagTab === 'harvest'
      dialogContent.innerHTML = `${inventory ? panelTabs('bag-tab', bagTab, [['seeds', 'Семена'], ['harvest', 'Припасы'], ['archive', 'Коллекции']], 'Разделы запасов') : ''}
        ${harvest ? inventorySupplies() : seedCards()}`
      break
    }
    case 'archive':
    case 'grove-display': {
      const pearl = panel === 'grove-display' && archiveGroup === 'bay' ? grovePearlCabinet(farm) : 'hidden'
      dialogContent.innerHTML = (pearl === 'place' || pearl === 'take'
        ? nav(button(pearl === 'place' ? 'Поставить жемчужину' : 'Забрать жемчужину', 'grove-pearl-display', true, {value:pearl})) : '')
        + panelTabs('archive-group', archiveGroup, [['crops', 'Грядки'], ['orchard', 'Сад'], ['coop', 'Курятник'], ['shore', 'Берег'], ['bay', 'Бухта']])
        + archiveCards(farm, archiveGroup, (name, trait) => itemIcon(archiveIcons[name] ?? name, trait))
      break
    }
    case 'hive': {
      const preview = getApiaryCopy(farm)
      const wind = getWindHoneySource(farm)
      const bunch = hiveFlower === undefined ? undefined : getCapeBouquetPreview(farm,hiveFlower)
      const harvest = preview.harvest
      const upgrade = getCapeUpgrade(farm)
      // A payable Apiary improves this still-available harvest, without replacing it.
      const readyChoice = hiveFlower === undefined && upgrade?.nextLevel === 2 && upgrade.available && preview.now.available
      const gatherAction = preview.planted === 0
        ? button('К свободной клумбе', 'focus-flower', true, { value: farm.capeFlowers.indexOf(null) })
        : preview.waiting ? button('Домой к отдыху', 'visit-rest')
        : button(preview.harvested ? 'Собрано' : 'Собрать мёд', 'collect-honey', preview.now.available)
      const upgradeAction = upgrade ? button('Улучшить', 'cape-upgrade', true, { secondary: !readyChoice })
        : button('Медовая кухня', 'visit-honey-kitchen', true, { secondary: true })
      dialogTitle.textContent = farm.capeLevel >= 2 ? 'Цветочная пасека' : 'Улей мыса'
      dialogTitle.setAttribute('aria-label', dialogTitle.textContent)
      dialogContent.innerHTML = `<div class="apiary-preview"><p class="dialog-intro">${preview.summary}</p>
        ${harvest ? `<section aria-label="${preview.heading}"><h2 class="dialog-status">${preview.heading}</h2>
          <ul class="dialog-list">${row('ui-honey', 'Цветочный мёд', `×${harvest.honey}`)}
            ${harvest.windHoney ? row('ui-wind-honey', 'Мёд ветров', `×${harvest.windHoney}`) : ''}
            ${harvest.wax ? row('ui-beeswax', 'Пчелиный воск', `×${harvest.wax}`) : ''}</ul>
          ${harvest.windHoney ? '<p class="dialog-intro">Мёд ветров заменяет одну обычную порцию.</p>' : ''}</section>` : ''}
        ${bunch ? nav(button(`Срезать букет · ${bunch.cost}${bunch.delaysUpgrade ? ' · улучшение не раньше завтра' : ''}`, 'cape-bouquet', true, {value:bunch.token, secondary:true})) : ''}
        ${readyChoice ? nav(upgradeAction, gatherAction) : ''}
        ${preview.note ? `<p class="dialog-intro">${preview.note}</p>` : ''}
        <section aria-label="Мёд ветров"><h2 class="dialog-status">Мёд ветров</h2><p class="dialog-intro">${wind.detail}</p></section>
        ${wind.kind === 'wait' && !preview.waiting ? nav(button('Домой к отдыху', 'visit-rest', true, {secondary:true})) : ''}
        ${readyChoice ? '' : nav(gatherAction, upgradeAction)}</div>`
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
      dialogContent.innerHTML = renderHoneyKitchenMenu(honeyKitchenDish, dish => icon(dishIcons[dish]), recipeCards)
      break
    }
    case 'recipes': {
      recipeBook.view.expandedRepeatId=expandedRepeatId
      const origin=panelHistory.at(-1),pair=origin?.panel==='shop-commissions' && origin.commissionRecipe && recipeBook.view.mode==='detail'
        ? getCommissionRecipePair(farm,origin.commissionRecipe.line,recipeBook.view.selectedId) : undefined
      dialogContent.innerHTML=signatureBook(farm,{icon,stock:stockTile},recipeBook.view,pair)
      break
    }
    case 'signature': dialogContent.innerHTML=signatureStudio(farm,signatureBase,signatureSlots,signatureSlot,{icon,stock:stockTile},currentCommunityRequest()?.intentId);break
    case 'cove': {
      const action=getCoveActions(farm)
      dialogContent.innerHTML=action.available?coveControls(farm,island.isCoveObserving()):`<div class="cove-locked">${icon('ui-shell')}<p>Найдите ракушку, чтобы обустроить берег.</p>${button('Найти ракушки','cove-shells')}</div>`
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
      const picnic = ready && !guest.served ? fairJamPicnicChoice(farm) : undefined
      dialogContent.innerHTML = (guest.served ? `<p class="dialog-status">Сегодняшний гость уже угощён.</p>${button('К отдыху дома','visit-rest')}`
        : `<ul class="ingredients">${stockTile(guest.item)}</ul>
          <ul class="dialog-list">${row('coin', 'Монеты', `+${guest.reward}`)}
            ${row(`ui-seed-${guest.seeds.crop}`, `Семена: ${cropDefinitions[guest.seeds.crop].name.toLowerCase()}`, `+${guest.seeds.count}`)}</ul>
          ${nav(button(picnic ? 'Угостить · открыть стройку гавани' : 'Угостить', 'serve-guest', ready),
            picnic ? button(`К пикнику · ${quantity(picnic.reward,'монета')}`, 'fair-jam-picnic', true, {value:picnic.id,secondary:true}) : '')}`) + renderFairReturn(farm,stockTile)
      break
    }
    case 'neighbor-visits':
      dialogContent.innerHTML = renderNeighborVisits(farm, icon, () => `<ul class="ingredients">${workshopIngredients.map(stockTile).join('')}</ul>`)
      break
    case 'hen-friendship':
      dialogContent.innerHTML = renderHenFriendship(farm, island.henWalkStatus(), island.henWalkAvailable(), selectedFriendHen, icon, island.henFieldTarget(selectedFriendHen))
      if (henNotesOpen) {
        const notes = dialogContent.querySelector<HTMLDetailsElement>('.hen-friend-notes')
        if (notes) notes.open = true
      }
      break
    case 'chicken-feed':
      dialogContent.innerHTML = renderChickenFeedMixes(farm, icon, panelHistory.at(-1)?.panel === 'rest')
      break
    case 'coop': {
      void bayAudio.primeEvents(['flock.stroke', 'flock.feed', 'flock.eggs', 'flock.hatch'])
      // Feed and collect refresh the numbers, without closing an actively viewed forecast.
      const forecastOpen = dialog.open && dialogContent.querySelector<HTMLDetailsElement>('.coop-forecast')?.open
      dialogContent.innerHTML = renderCoopPanel(farm, {icon,row,button,feedRow:flockFeedRow})
      disposeCoopServices = groupCoopServices(dialogContent)
      if (forecastOpen) {
        const forecast = dialogContent.querySelector<HTMLDetailsElement>('.coop-forecast')
        if (forecast) forecast.open = true
      }
      break
    }
    case 'rest': {
      const hatch = farm.hatchDay === null ? '' : farm.hatchDay === farm.day + 1
        ? 'К утру вылупится курочка.' : `Курочка вылупится утром дня ${farm.hatchDay}.`
      dialogContent.innerHTML = `<section class="rest-decision" aria-label="Отдых до утра">${renderSelectedIntentRest(farm,communityRequest)}<header class="rest-morning"><div><strong>Сейчас · день ${farm.day}</strong><span>Утром · день ${farm.day + 1} · ${weatherNames[getClimate(farm.day + 1).weather]}</span>${hatch ? `<span>${hatch}</span>` : ''}</div>${button('До утра', 'sleep', true, {value:farm.day})}</header><p class="rest-commit-note">Сон завершит этот день. Вернуться назад нельзя.</p>${renderShopRest(farm)}</section>
        <div class="home-morning-preview">${renderHomeFestivalPreparation(farm)}${renderRestPreview(farm,true)}${renderFerryReturn(farm,harbourGoods(),true)}</div>
        <div class="rest-before-morning">${renderVisitRest(farm)}${farm.neighborVisits.active?nav(button('Поговорить с гостем', 'open-panel',true,{value:'neighbor-visits',secondary:true})):''}${renderPicnicStatus(farm,true)}${renderCoopCapacityWarning(farm,true)}${!farm.chickensFed ? `<ul class="dialog-list">${flockFeedRow()}</ul>` : ''}</div>
        <details class="home-rest-details home-rest-services"><summary>${farm.village.built&&!farm.neighborVisits.active?'Кухня, гости и улучшения':'Кухня и улучшения'}</summary><div>${farm.village.built&&!farm.neighborVisits.active?nav(button('Гостевая книга', 'open-panel',true,{value:'neighbor-visits',secondary:true})):''}${nav(button('Открыть кухню', 'kitchen'), button('Улучшения', 'upgrades', true, { secondary: true }))}</div></details>`
      if (farm.freight.expeditions.active?.phase === 'sailing' && panelHistory.at(-1)?.ferryMorning === farm.freight.expeditions.active.serial)
        dialogContent.querySelector<HTMLButtonElement>('[data-action="sleep"]')!.textContent = 'До утра · к парому'
      break
    }
    case 'journal': {
      const goal = currentTask(), journal = getDiscoveryJournal(farm)
      const guidance = renderDiscoveryGuidance(farm.discoveryPreferences, getDiscoveryTask(farm, farm.orientation), goal)
      const chapter = journal.current
      const groveActivities = farm.island === 'grove'
        ? row('tool-rod', 'Рыбалка в роще', `Сегодня поймано: ${farm.fishCaughtToday.grove} / ${getFishLimit(farm, 'grove')}`)
          + row('ui-sea-salt', 'Морская соль', farm.saltGatheredToday ? 'Сегодня собрано' : 'Можно собрать на солончаках')
        : ''
      dialogContent.innerHTML = `${renderFerryReturn(farm,harbourGoods())}${guidance.focus}<section class="discovery-chapter">
          ${icon(chapter?.icon ?? 'star')}<div><small>Знакомство с бухтой · ${journal.completed}/${journal.chapters.length}</small><h2>${chapter?.title ?? 'Бухта живёт дальше'}</h2></div>
          <p>${chapter?.detail ?? 'Продолжайте свои рецепты, встречи с соседями и новые праздники. Каждая традиция может расти дальше.'}</p>
        </section>
        ${guidance.settings}
        <p class="discovery-tip">${journal.tip}</p>
        ${journal.next ? `<section class="discovery-next"><strong>Впереди: ${journal.next.title.toLowerCase()}</strong><p>${journal.next.detail}</p></section>` : ''}
        <details class="discovery-roadmap"${journalDetailsOpen ? ' open' : ''}><summary>Все открытия бухты</summary><ol>${journal.chapters.map(chapter => `<li data-current="${chapter.id === journal.current?.id}" data-complete="${chapter.complete}">${icon(chapter.icon)}<strong>${chapter.title}</strong><small>${chapter.complete ? 'Открыто' : chapter.id === journal.current?.id ? 'Сейчас' : 'Впереди'}</small></li>`).join('')}</ol></details>
        ${groveActivities ? `<ul class="dialog-list">${groveActivities}</ul>` : ''}
        ${journal.activities.length ? `<nav class="discovery-activities" aria-label="Другие занятия">${journal.activities.map(activity => {
          const card = `${icon(activity.icon)}<strong>${activity.label}</strong><small>${activity.detail}</small>`
          const visitAction = activity.panel === 'bay-music' ? 'journal-music' : activity.panel === 'festival' ? 'journal-festival'
            : activity.panel === 'bay-shop' ? 'journal-shop' : undefined
          if (visitAction && activity.visit !== undefined) return `<details class="journal-visit-crossing"><summary>${card}</summary><div><button type="button" data-action="journal-stay">Остаться на ферме</button><button type="button" data-action="${visitAction}" data-value="${activity.panel}" data-visit="${activity.visit}">Плыть в гавань</button></div></details>`
          return `<button type="button" data-action="${visitAction ?? 'open-panel'}" data-value="${activity.panel}">${card}</button>`
        }).join('')}</nav>` : ''}`
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
      const places: string[] = [], garden: string[] = []
      const tile = (name: string, image: string, value: Panel, action = 'open-panel') =>
        `<button class="explore-tile" type="button" data-action="${action}" data-value="${value}">${icon(image)}<strong>${name}</strong></button>`
      if (farm.island === 'grove') places.push(tile('Сад','ui-tree-apple','orchard'),tile('Рыбалка','tool-rod','fishing'))
      if (home) {
        places.push(tile('Дом','upgrade-farmhouse-card','rest'),tile('Курятник','tool-hen','coop'),tile('Рынок','ui-market','market'),tile('Улучшения','hammer','upgrades'),tile('Рыбалка','tool-rod','fishing'))
        garden.push(tile('Сад','ui-tree-apple','orchard'),tile('Свои планы огорода','field','garden-plans'),tile('Пересадка культур','tool-seeds','transplant'),tile('Размножить ягодный куст','ui-seed-blueberry','berry-nursery'),tile('Свой ягодник','ui-seed-strawberry','berry-renewal'))
        if (isProjectComplete(farm,'fair')) places.push(tile('Гость ярмарки','ui-market','guest'),tile('Просьбы соседей','ui-bea','intents'))
      }
      if (village) {
        places.push(tile('Своя лавка','bay/pavilion','bay-shop'),tile('Музыкальный сад','bay/music-harp','bay-music'),tile('Соседи','ui-bea','village'))
        if (!getVillageMeal(farm, pastryShape).served) places.push(tile('Общий ужин','ui-grilled-fish','village-meal'))
      }
      if (farm.island === 'cape') {
        places.push(tile('Пасека','ui-honey','hive'))
        if (farm.capeLevel >= 3) places.push(tile('Медовая кухня','ui-honey-biscuits','honey-kitchen'))
      }
      if (farm.island === 'grove') {
        places.push(tile('Живая заводь','ui-shell','cove'))
        if (hasShoal(farm)) places.push(tile('Лунная отмель','ui-moon-pearl','shoal'))
      }
      if (village || home && isProjectComplete(farm,'fair')) places.push(tile('Кондитерская','ui-handmade-round','workshop','workshop'))
      if (village) places.push(tile('Заказы лавки','ui-signature-bright','shop-commissions'),tile('Праздники гавани','festivals/lights','festival'))
      if (farm.boatOwned) places.push(tile('Грузовой паром','bay/ferry','bay-freight'))
      const away = [
        ...(!home ? [tile('Рынок дома','ui-market','market','travel-panel')] : []),
        ...(!village && farm.festivals.active ? [tile('Праздники гавани','festivals/lights','festival')] : []),
        ...(!village && farm.village.built ? [tile('Своя лавка','bay/pavilion','bay-shop'),tile('Музыкальный сад','bay/music-harp','bay-music')] : []),
      ]
      dialogContent.innerHTML = `<section class="explore-section"><h2>${islandNames[farm.island]}</h2><div class="explore-grid">${places.join('')}</div></section>
        ${garden.length ? `<details class="guide-garden-group" data-guide-garden${guideGardenOpen ? ' open' : ''}><summary>${icon('field')}<strong>Огород и сад</strong></summary><div class="explore-grid">${garden.join('')}</div></details>` : ''}
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
      let made = false, basketDay: number | undefined
      const cottage = !bread && farm.island === 'village' ? panelHistory.at(-1) : undefined
      const resident = cottage?.panel === 'village' ? farm.village.residents[cottage.villageSlot] : undefined
      const sameCottage = () => cottage?.panel === 'village' && !!resident && panel === 'workshop' && farm.island === 'village'
        && panelHistory.at(-1) === cottage && villageSlot === cottage.villageSlot && farm.village.residents[cottage.villageSlot] === resident
      let bakedSupper: {day: number; shape: WorkshopShape} | undefined
      const readySupper = () => bakedSupper?.day === farm.day && dialog.open && !island.isCrossing() && sameCottage()
        && getVillageMeal(farm,bakedSupper.shape).available ? bakedSupper : undefined
      workshopGame = createWorkshop(dialogContent.querySelector<HTMLElement>('.workshop-host')!, {
        initialShape: bread ? 'long' : pastryShape, recipe: bread ? 'bread' : 'pastry',
        onBake(shape) {
          if (made) return true
          if (panel !== 'workshop') return false
          const waiting = bread && getHomeBreadBasket(farm)?.status === 'waiting'
          const tableMissingPastry = sameCottage() && !getVillageMeal(farm,shape).served
            && !workshopShapes.some(choice => getVillageMeal(farm,choice).available)
            && !getReadySignatureSuppers(farm).some(choice => choice.available)
          made = perform(() => bread ? cookDish(farm, 'farmhouseBread') : bakeWorkshop(farm, shape), false, true)
          if (made && waiting && getHomeBreadBasket(farm)?.status === 'ready') basketDay = farm.day
          if (made && tableMissingPastry && getVillageMeal(farm,shape).available) bakedSupper = {day:farm.day,shape}
          return made
        },
        readyOrder: bread ? () => {
          if (basketDay !== farm.day || panel !== 'workshop') return
          const order = getHomeBreadBasket(farm)
          if (order?.status !== 'ready') return
          return { name: order.name, open() {
            if (!dialog.open || island.isCrossing()) return
            marketTab = 'orders'; selectedMarketOrder = order.lane
            // Replace the paid receipt: Back resumes its original kitchen, never a fresh batch.
            openPanel('market', false)
            const detail = dialogContent.querySelector<HTMLElement>('.market-order-detail')
            detail?.focus({preventScroll:true}); detail?.scrollIntoView({block:'nearest'})
          } }
        } : () => {
          const supper = readySupper()
          if (!supper) return
          return { name: 'Общий ужин', label: 'К ужину', open() {
            if (readySupper() !== supper) return
            pastryShape = supper.shape
            // Replace the paid workshop receipt without losing the cottage Back target.
            openPanel('village-meal',false)
            highlightControl(dialogContent.querySelector('.shared-supper-intro'))
          } }
        },
        onCancel: leaveScene,
      })
      break
    }
    case 'cookery': {
      const recipe = dishDefinitions[cookingDish], preparedFish = cookingFish, ingredients = getCookIngredients(farm,cookingDish,preparedFish)
      const signature=cookingMode==='signature',draft:SignatureDraft={base:signatureBase,ingredients:signatureSlots.filter((part):part is SignatureIngredient=>part!==null).map(part=>({...part}))},repeatId=signatureRepeatId,preparedDish=cookingDish
      const savedRecipe=signature&&repeatId?farm.culinary.recipes.find(recipe=>recipe.id===repeatId):undefined, familyName=signature?familyRecipeName(draft,signatureFamily):undefined
      const capacity=signatureBookCapacity(farm.culinary)
      if(signature&&!capacity.canCreate){
        dialogContent.innerHTML=`<p class="signature-capacity" role="status">${capacity.message}</p>${nav(button('Мои рецепты','recipe-book-return',true,{value:repeatId??''}))}`
        break
      }
      const action=signature?getSignatureAction(farm,draft):getCookAction(farm,preparedDish,preparedFish)
      if (!action.available) {
        dialogContent.innerHTML = `<ul class="ingredients">${(signature?getSignatureAction(farm,draft).items:ingredients).map(stockTile).join('')}</ul>${nav(button(signature?'Мои рецепты':'Кухня',signature?'recipe-book-return':'kitchen',true,signature?{value:repeatId??''}:{}))}`
        break
      }
      const selectedFruit=signature?draft.ingredients:recipe.ingredients.flatMap(part=>'item' in part&&signatureFruitIds.includes(part.item as typeof signatureFruitIds[number])?[{id:part.item,quantity:part.quantity}]:[])
      const kind=signature?draft.base==='tart'?'decorate':'preserves':(['honeyPear','honeyBiscuits','windParfait','honeyCake','grilledFish'] as const).find(id=>id===preparedDish)??(isTartDish(preparedDish)?'decorate':'preserves')
      let made=false, resultRecipeId=repeatId
      // The saved neighbour selection is an explicit travel shortcut, not this
      // cooking session's return address. Keep ordinary exits at their entry.
      const composer = panelHistory.at(-1), source = panelHistory.at(-2)
      // Manual cooking from a shop order uses the same exact recipe visit as
      // a quick repeat. A new preparation must not be presented as that order.
      const commissionOrigin = signature && repeatId && composer?.panel === 'recipes' && source?.panel === 'shop-commissions'
        ? source.commissionRecipe : undefined
      const commissionLineForReturn = () => {
        if (!commissionOrigin || panel !== 'cookery' || !dialog.open || farm.island !== 'village' || island.isCrossing()
          || panelHistory.at(-1) !== composer || panelHistory.at(-2) !== source || source?.commissionRecipe !== commissionOrigin) return
        const line = getShopCommissionLine(farm,commissionOrigin.line)
        return line && line.recipeId === repeatId && line.remaining > 0 ? line : undefined
      }
      // Mirror the first bread basket. Only a batch that completes the first
      // local preserves order from this kitchen can offer a finished receipt route.
      const preservesOrder = () => !signature && preparedDish === 'orchardPreserves'
        && farm.island === 'home' && farm.farmhouseSpecialization === 'preserves'
        && farm.orders.specialty.completed === 0 && composer?.panel === 'kitchen'
        && panelHistory.at(-1) === composer ? getMarketOrders(farm).find(order => order.lane === 'specialty') : undefined
      let preservesOrderDay: number | undefined
      const readyPreservesOrder = () => {
        if (preservesOrderDay !== farm.day || panel !== 'cookery' || !dialog.open || island.isCrossing()) return
        const order = preservesOrder()
        return order?.status === 'ready' ? order : undefined
      }
      const fromRequestedFood = composer?.panel === 'request-food'
      const ownDailyIntent = signature && !repeatId && composer?.panel === 'signature' && source?.panel === 'intent'
        ? source.dailyIntentComposerOrder : undefined
      const readyDailyIntent = () => {
        if (!ownDailyIntent || !made || !resultRecipeId || farm.island !== 'home' || panel !== 'cookery' || !dialog.open || island.isCrossing()
          || panelHistory.at(-1) !== composer || panelHistory.at(-2) !== source || communityOrderId !== ownDailyIntent) return
        const order = selectedDailyIntent(farm,communityRequest)
        return order?.id === ownDailyIntent && order.offers.some(offer => offer.id === `signature:${resultRecipeId}` && offer.available) ? order : undefined
      }
      const editingForNeighbor = () => signature && !made && !repeatId && composer?.panel === 'signature'
        && source?.panel === 'neighbor' && !!source.neighborComposerPlan && panelHistory.at(-1) === composer
        && communityRequest?.kind === 'neighbor' && communityRequest.planId === source.neighborComposerPlan
        && getNeighborPlans(farm).some(plan => plan.id === source.neighborComposerPlan && plan.resident === source.communityResident
          && (plan.phase === 'joined' || plan.phase === 'arranging'))
      // An unpaid local kitchen mix can be edited without reopening the book.
      const editingDraft = () => editingForNeighbor() || (signature && !made && !repeatId
        && (farm.island === 'home' || farm.island === 'village' && farm.village.built)
        && composer?.panel === 'signature' && source?.panel === 'kitchen'
        && panelHistory.at(-1) === composer && panelHistory.at(-2) === source)
      dialogContent.innerHTML = '<div class="cookery-host"></div>'
      cookeryGame = createCookery(dialogContent.querySelector<HTMLElement>('.cookery-host')!, {
        recipe: { id: signature?repeatId??'signature':preparedDish, name:signature?savedRecipe?.name??familyName??'Мой рецепт':preparedDish==='grilledFish'?`${fishDefinitions[preparedFish].name} на гриле`:recipe.name, kind, signature,processing:savedRecipe?.processing,fishSpecies:preparedDish==='grilledFish'?preparedFish:undefined,
          selectedFruit,fruitOptions:selectedFruit.map(part=>({id:part.id,name:signatureFruitNames[part.id as typeof signatureFruitIds[number]],art:part.id==='apple'?'apple-slice':part.id==='pear'?'pear-piece':part.id==='peach'?'peach-slice':part.id})),
          ingredients:(signature?getSignatureAction(farm,draft).items:ingredients).map(item=>({name:stockLabel(item).name,icon:iconUrl(stockLabel(item).image),count:item.quantity,...(item.kind==='variants'?{trait:item.trait}:{})})) },
        get returnLabel() { return editingDraft() ? 'К выбору ингредиентов' : fromRequestedFood ? 'К рецепту' : signature ? 'Мои рецепты' : 'На кухню' },
        ...(ownDailyIntent ? {readyOrder() {
          const order = readyDailyIntent()
          if (!order) return
          return {name:order.title,label:'К просьбе',primary:true,open() {
            if (readyDailyIntent()?.id !== order.id) return
            // Drop the paid scene's composer and request, but retain the request board for Back.
            panelHistory.length -= 2
            openPanel('intent',false)
            const heading = dialogContent.querySelector<HTMLElement>('.community-intent h2')
            if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}) }
          }}
        }} : !signature && preparedDish === 'orchardPreserves' ? {readyOrder() {
          const order = readyPreservesOrder()
          if (!order) return
          return {name: order.name, open() {
            if (!readyPreservesOrder()) return
            marketTab = 'orders'; selectedMarketOrder = order.lane
            // Like the bakery receipt, keep the existing kitchen as Back's target.
            openPanel('market', false)
            const detail = dialogContent.querySelector<HTMLElement>('.market-order-detail')
            detail?.focus({preventScroll:true}); detail?.scrollIntoView({block:'nearest'})
          }}
        }} : {}),
        onComplete(result) {if(made)return true
          if (panel !== 'cookery') return false
          const waiting = !signature && preparedDish === 'orchardPreserves' && preservesOrder()?.status === 'waiting'
          const commissionBefore = signature ? commissionLineForReturn() : undefined
          made = perform(() => {
            const known = new Set(farm.culinary.recipes.map(recipe=>recipe.id))
            const receipt=signature?repeatId?repeatSignature(farm,repeatId,result):completeSignature(farm,draft,result):cookDish(farm,preparedDish,result)
            if(receipt.ok&&'recipeId' in receipt&&typeof receipt.recipeId==='string')resultRecipeId=receipt.recipeId
            if(receipt.ok&&familyName&&'recipeId' in receipt&&typeof receipt.recipeId==='string'&&!known.has(receipt.recipeId))nameSignature(farm,receipt.recipeId,familyName)
            return receipt
          },false,true)
          if (made && waiting && preservesOrder()?.status === 'ready') preservesOrderDay = farm.day
          if (made && commissionBefore && commissionOrigin && resultRecipeId === repeatId
            && commissionBefore.inBag + commissionBefore.warehouse < commissionBefore.remaining) {
            const line = commissionLineForReturn()
            if (line && line.inBag + line.warehouse >= line.remaining) commissionOrigin.prepared = true
          }
          return made
        },
        onCancel(){if(signature && !fromRequestedFood && !editingDraft() && !(resultRecipeId === repeatId && commissionLineForReturn())) {
            panelHistory.length = 0; openRecipeBook(resultRecipeId,false,false)
          } else leaveScene()
        },
      })
      break
    }
    case 'village-project': dialogContent.innerHTML = villageProjectCard(); break
    case 'village': dialogContent.innerHTML = neighboursCard(); break
    case 'village-meal': {
      const fork = getSupperFishFork(farm)
      const choice = fork ? {fork,fish:(dialog.open ? tableSupperFish(dialogContent,fork) : undefined) ?? 'seaBass' as const} : undefined
      const meal = getVillageMeal(farm, pastryShape, choice?.fish)
      const signatures = getReadySignatureSuppers(farm, choice?.fish)
      dialogContent.innerHTML = meal.served ? renderSupperResult(farm,icon('upgrade-farmhouse-card'),button('Домой','sail',true,{value:'home',secondary:supperCottageReady(farm)}))
        : `<p class="shared-supper-intro">Выберите одно угощение: ручную выпечку или готовое авторское блюдо. Ужин расходует 1 порцию выбранного угощения и 1 рыбу.</p>
          ${choice ? renderSupperFishFork(farm,choice.fork,choice.fish,fish=>icon(fishImage(fish))) : `<ul class="ingredients">${meal.items.filter(item=>item.kind==='fish').map(stockTile).join('')}</ul>
          ${farm.fish.perch + farm.fish.seaBass === 0 ? renderHarbourFishChoice(farm,'supper') : '<p>Подойдёт обычный окунь или морской окунь. Выше показано, какая рыба пойдёт к столу.</p>'}`}
          ${renderSignatureSuppers(farm,recipe=>signatureResultPicture(recipe,{icon}),choice)}
          <details class="shared-supper-pastry" ${!signatures.length || meal.available ? 'open' : ''}><summary>Ручная выпечка</summary>${pastryChoices()}<ul class="ingredients">${meal.items.filter(item=>item.kind==='handmade').map(stockTile).join('')}</ul>${nav(button('Подать выпечку · 1 порция','share-meal',meal.available,choice?{value:`supper:${choice.fork.key}:${choice.fish}`,context:fishDefinitions[choice.fish].name}:{}))}</details>`
      break
    }
    case 'fishing': {
      const action = getFishAction(farm), trip = getOtherShoreFishingTrip(farm)
      if (trip) {
        const grove = trip.island === 'grove'
        const canResume = canSailTo(farm,trip.island) && !!getResumableFishingTrip({...farm,island:trip.island})
        dialogContent.innerHTML = nav(
          button(grove?'В рощу · продолжить':'Домой · продолжить','fishing-resume-shore',canResume,{value:trip.token}),
          button(grove?'Прервать рыбалку в роще':'Прервать рыбалку дома','fishing-abandon-shore',true,{value:trip.token,secondary:true}))
          + renderFishingPracticeEntry(farm)
      } else if (action.available) mountFishing()
      else dialogContent.innerHTML = `<p class="dialog-status">${action.label}</p>
        ${renderFishingPracticeEntry(farm)}${groveDockActions()}`
      break
    }
    case 'boat': {
      const journeys = getIslandJourneys(farm)
      const destination = journeys.find(place => place.id === boatIsland) ?? journeys[0]
      const selectors = journeys.map(place => {
        const status = place.current ? ', вы здесь' : place.unlocked ? '' : ', пока закрыт'
        const shortName = {home:'Дом',grove:'Роща',cape:'Мыс',village:'Гавань'}[place.id]
        const shortStatus = place.current ? 'Вы здесь' : place.unlocked ? '' : 'Закрыто'
        return `<button type="button" data-action="boat-island" data-value="${place.id}" aria-pressed="${place.id===destination.id}" aria-label="${place.name}${status}" title="${place.name}${status}">${icon({home:'upgrade-farmhouse-card',grove:'ui-tree-apple',cape:'ui-honey',village:'ui-bea'}[place.id])}<span class="island-full-name">${place.name}</span><span class="island-compact-name" aria-hidden="true">${shortName}${shortStatus ? `<small>${shortStatus}</small>` : ''}</span></button>`
      }).join('')
      const action = destination.nextAction
      const firstFerry = farm.island === 'home' && destination.id === 'grove' && farm.boatOwned && farm.freight.expeditions.serial === 0
        ? firstFerryCargoOffer(farm.freight.expeditions, farm.day, expeditionWallet(farm), selectedExpeditionPort, selectedExpeditionOffer) : undefined
      const capeStatus = getCapeJourneyStatus(farm, destination.id)
      const requirements = destination.requirements.filter(item => !item.complete)
      const unpaidBoat = action?.target === 'buy-boat' && !action.enabled
      const nextStep = unpaidBoat
        ? button(`Накопить на лодку · ещё ${quantity(boatPrice-farm.coins,'монета')}`,'boat-funds',true,{value:destination.id})
        : action ? button(action.target==='sail' && action.value===destination.id ? 'Отправиться' : action.label,action.target,action.enabled,{value:action.value,context:destination.name}) : ''
      const checklist = `<ul class="journey-requirements">${requirements.map(r=>requirementLink(`${icon(r.icon)}<span>${r.label}</span><strong>${r.current}/${r.target}</strong>`,{kind:'journey',island:destination.id,id:r.id},'journey-requirement',r.label,false)).join('')}</ul>`
      const supperTomorrow = destination.current && destination.id === 'village' && getVillageMeal(farm, pastryShape).served
      const localPlaces = farm.island === 'home'
        ? button('Кухня','kitchen',true,{secondary:true}) + (isProjectComplete(farm,'fair') ? button('Просьбы соседей','open-panel',true,{value:'intents',secondary:true}) : '')
        : farm.island === 'grove' ? button('Живая заводь','open-panel',true,{value:'cove',secondary:true})
          + (destination.dockProjectReady ? button('Причал рощи','project-dock',true,{secondary:true}) : '')
          + (getHarborOrder(farm) ? button('Заказ гавани','visit-harbor',true,{secondary:true}) : '')
        : farm.island === 'cape' ? button(farm.capeLevel>=3?'Медовая кухня':'Пасека','open-panel',true,{value:farm.capeLevel>=3?'honey-kitchen':'hive',secondary:true})
        : button('Соседи','open-village',true,{secondary:true}) + (supperTomorrow ? '' : button('Общий ужин','village-meal',true,{secondary:true}))
      dialogContent.innerHTML = `<nav class="island-selector" aria-label="Острова">${selectors}</nav>
        <article class="journey-card" data-island="${destination.id}" data-unlocked="${destination.unlocked}">
          <div class="journey-overview">
            <div class="journey-picture"><img src="${import.meta.env.BASE_URL}art/lavender/${destination.id}-plate.webp" alt="" draggable="false"></div>
            <div class="journey-caption"><div class="journey-heading"><h2>${destination.name}</h2></div>
              <p>${destination.description}</p>${capeStatus ? `<p class="journey-return-status">${escapeHtml(capeStatus)}</p>` : ''}${destination.current ? `<span class="journey-here">Вы здесь${supperTomorrow ? ' · Ужин завтра' : ''}</span>` : ''}
            </div>
          </div>
          <nav class="island-places" aria-label="Действия на острове">
            ${nextStep || localPlaces}
            ${destination.current && farm.boatOwned ? button('Грузовой паром','open-panel',true,{value:'bay-freight',secondary:true})
              : firstFerry ? button('Грузовой паром','first-ferry-route',true,{value:`${farm.day}:${firstFerry}`,secondary:true}) : ''}
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
      dialogContent.innerHTML = marketTreeContinuation()+`<p class="dialog-intro">В саду деревья растут и дают новые плоды после отдыха. Уберите дерево на хранение, чтобы бесплатно освободить место; потом его можно вернуть.</p>
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
        const standing=standingVisitTree(farm)
        dialogContent.innerHTML=treeSelector()+`<div class="tree-focus">${icon(`ui-tree-${slot.tree}`)}${slot.fruitReady ? '' : `<strong data-tree-remaining tabindex="-1">${growing ? 'До зрелости: ' + quantity(treeNightsToFruit(slot),'ночь') : 'Новые плоды завтра'}</strong>`}
          ${treeVariantCopy(slot)?`<p class="dialog-intro">${treeVariantCopy(slot)}</p>`:''}${slot.fruitReady?button(`Собрать · ${slot.fruitReady}`,'pick-fruit',action.available):panelHistory.at(-1)?.panel==='recipes'?button('К рецепту','back',true,{secondary:true}):''}
          ${standing?.index===treeSlot ? button('Показать Финну','visit-show-tree',true,{value:standing.token}) : ''}</div>
          <p class="dialog-intro">Хранение бесплатно освободит это место. Возраст, готовые плоды и особенность сохранятся; рост и новые плоды будут на паузе.</p>
          ${nav(button('Убрать дерево на хранение','store-tree',true,{value:treeSlot,secondary:true}))}`
      }else{
        dialogContent.innerHTML=treeSelector()+marketTreeContinuation()+nurseryCard(treeSlot)+`<div class="sapling-options">${treeIds.map(tree=>{
          const definition=treeDefinitions[tree],owned=farm.saplings[tree]>0
          const sow = getFruitTreeSeed(farm, treeSlot, tree)
          return `<article class="sapling-option">${icon(`ui-tree-${tree}`)}<h2>${definition.treeName}</h2><span>До зрелости: ${quantity(definition.days, 'ночь')}</span>${button(owned?'Посадить':'Купить и посадить','buy-plant-tree',owned||farm.coins>=definition.saplingPrice,{value:tree,context:`${definition.treeName}`,cost:owned?undefined:{icon:'coin',amount:definition.saplingPrice}})}${sow ? button(`Из 1 ${sow.fruitCost} · ${quantity(sow.nights, 'ночь')}`,'fruit-tree-seed',true,{value:sow.token,context:definition.treeName,secondary:true}) : ''}</article>`
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
          const labelText = branch ? branchDefinitions[branch].name : definition.name
          return row(`upgrade-${building}-card`, `<span data-upgrade-title="${building}" tabindex="-1">${labelText}</span>`,
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
      dialogContent.innerHTML = kitchenFamilies()
      break
    }
  }

  applyIngredientFinishes(dialogContent)
  // A stock update can redraw Sell while the player is still editing the query.
  if (focusedSaleSearch) {
    const input = dialogContent.querySelector<HTMLInputElement>('[data-market-sale-query]')
    input?.focus({preventScroll:true})
    if (input && focusedSaleSearch.start !== null && focusedSaleSearch.end !== null)
      input.setSelectionRange(focusedSaleSearch.start, focusedSaleSearch.end, focusedSaleSearch.direction ?? undefined)
  }
  if (focusedInlineKey) {
    const card = Array.from(dialogContent.querySelectorAll<HTMLElement>('[data-inline-key]')).find(card => card.dataset.inlineKey === focusedInlineKey)
    const input = card?.querySelector<HTMLInputElement>('[data-inline-quantity]:not(:disabled)')
    input?.focus({preventScroll:true})
    const grid = dialogContent.querySelector<HTMLElement>('#market-sale-results')
    // Anchor the actual editor, not a scroll offset that could point at a new row.
    if (input && grid && inlineEditorTop !== undefined)
      grid.scrollTop += input.getBoundingClientRect().top - grid.getBoundingClientRect().top - inlineEditorTop
  }
  if (focusedStorageChoice) dialogContent.querySelector<HTMLSelectElement>('[data-tree-storage-choice]')?.focus({preventScroll:true})
  if(panel==='market'&&salePresentation.place)updateSaleQuote()
  if (panel === 'recipes') recipeBook.restore(dialogContent,true)
  if (focused && panel !== 'bay-freight' && panel !== 'recipes') {
    const replacement = Array.from(dialogContent.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      .find(candidate => focusKey(candidate) === focusKey(focused))
      // A spent pack keeps a neutral result at the old button's position, even on a clipped shelf.
      ?? (focusedSeedCrop ? dialogContent.querySelector<HTMLElement>(`[data-seed-pack="${CSS.escape(focusedSeedCrop)}"] .market-seed-limit`) : null)
    const incubatorRoute = panel === 'coop' && (focused.dataset.action === 'incubate-egg' || focused.dataset.action === 'incubate-rare-egg')
      ? dialogContent.querySelector<HTMLButtonElement>('.coop-primary [data-action="visit-rest"]') : null
    // A queued planting can spend the last seed while the picker is already open.
    // Keep its crop in focus without moving the old confirmation onto the buy action.
    const depletedSeedTile = !replacement && focused.dataset.action === 'choose-seed'
      && (panel === 'seeds' || panel === 'inventory' && bagTab === 'seeds')
      && focused.dataset.crop === previewSeed && farm.seeds[previewSeed] === 0
      ? dialogContent.querySelector<HTMLButtonElement>('.seed-picker-tile[aria-pressed="true"]') : null
    const nextFocus = replacement ?? depletedSeedTile ?? incubatorRoute ?? (panel === 'hen-friendship' ? henCareResultFocus(dialogContent, focused) : undefined) ?? closeButton
    nextFocus.focus({ preventScroll: true })
  }
}

// A map shortcut continues at the chosen place after the crossing. Only global
// pages can be revisited on the new island; a local building belongs to its shore.
async function visitPanelAt(destination: typeof farm.island, next: Panel, ferryMorning?: number, recipeId?: string, shopMarketReturn?: PanelVisit, shelfFood?: () => string | undefined) {
  if (island.isCrossing()) return
  const focusRecoveredListing = () => {
    if (!shelfFood || next !== 'bay-shop' || panel !== next || !dialog.open) return
    const food = shelfFood()
    if (food) harbourScene?.focusListing?.(food)
  }
  // Keep an incubation morning on the farm so its hatch is not covered by a menu.
  const ferryVisit = ferryMorning !== undefined && farm.hatchDay !== farm.day + 1 && dialog.open && panel === 'bay-freight' && next === 'rest'
    ? {...rememberPanel(),ferryMorning} : undefined
  if (farm.island === destination) {
    if (ferryVisit) { panelHistory.push(ferryVisit); openPanel(next,false) }
    else if (next === 'recipes' && recipeId) openRecipeBook(recipeId)
    else openPanel(next)
    focusRecoveredListing()
    return
  }
  if (!canSailTo(farm,destination)) return
  const recipeVisit = recipeId && dialog.open && panel === 'recipes' && next === 'bay-shop' && destination === 'village'
    ? {...rememberPanel(),harbourRecipe:{id:recipeId,preview:true}} : undefined
  const marketVisit = destination === 'village' && next === 'bay-shop' && farm.island === 'home' &&
    dialog.open && panel === 'market' && marketTab === 'sell' ? {...rememberPanel(),focus:undefined} : undefined
  const returnPath = dialog.open && panel ? [...panelHistory,recipeVisit ?? ferryVisit ?? marketVisit ?? rememberPanel()].filter(visit =>
    visit === recipeVisit || ['guide','boat','archive','bay-freight','inventory','journal'].includes(visit.panel)) : []
  if (fieldViewButton.getAttribute('aria-pressed') === 'true') toggleFieldView()
  closeDialog()
  await island.crossIsland(()=>perform(()=>sail(farm,destination),false,true))
  if (farm.island !== destination) return
  panelHistory.push(...returnPath)
  if (next === 'market' && destination === 'home' && shopMarketReturn?.panel === 'market' && shopMarketReturn.marketTab === 'sell') {
    // Only the explicitly travelled return may restore this local Market visit.
    panelHistory.push(shopMarketReturn)
    goBack()
    return
  }
  if (marketVisit) {
    // Pass ownership only to the scene mounted by this successful crossing.
    nextShopMarketVisit = marketVisit
    try { openPanel(next,false) } finally { nextShopMarketVisit = undefined }
  } else if (next === 'recipes' && recipeId) openRecipeBook(recipeId, false, false)
  else openPanel(next,false)
  focusRecoveredListing()
}

function openGuidedMarket(tab?: string) {
  openPanel('market',true,farm.island,'page.unfold',undefined,{readyOrder:tab==='orders'})
}
function openGuidedSeeds(crop: CropId) {
  openPanel('seeds', true, farm.island, 'page.unfold', undefined, { seedPreview: crop })
  if (dialog.open && panel === 'seeds' && previewSeed === crop) {
    highlightControl(dialogContent.querySelector<HTMLElement>('.seed-picker-primary [data-action="choose-seed"]:not(:disabled)'))
  }
}
function openPanel(next: Panel, remember = true, destinationIsland = farm.island, cue = 'page.unfold', recipeTarget?: string, entry?: { hiveFlower?: number; seedPreview?: CropId; grillFish?: FishId; readyOrder?: boolean; firstFerryOffer?: string; festivalCargo?: { port: ExpeditionPort; offer: string }; honeyRecipe?: HoneyKitchenRecipe; meetHen?: number }) {
  if(next!==panel&&salePresentation.place)salePresentation.reset()
  if (island.isCrossing()) return
  if ((next === 'berry-nursery' || next === 'berry-renewal') && farm.island !== 'home') { void visitPanelAt('home',next); return }
  if (next === 'shoal' && (farm.island !== 'grove' || !hasShoal(farm))) return
  if (next === 'grove-display' && (farm.island !== 'grove' || !hasBayDisplay(farm))) return
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
  if ((next === 'transplant' || next === 'garden-plans' || next === 'recipe-surplus') && farm.island !== 'home') return
  hiveFlower = next === 'hive' ? entry?.hiveFlower : undefined
  // An automatic order belongs to this visit. A manual pick also survives an ordinary reopen.
  if (entry?.readyOrder || !dialog.open && remember) selectedMarketOrder = entry?.readyOrder ? undefined : pickedMarketOrder
  const reopenScroll = !dialog.open && remember && next === 'market' && marketTab === 'sell'
    ? marketSaleBrowse.takeClosed(marketSellView()) : undefined
  if (!dialog.open) marketSaleBrowse.reset()
  if(remember&&next!==panel){if(dialog.open&&panel)panelHistory.push(rememberPanel());else panelHistory.length=0}
  if (remember && next === 'village-meal' && panel === 'village' && !getVillageMeal(farm, pastryShape).available) {
    // Snapshot the cottage's choice first; the table can start with stock that is ready.
    pastryShape = workshopShapes.find(shape => getVillageMeal(farm, shape).available) ?? pastryShape
  }
  // A source visit shows the requested recipe without replacing the normal manual choice.
  if (next === 'honey-kitchen') {
    if (entry?.honeyRecipe) honeyKitchenDish = entry.honeyRecipe
    else if (remember && next !== panel) honeyKitchenDish = pickedHoneyKitchenDish
  }
  if (next === 'kitchen' && remember && next !== panel && typeof kitchenGroup === 'object' && kitchenGroup.returned)
    kitchenGroup = { ready:kitchenGroup.ready }
  if (next === 'kitchen' && entry?.grillFish) { kitchenGroup='dishes'; kitchenDish='grilledFish'; cookingFish=entry.grillFish }
  else if (next === 'kitchen' && remember && next !== panel && farm.fish[cookingFish] === 0) cookingFish = getGrillFish(farm)
  // A task previews a recipe; the next ordinary kitchen visit keeps the player's choice.
  if (next === 'kitchen' && remember && next !== panel && !recipeTarget && typeof kitchenGroup === 'object' && 'guidedFrom' in kitchenGroup)
    kitchenGroup = kitchenGroup.guidedFrom
  if (next === 'kitchen' && (
    recipeTarget === 'orchardTart' && farm.island === 'home' ||
    recipeTarget === 'appleJam' && farm.island === 'village' && panel === 'festival'
  ) && getCookAction(farm,recipeTarget).available) {
    const guidedFrom = typeof kitchenGroup === 'object' && 'guidedFrom' in kitchenGroup ? kitchenGroup.guidedFrom : kitchenGroup
    kitchenGroup = { ready:recipeTarget, guidedFrom }
  }
  if (next === 'kitchen' && kitchenGroup === undefined) {
    const ordinaryHomeEntry = farm.island === 'home' && remember && next !== panel && !entry && !recipeTarget
      && (!dialog.open || panel === 'rest' || panel === 'guide' || panel === 'boat' || panel === 'upgrades')
    const origin = panelHistory.at(-1)
    const cottage = farm.island === 'village' && farm.village.built && origin?.panel === 'village' ? origin : undefined
    const plainCottageEntry = remember && next !== panel && dialog.open && panel === 'village' && !entry && !recipeTarget
    if (cottage && plainCottageEntry) {
      const ready = kitchenReadyDishes()
      if (ready.length === 1) cottage.cottageKitchenDish = ready[0]
      else if (ready.length > 1 && (kitchenTart === 'mixed' || !getCookAction(farm,kitchenTart,cookingFish).available))
        cottage.cottageKitchenShelf = ready[0]
    }
    // Both cottage landings survive Back even after the selected dish's ingredients are spent.
    if (!(cottage?.cottageKitchenDish || cottage?.cottageKitchenShelf) || entry || recipeTarget || (remember && !plainCottageEntry && next !== panel))
      kitchenGroup = ordinaryHomeEntry ? {} : 'tart'
  }
  if (next === 'recipes') {
    if (recipeTarget) recipeBook.select(farm,recipeTarget)
    else if (remember && next !== panel) recipeBook.view.mode='index'
  }
  if (next !== panel) { transplantSelection.reset(); berryNurserySelection.reset(); berryRenewalSelection.reset(); gardenEditor.reset() }
  if (next !== panel && next !== 'recipe-surplus') recipeSurplusSelection.reset()
  if (next !== 'seeds') seedPickerBed = undefined
  // A distinct ferry visit owns no old cargo cue. Back from its orchard view
  // restores the still-open visit without resetting the same receipt.
  if (next === 'bay-freight' && (!dialog.open || (remember && next !== panel))) ferryPeachPlanting.reset()
  if (remember && next==='bay-freight' && next!==panel) {
    // The originating Boat view already holds its original offer for Back.
    if (entry?.firstFerryOffer) selectedExpeditionOffer = entry.firstFerryOffer
    const source = entry?.festivalCargo && panelHistory.at(-1)
    if (entry?.festivalCargo && source && source.panel === 'festival') {
      source.festivalCargoPreview = { ...entry.festivalCargo, serial: farm.freight.expeditions.serial }
      selectedExpeditionPort = entry.festivalCargo.port
      selectedExpeditionOffer = entry.festivalCargo.offer
    }
    freightPlanOpen=false
    if (panel!=='bay-music') selectedWarehouse=farm.island
  }
  if (next !== panel) { stopHarbour(); stopFishing(); stopWorkshop(); stopCookery(); stopArrangement() }
  if (remember && next !== panel && (next === 'inventory' || next === 'seeds')) previewSeed = next === 'seeds' && entry?.seedPreview ? entry.seedPreview : seedPickerBed === undefined ? farm.selectedSeed : seedPickerBedPreview(farm, seedPickerBed)
  if (remember && next !== panel && next === 'irrigation') irrigationMode = freshIrrigationMode()
  if (remember && next !== panel && next === 'boat') { boatIsland = destinationIsland; journeyDetailsOpen=false }
  if (next === 'archive' || next === 'boat') {
    farm.orientation[next === 'archive' ? 'collections' : 'islands'] = true
    saveFarm()
    status()
  }
  if (next !== panel && next !== 'festival') celebratedFestival=undefined
  if (panel !== next) playBaySound(cue==='page.unfold' && (next==='guide' || next==='boat') ? 'page.map' : cue,.76,0)
  panel = next
  // Warm the two possible morning cues silently while the explicit forecast is open.
  // primeEvents preserves mute/zero-volume/locked-audio gating and the shared cache.
  if (next === 'rest') void bayAudio.primeEvents(['daybreak.shutters', 'harbour.berth'])
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
  if (reopenScroll !== undefined) {
    // The new grid has geometry now. A synchronous assignment clamps to its range
    // and cannot race a later search, Back, or another panel opening.
    const grid = dialogContent.querySelector<HTMLElement>('#market-sale-results')
    if (grid) grid.scrollTop = reopenScroll
  }
  if (next === 'bay-freight' && ferryArrival.take(farm.freight.expeditions.active,dialog.open)) presentFerryArrival(dialogContent)
  updateCommunityReturn()
  const sceneEntry = next === 'bay-shop' ? dialogContent.querySelector<HTMLInputElement>('[data-stock-quantity]') ?? dialogContent.querySelector<HTMLElement>('.bay-shop-close')
    : next === 'bay-freight' ? dialogContent.querySelector<HTMLElement>('.bay-freight [data-action="close"]')
    : next === 'bay-music' ? dialogContent.querySelector<HTMLElement>(musicView?.sheet ? '.bay-music-sheet-close' : '.bay-music-close')
    : next === 'workshop' ? dialogContent.querySelector<HTMLElement>('.workshop-close')
    : next === 'fishing' ? dialogContent.querySelector<HTMLElement>('.fishing-controls .fishing-action, [data-action="fishing-resume-shore"]:not(:disabled)')
    : next === 'cookery' ? dialogContent.querySelector<HTMLElement>('.cookery-view') : next === 'arrangement' ? dialogContent.querySelector<HTMLElement>('.arrangement-view, [data-arrangement-return]') : null
  // An explicit Meet already chose this hen. Land on her name, not an action.
  const meetHeading = next === 'hen-friendship' && entry?.meetHen !== undefined && entry.meetHen === selectedFriendHen
    ? dialogContent.querySelector<HTMLElement>('.hen-friend-card h2') : null
  if (meetHeading?.getClientRects().length) {
    meetHeading.tabIndex = -1
    meetHeading.focus({ preventScroll: true })
    return
  }
  ;(sceneEntry ?? closeButton).focus({ preventScroll: true })
}

function openRecipeBook(id?: string, expanded=false, remember=true) {
  if(expanded)expandedRepeatId=id
  openPanel('recipes',remember,farm.island,'page.unfold',id)
}
function updateRecipeBookSearch(query: string) {
  if (panel !== 'recipes' || !dialog.open) return
  recipeBook.setQuery(query)
  const input = dialogContent.querySelector<HTMLInputElement>('[data-recipe-query]')
  if (input && input.value !== (recipeBook.view.query ?? '')) input.value = recipeBook.view.query ?? ''
  const results = dialogContent.querySelector<HTMLElement>('#recipe-book-results')
  if (results) { results.innerHTML = recipeBookResults(farm,{icon,stock:stockTile},recipeBook.view); applyIngredientFinishes(results) }
  const status = dialogContent.querySelector<HTMLElement>('.recipe-book-search-status')
  if (status) status.textContent = recipeBookSearchStatus(farm,recipeBook.view)
  const clear = dialogContent.querySelector<HTMLButtonElement>('[data-action="recipe-search-clear"]')
  if (clear) clear.disabled = !recipeBook.view.query
  const index = dialogContent.querySelector<HTMLElement>('.recipe-book-index')
  if (index) index.scrollTop = 0
}
function focusRecipeAction(withdraw=false) {
  const target=withdraw?dialogContent.querySelector<HTMLElement>('[data-action="recipe-warehouse-withdraw"]:not(:disabled)'):dialogContent.querySelector<HTMLElement>('[data-action="make-signature"]:not(:disabled)')
  const visible=target??dialogContent.querySelector<HTMLElement>('[data-recipe-focus="blocker"]')??dialogContent.querySelector<HTMLElement>('[data-recipe-focus="cooking"], .recipe-draft-card')
  if(visible){if(!visible.matches('button:not(:disabled),[tabindex]'))visible.tabIndex=-1;visible.classList.add('guidance-target');visible.scrollIntoView({block:'nearest',behavior:'instant'});visible.focus({preventScroll:true})}
}
function returnToRecipeIndex() {
  if(panel!=='recipes'||recipeBook.view.mode!=='detail'||!recipeBookNarrow()||!recipeBook.view.fromIndex&&panelHistory.length>0)return false
  recipeBook.capture(dialogContent);recipeBook.index();drawPanel();recipeBook.restore(dialogContent,true)
  return true
}

function closeDialog() {
  rememberClosedMarketSell()
  salePresentation.reset()
  gardenEditor.reset()
  transplantSelection.reset()
  berryNurserySelection.reset(); berryRenewalSelection.reset(); recipeSurplusSelection.reset()
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
  const source = panelHistory.slice().reverse().find(visit => visit.festivalCargoPreview)
  const peek = source?.festivalCargoPreview
  // Closing is not a manual ferry choice. Keep a changed choice or a dispatched voyage.
  if (source && peek && peek.port === selectedExpeditionPort && peek.offer === selectedExpeditionOffer
      && peek.serial === farm.freight.expeditions.serial) {
    selectedExpeditionPort = source.expeditionPort
    selectedExpeditionOffer = source.expeditionOffer
  }
  panel = undefined
  panelHistory.length=0
  marketTreeSpaceVisit=undefined
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
  const cta = refill ? 'К колодцу' : needsSeedChoice(farm, index) ? 'Выбрать семена'
    : preview ? preview.action : action.label
  const source = iconUrl(bed.kind === 'crop' ? bed.crop : bed.kind === 'tilled' ? 'tool-seeds' : 'tool-hoe')
  const planned = plannedCropAt(farm, index)
  const planDetail = planned ? `По плану: ${cropDefinitions[planned].name.toLowerCase()}${bed.kind === 'crop' && bed.crop !== planned ? '. Сначала сохраните или соберите эту посадку.' : ''}` : undefined
  updateFieldContextCopy(contextCard, title, preview?.detail ?? planDetail, preview?.bonus)
  if (contextButton.textContent !== cta) contextButton.textContent = cta
  const command = refill ? 'refill' : chooseSeeds ? 'context-seeds' : 'work-context'
  if (contextButton.dataset.action !== command) contextButton.dataset.action = command
  contextButton.hidden = !action.available && !refill && !chooseSeeds
  if (contextIcon.getAttribute('src') !== source) contextIcon.src = source
}

function readFieldHintBands() {
  const origin = canvas.getBoundingClientRect()
  const obstacles = [...app.querySelectorAll<HTMLElement>('.status-bar,.hud-actions,.task-card,.view-toggle,.island-location,.garden-mode,.hud-hint,.hotbar,.toast:not(.sr-only)')].map(control => {
    const box = control.getBoundingClientRect()
    return { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height }
  })
  return { obstacles, top: app.querySelector<HTMLElement>('.hud-top')!.getBoundingClientRect().bottom - origin.y,
    bottom: app.querySelector<HTMLElement>('.hotbar')!.getBoundingClientRect().top - origin.y }
}

let taskRailField: { left: number; right: number } | undefined
let taskRailKey = ''
function updateFieldHud() {
  const field = taskRailField
  if (!field) { delete app.dataset.fieldRail; taskRailKey = ''; return }
  const header = app.querySelector<HTMLElement>('.hud-top')!.getBoundingClientRect()
  const key = `${field.left}|${field.right}|${header.left}|${header.right}|${header.height}`
  if (key === taskRailKey) return
  taskRailKey = key
  const right = header.right - field.right - 8
  const left = field.left - header.left - 8
  const side = right >= 96 ? 'right' : left >= 96 ? 'left' : undefined
  if (side) {
    app.dataset.fieldRail = side
    app.style.setProperty('--field-rail-width', `${Math.min(210, side === 'right' ? right : left)}px`)
    app.style.setProperty('--field-hud-height', `${header.height}px`)
  } else delete app.dataset.fieldRail
}
const fieldHudObserver = new ResizeObserver(updateFieldHud)
fieldHudObserver.observe(app.querySelector('.hud-top')!)
window.addEventListener('pagehide', event => { if (!event.persisted) fieldHudObserver.disconnect() })

const island = createIsland(canvas, {
  fieldHudChanged(field) { taskRailField = field; updateFieldHud() },
  fieldHintBands() {
    // Status changes clear the cache; viewport and transient result changes have
    // their own keys. Stable animation frames never query or measure the HUD.
    const key = `${innerWidth}|${innerHeight}|${visualViewport?.width}|${visualViewport?.height}|${fieldViewButton.textContent}|${toast.hidden}|${toast.className}|${toast.textContent}`
    if (fieldHintCache?.key !== key) fieldHintCache = { key, value: readFieldHintBands() }
    return fieldHintCache.value
  },
  henWalkChanged: () => {
    if (dialog.open && panel === 'hen-friendship') refreshHenWalkChoice(dialogContent, farm, island.henWalkStatus(), island.henWalkAvailable(), island.henFieldTarget(selectedFriendHen))
  },
  harbourViewChanged: (view, traveling) => harbourControls?.select(view, traveling),
  moveHen(index, point) {
    perform(() => moveFarmHen(farm, index, point), false, true)
  },
  inspect(target) {
    updateFieldContext(target.kind === 'bed' ? target.index : undefined)
    if (target.kind === 'hen') return `${henFriends[target.index].name} · ${henFriendshipStage(farm.henFriendship.hens[target.index].points)} · ${farm.pettedChickens.includes(target.index) ? 'Сегодня поглажена' : 'Погладить'}`
    if (target.kind === 'shell' || target.kind === 'shoal-find') {
      const item = getShoreItem(farm, target)
      return item ? `${item.name} · Подобрать` : ''
    }
    if (target.kind === 'tree') {
      if (farm.island !== 'home' && farm.island !== 'grove') return ''
      const slot = farm.trees[farm.island][target.index]
      if (slot === undefined) return ''
      if (!slot) return `Место ${target.index + 1} · ${farm.treeNursery.length ? 'К деревьям на хранении' : 'Посмотреть саженцы'}`
      const name = treeDefinitions[slot.tree].treeName
      if (slot.fruitReady) return `${name} · Плодов: ${slot.fruitReady} · Осмотреть`
      return `${name} · ${getTreeAction(farm, target.index).label}`
    }
    if (target.kind === 'village-home') {
      const resident = farm.village.residents[target.index]
      return `Домик ${target.index + 1} · ${target.index >= getVillageHomeCount(farm) ? villageHomeProgress(farm) : resident ? residentDefinitions[resident].name : 'Пригласить соседа'}`
    }
    if (target.kind === 'flower') {
      const bloom = getCapeBloom(farm, target.index)
      return `Клумба ${target.index + 1} · ${bloom === 'empty' ? 'Посадить цветы' : bloom === 'growing' ? 'Расцветут завтра' : 'Цветут'}`
    }
    if (target.kind === 'neighbor') return `${residentDefinitions[target.resident].name} · ${farm.island==='home'?'В гостях на ферме':'Замысел соседа'}`
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
      if (kind === 'well' && farm.water === getWaterCapacity(farm)) return 'Колодец · Лейка полна'
      if(kind==='bay-music'||kind==='bay-shop'||kind==='bay-freight')return panelTitles[kind]
      return locationLabels[kind]
    }
    const bed = farm.beds[target.index]
    if (!bed) return 'Грядка'
    const action = getBedAction(farm, target.index)
    if (bed.kind !== 'crop') {
      const soil = bed.kind === 'empty' ? 'Целина' : 'Вспаханная земля'
      const next = bed.kind === 'empty' && needsSeedChoice(farm, target.index) ? 'Выбрать семена' : action.label
      return `${soil} · ${next}${plannedCropAt(farm, target.index) ? ' · По плану' : ''}`
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

function chooseSeed(crop: CropId, token: string) {
  previewSeed = crop
  if (farm.seeds[crop] === 0) { drawPanel(); return }
  const bed = seedPickerBed
  activeTool = 'seeds'
  // Without a bed the picker stays open. Confirm a changed seed or sow mode once.
  const quiet = bed !== undefined || (farm.selectedSeed === crop && farm.gardenPlans.active === null)
  if (perform(() => chooseSeedForBed(farm,crop,bed,token),false,quiet) && bed !== undefined) {
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
      openPanel('hive',true,farm.island,undefined,undefined,{hiveFlower:target.index})
    }
    return
  }
  if (target.kind === 'shell' || target.kind === 'shoal-find') {
    island.pickShore(target, () => {const done=perform(() => target.kind === 'shell' ? collectShell(farm, target.index) : collectShoalFind(farm, target.id));if(done)playBaySound(target.kind === 'shell' ? 'gather.shell' : 'gather.find', 1, 0);return done})
    return
  }
  if (target.kind === 'bed') {
    const index = target.index
    const intent = planBedWork(farm, index)
    if (!intent) return
    const upcomingSound = bedWorkSound(farm.beds[index], getBedAction(farm, index).kind)
    if (upcomingSound) void bayAudio.primeEvents([upcomingSound])
    if (needsSeedChoice(farm,index)) { requestSeedChoice(index); return }
    island.workBed(index, () => bedWorkKind(farm, intent), () => {
      if (!isCurrentBedWork(farm, intent)) return
      if (needsSeedChoice(farm,index)) { requestSeedChoice(index); return }
      const action = getBedAction(farm, index)
      // Picking from a bed is direct; the home basket opens supplies, not a tool mode.
      if (action.kind !== 'wait' && action.kind !== 'harvest' && action.available) activeTool = bedTools[action.kind]
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
    case 'neighbor': if(farm.island==='home'){openPanel('neighbor-visits');break} communityResident = target.resident; requestedFood = undefined; communityRequest = { kind: 'neighbor', resident: target.resident, planId: getNeighborPlans(farm).find(plan => plan.resident === target.resident)?.id ?? '' }; openPanel('neighbor'); break
    case 'village': openPanel(farm.island === 'home' ? 'village-project' : 'village'); break
    case 'village-meal': openPanel('village-meal'); break
    case 'village-home': villageSlot = target.index; openPanel('village'); break
    case 'bay-display':
      if (farm.island === 'grove' && hasBayDisplay(farm)) {
        archiveGroup = 'bay'
        openPanel('grove-display')
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
    case 'hen': {
      const id = target.index
      const petted = farm.pettedChickens.includes(id)
      const meeting = henGesture === 'stroke' && canIntroduceHenToVisitor(farm,id)
      const sound = henGesture === 'settle' ? 'flock.settle' : 'flock.stroke'
      if (petted && !meeting) {
        playBaySound(sound, 1, 0)
        notify(`${henFriends[id].name} снова радостно кудахчет.`)
      } else if (perform(() => petted ? introduceHenToVisitor(farm,id) : petChicken(farm,id), false, !meeting)) {
        playBaySound(sound, 1, 0)
      }
      break
    }
    case 'salt': if (perform(() => gatherSeaSalt(farm))) playBaySound('gather.salt', 1, 0); break
  }
}

function useHotbar(tool: Tool, keyboard = false) {
  if (farm.island === 'village' && tool !== 'boat') {
    workshopRecipe = 'pastry'
    openPanel(tool === 'basket' || tool === 'seeds' ? 'workshop' : 'village')
    return
  }
  if (farm.island === 'cape') {
    if (tool === 'basket') { activeTool = tool; status(); activateTarget({ kind: 'hive' }); return }
    if (tool === 'seeds') {
      const empty = farm.capeFlowers.indexOf(null)
      if (empty >= 0) island.focusTarget({kind:'flower', index:empty})
      else notify(getCapeHoney(farm).available ? 'Все клумбы засеяны. В улье можно собрать мёд.'
        : farm.capeHoneyOn === farm.day ? 'Все клумбы засеяны. Сегодня мёд уже собран.'
        : 'Все клумбы засеяны. Цветы распустятся после ночи дома.')
      return
    }
    if (tool !== 'boat') {
      notify('Подойдите к клумбам или улью.')
      return
    }
  }
  if (farm.island === 'grove' && !tools.some(entry => entry.id === tool && 'inGrove' in entry)) return
  activeTool = tool
  status()
  switch (tool) {
    case 'hoe':
      canvas.focus({ preventScroll: true })
      notify(!farm.beds.some(bed => bed.kind === 'empty') ? 'Все грядки уже вскопаны.'
        : farm.beds.some((bed, index) => bed.kind === 'empty' && !needsSeedChoice(farm, index)) ? 'Выберите пустую грядку, чтобы вскопать её.' : 'Выберите семена.')
      break
    case 'water':
      if (farm.buildingLevels.well >= 2) {
        activateTarget({ kind: 'well' })
        break
      }
      if (keyboard && !farm.water && farm.island === 'home') island.focusTarget({ kind: 'well' })
      else canvas.focus({ preventScroll: true })
      notify(!farm.water ? 'Наберите воду в колодце.'
        : farm.beds.some((_, index) => getBedAction(farm, index).kind === 'water')
          ? 'Выберите растение, которому нужна вода.' : 'Сейчас поливать нечего.')
      break
    case 'seeds':
      openPanel('seeds')
      break
    case 'feed':
      island.visit({ kind: 'coop' })
      if (canMixBedtimeFeed(farm)) {
        openPanel('coop')
        highlightControl(dialogContent.querySelector('[data-action="chicken-feed-open"]'))
        break
      }
      if(perform(() => feedChickens(farm)))playBaySound('flock.feed', 1, 0)
      break
    case 'basket':
      if (farm.island === 'grove') {
        openPanel('orchard')
      } else {
        bagTab = 'harvest'
        inventoryGroup = 'harvest'
        openPanel('inventory')
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
  const draftSource = panel === 'signature' && dialog.open && origin?.closest('.recipe-studio .recipe-cost') && dialogContent.contains(origin)
  const recipeOrigin = draftSource ? 'recipe-draft' : panel === 'recipes' && origin?.closest('.signature-page') ? 'saved-recipe'
    : panel === 'kitchen' && farm.island === 'home' && depth === 0 && dialog.open
      && requirement.kind === 'stock' && requirement.item.kind === 'fruit'
      && origin?.closest('.recipe .ingredients') && dialogContent.contains(origin) ? 'home-kitchen' : undefined
  const hint = getRequirementHint(farm, requirement, recipeOrigin)
  const {target,value} = hint.action
  if (!target) return // An exact in-flight source may have expired.
  if (target === 'review-returned-ferry') { openPanel('bay-freight'); return }
  if (target === 'market-sale-review' && value && farm.island === 'home') {
    beginExactSale({kind:'market',key:value})
    if (hint.notice) notify(hint.notice)
    return
  }
  // Keep the local grill recipe on Back. Sailing still leaves the old shore behind.
  if (target === 'visit-pier' && panel === 'kitchen' && farm.island === 'home'
      && requirement.kind === 'stock' && requirement.item.kind === 'fish') {
    activateTarget({kind:'pier'})
    return
  }
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
  else if (target === 'kitchen') place = {kind:farm.buildingLevels.farmhouse >= 2 ? 'kitchen' : 'farmhouse'}
  else {
    const places: Record<string, IslandTarget['kind']> = {'visit-coop':'coop','visit-pier':'pier','visit-hive':'hive','visit-guest':'guest',workshop:'workshop'}
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
    openGuidedMarket(value)
  }
  else if (target === 'show-upgrade') { openPanel('upgrades');highlightControl(dialogContent.querySelector<HTMLElement>(`[data-value="${value}"]`));return }
  else if (target === 'upgrades') openPanel('upgrades')
  else if (target === 'inspect-tree') {
    const index=Number(value)
    if((farm.island!=='home'&&farm.island!=='grove')||!Number.isInteger(index)||!farm.trees[farm.island][index]?.fruitReady)return
    if(draftSource)origin?.focus({preventScroll:true})
    treeSlot=index
    openPanel('tree')
  }
  else if (target === 'orchard' && hint.nurserySpace !== undefined && dialog.open && panel && panel !== 'orchard') {
    const start = panelHistory.length
    let owned: PanelVisit | undefined
    treeStorageChoice.guideSpace(farm, hint.nurserySpace, () => owned !== undefined && dialog.open
      && panel === 'tree' && panelHistory.length === start + 2
      && panelHistory[start] === owned && panelHistory[start + 1]?.panel === 'orchard')
    openPanel('orchard')
    if ((panel as Panel) === 'orchard' && panelHistory.length === start + 1) owned = panelHistory[start]
  }
  else if (target === 'orchard') { if (value) treeStorageChoice.choose(farm,value); openPanel('orchard') }
  else if (target === 'project-dock') openPanel('dock-project')
  else if (target === 'visit-harbor') openPanel('harbor')
  else if (target === 'fair-project') {marketTab='projects';openPanel('market')}
  else if (target === 'village-project') openPanel('village-project')
  else if (target === 'grill-kitchen') {
    const fish = getGrillFish(farm)
    if (!getCookAction(farm,'grilledFish',fish).available) return
    openPanel('kitchen',true,farm.island,'page.unfold',undefined,{grillFish:fish})
  }
  else if (target === 'warehouse-supply') { selectedWarehouseRequest=warehouseRequest(value);openPanel('warehouse-supply') }
  else if (target === 'open-panel' && value === 'honey-kitchen' && requirement.kind === 'stock' && requirement.item.kind === 'dishes') {
    const dish = chooseHoneyKitchenRecipe(requirement.item.item, {panel:'honey-kitchen',open:true,island:farm.island,capeLevel:farm.capeLevel})
    if (!dish || !getCookAction(farm,dish).available) return
    openPanel('honey-kitchen',true,farm.island,'page.unfold',undefined,{honeyRecipe:dish})
    if (dialog.open && panel === 'honey-kitchen' && honeyKitchenDish === dish)
      highlightControl(dialogContent.querySelector<HTMLElement>(`[data-action="honey-kitchen-recipe"][data-value="${dish}"]`))
    return
  }
  else if (target === 'open-panel' && value === 'seeds' && hint.seedPreview) { openGuidedSeeds(hint.seedPreview); return }
  else if (target === 'open-panel' && value && value in panelTitles) openPanel(value as Panel)
  else {openPanel('boat');return}
  if (hint.modalNotice && dialog.open) {
    window.clearTimeout(dialogFeedbackTimer)
    dialogFeedback.classList.remove('sr-only')
    dialogFeedback.dataset.tone = 'good'
    dialogFeedback.textContent = hint.modalNotice
    dialogFeedback.hidden = false
    return // Keep the ordinary panel entry focus, not its commit button.
  }
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
    if (next === 'garden-plans' && control.matches('.garden-mode')) {
      const {active, revision} = farm.gardenPlans
      if (dialog.open || farm.island !== 'home' || active === null || control.dataset.plan !== `${revision}:${active}` || !gardenEditor.choose(active)) return
    }
    if (control.closest('.dialog-destinations')) {
      if (next === panel) return
      const index = panelHistory.map(visit => visit.panel).lastIndexOf(next)
      if (index >= 0) { panelHistory.length=index+1; goBack(); return }
    }
    openPanel(next)
    return
  }
  if (control.dataset.tool && control.closest('.hotbar')) {
    useHotbar(control.dataset.tool as Tool, event.detail === 0 && document.activeElement === control)
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
    if ('id' in task && task.id === 'first-shop' && action === 'open-panel' && value === 'bay-shop'
      && farm.island === 'home' && farm.neighborVisits.active) {
      if (!dialog.open || panel !== 'journal') openPanel('journal')
      const crossing = dialogContent.querySelector<HTMLDetailsElement>('details.journal-visit-crossing:has([data-action="journal-shop"])')
      if (crossing) {
        crossing.open = true
        const summary = crossing.querySelector('summary')
        summary?.scrollIntoView({block:'nearest'})
        summary?.focus({preventScroll:true})
      }
      return
    }
    if ('id' in task && task.id === 'neighbour-service' && action === 'visit-cottage' && farm.island === 'village' &&
        farm.village.residents[Number(value)] === 'bea' && !getResidentService(farm, 'bea', pastryShape).available) {
      const shape = farm.workshopPatterns.find(shape => getResidentService(farm, 'bea', shape).available)
      if (shape) {
        activateTarget({ kind: 'village-home', index: Number(value) })
        if (panel === 'village' && dialog.open) {
          // Own only this guided card, not the player's manual workshop form or Back history.
          dialogContent.innerHTML = renderNeighboursCard(shape, true)
          applyIngredientFinishes(dialogContent)
        }
        return
      }
    }
    if (action === 'kitchen' && value === 'orchardTart' && farm.island === 'home') {
      island.visit({ kind: farm.buildingLevels.farmhouse >= 2 ? 'kitchen' : 'farmhouse' })
      openPanel('kitchen',true,farm.island,'page.unfold',value)
      return
    }
    if (action === 'open-panel' && value === 'seeds' && 'seedPreview' in task && task.seedPreview) {
      openGuidedSeeds(task.seedPreview)
      return
    }
    if (action === 'open-panel' && value === 'archive' && 'id' in task && task.id === 'collections' && !farm.orientation.collections) {
      openPanel('archive')
      if (dialog.open && panel === 'archive') {
        const find = dialogContent.querySelector('.archive-slot[data-discovered="true"]')
        highlightControl(find?.closest('.archive-series')?.querySelector<HTMLElement>('.archive-series-name') ?? null)
      }
      return
    }
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
    case 'berry-renewal-source':
      if (panel === 'berry-renewal' && dialog.open && berryRenewalSelection.choose(farm, Number(value))) {
        drawPanel(); dialogContent.scrollTop = 0; dialogContent.querySelector<HTMLElement>('.transplant-step')?.focus({ preventScroll: true })
      }
      break
    case 'berry-renewal-reset':
      if (panel === 'berry-renewal' && dialog.open) {
        const index = berryRenewalSelection.selected?.index
        berryRenewalSelection.reset(); drawPanel(); restoreBerryRenewalFocus(dialogContent, index)
      }
      break
    case 'berry-renewal-seeds':
      if (panel === 'berry-renewal' && dialog.open && farm.island === 'home') {
        // Preserve the touched entry as the history target, not the old Close button.
        control.focus({ preventScroll: true })
        const crop = berrySeedPreview(farm)
        openPanel('seeds', true, farm.island, 'page.unfold', undefined, { seedPreview: crop })
        revealBerrySeedPreview(dialogContent)
      }
      break
    case 'berry-renewal-bed': {
      const selected = berryRenewalSelection.selected
      if (panel === 'berry-renewal' && dialog.open && selected && String(selected.index) === value) {
        const index = selected.index; closeDialog(); island.focusTarget({ kind: 'bed', index })
      }
      break
    }
    case 'berry-renewal-confirm': {
      const selected = berryRenewalSelection.selected
      if (panel !== 'berry-renewal' || !dialog.open || !selected || value !== selected.token) break
      const { index, token } = selected
      if (getBerryRenewalPreview(farm, index)?.token !== token) { drawPanel(); break }
      const sound = bedWorkSound(farm.beds[index], 'harvest')
      if (sound) void bayAudio.primeEvents([sound])
      closeDialog()
      island.workBed(index, () => getBerryRenewalPreview(farm, index)?.token === token ? 'harvest' : 'wait', () => {
        if (perform(() => harvestBerryAndKeep(farm, token)) && sound) playBaySound(sound, 1, 0)
      })
      break
    }
    case 'berry-nursery-ingredient': {
      const requirement = value === undefined ? undefined : requirementLinks.get(value)
      if (requirement?.kind !== 'stock') break
      const ripe = getBerryNurserySource(farm, requirement.item)
      if (ripe === undefined) break
      // On an entirely planted farm, preserving this exact variety does not require making room.
      if (farm.island === 'home' && farm.beds.every(bed => bed.kind === 'crop')) {
        if (!dialog.open || !dialogContent.contains(control) || ingredientCount(farm, requirement.item) >= requirement.item.quantity) break
        control.focus({preventScroll:true})
        openPanel('berry-renewal')
        if (panel === 'berry-renewal' && dialog.open && berryRenewalSelection.choose(farm, ripe)) {
          drawPanel(); dialogContent.scrollTop = 0; dialogContent.querySelector<HTMLElement>('.transplant-step')?.focus({preventScroll:true})
        }
        break
      }
      await visitPanelAt('home', 'berry-nursery')
      const source = getBerryNurserySource(farm, requirement.item)
      if (panel !== 'berry-nursery' || !dialog.open || source === undefined) break
      if (!farm.beds.some((_, index) => getBerryPropagation(farm, source, index).available)) break
      if (berryNurserySelection.choose(farm, source)) { drawPanel(); dialogContent.scrollTop = 0; dialogContent.querySelector<HTMLElement>('.transplant-step')?.focus({preventScroll:true}) }
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
      if(panel==='berry-nursery'){berryNurserySelection.reset(); berryRenewalSelection.reset();drawPanel();dialogContent.scrollTop=0;dialogContent.querySelector<HTMLElement>('.transplant-step')?.focus({preventScroll:true})}
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
    case 'commission-preview-customer': {
      if(panel!=='shop-commissions'||!dialog.open)break
      const offer=compactShopCommissionOffers(getShopCommissionOffers(farm))?.find(offer=>offer.customer===value)
      if(offer&&shopCommissionView.choose(farm,'customer',offer.customer)){
        drawPanel();dialogContent.scrollTop=0
        dialogContent.querySelector<HTMLElement>('[data-action="commission-preview-customer"][aria-pressed="true"]')?.focus({preventScroll:true})
      }
      break
    }
    case 'commission-accept':
      if(panel==='shop-commissions'&&dialog.open&&perform(()=>acceptShopCommission(farm,value),false,true)){dialogContent.scrollTop=0;dialogContent.querySelector<HTMLElement>('.commission-current')?.focus({preventScroll:true})}
      break
    case 'commission-deliver': {
      const keyboardDelivery = event.detail === 0 && document.activeElement === control
      if(panel==='shop-commissions'&&dialog.open&&perform(()=>deliverShopCommission(farm,value),false,true)) {
        playBaySound('harbour.crate',.65)
        const updated = keyboardDelivery ? getShopCommissionLine(farm,value) : undefined
        if(updated && !updated.canDeliver) {
          const line = Array.from(dialogContent.querySelectorAll<HTMLElement>('[data-commission-line]')).find(item=>item.dataset.commissionLine===value)
          const result = updated.remaining ? line?.querySelector<HTMLElement>('[data-action="commission-recipe"]:not(:disabled)')
            : dialogContent.querySelector<HTMLElement>('.commission-ready') ?? line?.querySelector<HTMLElement>('.commission-line-ready')
          if(result) {
            if(!updated.remaining) result.tabIndex=-1
            result.focus({preventScroll:true}); result.scrollIntoView({block:'nearest'})
          }
        }
      }
      break
    }
    case 'commission-cancel':
      if(panel==='shop-commissions'&&dialog.open&&perform(()=>cancelShopCommission(farm,value),false,true)){dialogContent.scrollTop=0;dialogContent.querySelector<HTMLElement>('[data-commission-view], [data-commission-customer]')?.focus({preventScroll:true})}
      break
    case 'commission-finish':
      if(panel==='shop-commissions'&&dialog.open&&perform(()=>finishShopCommission(farm,value),false,true)){playBaySound('trade.receive');dialogContent.scrollTop=0;dialogContent.querySelector<HTMLElement>('.commission-receipt summary')?.focus({preventScroll:true})}
      break
    case 'commission-recipe': {
      const line=getShopCommissionLine(farm,value)
      if(panel==='shop-commissions'&&dialog.open&&line){
        openRecipeBook(line.recipeId,true)
        const source=panelHistory.at(-1)
        if(source?.panel==='shop-commissions' && recipeBook.view.selectedId===line.recipeId) {
          source.commissionRecipe={line:line.actionValue,prepared:false}
          if(getCommissionRecipePair(farm,line.actionValue,line.recipeId))drawPanel()
        }
        focusRecipeAction()
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
    case 'festival-home-preparation': {
      const current=getDiscoveryTask(farm,farm.orientation)?.action
      if(!value || current?.target!=='festival-home-preparation' || current.value!==value) break
      openPanel('rest')
      const plan=dialogContent.querySelector<HTMLDetailsElement>('[data-festival-home-preparation]')
      if(panel==='rest' && dialog.open && plan){
        plan.open=true
        highlightControl(plan.querySelector('summary'))
      }
      break
    }
    case 'festival-rest': await visitPanelAt('home','rest');break
    case 'festival-music': openPanel('bay-music');break
    case 'festival-freight': {
      if (panel !== 'festival' || !dialog.open || !dialogContent.contains(control)) break
      if (!value) { openPanel('bay-freight'); break }
      const route = getFestivalCargoRoute(farm)
      if (route?.key === value) openPanel('bay-freight',true,farm.island,'page.unfold',undefined,{festivalCargo:route.preview})
      break
    }
    case 'festival-source': {
      const [requirement,id]=(value??'').split('|')
      const active=getFestivalStatus(farm).active
      const row=active?.requirements.find(row=>row.id===requirement)
      const source=row?.alternatives.find(alt=>alt.id===id)
      if (farm.island === 'village' && active?.tradition === 'harvest' && active.edition === 1 && active.stage === 2
        && row?.id === 'treat' && source?.item?.kind === 'dishes' && source.item.item === 'appleJam') {
        if (!dialog.open || panel !== 'festival' || !dialogContent.contains(control) || active.waitingNight
          || row.delivered >= row.quantity || source.available > 0) break
        if (getCookAction(farm, 'appleJam').available) {
          openPanel('kitchen', true, farm.island, 'page.unfold', 'appleJam')
          break
        }
      }
      if(source?.item) await showRequirement({kind:'stock',item:{...source.item,quantity:source.quantity}},control)
      else if(source?.signature) { openRecipeBook(source.signature,true);focusRecipeAction() }
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
      if (panel !== 'bay-freight' || !dialog.open || voyage?.phase !== 'sailing' || String(voyage.serial) !== value) break
      await visitPanelAt('home','rest',voyage.serial)
      break
    }
    case 'harbour-fish-catch': {
      if (panel === 'village-project') {
        if (value) {
          if (!dialog.open || farm.island !== 'home' || island.isCrossing()) break
          const source = getVillageFishWarehouse(farm)
          if (source?.value !== value) { drawPanel(); break }
          selectedWarehouseRequest = source.item
          await visitPanelAt('grove','warehouse-supply')
        } else await showRequirement({kind:'stock',item:{kind:'fish',item:'seaBass',quantity:2}},control)
        break
      }
      if (panel !== 'village-meal' || !dialog.open || farm.island !== 'village' || !farm.village.built
        || getVillageMeal(farm).served || farm.fish.perch + farm.fish.seaBass > 0) break
      const recovery = getSupperFishRecovery(farm)
      if (recovery.kind === 'rest') await visitPanelAt('home','rest')
      else if (recovery.kind === 'warehouse' && recovery.port !== farm.island) {
        if (island.isCrossing()) break
        selectedWarehouseRequest = recovery.item
        await visitPanelAt(recovery.port,'warehouse-supply')
      } else await showRequirement({kind:'stock',item:recovery.item},control)
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
      if (panel !== 'bay-freight' || !dialog.open || value !== selectedExpeditionOffer) break
      const world = farm.freight.expeditions
      const plan = getFerryRestockPlan(world,value,farm.day,expeditionWallet(farm))
      if (!plan || plan.port !== selectedExpeditionPort) break
      if (plan.kind === 'rest') await visitPanelAt('home','rest')
      else {
        const view = captureFerryPanelView(dialogContent)
        selectedExpeditionOffer = plan.offer.id
        drawPanel()
        const owner = dialogContent.querySelector('.bay-freight')
        if (owner) ferrySupplyOrigins.set(owner,{day:farm.day,island:farm.island,serial:world.serial,
          port:plan.port,offer:value,supply:plan.offer.id,view})
        dialogContent.querySelector<HTMLElement>('.bay-freight-close')?.focus({preventScroll:true})
      }
      break
    }
    case 'expedition-source': {
      if (panel !== 'bay-freight') break
      const [offerId,itemId,harvestKey] = (value ?? '').split('|')
      if (harvestKey !== undefined) {
        if (!dialog.open || offerId !== selectedExpeditionOffer || selectedExpeditionPort !== 'mill' || itemId !== 'wheat') break
        const harvest = getFerryReadyHarvest(farm,offerId)
        if (!harvest || harvest.key !== harvestKey) break
        // This is a location preview. Harvest and shipment are still separate gestures.
        closeDialog()
        island.focusTarget({kind:'bed',index:harvest.index})
        break
      }
      const requirement = getFerrySupplyRequirement(farm,offerId,itemId)
      if (requirement) await showRequirement(requirement,control)
      break
    }
    case 'expedition-bun-warehouse': {
      if (panel !== 'bay-freight' || !dialog.open || !dialogContent.contains(control) || island.isCrossing() || selectedExpeditionPort !== 'orchard') break
      const source = getFerryGroveBunSource(farm, selectedExpeditionOffer)
      if (!source || value !== source.key) break
      selectedWarehouseRequest = source.item
      await visitPanelAt(source.port,'warehouse-supply')
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
      if(perform(()=>sendFerryExpedition(farm,value??''))) {
        presentFerryDeparture(dialogContent)
        bayAudio.playEvent('harbour.castoff')
      }
      break
    }
    case 'expedition-order-recipe': {
      if(panel!=='bay-freight'||!dialog.open)break
      openFerryCommissionRecipe(farm,value,id=>{openRecipeBook(id,true);focusRecipeAction()})
      break
    }
    case 'expedition-claim': {
      const keyboardClaim = event.detail === 0 && document.activeElement === control
      const voyage=farm.freight.expeditions.active
      if(voyage){selectedExpeditionPort=voyage.port;selectedExpeditionOffer=expeditionOfferAfterClaim(farm.freight.expeditions,voyage)}
      if(perform(()=>ferryPeachPlanting.receive(farm))) {
        bayAudio.playEvent('harbour.crate')
        if (keyboardClaim) {
          const receipt = dialogContent.querySelector<HTMLElement>('.expedition-receipt')
          receipt?.focus({preventScroll:true})
          receipt?.scrollIntoView({block:'nearest'})
        }
      }
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
    case 'fair-jam-picnic':
    case 'open-intent': {
      const order = action === 'open-intent' ? getCommunityOrders(farm).find(order => order.id === value)
        : panel === 'guest' && dialog.open ? fairJamPicnicChoice(farm) : undefined
      if (order && order.id === value) { communityOrderId = order.id; requestedFood = undefined; communityRequest = { kind: 'intent', orderId: order.id }; openPanel('intent') }
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
    case 'neighbor-stored-food': {
      if(!dialog.open||panel!=='neighbor')break
      const recovery=value?getNeighborFoodRecovery(farm,value):undefined
      if(!recovery||recovery.plan.resident!==communityResident)break
      if(!recovery.offer||recovery.offer.id!==control.dataset.food){drawPanel();break}
      if(control.dataset.storage){
        const source = recovery.remoteSignature
        if(!source || control.dataset.storage!==storedSignatureValue(source) || !dialogContent.contains(control) || island.isCrossing()) { drawPanel();break }
        const request = {kind:'neighbor' as const,resident:recovery.plan.resident,planId:recovery.plan.id}
        communityRequest=request
        requestedFood=undefined
        await visitPanelAt(source.port,'recipes',undefined,source.recipeId)
        // Standard close/continue returns to this meeting; no stock is moved on the crossing.
        if(dialog.open && farm.island===source.port && communityRequest===request && getStoredSignature(farm,source.recipeId)) focusRecipeAction(true)
        break
      }
      if(!recovery.warehouse){drawPanel();break}
      communityRequest={kind:'neighbor',resident:recovery.plan.resident,planId:recovery.plan.id}
      requestedFood=undefined
      const supply=recovery.warehouse
      if(supply.kind==='signature'){
        openRecipeBook(supply.recipeId)
        focusRecipeAction(true)
      }else{
        selectedWarehouseRequest=supply.request
        openPanel('warehouse-supply')
      }
      break
    }
    case 'neighbor-shelf-food': {
      if(!dialog.open||panel!=='neighbor')break
      const recovery=value?getNeighborFoodRecovery(farm,value):undefined
      if(!recovery||recovery.plan.resident!==communityResident)break
      const food=recovery.offer?.id
      if(recovery.warehouse||!recovery.shelved||!food||food!==control.dataset.food){drawPanel();break}
      const request={kind:'neighbor' as const,resident:recovery.plan.resident,planId:recovery.plan.id}
      communityRequest=request
      requestedFood=undefined
      await visitPanelAt('village','bay-shop',undefined,undefined,undefined,()=>{
        if(communityRequest!==request||farm.island!=='village')return
        const current=getNeighborFoodRecovery(farm,request.planId)
        if(current?.shelved&&!current.warehouse&&current.offer?.id===food)return food
      })
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
    case 'finn-picnic-ride': {
      if(control!==communityResume||dialog.open||island.isCrossing()||!value||value!==freshFinnRide||finnPicnicRide(farm)!==value)break
      freshFinnRide=undefined
      if(fieldViewButton.getAttribute('aria-pressed')==='true')toggleFieldView()
      island.focusTarget({kind:'boat'})
      await island.crossIsland(()=>{
        const sailed=perform(()=>sailHomeWithFinn(farm,value),false,true)
        if(sailed){communityRequest=undefined;requestedFood=undefined}
        return sailed
      },'finn')
      updateCommunityReturn()
      canvas.focus({preventScroll:true})
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
    case 'request-bea-batch': {
      const request = communityRequest
      if (panel !== 'request-food' || !dialog.open || request?.kind !== 'neighbor') break
      if (perform(()=>bakeRequestedBeaBatch(farm,request.planId,requestedFood,value),false,true))
        dialogContent.querySelector<HTMLElement>('[data-request-ready]')?.focus({preventScroll:true})
      break
    }
    case 'request-repeat-exact': repeatRequestedFood(); break
    case 'request-food-source': await guideRequestedFood(); break
    case 'rest-intent-request':
      if (canReturnToDailyIntent(farm,communityRequest,value,{panel,open:dialog.open})) await resumeCommunityRequest('request')
      break
    case 'resume-community': await resumeCommunityRequest(control === communityResume ? 'recipe' : 'request'); break
    case 'intent-own-recipe': {
      const plan = panel === 'neighbor' && dialog.open && farm.island === 'village'
        ? getNeighborPlans(farm).find(plan => plan.resident === communityResident && (plan.phase === 'joined' || plan.phase === 'arranging'))
        : undefined
      if (panel === 'neighbor') {
        if (!plan) break
        // Back can show this neighbor while another request still owns the HUD shortcut.
        communityRequest = { kind: 'neighbor', resident: plan.resident, planId: plan.id }
        requestedFood = undefined
      }
      const order = panel === 'intent' && dialog.open && communityRequest?.kind === 'intent'
        && communityRequest.orderId === communityOrderId ? communityOrderId : undefined
      signatureBase = 'tart'; signatureSlots = [null, null]; signatureSlot = 0; signatureRepeatId = undefined; signatureFamily = undefined
      openPanel('signature')
      const origin = panelHistory.at(-1)
      if (plan && panel === 'signature' && origin?.panel === 'neighbor') origin.neighborComposerPlan = plan.id
      if (order && panel === 'signature' && origin?.panel === 'intent' && order === origin.communityOrderId)
        origin.dailyIntentComposerOrder = order
      break
    }
    case 'honey-kitchen-recipe': {
      const dish = chooseHoneyKitchenRecipe(value, {panel,open:dialog.open,island:farm.island,capeLevel:farm.capeLevel})
      if (dish !== undefined) { honeyKitchenDish = pickedHoneyKitchenDish = dish; drawPanel(); dialogContent.scrollTop = 0 }
      break
    }
    case 'kitchen-group': {
      if (value === 'ready') {
        if (panel !== 'kitchen' || !dialog.open || farm.island !== 'home' || typeof kitchenGroup === 'object') break
        const ready = kitchenReadyDishes()
        if (ready.length < 2) break
        const previous = kitchenGroup === 'preserves' ? kitchenPreserves : kitchenGroup === 'dishes' ? kitchenDish : kitchenTart
        kitchenGroup = { ready:ready.find(dish => dish === previous) }
        drawPanel(); dialogContent.scrollTop = 0
        break
      }
      const group = kitchenGroups.find(group => group === value)
      if (group !== undefined) { kitchenGroup = group; drawPanel(); dialogContent.scrollTop = 0 }
      break
    }
    case 'recipe-family': {
      if (control.dataset.family === 'ready') {
        if (panel !== 'kitchen' || !dialog.open) break
        const origin = panelHistory.at(-1)
        const cottage = kitchenGroup === undefined && farm.island === 'village' && farm.village.built
          && origin?.panel === 'village' && origin.cottageKitchenShelf ? origin : undefined
        if (!cottage && (farm.island !== 'home' || typeof kitchenGroup !== 'object')) break
        const ready = kitchenReadyDishes(), dish = ready.find(id => id === value), previousChoice = cottage?.cottageKitchenShelf
        const spentHomeChoice = !cottage && typeof kitchenGroup === 'object' && kitchenGroup.returned && kitchenGroup.ready
          && !getCookAction(farm,kitchenGroup.ready,cookingFish).available
        if ((ready.length > 1 || spentHomeChoice) && dish && (!previousChoice || ready.includes(previousChoice))) {
          if (cottage) cottage.cottageKitchenShelf = dish
          else kitchenGroup = { ready: dish }
          drawPanel()
          if (spentHomeChoice && ready.length === 1)
            dialogContent.querySelector<HTMLButtonElement>('[data-action="recipe-family"][aria-pressed="true"]')?.focus({preventScroll:true})
        }
        break
      }
      if (control.dataset.family === 'tart' && (value === 'mixed' || dishIds.some(dish=>dish===value&&isTartDish(dish)))) { kitchenTart = value as KitchenTart; kitchenGroup = 'tart' }
      if (control.dataset.family === 'preserves' && (value === 'appleJam' || value === 'orchardPreserves' || value === 'custom')) { kitchenPreserves = value; kitchenGroup = 'preserves' }
      if (control.dataset.family === 'dishes') {
        const dish = dishIds.find(dish => dish === value)
        if (dish) { kitchenDish = dish; kitchenGroup = 'dishes' }
      }
      drawPanel(); break
    }
    case 'family-signature': {
      signatureFamily = value === 'berries' ? 'berries' : 'preserves'; signatureBase = signatureFamily === 'berries' ? 'tart' : 'preserves'
      signatureSlots = signatureFamily === 'berries' ? [{ id:'strawberry',quantity:1 },{ id:'blueberry',quantity:1 }] : [null,null]
      signatureSlot = 0; signatureRepeatId = undefined; openPanel('signature'); break
    }
    case 'market-category':
      if (value === 'seeds' || value === 'trees' || value === 'care' || value === 'buildings') {
        if (value !== marketCategory) marketSaleBrowse.resetBuySeeds()
        marketCategory = value; drawPanel(); dialogContent.scrollTop = 0
      }
      break
    case 'inventory-group':
      if(value==='harvest'||value==='kitchen'||value==='shore'){inventoryGroup=value;drawPanel();dialogContent.scrollTop=0;dialogContent.querySelector<HTMLButtonElement>(`[data-action="inventory-group"][data-value="${value}"]`)?.focus({preventScroll:true})}break
    case 'boat-funds': {
      const destination=islandIds.find(id=>id===value)
      if(destination && panel==='boat' && dialog.open && boatIsland===destination && dialogContent.contains(control)
        && control.closest(`.journey-card[data-island="${destination}"]`)) await showRequirement({kind:'journey',island:destination,id:'boat'},control)
      break
    }
    case 'first-ferry-route': {
      if (panel !== 'boat' || !dialog.open || boatIsland !== 'grove' || farm.island !== 'home'
        || !dialogContent.contains(control) || !control.closest('.journey-card[data-island="grove"]')) break
      const offer = firstFerryCargoOffer(farm.freight.expeditions, farm.day, expeditionWallet(farm), selectedExpeditionPort, selectedExpeditionOffer)
      if (offer && value === `${farm.day}:${offer}`) openPanel('bay-freight',true,farm.island,'page.unfold',undefined,{firstFerryOffer:offer})
      break
    }
    case 'boat-island':
      journeyDetailsOpen=false
      if(islandIds.some(id=>id===value)){boatIsland=value as typeof boatIsland;drawPanel();dialogContent.scrollTop=0;dialogContent.querySelector<HTMLButtonElement>(`[data-action="boat-island"][data-value="${value}"]`)?.focus({preventScroll:true})}break
    case 'market-sale-clear':
      if(panel==='market'&&marketTab==='sell'&&dialog.open){const input=dialogContent.querySelector<HTMLInputElement>('[data-market-sale-query]');if(input)input.value='';setMarketSaleQuery('');input?.focus({preventScroll:true})}
      break
    case 'market-sell-group':if(value==='all'||value==='harvest'||value==='kitchen'||value==='shore')selectMarketSaleGroup(value);break
    case 'recipe-search-clear':
      if(dialog.open&&panel==='recipes'){updateRecipeBookSearch('');dialogContent.querySelector<HTMLInputElement>('[data-recipe-query]')?.focus({preventScroll:true})}
      break
    case 'select-recipe':
      if(dialog.open&&panel==='recipes'){recipeBook.capture(dialogContent);if(recipeBook.select(farm,value,false,true)){expandedRepeatId=undefined;drawPanel();const heading=dialogContent.querySelector<HTMLElement>('.signature-page,.recipe-draft-card');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true})}}}
      break
    case 'recipe-book-return':
      if(dialog.open&&(panel==='signature'||panel==='cookery'))openRecipeBook(value||recipeBook.view.selectedId,false)
      break
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
      if(dialog.open && panel==='signature' && (value==='preserves'||value==='tart')){
        const changed = signatureBase !== value
        signatureBase=value;signatureRepeatId=undefined
        if(changed)rememberCurrentRecipeDraft()
        else rememberRecipeDraftFocus()
        drawPanel()
      }break
    case 'signature-slot':
      if(dialog.open && panel==='signature' && (value==='0'||value==='1')){signatureSlot=value==='1'?1:0;rememberRecipeDraftFocus();drawPanel()}break
    case 'signature-fruit':{
      if(!dialog.open || panel!=='signature')break
      const part=recipePlanningIngredient(farm,value,control.dataset.trait)
      if(!part)break
      signatureSlots[signatureSlot]=part;signatureSlot=signatureSlot===0?1:0;signatureRepeatId=undefined;rememberCurrentRecipeDraft();drawPanel();break
    }
    case 'start-signature':
      if(dialog.open && panel==='signature'){cookingMode='signature';openPanel('cookery')}break
    case 'signature-home':
      if(canSailTo(farm,'home')){closeDialog();await island.crossIsland(()=>perform(()=>sail(farm,'home'),false,true));openPanel('recipes',false);openPanel('signature')}
      break
    case 'recipe-repeat-home': {
      const recipe=farm.culinary.recipes.find(recipe=>recipe.id===value)
      if(!recipe)break
      expandedRepeatId=recipe.id
      recipeBook.select(farm,recipe.id,true)
      await visitPanelAt('home','recipes')
      if(panel==='recipes'&&farm.island==='home'){recipeBook.select(farm,recipe.id,true);drawPanel();focusRecipeAction()}
      break
    }
    case 'recipe-warehouse-withdraw':
      if(dialog.open&&panel==='recipes'&&perform(()=>withdrawStoredSignature(farm,value),false,true))bayAudio.playEvent('harbour.crate')
      break
    case 'make-signature': {
      const source = panel === 'recipes' && dialog.open && event.detail === 0 && document.activeElement === control
        ? panelHistory.at(-1)?.commissionRecipe : undefined
      const line = source && getShopCommissionLine(farm,source.line)
      if (!value || !perform(()=>repeatSignature(farm,value!,undefined,1),false,true)) break
      // Only a newly filled line hands Back to the order; a picnic can yield an extra portion.
      if (source && line?.recipeId === value && recipeBook.view.selectedId === value && line.inBag + line.warehouse < line.remaining
          && (farm.culinary.stock[value] ?? 0) + line.warehouse >= line.remaining && !backButton.hidden && backButton.dataset.recipeIndex === 'false') {
        source.prepared = true
        backButton.focus({preventScroll:true})
      }
      break
    }
    case 'manual-signature':{
      signatureFamily=undefined
      const recipe=farm.culinary.recipes.find(recipe=>recipe.id===value)
      if(recipe){signatureBase=recipe.base;signatureSlots=recipe.ingredients.flatMap(part=>Array.from({length:part.quantity},()=>({...part,quantity:1})));signatureRepeatId=recipe.id;cookingMode='signature';if(getSignatureAction(farm,recipe).available)openPanel('cookery');else openPanel('signature')}
      break
    }
    case 'batch-signature': {
      if(!value)break
      const pair=control.dataset.commissionRepeatQuote
      if(pair===undefined){perform(()=>repeatSignature(farm,value!,undefined,3),false,true);break}
      const origin=panelHistory.at(-1),source=origin?.panel==='shop-commissions'?origin.commissionRecipe:undefined
      if(!source||panel!=='recipes'||!dialog.open||!dialogContent.contains(control)||recipeBook.view.mode!=='detail'||recipeBook.view.selectedId!==value)break
      const keyboard=event.detail===0&&document.activeElement===control
      if(perform(()=>repeatCommissionRecipePair(farm,source.line,value!,pair),false,true) && keyboard && !backButton.hidden && backButton.dataset.recipeIndex==='false'){
        source.prepared=true
        backButton.focus({preventScroll:true})
      }
      break
    }
    case 'favorite-signature':if(value)perform(()=>favoriteSignature(farm,value!),false,true);break
    case 'forget-signature':if(value&&perform(()=>forgetSignature(farm,value!),false,true)){const target=dialogContent.querySelector<HTMLElement>('[data-action="select-recipe"]');target?.focus({preventScroll:true})}break
    case 'recipe-surplus-choose':
      if (dialog.open && (panel === 'recipes' || panel === 'recipe-surplus') && value && recipeSurplusSelection.choose(farm, value, 1)) {
        if (panel === 'recipe-surplus') { drawPanel(); dialogContent.scrollTop = 0 }
        else openPanel('recipe-surplus')
      }
      break
    case 'recipe-surplus-quantity':
    case 'recipe-surplus-refresh': {
      const quote = recipeSurplusSelection.quote
      const quantity = action === 'recipe-surplus-refresh' ? quote?.quantity : value === '1' ? 1 : value === '3' ? 3 : undefined
      if (dialog.open && panel === 'recipe-surplus' && quote && quantity && recipeSurplusSelection.choose(farm, quote.recipeId, quantity)) drawPanel()
      break
    }
    case 'recipe-surplus-reset':
      if (dialog.open && panel === 'recipe-surplus') { recipeSurplusSelection.reset(); drawPanel(); dialogContent.scrollTop = 0 }
      break
    case 'recipe-surplus-confirm':
      if (dialog.open && panel === 'recipe-surplus') {
        if (perform(() => recipeSurplusSelection.confirm(farm, value), false, true)) playBaySound('trade.receive')
        else drawPanel()
      }
      break
    case 'recipe-surplus-recipe':
      if (dialog.open && panel === 'recipe-surplus' && value && farm.culinary.recipes.some(recipe => recipe.id === value)) {
        openRecipeBook(value,true)
        focusRecipeAction()
      }
      break
    case 'sell-signature':if(value)beginExactSale({kind:'signature',key:value});break
    case 'use-signature':if(value)perform(()=>useSignature(farm,value!),false);break
    case 'visit-first-tasting': {
      const resident = residentIds.find(id => id === value)
      if (!resident || farm.culinary.tastings[resident].visits !== 0) break
      const selected = selectedBookId(farm,recipeBook.view)
      const dish = selected && farm.culinary.stock[selected] > 0 ? selected
        : sortedBookRecipes(farm).find(recipe => farm.culinary.stock[recipe.id] > 0)?.id
      if (!dish || !signatureTastingGuide(farm,dish,resident)?.available) break
      openRecipeBook(dish)
      highlightControl(dialogContent.querySelector(`[data-action="taste-signature"][data-resident="${resident}"]:not(:disabled)`))
      break
    }
    case 'recipe-shop-stock': {
      if (panel !== 'recipes' || !dialog.open || !value || selectedBookId(farm,recipeBook.view) !== value || island.isCrossing()) break
      const stock = lastPortionShopStock(farm,value)
      if (!stock) break
      nextShopStock = stock
      try { openPanel('bay-shop') } finally { nextShopStock = undefined }
      break
    }
    case 'tasting-bakery': {
      if (panel !== 'recipes' || !dialog.open || !value || selectedBookId(farm,recipeBook.view) !== value || island.isCrossing()) break
      const route = signatureTastingGuide(farm,value,'bea')?.bakeFirst
      if (!route) break
      if (!getResidentService(farm,'bea',pastryShape).available) pastryShape = route.shape
      activateTarget({kind:'village-home',index:route.slot})
      const source = panelHistory.at(-1)
      if (source?.panel === 'recipes') source.tastingBakery = value
      break
    }
    case 'taste-signature':{const id=residentIds.find(id=>id===control.dataset.resident);if(panel==='recipes'&&dialog.open&&value&&id&&selectedBookId(farm,recipeBook.view)===value)perform(()=>tasteSignature(farm,value!,id),false);break}
    case 'supper-fish': {
      if (panel !== 'village-meal' || !dialog.open || !dialogContent.contains(control)) break
      const fork = getSupperFishFork(farm)
      const group = fork && dialogContent.querySelector<HTMLElement>(`[data-supper-fish="${fork.key}"]`)
      if (!group || control.parentElement !== group || value !== 'perch' && value !== 'seaBass') break
      const pastry = dialogContent.querySelector<HTMLDetailsElement>('.shared-supper-pastry')?.open
      group.querySelectorAll<HTMLButtonElement>('button').forEach(option => option.setAttribute('aria-pressed',String(option === control)))
      drawPanel()
      const details = dialogContent.querySelector<HTMLDetailsElement>('.shared-supper-pastry')
      if (details && pastry !== undefined) details.open = pastry
      dialogContent.querySelector<HTMLButtonElement>(`[data-supper-fish] [data-value="${value}"]`)?.focus({preventScroll:true})
      break
    }
    case 'supper-signature': if(value?.startsWith('supper:')) { const picked=panel==='village-meal'&&dialog.open&&dialogContent.contains(control)&&reviewedSupperFish(farm,dialogContent,value); if(picked&&picked.id) { const {id,fish}=picked; finishSharedSupper(()=>deliverSignature(farm,id,fish)) } } else if(value)finishSharedSupper(()=>deliverSignature(farm,value!)); break
    case 'supper-cottage':
      if(panel==='village-meal' && supperCottageReady(farm)) activateTarget({kind:'village-home',index:1})
      break
    case 'cove-choice':{
      const [key,choice]=(value??'').split(':')
      if((key==='flow'&&['open','sheltered'].includes(choice))||(key==='cover'&&['kelp','meadow'].includes(choice))||(key==='refuge'&&['sand','stones'].includes(choice)))perform(()=>changeCove(farm,{[key]:choice}),false,true)
      break
    }
    case 'cove-cancel': if (panel === 'cove' && value) perform(() => cancelCovePlan(farm, value), false, true); break
    case 'cove-watch': {
      if (panel !== 'cove' || !dialog.open || !dialogContent.contains(control) || !getCoveActions(farm).available) break
      const observing = !island.isCoveObserving()
      if (island.setCoveObservation(observing)) control.setAttribute('aria-pressed', String(observing))
      break
    }
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
      if(panel!=='inventory'||!dialog.open)break
      const id=fishIds.find(id=>id===value)
      if(!id || farm.fish[id]<1)break
      if(farm.island!=='home') {closeDialog();await island.crossIsland(()=>perform(()=>sail(farm,'home'),false,true))}
      if(farm.island==='home')openPanel('kitchen',true,farm.island,'page.unfold',undefined,{grillFish:id})
      break
    }
    case 'fish-market': {
      if(panel!=='inventory'||!dialog.open)break
      const id=fishIds.find(id=>`fish:${id}`===value)
      if(!id||farm.fish[id]<1)break
      if(farm.island!=='home'){
        if(!canSailTo(farm,'home'))break
        closeDialog();await island.crossIsland(()=>perform(()=>sail(farm,'home'),false,true))
        if((farm.island as (typeof islandIds)[number])!=='home')break
        // Keep a Home Supplies return target for the existing quote's Cancel/Back.
        openPanel('inventory',false)
      }
      beginExactSale({kind:'market',key:`fish:${id}`})
      break
    }
    case 'first-grove-catch-review': {
      if (panel !== 'inventory' || !dialog.open || bagTab !== 'harvest' || inventoryGroup !== 'shore'
        || !dialogContent.contains(control)) break
      const quote = firstGroveCatchOrder()
      if (!quote || quote.token !== value) break
      const from = rememberPanel()
      if (farm.island === 'grove') {
        closeDialog()
        await island.crossIsland(()=>perform(()=>sail(farm,'home'),false,true))
        if (dialog.open) break
        panelHistory.push(from)
        if ((farm.island as (typeof islandIds)[number]) !== 'home' || firstGroveCatchOrder()?.token !== value) {
          goBack()
          break
        }
      } else panelHistory.push(from)
      marketTab = 'orders'
      selectedMarketOrder = quote.lane
      openPanel('market',false)
      dialogContent.querySelector<HTMLElement>('.market-order-detail')?.focus({preventScroll:true})
      break
    }
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
    case 'picnic-field': {
      if(!dialog.open||(panel!=='recipes'&&panel!=='rest')||island.isCrossing())break
      const target=activeHarvestPicnic(farm)
      if(!target||target.token!==value)break
      closeDialog()
      if(farm.island!=='home')await island.crossIsland(()=>perform(()=>sail(farm,'home'),false,true))
      if(farm.island==='home'&&activeHarvestPicnic(farm)?.token===value)island.focusTarget({kind:'bed',index:target.index})
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
    case 'back':
      if (!closeContextualSale() && !returnToRecipeIndex() && (panel !== 'bay-freight' || !returnToFerrySupplyOrigin()))
        goBack(event.detail===0)
      break
    case 'journal-stay': {
      const crossing = control.closest<HTMLDetailsElement>('details.journal-visit-crossing[open]')
      if (panel !== 'journal' || !dialog.open || !crossing || !dialogContent.contains(crossing)) break
      crossing.open = false
      crossing.querySelector('summary')?.focus({preventScroll:true})
      break
    }
    case 'journal-festival':
    case 'journal-music':
    case 'journal-shop': {
      const destination = action === 'journal-festival' ? 'festival' : action === 'journal-music' ? 'bay-music' : 'bay-shop'
      if (value !== destination || panel !== 'journal' || !dialog.open || !dialogContent.contains(control) || !farm.village.built) break
      const guest = farm.island === 'home' ? farm.neighborVisits.active : null
      if (control.dataset.visit !== guest?.serial.toString() || guest && !control.closest('details.journal-visit-crossing[open]')) break
      await visitPanelAt('village',destination)
      break
    }
    case 'recipe-harbour-shop': {
      if (panel !== 'recipes' || !dialog.open || !dialogContent.contains(control) || island.isCrossing() || farm.island === 'village'
          || !farm.village.built || !value || selectedBookId(farm,recipeBook.view) !== value || !(farm.culinary.stock[value] > 0)) break
      control.focus({preventScroll:true})
      await visitPanelAt('village','bay-shop',undefined,value)
      break
    }
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
        if (marketTab === 'sell' && panel === 'market' && dialog.open) {
          const grid = dialogContent.querySelector<HTMLElement>('#market-sale-results')
          if (grid) marketSaleBrowse.rememberTab(marketSaleGridKey(grid), grid.scrollTop)
        } else if (marketTab === 'buy' && panel === 'market' && dialog.open) {
          const grid = dialogContent.querySelector<HTMLElement>('.market-seed-grid')
          if (grid) marketSaleBrowse.rememberBuySeeds(marketBuySeedGridKey(grid), grid.scrollTop)
        }
        closeContextualSale(false)
        marketTab = value
        dialogFeedback.hidden = true
        dialogFeedback.textContent = ''
        drawPanel()
        dialogContent.scrollTop = 0
        if (marketTab === 'sell' && panel === 'market' && dialog.open) {
          const grid = dialogContent.querySelector<HTMLElement>('#market-sale-results')
          const scroll = marketSaleBrowse.takeTab(grid ? marketSaleGridKey(grid) : undefined)
          if (grid && scroll !== undefined) grid.scrollTop = scroll
        } else if (marketTab === 'buy' && panel === 'market' && dialog.open) {
          const grid = dialogContent.querySelector<HTMLElement>('.market-seed-grid')
          const scroll = marketSaleBrowse.takeBuySeeds(grid ? marketBuySeedGridKey(grid) : undefined)
          if (grid && scroll !== undefined) grid.scrollTop = scroll
        }
      }
      break
    case 'market-order-pickup':
      if (panel === 'market' && dialog.open && marketTab === 'orders' && dialogContent.contains(control)
        && perform(() => pickUpMarketOrderStock(farm, selectedMarketOrder, value))) {
        const ready = dialogContent.querySelector<HTMLElement>('.market-orders-workspace > .market-order-detail:first-child')
        ;(ready ?? dialogContent.querySelector<HTMLElement>('.market-order-detail'))?.focus({preventScroll:true})
        ready?.scrollIntoView({block:'nearest'})
      }
      break
    case 'market-order-select':
      if (panel === 'market' && dialog.open && marketTab === 'orders' && getMarketOrderBoard(farm).choices.some(order => order.id === value)) {
        const pickerScroll = dialogContent.querySelector<HTMLElement>('.market-order-picker')?.scrollTop ?? 0
        pickedMarketOrder = selectedMarketOrder = value
        drawPanel()
        const picker = dialogContent.querySelector<HTMLElement>('.market-order-picker')
        if (picker) picker.scrollTop = pickerScroll
        const detail = dialogContent.querySelector<HTMLElement>('.market-order-detail')
        detail?.focus({preventScroll:true})
        detail?.scrollIntoView({block:'nearest'})
      }
      break
    case 'deliver-order': {
      const lane = orderLanes.find((id) => id === value)
      if (lane && perform(() => deliverMarketOrder(farm, lane), false, farm.progress.sell > 0)
        && panel === 'market' && dialog.open && marketTab === 'orders') {
        const detail = dialogContent.querySelector<HTMLElement>('.market-order-detail')
        detail?.focus({preventScroll:true})
        detail?.querySelector<HTMLElement>('.order-done')?.scrollIntoView({block:'nearest'})
      }
      break
    }
    case 'project-boat': openPanel('boat',true,'grove');break
    case 'project-dock': openPanel('dock-project');break
    case 'visit-harbor': openPanel('harbor');break
    case 'harbor-order-route': {
      if (panel !== 'market' || !dialog.open || marketTab !== 'orders' || selectedMarketOrder !== 'harbor' || !dialogContent.contains(control)) break
      const route=readyHarborOrderRoute(farm)
      if (route && route === value) await visitPanelAt('grove','harbor')
      break
    }
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
    case 'grove-pearl-display': {
      if (!dialog.open || panel !== 'grove-display' || archiveGroup !== 'bay' || !dialogContent.contains(control)
          || (value !== 'place' && value !== 'take') || grovePearlCabinet(farm) !== value) break
      const action = value, focused = document.activeElement === control
      const placed = perform(() => ({
        ok: setGrovePearlCabinet(farm,action),
        message: action === 'place' ? 'Жемчужина на витрине.' : 'Жемчужина в припасах.',
      }),false,true)
      if (placed && focused)
        dialogContent.querySelector<HTMLButtonElement>('[data-action="grove-pearl-display"]')?.focus({preventScroll:true})
      break
    }
    case 'archive-group':
      if (value === 'crops' || value === 'orchard' || value === 'coop' || value === 'shore' || value === 'bay') {
        archiveGroup = value
        drawPanel()
        dialogContent.scrollTop = 0
      }
      break
    case 'save-crop-seeds': {
      const quote = seedSavingQuote(farm,previewSeed)
      if(dialog.open&&(panel==='seeds'||panel==='inventory'&&bagTab==='seeds')&&quote&&quote.token===value) {
        const origin = panel
        // An empty packet's exchange is above the grid; stay with selection after it refills.
        const fromRefill = quote.seeds === 0
        const ownedFocus = document.activeElement===control && (origin==='seeds' || event.detail===0)
        const saved = perform(()=>saveCropSeeds(farm,value),false,true)
        if(saved&&ownedFocus&&dialog.open&&panel===origin&&(panel!=='inventory'||bagTab==='seeds')) {
          seedProductionFocus(dialogContent.querySelectorAll<HTMLButtonElement>('button'), {
            crop: previewSeed, exchangeToken: fromRefill ? undefined : seedSavingQuote(farm,previewSeed)?.token,
            selectionToken: seedChoice(farm,previewSeed,seedPickerBed).token,
          })?.focus({preventScroll:true})
        }
      }
      break
    }
    case 'preview-seed':
      if (dialog.open&&(panel==='seeds'||panel==='inventory'&&bagTab==='seeds')&&value&&cropIds.includes(value as CropId)) {
        const keyboardChoice = event.detail === 0 && document.activeElement === control
        previewSeed=value as CropId;drawPanel()
        // The confirm button precedes all ten tiles. Never move focus to a purchase.
        if (keyboardChoice) dialogContent.querySelector<HTMLButtonElement>('.seed-picker-primary [data-action="choose-seed"]:not(:disabled)')?.focus({preventScroll:true})
      }
      break
    case 'choose-seed':
      if (dialog.open&&(panel==='seeds'||panel==='inventory'&&bagTab==='seeds')&&value===seedChoice(farm,previewSeed,seedPickerBed).token) chooseSeed(previewSeed,value)
      break
    case 'sell-order-surplus':
      if(dialog.open && panel==='market' && marketTab==='sell' && wholeInventorySaleView() && !salePresentation.place && dialogContent.contains(control)) {
        if(perform(() => sellMarketOrderSurplus(farm,value))) playBaySound('trade.receive')
        else updateMarketSaleSearch()
        if(event.detail===0)dialogContent.querySelector<HTMLElement>('.market-total')?.focus({preventScroll:true})
      }
      break
    case 'sell':
      if(dialog.open && panel==='market' && marketTab==='sell' && wholeInventorySaleView() && !salePresentation.place && dialogContent.contains(control)
        && perform(() => sellProduce(farm), false, farm.progress.sell > 0)){
        playBaySound('trade.receive')
        dialogContent.querySelector<HTMLElement>('[data-market-sale-empty]')?.focus({preventScroll:true})
      }
      break
    case 'inline-sale-step': {
      const context=inlineSaleContext(control), direction=control.dataset.step
      const keyboardStep = event.detail === 0 && document.activeElement === control
      if(context&&(direction==='less'||direction==='more')&&marketInlineSales.step(context.item.key,context.token,direction,context.item.count,context.item.price)){
        updateInlineSaleCard(context.card)
        // Keep the same tab position without arming Enter-to-sell or the opposite step.
        if (keyboardStep && control.disabled) control.closest<HTMLElement>('.market-step-limit')?.focus({preventScroll:true})
      }
      break
    }
    case 'inline-sale-confirm': if(event.detail<=1)confirmInlineSale(control,event.detail===0 && document.activeElement===control); break
    case 'inline-sale-again': {
      const context=inlineSaleContext(control)
      if(event.detail<=1&&context&&marketInlineSales.rearm(context.item.key,context.token,context.item.count,context.item.price))updateInlineSaleCard(context.card)
      break
    }
    case 'sell-item': if(value)beginExactSale({kind:'market',key:value}); break
    case 'sale-step':
      if(currentSaleControl(control)&&selectedSale&&!saleReceipt&&(value==='less'||value==='more'||value==='all')){
        const stock=saleStock(farm,selectedSale)
        if(stock){saleQuantity=stepSaleQuantity(saleQuantity,stock.count,value);const input=dialogContent.querySelector<HTMLInputElement>('[data-sale-quantity]');if(input)input.value=saleQuantity;updateSaleQuote()}
      }
      break
    case 'sale-context-close': if(currentSaleControl(control))closeContextualSale(); break
    case 'confirm-sale': if(currentSaleControl(control))confirmExactSale(event.detail===0); break
    case 'sale-again': if(currentSaleControl(control)&&selectedSale)beginExactSale(selectedSale); break
    case 'buy-feed': if(perform(() => buyFeed(farm)))playBaySound('trade.pay'); break
    case 'upgrade-can': perform(() => upgradeCan(farm), false, true); break
    case 'buy-seeds': {
      const scroll = control.closest('.market-seed-grid')?.scrollTop
      const origin = control.closest('.seed-picker-primary') ? panel : undefined
      const samePicker = () => dialog.open && panel === origin && (panel === 'seeds' || panel === 'inventory' && bagTab === 'seeds')
      const keyboardPicker = origin !== undefined && samePicker()
        && event.detail === 0 && document.activeElement === control && crop === previewSeed
      if (crop && perform(() => buySeeds(farm,crop))) {
        // The purchase redraw replaces the scrolling shelf, even when focus returns to the same pack.
        if (scroll) {
          const grid = dialogContent.querySelector<HTMLElement>('.market-seed-grid')
          if (grid) grid.scrollTop = scroll
        }
        if (keyboardPicker && samePicker() && previewSeed === crop) {
          const next = dialogContent.querySelector<HTMLButtonElement>('.seed-picker-primary [data-action="choose-seed"]:not(:disabled)')
          if (next?.dataset.value === seedChoice(farm,crop,seedPickerBed).token) next.focus({preventScroll:true})
        }
        playBaySound('trade.pay')
      }
      break
    }
    case 'garden-save-seeds': {
      if(panel!=='garden-plans'||!dialog.open||gardenEditor.draft||!gardenEditor.shopping)break
      if(!perform(()=>saveGardenSeedPacket(farm,gardenEditor.slot,gardenEditor.shopping!,value)))drawPanel()
      else if(event.detail===0)dialogContent.querySelector<HTMLElement>('[data-garden-basket-total]')?.focus({preventScroll:true})
      break
    }
    case 'garden-shop': case 'garden-shop-scope': case 'garden-shop-back': case 'garden-buy-seeds': case 'garden-slot': case 'garden-edit': case 'garden-copy': case 'garden-cancel': case 'garden-brush': case 'garden-paint': case 'garden-save': case 'garden-follow': case 'garden-delete': case 'garden-remove': case 'garden-bed': {
      if (panel !== 'garden-plans' || !dialog.open || farm.island !== 'home') break
      const token = gardenPlanToken(value)
      if (action === 'garden-buy-seeds') {
        if (!gardenEditor.draft && gardenEditor.shopping) {
          const quote = gardenSeedQuote(farm, gardenEditor.slot, gardenEditor.shopping)
          if (perform(() => quote?.token === value ? buyGardenSeeds(farm, value) : { ok: false, message: 'Список семян изменился. Проверьте обновлённый состав и цену.' })) playBaySound('trade.pay')
          else drawPanel()
        }
        break
      }
      if (action === 'garden-shop' && !gardenEditor.draft && farm.gardenPlans.pages[gardenEditor.slot]) { gardenEditor.shopping = 'open'; gardenEditor.deleting = undefined }
      else if (action === 'garden-shop-scope' && gardenEditor.shopping && (value === 'open' || value === 'all')) gardenEditor.shopping = value
      else if (action === 'garden-shop-back') gardenEditor.shopping = undefined
      else if (action === 'garden-slot') gardenEditor.choose(Number(value))
      else if (action === 'garden-edit' || action === 'garden-copy') gardenEditor.begin(farm, action === 'garden-copy')
      else if (action === 'garden-cancel') gardenEditor.reset()
      else if (action === 'garden-brush' && gardenEditor.draft) {
        if (value === 'none') gardenEditor.brush = null
        else if (cropIds.includes(value as CropId)) gardenEditor.brush = value as CropId
      } else if (action === 'garden-paint') gardenEditor.paint(Number(value))
      else if (action === 'garden-save') { perform(() => gardenEditor.save(farm)); break }
      else if (action === 'garden-follow' && token) {
        perform(() => followGardenPlan(farm, token.slot, token.revision)); break
      } else if (action === 'garden-delete' && token && token.slot === gardenEditor.slot && token.revision === farm.gardenPlans.revision) gardenEditor.deleting = value
      else if (action === 'garden-remove' && token && token.slot !== null && gardenEditor.deleting === value) {
        if (perform(() => removeGardenPlan(farm, token.slot!, token.revision))) gardenEditor.reset()
      } else if (action === 'garden-bed' && !gardenEditor.draft && /^([0-9]|1[0-5])$/.test(value ?? '')) {
        closeDialog(); island.focusTarget({kind:'bed', index:Number(value)}); break
      }
      drawPanel()
      break
    }
    case 'visit-book-home': {
      const resident = value === 'bea' || value === 'finn' ? value : undefined
      if (value && (!resident || resident !== communityResident || panel !== 'neighbor' || !dialog.open
        || !farm.village.residents.includes(resident) || !farm.neighbors[resident].completed)) break
      const day = farm.day
      await visitPanelAt('home','neighbor-visits')
      // The harbour invitation points at this resident, not the first guest in the book.
      if (resident && resident === communityResident && panel === 'neighbor-visits' && dialog.open
        && farm.day === day && !island.isCrossing() && !farm.neighborVisits.active && canInviteNeighbor(farm,resident)) {
        const heading = dialogContent.querySelector<HTMLElement>(`[data-visit-resident="${resident}"]`)
        heading?.scrollIntoView({block:'start',behavior:'instant'})
        heading?.focus({preventScroll:true})
      }
      break
    }
    case 'visit-invite':
      if(panel==='neighbor-visits'&&dialog.open&&perform(()=>inviteNeighborVisit(farm,value),false,true)){
        closeDialog();if(fieldViewButton.getAttribute('aria-pressed')==='true')toggleFieldView()
      }
      break
    case 'visit-finish': case 'visit-reply': {
      if(panel!=='neighbor-visits'||!dialog.open)break
      const parts=/^([1-9]\d{0,6})(?::(quiet|curious))?$/.exec(value??'')
      if(!parts||action==='visit-reply'&&!parts[2]||action==='visit-finish'&&parts[2])break
      if(perform(()=>finishNeighborVisit(farm,Number(parts[1]),parts[2]),false,true))closeDialog()
      break
    }
    case 'visit-introduce-hen': {
      if(panel!=='neighbor-visits'||!dialog.open)break
      const parts=/^([1-9]\d{0,6}):([0-4])$/.exec(value??'')
      if(!parts||farm.neighborVisits.active?.serial!==Number(parts[1]))break
      perform(()=>introduceHenToVisitor(farm,Number(parts[2])),false,true)
      break
    }
    case 'visit-find-tree': {
      if(panel!=='neighbor-visits'||!dialog.open||island.isCrossing()||!dialogContent.contains(control))break
      const tree=standingVisitTree(farm)
      if(!tree||tree.token!==value){drawPanel();break}
      closeDialog();if(fieldViewButton.getAttribute('aria-pressed')==='true')toggleFieldView()
      island.focusTarget({kind:'tree',index:tree.index})
      break
    }
    case 'visit-show-crop': {
      if(panel!=='neighbor-visits'||!dialog.open)break
      const crop=standingVisitCrop(farm)
      if(!crop||crop.token!==value){drawPanel();break}
      closeDialog()
      if(perform(()=>showStandingVisitCrop(farm,crop.token))){
        if(fieldViewButton.getAttribute('aria-pressed')==='true')toggleFieldView()
        island.guideHomeVisitorToBed(crop.index)
        island.focusTarget({kind:'bed',index:crop.index})
      }
      break
    }
    case 'visit-do': {
      if(panel!=='neighbor-visits'||!dialog.open||!farm.neighborVisits.active||farm.neighborVisits.active.observation||String(farm.neighborVisits.active.serial)!==value)break
      const kind=visitActivities[farm.neighborVisits.active.activity].kind
      if(kind==='pastry'){
        if(!getWorkshopAction(farm).available){drawPanel();break}
        workshopRecipe='pastry';openPanel('workshop');break
      }
      if(kind!=='crop'&&kind!=='fruit')break
      const index=kind==='crop'?farm.beds.findIndex(b=>b.kind==='crop'&&getBedStage(b)==='ripe'):farm.trees.home.findIndex(t=>t&&t.fruitReady>0)
      if(index<0){notify(kind==='crop'?'Зрелых грядок пока нет. Гость пока останется на ферме.':'Спелых плодов пока нет. Гость останется на ферме.');drawPanel();break}
      closeDialog();if(fieldViewButton.getAttribute('aria-pressed')==='true')toggleFieldView()
      island.focusTarget({kind:kind==='crop'?'bed':'tree',index})
      break
    }
    case 'hen-friend-select': {
      if (panel !== 'hen-friendship' || !dialog.open || farm.island !== 'home' || !/^[0-4]$/.test(value ?? '') || Number(value) >= farm.flockSize) break
      selectedFriendHen = Number(value)
      drawPanel()
      break
    }
    case 'hen-walk-start': {
      if (panel !== 'hen-friendship' || !dialog.open || !/^[0-4]$/.test(value ?? '')) break
      const id = Number(value)
      if (island.startHenWalk(id)) {
        dialog.close()
        if (fieldViewButton.getAttribute('aria-pressed') === 'true') toggleFieldView()
        notify(`${henFriends[id].name} идёт с вами. Закончить прогулку можно в дневнике стаи.`)
      }
      break
    }
    case 'hen-guide': {
      const choice=/^([0-4]):((?:bed|tree):[0-9]+)$/.exec(value??'')
      if (!choice || panel!=='hen-friendship' || !dialog.open || Number(choice[1])!==selectedFriendHen) break
      const target=island.startHenGuide(selectedFriendHen,choice[2])
      if (target) {
        dialog.close()
        if (fieldViewButton.getAttribute('aria-pressed')==='true') toggleFieldView()
        island.focusTarget(target)
        notify(`${henFriends[selectedFriendHen].name} покажет, где ждёт угощение. Собрать урожай можно отдельно.`)
      }
      break
    }
    case 'hen-walk-return': {
      if (panel !== 'hen-friendship' || !dialog.open || !/^[0-4]$/.test(value ?? '')) break
      if (island.endHenWalk(Number(value))) { dialog.close(); notify(`${henFriends[Number(value)].name} возвращается на своё место.`) }
      break
    }
    case 'hen-friendship-open': {
      if (panel !== 'coop' || !dialog.open || farm.island !== 'home' || !dialogContent.contains(control)) break
      if (control.closest('.coop-incubator-new-hen')) {
        const newcomer=getIncubatorNewHen(farm)
        if (newcomer===undefined) { drawPanel(); break }
        selectedFriendHen=newcomer
        openPanel('hen-friendship',true,farm.island,'page.unfold',undefined,{meetHen:newcomer})
      } else openPanel('hen-friendship')
      break
    }
    case 'hen-treat': {
      if (panel !== 'hen-friendship' || !dialog.open) break
      const choice = /^(0|1|2|3|4):(carrot|leafyGreens|apple)$/.exec(value ?? '')
      if (choice) perform(() => treatHen(farm, Number(choice[1]), choice[2]), false, true)
      break
    }
    case 'chicken-feed-open':
      if (panel === 'coop' && dialog.open && farm.island === 'home' && farm.buildingLevels.coop >= 2) openPanel('chicken-feed')
      else if (panel === 'rest' && dialog.open && canMixBedtimeFeed(farm)) {
        const opener = panelHistory.at(-1)
        const keyboardEntry = event.detail === 0 && document.activeElement === control
        openPanel('chicken-feed')
        const visit = panelHistory.at(-1)
        if (keyboardEntry && visit?.panel === 'rest' && visit !== opener && visit.focus === focusKey(control))
          visit.restFeedMixDay = farm.day
      }
      break
    case 'mix-chicken-feed': {
      const keyboardMix = event.detail === 0 && document.activeElement === control
      if (panel === 'chicken-feed' && dialog.open && perform(() => mixChickenFeed(farm, value), false, true)
        && keyboardMix && document.activeElement === closeButton) {
        // The chosen recipe ran out. Review the new stock rather than arming Close or the other mix.
        dialogContent.querySelector<HTMLElement>('[data-feed-stock]')?.focus()
      }
      break
    }
    case 'feed': if(perform(() => feedChickens(farm), false, farm.progress.feed > 0))playBaySound('flock.feed', 1, 0); break
    case 'collect': {
      const firstIncubatorEgg = panel === 'coop' && dialog.open && farm.coopSpecialization === 'hatchery'
        && farm.hatchDay === null && farm.eggs === 0 && event.detail === 0 && document.activeElement === control
      if (perform(() => collectEggs(farm))) {
        playBaySound('flock.eggs', 1, 0)
        if (firstIncubatorEgg)
          highlightControl(dialogContent.querySelector('.coop-primary [data-action="incubate-egg"]:not(:disabled)')?.closest<HTMLElement>('.dialog-row') ?? null)
      }
      break
    }
    case 'unpack-egg-basket': {
      const fromIncubator = panel === 'coop' && dialog.open && hasIncubatorBasketSource(farm)
        && !!control.closest('.coop-packing .dialog-row.guidance-target')
      if (perform(() => unpackEggBasket(farm), false, true) && fromIncubator) {
        // Return to the now-usable incubator row without arming egg insertion.
        highlightControl(dialogContent.querySelector('.coop-primary [data-action="incubate-egg"]:not(:disabled)')?.closest<HTMLElement>('.dialog-row') ?? null)
      }
      break
    }
    case 'unpack-egg-crate':perform(()=>unpackEggCrate(farm),false,true);break
    case 'pack-egg-basket': arrangementRequest = { kind: 'packing', mode: 'eggs' }; openPanel('arrangement'); break
    case 'pack-egg-crate': arrangementRequest = { kind: 'packing', mode: 'crate' }; openPanel('arrangement'); break
    case 'incubator-warehouse-basket': {
      if (panel !== 'coop' || !dialog.open || !dialogContent.contains(control)) break
      const storedBasket = getIncubatorWarehouseBasket(farm)
      if (!storedBasket || value !== storedBasket.token) break
      if (perform(() => withdrawWarehouseSupply(farm,storedBasket.request,storedBasket.supply),false,true)) {
        playBaySound('harbour.crate')
        highlightControl(dialogContent.querySelector('.coop-packing [data-action="unpack-egg-basket"]:not(:disabled)')?.closest<HTMLElement>('.dialog-row') ?? null)
      }
      break
    }
    case 'incubator-warehouse-egg': {
      if (panel !== 'coop' || !dialog.open || !dialogContent.contains(control)) break
      const storedEgg = getIncubatorWarehouseEgg(farm)
      if (!storedEgg || value !== storedEgg.token) break
      if (perform(() => withdrawWarehouseSupply(farm,storedEgg.request,storedEgg.supply),false,true)) {
        playBaySound('harbour.crate')
        highlightControl(dialogContent.querySelector('.coop-primary [data-action="incubate-egg"]:not(:disabled)')?.closest<HTMLElement>('.dialog-row') ?? null)
      }
      break
    }
    case 'incubator-basket':
      if (panel==='coop' && dialog.open && hasIncubatorBasketSource(farm))
        highlightControl(dialogContent.querySelector('.coop-packing [data-action="unpack-egg-basket"]:not(:disabled)')?.closest<HTMLElement>('.dialog-row') ?? null)
      break
    case 'incubate-egg': perform(() => incubateEgg(farm)); break
    case 'incubate-rare-egg':
      if (panel === 'coop' && dialog.open && dialogContent.contains(control))
        perform(() => incubateRareEgg(farm, value))
      break
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
      const expeditionBeforeNight=farm.freight.expeditions.active ? {...farm.freight.expeditions.active} : null
      const expeditionWasSailing=farm.freight.expeditions.active?.phase==='sailing'
      const returnSerial=expeditionWasSailing ? panelHistory.at(-1)?.ferryMorning : undefined
      const rested=perform(() => {
        const result=endDay(farm)
        if(result.ok)committedRestClose=true
        return result
      },true)
      if(rested)ferryArrival.recordNight(expeditionBeforeNight,farm.freight.expeditions.active)
      if(rested){playBaySound(expeditionWasSailing&&farm.freight.expeditions.active?.phase==='ready'||oldShip.phase==='sailing'&&farm.freight.ship.phase==='docked'?'harbour.berth':'daybreak.shutters')}
      if (rested && farm.flockSize > flockSize) {
        playBaySound('flock.hatch', 1, 0);island.showHatch()
        selectedFriendHen = farm.flockSize - 1
        notify(`Из яйца вылупилась ${henFriends[selectedFriendHen].name}.`)
      }
      if (rested && returnSerial === expeditionBeforeNight?.serial && returnSerial !== undefined &&
          farm.freight.expeditions.active?.phase === 'ready' && farm.freight.expeditions.active.serial === returnSerial) {
        panelHistory.length=0
        openPanel('bay-freight',false)
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
    case 'visit-market':
      if (value === 'orders') {
        if (island.isCrossing()) break
        island.visit({kind:'market'})
        openGuidedMarket(value)
      } else activateTarget({kind:'market'})
      break
    case 'fishing-practice': if (panel === 'fishing' && canPracticeFishing(farm)) mountFishing(true); break
    case 'fishing-resume-shore':
    case 'fishing-abandon-shore': {
      const trip = panel === 'fishing' && dialog.open ? getOtherShoreFishingTrip(farm) : undefined
      if (!trip || value !== String(trip.token)) break
      if (action === 'fishing-resume-shore') {
        if (getResumableFishingTrip({...farm,island:trip.island})) await visitPanelAt(trip.island,'fishing')
      } else if (perform(() => cancelFishingTrip(farm,trip.token),true,true)) {
        // Leave the review; a repeat of the abandon click cannot land on a new cast.
        closeDialog()
      }
      break
    }
    case 'visit-pier': activateTarget({ kind: 'pier' }); break
    case 'visit-hive': activateTarget({ kind: 'hive' }); break
    case 'visit-honey-kitchen': activateTarget({ kind: 'honey-kitchen' }); break
    case 'cape-upgrade': openPanel('cape-upgrade'); break
    case 'build-cape-upgrade': if(perform(()=>upgradeCape(farm),true))playBaySound('build.finish'); break
    case 'visit-guest': activateTarget({ kind: 'guest' }); break
    case 'bay-display': activateTarget({ kind: 'bay-display' }); break
    case 'cape-bouquet': {
      const bed=hiveFlower
      if(panel!=='hive'||bed===undefined||!value||getCapeBouquetPreview(farm,bed)?.token!==value)break
      closeDialog()
      island.workCape({kind:'flower',index:bed},()=>perform(()=>cutCapeBouquet(farm,bed,value)))
      break
    }
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
      revealTreeStorageReturn(dialogContent)
      break
    }
    case 'visit-tree': {
      if (value?.startsWith('peach:')) {
        if (panel !== 'bay-freight' || !dialog.open) break
        const choice = ferryPeachPlanting.resolve(farm, value)
        if (!choice) break
        activateTarget({ kind: 'tree', index: choice.slot })
        const peach = dialogContent.querySelector('[data-action="buy-plant-tree"][data-value="peach"]')
        highlightControl(peach?.closest('.sapling-option')?.querySelector('h2') ?? null)
      } else activateTarget({ kind: 'tree', index: Number(value) })
      revealTreeStorageReturn(dialogContent)
      break
    }
    case 'pet': activateTarget({ kind: 'hen', index: Number(value) }); break
    case 'gather-salt': activateTarget({ kind: 'salt' }); break
    case 'guide': openPanel('guide'); break
    case 'market-orchard-space': {
      if (panel !== 'market' || !dialog.open || marketTab !== 'buy' || marketCategory !== 'trees' || farm.island !== 'home' || farm.trees.home.includes(null)) break
      marketTreeSpaceVisit = rememberPanel()
      // The space button disappears once a slot is free. Return to the named category,
      // not an arbitrary purchase or a no-longer-present control.
      const category = dialogContent.querySelector<HTMLButtonElement>('[data-action="market-category"][data-value="trees"]')
      marketTreeSpaceVisit.focus = category ? focusKey(category) : undefined
      marketTreeSpaceVisit.scroll = 0
      panelHistory.push(marketTreeSpaceVisit)
      openPanel('orchard', false)
      break
    }
    case 'market-trees-return': {
      const index = marketTreeReturnIndex()
      if (!dialog.open || index < 0 || !farm.trees.home.includes(null)) break
      panelHistory.length = index + 1
      marketTreeSpaceVisit = undefined
      goBack()
      break
    }
    case 'orchard':
      if (value) treeStorageChoice.choose(farm,value)
      openPanel('orchard')
      if (value && farm.treeNursery.some(entry => entry.id === Number(value))) highlightControl(dialogContent.querySelector<HTMLElement>(`[data-action="return-nursery-tree"][data-value="${Number(value)}"]`))
      break
    case 'upgrades': {
      const marketBuilding = dialog.open && panel === 'market' && marketTab === 'buy' && marketCategory === 'buildings' && farm.island === 'home'
        ? buildingIds.find(id => id === value && farm.buildingLevels[id] >= 2) : undefined
      openPanel('upgrades')
      if (marketBuilding) {
        const title = dialogContent.querySelector<HTMLElement>(`[data-upgrade-title="${marketBuilding}"]`)
        title?.focus({preventScroll:true})
        title?.scrollIntoView({block:'nearest'})
      }
      break
    }
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
    case 'village-supply-pledge':
      if (panel==='village-project' && dialog.open && dialogContent.contains(control)
        && perform(()=>contributeVillageSupply(farm,value),false,true))playBaySound('harbour.crate')
      break
    case 'village-slot': villageSlot = Number(value) === 1 ? 1 : 0; drawPanel(); dialogContent.scrollTop=0; dialogContent.querySelector<HTMLButtonElement>(`[data-action="village-slot"][data-value="${villageSlot}"]`)?.focus({preventScroll:true}); break
    case 'invite-resident': {
      const id = residentIds.find(id => id === value)
      if (id) perform(() => inviteResident(farm, id, villageSlot), false, true)
      break
    }
    case 'practice-pattern': {
      const shape = workshopShapes.find(shape => shape === value)
      if (panel === 'village' && farm.village.residents[villageSlot] === 'bea' && shape === pastryShape
        && !farm.workshopPatterns.includes(shape) && getWorkshopAction(farm).available) {
        workshopRecipe = 'pastry'; openPanel('workshop')
      }
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
    case 'share-meal': if(value?.startsWith('supper:')) { const picked=panel==='village-meal'&&dialog.open&&dialogContent.contains(control)&&reviewedSupperFish(farm,dialogContent,value); if(picked&&!picked.id)finishSharedSupper(()=>serveVillageMeal(farm,pastryShape,picked.fish),true) } else finishSharedSupper(() => serveVillageMeal(farm, pastryShape), true); break
    case 'resident-service': {
      const guided = value?.startsWith('bea:')
      const shape = guided && dialog.open && dialogContent.contains(control)
        ? workshopShapes.find(shape => value === `bea:${shape}`) : undefined
      if (guided && !shape) break
      const id = guided ? 'bea' : residentIds.find(id => id === value)
      const fromTasting = id === 'bea' && !!panelHistory.at(-1)?.tastingBakery
      if (id && panel === 'village' && farm.village.residents[villageSlot] === id
        && perform(() => runResidentService(farm, id, shape ?? pastryShape), id !== 'finn' && !fromTasting, !fromTasting) && id === 'finn')
        dialogContent.querySelector<HTMLElement>('[data-finn-hook]')?.focus({preventScroll:true})
      break
    }
    case 'finn-pier': {
      if (panel !== 'village' || !dialog.open || farm.village.residents[villageSlot] !== 'finn') break
      const route = getFinnFishingRoute(farm)
      const pier = value ? [route, route?.alternate].find(choice => choice?.value === value) : undefined
      if (pier) await visitPanelAt(pier.island,pier.panel)
      else drawPanel()
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
      if (panel === 'tree' && Number(value) === treeSlot && perform(() => {
        const result = storeTree(farm, treeSlot)
        if (result.ok) treeStorageChoice.afterStore(farm)
        return result
      })) {
        dialogContent.scrollTop = 0
        const continuation = dialogContent.querySelector<HTMLButtonElement>('[data-action="market-trees-return"]')
        if (continuation) {
          continuation.focus({ preventScroll: true })
          continuation.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        } else {
          dialogContent.querySelector<HTMLButtonElement>('[data-action="return-nursery-tree"]')?.focus({ preventScroll: true })
          revealTreeStorageReturn(dialogContent)
        }
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
    case 'fruit-tree-seed':
      if (panel === 'tree' && dialog.open && dialogContent.contains(control)
        && perform(() => plantFruitTreeSeed(farm, treeSlot, value), false, true)) {
        playBaySound('orchard.sapling', 1, 0)
        dialogContent.querySelector<HTMLElement>('[data-tree-remaining]')?.focus({preventScroll:true})
      }
      break
    case 'buy-plant-tree': {const tree=treeIds.find(id=>id===value);if(tree && perform(()=>buyAndPlantTree(farm,treeSlot,tree)))playBaySound('orchard.sapling', 1, 0);break}
    case 'nursery-sail-plot': {
      if(!dialog.open||(panel!=='tree'&&panel!=='orchard')||island.isCrossing())break
      const crossing=treeStorageChoice.otherPlot(farm)
      if(!crossing||crossing.key!==value)break
      treeSlot=crossing.slot
      // Sailing opens the exact empty plot. Returning the tree and picking its
      // fruit are still ordinary, separate, explicit local actions.
      await visitPanelAt(crossing.to,'tree')
      if(dialog.open&&panel==='tree'&&farm.island===crossing.to&&treeSlot===crossing.slot
          &&farm.trees[crossing.to][crossing.slot]===null&&treeStorageChoice.current(farm)?.id===crossing.id)
        revealTreeStorageReturn(dialogContent)
      break
    }
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
    case 'visit-show-tree': {
      if(panel!=='tree'||!dialog.open||island.isCrossing()||!dialogContent.contains(control))break
      const tree=standingVisitTree(farm)
      if(!tree||tree.index!==treeSlot||tree.token!==value)break
      closeDialog()
      if(perform(()=>showStandingVisitTree(farm,tree.token))){
        island.guideHomeVisitorToTree(tree.index)
        island.focusTarget({kind:'tree',index:tree.index})
      }
      break
    }
    case 'pick-fruit': {
      const tree = (farm.island === 'home' || farm.island === 'grove') && farm.trees[farm.island][treeSlot]
      if(tree && perform(() => pickFruit(farm, treeSlot))) {
        playBaySound(orchardPickSound(tree.tree), 1, 0)
        dialogContent.querySelector<HTMLButtonElement>('.tree-focus [data-action="back"]')?.focus({preventScroll:true})
      }
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
  if (panel === 'arrangement' && arrangementRequest?.kind === 'neighbor') returnFromNeighborArrangement()
  else closeDialog()
}
closeButton.addEventListener('click', closeCurrentPanel)
function returnFromPanel(event: Event) {
  if (event.defaultPrevented) return
  if(closeContextualSale()){event.preventDefault();return}
  if(returnToRecipeIndex()){event.preventDefault();return}
  if (panel === 'bay-freight' && returnToFerrySupplyOrigin()) {event.preventDefault();return}
  if (panel === 'arrangement' && arrangementRequest?.kind === 'neighbor') {
    event.preventDefault()
    returnFromNeighborArrangement(event.type==='keydown')
  } else if (panelHistory.length) {
    event.preventDefault()
    goBack(event.type==='keydown')
  } else if (event.type === 'cancel') rememberClosedMarketSell()
}
dialog.addEventListener('cancel', returnFromPanel)
dialog.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  // Handle keyboard return before the native dialog close request. Browsers may
  // make repeated native cancel events non-cancelable between user activations.
  if (event.repeat) event.preventDefault()
  else returnFromPanel(event)
})
dialog.addEventListener('keydown',event=>{if(event.altKey&&event.key==='ArrowLeft'&&salePresentation.place){event.preventDefault();closeContextualSale();return}if(event.altKey&&event.key==='ArrowLeft'&&panel==='bay-freight'&&returnToFerrySupplyOrigin()){event.preventDefault();return}if(event.altKey&&event.key==='ArrowLeft'&&(panelHistory.length||panel==='recipes'&&recipeBook.view.mode==='detail'&&recipeBookNarrow())){event.preventDefault();if(!returnToRecipeIndex())goBack(true)}})
dialog.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !(event.target instanceof HTMLButtonElement)) return
  const selector = event.target.closest('.island-selector,.house-selector,.tree-selector,.panel-tabs,.market-category-icons,.recipe-family-choices,.recipe-fish-choices')
  if (!selector || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return
  const choiceSelector = selector.classList.contains('recipe-family-choices')
    ? 'button[data-action="recipe-family"]:not(:disabled)' : 'button:not(:disabled)'
  const choices = [...selector.querySelectorAll<HTMLButtonElement>(choiceSelector)]
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
stackedMarketOrders.addEventListener('change', ({ matches }) => {
  if (dialog.open && panel === 'market' && marketTab === 'orders') placeReadyMarketOrder(dialogContent, matches)
})
window.matchMedia('(max-width: 819px), (max-height: 559px)').addEventListener('change',()=>{if(dialog.open&&panel==='recipes')drawPanel()})
dialogContent.addEventListener('toggle',event=>{
  const details=event.target
  if(details instanceof HTMLDetailsElement&&details.isConnected&&panel==='recipes'&&details.dataset.repeatGuide){
    if(details.open)expandedRepeatId=details.dataset.repeatGuide
    else if(expandedRepeatId===details.dataset.repeatGuide)expandedRepeatId=undefined
  }
  const detail=event.target
  if(detail instanceof HTMLDetailsElement && detail.hasAttribute('data-guide-garden') && panel==='guide' && detail.open){
    const summary=detail.querySelector('summary')
    // Reveal a group the player just opened, never overwrite a restored Back position.
    if(summary===document.activeElement && detail.getBoundingClientRect().bottom>dialogContent.getBoundingClientRect().bottom)summary?.scrollIntoView({block:'start'})
  }
  if(detail instanceof HTMLDetailsElement && detail.classList.contains('journey-details')) journeyDetailsOpen=detail.open
  if(detail instanceof HTMLDetailsElement && detail.classList.contains('discovery-roadmap')) journalDetailsOpen=detail.open
},true)
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) closeDialog()
})
dialog.addEventListener('close', () => {
  const quietRestClose = committedRestClose
  committedRestClose = false
  if (!dialog.open) {
    stopCoopServices()
    salePresentation.reset()
    transplantSelection.reset()
  berryNurserySelection.reset(); berryRenewalSelection.reset(); recipeSurplusSelection.reset()
    if (!quietRestClose) playBaySound('page.fold',.72,0)
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
  if(input instanceof HTMLSelectElement && input.matches('[data-market-sale-group],[data-market-sale-family]') && panel==='market' && marketTab==='sell' && dialog.open) {
    let changed=false
    if(input.value.startsWith('family:')||input.hasAttribute('data-market-sale-family'))changed=selectMarketFamily(input.value)
    else if(['all','harvest','kitchen','shore'].includes(input.value)){
      changed=selectMarketSaleGroup(input.value as typeof marketSellGroup)
    }
    if(changed)dialogContent.querySelector<HTMLSelectElement>(input.hasAttribute('data-market-sale-family')?'[data-market-sale-family]':'[data-market-sale-group]')?.focus({preventScroll:true})
  }
  if (input instanceof HTMLSelectElement && input.dataset.commissionView && panel === 'shop-commissions' && dialog.open) {
    const part=input.dataset.commissionView
    if(shopCommissionView.choose(farm,part,input.value)){
      drawPanel();dialogContent.scrollTop=0
      dialogContent.querySelector<HTMLSelectElement>(`[data-commission-view="${CSS.escape(part)}"]`)?.focus({preventScroll:true})
    }
  }
  if (input instanceof HTMLSelectElement && input.dataset.commissionPair && panel === 'shop-commissions' && dialog.open) {
    const part = input.dataset.commissionPair, customer = input.dataset.customer
    if (shopAssortmentChoice.choose(farm, customer, part, input.value)) {
      const scroll = dialogContent.scrollTop
      drawPanel(); dialogContent.scrollTop = scroll
      dialogContent.querySelector<HTMLSelectElement>(`[data-commission-pair="${part}"][data-customer="${CSS.escape(customer!)}"]`)?.focus({preventScroll:true})
    }
  }
  if (input instanceof HTMLSelectElement && input.matches('[data-tree-storage-choice]') && (panel === 'tree' || panel === 'orchard') && dialog.open) {
    if (treeStorageChoice.choose(farm,input.value)) {
      drawPanel()
      const choice=dialogContent.querySelector<HTMLSelectElement>('[data-tree-storage-choice]')
      choice?.focus({preventScroll:true})
      choice?.scrollIntoView({block:'nearest'})
      revealTreeStorageReturn(dialogContent)
    }
  }
  if((input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement)&&input.dataset.recipeName)perform(()=>nameSignature(farm,input.dataset.recipeName!,input.value),false,true)
})
dialogContent.addEventListener('focusin', event => {
  const target = event.target
  if (!(target instanceof HTMLButtonElement) || !target.matches('.seed-picker-tile:focus-visible')) return
  // Check after native Tab scrolling or drawPanel's replacement-focus restoration.
  requestAnimationFrame(() => {
    if (dialog.open && (panel === 'seeds' || panel === 'inventory' && bagTab === 'seeds'))
      revealSeedPickerFocus(dialogContent, target)
  })
})
// Native focus scrolling may reveal only a text caret in a nested short viewport.
// Reveal the whole compact row once on focus so its exact quantity and action stay together.
app.addEventListener('focusin',event=>{
  if(panel==='market'&&marketTab==='buy'&&marketCategory==='care'&&event.target instanceof HTMLButtonElement&&event.target.matches('[data-action=buy-feed]:focus-visible,[data-action=upgrade-can]:focus-visible')&&matchMedia('(max-height:400px) and (orientation:landscape)').matches)
    event.target.closest<HTMLElement>('[data-care-product]')?.scrollIntoView({block:'nearest',inline:'nearest'})
  if(panel==='market'&&marketTab==='buy'&&marketCategory==='trees'&&event.target instanceof HTMLButtonElement&&event.target.matches('[data-action=buy-sapling]:focus-visible')&&matchMedia('(max-height:400px) and (orientation:landscape)').matches)
    event.target.closest<HTMLElement>('[data-tree-product]')?.scrollIntoView({block:'nearest',inline:'nearest'})
  if(panel==='market'&&marketTab==='sell'&&event.target instanceof HTMLInputElement&&event.target.matches('[data-inline-quantity]')&&matchMedia('(max-height:400px) and (orientation:landscape)').matches)
    event.target.closest<HTMLElement>('.market-inline-card')?.scrollIntoView({block:'nearest',inline:'nearest'})
})
app.addEventListener('compositionend', event => {
  if (event.target instanceof HTMLInputElement && event.target.matches('[data-market-sale-query]') && panel==='market' && marketTab==='sell')
    setMarketSaleQuery(event.target.value)
})
app.addEventListener('input', event => {
  if(event.target instanceof HTMLInputElement&&event.target.matches('[data-inline-quantity]')){const context=inlineSaleContext(event.target);if(context&&marketInlineSales.edit(context.item.key,context.token,event.target.value,context.item.count,context.item.price))updateInlineSaleCard(context.card)}
  if (event.target instanceof HTMLInputElement && event.target.matches('[data-recipe-query]')) updateRecipeBookSearch(event.target.value)
  if (event.target instanceof HTMLInputElement && event.target.matches('[data-market-sale-query]') && panel==='market' && marketTab==='sell'
    && !('isComposing' in event && event.isComposing)) setMarketSaleQuery(event.target.value)
  if (event.target instanceof HTMLInputElement && event.target.matches('[data-garden-name]') && panel === 'garden-plans' && gardenEditor.draft) gardenEditor.draft.name = event.target.value
  if (event.target instanceof HTMLInputElement && event.target.matches('[data-sale-quantity]')) {
    if(currentSaleControl(event.target)){saleQuantity = event.target.value; updateSaleQuote()}
  }
})
app.addEventListener('keydown', event => {
  if(!event.defaultPrevented&&event.key==='Enter'&&event.target instanceof HTMLInputElement&&event.target.matches('[data-inline-quantity]')){event.preventDefault();if(!event.repeat)confirmInlineSale(event.target,document.activeElement===event.target)}
  if (!event.defaultPrevented && event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.matches('[data-sale-quantity]')) {
    event.preventDefault()
    if (!event.repeat && currentSaleControl(event.target)) dialogContent.querySelector<HTMLButtonElement>('[data-action="confirm-sale"]')?.click()
  }
})
app.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)&&event.target.dataset.recipeName){event.preventDefault();event.target.blur()}})

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
  if (tool === 'coop' && farm.island === 'cape') return
  if (tool) {
    event.preventDefault()
    useHotbar(tool, true)
  }
})

saveRecovery = mountSaveRecovery(saveStore, saveFarm)
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
