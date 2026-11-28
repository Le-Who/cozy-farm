import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),start=source.indexOf('function marketCareProducts('),branch=source.slice(start,source.indexOf('function marketCards(',start))
function earned(){const f=F.createFarm();for(const [name,args]of [['workBed',[2]],['workBed',[3]],['pickFruit',[0]],['sellProduce',[]],['upgradeBuilding',['well']]] as const)assert.ok((F[name] as Function)(f,...args).ok);return f}
function render(farm:ReturnType<typeof F.createFarm>){
 const actions:{label:string;action:string;enabled:boolean;options:any}[]=[]
 const ctx={farm,marketCategory:'care',tabs:'',categories:'',stall:'',getWaterCapacity:F.getWaterCapacity,feedBagSize:F.feedBagSize,feedBagPrice:F.feedBagPrice,canUpgradePrice:F.canUpgradePrice,quantity:(n:number,w:string)=>`${n} ${w}`,icon:(s:string)=>`<img src="${s}">`,button:(label:string,action:string,enabled:boolean,options:any)=>{actions.push({label,action,enabled,options});return `<button data-action="${action}"${enabled?'':' disabled'}>${label}</button>`}}
 const html=runInNewContext(stripTypeScriptTypes(branch+'\nmarketCareProducts(tabs,categories,stall)'),ctx) as string
 return{html,actions}
}
test('Care names bag size and current stock, preserving one original action and canonical price per product',()=>{
 const farm=earned(),before=structuredClone(farm),{html,actions}=render(farm)
 assert.match(html,/В мешке: 2 порция/);assert.match(html,/В запасе: 2 порция/);assert.match(html,/4 <img src="coin"> за мешок/);assert.match(html,/35 <img src="coin"> за улучшение/)
 assert.deepEqual(JSON.parse(JSON.stringify(actions)),[{label:'Купить',action:'buy-feed',enabled:true,options:{context:'Корм для кур'}},{label:'Улучшить',action:'upgrade-can',enabled:true,options:{context:'Большая лейка'}}]);assert.deepEqual(farm,before)
})
test('real well bonus is represented before and after the canonical can upgrade, not a hardcoded ten',()=>{
 const farm=earned();assert.equal(F.getWaterCapacity(farm),8);assert.match(render(farm).html,/Объём: 8 → 12/)
 assert.ok(F.buyFeed(farm).ok);assert.match(render(farm).html,/В запасе: 4 порция/);assert.ok(F.upgradeCan(farm).ok);const before=structuredClone(farm),{html,actions}=render(farm)
 assert.equal(farm.coins,2);assert.equal(farm.water,12);assert.match(html,/Объём: 12/);assert.doesNotMatch(html,/за улучшение|Объём: 10|→/);assert.equal(actions[1].label,'Куплено');assert.equal(actions[1].enabled,false);assert.deepEqual(farm,before)
 assert.equal(F.upgradeCan(farm).ok,false);assert.deepEqual(farm,before);assert.deepEqual(F.restoreCurrentFarm(structuredClone(farm)),farm)
})
test('display follows the existing rain/well capacity formula without changing farm state',()=>{
 const farm=earned();farm.wellSpecialization='rain';const before=structuredClone(farm);assert.match(render(farm).html,/Объём: 12 → 16/);assert.deepEqual(farm,before)
})
test('original affordability thresholds and stock-only feed purchase stay exact',()=>{
 const farm=F.createFarm();assert.equal(render(farm).actions[0].enabled,true);assert.equal(render(farm).actions[1].enabled,false)
 assert.ok(F.buySeeds(farm,'tomato').ok);assert.ok(F.buySeeds(farm,'tomato').ok);assert.equal(farm.coins,F.feedBagPrice);assert.equal(render(farm).actions[0].enabled,true)
 const before=structuredClone(farm);assert.ok(F.buyFeed(farm).ok);const expected=structuredClone(before);expected.coins-=F.feedBagPrice;expected.feed+=F.feedBagSize;assert.deepEqual(farm,expected);assert.ok(render(farm).actions.every(a=>!a.enabled));assert.equal(F.buyFeed(farm).ok,false);assert.deepEqual(farm,expected)
 const rich=earned();assert.ok(F.buyFeed(rich).ok);assert.equal(render(rich).actions[1].enabled,true);assert.ok(F.buyFeed(rich).ok);assert.equal(render(rich).actions[1].enabled,false)
})
test('presentation and short keyboard-focus reveal are Care-only and read-only',()=>{
 assert.doesNotMatch(branch,/perform\(|saveFarm\(|buyFeed\(|upgradeCan\(|localStorage|data-market-tree-browser|data-market-orders-browser/)
 const css=readFileSync(new URL('../src/market-buy-care.css',import.meta.url),'utf8');assert.doesNotMatch(css,/market-tree|market-orders|market-sale/)
 const focus=source.slice(source.indexOf("app.addEventListener('focusin',event=>{"),source.indexOf("app.addEventListener('input', event => {"));assert.match(focus,/marketCategory==='care'/);assert.match(focus,/\[data-care-product\]/);assert.match(focus,/\[data-action=buy-feed\]:focus-visible,\[data-action=upgrade-can\]:focus-visible/);assert.match(focus,/max-height:400px/)
})
