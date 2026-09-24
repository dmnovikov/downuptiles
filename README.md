# CryptoTiles

A compact, mobile-first crypto watchlist. React + TypeScript + Vite, with an English UI.
The default application now uses **real Binance Spot market data**, directly from the browser.
No API keys, exchange account, backend or trading permissions are required.

## Run

Node.js 22.12+ and npm are required (tested with Node.js 22.23.2).

```sh
npm ci
npm run dev
```

Open http://localhost:5173. On a phone connected to the same local network, use
`http://<computer-IP>:5173`. Lists are stored separately for each browser and origin.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

The static production build is in `dist/`. Hash navigation supports static hosting.
The app does not require a proxy or a private API credential.

## Market data

- Source: **Binance Spot**, USDT pairs only. Availability depends on region/network and exchange listings.
- REST: `https://data-api.binance.vision/api/v3`.
- WebSocket: `wss://data-stream.binance.vision/stream`.
- Market discovery: cached `exchangeInfo`, active spot pairs only. Searches return up to 100 matches.
- Initial quotes: batched `ticker/24hr`, at most 20 symbols per request.
- Sparklines: 15-minute candle closes for the last 24 hours, with the ticker's rolling 24h opening
  price at the start and current price at the end. The percent uses the same ticker baseline.
- Live watchlist: one combined WebSocket for visible instruments, with ticker and 15m candle streams.
- Candle chart: real OHLCV history plus a candle WebSocket for the selected interval.
- History loading is limited to four concurrent sparkline requests. REST sparkline history is cached
  for one minute; incoming candles update that cache.
- On quote stream failure, polling refreshes the batch every 5 seconds. Failures increase the delay;
  HTTP 429/418 respect `Retry-After`. A live reconnect is attempted after 60 seconds.
- Silent quote streams fall back after 30 seconds. Silent chart streams fall back after 20 seconds,
  with chart polling every 15 seconds. Offline/background tabs pause subscriptions.
- Unsupported pairs show an explicit message. **Real data is never replaced with mock prices.**

### GRAM

The user confirmed that GRAM means the native TON coin, formerly Toncoin, not a separate
TON-based token sharing the ticker. The existing `gram` asset ID explicitly maps to Binance
`GRAMUSDT`, verified against the exchange announcement and `exchangeInfo`.
Its display name is “Gram (formerly Toncoin)”; searching for Toncoin also finds GRAM.
Legacy `ton` entries are not silently remapped: if TONUSDT is unavailable, the tile explains
that Toncoin now trades as GRAM.

