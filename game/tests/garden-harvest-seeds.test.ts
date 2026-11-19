import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { createFarm, workBed, restoreCurrentFarm, type FarmState } from '../src/farm.ts'
import { saveGardenPlan, followGardenPlan } from '../src/garden-plans.ts'
import { buyGardenSeeds, gardenSeedQuote } from '../src/garden-seed-basket.ts'
import { gardenHarvestSeeds, saveGardenSeedPacket } from '../src/garden-harvest-seeds.ts'
import { renderGardenSeedBasket } from '../src/garden-plans-ui.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'

const persisted=(f:FarmState)=>restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!
function autumnPlan(){
  let f=createFarm()
  const step=(r:{ok:boolean})=>{assert.ok(r.ok);f=persisted(f)}
  step(workBed(f,7));step(workBed(f,9)) // actual ripe pumpkins + carrots
  const crops=Array(16).fill(null);crops[0]=crops[7]='pumpkin';crops[8]='blueberry';crops[9]=crops[13]='beetroot'
  step(saveGardenPlan(f,0,{name:'Осенняя грядка',crops},f.gardenPlans.revision))
  step(followGardenPlan(f,0,f.gardenPlans.revision));return f
}

test('an ordinary farmer with 18 coins uses one freshly harvested pumpkin to unblock a 20-coin planting list, then sows manually',()=>{
  let f=autumnPlan();const blocked=gardenSeedQuote(f,0,'open')!,before=structuredClone(f)
  assert.equal(f.coins,18);assert.equal(f.produce.pumpkin,2);assert.equal(f.seeds.pumpkin,1)
  assert.equal(blocked.total,20);assert.equal(buyGardenSeeds(f,blocked.token).ok,false)
  const opts=gardenHarvestSeeds(f,0,'open');assert.equal(opts.length,1);assert.equal(opts[0].name,'Тыква')
  const html=renderGardenSeedBasket(f,0,'open')
  assert.match(html,/Купить список за 20 монет/);assert.match(html,/data-action="garden-buy-seeds"[^>]* disabled/)
  assert.match(html,/тыква ×1 → 3 семени/);assert.match(html,/Останется обычного урожая: 1/);assert.match(html,/Затем к покупке: 12 монет/)
  assert.deepEqual(f,before)
  assert.ok(saveGardenSeedPacket(f,0,'open',opts[0].token).ok);f=persisted(f)
  assert.equal(f.coins,18);assert.equal(f.produce.pumpkin,1);assert.equal(f.seeds.pumpkin,4)
  assert.deepEqual(f.gardenPlans,before.gardenPlans);assert.deepEqual(f.beds,before.beds)
  assert.deepEqual(f.variants,before.variants);assert.equal(f.selectedSeed,before.selectedSeed)
  assert.equal(f.workToday,before.workToday+1);assert.equal(saveGardenSeedPacket(f,0,'open',opts[0].token).ok,false)
  assert.equal(buyGardenSeeds(f,blocked.token).ok,false)
  const payable=gardenSeedQuote(f,0,'open')!
  assert.equal(payable.total,12);assert.equal(payable.affordable,true);assert.equal(payable.packs,2)
  assert.doesNotMatch(renderGardenSeedBasket(f,0,'open'),/garden-save-seeds/)
  assert.ok(buyGardenSeeds(f,payable.token).ok);f=persisted(f)
  assert.equal(f.coins,6);assert.equal(f.gardenPlans.active,0);assert.deepEqual(f.beds,before.beds)
  assert.ok(workBed(f,7).ok);assert.equal(f.seeds.pumpkin,3);assert.equal(f.beds[7].kind==='crop'&&f.beds[7].crop,'pumpkin')
  assert.deepEqual(persisted(f),f)
})

test('ordinary/rare stocks and scope are not interchangeable, and changed plans, stock, or wallet never spend an old proposal',()=>{
  const f=autumnPlan(),token=gardenHarvestSeeds(f,0,'open')[0].token
  for(const edit of [(s:FarmState)=>{s.coins--},(s:FarmState)=>{s.seeds.pumpkin++},(s:FarmState)=>{s.gardenPlans.revision++},
    (s:FarmState)=>{s.produce.pumpkin--;s.variants.pumpkin={rainbow:1}},(s:FarmState)=>{s.island='grove' as const}]){
    const s=structuredClone(f);edit(s);const before=structuredClone(s)
    assert.equal(saveGardenSeedPacket(s,0,'open',token).ok,false);assert.deepEqual(s,before)
  }
  assert.equal(saveGardenSeedPacket(f,0,'all',token).ok,false);assert.equal(saveGardenSeedPacket(f,1,'open',token).ok,false)
  const rare=structuredClone(f);rare.produce.pumpkin=0;rare.variants.pumpkin={rainbow:2}
  assert.deepEqual(gardenHarvestSeeds(rare,0,'open'),[])
  const affordable=structuredClone(f);affordable.coins=20;assert.deepEqual(gardenHarvestSeeds(affordable,0,'open'),[])
})

test('keyboard exchange focuses updated read-only balance, never a newly executable money action',()=>{
  const f=autumnPlan(),value=gardenHarvestSeeds(f,0,'open')[0].token
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),a=main.indexOf("case 'garden-save-seeds':"),b=main.indexOf("case 'garden-shop':",a)
  assert.ok(a>=0&&b>a);const code=ts.transpileModule('switch(action){'+main.slice(a,b)+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const calls:string[]=[]
  const ctx={action:'garden-save-seeds',panel:'garden-plans',event:{detail:0},value,dialog:{open:true},gardenEditor:{slot:0,shopping:'open',draft:null},farm:f,saveGardenSeedPacket,
    perform:(fn:()=>{ok:boolean})=>fn().ok,drawPanel:()=>calls.push('refresh'),dialogContent:{querySelector:(s:string)=>({focus:()=>calls.push(s)})}}
  ctx.panel='inventory';runInNewContext(code,ctx);assert.deepEqual(calls,[]);assert.equal(f.produce.pumpkin,2)
  ctx.panel='garden-plans';runInNewContext(code,ctx);assert.deepEqual(calls,['[data-garden-basket-total]']);assert.equal(f.coins,18)
  assert.match(renderGardenSeedBasket(f,0,'open'),/data-garden-basket-total tabindex="-1"/);assert.ok(isGuardedAction('garden-save-seeds'))
})
