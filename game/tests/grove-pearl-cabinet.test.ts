import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import * as farm from '../src/farm.ts';
import { ActivationKeyGuard, ActionClickGuard, isGuardedAction } from '../src/action-click-guard.ts';
import { expeditionWallet, reserveShopGoods, transferBayGoods } from '../src/harbour-economy.ts';
import { getShoalFindAt } from '../src/shoal.ts';
import { commissionPlayer } from './fixtures/commission-player.ts';

const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'));
const source = (leaf: string) => readFileSync(new URL('../src/' + leaf, import.meta.url), 'utf8');
const pearl = { kind:'shoalFinds', item:'pearl', quantity:1 } as const;
const pearlKey = 'shoalFinds:pearl';
const snapshot = (f: farm.FarmState) => JSON.stringify(f);
const stock = (f: farm.FarmState) => [f.shoalFinds.pearl, farm.ingredientCount(f,pearl), f.coins];
const quote = (f: farm.FarmState) => farm.getMarketBasket(f,[{key:pearlKey,quantity:1}]);
const reload = (f: farm.FarmState) => {
  const restored = farm.restoreCurrentFarm(JSON.parse(snapshot(f)));
  assert.ok(restored);
  return restored;
};
function earned() {
  const player = commissionPlayer(opening.slice(0,55));
  assert.equal(player.state.day,6);
  player.visit('grove');
  for (const shell of ['regular','moon']) {
    const spot = [0,1,2].find(i=>farm.getShellAt(player.state,i)===shell);
    assert.notEqual(spot,undefined);
    player.act('collectShell',spot);
  }
  player.act('collectShoalFind','glass');player.visit('home');
  for(let i=55;player.state.day<11;i++){const a=opening[i];player.act(a.name,...a.args)}
  player.visit('grove');
  assert.equal(getShoalFindAt(player.state,'pearl'),'pearl');
  player.act('collectShoalFind','pearl');
  assert.equal(player.actions,99);
  assert.deepEqual(stock(player.state),[1,1,72]);
  assert.equal(createHash('sha256').update(snapshot(player.state)).digest('hex'),'0d5f8bd390bd53c3fc72a142dad1e2bac9f4f94bbbdc5f09a02a8af8ef9b5833');
  return player.state;
}

test('earned local stand: one reversible placement, read-only preview, no fare, work, seeds or discovery changes',()=>{
  const f=earned(), before=snapshot(f);
  assert.equal(farm.hasBayDisplay(f),true);
  assert.equal(farm.grovePearlCabinet(f),'place');
  assert.equal(snapshot(f),before);
  assert.equal(farm.setGrovePearlCabinet(f,'place'),true);
  assert.equal(farm.grovePearlCabinet(f),'take');
  assert.deepEqual(stock(f),[1,0,72]);
  const marked=snapshot(f);
  assert.equal(farm.setGrovePearlCabinet(f,'place'),false);
  assert.equal(snapshot(f),marked);
  const restored=reload(f);
  assert.equal(farm.grovePearlCabinet(restored),'take');
  assert.equal(farm.setGrovePearlCabinet(restored,'take'),true);
  assert.equal(farm.setGrovePearlCabinet(restored,'take'),false);
  assert.equal(snapshot(restored),before);
});

test('offsite stale choice, sale, bulk, freight and shelf cannot spend the displayed pearl',()=>{
  const f=earned(), untouched=structuredClone(f);
  assert.equal(farm.setGrovePearlCabinet(f,'place'),true);
  for(const island of ['cape','village','home'] as const){
    assert.equal(farm.sail(f,island).ok,true);
    const before=snapshot(f);
    assert.equal(farm.grovePearlCabinet(f),'hidden');
    assert.equal(farm.setGrovePearlCabinet(f,'take'),false);
    assert.equal(transferBayGoods(f,'deposit',island,'pearl',1).ok,false);
    if(island==='village')assert.equal(reserveShopGoods(f,'pearl',1),false);
    assert.equal(expeditionWallet(f).bag.pearl,0);
    assert.equal(snapshot(f),before);
  }
  assert.equal(farm.sail(untouched,'home').ok,true);
  const quotedBefore=quote(untouched);
  assert.equal(quotedBefore?.total,18);
  assert.equal(quote(f),undefined);
  assert.equal(farm.sellMarketBasket(f,[{key:pearlKey,quantity:1}],quotedBefore?.token).ok,false);
  assert.equal(farm.sellMarketItem(f,pearlKey).ok,false);
  assert.equal(farm.getSale(untouched).coins-farm.getSale(f).coins,18);
  assert.equal(farm.sellProduce(f).ok,true);
  assert.deepEqual(stock(f).slice(0,2),[1,0]);
  assert.equal(farm.grovePearlCabinet(reload(f)),'hidden');
  assert.equal(farm.sail(f,'grove').ok,true);
  assert.equal(farm.grovePearlCabinet(f),'take');
});

