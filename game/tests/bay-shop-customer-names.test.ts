import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {commissionPlayer} from './fixtures/commission-player.ts'
import {foodDescriptors,restoreCurrentFarm} from '../src/farm.ts'
import {getShopCommissionOffers} from '../src/shop-commissions.ts'
import {BayShopCustomerView,renderBayShopCustomers} from '../src/bay-shop-customers.ts'
import type {BayShopProduct} from '../src/bay-shop-model.ts'

const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
function earned(){const p=commissionPlayer(opening),id=p.cook();p.shelf(id);p.sale();assert.equal(p.state.bayShop.memories.bea.purchases['signature:'+id].liked,1);return {p,id,key:'signature:'+id}}
function catalog(p:ReturnType<typeof commissionPlayer>,id:string):BayShopProduct[]{const food=foodDescriptors(p.state).find(f=>f.id==='signature:'+id)!;return [{id:String(food.id),identity:String(food.id),name:food.name,image:'/art/lavender/ui-signature-silky.webp',basePrice:food.sellPrice,tags:[],signature:true}]}
const card=(html:string)=>html.split('<article')[1].split('</article>')[0]

test('earned liked recipe rename has the same current name in remembered taste, stock catalog and exact order',()=>{
 const {p,id,key}=earned(),oldName=p.state.bayShop.reputation[key].name
 p.cook(id);p.act('nameSignature',id,'Тёплый вечер')
 const current=catalog(p,id),before=structuredClone(p.state),html=renderBayShopCustomers(p.state.bayShop,new BayShopCustomerView(),current)
 assert.match(card(html),/Тёплый вечер/);assert.ok(!html.includes(oldName));assert.match(card(html),/Куплено: 1 · Понравилось: 1/)
 assert.equal(current[0].name,'Тёплый вечер');assert.equal(getShopCommissionOffers(p.state).find(o=>o.customer==='bea')!.recipeName,'Тёплый вечер')
 assert.equal(getShopCommissionOffers(p.state).find(o=>o.customer==='bea')!.recipeId,id)
 assert.equal(p.state.bayShop.reputation[key].name,oldName,'read-time presentation never rewrites sale history')
 assert.deepEqual(p.state,before);assert.deepEqual(restoreCurrentFarm(structuredClone(p.state)),p.state)
})

test('absent or archived recipe catalog safely retains the historical observed name',()=>{
 const {p,id,key}=earned(),oldName=p.state.bayShop.reputation[key].name
 p.act('nameSignature',id,'Имя после продажи');p.act('forgetSignature',id)
 assert.equal(foodDescriptors(p.state).some(f=>f.id===key),false)
 const before=structuredClone(p.state),html=renderBayShopCustomers(p.state.bayShop,new BayShopCustomerView(),[])
 assert.ok(card(html).includes(oldName));assert.doesNotMatch(html,/Имя после продажи/);assert.deepEqual(p.state,before)
})

test('only the exact observed signature identity can resolve a name; unseen tastes remain hidden',()=>{
 const {p,id,key}=earned(),view=new BayShopCustomerView(),oldName=p.state.bayShop.reputation[key].name,base=catalog(p,id)[0]
 const impostors=[{...base,id:'signature:s999',identity:'signature:s999',name:'Чужое имя'},{...base,identity:'different-result',name:'Чужое имя'}]
 const before=structuredClone(p.state),html=renderBayShopCustomers(p.state.bayShop,view,impostors)
 assert.ok(card(html).includes(oldName));assert.doesNotMatch(html,/Чужое имя/)
 view.choose('finn');assert.doesNotMatch(card(renderBayShopCustomers(p.state.bayShop,view,[base])),new RegExp(oldName));assert.match(card(renderBayShopCustomers(p.state.bayShop,view,[base])),/Любимые товары ещё неизвестны/)
 assert.deepEqual(p.state,before)
})

test('current player name remains escaped and the actual shop renderer supplies its existing catalog',()=>{
 const {p,id}=earned(),current=catalog(p,id);current[0].name='Мой <тарт> & чай'
 const html=renderBayShopCustomers(p.state.bayShop,new BayShopCustomerView(),current)
 assert.match(html,/Мой &lt;тарт&gt; &amp; чай/);assert.doesNotMatch(html,/<тарт>/)
 const src=readFileSync(new URL('../src/bay-shop.ts',import.meta.url),'utf8')
 assert.match(src,/renderBayShopCustomers\(state, customerView, options\.catalog\)/)
})
