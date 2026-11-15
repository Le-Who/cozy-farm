import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createFarm,getBerryRenewalPreview,harvestBerryAndKeep,getBerryPropagation,restoreCurrentFarm} from '../src/farm.ts'
import {BerryRenewalSelection,renderBerryRenewal} from '../src/berry-renewal-ui.ts'
import {BerryNurserySelection,renderBerryNursery} from '../src/berry-nursery.ts'
const icon=()=>''
function ready(){const f=createFarm();f.beds[0]={kind:'crop',crop:'blueberry',growth:3,watered:false,trait:'dew'};f.beds[2]={kind:'tilled'};return f}
const enabled=(html:string,action:string)=>[...html.matchAll(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`,'g'))].filter(x=>!x[0].includes(' disabled')).length

test('the existing entry, panel title and map use the same plain-language name',()=>{
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 assert.match(main,/'berry-nursery':'Размножить ягодный куст'/)
 assert.match(main,/tile\('Размножить ягодный куст','ui-seed-blueberry','berry-nursery'\)/)
 assert.match(main,/button\('Размножить ягодный куст','open-panel',true,\{value:'berry-nursery'/)
 assert.doesNotMatch(main,/Ягодный питомник/)
 assert.match(renderBerryRenewal(createFarm(),new BerryRenewalSelection(),icon),/>Размножить ягодный куст<\/button>/)
})

test('first screens explain different outcomes and report only currently legal selectable plants',()=>{
 for(const stage of ['initial','young','ready','no-space'] as const){
  const f=stage==='initial'?createFarm():ready()
  if(stage==='young'&&f.beds[0].kind==='crop')f.beds[0].growth=0
  if(stage==='no-space')f.beds=f.beds.map(b=>b.kind==='tilled'?{kind:'empty'}:b)
  const before=structuredClone(f),r=renderBerryRenewal(f,new BerryRenewalSelection(),icon),n=renderBerryNursery(f,new BerryNurserySelection(),icon)
  assert.match(r,/Меньше ягод сейчас, тот же куст на той же грядке/)
  assert.match(n,/Без сбора ягод: один куст → две молодые посадки/)
  assert.match(n,/на прежней и выбранной свободной грядках/)
  assert.match(r,new RegExp(`Выберите зрелый куст · доступно ${enabled(r,'berry-renewal-source')}`))
  assert.match(n,new RegExp(`Выберите зрелый куст · доступно ${enabled(n,'berry-nursery-source')}`))
  assert.equal(enabled(r,'berry-renewal-source'),['ready','no-space'].includes(stage)?1:0)
  assert.equal(enabled(n,'berry-nursery-source'),stage==='ready'?1:0)
  assert.doesNotMatch(r,/data-action="berry-renewal-confirm"/);assert.doesNotMatch(n,/data-action="berry-nursery-confirm"/)
  if(stage==='young')assert.match(r,/Ягоды ещё растут/)
  if(stage==='no-space')assert.match(n,/Нужна ещё одна свободная вспаханная грядка/)
  assert.deepEqual(f,before)
 }
})

test('exact rare and picnic yields remain in separate protected reviews; neither preview consumes anything',()=>{
 const f=ready();f.culinary.picnic={day:f.day,processing:'chunky'}
 const before=structuredClone(f),r=new BerryRenewalSelection(),n=new BerryNurserySelection()
 assert.ok(r.choose(f,0));assert.ok(n.choose(f,0));assert.ok(n.destination(f,2))
 const rh=renderBerryRenewal(f,r,icon),nh=renderBerryNursery(f,n,icon)
 assert.match(rh,/Бережный сбор: Черника ×1 \(обычные\) \+ Росистая черника ×1/)
 assert.match(rh,/Обычный сбор на поле: Черника ×3 \(обычные\) \+ Росистая черника ×1/)
 assert.match(rh,/Бережно собрать ×2/);assert.match(rh,/Этот бонус расходуется один раз/)
 assert.match(nh,/Готовый урожай сейчас не получите/);assert.match(nh,/Возраст обеих посадок начнётся с нуля/)
 assert.match(nh,/Грядка 1 → две молодые посадки на грядках 1 и 3/)
 assert.match(nh,/одна росистая черника и 2 обычные ягоды/)
 assert.deepEqual(f,before)
 const renew=structuredClone(f),split=structuredClone(f)
 assert.ok(harvestBerryAndKeep(renew,getBerryRenewalPreview(renew,0)!.token).ok)
 assert.equal(renew.produce.blueberry,f.produce.blueberry+1);assert.equal(renew.variants.blueberry?.dew,1)
 assert.deepEqual(renew.beds[2],f.beds[2]);assert.equal(renew.culinary.picnic,null)
 assert.ok(n.divide(split).ok);assert.deepEqual(split.produce,f.produce);assert.deepEqual(split.variants,f.variants)
 assert.deepEqual(split.culinary.picnic,f.culinary.picnic);assert.deepEqual(split.beds[0],split.beds[2])
 for(const after of [renew,split]){assert.deepEqual(after.seeds,f.seeds);assert.equal(after.day,f.day);assert.deepEqual(restoreCurrentFarm(after),after)}
 assert.equal(getBerryPropagation(split,0,2).available,false)
})
