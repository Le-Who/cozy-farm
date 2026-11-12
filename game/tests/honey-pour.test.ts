import test from 'node:test'
import assert from 'node:assert/strict'
import { honeyPourAngle, honeyPourFlow } from '../src/honey-pour.ts'
import { createHoneyPlateFilm, onHoneyPlate } from '../src/honey-plate.ts'
import { createHoneyStream } from '../src/honey-stream.ts'

const mass = (film: ReturnType<typeof createHoneyPlateFilm>) => film.height.reduce((a,b)=>a+b,0)

test('upright pitcher does not pour and increasing its visible tilt increases flow monotonically', () => {
  assert.equal(honeyPourFlow(0),0)
  assert.equal(honeyPourFlow(.16),0)
  assert.equal(honeyPourFlow(1),1)
  assert.equal(honeyPourAngle(0),0)
  assert.ok(honeyPourAngle(1)<-1)
  let previous=0
  for(let i=17;i<=100;i++) { const flow=honeyPourFlow(i/100);assert.ok(flow>previous);previous=flow }
  for(const invalid of [NaN,Infinity,-Infinity]) { assert.equal(honeyPourFlow(invalid),0);assert.equal(honeyPourAngle(invalid),0) }
  assert.equal(honeyPourFlow(-3),0);assert.equal(honeyPourFlow(3),1)
})

test('tilt changes both strand thickness and deposited dose, not the movement rate', () => {
  const thin=honeyPourFlow(.35),thick=honeyPourFlow(.85),stream=createHoneyStream()
  const input={from:{x:100,y:100,z:0},to:{x:100,y:200,z:0},velocity:{x:0,y:0},radius:5,tail:0,time:0,flow:thin}
  stream.update(input)
  const positions=stream.geometry.getAttribute('position'),diameter=()=>Math.abs(positions.getX(0)-positions.getX(4)),small=diameter()
  stream.update({...input,flow:thick});assert.ok(diameter()>small*2)
  const low=createHoneyPlateFilm(),high=createHoneyPlateFilm(),point={x:.5,y:.525}
  for(let i=0;i<30;i++) { low.deposit(point,point,18/30*thin,thin);high.deposit(point,point,18/30*thick,thick) }
  assert.ok(mass(high)>mass(low)*4)
  stream.dispose()
})

test('plate accepts real hits but leaves its rim, outside and pear-occluded pixels dry', () => {
  const film=createHoneyPlateFilm(),point={x:.5,y:.525}
  assert.equal(onHoneyPlate(point),true)
  assert.equal(onHoneyPlate({x:.5,y:.1}),false)
  assert.equal(onHoneyPlate({x:NaN,y:.5}),false)
  assert.equal(film.deposit(point,point,5,1,()=>true),0)
  assert.equal(film.deposit({x:0,y:0},{x:0,y:0},5,1),0)
  assert.equal(film.deposit(point,point,5,0),0)
  assert.ok(film.deposit(point,point,5,1)>0)
  assert.ok(mass(film)>4.8)
  for(let i=0;i<60;i++)film.step(1/60)
  assert.ok(mass(film)>4.8)
  for(let i=0;i<film.height.length;i++)if(!film.region[i])assert.equal(film.height[i],0)
})

test('a crossing deposits only the fraction actually above the plate, without snapping misses to its edge',()=>{
  const film=createHoneyPlateFilm()
  const accepted=film.deposit({x:-.5,y:.525},{x:1.5,y:.525},20,1)
  assert.ok(accepted>7 && accepted<9)
  assert.ok(mass(film)>6 && mass(film)<9)
})

test('stationary pour is frame-rate independent and retained plate state stays finite under adversarial input',()=>{
  const point={x:.5,y:.525},slow=createHoneyPlateFilm(),fast=createHoneyPlateFilm()
  for(let i=0;i<30;i++)slow.deposit(point,point,18/30,.7)
  for(let i=0;i<120;i++)fast.deposit(point,point,18/120,.7)
  assert.ok(Math.abs(mass(slow)-mass(fast))<.001)
  const before=mass(slow)
  for(const invalid of [NaN,Infinity,-Infinity])slow.deposit({x:invalid,y:.5},point,invalid,invalid)
  assert.equal(mass(slow),before)
  for(let i=0;i<50;i++) { slow.deposit(point,point,1e9,1);slow.step(.05) }
  assert.ok(slow.height.every(Number.isFinite))
  assert.ok(mass(slow)<2000)
})
