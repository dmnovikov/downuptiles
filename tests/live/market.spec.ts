import { test, expect } from '@playwright/test';
test('real Binance REST, ticker streams and candlesticks work directly in the browser', async ({ page }) => {
  const errors: string[] = [], frames: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('binance.vision')) requests.push(request.url()); });
  page.on('websocket', socket => socket.on('framereceived', frame => frames.push(String(frame.payload))));
  await page.goto('/');
  await expect(page.locator('.demo-tag')).toHaveText('BINANCE');
  await expect(page.getByTestId('tile-btc').locator('.tile-price')).not.toHaveText('—', { timeout: 40000 });
  for (const id of ['btc', 'eth', 'sol', 'ltc', 'gram', 'trx', 'bnb', 'xrp']) {
    await expect(page.getByTestId(`tile-${id}`).locator('.sparkline')).toBeVisible();
    await expect(page.getByTestId(`tile-${id}`).locator('.tile-price')).not.toHaveText('—');
  }
  await expect.poll(() => frames.some(frame => frame.includes('24hrTicker')), { timeout: 20000 }).toBe(true);
  await page.screenshot({ path: 'test-results/live-main.png', fullPage: true });
  await page.getByRole('button', { name: 'Open chart for BTC', exact: true }).click();
  await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });
  await expect(page.locator('.ohlc b').first()).not.toHaveText('—');
  await expect.poll(() => frames.some(frame => frame.includes('kline_15m')), { timeout: 15000 }).toBe(true);
  await page.getByRole('button', { name: '1h', exact: true }).click();
  await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });
  await expect.poll(() => frames.some(frame => frame.includes('kline_1h')), { timeout: 15000 }).toBe(true);
  await page.screenshot({ path: 'test-results/live-chart.png', fullPage: true });
  console.log(JSON.stringify({ requests: requests.length, websocketFrames: frames.length, price: await page.locator('.detail-price').innerText() }));
  await page.getByRole('button', { name: 'Back to watchlist' }).click();
  await page.getByRole('button', { name: 'Open chart for GRAM', exact: true }).click();
  await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });
  await expect(page.locator('.asset-subtitle')).toHaveText('Gram (formerly Toncoin)');
  await expect(page.locator('.ohlc b').first()).not.toHaveText('—');
  await expect.poll(() => frames.some(frame => frame.includes('gramusdt@kline_15m')), { timeout: 15000 }).toBe(true);
  await page.screenshot({ path: 'test-results/live-gram.png', fullPage: true });
  expect(errors).toEqual([]);
});
