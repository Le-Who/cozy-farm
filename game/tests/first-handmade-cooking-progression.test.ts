import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import * as F from '../src/farm.ts';
import * as Cook from '../src/cookery-model.ts';
import { getDiscoveryTask } from '../src/discovery-path.ts';
import { rememberRecipeDraft } from '../src/recipe-draft.ts';
import { publishedFarmSaveKeys } from '../src/farm-save-keys.ts';
import { restoreLegacyFarm } from '../src/farm-save-migration.ts';
import type { CookeryResult } from '../src/culinary.ts';

const src = readFileSync(new URL('../src/cookery.ts', import.meta.url), 'utf8');
const from = src.indexOf('  function doFinish()'), to = src.indexOf("  finish.addEventListener('click', doFinish", from);
assert.ok(from >= 0 && to > from);
const finish = stripTypeScriptTypes(src.slice(from, to) + '\ndoFinish();');
const apples = { base: 'tart', ingredients: [{id: 'apple', quantity: 2}] } as const;
const actionTrace = JSON.parse(readFileSync(new URL('fixtures/home-progress-actions.json', import.meta.url), 'utf8'));

function readyFarm() {
  const farm = F.createFarm();
  for (const { name,args } of actionTrace.slice(0,12)) {
    const act = F[name as keyof typeof F] as (farm: F.FarmState, ...args: unknown[]) => {ok:boolean;message:string};
    assert.equal(act(farm, ...args).ok, true, name);
  }
  assert.deepEqual([farm.day,farm.island,farm.fruit.apple,farm.produce.wheat,farm.eggs], [2,'home',2,3,4]);
  // Two already visited read-only tutorial panels from the checked portrait scenario.
  farm.orientation.collections = farm.orientation.islands = true;
  assert.equal(getDiscoveryTask(farm,farm.orientation)?.id,'first-cooking');
  return farm;
}
function performTart(accept: (result: CookeryResult) => boolean, accepted = true) {
  const model = Cook.createCookeryModel('decorate');
  for(let i=0;i<3;i++)assert.equal(Cook.placeCookeryFruit(model,i,{x:(i-1)*.4,y:.3}),true);
  assert.equal(model.stage,'sprinkle');
  for(let i=-5;i<=5;i++){
    const y=i*.15, half=Math.sqrt(1-y*y)*.9;
    Cook.beginCookeryStroke(model,{x:-half,y});
    Cook.moveCookeryStroke(model,{x:0,y});
    Cook.moveCookeryStroke(model,{x:half,y});
    Cook.endCookeryStroke(model);
  }
  assert.equal(model.stage,'ready');
  const calls:string[]=[];
  const state={model,completeCookery:Cook.completeCookery,contextLost:false,destroyed:false,loaded:true,
    physicallySettled:true,drag:null,options:{recipe:{},onComplete:accept,onCancel:()=>calls.push('exit')},
    fruitId:()=> 'apple',fruitTrait:()=>undefined,normalizeAngle:(a:number)=>a,
    playBaySound:()=>{},sync:()=>{},announce:(message:string)=>calls.push(message),exitButton:{setAttribute(){}}};
  runInNewContext(finish,state);
  if (!accepted) {
    assert.equal(model.stage,'ready');
    assert.match(calls[0] ?? '', /Не хватает ингредиентов/);
    return;
  }
  assert.equal(model.stage,'finished');
  runInNewContext(finish,state);
  assert.deepEqual(calls,['exit'],'second click is the exit, not a duplicate ingredient transaction');
}
function restore(farm: F.FarmState) {
  const recovered = F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)));
  assert.ok(recovered);
  return recovered;
}
test('first authored apple tart completes the same cooking milestone as the standard first tart', () => {
  const direct=readyFarm(), custom=restore(direct);
  const bill = (s:F.FarmState)=>[s.fruit.apple,s.produce.wheat,s.eggs,s.coins,s.day,s.island];
  const initial=bill(direct);
  assert.equal(F.getSignatureAction(custom,apples).available,true);
  performTart(result=>F.cookDish(direct,'orchardTart',result).ok);
  let authored:string|undefined;
  performTart(result=>{const receipt=F.completeSignature(custom,apples,result);authored=receipt.recipeId;return receipt.ok});
  assert.equal(direct.dishes.orchardTart,1);
  assert.equal(custom.culinary.stock[authored!],1);
  assert.deepEqual(bill(custom),bill(direct));
  assert.deepEqual(bill(custom).slice(0,3),[0,2,3]);
  assert.deepEqual(bill(custom).slice(3),initial.slice(3),'no purchase, sleep, or travel was applied by cooking');
  const need = (s:F.FarmState)=>getDiscoveryTask(s,s.orientation);
  const viaStandard=need(direct),viaOriginal=need(custom);
  process.stdout.write(JSON.stringify({initial,after:bill(custom),standard:viaStandard?.action,authored:viaOriginal?.action,serial:custom.culinary.serial})+'\n');
  assert.equal(viaStandard?.id,'boat');
  assert.equal(custom.boatOwned,false);
  assert.equal(custom.culinary.recipes[0].name,'Тарт: яблоко','ordinary generated name is enough');
  assert.equal(custom.culinary.serial,1);
  assert.equal(viaOriginal?.id,viaStandard?.id,'the same earned first cooking should not send the player back for apples');
  assert.deepEqual(viaOriginal?.action,viaStandard?.action);
  assert.equal(need(restore(custom))?.id,viaStandard?.id);
  assert.ok(F.endDay(custom).ok);
  assert.equal(need(restore(custom))?.id,viaStandard?.id,'sleep/reload do not restart first cooking');
  assert.ok(authored && F.sellSignature(custom,authored).ok && F.forgetSignature(custom,authored).ok);
  assert.equal(custom.culinary.recipes.length,0);

  const archived=restore(custom);
  assert.equal(archived.culinary.serial,1);
  assert.equal(Object.keys(archived.culinary.stock).length,0);
  assert.equal(need(archived)?.id,'boat','archiving a used recipe must not undo an earned milestone');
  const coins=archived.coins;
  assert.equal(F.buyBoat(archived).ok,true,'only a separate normal purchase spends coins');
  assert.equal(archived.coins,coins-F.boatPrice);
  assert.equal(archived.island,'home');
  assert.equal(need(archived)?.action.value,'grove');
});


