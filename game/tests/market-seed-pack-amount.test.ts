import test from 'node:test'
import A from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as G from '../src/garden-plans.ts'
import { MarketSeedPacks } from '../src/market-seed-packs.ts'
import { MarketSaleBrowseMemory } from '../src/market-sale-browse.ts'
import { seedSavingQuote, saveCropSeeds } from '../src/seed-saving.ts'
import { ruPlural } from '../src/ru.ts'
import { earned416Mixed } from './fixtures/earned-416-market-orders.ts'

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
function chunk(a:string,b:string){const start=main.indexOf(a),end=main.indexOf(b,start+a.length);A.ok(start>=0&&end>start);return main.slice(start,end)}
const render=stripTypeScriptTypes(chunk('function button(','function goods()')+chunk('function marketCareProducts(','function treeSelector()')+'\nmarketCards(seedPacks)')
const decisions=stripTypeScriptTypes("switch (action) {"+chunk("    case 'market-seed-select':","    case 'buy-feed':")+'}')
const inputEvent=stripTypeScriptTypes(chunk("app.addEventListener('input', event => {","  if(event.target instanceof HTMLInputElement&&event.target.matches('[data-inline-quantity]'))")+"})")
const market=(farm:F.FarmState,seedPacks:MarketSeedPacks,marketCategory='seeds')=>runInNewContext(render,{...F,farm,seedPacks,marketCategory,marketTab:'buy',ruPlural,
 numberFormat:new Intl.NumberFormat('ru'),icon:(id:string)=>`<img data-icon="${id}" alt="">`}) as string
const make=()=>{
 const p=earned416Mixed(false);p.night()
 const f=structuredClone(p.state)
 const crops=f.beds.map((_,i)=>i<13?'wheat':'carrot')
 A.ok(G.saveGardenPlan(f,0,{name:'Пшеница и морковь',crops},f.gardenPlans.revision).ok)
 A.ok(G.followGardenPlan(f,0,f.gardenPlans.revision).ok)
 const verified=F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))
 A.deepEqual(verified,f)
 A.deepEqual([p.actions+2,f.day,f.island,f.coins,f.seeds.wheat,f.seeds.carrot,f.beds.filter(b=>b.kind==='tilled').length],[546,194,'home',56,0,1,16])
 return verified!
}
class Field {
 value='1';max='14';focuses=0;invalid=''
 setAttribute(key:string,value:string){A.equal(key,'aria-invalid');this.invalid=value}
 matches(s:string){return s==='[data-market-seed-count]'}
 focus(opts:FocusOptions){A.deepEqual({...opts},{preventScroll:true});this.focuses++}
}
function ui(farm:F.FarmState){
 const seedPacks=new MarketSeedPacks(),input=new Field()
 const total={textContent:''},summary={textContent:''},coin={hidden:false}
 const buy={disabled:false,dataset:{quote:''},label:'',setAttribute(key:string,value:string){A.equal(key,'aria-label');this.label=value},
  querySelector(s:string){A.ok(['[data-market-seed-total]','[data-market-seed-coin]'].includes(s));return s==='[data-market-seed-total]'?total:coin}}
 const less={disabled:false},more={disabled:false},keys=new Map<string,unknown>([
 ['[data-market-seed-count]',input],['[data-action="market-buy-seed-packs"]',buy],
 ['[data-market-seed-summary]',summary],['[data-action="market-seed-step"][data-value="less"]',less],['[data-action="market-seed-step"][data-value="more"]',more],
 ])
 const editor={querySelector(s:string){A.ok(keys.has(s),s);return keys.get(s)}} as unknown as HTMLElement
 const control={disabled:false,dataset:{quote:''}},grid={scrollTop:191}
 const focus:unknown[][]=[],sounds:string[]=[]
 let markup=market(farm,seedPacks),writes=0, attached=true
 const redraw=()=>{markup=market(farm,seedPacks);seedPacks.paint(farm,editor)}
 const ctx={farm,action:'',value:'',crop:'',control,
  marketSaleBrowse:{seedPacks},currentMarketSeedGrid:()=>attached?grid:undefined,currentMarketSeedEditor:()=>attached&&seedPacks.crop?editor:undefined,
  focusMarketSeedChoice(...args:unknown[]){focus.push(args)},
  drawPanel:redraw,playBaySound(s:string){sounds.push(s)},
  buySeeds:F.buySeeds,perform(act:()=>F.ActionResult){if(!act().ok)return false;writes++;redraw();return true},
 }
 return {seedPacks,focus,sounds,input,total,summary,coin,buy,more,less,disableControl(){control.disabled=true},get markup(){return markup},get writes(){return writes},
  act(action:string,value?:string,crop?:string,token=buy.dataset.quote){Object.assign(ctx,{action,value,crop});control.dataset.quote=token;runInNewContext(decisions,ctx)},
  type(raw:string){input.value=raw;runInNewContext(inputEvent,{...ctx,HTMLInputElement:Field,app:{addEventListener(event:string,fn:(arg:unknown)=>void){A.equal(event,'input');fn({target:input})}}})},
  attach(active:boolean){attached=active}}
}
function card(html:string,crop:string) {return html.match(new RegExp(`<section data-seed-pack="${crop}">([\\s\\S]+?)</section>`))?.[1]??''}

