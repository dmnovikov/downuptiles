import { test, expect } from '@playwright/test';
test('mobile workspace, chart, editing and persistence', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.quote-tile')).toHaveCount(8);
  await expect(page.getByTestId('tile-btc').locator('.tile-price')).not.toHaveText('—');
  await expect(page.locator('.quote-tile').first()).toHaveAttribute('data-testid', 'tile-btc');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-main.png', fullPage: true });
  await page.getByRole('button', { name: 'Open chart for BTC', exact: true }).click();
  await expect(page.getByTestId('candle-chart').locator('canvas').first()).toBeVisible();
  await expect(page.getByText('Loading history…')).toBeHidden();
  await page.getByRole('button', { name: '1h', exact: true }).click();
  await expect(page.getByRole('button', { name: '1h', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/mobile-chart.png', fullPage: true });
  await page.getByRole('button', { name: 'Back to watchlist' }).click();
  await page.getByRole('button', { name: 'Edit tiles' }).click();
  await page.getByRole('button', { name: 'Remove BTC', exact: true }).click();
  await expect(page.locator('.quote-tile')).toHaveCount(7);
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await page.reload();
  await expect(page.locator('.quote-tile')).toHaveCount(7);
  await expect(page.getByTestId('tile-btc')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search assets' }).fill('DOG');
  await page.getByRole('button', { name: 'Add DOGE', exact: true }).click();
  await expect(page.getByRole('button', { name: 'DOGE already added' })).toBeDisabled();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByTestId('tile-doge')).toBeVisible();
  await page.getByRole('button', { name: 'Manage tabs', exact: true }).click();
  await page.getByLabel('New tab name').fill('DeFi');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('heading', { name: 'Your next watchlist' })).toBeVisible();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search assets' }).fill('ETH');
  await expect(page.getByText('No available assets found', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add ETH', exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search assets' }).fill('BTC');
  await expect(page.getByRole('button', { name: 'Add BTC', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('tab', { name: /Main/ }).click();
  await page.getByRole('button', { name: 'Edit tiles' }).click();
  await page.getByRole('button', { name: 'Move ETH', exact: true }).click();
  await page.getByRole('button', { name: /DeFi.*assets/ }).click();
  await expect(page.getByTestId('tile-eth')).toHaveCount(0);
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await page.getByRole('tab', { name: /DeFi/ }).click();
  await expect(page.getByTestId('tile-eth')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: /DeFi/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('tile-eth')).toBeVisible();
  expect(errors).toEqual([]);
});
test('long press enters edit without opening chart; keyboard reorder persists', async ({ page }) => {
  await page.goto('/');
  const tile = page.getByRole('button', { name: 'Open chart for BTC', exact: true });
  await tile.dispatchEvent('pointerdown', { button: 0, clientX: 80, clientY: 280, pointerId: 1 });
  await expect(page.getByRole('button', { name: 'Finish editing', exact: true })).toBeVisible();
  await tile.dispatchEvent('pointerup', { button: 0 });
  await expect(page.getByTestId('candle-chart')).toHaveCount(0);
  const handle = page.getByRole('button', { name: 'Drag BTC', exact: true });
  await handle.focus();
  await page.keyboard.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Draggable item btc was moved over droppable area eth.', { exact: true })).toBeAttached();
  await page.keyboard.press('Space');
  await expect(page.locator('.quote-tile').nth(1)).toHaveAttribute('data-testid', 'tile-btc');
  await page.reload();
  await expect(page.locator('.quote-tile').nth(1)).toHaveAttribute('data-testid', 'tile-btc');
});
test('offline keeps tiles and resumes; small and desktop viewports do not overflow', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByTestId('tile-btc').locator('.tile-price')).not.toHaveText('—');
  const lastPrice = await page.getByTestId('tile-btc').locator('.tile-price').textContent();
  await context.setOffline(true);
  await expect(page.getByTestId('tile-btc')).toHaveClass(/stale/);
  await expect(page.getByTestId('tile-btc').getByText('Stale data')).toBeVisible();
  await expect(page.getByTestId('tile-btc').locator('.tile-price')).toHaveText(lastPrice!);
  await expect(page.getByText('Offline · Showing last known prices')).toBeVisible();
  await expect(page.locator('.quote-tile')).toHaveCount(8);
  await context.setOffline(false);
  await expect(page.getByText('Offline · Showing last known prices')).toBeHidden();
  await expect(page.getByTestId('tile-btc')).not.toHaveClass(/stale/);
  await expect(page.getByTestId('tile-btc').getByText('Stale data')).toBeHidden();
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
});
test('touch swipe changes screens; touch drag reorders and stays on screen', async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem('cryptotiles.workspace', JSON.stringify({ version: 1, initialized: true, activeScreenId: 'main', screens: [{ id: 'main', name: 'Main', assets: ['btc', 'eth', 'sol', 'ltc', 'gram', 'trx', 'bnb', 'xrp'] }, { id: 'second', name: 'Second', assets: ['doge'] }] })));
  await page.goto('/');
  const cdp = await context.newCDPSession(page);
  const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const tile = await page.getByTestId('tile-btc').boundingBox();
  const y = tile!.y + 55;
  await touch('touchStart', 320, y);
  for (let x = 300; x >= 65; x -= 25) { await touch('touchMove', x, y); await page.waitForTimeout(16); }
  await touch('touchEnd');
  await expect(page.getByRole('tab', { name: /Second/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('tile-doge')).toBeVisible();
  await page.getByRole('tab', { name: /Main/ }).click();
  // An actual held touch enters editing, without opening the instrument.
  const btc = await page.getByTestId('tile-btc').boundingBox();
  await touch('touchStart', btc!.x + 50, btc!.y + 35);
  await page.waitForTimeout(600);
  await touch('touchEnd');
  await expect(page.getByRole('button', { name: 'Finish editing', exact: true })).toBeVisible();
  const from = await page.getByRole('button', { name: 'Drag BTC', exact: true }).boundingBox();
  const to = await page.getByRole('button', { name: 'Drag ETH', exact: true }).boundingBox();
  const x0 = from!.x + from!.width / 2, y0 = from!.y + from!.height / 2;
  await touch('touchStart', x0, y0);
  for (let i = 1; i <= 12; i++) { await touch('touchMove', x0 + (to!.x + to!.width / 2 - x0) * i / 12, y0); await page.waitForTimeout(20); }
  await touch('touchEnd');
  await expect(page.locator('.quote-tile').nth(1)).toHaveAttribute('data-testid', 'tile-btc');
  await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');
});
test('all candle intervals and history pan remain usable', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#/asset/gram');
  for (const interval of ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']) {
    await page.getByRole('button', { name: interval, exact: true }).click();
    await expect(page.getByText('Loading history…')).toBeHidden();
    await expect(page.getByTestId('candle-chart').locator('canvas').first()).toBeVisible();
  }
  const chart = await page.getByTestId('candle-chart').boundingBox();
  for (let i = 0; i < 7; i++) {
    await page.mouse.move(chart!.x + 35, chart!.y + 120); await page.mouse.down();
    await page.mouse.move(chart!.x + 280, chart!.y + 120, { steps: 8 }); await page.mouse.up();
  }
  await page.getByRole('button', { name: 'Latest price' }).click();
  expect(errors).toEqual([]);
});
test('first chart opening offline keeps navigation available', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByTestId('tile-btc').locator('.tile-price')).not.toHaveText('—');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Open chart for BTC', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chart not downloaded yet' })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByTestId('candle-chart').locator('canvas').first()).toBeVisible();
  await page.getByRole('button', { name: 'Back to watchlist' }).click();
  await expect(page.locator('.quote-tile')).toHaveCount(8);
});
test('swipe works in blank space below tiles and on an empty screen', async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem('cryptotiles.workspace', JSON.stringify({ version: 1, initialized: true, activeScreenId: 'main', screens: [{ id: 'main', name: 'Main', assets: ['btc', 'eth', 'sol', 'ltc', 'gram', 'trx', 'bnb', 'xrp'] }, { id: 'empty', name: 'Empty', assets: [] }] })));
  await page.goto('/');
  const cdp = await context.newCDPSession(page);
  const swipe = async (fromX: number, toX: number, y: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fromX, y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: fromX + (toX - fromX) * i / 10, y }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const blankY = page.viewportSize()!.height - 65;
  expect(await page.evaluate(y => !document.querySelector('#quote-panel')!.contains(document.elementFromPoint(300, y)), blankY)).toBe(true);
  await swipe(310, 75, blankY);
  await expect(page.getByRole('tab', { name: /Empty/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Your next watchlist' })).toBeVisible();
  await swipe(75, 310, blankY);
  await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: /Empty/ }).click();
  const empty = await page.locator('.empty-state').boundingBox();
  await swipe(75, 310, empty!.y + 35);
  await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');
  // Native vertical scrolling must not turn into a tab swipe.
  await page.setViewportSize({ width: 390, height: 500 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 370 }] });
  for (let y = 350; y >= 170; y -= 20) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');
});
test('reset requires confirmation and restores defaults persistently', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit tiles' }).click();
  await page.getByRole('button', { name: 'Remove BTC', exact: true }).click();
  await page.getByRole('button', { name: 'Manage tabs', exact: true }).click();
  await page.getByLabel('New tab name').fill('Custom');
  await page.getByRole('button', { name: 'Save name' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Reset to defaults/ }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab', { name: /Custom/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Reset to defaults/ }).click();
  await page.getByRole('button', { name: 'Restore Main', exact: true }).click();
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(page.locator('.quote-tile')).toHaveCount(8);
  await page.reload();
  await expect(page.getByRole('tab', { name: /Main/ })).toHaveAttribute('aria-selected', 'true');
  expect(await page.locator('.quote-tile').evaluateAll(tiles => tiles.map(tile => tile.getAttribute('data-testid')))).toEqual(['tile-btc', 'tile-eth', 'tile-sol', 'tile-ltc', 'tile-gram', 'tile-trx', 'tile-bnb', 'tile-xrp']);
});
test('asset picker has Done and browser Back dismisses dialogs without leaving the app', async ({ page }) => {
  await page.goto('/');
  const appUrl = page.url();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search assets' }).fill('DOG');
  await page.getByRole('button', { name: 'Add DOGE', exact: true }).click();
  await expect(page.getByRole('button', { name: 'DOGE already added' })).toBeDisabled();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('tile-doge')).toBeVisible();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(appUrl);
  await expect(page.getByTestId('tile-doge')).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /About/ }).click();
  await expect(page.getByRole('dialog', { name: 'downuptiles' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(appUrl);
  // Dialog transitions use a single history entry, with no invisible entries left behind.
  await page.getByRole('button', { name: 'Open chart for BTC', exact: true }).click();
  await expect(page.getByTestId('candle-chart')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('tile-btc')).toBeVisible();
});
test('layout export and confirmed import preserve tabs, tiles and active selection after reload', async ({ page }) => {
  const layout = { version: 1, initialized: true, activeScreenId: 'second', screens: [
    { id: 'second', name: 'Favorites', assets: ['xrp', 'btc', 'sol'] },
    { id: 'main', name: 'Empty', assets: [] },
  ] };
  await page.goto('/');
  await page.evaluate(value => localStorage.setItem('cryptotiles.workspace', JSON.stringify(value)), layout);
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export layout/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^downuptiles-layout-.*\.json$/);
  const file = await download.path();
  expect(file).toBeTruthy();
  const { readFile } = await import('node:fs/promises');
  const backup = JSON.parse(await readFile(file!, 'utf8'));
  expect(backup.workspace).toEqual(layout);
  await page.getByRole('button', { name: /Reset to defaults/ }).click();
  await page.getByRole('button', { name: 'Restore Main', exact: true }).click();
  await expect(page.locator('.quote-tile')).toHaveCount(8);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Layout backup file').setInputFiles(file!);
  await expect(page.getByRole('group', { name: 'Confirm import' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cryptotiles.workspace')!).screens.length)).toBe(1);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Confirm import' })).toHaveCount(0);
  await page.getByLabel('Layout backup file').setInputFiles(file!);
  await page.getByRole('button', { name: 'Import and replace', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Favorites/ })).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cryptotiles.workspace')!))).toEqual(layout);
  expect(await page.locator('.quote-tile').evaluateAll(tiles => tiles.map(tile => tile.getAttribute('data-testid')))).toEqual(['tile-xrp', 'tile-btc', 'tile-sol']);
  await page.getByRole('tab', { name: /Empty/ }).click();
  await expect(page.getByRole('heading', { name: 'Your next watchlist' })).toBeVisible();
});
test('invalid import leaves the existing layout intact', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => localStorage.getItem('cryptotiles.workspace'));
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Layout backup file').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await expect(page.getByRole('alert')).toContainText('Your current layout has not changed.');
  await expect(page.getByRole('button', { name: 'Import and replace', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('cryptotiles.workspace'))).toBe(before);
});

