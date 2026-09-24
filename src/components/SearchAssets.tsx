import { useEffect, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { isDemo, providerFor, searchCatalog, type ExchangeFilter } from '../providers/registry';
import type { Asset } from '../types/market';
import { Modal } from './Modal';
import { CoinAvatar } from './CoinAvatar';
export function SearchAssets({ selected, screenName, onAdd, onClose }: { selected: string[]; screenName: string; onAdd: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState(''), [exchange, setExchange] = useState<ExchangeFilter>('all');
  const [assets, setAssets] = useState<Asset[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(20), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setAssets([]); setLimit(20);
    const timer = setTimeout(() => {
      searchCatalog(query, exchange, controller.signal).then(result => {
        if (!controller.signal.aborted) { setAssets(result.assets); setError(result.warning); setLoading(false); }
      }).catch(() => { if (!controller.signal.aborted) { setError('Search is unavailable. Please try again.'); setLoading(false); } });
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, exchange, retry]);
  return <Modal title="Add asset" onClose={onClose}>
    <p className="muted modal-description">Tab {screenName} · {selected.length}/20 assets</p>
    <label className="search-box"><Search size={18}/><input autoFocus placeholder="Name or symbol" aria-label="Search assets" value={query} onChange={event => setQuery(event.target.value)}/></label>
    {!isDemo && <div className="exchange-filters" aria-label="Filter by exchange">{(['all', 'binance', 'mexc'] as const).map(value => <button key={value} aria-pressed={exchange === value} onClick={() => setExchange(value)}>{value === 'all' ? 'All exchanges' : value.toUpperCase()}</button>)}</div>}
    {selected.length >= 20 && <p className="notice">This tab is full. Remove an asset or create another tab.</p>}
    <div className="asset-results" aria-busy={loading}>
      {loading && <p className="empty-small" role="status">Searching…</p>}
      {error && <p className="search-warning" role="alert">{error} <button className="text-button" onClick={() => setRetry(v => v + 1)}>Retry</button></p>}
      {!loading && !error && !assets.length && <p className="empty-small">No assets found</p>}
      {assets.slice(0, limit).map(asset => {
        const added = selected.includes(asset.id), source = providerFor(asset.id).name.toUpperCase();
        return <button key={asset.id} className="asset-result" disabled={added || selected.length >= 20} onClick={() => onAdd(asset.id)} aria-label={added ? `${asset.symbol} already added${isDemo ? '' : ` on ${source}`}` : `Add ${asset.symbol}${isDemo ? '' : ` on ${source}`}`}>
          <CoinAvatar asset={asset}/><span className="asset-name"><strong>{asset.symbol}<span className="muted"> / USDT</span></strong><small>{asset.name}</small></span>
          {!isDemo && <span className="asset-exchange">{source}</span>}{added ? <Check size={18} className="up"/> : <Plus size={19}/>}
        </button>;
      })}
      {!loading && assets.length > limit && <button className="secondary-button full-width" onClick={() => setLimit(n => n + 20)}>Show 20 more</button>}
    </div>
    {!loading && assets.length > 0 && <p className="search-count">{Math.min(limit, assets.length)} of {assets.length} pairs · Type to narrow results</p>}
    <div className="search-footer"><p>Assets are added immediately.</p><button className="secondary-button full-width" onClick={onClose}><Check size={17}/>Done</button></div>
  </Modal>;
}
