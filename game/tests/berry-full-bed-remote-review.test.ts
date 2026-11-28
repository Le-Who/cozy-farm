import A from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes as strip} from 'node:module'
import {runInNewContext as vm} from 'node:vm'
import test from 'node:test'
import * as F from '../src/farm.ts'
import * as N from '../src/berry-nursery.ts'
import * as R from '../src/berry-renewal-ui.ts'
import {getShopCommission,getShopCommissionOffers} from '../src/shop-commissions.ts'
import {berryNurseryPlayer} from './fixtures/berry-nursery-player.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const code=read('../src/main.ts')
const start=code.indexOf("    case 'berry-nursery-ingredient':")
const end=code.indexOf("    case 'berry-nursery-source':",start)
A.ok(start>=0&&end>start)
const action=strip("(async()=>{switch('berry-nursery-ingredient'){"+code.slice(start,end)+"}})()")
const item={kind:'variants',item:'blueberry',trait:'dew',quantity:1} as const
function earned(open=false){
 const n=berryNurseryPlayer(JSON.parse(read('./fixtures/home-progress-actions.json'))),p=n.p
 p.act('harvestBerryAndKeep',F.getBerryRenewalPreview(p.state,0)!.token)
 const id=n.cook();n.introduce(id)
 const offer=getShopCommissionOffers(p.state).find(o=>o.customer==='finn'&&o.recipeId===id)!
 A.deepEqual([offer.quantity,offer.total],[2,58]);p.act('acceptShopCommission',offer.key)
 n.grow();p.act('harvestBerryAndKeep',F.getBerryRenewalPreview(p.state,0)!.token)
 n.cook(id);p.act('deliverShopCommission',String(p.state.shopCommissions.serial))
 n.grow();p.fruit('apple',1)
 const spare=p.state.beds.findIndex(b=>b.kind==='tilled')
 for(const [i,bed] of p.state.beds.entries()){
  if(bed.kind==='crop'||open&&i===spare)continue
  if(bed.kind==='empty')p.act('workBed',i)
  const seed=F.cropIds.find(c=>p.state.seeds[c]>0)
  if(!seed)p.act('buySeeds','carrot')
  p.act('selectSeed',seed??'carrot');p.act('workBed',i)
 }
 p.visit('village')
 A.deepEqual([p.state.day,p.state.island,p.state.beds.filter(b=>b.kind==='crop').length,F.ingredientCount(p.state,item),
   getShopCommission(p.state)?.delivered,N.getBerryNurserySource(p.state,item)],
   [23,'village',open?15:16,0,1,0])
 return {n,p,id,spare}
}
function tap(p:ReturnType<typeof earned>['p'], mode?:'disconnect'|'harvest-during-crossing'){
 const calls:string[]=[],focus:string[]=[],renewal=new R.BerryRenewalSelection(),nursery=new N.BerryNurserySelection()
 const ui={...F,...N,...R,get farm(){return p.state},panel:'recipes',dialog:{open:true},value:'0',
  requirementLinks:new Map([['0',{kind:'stock',item}]]),
  control:{focus:()=>focus.push('source')},dialogContent:{scrollTop:43,contains:()=>mode!=='disconnect',
    querySelector:()=>({focus:()=>focus.push('heading')})},
  berryRenewalSelection:renewal,berryNurserySelection:nursery,drawPanel(){},
  openPanel(panel:string){calls.push(panel);ui.panel=panel},
  async visitPanelAt(port:'home',panel:string){
   calls.push(port+':'+panel);p.visit(port);ui.panel=panel
   if(mode==='harvest-during-crossing')p.act('workBed',0)
  }}
 const markup=()=>ui.panel==='berry-renewal'?R.renderBerryRenewal(p.state,renewal,()=>''):N.renderBerryNursery(p.state,nursery,()=>'')
 return {act:()=>vm(action,ui),ui,calls,focus,renewal,nursery,markup}
}

test('an earned full Day23 garden reached from the exact paid recipe reviews gentle harvest directly',async t=>{
 const {p,n,id}=earned(),farm=p.state,before=structuredClone(farm)
 A.deepEqual([p.actions,farm.coins],[150,90])
 const ui=tap(p);await ui.act()
 if(ui.ui.panel==='berry-nursery'){
  A.match(ui.markup(),/Нужна ещё одна свободная вспаханная грядка/)
  A.equal(ui.nursery.selected,undefined)
  t.diagnostic('actual stock arrival points at impossible multiplication; no exact source selected')
 }
 A.deepEqual(p.state,{...before,island:'home'})
 A.deepEqual(ui.calls,['home:berry-renewal'])
 A.deepEqual(ui.focus,['source','heading'])
 A.equal(ui.renewal.selected?.index,0)
 A.match(ui.markup(),/Грядка 1 · Сохранить посадку\?/)
 A.match(ui.markup(),/data-action="berry-renewal-bed"/)
 A.match(ui.markup(),/data-action="berry-renewal-confirm"/)
 const home=earned();home.p.visit('home')
 const local=tap(home.p);await local.act()
 A.deepEqual(local.calls,['berry-renewal'])
 A.deepEqual(local.focus,['source','heading'])
 A.deepEqual(home.p.state,p.state)
 A.equal(ui.markup(),local.markup(),'same existing Home review, no alternative structure, copy or styling')
 const token=ui.renewal.selected!.token
 p.act('harvestBerryAndKeep',token)
 A.deepEqual([F.ingredientCount(p.state,item),p.state.beds[0].kind,p.state.produce.blueberry,p.state.coins],[1,'crop',0,90])
 A.equal(getShopCommission(p.state)?.delivered,1)
 n.cook(id);p.act('deliverShopCommission',String(p.state.shopCommissions.serial))
 A.equal(p.state.coins,90)
 p.act('finishShopCommission',String(p.state.shopCommissions.serial))
 A.deepEqual([p.state.day,p.state.coins,p.state.shopCommissions.completed.finn],[23,148,1])
 n.grow();A.equal(p.state.day,26)
 A.equal(F.getBerryRenewalPreview(p.state,0)?.trait,'dew')
})

test('ordinary open space still divides and stale remote activity never auto-selects a changed plant',async()=>{
 const open=earned(true),state=structuredClone(open.p.state),seam=tap(open.p)
 await seam.act()
 A.deepEqual(seam.calls,['home:berry-nursery'])
 A.equal(seam.nursery.selected?.source,0)
 A.ok(seam.nursery.destination(open.p.state,open.spare))
 A.deepEqual(open.p.state,{...state,island:'home'})
 const gone=earned(),g=tap(gone.p,'harvest-during-crossing')
 await g.act()
 A.deepEqual(g.calls,['home:berry-renewal'])
 A.equal(g.renewal.selected,undefined)
 A.equal(gone.p.state.beds[0].kind,'tilled')
 A.equal(F.ingredientCount(gone.p.state,item),1)
 A.doesNotMatch(g.markup(),/data-action="berry-renewal-confirm"/)
 const bad=earned(),old=structuredClone(bad.p.state),detached=tap(bad.p,'disconnect')
 await detached.act()
 A.deepEqual(detached.calls,[]);A.deepEqual(bad.p.state,old)
})
