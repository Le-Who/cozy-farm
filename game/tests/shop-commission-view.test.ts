import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import * as F from '../src/farm.ts'
import * as C from '../src/shop-commissions.ts'
import {ShopCommissionView} from '../src/shop-commission-view.ts'
import {ShopAssortmentChoice} from '../src/shop-assortment-choice.ts'
import {renderShopCommissions} from '../src/shop-commissions-ui.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'
import {assortmentPlayer} from './fixtures/assortment-player.ts'
const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
const earned=assortmentPlayer(opening),fresh=()=>structuredClone(earned.p.state)
const render=(f:F.FarmState,v=new ShopCommissionView(),pair=new ShopAssortmentChoice())=>renderShopCommissions(f,id=>`<i data-picture="${id}"></i>`,pair,v)

test('one selected exact offer replaces repeated accept cards while all eligible recipes remain selectable',()=>{
 const f=fresh(),v=new ShopCommissionView(),before=structuredClone(f),offers=C.getShopCommissionOffers(f)
 for(const customer of new Set(offers.map(o=>o.customer))){assert.ok(v.choose(f,'customer',customer));for(const o of offers.filter(o=>o.customer===customer)){assert.ok(v.choose(f,'recipe',o.recipeId));const html=render(f,v);assert.equal((html.match(/data-action="commission-accept"/g)??[]).length,1);assert.match(html,new RegExp(`data-value="${o.key}"`));assert.ok(html.includes(`За всю партию: ${o.total}`));for(const p of offers.filter(p=>p.customer===customer))assert.ok(html.includes(p.recipeName))}}
 assert.deepEqual(f,before)
})

test('invalid, unavailable and stale preview choices never alter the farm or create an offer',()=>{
 const f=fresh(),v=new ShopCommissionView(),before=structuredClone(f)
 for(const[part,value]of[['customer','unknown'],['recipe','s999'],['mode','free'],['other','set']])assert.equal(v.choose(f,part,value),false)
 assert.deepEqual(f,before);const selected=v.current(f).offer!;assert.ok(C.acceptShopCommission(f,selected.key).ok);const active=structuredClone(f)
 assert.equal(v.choose(f,'mode','set'),false);assert.equal(v.current(f).offer,undefined);assert.deepEqual(f,active)
})

test('preview separates held bag and harbour warehouse, excludes shelf stock and never implies auto-reservation',()=>{
 const f=fresh(),v=new ShopCommissionView();v.choose(f,'customer','bea');v.choose(f,'recipe',earned.jam)
 f.culinary.stock[earned.jam]=1;f.freight.warehouses.village[`signature:${earned.jam}`]=2
 const before=structuredClone(f),html=render(f,v);assert.match(html,/Припасы: 1 · склад гавани: 2/);assert.match(html,/Не хватает: 1 порция/);assert.match(html,/При принятии припасы не расходуются/);assert.deepEqual(f,before)
 f.culinary.stock[earned.jam]=2;assert.match(render(f,v),/Готовых порций уже хватает/)
})

test('set mode shows both known recipes without extra choices, preserving exact 2+2 offer and read-only preview',()=>{
 const f=fresh(),v=new ShopCommissionView(),pair=new ShopAssortmentChoice(),before=structuredClone(f)
 assert.ok(v.choose(f,'customer','bea'));assert.ok(v.choose(f,'mode','set'))
 assert.doesNotMatch(render(f,v,pair),/data-commission-pair=/)
 assert.ok(pair.choose(f,'bea','first',earned.jam));assert.ok(pair.choose(f,'bea','second',earned.tart))
 const html=render(f,v,pair),offer=C.getShopAssortment(f,'bea',earned.jam,earned.tart)!
 assert.equal((html.match(/data-action="commission-accept"/g)??[]).length,1);assert.ok(html.includes(`data-value="${offer.key}"`));assert.match(html,/За всю партию: 114 монет/);assert.match(html,/Принять набор 2\+2/);assert.deepEqual(f,before)
 assert.ok(v.choose(f,'mode','single'));assert.doesNotMatch(render(f,v,pair),/data-commission-pair=/);assert.ok(v.choose(f,'mode','set'));assert.ok(render(f,v,pair).includes(`data-value="${offer.key}"`))
})

