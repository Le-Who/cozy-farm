import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { ruPlural } from '../src/ru.ts'
import { MarketInlineSales } from '../src/market-inline-sale.ts'
import { createFarm, restoreFarm, pickFruit, sellMarketItem, completeSignature, repeatSignature, sellSignature } from '../src/farm.ts'
import { ActionClickGuard } from '../src/action-click-guard.ts'
import { exactSaleQuote, saleStock } from '../src/exact-sale.ts'

test('selling precisely 28 of 30 apples survives reload and leaves variants untouched', () => {
  const farm = createFarm()
  farm.fruit.apple = 30; farm.variants.apple = { rainbow: 2 }; farm.progress.sell = 1
  const before = structuredClone(farm)
  assert.deepEqual(exactSaleQuote('28', 30, 4), { valid: true, quantity: 28, total: 112, remaining: 2 })
  assert.ok(sellMarketItem(farm, 'fruit:apple', 28).ok)
  assert.equal(farm.fruit.apple, 2)
  assert.equal(farm.coins - before.coins, 112)
  assert.deepEqual(farm.variants.apple, before.variants.apple)
  assert.equal(farm.workToday, before.workToday + 1)
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(restored); assert.equal(restored.fruit.apple, 2)
  assert.equal(restored.coins, farm.coins)
})

