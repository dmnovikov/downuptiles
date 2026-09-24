import type { Workspace } from '../types/workspace';
import { parseWorkspace } from './workspace';

export const MAX_BACKUP_BYTES = 256 * 1024;
const FORMAT = 'cryptotiles-layout';

export function serializeBackup(workspace: Workspace, now = new Date()): string {
  return JSON.stringify({
    format: FORMAT,
    version: 1,
    exportedAt: now.toISOString(),
    workspace: parseWorkspace(JSON.stringify(workspace)),
  }, null, 2) + '\n';
}

export function parseBackup(raw: string): Workspace {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw new Error('File is too large. Choose a CryptoTiles JSON backup under 256 KB.');
  let data: unknown;
  try { data = JSON.parse(raw.replace(/^\uFEFF/, '')); }
  catch { throw new Error('This file is not valid JSON. Choose a CryptoTiles layout backup.'); }
  if (!data || typeof data !== 'object' || !('format' in data) || data.format !== FORMAT) throw new Error('This is not a CryptoTiles layout backup.');
  if (!('version' in data) || data.version !== 1) throw new Error('This backup version is not supported.');
  if (!('workspace' in data)) throw new Error('This backup does not contain a layout.');
  return parseWorkspace(JSON.stringify(data.workspace));
}

export function downloadBackup(workspace: Workspace): void {
  const now = new Date();
  const url = URL.createObjectURL(new Blob([serializeBackup(workspace, now)], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cryptotiles-layout-${now.toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally {
    anchor.remove();
    // Allow mobile browsers time to start the download before releasing its data.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
