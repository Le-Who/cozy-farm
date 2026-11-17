import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectContributionCopy, projectLevelCopy, projectRewardLabel } from '../src/project-readiness-copy.ts'
import { createFarm, getProject, deliverProject } from '../src/farm.ts'

test('labels distinguish deposited requirements from what this contribution can transfer',()=>{
 const progress={item:{kind:'produce' as const,item:'carrot' as const,quantity:4},delivered:0,available:2},before=structuredClone(progress)
 assert.deepEqual(projectContributionCopy(progress),{delivered:'Внесено: 0/4',available:'Можно внести: 2'})
 assert.deepEqual(projectContributionCopy({...progress,delivered:2,available:0}),{delivered:'Внесено: 2/4',available:'Можно внести: 0'})
 assert.deepEqual(progress,before)
})
test('upgrade copy shows the real level, including levels beyond the required second level',()=>{
 assert.equal(projectLevelCopy(1),'Ур. 1 → 2');assert.equal(projectLevelCopy(2),'Ур. 2');assert.equal(projectLevelCopy(3),'Ур. 3')
})
test('reward copy cannot imply that partial delivery or completed projects pay again',()=>{
 const farm=createFarm();farm.buildingLevels={farmhouse:2,coop:2,well:2};farm.produce.carrot=2
 const ready=getProject(farm,'fair'),coins=farm.coins
 assert.equal(projectRewardLabel(ready.status),'Награда')
 assert.equal(projectContributionCopy(ready.items[2]).available,'Можно внести: 2')
 assert.ok(deliverProject(farm,'fair').ok);assert.equal(farm.coins,coins)
 assert.equal(projectRewardLabel(getProject(farm,'fair').status),'Награда')
 farm.produce.carrot=2;farm.produce.wheat=3;farm.eggBaskets=1;farm.dishes.appleJam=1
 assert.ok(deliverProject(farm,'fair').ok);assert.equal(farm.coins,coins+ready.reward)
 assert.equal(projectRewardLabel(getProject(farm,'fair').status),'Получено')
 const completed=structuredClone(farm);assert.equal(deliverProject(farm,'fair').ok,false);assert.deepEqual(farm,completed)
})
