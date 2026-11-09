import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFreight, restoreFreight, advanceFreight, freightStock, freightUsed, ferryUsed,
  addFreightStock, takeFreightStock, consumeFreightStock, startFreight, pauseFreight,
  setFreightStops, setFreightMode, setFreightPickup, reconcileFreightPorts, ferryCapacity, warehouseCapacity } from '../src/bay-freight-model.ts';

const ports = ['home', 'grove', 'cape', 'village'] as const;

test('warehouse transfers and batch consumption are atomic at capacity and on shortages', () => {
  const state = createFreight();
  assert.equal(addFreightStock(state, 'home', 'wheat', warehouseCapacity), true);
  const before = structuredClone(state);
  assert.equal(addFreightStock(state, 'home', 'shells', 1), false);
  assert.equal(takeFreightStock(state, 'home', 'wheat', warehouseCapacity + 1), false);
  assert.equal(consumeFreightStock(state, 'home', [{ id: 'wheat', quantity: 2 }, { id: 'shells', quantity: 1 }]), false);
  assert.deepEqual(state, before);
  assert.equal(consumeFreightStock(state, 'home', [{ id: 'wheat', quantity: 20 }, { id: 'wheat', quantity: 20 }]), false);
  assert.deepEqual(state, before);
});

test('saved running ferry loads finite cargo, arrives on played days and baker consumes real grain', () => {
  let state = createFreight(1);
  addFreightStock(state, 'home', 'wheat', 12);
  assert.equal(startFreight(state, 1, ports).ok, true);
  assert.equal(state.ship.phase, 'sailing');
  assert.equal(freightStock(state, 'home', 'wheat'), 12 - ferryCapacity);
  state = restoreFreight(JSON.parse(JSON.stringify(state)), 1);
  advanceFreight(state, 2, ports);
  assert.equal(state.ship.phase, 'docked');
  assert.equal(freightStock(state, 'village', 'wheat'), 6);
  assert.equal(freightStock(state, 'village', 'handmade:round'), 3);
  const once = structuredClone(state);
  advanceFreight(state, 2, ports);
  assert.deepEqual(state, once);
  advanceFreight(state, 3, ports);
  assert.equal(state.ship.phase, 'sailing');
  advanceFreight(state, 4, ports);
  assert.equal(freightStock(state, 'home', 'handmade:round'), 3);
});

test('mixed cargo shares the hold while priority fills the first selected product', () => {
  const mixed = createFreight();
  addFreightStock(mixed, 'home', 'wheat', 12);
  addFreightStock(mixed, 'home', 'shells', 12);
  setFreightPickup(mixed, 'home', 'village', ['wheat', 'shells']);
  startFreight(mixed, 1, ports);
  assert.deepEqual(mixed.ship.cargo.map(item => [item.id, item.quantity]), [['wheat', 4], ['shells', 4]]);
  const priority = createFreight();
  addFreightStock(priority, 'home', 'wheat', 12);
  addFreightStock(priority, 'home', 'shells', 12);
  setFreightPickup(priority, 'home', 'village', ['wheat', 'shells']);
  setFreightMode(priority, 'priority');
  startFreight(priority, 1, ports);
  assert.deepEqual(priority.ship.cargo.map(item => [item.id, item.quantity]), [['wheat', 8]]);
});

test('cargo stays aboard at intermediate piers and unloading waits for warehouse room', () => {
  const state = createFreight();
  setFreightStops(state, ['home', 'grove', 'village'], ports);
  addFreightStock(state, 'home', 'wheat', 8);
  addFreightStock(state, 'village', 'shells', warehouseCapacity);
  startFreight(state, 1, ports);
  advanceFreight(state, 2, ports);
  assert.equal(state.ship.cargo.reduce((sum, item) => sum + item.quantity, 0), 8);
  advanceFreight(state, 3, ports);
  pauseFreight(state);
  advanceFreight(state, 4, ports);
  assert.equal(state.ship.phase, 'docked');
  assert.equal(state.ship.cargo.reduce((sum, item) => sum + item.quantity, 0), 8);
  takeFreightStock(state, 'village', 'shells', 10);
  advanceFreight(state, 5, ports);
  assert.equal(state.ship.cargo.length, 0);
  assert.equal(freightStock(state, 'village', 'handmade:round'), 3);
});

