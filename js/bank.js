/* Consultas de estudio sobre el banco de la ruta activa + el progreso guardado. */
import { route, moduleMeta, questionsByModule } from './study-routes.js';
import { STATE, MASTER_BOX } from './state.js';
import { shuffle } from './util.js';

export const MODULE_DONE_RATIO = 0.85; // un módulo cuenta como terminado con 85% dominado

export const correctOption = (q) => q.options.find((o) => o.letter === q.correct);

/* Orden en que se muestran las opciones. La letra siempre acompaña a su texto. */
export const displayOptions = (q) => (route.shuffleOptions ? shuffle(q.options.slice()) : q.options);

export function masteredCount(list) {
  return list.filter((q) => (STATE.cards[q.id]?.box ?? 0) >= MASTER_BOX).length;
}
export function seenCount(list) {
  return list.filter((q) => (STATE.cards[q.id]?.seen ?? 0) > 0).length;
}
export function modulePct(modId) {
  const qs = questionsByModule(modId);
  return qs.length ? Math.round((masteredCount(qs) / qs.length) * 100) : 0;
}
export const overallPct = () => Math.round((masteredCount(route.questions) / route.questions.length) * 100);
export const modulesCompletedCount = () =>
  route.modules.filter((m) => modulePct(m.id) >= MODULE_DONE_RATIO * 100).length;

/* Leitner: tarjetas que "tocan" hoy. Las nunca vistas siempre entran. */
export function dueCardsFor(list) {
  const now = Date.now();
  return list.filter((q) => {
    const c = STATE.cards[q.id];
    return !c || c.seen === 0 || c.next <= now;
  });
}

/* Arma un mazo de n preguntas: primero las pendientes (Leitner), luego completa al azar. */
export function pickDeck(pool, n) {
  let picked = shuffle(dueCardsFor(pool)).slice(0, n);
  if (picked.length < n) {
    picked = picked.concat(shuffle(pool.filter((q) => !picked.includes(q))).slice(0, n - picked.length));
  }
  return shuffle(picked);
}

/* Puntos débiles: preguntas que has fallado y aún no dominas, las peores primero. */
export function weakQuestions() {
  return route.questions
    .filter((q) => { const c = STATE.cards[q.id]; return c && c.wrong > 0 && c.box < MASTER_BOX; })
    .sort((a, b) => {
      const ca = STATE.cards[a.id], cb = STATE.cards[b.id];
      return (cb.wrong - cb.correct) - (ca.wrong - ca.correct) || ca.box - cb.box;
    });
}

/* ---------------- Datos Duros (solo ruta RSTI) ----------------
   Detecta preguntas cuya respuesta es un número, sigla, extensión de archivo,
   nombre de comando/archivo técnico, etc. — el tipo de dato que se olvida
   fácil y necesita repaso aparte de los conceptos. */
const COMMON_WORDS = new Set(['PARA', 'PERO', 'ESTA', 'ESTE', 'ESTO', 'ESTAS', 'ESTOS', 'TODO', 'TODA', 'TODOS', 'TODAS',
  'DEBE', 'DEBEN', 'PUEDE', 'PUEDEN', 'QUE', 'CON', 'SIN', 'LOS', 'LAS', 'DEL', 'SOBRE', 'ENTRE', 'CADA', 'MISMO', 'MISMA',
  'CUAL', 'CUALES', 'DONDE', 'CUANDO', 'COMO', 'PORQUE']);
function isHardFact(q) {
  const correctText = correctOption(q).text;
  const combined = q.q + ' ' + correctText;
  // números sueltos (fechas, plazos, medidas, cantidades)
  if (/\b\d{1,4}\s*(mts|metros|d[ií]as|meses|a[ñn]os|horas|caracteres|mb|megabytes|mhz|ghz|db|%|puertos|veces)?\b/i.test(correctText) && /\d/.test(correctText)) return true;
  // extensión de archivo o nombre de archivo técnico (.exe, .PST, FrmInst.exe)
  if (/\.\w{2,4}\b/.test(combined)) return true;
  // siglas de 2+ letras mayúsculas consecutivas que no sean palabras comunes
  const acronyms = correctText.match(/\b[A-ZÁÉÍÓÚÑ]{2,}(-[A-Z]{2,})?\b/g) || [];
  return acronyms.some((a) => !COMMON_WORDS.has(a));
}
const hardFactCache = new Map();
export function hardFactQuestions() {
  if (!hardFactCache.has(route.id)) hardFactCache.set(route.id, route.questions.filter(isHardFact));
  return hardFactCache.get(route.id);
}

/* Pista para una pregunta fallada: la línea de puntos clave / resumen del módulo
   que más palabras comparte con la pregunta; si no hay, la mnemotecnia. */
export function explainFor(q) {
  const m = moduleMeta(q.module);
  if (!m) return '';
  const stemWords = (q.q || '').toLowerCase().replace(/[¿?.,:;()]/g, '').split(/\s+/).filter((w) => w.length > 4);
  let best = null, bestScore = 0;
  [...(m.puntos_clave || []), ...(m.resumen || [])].forEach((line) => {
    const lw = line.toLowerCase();
    const score = stemWords.filter((w) => lw.includes(w)).length;
    if (score > bestScore) { bestScore = score; best = line; }
  });
  return best || m.mnemotecnia || '';
}
