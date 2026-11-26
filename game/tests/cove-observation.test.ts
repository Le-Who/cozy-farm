import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import * as F from '../src/farm.ts';
import * as visual from '../src/shoreline-view.ts';
import {getShoalFindAt} from '../src/shoal.ts';
import {isGuardedAction} from '../src/action-click-guard.ts';
import {commissionPlayer} from './fixtures/commission-player.ts';
const text=(name:string)=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'));
function earned(){
 const p=commissionPlayer(opening.slice(0,55));p.visit('grove');
 for(const kind of ['regular','moon']){
   const slot=[0,1,2].find(i=>F.getShellAt(p.state,i)===kind);
   assert.notEqual(slot,undefined);p.act('collectShell',slot);
 }
 p.act('collectShoalFind','glass');p.visit('home');
 for(let i=55;p.state.day<11;i++){const a=opening[i];p.act(a.name,...a.args);}
 p.visit('grove');assert.equal(getShoalFindAt(p.state,'pearl'),'pearl');p.act('collectShoalFind','pearl');
 assert.deepEqual([p.actions,p.state.day,p.state.coins],[99,11,72]);
 assert.equal(createHash('sha256').update(JSON.stringify(p.state)).digest('hex'),'0d5f8bd390bd53c3fc72a142dad1e2bac9f4f94bbbdc5f09a02a8af8ef9b5833');
 return p;
}
function choose(p:ReturnType<typeof earned>,channel:boolean){
 if(channel){p.act('changeCove',{flow:'open'});p.act('changeCove',{refuge:'stones'});}
 else p.act('changeCove',{cover:'kelp'});
}
function liveCoveMarkup(){
 const source=text('culinary-ui.ts'), control=source.split('\n').find(l=>l.startsWith('const control='))!;
 const ui=source.slice(source.indexOf('const coveChoiceSummary')).replace('export function coveControls','function coveControls').replaceAll('import.meta.env.BASE_URL','"/"');
 return runInNewContext(stripTypeScriptTypes(control+'\n'+ui+'\ncoveControls'),{getCoveActions:F.getCoveActions,hasLanternfishDepth:()=>true}) as (farm:F.FarmState,watching?:boolean)=>string;
}
const localBird=(f:F.FarmState)=>F.getCoveActions(f).ecology.animals.egret.mode;
const ACT='data-action="cove-watch"';

test('earned same-day forecast does not become a witnessed bird; after the tide two actually distinct built egret scenes',()=>{
 for(const channel of [false,true]){
   const p=earned();choose(p,channel);
   assert.equal(localBird(p.state),'watch','physical behavior follows settled ecology, never the pending menu');
   p.night();p.visit('grove');
   assert.equal(localBird(p.state),channel?'wade':'watch');
   const before=structuredClone(p.state), bird=localBird(p.state);
   const from=visual.coveObservationPose(bird,0,false);
   const middle=visual.coveObservationPose(bird,1.1,false);
   const to=visual.coveObservationPose(bird,2.2,false);
   assert.deepEqual([from.x,from.y,from.frame],[1439,657,0]);
   if(channel){
     assert.ok(middle.x<from.x&&middle.y>from.y&&middle.y<to.y);
     assert.deepEqual([to.x,to.y,to.frame],[1402,711,2]);
   }else assert.deepEqual(to,from);
   const still=visual.coveObservationPose(bird,0,true);
   assert.deepEqual(still,visual.coveObservationPose(bird,20,true));
   assert.deepEqual(still,to,'reduced motion shows the same appropriate final pose immediately');
   assert.deepEqual(p.state,before,'a scene view has no farm/save/economy effect');
   p.night();p.visit('grove'); // Not a first-morning obligation.
   assert.equal(localBird(p.state),bird);
 }
});

