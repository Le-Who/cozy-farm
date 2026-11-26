import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as Coop from '../src/coop-panel.ts'
import {renderCoopMorning} from '../src/coop-preview.ts'
import {ActivationKeyGuard,isGuardedAction} from '../src/action-click-guard.ts'
import {chickenCarePlayer} from './fixtures/chicken-care-player.ts'
const {renderCoopPanel}=Coop
const button=(label:string,action:string,enabled=true,options:{value?:string|number}={})=>`<button data-action="${action}"${options.value!==undefined?` data-value="${options.value}"`:''}${!enabled?' disabled':''}>${label}</button>`
const row=(image:string,name:string,detail:string,actions='')=>`<li data-row="${name}"><i>${image}</i><strong>${name}</strong><small>${detail}</small>${actions}</li>`
const render=(f:F.FarmState)=>renderCoopPanel(f,{icon:id=>`<i>${id}</i>`,row,button,feedRow:()=>row('tool-feed','Корм для кур',f.chickensFed?'Сегодня накормлены':'Корм к утренней кладке',f.chickensFed?'':f.feed>0?button('Покормить','feed'):button('Купить корм','buy-feed',f.coins>=F.feedBagPrice))})
const actions=(html:string)=>[...html.matchAll(/<button([^>]*data-action="([^"]+)"[^>]*)>/g)].map(m=>({action:m[2],value:m[1].match(/data-value="([^"]*)"/)?.[1]??'',disabled:m[1].includes('disabled')}))
const p=chickenCarePlayer('orchard','hatchery');p.act('feedChickens');p.act('endDay');p.act('collectEggs');if(!p.state.feed)p.act('buyFeed');p.act('feedChickens');p.act('endDay');const earned=structuredClone(p.state)

test('daily feeding, eggs and incubator precede the old forecast and optional navigation without mutating earned state',()=>{
 const f=structuredClone(earned),before=structuredClone(f),html=render(f),primary=html.slice(0,html.indexOf('<details'))
 assert.ok(primary.indexOf('data-action="feed"')<primary.indexOf('data-action="collect"'))
 assert.ok(primary.indexOf('data-action="collect"')<primary.indexOf('data-action="incubate-egg"'))
 assert.ok(html.indexOf('data-action="incubate-egg"')<html.indexOf('coop-forecast'))
 assert.ok(html.indexOf('coop-forecast')<html.indexOf('hen-friendship-open'))
 assert.ok(html.includes(renderCoopMorning(f)));assert.match(html,/<summary>Кладка после отдыха<\/summary>/);assert.deepEqual(f,before)
})

test('every original action and enabled guard remains in basic, hatchery, pending, full flock and packing states',()=>{
 const pending=structuredClone(earned);assert.ok(F.incubateEgg(pending).ok);const hatched=structuredClone(pending);F.endDay(hatched);F.endDay(hatched)
 for(const f of[F.createFarm(),earned,pending,hatched,chickenCarePlayer('orchard','packing').state]){
  const a=actions(render(f)),expect:{action:string;value:string;disabled:boolean}[]=[],add=(action:string,enabled=true,value='')=>expect.push({action,value,disabled:!enabled})
  if(!f.chickensFed)add(f.feed?'feed':'buy-feed',!!f.feed||f.coins>=F.feedBagPrice)
  add('collect',f.eggsReady>0);if(f.coopSpecialization==='hatchery'&&f.flockSize<F.maxFlockSize&&f.hatchDay===null)add('incubate-egg',f.eggs>0)
  if(f.hatchDay!==null)add('visit-rest')
  add('upgrades');add('hen-friendship-open');if(f.buildingLevels.coop>=2)add('chicken-feed-open')
  if(f.coopSpecialization==='packing'){add('pack-egg-crate',f.eggs>=F.eggsPerCrate);add('unpack-egg-crate',F.getEggUnpackAction(f,'crate').available)}
  if(f.buildingLevels.coop>=2||f.eggBaskets>0){add('pack-egg-basket',f.buildingLevels.coop>=2&&f.eggs>=F.eggsPerBasket);add('unpack-egg-basket',F.getEggUnpackAction(f,'basket').available)}
  for(let i=0;i<f.flockSize;i++)add('pet',true,String(i))
  const sorted=(x:typeof a)=>x.map(v=>JSON.stringify(v)).sort();assert.deepEqual(sorted(a),sorted(expect))
 }
})

