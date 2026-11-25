import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as C from '../src/shop-commissions.ts'
import { ShopCommissionView } from '../src/shop-commission-view.ts'
import { ShopAssortmentChoice } from '../src/shop-assortment-choice.ts'
import { renderShopCommissions } from '../src/shop-commissions-ui.ts'
import { bayShopDailyLimit, removeBayShopStock } from '../src/bay-shop-model.ts'
import { assortmentPlayer } from './fixtures/assortment-player.ts'

const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url),'utf8'))
const earned = assortmentPlayer(opening)
const main = readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
type FState = F.FarmState
const request = (key: string) => ({dataset:{commissionView:'request'},value:key})
const pair = (part: string, id: string) => ({dataset:{commissionPair:part,customer:'bea'},value:id})
const buttons = (html: string) => [...html.matchAll(/<button\b[^>]*data-action="commission-accept"\s+data-value="([^"]*)"([^>]*)>/g)].map(row=>({key:row[1],enabled:!row[2].includes('disabled')}))
const selectors = (html: string) => [...html.matchAll(/<select\b[^>]*data-commission-pair="([^"]+)"/g)].map(row=>row[1])
function segment(start:string,end:string){const a=main.indexOf(start),b=main.indexOf(end,a+1);assert.ok(a>=0&&b>a);return main.slice(a,b)}

function stock(farm:FState) {
 const view=new ShopCommissionView(),choice=new ShopAssortmentChoice()
 assert.ok(view.choose(farm,'customer','bea'))
 const focuses:string[]=[],journey:string[]=[], state:any={
   HTMLSelectElement:class {constructor(options:object){Object.assign(this,options)}},farm,
   panel:'shop-commissions',dialog:{open:true},shopCommissionView:view,shopAssortmentChoice:choice,
   CSS:{escape:(s:string)=>s},drawPanel(){},
   dialogContent:{scrollTop:9,querySelector:(s:string)=>({focus:(options:{preventScroll:boolean})=>{assert.ok(options.preventScroll);focuses.push(s)}})},
   acceptShopCommission:C.acceptShopCommission,perform:(command:()=>{ok:boolean})=>command().ok,requestAnimationFrame:(cb:()=>void)=>cb(),
 }
 const choose =runInNewContext(stripTypeScriptTypes('(input)=>{'+segment('  if (input instanceof HTMLSelectElement && input.dataset.commissionView',`  if (input instanceof HTMLSelectElement && input.matches('[data-tree-storage-choice]')`)+ '}'),state)
 const commit =runInNewContext(stripTypeScriptTypes('(value)=>{switch("commission-accept"){'+segment("    case 'commission-accept':","    case 'commission-deliver':")+'}}'),state)
 return {view,choice,focuses,journey,setPanel(panel:string,open:boolean){state.panel=panel;state.dialog.open=open},html:()=>renderShopCommissions(farm,()=>'<img alt="">',choice,view),
    choose(input:any){journey.push(Object.keys(input.dataset)[0]+':'+input.value);choose(new state.HTMLSelectElement(input))},
    accept(key:string){journey.push('accept');commit(key)}}
}


const restore=(f:FState)=>F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!
const tryAccept=(h:ReturnType<typeof stock>)=>{const [button]=buttons(h.html());assert.ok(button?.enabled);h.accept(button.key);return button.key}
const itemRows=(html:string)=>(html.match(/class="commission-preview-line"/g)??[]).length
const tag=(html:string)=>html.slice(html.indexOf('aria-label="Набор для покупателя"'),html.indexOf('commission-navigation'))

