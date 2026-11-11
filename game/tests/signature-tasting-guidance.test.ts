import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createServer} from 'vite'
import {signatureTastingGuide} from '../src/signature-tasting-guidance.ts'
import {endDay,forgetSignature,restoreFarm,sail,tasteSignature} from '../src/farm.ts'
import {neighborTastingsFixture} from './fixtures/neighbor-tastings.ts'

const reload=(farm:ReturnType<typeof neighborTastingsFixture>['farm'])=>restoreFarm(JSON.parse(JSON.stringify(farm)))!

test('ready guidance states the one-portion action without predicting either undiscovered preference',()=>{
  const {farm,recipeId}=neighborTastingsFixture(),before=structuredClone(farm)
  for(let i=0;i<3;i++)for(const resident of ['bea','finn'] as const){
    const guide=signatureTastingGuide(farm,recipeId,resident)!
    assert.equal(guide.available,true);assert.match(guide.label,/Угостить .+ · 1 порция/)
    assert.equal(guide.reason,'');assert.equal(guide.knownFavorite,false);assert.equal(guide.favoriteNote,'')
  }
  assert.deepEqual(farm,before,'rendering does not spend, serve, grant help or change the day')
})

test('an ordinary tasting spends exactly one portion and reload explains its daily lock',()=>{
  const {farm,recipeId}=neighborTastingsFixture(),before=structuredClone(farm)
  assert.equal(tasteSignature(farm,recipeId,'bea').ok,true)
  const expected=structuredClone(before);expected.culinary.stock[recipeId]--
  expected.culinary.tastings.bea={servedOn:farm.day,visits:1,liked:0,lastRecipeId:recipeId,favoriteIds:[],bonus:false}
  assert.deepEqual(farm,expected)
  const loaded=reload(farm);assert.ok(loaded)
  const guide=signatureTastingGuide(loaded,recipeId,'bea')!
  assert.equal(guide.available,false);assert.match(guide.reason,/Сегодня уже пробовала.+следующий игровой день/)
  assert.equal(guide.knownFavorite,false);assert.equal(guide.favoriteNote,'')
  assert.equal(signatureTastingGuide(loaded,recipeId,'finn')!.available,true)
  assert.equal(tasteSignature(loaded,recipeId,'bea').ok,false);assert.deepEqual(loaded,expected)
})

test('a known favorite is shown only after tasting, survives reload and remains known on the next game day',()=>{
  const {farm,recipeId}=neighborTastingsFixture()
  assert.equal(signatureTastingGuide(farm,recipeId,'finn')!.knownFavorite,false)
  assert.equal(tasteSignature(farm,recipeId,'finn').ok,true)
  const loaded=reload(farm),stock=loaded.culinary.stock[recipeId],before=structuredClone(loaded)
  const today=signatureTastingGuide(loaded,recipeId,'finn')!
  assert.equal(today.available,false);assert.equal(today.knownFavorite,true)
  assert.match(today.favoriteNote,/уже понравилось Финну/);assert.match(today.reason,/Сегодня уже пробовал/)
  assert.equal(signatureTastingGuide(loaded,recipeId,'bea')!.favoriteNote,'')
  assert.deepEqual(loaded,before)
  assert.equal(sail(loaded,'home').ok,true);assert.equal(endDay(loaded).ok,true);assert.equal(sail(loaded,'village').ok,true)
  const tomorrow=reload(loaded),guide=signatureTastingGuide(tomorrow,recipeId,'finn')!
  assert.equal(guide.available,true);assert.equal(guide.reason,'');assert.equal(guide.knownFavorite,true)
  assert.equal(tomorrow.culinary.stock[recipeId],stock);assert.equal(tomorrow.culinary.tastings.finn.bonus,true)
  assert.equal(tasteSignature(tomorrow,recipeId,'finn').ok,true);assert.equal(tomorrow.culinary.stock[recipeId],stock-1)
})

test('no portion, missing resident, wrong island and deleted recipe retain safe refusals',()=>{
  for(const blocked of ['portion','resident','island','recipe']){
    const {farm,recipeId}=neighborTastingsFixture()
    if(blocked==='portion')farm.culinary.stock[recipeId]=0
    if(blocked==='resident')farm.village.residents[0]=null
    if(blocked==='island')farm.island='home'
    if(blocked==='recipe'){farm.culinary.stock[recipeId]=0;assert.equal(forgetSignature(farm,recipeId).ok,true)}
    const before=structuredClone(farm),guide=signatureTastingGuide(farm,recipeId,'bea')
    if(blocked==='portion'){assert.equal(guide?.available,false);assert.match(guide!.reason,/Нет готовой порции/)}
    else assert.equal(guide,undefined)
    assert.equal(tasteSignature(farm,recipeId,'bea').ok,false);assert.deepEqual(farm,before);assert.ok(reload(farm))
  }
})

test('an empty served recipe explains the daily lock instead of implying another batch would unlock it',()=>{
  const {farm,recipeId}=neighborTastingsFixture();farm.culinary.stock[recipeId]=1
  assert.equal(tasteSignature(farm,recipeId,'bea').ok,true)
  const guide=signatureTastingGuide(reload(farm),recipeId,'bea')!
  assert.equal(guide.available,false);assert.match(guide.reason,/следующий игровой день/)
  assert.doesNotMatch(guide.reason,/повторите/)
})

test('a full existing tasting journal does not promise an impossible next-day action',()=>{
  const {farm,recipeId}=neighborTastingsFixture();farm.day=1_000_001
  Object.assign(farm.culinary.tastings.bea,{servedOn:1_000_000,visits:1_000_000,lastRecipeId:recipeId})
  const before=structuredClone(farm),guide=signatureTastingGuide(farm,recipeId,'bea')!
  assert.equal(guide.available,false);assert.match(guide.reason,/Журнал угощений заполнен/)
  assert.equal(tasteSignature(farm,recipeId,'bea').ok,false);assert.deepEqual(farm,before)
})

test('the real book exposes cost, reason and learned preference without adding an action or hidden taste',async()=>{
  const server=await createServer({server:{middlewareMode:true},appType:'custom'})
  try{
    const {signatureBook}=await server.ssrLoadModule('/src/culinary-ui.ts')
    const {farm,recipeId}=neighborTastingsFixture(),art={icon:()=>'<img alt="">',stock:()=>'<li>Продукты</li>'}
    const html=signatureBook(farm,art),before=structuredClone(farm)
    assert.match(html,/Каждый сосед пробует одно угощение за игровой день/)
    assert.match(html,/Угостить Беа · 1 порция/);assert.match(html,/Угостить Финна · 1 порция/)
    assert.doesNotMatch(html,/уже понравилось|любимый фрукт|любимая текстура/);assert.deepEqual(farm,before)
    tasteSignature(farm,recipeId,'finn')
    const tasted=signatureBook(reload(farm),art)
    assert.match(tasted,/data-action="taste-signature"[^>]*disabled[^>]*data-resident="finn"[^>]*aria-describedby="tasting-s1-finn"/)
    assert.match(tasted,/Сегодня уже пробовал/);assert.match(tasted,/♥ Это блюдо уже понравилось Финну/)
    farm.island='home';assert.doesNotMatch(signatureBook(farm,art),/data-action="taste-signature"/)
    farm.island='village';farm.village.residents=[null,null]
    assert.doesNotMatch(signatureBook(farm,art),/data-action="taste-signature"|Каждый сосед пробует/)
  }finally{await server.close()}
})
