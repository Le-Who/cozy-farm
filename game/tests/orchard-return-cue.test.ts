import test from 'node:test'
import assert from 'node:assert/strict'
import {ruCount} from '../src/ru.ts'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {createFarm,getTreeAction,treeDefinitions,treeIds,pickFruit,buyAndPlantTree,endDay,storeTree,restoreCurrentFarm} from '../src/farm.ts'

const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const fn=source.slice(source.indexOf('function treeRow('),source.indexOf('\nconst treeStorageChoice'))
function render(farm:ReturnType<typeof createFarm>,index:number){
 return runInNewContext(stripTypeScriptTypes(fn+'\ntreeRow(index)'),{farm,index,treeDefinitions,getTreeAction,
  quantity:(n:number)=>ruCount(n,'ночь','ночи','ночей'),
  button:(label:string,action:string,enabled:boolean,o:{value:number})=>`<button data-action="${action}" data-value="${o.value}"${enabled?'':' disabled'}>${label}</button>`,
  row:(_icon:string,name:string,detail:string,action:string)=>`<li><strong>${name}</strong><small>${detail}</small>${action}</li>`}) as string
}

test('new Home has an immediate harvest and a separate free planting choice, without first reading storage rules',()=>{
 const f=createFarm(),before=structuredClone(f)
 assert.equal(f.day,1);assert.equal(f.saplings.apple,1);assert.equal(f.treeNursery.length,0)
 assert.match(render(f,0),/Плодов к сбору: 2/)
 assert.match(render(f,0),/data-action="visit-tree" data-value="0">Осмотреть дерево/)
 for(const i of [1,2])assert.match(render(f,i),new RegExp(`data-action="visit-tree" data-value="${i}">Посадить дерево`))
 assert.deepEqual(f,before)
})

test('first harvest immediately tells the returning player when the same tree refills, including reload',()=>{
 const f=createFarm(),progress=structuredClone(f.progress),coins=f.coins;assert.ok(pickFruit(f,0).ok);assert.equal(f.fruit.apple,2);assert.equal(f.trees.home[0]!.fruitReady,0)
 assert.equal(f.coins,coins);assert.deepEqual(f.progress,progress)
 const before=structuredClone(f),html=render(f,0)
 assert.match(html,/Новые плоды завтра/);assert.doesNotMatch(html,/Плодов к сбору: 0/)
 assert.match(html,/data-action="visit-tree" data-value="0">Осмотреть/)
 assert.deepEqual(f,before)
 const loaded=restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!;assert.ok(loaded);assert.equal(render(loaded,0),html)
 assert.ok(endDay(loaded).ok);assert.equal(loaded.day,2);assert.equal(loaded.trees.home[0]!.fruitReady,2)
 assert.match(render(loaded,0),/Плодов к сбору: 2/)
 assert.ok(pickFruit(loaded,0).ok);assert.equal(loaded.fruit.apple,4)
})

test('an actually emptied Home garden still offers one explicit planting step and a two-night path to fruit',()=>{
 const f=createFarm();assert.ok(storeTree(f,0).ok);assert.ok(f.trees.home.every(t=>t===null))
 const stored=structuredClone(f.treeNursery),coins=f.coins,seeds=structuredClone(f.seeds),beds=structuredClone(f.beds)
 const before=structuredClone(f);assert.match(render(f,1),/Место для саженца/);assert.match(render(f,1),/>Посадить дерево/);assert.deepEqual(f,before)
 assert.ok(buyAndPlantTree(f,1,'apple').ok);assert.equal(f.coins,coins);assert.equal(f.saplings.apple,0)
 assert.deepEqual(f.treeNursery,stored);assert.deepEqual(f.seeds,seeds);assert.deepEqual(f.beds,beds)
 assert.match(render(f,1),/2 ночи до зрелости/);assert.equal(pickFruit(f,1).ok,false)
 assert.ok(endDay(f).ok);assert.match(render(f,1),/1 ночь до зрелости/);assert.equal(pickFruit(f,1).ok,false)
 assert.ok(endDay(f).ok);assert.equal(f.day,3);assert.match(render(f,1),/Плодов к сбору: 2/)
 assert.ok(pickFruit(f,1).ok);assert.equal(f.fruit.apple,2);assert.deepEqual(f.treeNursery,stored)
})

test('the forecast is used only for mature empty planted trees on either orchard',()=>{
 for(const island of ['home','grove'] as const)for(const tree of treeIds){
  const f=createFarm();f.island=island;const days=treeDefinitions[tree].days
  for(let age=0;age<days;age++){
   f.trees[island][0]={tree,age,fruitReady:0};const before=structuredClone(f)
   assert.match(render(f,0),new RegExp(`${ruCount(days-age,'ночь','ночи','ночей')} до зрелости`));assert.doesNotMatch(render(f,0),/Новые плоды завтра/);assert.deepEqual(f,before)
  }
  f.trees[island][0]={tree,age:days,fruitReady:0};assert.match(render(f,0),/Новые плоды завтра/)
  f.trees[island][0]!.fruitReady=2;assert.match(render(f,0),/Плодов к сбору: 2/);assert.doesNotMatch(render(f,0),/Новые плоды завтра/)
 }
 const away=createFarm();away.island='cape';assert.equal(render(away,0),'')
})
