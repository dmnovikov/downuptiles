import { test, expect } from '@playwright/test';
test('real Binance REST, ticker streams and candlesticks work directly in the browser', async ({ page }) => {
  const errors: string[] = [], frames: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('binance.vision')) requests.push(request.url()); });
  page.on('websocket', socket => socket.on('framereceived', frame => frames.push(String(frame.payload))));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Crypto', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('tile-btc').locator('.tile-price')).not.toHaveText('—', { timeout: 40000 });
  for (const id of ['btc', 'eth', 'sol', 'ltc', 'gram', 'trx', 'bnb', 'xrp']) {
    await expect(page.getByTestId(`tile-${id}`).locator('.sparkline')).toBeVisible();
    await expect(page.getByTestId(`tile-${id}`).locator('.tile-price')).not.toHaveText('—');
  }
  await expect.poll(() => frames.some(frame => frame.includes('24hrTicker')), { timeout: 20000 }).toBe(true);
  await page.screenshot({ path: 'test-results-live/live-main.png', fullPage: true });
  await page.getByRole('button', { name: 'Open chart for BTC', exact: true }).click();
  await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });
  await expect(page.locator('.ohlc b').first()).not.toHaveText('—');
  await expect.poll(() => frames.some(frame => frame.includes('kline_15m')), { timeout: 15000 }).toBe(true);
  await page.getByRole('button', { name: '1h', exact: true }).click();
  await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });
  await expect.poll(() => frames.some(frame => frame.includes('kline_1h')), { timeout: 15000 }).toBe(true);
  await page.screenshot({ path: 'test-results-live/live-chart.png', fullPage: true });
  console.log(JSON.stringify({ requests: requests.length, websocketFrames: frames.length, price: await page.locator('.detail-price').innerText() }));
  await page.getByRole('button', { name: 'Back to watchlist' }).click();
  await page.getByRole('button', { name: 'Open chart for GRAM', exact: true }).click();
  await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });
  await expect(page.locator('.asset-subtitle')).toHaveText('Gram (formerly Toncoin)');
  await expect(page.locator('.ohlc b').first()).not.toHaveText('—');
  await expect.poll(() => frames.some(frame => frame.includes('gramusdt@kline_15m')), { timeout: 15000 }).toBe(true);
  await page.screenshot({ path: 'test-results-live/live-gram.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('MEXC search, local icons, mixed tiles and candle intervals work', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'MEXC', exact: true }).click();
  await expect(page.locator('.asset-result')).toHaveCount(20, { timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Show 20 more' })).toBeVisible();
  await page.getByRole('button', { name: 'Show 20 more' }).click();
  await expect(page.locator('.asset-result')).toHaveCount(40);
  await page.getByRole('textbox', { name: 'Search assets' }).fill('BTC');
  const result = page.getByRole('button', { name: 'Add BTC on MEXC', exact: true });
  await expect(result).toBeVisible();
  await expect.poll(() => result.locator('img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: 'test-results-live/live-search-mexc.png', fullPage: true });
  await result.click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const tile = page.getByTestId('tile-mexc:BTC');
  await expect(tile.locator('.tile-price')).not.toHaveText('—', { timeout: 30000 });
  await expect(tile.locator('.tile-source')).toHaveText('MEXC');
  await expect(page.getByTestId('tile-btc').locator('.tile-source')).toHaveText('BINANCE');
  await tile.locator('.tile-content').click();
  await expect(page.locator('.detail-header .demo-tag')).toHaveText('MEXC');
  await expect(page.locator('.ohlc b').first()).not.toHaveText('—', { timeout: 20000 });
  for (const interval of ['1h', '1w']) {
    await page.getByRole('button', { name: interval, exact: true }).click();
    await expect(page.getByText('Loading history…')).toBeHidden({ timeout: 20000 });
    await expect(page.locator('.ohlc b').first()).not.toHaveText('—');
  }
  await page.screenshot({ path: 'test-results-live/live-mexc-chart.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('MEXC-only MX pair recovers from an outage without interrupting Binance', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cryptotiles.workspace', JSON.stringify({
    version: 1, initialized: true, activeScreenId: 'mixed', screens: [{ id: 'mixed', name: 'Mixed', assets: ['btc', 'mexc:MX'] }],
  })));
  await page.goto('/');
  const mx = page.getByTestId('tile-mexc:MX'), btc = page.getByTestId('tile-btc');
  await expect(mx.locator('.tile-price')).not.toHaveText('—', { timeout: 20000 });
  await expect(btc.locator('.tile-price')).not.toHaveText('—', { timeout: 20000 });
  await page.route('**/api/mexc/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await expect(mx).toHaveClass(/stale/, { timeout: 15000 });
  await expect(mx.getByText('Stale data')).toBeVisible();
  await expect(btc).not.toHaveClass(/stale/);
  await page.unroute('**/api/mexc/**');
  await expect(mx).not.toHaveClass(/stale/, { timeout: 25000 });
  await page.route('**/api/mexc/exchangeInfo*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search assets' }).fill('BTC');
  await expect(page.getByRole('button', { name: 'BTC already added on BINANCE', exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('alert')).toContainText('MEXC search unavailable');
});

for (const exchange of ['binance', 'mexc'] as const) {
  test(`market-wide ${exchange} ranks top 100 by volume and loads only displayed charts`, async ({ page }) => {
    const historyRequests: string[] = [];
    page.on('request', request => { if (request.url().includes('/klines?')) historyRequests.push(request.url()); });
    await page.goto(`/#/movers/${exchange}`);
    await expect(page.getByRole('tab', { name: exchange === 'binance' ? 'Binance' : 'MEXC', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('100 most traded USDT pairs · Updates every minute')).toBeVisible({ timeout: 30000 });
    const gainers = page.getByRole('region', { name: 'Top 10 Gainers' }), losers = page.getByRole('region', { name: 'Top 10 Losers' });
    await expect(gainers.locator('.quote-tile')).toHaveCount(10);
    await expect(losers.locator('.quote-tile')).toHaveCount(10);
    await expect(page.locator('.movers-page svg.sparkline')).toHaveCount(20, { timeout: 30000 });
    expect(historyRequests.length).toBe(20);
    const positive = await gainers.locator('.tile-change').allTextContents();
    const negative = await losers.locator('.tile-change').allTextContents();
    const parse = (text: string) => Number(text.replace('−', '-').replace('%', ''));
    expect(positive.every(value => parse(value) > 0)).toBe(true);
    expect(negative.every(value => parse(value) < 0)).toBe(true);
    expect(positive.map(parse)).toEqual(positive.map(parse).sort((a, b) => b - a));
    expect(negative.map(parse)).toEqual(negative.map(parse).sort((a, b) => a - b));
    await page.screenshot({ path: `test-results-live/market-movers-${exchange}.png`, fullPage: true });
    await page.locator('.movers-page .tile-content').first().click();
    await expect(page.locator('.ohlc b').first()).not.toHaveText('—', { timeout: 20000 });
    await page.getByRole('button', { name: 'Back to Top movers' }).click();
    await expect(page).toHaveURL(new RegExp(`#/movers/${exchange}$`));
  });
}

test('World Market loads Yahoo metal futures, indices, Brent and five currency pairs', async ({ page }) => {
  await page.goto('/#/market');
  await expect(page.locator('.world-tile')).toHaveCount(10);
  for (const id of ['gold', 'silver', 'sp500', 'nasdaq100', 'brent', 'usd-eur', 'usd-rub', 'usd-uzs', 'usd-cny', 'usd-kzt']) {
    await expect(page.getByTestId(`world-${id}`).locator('.tile-price')).not.toHaveText(/^—/, { timeout: 35000 });
  }
  await expect(page.getByTestId('world-usd-uzs')).toContainText('YAHOO');
  await expect(page.getByTestId('world-brent')).toContainText('Brent futures');
  await page.screenshot({ path: 'test-results-live/world-market.png', fullPage: true });
  await page.getByRole('button', { name: 'Open S&P 500', exact: true }).click();
  await expect(page.getByTestId('world-chart').locator('canvas').first()).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Back to Market' }).click();
  await page.getByRole('button', { name: 'Open USD/UZS', exact: true }).click();
  await expect(page.getByTestId('world-chart').locator('canvas').first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.intervals')).toBeVisible();
});
