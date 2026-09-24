import { useState, type Dispatch } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Workspace } from '../types/workspace';
import type { WorkspaceAction } from '../storage/workspace';
import { Modal } from './Modal';
export function ScreenManager({ workspace, dispatch, onClose }: { workspace: Workspace; dispatch: Dispatch<WorkspaceAction>; onClose: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(workspace.screens.length < 5 ? 'new' : null), [name, setName] = useState(''), [deleting, setDeleting] = useState<string | null>(null);
  const submit = () => { if (!name.trim()) return; if (editingId === 'new') { dispatch({ type: 'create', id: globalThis.crypto?.randomUUID?.() ?? `screen-${Date.now()}-${Math.random().toString(36).slice(2)}`, name }); onClose(); } else if (editingId) dispatch({ type: 'rename', id: editingId, name }); setEditingId(null); };
  return <Modal title={editingId === 'new' ? 'New tab' : 'My tabs'} onClose={onClose}>
    <p className="muted modal-description">Up to 5 tabs with 20 assets each.</p>
    <div className="screen-list">{workspace.screens.map((screen, i) => <div key={screen.id} className="screen-row">
      <button className="screen-select" onClick={() => { dispatch({ type: 'activate', id: screen.id }); onClose(); }}><span className={`screen-number ${screen.id === workspace.activeScreenId ? 'selected' : ''}`}>{i + 1}</span><span><strong>{screen.name}</strong><small>{screen.assets.length} / 20 assets</small></span></button>
      <div className="screen-tools"><button className="icon-button" disabled={i === 0} aria-label={`Move up ${screen.name}`} onClick={() => dispatch({ type: 'reorderScreens', from: i, to: i - 1 })}><ArrowUp size={15}/></button><button className="icon-button" disabled={i === workspace.screens.length - 1} aria-label={`Move down ${screen.name}`} onClick={() => dispatch({ type: 'reorderScreens', from: i, to: i + 1 })}><ArrowDown size={15}/></button><button className="icon-button" aria-label={`Rename ${screen.name}`} onClick={() => { setEditingId(screen.id); setName(screen.name); setDeleting(null); }}><Pencil size={15}/></button><button className="icon-button" disabled={workspace.screens.length === 1} aria-label={`Delete tab ${screen.name}`} onClick={() => { setDeleting(screen.id); setEditingId(null); }}><Trash2 size={15}/></button></div>
    </div>)}</div>
    {editingId && <form className="name-form" onSubmit={event => { event.preventDefault(); submit(); }}><label htmlFor="screen-name">{editingId === 'new' ? 'New tab name' : 'New name'}</label><div><input id="screen-name" autoFocus value={name} maxLength={24} onChange={event => setName(event.target.value)} placeholder="e.g. Favorites"/><button className="primary-button" disabled={!name.trim()} aria-label="Save name">{editingId === 'new' ? 'Create' : <Check size={18}/>}</button></div></form>}
    {deleting && <div className="confirm-box"><p>Delete tab «{workspace.screens.find(s => s.id === deleting)?.name}» and its watchlist?</p><div className="button-row"><button className="secondary-button" onClick={() => setDeleting(null)}>Cancel</button><button className="danger-button" onClick={() => { dispatch({ type: 'delete', id: deleting }); setDeleting(null); }}>Delete tab</button></div></div>}
    {!editingId && <button className="primary-button full-width" disabled={workspace.screens.length >= 5} onClick={() => { setEditingId('new'); setName(''); setDeleting(null); }}><Plus size={18}/>{workspace.screens.length >= 5 ? 'Tab limit reached' : 'Create tab'}</button>}
  </Modal>;
}
