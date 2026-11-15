// Opt-in DOM harness. No browser, production mount or global schema edit.
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from '../../node_modules/typescript/lib/typescript.js';
import * as F from '../../src/farm.ts';import * as Visits from '../../src/neighbor-visits.ts';import {GuestBookView} from '../../src/guest-book-view.ts';import {renderGuestBookPrototype} from '../../src/guest-book-prototype.ts';import {GuestBookActionAdapter,guestBookGuardProposal} from '../../src/guest-book-action-adapter.ts';
const {JSDOM}=await import(process.env.GUEST_BOOK_DOM_MODULE??'jsdom');
const guardSource=fs.readFileSync(new URL('../../src/action-click-guard.ts',import.meta.url),'utf8'),fixtureSource=fs.readFileSync(new URL('../../tests/guest-book-prototype.test.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('fixture.ts',fixtureSource,ts.ScriptTarget.Latest,true),fixture=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='eligible');assert.ok(fixture);const fContext={...F,assert};vm.runInNewContext(ts.transpileModule(fixture.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,fContext);
const results=[];function run(name,fn){fn();results.push({name,pass:true})}
function host(proposedKeys=false){
 const dom=new JSDOM('<!doctype html><body><div id="root"></div></body>'),w=dom.window,root=w.document.querySelector('#root'),farm=fContext.eligible(),view=new GuestBookView(),state={open:true,writes:0,legacy:0,parentBack:0};
 // Exact current installer. Proposal adds only two keys in this private VM.
 const code=ts.transpileModule(guardSource+(proposedKeys?guestBookGuardProposal.map(id=>`\nguardedActions.add('${id}')`).join(''):''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,ctx={exports:{},Element:w.Element};vm.runInNewContext(code,ctx);ctx.exports.installActionClickGuard(root);
 function render(focus){
  // Outset markup BEFORE parsing/insertion. Actual renderer remains untouched.
  root.innerHTML=renderGuestBookPrototype(farm,view,()=> '')
   .replace(/data-guest-command="([^"]+)"/g,'data-action="$1" data-guest-command="$1"')
   .replace(/data-guest-choice="([^"]+)"/g,'data-action="guest-book-choice" data-guest-choice="$1"')
   .replace(/data-guest-back(?=>)/g,'data-action="guest-book-back" data-guest-back');
  if(focus)[...root.querySelectorAll('[data-guest-choice]')].find(e=>e.dataset.guestChoice===focus.part&&(e.tagName==='SELECT'||e.dataset.value===focus.value))?.focus();
 }
 const adapter=new GuestBookActionAdapter({root,view,farm:()=>farm,active:()=>state.open,redraw:render,dispatch(command){
  if(command.action==='close'){state.open=false;return}let result;
  if(command.action==='visit-invite')result=Visits.inviteNeighborVisit(farm,command.value);
  else if(command.action==='visit-introduce-hen'){const[serial,id]=command.value.split(':').map(Number);if(farm.neighborVisits.active?.serial===serial)result=F.introduceHenToVisitor(farm,id)}
  else if(command.action==='visit-reply'||command.action==='visit-finish'){const[serial,reply]=command.value.split(':');result=Visits.finishNeighborVisit(farm,Number(serial),reply)}
  else if(command.action==='visit-do')assert.equal(String(farm.neighborVisits.active?.serial),command.value);
  if(result?.ok){state.writes++;render()}
 }});
 // One host delegated handler, not a competing adapter listener.
 root.addEventListener('click',e=>{if(adapter.click(e))return;state.legacy++});root.addEventListener('change',e=>adapter.change(e));
 function back(e){if(e.defaultPrevented)return;if(e.type==='keydown'&&e.repeat){e.preventDefault();return}if(adapter.back(e))return;state.parentBack++;e.preventDefault()}
 root.addEventListener('cancel',back);root.addEventListener('keydown',e=>{if(e.key==='Escape'||e.altKey&&e.key==='ArrowLeft')back(e)});render();
 const select=q=>root.querySelector(q);
 function click(control,stamp=1000,detail=1){assert.ok(control);const e=new w.MouseEvent('click',{bubbles:true,cancelable:true,detail,clientX:200,clientY:180});Object.defineProperty(e,'timeStamp',{value:stamp});control.dispatchEvent(e);return e}
 function key(control,key,repeat=false,altKey=false){const e=new w.KeyboardEvent('keydown',{key,repeat,altKey,bubbles:true,cancelable:true});control.dispatchEvent(e);return e}
 function release(key){w.document.dispatchEvent(new w.KeyboardEvent('keyup',{key,bubbles:true}))}
 function change(value){const s=select('select[data-guest-choice="activity"]');s.value=value;s.dispatchEvent(new w.Event('change',{bubbles:true,cancelable:true}));return s}
 return{state,root,w,view,farm,adapter,select,click,key,release,change,render,close:()=>w.close()}
}
run('six exact choices use actual labeled select; read-only changes restore select focus',()=>{
 const h=host(),before=JSON.stringify(h.farm);for(const [i,id]of Visits.visitActivityIds.entries()){h.click(h.select(`[data-guest-choice="resident"][data-value="${Visits.visitActivities[id].resident}"]`),1000+i*1000);h.change(id);assert.equal(h.view.current(h.farm).activity,id);assert.equal(h.root.querySelectorAll('select[data-guest-choice="activity"] option').length,3);assert.equal(h.w.document.activeElement,h.select('select[data-guest-choice="activity"]'));const invite=h.select('[data-guest-command="visit-invite"]');assert.equal(invite.dataset.value,id);assert.equal(invite.dataset.action,'visit-invite');assert.equal(invite.disabled,false)}assert.equal(JSON.stringify(h.farm),before);assert.equal(h.state.writes,0);h.close();
});
run('current capture guard blocks second command crossing click after fresh active redraw',()=>{
 const h=host();h.change('beaFlock');h.click(h.select('[data-guest-command="visit-invite"]'),100);assert.equal(h.state.writes,1);assert.equal(h.farm.neighborVisits.active.activity,'beaFlock');const second=h.click(h.select('[data-guest-command="visit-introduce-hen"]'),180,2);assert.equal(second.defaultPrevented,true);assert.equal(h.state.writes,1);assert.equal(h.farm.neighborVisits.active.observation,null);h.click(h.select('[data-guest-command="visit-introduce-hen"]'),701);assert.equal(h.state.writes,2);assert.ok(h.farm.neighborVisits.active.observation);assert.equal(h.state.legacy,0);h.close();
});
run('current held-key guard owns fresh replacement commands until keyup',()=>{
 for(const key of ['Enter',' ']){const h=host();h.change('beaFlock');const invite=h.select('[data-guest-command="visit-invite"]');assert.equal(h.key(invite,key).defaultPrevented,false);h.click(invite,100,0);assert.equal(h.state.writes,1);for(let i=0;i<8;i++){const next=h.select('[data-guest-command="visit-introduce-hen"]'),e=h.key(next,key,true);if(!e.defaultPrevented)h.click(next,120+i,0);assert.equal(e.defaultPrevented,true)}assert.equal(h.state.writes,1);h.release(key);const next=h.select('[data-guest-command="visit-introduce-hen"]');assert.equal(h.key(next,key).defaultPrevented,false);h.click(next,200,0);assert.equal(h.state.writes,2);h.close()}
});
run('two proposed button IDs close choice → fresh invite crossing gap with same capture algorithm',()=>{
 for(const proposed of [false,true]){const h=host(proposed);h.click(h.select('[data-guest-choice="resident"][data-value="finn"]'),100);const second=h.click(h.select('[data-guest-command="visit-invite"]'),180,2);assert.equal(second.defaultPrevented,proposed);assert.equal(h.state.writes,proposed?0:1);if(proposed)assert.equal(h.farm.neighborVisits.active,null);h.close()}
});
run('proposed choice and Back buttons retain held-key ownership without a parallel guard',()=>{
 const h=host(true),choice=h.select('[data-guest-choice="resident"][data-value="finn"]');assert.equal(h.key(choice,'Enter').defaultPrevented,false);h.click(choice,100,0);assert.equal(h.key(h.select('[data-guest-command="visit-invite"]'),'Enter',true).defaultPrevented,true);assert.equal(h.state.writes,0);h.release('Enter');h.click(h.select('[data-guest-choice="page"][data-value="rules"]'),800);const back=h.select('[data-guest-back]');assert.equal(h.key(back,'Enter').defaultPrevented,false);h.click(back,900,0);assert.equal(h.view.current(h.farm).kind,'invitation');assert.equal(h.key(h.select('[data-guest-command="visit-invite"]'),'Enter',true).defaultPrevented,true);assert.equal(h.state.writes,0);h.close();
});
run('HOLD: native select remount has unowned pointer interval despite focus restore and two proposed IDs',()=>{
 const h=host(true),select=h.select('select[data-guest-choice="activity"]');select.dispatchEvent(new h.w.MouseEvent('pointerdown',{bubbles:true,cancelable:true,clientX:200,clientY:180}));h.change('beaFlock');assert.notEqual(h.select('select[data-guest-choice="activity"]'),select);assert.equal(h.w.document.activeElement,h.select('select[data-guest-choice="activity"]'));const invite=h.select('[data-guest-command="visit-invite"]');invite.dispatchEvent(new h.w.MouseEvent('pointerup',{bubbles:true,cancelable:true,clientX:200,clientY:180}));assert.equal(h.click(invite,180).defaultPrevented,false);assert.equal(h.state.writes,1,'adversarial retargeted click executes: integration must remain HOLD');h.close();
});
run('live guest beats preview; exact paired replies, stale phase/node/context and no fallthrough',()=>{
 const h=host();h.click(h.select('[data-guest-choice="resident"][data-value="finn"]'),100);h.change('finnOrchard');const choice=h.view.snapshot();assert.ok(Visits.inviteNeighborVisit(h.farm,'beaFlock').ok);h.render();assert.equal(h.view.current(h.farm).activity,'beaFlock');const stale=h.select('[data-guest-command="visit-introduce-hen"]');h.click(stale,1000);assert.equal(h.state.writes,1);assert.deepEqual([...h.root.querySelectorAll('[data-guest-command="visit-reply"]')].map(e=>e.dataset.value),['1:quiet','1:curious']);assert.equal(h.adapter.click({target:stale,defaultPrevented:false}),false);const before=JSON.stringify(h.farm);h.click(h.select('[data-guest-choice="page"][data-value="memories"]'),2000);h.key(h.root,'Escape');assert.equal(h.view.current(h.farm).kind,'active');assert.equal(h.view.current(h.farm).activity,'beaFlock');assert.deepEqual(h.view.snapshot(),choice);assert.equal(JSON.stringify(h.farm),before);const command=h.select('[data-guest-command="visit-reply"]');command.dataset.context='stale';h.click(command,3000);assert.equal(JSON.stringify(h.farm),before);assert.equal(h.state.legacy,0);h.close();
});
run('button/Escape/cancel/Alt+Left consume nested page before host Back without ending guest',()=>{
 for(const route of ['button','escape','cancel','alt-left']){const h=host(true);assert.ok(Visits.inviteNeighborVisit(h.farm,'beaFlock').ok);h.render();h.click(h.select('[data-guest-choice="page"][data-value="rules"]'),100);const before=JSON.stringify(h.farm);if(route==='button')h.click(h.select('[data-guest-back]'),701);else if(route==='cancel')h.root.dispatchEvent(new h.w.Event('cancel',{cancelable:true}));else h.key(h.root,route==='escape'?'Escape':'ArrowLeft',false,route==='alt-left');assert.equal(h.view.current(h.farm).kind,'active');assert.equal(h.state.parentBack,0);assert.equal(JSON.stringify(h.farm),before);assert.equal(h.state.writes,0);h.key(h.root,'Escape');assert.equal(h.state.parentBack,1);h.key(h.root,'Escape',true);assert.equal(h.state.parentBack,1);assert.equal(JSON.stringify(h.farm),before);h.close()}
});
run('Close is not Finish; wrong panel and original inert attributes do not dispatch',()=>{
 const h=host();assert.ok(Visits.inviteNeighborVisit(h.farm,'beaFlock').ok);h.render();const before=JSON.stringify(h.farm);h.click(h.select('[data-guest-command="close"]'));assert.equal(h.state.open,false);assert.equal(JSON.stringify(h.farm),before);assert.equal(h.state.writes,0);assert.equal(h.adapter.click({target:h.select('[data-guest-command="visit-finish"]'),defaultPrevented:false}),false);h.state.open=true;h.root.innerHTML=renderGuestBookPrototype(h.farm,h.view,()=> '');assert.equal(h.adapter.click({target:h.select('[data-guest-command="visit-finish"]'),defaultPrevented:false}),false);assert.equal(JSON.stringify(h.farm),before);h.close();
});
console.log(JSON.stringify({status:'HOLD FOR INTEGRATION: native select remount has an unowned pointer interval',cases:results,guardEdits:'none; two proposed IDs are private-VM set additions only',native:false,fixture:'existing restored-valid synthetic prototype fixture, not earned/native'},null,2));
