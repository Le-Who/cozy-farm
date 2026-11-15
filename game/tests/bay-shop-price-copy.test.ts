import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {shopRemainderQuote,shopReturnLabel} from '../src/bay-shop-price-copy.ts'
import {createBayShop,stockBayShop,setBayShopPrice,setBayShopOpen,advanceBayShop,removeBayShopStock} from '../src/bay-shop-model.ts'
import {shopQuantityPreview} from '../src/bay-shop-quantity.ts'
const apple={id:'apple',identity:'apple',name:'Яблоко',image:'/art/lavender/ui-apple.webp',basePrice:4,tags:['apple','fruit','sweet'],quantity:5}

test('remaining stock quote names a conditional total, not a purchase or guaranteed payout',()=>{
 assert.equal(shopRemainderQuote(3,4),'Если купят все 3: 12 монет.')
 assert.equal(shopRemainderQuote(3,7),'Если купят все 3: 21 монета.')
 assert.equal(shopRemainderQuote(2,7),'Если купят все 2: 14 монет.')
 assert.equal(shopRemainderQuote(0,7),'На полке ничего не осталось.')
 assert.equal(shopReturnLabel(3),'Вернуть непроданное в припасы: 3')
 assert.equal(shopReturnLabel(0),'Освободить место на прилавке')
 assert.match(shopRemainderQuote(999,10000),/9\D990\D000 монет/)
})

test('pure quote uses the actual preserved shelf price, including a top-up, without stock or revenue mutation',()=>{
 const s=createBayShop();stockBayShop(s,0,apple,2);setBayShopPrice(s,0,7);const before=structuredClone(s)
 const preview=shopQuantityPreview(s,0,apple,3)
 assert.equal(preview.after,5);assert.equal(preview.price,7);assert.equal(shopRemainderQuote(preview.after,preview.price),'Если купят все 5: 35 монет.')
 for(let n=0;n<10;n++)shopRemainderQuote(s.slots[0]!.quantity,s.slots[0]!.price)
 assert.deepEqual(s,before);assert.equal(s.revenue,0)
})

test('a real purchase reduces the quoted remainder and return still excludes already-sold goods',()=>{
 const s=createBayShop();stockBayShop(s,0,apple,3);setBayShopOpen(s,true)
 let paid=0;for(let n=0;n<20&&!s.sold;n++)for(const sale of advanceBayShop(s,500))paid+=sale.price
 assert.equal(s.sold,1);assert.equal(paid,4);assert.equal(shopRemainderQuote(s.slots[0]!.quantity,s.slots[0]!.price),'Если купят все 2: 8 монет.')
 assert.equal(shopReturnLabel(s.slots[0]!.quantity),'Вернуть непроданное в припасы: 2')
 assert.deepEqual(removeBayShopStock(s,0),{id:'apple',quantity:2});assert.equal(s.revenue,4)
})

test('distinct recipes stay separate, old price bounds and fractional rejection remain unchanged',()=>{
 const s=createBayShop(),a={...apple,id:'signature:s1',identity:'signature:s1',signature:true},b={...apple,id:'signature:s2',identity:'signature:s2',signature:true}
 stockBayShop(s,0,a,2);stockBayShop(s,1,b,3);assert.equal(setBayShopPrice(s,0,10000),true);assert.equal(setBayShopPrice(s,1,1),true)
 const before=structuredClone(s);for(const price of[0,10001,1.5,Infinity,NaN])assert.equal(setBayShopPrice(s,0,price),false)
 assert.deepEqual(s,before);assert.equal(s.slots[0]!.product.identity,a.identity);assert.equal(s.slots[1]!.product.identity,b.identity)
 assert.match(shopRemainderQuote(2,s.slots[0]!.price),/20\D000/);assert.equal(shopRemainderQuote(3,s.slots[1]!.price),'Если купят все 3: 3 монеты.')
})

test('mounted view identifies per-piece price and refreshes the quote on both full render and committed manual price',()=>{
 const source=readFileSync(new URL('../src/bay-shop.ts',import.meta.url),'utf8')
 assert.match(source,/За 1 шт\./);assert.match(source,/aria-label="Цена за одну штуку в монетах"/)
 assert.match(source,/data-shelf-quote>\$\{shopRemainderQuote\(slot.quantity,slot.price\)\}/)
 assert.match(source,/quote.textContent = shopRemainderQuote\(slot.quantity,slot.price\)/)
 assert.match(source,/shopRemainderQuote\(preview.after,preview.price\)/)
 assert.match(source,/На полке будет: \$\{preview.after\}/);assert.match(source,/в запасе останется: \$\{preview.remaining\}/)
 assert.match(source,/Оплата только за купленное/)
})
