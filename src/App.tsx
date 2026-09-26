import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Settings as SettingsIcon, Layers, Pencil, Plus, WifiOff } from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { WorldMarket } from './pages/WorldMarket';
import { WORLD_ASSETS } from './types/world';
import { TopMovers, routeMoversTab, type MoversTab } from './pages/TopMovers';
import { QuoteTile } from './components/QuoteTile';
import { Modal } from './components/Modal';
import { SearchAssets } from './components/SearchAssets';
import { ScreenManager } from './components/ScreenManager';
import { Settings } from './components/Settings';
import { useWorkspace } from './hooks/useWorkspace';
import { useOverlayHistory } from './hooks/useOverlayHistory';
import { useConnection, useMarket } from './hooks/useMarket';
import { provider } from './services/market';
import { trackPageView } from './services/analytics';
const WorldDetail = lazy(() => import('./pages/WorldDetail'));
function worldRoute() { const id = location.hash.replace('#/market/', ''); return { active: location.hash.startsWith('#/market'), id: WORLD_ASSETS.some(a => a.id === id) ? id : null }; }
let chartLoaded = false;
const ChartPage = lazy(() => import('./pages/ChartPage').then(module => { chartLoaded = true; return module; }));
function routeAsset() { try { const id = decodeURIComponent(location.hash.replace(/^#\/asset\//, '')); return provider.getAsset(id) ? id : null; } catch { return null; } }
export default function App() {
  const { workspace, dispatch, storageError } = useWorkspace();
  const screen = workspace.screens.find(s => s.id === workspace.activeScreenId)!;
  const [assetId, setAssetId] = useState<string | null>(routeAsset), [editing, setEditing] = useState(false);
  const [movers, setMovers] = useState(() => location.hash.startsWith('#/movers'));
  const [moversTab, setMoversTab] = useState<MoversTab>(routeMoversTab);
  const [world, setWorld] = useState(worldRoute);
  const allIds = [...new Set(workspace.screens.flatMap(tab => tab.assets))].filter(id => !!provider.getAsset(id));
  const { modal, moving, setModal, setMoving } = useOverlayHistory();
  const [toast, setToast] = useState('');
  const connection = useConnection();
  useMarket(world.active ? [] : assetId ? [assetId] : movers ? moversTab === 'my' ? allIds : [] : screen.assets.filter(id => !!provider.getAsset(id)));
  useEffect(trackPageView, [assetId, movers, moversTab, world.active, world.id]);
  useEffect(() => { const update = () => { setWorld(worldRoute()); setAssetId(routeAsset()); setMovers(location.hash.startsWith('#/movers')); setMoversTab(routeMoversTab()); }; window.addEventListener('hashchange', update); window.addEventListener('popstate', update); return () => { window.removeEventListener('hashchange', update); window.removeEventListener('popstate', update); }; }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { setEditing(false); window.scrollTo({ top: 0 }); }, [screen.id, assetId, movers]);
  const openAsset = useCallback((id: string) => { history.pushState({ chart: true, chartFrom: location.hash.startsWith('#/movers') ? 'movers' : 'watchlist' }, '', `#/asset/${encodeURIComponent(id)}`); setAssetId(id); setMovers(false); window.scrollTo({ top: 0 }); }, []);
  const back = () => { if (history.state?.chart) history.back(); else { history.replaceState(null, '', location.pathname + location.search); setAssetId(null); setMovers(false); } };
  const openMovers = () => { if (movers) return; history.pushState({ movers: true }, '', '#/movers'); setWorld({ active: false, id: null }); setMoversTab('my'); setMovers(true); };
  const changeMoversTab = (tab: MoversTab) => { history.replaceState(history.state, '', tab === 'my' ? '#/movers' : `#/movers/${tab}`); setMoversTab(tab); };
  const backFromMovers = () => { if (history.state?.movers) history.back(); else { history.replaceState(null, '', location.pathname + location.search); setMovers(false); } };
  const setMarketMode = (active: boolean) => { history.pushState({}, '', active ? '#/market' : '#'); setWorld({ active, id: null }); setMovers(false); setAssetId(null); };
  const openWorldAsset = (id: string) => { history.pushState({ worldDetail: true }, '', `#/market/${id}`); setWorld({ active: true, id }); };
  const backWorld = () => { if (history.state?.worldDetail) history.back(); else { history.replaceState({}, '', '#/market'); setWorld({ active: true, id: null }); } };
  const edit = useCallback(() => setEditing(true), []);
  const remove = useCallback((id: string) => { dispatch({ type: 'remove', screenId: screen.id, assetId: id }); setToast(`${provider.getAsset(id)?.symbol ?? id} removed from this tab`); }, [screen.id, dispatch]);
  const move = useCallback((id: string) => setMoving(id), [setMoving]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const reorder = ({ active, over }: DragEndEvent) => { if (over && active.id !== over.id) dispatch({ type: 'reorder', screenId: screen.id, from: screen.assets.indexOf(String(active.id)), to: screen.assets.indexOf(String(over.id)) }); };
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const index = workspace.screens.indexOf(screen);
  return <div className="app-shell">
    {storageError && <div className="notice" role="alert">{storageError}</div>}
    {!world.active && (connection === 'offline' || connection === 'error') && <div className="connection-banner" role="status"><WifiOff size={14}/>{connection === 'offline' ? 'Offline · Showing last known prices' : 'Prices may be outdated · Reconnecting'}</div>}
    {world.id ? <Suspense fallback={<div className="page-loading">Loading chart…</div>}><WorldDetail key={world.id} id={world.id} onBack={backWorld}/></Suspense> : assetId ? connection === 'offline' && !chartLoaded ? <div className="empty-state"><WifiOff size={30}/><h2>Chart not downloaded yet</h2><p>It will load when you are back online.<br/>Your watchlists are still available.</p><button className="primary-button" onClick={back}>Back to watchlist</button></div> : <Suspense fallback={<div className="page-loading">Loading chart…</div>}><ChartPage assetId={assetId} onBack={back} backLabel={history.state?.chartFrom === 'movers' ? 'Back to Top movers' : 'Back to watchlist'}/></Suspense> : <>
      <header className="app-header"><a className="brand" href="#/movers" onClick={event => { event.preventDefault(); openMovers(); }} aria-label="downuptiles · Top movers" title="Top movers"><img className="brand-logo" src="/logo.png" alt="" width="30" height="30"/><span>downup<span>tiles</span></span></a><div className="header-actions"><div className="market-switch" role="group" aria-label="Market type"><button aria-pressed={!world.active && !movers} onClick={() => { if (world.active || movers) setMarketMode(false); }}>Crypto</button><button aria-pressed={movers} onClick={() => { if (!movers) openMovers(); }}>Tops</button><button aria-pressed={world.active} onClick={() => { if (!world.active) setMarketMode(true); }}>Market</button></div><button className="icon-button" aria-label="Settings" title="Settings" onClick={() => setModal('settings')}><SettingsIcon size={19}/></button></div></header>
      {movers ? <TopMovers tab={moversTab} onTab={changeMoversTab} ids={allIds} onBack={backFromMovers} onOpen={openAsset}/> : world.active ? <WorldMarket onOpen={openWorldAsset}/> : <main aria-label="Quotes">
        <div className="tabs-row"><div className="tabs" role="tablist" aria-label="Tabs">{workspace.screens.map(s => <button key={s.id} role="tab" aria-selected={s.id === screen.id} aria-controls="quote-panel" id={`tab-${s.id}`} className={s.id === screen.id ? 'active' : ''} onClick={() => dispatch({ type: 'activate', id: s.id })}>{s.name}<span>{s.assets.length}</span></button>)}</div><button className="icon-button manage-button" aria-label="Manage tabs" title="Manage tabs" onClick={() => setModal('screens')}><Layers size={20}/></button></div>
        <div className="swipe-area" onTouchStart={event => { swipe.current = !editing && event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }} onTouchEnd={event => {
          if (editing || !swipe.current) return;
          const dx = event.changedTouches[0].clientX - swipe.current.x, dy = event.changedTouches[0].clientY - swipe.current.y; swipe.current = null;
          if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.6) { const next = workspace.screens[index + (dx < 0 ? 1 : -1)]; if (next) dispatch({ type: 'activate', id: next.id }); }
        }} onTouchCancel={() => { swipe.current = null; }}>
        <div className="grid-caption watchlist-caption">
          <span className="caption-status">{editing ? 'DRAG ⋮⋮ TO REORDER' : <><i className={`live-dot ${connection === 'live' || connection === 'polling' ? '' : 'muted-dot'}`}/>{connection === 'live' || connection === 'polling' ? 'CHART & CHANGE · 24H' : connection === 'connecting' ? 'CONNECTING…' : connection === 'paused' ? 'UPDATES PAUSED' : 'LAST KNOWN PRICES'}</>}</span>
          <span className="caption-pair">{!editing && 'USDT PAIRS'}<button className={`icon-button edit-toggle ${editing ? 'active' : ''}`} aria-label={editing ? 'Finish editing' : 'Edit tiles'} onClick={() => setEditing(value => !value)}>{editing ? <Check size={20}/> : <Pencil size={18}/>}</button><button className="add-asset-button" aria-label="Add" title={screen.assets.length >= 20 ? 'This tab already has 20 assets' : 'Add asset'} disabled={screen.assets.length >= 20} onClick={() => setModal('search')}><Plus size={17}/></button></span>
        </div>
        <div id="quote-panel" role="tabpanel" aria-labelledby={`tab-${screen.id}`} className="quote-panel">
          {screen.assets.length ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}><SortableContext items={screen.assets} strategy={rectSortingStrategy}><div className="quote-grid">{screen.assets.map(id => <QuoteTile key={id} id={id} editing={editing} onOpen={openAsset} onEdit={edit} onRemove={remove} onMove={move}/>)}</div></SortableContext></DndContext> : <div className="empty-state"><Layers size={32} strokeWidth={1.3}/><h2>Your next watchlist</h2><p>Add the coins you want<br/>to keep an eye on.</p><button className="primary-button" onClick={() => setModal('search')}><Plus size={17}/>Add asset</button></div>}
        </div>
        <div className="watchlist-footer"><span>{String(index + 1).padStart(2, '0')} / {String(workspace.screens.length).padStart(2, '0')}</span><div className="page-dots">{workspace.screens.map(s => <button key={s.id} className={s.id === screen.id ? 'active' : ''} aria-label={`Switch to tab ${s.name}`} onClick={() => dispatch({ type: 'activate', id: s.id })}/>)}</div><span>{editing ? 'EDITING' : 'SAVED ON DEVICE'}</span></div>
        </div>
      </main>}
    </>}
    {modal === 'search' && <SearchAssets selected={screen.assets} excluded={workspace.screens.filter(s => s.id !== screen.id).flatMap(s => s.assets)} screenName={screen.name} onClose={() => setModal(null)} onAdd={id => { dispatch({ type: 'add', screenId: screen.id, assetId: id }); setToast(`${provider.getAsset(id)?.symbol} added`); }}/>}
    {modal === 'screens' && <ScreenManager workspace={workspace} dispatch={dispatch} onClose={() => setModal(null)}/>}
    {modal === 'settings' && <Settings workspace={workspace} onImport={next => { dispatch({ type: 'import', workspace: next }); setEditing(false); setModal(null); setToast('Layout imported'); }} onClose={() => setModal(null)} onHelp={() => setModal('help')} onReset={() => { dispatch({ type: 'reset' }); setEditing(false); setModal(null); setToast('Default Main tab restored'); }}/>}
    {modal === 'help' && <Modal title="downuptiles" onClose={() => setModal(null)}><p className="help-intro">The market at a glance.</p><p className="help-copy">{provider.isDemo ? 'These are simulated quotes, not live market prices. They update every 2 seconds.' : 'Prices, 24-hour changes and candles come from Binance Spot and MEXC Spot. The exchange is shown on each tile. Availability depends on your region and network. Prices are never replaced with simulated data.'}</p><div className="help-section"><h3>Each tile shows the last 24 hours</h3><p>The line uses 15-minute samples. Line and percentage colors: <span className="up">up</span>, <span className="down">down</span>, <span className="flat">unchanged</span>.</p><p><span className="up">●</span> &gt;15% &nbsp; <span className="up">●●</span> &gt;30% &nbsp; <span className="up">●●●</span> &gt;50%</p><p><span className="down">●</span> &lt;−15% &nbsp; <span className="down">●●</span> &lt;−30% &nbsp; <span className="down">●●●</span> &lt;−50%</p></div><div className="help-section"><h3>Make it yours</h3><p>Press and hold a tile to reorder, remove or move it. Swipe or tap a tab to switch lists.</p><p>Your lists are saved in this browser. Create up to 5 tabs with 20 assets each.</p></div><div className="help-section"><h3>Market · For reference</h3><p>The Market section provides a quick overview for comparing crypto with global markets. Quotes may be delayed or updated at different times, so prices and charts may not reflect the same moment.</p></div><div className="help-section"><h3>Missing a pair?</h3><p>If you cannot find a pair on Binance or MEXC, let us know which pairs you would like to see.</p><p><a href="https://github.com/dmnovikov/downuptiles/issues/new" target="_blank" rel="noreferrer">Request a pair on GitHub</a></p></div><div className="help-section"><h3>Credits</h3><p>Created by Dmitrij Novikov.<br/>Built with AI assistance.</p><p><a href="https://github.com/dmnovikov/downuptiles" target="_blank" rel="noreferrer">GitHub · downuptiles</a></p></div></Modal>}
    {moving && <Modal title={`Move ${provider.getAsset(moving)?.symbol ?? moving}`} onClose={() => setMoving(null)}><p className="muted modal-description">Choose a destination tab</p><div className="move-list">{workspace.screens.filter(s => s.id !== screen.id).map(s => {
      const reason = s.assets.includes(moving) ? 'Already added' : s.assets.length >= 20 ? 'Tab is full' : `${s.assets.length} / 20 assets`;
      return <button key={s.id} disabled={s.assets.includes(moving) || s.assets.length >= 20} onClick={() => { dispatch({ type: 'move', from: screen.id, to: s.id, assetId: moving }); setMoving(null); setToast(`Moved to tab ${s.name}`); }}><span><strong>{s.name}</strong><small>{reason}</small></span><ChevronRight size={18}/></button>;
    })}</div>{workspace.screens.length === 1 && <div className="empty-small"><p>Create another tab first.</p><button className="primary-button" onClick={() => { setModal('screens'); }}>Manage tabs</button></div>}</Modal>}
    {toast && <div className="toast" role="status"><Check size={16}/>{toast}</div>}
  </div>;
}