test('normalizing an older save, saving a draft and cancelling or failing cooking are not cooking credit', () => {
  const fresh = F.createFarm(), farm=readyFarm();
  const old=structuredClone(farm) as Partial<F.FarmState>;
  delete old.culinary;
  const migrated=restoreLegacyFarm(old,publishedFarmSaveKeys.primary);
  assert.ok(migrated);
  assert.equal(fresh.culinary.serial,0);
  assert.equal(migrated.culinary.serial,0);
  assert.equal(getDiscoveryTask(migrated,migrated.orientation)?.id,'first-cooking');

  assert.ok(rememberRecipeDraft(migrated,{base:'tart',slots:[{id:'apple',quantity:1},{id:'apple',quantity:1}],activeSlot:0}));
  const prepared=restore(migrated), before=structuredClone(prepared);
  const model=Cook.createCookeryModel('decorate');
  assert.ok(Cook.placeCookeryFruit(model,0,{x:0,y:0}));
  Cook.cancelCookery(model);
  assert.equal(Cook.completeCookery(model,()=>{assert.fail('cancelled minigame cannot commit')}),false);
  performTart(result=>{
    // Another composition is rejected by the actual finish transaction.
    return F.completeSignature(prepared,{base:'tart',ingredients:[{id:'pear',quantity:2}]},result).ok;
  },false);
  assert.deepEqual(prepared,before);
  assert.equal(prepared.culinary.serial,0);
  assert.equal(getDiscoveryTask(restore(prepared),prepared.orientation)?.id,'first-cooking');
});
