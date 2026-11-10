// Continues the first harvest preparation through real UI buttons.
async page => {
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('cozy-farm-island-v2')));
  if (before.festivals.active?.tradition !== 'harvest' || before.festivals.active.stage !== 0 || !before.festivals.active.delivered.participation) throw new Error('Complete a real harvest and confirm its participation first.');
  const remaining = 3 - (before.festivals.active.delivered.fruit ?? 0);
  for (let i = 0; i < remaining; i++) await page.getByRole('button', { name: 'Яблоки ×1', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cozy-farm-island-v2')));
  if (saved.festivals.active.stage !== 1 || saved.festivals.active.readyOn !== saved.day + 1) throw new Error('Preparation did not wait for the next morning.');
  if (saved.fruit.apple !== before.fruit.apple - remaining) throw new Error('Incorrect ingredient charge');
  if (await page.locator('[data-action="festival-contribute"]').count()) throw new Error('Next-night materials should not remain actionable.');
  return { stage: saved.festivals.active.stage, readyOn: saved.festivals.active.readyOn, materialValue: saved.festivals.active.materialValue, applesConsumed: remaining };
}
