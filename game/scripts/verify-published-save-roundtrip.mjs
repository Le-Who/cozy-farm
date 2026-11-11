// Verify storage isolation using the actual published implementation, not a mock of old writes.
// Usage: node scripts/verify-published-save-roundtrip.mjs /path/to/published/game
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as currentFarm from '../src/farm.ts';
import { farmSaveKeys as currentKeys } from '../src/farm-save-keys.ts';
import { VersionedSave as CurrentSave } from '../src/versioned-save.ts';

const base = '6ca84d8d41e60622fd73584cdbf92b3bc202b1de';
assert.ok(process.argv[2], 'Pass the game directory of a clean checkout at the published commit.');
const published = resolve(process.argv[2]);
assert.equal(execFileSync('git', ['-C', published, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), base);
assert.equal(execFileSync('git', ['-C', published, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim(), '');
const loadOld = name => import(pathToFileURL(resolve(published, 'src', `${name}.ts`)).href);
const oldFarm = await loadOld('farm');
const { farmSaveKeys: oldKeys } = await loadOld('farm-save-keys');
const { VersionedSave: OldSave } = await loadOld('versioned-save');
class MemoryStorage {
  items = new Map(); writes = [];
  getItem(key) { return this.items.get(key) ?? null; }
  setItem(key, raw) { this.writes.push(key); this.items.set(key, raw); }
}
const exclusive = async operation => operation();
const storage = new MemoryStorage();
const oldOpen = () => new OldSave(() => storage, oldKeys, oldFarm.restoreFarm, oldFarm.createFarm, exclusive);
const newOpen = () => new CurrentSave(() => storage, currentKeys, currentFarm.restoreFarm, currentFarm.createFarm, exclusive);
const oldSession = oldOpen();
const initial = await oldSession.load();
assert.ok(initial); initial.coins = 500;
assert.equal(oldFarm.upgradeBuilding(initial, 'farmhouse').ok, true);
assert.equal(oldFarm.specializeFarmhouse(initial, 'bakery').ok, true);
assert.equal(await oldSession.save(initial), true);
const publishedRaw = storage.getItem(oldKeys.primary);
const publishedJournal = storage.getItem(oldKeys.journal);
const publishedWriteCount = storage.writes.length;
const newSession = newOpen();
const recovered = await newSession.load();
assert.ok(recovered);
assert.equal(recovered.farmhouseSpecialization, 'bakery');
assert.equal(currentFarm.specializeFarmhouse(recovered, 'preserves').ok, true);
recovered.produce.wheat = 2; recovered.eggs = 1; recovered.fruit.apple = 1; recovered.fruit.pear = 1;
assert.equal(currentFarm.cookDish(recovered, 'farmhouseBread').ok, true);
assert.equal(currentFarm.cookDish(recovered, 'orchardPreserves').ok, true);
assert.equal(await newSession.save(recovered), true);
const recoveredRaw = storage.getItem(currentKeys.primary);
assert.equal(storage.getItem(oldKeys.primary), publishedRaw);
assert.equal(storage.getItem(oldKeys.journal), publishedJournal);
assert.equal(JSON.parse(storage.getItem(currentKeys.journal)).legacyRaw, publishedRaw);
assert.ok(storage.writes.slice(publishedWriteCount).every(key => key === currentKeys.primary || key === currentKeys.journal));
// The still-open published tab writes through its real save guard after the new tab saves.
initial.coins = 17;
assert.equal(await oldSession.save(initial), true);
assert.equal(storage.getItem(currentKeys.primary), recoveredRaw);
const oldReopened = await oldOpen().load();
assert.equal(oldReopened.coins, 17);
assert.equal(oldReopened.farmhouseSpecialization, 'bakery');
assert.equal(oldReopened.farmhouseSecondarySpecialization, undefined);
const newReopened = await newOpen().load();
assert.deepEqual(newReopened, recovered);
assert.equal(newReopened.dishes.farmhouseBread, 1);
assert.equal(newReopened.dishes.orchardPreserves, 1);
assert.equal(newReopened.farmhouseSecondarySpecialization, 'preserves');
console.log(JSON.stringify({ status: 'passed', publishedCommit: base, publishedKey: oldKeys.primary,
  recoveredKey: currentKeys.primary, originalSnapshotPreserved: true,
  actualOldWriterCannotOverwriteRecoveredProgress: true, bothKitchensAndDishesSurviveReload: true }, null, 2));
