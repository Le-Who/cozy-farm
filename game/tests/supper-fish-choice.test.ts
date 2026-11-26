import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes as strip} from 'node:module'
import {test} from 'node:test'
import {runInNewContext as vm} from 'node:vm'
import * as F from '../src/farm.ts'
import * as S from '../src/shared-supper.ts'
import {isGuardedAction, ActivationKeyGuard} from '../src/action-click-guard.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
const main=read('../src/main.ts')
const actual=(from:string,to:string)=>{const i=main.indexOf(from),j=main.indexOf(to,i+from.length);assert.ok(i>=0&&j>i,from);return main.slice(i,j)}
const draw=strip("switch('village-meal'){"+actual("    case 'village-meal': {","    case 'fishing': {")+'}')
const start=main.includes("    case 'supper-fish':")?"    case 'supper-fish':":"    case 'supper-signature':"
const run=strip(actual('function finishSharedSupper(','function neighboursCard(')+";switch(action){"+
 actual(start,"    case 'cove-choice':")+main.split('\n').find(line=>line.startsWith("    case 'share-meal':"))+'}')
function earned(signature=false) {
  const p=commissionPlayer(JSON.parse(read('./fixtures/home-progress-actions.json')))
  assert.deepEqual([p.actions,p.state.day,p.state.coins,p.state.village.meals,p.state.village.residents[1]],[107,14,68,2,'finn'])
  p.visit('home');p.act('specializeFarmhouse','bakery')
  const plots=p.state.beds.flatMap((b,i)=>b.kind==='tilled'?[i]:[]).slice(0,2)
  assert.equal(plots.length,2)
  if(p.state.seeds.wheat<2)p.act('buySeeds','wheat')
  if(p.state.selectedSeed!=='wheat')p.act('selectSeed','wheat')
  for(const i of plots)p.act('workBed',i)
  for(let nights=0;nights<5&&!plots.every(i=>F.getBedAction(p.state,i).kind==='harvest');nights++){
    for(const i of plots)if(F.getBedAction(p.state,i).kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',i)}
    p.night()
  }
  for(const i of plots)p.act('workBed',i)
  p.act('bakeWorkshop','round');p.act('cookDish','farmhouseBread')
  p.act('catchFish',true);p.visit('grove');p.act('catchFish',true);p.visit('village')
  const recipe=signature?p.cook():undefined
  assert.deepEqual([p.state.fish.perch,p.state.fish.seaBass,p.state.handmade.round,p.state.dishes.farmhouseBread],[1,1,1,1])
  assert.equal(F.getHarborOrder(p.state)?.reward,42)
  return {p,recipe}
}
function mount(farm:F.FarmState) {
  class Button {
    dataset:{action:string;value:string}
    parentElement:typeof group|undefined
    pressed:boolean
    constructor(action:string,value:string,pressed=false){this.dataset={action,value};this.pressed=pressed}
    setAttribute(k:string,v:string){assert.equal(k,'aria-pressed');this.pressed=v==='true'}
    focus(){focused=this.dataset.value}
  }
  let group:{key:string;options:Button[];querySelectorAll:()=>Button[]}|undefined,focused='',result:F.ActionResult|undefined
  let dishes:Button[]=[]
  const pastry={open:true}
  const root={innerHTML:'',scrollTop:0,contains:(b:Button)=>!!group?.options.includes(b)||dishes.includes(b),
    querySelector(k:string) {
      if(k==='.shared-supper-pastry')return pastry
      if(k==='[data-supper-result]')return null
      const key=k.match(/data-supper-fish="([^"]+)"/)?.[1]
      if(key&&key!==group?.key)return null
      if(k.includes('aria-pressed'))return group?.options.find(b=>b.pressed)??null
      const value=k.match(/data-value="([^"]+)"/)?.[1]
      if(value)return group?.options.find(b=>b.dataset.value===value)??null
      return key?group:null
    }}
  const ctx={...F,...S,farm,panel:'village-meal',pastryShape:'round',dialogContent:root,
    dialog:{open:true},control:undefined as Button|undefined,action:'',value:undefined as string|undefined,
    icon:()=>'',fishImage:(id:string)=>id,stockTile:(item:F.StockItem)=>`<li data-stock-id="${F.marketKey(item)}"></li>`,
    renderHarbourFishChoice:()=>'<p>ordinary fishing</p>',pastryChoices:()=>'',signatureResultPicture:()=>'',nav:(x:string)=>x,
    button:(label:string,action:string,ready=true,o?:{value?:string})=>`<button data-action="${action}" data-value="${o?.value??''}"${ready?'':' disabled'}>${label}</button>`,
    perform(fn:()=>F.ActionResult){result=fn();if(result.ok)ctx.drawPanel();return result.ok},
    drawPanel() {
      vm(draw,ctx)
      const key=root.innerHTML.match(/data-supper-fish="([^"]+)"/)?.[1]
      const choices=[...root.innerHTML.matchAll(/data-action="supper-fish" data-value="([^"]+)" aria-pressed="(true|false)"/g)]
      const options=choices.map(([,value,state])=>new Button('supper-fish',value,state==='true'))
      group=key?{key,options,querySelectorAll:()=>options}:undefined
      for(const entry of options)entry.parentElement=group
      dishes=[...root.innerHTML.matchAll(/data-action="(share-meal|supper-signature)" data-value="([^"]*)"/g)].map(([,action,value])=>new Button(action,value))
    }}
  ctx.drawPanel()
  function activate(control:Button){
    ctx.control=control;ctx.action=control.dataset.action;ctx.value=control.dataset.value;result=undefined
    vm(run,ctx);return result
  }
  const dish=(action:string)=>dishes.find(b=>b.dataset.action===action)!
  const fish=(value:string)=>group?.options.find(x=>x.dataset.value===value)!
  return {ctx,activate,dish,fish,get markup(){return root.innerHTML},get focused(){return focused},pastry}
}
test('earned Day16 direct table choices preserve the default, or consciously keep the last bass for the same +42 order',()=>{
  const {p}=earned(),before=structuredClone(p.state)
  assert.deepEqual([p.state.day,p.actions,p.state.coins],[16,124,6])
  const defaulted=structuredClone(before),ui=mount(defaulted)
  assert.match(ui.markup,/data-action="supper-fish" data-value="seaBass" aria-pressed="true"/)
  assert.match(ui.markup,/data-action="supper-fish" data-value="perch" aria-pressed="false"/)
  assert.match(ui.markup,/Морской окунь ×1<\/span><small>Отложит заказ на 42 монеты/)
  assert.doesNotMatch(ui.markup,/Подойдёт обычный окунь/)
  assert.deepEqual(defaulted,before)
  assert.ok(ui.activate(ui.dish('share-meal'))?.ok)
  assert.deepEqual([defaulted.fish.perch,defaulted.fish.seaBass,defaulted.village.meals],[1,0,3])
  const retained=structuredClone(before),alternate=mount(retained),old=alternate.dish('share-meal')
  alternate.pastry.open=false
  assert.equal(alternate.activate(alternate.fish('perch')),undefined)
  assert.equal(alternate.focused,'perch');assert.equal(alternate.pastry.open,false)
  assert.deepEqual(retained,before)
  assert.equal(alternate.activate(old),undefined,'replaced default cannot spend')
  assert.ok(alternate.activate(alternate.dish('share-meal'))?.ok)
  assert.deepEqual([retained.fish.perch,retained.fish.seaBass,retained.handmade.round,retained.dishes.farmhouseBread,retained.coins],[0,1,0,1,6])
  assert.ok(F.sail(retained,'grove').ok)
  assert.equal(F.getHarborOrder(retained)?.status,'ready')
  assert.ok(F.deliverHarborOrder(retained).ok)
  assert.deepEqual([retained.coins,retained.village.mealOn,retained.orders.harbor.completed],[48,16,1])
  assert.deepEqual(F.restoreCurrentFarm(retained),retained)
})
test('a real signature and pastry quote the same selected ordinary fish, no substitution if it disappears',()=>{
  const {p,recipe}=earned(true),f=p.state,ui=mount(f),before=structuredClone(f)
  assert.ok(recipe)
  assert.equal(ui.activate(ui.fish('perch')),undefined)
  const chosen=ui.dish('supper-signature')
  assert.match(chosen.dataset.value,new RegExp(`:perch:${recipe}$`))
  assert.match(ui.markup,/1 рыба — окунь/)
  assert.deepEqual(f,before)
  assert.ok(ui.activate(chosen)?.ok)
  assert.deepEqual([f.fish.perch,f.fish.seaBass,f.handmade.round,f.culinary.stock[recipe],f.coins],
    [0,1,1,before.culinary.stock[recipe]-1,before.coins])
  assert.equal(ui.activate(chosen),undefined)
  const stale=structuredClone(before), earlier=mount(stale)
  earlier.activate(earlier.fish('perch'));const btn=earlier.dish('supper-signature')
  assert.ok(F.sail(stale,'home').ok);assert.ok(F.sellMarketItem(stale,'fish:perch',1).ok);assert.ok(F.sail(stale,'village').ok)
  const after=structuredClone(stale)
  assert.equal(earlier.activate(btn),undefined)
  assert.equal(F.deliverSignature(stale,recipe,'perch').ok,false);assert.deepEqual(stale,after)
  assert.equal(F.deliverSignature(stale,recipe,'moonfish' as F.SupperFish).ok,false);assert.deepEqual(stale,after)
  const book=structuredClone(before)
  assert.ok(F.deliverSignature(book,recipe).ok,'outside the local table the existing book action keeps the default')
  assert.deepEqual([book.fish.perch,book.fish.seaBass],[1,0])
})
test('when the order is paid, no reserve tradeoff remains; the ordinary table and held-key safety are unchanged',()=>{
  const {p}=earned()
  const stock=structuredClone(p.state)
  for (const condition of ['extra fish','missing bread'] as const) {
    const ordinary=structuredClone(stock)
    if(condition==='extra fish'){
      assert.ok(F.sail(ordinary,'grove').ok);assert.ok(F.catchFish(ordinary,true).ok)
    } else {
      assert.ok(F.sail(ordinary,'home').ok);assert.ok(F.sellMarketItem(ordinary,'dishes:farmhouseBread',1).ok)
    }
    assert.ok(F.sail(ordinary,'village').ok)
    const before=structuredClone(ordinary),usual=mount(ordinary)
    assert.doesNotMatch(usual.markup,/data-action="supper-fish"/,condition)
    assert.match(usual.markup,/data-stock-id="fish:seaBass"/)
    assert.deepEqual(ordinary,before)
  }
  p.visit('grove');p.act('deliverHarborOrder');p.visit('village')
  const f=p.state,before=structuredClone(f),ui=mount(f)
  assert.doesNotMatch(ui.markup,/data-action="supper-fish"/)
  assert.match(ui.markup,/data-stock-id="fish:perch"/)
  assert.equal(ui.dish('share-meal').dataset.value,'')
  assert.deepEqual(f,before);assert.ok(ui.activate(ui.dish('share-meal'))?.ok)
  assert.equal(f.fish.perch,0)
  assert.ok(isGuardedAction('supper-fish'));assert.ok(isGuardedAction('share-meal'));assert.ok(isGuardedAction('supper-signature'))
  for(const key of ['Enter',' ']){
    const guard=new ActivationKeyGuard()
    assert.equal(guard.blocks({key,repeat:false},isGuardedAction('supper-fish')),false)
    assert.equal(guard.blocks({key,repeat:true},false),true)
  }
})
