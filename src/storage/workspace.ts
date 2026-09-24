import type { Screen, Workspace } from '../types/workspace';
export const STORAGE_KEY = 'cryptotiles.workspace';
export const MAX_SCREENS = 5, MAX_ASSETS = 20;
export const DEFAULT_ASSETS = ['btc', 'eth', 'sol', 'ltc', 'gram', 'trx', 'bnb', 'xrp'];
export function initialWorkspace(): Workspace {
  return { version: 1, initialized: true, activeScreenId: 'main', screens: [{ id: 'main', name: 'Main', assets: [...DEFAULT_ASSETS] }] };
}
export function parseWorkspace(raw: string): Workspace {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Invalid format');
  const w = value as Workspace;
  if (w.version !== 1) throw new Error('Unsupported storage version');
  if (w.initialized !== true || !Array.isArray(w.screens) || w.screens.length < 1 || w.screens.length > MAX_SCREENS) throw new Error('Invalid tab list');
  const ids = new Set<string>();
  for (const screen of w.screens) {
    if (!screen || typeof screen.id !== 'string' || !screen.id || screen.id.length > 128 || ids.has(screen.id) || typeof screen.name !== 'string' || !screen.name.trim() || screen.name.length > 24 || !Array.isArray(screen.assets) || screen.assets.length > MAX_ASSETS || screen.assets.some(a => typeof a !== 'string' || !a || a.length > 128) || new Set(screen.assets).size !== screen.assets.length) throw new Error('Invalid tab data');
    ids.add(screen.id);
  }
  if (!ids.has(w.activeScreenId)) throw new Error('Invalid active tab');
  return { version: 1, initialized: true, activeScreenId: w.activeScreenId, screens: w.screens.map(s => ({ id: s.id, name: s.name, assets: [...s.assets] })) };
}
export type WorkspaceAction =
  | { type: 'reset' }
  | { type: 'import'; workspace: Workspace }
  | { type: 'activate'; id: string }
  | { type: 'create'; id: string; name: string }
  | { type: 'rename'; id: string; name: string }
  | { type: 'delete'; id: string }
  | { type: 'add' | 'remove'; screenId: string; assetId: string }
  | { type: 'move'; from: string; to: string; assetId: string }
  | { type: 'reorder'; screenId: string; from: number; to: number }
  | { type: 'reorderScreens'; from: number; to: number };
function reorder<T>(items: T[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next;
}
export function workspaceReducer(w: Workspace, action: WorkspaceAction): Workspace {
  const updateScreen = (id: string, fn: (screen: Screen) => Screen) => ({ ...w, screens: w.screens.map(s => s.id === id ? fn(s) : s) });
  switch (action.type) {
    case 'reset': return initialWorkspace();
    case 'import': return parseWorkspace(JSON.stringify(action.workspace));
    case 'activate': return w.screens.some(s => s.id === action.id) ? { ...w, activeScreenId: action.id } : w;
    case 'create': return w.screens.length >= MAX_SCREENS || !action.name.trim() || w.screens.some(s => s.id === action.id) ? w : { ...w, activeScreenId: action.id, screens: [...w.screens, { id: action.id, name: action.name.trim().slice(0, 24), assets: [] }] };
    case 'rename': return action.name.trim() ? updateScreen(action.id, s => ({ ...s, name: action.name.trim().slice(0, 24) })) : w;
    case 'delete': {
      if (w.screens.length === 1) return w;
      const screens = w.screens.filter(s => s.id !== action.id);
      return { ...w, screens, activeScreenId: w.activeScreenId === action.id ? screens[0].id : w.activeScreenId };
    }
    case 'add': return updateScreen(action.screenId, s => s.assets.length >= MAX_ASSETS || s.assets.includes(action.assetId) ? s : { ...s, assets: [...s.assets, action.assetId] });
    case 'remove': return updateScreen(action.screenId, s => ({ ...s, assets: s.assets.filter(id => id !== action.assetId) }));
    case 'move': {
      const source = w.screens.find(s => s.id === action.from), target = w.screens.find(s => s.id === action.to);
      if (!source?.assets.includes(action.assetId) || !target || source === target || target.assets.length >= MAX_ASSETS || target.assets.includes(action.assetId)) return w;
      return { ...w, screens: w.screens.map(s => s.id === source.id ? { ...s, assets: s.assets.filter(id => id !== action.assetId) } : s.id === target.id ? { ...s, assets: [...s.assets, action.assetId] } : s) };
    }
    case 'reorder': return updateScreen(action.screenId, s => ({ ...s, assets: reorder(s.assets, action.from, action.to) }));
    case 'reorderScreens': return { ...w, screens: reorder(w.screens, action.from, action.to) };
  }
}
