// Explicit local DOM proof: actual button surface + actual capture installer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from '../../node_modules/typescript/lib/typescript.js';
import * as F from '../../src/farm.ts';
import * as Visits from '../../src/neighbor-visits.ts';
import { GuestBookButtonSurface } from '../../src/guest-book-button-surface.ts';
const { JSDOM } = await import(process.env.GUEST_BOOK_DOM_MODULE ?? 'jsdom');
const source = fs.readFileSync(new URL('../../tests/guest-book-prototype.test.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true);
const fixture = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'eligible');
const fc = { ...F, assert };
vm.runInNewContext(ts.transpileModule(fixture.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, fc);
const guardSource = fs.readFileSync(new URL('../../src/action-click-guard.ts', import.meta.url), 'utf8');
const results = [];
function run(name, fn) { fn(); results.push({ name, pass: true }); }
function host({ guarded = true, farm = fc.eligible() } = {}) {
  const w = new JSDOM('<!doctype html><body><button id="outside">Вне книги</button><main id="app"><section id="book"></section></main></body>').window;
  const app = w.document.querySelector('#app'), root = w.document.querySelector('#book');
  // Only transpilation for jsdom's Element realm. NO private-set additions.
  const ctx = { exports: {}, Element: w.Element };
  vm.runInNewContext(ts.transpileModule(guardSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, ctx);
  ctx.exports.installActionClickGuard(app, { guestBookButtons: guarded });
  const state = { open: true, writes: 0, storageWrites: 0, legacy: 0, parentBack: 0, dispatched: [] };
  w.Storage.prototype.setItem = () => { state.storageWrites++; throw new Error('unexpected persistence'); };
  let book;
  book = new GuestBookButtonSurface({ enabled: true, root, farm: () => farm, active: () => state.open,
    dispatch(command) {
      state.dispatched.push(command);
      if (command.action === 'close') { state.open = false; return; }
      let result;
      if (command.action === 'visit-invite') result = Visits.inviteNeighborVisit(farm, command.value);
      if (command.action === 'visit-introduce-hen') {
        const [serial, hen] = command.value.split(':').map(Number);
        if (farm.neighborVisits.active?.serial === serial) result = F.introduceHenToVisitor(farm, hen);
      }
      if (command.action === 'visit-reply' || command.action === 'visit-finish') {
        const [serial, reply] = command.value.split(':');
        result = Visits.finishNeighborVisit(farm, Number(serial), reply);
      }
      if (result?.ok) { state.writes++; book.render(); }
    }
  });
  app.addEventListener('click', event => { if (!book.click(event)) state.legacy++; });
  function back(event) { if (event.defaultPrevented) return; if (book.back(event)) return; state.parentBack++; event.preventDefault(); }
  root.addEventListener('cancel', back);
  root.addEventListener('keydown', event => { if (event.key === 'Escape' || event.altKey && event.key === 'ArrowLeft') back(event); });
  const event = (type, target, options = {}) => {
    const E = type.startsWith('key') ? w.KeyboardEvent : type === 'cancel' ? w.Event : w.MouseEvent;
    const e = new E(type, { bubbles: true, cancelable: true, ...options });
    if (options.stamp !== undefined) Object.defineProperty(e, 'timeStamp', { value: options.stamp });
    target.dispatchEvent(e); return e;
  };
  const select = q => root.querySelector(q);
  const button = (part, value) => select(`[data-guest-choice="${part}"][data-value="${value}"]`);
  const visible = q => [...root.querySelectorAll(q)].filter(e => !e.closest('[hidden]'));
  const click = (target, stamp = 1000, detail = 1) => event('click', target, { stamp, detail, clientX: 120, clientY: 180 });
  return { w, root, app, farm, state, book, select, button, visible, click, event, close: () => w.close() };
}
run('six exact button choices, one explicit invite, retained identities and zero passive writes', () => {
  const h = host(), before = JSON.stringify(h.farm), nodes = [...h.root.querySelectorAll('*')];
  for (const [i, id] of Visits.visitActivityIds.entries()) {
    h.click(h.button('resident', Visits.visitActivities[id].resident), 1000 + i * 2000);
    h.click(h.button('activity', id), 1800 + i * 2000);
    assert.equal(h.book.view.current(h.farm).activity, id);
    assert.equal(h.visible('[data-guest-choice="activity"]').length, 3);
    const invites = h.visible('[data-guest-command="visit-invite"]');
    assert.equal(invites.length, 1); assert.equal(invites[0].dataset.value, id);
    assert.equal(h.w.document.activeElement, h.button('activity', id));
    assert.deepEqual([...h.root.querySelectorAll('*')], nodes);
  }
  assert.equal(h.root.querySelectorAll('select').length, 0);
  assert.equal(JSON.stringify(h.farm), before); assert.equal(h.state.writes, 0);
  h.close();
});
run('owned forged, disabled and hidden controls are consumed instead of falling into a live host branch', () => {
  const h = host(), before = JSON.stringify(h.farm), invite = h.select('[data-guest-command="visit-invite"]');
  invite.dataset.action = 'sail'; h.click(invite, 100);
  assert.equal(h.state.legacy, 0); assert.equal(h.state.dispatched.length, 0);
  invite.dataset.action = 'visit-invite'; invite.disabled = true; h.click(invite, 1000);
  assert.equal(h.state.legacy, 0); assert.equal(h.state.dispatched.length, 0);
  h.click(h.select('[data-guest-command="visit-finish"]'), 2000);
  assert.equal(h.state.legacy, 0); assert.equal(h.state.dispatched.length, 0);
  assert.equal(JSON.stringify(h.farm), before); h.close();
});
run('the real guard opt-in blocks selection-to-invite trailing click; fresh gesture invites once', () => {
  for (const guarded of [false, true]) {
    const h = host({ guarded }), before = JSON.stringify(h.farm), choice = h.button('activity', 'beaFlock');
    const cta = h.select('[data-guest-command="visit-invite"]');
    h.event('pointerdown', choice); h.event('pointerup', choice); h.click(choice, 100);
    const trailing = h.click(cta, 180, 2);
    assert.equal(trailing.defaultPrevented, guarded);
    assert.equal(h.state.writes, guarded ? 0 : 1, 'explicit host opt-in, never a changed global default');
    if (guarded) {
      assert.equal(JSON.stringify(h.farm), before);
      h.event('pointerdown', cta); h.event('pointerup', cta); h.click(cta, 800);
      assert.equal(h.state.writes, 1); assert.equal(h.farm.neighborVisits.active.activity, 'beaFlock');
      const hen = h.select('[data-command-key="hen-0"]');
      assert.equal(h.click(hen, 880, 2).defaultPrevented, true);
      assert.equal(h.farm.neighborVisits.active.observation, null);
      h.click(hen, 1500); assert.equal(h.state.writes, 2);
      assert.ok(h.farm.neighborVisits.active.observation);
    }
    assert.equal(h.state.storageWrites, 0); h.close();
  }
});
run('held Enter and Space retain selection/action ownership until keyup, including Back', () => {
  for (const key of ['Enter', ' ']) {
    const h = host(), choice = h.button('activity', 'beaFlock');
    choice.focus(); h.event('keydown', choice, { key }); h.click(choice, 100, 0);
    const cta = h.select('[data-guest-command="visit-invite"]');
    for (let i = 0; i < 3; i++) assert.equal(h.event('keydown', cta, { key, repeat: true }).defaultPrevented, true);
    assert.equal(h.state.writes, 0);
    h.event('keyup', h.w.document, { key }); cta.focus(); h.event('keydown', cta, { key }); h.click(cta, 800, 0);
    assert.equal(h.state.writes, 1);
    assert.equal(h.event('keydown', h.select('[data-command-key="hen-0"]'), { key, repeat: true }).defaultPrevented, true);
    h.event('keyup', h.w.document, { key });
    h.click(h.button('page', 'rules'), 1600);
    const back = h.select('[data-guest-back]'); back.focus(); h.event('keydown', back, { key }); h.click(back, 2200, 0);
    assert.equal(h.event('keydown', h.select('[data-command-key="hen-0"]'), { key, repeat: true }).defaultPrevented, true);
    assert.equal(h.state.writes, 1); h.close();
  }
});
run('nested Back owns button, Escape, cancel and Alt+Left, then returns ownership to the host', () => {
  for (const route of ['button', 'escape', 'cancel', 'alt-left']) {
    const h = host(); h.click(h.button('resident', 'finn'), 100); h.click(h.button('activity', 'finnOrchard'), 800);
    const selected = h.book.snapshot(), before = JSON.stringify(h.farm);
    h.click(h.button('page', 'rules'), 1500);
    assert.equal(h.w.document.activeElement, h.select('[data-focus="rules"]'));
    if (route === 'button') h.click(h.select('[data-guest-back]'), 2200);
    else if (route === 'cancel') h.event('cancel', h.root);
    else h.event('keydown', h.root, { key: route === 'escape' ? 'Escape' : 'ArrowLeft', altKey: route === 'alt-left' });
    assert.deepEqual(h.book.snapshot(), selected); assert.equal(h.state.parentBack, 0);
    assert.equal(h.w.document.activeElement, h.button('page', 'rules'));
    h.event('keydown', h.root, { key: 'Escape', repeat: true }); assert.equal(h.state.parentBack, 0);
    h.event('keydown', h.root, { key: 'Escape' }); assert.equal(h.state.parentBack, 1);
    assert.equal(JSON.stringify(h.farm), before); assert.equal(h.state.storageWrites, 0); h.close();
  }
});
run('passive refresh never takes focus or scroll; explicit history restores the exact local choice only', () => {
  const h = host(); h.click(h.button('resident', 'finn'), 100); h.click(h.button('activity', 'finnOrchard'), 800);
  const selected = h.book.snapshot(), before = JSON.stringify(h.farm), nodes = [...h.root.querySelectorAll('*')];
  h.w.document.querySelector('#outside').focus(); h.root.scrollTop = 72;
  for (let i = 0; i < 20; i++) h.book.render();
  assert.equal(h.w.document.activeElement.id, 'outside'); assert.equal(h.root.scrollTop, 72);
  assert.deepEqual([...h.root.querySelectorAll('*')], nodes);
  h.click(h.button('resident', 'bea'), 1500);
  assert.equal(h.book.restore(selected, { part: 'activity', value: 'finnOrchard' }), true);
  assert.equal(h.w.document.activeElement, h.button('activity', 'finnOrchard'));
  assert.equal(h.root.scrollTop, 72); assert.equal(JSON.stringify(h.farm), before);
  assert.equal(h.state.storageWrites, 0); assert.equal(h.state.writes, 0); h.close();
});
run('eligibility stays distinct from readiness; stale revision, day, serial and wrong panel fail closed', () => {
  const farm = fc.eligible(); farm.neighbors.finn = F.createFarm().neighbors.finn;
  const h = host({ farm }); h.click(h.button('resident', 'finn'), 100);
  const cta = h.select('[data-guest-command="visit-invite"]'); assert.equal(cta.disabled, true);
  assert.match(h.select('[data-text="gate"]').textContent, /общую встречу/);
  h.click(h.button('resident', 'bea'), 800); h.click(h.button('activity', 'beaHands'), 1500);
  assert.equal(cta.disabled, false); assert.equal(h.book.view.current(farm).workReady, false);
  const old = { action: cta.dataset.action, value: cta.dataset.value, context: cta.dataset.context };
  h.click(h.button('activity', 'beaFlock'), 2200); assert.equal(h.book.view.resolve(farm, old), undefined);
  cta.dataset.context = old.context; h.click(cta, 2900); assert.equal(h.state.writes, 0);
  h.book.render(); h.state.open = false; h.click(cta, 3600);
  assert.equal(h.state.writes, 0); assert.equal(h.state.legacy, 0); h.state.open = true;
  h.click(cta, 4300); assert.equal(h.state.writes, 1);
  const hen = h.select('[data-command-key="hen-0"]'), stale = { action: hen.dataset.action, value: hen.dataset.value, context: hen.dataset.context };
  assert.ok(F.endDay(farm).ok); h.book.render(); assert.equal(h.book.view.resolve(farm, stale), undefined);
  assert.ok(Visits.inviteNeighborVisit(farm, 'beaFlock').ok); h.book.render();
  assert.equal(h.book.view.resolve(farm, stale), undefined); assert.ok(F.restoreCurrentFarm(structuredClone(farm)));
  assert.equal(h.state.storageWrites, 0); h.close();
});
run('every recorded memory is a stable named button; live guest wins preview and Close never finishes', () => {
  const farm = fc.eligible(); farm.produce.wheat = 2; farm.eggs = 1;
  farm.beds[0] = { kind: 'crop', crop: 'carrot', growth: 1, watered: false };
  farm.beds[1] = { kind: 'crop', crop: 'carrot', growth: 1, watered: false };
  farm.trees.home[0] = { tree: 'apple', age: 2, fruitReady: 2 };
  for (const id of Visits.visitActivityIds) {
    assert.ok(Visits.inviteNeighborVisit(farm, id).ok);
    const kind = Visits.visitActivities[id].kind;
    assert.ok((kind === 'crop' ? F.workBed(farm, id === 'beaHarvest' ? 0 : 1) : kind === 'pastry' ? F.bakeWorkshop(farm, 'round') : kind === 'fruit' ? F.pickFruit(farm, 0) : F.introduceHenToVisitor(farm, 0)).ok);
    assert.ok(Visits.finishNeighborVisit(farm, farm.neighborVisits.serial, 'quiet').ok);
  }
  const h = host({ farm }), nodes = [...h.root.querySelectorAll('*')], ledger = structuredClone(farm.neighborVisits.memories);
  h.click(h.button('resident', 'finn'), 100); h.click(h.button('activity', 'finnOrchard'), 800);
  assert.ok(Visits.inviteNeighborVisit(farm, 'beaFlock').ok); h.book.render();
  assert.equal(h.book.view.current(farm).activity, 'beaFlock');
  const hens = h.visible('[data-guest-command="visit-introduce-hen"]'); assert.equal(hens.length, farm.flockSize);
  h.click(hens[1], 1500); assert.equal(h.state.writes, 1);
  assert.deepEqual(h.visible('[data-guest-command="visit-reply"]').map(e => e.dataset.value), ['7:quiet', '7:curious']);
  const before = JSON.stringify(farm); h.click(h.button('page', 'memories'), 2200);
  assert.equal(h.visible('[data-guest-choice="memory"]').length, 6);
  for (const [i, id] of Visits.visitActivityIds.entries()) {
    h.click(h.button('memory', id), 3000 + i * 700);
    assert.equal(h.book.view.current(farm).memory.activity, id);
    assert.equal(h.w.document.activeElement, h.button('memory', id));
  }
  assert.deepEqual([...h.root.querySelectorAll('*')], nodes); assert.equal(JSON.stringify(farm), before);
  assert.deepEqual(farm.neighborVisits.memories, ledger);
  h.event('keydown', h.root, { key: 'Escape' }); assert.equal(h.book.view.current(farm).activity, 'beaFlock');
  h.click(h.select('[data-guest-command="close"]'), 9000);
  assert.equal(h.state.open, false); assert.equal(JSON.stringify(farm), before);
  assert.equal(h.state.storageWrites, 0); h.close();
});
run('current observed visit permits both exact replies and leaving without reply once each', () => {
  for (const reply of ['quiet', 'curious', null]) {
    const farm = fc.eligible(); assert.ok(Visits.inviteNeighborVisit(farm, 'beaFlock').ok); assert.ok(F.introduceHenToVisitor(farm, 0).ok);
    const h = host({ farm }), key = reply ?? 'finish', button = h.select(`[data-command-key="${key}"]`);
    const old = { action: button.dataset.action, value: button.dataset.value, context: button.dataset.context };
    h.click(button, 100); assert.equal(h.state.writes, 1); assert.equal(farm.neighborVisits.active, null);
    assert.equal(farm.neighborVisits.memories[0].reply, reply);
    assert.equal(h.book.view.resolve(farm, old), undefined);
    h.click(button, 180, 2); assert.equal(h.state.writes, 1); assert.ok(F.restoreCurrentFarm(structuredClone(farm))); h.close();
  }
});
if (process.env.GUEST_BOOK_EARNED_FIXTURE) {
  const { createEarnedFixture, repeatOracle } = await import(process.env.GUEST_BOOK_EARNED_FIXTURE);
  run('earned 119-command fixture: actual button events preserve exact carrot/quiet memory through beetroot/curious repeat', () => {
    const fixture = createEarnedFixture(), expected = repeatOracle(fixture), h = host({ farm: fixture.farm });
    let step = 0;
    for (const [i, crop] of fixture.crops.entries()) {
      const stamp = 1000 + i * 5000;
      h.click(h.select('[data-guest-command="visit-invite"]'), stamp);
      assert.deepEqual(h.farm, expected[step++].state);
      assert.ok(F.workBed(h.farm, crop.index).ok); h.book.render();
      assert.deepEqual(h.farm, expected[step++].state);
      if (i) {
        assert.match(h.select('[data-text="observation-subject"]').textContent, /^Сегодня: /);
        assert.equal(h.farm.neighborVisits.memories[0].subject, fixture.crops[0].subject);
      }
      h.click(h.select(`[data-command-key="${i ? 'curious' : 'quiet'}"]`), stamp + 700);
      assert.deepEqual(h.farm, expected[step++].state);
    }
    assert.equal(h.state.writes, 4); assert.equal(h.state.storageWrites, 0);
    assert.equal(h.farm.neighborVisits.serial, 2); assert.equal(h.farm.neighborVisits.memories.length, 1);
    assert.equal(h.farm.neighborVisits.memories[0].reply, 'quiet');
    assert.ok(F.restoreCurrentFarm(structuredClone(h.farm))); h.close();
  });
}
console.log(JSON.stringify({ status: 'local opt-in button surface', results, native: false }, null, 2));
