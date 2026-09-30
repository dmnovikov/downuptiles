const START_WITH_TOPS = 'downuptiles.start-with-tops';

export function readStartWithTops(): boolean {
  try { return localStorage.getItem(START_WITH_TOPS) === 'true'; }
  catch { return false; }
}

export function saveStartWithTops(enabled: boolean) {
  localStorage.setItem(START_WITH_TOPS, String(enabled));
}

export function applyStartupRoute() {
  if (!location.hash && readStartWithTops()) {
    history.replaceState(history.state, '', `${location.pathname}${location.search}#/movers`);
  }
}
