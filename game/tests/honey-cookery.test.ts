import assert from 'node:assert/strict'
import test from 'node:test'
import { syncHoneyCoating,HONEY_PEAR_EACH_HALF } from '../src/honey-cookery-model.ts'
import { advanceHoneyBake, beginHoneyStroke, cancelHoney, completeHoney, createHoneyModel, createHoneyFilm, depositHoneyPiece, measuredHoneyCoverage, reportHoneyCoating, endHoneyStroke, honeyBiscuitCenters, moveHoneyStroke, placeHoneyFruit, recordHoneyKnife, workHoneyPiece, settleHoney, startHoneyBake, type HoneyModel } from '../src/honey-cookery-model.ts'

function sweep(model: HoneyModel, tool: 'spoon' | 'honey') {
  beginHoneyStroke(model, tool, { x: -.8, y: -.6 })
  if(tool==='honey'&&model.family==='honeyPear'){for(let i=0;i<4;i++)reportHoneyCoating(model,i,1);endHoneyStroke(model);for(let i=0;i<4;i++)settleHoney(model,.05,true);return}
  if(tool==='honey'&&model.family==='honeyBiscuits'){for(let pass=0;pass<3;pass++)for(let piece=0;piece<4;piece++){let previous={x:.15,y:.5};for(let i=0;i<17;i++){const a=i/16*Math.PI*2,point={x:.5+Math.cos(a)*.32,y:.5+Math.sin(a)*.32};depositHoneyPiece(model,piece,previous,point,.25);previous=point}depositHoneyPiece(model,piece,previous,{x:.5,y:.5},.25)}endHoneyStroke(model);for(let i=0;i<4;i++)settleHoney(model,.05,true);return}
  for (let y = -.76; y <= .76; y += .12) {
    const edge = Math.sqrt(1 - y * y) * .9
    moveHoneyStroke(model, { x: -edge, y }); moveHoneyStroke(model, { x: 0, y }); moveHoneyStroke(model, { x: edge, y })
  }
  endHoneyStroke(model)
  for (let i=0;i<4;i++) settleHoney(model,.05,true)
}
test('honey pears require swept knife cuts through both pears, followed by spatial honey coverage', () => {
  const model = createHoneyModel('honeyPear')
  beginHoneyStroke(model, 'knife', { x: -.8, y: .65 }); moveHoneyStroke(model, { x: .8, y: .65 }); endHoneyStroke(model)
  assert.equal(model.cuts.size, 0)
  beginHoneyStroke(model, 'knife', { x: -.85, y: 0 });recordHoneyKnife(model,0,0,Array.from({length:16},(_,i)=>i));recordHoneyKnife(model,1,Math.PI/2,Array.from({length:16},(_,i)=>i));endHoneyStroke(model)
  assert.equal(model.stage, 'glaze'); assert.equal(model.cuts.size, 2)
  sweep(model, 'spoon'); assert.equal(model.stage, 'glaze', 'a spoon cannot stand in for the honey pitcher')
  sweep(model, 'honey'); assert.equal(model.stage, 'ready')
})
test('biscuit shaping responds to actual work on multiple pieces, then baking and glazing', () => {
  const model = createHoneyModel('honeyBiscuits')
  assert.equal(startHoneyBake(model), false)
  for (const [index,piece] of honeyBiscuitCenters.slice(0, 3).entries()) {
    beginHoneyStroke(model, 'hand', { x: piece.x - .2, y: piece.y })
    for (let i = 0; i < 5; i++) workHoneyPiece(model,index,.4,.016,.9)
    endHoneyStroke(model)
  }
  assert.equal(model.stage, 'bake-ready')
  assert.equal(startHoneyBake(model), true)
  advanceHoneyBake(model, 1); assert.equal(model.stage, 'baking')
  advanceHoneyBake(model, 2); assert.equal(model.stage, 'glaze')
  sweep(model, 'honey'); assert.equal(model.stage, 'ready')
  assert.deepEqual(model.steps, ['shape-biscuits', 'bake-golden', 'pour-honey'])
})
test('cake mixing needs circular movement around the bowl; baking cannot skip it', () => {
  const model = createHoneyModel('honeyCake')
  beginHoneyStroke(model, 'spoon', { x: .6, y: 0 })
  for (let i = 0; i < 300; i++) moveHoneyStroke(model, { x: .6, y: i % 2 ? .03 : 0 })
  assert.equal(model.stage, 'mix')
  for (let i = 0; i <= 180; i++) moveHoneyStroke(model, { x: Math.cos(i / 180 * Math.PI * 4.2) * .6, y: Math.sin(i / 180 * Math.PI * 4.2) * .6 })
  endHoneyStroke(model); assert.equal(model.stage, 'bake-ready')
  startHoneyBake(model); advanceHoneyBake(model, 3); sweep(model, 'honey'); assert.equal(model.stage, 'ready')
})
test('parfait layers custard, freely positioned fruit and honey in that order', () => {
  const model = createHoneyModel('windParfait')
  assert.equal(placeHoneyFruit(model, 0, { x: 0, y: 0 }), false)
  sweep(model, 'spoon'); assert.equal(model.stage, 'fruit')
  assert.equal(placeHoneyFruit(model, 0, { x: 2, y: 0 }), false)
  for (let i = 0; i < 3; i++) placeHoneyFruit(model, i, { x: (i - 1) * .35, y: 0 }, 'peach', i * .2)
  assert.equal(model.stage, 'glaze'); assert.equal(model.fruit.length, 3)
  placeHoneyFruit(model, 0, { x: 0, y: -.3 }, 'peach', -.4)
  assert.equal(model.fruit[0].angle, -.4)
  sweep(model, 'honey'); assert.equal(model.stage, 'ready')
  assert.deepEqual(model.steps, ['layer-custard', 'layer-fruit', 'pour-honey'])
})
test('stationary glaze events do not prepare a dish and completion is guarded, retryable and atomic', () => {
  const model = createHoneyModel('honeyPear'); model.stage = 'glaze'
  beginHoneyStroke(model, 'honey', { x: 0, y: 0 }); for (let i = 0; i < 1000; i++) moveHoneyStroke(model, { x: 0, y: 0 })
  assert.equal(model.stage, 'glaze'); assert.equal(completeHoney(model, () => true), false)
  sweep(model, 'honey'); assert.equal(completeHoney(model, () => false), false); assert.equal(model.stage, 'ready')
  let commits = 0
  assert.equal(completeHoney(model, () => { commits++; assert.equal(completeHoney(model, () => true), false); return true }), true)
  assert.equal(completeHoney(model, () => { commits++; return true }), false); assert.equal(commits, 1)
  const cancelled = createHoneyModel('honeyCake'); cancelHoney(cancelled); assert.equal(completeHoney(cancelled, () => true), false)
})