test('a uniquely earned set takes request then explicit accept, and actual preparation and payment remain separate',()=>{
 const {p,jam,tart,cook}=assortmentPlayer(opening)
 const before=structuredClone(p.state),h=stock(p.state)
 assert.deepEqual([p.state.day,p.actions,p.state.shopCommissions.completed.bea],[25,200,2])
 assert.doesNotMatch(h.html(),/aria-label="Набор для покупателя"/)
 assert.equal(buttons(h.html()).length,1)
 h.choose(request('set'))
 const preview=tag(h.html())
 assert.deepEqual(selectors(preview),[]);assert.equal(itemRows(preview),2)
 assert.equal((preview.match(/Нужно 2 ·/g)??[]).length,2)
 for(const id of [jam,tart]) assert.ok(preview.includes(p.state.culinary.recipes.find(r=>r.id===id)!.name))
 assert.match(preview,/За всю партию: 114 монет/);assert.match(preview,/Включая премию 12 монет/)
 assert.equal(buttons(preview).length,1);assert.deepEqual(p.state,before)
 const key=tryAccept(h)
 assert.deepEqual(h.journey,['commissionView:set','accept'])
 assert.deepEqual(h.focuses,['[data-commission-view="request"]','.commission-current'])
 const expected=restore(before);assert.ok(C.acceptShopCommission(expected,key).ok)
 assert.deepEqual(p.state,expected)
 assert.deepEqual(p.state.culinary,before.culinary);assert.deepEqual(p.state.freight,before.freight)
 assert.deepEqual([p.state.workToday,p.state.coins],[before.workToday,before.coins])
 assert.match(h.html(),/Отменить заказ/);assert.doesNotMatch(h.html(),/data-action="commission-finish"/)
 assert.equal(C.acceptShopCommission(p.state,key).ok,false);assert.deepEqual(p.state,expected)
 const serial=String(p.state.shopCommissions.serial)
 for(const [id,base] of [[jam,'preserves'],[tart,'tart']] as const){
  for(let n=0;n<2;n++){
   cook(base,id)
   const row=C.getShopCommission(p.state)!.lines.find(row=>row.recipeId===id)!
   const coins=p.state.coins
   if(n===0){p.act('transferBayGoods','deposit','village','signature:'+id,1);assert.ok(C.getShopCommissionLine(p.state,row.actionValue)!.warehouse)}
   p.act('deliverShopCommission',row.actionValue)
   assert.equal(p.state.coins,coins)
   if(n===0)assert.equal(C.getShopCommissionLine(p.state,row.actionValue)!.warehouse,0)
  }
 }
 assert.ok(C.getShopCommission(p.state)?.canClaim);const coins=p.state.coins
 p.act('finishShopCommission',serial);assert.equal(p.state.coins-coins,114)
 assert.equal(p.state.shopCommissions.completed.bea,3);assert.deepEqual(restore(p.state),p.state)
 assert.equal(C.finishShopCommission(p.state,serial).ok,false)
 console.log('actual',JSON.stringify({uniqueActions:h.journey,paid:p.state.coins-coins,receipt:p.state.shopCommissions.last}))
})
function earnThird(){
 const {p,...details}=assortmentPlayer(opening)
 p.fruit('apple',2);p.visit('village')
 const sibling=p.act('completeSignature',{base:'preserves',ingredients:[{id:'apple',quantity:2}]},{family:'preserves',processing:'silky',fruit:[],steps:['mix','pour']}).recipeId as string
 for(let i=0;!p.state.bayShop.memories.bea.purchases['signature:'+sibling]?.liked;i++){
    assert.ok(i<12)
    if(p.state.bayShop.visitsToday>=bayShopDailyLimit()){p.night();p.visit('village')}
    if(!p.state.culinary.stock[sibling]){
      p.fruit('apple',2);p.visit('village');p.act('repeatSignature',sibling)
    }
    const shelf=p.state.bayShop.slots[0]
    if(shelf&&shelf.product.id!=='signature:'+sibling){assert.equal(shelf.quantity,0);removeBayShopStock(p.state.bayShop,0);p.reload()}
    p.shelf(sibling);p.sale()
 }
 return {p,...details,sibling}
}
test('a real third liked recipe retains both preserve choices and only asks the player to choose that base',()=>{
 const {p,jam,tart,sibling}=earnThird()
 assert.deepEqual([p.state.day,p.actions],[32,232])
 assert.ok(p.state.bayShop.memories.bea.purchases['signature:'+sibling].liked)
 const before=structuredClone(p.state), quotes=[]
 for(const id of [jam,sibling]){
  const f=restore(before),h=stock(f)
  h.choose(request('set'))
  const pending=tag(h.html())
  assert.deepEqual(selectors(pending),['first']);assert.equal(itemRows(pending),1)
  assert.ok(pending.includes(f.culinary.recipes.find(r=>r.id===tart)!.name))
  assert.deepEqual(buttons(pending),[{key:'',enabled:false}])
  assert.ok(pending.includes('value="'+jam+'"'));assert.ok(pending.includes('value="'+sibling+'"'));assert.doesNotMatch(pending,new RegExp('<option value="'+tart+'"'))
  h.choose(pair('first',id))
  const displayed=tag(h.html());assert.equal(itemRows(displayed),2)
  assert.deepEqual(f,before)
  const key=tryAccept(h),expected=restore(before)
  assert.equal(key,C.getShopAssortment(expected,'bea',id,tart)?.key)
  assert.ok(C.acceptShopCommission(expected,key).ok);assert.deepEqual(f,expected)
  assert.deepEqual(h.journey,['commissionView:set','commissionPair:'+id,'accept'])
  assert.match(h.focuses[1],/\[data-commission-pair="first"\]\[data-customer="bea"\]/)
  assert.equal(h.focuses.at(-1),'.commission-current')
  quotes.push(C.getShopCommission(f)?.total)
 }
 assert.deepEqual(quotes,[114,104])
 const x=restore(before),view=stock(x)
 view.choose(request('set'));view.choose(pair('first',sibling));const token=buttons(view.html())[0].key
 view.choose(request(jam));assert.doesNotMatch(view.html(),/aria-label="Набор для покупателя"/)
 view.choose(request('set'));assert.equal(buttons(view.html())[0].key,token)
 view.choose(pair('first',''));assert.deepEqual(buttons(view.html()),[{key:'',enabled:false}])
 assert.deepEqual(x,before)
 console.log('actual',JSON.stringify({thirdRecipeActions:3,quotes,exclusiveBase:'preserves'}))
})

