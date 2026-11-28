import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {MarketFeedBags} from '../src/market-feed-bags.ts'
import {isGuardedAction} from '../src/action-click-guard.ts'
import {earned416Mixed} from './fixtures/earned-416-market-orders.ts'
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),start=source.indexOf('function marketCareProducts('),branch=source.slice(start,source.indexOf('function marketCards(',start))
function earned(){const f=F.createFarm();for(const [name,args]of [['workBed',[2]],['workBed',[3]],['pickFruit',[0]],['sellProduce',[]],['upgradeBuilding',['well']]] as const)assert.ok((F[name] as Function)(f,...args).ok);return f}
function render(farm:ReturnType<typeof F.createFarm>,bags?:MarketFeedBags){
 const actions:{label:string;action:string;enabled:boolean;options:any}[]=[]
 const ctx={farm,bags,marketCategory:'care',tabs:'',categories:'',stall:'',getWaterCapacity:F.getWaterCapacity,feedBagSize:F.feedBagSize,feedBagPrice:F.feedBagPrice,canUpgradePrice:F.canUpgradePrice,quantity:(n:number,w:string)=>`${n} ${w}`,icon:(s:string)=>`<img src="${s}">`,button:(label:string,action:string,enabled:boolean,options:any)=>{actions.push({label,action,enabled,options});return `<button data-action="${action}"${enabled?'':' disabled'}>${label}</button>`}}
 const html=runInNewContext(stripTypeScriptTypes(branch+'\nmarketCareProducts(tabs,categories,stall,bags)'),ctx) as string
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

test('earned D196 one batch exactly matches four ordinary bag purchases and changes only money/feed',()=>{
 const {state:farm,actions}=earned416Mixed(true)
 assert.deepEqual([farm.day,actions,F.getSale(farm).items,farm.coins,farm.feed,farm.workToday],[196,552,416,60,1,2])
 const repeat=structuredClone(farm),batch=structuredClone(farm),expected=structuredClone(farm)
 for(let n=0;n<4;n++)assert.ok(F.buyFeed(repeat).ok)
 expected.coins=44;expected.feed=9
 assert.deepEqual(repeat,expected)
 assert.ok(F.buyFeed(batch,4).ok)
 assert.deepEqual([batch.coins,batch.feed],[44,9])
 assert.deepEqual(batch,repeat)
 const normal=structuredClone(farm),one=structuredClone(farm)
 assert.ok(F.buyFeed(normal).ok);assert.ok(F.buyFeed(one,1).ok);assert.deepEqual(one,normal)
 for(const bags of [0,-1,1.1,NaN,Infinity,16,Number.MAX_SAFE_INTEGER]){
  const rejected=structuredClone(farm)
  assert.equal(F.buyFeed(rejected,bags).ok,false)
  assert.deepEqual(rejected,farm)
 }
 const almostFull={...farm,feed:Number.MAX_SAFE_INTEGER-1}
 assert.equal(F.buyFeed(almostFull).ok,false)
 assert.deepEqual(almostFull,{...farm,feed:Number.MAX_SAFE_INTEGER-1})
})

test('the earned Care card has an inline one-bag default and live larger quote, with no write or duplicate Buy',()=>{
 const {state:farm}=earned416Mixed(true),before=structuredClone(farm),bags=new MarketFeedBags()
 const initial=render(farm,bags)
 assert.match(initial.html,/data-market-feed-count type="number" min="1" max="15"/)
 assert.match(initial.html,/Купить 1 мешок · 4/)
 assert.match(initial.html,/В мешке: 2 порция/)
 assert.match(initial.html,/В запасе: 1 порция/)
 assert.match(initial.html,/4 <img src="coin"> за мешок/)
 assert.doesNotMatch(initial.html,/data-action="buy-feed"/)
 assert.equal(initial.actions.filter(a=>a.action==='upgrade-can').length,1)
 bags.step(farm,1)
 assert.equal(bags.view(farm).text,'2')
 bags.edit('4')
 const quote=bags.view(farm),selected=render(farm,bags).html
 assert.match(selected,/Купить 4 мешка · 16/)
 assert.match(selected,/8 порций/)
 assert.equal(bags.confirm(farm,quote.token)?.bags,4)
 assert.deepEqual(farm,before)
 for(const bad of ['0','','-1','1.3','e4','16','9007199254740992']){
  bags.edit(bad); const v=bags.view(farm)
  assert.equal(v.valid,false)
  assert.equal(bags.confirm(farm,quote.token),undefined)
  assert.match(render(farm,bags).html,/aria-invalid="true"/)
 }
 bags.reset()
 const one=structuredClone(farm)
 while(one.coins>F.feedBagPrice)assert.ok(F.buyFeed(one).ok)
 assert.equal(render(one,bags).actions[0].action,'buy-feed')
 assert.doesNotMatch(render(one,bags).html,/data-market-feed-count/)
 assert.ok(F.buyFeed(one).ok)
 assert.equal(render(one,bags).actions[0].enabled,false)
 assert.equal(isGuardedAction('market-feed-buy-bags'),true)
})

test('actual Care checkout path rejects detached and stale quotes, then commits once and focuses stock',()=>{
 const {state:farm}=earned416Mixed(true),bags=new MarketFeedBags()
 const careStart=source.indexOf('function currentMarketFeedEditor(')
 const guard=source.slice(careStart,source.indexOf('function focusMarketSeedChoice(',careStart))
 const casesStart=source.indexOf("    case 'market-feed-step':")
 const cases=source.slice(casesStart,source.indexOf("    case 'buy-feed':",casesStart))
 assert.ok(careStart>=0&&casesStart>=0)
 const common = () => ({dataset:{} as Record<string,string>,disabled:false,hidden:false,textContent:'',
  setAttribute(){},focus(){}})
 const input={...common(),value:'4',max:''},total=common(),coin=common(),output=common(),less=common(),more=common()
 const choose={...common(),querySelector:(key:string)=>key==='[data-market-feed-total]'?total:coin}
 const editorParts:Record<string,unknown>={'[data-market-feed-count]':input,'[data-action="market-feed-buy-bags"]':choose,
  '[data-market-feed-output]':output,'[data-action="market-feed-step"][data-value="less"]':less,
  '[data-action="market-feed-step"][data-value="more"]':more}
 let focus=0,paid=0,saves=0,crossing=false
 const editor={contains:(el:unknown)=>el===choose||el===input||el===less||el===more,
  querySelector:(key:string)=>editorParts[key]}
 const ctx={panel:'market',marketTab:'buy',marketCategory:'care',farm,dialog:{open:true},
  island:{isCrossing:()=>crossing},dialogContent:{querySelector:(sel:string)=>sel==='[data-market-feed-stock]'
   ?{focus:(opts?:{preventScroll:boolean})=>{assert.equal(opts?.preventScroll,true);focus++}}:editor},
  marketSaleBrowse:{feedBags:bags},buyFeed:F.buyFeed,playBaySound:(sound:string)=>{assert.equal(sound,'trade.pay');paid++},
  perform:(doBuy:()=>ReturnType<typeof F.buyFeed>)=>{const result=doBuy();if(result.ok)saves++;return result.ok}}
 const dispatch=runInNewContext(stripTypeScriptTypes(guard+`\n(action,control,value)=>{switch(action){${cases}}}`),ctx)
 bags.edit('4');bags.paint(farm,editor as unknown as HTMLElement)
 const baseline=structuredClone(farm)
 dispatch('market-feed-buy-bags',{...choose}); assert.equal(saves,0)
 crossing=true;dispatch('market-feed-buy-bags',choose);crossing=false;assert.equal(saves,0)
 ctx.marketCategory='seeds';dispatch('market-feed-buy-bags',choose);ctx.marketCategory='care';assert.equal(saves,0)
 assert.deepEqual(farm,baseline)
 assert.ok(F.buyFeed(farm).ok) // an explicit old purchase outside this mounted quote
 const afterInterruption=structuredClone(farm)
 dispatch('market-feed-buy-bags',choose)
 assert.equal(saves,0);assert.equal(paid,0);assert.equal(focus,0);assert.deepEqual(farm,afterInterruption)
 assert.equal(input.max,'14');assert.match(total.textContent,/Купить 4 мешка · 16/)
 assert.match(output.textContent,/8 порций/)
 dispatch('market-feed-buy-bags',choose)
 assert.deepEqual([farm.coins,farm.feed,saves,paid,focus],[40,11,1,1,1])
 dispatch('market-feed-buy-bags',choose) // even a retained old button/token cannot buy again
 assert.deepEqual([farm.coins,farm.feed,saves,paid,focus],[40,11,1,1,1])
 assert.equal(bags.view(farm).text,'1')
 assert.match(source,/marketCategory === 'care' && farm.island === 'home'\s*\? marketCards\(undefined,marketSaleBrowse.feedBags\)/)
 assert.match(source,/event.target.matches\('\[data-market-feed-count\]'\)[\s\S]{0,200}marketSaleBrowse.feedBags.edit/)
 assert.doesNotMatch(source.slice(source.indexOf("app.addEventListener('keydown', event => {",source.indexOf("app.addEventListener('input', event => {"))),/data-market-feed-count/)
})