test('only actual view traces can advance a cut, and partial material marks persist between strokes', () => {
  const model=createHoneyModel('honeyPear')
  beginHoneyStroke(model,'knife',{x:-1,y:0});moveHoneyStroke(model,{x:1,y:0});endHoneyStroke(model)
  assert.equal(model.cuts.size,0,'a legacy normalized line is not evidence of a mesh contact')
  beginHoneyStroke(model,'knife',{x:0,y:0});recordHoneyKnife(model,0,.2,[0,1,2,3]);endHoneyStroke(model)
  assert.equal(model.cutTracks[0].progress,.25)
  beginHoneyStroke(model,'knife',{x:0,y:0});recordHoneyKnife(model,0,.2,[0,1,2,3,4,5,6,7]);endHoneyStroke(model)
  assert.equal(model.cutTracks[0].progress,.5);assert.equal(model.cuts.size,0)
  beginHoneyStroke(model,'knife',{x:0,y:0});recordHoneyKnife(model,0,.2,Array.from({length:16},(_,i)=>i));endHoneyStroke(model)
  assert.equal(model.cuts.has(0),true)
})

test('honey readiness waits for both release and a continuous physically settled interval',()=>{
  const model=createHoneyModel('honeyPear');model.stage='glaze'
  beginHoneyStroke(model,'honey',{x:-.8,y:-.6})
  for(let i=0;i<4;i++)reportHoneyCoating(model,i,1)
  assert.equal(model.stage,'glaze');assert.equal(completeHoney(model,()=>true),false)
  endHoneyStroke(model);assert.equal(model.stage,'settling')
  settleHoney(model,.1,true);settleHoney(model,.1,false);assert.equal(model.stage,'settling')
  settleHoney(model,.1,true);settleHoney(model,.05,true);assert.equal(model.stage,'ready')
})

test('a fast dry brush path cannot claim honey coverage without enough deposited material',()=>{
  const model=createHoneyModel('honeyPear');model.stage='glaze'
  beginHoneyStroke(model,'honey',{x:-.8,y:-.6})
  for(let y=-.76;y<=.76;y+=.12){moveHoneyStroke(model,{x:-.9,y},.002);moveHoneyStroke(model,{x:.9,y},.002)}
  endHoneyStroke(model)
  assert.equal(model.stage,'glaze');assert.equal(model.coverage.size,0)
  sweep(model,'honey');assert.equal(model.stage,'ready')
})

