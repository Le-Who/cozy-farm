import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { createFarm, restoreCurrentFarm, endDay, sail, workBed, storeTree, returnNurseryTree, plantTree, petChicken, introduceHenToVisitor, bakeWorkshop, pickFruit, getNeighborPlans, joinNeighborPlan, serveNeighborPlan, finishNeighborPlan } from '../src/farm.ts'
import { inviteNeighborVisit, finishNeighborVisit, visitActivities, visitActivityIds } from '../src/neighbor-visits.ts'
import { renderNeighborVisits, renderVisitRest } from '../src/neighbor-visits-ui.ts'
import { restoreLegacyFarm } from '../src/farm-save-migration.ts'
import { farmSaveKeys as keys, friendshipFarmSaveKeys as v5 } from '../src/farm-save-keys.ts'
import { VersionedSave } from '../src/versioned-save.ts'
import { getBedStage } from '../src/farm.ts'
function ready(meetResidents=true){
  const f=createFarm();f.day=5;f.boatOwned=true;f.buildingLevels.farmhouse=2
  f.projects.fair={'dishes:appleJam':1,eggBaskets:1,'produce:carrot':4,'produce:wheat':3}
  f.fairGuestsServed=1;f.guestServedOn=1
  f.village={built:true,supplies:{'handmade:round':2,'fish:seaBass':2,honey:2},residents:['bea','finn'],meals:2,mealOn:2,serviceOn:{bea:0,finn:0},scouting:false}
  if(meetResidents){f.dishes.windParfait=1;f.dishes.grilledFish=1}
  f.island='village'
  for(const p of meetResidents?getNeighborPlans(f):[]){
    assert.ok(joinNeighborPlan(f,p.id).ok)
    assert.ok(serveNeighborPlan(f,p.id,p.resident==='bea'?'dish:windParfait':'dish:grilledFish').ok)
    assert.ok(finishNeighborPlan(f,p.id,{kind:p.arrangement,settled:true,placements:[{slot:'food',x:0,y:0},{slot:'cup',x:-.6,y:.3},{slot:'flowers',x:.6,y:.3}]}).ok)
  }
  assert.ok(sail(f,'home').ok);assert.ok(restoreCurrentFarm(JSON.parse(JSON.stringify(f))));return f
}
const load=(f:ReturnType<typeof createFarm>)=>restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!
const economy=(f:ReturnType<typeof createFarm>)=>{const copy=structuredClone(f) as any;delete copy.neighborVisits;return copy}

test('active harvest visit does not offer a ripe-bed target when none exists',()=>{
  for(const activity of ['beaHarvest','finnGarden'] as const){
    const f=ready();f.beds=f.beds.map(()=>({kind:'empty'}));f.beds[0]={kind:'crop',crop:'carrot',growth:0,watered:false}
    assert.ok(inviteNeighborVisit(f,activity).ok);const before=structuredClone(f)
    const html=renderNeighborVisits(f,()=>''),target=html.match(/<button[^>]*data-action="visit-do"[^>]*>[\s\S]*?<\/button>/)![0]
    assert.match(target,/disabled/);assert.match(target,/Нет зрелых грядок/)
    assert.match(html,/Побыть на ферме/);assert.match(html,/Завершить визит/);assert.deepEqual(f,before)
    f.beds[0]={kind:'crop',crop:'carrot',growth:1,watered:false}
    const available=renderNeighborVisits(f,()=>'').match(/<button[^>]*data-action="visit-do"[^>]*>[\s\S]*?<\/button>/)![0]
    assert.doesNotMatch(available,/disabled/);assert.match(available,/К зрелой грядке/)
  }
})

