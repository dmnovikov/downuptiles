import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export function useAndroidBack(editing: boolean, finishEditing: () => void) {
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    const listener = App.addListener('backButton', ({ canGoBack }) => {
      // Dialogs have their own history entry; dismiss them before the page.
      if (history.state?.cryptoTilesOverlay) { history.back(); return; }
      if (editing) { finishEditing(); return; }
      if (canGoBack) { history.back(); return; }
      if (location.hash && location.hash !== '#') {
        history.replaceState(null, '', location.pathname + location.search);
        window.dispatchEvent(new PopStateEvent('popstate'));
        return;
      }
      void App.minimizeApp();
    });
    return () => { void listener.then(handle => handle.remove()); };
  }, [editing, finishEditing]);
}
