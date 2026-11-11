import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarm, restoreFarm, workBed, endDay } from '../src/farm.ts';
import { getDiscoveryTask } from '../src/discovery-path.ts';
import { chooseDiscoveryIdea, createDiscoveryPreferences, forgetDiscoveryIdea, restoreDiscoveryPreferences, resumeDiscoveryIdea, setDiscoveryPace } from '../src/discovery-preferences.ts';
import { getGuidanceTask } from '../src/discovery-guidance.ts';
import { renderDiscoveryPreferences } from '../src/discovery-preferences-ui.ts';

function reload(farm: ReturnType<typeof createFarm>) {
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm))); assert.ok(restored); return restored;
}
function pick(farm: ReturnType<typeof createFarm>) {
  const task = getDiscoveryTask(farm, farm.orientation)!; assert.ok(task);
  assert.equal(chooseDiscoveryIdea(farm.discoveryPreferences, task, task.id), true);
  return task;
}
function otherState(farm: ReturnType<typeof createFarm>) {
  const { discoveryPreferences, ...rest } = structuredClone(farm); return rest;
}

test('old saves without preferences keep existing progress and get ordinary guidance', () => {
  const farm = createFarm(); workBed(farm, 0);
  const old = JSON.parse(JSON.stringify(farm)); delete old.discoveryPreferences;
  const restored = restoreFarm(old)!; assert.ok(restored);
  assert.deepEqual(restored.discoveryPreferences, createDiscoveryPreferences());
  assert.deepEqual(otherState(restored), otherState(farm));
});

test('selecting, hiding and returning change only preferences, never resources, work or rewards', () => {
  const farm = createFarm(), before = otherState(farm), task = pick(farm);
  assert.deepEqual(Object.keys(farm.discoveryPreferences.idea!).sort(), ['detail', 'id', 'label']);
  assert.deepEqual(otherState(farm), before);
  setDiscoveryPace(farm.discoveryPreferences, true);
  assert.equal(getGuidanceTask(farm.discoveryPreferences, task), undefined);
  assert.deepEqual(otherState(farm), before);
  assert.equal(resumeDiscoveryIdea(farm.discoveryPreferences), true);
  assert.deepEqual(getGuidanceTask(farm.discoveryPreferences, task), task);
  assert.deepEqual(otherState(farm), before);
});

test('quiet mode and the selected idea persist across actions, four short visits, sleep and reload', () => {
  let farm = createFarm(); pick(farm); setDiscoveryPace(farm.discoveryPreferences, true);
  const selected = structuredClone(farm.discoveryPreferences.idea);
  for (let visit = 0; visit < 4; visit++) {
    farm = reload(farm);
    for (let i = 0; i < 8; i++) {
      workBed(farm, (visit + i) % farm.beds.length);
      assert.equal(getGuidanceTask(farm.discoveryPreferences, getDiscoveryTask(farm, farm.orientation)), undefined);
      assert.equal(farm.discoveryPreferences.quiet, true);
      assert.deepEqual(farm.discoveryPreferences.idea, selected);
    }
    endDay(farm);
    assert.deepEqual(farm.discoveryPreferences.idea, selected);
  }
  assert.equal(resumeDiscoveryIdea(farm.discoveryPreferences), true);
  assert.equal(farm.discoveryPreferences.quiet, false);
  assert.deepEqual(farm.discoveryPreferences.idea, selected);
  assert.deepEqual(reload(farm).discoveryPreferences, farm.discoveryPreferences);
});

test('a past idea is never automatically replaced and cannot replay its former action or reward', () => {
  const farm = createFarm(); const selected = pick(farm);
  const idea = structuredClone(farm.discoveryPreferences.idea);
  const different = { ...selected, id: 'another-step', label: 'Другая цель', reward: 999, action: { label: 'Продать', target: 'sell-item' } };
  const old = getGuidanceTask(farm.discoveryPreferences, different)!;
  assert.equal(old.label, idea!.label);
  assert.equal(old.bookmarkOnly, true);
  assert.equal(old.reward, undefined);
  assert.deepEqual(old.action, { label: 'К своей задумке', target: 'open-panel', value: 'journal' });
  assert.deepEqual(farm.discoveryPreferences.idea, idea);
  const missing = getGuidanceTask(farm.discoveryPreferences, undefined)!;
  assert.deepEqual(missing, old);
});