test('stale harvest target keeps the guest book open; ready target still focuses without harvesting',()=>{
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const branch=main.slice(main.indexOf("    case 'visit-do': {"),main.indexOf("    case 'hen-friend-select':"))
  for(const activity of ['beaHarvest','finnGarden'] as const){
    const f=ready();f.beds=f.beds.map(()=>({kind:'empty'}));assert.ok(inviteNeighborVisit(f,activity).ok)
    const before=structuredClone(f),calls:string[]=[],notices:string[]=[],focus:unknown[]=[]
    const state={farm:f,visitActivities,getBedStage,panel:'neighbor-visits',dialog:{open:true},value:String(f.neighborVisits.serial),
      closeDialog:()=>calls.push('close'),fieldViewButton:{getAttribute:()=> 'false'},toggleFieldView:()=>calls.push('toggle'),
      island:{focusTarget:(target:unknown)=>focus.push(target)},notify:(message:string)=>notices.push(message),drawPanel:()=>calls.push('redraw')}
    const dispatch=()=>runInNewContext(stripTypeScriptTypes(`switch('visit-do'){${branch}}`),state)
    dispatch();assert.deepEqual(calls,['redraw']);assert.deepEqual(focus,[]);assert.equal(notices.length,1);assert.match(notices[0],/Зрелых грядок пока нет/);assert.deepEqual(f,before)
    f.beds[2]={kind:'crop',crop:'carrot',growth:1,watered:false};const ripe=structuredClone(f);calls.length=0
    dispatch();assert.deepEqual(calls,['close']);assert.deepEqual(JSON.parse(JSON.stringify(focus)),[{kind:'bed',index:2}]);assert.deepEqual(f,ripe)
  }
})
test('earned invitation is free, one guest only, invalid and repeated starts are atomic',()=>{
  assert.equal(inviteNeighborVisit(createFarm(),'beaFlock').ok,false)
  const f=ready(),before=economy(f)
  for(const id of [undefined,'__proto__','finn',''])assert.equal(inviteNeighborVisit(f,id).ok,false)
  assert.ok(inviteNeighborVisit(f,'beaFlock').ok);assert.deepEqual(economy(f),before)
  const active=structuredClone(f);assert.equal(inviteNeighborVisit(f,'finnFlock').ok,false);assert.deepEqual(f,active);assert.deepEqual(load(f),f)
})
test('each of six visits records actual ordinary work, without taking its reward or changing orders',()=>{
  for(const id of visitActivityIds){
    const f=ready();f.produce.wheat=8;f.eggs=4;f.beds[0]={kind:'crop',crop:'carrot',growth:1,watered:false};f.trees.home[0]={tree:'apple',age:2,fruitReady:2}
    const normal=structuredClone(f);assert.ok(inviteNeighborVisit(f,id).ok)
    const action=(farm:typeof f)=>{switch(visitActivities[id].kind){case 'crop':return workBed(farm,0);case 'pastry':return bakeWorkshop(farm,'folded');case 'hen':return petChicken(farm,0);case 'fruit':return pickFruit(farm,0)}}
    assert.ok(action(f).ok);assert.ok(action(normal).ok);assert.deepEqual(economy(f),economy(normal),id)
    assert.equal(f.neighborVisits.memories.length,1);assert.ok(f.neighborVisits.active?.observation);assert.deepEqual(load(f),f)
    assert.ok(finishNeighborVisit(f,f.neighborVisits.serial,'curious').ok);assert.equal(f.neighborVisits.memories[0].reply,'curious');assert.deepEqual(load(f),f)
  }
})
test('already-petted hens may be introduced without farming friendship or repeating rewards',()=>{
  const f=ready();petChicken(f,0);assert.ok(inviteNeighborVisit(f,'finnFlock').ok);const before=economy(f)
  assert.ok(introduceHenToVisitor(f,0).ok);assert.deepEqual(economy(f),before)
  const observed=structuredClone(f);assert.equal(introduceHenToVisitor(f,0).ok,false);assert.deepEqual(f,observed)
  finishNeighborVisit(f,f.neighborVisits.serial);inviteNeighborVisit(f,'finnFlock');introduceHenToVisitor(f,1)
  assert.equal(f.neighborVisits.memories.length,1);assert.equal(f.neighborVisits.memories[0].subject,'Плюша');assert.deepEqual(load(f),f)
})
test('cancel, failed work, wrong kind, rest and travel do not invent memories or lose earned ones',()=>{
  const f=ready();inviteNeighborVisit(f,'beaHands');petChicken(f,1);assert.equal(f.neighborVisits.active?.observation,null)
  assert.equal(bakeWorkshop(f,'round').ok,false);assert.equal(f.neighborVisits.memories.length,0)
  const before=structuredClone(f);assert.equal(finishNeighborVisit(f,0).ok,false);assert.equal(finishNeighborVisit(f,f.neighborVisits.serial,'quiet').ok,false);assert.deepEqual(f,before)
  endDay(f);assert.equal(f.neighborVisits.active,null);inviteNeighborVisit(f,'beaFlock');introduceHenToVisitor(f,2)
  const memories=structuredClone(f.neighborVisits.memories);assert.ok(sail(f,'grove').ok);assert.equal(f.neighborVisits.active,null);assert.deepEqual(f.neighborVisits.memories,memories);assert.ok(load(f))
})
test('malformed active visits, forged duplicate memories and missing v6 ledger fail closed',()=>{
  const f=ready();inviteNeighborVisit(f,'beaFlock');introduceHenToVisitor(f,0)
  const mutations=[(x:any)=>delete x.neighborVisits,(x:any)=>x.neighborVisits.active.startedOn--,(x:any)=>x.neighborVisits.serial=0,(x:any)=>x.island='grove',(x:any)=>x.neighborVisits.memories.push(x.neighborVisits.memories[0]),(x:any)=>x.neighborVisits.active.observation.subject='<img>',(x:any)=>x.neighborVisits.memories[0].activity='bad',(x:any)=>x.neighborVisits.memories[0].serial=999]
  for(const mutate of mutations){const raw=structuredClone(f);mutate(raw);assert.equal(restoreCurrentFarm(raw),undefined)}
})
class Storage{items=new Map<string,string>();getItem(k:string){return this.items.get(k)??null}setItem(k:string,v:string){this.items.set(k,v)}}
const open=(s:Storage)=>new VersionedSave(()=>s,keys,restoreCurrentFarm,createFarm,async operation=>operation(),restoreLegacyFarm)
test('v5 imports friendships and held orders intact; corrupt v5 never resets protected ledgers',async()=>{
  for(const absent of ['neighborVisits','henFriendship','shopCommissions'] as const){
    const s=new Storage(),raw=structuredClone(ready()) as any;delete raw.neighborVisits;if(absent!=='neighborVisits')delete raw[absent]
    const bytes=JSON.stringify(raw);s.items.set(v5.primary,bytes);const save=open(s),f=await save.load()
    if(absent==='neighborVisits'){assert.ok(f);assert.deepEqual(f.henFriendship,raw.henFriendship);assert.deepEqual(f.shopCommissions,raw.shopCommissions);assert.deepEqual(f.neighborVisits,{serial:0,active:null,memories:[]})
      inviteNeighborVisit(f,'beaFlock');introduceHenToVisitor(f,0);assert.ok(await save.save(f));s.items.set(v5.primary,JSON.stringify(createFarm()));assert.deepEqual((await open(s).load())?.neighborVisits,f.neighborVisits)
    }else{assert.equal(f,undefined);assert.equal(save.blocked,true);assert.equal(s.items.size,1)}
    if(absent!=='neighborVisits')assert.equal(s.getItem(v5.primary),bytes)
  }
})

