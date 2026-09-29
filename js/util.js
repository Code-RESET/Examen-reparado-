/* Utilidades puras: sin estado y sin tocar la página. */

export const DAY = 24 * 60 * 60 * 1000;

export const $ = (id) => document.getElementById(id);

/* Mezcla un arreglo en su lugar (Fisher–Yates) y lo devuelve. */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* Fecha LOCAL como 'YYYY-MM-DD'. Antes se usaba toISOString(), que da la fecha UTC:
   en México, después de las 6 pm ya contaba como el día siguiente y rompía la racha. */
function localDateStr(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
export const todayStr = () => localDateStr();
export function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Texto seguro para innerHTML; lo que va entre `comillas invertidas` se muestra como código. */
export function formatText(s) {
  return escapeHtml(s).replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
