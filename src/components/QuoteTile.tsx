import { memo, useEffect, useRef } from 'react';
import { ArrowUpRight, GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useConnection, useQuote, useQuoteError } from '../hooks/useMarket';
import { providerFor } from '../services/market';
import { direction, formatChange, formatPrice, changeDots } from '../services/format';
import { Sparkline } from './Sparkline';
interface Props { id: string; editing: boolean; readOnly?: boolean; onOpen: (id: string) => void; onEdit: () => void; onRemove: (id: string) => void; onMove: (id: string) => void }
export const QuoteTile = memo(function QuoteTile({ id, editing, readOnly = false, onOpen, onEdit, onRemove, onMove }: Props) {
  const provider = providerFor(id);
  const asset = provider.getAsset(id), quote = useQuote(id), error = useQuoteError(id);
  const connection = useConnection(id);
  const unavailable = Boolean(error) || connection === 'offline' || connection === 'error';
  const stale = Boolean(quote) && (unavailable || connection === 'connecting');
  const refreshing = stale && connection === 'connecting';
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !editing });
  const press = useRef<{ x: number; y: number; fired: boolean; moved: boolean; timer?: ReturnType<typeof setTimeout> } | null>(null);
  useEffect(() => () => clearTimeout(press.current?.timer), []);
  const color = stale || unavailable ? 'stale' : quote ? direction(quote.change24h) : 'flat', dots = quote ? changeDots(quote.change24h) : 0;
  const cancel = () => clearTimeout(press.current?.timer);
  return <article ref={setNodeRef} className={`quote-tile ${color} ${refreshing ? 'refreshing' : ''} ${editing ? 'editing' : ''} ${isDragging ? 'dragging' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }} data-testid={`tile-${id}`} aria-busy={refreshing}>
    <button className="tile-content" disabled={editing} aria-label={`Open chart for ${asset?.symbol ?? id}`} onContextMenu={event => event.preventDefault()}
      onPointerDown={event => {
        if (readOnly || editing || event.button !== 0) return;
        cancel(); press.current = { x: event.clientX, y: event.clientY, fired: false, moved: false };
        press.current.timer = setTimeout(() => { if (press.current && !press.current.moved) { press.current.fired = true; onEdit(); } }, 500);
      }}
      onPointerMove={event => { if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 9) { press.current.moved = true; cancel(); } }}
      onPointerUp={cancel} onPointerCancel={() => { cancel(); if (press.current) press.current.moved = true; }}
      onClick={() => { if (press.current?.fired || press.current?.moved) { press.current = null; return; } onOpen(id); }}>
      <div className="tile-top"><span className="pair">{asset?.symbol ?? id}<span>/USDT</span></span><span className="tile-source-info"><span className="tile-source">{provider.isDemo ? 'DEMO' : provider.name.toUpperCase()}</span><span className="change-dots" aria-label={dots ? `${quote && quote.change24h < 0 ? 'Down more than' : 'Up more than'} ${dots === 3 ? 50 : dots === 2 ? 30 : 15} percent` : undefined}>{Array.from({ length: dots }, (_, i) => <i key={i}/>)}</span></span></div>
      <div className="tile-price">{quote ? formatPrice(quote.price) : '—'}</div>
      {quote ? <Sparkline points={quote.sparkline}/> : unavailable ? <div className="tile-unavailable" title={error}>No data</div> : <div className="sparkline loading-line"/>}
      <div className="tile-bottom"><span className="tile-change">{quote ? formatChange(quote.change24h) : '—'}</span><span className="period-label">{stale ? 'Stale data' : '24h'}</span></div>
    </button>
    {editing && <div className="tile-actions"><button aria-label={`Remove ${asset?.symbol}`} onClick={() => onRemove(id)}><Trash2 size={16}/></button><button aria-label={`Move ${asset?.symbol}`} onClick={() => onMove(id)}><ArrowUpRight size={18}/></button><button ref={setActivatorNodeRef} {...attributes} {...listeners} className="drag-handle" aria-label={`Drag ${asset?.symbol}`}><GripVertical size={19}/></button></div>}
  </article>;
});
