// playwright-cli -s=<isolated-new-profile> run-code --filename scripts/qa/fresh-start.js
// Uses the running game and native input. Does not create or alter a save fixture.
async (page) => {
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cozy-farm-island-v1')));
  if (saved && (saved.day !== 1 || saved.workToday !== 0 || saved.boatOwned)) {
    throw new Error('Use a new isolated browser profile; this scenario preserves existing farms.');
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const ledger = [];
  const checkpoint = async label => {
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('cozy-farm-island-v1')));
    ledger.push({ label, day: state.day, coins: state.coins, progress: state.progress, orientation: state.orientation });
  };
  const close = async () => { if (await page.locator('dialog').isVisible()) await page.locator('.dialog-close').click(); };
  const next = () => page.locator('.task-card').click();
  await close();
  for (let step = 0; step < 3; step++) {
    await next();
    await page.keyboard.press('Enter');
  }
  await checkpoint('Prepared, planted and watered through the task focus');
  await next();
  await page.locator('[data-action="feed"]').click();
  await page.locator('[data-action="collect"]').click();
  await close();
  const columns = [565, 709, 850, 993], rows = [436, 520, 612, 706];
  for (const index of [2, 3, 4, 5, 7, 9, 15]) {
    await page.mouse.click((125.25 + .75 * columns[index % 4]) * 1280 / 1440,
      50 + (37 + .75 * rows[Math.floor(index / 4)]) * 1280 / 1440);
  }
  await next();
  if (await page.locator('dialog').getAttribute('data-panel') !== 'archive') throw new Error('First discoveries did not lead to Collections');
  await page.screenshot({ path: '../output/playwright/replay-first-collection.png', scale: 'css' });
  await close();
  await page.getByRole('button', { name: 'Market', exact: true }).click();
  await page.locator('[data-action="market-tab"][data-value="sell"]').click();
  for (let i = 0; i < 2; i++) await page.locator('[data-action="sell-item"][data-value="produce:pumpkin"]').click();
  await close();
  await next();
  await checkpoint('First night after feeding, harvesting and selling');
  await next();
  if (await page.locator('dialog').getAttribute('data-panel') !== 'boat') throw new Error('Island introduction did not open the route map');
  await page.screenshot({ path: '../output/playwright/replay-first-islands.png', scale: 'css' });
  await close();
  await next();
  await page.locator('[data-action="pick-fruit"]').click();
  await close();
  await next();
  await page.locator('[data-action="cook"][data-value="orchardTart"]').click();
  await page.waitForFunction(() => document.querySelector('.cookery-game')?.dataset.stage === 'fruit');
  await page.locator('.cookery-render-status').waitFor({ state: 'hidden' });
  await checkpoint('First tart worktop opened with ingredients earned in play');
  return { ledger, next: 'Use scripts/qa/fresh-cookery.js to prepare the open recipe.' };
}