test('unearned set mode stays unavailable and changing customer does not leak another customer recipe',()=>{
 const f=fresh(),v=new ShopCommissionView(),o=C.getShopCommissionOffers(f).find(o=>o.customer!=='bea')!
 assert.ok(o);assert.ok(v.choose(f,'customer',o.customer));assert.equal(v.choose(f,'mode','set'),o.completed>=2)
 const html=render(f,v);if(o.completed<2){assert.doesNotMatch(html,/<option value="set"/);assert.match(html,/Набор 2\+2 после двух заказов/)}
 assert.ok(v.current(f).choices.every(item=>item.customer===o.customer))
})

test('active single and mixed lines retain exact named tokens, partial escrow, recipe access and deferred payment',()=>{
 for(const mixed of[false,true]){const f=fresh(),key=mixed?C.getShopAssortment(f,'bea',earned.jam,earned.tart)!.key:C.getShopCommissionOffers(f).find(o=>o.customer==='bea')!.key;assert.ok(C.acceptShopCommission(f,key).ok);const active=C.getShopCommission(f)!
  const html=render(f);for(const line of active.lines){assert.ok(html.includes(`data-action="commission-deliver" data-value="${line.actionValue}"`));assert.ok(html.includes(`data-action="commission-recipe" data-value="${line.actionValue}"`))}assert.doesNotMatch(html,/data-action="commission-finish"/);assert.match(html,/без срока/);assert.match(html,/Прилавок не расходуется/);assert.match(html,/Отменить и вернуть/)
 }
})

test('complete set puts the one existing final handover first and reports both earned receipt lines',()=>{
 const f=fresh();assert.ok(C.acceptShopCommission(f,C.getShopAssortment(f,'bea',earned.jam,earned.tart)!.key).ok)
 for(const line of C.getShopCommission(f)!.lines){f.culinary.stock[line.recipeId]=2;for(let i=0;i<2;i++)assert.ok(C.deliverShopCommission(f,line.actionValue).ok)}
 const view=C.getShopCommission(f)!,html=render(f);assert.equal((html.match(/data-action="commission-finish"/g)??[]).length,1);assert.ok(html.indexOf('commission-finish')<html.indexOf('commission-lines'));assert.match(html,/Передать · 114 монет/);assert.doesNotMatch(html,/data-action="commission-deliver"/)
 assert.ok(C.finishShopCommission(f,String(view.serial)).ok);const done=render(f);assert.match(done,/Следующий — после отдыха/);assert.match(done,/Выплачено: 114 монет/);for(const line of view.lines)assert.ok(done.includes(line.recipeName));assert.match(done,/data-action="commission-rest"/);assert.ok(done.indexOf('commission-receipt')<done.indexOf('commission-rest'));assert.ok(done.indexOf('Выплачено: 114')<done.indexOf('commission-rest'))
})

test('empty, away and sparse set states keep their existing sources and reject consequential actions',()=>{
 const f=F.createFarm(),empty=render(f);assert.match(empty,/Обычные блюда не открывают/);assert.match(empty,/data-value="recipes"/);assert.match(empty,/data-value="bay-shop"/);assert.doesNotMatch(empty,/data-action="commission-accept"/)
 const away=fresh(),v=new ShopCommissionView();F.sail(away,'home');const html=render(away,v);assert.match(html,/data-action="commission-accept" data-value="[^"]+" disabled/)
 const missing=fresh();missing.bayShop.memories.bea.purchases[`signature:${earned.tart}`].liked=0;v.choose(missing,'customer','bea');v.choose(missing,'mode','set');const sparse=render(missing,v);assert.match(sparse,/конфитюра и тарта/);assert.doesNotMatch(sparse,/data-action="commission-accept"/)
})