test('earned 13 wheat + 3 carrot plan: choose/quote on exact wheat card, one exact payment equal to five, and one ordinary other crop pack',()=>{
 const farm=make(),before=structuredClone(farm),v=ui(farm)
 A.equal((v.markup.match(/data-action="buy-seeds"/g)??[]).length,10)
 A.doesNotMatch(v.markup,/data-market-seed-count/)
 A.match(card(v.markup,'wheat'),/aria-expanded="false">Пшеница<\/button>/)
 v.act('market-seed-select','wheat')
 A.deepEqual(v.focus,[['wheat',191,'[data-market-seed-count]']])
 A.match(card(v.markup,'wheat'),/В пакете: 3 семени/)
 A.match(card(v.markup,'wheat'),/В запасе: 0 семян/)
 A.match(card(v.markup,'wheat'),/aria-label="4 монеты за пакет"/)
 A.match(card(v.markup,'wheat'),/aria-expanded="true" aria-controls="seed-packs-wheat"/)
 A.match(card(v.markup,'wheat'),/aria-label="Количество пакетов: Пшеница"/)
 A.equal((v.markup.match(/data-market-seed-count/g)??[]).length,1)
 A.match(card(v.markup,'carrot'),/data-action="buy-seeds"/)
 v.act('market-seed-step','more');A.equal(v.input.value,'2')
 v.disableControl();v.act('market-seed-step','less');A.equal(v.input.value,'1');A.equal(v.input.focuses,1)
 v.type('5')
 A.equal(v.total.textContent,'Купить 5 пакетов · 20')
 A.equal(v.summary.textContent,'5 пакетов: 15 семян, 20 монет.')
 A.deepEqual(farm,before);A.equal(v.writes,0)
 const paidToken=v.buy.dataset.quote
 v.act('market-buy-seed-packs',undefined,'wheat')
 A.equal(v.writes,1);A.deepEqual(v.sounds,['trade.pay'])
 A.deepEqual(v.focus.at(-1),['wheat',191,'.market-seed-stock'])
 A.equal(v.seedPacks.view(farm)?.text,'')
 A.equal(v.buy.disabled,true,'keep the same physical editor in place after payment, with no next paid action armed')
 A.match(card(v.markup,'wheat'),/В запасе: 15 семян/)
 v.act('market-buy-seed-packs',undefined,'wheat',paidToken)
 A.equal(v.writes,1)
 const repeated=structuredClone(before)
 for(let i=0;i<5;i++)A.ok(F.buySeeds(repeated,'wheat').ok)
 A.deepEqual(farm,repeated)
 A.ok(F.buySeeds(farm,'carrot').ok);A.ok(F.buySeeds(repeated,'carrot').ok)
 A.deepEqual(farm,repeated)
 A.deepEqual([farm.coins,farm.seeds.wheat,farm.seeds.carrot],[32,15,4])
 A.deepEqual(farm.beds,before.beds)
 A.deepEqual(farm.gardenPlans,before.gardenPlans)
 A.equal(farm.selectedSeed,before.selectedSeed)
 const free=structuredClone(before),q=seedSavingQuote(free,'wheat')
 A.ok(q?.available&&saveCropSeeds(free,q.token).ok)
 A.deepEqual([free.coins,free.produce.wheat,free.seeds.wheat],[56,1,3])
})