test('a second ordinary pearl stays saleable, and no-marker older state recovers the first as normal inventory',()=>{
  let f=earned();
  assert.equal(farm.setGrovePearlCabinet(f,'place'),true);
  const oldNormalized=JSON.parse(snapshot(f));
  delete oldNormalized.grovePearlDisplay; // Exact b05 writer comparison is a separate pinned legacy/current test.
  const recovered=farm.restoreCurrentFarm(oldNormalized);
  assert.ok(recovered);
  assert.equal(farm.grovePearlCabinet(recovered),'place');
  assert.deepEqual(stock(recovered),[1,1,72]);
  assert.equal(farm.sail(recovered,'home').ok,true);
  assert.equal(farm.sellMarketItem(recovered,pearlKey).ok,true);
  recovered.grovePearlDisplay=true; // Reject a stale value even after a legitimate old-version sale.
  assert.equal(farm.sail(recovered,'grove').ok,true);
  assert.equal(farm.grovePearlCabinet(reload(recovered)),'empty');
  assert.equal(farm.sail(f,'home').ok,true);
  while(f.day<16){assert.equal(farm.endDay(f).ok,true);f=reload(f);}
  assert.equal(farm.sail(f,'grove').ok,true);
  assert.equal(farm.collectShoalFind(f,'pearl').ok,true);
  assert.deepEqual(stock(f),[2,1,72]);
  assert.equal(farm.sail(f,'home').ok,true);
  assert.equal(farm.sellMarketItem(f,pearlKey).ok,true);
  assert.deepEqual(stock(f),[1,0,90]);
});

test('plain warehouse stock is not a display and the ordinary physical gate is still required',()=>{
  const f=earned();
  assert.equal(transferBayGoods(f,'deposit','grove','pearl',1).ok,true);
  assert.equal(farm.grovePearlCabinet(reload(f)),'empty');
  assert.equal(farm.setGrovePearlCabinet(f,'take'),false);
  const early=commissionPlayer(opening.slice(0,15)).state;
  assert.equal(early.island,'grove');
  assert.equal(farm.hasBayDisplay(early),false);
  assert.equal(farm.grovePearlCabinet(early),'hidden');
});

