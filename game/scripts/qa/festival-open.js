async page => {
  await page.getByRole('button', { name: 'Открыть бухту', exact: true }).click();
  await page.getByRole('button', { name: 'Праздники гавани', exact: true }).click();
  await page.locator('.bay-festival').waitFor();
  return await page.locator('.bay-festival').innerText();
}
