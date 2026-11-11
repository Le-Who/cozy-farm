import test from 'node:test';
import assert from 'node:assert/strict';
import { harbourCamera, harbourViews, harbourScreenPoint, harbourWorldPoint, harbourPointVisible,
  harbourViewForPoint, harbourRouteNeedsOverview, isHarbourPortrait, isHarbourView, harbourFocus } from '../src/harbour-view.ts';
const vp = { width: 390, height: 844, top: 210, bottom: 90 };
const point = (x: number, y: number) => ({ x: 125.25 + x * .75, y: 37 + y * .75 });

test('real HUD bands fit full plate with a single proportional scale', () => {
  for (const [width, height, top, bottom] of [[320,568,210,90],[390,844,210,90],[430,932,160,120],[680,900,230,130]]) {
    const viewport = { width, height, top, bottom };
    for (const { id } of harbourViews.slice(1)) {
      const view = harbourCamera(viewport, id);
      assert.ok(view.close);
      assert.ok(harbourScreenPoint(viewport, id, point(800,0)).y >= top - 1e-8);
      assert.ok(harbourScreenPoint(viewport, id, point(800,992)).y <= height - bottom + 1e-8);
    }
  }
  assert.ok(151 * .75 * harbourCamera(vp, 'east').scale > 80);
});
test('wide, short, overcrowded and degenerate areas safely remain overview', () => {
  for (const viewport of [{...vp,width:844,height:390},{...vp,width:960,height:600},
    {...vp,width:470,height:480},{...vp,top:700,bottom:300},{...vp,width:0,height:0}]) {
    for (const {id} of harbourViews) assert.deepEqual(harbourCamera(viewport,id),harbourCamera(viewport,'overview'));
  }
  assert.equal(isHarbourPortrait(vp),true);
  assert.equal(isHarbourPortrait({...vp,height:400}),false);
  assert.equal(isHarbourView('west'),true); assert.equal(isHarbourView('home'),false);
});
test('screen/world are inverse in every framing after resize and HUD changes', () => {
  for (const viewport of [vp,{...vp,width:320,height:568},{...vp,top:166,bottom:134},{...vp,width:844,height:390}]) {
    for (const {id} of harbourViews) for (const p of [point(439,357),point(1195,513),point(546,938)]) {
      const restored = harbourWorldPoint(viewport,id,harbourScreenPoint(viewport,id,p));
      assert.ok(Math.abs(restored.x-p.x)<1e-8); assert.ok(Math.abs(restored.y-p.y)<1e-8);
    }
  }
});
test('doors, workshop, music, table, neighbour, pier and boat all have an accessible close view', () => {
  for (const viewport of [vp,{...vp,width:320,height:568}]) {
    for (const p of [[439,357],[1160,357],[382,516],[790,313],[979,604],[1222,561],[367,877],[546,909]]) {
      assert.ok(harbourViews.slice(1).some(({id})=>harbourPointVisible(viewport,id,point(...p as [number,number]))),String(p));
    }
  }
});
test('focus preserves overview, keeps a visible target, and brings an offscreen target into view', () => {
  assert.equal(harbourViewForPoint(vp,'overview',point(1160,357)),'overview');
  assert.equal(harbourViewForPoint(vp,'west',point(439,357)),'west');
  assert.equal(harbourViewForPoint(vp,'west',point(1160,357)),'east');
  assert.equal(harbourViewForPoint(vp,'east',point(382,516)),'west');
  assert.equal(harbourViewForPoint({...vp,width:844,height:390},'east',point(382,516)),'east');
});
test('only a route outside the selected frame requests a temporary overview', () => {
  assert.equal(harbourRouteNeedsOverview(vp,'west',[point(367,739),point(597,610)]),false);
  assert.equal(harbourRouteNeedsOverview(vp,'east',[point(367,739),point(803,470),point(1222,561)]),true);
  assert.equal(harbourRouteNeedsOverview(vp,'overview',[point(367,739),point(1222,561)]),false);
  assert.equal(harbourRouteNeedsOverview({...vp,width:844,height:390},'east',[point(367,739)]),false);
});


test('short portrait overview keeps door and music targets below the actual HUD stack', () => {
  for (const [width,height] of [[470,480],[390,480],[470,520]]) {
    const viewport={width,height,top:213,bottom:90};
    for (const p of [point(439,257),point(1160,257),point(790,313),point(546,909)]) {
      const screen=harbourScreenPoint(viewport,'overview',p);
      assert.ok(screen.y>=viewport.top && screen.y<=height-viewport.bottom);
    }
  }
});


test('dialog focus restoration and resize preserve the journey; explicit navigation can interrupt it', () => {
  const west=point(382,516),east=point(1195,445);
  assert.deepEqual(harbourFocus(vp,'east',east,true),{view:'east',traveling:true});
  assert.deepEqual(harbourFocus({...vp,width:320,height:568},'east',west,true),{view:'east',traveling:true});
  assert.deepEqual(harbourFocus(vp,'east',west,true,true),{view:'west',traveling:false});
  assert.deepEqual(harbourFocus(vp,'east',west,false),{view:'west',traveling:false});
});