test('ordinary egg cost and two nights are explicit; rare eggs do not enable or pay incubation',()=>{
 const f=structuredClone(earned);f.eggs=0;f.variants.egg={rainbow:1};const before=structuredClone(f)
 assert.ok(f.eggsReady>Number(f.eggTrait!==null),'ordinary egg still in the nest')
 const beforeCollect=render(f)
 assert.match(beforeCollect,/1 обычное яйцо · 2 ночи/)
 const choices=actions(beforeCollect)
 assert.equal(choices.filter(a=>a.action==='collect'&&!a.disabled).length,1)
 assert.equal(choices.some(a=>a.action==='incubate-egg'||a.action==='incubate-rare-egg'),false)
 assert.equal(F.incubateEgg(f).ok,false);assert.deepEqual(f,before)
 f.eggs=1;assert.ok(F.incubateEgg(f).ok);assert.equal(f.eggs,0);assert.equal(f.variants.egg.rainbow,1)
 assert.match(render(f),/До вылупления: 2 ночи/);assert.doesNotMatch(render(f),/data-action="incubate-egg"/)
})

test('pending hatch progresses only on real rest and fifth hen appears without a duplicate hatch action',()=>{
 const f=structuredClone(earned);assert.ok(F.incubateEgg(f).ok);const day=f.day,flock=f.flockSize
 render(f);assert.equal(f.day,day);assert.equal(f.flockSize,flock);F.endDay(f);assert.match(render(f),/До вылупления: 1 ночь/)
 assert.ok(render(f).includes('Утром вылупится новая курочка'))
 F.endDay(f);assert.equal(f.flockSize,5);assert.equal(f.hatchDay,null);assert.doesNotMatch(render(f),/data-row="Инкубатор"/)
 assert.equal(actions(render(f)).filter(a=>a.action==='pet').length,5);assert.ok(F.restoreCurrentFarm(JSON.parse(JSON.stringify(f))))
})

test('capacity caution remains beside visible egg collection, while the complete old forecast stays available',()=>{
 const f=structuredClone(earned);f.eggsReady=F.getCoopMorning(f).capacity;f.chickensFed=true
 const html=render(f),primary=html.slice(0,html.indexOf('<details'))
 assert.match(primary,/В гнёздах: 9\/9 · соберите до отдыха/);assert.ok(html.includes(renderCoopMorning(f)))
 assert.match(html,/Гнёзда полны/);assert.match(html,/Новая кладка пока не поместится/)
 const before=structuredClone(f);render(f);assert.deepEqual(f,before);assert.ok(F.collectEggs(f).ok);assert.doesNotMatch(render(f).slice(0,render(f).indexOf('<details')),/соберите до отдыха/)
})

test('feeding and buying remain first; empty-money guards and unlocked mix navigation are preserved',()=>{
 const f=structuredClone(earned);f.feed=0;f.coins=0;f.chickensFed=false;const before=structuredClone(f),html=render(f)
 assert.equal(actions(html)[0].action,'buy-feed');assert.equal(actions(html)[0].disabled,true);assert.ok(actions(html).some(a=>a.action==='chicken-feed-open'&&!a.disabled));assert.deepEqual(f,before)
 f.coins=F.feedBagPrice;assert.equal(actions(render(f))[0].disabled,false);assert.ok(F.buyFeed(f).ok);assert.equal(actions(render(f))[0].action,'feed');assert.ok(F.feedChickens(f).ok);assert.doesNotMatch(render(f),/data-action="feed"|data-action="buy-feed"/)
})

test('packaging stays before the complete original hen grid and does not silently unpack or consume',()=>{
 const f=chickenCarePlayer('orchard','packing').state;f.eggs=8;const before=structuredClone(f),html=render(f)
 assert.ok(html.indexOf('pack-egg-crate')<html.indexOf('hen-grid'));assert.ok(html.indexOf('pack-egg-basket')<html.indexOf('hen-grid'))
 assert.match(html,/Нужно 5 · в запасе 8/);assert.match(html,/Нужно 3 · в запасе 8/);assert.deepEqual(f,before)
 assert.ok(F.packEggCrate(f).ok);assert.ok(F.packEggBasket(f).ok);assert.equal(f.eggs,0);assert.equal(f.eggCrates,1);assert.equal(f.eggBaskets,1)
 assert.ok(actions(render(f)).filter(a=>a.action.startsWith('unpack')).every(a=>!a.disabled))
})

