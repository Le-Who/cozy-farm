import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { createServer } from 'vite'
import { transferBayGoods } from '../src/harbour-economy.ts'
import { createFarm, completeSignature, getSignatureAction, sellMarketItem } from '../src/farm.ts'

function bookFarm() {
  const farm = createFarm()
  farm.buildingLevels.farmhouse = 2
  farm.fruit.apple = 20; farm.produce.wheat = 10; farm.eggs = 10
  const first = completeSignature(farm, {base:'tart', ingredients:[{id:'apple', quantity:2}]}, {family:'decorate', fruit:[{ingredientId:'apple',x:0,y:0,angle:0}], steps:['fruit']}).recipeId!
  const second = completeSignature(farm, {base:'tart', ingredients:[{id:'apple', quantity:2}]}, {family:'decorate', fruit:[{ingredientId:'apple',x:.2,y:0,angle:0}], steps:['fruit']}).recipeId!
  return {farm, first, second}
}
const art = {icon:()=>'<img alt="">', stock:(item:{kind:string;quantity:number})=>`<li>${item.kind} ×${item.quantity}</li>`}

test('book indexes every recipe but exposes actions for only the explicitly selected recipe without spending', async () => {
  const server = await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'})
  try {
    const {signatureBook} = await server.ssrLoadModule('/src/culinary-ui.ts')
    const {farm,first,second} = bookFarm(), before = structuredClone(farm)
    const html = signatureBook(farm,art,{selectedId:first,mode:'detail'})
    assert.equal((html.match(/data-action="select-recipe"/g)??[]).length,2)
    assert.match(html,new RegExp(`data-action="make-signature" data-value="${first}"`))
    assert.doesNotMatch(html,new RegExp(`data-action="make-signature" data-value="${second}"`))
    assert.deepEqual(farm,before)
  } finally {await server.close()}
})

test('carried portions, warehouse recovery, missing supplies and active picnic stay independent', async () => {
  const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'})
  try {
    const {signatureBook}=await server.ssrLoadModule('/src/culinary-ui.ts')
    const {storedRecipesFixture}=await import('./fixtures/stored-recipes.ts')
    const {farm,recipeId}=storedRecipesFixture(); farm.culinary.stock[recipeId]=0
    const before=structuredClone(farm),html=signatureBook(farm,art,{selectedId:recipeId,mode:'detail'})
    assert.match(html,/<dt>С собой<\/dt><dd>0<\/dd>/)
    assert.match(html,/<dt>На местном складе<\/dt><dd>3<\/dd>/)
    assert.match(html,/data-action="recipe-warehouse-withdraw" data-value="home\|s1\|3"/)
    assert.match(html,/Не хватает 1 яйца/)
    assert.match(html,/data-action="make-signature"[^>]*disabled/)
    assert.match(html,/data-action="use-signature"[^>]*disabled/)
    assert.match(html,/data-action="sell-signature"[^>]*disabled/)
    assert.doesNotMatch(html,/Пикник действует · до сна/)
    assert.deepEqual(farm,before)
    farm.culinary.stock[recipeId]=2;farm.culinary.picnic={day:farm.day,processing:'silky'}
    const active=signatureBook(farm,art,{selectedId:recipeId,mode:'detail'})
    assert.match(active,/data-recipe-disclosure="picnic-status"/)
    assert.match(active,/data-action="use-signature"[^>]*disabled/)
    assert.match(active,/Ручная выпечка в мастерской этот эффект не расходует/)
    assert.match(active,/Эффект действует только сегодня и исчезнет после сна/)
    assert.match(active,/data-action="sell-signature"[^>]* >Продать…/)
  } finally {await server.close()}
})

test('selection survives favorite sorting, rejects stale IDs and falls back safely after deletion', async () => {
  const {RecipeBookNavigation}=await import('../src/recipe-book-view.ts')
  const {farm,first,second}=bookFarm(),nav=new RecipeBookNavigation(),before=structuredClone(farm)
  nav.reconcile(farm);assert.equal(nav.view.mode,'index')
  assert.equal(nav.select(farm,first,true),true)
  nav.view.indexScroll=120;nav.view.detailScroll=64;nav.view.disclosures=['picnic-offer']
  assert.equal(nav.select(farm,'missing'),false);assert.equal(nav.view.selectedId,first)
  assert.deepEqual(farm,before)
  farm.culinary.recipes.find(recipe=>recipe.id===second)!.favorite=true
  nav.reconcile(farm);assert.equal(nav.view.selectedId,first);assert.equal(nav.view.detailScroll,64)
  const snapshot=structuredClone(nav.view)
  nav.select(farm,second);assert.equal(nav.view.detailScroll,0)
  nav.load(snapshot);snapshot.disclosures!.push('other')
  assert.deepEqual(nav.view.disclosures,['picnic-offer'])
  farm.culinary.recipes=farm.culinary.recipes.filter(recipe=>recipe.id!==first)
  nav.reconcile(farm);assert.equal(nav.view.selectedId,second);assert.equal(nav.view.mode,'index');assert.equal(nav.view.focus,undefined)
})

