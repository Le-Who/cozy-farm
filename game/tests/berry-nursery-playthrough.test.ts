import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { berryNurseryPlayer } from './fixtures/berry-nursery-player.ts'
import { getShopCommissionOffers, getShopCommission } from '../src/shop-commissions.ts'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { BerryNurserySelection, renderBerryNursery, getBerryNurserySource } from '../src/berry-nursery.ts'
import { cropIds, getBerryPropagation, getBerryRenewalPreview, harvestBerryAndKeep, type CropBed } from '../src/farm.ts'
const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))

test('an earned weather berry line supplies an authored recipe and repeated orders without injecting resources', () => {
  const n = berryNurseryPlayer(opening), p = n.p
  assert.equal(p.state.day, 17); assert.equal(p.state.coins, 61)
  // Invest the only ripe harvest in two seedlings, then choose further expansion to four beds.
  n.divide(0, 2); n.grow(); n.divide(0, 3); n.divide(2, 4); n.grow()
  assert.equal(p.state.day, 23)
  for (const i of [0, 2, 3]) p.act('workBed', i)
  assert.equal(p.state.variants.blueberry?.dew, 3)
  assert.equal((p.state.beds[4] as CropBed).trait, 'dew')
  const id = n.cook(); n.introduce(id)
  const first = getShopCommissionOffers(p.state).find(o => o.customer === 'finn')!
  p.act('acceptShopCommission', first.key)
  for (let i = 0; i < 2; i++) { n.cook(id); p.act('deliverShopCommission', String(p.state.shopCommissions.serial)) }
  const firstPayment = getShopCommission(p.state)!.total
  p.act('finishShopCommission', String(p.state.shopCommissions.serial))
  assert.equal(p.state.variants.blueberry?.dew ?? 0, 0)
  assert.equal(p.state.shopCommissions.completed.finn, 1)
  // Keep the mother planting rather than waiting for a new random weather exposure.
  n.divide(4, 0); n.grow(); n.divide(4, 2); n.divide(0, 3); n.grow()
  for (const i of [0, 2, 3]) p.act('workBed', i)
  p.visit('village'); const next = getShopCommissionOffers(p.state).find(o => o.customer === 'finn')!
  assert.equal(next.quantity, 3); p.act('acceptShopCommission', next.key)
  for (let i = 0; i < 3; i++) { n.cook(id); p.act('deliverShopCommission', String(p.state.shopCommissions.serial)) }
  const secondPayment = getShopCommission(p.state)!.total
  p.act('finishShopCommission', String(p.state.shopCommissions.serial))
  assert.equal(p.state.shopCommissions.completed.finn, 2)
  assert.equal((p.state.beds[4] as CropBed).trait, 'dew')
  assert.equal(p.state.culinary.recipes.length, 1)
  assert.equal(p.state.bayShop.sold, 1)
  assert.equal(p.state.variants.blueberry?.dew ?? 0, 0)
  assert.deepEqual([firstPayment, secondPayment], [58, 87])
  p.reload()
})

test('rare-berry shortcut offers the full-garden alternatives unless a second home bed is available on arrival',async()=>{
  const {p}=berryNurseryPlayer(opening)
  // Plant the available tilled beds through ordinary actions. Leave the untilled bed distinct.
  for(const [i,bed] of p.state.beds.entries())if(bed.kind==='tilled'){
    p.act('selectSeed',cropIds.find(id=>p.state.seeds[id]>0)!);p.act('workBed',i)
  }
  const empty=p.state.beds.findIndex(b=>b.kind==='empty')
  assert.ok(empty>=0);assert.ok(!p.state.beds.some(b=>b.kind==='tilled'))
  const request={kind:'variants',item:'blueberry',trait:'dew',quantity:1} as const
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const from=main.indexOf("    case 'berry-nursery-ingredient':")
  const handler=stripTypeScriptTypes("(async()=>{switch('berry-nursery-ingredient'){"+main.slice(from,main.indexOf("    case 'berry-nursery-source':",from))+"}})()")
  for(const makeRoom of [false,true]){
    p.visit('village');assert.equal(getBerryNurserySource(p.state,request),0,'discovery link remains available')
    const selection=new BerryNurserySelection(), calls:string[]=[]
    let arrived:typeof p.state|undefined
    const ctx={get farm(){return p.state},getBerryNurserySource,getBerryPropagation,value:'0',
      requirementLinks:new Map([['0',{kind:'stock',item:request}]]),panel:'recipes',dialog:{open:true},
      berryNurserySelection:selection,drawPanel:()=>{},dialogContent:{scrollTop:0,querySelector:()=>({focus:()=>calls.push('focus')})},
      async visitPanelAt(port:'home',panel:string){
        assert.equal(port,'home');assert.equal(panel,'berry-nursery');calls.push('arrive');p.visit(port)
        if(makeRoom)p.act('workBed',empty)
        ctx.panel=panel;arrived=structuredClone(p.state)
      }}
    await runInNewContext(handler,ctx)
    assert.deepEqual(p.state,arrived);assert.equal(ctx.panel,'berry-nursery')
    const html=renderBerryNursery(p.state,selection,()=>'<img alt="">')
    if(!makeRoom){
      assert.equal(selection.selected,undefined);assert.deepEqual(calls,['arrive'])
      assert.match(html,/Нужна ещё одна свободная вспаханная грядка/)
      assert.match(html,/data-value="berry-renewal"[^>]*>Собрать ягоды и сохранить посадку/)
      const alternate=structuredClone(p.state),gentle=getBerryRenewalPreview(alternate,0)!
      assert.ok(harvestBerryAndKeep(alternate,gentle.token).ok)
      assert.equal(alternate.variants.blueberry?.dew,(p.state.variants.blueberry?.dew??0)+1)
      assert.equal((alternate.beds[0] as CropBed).trait,'dew');assert.equal((alternate.beds[0] as CropBed).growth,0)
    }else{
      assert.equal(selection.selected?.source,0);assert.deepEqual(calls,['arrive','focus'])
      assert.match(html,/2\. Выберите вторую грядку · свободно 1/)
      assert.ok(selection.destination(p.state,empty));assert.deepEqual(p.state,arrived)
    }
  }
})