test('guest book is read-only, escapes saved subjects and exposes no extra reward or daily obligation',async()=>{
  const {renderNeighborVisits}=await import('../src/neighbor-visits-ui.ts');const {isGuardedAction}=await import('../src/action-click-guard.ts')
  const f=ready(),before=structuredClone(f);const html=renderNeighborVisits(f,()=>'<i></i>')
  assert.match(html,/Пригласить/);assert.match(html,/Повторные визиты не дают монет/);assert.deepEqual(f,before)
  inviteNeighborVisit(f,'beaFlock');introduceHenToVisitor(f,0);f.neighborVisits.active!.observation!.subject='<unsafe>'
  assert.match(renderNeighborVisits(f,()=>''),/&lt;unsafe&gt;/);assert.doesNotMatch(renderNeighborVisits(f,()=>''),/<unsafe>/)
  for(const id of ['visit-invite','visit-finish','visit-reply','visit-introduce-hen','visit-do','visit-book-home'])assert.ok(isGuardedAction(id))
})

test('every guest arrives and leaves by safe routes; rest, travel and reduced motion release runtime actors',async()=>{
  const {syncHomeVisitor,stepHomeVisitor,visitorLanding}=await import('../src/neighbor-visit-scene.ts')
  const {isHenWalkSegment}=await import('../src/hen-companion.ts')
  for(const id of visitActivityIds){const f=ready();inviteNeighborVisit(f,id);const before=structuredClone(f);let actor=syncHomeVisitor(undefined,f)!
    let p=actor.point;assert.ok(actor.route.length);for(const next of actor.route){assert.ok(isHenWalkSegment(p,next,f.buildingLevels));p=next}
    for(let i=0;i<1500&&actor.route.length;i++)stepHomeVisitor(actor,1/30,false)
    assert.ok(Math.hypot(actor.point.x-visitActivities[id].point.x,actor.point.y-visitActivities[id].point.y)<2);assert.deepEqual(f,before)
    finishNeighborVisit(f,f.neighborVisits.serial);actor=syncHomeVisitor(actor,f)!;assert.ok(actor.leaving)
    for(let i=0;i<1500&&actor.route.length;i++)stepHomeVisitor(actor,1/30,false)
    assert.ok(stepHomeVisitor(actor,0,false));assert.deepEqual(actor.point,visitorLanding)
    inviteNeighborVisit(f,id);actor=syncHomeVisitor(actor,f)!;stepHomeVisitor(actor,0,true);assert.deepEqual(actor.point,visitActivities[id].point)
    endDay(f);assert.equal(syncHomeVisitor(actor,f),undefined);f.island='grove';assert.equal(syncHomeVisitor(actor,f),undefined)
  }
})


