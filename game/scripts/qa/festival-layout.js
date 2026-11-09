// Run with the real festival panel open in an isolated browser session.
async page => {
  const report = [];
  const state = await page.locator('.festival-celebration').count() ? 'celebration' : await page.locator('.festival-wait').count() ? 'wait' : await page.locator('.festival-active').count() ? 'active' : 'choices';
  for (const [width, height] of [[1280, 900], [360, 640], [390, 844], [568, 320], [844, 390], [520, 480]]) {
    await page.setViewportSize({ width, height });
    await page.locator('.bay-festival').waitFor();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll('.bay-festival img')].map(image => image.decode())); });
    const metrics = await page.locator('.bay-festival').evaluate(root => {
      const dialog = root.closest('dialog'), box = dialog.getBoundingClientRect();
      const clipped = [...root.querySelectorAll('button,h2,h3')].filter(node => {
        const rect = node.getBoundingClientRect();
        return rect.width && (rect.left < box.left - 1 || rect.right > box.right + 1 || node.scrollWidth > node.clientWidth + 1);
      }).map(node => node.textContent.trim());
      return { horizontalOverflow: root.scrollWidth > root.clientWidth + 1, clipped, images: [...root.querySelectorAll('img')].every(image => image.complete && image.naturalWidth > 0) };
    });
    if (metrics.horizontalOverflow || metrics.clipped.length || !metrics.images) throw new Error(JSON.stringify({ width, height, ...metrics }));
    await page.screenshot({ path: `output/playwright/festival-${state}-${width}x${height}.png` });
    report.push({ width, height, ...metrics });
  }
  return report;
}
