import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceBayShop, advanceBayShopDay, bayShopInterest, createBayShop, removeBayShopStock, restoreBayShop,
  setBayShopOpen, setBayShopPrice, stockBayShop, type BayShopProduct, type BayShopState,
} from '../src/bay-shop-model.ts';

const pear: BayShopProduct = { id: 'signature:s1', identity: 'pear-silky-layout-a', name: 'Грушевое облако',
  image: '/art/lavender/ui-tart.webp', basePrice: 50, tags: ['pear', 'fruit', 'delicate', 'silky', 'sweet'], signature: true };
function run(state: BayShopState, milliseconds: number, bonus = 0) {
  const sales = []; let remaining = milliseconds;
  while (remaining > 0) { const step = Math.min(1000, remaining); sales.push(...advanceBayShop(state, step, bonus)); remaining -= step; }
  return sales;
}
function openShop(quantity = 10) {
  const state = createBayShop(); assert.equal(stockBayShop(state, 0, pear, quantity), true); setBayShopOpen(state, true); return state;
}

test('four shelves reserve distinct stock and return exactly what remains after a sale', () => {
  const state = openShop(3);
  assert.equal(state.slots.length, 4);
  assert.equal(stockBayShop(state, 0, { ...pear, id: 'dish:appleJam' }, 1), false);
  assert.equal(stockBayShop(state, 4, pear, 1), false);
  assert.equal(stockBayShop(state, 1, pear, 1000), false);
  assert.equal(run(state, 7400).length, 1);
  assert.deepEqual(removeBayShopStock(state, 0), { id: pear.id, quantity: 2 });
  assert.equal(removeBayShopStock(state, 0), null);
  assert.equal(state.sold, 1); assert.equal(state.revenue, 50);
});

test('approach, choose, react and depart are actual timed stages; saving cannot replay payment', () => {
  const state = openShop();
  assert.equal(run(state, 1200).length, 0); assert.equal(state.visitor?.phase, 'approaching');
  run(state, 3200); assert.equal(state.visitor?.phase, 'browsing');
  const first = run(state, 3000); assert.equal(first.length, 1); assert.equal(first[0].liked, true);
  assert.equal(state.visitor?.phase, 'reacting');
  const restored = restoreBayShop(JSON.parse(JSON.stringify(state)))!; assert.ok(restored);
  assert.equal(run(restored, 3400).length, 0); assert.equal(restored.visitor?.phase, 'departing');
  assert.equal(run(restored, 2800).length, 0); assert.equal(restored.visitor, null);
  assert.equal(restored.sold, 1); assert.equal(restored.slots[0]?.quantity, 9);
  assert.equal(restored.memories.bea.purchases[pear.identity].bought, 1);
});

test('visitors compare budgets and value; a high price produces no sale', () => {
  const tooDear = openShop(); setBayShopPrice(tooDear, 0, 500);
  assert.equal(run(tooDear, 7400).length, 0); assert.equal(tooDear.visitor?.outcome?.kind, 'budget');
  const poorValue = openShop(); setBayShopPrice(poorValue, 0, 90);
  assert.equal(run(poorValue, 7400).length, 0); assert.equal(poorValue.visitor?.outcome?.kind, 'expensive');
  assert.equal(poorValue.slots[0]?.quantity, 10); assert.equal(poorValue.revenue, 0);
  const goodValue = openShop(); setBayShopPrice(goodValue, 0, 70);
  assert.equal(run(goodValue, 7400).length, 1);
  assert.equal(goodValue.revenue, 70);
});

test('taste and returning memory belong to the precise product, including its signature layout', () => {
  const state = openShop(20), other = { ...pear, id: 'signature:s2', identity: 'pear-silky-layout-b', name: 'Второе облако' };
  stockBayShop(state, 1, other, 20);
  const initial = bayShopInterest(state, 'bea', state.slots[0]!);
  const initialOther = bayShopInterest(state, 'bea', state.slots[1]!);
  const sales = run(state, 7400); assert.equal(sales[0].product.id, pear.id);
  const remembered = bayShopInterest(state, 'bea', state.slots[0]!);
  const unchangedOther = bayShopInterest(state, 'bea', state.slots[1]!);
  assert.ok(remembered.willingness > initial.willingness);
  assert.equal(remembered.returning, true); assert.equal(unchangedOther.returning, false);
  assert.equal(unchangedOther.willingness, initialOther.willingness);
  assert.equal(state.reputation[other.identity], undefined);
  assert.equal(state.reputation[pear.identity].liked, 1);
  assert.ok(restoreBayShop(JSON.parse(JSON.stringify(state))));
});

