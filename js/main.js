/* Punto de entrada. Importar cada vista hace que registre sus páginas y acciones. */
import { installActionListener } from './actions.js';
import { startRouter } from './router.js';
import { STATE, saveState } from './state.js';
import { renderTopbar, touchStreak } from './progress.js';
import './ai.js';
import './pwa.js';
import './views/home.js';
import './views/search.js';
import './views/module.js';
import './views/flashcards.js';
import './views/quiz.js';
import './views/exam.js';
import './views/aplicar.js';
import './views/stats.js';

installActionListener();

/* Tiempo estudiado: suma cada 5 s solo si la app está visible y hubo actividad en el último minuto
   (antes contaba aunque el celular estuviera olvidado con la app abierta). */
const TICK_MS = 5000;
const IDLE_MS = 60000;
let lastActivity = Date.now();
['pointerdown', 'keydown', 'scroll'].forEach((ev) =>
  window.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
setInterval(() => {
  if (document.hidden || Date.now() - lastActivity > IDLE_MS) return;
  STATE.totalSeconds += TICK_MS / 1000;
  saveState();
}, TICK_MS);

touchStreak();
renderTopbar();
startRouter();
