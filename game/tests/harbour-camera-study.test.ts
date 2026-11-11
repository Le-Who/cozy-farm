import test from 'node:test';
import assert from 'node:assert/strict';
import { harbourStudyCamera, harbourStudyViews, projectHarbourStudyPoint } from './fixtures/harbour-camera-study.ts';

test('portrait study makes the real artwork legible without changing native aspect ratio', () => {
  const before = harbourStudyCamera(390, 844, 'overview');
  const after = harbourStudyCamera(390, 844, 'east');
  assert.equal(before.scale, 390 / 1440);
  assert.ok(after.scale / before.scale > 2.6);
  assert.ok(after.scale / before.scale < 2.7);
  assert.ok(Math.abs(151 * .75 * before.scale - 30.671875) < 1e-9);
  assert.ok(151 * .75 * after.scale > 80, 'shop becomes a visible building, not a 31px icon');
});

test('all close views keep full vertical artwork between the planned HUD bands', () => {
  for (const [width, height] of [[320, 568], [390, 844], [430, 932], [680, 900]]) {
    for (const selected of harbourStudyViews.slice(1)) {
      const top = projectHarbourStudyPoint(width, height, selected.id, 800, 0);
      const bottom = projectHarbourStudyPoint(width, height, selected.id, 800, 992);
      assert.ok(top.y >= 180 - .001, `${width}×${height} ${selected.id}: top ${top.y}`);
      assert.ok(bottom.y <= height - 96 + .001, `${width}×${height} ${selected.id}: bottom ${bottom.y}`);
      }
  }
});

test('house doors, workshop, square, shop, common table and pier remain reachable through overlapping views', () => {
  const targets = [[439, 357], [1160, 357], [597, 610], [803, 470], [1195, 513], [1012, 738], [367, 877]];
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [430, 932], [680, 900]]) {
    for (const [x, y] of targets) {
      assert.ok(harbourStudyViews.slice(1).some(({ id }) => {
        const point = projectHarbourStudyPoint(width, height, id, x, y);
        return point.x >= 22 && point.x <= width - 22 && point.y >= 202 && point.y <= height - 118;
      }), `${width}×${height}: no reachable view for ${x},${y}`);
    }
  }
});

test('desktop and short landscape retain the current whole-island composition', () => {
  for (const [width, height] of [[960, 600], [844, 390], [1280, 720], [320, 400], [470, 480]]) {
    const before = harbourStudyCamera(width, height, 'overview');
    for (const { id } of harbourStudyViews) assert.deepEqual(harbourStudyCamera(width, height, id), before);
  }
});
