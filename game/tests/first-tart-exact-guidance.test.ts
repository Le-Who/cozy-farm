import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { getGuidanceTask } from '../src/discovery-guidance.ts';
import { getDiscoveryTask } from '../src/discovery-path.ts';
import * as rules from '../src/farm.ts';

const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const ordinaryActions = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8')) as { name: string; args: unknown[] }[];

function exact(from: string, to: string) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, from);
  return source.slice(start, end);
}

const cookControls = (html: string) => [...html.matchAll(/<button[^>]*data-action="cook"[^>]*>/g)]
  .filter(([button]) => !/\bdisabled\b/.test(button))
  .map(([button]) => button.match(/data-value="([^"]+)"/)?.[1]);

function view(farm: rules.FarmState) {
  const visits: string[] = [], focus: string[] = [], saves: string[] = [];
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; }, querySelectorAll: () => [] };
  const content = { scrollTop: 0, querySelector: () => null, querySelectorAll: () => [] };
  const initial = {
    ...rules, getGuidanceTask, getDiscoveryTask, farm, dialog, dialogContent: content, panel: undefined, panelHistory: [],
    guideGardenOpen: false, marketTab: 'buy', selectedMarketOrder: undefined, pickedMarketOrder: undefined,
    salePresentation: { reset() {} }, marketSaleBrowse: { reset() {} }, recipeBook: { view: {}, snapshot: () => ({}), load() {} },
    gardenEditor: { reset() {} }, transplantSelection: { reset() {} }, berryNurserySelection: { reset() {} },
    berryRenewalSelection: { reset() {} }, recipeSurplusSelection: { reset() {} },
    island: { isCrossing: () => false, visit: (target: { kind: string }) => visits.push(target.kind), setViewMode() {}, setCoveFocus() {} },
    app: { dataset: {} }, toast: {}, dialogFeedback: {}, closeButton: { focus: () => focus.push('close') },
    drawPanel: undefined, stopHarbour() {}, stopFishing() {}, stopWorkshop() {}, stopCookery() {}, stopArrangement() {},
    playBaySound() {}, updateCommunityReturn() {}, status() {},
    rememberClosedMarketSell() {}, restoreFerryPanelView() {}, panelRenderVersion: 0, requestAnimationFrame: (f: () => void) => f(),
    saveFarm: () => saves.push(JSON.stringify(farm)),
    visitPanelAt: () => { throw new Error('preview should never travel'); },
    kitchenGroup: undefined, kitchenTart: 'orchardTart', kitchenPreserves: 'appleJam', kitchenDish: 'grilledFish',
    cookingFish: 'perch', kitchenGroups: ['tart', 'preserves', 'dishes'], dishIcons: {},
    icon: () => '', stockTile: () => '', stockTileWithSource: () => '',
    rememberPanel: () => ({ panel: initial.panel, kitchenGroup: initial.kitchenGroup, kitchenTart: initial.kitchenTart, kitchenPreserves: initial.kitchenPreserves, recipeBook: {}, signatureSlots: [], marketNextOpen: [], scroll: 0 }),
    getRequirementHint: () => { throw new Error('not a salt recipe'); },
    hasShoal: () => false, hiveFlower: undefined, seedPickerBed: undefined, celebratedFestival: undefined,
  } as Record<string, unknown>;
  const script = `
    ${exact('function currentTask(', '\nfunction status(')}
    ${exact('function button(', '\nfunction quantity(')}
    ${exact('function goBack(', '\nlet harbourScene:')}
    ${exact('function closeDialog(', '\nfunction refresh(')}
    ${exact('function recipeDestination(', '\nfunction recipeCards(')}
    ${exact('function recipeCards(', '\nfunction kitchenReadyDishes(')}
    ${exact('function kitchenReadyDishes(', '\nfunction kitchenFamilies(')}
    ${exact('function kitchenFamilies(', '\nfunction ').trim()}
    ${exact('function openPanel(', '\nfunction openRecipeBook(')}
    drawPanel = function () {};
    function click(action: string, value?: string) {
      ${exact("  if (action === 'follow-task')", '  switch (action) {')}
      switch(action) {
        ${exact("    case 'kitchen-group':", "    case 'recipe-family':")}
        ${exact("    case 'kitchen':\n      island.visit", "    case 'close':")}
      }
    }
    ({ click, openPanel, closeDialog, goBack, kitchenFamilies });`;
  // The Back routine restores these existing unrelated fields. They have no role in the path under test.
  for (const field of `journeyDetailsOpen journalDetailsOpen selectedExpeditionPort selectedExpeditionOffer
    selectedWarehouseRequest selectedWarehouse freightPlanOpen inventoryGroup boatIsland marketSaleFamily marketSaleQuery marketCategory
    marketSellGroup bagTab archiveGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot
    pastryShape workshopRecipe cookingDish signatureBase signatureSlots signatureSlot signatureRepeatId expandedRepeatId cookingMode
    communityOrderId communityResident requestedFood honeyKitchenDish signatureFamily marketTreeSpaceVisit`.split(/\s+/))
    initial[field] = undefined;
  const ui = runInNewContext(stripTypeScriptTypes(script), initial);
  return { state: initial, ui, visits, focus, saves };
}

