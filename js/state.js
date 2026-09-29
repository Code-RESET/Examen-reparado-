/* Estado del progreso. Cada ruta de estudio tiene su propio objeto de estado,
   guardado en su propia llave de localStorage (route.storageKey). */
import { DAY, todayStr, daysAgoStr } from './util.js';
import { safeGet, safeSet } from './storage.js';
import { route, onRouteChange } from './study-routes.js';
import { showToast } from './ui.js';

/* Sistema Leitner: cada tarjeta vive en una "caja" 0-4; cuanto más alta, más tarda en volver. */
export const BOX_INTERVALS = [0, 1 * DAY, 3 * DAY, 7 * DAY, 16 * DAY];
export const MASTER_BOX = 3; // caja >= 3 cuenta como "dominada"

function defaultState() {
  return {
    xp: 0,
    streak: { count: 0, lastDay: null },
    totalSeconds: 0,
    cards: {},          // id -> {box, next, seen, correct, wrong}
    quiz: { answered: 0, correct: 0, wrong: 0 },
    unlocked: [],
    dailyLog: {},       // 'YYYY-MM-DD' -> {answered, correct}
    examHistory: [],    // [{date, pct, total, correct}]
    confidenceLog: [],  // [{qid, confidence, correct, date}] — últimos 200
    feynmanCount: 0,
    quizSession: null,     // quiz en curso, para reanudar
    examSession: null,     // simulacro en curso, para reanudar
    lastExamResult: null,  // último simulacro terminado (página de resultados)
    aplicarSession: null,  // "Examen a Aplicar" en curso
  };
}

export let STATE = loadState();

function loadState() {
  try {
    const raw = safeGet(route.storageKey);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    delete parsed.moduleQuizBest; // campo que nunca se usó
    return Object.assign(defaultState(), parsed);
  } catch {
    return defaultState();
  }
}

onRouteChange(() => { STATE = loadState(); });

let warnedSaveFail = false;
export function saveState() {
  if (safeSet(route.storageKey, JSON.stringify(STATE))) return;
  if (!warnedSaveFail) {
    warnedSaveFail = true;
    showToast('⚠️ No se pudo guardar tu progreso (almacenamiento lleno o modo privado).');
  }
}

export function cardOf(id) {
  if (!STATE.cards[id]) STATE.cards[id] = { box: 0, next: 0, seen: 0, correct: 0, wrong: 0 };
  return STATE.cards[id];
}

/* Registra una respuesta en la tarjeta Leitner: acierto sube de caja, error regresa a la 0. */
export function recordAnswer(id, correct) {
  const c = cardOf(id);
  c.seen += 1;
  if (correct) { c.box = Math.min(c.box + 1, 4); c.correct += 1; }
  else { c.box = 0; c.wrong += 1; }
  c.next = Date.now() + BOX_INTERVALS[c.box];
  logDaily(correct);
}

function logDaily(correct) {
  const d = todayStr();
  if (!STATE.dailyLog[d]) STATE.dailyLog[d] = { answered: 0, correct: 0 };
  STATE.dailyLog[d].answered += 1;
  if (correct) STATE.dailyLog[d].correct += 1;
}

export function last7DaysLog() {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = daysAgoStr(i);
    out.push({ date: d, ...(STATE.dailyLog[d] || { answered: 0, correct: 0 }) });
  }
  return out;
}

export function logConfidence(qid, confidence, correct) {
  STATE.confidenceLog.push({ qid, confidence, correct, date: todayStr() });
  if (STATE.confidenceLog.length > 200) STATE.confidenceLog = STATE.confidenceLog.slice(-200);
}

export function confidenceStats() {
  const log = STATE.confidenceLog;
  if (!log.length) return null;
  const over = log.filter((e) => e.confidence >= 4 && !e.correct).length;
  const under = log.filter((e) => e.confidence <= 2 && e.correct).length;
  const pct = (n) => Math.round((n / log.length) * 100);
  return {
    total: log.length,
    overconfidentPct: pct(over),
    underconfidentPct: pct(under),
    wellCalibratedPct: pct(log.length - over - under),
    overconfidentCount: over,
  };
}
