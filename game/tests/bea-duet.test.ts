import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync}from'node:fs'
import {commissionPlayer}from'./fixtures/commission-player.ts'
import {BeaDuet,canPlayWithBea}from'../src/bea-duet.ts'
function clock(){
 let time=0,serial=0
 const tasks=new Map<number,{time:number;cb:()=>void}>(),played:{at:number;note:number}[]=[]
 const timer=new BeaDuet(()=>time,(cb,ms)=>{tasks.set(++serial,{cb,time:time+ms});return serial},id=>{tasks.delete(id)},note=>played.push({at:time,note}))
 const advance=(to:number,late=false)=>{const due=()=>Array.from(tasks).filter(([,t])=>t.time<=to).sort((a,b)=>a[1].time-b[1].time)[0]
   for(let entry=due();entry;entry=due()){tasks.delete(entry[0]);time=late?to:entry[1].time;entry[1].cb()}time=to}
 return {timer,advance,played,tasks}
}
test('an earned harbour meeting opens free play, not an alteration to either farm or composition',()=>{
 const player=commissionPlayer(JSON.parse(readFileSync(new URL('./fixtures/market-order-selection-commands.json',import.meta.url),'utf8')))
 assert.equal(canPlayWithBea(player.state),false);player.visit('village')
 const farm=player.state,before=structuredClone(farm);assert.equal(farm.neighbors.bea.completed,1);assert.equal(farm.musicGarden.level,0);assert.equal(canPlayWithBea(farm),true)
 const c=clock();c.timer.tap(0);c.advance(320);c.timer.tap(2);c.advance(1400)
 assert.deepEqual(c.played,[{at:688,note:2},{at:1008,note:0}]);assert.deepEqual(farm,before)
})
test('a slower call gets its own rhythm; interruption, late dispatch and explicit cancellation produce no ghost notes',()=>{
 const r=clock();r.timer.tap(6);r.advance(500);r.timer.tap(4);r.advance(1075);assert.deepEqual(r.played,[{at:1075,note:4}])
 r.advance(1200);r.timer.tap(1);r.advance(1800);assert.equal(r.played.length,1)
 r.timer.tap(4);r.timer.cancel();r.advance(2800);assert.equal(r.played.length,1)
 r.timer.tap(1);r.advance(3100);r.timer.tap(3);r.advance(6100,true);assert.equal(r.played.length,1);assert.equal(r.tasks.size,0)
})

test('a slightly late first answer preserves the tap spacing instead of rushing its ending',()=>{
 const c=clock();c.timer.tap(0);c.advance(100);c.timer.tap(2);c.advance(505,true)
 assert.deepEqual(c.played,[{at:505,note:2}]);c.advance(604);assert.equal(c.played.length,1);c.advance(605)
 assert.deepEqual(c.played[1],{at:605,note:0})
})
