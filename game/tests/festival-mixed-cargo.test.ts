import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import * as F from '../src/farm.ts'
import { receiveFerryExpedition } from '../src/harbour-economy.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

// Reach the first Lights finale through player actions, including a real claimed trade.
// The helper saves and reopens the farm after every command.
function earnedCargoStage(claim = true) {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url),'utf8'))
  const p = commissionPlayer(opening.slice(0, opening.findIndex((row:{name:string})=>row.name==='serveVillageMeal')+1))
  p.act('beginFestival','lights')
  p.visit('home')
  for(let i=0;i<3;i++){
    if(!F.getFishAction(p.state).available)p.night()
    const trip=p.act('beginFishingTrip')
    p.act('finishFishingTrip',trip.token,1)
  }
  p.visit('village');p.act('contributeFestival','participation','fish')
  for(let i=0;i<3;i++){
    const available=F.getFestivalStatus(p.state).active!.requirements.find(req=>req.id==='fish')!.alternatives.find(alt=>alt.available>0)!
    p.act('contributeFestival','fish',available.id)
  }
  p.night();p.visit('grove')
  for(let i=0;i<3;i++)if(F.getShellAt(p.state,i))p.act('collectShell',i)
  p.act('transferBayGoods','withdraw','grove','seaSalt',2)
  p.visit('village');p.act('contributeFestival','shore','shells');p.act('contributeFestival','shore','shells')
  p.act('sendFerryExpedition','mill-buy');p.night()
  if(claim)p.act('receiveFerryExpedition')
  p.visit('village');assert.equal(p.state.day,13);assert.equal(p.state.festivals.active!.stage,2)
  return p
}
const remainingCredit=(farm:F.FarmState)=>F.getFestivalStatus(farm).active!.requirements.find(r=>r.id==='cargo')!.alternatives.find(a=>a.id==='delivery')!.available

test('two hand-carried salt and one actual ferry credit fill the same three places in either order',async()=>{
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true,ws:false,hmr:false},appType:'custom'})
  try {
    const {renderFestivalPanel}=await server.ssrLoadModule('/src/bay-festival-ui.ts')
    for(const order of [['salt','salt','delivery'], ['delivery','salt','salt']]){
      const p=earnedCargoStage(), coins=p.state.coins,salt=p.state.seaSalt,buns=p.state.handmade.round
      assert.equal(p.state.festivals.active!.cargoDelivered,1)
      for(const [i,alternative] of order.entries()){
        const html=renderFestivalPanel(p.state)
        assert.ok(html.includes('data-action="festival-contribute" data-value="cargo|'+alternative+'"'), 'panel offers the actual available choice '+alternative)
        p.act('contributeFestival','cargo',alternative)
        if(alternative==='delivery'&&i===0) {
          assert.equal(remainingCredit(p.state),0)
          const snapshot=structuredClone(p.state)
          assert.equal(F.contributeFestival(p.state,'cargo','delivery').ok,false)
          assert.deepEqual(p.state,snapshot)
        }
      }
      assert.equal(p.state.festivals.active!.stage,3)
      assert.equal(p.state.coins,coins);assert.equal(p.state.seaSalt,salt-2);assert.equal(p.state.handmade.round,buns)
      assert.equal(F.finishFestival(p.state).ok,false)
      p.night();p.visit('village')
      const reward=F.getFestivalStatus(p.state).active!.reward
      p.act('finishFestival');assert.equal(p.state.coins,coins+reward)
      assert.equal(F.finishFestival(p.state).ok,false)
    }
  } finally {await server.close()}
})
test('a ferry still at sea does not count; claiming after a hand delivery adds one usable credit',()=>{
  const p=earnedCargoStage(false)
  p.act('contributeFestival','cargo','salt')
  assert.equal(remainingCredit(p.state),0)
  p.act('receiveFerryExpedition')
  assert.equal(remainingCredit(p.state),1)
  p.act('contributeFestival','cargo','delivery')
  assert.equal(remainingCredit(p.state),0)
  p.act('contributeFestival','cargo','salt')
  assert.equal(p.state.festivals.active!.stage,3)
})
test('legacy partial saves do not reissue possibly spent credits, or consume later arrivals',()=>{
  for(const alreadyReceived of [true,false]){
    const p=earnedCargoStage(alreadyReceived)
    p.act('contributeFestival','cargo',alreadyReceived?'delivery':'salt')
    const old=structuredClone(p.state);delete old.festivals.active!.cargoCreditsSpent
    const recovered=F.restoreFarm(old)!
    assert.ok(recovered)
    assert.equal(remainingCredit(recovered),0)
    if(!alreadyReceived){
      assert.ok(receiveFerryExpedition(recovered).ok)
      assert.equal(remainingCredit(F.restoreFarm(recovered)!),1)
    }
    const expected=alreadyReceived?1:0
    assert.equal(recovered.festivals.active!.cargoCreditsSpent,expected)
    for(const bad of [-1,2,0.5,null,'1']){
      const invalid=structuredClone(old)
      Object.assign(invalid.festivals.active!,{cargoCreditsSpent:bad})
      assert.equal(F.restoreFarm(invalid),undefined)
    }
  }
})
test('a repeat edition can acknowledge an arrival even after assigning its only supply unit',()=>{
  const p=earnedCargoStage(), scenario=structuredClone(p.state)
  // Controlled third-edition layout: its first stage shows participation and cargo together.
  scenario.festivals.completed.lights=2;scenario.festivals.lastCompletedOn=scenario.festivals.active!.startedOn
  Object.assign(scenario.festivals.active!,{edition:3,stage:0,delivered:{},materialValue:0})
  const f=F.restoreFarm(scenario)!
  assert.ok(f)
  assert.ok(F.contributeFestival(f,'cargo','delivery').ok)
  assert.equal(remainingCredit(f),0)
  assert.ok(F.contributeFestival(f,'participation','delivery').ok,'arrival evidence is not an extra supply unit')
  assert.equal(remainingCredit(f),0)
  assert.equal(F.contributeFestival(f,'cargo','delivery').ok,false)
  assert.equal(F.contributeFestival(f,'participation','delivery').ok,false)
})
