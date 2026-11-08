import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditRussianSource, inspectRussianText, inspectRussianQuantities } from '../scripts/audit-russian.mjs';

test('Russian source audit follows UI contexts and preserves internal IDs, shaders and diagnostics', async () => {
  const source = `
    const shader = '#include <common> uniform float time; void main() {}';
    const state = {id:'open-channel', asset:'art/honey-cake.webp'};
    const contacts = [{name:'leftHandle', x:60, y:296}];
    const preserveNames = ['syrup-surface', 'jam-surface'];
    throw new Error('Missing geometry buffer');
    const crop = {id:'apple',name:'Apple'};
    button('Cook', 'start-signature');
    task('first-harvest','Первый урожай','Harvest a crop','ui-carrot',{target:'focus-bed'});
    el.textContent = ready ? 'Готово' : 'Try again';
    el.innerHTML = '<button data-action="return-home" aria-label="Go home">Домой</button>';
    function helper() { return '<p class="empty-state">New menu</p>'; }
  `;
  const findings = await auditRussianSource(source);
  assert.deepEqual(findings.flatMap(finding => finding.words).sort(), ['Apple', 'Cook', 'Go', 'Harvest', 'New', 'Try', 'again', 'crop', 'home', 'menu'].sort());
  assert.ok(findings.every(finding => !/shader|uniform|geometry|return-home|start-signature/.test(finding.text)));
});

test('HTML template branches audit captions and accessible names while skipping class and action IDs', async () => {
  const source = "const view = `${icon('honey')}<span class=\"${ready ? 'ready-state' : 'empty-state'}\">${ready ? 'Ready' : 'Wait'}</span>`;";
  assert.deepEqual((await auditRussianSource(source)).flatMap(finding => finding.words).sort(), ['Ready', 'Wait']);
});

test('keyboard keys and player recipe names can appear in otherwise Russian prose', () => {
  assert.deepEqual(inspectRussianText('Нажмите Enter или Alt + Q. Блюдо «Bay morning» готово. WebGL'), []);
  assert.deepEqual(inspectRussianText('Нажмите Enter to continue'), ['to', 'continue']);
  assert.deepEqual(inspectRussianText('Глубина: 75 m'), ['m']);
});

test('Russian quantity audit distinguishes ordinary counts, teens and genitive context', () => {
  assert.deepEqual(inspectRussianQuantities('1 день, 2 дня, 11 дней, 21 день, 3 рыбы, 5 яиц, 1 монету'), []);
  assert.equal(inspectRussianQuantities('21 монет')[0]?.text, '21 монет');
  assert.equal(inspectRussianQuantities('3 рыба')[0]?.expected[0], 'рыбы');
  assert.deepEqual(inspectRussianQuantities('На крючке 0 из 3 мест. Без 1 монеты. 3/4 порции.'), []);
});
