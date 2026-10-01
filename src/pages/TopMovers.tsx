import { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, LoaderCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { market, mexcMarket, marketFor } from '../services/market';
import { rankMovers } from '../services/movers';
import { useConnection } from '../hooks/useMarket';
import { MarketMovers } from './MarketMovers';
import { QuoteTile } from '../components/QuoteTile';
import { MoversLoading } from '../components/MoversLoading';
export type MoversTab = 'my' | 'binance' | 'mexc';
export function routeMoversTab(): MoversTab { return location.hash === '#/movers/binance' ? 'binance' : location.hash === '#/movers/mexc' ? 'mexc' : 'my'; }
const noop = () => {};
export function TopMovers({ ids, tab, onTab, onBack, onOpen }: { ids: string[]; tab: MoversTab; onTab: (tab: MoversTab) => void; onBack: () => void; onOpen: (id: string) => void }) {
  useSyncExternalStore(market.subscribeUpdates, market.getRevision);
  useSyncExternalStore(mexcMarket.subscribeUpdates, mexcMarket.getRevision);
  const connection = useConnection();
  const loading = ids.some(id => {
    const store = marketFor(id), status = store.getStatus();
    return status === 'connecting' || ((status === 'live' || status === 'polling') && !store.getQuote(id) && !store.getQuoteError(id));
  });
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now() / 1000), 5000); return () => clearInterval(timer); }, []);
  const result = rankMovers(ids.map(id => {
    const store = marketFor(id);
    return { id, quote: store.getQuote(id), error: store.getQuoteError(id), status: store.getStatus() };
  }), Math.max(now, Date.now() / 1000));
  return <main className="movers-page">
    <header className="movers-header"><button className="icon-button" onClick={onBack} aria-label="Back to watchlist"><ArrowLeft size={22}/></button><div><h1>Top movers</h1><p>{tab === 'my' ? 'All your tabs · Past 24 hours' : 'Market movers · Past 24 hours'}</p></div></header>
    <div className="movers-tabs" role="tablist" aria-label="Movers source">{(['my', 'binance', 'mexc'] as const).map(value => <button key={value} role="tab" id={`movers-tab-${value}`} aria-controls="movers-panel" aria-selected={tab === value} onClick={() => onTab(value)}>{value === 'my' ? 'My pairs' : value === 'binance' ? 'Binance' : 'MEXC'}</button>)}</div>
    <div id="movers-panel" role="tabpanel" aria-labelledby={`movers-tab-${tab}`}>
    {tab !== 'my' ? <MarketMovers key={tab} exchange={tab} onOpen={onOpen}/> : <>
    <p className="movers-status" role="status">{loading && <LoaderCircle className="movers-spinner" size={13} aria-hidden="true"/>}{!ids.length ? 'Add pairs to your watchlists to see their top movers.' : connection === 'offline' ? 'Offline · Rankings will resume when you reconnect.' : `${result.freshCount} of ${result.total} pairs up to date${loading ? ' · Updating…' : ''}`}</p>
    {([{ title: 'Top 6 Gainers', rows: result.gainers, up: true }, { title: 'Top 6 Losers', rows: result.losers, up: false }]).map(group => <section className="movers-group" key={group.title} aria-label={group.title}>
      <h2 className={group.up ? 'up' : 'down'}>{group.up ? <TrendingUp size={18}/> : <TrendingDown size={18}/>} {group.title}</h2>
      {group.rows.length || loading ? <div className="quote-grid" aria-busy={loading}>{group.rows.map(entry => <QuoteTile key={entry.id} id={entry.id} editing={false} readOnly onOpen={onOpen} onEdit={noop} onRemove={noop} onMove={noop}/>)}{loading && <MoversLoading count={Math.max(0, Math.min(4, ids.length) - group.rows.length)}/>}</div> : <p className="movers-empty">{`No ${group.up ? 'gainers' : 'losers'} with fresh data.`}</p>}
    </section>)}
    </>}
    </div>
  </main>;
}