test('hiding the narrow recipe index does not replace its saved offset with the CSSOM zero', async () => {
  const {RecipeBookNavigation}=await import('../src/recipe-book-view.ts')
  const nav=new RecipeBookNavigation()
  nav.view={mode:'index',selectedId:'s4'}
  const root=(visible:boolean,scrollTop:number)=>({
    querySelector:(selector:string)=>selector==='.signature-book'
      ? {dataset:{mode:'detail',selectedRecipe:'s4'}}
      : {scrollTop,getClientRects:()=>visible?[{}]:[]},
  }) as unknown as HTMLElement
  nav.capture(root(true,882))
  nav.capture(root(false,0))
  assert.equal(nav.view.indexScroll,882)
  nav.capture(root(true,0))
  assert.equal(nav.view.indexScroll,0,'a visible pane actually scrolled to the top still records zero')
})

test('the first saved dish can be served from its book page with the ordinary fish actually carried', async () => {
  const server = await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
  try {
    const {signatureBook} = await server.ssrLoadModule('/src/culinary-ui.ts')
    const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
    const p = commissionPlayer(opening)
    assert.match(signatureBook(p.state, art), /Сохранённых рецептов пока нет/)
    const id = p.cook()
    assert.equal(p.state.culinary.recipes.length, 1); assert.equal(p.state.culinary.stock[id], 1)
    const supper = () => {
      const html: string = signatureBook(p.state, art, {selectedId:id, mode:'detail'})
      const section = html.match(/<div class="recipe-book-supper">([\s\S]*?)<\/div>/)?.[1]
      assert.ok(section?.includes(`data-action="supper-signature" data-value="${id}"`))
      return section!
    }
    p.night(); p.visit('village')
    assert.match(supper(), /disabled/, 'no ordinary fish yet')
    p.visit('home'); p.act('catchFish', true); p.visit('village'); p.reload()
    assert.ok(p.state.village.residents.includes('finn')); assert.equal(p.state.fish.seaBass, 0); assert.equal(p.state.fish.perch, 1)
    const before = structuredClone(p.state), offer = supper()
    assert.doesNotMatch(offer, /disabled/); assert.match(offer, /1 порция \+ 1 окунь\./)
    assert.deepEqual(p.state, before, 'viewing the offer does not spend the dish or fish')
    p.act('deliverSignature', id)
    assert.equal(p.state.village.meals, before.village.meals + 1)
    assert.equal(p.state.fish.perch, 0); assert.equal(p.state.culinary.stock[id], 0); assert.equal(p.state.coins, before.coins)
    assert.match(supper(), /disabled/); assert.match(supper(), /уже состоялся/)
  } finally {await server.close()}
})


test('returning after the final warehouse ingredient offers only the selected saved repeat',async()=>{
  const {RecipeBookNavigation}=await import('../src/recipe-book-view.ts')
  const {getLocalWarehouseSupply,withdrawWarehouseSupply}=await import('../src/warehouse-guidance.ts')
  const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
  try {
    const {signatureBook}=await server.ssrLoadModule('/src/culinary-ui.ts')
    const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
    const p=commissionPlayer(opening);p.fruit('apple',4);p.visit('home')
    const id=p.act('completeSignature',{base:'preserves',ingredients:[{id:'apple',quantity:2}]},
      {family:'preserves',processing:'silky',fruit:[],steps:['mix','pour']}).recipeId!
    const apples=p.state.fruit.apple
    assert.ok(apples>=2)
    for(const n of [0,1,2]){
      const farm=structuredClone(p.state),recipe=farm.culinary.recipes[0]
      if(n===1)assert.ok(sellMarketItem(farm,'fruit:apple',apples-1).ok)
      assert.ok(transferBayGoods(farm,'deposit','home','apple',farm.fruit.apple).ok)
      const [item]=getSignatureAction(farm,recipe).items
      if(n)assert.ok(withdrawWarehouseSupply(farm,item,getLocalWarehouseSupply(farm,item)).ok)
      const nav=new RecipeBookNavigation();assert.ok(nav.select(farm,id));const before=structuredClone(farm)
      const html:string=signatureBook(farm,art,nav.view)
      const action=html.match(/<button[^>]*data-action="make-signature"[^>]*>/)?.[0]
      assert.ok(action?.includes(`data-value="${id}"`));const ready=!action.includes('disabled')
      assert.equal(ready,n===2)
      for(const origin of [id,undefined,'s2']){
        const focused:string[]=[]
        const repeat={dataset:{value:id},getClientRects:()=>[{}],focus(){focused.push(id)},scrollIntoView(){focused.push('reveal')}}
        const detail={scrollTop:0,querySelector:(selector:string)=>{assert.match(selector,/make-signature.*not\(:disabled\)/);return ready?repeat:null}}
        const root={querySelector:(s:string)=>s==='.recipe-book-detail'?detail:null,querySelectorAll:()=>[]}
        nav.restore(root as unknown as HTMLElement,true,origin)
        assert.deepEqual(focused,ready&&origin===id?[id,'reveal']:[])
      }
      assert.deepEqual(farm,before);assert.equal(nav.view.selectedId,id)
    }
  }finally{await server.close()}
})