test('first load without connectivity shows gray No data tiles', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }));
  await page.goto('/');
  const tile = page.getByTestId('tile-btc');
  await expect(tile).toHaveClass(/stale/);
  await expect(tile.getByText('No data', { exact: true })).toBeVisible();
  await expect(tile.locator('.tile-price')).toHaveText('—');
  await expect(tile.locator('.loading-line')).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
    window.dispatchEvent(new Event('online'));
  });
  await expect(tile.locator('.tile-price')).not.toHaveText('—');
  await expect(tile).not.toHaveClass(/stale/);
  await expect(tile.getByText('No data', { exact: true })).toBeHidden();
});

test('reload restores cached prices and charts in gray until fresh data arrives', async ({ page }) => {
  await page.goto('/');
  const tile = page.getByTestId('tile-btc');
  await expect(tile.locator('.tile-price')).not.toHaveText('—');
  await expect(tile).not.toHaveClass(/stale/);
  // Save the current snapshot as a mobile browser does when hiding the page.
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const cached = await page.evaluate(() => JSON.parse(localStorage.getItem('cryptotiles.quotes.v1.Demo')!).find((q: { assetId: string }) => q.assetId === 'btc'));
  expect(cached.price).toBeGreaterThan(0);
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }));
  await page.reload();
  await expect(tile).toHaveClass(/stale/);
  await expect(tile.locator('.tile-price')).not.toHaveText('—');
  await expect(tile.getByText('Stale data')).toBeVisible();
  await expect(tile.locator('svg.sparkline')).toBeVisible();
  await expect(tile.locator('.loading-line')).toHaveCount(0);
  const color = await tile.locator('.tile-price').evaluate(el => getComputedStyle(el).color);
  await expect(tile.locator('svg.sparkline')).toHaveCSS('color', color);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
    window.dispatchEvent(new Event('online'));
  });
  await expect(tile).not.toHaveClass(/stale/);
  await expect(tile.getByText('Stale data')).toBeHidden();
});