test('an idea still current uses newly derived progress and action, not its stored snapshot', () => {
  const farm = createFarm(), selected = pick(farm);
  const current = { ...selected, progress: 2, target: 3, reward: 4, action: { label: 'К дневнику', target: 'open-panel', value: 'journal' } };
  assert.deepEqual(getGuidanceTask(farm.discoveryPreferences, current), current);
  assert.equal('reward' in farm.discoveryPreferences.idea!, false);
  assert.equal('action' in farm.discoveryPreferences.idea!, false);
});

test('stale selection is refused and copies cannot change saved preferences', () => {
  const farm = createFarm(), next = getDiscoveryTask(farm, farm.orientation)!, before = structuredClone(farm);
  assert.equal(chooseDiscoveryIdea(farm.discoveryPreferences, next, 'old-id'), false);
  assert.deepEqual(farm, before);
  chooseDiscoveryIdea(farm.discoveryPreferences, next, next.id);
  next.label = 'Changed outside';
  assert.notEqual(farm.discoveryPreferences.idea!.label, next.label);
  const restored = reload(farm); restored.discoveryPreferences.idea!.label = 'Other copy';
  assert.notEqual(farm.discoveryPreferences.idea!.label, 'Other copy');
});

test('forgetting a bookmark does not turn quiet guidance back on or affect the farm', () => {
  const farm = createFarm(); pick(farm); setDiscoveryPace(farm.discoveryPreferences, true); const before = otherState(farm);
  forgetDiscoveryIdea(farm.discoveryPreferences);
  assert.deepEqual(farm.discoveryPreferences, { quiet: true, idea: null });
  assert.equal(resumeDiscoveryIdea(farm.discoveryPreferences), false);
  assert.deepEqual(otherState(farm), before);
});

test('preferences strictly validate values and strip executable fields from valid bookmarks', () => {
  for (const value of [null, [], {}, {quiet:1,idea:null}, {quiet:false}, {quiet:false,idea:{}}, {quiet:true,idea:{id:'x',label:'',detail:'d'}},
    {quiet:true,idea:{id:'x',label:'a'.repeat(181),detail:'d'}}, {quiet:true,idea:{id:'x',label:'name',detail:'\u0000'}}]) {
    assert.equal(restoreDiscoveryPreferences(value), undefined);
    assert.equal(restoreFarm({...createFarm(),discoveryPreferences:value}), undefined);
  }
  const prefs = restoreDiscoveryPreferences({quiet:true,idea:{id:'x',label:'Name',detail:'Detail',action:{target:'sell-item'},reward:1000}})!;
  assert.deepEqual(prefs, {quiet:true,idea:{id:'x',label:'Name',detail:'Detail'}});
});

test('journal renders explicit quiet/return controls, preserves selected text and escapes saved markup', () => {
  const farm = createFarm(), next = pick(farm), before = structuredClone(farm);
  assert.match(renderDiscoveryPreferences(farm.discoveryPreferences, next), />В своём ритме<\/button>/);
  assert.deepEqual(farm, before);
  setDiscoveryPace(farm.discoveryPreferences, true);
  const quiet = renderDiscoveryPreferences(farm.discoveryPreferences, next);
  assert.match(quiet, /Подсказки на острове скрыты/);
  assert.match(quiet, /Вернуться к задумке/);
  assert.match(quiet, /Выбранная задумка · сохранена/);
  const malicious = {quiet:false,idea:{id:'x',label:'<img src=x onerror=alert(1)>',detail:'<script>bad</script>'}};
  const html = renderDiscoveryPreferences(malicious);
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;img/);
  assert.match(html, /Доступные дела/);
  assert.doesNotMatch(html, /data-action="follow-task"/);
});
