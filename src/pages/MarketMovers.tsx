import { LoaderCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { useMarketMovers, type MarketExchange } from '../hooks/useMarketMovers';
import { QuoteTile } from '../components/QuoteTile';
import { MoversLoading } from '../components/MoversLoading';
const noop = () => {};
export function MarketMovers({ exchange, onOpen }: { exchange: MarketExchange; onOpen: (id: string) => void }) {
  const { data, loading, error, historyFailed, retry } = useMarketMovers(exchange);
  return <div>
    <p className="movers-status" role="status">{loading && <LoaderCircle className="movers-spinner" size={13} aria-hidden="true"/>}{data ? `${data.count} most traded USDT pairs · ${loading ? 'Updating…' : 'Updates every minute'}` : loading ? 'Loading market ranking…' : 'No market data'}</p>
    {error && <div className="notice" role="alert">{error} <button className="text-button" onClick={retry}>Retry</button></div>}
    {historyFailed && <p className="movers-footnote">Some charts are unavailable. Prices and rankings are still shown.</p>}
    {[{ title: 'Top 10 Gainers', up: true, rows: data?.gainers ?? [] }, { title: 'Top 10 Losers', up: false, rows: data?.losers ?? [] }].map(group => <section className="movers-group" key={group.title} aria-label={group.title}>
      <h2 className={group.up ? 'up' : 'down'}>{group.up ? <TrendingUp size={18}/> : <TrendingDown size={18}/>} {group.title}</h2>
      {group.rows.length ? <div className="quote-grid">{group.rows.map(quote => <QuoteTile key={quote.assetId} id={quote.assetId} snapshot={quote} snapshotStale={Boolean(error) || loading} editing={false} readOnly onOpen={onOpen} onEdit={noop} onRemove={noop} onMove={noop}/>)}</div> : loading && !data ? <div className="quote-grid" aria-busy="true"><MoversLoading/></div> : <p className="movers-empty">{!data ? 'No data' : `No ${group.up ? 'gainers' : 'losers'} in the top 100.`}</p>}
    </section>)}
    <p className="movers-footnote">Top 100 by 24-hour trading volume in USDT. Ranked by 24-hour price change. These pairs do not change your watchlists.</p>
  </div>;
}