function earned(steps: number) {
  const farm = rules.createFarm();
  for (const { name, args } of ordinaryActions.slice(0, steps)) {
    const apply = (rules as unknown as Record<string, (farm: rules.FarmState, ...args: unknown[]) => { ok: boolean; message: string }>)[name];
    const result = apply(farm, ...args);
    assert.ok(result.ok, name + ': ' + result.message);
  }
  assert.equal(farm.day, 2);
  return farm;
}

test('a first-tart navigation task opens its ready recipe even after manually choosing the preserves tab', () => {
  const farm = earned(12);
  assert.equal(rules.getCookAction(farm, 'orchardTart').available, true);
  assert.equal(rules.getCookAction(farm, 'appleJam').available, false);
  const { state, ui, visits, focus, saves } = view(farm);
  // The genuine panels record orientation before the no-write navigation check.
  ui.openPanel('archive');
  ui.openPanel('boat');
  ui.closeDialog();
  assert.equal(saves.length, 2);
  ui.click('kitchen');
  ui.click('kitchen-group', 'preserves');
  assert.deepEqual(cookControls(ui.kitchenFamilies()), []);
  assert.match(ui.kitchenFamilies(), /recipe-locked/);
  ui.openPanel('journal');
  const task = getDiscoveryTask(farm, farm.orientation);
  assert.equal(task?.id, 'first-cooking');
  const before = JSON.stringify(farm);
  ui.click('follow-task');
  assert.deepEqual(cookControls(ui.kitchenFamilies()), ['orchardTart']);
  assert.match(ui.kitchenFamilies(), /data-action="kitchen-group" data-value="preserves"/);
  assert.equal(state.panel, 'kitchen');
  assert.equal((state.panelHistory as {panel: string}[]).at(-1)?.panel, 'journal');
  assert.equal(focus.at(-1), 'close');
  ui.goBack();
  assert.equal(state.panel, 'journal');
  ui.click('kitchen');
  assert.deepEqual(cookControls(ui.kitchenFamilies()), [], 'Back preserves the manual preserves tab');
  ui.closeDialog();
  ui.click('follow-task');
  assert.deepEqual(cookControls(ui.kitchenFamilies()), ['orchardTart'], 'the HUD opens the same dish without a Journal history frame');
  ui.closeDialog();
  ui.click('kitchen');
  assert.deepEqual(cookControls(ui.kitchenFamilies()), [], 'ordinary fresh entry after X keeps the prior manual choice');
  assert.match(ui.kitchenFamilies(), /recipe-locked/);
  assert.deepEqual(visits, Array(5).fill('farmhouse'));
  assert.equal(saves.length, 2, 'only the earlier orientation panels wrote saves');
  assert.equal(JSON.stringify(farm), before);
});

test('without its wheat, the first-tart guide still points to real ripe wheat instead of the kitchen', () => {
  const farm = earned(11);
  assert.equal(rules.getCookAction(farm, 'orchardTart').available, false);
  const { ui } = view(farm);
  ui.openPanel('archive');
  ui.openPanel('boat');
  const task = getDiscoveryTask(farm, farm.orientation);
  assert.equal(task?.action.target, 'focus-bed');
  assert.equal(task?.action.value, '4');
  assert.equal(rules.getBedAction(farm, 4).kind, 'harvest');
});