test('the fixed pricing preview grants no acceptance rights, redraw does not spend, and cancellation stays explicit',()=>{
 const before=structuredClone(earned.p.state),f=restore(before),h=stock(f)
 h.choose(request('set'));const key=buttons(h.html())[0].key
 for(const [panel,open] of [['shop-commissions',false],['bay-shop',true]] as const){
    h.setPanel(panel,open);h.accept(key);assert.deepEqual(f,before)
 }
 h.setPanel('shop-commissions',true)
 assert.ok(F.sail(f,'home').ok)
 const home=structuredClone(f); assert.equal(buttons(h.html())[0].enabled,false); h.accept(key);assert.deepEqual(f,home)
 assert.ok(F.endDay(f).ok);assert.ok(F.sail(f,'village').ok)
 const tomorrow=structuredClone(f); h.accept(key);assert.deepEqual(f,tomorrow)
 assert.notEqual(buttons(h.html())[0].key,key)
 tryAccept(h);const accepted=structuredClone(f),active=C.getShopCommission(f)!
 assert.equal(active.delivered,0);assert.equal(C.finishShopCommission(f,String(active.serial)).ok,false);assert.deepEqual(f,accepted)
 const rendered=h.html();assert.match(rendered,/Отменить и вернуть/)
 assert.ok(C.cancelShopCommission(f,String(active.serial)).ok)
 assert.equal(f.coins,tomorrow.coins);assert.equal(f.workToday,tomorrow.workToday)
 assert.equal(f.shopCommissions.active,null);assert.equal(f.shopCommissions.completed.bea,tomorrow.shopCommissions.completed.bea)
 assert.deepEqual(restore(f),f)
})
