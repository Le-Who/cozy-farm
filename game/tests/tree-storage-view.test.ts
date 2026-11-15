import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {createFarm,treeDefinitions,buyAndPlantTree,storeTree,returnNurseryTree,endDay,pickFruit,restoreCurrentFarm} from '../src/farm.ts'
import {nurseryFruitDetail} from '../src/orchard-guidance.ts'
import {treeVariantCopy} from '../src/ready-variant-guidance.ts'
import {TreeStorageChoice,storedTreeChoiceLabel} from '../src/tree-storage-choice.ts'
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const fn=source.slice(source.indexOf('function nurseryCard('),source.indexOf('\nlet fishingGame:'))
function render(farm:ReturnType<typeof createFarm>,slot?:number){
 const ctx={farm,slot,treeDefinitions,nurseryFruitDetail,treeVariantCopy,treeStorageChoice:new TreeStorageChoice(),storedTreeChoiceLabel,escapeHtml:(s:string)=>s,
  button:(label:string,action:string,enabled=true,o:any={})=>`<button data-action="${action}" data-value="${o.value}"${enabled?'':' disabled'}>${label}</button>`,
  row:(icon:string,name:string,detail:string,action:string,trait?:string)=>`<li data-trait="${trait??''}"><strong>${name}</strong>${detail}${action}</li>`}
 return runInNewContext(stripTypeScriptTypes(fn+'\nnurseryCard(slot)'),ctx) as string
}
function full(){const f=createFarm();assert.ok(buyAndPlantTree(f,1,'apple').ok);assert.ok(buyAndPlantTree(f,2,'apple').ok);assert.equal(f.coins,9);return f}

test('one existing storage name is used in market, orchard, return and rare-source text',()=>{
 assert.match(source,/Родной сад заполнен\. Бесплатно уберите дерево на хранение/)
 assert.match(source,/aria-label="Деревья на хранении"/)
 assert.match(source,/Хранение бесплатно освободит это место/)
 for(const file of ['main.ts','farm.ts','discovery-path.ts','nursery-variant-guidance.ts'])assert.doesNotMatch(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),/питомник/iu)
})

test('empty storage is absent; full gardens cannot return; every stored state and exact free target stays visible',()=>{
 const f=full();assert.equal(render(f),'');f.trees.home[0]!.trait='star';assert.ok(storeTree(f,0).ok)
 const before=structuredClone(f),html=render(f)
 assert.match(html,/Деревья на хранении · 1/);assert.match(html,/готовые плоды и особенность сохраняются/)
 assert.match(html,/рост и новые плоды на паузе/);assert.match(html,/Плодов к сбору: 2/)
 assert.match(html,/Обычные плоды ×1/);assert.match(html,/Звёздное яблоко ×1/)
 assert.match(html,/>Вернуть · место 1<\/button>/);assert.doesNotMatch(html,/ disabled/)
 assert.deepEqual(f,before)
 f.trees.home[0]={tree:'pear',age:0,fruitReady:0};const blocked=structuredClone(f)
 assert.match(render(f),/Сначала|сначала освободите место в саду/)
 assert.match(render(f),/data-action="return-nursery-tree" data-value="1" disabled>Нет места в саду/)
 assert.deepEqual(f,blocked)
 f.trees.home[2]=null;assert.match(render(f),/>Вернуть · место 3<\/button>/);assert.match(render(f,2),/>Вернуть · место 3<\/button>/)
 f.island='grove';assert.match(render(f,2),/>Вернуть · место 3<\/button>/)
 f.island='cape';assert.equal(render(f),'')
})

test('a real default full garden stores and relocates without selling or refilling, even across sleep and reload',()=>{
 const f=full(),original=structuredClone(f.trees.home[0]),coins=f.coins,fruit=structuredClone(f.fruit),seeds=structuredClone(f.saplings)
 assert.ok(storeTree(f,0).ok);const id=f.treeNursery[0].id,stored=structuredClone(f.treeNursery)
 assert.equal(f.trees.home[0],null);assert.deepEqual(f.fruit,fruit);assert.equal(f.coins,coins);assert.deepEqual(f.saplings,seeds)
 assert.match(render(f),/>Вернуть · место 1<\/button>/)
 const view=structuredClone(f);render(f);render(f,0);assert.deepEqual(f,view)
 assert.ok(endDay(f).ok);assert.deepEqual(f.treeNursery,stored)
 const loaded=restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!;assert.ok(loaded)
 assert.ok(storeTree(loaded,1).ok);assert.match(render(loaded,1),/>Вернуть · место 2<\/button>/)
 const before=structuredClone(loaded);assert.ok(returnNurseryTree(loaded,1,id).ok)
 assert.deepEqual(loaded.trees.home[1],original);assert.equal(loaded.trees.home[0],null)
 assert.deepEqual(loaded.fruit,before.fruit);assert.deepEqual(loaded.saplings,before.saplings);assert.equal(loaded.coins,before.coins)
 const once=structuredClone(loaded);assert.equal(returnNurseryTree(loaded,0,id).ok,false);assert.deepEqual(loaded,once)
 assert.ok(pickFruit(loaded,1).ok);assert.equal(loaded.fruit.apple,fruit.apple+2)
 assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(loaded))),loaded)
})
