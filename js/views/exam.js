/* Modo examen (simulacro cronometrado) + resultados.
   URLs: #/examen (configuración) · #/examen/curso · #/examen/resultados
   El simulacro en curso vive en STATE.examSession, así sobrevive a recargas y a salir de la página.
   El cronómetro se calcula contra la hora de fin (endAt): aunque el celular congele la pestaña,
   el tiempo restante siempre es el real. */
import { $, shuffle, escapeHtml, formatText, fmtClock, todayStr } from '../util.js';
import { route, questionById, moduleMeta, moduleShort, onRouteChange } from '../study-routes.js';
import { STATE, saveState, recordAnswer } from '../state.js';
import { registerPage, go } from '../router.js';
import { registerActions } from '../actions.js';
import { paginate } from '../ui.js';
import { addXp, unlockAchievement, checkGlobalAchievements } from '../progress.js';
import { correctOption, displayOptions, explainFor } from '../bank.js';
import { explainButton } from '../ai.js';

const SECONDS_PER_QUESTION = 45;
const MIN_SECONDS = 300;
let examSize = route.examSizes[0].n;
let selected = null;
let timer = null;

onRouteChange((r) => { examSize = r.examSizes[0].n; });

/* ---------------- Configuración ---------------- */
function enterSetup() {
  $('examSetupText').textContent = `Elige cuántas preguntas quieres en tu simulacro. Se sortean al azar de ${route.id === 'rsti' ? 'los' : 'las'} ${route.modules.length} ${route.unitPlural} y tendrás un cronómetro en cuenta regresiva, igual que en el examen real.`;
  const sizes = route.examSizes;
  const rows = [];
  for (let i = 0; i < sizes.length; i += 2) rows.push(sizes.slice(i, i + 2));
  $('examSizeButtons').innerHTML = rows.map((row, i) => `
    <div class="btn-row"${i < rows.length - 1 ? ' style="margin-bottom:10px;"' : ''}>
      ${row.map((s) => `<button class="btn ${s.n === examSize ? 'btn-primary' : 'btn-outline'}" data-action="setExamSize" data-n="${s.n}">${s.label}</button>`).join('')}
    </div>`).join('');
  $('examSizeLabel').textContent = Math.min(examSize, route.questions.length);
}

function startExam() {
  const ids = shuffle(route.questions.map((q) => q.id)).slice(0, examSize);
  const now = Date.now();
  STATE.examSession = {
    ids, index: 0, answers: [], startedAt: now,
    endAt: now + Math.max(ids.length * SECONDS_PER_QUESTION, MIN_SECONDS) * 1000,
  };
  saveState();
  go('examen/curso');
}

/* ---------------- En curso ---------------- */
const secondsLeft = () => (STATE.examSession.endAt - Date.now()) / 1000;

function enterRun() {
  const s = STATE.examSession;
  if (!s) return 'examen';
  if (secondsLeft() <= 0 || s.index >= s.ids.length) { finishExam(); return 'examen/resultados'; }
  $('examHeaderSub').textContent = s.ids.length + ' preguntas · simulacro';
  renderQuestion();
  clearInterval(timer);
  timer = setInterval(tick, 1000);
  tick();
}

function tick() {
  const left = secondsLeft();
  $('examTimer').textContent = fmtClock(left);
  if (left <= 0) { finishExam(); go('examen/resultados', { replace: true }); }
}

function renderQuestion() {
  const s = STATE.examSession;
  const q = questionById(s.ids[s.index]);
  selected = null;
  $('examProgressLabel').textContent = `Pregunta ${s.index + 1}/${s.ids.length}`;
  $('examProgFill').style.width = Math.round((s.index / s.ids.length) * 100) + '%';
  $('examTag').textContent = route.id === 'rsti' ? `${q.icon} Módulo ${q.module}` : `${q.icon} ${q.moduleTitle}`;
  $('examQuestion').innerHTML = formatText(q.q);
  $('examOptions').innerHTML = displayOptions(q).map((o) => `
    <button class="opt-item" data-action="examOption" data-letter="${o.letter}">
      <span class="opt-letter">${o.letter}</span><span>${formatText(o.text)}</span>
    </button>`).join('');
}

function selectOption(letter, btn) {
  selected = letter;
  document.querySelectorAll('#examOptions .opt-item').forEach((b) => {
    b.style.borderColor = b === btn ? 'var(--accent)' : 'transparent';
  });
}

function examNext() {
  const s = STATE.examSession;
  if (!s || secondsLeft() <= 0) return;
  const q = questionById(s.ids[s.index]);
  recordAnswer(q.id, selected === q.correct);
  s.answers.push({ id: q.id, sel: selected });
  s.index++;
  saveState();
  if (s.index < s.ids.length) { renderQuestion(); window.scrollTo(0, 0); }
  else { finishExam(); go('examen/resultados', { replace: true }); }
}

/* Califica el simulacro. Las preguntas que no alcanzaste a ver por falta de tiempo cuentan como
   incorrectas en la calificación, pero NO se suman a "preguntas respondidas" ni tocan tus tarjetas. */