test('a tasted last portion keeps the commissioned recipe repeatable, not archivable, until release', async () => {
  const { getShopCommissionOffers } = await import('../src/shop-commissions.ts')
  const { forgetSignature } = await import('../src/farm.ts')
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
  const p = commissionPlayer(opening), id = p.cook()
  p.shelf(id); p.sale()
  const accept = () => {
    const offer = getShopCommissionOffers(p.state).find(o => o.customer === 'bea' && o.recipeId === id)!
    p.act('acceptShopCommission', offer.key)
    return String(p.state.shopCommissions.serial)
  }
  const first = accept()
  for (let i = 0; i < 2; i++) { p.cook(id); p.act('deliverShopCommission', first) }
  p.act('finishShopCommission', first); p.night()
  p.cook(id); p.cook(id)
  p.fruit('apple', 1); p.fruit('pear', 1); p.visit('village')
  const sibling = p.act('completeSignature', { base: 'preserves', ingredients: [{ id: 'apple', quantity: 1 }, { id: 'pear', quantity: 1 }] },
    { family: 'preserves', processing: 'chunky', fruit: [], steps: ['mix', 'pour'] }).recipeId as string
  p.act('nameSignature', sibling, p.state.culinary.recipes.find(recipe => recipe.id === id)!.name)
  p.fruit('apple', 2); p.fruit('pear', 2); p.visit('village')
  const serial = accept()
  p.act('deliverShopCommission', serial); p.act('tasteSignature', id, 'bea')
  assert.equal(p.state.culinary.stock[id], 0); assert.equal(p.state.culinary.stock[sibling], 1)
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const { signatureBook } = await server.ssrLoadModule('/src/culinary-ui.ts')
    const page = (key: string) => signatureBook(p.state, art, { selectedId: key, mode: 'detail' })
    const archive = (key: string) => new RegExp(`data-action="forget-signature" data-value="${key}"`)
    const before = structuredClone(p.state), html = page(id)
    assert.doesNotMatch(html, archive(id)); assert.match(html, new RegExp(`data-action="make-signature" data-value="${id}"[^>]*>Повторить ×1`))
    assert.doesNotMatch(html, /data-action="make-signature"[^>]*disabled/)
    assert.equal(forgetSignature(p.state, id).ok, false); assert.deepEqual(p.state, before)
    // An identically named non-commissioned recipe can still be archived as soon as its own bag is empty.
    p.act('useSignature', sibling); assert.match(page(sibling), archive(sibling)); assert.doesNotMatch(page(id), archive(id))
    // Cancellation returns the escrow to the bag. Archiving is available only after spending that portion.
    p.act('cancelShopCommission', serial); assert.equal(p.state.culinary.stock[id], 1); assert.doesNotMatch(page(id), archive(id))
    p.visit('home'); p.act('sellSignature', id, 1); assert.match(page(id), archive(id)); p.act('forgetSignature', id)
    assert.ok(p.state.culinary.recipes.some(recipe => recipe.id === sibling))
  } finally { await server.close() }
})

test('a full book explains only new variants once, for both panes; exact repeats still work', async () => {
  const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
  try {
    const {signatureBook}=await server.ssrLoadModule('/src/culinary-ui.ts')
    const {farm,first}=bookFarm()
    assert.doesNotMatch(signatureBook(farm,art), /id="recipe-capacity-note"/)
    farm.fruit.apple=100; farm.produce.wheat=100; farm.eggs=100
    for (let i=1;i<=22;i++) {
      const res=completeSignature(farm,{base:'tart',ingredients:[{id:'apple',quantity:2}]},{family:'decorate',fruit:[{ingredientId:'apple',x:-i/25,y:0,angle:0}],steps:['fruit']})
      assert.ok(res.recipeId)
    }
    assert.equal(farm.culinary.recipes.length,24)
    const before=structuredClone(farm)
    for (const mode of ['index','detail']) {
      const html=signatureBook(farm,art,{mode,selectedId:first})
      assert.equal((html.match(/id="recipe-capacity-note"/g)??[]).length,1)
      assert.equal((html.match(/aria-describedby="recipe-capacity-note"/g)??[]).length,3)
      for (const a of ['new-signature','manual-signature']) assert.match(html,new RegExp('data-action="'+a+'"[^>]*disabled[^>]*aria-describedby="recipe-capacity-note"'))
      for (const a of ['make-signature','batch-signature']) {
        const button=html.match(new RegExp('<button[^>]*data-action="'+a+'"[^>]*>'))?.[0]
        assert.ok(button);assert.doesNotMatch(button,/disabled|aria-describedby/)
      }
      assert.match(html,/Удалить пустой рецепт/)
    }
    assert.deepEqual(farm,before)
  } finally {await server.close()}
})