test('first and repeat harvest copy follows the exact visit serial, preserving the first crop and reply after reload',()=>{
  for(const activity of ['beaHarvest','finnGarden'] as const){
    let f=ready();f.beds[0]={kind:'crop',crop:'carrot',growth:1,watered:false};f.beds[1]={kind:'crop',crop:'wheat',growth:2,watered:false}
    assert.ok(inviteNeighborVisit(f,activity).ok)
    const firstSerial=f.neighborVisits.serial
    const firstHarvest=workBed(f,0)
    assert.ok(firstHarvest.ok);assert.match(firstHarvest.message,/Воспоминание добавлено в гостевую книгу/)
    const firstHtml=renderNeighborVisits(f,()=>''),firstActive=firstHtml.match(/<article class="home-visit-active"[\s\S]*?<\/article>/)![0]
    assert.match(firstActive,/Воспоминание добавлено в книгу/);assert.doesNotMatch(firstActive,/Сегодня:/)
    assert.match(renderVisitRest(f),/Воспоминание уже в гостевой книге/)
    const firstFarewell=finishNeighborVisit(f,firstSerial,'quiet')
    assert.ok(firstFarewell.ok);assert.match(firstFarewell.message,/Воспоминание осталось в гостевой книге/)
    const first=structuredClone(f.neighborVisits.memories[0])
    assert.equal(first.reply,'quiet')
    assert.ok(inviteNeighborVisit(f,activity).ok)
    const repeatSerial=f.neighborVisits.serial
    assert.notEqual(repeatSerial,firstSerial);assert.equal(f.neighborVisits.active!.startedOn,first.day)
    const ordinary=structuredClone(f);ordinary.neighborVisits.active=null
    const repeatHarvest=workBed(f,1)
    assert.ok(repeatHarvest.ok);assert.ok(workBed(ordinary,1).ok);assert.deepEqual(economy(f),economy(ordinary))
    assert.match(repeatHarvest.message,/В гостевой книге осталась первая встреча за этим занятием/)
    assert.doesNotMatch(repeatHarvest.message,/запомнил|Воспоминание добавлено/)
    const today=structuredClone(f.neighborVisits.active!.observation!)
    assert.notEqual(today.subject,first.subject)
    assert.deepEqual(f.neighborVisits.memories,[first])
    f=load(f);assert.ok(f);assert.deepEqual(f.neighborVisits.active!.observation,today)
    const before=structuredClone(f),repeatHtml=renderNeighborVisits(f,()=>''),repeatActive=repeatHtml.match(/<article class="home-visit-active"[\s\S]*?<\/article>/)![0]
    assert.ok(repeatActive.includes(`Сегодня: ${today.subject}`));assert.ok(!repeatActive.includes(first.subject))
    assert.match(repeatActive,/В книге осталась ваша первая встреча за этим занятием/)
    assert.doesNotMatch(repeatActive,/Воспоминание добавлено|Момент уже сохранён/)
    assert.ok(!repeatActive.includes(visitActivities[activity].memory))
    assert.ok(repeatActive.includes(`data-value="${repeatSerial}:curious"`))
    assert.ok(repeatHtml.includes(first.subject));assert.ok(repeatHtml.includes(visitActivities[activity].quiet))
    assert.match(renderVisitRest(f),/В гостевой книге останется первая встреча за этим занятием/)
    assert.doesNotMatch(renderVisitRest(f),/Воспоминание уже/)
    assert.deepEqual(f,before)
    assert.equal(finishNeighborVisit(f,firstSerial,'curious').ok,false);assert.deepEqual(f,before)
    assert.equal(finishNeighborVisit(f,repeatSerial,'invalid').ok,false);assert.deepEqual(f,before)
    const farewell=finishNeighborVisit(f,repeatSerial,'curious')
    assert.ok(farewell.ok);assert.match(farewell.message,/В гостевой книге осталась первая встреча за этим занятием/)
    assert.doesNotMatch(farewell.message,/Воспоминание осталось/)
    assert.deepEqual(f.neighborVisits.memories,[first]);assert.equal(f.neighborVisits.active,null)
    const completed=structuredClone(f)
    assert.equal(finishNeighborVisit(f,repeatSerial,'curious').ok,false);assert.deepEqual(f,completed)
    const loaded=load(f);assert.ok(loaded);assert.deepEqual(loaded.neighborVisits.memories,[first])
    const remembered=renderNeighborVisits(loaded,()=>'')
    assert.ok(remembered.includes(first.subject));assert.ok(remembered.includes(visitActivities[activity].quiet))
    assert.ok(!remembered.includes(today.subject));assert.ok(!remembered.includes(visitActivities[activity].curious))
  }
})