test('worked food is coated in its material coordinates, independently of its original screen position',()=>{
  const model=createHoneyModel('honeyBiscuits');model.stage='glaze';beginHoneyStroke(model,'honey',{x:0,y:0})
  for(let pass=0;pass<3;pass++)for(let piece=0;piece<4;piece++){let previous={x:.15,y:.5};for(let i=0;i<17;i++){const a=i/16*Math.PI*2,point={x:.5+Math.cos(a)*.32,y:.5+Math.sin(a)*.32};depositHoneyPiece(model,piece,previous,point,.25);previous=point}depositHoneyPiece(model,piece,previous,{x:.5,y:.5},.25)}
  assert.ok(model.coverage.size>=26);assert.equal(model.stage,'glaze','a finished painting must still be released')
  endHoneyStroke(model);for(let i=0;i<4;i++)settleHoney(model,.05,true);assert.equal(model.stage,'ready')
})

test('pear coating measures deposited flesh area, excluding every off-food pixel and thin film',()=>{
 const region=new Uint8Array([0,255,255,0]),paint=new Uint8ClampedArray([255,255,255,255,50,50,50,255,90,90,90,255,255,255,255,255])
 assert.equal(measuredHoneyCoverage(region,paint),0);paint[4]=150;assert.equal(measuredHoneyCoverage(region,paint),.5);paint[8]=150;assert.equal(measuredHoneyCoverage(region,paint),1)
 const model=createHoneyModel('honeyPear');model.stage='glaze';beginHoneyStroke(model,'honey',{x:0,y:0})
 for(let i=0;i<3;i++)reportHoneyCoating(model,i,1);assert.equal(model.pending,null,'an untouched half cannot be hidden by coating the other three')
 reportHoneyCoating(model,3,.4);assert.equal(model.pending,'settling');endHoneyStroke(model);for(let i=0;i<4;i++)settleHoney(model,.05,true);assert.equal(model.stage,'ready')
})

test('a real contact on an elongated biscuit tip counts work without an obsolete centre hit region',()=>{
 const model=createHoneyModel('honeyBiscuits');assert.equal(workHoneyPiece(model,99,.4,.05,.9),false)
 for(let i=0;i<4;i++){workHoneyPiece(model,0,.3,.05,.9);workHoneyPiece(model,1,.3,.05,.9)}
 assert.equal(model.stage,'bake-ready');assert.ok(model.pieces[0].work>.36);assert.equal(model.pieces[2].work,0)
})

test('retained honey levels by pressure without losing mass or crossing the cut-face boundary',()=>{
 const size=32,region=Uint8Array.from({length:size*size},(_,i)=>Math.hypot(i%size-15.5,Math.floor(i/size)-15.5)<12?255:0),film=createHoneyFilm(size,region)
 film.deposit({x:.5,y:.5},80,.045)
 const sum=()=>film.height.reduce((a,b)=>a+b,0),mass=sum(),peak=Math.max(...film.height)
 for(let i=0;i<240;i++)film.step(1/60)
 assert.ok(Math.abs(sum()-mass)<mass*.00001,'viscous spreading conserves deposited material')
 assert.ok(Math.max(...film.height)<peak*.5,'a stationary contact spreads after the source stops')
 assert.ok(film.height.every((h,i)=>Number.isFinite(h)&&h>=0&&(region[i]>128||h===0)))
 for(let i=0;i<300;i++)film.step(1/60)
 assert.ok(Math.abs(sum()-mass)<mass*.00001,'the coating remains after release')
})

test('honey contact deposits only in the actual face and partial coverage needs real liquid depth',()=>{
 const size=24,region=Uint8Array.from({length:size*size},(_,i)=>i%size<12?255:0),film=createHoneyFilm(size,region)
 film.deposit({x:.85,y:.5},2,.02);assert.ok(film.height.every(h=>h<.00001));assert.equal(film.coverage(),0)
 film.deposit({x:.25,y:.5},.005,.04);assert.equal(film.coverage(),0)
 for(let pass=0;pass<25;pass++)film.deposit({x:.25,y:.5},.1,.04)
 assert.ok(film.coverage()>0&&film.coverage()<.3)
 assert.equal(film.step(Number.NaN),false)
})