test('main delegates only the coop view and keeps child screens and canonical action handlers',()=>{
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),start=main.indexOf("    case 'coop':",main.indexOf('function drawPanel()')),end=main.indexOf("    case 'rest':",start),branch=main.slice(start,end)
 assert.match(branch,/renderCoopPanel\(farm, \{icon,row,button,feedRow:flockFeedRow\}\)/)
 assert.doesNotMatch(branch,/perform\(|saveFarm\(|incubateEgg\(|collectEggs\(/)
 assert.match(main,/renderHenFriendship\(farm, island.henWalkStatus\(\)/);assert.match(main,/renderChickenFeedMixes\(farm, icon, panelHistory\.at\(-1\)\?\.panel === 'rest'\)/)
 assert.match(main,/case 'incubate-egg': perform\(\(\) => incubateEgg\(farm\)\)/)
})


test('legacy level-one baskets remain unpackable but do not unlock new packing or feed mixes',()=>{
 const f=F.createFarm();f.eggBaskets=1;const before=structuredClone(f),a=actions(render(f))
 assert.ok(a.find(x=>x.action==='pack-egg-basket')!.disabled);assert.equal(a.find(x=>x.action==='unpack-egg-basket')!.disabled,false);assert.equal(a.some(x=>x.action==='chicken-feed-open'),false);assert.deepEqual(f,before)
})

test('a pending egg gives a route to the explicit bedtime decision on both nights, not another spend', () => {
 const f=structuredClone(earned), day=f.day, eggs=f.eggs, flock=f.flockSize
 const before=structuredClone(f);assert.doesNotMatch(render(f),/data-action="visit-rest"/);assert.deepEqual(f,before)
 assert.ok(F.incubateEgg(f).ok)
 for(let nights=2;nights>=1;nights--){
  const saved=structuredClone(f),html=render(f),row=html.match(/<li data-row="Инкубатор">.*?<\/li>/)?.[0]??''
  assert.match(row,/data-action="visit-rest"[^>]*>К отдыху дома/);assert.doesNotMatch(row,/data-action="(?:incubate-egg|sleep)"/)
  assert.deepEqual(f,saved)
  assert.equal(f.eggs,eggs-1);assert.equal(f.flockSize,flock)
  assert.ok(F.endDay(f).ok)
 }
 assert.equal(f.day,day+2);assert.equal(f.flockSize,flock+1);assert.equal(f.eggs,eggs-1)
 assert.doesNotMatch(render(f),/data-action="visit-rest"|data-row="Инкубатор"/)
})

function firstHatcheryWithBasket() {
 const player=chickenCarePlayer('orchard','basic')
 player.act('feedChickens');player.act('endDay');player.act('collectEggs');player.act('packEggBasket')
 assert.equal(player.state.eggs,1);player.act('sellMarketItem','eggs',1)
 player.act('specializeFacility','hatchery')
 assert.equal(player.state.day,2);assert.equal(player.state.eggs,0);assert.equal(player.state.eggsReady,0)
 assert.equal(player.state.eggBaskets,1);assert.equal(player.state.hatchDay,null)
 return player
}

test('a first hatchery with all loose eggs packed points to its existing basket rather than just disabling incubation',()=>{
 const p=firstHatcheryWithBasket(),before=structuredClone(p.state),html=render(p.state)
 const primary=html.slice(0,html.indexOf('coop-forecast'))
 assert.match(primary,/data-row="Инкубатор"[^\n]*data-action="incubator-basket"[^>]*>К корзине яиц/)
 assert.doesNotMatch(primary,/data-action="incubate-egg"|data-action="unpack-egg-basket"/)
 assert.equal(actions(html).filter(a=>a.action==='unpack-egg-basket'&&!a.disabled).length,1)
 assert.deepEqual(p.state,before)
 p.act('unpackEggBasket')
 assert.equal(p.state.eggs,3);assert.equal(p.state.hatchDay,null);assert.equal(p.state.day,2)
 assert.match(render(p.state),/data-action="incubate-egg">Положить яйцо/)
 assert.doesNotMatch(render(p.state),/data-action="incubator-basket"/)
 p.act('incubateEgg');assert.equal(p.state.eggs,2);assert.equal(p.state.hatchDay,4)
})

test('the exact basket shortcut reveals one neutral destination and cannot reuse a held or stale activation',()=>{
 const p=firstHatcheryWithBasket(),target={},visits:unknown[]=[]
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 const from=main.indexOf("    case 'incubator-basket':"),to=main.indexOf("    case 'incubate-egg':",from)
 assert.ok(from>=0&&to>from)
 const script=stripTypeScriptTypes("switch('incubator-basket'){"+main.slice(from,to)+'}')
 const go=(farm:F.FarmState,panel='coop',open=true)=>{
  const before=structuredClone(farm),button={closest:(s:string)=>s==='.dialog-row'?target:null}
  runInNewContext(script,{farm,panel,dialog:{open},hasIncubatorBasketSource:Coop.hasIncubatorBasketSource,
   dialogContent:{querySelector:(s:string)=>s==='.coop-packing [data-action="unpack-egg-basket"]:not(:disabled)'?button:null},
   highlightControl:(node:unknown)=>visits.push(node)})
  assert.deepEqual(farm,before)
 }
 go(p.state);assert.deepEqual(visits,[target])
 go(p.state,'rest');go(p.state,'coop',false)
 p.act('feedChickens');p.act('endDay');assert.ok(p.state.eggsReady>0)
 go(p.state);assert.doesNotMatch(render(p.state),/data-action="incubator-basket"/)
 assert.deepEqual(visits,[target])
 for (const key of ['Enter',' ']) {
  const guard=new ActivationKeyGuard()
  assert.equal(isGuardedAction('incubator-basket'),true)
  assert.equal(guard.blocks({key,repeat:false},true),false)
  assert.equal(guard.blocks({key,repeat:true},false),true)
  guard.release(key);assert.equal(guard.blocks({key,repeat:false},true),false)
 }
})

test('an expanded hatchery forecast survives local changes but starts closed on each new visit', () => {
 const player=chickenCarePlayer('orchard','hatchery')
 player.act('feedChickens');player.act('endDay');player.act('collectEggs')
 const day=player.state.day,flock=player.state.flockSize,eggs=player.state.eggs
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 const from=main.indexOf("    case 'coop':",main.indexOf('function drawPanel()')),to=main.indexOf("    case 'rest':",from)
 assert.ok(from>=0&&to>from)
 const branch=stripTypeScriptTypes("switch('coop'){"+main.slice(from,to)+"}")
 let html='',details:{open:boolean}|null=null
 const dialogContent={
  set innerHTML(value:string) { html=value;details=/<details class="coop-forecast"[ >]/.test(value)?{open:/<details class="coop-forecast" open>/.test(value)}:null },
  querySelector(selector:string) { return selector==='.coop-forecast'?details:null },
 }
 const forecast=()=>{ const current=dialogContent.querySelector('.coop-forecast');assert.ok(current);return current }
 const dialog={open:false}
 function draw() {
  const before=structuredClone(player.state)
  runInNewContext(branch,{farm:player.state,dialog,dialogContent,renderCoopPanel,icon:(id:string)=>id,row,button,
   flockFeedRow:()=>'',bayAudio:{primeEvents(){}},groupCoopServices:()=>()=>{},disposeCoopServices:undefined})
  assert.deepEqual(player.state,before,'rendering never feeds, collects, incubates or rests')
 }
 draw();dialog.open=true
 assert.equal(forecast().open,false,'the first visit is collapsed')
 assert.match(html,/Без корма новой кладки не будет/)
 forecast().open=true
 player.act('incubateEgg')
 draw()
 assert.equal(forecast().open,true,'inserting an egg must not close the player’s forecast')
 assert.match(html,/До вылупления: 2 ночи/)
 if(!player.state.feed) player.act('buyFeed')
 player.act('feedChickens');draw()
 assert.equal(forecast().open,true,'the new forecast stays visible after feeding')
 assert.match(html,/К утру добавится:/);assert.doesNotMatch(html,/Без корма новой кладки не будет/)
 assert.equal(player.state.day,day);assert.equal(player.state.flockSize,flock);assert.equal(player.state.eggs,eggs-1)
 forecast().open=false;draw()
 assert.equal(forecast().open,false,'explicit collapse is preserved too')
 forecast().open=true;dialog.open=false;draw();dialog.open=true
 assert.equal(forecast().open,false,'closing and immediately reopening does not inherit stale markup')
 forecast().open=true;dialogContent.innerHTML='<section>Other menu</section>';draw()
 assert.equal(forecast().open,false,'returning from a different menu starts collapsed')
})

test('unpacking through the incubator shortcut returns to the newly available egg slot without inserting',()=>{
 const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 const between=(a:string,b:string)=>{const from=source.indexOf(a),to=source.indexOf(b,from+1);assert.ok(from>=0&&to>from);return source.slice(from,to)}
 const focus=between("  if (focused && panel !== 'bay-freight'","\n}\n")
 const buttonGuard=between("    case 'unpack-egg-basket':","    case 'unpack-egg-crate':")
 const route=between("    case 'incubator-basket':","    case 'incubate-egg':")
 const highlight=between('function highlightControl(','async function showRequirement(')
 const code=stripTypeScriptTypes(`${highlight}\nfunction dispatch(action){switch(action){${buttonGuard}${route}}}\nfunction restoreOnRedraw(focused){${focus}}`)
 for(const guided of [true,false]){
  const farm=firstHatcheryWithBasket().state
  let active='',scrollTarget=''
  class Row {
   tabIndex?:number
   classes=new Set<string>()
   classList={add:(value:string)=>this.classes.add(value),remove:(value:string)=>this.classes.delete(value)}
   name:string
   constructor(name:string){this.name=name}
   matches(){return this.tabIndex!==undefined}
   focus(){active=this.name}
   scrollIntoView(){scrollTarget=this.name}
  }
  class Button {
   disabled=false
   dataset:{action:string}
   row?:Row
   constructor(action:string,row?:Row){this.dataset={action};this.row=row}
   focus(){active=this.dataset.action}
   closest(selector:string){return selector==='.dialog-row'?this.row
    : selector==='.coop-packing .dialog-row.guidance-target'&&this.row?.classes.has('guidance-target')?this.row:null}
  }
  const basket=new Row('корзина'),incubator=new Row('инкубатор'),closeButton=new Button('close')
  const control=new Button('unpack-egg-basket',basket),insert=new Button('incubate-egg',incubator)
  const can=(action:string)=>actions(render(farm)).some(button=>button.action===action&&!button.disabled)
  const dialogContent={
   querySelector(selector:string){return selector==='.coop-packing [data-action="unpack-egg-basket"]:not(:disabled)'&&can('unpack-egg-basket')?control
    :selector==='.coop-primary [data-action="incubate-egg"]:not(:disabled)'&&can('incubate-egg')?insert:null},
   querySelectorAll(selector:string){return selector==='.guidance-target'?[basket,incubator].filter(row=>row.classes.has('guidance-target')):[control,insert].filter(button=>can(button.dataset.action))},
  }
  const ctx={
   panel:'coop',dialog:{open:true},farm,control,closeButton,dialogContent,HTMLButtonElement:Button,
   hasIncubatorBasketSource:Coop.hasIncubatorBasketSource,unpackEggBasket:F.unpackEggBasket,
   focusKey:(button:Button)=>button.dataset.action,focusedSeedCrop:undefined,
   dispatch:(_action:string)=>{},restoreOnRedraw:(_button:Button)=>{},
   perform(action:()=>F.ActionResult){
    const result=action()
    if(result.ok){basket.classes.clear();incubator.classes.clear();ctx.restoreOnRedraw(control)}
    return result.ok
   },
  }
  runInNewContext(code,ctx)
  const before=structuredClone(farm)
  if(guided){
   ctx.dispatch('incubator-basket')
   assert.equal(active,'корзина');assert.equal(scrollTarget,'корзина');assert.deepEqual(farm,before)
  }
  control.focus();ctx.dispatch('unpack-egg-basket')
  assert.equal(active,guided?'инкубатор':'close')
  assert.equal(scrollTarget,guided?'инкубатор':'')
  assert.equal(incubator.tabIndex,guided?-1:undefined)
  before.eggs+=F.eggsPerBasket;before.eggBaskets--
  assert.deepEqual(farm,before,'unpacking alone must not start the hatch, advance a day or change a visit')
 }
})

test('collecting the first loose egg by keyboard reveals the incubator without starting it',()=>{
 const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
 const part=(a:string,b:string)=>{const i=source.indexOf(a),j=source.indexOf(b,i+1);assert.ok(i>=0&&j>i);return source.slice(i,j)}
 const code=stripTypeScriptTypes(part('function highlightControl(','async function showRequirement(')
  +'\nfunction dispatch(action){switch(action){'+part("    case 'collect':","    case 'unpack-egg-basket':")
  +part("    case 'incubate-egg':","    case 'rest-close-shop':")+'}}'
  +'\nfunction restore(focused){'+part("  if (focused && panel !== 'bay-freight'","\n}\n")+'}')
 const p=chickenCarePlayer('orchard','hatchery');p.act('feedChickens');p.act('endDay')
 assert.equal(p.state.eggs,0);assert.ok(p.state.eggsReady>0);assert.equal(p.state.hatchDay,null)
 for(const mode of ['owned-keyboard','pointer','focus-elsewhere','already-stocked'] as const){
  const farm=structuredClone(p.state)
  if(mode==='already-stocked'){
   assert.ok(F.collectEggs(farm).ok);assert.ok(F.buyFeed(farm).ok);assert.ok(F.feedChickens(farm).ok);assert.ok(F.endDay(farm).ok)
   assert.ok(farm.eggs>0);assert.ok(farm.eggsReady>0)
  }
  const beforeCollect=actions(render(farm)).find(a=>a.action==='incubate-egg')
  assert.equal(beforeCollect?.disabled,mode==='already-stocked'?false:undefined)
  const before=structuredClone(farm),expected=structuredClone(farm)
  assert.ok(F.collectEggs(expected).ok)
  const sounds:string[]=[],document={activeElement:null as unknown}
  let revealed=false
  const classes=new Set<string>()
  const incubator={tabIndex:undefined as number|undefined,classList:{add:(value:string)=>classes.add(value)},matches:()=>false,
    focus({preventScroll}:{preventScroll:boolean}){assert.ok(preventScroll);document.activeElement=this},
    scrollIntoView({block}:{block:string}){assert.equal(block,'center');revealed=true}}
  class Button {
   dataset:{action:string};disabled=false
   constructor(action:string){this.dataset={action}}
   focus(){document.activeElement=this}
   closest(selector:string){return selector==='.dialog-row'&&this.dataset.action==='incubate-egg'?incubator:null}
  }
  const control=new Button('collect'),insert=new Button('incubate-egg'),closeButton=new Button('close')
  document.activeElement=mode==='focus-elsewhere'?closeButton:control
  const available=()=>actions(render(farm)).some(a=>a.action==='incubate-egg'&&!a.disabled)
  const dialogContent={querySelector:(s:string)=>s==='.coop-primary [data-action="incubate-egg"]:not(:disabled)'&&available()?insert:null,
   querySelectorAll:(s:string)=>s==='button:not(:disabled)'&&available()?[insert]:[]}
  const ctx:any={...F,farm,panel:'coop',dialog:{open:true},dialogContent,control,document,event:{detail:mode==='pointer'?1:0},
   closeButton,HTMLButtonElement:Button,focusedSeedCrop:undefined,focusKey:(item:Button)=>item.dataset.action,playBaySound:(id:string)=>sounds.push(id),
   perform(action:()=>{ok:boolean}){const focused=document.activeElement;const result=action();if(result.ok)ctx.restore(focused instanceof Button?focused:undefined);return result.ok}}
  runInNewContext(code,ctx);ctx.dispatch('collect')
  assert.deepEqual(farm,expected);assert.equal(farm.hatchDay,null);assert.equal(farm.day,before.day)
  assert.deepEqual(sounds,['flock.eggs']);assert.equal(available(),true)
  assert.equal(revealed,mode==='owned-keyboard',mode)
  assert.equal(document.activeElement,mode==='owned-keyboard'?incubator:closeButton)
  if(mode==='owned-keyboard'){
   assert.equal(incubator.tabIndex,-1);assert.ok(classes.has('guidance-target'))
   ctx.dispatch('incubate-egg')
   assert.equal(farm.eggs,expected.eggs-1);assert.equal(farm.hatchDay,before.day+F.incubationDays)
  }
 }
})