test('unobserved repeat visits never claim a new memory in rest or farewell copy',()=>{
  const f=ready();inviteNeighborVisit(f,'beaFlock');introduceHenToVisitor(f,0);finishNeighborVisit(f,f.neighborVisits.serial,'quiet')
  const first=structuredClone(f.neighborVisits.memories)
  inviteNeighborVisit(f,'beaFlock')
  assert.match(renderVisitRest(f),/Пригласить снова можно в любой день/)
  const farewell=finishNeighborVisit(f,f.neighborVisits.serial)
  assert.ok(farewell.ok);assert.match(farewell.message,/Можно пригласить снова, когда будет удобно/)
  assert.deepEqual(load(f).neighborVisits.memories,first)
})


test('repeat observations leave the first memory intact after a plain farewell, rest or travel',()=>{
  for(const departure of ['farewell','rest','travel'] as const){
    const f=ready();f.beds[0]={kind:'crop',crop:'carrot',growth:1,watered:false};f.beds[1]={kind:'crop',crop:'wheat',growth:2,watered:false}
    inviteNeighborVisit(f,'beaHarvest');workBed(f,0);finishNeighborVisit(f,f.neighborVisits.serial,'quiet')
    const first=structuredClone(f.neighborVisits.memories)
    inviteNeighborVisit(f,'beaHarvest');workBed(f,1)
    if(departure==='farewell')assert.match(finishNeighborVisit(f,f.neighborVisits.serial).message,/В гостевой книге осталась первая встреча за этим занятием/)
    else if(departure==='rest')assert.ok(endDay(f).ok)
    else assert.ok(sail(f,'grove').ok)
    assert.equal(f.neighborVisits.active,null)
    assert.deepEqual(load(f).neighborVisits.memories,first)
  }
})

