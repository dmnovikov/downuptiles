import { describe, expect, it } from 'vitest';
import { initialWorkspace, parseWorkspace, workspaceReducer as reduce } from '../src/storage/workspace';
import { changeDots, direction } from '../src/services/format';
describe('workspace invariants', () => {
  it('initializes once and keeps an intentionally empty watchlist', () => {
    let w = initialWorkspace();
    expect(w.screens[0].assets).toEqual(['btc', 'eth', 'sol', 'ltc', 'gram', 'trx', 'bnb', 'xrp']);
    for (const assetId of w.screens[0].assets) w = reduce(w, { type: 'remove', screenId: 'main', assetId });
    expect(parseWorkspace(JSON.stringify(w)).screens[0].assets).toEqual([]);
  });
  it('persists reordering and rejects duplicate pairs across tabs while preserving exchange identity', () => {
    let w = initialWorkspace();
    w = reduce(w, { type: 'reorder', screenId: 'main', from: 0, to: 2 });
    expect(w.screens[0].assets.slice(0, 3)).toEqual(['eth', 'sol', 'btc']);
    w = reduce(w, { type: 'add', screenId: 'main', assetId: 'btc' });
    expect(w.screens[0].assets).toHaveLength(8);
    w = reduce(w, { type: 'create', id: 'second', name: 'Other' });
    w = reduce(w, { type: 'add', screenId: 'second', assetId: 'btc' });
    expect(w.screens[1].assets).toEqual([]);
    w = reduce(w, { type: 'add', screenId: 'second', assetId: 'mexc:BTC' });
    expect(w.screens[1].assets).toEqual(['mexc:BTC']);
    expect(parseWorkspace(JSON.stringify(w))).toEqual(w);
  });
  it('moves atomically and refuses duplicate or full destinations', () => {
    let w = reduce(initialWorkspace(), { type: 'create', id: 'second', name: 'Other' });
    w = reduce(w, { type: 'move', from: 'main', to: 'second', assetId: 'btc' });
    expect(w.screens[0].assets).not.toContain('btc'); expect(w.screens[1].assets).toEqual(['btc']);
    w.screens[0].assets.push('btc'); // Legacy layouts with duplicates remain readable.
    expect(reduce(w, { type: 'move', from: 'main', to: 'second', assetId: 'btc' })).toEqual(w);
    for (let i = 0; i < 19; i++) w = reduce(w, { type: 'add', screenId: 'second', assetId: `test-${i}` });
    expect(reduce(w, { type: 'move', from: 'main', to: 'second', assetId: 'eth' })).toEqual(w);
    expect(reduce(w, { type: 'add', screenId: 'second', assetId: 'extra' }).screens[1].assets).toHaveLength(20);
  });
  it('enforces screen limits and recovers active screen on deletion', () => {
    let w = initialWorkspace(); expect(reduce(w, { type: 'delete', id: 'main' })).toEqual(w);
    for (let i = 1; i <= 6; i++) w = reduce(w, { type: 'create', id: `s${i}`, name: `Screen ${i}` });
    expect(w.screens).toHaveLength(5);
    w = reduce(w, { type: 'delete', id: w.activeScreenId });
    expect(w.screens.some(s => s.id === w.activeScreenId)).toBe(true);
  });
  it('rejects corrupt data and unknown versions rather than silently overwriting', () => {
    expect(() => parseWorkspace('{')).toThrow();
    expect(() => parseWorkspace(JSON.stringify({ ...initialWorkspace(), version: 7 }))).toThrow();
    expect(() => parseWorkspace(JSON.stringify({ ...initialWorkspace(), activeScreenId: 'missing' }))).toThrow();
  });
});
it('uses strict growth thresholds and consistent displayed zero', () => {
  expect([0, 15, 15.01, 30, 30.01, 50, 50.01, -15, -15.01, -30, -30.01, -50, -50.01].map(changeDots)).toEqual([0, 0, 1, 1, 2, 2, 3, 0, 1, 1, 2, 2, 3]);
  expect(direction(-0.001)).toBe('flat'); expect(direction(0.1)).toBe('up');
});
