import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createFarm,workBed,restoreCurrentFarm} from '../src/farm.ts'
import {seedSavingQuote,saveCropSeeds} from '../src/seed-saving.ts'

test('one harvested ordinary carrot becomes three seeds without planting or changing money and progress',()=>{
  const farm=createFarm();assert.ok(workBed(farm,9,0).ok)
  const before=structuredClone(farm),quote=seedSavingQuote(farm,'carrot')!
  assert.equal(quote.available,true);assert.equal(quote.produce,3);assert.equal(quote.remaining,2)
  assert.equal(quote.seeds,3);assert.equal(quote.total,6);assert.deepEqual(farm,before)
  assert.ok(saveCropSeeds(farm,quote.token).ok)
  const expected=structuredClone(before);expected.produce.carrot=2;expected.seeds.carrot=6;expected.workToday++
  assert.deepEqual(farm,expected)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),expected)
  assert.equal(saveCropSeeds(farm,quote.token).ok,false);assert.deepEqual(farm,expected)
})

test('the existing seed detail can show an honest tradeoff, including pumpkins that cost more than buying', async()=>{
  const {renderSeedSaving}=await import('../src/seed-saving.ts')
  const farm=createFarm();assert.ok(workBed(farm,7,0).ok)
  const before=structuredClone(farm),html=renderSeedSaving(farm,'pumpkin')
  assert.match(html,/Тыква: 1 обычный продукт → 3 семени/)
  assert.match(html,/В припасах: 2 → 1/);assert.match(html,/Семян: 1 → 4/)
  assert.match(html,/Продажа продукта: 9 монет/);assert.match(html,/пакет на рынке: 8 монет/)
  assert.match(html,/data-action="save-crop-seeds"/)
  assert.deepEqual(farm,before)
})

test('all seven crops work without coins and keep rare products, garden plans, selection and beds intact', async()=>{
  const {seedSavingCrops}=await import('../src/seed-saving.ts')
  const {saveGardenPlan,followGardenPlan}=await import('../src/garden-plans.ts')
  const ripe={carrot:9,cabbage:2,beetroot:5,tomato:3,pumpkin:7,wheat:4,leafyGreens:15}
  assert.equal(seedSavingCrops.length,7)
  for(const crop of seedSavingCrops){
    const farm=createFarm();assert.ok(workBed(farm,ripe[crop],0).ok)
    const crops=Array(16).fill('wheat');assert.ok(saveGardenPlan(farm,0,{name:'Мой хлеб',crops},0).ok)
    assert.ok(followGardenPlan(farm,0,1).ok)
    farm.coins=0;farm.variants[crop]={star:2};farm.discoveries[crop]!.star=true
    const before=structuredClone(farm),quote=seedSavingQuote(farm,crop)!
    assert.ok(saveCropSeeds(farm,quote.token).ok)
    const expected=structuredClone(before);expected.produce[crop]--;expected.seeds[crop]+=3;expected.workToday++
    assert.deepEqual(farm,expected,crop)
    assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))),expected,crop)
  }
})

test('rare-only stock, berries, invalid IDs and overflow never partially spend', async()=>{
  const {renderSeedSaving}=await import('../src/seed-saving.ts')
  const farm=createFarm();farm.variants.carrot={rainbow:3}
  const before=structuredClone(farm),quote=seedSavingQuote(farm,'carrot')!
  assert.equal(quote.available,false);assert.equal(saveCropSeeds(farm,quote.token).ok,false);assert.deepEqual(farm,before)
  assert.match(renderSeedSaving(farm,'carrot'),/ disabled/)
  for(const invalid of ['strawberry','blueberry','raspberry','apple','__proto__','',null,{},undefined]){
    assert.equal(seedSavingQuote(farm,invalid),undefined)
    assert.equal(saveCropSeeds(farm,`ss1|${String(invalid)}|1|0|0|0`).ok,false)
    assert.deepEqual(farm,before)
  }
  for(const reason of ['seeds','work']){
    const f=createFarm();assert.ok(workBed(f,9,0).ok)
    if(reason==='seeds')f.seeds.carrot=Number.MAX_SAFE_INTEGER
    else f.workToday=Number.MAX_SAFE_INTEGER
    const snapshot=structuredClone(f),q=seedSavingQuote(f,'carrot')!
    assert.equal(q.room,false);assert.equal(saveCropSeeds(f,q.token).ok,false);assert.deepEqual(f,snapshot)
  }
})

