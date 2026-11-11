import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contributeVillage, endDay, getVillageProject, restoreFarm } from '../src/farm.ts';
import { villageBudgetFixture } from './fixtures/village-budget.ts';

test('a partial village contribution keeps coins and survives another morning and reload', () => {
  const farm=villageBudgetFixture();
  assert.ok(contributeVillage(farm).ok);
  assert.equal(farm.coins,20);assert.equal(farm.village.built,false);
  assert.deepEqual(farm.village.supplies,{'handmade:round':1,'fish:seaBass':2,honey:2});
  const supplies=structuredClone(farm.village.supplies);
  endDay(farm);const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;
  assert.ok(loaded);assert.deepEqual(loaded.village.supplies,supplies);assert.equal(loaded.coins,20);
});

test('all supplies can wait without charging coins when the construction budget is short', () => {
  const farm=villageBudgetFixture();farm.handmade.round=2;
  assert.ok(contributeVillage(farm).ok);
  assert.equal(farm.coins,20);assert.equal(farm.village.built,false);
  assert.ok(getVillageProject(farm).items.every(({item,delivered})=>delivered===item.quantity));
  const before=structuredClone(farm);
  assert.equal(contributeVillage(farm).ok,false);assert.deepEqual(farm,before);assert.ok(restoreFarm(farm));
});

test('only explicit finishing with sufficient coins charges the existing price exactly once', () => {
  const farm=villageBudgetFixture();farm.handmade.round=2;contributeVillage(farm);farm.coins=50;
  const price=getVillageProject(farm).coins;
  assert.equal(price,48);assert.ok(contributeVillage(farm).ok);
  assert.equal(farm.coins,50-price);assert.equal(farm.village.built,true);
  const before=structuredClone(farm);
  assert.equal(contributeVillage(farm).ok,false);assert.deepEqual(farm,before);assert.ok(restoreFarm(farm));
});

test('an attempt from the wrong shore does not spend the displayed budget or supplies', () => {
  const farm=villageBudgetFixture();farm.island='grove';farm.coins=50;farm.handmade.round=2;
  const before=structuredClone(farm);
  assert.equal(contributeVillage(farm).ok,false);assert.deepEqual(farm,before);
});

test('the unfinished project shows the full price and current shortage before any contribution', async () => {
  const {renderVillageBudget}=await import('../src/village-budget.ts');
  const farm=villageBudgetFixture(),before=structuredClone(farm);
  const html=renderVillageBudget(farm,'',(content,ready)=>`<li data-ready="${ready}">${content}</li>`);
  assert.match(html,/Постройка · 48 монет/);assert.match(html,/У вас: 20 монет/);assert.match(html,/Не хватает: 28 монет/);
  assert.match(html,/Как накопить/);assert.match(html,/только при завершении/);assert.match(html,/останется в проекте после отдыха/);
  assert.deepEqual(farm,before);
  assert.equal(renderVillageBudget(restoreFarm(JSON.parse(JSON.stringify(farm)))!,'',(content,ready)=>`<li data-ready="${ready}">${content}</li>`),html);
});

test('changed funds render immediately and stale guidance cannot auto-sell, contribute or build', async () => {
  const {renderVillageBudget}=await import('../src/village-budget.ts');
  const {getRequirementHint}=await import('../src/requirement-guidance.ts');
  const farm=villageBudgetFixture();
  const requirement={kind:'journey',island:'village',id:'village-coins'} as const;
  const before=structuredClone(farm),hint=getRequirementHint(farm,requirement);
  assert.equal(hint.action.target,'visit-market');assert.equal(hint.action.value,'sell');assert.deepEqual(farm,before);
  farm.coins=50;const changed=structuredClone(farm);
  const html=renderVillageBudget(farm,'',(content,ready)=>`<li data-ready="${ready}">${content}</li>`);
  assert.match(html,/data-ready="true"/);assert.match(html,/У вас: 50 монет/);assert.doesNotMatch(html,/Как накопить|Не хватает/);
  assert.equal(getRequirementHint(farm,requirement).action.target,'village-project');assert.deepEqual(farm,changed);
  farm.handmade.round=2;contributeVillage(farm);
  assert.equal(renderVillageBudget(farm,'',content=>content),'');
});


test('the explicit final contribution can also finish construction and charge once in the same action', () => {
  const farm=villageBudgetFixture(true);
  assert.deepEqual(farm.village.supplies,{});
  assert.ok(contributeVillage(farm).ok);
  assert.equal(farm.village.built,true);assert.equal(farm.coins,2);assert.equal(farm.workToday,1);
  assert.deepEqual(farm.village.supplies,{'handmade:round':2,'fish:seaBass':2,honey:2});
  assert.equal(farm.handmade.round,0);assert.equal(farm.fish.seaBass,0);assert.equal(farm.honey,0);
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))));
  const before=structuredClone(farm);
  assert.equal(contributeVillage(farm).ok,false);assert.deepEqual(farm,before);
});
