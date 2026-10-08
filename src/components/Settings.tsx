import { useRef, useState, type ChangeEvent } from 'react';
import { CircleHelp, Download, FileText, RotateCcw, Send, Upload } from 'lucide-react';
import { Modal } from './Modal';
import type { Workspace } from '../types/workspace';
import { downloadBackup, MAX_BACKUP_BYTES, parseBackup } from '../storage/backup';
import { readStartWithTops, saveStartWithTops } from '../storage/preferences';

interface Props {
  workspace: Workspace;
  onClose: () => void;
  onHelp: () => void;
  onDisclaimer: () => void;
  onReset: () => void;
  onImport: (workspace: Workspace) => void;
}

export function Settings({ workspace, onClose, onHelp, onDisclaimer, onReset, onImport }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<Workspace | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [startWithTops, setStartWithTops] = useState(readStartWithTops);
  const [preferenceError, setPreferenceError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const exportLayout = async () => {
    setError(''); setMessage('');
    try { await downloadBackup(workspace); setMessage('Your layout backup is ready to save.'); }
    catch { setError('Unable to export your layout. Please try again.'); }
  };
  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReading(true); setPending(null); setConfirming(false); setError(''); setMessage('');
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('File is too large. Choose a downuptiles JSON backup under 256 KB.');
      setPending(parseBackup(await file.text()));
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to read this file.'); }
    finally { setReading(false); }
  };

  return <Modal title="Settings" onClose={onClose}>
    <div className="settings-actions">
      <label className="settings-action startup-preference"><span>Open Tops on startup<small>Start with My pairs instead of Crypto</small></span><input type="checkbox" role="switch" checked={startWithTops} onChange={event => {
        try { saveStartWithTops(event.target.checked); setStartWithTops(event.target.checked); setPreferenceError(''); }
        catch { setPreferenceError('Unable to save this setting in your browser.'); }
      }}/></label>
      <button className="settings-action" onClick={exportLayout}><Download size={19}/><span>Export layout<small>Save your tabs and tile order to a JSON file</small></span></button>
      <button className="settings-action" disabled={reading} onClick={() => input.current?.click()}><Upload size={19}/><span>Import layout<small>Restore tabs and tile order from a backup</small></span></button>
      <input ref={input} type="file" accept=".json,application/json" aria-label="Layout backup file" hidden onChange={event => void readFile(event)}/>
      <button className="settings-action" disabled={reading} onClick={() => { setPending(null); setConfirming(true); setError(''); setMessage(''); }}><RotateCcw size={19}/><span>Reset to defaults<small>Restore the original watchlist</small></span></button>
      <a className="settings-action settings-link" href="https://t.me/downuptiles" target="_blank" rel="noopener noreferrer"><Send size={19}/><span>Subscribe to our Telegram<small>@downuptiles</small></span></a>
      <button className="settings-action" onClick={onDisclaimer}><FileText size={19}/><span>Disclaimer</span></button>
      <button className="settings-action" onClick={onHelp}><CircleHelp size={19}/><span>About<small>Version 0.3</small></span></button>
    </div>
    {preferenceError && <p className="notice" role="alert">{preferenceError}</p>}
    {reading && <p className="backup-status" role="status">Reading backup…</p>}
    {message && <p className="backup-status" role="status">{message}</p>}
    {error && <p className="notice" role="alert">{error} Your current layout has not changed.</p>}
    {pending && <div className="import-preview" role="group" aria-label="Confirm import">
      <h3>Replace current layout?</h3>
      <p>This file contains {pending.screens.length} {pending.screens.length === 1 ? 'tab' : 'tabs'} and {pending.screens.reduce((total, tab) => total + tab.assets.length, 0)} tiles:</p>
      <ul>{pending.screens.map(tab => <li key={tab.id}><span>{tab.name}{tab.id === pending.activeScreenId && <small>Active</small>}</span><span>{tab.assets.length} / 20</span></li>)}</ul>
      <p>Your current tabs and lists will be replaced. Export them first if you want to keep a copy.</p>
      <div className="button-row"><button className="secondary-button" onClick={() => setPending(null)}>Cancel</button><button className="secondary-button" onClick={() => onImport(pending)}>Import and replace</button></div>
    </div>}
    {confirming && <div className="confirm-box" role="group" aria-label="Confirm reset">
      <p>All your tabs and lists will be replaced with a single Main tab: BTC, ETH, SOL, LTC, GRAM, TRX, BNB, XRP, in their original order.</p>
      <p className="reset-warning">This cannot be undone.</p>
      <div className="button-row"><button className="secondary-button" autoFocus onClick={() => setConfirming(false)}>Cancel</button><button className="danger-button" onClick={onReset}>Restore Main</button></div>
    </div>}
  </Modal>;
}
