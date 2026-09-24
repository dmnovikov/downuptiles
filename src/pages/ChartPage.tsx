import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Maximize2 } from 'lucide-react';
import { CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { providerFor } from '../services/market';
import { useConnection, useQuote } from '../hooks/useMarket';
import { direction, formatChange, formatPrice, precision } from '../services/format';
import { INTERVALS, type Candle, type Interval } from '../types/market';
const labels: Record<Interval, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w' };
const chartCandle = (c: Candle) => ({ ...c, time: c.time as UTCTimestamp });
const volumeBar = (c: Candle) => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? '#70daa052' : '#f17d8552' });
export default function ChartPage({ assetId, onBack }: { assetId: string; onBack: () => void }) {
  const provider = providerFor(assetId);
  const asset = provider.getAsset(assetId), quote = useQuote(assetId), connection = useConnection(assetId);
  const [interval, setIntervalValue] = useState<Interval>('15m');
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [hovered, setHovered] = useState<Candle | null>(null);
  const [latestCandle, setLatestCandle] = useState<Candle | null>(null);
  const container = useRef<HTMLDivElement>(null), chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null), volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const quoteRef = useRef(quote); quoteRef.current = quote;
  useEffect(() => {
    const element = container.current!;
    const chart = createChart(element, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: '#101315' }, textColor: '#8c979e', fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 10, attributionLogo: true },
      grid: { vertLines: { color: '#20262a' }, horzLines: { color: '#20262a' } },
      rightPriceScale: { borderColor: '#282f33', scaleMargins: { top: .12, bottom: .24 } },
      timeScale: { borderColor: '#282f33', timeVisible: INTERVALS[interval] < 86400, secondsVisible: false, rightOffset: 4, barSpacing: 6, minBarSpacing: 2 },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#819a91', labelBackgroundColor: '#35423d' }, horzLine: { color: '#819a91', labelBackgroundColor: '#35423d' } },
      localization: { locale: 'en-US' },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });
    chartRef.current = chart;
    const digits = precision(quoteRef.current?.price ?? 1);
    const series = chart.addSeries(CandlestickSeries, { upColor: '#76dfa7', downColor: '#f17d85', borderVisible: false, wickUpColor: '#76dfa7', wickDownColor: '#f17d85', priceFormat: { type: 'price', precision: digits, minMove: 10 ** -digits } });
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume', lastValueVisible: false, priceLineVisible: false });
    volume.priceScale().applyOptions({ scaleMargins: { top: .82, bottom: 0 } });
    seriesRef.current = series; volumeRef.current = volume; candlesRef.current = [];
    let disposed = false, fetching = false, hasOlder = true;
    const controller = new AbortController();
    setLoading(true); setError(''); setHovered(null); setLatestCandle(null);
    const apply = (candles: Candle[]) => { candlesRef.current = candles; setLatestCandle(candles.at(-1) ?? null); series.setData(candles.map(chartCandle)); volume.setData(candles.map(volumeBar)); };
    const loadOlder = async () => {
      if (!hasOlder || fetching || disposed || !candlesRef.current.length || candlesRef.current.length >= 5000) return;
      fetching = true;
      const range = chart.timeScale().getVisibleLogicalRange();
      try {
        const older = await provider.getHistory(assetId, { interval, before: candlesRef.current[0].time, limit: 180, signal: controller.signal });
        if (disposed) return;
        if (!older.length) { hasOlder = false; return; }
        apply([...older, ...candlesRef.current]);
        if (range) chart.timeScale().setVisibleLogicalRange({ from: range.from + older.length, to: range.to + older.length });
      } catch { if (!disposed) setError('Unable to load earlier history. Please try again.'); }
      finally { fetching = false; }
    };
    // The initial request and range listener share a local ready flag (no React render dependency).
    let ready = false;
    const onRange = (range: { from: number; to: number } | null) => { if (ready && range && range.from < 15) void loadOlder(); };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    chart.subscribeCrosshairMove(event => {
      const data = event.seriesData.get(series);
      if (data && 'open' in data && typeof event.time === 'number') {
        setHovered(candlesRef.current.find(c => c.time === event.time) ?? null);
      } else { setHovered(null); }
    });
    provider.getHistory(assetId, { interval, limit: 240, signal: controller.signal }).then(candles => {
      if (disposed) return;
      if (!candles.length) throw new Error('No history is available for this pair.');
      const digits = precision(candles.at(-1)!.close);
      series.applyOptions({ priceFormat: { type: 'price', precision: digits, minMove: 10 ** -digits } });
      apply(candles);
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 65), to: candles.length + 3 });
      ready = true; setLoading(false);
    }).catch(error => { if (!disposed) { setLoading(false); setError(error instanceof Error ? error.message : 'Unable to load the chart.'); } });
    return () => { disposed = true; controller.abort(); chart.remove(); chartRef.current = null; seriesRef.current = null; volumeRef.current = null; };
    // Recreate only when the instrument or candle interval changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, interval, retry]);
  useEffect(() => {
    if (loading || !candlesRef.current.length || connection === 'offline' || connection === 'paused' || connection === 'error' || connection === 'connecting') return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setInterval> | undefined;
    let stop: (() => void) | undefined;
    let lastUpdate = Date.now(), polling = false;
    const applyCandle = (candle: Candle) => {
      if (controller.signal.aborted || !seriesRef.current) return;
      const last = candlesRef.current.at(-1);
      if (!last || candle.time < last.time) return;
      if (candle.time === last.time) candlesRef.current[candlesRef.current.length - 1] = candle;
      else candlesRef.current.push(candle);
      seriesRef.current.update(chartCandle(candle)); volumeRef.current?.update(volumeBar(candle));
      lastUpdate = Date.now(); setLatestCandle(candle);
    };
    const poll = async () => {
      try {
        const candles = await provider.getHistory(assetId, { interval, limit: 3, signal: controller.signal });
        if (controller.signal.aborted) return;
        candles.forEach(applyCandle); setError('');
      } catch { if (!controller.signal.aborted) setError('Chart updates are temporarily unavailable.'); }
      if (!controller.signal.aborted) timer = setTimeout(() => void poll(), provider.isDemo ? 2000 : 15000);
    };
    const usePolling = () => {
      if (polling || controller.signal.aborted) return;
      polling = true; stop?.(); clearInterval(watchdog); void poll();
    };
    if (provider.subscribeHistory) {
      stop = provider.subscribeHistory(assetId, interval, applyCandle, usePolling);
      watchdog = setInterval(() => { if (Date.now() - lastUpdate > 20000) usePolling(); }, 5000);
    } else usePolling();
    return () => { controller.abort(); stop?.(); clearTimeout(timer); clearInterval(watchdog); };
  }, [loading, assetId, interval, connection]);
  const candle = hovered ?? latestCandle;
  return <section className="chart-page">
    <header className="detail-header"><button className="icon-button" onClick={onBack} aria-label="Back to watchlist"><ArrowLeft size={22}/></button><div><h1>{asset?.symbol}<span className="muted"> / USDT</span></h1><span className="asset-subtitle">{asset?.name}</span></div><span className="demo-tag">{provider.isDemo ? 'DEMO' : provider.name.toUpperCase()}</span></header>
    <div className="detail-price-row"><div className="detail-price">{quote ? formatPrice(quote.price) : '—'}<span>USDT</span></div><div className={`detail-change ${quote ? direction(quote.change24h) : ''}`}>{quote ? formatChange(quote.change24h) : '—'}<small>past 24 hours</small></div></div>
    <div className="daily-stats"><span>24h high <b>{quote ? formatPrice(quote.high24h) : '—'}</b></span><span>24h low <b>{quote ? formatPrice(quote.low24h) : '—'}</b></span></div>
    <div className="chart-toolbar"><span>Candlesticks</span><button className="text-button" onClick={() => { const count = candlesRef.current.length; chartRef.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, count - 65), to: count + 3 }); }}><Maximize2 size={13}/> Latest price</button></div>
    <div className="ohlc"><span>{hovered ? new Date(hovered.time * 1000).toLocaleString('en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : 'Current candle'}</span><div>{(['open', 'high', 'low', 'close'] as const).map((key, i) => <span key={key}>{['O', 'H', 'L', 'C'][i]} <b>{candle ? formatPrice(candle[key]) : '—'}</b></span>)}</div></div>
    <div className="chart-container" ref={container} data-testid="candle-chart"/>
    {loading && <p className="chart-message" role="status">Loading history…</p>}
    {error && <div className="notice" role="alert">{error}<button className="text-button" onClick={() => setRetry(v => v + 1)}>Retry</button></div>}
    <div className="intervals" aria-label="Candle interval">{(Object.keys(INTERVALS) as Interval[]).map(value => <button key={value} className={interval === value ? 'active' : ''} aria-pressed={interval === value} onClick={() => setIntervalValue(value)}>{labels[value]}</button>)}</div>
    <div className="chart-notes"><span>Candle interval · UTC</span><span>Pinch to zoom</span></div>
    <footer className="chart-footer">{provider.isDemo ? 'Simulated data' : `${provider.name} Spot data`} · Charts by <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts™</a></footer>
  </section>;
}
