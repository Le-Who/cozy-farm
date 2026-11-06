import './style.css'
import {
  boatPrice,
  buildingDefinitions,
  buildingIds,
  buyBoat,
  buyFeed,
  buySapling,
  buySeeds,
  canUpgradePrice,
  catchFish,
  chickenCount,
  collectEggs,
  cookDish,
  createFarm,
  cropDefinitions,
  cropIds,
  dishDefinitions,
  dishIds,
  endDay,
  expandedWaterCapacity,
  feedBagPrice,
  feedBagSize,
  feedChickens,
  fishDailyLimit,
  fishDefinitions,
  fishIds,
  gatherSeaSalt,
  getBedAction,
  getBedStage,
  getCookAction,
  getDayPhase,
  getFishAction,
  getGoal,
  getSale,
  getTreeAction,
  getWaterCapacity,
  islandIds,
  maxChickenHappiness,
  petChicken,
  pickFruit,
  plantTree,
  refillWater,
  restoreFarm,
  sail,
  seedPackSize,
  selectSeed,
  sellProduce,
  treeDefinitions,
  treeIds,
  upgradeBuilding,
  upgradeCan,
  workBed,
  type CropId,
} from './farm'
import { createIsland, type IslandTarget } from './island'

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
  return `${import.meta.env.BASE_URL}art/icons/${name}.webp`
}