Reference: [Binance Toncoin → Gram announcement](https://www.binance.com/en/square/post/340336090265410).

Official API references:
[public market-data hosts](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md),
[REST](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md),
[WebSocket streams](https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md).

## UI and storage

- Two compact columns on phones; four on wide screens.
- Initial Main tab: BTC, ETH, SOL, LTC, GRAM, TRX, BNB, XRP, in that order.
- Price, daily sparkline and rolling 24h percentage. Green for gains, red for losses, yellow for
  changes rounding to zero. Values and colors use the same displayed percentage.
- Movement dots: magnitude strictly greater than 15% / 30% / 50% gives one / two / three dots;
  green for positive changes, red for negative changes.
- Tap a tile for candlesticks, volume, crosshair, pan and zoom. Intervals: 1m/5m/15m/30m/1h/4h/1d/1w.
  Chart timestamps use UTC. Older history loads when scrolling left, up to approximately 5000 candles.
- The chart library is loaded only when opening the chart.
- Up to 5 tabs with 20 assets each. The top `+` opens tab creation and management.
- Swipe on tiles or empty space to switch tabs. Vertical scrolling stays available.
- Hold a tile or tap the pencil to reorder, remove or move assets. Drag handles support touch/mouse;
  keyboard users can focus the handle, press Space, move with arrows and press Space to drop.
- Asset search adds immediately; **Done** closes the picker. Browser Back dismisses an open dialog first.
- Settings include About, **Export layout**, **Import layout**, and **Reset to defaults**.
- Export downloads a versioned `cryptotiles-layout-<timestamp>.json` file with tab IDs/names/order,
  asset IDs/order and the active tab. It contains no quotes, account data or network credentials.
- Import validates the file (maximum 256 KB), previews its tabs, and asks before replacing all lists.
  Invalid files, duplicate IDs/assets, unsupported versions and limits over 5 tabs/20 assets are rejected.
  Empty tabs are preserved. Import on another device to transfer the layout; prices load from the provider.
- Reset to defaults also requires confirmation before replacing all lists.
- LocalStorage key: `cryptotiles.workspace`; schema `version: 1`, `initialized: true`.
  Empty lists are preserved. Corrupt or newer-version data is not silently overwritten.
  An explicitly confirmed reset can replace it. Storage failures are shown in the UI.
- Lists are not synchronized between devices or multiple browser windows.

## Architecture

```text
src/
  components/       Tiles, SVG sparklines, dialogs, search, settings, tab management
  pages/            Lazy-loaded candlestick chart
  hooks/            Market subscriptions, workspace persistence, dialog history
  services/         MarketStore, stream/polling lifecycle, formatting
  providers/        Binance provider, known asset metadata, mock provider
  storage/          Workspace operations and saved-data validation
  types/            Market and workspace contracts
  App.tsx           Layout, navigation and gestures
  styles.css        Mobile-first styling, no heavy UI framework
```

UI → hooks → MarketStore → MarketDataProvider. Providers own all market requests and exchange
response parsing. React tiles never start their own network loops. Each tile subscribes to its own
quote through `useSyncExternalStore`; an update does not rerender the entire grid.

Array order determines tab/asset order, without duplicated `position` fields. Existing asset IDs
are preserved. Additional Binance instruments use exchange-scoped IDs such as `binance:XYZ`.
The provider validates those IDs against active exchange markets before requesting prices.
One symbol can appear on multiple tabs, but cannot be added twice to the same tab.
The last tab cannot be deleted; its asset list can be empty.

`src/types/market.ts` defines the provider contract:

- `name`, `isDemo`: source identification.
- `getAsset(id)`, `searchAssets(query, signal?)`: metadata and discovery.
- `getQuote(id, signal?)`, `getQuotes(ids, signal?)`: single and batched quotes.
- `getHistory(id, { interval, limit?, before?, signal? })`: OHLCV candles, with Unix seconds timestamps.
- `subscribeQuotes(ids, onQuotes, onError)`: optional live quotes, returning an unsubscribe function.
- `subscribeHistory(id, interval, onCandle, onError)`: optional candle stream.

Batch results can contain per-asset errors, so one unavailable pair does not break the whole list.
Successful quotes carry price, 24h change/high/low, update time and sparkline points.

## Tests and demo mode

```sh
npm test              # Deterministic unit tests, including response validation and fallback
npm run test:e2e      # UI/touch tests against an isolated mock server on port 5174
npm run test:live     # Real REST + WebSocket browser smoke test against port 5173
```

Playwright uses `/usr/bin/google-chrome`; override with `CHROME_PATH` if needed. Browser tests start
or reuse their server. Live tests depend on network access and Binance availability. Screenshots and
failure traces go to `test-results/`.

For a deliberate offline-development demo:

```sh
npm run dev -- --mode test --port 5174
```

`.env.test` selects `VITE_MARKET_PROVIDER=mock`. The default development/production mode selects
Binance. There is no automatic switch to demo data when Binance is unavailable.
Mock prices and all chart intervals derive from one deterministic function of time.

## Remaining platform work

PWA/service worker, offline cold start, Capacitor, Android/iOS projects and app-store packaging are
not implemented yet. The current milestone is the mobile web app. Physical Android/iPhone testing
is still needed; Chromium touch emulation does not replace it. No accounts, orders, wallets,
alerts, portfolio, cloud sync or backend are included.

The conversation refinements supersede the original `task.md`: daily sparklines, signed movement
dots, candlestick intervals, compact English UI, and now real market data.

## Chart attribution

[TradingView Lightweight Charts™](https://www.tradingview.com/) is distributed under Apache-2.0.
TradingView attribution is retained on the chart and in its footer.