test('the visible first-visit receipt is not duplicated in history until farewell; other serials remain',()=>{
  const f=ready(),book=()=>renderNeighborVisits(f,()=>'')
  const history=(html:string)=>html.split('<h2>Наши домашние встречи</h2>')[1]??''
  assert.match(history(book()),/Здесь останутся первые встречи/)
  for(const [i,id] of (['finnGarden','beaFlock','beaHarvest'] as const).entries()){
    assert.ok(inviteNeighborVisit(f,id).ok)
    if(id==='beaFlock')assert.ok(introduceHenToVisitor(f,0).ok)
    else{f.beds[i]={kind:'crop',crop:'carrot',growth:1,watered:false};assert.ok(workBed(f,i).ok)}
    const {serial}=f.neighborVisits.active!,entry=visitActivities[id],before=structuredClone(f)
    const html=book(),past=history(html)
    assert.deepEqual(f,before)
    assert.equal(html.split(entry.memory).length-1,1)
    assert.ok(!past.includes(entry.memory));assert.doesNotMatch(html,/Здесь останутся первые встречи/)
    if(i===0)assert.doesNotMatch(html,/<h2>Наши домашние встречи<\/h2>/)
    for(const prior of f.neighborVisits.memories.slice(0,-1))assert.ok(past.includes(visitActivities[prior.activity].memory))
    for(const reply of ['quiet','curious'])assert.ok(html.includes(`data-action="visit-reply" data-value="${serial}:${reply}"`))
    assert.ok(html.includes(`data-action="visit-finish" data-value="${serial}"`))
    assert.ok(finishNeighborVisit(f,serial,'quiet').ok)
    const after=history(book());assert.ok(after.includes(entry.memory));assert.ok(after.includes(entry.quiet))
    assert.deepEqual(f.neighborVisits.memories.map(m=>m.serial),before.neighborVisits.memories.map(m=>m.serial))
  }
  assert.deepEqual(load(f),f)
})

