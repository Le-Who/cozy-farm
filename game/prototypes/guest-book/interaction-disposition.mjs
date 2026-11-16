// Opt-in, unstyled DOM disposition test. Never imported by the game.
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from '../../node_modules/typescript/lib/typescript.js';
import * as F from '../../src/farm.ts';import * as Visits from '../../src/neighbor-visits.ts';import {GuestBookView} from '../../src/guest-book-view.ts';
const {JSDOM}=await import(process.env.GUEST_BOOK_DOM_MODULE??'jsdom');
const text=fs.readFileSync(new URL('../../tests/guest-book-prototype.test.ts',import.meta.url),'utf8'),ast=ts.createSourceFile('test.ts',text,ts.ScriptTarget.Latest,true),fixture=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='eligible'),fc={...F,assert};assert.ok(fixture);vm.runInNewContext(ts.transpileModule(fixture.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,fc);
const guardSource=fs.readFileSync(new URL('../../src/action-click-guard.ts',import.meta.url),'utf8');
function specimen(mode,gated=false){
 const w=new JSDOM('<!doctype html><body><section id="book"></section></body>').window,root=w.document.querySelector('#book'),farm=fc.eligible(),view=new GuestBookView();let writes=0,pending=false,selectHeld=false;
 if(gated){farm.neighbors.finn=F.createFarm().neighbors.finn;assert.ok(F.restoreCurrentFarm(structuredClone(farm)))}
 // Existing algorithm; proposed exact keys only in the private test VM.
 const ctx={exports:{},Element:w.Element};vm.runInNewContext(ts.transpileModule(guardSource+"\nguardedActions.add('guest-book-choice');guardedActions.add('guest-book-back');",{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,ctx);ctx.exports.installActionClickGuard(root);
 const label=id=>`${Visits.visitName(Visits.visitActivities[id].resident)} · ${Visits.visitActivities[id].title}`;
 // All nodes, semantic labels and actual actions precede any input.
 root.innerHTML=mode==='buttons'?`<nav aria-label="Выберите встречу">${Visits.visitActivityIds.map(id=>`<button type="button" data-action="guest-book-choice" data-choice="${id}" aria-pressed="false">${label(id)}</button>`).join('')}</nav>`:`<label for="activity">Выберите встречу</label><select id="activity">${['bea','finn'].map(resident=>`<optgroup label="${Visits.visitName(resident)}">${Visits.visitActivityIds.filter(id=>Visits.visitActivities[id].resident===resident).map(id=>`<option value="${id}">${Visits.visitActivities[id].title}</option>`).join('')}</optgroup>`).join('')}</select>`;
 const cta=w.document.createElement('button');cta.type='button';cta.dataset.action='visit-invite';root.append(cta);const select=root.querySelector('select'),choices=[...root.querySelectorAll('[data-choice]')],nodes=[...root.querySelectorAll('*')];
 const current=()=>view.current(farm).commands.find(c=>c.action==='visit-invite');
 function publish(){const c=current();cta.dataset.value=c?.value??'';cta.dataset.context=c?.context??'';cta.disabled=!c?.enabled;pending=false}
 function choose(id){assert.ok(Visits.isVisitActivity(id));view.choose(farm,'resident',Visits.visitActivities[id].resident);view.choose(farm,'activity',id);for(const b of choices)b.setAttribute('aria-pressed',String(b.dataset.choice===id));cta.textContent=current().label;cta.disabled=!current().enabled}
 choose('beaHarvest');publish();
 root.addEventListener('pointerdown',e=>{if(mode!=='select')return;if(e.target===select)selectHeld=true;else if(e.target===cta&&pending){selectHeld=false;publish()}});
 root.addEventListener('keydown',e=>{if(mode!=='select')return;if(e.target===select&&(e.key==='Enter'||e.key===' '))selectHeld=true;else if(e.target===cta&&!e.repeat&&(e.key==='Enter'||e.key===' ')){selectHeld=false;if(pending)publish()}});
 for(const type of ['pointerup','pointercancel','keyup'])w.document.addEventListener(type,()=>{selectHeld=false});w.addEventListener('blur',()=>{selectHeld=false});
 root.addEventListener('change',e=>{if(e.target!==select)return;choose(select.value);pending=true;/* retain old stale executable token until distinct CTA activation */});
 root.addEventListener('click',e=>{
  const choice=e.target.closest?.('[data-choice]');if(choice){choose(choice.dataset.choice);publish();return}
  if(e.target!==cta||cta.disabled)return;
  // Focused assistive activation after release is distinct from popup pointer
  // click-through. No timer, document-wide cooldown or competing capture guard.
  if(pending&&e.detail===0&&w.document.activeElement===cta&&!selectHeld)publish();
  if(pending)return;
  const command=view.resolve(farm,{action:cta.dataset.action,value:cta.dataset.value,context:cta.dataset.context});
  if(command&&Visits.inviteNeighborVisit(farm,command.value).ok){writes++;cta.disabled=true}
 });
 const event=(type,target,options={})=>{const E=type.startsWith('key')?w.KeyboardEvent:type==='change'?w.Event:w.MouseEvent,e=new E(type,{bubbles:true,cancelable:true,...options});if(options.stamp!==undefined)Object.defineProperty(e,'timeStamp',{value:options.stamp});target.dispatchEvent(e);return e};
 const identities=()=>assert.deepEqual([...root.querySelectorAll('*')],nodes,'no node replaced at any point');
 return{w,root,farm,view,cta,select,choices,event,identities,get writes(){return writes},get pending(){return pending},close:()=>w.close()};
}
const results=[];
for(const mode of ['buttons','select']){
 const h=specimen(mode),before=JSON.stringify(h.farm),oldToken={action:'visit-invite',value:h.cta.dataset.value,context:h.cta.dataset.context},target=mode==='buttons'?h.choices.find(b=>b.dataset.choice==='beaFlock'):h.select;
 h.event('pointerdown',target);h.identities();assert.equal(h.view.current(h.farm).activity,'beaHarvest');
 if(mode==='select'){target.value='beaFlock';h.event('change',target);h.identities();assert.equal(h.pending,true)}
 h.event('pointerup',target);h.identities();if(mode==='buttons')h.event('click',target,{detail:1,stamp:100,clientX:100,clientY:100});
 assert.equal(h.view.current(h.farm).activity,'beaFlock');assert.equal(h.view.resolve(h.farm,oldToken),undefined);h.identities();
 const crossing=h.event('click',h.cta,{detail:2,stamp:180,clientX:100,clientY:100});assert.equal(h.writes,0);assert.equal(JSON.stringify(h.farm),before);if(mode==='buttons')assert.equal(crossing.defaultPrevented,true);else assert.equal(h.pending,true);
 // Fresh intentional gesture, SAME CTA, exactly the selected activity.
 h.event('pointerdown',h.cta);h.event('pointerup',h.cta);h.event('click',h.cta,{detail:1,stamp:800,clientX:100,clientY:100});assert.equal(h.writes,1);assert.equal(h.farm.neighborVisits.active.activity,'beaFlock');assert.equal(h.farm.neighborVisits.active.serial,1);h.identities();h.event('click',h.cta,{detail:2,stamp:880,clientX:100,clientY:100});assert.equal(h.writes,1);
 const accepted={action:'visit-invite',value:h.cta.dataset.value,context:h.cta.dataset.context};assert.equal(h.view.resolve(h.farm,accepted),undefined);assert.ok(F.endDay(h.farm).ok);assert.equal(h.view.resolve(h.farm,accepted),undefined);assert.ok(F.restoreCurrentFarm(structuredClone(h.farm)));
 results.push({mode,identityRetained:true,pendingPublication:mode==='select',sameGestureWrites:0,freshGestureWrites:1,exactActivity:'beaFlock',staleDayAndSerialRejected:true});h.close();
}
for(const mode of ['buttons','select']){
 const h=specimen(mode),target=mode==='buttons'?h.choices.find(b=>b.dataset.choice==='beaHands'):h.select;target.focus();h.event('keydown',target,{key:'Enter'});
 if(mode==='select'){target.value='beaHands';h.event('change',target)}else h.event('click',target,{detail:0});h.identities();
 const held=h.event('keydown',h.cta,{key:'Enter',repeat:true});assert.equal(held.defaultPrevented,true);assert.equal(h.writes,0);h.event('keyup',target,{key:'Enter'});h.cta.focus();h.event('keydown',h.cta,{key:'Enter'});h.event('click',h.cta,{detail:0});assert.equal(h.writes,1);assert.equal(h.farm.neighborVisits.active.activity,'beaHands');h.identities();h.close();
}
{const h=specimen('select');h.select.focus();h.event('pointerdown',h.select);h.select.value='beaFlock';h.event('change',h.select);h.event('click',h.cta,{detail:0});assert.equal(h.writes,0);h.event('pointercancel',h.select);h.cta.focus();h.event('click',h.cta,{detail:0});assert.equal(h.writes,1);h.identities();h.close()}
// Readiness remains truthful while the executable token is pending: a locked
// Finn choice cannot trap the same CTA disabled after selecting eligible Bea.
{const h=specimen('select',true),before=JSON.stringify(h.farm);h.select.value='finnGarden';h.event('change',h.select);assert.equal(h.cta.disabled,true);h.select.value='beaFlock';h.event('change',h.select);assert.equal(h.cta.disabled,false);assert.equal(h.pending,true);h.event('click',h.cta,{detail:1,stamp:100});assert.equal(h.writes,0);assert.equal(JSON.stringify(h.farm),before);h.event('pointerdown',h.cta);h.event('pointerup',h.cta);h.event('click',h.cta,{detail:1,stamp:800});assert.equal(h.writes,1);assert.equal(h.farm.neighborVisits.active.activity,'beaFlock');h.identities();h.close()}
console.log(JSON.stringify({recommended:'upfront buttons, existing capture guard with two explicit future IDs',results,keyboardAndFocusedAssistiveChecks:true,productionChanges:0,native:false,selectCondition:'local pending publication/origin contract required; DOM identity alone is NOT sufficient'},null,2));
