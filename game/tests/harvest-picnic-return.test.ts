import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createServer } from './fixtures/ssr-vite.ts'
import ts from 'typescript'
import { activeHarvestPicnic, harvestPicnicBed, harvestPicnicOffer, renderHarvestPicnicRoute } from '../src/harvest-picnic.ts'
import { renderPicnicStatus } from '../src/picnic-guidance.ts'
import { getBedHarvestPreview, workBed, useSignature, endDay, restoreCurrentFarm, sail, type FarmState } from '../src/farm.ts'
import { harvestPicnicPlayer } from './fixtures/harvest-picnic-player.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'

const {p,picnicRecipe:id,deferred}=harvestPicnicPlayer(),ready=structuredClone(p.state)
const reload=(farm:FarmState)=>restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const a=main.indexOf("case 'picnic-field':"), b=main.indexOf("case 'focus-bed':",a)
assert.ok(a>=0&&b>a)
const handler=ts.transpileModule('(async()=>{switch(action){'+main.slice(a,b)+'}})()', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText

test('saved spare jar after a real paid customer: save it on a bare field, then collect the same hand-tended carrot for four not three',()=>{
  const bare=reload(deferred),snapshot=structuredClone(bare)
  assert.equal(bare.shopCommissions.completed.bea,1);assert.equal(bare.culinary.stock[id],1)
  assert.equal(harvestPicnicBed(bare),undefined);assert.match(harvestPicnicOffer(bare),/Оставьте порцию до урожая/);assert.deepEqual(bare,snapshot)
  // Counterfactual on the same earned farm: before the patch it was already legal
  // to spend the only portion, but sleep removes it before an empty field can pay.
  assert.ok(useSignature(bare,id).ok);assert.ok(endDay(bare).ok);assert.equal(bare.culinary.stock[id]??0,0);assert.equal(bare.culinary.picnic,null)
  const plain=reload(ready),used=reload(ready),bed=harvestPicnicBed(used)!
  assert.equal(used.culinary.stock[id],1);assert.match(harvestPicnicOffer(used),/Морковь: сейчас ×3, с пикником ×4/)
  assert.equal(bed.normal,3);assert.equal(bed.total,4)
  assert.ok(useSignature(used,id).ok);assert.equal(activeHarvestPicnic(used)?.index,bed.index)
  const pre=used.produce.carrot,coins=used.coins,day=used.day,escrow=structuredClone(used.shopCommissions)
  assert.ok(workBed(plain,bed.index).ok);assert.ok(workBed(used,bed.index).ok)
  assert.equal(plain.produce.carrot-pre,3);assert.equal(used.produce.carrot-pre,4)
  assert.equal(used.culinary.picnic,null);assert.equal(renderHarvestPicnicRoute(used),'')
  assert.deepEqual(used.shopCommissions,escrow);assert.equal(used.coins,coins);assert.equal(used.day,day)
  assert.deepEqual(reload(used),used)
})

test('the actual recipe-book/rest markup shows the decision before spending; no bonus or crop mutates by viewing',async()=>{
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'})
  try{
    const {signatureBook}=await server.ssrLoadModule('/src/culinary-ui.ts')
    const book=(farm:FarmState)=>signatureBook(farm,{icon:()=>'',stock:()=>''},{mode:'detail',selectedId:id})
    const farm=reload(ready),bare=book(deferred)
    assert.match(bare,/Оставьте порцию до урожая/);assert.ok(bare.indexOf('Оставьте порцию до урожая')<bare.indexOf('data-recipe-disclosure="picnic-offer"'))
    assert.doesNotMatch(bare,/data-action="picnic-field"/)
    assert.match(book(farm),/сейчас ×3, с пикником ×4/);assert.equal(useSignature(farm,id).ok,true)
    const active=structuredClone(farm)
    for(const html of [book(farm),renderPicnicStatus(farm,true)]){
      assert.equal(html.split('data-action="picnic-field"').length,2)
      assert.match(html,/Показать грядку №1 · Морковь ×4/);assert.doesNotMatch(html,/Собрать автоматически/)
    }
    assert.deepEqual(farm,active)
    const trait=structuredClone(farm);if(trait.beds[0].kind==='crop')trait.beds[0].trait='rainbow'
    assert.equal(activeHarvestPicnic(trait)?.total,getBedHarvestPreview(trait,0)?.total)
    assert.notEqual(activeHarvestPicnic(trait)?.token,activeHarvestPicnic(farm)?.token)
    for(const processing of ['silky','bright'] as const){const other=structuredClone(farm);other.culinary.picnic!.processing=processing;assert.equal(renderHarvestPicnicRoute(other),'')}
  }finally{await server.close()}
})

test('the production click handler marks the shown bed only: home inspection is free; sailing requires the explicit away action and cannot harvest',async()=>{
  async function click(farm:FarmState,value:string,panel='recipes',afterSail?:()=>void){
    const events:string[]=[],state={value,panel,action:'picnic-field',farm,activeHarvestPicnic,dialog:{open:true},closeDialog:()=>events.push('close'),
      island:{isCrossing:()=>false,crossIsland:async(fn:()=>boolean)=>{events.push('cross');fn();afterSail?.()},focusTarget:(t:{kind:string;index:number})=>events.push(t.kind+':'+t.index)},
      sail,perform:(fn:()=>{ok:boolean})=>fn().ok}
    await runInNewContext(handler,state);return events
  }
  assert.ok(isGuardedAction('picnic-field'))
  const home=reload(ready);useSignature(home,id);const key=activeHarvestPicnic(home)!.token,before=structuredClone(home)
  assert.deepEqual(await click(home,'old'),[]);assert.deepEqual(await click(home,key,'guide'),[])
  assert.deepEqual(await click(home,key,'rest'),['close','bed:0']);assert.deepEqual(home,before)
  const away=reload(home);assert.ok(sail(away,'village').ok);assert.match(renderHarvestPicnicRoute(away),/Плыть домой · грядка №1/)
  const expected=structuredClone(away);assert.ok(sail(expected,'home').ok)
  assert.deepEqual(await click(away,key),['close','cross','bed:0']);assert.deepEqual(away,expected)
  const changed=reload(before);sail(changed,'village')
  assert.deepEqual(await click(changed,key,'recipes',()=>{changed.culinary.picnic=null}),['close','cross'])
  assert.deepEqual(changed.beds,home.beds)
})
