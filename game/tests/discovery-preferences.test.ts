import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarm, restoreFarm, workBed, endDay } from '../src/farm.ts';
import { getDiscoveryTask } from '../src/discovery-path.ts';
import { chooseDiscoveryIdea, createDiscoveryPreferences, forgetDiscoveryIdea, restoreDiscoveryPreferences, resumeDiscoveryIdea, setDiscoveryPace } from '../src/discovery-preferences.ts';
import { getGuidanceTask } from '../src/discovery-guidance.ts';
import { renderDiscoveryGuidance } from '../src/discovery-preferences-ui.ts';

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
  assert.match(renderDiscoveryGuidance(farm.discoveryPreferences, next).settings, />В своём ритме<\/button>/);
  assert.deepEqual(farm, before);
  setDiscoveryPace(farm.discoveryPreferences, true);
  const quiet = renderDiscoveryGuidance(farm.discoveryPreferences, next);
  assert.match(quiet.settings, /Подсказки на острове скрыты/);
  assert.match(quiet.focus, /Вернуться к задумке/);
  assert.match(quiet.focus, /Выбранная задумка · сохранена/);
  const malicious = {quiet:false,idea:{id:'x',label:'<img src=x onerror=alert(1)>',detail:'<script>bad</script>'}};
  const { focus: html } = renderDiscoveryGuidance(malicious);
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;img/);
  assert.match(html, /Доступные дела/);
  assert.doesNotMatch(html, /data-action="follow-task"/);
});

test('the current step is presented once, with its action, progress, reward and optional bookmark together', () => {
  const farm = createFarm();
  const next = { ...getDiscoveryTask(farm, farm.orientation)!, progress: 2, target: 3, reward: 21 };
  const before = structuredClone(farm);
  const { focus, settings } = renderDiscoveryGuidance(farm.discoveryPreferences, next, next);
  assert.match(focus, /aria-label="Ближайший шаг"/);
  assert.match(focus, /2\/3 · Награда: 21 монета/);
  assert.ok(focus.indexOf('data-action="follow-task"') < focus.indexOf('data-action="discovery-pin"'));
  assert.match(focus, /class="dialog-button secondary" data-action="discovery-pin"/);
  assert.equal((focus + settings).split(`<h3>${next.label}</h3>`).length - 1, 1);
  assert.doesNotMatch(settings, /discovery-choice|discovery-pin/);
  assert.deepEqual(farm, before);
});

test('a current bookmark keeps its action and newly derived progress in the leading card', () => {
  const farm = createFarm(), selected = pick(farm);
  const next = { ...selected, detail: 'Текущие условия', progress: 3, target: 4, reward: 5 };
  const { focus, settings } = renderDiscoveryGuidance(farm.discoveryPreferences, next, next);
  assert.match(focus, /Текущие условия/);
  assert.match(focus, /3\/4 · Награда: 5 монет/);
  assert.match(focus, /data-action="follow-task"/);
  assert.match(focus, /data-action="discovery-forget"/);
  assert.doesNotMatch(focus + settings, /discovery-pin|сохранённая запись/);
  assert.doesNotMatch(settings, /discovery-bookmark|discovery-now/);
});

test('an old bookmark stays first without replaying an action, while the new suggestion remains optional', () => {
  const farm = createFarm(), selected = pick(farm);
  const next = { ...selected, id: 'different-step', label: 'Следующее дело', reward: 99 };
  const before = structuredClone(farm);
  const { focus, settings } = renderDiscoveryGuidance(farm.discoveryPreferences, next, getGuidanceTask(farm.discoveryPreferences, next));
  assert.ok(focus.includes(selected.label));
  assert.match(focus, /сохранённая запись/);
  assert.match(focus, /data-action="open-panel" data-value="guide"/);
  assert.doesNotMatch(focus, /follow-task|Награда|Следующее дело/);
  assert.match(settings, /Следующее дело/);
  assert.match(settings, /data-action="discovery-pin" data-value="different-step"/);
  assert.deepEqual(farm, before);
});

test('quiet play does not restore a current step merely by opening the journal', () => {
  const farm = createFarm(), next = getDiscoveryTask(farm, farm.orientation)!;
  setDiscoveryPace(farm.discoveryPreferences, true);
  const before = structuredClone(farm);
  const { focus, settings } = renderDiscoveryGuidance(farm.discoveryPreferences, next, next);
  assert.equal(focus, '');
  assert.doesNotMatch(settings, /follow-task/);
  assert.match(settings, /Показать подсказки/);
  assert.match(settings, /discovery-pin/);
  assert.deepEqual(farm, before);
});

test('quiet bookmarks can be resumed or forgotten, but do not expose an immediate task action', () => {
  const farm = createFarm(), next = pick(farm);
  setDiscoveryPace(farm.discoveryPreferences, true);
  const { focus, settings } = renderDiscoveryGuidance(farm.discoveryPreferences, next, next);
  assert.match(focus, /discovery-resume/);
  assert.match(focus, /discovery-forget/);
  assert.doesNotMatch(focus + settings, /follow-task|discovery-pin/);
});

test('local guidance without a task action keeps its details and does not invent controls', () => {
  const preferences = createDiscoveryPreferences();
  const goal = { label: 'Исследуйте Солёную рощу', detail: 'Сегодня можно собрать соль.', progress: 1, target: 3 };
  const { focus } = renderDiscoveryGuidance(preferences, undefined, goal);
  assert.match(focus, /Исследуйте Солёную рощу/);
  assert.match(focus, /1\/3/);
  assert.doesNotMatch(focus, /<button|dialog-nav/);
});
