import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { ActionClickGuard, ActivationKeyGuard, isGuardedAction } from '../src/action-click-guard.ts';
import { bakeWorkshop, restoreFarm, workshopShapes } from '../src/farm.ts';
import { getDiscoveryTask, getSupplyGuidance } from '../src/discovery-path.ts';
import { getRequirementHint } from '../src/requirement-guidance.ts';
import { pastryGuidanceFixture, pastryProjectFixture } from './fixtures/pastry-guidance.ts';
const seen={collections:true,islands:true};

test('a project needing round buns carries its exact shape rather than the first learned pastry',()=>{
  const farm=pastryProjectFixture(),before=structuredClone(farm);
  const task=getDiscoveryTask(farm,seen)!;
  assert.equal(task.action.target,'workshop');assert.equal(task.action.value,'round');
  assert.match(task.detail,/Круглая булочка/);assert.deepEqual(farm,before);
  const restored=restoreFarm(JSON.parse(JSON.stringify(farm)))!;
  assert.deepEqual(getDiscoveryTask(restored,seen),task);
});

test('all requested handmade shapes survive general supply and requirement guidance without cooking',()=>{
  for(const shape of workshopShapes){
    const farm=pastryGuidanceFixture(),before=structuredClone(farm),item={kind:'handmade' as const,item:shape,quantity:1};
    assert.deepEqual(getSupplyGuidance(farm,item,'общий ужин').action,{label:'В кондитерскую',target:'workshop',value:shape});
    assert.equal(getRequirementHint(farm,{kind:'stock',item}).action.value,shape);
    assert.deepEqual(farm,before);
  }
});

test('missing ingredients, travel and a locked workshop keep their actual preparation routes',()=>{
  const farm=pastryGuidanceFixture(),item={kind:'handmade' as const,item:'long' as const,quantity:1};
  farm.eggs=0;assert.notEqual(getRequirementHint(farm,{kind:'stock',item}).action.target,'workshop');
  farm.eggs=2;farm.produce.wheat=0;assert.notEqual(getRequirementHint(farm,{kind:'stock',item}).action.target,'workshop');
  farm.produce.wheat=4;farm.island='grove';
  assert.deepEqual(getRequirementHint(farm,{kind:'stock',item}).action,{label:'Домой',target:'sail',value:'home'});
  farm.island='home';farm.village.built=false;farm.projects.fair={};
  assert.notEqual(getRequirementHint(farm,{kind:'stock',item}).action.target,'workshop');
});

const path=new URL('../src/main.ts',import.meta.url);
const main=ts.createSourceFile(path.pathname,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);
const js=(source:string)=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
function handlerCases(){const result:ts.CaseClause[]=[];function visit(node:ts.Node){if(ts.isSwitchStatement(node)&&node.expression.getText(main)==='action')for(const clause of node.caseBlock.clauses)if(ts.isCaseClause(clause)&&clause.expression.getText(main)==="'workshop'")result.push(clause);ts.forEachChild(node,visit);}visit(main);return result;}
const workshopCase=handlerCases()[0];assert.ok(workshopCase);
const show=main.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='showRequirement')!;assert.ok(show);

test('actual HUD handler selects every guided shape but preserves manual or malformed choices',()=>{
  for(const previous of workshopShapes)for(const value of [...workshopShapes,undefined,'not-a-shape']){
    const opened:string[]=[],state={value,pastryShape:previous,workshopRecipe:'bread',workshopShapes,openPanel:(panel:string)=>opened.push(panel)};
    runInNewContext(js(`switch('workshop'){${workshopCase.getText(main)}}`),state);
    assert.equal(state.pastryShape,workshopShapes.includes(value as typeof previous)?value:previous);
    assert.equal(state.workshopRecipe,'pastry');assert.deepEqual(opened,['workshop']);
  }
});

test('actual requirement route sets the shape before focusing the workshop, without baking or saving',async()=>{
  for(const shape of workshopShapes){
    const farm=pastryGuidanceFixture(),before=structuredClone(farm),focused:unknown[]=[],calls:string[]=[];
    const state={farm,pastryShape:'folded',workshopShapes,getRequirementHint:()=>({action:{target:'workshop',value:shape}}),
      fieldViewButton:{getAttribute:()=> 'false'},closeDialog:()=>calls.push('close'),
      island:{focusTarget:(place:unknown)=>focused.push([place,state.pastryShape])}};
    await runInNewContext(js(`${show.getText(main)}\nshowRequirement({})`),state);
    assert.equal(state.pastryShape,shape);assert.equal(JSON.stringify(focused),JSON.stringify([[{kind:'workshop'},shape]]));
    assert.deepEqual(calls,['close']);assert.deepEqual(farm,before);
  }
});

test('explicit baking still spends only the existing recipe and grants the selected pastry once',()=>{
  for(const shape of workshopShapes){
    const farm=pastryGuidanceFixture();farm.produce.wheat=2;farm.eggs=1;
    const before=structuredClone(farm);
    assert.equal(getSupplyGuidance(farm,{kind:'handmade',item:shape,quantity:1},'проверка').action.value,shape);
    assert.deepEqual(farm,before);
    assert.equal(bakeWorkshop(farm,shape).ok,true);
    assert.equal(farm.handmade[shape],1);assert.equal(farm.produce.wheat,0);assert.equal(farm.eggs,0);
    assert.equal(farm.workToday,before.workToday+1);assert.equal(farm.coins,before.coins);
    assert.deepEqual(farm.village,before.village,'baking never serves supper or contributes to a project');
    const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(loaded);
    const after=structuredClone(loaded);assert.equal(bakeWorkshop(loaded,shape).ok,false);assert.deepEqual(loaded,after);
  }
});

test('an unknown requirement shape keeps the current choice and cannot become an executable command',async()=>{
  for(const value of [undefined,'unknown','long; bakeWorkshop(farm,"long")']){
    const farm=pastryGuidanceFixture(),before=structuredClone(farm),state={farm,pastryShape:'folded',workshopShapes,
      getRequirementHint:()=>({action:{target:'workshop',value}}),fieldViewButton:{getAttribute:()=> 'false'},
      closeDialog:()=>{},island:{focusTarget:()=>{}}};
    await runInNewContext(js(`${show.getText(main)}\nshowRequirement({})`),state);
    assert.equal(state.pastryShape,'folded');assert.deepEqual(farm,before);
  }
});

test('following the HUD ignores the second click or held Enter, not a later independent gesture',()=>{
  assert.equal(isGuardedAction('follow-task'),true);
  const guard=new ActionClickGuard(),first={detail:1,timeStamp:100,clientX:300,clientY:80};
  guard.remember(first);
  assert.equal(guard.blocks({...first,detail:2,timeStamp:180}),true);
  assert.equal(guard.blocks({...first,detail:1,timeStamp:700}),false);
  assert.equal(guard.blocks({...first,detail:0,timeStamp:200}),false);
  const keyboard=new ActivationKeyGuard();
  assert.equal(keyboard.blocks({key:'Enter',repeat:false},true),false);
  assert.equal(keyboard.blocks({key:'Enter',repeat:true},false),true);
  keyboard.release('Enter');assert.equal(keyboard.blocks({key:'Enter',repeat:false},true),false);
});
