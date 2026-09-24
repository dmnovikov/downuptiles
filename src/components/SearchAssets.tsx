import { useEffect, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { provider } from '../services/market';
import type { Asset } from '../types/market';
import { Modal } from './Modal';
export function SearchAssets({ selected, screenName, onAdd, onClose }: { selected: string[]; screenName: string; onAdd: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState(''), [assets, setAssets] = useState<Asset[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    const timer = setTimeout(() => { provider.searchAssets(query, controller.signal).then(items => { if (!controller.signal.aborted) { setAssets(items); setError(''); setLoading(false); } }).catch(() => { if (!controller.signal.aborted) { setAssets([]); setError('Search is unavailable. Please check your connection and try again.'); setLoading(false); } }); }, 100);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  return <Modal title="Add asset" onClose={onClose}>
    <p className="muted modal-description">Tab {screenName} · {selected.length}/20 assets</p>
    <label className="search-box"><Search size={18}/><input autoFocus placeholder="Name or symbol" aria-label="Search assets" value={query} onChange={event => setQuery(event.target.value)}/></label>
    {selected.length >= 20 && <p className="notice">This tab is full. Remove an asset or create another tab.</p>}
    <div className="asset-results" aria-busy={loading}>{error && <p role="alert">{error}</p>}{!loading && !assets.length && <p className="empty-small">No assets found</p>}{assets.map(asset => {
      const added = selected.includes(asset.id);
      return <button key={asset.id} className="asset-result" disabled={added || selected.length >= 20} onClick={() => onAdd(asset.id)} aria-label={added ? `${asset.symbol} already added` : `Add ${asset.symbol}`}><span className="coin-avatar" style={{ color: asset.color, backgroundColor: `${asset.color}15` }}>{asset.symbol.slice(0, 1)}</span><span className="asset-name"><strong>{asset.symbol}<span className="muted"> / USDT</span></strong><small>{asset.name}</small></span>{added ? <Check size={18} className="up"/> : <Plus size={19}/>}</button>;
    })}</div>
    <div className="search-footer"><p>Assets are added immediately.</p><button className="secondary-button full-width" onClick={onClose}><Check size={17}/>Done</button></div>
  </Modal>;
}