test('Top movers includes all tabs, deduplicates, opens charts and returns to the selected tab', async ({ page, context }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('cryptotiles.workspace')) localStorage.setItem('cryptotiles.workspace', JSON.stringify({ version: 1, initialized: true, activeScreenId: 'second', screens: [
      { id: 'main', name: 'Main', assets: ['btc', 'eth', 'sol'] },
      { id: 'second', name: 'Other', assets: ['btc'] },
    ] }));
  });
  await page.goto('/');
  await expect(page.locator('.quote-tile')).toHaveCount(1);
  await page.getByRole('link', { name: 'downuptiles · Top movers' }).click();
  await expect(page).toHaveURL(/#\/movers$/);
  await expect(page.getByRole('heading', { name: 'Top movers', exact: true })).toBeVisible();
  await expect(page.getByText('3 of 3 pairs up to date')).toBeVisible();
  await expect(page.locator('.movers-page .quote-tile')).toHaveCount(3);
  await expect(page.getByTestId('tile-btc')).toHaveCount(1);
  await expect(page.getByTestId('tile-eth')).toBeVisible();
  const tile = page.getByTestId('tile-eth').locator('.tile-content');
  await tile.dispatchEvent('pointerdown', { button: 0, clientX: 80, clientY: 280, pointerId: 1 });
  await page.waitForTimeout(600);
  await tile.dispatchEvent('pointerup', { button: 0 });
  await expect(page.locator('.tile-actions')).toHaveCount(0);
  await tile.click();
  await expect(page.getByTestId('candle-chart')).toBeVisible();
  await page.getByRole('button', { name: 'Back to Top movers' }).click();
  await expect(page.getByRole('heading', { name: 'Top movers', exact: true })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText('Offline · Rankings will resume when you reconnect.')).toBeVisible();
  await expect(page.locator('.movers-page .quote-tile')).toHaveCount(0);
  await context.setOffline(false);
  await expect(page.locator('.movers-page .quote-tile')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/top-movers.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Top movers', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to watchlist' }).click();
  await expect(page.getByRole('tab', { name: /Other/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.quote-tile')).toHaveCount(1);
  await page.getByRole('link', { name: 'downuptiles · Top movers' }).click();
  await page.goBack();
  await expect(page.getByRole('tab', { name: /Other/ })).toHaveAttribute('aria-selected', 'true');
});

test('Top movers direct link handles an empty workspace and returns safely', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cryptotiles.workspace', JSON.stringify({ version: 1, initialized: true, activeScreenId: 'empty', screens: [{ id: 'empty', name: 'Empty', assets: [] }] })));
  await page.goto('/#/movers');
  await expect(page.getByText('Add pairs to your watchlists to see their top movers.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to watchlist' }).click();
  await expect(page.getByRole('heading', { name: 'Your next watchlist' })).toBeVisible();
});

