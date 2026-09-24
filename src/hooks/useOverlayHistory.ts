import { useCallback, useEffect, useRef, useState } from 'react';

type ModalName = 'search' | 'screens' | 'help' | 'settings';
interface Overlay { modal: ModalName | null; moving: string | null }
const empty: Overlay = { modal: null, moving: null };
const historyKey = 'cryptoTilesOverlay';
function readOverlay(): Overlay {
  const saved = history.state?.[historyKey];
  if (!saved || typeof saved !== 'object') return empty;
  if (['search', 'screens', 'help', 'settings'].includes(saved.modal)) return { modal: saved.modal, moving: null };
  if (typeof saved.moving === 'string' && saved.moving) return { modal: null, moving: saved.moving };
  return empty;
}

/** One history entry per open dialog, so browser/Android Back dismisses it first. */
export function useOverlayHistory() {
  const [overlay, setOverlay] = useState<Overlay>(readOverlay);
  const closing = useRef(false);
  useEffect(() => {
    const update = () => { closing.current = false; setOverlay(readOverlay()); };
    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);
    return () => { window.removeEventListener('popstate', update); window.removeEventListener('hashchange', update); };
  }, []);
  const show = useCallback((next: Overlay) => {
    if (closing.current) return;
    const state = { ...history.state, [historyKey]: next };
    if (history.state?.[historyKey]) history.replaceState(state, '');
    else history.pushState(state, '');
    setOverlay(next);
  }, []);
  const close = useCallback(() => {
    if (closing.current) return;
    if (history.state?.[historyKey]) { closing.current = true; history.back(); }
    else setOverlay(empty);
  }, []);
  const setModal = useCallback((modal: ModalName | null) => { if (modal) show({ modal, moving: null }); else close(); }, [show, close]);
  const setMoving = useCallback((moving: string | null) => { if (moving) show({ modal: null, moving }); else close(); }, [show, close]);
  return { ...overlay, setModal, setMoving };
}