test('closing while a guest is choosing returns them to the path without charging or losing stock', () => {
  const state = openShop(2); run(state, 5000);
  assert.equal(state.visitor?.phase, 'browsing');
  setBayShopOpen(state, false);
  assert.equal(state.visitor?.phase, 'departing');
  assert.equal(run(state, 30_000).length, 0);
  assert.equal(state.visitor, null); assert.equal(state.slots[0]?.quantity, 2); assert.equal(state.revenue, 0);
  assert.ok(restoreBayShop(state));
});

test('deterministic visitor tastes, budgets and outcomes survive reload; music increases opportunities', () => {
  const first = openShop(100), second = openShop(100), lively = openShop(100);
  const sales = run(first, 150_000), repeated = run(second, 150_000), concert = run(lively, 150_000, 3);
  assert.deepEqual(sales, repeated); assert.deepEqual(first, second);
  assert.ok(lively.serial > first.serial); assert.ok(concert.length >= sales.length);
  assert.ok(restoreBayShop(first));
});

test('legacy defaults, fractional frame clocks and purchase receipts validate; tampered saves do not', () => {
  assert.deepEqual(restoreBayShop(undefined), createBayShop());
  const state = openShop(10); advanceBayShop(state, 16.6667);
  assert.ok(restoreBayShop(JSON.parse(JSON.stringify(state))));
  run(state, 7500); advanceBayShop(state, 16.6667);
  assert.ok(restoreBayShop(JSON.parse(JSON.stringify(state))));
  for (const corrupt of [
    (s: BayShopState) => { s.slots.pop(); },
    (s: BayShopState) => { s.slots[0]!.quantity = -1; },
    (s: BayShopState) => { s.revenue++; },
    (s: BayShopState) => { s.memories.bea.purchases[pear.identity].liked = 20; },
    (s: BayShopState) => { s.visitor!.budget++; },
    (s: BayShopState) => { s.visitor!.outcome = null; },
    (s: BayShopState) => { s.slots[0]!.product.image = 'https://example.com/tracker.png'; },
    (s: BayShopState) => { s.slots[0]!.product.identity = 'toString'; },
  ]) {
    const invalid = structuredClone(state); corrupt(invalid); assert.equal(restoreBayShop(invalid), undefined);
  }
});

test('long inactive frames do not catch up offline purchases and invalid numeric inputs cannot mutate stock', () => {
  const state = openShop(10);
  assert.equal(advanceBayShop(state, 24 * 60 * 60 * 1000).length, 0);
  assert.equal(state.serial, 0); assert.equal(state.waitMs, 200);
  assert.equal(setBayShopPrice(state, 0, 0), false); assert.equal(setBayShopPrice(state, 0, 1.1), false);
  assert.equal(setBayShopPrice(state, 0, Infinity), false); assert.equal(stockBayShop(state, 0, pear, NaN), false);
  assert.equal(advanceBayShop(state, NaN).length, 0); assert.equal(state.sold, 0);
});

test('an open shop operates while farming with a shared daily allowance and one settlement per day', () => {
  const state = openShop(100);
  const first = run(state, 7400); assert.equal(first.length, 1);
  const night = advanceBayShopDay(state, 2); assert.equal(night.length, 5);
  assert.equal(state.sold, 6); assert.equal(state.visitsToday, 0);
  assert.equal(advanceBayShopDay(state, 2).length, 0); assert.equal(state.sold, 6);
  const returning = advanceBayShopDay(state, 3);
  assert.equal(returning.length, 6); assert.equal(state.memories.bea.purchases[pear.identity].bought, 2);
  assert.ok(restoreBayShop(state, 3));
  setBayShopOpen(state, false); assert.equal(advanceBayShopDay(state, 4).length, 0);
});

test('concert listeners grant finite extra daily visits and visible purchases never exceed that budget', () => {
  const regular = openShop(100), concert = openShop(100);
  assert.equal(advanceBayShopDay(regular, 2).length, 6);
  assert.equal(advanceBayShopDay(concert, 2, 2).length, 10);
  const visible = openShop(100); run(visible, 600_000);
  assert.equal(visible.serial, 6); assert.equal(visible.sold, 6);
  assert.equal(advanceBayShopDay(visible, 2).length, 0);
});