test('new main preview change handler is gated, read-only and preserves focus without altering old action handlers',()=>{
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),start=main.indexOf('input.dataset.commissionView &&'),end=main.indexOf('input.dataset.commissionPair',start),preview=main.slice(start,end)
 assert.match(preview,/panel === 'shop-commissions' && dialog.open/);assert.match(preview,/shopCommissionView.choose/);assert.match(preview,/focus\(\{preventScroll:true\}\)/);assert.doesNotMatch(preview,/perform\(|acceptShopCommission\(|deliverShopCommission\(|saveFarm\(/)
})


test('combined request chooser guards sets and returns to exact single recipe without changing pair or farm',()=>{
 const f=fresh(),v=new ShopCommissionView(),pair=new ShopAssortmentChoice(),before=structuredClone(f)
 assert.ok(v.choose(f,'customer','bea'));assert.ok(pair.choose(f,'bea','first',earned.jam));assert.ok(pair.choose(f,'bea','second',earned.tart));const oldPair=structuredClone(pair)
 assert.ok(v.choose(f,'request','set'));assert.equal(v.mode,'set');assert.match(render(f,v,pair),/aria-label="Набор для покупателя"/)
 assert.equal(v.choose(f,'request','s999'),false);assert.equal(v.mode,'set')
 assert.ok(v.choose(f,'request',earned.tart));assert.equal(v.mode,'single');assert.equal(v.current(f).offer!.recipeId,earned.tart);assert.doesNotMatch(render(f,v,pair),/data-commission-pair=/)
 assert.deepEqual(f,before);assert.deepEqual({...pair},{...oldPair})
 const novice=C.getShopCommissionOffers(f).find(o=>o.completed<2)!;assert.ok(v.choose(f,'customer',novice.customer));assert.equal(v.choose(f,'request','set'),false);assert.equal(v.mode,'single');assert.deepEqual(f,before)
})

test('successful view transitions reset old scroll; delivery never resets the panel or activates the next action',()=>{
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 for(const[action,target]of[['accept','commission-current'],['cancel','data-commission-view'],['finish','commission-receipt summary']]){
  const start=main.indexOf(`case 'commission-${action}':`),branch=main.slice(start,main.indexOf('break',start))
  assert.match(branch,/panel==='shop-commissions'&&dialog.open&&perform\(/);assert.match(branch,/dialogContent.scrollTop=0/);assert.ok(branch.includes(target));assert.match(branch,/focus\(\{preventScroll:true\}\)/)
 }
 const start=main.indexOf("case 'commission-deliver':"),branch=main.slice(start,main.indexOf('break',start));assert.doesNotMatch(branch,/scrollTop/);assert.match(branch,/deliverShopCommission\(farm,value\)/)
 assert.match(branch,/keyboardDelivery = event.detail === 0 && document.activeElement === control/)
 assert.doesNotMatch(branch,/\.click\(|openRecipeBook\(|finishShopCommission\(/)
})

test('a sole first order has a focusable buyer, one recipe name and one real decision, not two empty choices',()=>{
 const p=commissionPlayer(opening),id=p.cook();p.shelf(id);p.sale()
 const offers=C.getShopCommissionOffers(p.state);assert.equal(offers.length,1)
 const [offer]=offers,before=structuredClone(p.state),html=render(p.state)
 assert.doesNotMatch(html,/data-commission-view=/)
 assert.match(html,/<header data-commission-customer tabindex="-1">Покупатель: <strong>Беа<\/strong>/)
 assert.equal(html.split(offer.recipeName).length-1,1)
 assert.ok(html.includes(`Нужно ${offer.quantity} порции`));assert.ok(html.includes(`За всю партию: ${offer.total} монеты`))
 assert.match(html,/Набор 2\+2 после двух заказов · 0\/2/);assert.ok(html.includes(`data-action="commission-accept" data-value="${offer.key}"`))
 assert.deepEqual(p.state,before)
 const multiple=render(fresh());assert.match(multiple,/data-commission-view="customer"/);assert.match(multiple,/data-commission-view="request"/)
 // One known recipe can still have another request mode once sets are unlocked.
 const repeat=structuredClone(p.state);repeat.shopCommissions.completed.bea=2
 assert.equal(C.getShopCommissionOffers(repeat).length,1);assert.match(render(repeat),/<option value="set">Набор 2\+2<\/option>/)
})