test('exact sales reject fractional, missing, oversized and overflowing quantities atomically', () => {
  const farm = createFarm(); farm.fruit.apple = 30
  for (const quantity of [0, -1, .5, 31, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    const before = structuredClone(farm)
    assert.equal(sellMarketItem(farm, 'fruit:apple', quantity).ok, false)
    assert.deepEqual(farm, before)
  }
  for (const raw of ['', '0', '-1', '2.5', '31', '2e1', 'Infinity', 'NaN']) assert.equal(exactSaleQuote(raw, 30, 4).valid, false)
  for (const mutation of ['coins', 'workToday'] as const) {
    const full = createFarm(); full.fruit.apple = 30; full[mutation] = Number.MAX_SAFE_INTEGER
    const before = structuredClone(full)
    assert.equal(sellMarketItem(full, 'fruit:apple', 28).ok, false)
    assert.deepEqual(full, before)
  }
})

test('market default remains one and special stock can be sold without using ordinary goods', () => {
  const farm = createFarm(); farm.fruit.apple = 30; farm.variants.apple = { rainbow: 4 }
  assert.ok(sellMarketItem(farm, 'fruit:apple').ok)
  assert.equal(farm.fruit.apple, 29)
  assert.ok(sellMarketItem(farm, 'variants:apple:rainbow', 3).ok)
  assert.equal(farm.fruit.apple, 29); assert.equal(farm.variants.apple.rainbow, 1)
})

test('recipe selection sells the exact chosen stock and preserves saved recipe identity', () => {
  const farm = createFarm(); farm.buildingLevels.farmhouse = 2
  farm.fruit.apple = farm.eggs = farm.produce.wheat = 100
  const id = completeSignature(farm, { base: 'tart', ingredients: [{ id: 'apple', quantity: 2 }] }, { family: 'decorate', fruit: [{ ingredientId: 'apple', x: .2, y: -.3, angle: .4 }], steps: ['fruit', 'dust'] }).recipeId!
  repeatSignature(farm, id, undefined, 3)
  const recipe = structuredClone(farm.culinary.recipes[0]), stock = saleStock(farm, { kind: 'signature', key: id })!
  assert.equal(stock.count, 4)
  assert.ok(sellSignature(farm, id, 3).ok)
  assert.equal(farm.culinary.stock[id], 1)
  assert.deepEqual(farm.culinary.recipes[0], recipe)
  assert.equal(restoreFarm(JSON.parse(JSON.stringify(farm)))!.culinary.stock[id], 1)
})

const click = (timeStamp: number, detail = 1, clientX = 20, clientY = 30) => ({ timeStamp, detail, clientX, clientY })
test('click guard stops double-click after replaced DOM and leaked clicks on a different action', () => {
  const guard = new ActionClickGuard()
  assert.equal(guard.blocks(click(100)), false); guard.remember(click(100))
  assert.equal(guard.blocks(click(180, 2)), true)
  assert.equal(guard.blocks(click(200, 1)), true, 'replacement targets may restart click detail')
  assert.equal(guard.blocks(click(250, 1, 23, 32)), true)
  assert.equal(guard.blocks(click(250, 1, 100, 32)), false, 'a distinct location remains usable')
  assert.equal(guard.blocks(click(601, 1)), false, 'an independent later click works')
})

test('keyboard activation is independent and a blocked follow-up does not renew the guard', () => {
  const guard = new ActionClickGuard(); guard.remember(click(100))
  assert.equal(guard.blocks(click(150, 0)), false)
  guard.remember(click(150, 0))
  assert.equal(guard.blocks(click(550, 2)), true)
  assert.equal(guard.blocks(click(610)), false)
})

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const block=(from:string,to:string)=>main.slice(main.indexOf(from),main.indexOf(to,main.indexOf(from)))
const money=block('function quantity(','function row(')
const format={ruPlural,numberFormat:new Intl.NumberFormat('ru-RU')}

test('the unit price retains its decorative coin and exposes the currency in running text',()=>{
  const render=block('function marketInlineCard(','function marketSaleResults(')
  for(const [price,noun] of [[1,'монета'],[2,'монеты'],[5,'монет'],[11,'монет'],[21,'монета']] as const){
    const item={key:'fruit:apple',count:10,price,name:'Яблоко'}
    const html=runInNewContext(stripTypeScriptTypes(money+render+';marketInlineCard(item)'),{...format,item,marketInlineSales:new MarketInlineSales(),
      icon:()=>'<img alt="" aria-hidden="true">',itemIcon:()=>'',escapeHtml:String}) as string
    const line=html.match(/<p class="market-inline-price">([\s\S]*?)<\/p>/)![1]
    assert.match(line,/<img alt="" aria-hidden="true">/)
    const words=(s:string)=>s.replace(/<[^>]+>/g,' ').trim().replace(/\s+/g,' ')
    assert.equal(words(line.replace(/<span aria-hidden="true">[^<]*<\/span>/g,'')),`${price} ${noun} за штуку`)
    assert.equal(words(line.replace(/<span class="sr-only">[^<]*<\/span>/g,'')),`${price} за штуку`)
  }
})

test('the exact confirmation names the batch total; its receipt reports actual proceeds, not unit price',()=>{
  const farm=createFarm();assert.ok(pickFruit(farm,0).ok);const before=structuredClone(farm)
  const selectedSale={kind:'market',key:'fruit:apple',name:'Яблоко'} as const
  const stock=saleStock(farm,selectedSale)!;assert.equal(stock.count,2);assert.equal(stock.price,4)
  const confirm={disabled:false,textContent:'',name:'',setAttribute(k:string,v:string){assert.equal(k,'aria-label');this.name=v}}
  const summary={textContent:''}
  const context={...format,farm,selectedSale,saleQuantity:'2',saleReceipt:undefined,saleStock,exactSaleQuote,sellMarketItem,
    isSaleSurface:()=>true,perform:(op:()=>{ok:boolean})=>op().ok,playBaySound:()=>{},salePresentation:{token:'one'},
    dialogContent:{querySelector:(q:string)=>q==='.exact-sale-summary'?summary:confirm,querySelectorAll:()=>[]},escapeHtml:String,button:()=>'',nav:()=>''}
  const code=money+block('function exactSaleCard(','function isSaleSurface(')+block('function updateSaleQuote()','let disposeCoopServices:')
  runInNewContext(stripTypeScriptTypes(code),context)
  const run=(s:string)=>runInNewContext(s,context)
  run('updateSaleQuote()');assert.equal(confirm.disabled,false);assert.equal(confirm.name,'Продать 2 · 8 монет')
  assert.equal(confirm.textContent,'Продать 2 · 8');assert.deepEqual(farm,before)
  const large=structuredClone(farm);large.fruit.apple=300;context.farm=large;context.saleQuantity='300';run('updateSaleQuote()')
  assert.equal(confirm.textContent,'Продать 300 · 1200');assert.equal(confirm.name,confirm.textContent+' монет');context.farm=farm
  context.saleQuantity='3';run('updateSaleQuote()');assert.ok(confirm.disabled);assert.equal(confirm.name,'Продать выбранное')
  run('confirmExactSale()');assert.deepEqual(farm,before)
  context.saleQuantity='2';run('updateSaleQuote();confirmExactSale()')
  // The first-sale goal can award extra coins. The receipt quotes only the goods.
  const expected=structuredClone(before);assert.ok(sellMarketItem(expected,'fruit:apple',2).ok);assert.deepEqual(farm,expected)
  assert.equal(farm.fruit.apple,0)
  const html=run('exactSaleCard(false)') as string
  assert.match(html,/За 1: 4 монеты/);assert.match(html,/Продано: 2\. Получено: 8 монет\. Осталось: 0\./)
  const once=structuredClone(farm);run('confirmExactSale()');assert.deepEqual(farm,once)
})
