import { useCallback, useState } from 'react';
import { initialWorkspace, parseWorkspace, STORAGE_KEY, workspaceReducer, type WorkspaceAction } from '../storage/workspace';
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { workspace: raw === null ? initialWorkspace() : parseWorkspace(raw), error: '', blocked: false };
  } catch {
    return { workspace: initialWorkspace(), error: 'Unable to read saved lists. Your original data has not been overwritten. Changes will only last for this session.', blocked: true };
  }
}
export function useWorkspace() {
  const [state, setState] = useState(() => {
    const loaded = load();
    if (!loaded.blocked) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded.workspace)); }
      catch { loaded.error = 'Storage is unavailable. Changes will only last for this session.'; }
    }
    return loaded;
  });
  const dispatch = useCallback((action: WorkspaceAction) => {
    setState(previous => {
      const workspace = workspaceReducer(previous.workspace, action);
      if (previous.blocked && action.type !== 'reset' && action.type !== 'import') return { ...previous, workspace };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)); return { ...previous, workspace, blocked: false, error: '' }; }
      catch { return { ...previous, workspace, error: 'Unable to save changes. Keep the app open to avoid losing your current list.' }; }
    });
  }, []);
  return { workspace: state.workspace, storageError: state.error, dispatch };
}