test('even a fully wetted face relaxes to a rounded pinned meniscus while retaining its material',()=>{
 const size=32,region=Uint8Array.from({length:size*size},(_,i)=>Math.hypot(i%size-15.5,Math.floor(i/size)-15.5)<12?255:0),film=createHoneyFilm(size,region)
 film.deposit({x:.5,y:.5},6000,1)
 const before=film.height.reduce((a,b)=>a+b,0)
 for(let i=0;i<1800;i++)film.step(1/60)
 let edge=0,edges=0,centre=0,centres=0
 for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++){const i=y*size+x;if(region[i]<=128)continue;if(region[i-1]<=128||region[i+1]<=128||region[i-size]<=128||region[i+size]<=128){edge+=film.height[i];edges++}if(Math.hypot(x-15.5,y-15.5)<5){centre+=film.height[i];centres++}}
 assert.ok(edge/edges<centre/centres*.25,'the liquid rolls inward at the physical food edge instead of ending in a flat raised cutout')
 assert.ok(Math.abs(film.height.reduce((a,b)=>a+b,0)-before)<before*.00001)
})

test('hands-off physical spreading refreshes all coverage and becomes ready once without another pour',()=>{
 const model=createHoneyModel('honeyPear');model.stage='glaze';beginHoneyStroke(model,'honey',{x:0,y:0})
 syncHoneyCoating(model,[HONEY_PEAR_EACH_HALF-.01,.55,.55,.55]);endHoneyStroke(model);assert.equal(model.stage,'glaze')
 syncHoneyCoating(model,[.35,.55,.55,.55]);assert.equal(model.stage,'settling')
 syncHoneyCoating(model,[.36,.56,.56,.56]);settleHoney(model,.1,true);settleHoney(model,.05,true);assert.equal(model.stage,'ready');assert.deepEqual(model.steps,['pour-honey'])
 let commits=0;completeHoney(model,()=>{commits++;return true});syncHoneyCoating(model,[1,1,1,1]);completeHoney(model,()=>{commits++;return true});assert.equal(commits,1)
})

test('physical coverage can fall during settling and cancellation never revives preparation',()=>{
 const model=createHoneyModel('honeyPear');model.stage='glaze';beginHoneyStroke(model,'honey',{x:0,y:0});syncHoneyCoating(model,[.6,.6,.6,.6]);endHoneyStroke(model)
 syncHoneyCoating(model,[HONEY_PEAR_EACH_HALF*.5,.6,.6,.6]);assert.equal(model.coated.get(0),HONEY_PEAR_EACH_HALF*.5);assert.equal(model.stage,'glaze');assert.equal(model.pending,null)
 cancelHoney(model);syncHoneyCoating(model,[1,1,1,1]);assert.equal(model.stage,'cancelled');assert.equal(completeHoney(model,()=>true),false)
})

test('a real slow curved drizzle leaves a visible retained trail while a fast skim stays underdosed',()=>{
 const size=96,region=Uint8Array.from({length:size*size},(_,i)=>((i%size+.5-size*.5)/(size*.27))**2+((Math.floor(i/size)+.5-size*.5)/(size*.46))**2<1?255:0)
 const pour=(seconds:number)=>{const film=createHoneyFilm(size,region),steps=Math.round(seconds*60);for(let i=0;i<steps;i++){const t=i/(steps-1);film.deposit({x:.5+.08*Math.sin(t*Math.PI*2),y:.14+.72*t},520/60,.018);film.step(1/60)}for(let i=0;i<96;i++)film.step(1/60);return film}
 const fast=pour(.2),slow=pour(1.5)
 assert.ok(fast.coverage()<HONEY_PEAR_EACH_HALF,'racing over the surface cannot replace a real dose')
 assert.ok(slow.coverage()>=HONEY_PEAR_EACH_HALF,'a continuous narrow trail is meaningful preparation')
 assert.ok(slow.coverage()>fast.coverage()*3)
 assert.ok(slow.height.some(h=>h>1),'the drizzle retains local relief inside the cap')
 assert.ok(slow.height.filter((h,i)=>region[i]>128&&h<.05).length>region.filter(v=>v>128).length*.25,'the recipe does not require flooding the flesh')
})

test('an extreme retained dose respects the pressure maximum principle at variable frame steps',()=>{
 const size=32,region=Uint8Array.from({length:size*size},(_,i)=>Math.hypot(i%size-15.5,Math.floor(i/size)-15.5)<12?255:0),film=createHoneyFilm(size,region)
 film.deposit({x:.78,y:.5},20_000,.018)
 const mass=film.height.reduce((a,b)=>a+b,0);let pressure=film.maxPressure()
 for(let i=0;i<360;i++){film.step([1/144,1/60,.05][i%3]);const next=film.maxPressure();assert.ok(next<=pressure*(1+1e-6),'bounded mobility must not create pressure ringing');assert.ok(film.height.every(h=>Number.isFinite(h)&&h>=0));pressure=next}
 assert.ok(Math.abs(film.height.reduce((a,b)=>a+b,0)-mass)<mass*.00001)
})