test('read-only quantity and crop scope reject wrong or stale confirmation; same Buy visit resumes without carrying amount to another crop',()=>{
 const farm=make(),before=structuredClone(farm),v=ui(farm)
 v.act('market-seed-select','wheat')
 for(const value of ['','5e0','abc','4.1','0','-2','15','99999999999999999999999']){
  v.type(value);A.equal(v.buy.disabled,true,value);A.equal(v.buy.dataset.quote,'',value)
  A.equal(v.input.invalid,'true');A.equal(v.coin.hidden,true);A.equal(v.total.textContent,'1–14 пакетов')
  v.act('market-buy-seed-packs',undefined,'wheat')
 }
 v.type('5');const wheatToken=v.buy.dataset.quote
 v.act('market-buy-seed-packs',undefined,'carrot',wheatToken)
 v.act('market-seed-select','carrot')
 A.equal(v.seedPacks.view(farm)?.text,'1')
 A.match(card(v.markup,'wheat'),/data-action="buy-seeds"/)
 v.act('market-buy-seed-packs',undefined,'carrot',wheatToken)
 v.act('market-seed-select','carrot')
 A.equal(v.seedPacks.crop,undefined)
 A.deepEqual(farm,before);A.equal(v.writes,0)
 v.act('market-seed-select','wheat');v.type('5')
 A.ok(F.buySeeds(farm,'beetroot').ok) // real separate payment invalidates the previously displayed funding bound
 const stale=structuredClone(farm)
 v.act('market-buy-seed-packs',undefined,'wheat',wheatToken)
 A.deepEqual(farm,stale);A.equal(v.writes,0)
 A.notEqual(v.buy.dataset.quote,wheatToken)
 v.attach(false)
 v.act('market-buy-seed-packs',undefined,'wheat')
 A.equal(v.writes,0);A.deepEqual(farm,stale)
 A.doesNotMatch(market(farm,v.seedPacks,'care'),/data-market-seed-count|market-seed-select/)
 A.doesNotMatch(market(farm,v.seedPacks,'trees'),/data-market-seed-count|market-seed-select/)
 const mem=new MarketSaleBrowseMemory();A.ok(mem.seedPacks.choose(farm,'wheat'));mem.seedPacks.edit('5')
 mem.rememberBuySeeds('current',191);A.equal(mem.takeBuySeeds('current'),191)
 A.equal(mem.seedPacks.view(farm)?.text,'5')
 mem.resetBuySeeds();A.equal(mem.seedPacks.crop,undefined)
 A.match(main,/case 'market':[\s\S]*?marketCards\(marketSaleBrowse\.seedPacks\)/)
})

test('seed quote and atomic purchase obey owned save capacity and exact funds without altering other purchasing',()=>{
 const farm=make(),choose=new MarketSeedPacks()
 farm.coins=7
 A.equal(F.seedPackQuote(farm,'wheat',2)?.available,false)
 A.equal(choose.choose(farm,'wheat'),false)
 A.doesNotMatch(card(market(farm,choose),'wheat'),/market-seed-select/)
 A.match(card(market(farm,choose),'wheat'),/data-action="buy-seeds"/)
 const before=structuredClone(farm)
 for(const n of [2,Number.NaN,-1,0,.5,Infinity]){
  A.equal(F.buySeeds(farm,'wheat',n).ok,false)
  A.deepEqual(farm,before)
 }
 A.ok(F.buySeeds(farm,'wheat').ok)
 A.deepEqual([farm.coins,farm.seeds.wheat],[3,3])
 farm.coins=56;farm.seeds.wheat=Number.MAX_SAFE_INTEGER-2
 const full=structuredClone(farm)
 A.equal(F.seedPackQuote(farm,'wheat')?.maximum,0)
 A.equal(F.buySeeds(farm,'wheat').ok,false)
 A.deepEqual(farm,full)
})