test('closed ports neither produce nor join a route; pausing completes the current crossing only', () => {
  const state = createFreight();
  assert.equal(setFreightStops(state, ['home', 'cape'], ['home', 'village']).ok, false);
  advanceFreight(state, 2, ['home', 'village']);
  assert.equal(freightUsed(state, 'grove'), 0);
  assert.equal(freightUsed(state, 'cape'), 0);
  startFreight(state, 2, ports);
  pauseFreight(state);
  advanceFreight(state, 3, ports);
  assert.equal(state.ship.phase, 'docked');
  advanceFreight(state, 4, ports);
  assert.equal(state.ship.phase, 'docked');
});

test('a first boat gets a working route through opened piers without requiring locked Harbour', () => {
  const state = createFreight();
  reconcileFreightPorts(state, ['home', 'grove']);
  assert.deepEqual(state.route.stops, ['home', 'grove']);
  assert.equal(state.route.pickups.home.destination, 'grove');
  addFreightStock(state, 'home', 'wheat', 2);
  assert.equal(startFreight(state, 1, ['home', 'grove']).ok, true);
  advanceFreight(state, 2, ['home', 'grove']);
  assert.equal(freightStock(state, 'grove', 'wheat'), 2);
  const saved = structuredClone(state);
  reconcileFreightPorts(state, ports);
  assert.deepEqual(state, saved);
});

test('old saves start without invented stock and malformed freight cannot overflow finite stores', () => {
  const old = restoreFreight(undefined, 20);
  assert.equal(old.lastDay, 20);
  assert.equal(freightUsed(old, 'home'), 0);
  const restored = restoreFreight({ warehouses: { home: { wheat: 999, shells: -1 } }, ship: { phase: 'docked', port: 'home', cargo: [{ id: 'signature:s4', quantity: 999, destination: 'village' }] }, lastDay: 999 }, 20);
  assert.equal(freightUsed(restored, 'home'), warehouseCapacity);
  assert.equal(restored.ship.cargo[0].quantity, ferryCapacity);
  assert.equal(restored.lastDay, 20);
});

test('malformed journal entries cannot break arrival feedback after restoring a save', () => {
  const state = restoreFreight({ events: [
    { day: 2, kind: 'sailing', port: 'home', items: [] },
    { day: 2, kind: 'loading', port: 'home', items: [] },
    { day: 2, kind: 'unloading', port: 'village', items: [{ id: 'wheat', quantity: 2 }] },
  ] }, 2);
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].kind, 'unloading');
});

test('reloading during a multi-stop repeating route preserves exact stock and destination ownership', () => {
  const uninterrupted = createFreight();
  setFreightStops(uninterrupted, ['home', 'grove', 'cape', 'village'], ports);
  addFreightStock(uninterrupted, 'home', 'signature:s7', 2);
  addFreightStock(uninterrupted, 'home', 'wheat', 14);
  setFreightPickup(uninterrupted, 'home', 'village', ['signature:s7', 'wheat']);
  startFreight(uninterrupted, 1, ports);
  const resumed = restoreFreight(JSON.parse(JSON.stringify(uninterrupted)), 1);
  for (let day = 2; day <= 20; day++) {
    advanceFreight(uninterrupted, day, ports);
    advanceFreight(resumed, day, ports);
    assert.deepEqual(resumed, uninterrupted);
    assert.ok(ferryUsed(resumed) <= ferryCapacity);
    for (const port of ports) assert.ok(freightUsed(resumed, port) <= warehouseCapacity);
  }
  assert.equal(freightStock(resumed, 'village', 'signature:s7'), 2);
  assert.equal(freightStock(resumed, 'grove', 'signature:s7'), 0);
  assert.equal(freightStock(resumed, 'cape', 'signature:s7'), 0);
});