test('desktop 1280 close view magnifies the actual existing bird path without covering the bank composition',()=>{
 const normal=visual.coveFraming({width:1280,height:720},0,.75);
 const observe=visual.coveFraming({width:1280,height:720},1,.75);
 assert.equal(normal.scale,Math.min(1280/(430*.75),520/(280*.75)));
 assert.deepEqual(normal.nativeFocus,{x:1320,y:700});assert.equal(normal.screenLift,72);
 assert.ok(observe.scale>=normal.scale*1.24);
 function project({x,y}:{x:number;y:number}){
   // The existing layout uses scenePoint(raw)=(125.25,37)+0.75*raw.
   return [640+(.75*(x-observe.nativeFocus.x))*observe.scale,
     360+(.75*(y-observe.nativeFocus.y))*observe.scale-observe.screenLift];
 }
 const perch=project(visual.coveObservationPose('watch',0,true)), pool=project(visual.coveObservationPose('wade',0,true));
 assert.ok(pool[1]-perch[1]>120,'visible difference at 1280, not just a changed label');
 for(const [x,y] of [perch,pool])assert.ok(x>=490&&x<=790&&y>=175&&y<=360,'keeps both poses above the control strip');
 const scene=text('island.ts');
 assert.match(scene,/coveObservationPose\(ecology\.animals\.egret\.mode,/);
 assert.match(scene,/draw\('cove-egret', egret, 73/);
 assert.equal((scene.match(/draw\('cove-egret',/g)||[]).length,1);
});

test('one accessible no-cost local toggle without swapping existing tools, trip or cove/fishing choices',()=>{
 const p=earned(), markup=liveCoveMarkup(), f=p.state;
 assert.equal((markup(f).match(new RegExp(ACT,'g'))||[]).length,1);
 assert.match(markup(f),/data-action="cove-watch"[^>]*aria-pressed="false"[^>]*>Понаблюдать за цаплей/);
 assert.match(markup(f,true),/data-action="cove-watch"[^>]*aria-pressed="true"/);
 assert.match(markup(f,true),/aria-description="Цапля наблюдает с насеста."/);
 choose(p,true);assert.match(markup(p.state),/aria-description="Цапля наблюдает с насеста."/);
 p.night();p.visit('grove');assert.match(markup(p.state),/aria-description="Цапля выходит на мелководье."/);
 for(const a of ['cove-fish','cove-choice','sail'])assert.ok(markup(f,true).includes('data-action="'+a+'"'));
 const none=F.createFarm();assert.doesNotMatch(markup(none),/cove-watch/);
 p.visit('home');assert.doesNotMatch(markup(p.state),/cove-watch/);
 assert.equal(isGuardedAction('cove-watch'),true);
});

test('exact local input only affects runtime perspective; stale/offsite, close/back and fishing have no observation commit',()=>{
 const main=text('main.ts'), scene=text('island.ts');
 const a=main.indexOf("    case 'cove-watch': {");
 const b=main.indexOf("    case 'cove-fish':",a);
 assert.ok(a>=0&&b>a);
 const event=stripTypeScriptTypes("switch('cove-watch'){"+main.slice(a,b)+'}');
 const p=earned();
 let toggles=0, observing=false;
 function fire(panel:string,open:boolean,connected:boolean){
   const control={setAttribute(k:string,v:string){assert.equal(k,'aria-pressed');assert.equal(v,String(observing));}};
   runInNewContext(event,{panel,dialog:{open},dialogContent:{contains:(x:unknown)=>x===control&&connected},
      control,farm:p.state,getCoveActions:F.getCoveActions,
      island:{isCoveObserving:()=>observing,setCoveObservation(active:boolean){assert.notEqual(active,observing);observing=active;toggles++;return true;}}});
 }
 const before=structuredClone(p.state);
 fire('cove',true,false);fire('fishing',true,true);fire('cove',false,true);assert.equal(toggles,0);
 fire('cove',true,true);assert.equal(observing,true);
 fire('cove',true,true);assert.equal(observing,false);assert.equal(toggles,2);assert.deepEqual(p.state,before);
 p.visit('home');fire('cove',true,true);assert.equal(toggles,2);
 assert.match(scene,/setCoveFocus\(active: boolean\)[\s\S]{0,210}if \(!active\) coveObservation = undefined/);
 assert.match(main,/case 'cove-fish':openPanel\('fishing'\);break/);
 assert.doesNotMatch(main.slice(a,b),/perform\(|saveFarm\(|sail\(|endDay\(|openPanel\(/);
});

test('real runtime methods reset observation on leaving; the camera never claims a locked, offsite or crossing state',()=>{
 const scene=text('island.ts'), a=scene.indexOf('    setCoveFocus(active: boolean)'), b=scene.indexOf('    setFishing(active: boolean)',a);
 assert.ok(a>=0&&b>a);
 const api=stripTypeScriptTypes('({'+scene.slice(a,b)+'})');
 for(const reduced of [false,true]){
   const p=earned(), before=JSON.stringify(p.state), ctx={
     coveFocus:false,state:p.state,crossing:false,coveBlend:0,coveObservation:undefined,coveObservationBlend:1,hovered:{},
     motion:{matches:reduced},performance:{now:()=>12345},getCoveActions:F.getCoveActions,requestPaint(){},updateCameraView(){},
   };
   const view=runInNewContext(api,ctx);
   assert.equal(view.setCoveObservation(true),false);
   view.setCoveFocus(true);
   ctx.crossing=true;assert.equal(view.setCoveObservation(true),false);ctx.crossing=false;
   assert.equal(view.setCoveObservation(true),true);assert.equal(view.isCoveObserving(),true);
   assert.equal(ctx.coveObservation,12345);
   view.setCoveFocus(false);assert.equal(view.isCoveObserving(),false);
   if(reduced)assert.equal(ctx.coveObservationBlend,0);
   view.setCoveFocus(true);assert.equal(view.isCoveObserving(),false);
   assert.equal(JSON.stringify(p.state),before);
   ctx.state=F.createFarm();assert.equal(view.setCoveObservation(true),false);
   p.visit('home');ctx.state=p.state;assert.equal(view.setCoveObservation(true),false);
 }
});