test('Market movers switches sources, opens charts, preserves watchlists and handles offline data', async ({ page, context }) => {
  await page.goto('/');
  const before = await page.evaluate(() => localStorage.getItem('cryptotiles.workspace'));
  await page.getByRole('link', { name: 'downuptiles · Top movers' }).click();
  await page.getByRole('tab', { name: 'Binance', exact: true }).click();
  await expect(page).toHaveURL(/#\/movers\/binance$/);
  await expect(page.getByRole('heading', { name: 'Top 10 Gainers' })).toBeVisible();
  await expect(page.locator('.movers-page .quote-tile').first()).toBeVisible();
  const gainers = page.getByRole('region', { name: 'Top 10 Gainers' });
  expect(await gainers.locator('.quote-tile').count()).toBeLessThanOrEqual(10);
  await page.locator('.movers-page .tile-content').first().click();
  await expect(page.getByTestId('candle-chart')).toBeVisible();
  await page.getByRole('button', { name: 'Back to Top movers' }).click();
  await expect(page.getByRole('tab', { name: 'Binance', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'MEXC', exact: true }).click();
  await expect(page.locator('.movers-page .quote-tile').first()).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole('alert')).toContainText('Offline');
  await expect(page.locator('.movers-page .quote-tile').first()).toHaveClass(/stale/);
  await context.setOffline(false);
  await expect(page.locator('.movers-page .quote-tile').first()).not.toHaveClass(/stale/);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'MEXC', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'My pairs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Top 5 Gainers' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('cryptotiles.workspace'))).toBe(before);
});

