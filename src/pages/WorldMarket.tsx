import { useWorldQuotes } from '../hooks/useWorldQuotes';
import { WORLD_ASSETS } from '../types/world';
import { direction, formatChange, formatPrice } from '../services/format';
import { Sparkline } from '../components/Sparkline';
export function WorldMarket({ onOpen }: { onOpen: (id: string) => void }) {
  const { entries, retry } = useWorldQuotes(WORLD_ASSETS.map(a => a.id));
  const failed = Object.values(entries).some(e => e.error);
  return <main aria-label="World markets">
    <div className="grid-caption"><span>WORLD MARKETS</span><span>METALS · INDICES · FX · OIL</span></div>
    {failed && <p className="world-notice" role="status">Some sources are unavailable. <button className="text-button" onClick={retry}>Retry</button></p>}
    <div className="quote-grid">{WORLD_ASSETS.map(asset => {
      const entry = entries[asset.id], quote = entry?.quote;
      const stale = Boolean(entry?.error) || Boolean(quote && entry?.refreshing);
      const color = stale ? 'stale' : quote?.change != null ? direction(quote.change) : 'world-neutral';
      return <article className={`quote-tile ${color} ${quote && entry?.refreshing ? 'refreshing' : ''}`} key={asset.id} data-testid={`world-${asset.id}`}>
        <button className="tile-content world-tile" onClick={() => onOpen(asset.id)} aria-label={`Open ${asset.name}`}>
          <div className="tile-top"><span className="pair">{asset.name}</span><span className="tile-source">{asset.source}</span></div>
          <div className="tile-price">{quote ? formatPrice(quote.price) : '—'}<span className="world-unit">{asset.unit}</span></div>
          {quote?.points.length && quote.points.length > 1 ? <Sparkline points={quote.points} label={quote.historyLabel}/> : <div className="world-history-note">{quote ? quote.historyLabel : entry?.error ? 'No data' : 'Loading…'}</div>}
          <div className="tile-bottom"><span className="tile-change">{quote?.change != null ? formatChange(quote.change) : '—'}</span><span className="period-label">{stale ? 'Stale data' : quote?.status ?? ''}</span></div>
        </button>
      </article>;
    })}</div>
    <p className="world-footnote">Yahoo Finance data may be delayed; currency updates can be infrequent. Gold, silver and oil are futures. Tap a tile for its date, source and chart.</p>
  </main>;
}