function finishExam() {
  clearInterval(timer);
  const s = STATE.examSession;
  if (!s) return;
  const total = s.ids.length;
  const answers = s.ids.map((id, i) => s.answers[i] || { id, sel: null, timedOut: true });
  const correct = answers.filter((a) => a.sel === questionById(a.id)?.correct).length;
  const answered = s.answers.length;
  const pct = Math.round((correct / total) * 100);

  STATE.quiz.answered += answered;
  STATE.quiz.correct += correct;
  STATE.quiz.wrong += answered - correct;
  STATE.examHistory.push({ date: todayStr(), pct, total, correct });
  if (STATE.examHistory.length > 20) STATE.examHistory = STATE.examHistory.slice(-20);
  STATE.lastExamResult = {
    pct, total, correct, unanswered: total - answered,
    elapsed: Math.round((Math.min(Date.now(), s.endAt) - s.startedAt) / 1000),
    answers,
  };
  STATE.examSession = null;
  saveState();
  addXp(50 + correct * 3);
  if (pct >= 80) unlockAchievement('exam_pass');
  checkGlobalAchievements();
}

/* ---------------- Resultados ---------------- */
const answerLabel = (a) => a.sel || (a.timedOut ? '(sin responder — se acabó el tiempo)' : '(sin respuesta)');

function enterResults() {
  const r = STATE.lastExamResult;
  if (!r) return 'examen';
  const items = r.answers.map((a) => ({ ...a, q: questionById(a.id) })).filter((a) => a.q);
  items.forEach((a) => { a.isCorrect = a.sel === a.q.correct; });
  const wrong = items.filter((a) => !a.isCorrect);

  $('resScore').textContent = r.pct + '%';
  $('resScore').style.color = r.pct >= 80 ? 'var(--success)' : r.pct >= 60 ? 'var(--warning)' : 'var(--danger)';
  $('resMsg').textContent = r.pct >= 80 ? '¡Excelente! Estás listo para el examen real.'
    : r.pct >= 60 ? 'Vas bien, sigue repasando tus áreas débiles.' : 'Necesitas más repaso — no te desanimes, cada intento suma.';
  $('resCorrect').textContent = r.correct;
  $('resWrong').textContent = r.total - r.correct;
  $('resTime').textContent = fmtClock(r.elapsed);
  $('resUnanswered').hidden = !r.unanswered;
  $('resUnanswered').textContent = `${r.unanswered} pregunta(s) sin responder por tiempo — cuentan como incorrectas.`;

  const byModule = {};
  wrong.forEach((a) => { byModule[a.q.module] = (byModule[a.q.module] || 0) + 1; });
  const modIds = Object.keys(byModule).sort((a, b) => byModule[b] - byModule[a]);
  $('resWeakAreas').innerHTML = modIds.length ? modIds.map((mid) => {
    const m = moduleMeta(mid);
    return `<div class="bar-row"><div class="br-label">${m.icon} ${moduleShort(m)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, byModule[mid] * 20)}%; background:linear-gradient(90deg, var(--danger-dim), var(--danger));"></div></div><div class="br-pct">${byModule[mid]} err.</div></div>`;
  }).join('') : `<p class="muted" style="font-size:13px;">¡Sin errores por ${route.unit.toLowerCase()}!</p>`;

  paginate('resWrongList', wrong, (a) => {
    const tip = explainFor(a.q);
    return `<div class="weak-item">
      <div class="wq">${formatText(a.q.q)}</div>
      <div class="wu">Tu respuesta: ${escapeHtml(answerLabel(a))}</div>
      <div class="wa">Correcta: ${a.q.correct}) ${formatText(correctOption(a.q).text)}</div>
      ${tip ? `<div class="wtip">${escapeHtml(tip)}</div>` : ''}
      <div class="btn-row" style="margin-top:8px;">
        <button class="btn btn-outline btn-sm" data-action="openModule" data-id="${a.q.module}">Repasar ${route.id === 'rsti' ? 'Módulo ' + a.q.module : escapeHtml(a.q.moduleTitle)} →</button>
        ${explainButton(a.q.id, a.sel, 'exam')}
      </div>
    </div>`;
  }, '<div class="empty-state">¡Ninguna pregunta fallada!</div>');

  $('resFullList').hidden = true;
  $('fullReviewBtn').textContent = 'Ver examen completo (todas las preguntas) ▾';
  paginate('resFullList', items, (a, i) => `
    <div class="weak-item" style="box-shadow:inset 3px 0 0 ${a.isCorrect ? 'var(--success)' : 'var(--danger)'};">
      <div class="wq">${i + 1}. ${formatText(a.q.q)}</div>
      <div class="${a.isCorrect ? 'wa' : 'wu'}">${a.isCorrect ? '✔ Correcta' : '✘'} Tu respuesta: ${escapeHtml(answerLabel(a))}</div>
      ${a.isCorrect ? '' : `<div class="wa">Correcta: ${a.q.correct}) ${formatText(correctOption(a.q).text)}</div>`}
    </div>`);
}

registerPage('examen', { view: 'examSetup', nav: 'examSetup', enter: enterSetup });
registerPage('examen/curso', { view: 'exam', nav: 'examSetup', enter: enterRun, leave: () => clearInterval(timer) });
registerPage('examen/resultados', { view: 'results', nav: 'examSetup', enter: enterResults });

registerActions({
  setExamSize: ({ n }) => { examSize = Number(n); enterSetup(); },
  startExam,
  examOption: ({ letter }, btn) => selectOption(letter, btn),
  examNext,
  abortExam: () => {
    if (!confirm('¿Abandonar el simulacro? Se perderá tu avance.')) return;
    clearInterval(timer);
    STATE.examSession = null;
    saveState();
    go('inicio');
  },
  toggleFullReview: () => {
    const el = $('resFullList');
    el.hidden = !el.hidden;
    $('fullReviewBtn').textContent = el.hidden ? 'Ver examen completo (todas las preguntas) ▾' : 'Ocultar examen completo ▴';
  },
});
