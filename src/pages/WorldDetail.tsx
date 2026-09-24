import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CandlestickSeries, LineSeries, ColorType, createChart, type UTCTimestamp } from 'lightweight-charts';
import { useWorldQuotes } from '../hooks/useWorldQuotes';
import { WORLD_ASSETS } from '../types/world';
import { direction, formatChange, formatPrice, precision } from '../services/format';
export default function WorldDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const asset = WORLD_ASSETS.find(a => a.id === id)!;
  const [interval, setInterval] = useState('15m');
  const { entries, retry } = useWorldQuotes([id], interval);
  const entry = entries[id], quote = entry?.quote;
  const chartElement = useRef<HTMLDivElement>(null);
  const supportsCandles = true;
  useEffect(() => {
    if (!chartElement.current || !quote?.points.length) return;
    const chart = createChart(chartElement.current, {
      autoSize: true, layout: { background: { type: ColorType.Solid, color: '#101315' }, textColor: '#8c979e', attributionLogo: true },
      grid: { vertLines: { color: '#20262a' }, horzLines: { color: '#20262a' } },
      timeScale: { timeVisible: supportsCandles && interval !== '1d' },
    });
    const digits = precision(quote.price), priceFormat = { type: 'price' as const, precision: digits, minMove: 10 ** -digits };
    if (quote.candles.length) {
      chart.addSeries(CandlestickSeries, { upColor: '#76dfa7', downColor: '#f17d85', borderVisible: false, wickUpColor: '#76dfa7', wickDownColor: '#f17d85', priceFormat })
        .setData(quote.candles.map(c => ({ ...c, time: c.time as UTCTimestamp })));
    } else chart.addSeries(LineSeries, { color: '#76dfa7', lineWidth: 2, priceFormat }).setData(quote.points.map(p => ({ ...p, time: p.time as UTCTimestamp })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [quote, supportsCandles, interval]);
  return <main className="chart-page world-detail">
    <header className="detail-header"><button className="icon-button" aria-label="Back to Market" onClick={onBack}><ArrowLeft size={22}/></button><div><h1>{asset.name}</h1><span className="asset-subtitle">{asset.unit}</span></div><span className="demo-tag">{asset.source}</span></header>
    <div className={`detail-price-row ${entry?.error || entry?.refreshing ? 'world-stale' : ''}`}><div className="detail-price">{quote ? formatPrice(quote.price) : '—'}<span>{asset.unit}</span></div><div className={`detail-change ${quote?.change != null ? direction(quote.change) : ''}`}>{quote?.change != null ? formatChange(quote.change) : '—'}<small>{quote?.period ?? ''}</small></div></div>
    {entry?.refreshing && <p className="chart-message" role="status">Updating…</p>}
    {entry?.error && <div className="notice" role="alert">{entry.error} <button className="text-button" onClick={retry}>Retry</button></div>}
    {quote && <p className="world-detail-status">{quote.status} · {new Date(quote.asOf).toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC'}</p>}
    {quote && quote.points.length > 1 ? <div className="chart-container" ref={chartElement} data-testid="world-chart"/> : <p className="movers-empty">{quote ? 'Historical prices are unavailable for this source.' : 'Waiting for data…'}</p>}
    {supportsCandles && <div className="intervals" aria-label="Candle interval">{['15m', '1h', '1d'].map(value => <button key={value} aria-pressed={interval === value} className={interval === value ? 'active' : ''} onClick={() => setInterval(value)}>{value}</button>)}</div>}
    {quote && <><p className="chart-notes">{quote.historyLabel}</p><p className="world-footnote">{quote.note}</p><footer className="chart-footer"><a href={quote.sourceUrl} target="_blank" rel="noreferrer">{asset.source}</a> · Charts by <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts™</a></footer></>}
  </main>;
}
