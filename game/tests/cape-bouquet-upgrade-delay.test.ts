import A from 'node:assert/strict'
import {readFileSync as read} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import test from 'node:test'
import * as F from '../src/farm.ts'
import {getApiaryCopy} from '../src/apiary-preview.ts'
import {getWindHoneySource} from '../src/wind-honey-guidance.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const m=JSON.parse(read(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
const src=read(new URL('../src/main.ts',import.meta.url),'utf8')
function slice(a:string,b:string) {
 const i=src.indexOf(a),j=src.indexOf(b,i+a.length);A.ok(i>=0&&j>i)
 return src.slice(i,j)
}
const render=stripTypeScriptTypes(slice('function button(label:','function quantity(')+"\n;switch('hive'){"+slice("    case 'hive': {","    case 'cape-upgrade': {")+'}')
const controller=stripTypeScriptTypes("switch('cape-bouquet'){"+slice("    case 'cape-bouquet': {","    case 'collect-honey':")+"}")
function earned() {
 const p=commissionPlayer(m.slice(0,58))
 p.visit('grove');for(let i=0;i<2;i++){const cast=p.act('beginFishingTrip');p.act('finishFishingTrip',cast.token,1)}
 p.visit('home'); const quote=F.getVillageContributionChoices(p.state).find(s=>s.key==='fish:seaBass')!
 p.act('contributeVillageSupply',quote.token);p.visit('cape')
 A.deepEqual([p.actions,p.state.day,p.state.capeLevel,p.state.coins,p.state.honey,p.state.village.supplies,F.getCapeHoney(p.state).blooms],
   [66,6,1,120,3,{'fish:seaBass':2},3])
 return p
}
function view(farm:F.FarmState,hiveFlower?: number) {
 const dialogContent={innerHTML:''}
 runInNewContext(render,{...F,farm,hiveFlower,getApiaryCopy,getWindHoneySource,dialogContent,icon:()=>'',row:()=>'',nav:(...x:string[])=>'<nav>'+x.join('')+'</nav>',
  numberFormat:new Intl.NumberFormat('ru'),dialogTitle:{textContent:'',setAttribute(){}}})
 return dialogContent.innerHTML
}
function choose(farm:F.FarmState,value:string) {
 const events:string[]=[];let commit:undefined|(()=>boolean)
 runInNewContext(controller,{...F,farm,value,panel:'hive',hiveFlower:1,
   island:{workCape(t:{kind:string;index:number},c:()=>boolean){A.deepEqual([t.kind,t.index],['flower',1]);events.push('approach');commit=c}},
   closeDialog(){events.push('close')},perform:(fn:()=>F.ActionResult)=>fn().ok})
 return {events,commit}
}
const later=/улучшение не раньше завтра/

test('the exact earned Day6 flowering-bed cut discloses the lost upgrade today while manual collecting remains possible',()=>{
 const p=earned(), f=p.state, before=structuredClone(f)
 const html=view(f,1), quote=F.getCapeBouquetPreview(f,1)!
 A.match(html,/Срезать букет · мёд 3 → 2 · улучшение не раньше завтра/)
 A.match(html,/data-action="collect-honey"[^>]*>Собрать мёд/)
 A.match(html,/data-action="cape-upgrade"[^>]*>Улучшить/)
 A.equal(F.getCapeUpgrade(f)?.available,true);A.deepEqual(f,before)
 const click=choose(f,quote.token);A.deepEqual(click.events,['close','approach']);A.deepEqual(f,before)
 A.equal(click.commit?.(),true);A.equal(click.commit?.(),false);p.reload()
 A.deepEqual([F.getCapeHoney(p.state).blooms,F.getCapeHoney(p.state).available,F.getCapeUpgrade(p.state)?.available],[2,true,false])
 p.act('collectCapeHoney')
 A.deepEqual([p.state.day,p.state.honey,p.state.beeswax,F.getCapeUpgrade(p.state)?.available],[6,5,0,false])
 p.night();p.visit('cape')
 A.deepEqual([p.state.day,F.getCapeHoney(p.state).blooms,F.getCapeUpgrade(p.state)?.available],[7,3,true])
})

test('upgrade first retains the same bouquet and wax today, while the normal Hive still offers both genuine choices',()=>{
 const p=earned(), ordinary=view(p.state)
 A.doesNotMatch(ordinary,later)
 A.match(ordinary,/<nav><button class="dialog-button" type="button" data-action="cape-upgrade"[^>]*>Улучшить[\s\S]*?data-action="collect-honey"[^>]*>Собрать мёд/)
 p.act('upgradeCape')
 A.doesNotMatch(view(p.state,1),later)
 const quote=F.getCapeBouquetPreview(p.state,1)!
 A.equal(quote.cost,'мёд 4 → 2')
 p.act('cutCapeBouquet',1,quote.token);p.act('collectCapeHoney')
 A.deepEqual([p.state.day,p.state.capeBouquet,p.state.honey,p.state.beeswax,p.state.coins],
  [6,{day:6,bed:1},2,1,72])
 A.doesNotMatch(view(p.state,1),/cape-bouquet|улучшение не раньше завтра/)
})

test('an unavailable upgrade is not advertised as a lost option and a stale disclosed harvest quote cannot cut',()=>{
 const p=earned(), old=F.getCapeBouquetPreview(p.state,1)!
 p.visit('home');p.act('sellMarketItem','honey',1);p.visit('cape')
 A.equal(F.getCapeUpgrade(p.state)?.available,false)
 const newQuote=F.getCapeBouquetPreview(p.state,1)!
 A.equal(newQuote.cost,old.cost,'only the lost construction choice changed, not the honey yield')
 A.doesNotMatch(view(p.state,1),later)
 const before=structuredClone(p.state)
 A.deepEqual(choose(p.state,old.token).events,[]);A.deepEqual(p.state,before)
 A.equal(choose(p.state,newQuote.token).commit?.(),true)
 A.equal(F.getCapeHoney(p.state).available,true)
})
