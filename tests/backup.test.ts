import { expect, it } from 'vitest';
import { MAX_BACKUP_BYTES, parseBackup, serializeBackup } from '../src/storage/backup';
import { initialWorkspace, workspaceReducer } from '../src/storage/workspace';
import type { Workspace } from '../src/types/workspace';
const layout: Workspace = { version: 1, initialized: true, activeScreenId: 'empty', screens: [
  { id: 'custom', name: 'DeFi', assets: ['sol', 'btc', 'binance:NEW'] },
  { id: 'empty', name: 'Empty', assets: [] },
] };
it('round-trips tab order, tile order, IDs, names, empty tabs and the active tab', () => {
  const file = serializeBackup(layout);
  expect(parseBackup(file)).toEqual(layout);
  expect(parseBackup('\uFEFF' + file)).toEqual(layout);
  expect(workspaceReducer(initialWorkspace(), { type: 'import', workspace: parseBackup(file) })).toEqual(layout);
  expect(file).not.toContain('price');
});
it('rejects invalid formats and future versions without changing the source layout', () => {
  for (const raw of ['{', '{}', 'null', JSON.stringify({ format: 'other', version: 1, workspace: layout }), JSON.stringify({ format: 'cryptotiles-layout', version: 2, workspace: layout })]) expect(() => parseBackup(raw)).toThrow();
  expect(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow('too large');
  expect(layout.screens[0].assets).toEqual(['sol', 'btc', 'binance:NEW']);
});
it('rejects invalid limits, duplicates and active-tab references', () => {
  const file = (workspace: unknown) => JSON.stringify({ format: 'cryptotiles-layout', version: 1, workspace });
  for (const workspace of [
    { ...layout, activeScreenId: 'missing' },
    { ...layout, screens: [] },
    { ...layout, screens: Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: 'Tab', assets: [] })) },
    { ...layout, screens: [layout.screens[0], layout.screens[0]] },
    { ...layout, screens: [{ ...layout.screens[0], assets: ['btc', 'btc'] }, layout.screens[1]] },
    { ...layout, screens: [{ ...layout.screens[0], assets: Array.from({ length: 21 }, (_, i) => `asset-${i}`) }, layout.screens[1]] },
    { ...layout, screens: [{ ...layout.screens[0], name: 'x'.repeat(25) }, layout.screens[1]] },
  ]) expect(() => parseBackup(file(workspace))).toThrow();
});