function icon(name: string, className = '') {
  return `<img class="icon ${className}" src="${iconUrl(name)}" alt="" aria-hidden="true" draggable="false">`
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
type Panel = 'market' | 'inventory' | 'settings' | 'journal' | 'coop' | 'rest' | 'guide' | 'seeds'
  | 'fishing' | 'boat' | 'orchard' | 'tree' | 'upgrades' | 'kitchen'

let activeTool: Tool = 'seeds'
let panel: Panel | undefined
let treeSlot = 0
const islandNames = { home: 'Cozy Farm', grove: 'Saltwind Grove' }

function statusItem(id: string, image: string, label: string) {
  return `<div class="status-item status-${id}">
    <span class="status-icon" id="status-${id}-icon">${icon(image)}</span>
    <span><span class="status-label sr-only">${label} </span><span class="status-value" id="status-${id}"></span></span>
  </div>`
}

const app = document.querySelector<HTMLElement>('#app')!
app.innerHTML = `
  <main class="game-shell" aria-label="Cozy Farm">
    <canvas class="island-canvas" tabindex="0" aria-label="Cozy Farm island. Use the arrow keys to select a farm location and Enter to interact."></canvas>
    <header class="hud-top">
      <div class="status-bar" aria-label="Farm status">
        ${statusItem('day', 'sun', 'Farm day')}
        ${statusItem('phase', 'sun', 'Time of day')}
        ${statusItem('coins', 'coin', 'Coins')}
        ${statusItem('water', 'drop', 'Water')}
        ${statusItem('seed', 'carrot', 'Selected seeds')}
        ${statusItem('tool', 'seeds', 'Current tool')}
      </div>
      <nav class="hud-actions" aria-label="Farm menus">
        <button class="hud-button" type="button" data-panel="market" aria-label="Market" title="Market">${icon('shop')}</button>
        <button class="hud-button" type="button" data-panel="inventory" aria-label="Inventory" title="Inventory">${icon('pack')}</button>
        <button class="hud-button" type="button" data-panel="settings" aria-label="Settings" title="Settings">${icon('gear')}</button>
      </nav>
    </header>
    <aside class="task-card" aria-label="Current task">
      <button class="task-heading" type="button" data-panel="journal" aria-label="Current task, open farm journal" aria-keyshortcuts="J" title="Open farm journal (J)">
        <span class="task-medallion">${icon('star')}</span><span>Current Task</span><kbd aria-hidden="true">J</kbd>
      </button>
      <div class="task-content">
        <p class="task-name" id="task-name"></p>
        <p class="task-count" id="task-count"></p>
        <progress class="task-progress" aria-labelledby="task-name" max="1" value="0"></progress>
        <div class="task-reward">${icon('coin')}<span id="task-reward"></span></div>
      </div>
    </aside>
    <div class="island-location" hidden>${icon('island')}<span>Saltwind Grove</span></div>
    <button class="view-toggle" type="button" data-action="field-view" aria-pressed="false">${icon('field')}<span>Field view</span></button>
    <div class="hud-bottom">
      <button class="hud-hint" type="button" data-panel="guide" aria-label="Open farm guide" aria-describedby="farm-hint-text" aria-keyshortcuts="?" title="Open farm guide">
        <span class="hint-icon">${icon('star')}</span><span class="hint-text" id="farm-hint-text"></span><kbd aria-hidden="true">?</kbd>
      </button>
      <div class="hotbar" role="group" aria-label="Tool belt">
        ${tools.map(({ id, label, image, key }) => `<button class="hotbar-slot" type="button" data-tool="${id}" aria-label="${label}" aria-describedby="slot-count-${id}" title="${label} (${key})" aria-pressed="false" aria-keyshortcuts="${key}">
          <span class="slot-icon">${icon(image)}</span><kbd class="slot-key" aria-hidden="true">${key}</kbd><span class="slot-count" id="slot-count-${id}" hidden></span>
        </button>`).join('')}
      </div>
    </div>
    <p class="toast" role="status" aria-live="polite" hidden></p>
    <dialog class="farm-dialog" aria-labelledby="dialog-title">
      <section class="dialog-panel">
        <header class="dialog-header">
          <div><p class="dialog-eyebrow">COZY FARM</p><h1 class="dialog-title" id="dialog-title"></h1></div>
          <button class="dialog-close" type="button" aria-label="Close menu">${icon('close')}</button>
        </header>
        <div class="dialog-content"></div>
      </section>
    </dialog>
  </main>
`

const canvas = app.querySelector<HTMLCanvasElement>('.island-canvas')!
const dialog = app.querySelector<HTMLDialogElement>('.farm-dialog')!
const dialogTitle = app.querySelector<HTMLElement>('.dialog-title')!
const dialogContent = app.querySelector<HTMLElement>('.dialog-content')!
const closeButton = app.querySelector<HTMLButtonElement>('.dialog-close')!
const toast = app.querySelector<HTMLParagraphElement>('.toast')!
const taskProgress = app.querySelector<HTMLProgressElement>('.task-progress')!
const taskReward = app.querySelector<HTMLElement>('.task-reward')!
const hintText = app.querySelector<HTMLElement>('.hint-text')!
const hotbarButtons = Array.from(app.querySelectorAll<HTMLButtonElement>('.hotbar-slot'))
const marketButton = app.querySelector<HTMLButtonElement>('[data-panel="market"]')!
const islandLocation = app.querySelector<HTMLElement>('.island-location')!
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

function notify(message: string, ok = true) {
  window.clearTimeout(toastTimer)
  toast.textContent = message
  toast.dataset.tone = ok ? 'good' : 'bad'
  toast.hidden = false
  toastTimer = window.setTimeout(() => { toast.hidden = true }, 3200)
}

function currentTask() {
  if (farm.island === 'home') return getGoal(farm)
  return {
    label: 'Explore Saltwind Grove',
    detail: `Catch ${fishDailyLimit} sea bass and gather sea salt today.`,
    progress: farm.fishCaughtToday.grove + Number(farm.saltGatheredToday),
    target: fishDailyLimit + 1,
    reward: undefined,
  }
}

function status() {
  const tool = tools.find(({ id }) => id === activeTool)!
  const goal = currentTask()
  const atHome = farm.island === 'home'
  const counts: Partial<Record<Tool, number>> = {
    seeds: farm.seeds[farm.selectedSeed],
    feed: farm.feed,
    basket: getSale(farm).items,
    coop: farm.eggsReady,
    rod: fishDailyLimit - farm.fishCaughtToday[farm.island],
  }

  textAt('status-day', `Day ${farm.day}`)
  const phase = getDayPhase(farm)
  textAt('status-phase', phase)
  statusIcon('phase', phase === 'Evening' ? 'moon' : 'sun')
  textAt('status-coins', numberFormat.format(farm.coins))
  textAt('status-water', `${farm.water}/${getWaterCapacity(farm)}`)
  textAt('status-seed', `${cropDefinitions[farm.selectedSeed].name} Seeds`)
  statusIcon('seed', farm.selectedSeed)
  textAt('status-tool', tool.label)
  statusIcon('tool', tool.image)

  textAt('task-name', goal?.label ?? 'Make yourself at home')
  textAt('task-count', goal ? `${goal.progress} / ${goal.target}` : 'Journal complete')
  textAt('task-reward', goal?.reward === undefined ? 'All rewards earned' : numberFormat.format(goal.reward))
  taskReward.hidden = !atHome
  taskProgress.max = goal?.target ?? 1
  taskProgress.value = goal?.progress ?? 1
  marketButton.disabled = !atHome
  marketButton.title = atHome ? 'Market' : 'The market is back at Cozy Farm'
  islandLocation.hidden = atHome
  fieldViewButton.hidden = !atHome
  hintText.textContent = !atHome && goal?.progress === goal?.target
    ? 'Explore the orchard or sail back to Cozy Farm.'
    : goal?.detail ?? 'Fish at the pier or take the boat to Saltwind Grove.'

  for (const button of hotbarButtons) {
    const toolId = button.dataset.tool as Tool
    const count = counts[toolId]
    const badge = button.querySelector<HTMLElement>('.slot-count')!
    button.setAttribute('aria-pressed', String(toolId === activeTool))
    badge.hidden = count === undefined
    badge.textContent = count === undefined ? '' : String(count)
  }
}

const panelTitles: Record<Panel, string> = {
  market: 'Island Market',
  inventory: 'Farm Inventory',
  settings: 'Settings',
  journal: 'Farm Journal',
  coop: 'Chicken Coop',
  rest: 'Farmhouse',
  guide: 'Around the Island',
  seeds: 'Seed Pouch',
  fishing: 'Fishing Pier',
  boat: 'The Boat Dock',
  orchard: 'Island Orchard',
  tree: 'Orchard Plot',
  upgrades: 'Building Upgrades',
  kitchen: 'Farmhouse Kitchen',
}

type ButtonOptions = { secondary?: boolean; crop?: CropId; value?: string | number; context?: string }

function button(label: string, action: string, enabled = true, options: ButtonOptions = {}) {
  const { secondary, crop, value, context = crop ? `${cropDefinitions[crop].name} seeds` : undefined } = options
  return `<button class="dialog-button${secondary ? ' secondary' : ''}" type="button" data-action="${action}"
    ${crop ? `data-crop="${crop}"` : ''} ${value !== undefined ? `data-value="${value}"` : ''}
    ${context ? `aria-label="${label}, ${context}"` : ''} ${enabled ? '' : 'disabled'}>${label}</button>`
}

function quantity(count: number, noun: string) {
  return `${numberFormat.format(count)} ${noun}${count === 1 ? '' : 's'}`
}

function row(image: string, name: string, detail: string, actions = '') {
  return `<li class="dialog-row"><span class="dialog-icon">${icon(image)}</span>
    <span class="dialog-row-copy"><strong>${name}</strong><small>${detail}</small></span>
    ${actions ? `<span class="dialog-row-actions">${actions}</span>` : ''}
  </li>`
}

function nav(...buttons: string[]) {
  return `<div class="dialog-grid dialog-nav">${buttons.join('')}</div>`
}

function treeRow(index: number) {
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

const fishingPass = 3800
const fishingBand = 22
let fishingRound: { started: number; zone: number; position: number } | undefined
let fishingFrame = 0

function fishingPosition(now: number, started: number) {
  const phase = (Math.max(0, now - started) / fishingPass) % 2
  return 100 * (phase <= 1 ? phase : 2 - phase)
}

function updateFishingMeter(now: number) {
  const round = fishingRound
  if (!round || !dialog.open || panel !== 'fishing') return
  const track = dialogContent.querySelector<HTMLElement>('.fishing-track')!
  const marker = track.querySelector<HTMLElement>('.fishing-marker')!
  const cue = dialogContent.querySelector<HTMLElement>('.fishing-cue')!
  const position = fishingPosition(now, round.started)
  round.position = position
  const ready = position >= round.zone && position <= round.zone + fishingBand
  marker.style.left = `${position}%`
  if (track.dataset.ready !== String(ready)) {
    track.dataset.ready = String(ready)
    cue.textContent = ready ? 'Reel now!' : 'Wait for the green band.'
    island.setFishingBite(ready)
  }
  fishingFrame = requestAnimationFrame(updateFishingMeter)
}

function stopFishing() {
  if (!fishingRound) return
  fishingRound = undefined
  cancelAnimationFrame(fishingFrame)
  island.setFishing(false)
}

function castLine() {
  if (fishingRound || !getFishAction(farm).available) return
  fishingRound = { started: performance.now(), zone: 32 + Math.round(Math.random() * 30), position: 0 }
  island.setFishing(true)
  drawPanel()
  dialogContent.querySelector<HTMLButtonElement>('[data-action="reel"]')!.focus({ preventScroll: true })
  fishingFrame = requestAnimationFrame(updateFishingMeter)
}

function reelLine() {
  if (!fishingRound) return
  const { position, zone } = fishingRound
  stopFishing()
  drawPanel()
  perform(() => catchFish(farm, position >= zone && position <= zone + fishingBand))
  dialogContent.querySelector<HTMLButtonElement>('[data-action="cast"]:not(:disabled)')?.focus({ preventScroll: true })
}

function drawPanel() {
  if (!panel) return
  dialogTitle.textContent = panelTitles[panel]
  const focused = document.activeElement instanceof HTMLButtonElement && dialogContent.contains(document.activeElement)
    ? document.activeElement
    : undefined

  switch (panel) {
    case 'market': {
      const sale = getSale(farm)
      dialogContent.innerHTML = `<p class="dialog-intro">You have <strong>${numberFormat.format(farm.coins)} coins</strong> to spend.</p>
        ${nav(button('Boat dock', 'visit-boat', true, { secondary: true }), button('Building upgrades', 'upgrades', true, { secondary: true }))}
        <ul class="dialog-list">
          ${row('crate', 'Sell farm goods', sale.items ? `${quantity(sale.items, 'item')} ready to sell · cook ingredients first if you want to make meals` : 'Bring crops, fruit, fish, eggs, or meals', button(`Sell all · ${quantity(sale.coins, 'coin')}`, 'sell', sale.items > 0))}
          ${row('feed', 'Chicken feed', `${quantity(feedBagSize, 'serving')} per bag`, button(`Buy · ${quantity(feedBagPrice, 'coin')}`, 'buy-feed', farm.coins >= feedBagPrice))}
          ${row('can', 'Large watering can', `Holds ${expandedWaterCapacity} servings of water`, button(farm.canUpgraded ? 'Owned' : `Upgrade · ${quantity(canUpgradePrice, 'coin')}`, 'upgrade-can', !farm.canUpgraded && farm.coins >= canUpgradePrice))}
          ${treeIds.map((tree) => {
            const definition = treeDefinitions[tree]
            return row('orchard', `${definition.name} sapling`, `${quantity(definition.days, 'night')} to mature`,
              button(`Buy · ${quantity(definition.saplingPrice, 'coin')}`, 'buy-sapling', farm.coins >= definition.saplingPrice, { value: tree, context: `${definition.name} sapling` }))
          }).join('')}
          ${cropIds.map((crop) => {
            const definition = cropDefinitions[crop]
            return row(crop, `${definition.name} seeds`, `${quantity(seedPackSize, 'seed')} per packet · ${quantity(definition.days, 'night')} to grow`,
              button(`Buy · ${quantity(definition.seedPrice, 'coin')}`, 'buy-seeds', farm.coins >= definition.seedPrice, { crop }))
          }).join('')}
        </ul>`
      break
    }
    case 'inventory':
    case 'seeds': {
      const inventory = panel === 'inventory'
      dialogContent.innerHTML = `<p class="dialog-intro">${inventory ? 'Check what you have on hand and choose what to plant next.' : 'Choose the seeds you want to plant in tilled soil.'}</p>
        <ul class="dialog-list">
          ${inventory ? [
            row('feed', 'Chicken feed', quantity(farm.feed, 'serving')),
            row('egg', 'Eggs', `${farm.eggs} in your basket`),
            row('crate', 'Sea salt', `${farm.seaSalt} on hand`),
            ...treeIds.map((tree) => row(tree === 'apple' ? 'apple' : 'orchard', treeDefinitions[tree].name, `${farm.fruit[tree]} picked · ${quantity(farm.saplings[tree], 'sapling')}`)),
            ...fishIds.map((fish) => row('fish', fishDefinitions[fish].name, `${farm.fish[fish]} caught`)),
            ...dishIds.map((dish) => row('meal', dishDefinitions[dish].name, `${farm.dishes[dish]} prepared`)),
          ].join('') : ''}
          ${cropIds.map((crop) => {
            const selected = crop === farm.selectedSeed
            return row(crop, cropDefinitions[crop].name,
              `${quantity(farm.seeds[crop], 'seed')}${inventory ? ` · ${farm.produce[crop]} harvested` : ''}`,
              button(selected ? 'Selected' : 'Select', 'select-seed', !selected && farm.seeds[crop] > 0, { crop, secondary: selected }))
          }).join('')}
        </ul>`
      break
    }
    case 'coop':
      dialogContent.innerHTML = `<p class="dialog-intro">Fed chickens lay eggs overnight. Tap or gently drag a hen in the pen to pet her. Flock happiness ${farm.chickenHappiness}/${maxChickenHappiness}.</p>
        ${nav(button('Building upgrades', 'upgrades', true, { secondary: true }))}
        <ul class="dialog-list">
          ${row('feed', 'Feed the chickens', farm.chickensFed ? 'The flock has eaten today' : `${quantity(farm.feed, 'serving')} available`,
            button('Feed flock', 'feed', !farm.chickensFed && farm.feed > 0))}
          ${row('egg', 'Gather eggs', `${farm.eggsReady} ready to collect`, button('Collect eggs', 'collect', farm.eggsReady > 0))}
          ${Array.from({ length: chickenCount }, (_, index) => {
            const petted = farm.pettedChickens.includes(index)
            return row('hen', `Hen ${index + 1}`, petted ? 'Petted today' : 'Would like a pet',
              button('Pet hen', 'pet', !petted, { value: index, context: `hen ${index + 1}` }))
          }).join('')}
        </ul>`
      break
    case 'rest':
      dialogContent.innerHTML = `<p class="dialog-intro">Turn in for the night. Watered crops grow while you sleep, and fed chickens lay eggs by morning.</p>
        ${nav(button('Open kitchen', 'kitchen'), button('Building upgrades', 'upgrades', true, { secondary: true }))}
        <ul class="dialog-list">${row('moon', `Day ${farm.day}`, `Wake up on Day ${farm.day + 1}`, button('Rest until morning', 'sleep'))}</ul>`
      break
    case 'journal': {
      const goal = currentTask()
      const groveActivities = farm.island === 'grove'
        ? row('fish', 'Sea bass', `${farm.fishCaughtToday.grove} / ${fishDailyLimit} caught today`)
          + row('crate', 'Sea salt', farm.saltGatheredToday ? 'Gathered today' : 'Ready to gather at the salt flats')
        : ''
      dialogContent.innerHTML = goal
        ? `<p class="dialog-intro">${goal.detail}</p>
          <ul class="dialog-list">
            ${row('star', goal.label, `${goal.progress} / ${goal.target}${goal.reward === undefined ? '' : ` · ${goal.reward} coins on completion`}`)}
            ${groveActivities}
          </ul>`
        : '<p class="dialog-status">All journal tasks are complete. Keep growing the island at your own pace.</p>'
      break
    }
    case 'settings':
      dialogContent.innerHTML = `<p class="dialog-intro">Make yourself at home on your little island.</p>
        <ul class="dialog-list">
          ${row('pack', 'Local save', saveAvailable ? 'Your farm saves in this browser after every action.' : 'This browser could not save your farm. You can keep playing for this session.')}
          ${row('gear', 'Controls', 'Review keyboard, mouse, and touch controls.', button('Farm guide', 'guide', true, { secondary: true }))}
        </ul>`
      break
    case 'guide': {
      const atHome = farm.island === 'home'
      const secondary = { secondary: true }
      dialogContent.innerHTML = `<p class="dialog-intro">Tap or click a place to interact. With the island focused, use the arrow keys and Enter.</p>
        <ul class="dialog-list">
          ${row('rod', 'Fishing pier', 'Cast a line and time your reel as the marker enters the green band.', button('Go fishing', 'visit-pier', true, secondary))}
          ${row('orchard', 'Orchard', 'Pick ripe fruit or plant saplings in empty plots.', button('Visit orchard', 'orchard', true, secondary))}
          ${row('boat', 'Boat dock', 'Get a boat and sail between Cozy Farm and Saltwind Grove.', button('Visit dock', 'visit-boat', true, secondary))}
          ${atHome ? [
            row('seeds', 'Garden beds', 'Harvest only beds with a small gold marker. Hover over or focus a bed to see its exact stage.'),
            row('can', 'Well', 'Fill your watering can for free.', button('Refill', 'refill', true, secondary)),
            row('moon', 'Farmhouse', 'Rest to grow crops and give the chickens time to lay.', button('Visit farmhouse', 'visit-rest', true, secondary)),
            row('kitchen', 'Kitchen', 'Cook with produce, eggs, and the ingredients found at Saltwind Grove.', button('Open kitchen', 'kitchen', true, secondary)),
            row('hen', 'Chicken coop', 'Pet the hens, feed the flock, and collect eggs.', button('Visit coop', 'visit-coop', true, secondary)),
            row('hammer', 'Building upgrades', 'Spend coins to improve the farmhouse, coop, and well.', button('See upgrades', 'upgrades', true, secondary)),
            row('shop', 'Market', 'Buy supplies or sell farm goods, fish, and cooked meals.', button('Visit market', 'visit-market', true, secondary)),
          ].join('') : row('crate', 'Salt flats', 'Gather sea salt once per day for recipes and sales.', button('Gather sea salt', 'gather-salt', !farm.saltGatheredToday, secondary))}
        </ul>`
      break
    }
    case 'fishing': {
      const action = getFishAction(farm)
      const round = fishingRound
      const zone = round?.zone ?? 48
      dialogContent.innerHTML = `<p class="dialog-intro">${farm.island === 'home' ? 'Catch perch in the calm waters by Cozy Farm.' : 'Cast from Saltwind Grove to catch sea bass.'}</p>
        <div class="fishing-game">
          <div class="fishing-art">${icon('rod')}${icon('fish')}</div>
          <div class="fishing-track" aria-hidden="true" data-ready="false"><span class="fishing-zone" style="left:${zone}%;width:${fishingBand}%"></span><span class="fishing-marker" style="left:0"></span></div>
          <p class="fishing-cue" role="status">${round ? 'Wait for the green band.' : action.available ? 'Cast, then reel in when the marker crosses the green band.' : action.label}</p>
          ${nav(round ? button('Reel in', 'reel') : button('Cast line', 'cast', action.available))}
        </div>`
      break
    }
    case 'boat':
      dialogContent.innerHTML = `<p class="dialog-intro">You’re at <strong>${islandNames[farm.island]}</strong>. Saltwind Grove has sea salt, sea bass, and space for more fruit trees.</p>
        <ul class="dialog-list">${farm.boatOwned
          ? islandIds.map((destination) => row('island', islandNames[destination], destination === farm.island ? 'You are here' : 'A short sail across the bay',
            button('Set sail', 'sail', destination !== farm.island, { value: destination, context: islandNames[destination] }))).join('')
          : row('boat', 'Wooden boat', farm.coins >= boatPrice ? 'One purchase opens both sailing routes.' : `Sell goods at the market to save up. You have ${quantity(farm.coins, 'coin')}.`, button(`Buy boat · ${quantity(boatPrice, 'coin')}`, 'buy-boat', farm.coins >= boatPrice))}
        </ul>`
      break
    case 'orchard':
      dialogContent.innerHTML = `<p class="dialog-intro">Trees grow overnight. Mature trees bear fruit after you rest.</p>
        <ul class="dialog-list">${farm.trees[farm.island].map((_, index) => treeRow(index)).join('')}</ul>`
      break
    case 'tree': {
      const slot = farm.trees[farm.island][treeSlot]
      const action = getTreeAction(farm, treeSlot)
      dialogTitle.textContent = slot ? treeDefinitions[slot.tree].name : `Orchard Plot ${treeSlot + 1}`
      dialogContent.innerHTML = `<p class="dialog-intro">${slot ? action.label : 'Choose a sapling to plant in this plot. Buy saplings from the market at Cozy Farm.'}</p>
        ${slot ? nav(button('Pick fruit', 'pick-fruit', action.available))
          : `<ul class="dialog-list">${treeIds.map((tree) => row('orchard', `${treeDefinitions[tree].name} sapling`, `${farm.saplings[tree]} in your bag`,
            button('Plant', 'plant-tree', farm.saplings[tree] > 0, { value: tree, context: treeDefinitions[tree].name }))).join('')}</ul>`}
        ${nav(button('All orchard plots', 'orchard', true, { secondary: true }))}`
      break
    }
    case 'upgrades': {
      dialogContent.innerHTML = `<p class="dialog-intro">Make room for more on your farm. You have <strong>${numberFormat.format(farm.coins)} coins</strong>.</p>
        <ul class="dialog-list">${buildingIds.map((building) => {
          const definition = buildingDefinitions[building]
          const level = farm.buildingLevels[building]
          return row('hammer', definition.name, `Level ${level} · ${definition.benefit}`,
            button(level === 2 ? 'Upgraded' : `Upgrade · ${quantity(definition.upgradePrice, 'coin')}`, 'upgrade-building',
              level < 2 && farm.coins >= definition.upgradePrice, { value: building, context: definition.name }))
        }).join('')}</ul>`
      break
    }
    case 'kitchen':
      dialogContent.innerHTML = `<p class="dialog-intro">Turn your ingredients into dishes to sell at the market.</p>
        <ul class="dialog-list">${dishIds.map((dish) => {
          const recipe = dishDefinitions[dish]
          const action = getCookAction(farm, dish)
          return row('meal', recipe.name, `${recipe.ingredientLabel} · Sells for ${recipe.sellPrice} coins${action.available ? '' : ` · ${action.label}`}`,
            button('Cook', 'cook', action.available, { value: dish, context: recipe.name }))
        }).join('')}</ul>`
      break
  }

  if (focused) {
    const replacement = Array.from(dialogContent.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      .find((candidate) => candidate.dataset.action === focused.dataset.action && candidate.dataset.crop === focused.dataset.crop && candidate.dataset.value === focused.dataset.value)
    const nextFocus = replacement ?? closeButton
    nextFocus.focus({ preventScroll: true })
  }
}

function openPanel(next: Panel) {
  if (next !== 'fishing') stopFishing()
  panel = next
  drawPanel()
  if (!dialog.open) dialog.showModal()
  closeButton.focus({ preventScroll: true })
}

function refresh() {
  status()
  island.render(farm)
  if (dialog.open) drawPanel()
}

function perform(action: () => { ok: boolean; message: string }, dismiss = false) {
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
    let feedback = dialogContent.querySelector<HTMLElement>('.dialog-status[role="status"]')
    if (!feedback) {
      feedback = document.createElement('p')
      feedback.className = 'dialog-status'
      feedback.setAttribute('role', 'status')
      dialogContent.prepend(feedback)
    }
    feedback.textContent = result.message
  } else {
    notify(result.message, result.ok)
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
  pier: 'Fishing Pier · Cast a line',
  boat: 'Boat Dock · Buy a boat or set sail',
  salt: 'Salt Flats · Gather sea salt',
}

const island = createIsland(canvas, {
  inspect(target) {
    if (target.kind === 'hen') return `Hen ${target.index + 1} · ${farm.pettedChickens.includes(target.index) ? 'Petted today' : 'Pet the hen'}`
    if (target.kind === 'tree') {
      const slot = farm.trees[farm.island][target.index]
      const name = slot ? treeDefinitions[slot.tree].name : `Orchard Plot ${target.index + 1}`
      return `${name} · ${getTreeAction(farm, target.index).label}`
    }
    if (target.kind !== 'bed') return locationLabels[target.kind]
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

const fieldViewButton = app.querySelector<HTMLButtonElement>('.view-toggle')!
const portraitView = window.matchMedia('(max-width: 680px) and (orientation: portrait)')

function toggleFieldView() {
  const fieldView = island.toggleFieldView()
  fieldViewButton.setAttribute('aria-pressed', String(fieldView))
  fieldViewButton.querySelector('span')!.textContent = fieldView ? 'Island view' : 'Field view'
  fieldViewButton.querySelector('img')!.src = iconUrl(fieldView ? 'island' : 'field')
}

portraitView.addEventListener('change', ({ matches }) => {
  if (!matches && fieldViewButton.getAttribute('aria-pressed') === 'true') toggleFieldView()
})

function activateTarget(target: IslandTarget) {
  if (target.kind === 'bed') {
    const index = target.index
    island.workBed(index, () => {
      const action = getBedAction(farm, index)
      return farm.island === 'home' && action.available ? action.kind : 'wait'
    }, () => {
      if (farm.island !== 'home') return
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
      perform(() => refillWater(farm))
      status()
      break
    case 'coop':
      activeTool = 'coop'
      status()
      openPanel('coop')
      break
    case 'market': openPanel('market'); break
    case 'farmhouse': openPanel('rest'); break
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
        perform(() => petChicken(farm, target.index))
      }
      break
    case 'salt': perform(() => gatherSeaSalt(farm)); break
  }
}

function useHotbar(tool: Tool) {
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

app.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return
  const control = event.target.closest<HTMLButtonElement>('button')
  if (!control || control.disabled) return
  if (control.dataset.panel) {
    openPanel(control.dataset.panel as Panel)
    return
  }
  if (control.dataset.tool) {
    useHotbar(control.dataset.tool as Tool)
    return
  }
  const crop = cropIds.find((id) => id === control.dataset.crop)
  const value = control.dataset.value
  switch (control.dataset.action) {
    case 'field-view': toggleFieldView(); break
    case 'sell': perform(() => sellProduce(farm)); break
    case 'buy-feed': perform(() => buyFeed(farm)); break
    case 'upgrade-can': perform(() => upgradeCan(farm)); break
    case 'buy-seeds': if (crop) perform(() => buySeeds(farm, crop)); break
    case 'select-seed':
      if (crop) {
        activeTool = 'seeds'
        perform(() => selectSeed(farm, crop))
      }
      break
    case 'feed': perform(() => feedChickens(farm)); break
    case 'collect': perform(() => collectEggs(farm)); break
    case 'sleep': perform(() => endDay(farm), true); break
    case 'refill': activateTarget({ kind: 'well' }); break
    case 'visit-rest': activateTarget({ kind: 'farmhouse' }); break
    case 'visit-coop': activateTarget({ kind: 'coop' }); break
    case 'visit-market': activateTarget({ kind: 'market' }); break
    case 'visit-pier': activateTarget({ kind: 'pier' }); break
    case 'visit-boat': activateTarget({ kind: 'boat' }); break
    case 'visit-tree': activateTarget({ kind: 'tree', index: Number(value) }); break
    case 'pet': activateTarget({ kind: 'hen', index: Number(value) }); break
    case 'gather-salt': activateTarget({ kind: 'salt' }); break
    case 'guide': openPanel('guide'); break
    case 'orchard': openPanel('orchard'); break
    case 'upgrades': openPanel('upgrades'); break
    case 'kitchen':
      island.visit({ kind: 'farmhouse' })
      openPanel('kitchen')
      break
    case 'cast': castLine(); break
    case 'reel': reelLine(); break
    case 'buy-boat': perform(() => buyBoat(farm)); break
    case 'sail': {
      const destination = islandIds.find((id) => id === value)
      if (destination) {
        if (fieldViewButton.getAttribute('aria-pressed') === 'true') toggleFieldView()
        if (perform(() => sail(farm, destination), true)) canvas.focus({ preventScroll: true })
      }
      break
    }
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
      if (building) perform(() => upgradeBuilding(farm, building))
      break
    }
    case 'cook': {
      const dish = dishIds.find((id) => id === value)
      if (dish) perform(() => cookDish(farm, dish))
      break
    }
  }
})

closeButton.addEventListener('click', () => dialog.close())
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close()
})
dialog.addEventListener('close', () => {
  if (!dialog.open) {
    stopFishing()
    panel = undefined
  }
})

window.addEventListener('keydown', (event) => {
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
