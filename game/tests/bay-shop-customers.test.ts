import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { advanceBayShop, advanceBayShopDay, createBayShop, stockBayShop, setBayShopOpen, setBayShopPrice, restoreBayShop, bayShopVisitors, type BayShopProduct, type BayShopState } from '../src/bay-shop-model.ts'
import { BayShopCustomerView, renderBayShopCustomers } from '../src/bay-shop-customers.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const pear:BayShopProduct={id:'signature:s1',identity:'pear-silky-a',name:'Грушевое облако',image:'/art/lavender/ui-tart.webp',basePrice:50,tags:['pear','fruit','delicate','silky','sweet'],signature:true}
const run=(state:BayShopState,ms:number)=>{while(ms>0){const step=Math.min(ms,1000);advanceBayShop(state,step);ms-=step}}
function opened(){const s=createBayShop();assert.ok(stockBayShop(s,0,pear,100));setBayShopOpen(s,true);return s}
const card=(s:BayShopState,v:BayShopCustomerView)=>renderBayShopCustomers(s,v).split('<article')[1].split('</article>')[0]

test('all six visual choices expose exactly one active card, without touching state',()=>{
 const s=createBayShop(),v=new BayShopCustomerView(),before=structuredClone(s)
 for(const person of bayShopVisitors){assert.ok(v.choose(person.id));const html=renderBayShopCustomers(s,v);assert.equal((html.match(/data-customer="/g)??[]).length,6);assert.equal((html.match(/aria-pressed="true"/g)??[]).length,1);assert.equal((html.match(/<article/g)??[]).length,1);assert.match(card(s,v),new RegExp(`<h3>${person.name}</h3>`))}
 assert.deepEqual(s,before);assert.equal(v.choose('unknown'),false);assert.equal(v.selected,'mark')
})

test('unvisited customers reveal no hidden likes or unobserved request',()=>{
 const s=createBayShop(),v=new BayShopCustomerView(),html=card(s,v)
 assert.match(html,/Любимые товары ещё неизвестны/);assert.doesNotMatch(html,/Нежное к чаю|груш|шёлк|silky|delicate|pear|Просит/)
 assert.match(html,/Базовый бюджет визита/);assert.match(html,/95 монет/);assert.doesNotMatch(html,/Не цена товара и не оценка качества/)
 assert.doesNotMatch(readFileSync(new URL('../src/bay-shop-customers.ts',import.meta.url),'utf8'),/\.likes|bayShopInterest/)
})

test('real arrival reveals only spoken request and exact actual visit budget, including later cycles',()=>{
 const s=opened(),v=new BayShopCustomerView();run(s,1200)
 assert.equal(s.visitor?.budget,95);assert.match(card(s,v),/Бюджет этого визита/);assert.match(card(s,v),/Нежное к чаю/);assert.doesNotMatch(card(s,v),/Грушевое облако/)
 advanceBayShopDay(s,2);run(s,1200);assert.equal(s.visitor?.id,'bea');assert.equal(s.visitor?.budget,103);assert.match(card(s,v),/103 монеты/)
 advanceBayShopDay(s,3);run(s,1200);assert.equal(s.visitor?.budget,111);assert.match(card(s,v),/111 монет/)
 advanceBayShopDay(s,4);run(s,1200);assert.equal(s.visitor?.budget,95);assert.match(card(s,v),/95 монет/)
 assert.ok(restoreBayShop(JSON.parse(JSON.stringify(s)),s.businessDay))
})

test('only actual liked purchase becomes a remembered taste, exact recipe identities remain separate',()=>{
 const s=opened(),v=new BayShopCustomerView();run(s,7400)
 assert.equal(s.memories.bea.purchases[pear.identity].liked,1);let html=card(s,v);assert.match(html,/Грушевое облако/);assert.match(html,/Понравилось: 1/);assert.match(html,/Куплено: 1/)
 const other={...pear,id:'signature:s2',identity:'pear-silky-b',name:'Другое облако'};assert.ok(stockBayShop(s,1,other,10));html=card(s,v);assert.doesNotMatch(html,/Другое облако|pear-silky-b/)
 v.choose('finn');assert.doesNotMatch(card(s,v),/Грушевое облако|Понравилось/)
})

test('a real neutral purchase never becomes a favourite even after repeat sales',()=>{
 const s=createBayShop(),v=new BayShopCustomerView(),plain={...pear,identity:'plain-a',name:'Простая булочка',tags:['bread']}
 stockBayShop(s,0,plain,30);setBayShopOpen(s,true);run(s,7400);assert.equal(s.memories.bea.purchases[plain.identity].liked,0)
 advanceBayShopDay(s,2);run(s,7400);const html=card(s,v);assert.match(html,/Куплено: 2/);assert.doesNotMatch(html,/Понравилось:/)
})

test('budget is not willingness or a guaranteed price; observed rejected visit creates no favourite',()=>{
 const s=opened(),v=new BayShopCustomerView();setBayShopPrice(s,0,90);run(s,7400)
 assert.equal(s.visitor?.budget,95);assert.equal(s.visitor?.outcome?.kind,'expensive');assert.equal(s.sold,0);assert.match(card(s,v),/Покупок пока нет/)
 assert.doesNotMatch(card(s,v),/Грушевое облако/)
})

test('help hides only explanatory prose; exact aggregate sales and remembered product data remain available',()=>{
 const s=opened(),v=new BayShopCustomerView();run(s,7400);const before=structuredClone(s),closed=renderBayShopCustomers(s,v)
 assert.match(closed,/aria-expanded="false"/);assert.match(closed,/id="bay-shop-customer-explanation" hidden/);assert.match(closed,/Продано: <strong>1/);assert.match(closed,/Выручка: <strong>50 монет/);assert.match(closed,/Помнят вкус: Беа/)
 v.explanation=true;const open=renderBayShopCustomers(s,v)
 assert.equal((open.match(/Не цена товара и не оценка качества/g)??[]).length,1)
 assert.match(open,/id="bay-shop-customer-explanation">[\s\S]*Не цена товара и не оценка качества/)
 assert.doesNotMatch(card(s,v),/Не цена товара и не оценка качества/)
 assert.match(open,/aria-expanded="true"/);assert.doesNotMatch(open,/id="bay-shop-customer-explanation" hidden/);assert.deepEqual(s,before)
})

test('saved player recipe names are escaped, not interpreted as markup',()=>{
 const s=opened(),v=new BayShopCustomerView();run(s,7400);s.reputation[pear.identity].name='Мой <тарт> & «Чай»';const html=renderBayShopCustomers(s,v)
 assert.match(html,/Мой &lt;тарт&gt; &amp; «Чай»/);assert.doesNotMatch(html,/<тарт>/)
})

test('customer actions are local render-only and focus is retained across live refresh',()=>{
 const src=readFileSync(new URL('../src/bay-shop.ts',import.meta.url),'utf8');const a=src.indexOf("if (button.hasAttribute('data-customer'))"),b=src.indexOf("if (button.hasAttribute('data-shop-next'))",a),actions=src.slice(a,b)
 assert.match(actions,/customerView.choose/);assert.match(actions,/customerView.explanation/);assert.doesNotMatch(actions,/changed\(|onChange\(|setBayShop|advanceBayShop|takeStock/)
 assert.match(src,/'data-customer', 'data-customer-help'/);assert.match(src,/phase !== lastPhase[^\n]+tab === 'journal'/)
})

test('a multi-product shop keeps its totals and selected customer in view; the complete global ledger is optional',()=>{
 const s=createBayShop(),v=new BayShopCustomerView()
 assert.doesNotMatch(renderBayShopCustomers(s,v),/data-customer-history/)
 const first={...pear,name:'Грушевое облако'},second={...pear,id:'signature:s2',identity:'berry-cloud',name:'Ягодное облако'}
 assert.ok(stockBayShop(s,0,first,1));setBayShopOpen(s,true);run(s,7400)
 const single=renderBayShopCustomers(s,v)
 assert.doesNotMatch(single,/data-customer-history/);assert.match(single,/Помнят вкус: Беа/)
 assert.ok(stockBayShop(s,1,second,1));advanceBayShopDay(s,2)
 const before=structuredClone(s),closed=renderBayShopCustomers(s,v)
 assert.match(closed,/data-customer-history aria-expanded="false" aria-controls="bay-shop-product-sales">Продажи по товарам · 2/)
 assert.match(closed,/Продано: <strong>2/);assert.match(closed,/Выручка: <strong>100 монет/)
 assert.match(card(s,v),/Грушевое облако/);assert.doesNotMatch(closed,/class="bay-shop-reputation"/)
 v.historyOpen=true
 const open=renderBayShopCustomers(s,v)
 assert.match(open,/data-customer-history aria-expanded="true"/);assert.equal((open.match(/class="bay-shop-reputation"/g)??[]).length,2)
 assert.match(open,/Грушевое облако/);assert.match(open,/Ягодное облако/)
 assert.ok(v.choose('finn'));assert.equal(v.historyOpen,true);assert.equal(v.explanation,false)
 v.historyOpen=false;assert.doesNotMatch(renderBayShopCustomers(s,v),/class="bay-shop-reputation"/)
 assert.deepEqual(s,before)
})

test('first Buyers visit shows the real customer after an earned sale; browsing profiles never follows a later visitor',()=>{
 const commands=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
 const p=commissionPlayer(commands.slice(0,commands.findIndex((a:{name:string})=>a.name==='inviteResident')+1))
 const id=p.cook();p.cook(id);p.shelf(id);p.shelf(id)
 const shop=p.state.bayShop,price=Math.floor(shop.slots[0]!.product.basePrice*.8),coins=p.state.coins
 assert.ok(setBayShopPrice(shop,0,price));setBayShopOpen(shop,true)
 function until(next:'finn'|'mira'){
   for(let n=0;n<120;n++){
     if(shop.visitor?.id===next&&shop.visitor.phase==='browsing')return
     for(const sale of advanceBayShop(shop,250))p.state.coins+=sale.price
   }
   assert.fail('Expected the next ordinary visitor')
 }
 until('finn')
 assert.equal(p.state.day,9);assert.equal(shop.sold,1);assert.equal(p.state.coins,coins+price);assert.equal(shop.visitor?.budget,145)
 const view=new BayShopCustomerView(),before=structuredClone(p.state)
 view.enter(shop.visitor?.id)
 assert.equal(view.selected,'finn');assert.match(card(shop,view),/Бюджет этого визита/);assert.match(card(shop,view),/145 монет/);assert.match(card(shop,view),/Что-нибудь сытное/)
 assert.ok(view.choose('bea'));view.enter(shop.visitor?.id)
 assert.equal(view.selected,'bea');assert.deepEqual(p.state,before,'opening tabs or selecting a profile is not a transaction')
 until('mira')
 view.enter(shop.visitor?.id);assert.equal(view.selected,'bea')
 const fresh=new BayShopCustomerView();fresh.enter(shop.visitor?.id);assert.equal(fresh.selected,'mira','a new scene starts fresh')
 const emptyFirst=new BayShopCustomerView();emptyFirst.enter(undefined);emptyFirst.enter('finn');assert.equal(emptyFirst.selected,'bea')
 const chosenFirst=new BayShopCustomerView();chosenFirst.choose('lina');chosenFirst.enter('finn');assert.equal(chosenFirst.selected,'lina')
})