test('only physical Grove entry owns the action; read-only Archive and ordinary tabs share the existing content',()=>{
  const main=source('main.ts');
  const entry=main.slice(main.indexOf("    case 'bay-display':\n"),main.indexOf("    case 'harbor': if (farm.island"));
  assert.match(entry,/case 'bay-display':[\s\S]*farm\.island === 'grove'[\s\S]*hasBayDisplay\(farm\)[\s\S]*openPanel\('grove-display'\)/);
  assert.doesNotMatch(entry,/openPanel\('archive'\)|saveFarm\(|setGrovePearlCabinet\(/);
  assert.match(main,/case 'archive':[\s\S]{0,25}case 'grove-display':[\s\S]{0,290}panel === 'grove-display' && archiveGroup === 'bay'/);
  assert.match(main,/if \(next === 'archive' \|\| next === 'boat'\) \{\s*farm\.orientation/);
  assert.match(main,/case 'grove-pearl-display': \{[\s\S]{0,230}panel !== 'grove-display'[\s\S]{0,150}!dialogContent\.contains\(control\)/);
  assert.match(main,/Поставить жемчужину/);
  assert.match(main,/Забрать жемчужину/);
  assert.match(main,/querySelector<HTMLButtonElement>\('\[data-action="grove-pearl-display"\]'\)\?\.focus\(\{preventScroll:true\}\)/);
});

test('physical pearl adds one existing sprite to the earned stand, never another target or collection opportunity',()=>{
  const scene=source('island.ts');
  const block=scene.match(/if \(atGrove && state && hasBayDisplay\(state\)\) \{([\s\S]*?)\n    \}/)?.[1];
  assert.ok(block);
  assert.match(block,/art\.draw\(world, 'bay-display', displayFoot\.x, displayFoot\.y/);
  assert.match(block,/grovePearlCabinet\(state\) === 'take'[\s\S]*art\.draw\(world, 'ui-moon-pearl', displayFoot\.x \+ \d+, displayFoot\.y - \d+/);
  assert.equal(scene.match(/sites\.push\(displaySite\)/g)?.length,1);
});

test('existing gesture guard prevents double tap (including detail=1 after redraw) and held Enter/Space from reversing the first choice',()=>{
  assert.equal(isGuardedAction('grove-pearl-display'),true);
  const pointer=new ActionClickGuard();
  pointer.remember({detail:1,timeStamp:100,clientX:410,clientY:310});
  assert.equal(pointer.blocks({detail:1,timeStamp:168,clientX:410,clientY:310}),true);
  assert.equal(pointer.blocks({detail:2,timeStamp:168,clientX:410,clientY:310}),true);
  assert.equal(pointer.blocks({detail:1,timeStamp:168,clientX:428,clientY:313}),false,'distinct physical point is not blocked');
  assert.equal(pointer.blocks({detail:1,timeStamp:615,clientX:410,clientY:310}),false);
  const input=new ActivationKeyGuard();
  for(const key of ['Enter',' ']){
    assert.equal(input.blocks({key,repeat:false},true),false);
    assert.equal(input.blocks({key,repeat:true},true),true);
    input.release(key);
    assert.equal(input.blocks({key,repeat:false},true),false);
    input.release(key);
  }
});

test('exact Archive render: cupboard action is first and unique, familiar tabs remain; no mutation even when empty',()=>{
  const main=source('main.ts'), start=main.indexOf("    case 'archive':\n");
  const end=main.indexOf("    case 'hive': {",start);
  assert.ok(start>=0&&end>start);
  const draw=stripTypeScriptTypes('switch(panel){'+main.slice(start,end)+'}');
  const f=earned();
  function render(panel:string,archiveGroup:string){
    const dialogContent={innerHTML:''}, buttons:Array<[string,string,string]>=[];
    const before=snapshot(f);
    runInNewContext(draw,{panel,archiveGroup,dialogContent,farm:f,grovePearlCabinet:farm.grovePearlCabinet,
      archiveCards:()=>'<archive>',panelTabs:()=>'<tabs>',nav:(b:string)=>b,
      button:(label:string,action:string,enabled:boolean,{value}:{value:string})=>{assert.equal(enabled,true);buttons.push([label,action,value]);return '<primary>'}});
    assert.equal(snapshot(f),before);
    return {html:dialogContent.innerHTML,buttons};
  }
  assert.deepEqual(render('grove-display','bay'),{html:'<primary><tabs><archive>',buttons:[['Поставить жемчужину','grove-pearl-display','place']]});
  assert.deepEqual(render('archive','bay'),{html:'<tabs><archive>',buttons:[]});
  assert.deepEqual(render('grove-display','shore'),{html:'<tabs><archive>',buttons:[]});
  assert.ok(farm.setGrovePearlCabinet(f,'place'));
  assert.deepEqual(render('grove-display','bay'),{html:'<primary><tabs><archive>',buttons:[['Забрать жемчужину','grove-pearl-display','take']]});
  assert.ok(farm.setGrovePearlCabinet(f,'take'));
  assert.ok(transferBayGoods(f,'deposit','grove','pearl',1).ok);
  assert.deepEqual(render('grove-display','bay'),{html:'<tabs><archive>',buttons:[]});
});

test('exact action handler rejects stale, alternate tab, detached and ordinary Archive controls; only explicit local actions request a write',()=>{
  const main=source('main.ts'), start=main.indexOf("    case 'grove-pearl-display': {");
  const end=main.indexOf("    case 'archive-group':",start);
  assert.ok(start>=0&&end>start);
  const dispatch=stripTypeScriptTypes("switch ('grove-pearl-display'){"+main.slice(start,end)+'}');
  const f=earned(), initial=snapshot(f);
  let writes=0,focus=0; const labels:string[]=[];
  function fire(value:string,panel='grove-display',archiveGroup='bay',open=true,connected=true) {
    const control={}, target={focus:()=>{focus++}};
    runInNewContext(dispatch,{
      value,panel,archiveGroup,dialog:{open},control,document:{activeElement:control},
      dialogContent:{contains:(x:object)=>x===control&&connected,querySelector:(s:string)=>{
        assert.equal(s,'[data-action="grove-pearl-display"]');return target;
      }},
      farm:f,grovePearlCabinet:farm.grovePearlCabinet,setGrovePearlCabinet:farm.setGrovePearlCabinet,
      perform:(action:()=>{ok:boolean;message:string},dismiss:boolean,quiet:boolean)=>{
        assert.equal(dismiss,false);assert.equal(quiet,true);
        const result=action();assert.equal(result.ok,true);writes++;labels.push(result.message);return result.ok;
      },
    });
  }
  fire('place','archive');fire('place','grove-display','shore');fire('place','grove-display','bay',false);
  fire('place','grove-display','bay',true,false);fire('take');fire('fake');
  assert.equal(writes,0);assert.equal(snapshot(f),initial);
  fire('place');fire('place');
  assert.equal(writes,1);assert.equal(focus,1);assert.deepEqual(stock(f),[1,0,72]);
  fire('take');fire('take');
  assert.equal(writes,2);assert.equal(focus,2);assert.equal(snapshot(f),initial);
  assert.deepEqual(labels,['Жемчужина на витрине.','Жемчужина в припасах.']);
});
