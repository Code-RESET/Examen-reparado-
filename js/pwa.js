/* PWA: service worker (modo sin conexión) y botón "Instalar". */
import { $ } from './util.js';
import { registerActions } from './actions.js';

if ('serviceWorker' in navigator) {
  // Cuando se instala una versión nueva de la app, recarga una vez para no seguir con archivos viejos.
  // Solo si ya había una versión antes (la primera instalación no necesita recargar).
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
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
