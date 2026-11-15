import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import * as F from '../src/farm.ts'
import {renderCoopPanel} from '../src/coop-panel.ts'
import {renderCoopMorning} from '../src/coop-preview.ts'
import {chickenCarePlayer} from './fixtures/chicken-care-player.ts'
const button=(label:string,action:string,enabled=true,options:{value?:string|number}={})=>`<button data-action="${action}"${options.value!==undefined?` data-value="${options.value}"`:''}${!enabled?' disabled':''}>${label}</button>`
const row=(image:string,name:string,detail:string,actions='')=>`<li data-row="${name}"><i>${image}</i><strong>${name}</strong><small>${detail}</small>${actions}</li>`
const render=(f:F.FarmState)=>renderCoopPanel(f,{icon:id=>`<i>${id}</i>`,row,button,feedRow:()=>row('tool-feed','Корм для кур',f.chickensFed?'Сегодня накормлены':'Корм к утренней кладке',f.chickensFed?'':f.feed>0?button('Покормить','feed'):button('Купить корм','buy-feed',f.coins>=F.feedBagPrice))})
const actions=(html:string)=>[...html.matchAll(/<button([^>]*data-action="([^"]+)"[^>]*)>/g)].map(m=>({action:m[2],value:m[1].match(/data-value="([^"]*)"/)?.[1]??'',disabled:m[1].includes('disabled')}))
const p=chickenCarePlayer('orchard','hatchery');p.act('feedChickens');p.act('endDay');p.act('collectEggs');if(!p.state.feed)p.act('buyFeed');p.act('feedChickens');p.act('endDay');const earned=structuredClone(p.state)

test('daily feeding, eggs and incubator precede the old forecast and optional navigation without mutating earned state',()=>{
 const f=structuredClone(earned),before=structuredClone(f),html=render(f),primary=html.slice(0,html.indexOf('<details'))
 assert.ok(primary.indexOf('data-action="feed"')<primary.indexOf('data-action="collect"'))
 assert.ok(primary.indexOf('data-action="collect"')<primary.indexOf('data-action="incubate-egg"'))
 assert.ok(html.indexOf('data-action="incubate-egg"')<html.indexOf('coop-forecast'))
 assert.ok(html.indexOf('coop-forecast')<html.indexOf('hen-friendship-open'))
 assert.ok(html.includes(renderCoopMorning(f)));assert.match(html,/<summary>Кладка после отдыха<\/summary>/);assert.deepEqual(f,before)
})

test('every original action and enabled guard remains in basic, hatchery, pending, full flock and packing states',()=>{
 const pending=structuredClone(earned);assert.ok(F.incubateEgg(pending).ok);const hatched=structuredClone(pending);F.endDay(hatched);F.endDay(hatched)
 for(const f of[F.createFarm(),earned,pending,hatched,chickenCarePlayer('orchard','packing').state]){
  const a=actions(render(f)),expect:{action:string;value:string;disabled:boolean}[]=[],add=(action:string,enabled=true,value='')=>expect.push({action,value,disabled:!enabled})
  if(!f.chickensFed)add(f.feed?'feed':'buy-feed',!!f.feed||f.coins>=F.feedBagPrice)
  add('collect',f.eggsReady>0);if(f.coopSpecialization==='hatchery'&&f.flockSize<F.maxFlockSize&&f.hatchDay===null)add('incubate-egg',f.eggs>0)
  add('upgrades');add('hen-friendship-open');if(f.buildingLevels.coop>=2)add('chicken-feed-open')
  if(f.coopSpecialization==='packing'){add('pack-egg-crate',f.eggs>=F.eggsPerCrate);add('unpack-egg-crate',F.getEggUnpackAction(f,'crate').available)}
  if(f.buildingLevels.coop>=2||f.eggBaskets>0){add('pack-egg-basket',f.buildingLevels.coop>=2&&f.eggs>=F.eggsPerBasket);add('unpack-egg-basket',F.getEggUnpackAction(f,'basket').available)}
  for(let i=0;i<f.flockSize;i++)add('pet',true,String(i))
  const sorted=(x:typeof a)=>x.map(v=>JSON.stringify(v)).sort();assert.deepEqual(sorted(a),sorted(expect))
 }
})

test('ordinary egg cost and two nights are explicit; rare eggs do not enable or pay incubation',()=>{
 const f=structuredClone(earned);f.eggs=0;f.variants.egg={rainbow:1};const before=structuredClone(f)
 assert.match(render(f),/1 обычное яйцо · в запасе 0 · 2 ночи/)
 assert.ok(actions(render(f)).find(a=>a.action==='incubate-egg')!.disabled);assert.equal(F.incubateEgg(f).ok,false);assert.deepEqual(f,before)
 f.eggs=1;assert.ok(F.incubateEgg(f).ok);assert.equal(f.eggs,0);assert.equal(f.variants.egg.rainbow,1)
 assert.match(render(f),/До вылупления: 2 ночи/);assert.doesNotMatch(render(f),/data-action="incubate-egg"/)
})

