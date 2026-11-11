import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarbourControls } from '../src/harbour-controls.ts';
import type { HarbourViewport } from '../src/harbour-view.ts';

function setup() {
  let callback: () => void = () => {};
  let disconnected = false;
  class Observer { constructor(fn: () => void) { callback = fn; } observe() {} disconnect() { disconnected = true; } }
  Object.assign(globalThis, { ResizeObserver: Observer });
  const bounds = { width:390, height:844, top:0, bottom:844 };
  const contextBounds = { bottom:198 };
  const canvas = { getBoundingClientRect: () => bounds };
  const context = { dataset: {} as Record<string,string>, getBoundingClientRect: () => contextBounds };
  const buttons = ['overview','west','square','east'].map(id => ({dataset:{harbourView:id},disabled:false,
    attributes:{} as Record<string,string>,setAttribute(key:string,value:string){this.attributes[key]=value;}}));
  const live = { textContent: '' };
  const nav = { hidden:true,querySelector:()=>live,querySelectorAll:()=>buttons };
  const bottom = { getBoundingClientRect: () => ({top:bounds.bottom-78}) };
  const resume = { hidden:true,getBoundingClientRect:()=>({top:bounds.bottom-134}) };
  let latest: HarbourViewport | undefined;
  const ui = createHarbourControls(canvas as any,context as any,nav as any,bottom as any,resume as any,v=>latest=v);
  return { ui, bounds, contextBounds, context, nav, buttons, live, resume,
    resize:()=>callback(), viewport:()=>latest!, disconnected:()=>disconnected };
}

test('actual stacked HUD and toolbar determine safe framing; other islands hide controls', () => {
  const s=setup();s.ui.sync('village');
  assert.equal(s.nav.hidden,false);assert.equal(s.context.dataset.harbour,'true');
  assert.deepEqual(s.viewport(),{width:390,height:844,top:210,bottom:90});
  for (const island of ['home','grove','cape']) {s.ui.sync(island);assert.equal(s.nav.hidden,true);assert.equal(s.context.dataset.harbour,'false');}
});
test('orientation returns to overview while retaining the player selection for portrait', () => {
  const s=setup();s.ui.sync('village');s.ui.select('east',false);
  assert.equal(s.buttons[3].attributes['aria-pressed'],'true');
  s.bounds.width=844;s.bounds.height=390;s.bounds.bottom=390;s.resize();
  assert.equal(s.nav.hidden,true);assert.equal(s.buttons[0].attributes['aria-pressed'],'true');
  s.bounds.width=390;s.bounds.height=844;s.bounds.bottom=844;s.resize();
  assert.equal(s.buttons[3].attributes['aria-pressed'],'true');assert.equal(s.nav.hidden,false);
});
test('wrapped task and visible return chip reserve real space without a fixed HUD assumption', () => {
  const s=setup();s.ui.sync('village');s.contextBounds.bottom=236;s.resume.hidden=false;s.resize();
  assert.equal(s.viewport().top,248);assert.equal(s.viewport().bottom,146);
  s.contextBounds.bottom=152;s.resume.hidden=true;s.resize();
  assert.equal(s.viewport().top,164);assert.equal(s.viewport().bottom,90);
});
test('temporary route overview is announced then restores the selected close view', () => {
  const s=setup();s.ui.sync('village');s.ui.select('east',true);
  assert.equal(s.buttons[0].attributes['aria-pressed'],'true');assert.match(s.live.textContent,/путь целиком/);
  s.ui.select('east',false);assert.equal(s.buttons[3].attributes['aria-pressed'],'true');assert.equal(s.live.textContent,'');
});
test('short crowded portrait disables unavailable zoom but keeps overview actionable', () => {
  const s=setup();s.bounds.width=470;s.bounds.height=480;s.bounds.bottom=480;s.ui.sync('village');
  assert.equal(s.buttons[0].disabled,false);assert.ok(s.buttons.slice(1).every(b=>b.disabled));
  assert.equal(s.buttons[0].attributes['aria-pressed'],'true');assert.match(s.live.textContent,/больше места/);
});
test('destroy disconnects observation and ignores a queued resize', () => {
  const s=setup();s.ui.sync('village');const before=s.viewport();s.ui.destroy();s.bounds.width=100;s.resize();
  assert.equal(s.disconnected(),true);assert.equal(s.viewport(),before);
});
