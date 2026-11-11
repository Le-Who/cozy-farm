// New propagation uses existing Bed fields: an actual previous v4 reader/writer must preserve it.
// Usage: node game/scripts/verify-berry-v4-roundtrip.mjs /path/to/819f2a0/game
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as F from '../src/farm.ts';
import { getShopCommissionOffers } from '../src/shop-commissions.ts';
import { farmSaveKeys as keys } from '../src/farm-save-keys.ts';
import { VersionedSave as CurrentSave } from '../src/versioned-save.ts';
import { berryNurseryPlayer } from '../tests/fixtures/berry-nursery-player.ts';
const base='819f2a01bd7af803645de0da04da3e9095a82279';
assert.ok(process.argv[2], 'Pass a clean previous v4 game directory.');
const oldPath=resolve(process.argv[2]);
assert.equal(execFileSync('git',['-C',oldPath,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),base);
assert.equal(execFileSync('git',['-C',oldPath,'status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'');
const loadOld=name=>import(pathToFileURL(resolve(oldPath,'src',`${name}.ts`)).href);
const oldF=await loadOld('farm'),{farmSaveKeys:oldKeys}=await loadOld('farm-save-keys'),{VersionedSave:OldSave}=await loadOld('versioned-save');
assert.deepEqual(keys,oldKeys);
class Storage {items=new Map(); getItem(k){return this.items.get(k)??null} setItem(k,v){this.items.set(k,v)}}
const storage=new Storage(),exclusive=async op=>op();
const current=()=>new CurrentSave(()=>storage,keys,F.restoreCurrentFarm,F.createFarm,exclusive,F.restoreFarm);
const previous=()=>new OldSave(()=>storage,oldKeys,oldF.restoreCurrentFarm,oldF.createFarm,exclusive,oldF.restoreFarm);
const opening=JSON.parse(readFileSync(new URL('../tests/fixtures/home-progress-actions.json',import.meta.url),'utf8'));
const n=berryNurseryPlayer(opening),p=n.p;
n.divide(0,2);n.grow();n.divide(0,3);n.divide(2,4);n.grow();
for(const i of [0,2,3])p.act('workBed',i);
const id=n.cook();n.introduce(id);p.act('acceptShopCommission',getShopCommissionOffers(p.state).find(o=>o.customer==='finn').key);
n.cook(id);p.act('deliverShopCommission',String(p.state.shopCommissions.serial));
p.visit('home');
storage.setItem(keys.primary,JSON.stringify(p.state));
const newSession=current(),f=await newSession.load();
const staleSession=previous(),stale=await staleSession.load();
assert.equal(F.propagateBerry(f,4,0).ok,true);assert.equal(await newSession.save(f),true);
const committed=storage.getItem(keys.primary);
assert.equal(await staleSession.save(stale),false);assert.equal(storage.getItem(keys.primary),committed);
const oldSession=previous(),old=await oldSession.load();
assert.deepEqual(old,f,'actual previous strict v4 reader retains new seedlings and partial order');
assert.equal(old.shopCommissions.active.delivered,1);
for(const i of [0,4])assert.deepEqual(old.beds[i],{kind:'crop',crop:'blueberry',growth:0,watered:false,trait:'dew'});
// Let the prior release perform genuine normal watering and a normal morning, then save.
for(const i of [0,4]){if(!old.water)assert.equal(oldF.refillWater(old).ok,true);assert.equal(oldF.workBed(old,i).ok,true)}
assert.equal(oldF.endDay(old).ok,true);assert.equal(await oldSession.save(old),true);
const restored=await current().load();assert.deepEqual(restored,old);
for(let night=0;night<2;night++)assert.equal(F.endDay(restored).ok,true);
for(const i of [0,4])assert.equal(F.getBedStage(restored.beds[i]),'ripe');
assert.equal(F.workBed(restored,0).ok,true);
assert.equal(restored.variants.blueberry.dew,2,'one existing ingredient plus one genuine grown harvest');
assert.equal(restored.shopCommissions.active.delivered,1);
assert.equal(restored.shopCommissions.active.recipeId,id);
console.log(JSON.stringify({status:'passed',previousCommit:base,key:keys.primary,actualOldReaderWriterRetainsSeedlings:true,partialOrderRetained:true,staleWriterBlocked:true,ordinaryGrowthAndRareHarvest:true},null,2));