test('pending hatch progresses only on real rest and fifth hen appears without a duplicate hatch action',()=>{
 const f=structuredClone(earned);assert.ok(F.incubateEgg(f).ok);const day=f.day,flock=f.flockSize
 render(f);assert.equal(f.day,day);assert.equal(f.flockSize,flock);F.endDay(f);assert.match(render(f),/До вылупления: 1 ночь/)
 assert.ok(render(f).includes('Утром вылупится новая курочка'))
 F.endDay(f);assert.equal(f.flockSize,5);assert.equal(f.hatchDay,null);assert.doesNotMatch(render(f),/data-row="Инкубатор"/)
 assert.equal(actions(render(f)).filter(a=>a.action==='pet').length,5);assert.ok(F.restoreCurrentFarm(JSON.parse(JSON.stringify(f))))
})

test('capacity caution remains beside visible egg collection, while the complete old forecast stays available',()=>{
 const f=structuredClone(earned);f.eggsReady=F.getCoopMorning(f).capacity;f.chickensFed=true
 const html=render(f),primary=html.slice(0,html.indexOf('<details'))
 assert.match(primary,/В гнёздах: 9\/9 · соберите до отдыха/);assert.ok(html.includes(renderCoopMorning(f)))
 assert.match(html,/Гнёзда полны/);assert.match(html,/Новая кладка пока не поместится/)
 const before=structuredClone(f);render(f);assert.deepEqual(f,before);assert.ok(F.collectEggs(f).ok);assert.doesNotMatch(render(f).slice(0,render(f).indexOf('<details')),/соберите до отдыха/)
})

test('feeding and buying remain first; empty-money guards and unlocked mix navigation are preserved',()=>{
 const f=structuredClone(earned);f.feed=0;f.coins=0;f.chickensFed=false;const before=structuredClone(f),html=render(f)
 assert.equal(actions(html)[0].action,'buy-feed');assert.equal(actions(html)[0].disabled,true);assert.ok(actions(html).some(a=>a.action==='chicken-feed-open'&&!a.disabled));assert.deepEqual(f,before)
 f.coins=F.feedBagPrice;assert.equal(actions(render(f))[0].disabled,false);assert.ok(F.buyFeed(f).ok);assert.equal(actions(render(f))[0].action,'feed');assert.ok(F.feedChickens(f).ok);assert.doesNotMatch(render(f),/data-action="feed"|data-action="buy-feed"/)
})

test('packaging stays before the complete original hen grid and does not silently unpack or consume',()=>{
 const f=chickenCarePlayer('orchard','packing').state;f.eggs=8;const before=structuredClone(f),html=render(f)
 assert.ok(html.indexOf('pack-egg-crate')<html.indexOf('hen-grid'));assert.ok(html.indexOf('pack-egg-basket')<html.indexOf('hen-grid'))
 assert.match(html,/Нужно 5 · в запасе 8/);assert.match(html,/Нужно 3 · в запасе 8/);assert.deepEqual(f,before)
 assert.ok(F.packEggCrate(f).ok);assert.ok(F.packEggBasket(f).ok);assert.equal(f.eggs,0);assert.equal(f.eggCrates,1);assert.equal(f.eggBaskets,1)
 assert.ok(actions(render(f)).filter(a=>a.action.startsWith('unpack')).every(a=>!a.disabled))
})

test('main delegates only the coop view and keeps child screens and canonical action handlers',()=>{
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),start=main.indexOf("    case 'coop':",main.indexOf('function drawPanel()')),end=main.indexOf("    case 'rest':",start),branch=main.slice(start,end)
 assert.match(branch,/renderCoopPanel\(farm, \{icon,row,button,feedRow:flockFeedRow\}\)/)
 assert.doesNotMatch(branch,/perform\(|saveFarm\(|incubateEgg\(|collectEggs\(/)
 assert.match(main,/renderHenFriendship\(farm, island.henWalkStatus\(\)/);assert.match(main,/renderChickenFeedMixes\(farm, icon\)/)
 assert.match(main,/case 'incubate-egg': perform\(\(\) => incubateEgg\(farm\)\)/)
})


test('legacy level-one baskets remain unpackable but do not unlock new packing or feed mixes',()=>{
 const f=F.createFarm();f.eggBaskets=1;const before=structuredClone(f),a=actions(render(f))
 assert.ok(a.find(x=>x.action==='pack-egg-basket')!.disabled);assert.equal(a.find(x=>x.action==='unpack-egg-basket')!.disabled,false);assert.equal(a.some(x=>x.action==='chicken-feed-open'),false);assert.deepEqual(f,before)
})
