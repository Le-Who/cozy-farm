import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {createFarm,treeDefinitions,getTreeAction,buyAndPlantTree,storeTree,returnNurseryTree,endDay,pickFruit,restoreCurrentFarm} from '../src/farm.ts'
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

test('orchard rows identify the tree and open its inspection without harvesting even when ripe',()=>{
 const farm=createFarm();assert.ok(buyAndPlantTree(farm,1,'apple').ok)
 for(let n=0;n<treeDefinitions.apple.days;n++)assert.ok(endDay(farm).ok)
 const before=structuredClone(farm),opened:string[]=[]
 const context={farm,treeDefinitions,getTreeAction,treeSlot:-1,quantity:String,itemIcon:()=>'',dialogContent:{},
  island:{visit:()=>{},isCrossing:()=>false},bayAudio:{primeEvents:()=>{}},openPanel:(panel:string)=>opened.push(panel),revealTreeStorageReturn:()=>{}}
 const slice=(from:string,to:string)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)))
 const command=slice("    case 'visit-tree':","    case 'pet':")
 const code=slice('function button(','function quantity(')+slice('function row(','function nav(')+
  slice('function treeRow(','const treeStorageChoice')+slice('function activateTarget(','function useHotbar(')+
  `function visit(value:string){switch('visit-tree'){${command}}}`
 runInNewContext(stripTypeScriptTypes(code),context)
 for(const index of [0,1,2]){
  const html=runInNewContext(`treeRow(${index})`,context) as string
  const label=index<2?'Осмотреть дерево':'Посадить дерево'
  const target=index<2?'Яблоня, ':''
  assert.match(html,new RegExp(`aria-label="${label}, ${target}место ${index+1}"`))
  assert.match(html,new RegExp(`>${label}\\s*<`));assert.doesNotMatch(html,/Собрать плоды/)
  if(index<2)assert.match(html,/Плодов к сбору: 2/)
  assert.match(html,/data-action="visit-tree"/)
  const value=html.match(/data-value="(\d+)"/)![1]
  runInNewContext(`visit("${value}")`,context)
  assert.equal(context.treeSlot,index);assert.equal(opened.at(-1),'tree');assert.deepEqual(farm,before)
 }
})

test('a full orchard names an alternative only when a boat and a free slot exist there',()=>{
 const f=full();assert.ok(storeTree(f,0).ok);assert.ok(buyAndPlantTree(f,0,'apple').ok)
 const localOnly='Сначала освободите место в этом саду.'
 assert.ok(render(f).includes(localOnly));assert.doesNotMatch(render(f),/в Солёной роще/)
 f.boatOwned=true
 const homeFull=structuredClone(f),away=render(f)
 assert.match(away,/Освободите место здесь или верните дерево в Солёной роще\./)
 assert.match(away,/disabled>Нет места в саду/);assert.deepEqual(f,homeFull)
 f.trees.grove=f.trees.home.map(tree=>tree&&{...tree})
 assert.ok(render(f).includes(localOnly));assert.doesNotMatch(render(f),/в Солёной роще/)
 f.island='grove';assert.ok(render(f).includes(localOnly))
 f.trees.home[1]=null
 assert.match(render(f),/Освободите место здесь или верните дерево на Родном острове\./)
 f.trees.grove[2]=null
 assert.match(render(f),/Вернуть · место 3/);assert.doesNotMatch(render(f),/tree-storage-availability/)
})