test('Crypto and Market switch preserves watchlists, labels world prices and supports history/back', async ({ page }) => {
  await page.route('**/api/world/quote?*', route => {
    const id = new URL(route.request().url()).searchParams.get('id')!;
    const fx = id.startsWith('usd-');
    return route.fulfill({ json: { id, price: fx ? 1.2 : 100, change: 2,
      asOf: '2026-09-25T00:00:00+05:00', status: 'Market closed', period: 'Day',
      historyLabel: '5 days · 15m candles', note: 'Source details', sourceUrl: 'https://finance.yahoo.com/',
      points: [{ time: 1700000000, value: 98 }, { time: 1700086400, value: 100 }],
      candles: [{ time: 1700000000, open: 97, high: 100, low: 96, close: 98, volume: 10 }, { time: 1700086400, open: 98, high: 102, low: 97, close: 100, volume: 10 }],
    } });
  });
  await page.goto('/');
  const saved = await page.evaluate(() => localStorage.getItem('cryptotiles.workspace'));
  await page.getByRole('button', { name: 'Tops', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Top movers', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tops', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Tops', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Market', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Market', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.world-tile')).toHaveCount(10);
  await expect(page.getByTestId('world-usd-kzt')).toContainText('USD/KZT');
  await expect(page.getByTestId('world-usd-uzs')).toContainText('YAHOO');
  await expect(page.getByTestId('world-gold')).toContainText('Gold futures');
  await page.getByRole('button', { name: 'Open S&P 500', exact: true }).click();
  await expect(page.getByTestId('world-chart').locator('canvas').first()).toBeVisible();
  await page.getByRole('button', { name: '1d', exact: true }).click();
  await page.getByRole('button', { name: 'Back to Market' }).click();
  await page.getByRole('button', { name: 'Open USD/UZS', exact: true }).click();
  await expect(page.getByTestId('world-chart').locator('canvas').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '1d', exact: true })).toBeVisible();
  await page.goBack();
  await page.reload();
  await expect(page.locator('.world-tile')).toHaveCount(10);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Crypto', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('cryptotiles.workspace'))).toBe(saved);
});
