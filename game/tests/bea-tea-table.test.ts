import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { getVillageMeal, getNeighborPlans } from '../src/farm.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

test('after a shared supper, Bea’s separate tea table is identified without hiding the earned arrangement', async () => {
  const steps=JSON.parse(readFileSync(new URL('./fixtures/market-order-selection-commands.json',import.meta.url),'utf8')) as {name:string;args:unknown[]}[]
  const end=steps.findIndex(step=>step.name==='finishNeighborPlan')
  assert.ok(end>0)
  const {state:farm}=commissionPlayer(steps.slice(0,end))
  assert.equal(getVillageMeal(farm,'round').served,true)
  const plan=getNeighborPlans(farm).find(p=>p.resident==='bea')!
  assert.equal(plan.phase,'arranging');assert.equal(plan.episode,'beaTea')
  const before=structuredClone(farm),server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'})
  try {
    const {neighborDetail}=await server.ssrLoadModule('/src/community-ui.ts')
    const html=neighborDetail(farm,'bea',{icon:()=>'',offerIcon:()=>''})
    assert.match(html,new RegExp('data-action="arrange-neighbor" data-value="'+plan.id+'"[^>]*>Накрыть стол к чаю</button>'))
    assert.doesNotMatch(html,/data-action="(?:share-meal|village-meal)"|>Накрыть стол<\/button>/)
    assert.deepEqual(farm,before)
  } finally {await server.close()}
})
