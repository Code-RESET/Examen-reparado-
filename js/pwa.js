/* PWA: service worker (modo sin conexión) y botón "Instalar". */
import { $ } from './util.js';
import { registerActions } from './actions.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Si sw.js no está disponible (p.ej. previsualización local), la app sigue funcionando sin modo offline.
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  $('installBtn').hidden = false;
});

registerActions({
  install: () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(() => {
      deferredInstallPrompt = null;
      $('installBtn').hidden = true;
    });
  },
});