test('the guest leads an active visit; leaving consequences stay by the exit and invitation rules stay with invitations',()=>{
  const read=(f:ReturnType<typeof createFarm>)=>{const before=structuredClone(f),html=renderNeighborVisits(f,()=>'');assert.deepEqual(f,before);return html}
  function invitations(html:string){
    assert.match(html,/Приглашения открываются после первой общей встречи/)
    assert.match(html,/За визит не нужно платить или отдавать угощение/)
    assert.match(html,/Один гость за раз/);assert.match(html,/Повторные визиты не дают монет/)
  }
  const locked=read(ready(false));invitations(locked)
  assert.match(locked,/Сначала устройте с этим соседом общую встречу/);assert.match(locked,/data-value="beaFlock" disabled/)
  const f=ready(),available=read(f);invitations(available);assert.match(available,/data-value="beaFlock">Пригласить/)
  assert.ok(inviteNeighborVisit(f,'beaFlock').ok)
  for(const observed of [false,true]){
    if(observed)assert.ok(introduceHenToVisitor(f,0).ok)
    const html=read(f);assert.match(html,/^<section class="home-visits">\s*<article class="home-visit-active"/)
    assert.doesNotMatch(html,/Приглашения открываются|Один гость за раз|Повторные визиты не дают монет/)
    assert.match(html,/После отдыха или поездки гость уйдёт, а записи в книге останутся\.<\/p>\s*<div class="dialog-actions">/)
    assert.match(html,observed?/data-action="visit-reply"/:/data-action="visit-introduce-hen"/)
    assert.match(html,/data-action="visit-finish"/)
  }
  assert.ok(finishNeighborVisit(f,f.neighborVisits.serial,'quiet').ok)
  const history=read(f);invitations(history);assert.match(history,/Позвать снова/);assert.ok(history.includes(visitActivities.beaFlock.quiet))
  assert.ok(sail(f,'grove').ok)
  const away=read(f);invitations(away);assert.match(away,/Вернуться домой к приглашениям/);assert.match(away,/data-value="beaFlock" disabled/)
})

test('Finn points only to ripe fruit in the home garden; an obsolete route leaves the book and field view alone',()=>{
  const f=ready();assert.ok(plantTree(f,1,'apple').ok);assert.ok(inviteNeighborVisit(f,'finnOrchard').ok)
  const button=()=>renderNeighborVisits(f,()=>'').match(/<button[^>]*data-action="visit-do"[^>]*>[\s\S]*?<\/button>/)?.[0]
  assert.match(button()!,/>К дереву</)
  const token=String(f.neighborVisits.serial),main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  const branch=main.slice(main.indexOf("    case 'visit-do': {"),main.indexOf("    case 'hen-friend-select':"))
  const dispatch=()=>{
    const before=structuredClone(f),calls:string[]=[],notices:string[]=[]
    runInNewContext(stripTypeScriptTypes(`switch('visit-do'){${branch}}`),{
      farm:f,visitActivities,getBedStage,panel:'neighbor-visits',dialog:{open:true},value:token,drawPanel:()=>calls.push('redraw'),
      closeDialog:()=>calls.push('close'),fieldViewButton:{getAttribute:()=> 'true'},toggleFieldView:()=>calls.push('toggle'),
      island:{focusTarget:(t:{kind:string;index:number})=>calls.push(`focus:${t.kind}:${t.index}`)},notify:(s:string)=>notices.push(s),
    })
    assert.deepEqual(f,before);return {calls,notices}
  }
  // The ripe apple has moved to storage; the grove has ripe fruit, but neither is a destination on this visit.
  assert.ok(storeTree(f,0).ok);assert.ok(f.trees.grove.some(t=>t&&t.fruitReady>0));assert.ok(load(f))
  const stale=dispatch()
  assert.deepEqual(stale.calls,['redraw']);assert.match(stale.notices[0],/Спелых плодов пока нет/)
  assert.match(button()!,/ disabled>Нет спелых плодов</)
  const html=renderNeighborVisits(f,()=>'');assert.doesNotMatch(html,/Визит можно начать позднее/)
  assert.match(html,/Побыть на ферме/);assert.match(html,/Завершить визит/)
  assert.ok(returnNurseryTree(f,2,f.treeNursery[0].id).ok);assert.doesNotMatch(button()!,/disabled/)
  assert.deepEqual(dispatch(),{calls:['close','toggle','focus:tree:2'],notices:[]})
  assert.equal(f.neighborVisits.active?.observation,null);assert.ok(f.trees.home[2]!.fruitReady>0)
  assert.ok(pickFruit(f,2).ok);assert.ok(f.neighborVisits.active?.observation);assert.equal(button(),undefined)
  assert.deepEqual(dispatch(),{calls:[],notices:[]});assert.deepEqual(load(f),f)
})