test('changed quantities, day, work, destination and malformed confirmations reject atomically',()=>{
  for(const reason of ['produce','seeds','day','work','island']){
    const farm=createFarm();assert.ok(workBed(farm,9,0).ok)
    const quote=seedSavingQuote(farm,'carrot')!
    if(reason==='produce')farm.produce.carrot++
    if(reason==='seeds')farm.seeds.carrot++
    if(reason==='day')farm.day++
    if(reason==='work')farm.workToday++
    if(reason==='island')farm.island='grove'
    const before=structuredClone(farm)
    assert.equal(saveCropSeeds(farm,quote.token).ok,false,reason);assert.deepEqual(farm,before)
  }
  const farm=createFarm();assert.ok(workBed(farm,9,0).ok)
  const before=structuredClone(farm),quote=seedSavingQuote(farm,'carrot')!
  for(const invalid of [undefined,null,{},'',quote.token+'|extra',quote.token.replace('carrot','cabbage'),'x'.repeat(201)]){
    assert.equal(saveCropSeeds(farm,invalid).ok,false);assert.deepEqual(farm,before)
  }
})

test('the farm sustains four planting cycles for every seed-saving crop using earned harvest and ordinary care', async()=>{
  const {selectSeed,getBedStage,getBedAction,endDay,refillWater,cropDefinitions}=await import('../src/farm.ts')
  const {seedSavingCrops}=await import('../src/seed-saving.ts')
  for(const crop of seedSavingCrops){
    let farm=createFarm()
    const act=(command:()=>{ok:boolean})=>{assert.ok(command().ok,crop);const loaded=restoreCurrentFarm(JSON.parse(JSON.stringify(farm)));assert.ok(loaded,crop);farm=loaded}
    act(()=>selectSeed(farm,crop))
    const startingSeeds=farm.seeds[crop]
    for(let cycle=0;cycle<4;cycle++){
      act(()=>workBed(farm,13,0))
      for(let night=0;getBedStage(farm.beds[13])!=='ripe';night++){
        assert.ok(night<cropDefinitions[crop].days)
        if(getBedAction(farm,13).kind==='water'){
          if(!farm.water)act(()=>refillWater(farm))
          act(()=>workBed(farm,13,0))
        }
        act(()=>endDay(farm))
      }
      act(()=>workBed(farm,13,0))
      const before=structuredClone(farm),q=seedSavingQuote(farm,crop)!
      act(()=>saveCropSeeds(farm,q.token))
      assert.deepEqual(farm.beds,before.beds)
      assert.equal(farm.coins,before.coins);assert.deepEqual(farm.progress,before.progress)
      assert.deepEqual(farm.variants,before.variants)
      assert.equal(farm.selectedSeed,crop)
    }
    assert.equal(farm.seeds[crop],startingSeeds+8,crop)
  }
})

test('fair prices remain honest and entry plus spending own double-click and held-key activation', async()=>{
  const {renderSeedSaving}=await import('../src/seed-saving.ts')
  const {isGuardedAction,ActionClickGuard,ActivationKeyGuard}=await import('../src/action-click-guard.ts')
  const farm=createFarm()
  farm.projects.fair={'dishes:appleJam':1,eggBaskets:1,'produce:carrot':4,'produce:wheat':3}
  assert.equal(seedSavingQuote(farm,'pumpkin')!.saleValue,10)
  assert.match(renderSeedSaving(farm,'pumpkin'),/Продажа продукта: 10 монет; такой же пакет на рынке: 8 монет/)
  for(const action of ['preview-seed','save-crop-seeds'])assert.ok(isGuardedAction(action))
  const mouse=new ActionClickGuard(),click={detail:1,timeStamp:100,clientX:30,clientY:90}
  mouse.remember(click);assert.ok(mouse.blocks({...click,detail:2,timeStamp:200}))
  const key=new ActivationKeyGuard();assert.equal(key.blocks({key:'Enter',repeat:false},true),false)
  assert.equal(key.blocks({key:'Enter',repeat:true},false),true)
})
