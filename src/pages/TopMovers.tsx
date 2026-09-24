import { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, TrendingDown, TrendingUp } from 'lucide-react';
import { market, mexcMarket, marketFor } from '../services/market';
import { rankMovers } from '../services/movers';
import { useConnection } from '../hooks/useMarket';
import { QuoteTile } from '../components/QuoteTile';
const noop = () => {};
export function TopMovers({ ids, onBack, onOpen }: { ids: string[]; onBack: () => void; onOpen: (id: string) => void }) {
  useSyncExternalStore(market.subscribeUpdates, market.getRevision);
  useSyncExternalStore(mexcMarket.subscribeUpdates, mexcMarket.getRevision);
  const connection = useConnection();
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now() / 1000), 5000); return () => clearInterval(timer); }, []);
  const result = rankMovers(ids.map(id => {
    const store = marketFor(id);
    return { id, quote: store.getQuote(id), error: store.getQuoteError(id), status: store.getStatus() };
  }), Math.max(now, Date.now() / 1000));
  return <main className="movers-page">
    <header className="movers-header"><button className="icon-button" onClick={onBack} aria-label="Back to watchlist"><ArrowLeft size={22}/></button><div><h1>Top movers</h1><p>All your tabs · Past 24 hours</p></div></header>
    <p className="movers-status" role="status">{!ids.length ? 'Add pairs to your watchlists to see their top movers.' : connection === 'offline' ? 'Offline · Rankings will resume when you reconnect.' : `${result.freshCount} of ${result.total} pairs up to date${connection === 'connecting' ? ' · Updating…' : ''}`}</p>
    {([{ title: 'Top 5 Gainers', rows: result.gainers, up: true }, { title: 'Top 5 Losers', rows: result.losers, up: false }]).map(group => <section className="movers-group" key={group.title} aria-label={group.title}>
      <h2 className={group.up ? 'up' : 'down'}>{group.up ? <TrendingUp size={18}/> : <TrendingDown size={18}/>} {group.title}</h2>
      {group.rows.length ? <div className="quote-grid">{group.rows.map(entry => <QuoteTile key={entry.id} id={entry.id} editing={false} readOnly onOpen={onOpen} onEdit={noop} onRemove={noop} onMove={noop}/>)}</div> : <p className="movers-empty">{connection === 'connecting' ? 'Waiting for fresh prices…' : `No ${group.up ? 'gainers' : 'losers'} with fresh data.`}</p>}
    </section>)}
    <p className="movers-footnote">Only fresh prices are ranked. The same pair on different exchanges is listed separately.</p>
  </main>;
}
