// Prepare an open ordinary recipe with playwright-cli run-code --filename.
// Uses native input only. localStorage is read solely for checkpoint evidence.
async (page) => {
  const actions = [];
  const readSave = () => page.evaluate(() => {
    const f = JSON.parse(localStorage.getItem('cozy-farm-island-v2'));
    return { day: f.day, coins: f.coins, island: f.island, boat: f.boatOwned,
      buildingLevels: f.buildingLevels, specialization: f.farmhouseSpecialization,
      dishes: f.dishes, fruit: f.fruit, produce: f.produce, eggs: f.eggs,
      projects: f.projects, harbor: f.orders.harbor, capeFlowers: f.capeFlowers,
      honey: f.honey, fairGuestsServed: f.fairGuestsServed, village: f.village };
  });
  const before = await readSave();
  if (!await page.locator('.cookery-game').isVisible()) return { before, actions, note: 'Open an available fruit recipe through its ordinary kitchen button first.' };
  await page.locator('.cookery-render-status').waitFor({ state: 'hidden' });
  const root = page.locator('.cookery-game'), view = page.locator('.cookery-view');
  const preserves = await root.getAttribute('data-kind') === 'preserves';
  const b = await view.boundingBox(), w = b.width, h = b.height;
  if (w / h < .85 || h < 420) throw new Error('This native batch currently expects the desktop kitchen layout.');
  const main = Math.min(w * .63, h * .75), rx = main * (preserves ? 165 / 512 * .97 : 146 / 512), ry = main * (preserves ? 105 / 512 * .84 : 110 / 512);
  const cx = w * .53 + main * ((preserves ? 263 : 257) / 512 - .5);
  const cy = h * .69 + main * ((preserves ? 219 : 240) / 512 - .5 + (preserves ? .025 : 0));
  const step = Math.max(6, Math.min(rx, ry) * .18);
  const cursor = () => page.locator('.cookery-keyboard-cursor').evaluate(el => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) }));
  await view.focus();
  for (let fruit = 0; fruit < (preserves ? 5 : 3); fruit++) {
    await page.keyboard.press('f'); const at = await cursor();
    for (let i = 0; i < Math.round(Math.abs(cx - at.x) / step); i++) await page.keyboard.press(cx > at.x ? 'ArrowRight' : 'ArrowLeft');
    for (let i = 0; i < Math.round(Math.abs(cy - at.y) / step); i++) await page.keyboard.press(cy > at.y ? 'ArrowDown' : 'ArrowUp');
    await page.keyboard.press('Space');
  }
  actions.push(`Placed ${preserves ? 5 : 3} fruit using native F/arrows/Space`);
  await page.keyboard.press('s'); const tool = await cursor(); await page.keyboard.press('Space');
  await page.mouse.move(b.x + tool.x, b.y + tool.y); await page.mouse.down();
  if (preserves) {
    for (let i = 0; i <= 210; i++) { const a = i / 210 * Math.PI * 5.15; await page.mouse.move(b.x + cx + Math.cos(a) * rx * .63, b.y + cy + Math.sin(a) * ry * .63); }
    await page.mouse.up(); actions.push('Stirred pot for 2.575 circles with native held spoon');
    await page.screenshot({ path: `../output/playwright/fresh-day${before.day}-preserves-reduced.png`, scale: 'css' });
    await view.focus(); await page.keyboard.press('s'); const spoon = await cursor(); await page.keyboard.press('Space');
    await page.mouse.move(b.x + spoon.x, b.y + spoon.y); await page.mouse.down();
    for (let i = 0; i < 3; i++) { await page.mouse.move(b.x + cx, b.y + cy, { steps: 12 }); await page.mouse.move(b.x + w * .86, b.y + h * .77, { steps: 15 }); }
    await page.mouse.up(); actions.push('Transferred three native spoonfuls from pot to jar');
  } else {
    for (let row = 0; row < 9; row++) {
      const y = -.72 + row * .18, edge = Math.sqrt(.78 ** 2 - y ** 2);
      for (let col = 0; col <= 12; col++) await page.mouse.move(b.x + cx + rx * (row % 2 ? 1 : -1) * edge * (1 - col / 6), b.y + cy + ry * y, { steps: 3 });
    }
    await page.mouse.up(); actions.push('Dusted pastry with native held shaker');
  }
  if (!await page.locator('.cookery-finish').isVisible()) return { before, actions, hint: await page.locator('.cookery-hint').innerText(), progress: await page.locator('.cookery-progress').getAttribute('aria-valuenow'), after: await readSave() };
  await page.locator('.cookery-finish').click(); actions.push('Finished recipe through native button');
  await page.screenshot({ path: `../output/playwright/fresh-day${before.day}-${preserves ? 'preserves' : 'tart'}-finished.png`, scale: 'css' });
  const after = await readSave();
  await page.locator('.cookery-finish').click(); actions.push('Returned to ordinary kitchen');
  return { before, actions, after, dialog: await page.locator('dialog').innerText() };
}
