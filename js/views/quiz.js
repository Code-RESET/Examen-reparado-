/* Quiz con retroalimentación inmediata y nivel de confianza.
   Tipos: 'general' (rápido), 'module', 'hard' (datos duros) y 'weak' (puntos débiles).
   El quiz en curso se guarda en STATE.quizSession para reanudarlo tras recargar. */
import { $, escapeHtml, formatText } from '../util.js';
import { route, questionById, questionsByModule, moduleMeta, unitTag } from '../study-routes.js';
import { STATE, saveState, recordAnswer, logConfidence } from '../state.js';
import { registerPage, go } from '../router.js';
import { registerActions } from '../actions.js';
import { showToast } from '../ui.js';
import { addXp, touchStreak, unlockAchievement, checkGlobalAchievements } from '../progress.js';
import { pickDeck, hardFactQuestions, weakQuestions, correctOption, displayOptions, explainFor } from '../bank.js';
import { explainButton } from '../ai.js';

let deck = [];
let session = null;   // referencia a STATE.quizSession
let selected = null;  // letra elegida, esperando el nivel de confianza

export function quizSessionLabel(s) {
  const kind = s.kind || (s.hardOnly ? 'hard' : s.moduleScope ? 'module' : 'general'); // sesiones guardadas antes de esta versión
  if (kind === 'hard') return 'Datos duros';
  if (kind === 'weak') return 'Puntos débiles';
  if (kind === 'module') return moduleMeta(s.moduleScope)?.title || 'Quiz';
  return 'Quiz general';
}

function headerSub(s) {
  const kind = s.kind || (s.hardOnly ? 'hard' : s.moduleScope ? 'module' : 'general');
  if (kind === 'hard') return `🔢 Datos duros · ${hardFactQuestions().length} detectados en el banco`;
  if (kind === 'weak') return `🎯 Puntos débiles · las que más has fallado`;
  if (kind === 'module') return moduleMeta(s.moduleScope)?.title || '';
  return 'General · aleatorio';
}

function begin(kind, questions, moduleScope = null) {
  touchStreak();
  STATE.quizSession = {
    kind, moduleScope, ids: questions.map((q) => q.id), index: 0, score: { correct: 0, wrong: 0 }, answered: false,
  };
  saveState();
  go('quiz');
}

export function startQuiz(modId) {
  const pool = modId ? questionsByModule(modId) : route.questions;
  begin(modId ? 'module' : 'general', pickDeck(pool, Math.min(10, pool.length)), modId || null);
}

function enterQuiz() {
  const s = STATE.quizSession;
  deck = s?.ids ? s.ids.map(questionById).filter(Boolean) : [];
  if (!deck.length || s.index >= deck.length) { STATE.quizSession = null; saveState(); return 'inicio'; }
  session = s;
  // Si se recargó justo después de contestar, no se vuelve a contestar la misma pregunta
  if (session.answered) {
    if (session.index >= deck.length - 1) { finishQuiz(); return 'inicio'; }
    session.index++;
    session.answered = false;
    saveState();
  }
  $('quizHeaderSub').textContent = headerSub(session);
  renderQuestion();
}

function renderQuestion() {
  selected = null;
  const q = deck[session.index];
  $('quizProgressLabel').textContent = `Pregunta ${session.index + 1}/${deck.length}`;
  $('quizScoreLabel').textContent = `✔ ${session.score.correct}   ✘ ${session.score.wrong}`;
  $('quizProgFill').style.width = Math.round((session.index / deck.length) * 100) + '%';
  $('quizTag').textContent = unitTag(q);
  $('quizQuestion').innerHTML = formatText(q.q);
  $('quizOptions').innerHTML = displayOptions(q).map((o) => `
    <button class="opt-item" data-action="quizOption" data-letter="${o.letter}">
      <span class="opt-letter">${o.letter}</span><span>${formatText(o.text)}</span>
    </button>`).join('');
  $('quizFeedback').innerHTML = '';
  $('quizConfidence').hidden = true;
  $('quizNextBtn').hidden = true;
}

function selectOption(letter) {
  if (selected || session.answered) return;
  selected = letter;
  document.querySelectorAll('#quizOptions .opt-item').forEach((btn) => {
    btn.classList.add('disabled');
    if (btn.dataset.letter === letter) btn.style.borderColor = 'var(--accent-2)';
  });
  $('quizConfidence').hidden = false;
  $('quizConfidence').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function answer(confidence) {
  if (!selected || session.answered) return;
  const letter = selected;
  const q = deck[session.index];
  const correct = letter === q.correct;
  session.answered = true;
  $('quizConfidence').hidden = true;

  recordAnswer(q.id, correct);
  STATE.quiz.answered += 1;
  logConfidence(q.id, confidence, correct);
  if (correct) { session.score.correct++; STATE.quiz.correct++; }
  else { session.score.wrong++; STATE.quiz.wrong++; }
  saveState();
  addXp(correct ? 10 : 2);
  checkGlobalAchievements();

  document.querySelectorAll('#quizOptions .opt-item').forEach((btn) => {
    if (btn.dataset.letter === q.correct) btn.classList.add('correct');
    else if (btn.dataset.letter === letter) btn.classList.add('wrong');
  });
  const tip = explainFor(q);
  const overconfident = confidence >= 4 && !correct;
  $('quizFeedback').innerHTML = `<div class="feedback-box ${correct ? 'ok' : 'bad'}">
    ${correct ? '✅ ¡Correcto!' : '❌ Incorrecto.'} La respuesta correcta es <b>${q.correct}) ${formatText(correctOption(q).text)}</b>.
    <br><span class="muted">${route.unit}: ${escapeHtml(q.moduleTitle)}</span>
    ${overconfident ? `<div class="fb-extra danger">⚠️ Estabas muy seguro y fallaste — esto es "falsa seguridad": revísala con más cuidado, es justo el tipo de error que te puede sorprender en el examen real.</div>` : ''}
    ${tip ? `<div class="fb-extra">💡 ${escapeHtml(tip)}</div>` : ''}
    <div style="margin-top:10px;">${explainButton(q.id, letter, 'quiz')}</div>
  </div>`;
  $('quizScoreLabel').textContent = `✔ ${session.score.correct}   ✘ ${session.score.wrong}`;
  $('quizNextBtn').hidden = false;
  $('quizNextBtn').textContent = session.index < deck.length - 1 ? 'Siguiente pregunta →' : 'Ver resultados 🏁';
}

function next() {
  if (!session.answered) return;
  if (session.index < deck.length - 1) {
    session.index++;
    session.answered = false;
    saveState();
    renderQuestion();
    window.scrollTo(0, 0);
  } else {
    finishQuiz();
    go('inicio');
  }
}

function finishQuiz() {
  const pct = Math.round((session.score.correct / deck.length) * 100);
  if (pct === 100 && deck.length >= 10) unlockAchievement('quiz_perfect');
  STATE.quizSession = null;
  saveState();
  showToast(`Quiz terminado: ${pct}% de aciertos`);
}

registerPage('quiz', { view: 'quiz', nav: null, enter: enterQuiz });

registerActions({
  startQuiz: ({ id }) => startQuiz(id),
  startHardFacts: () => {
    const pool = hardFactQuestions();
    if (!pool.length) { showToast('No se detectaron preguntas de datos duros.'); return; }
    begin('hard', pickDeck(pool, Math.min(15, pool.length)));
  },
  startWeak: () => {
    const weak = weakQuestions();
    if (!weak.length) { showToast('Aún no tienes puntos débiles: responde algunas preguntas primero. 💪'); return; }
    begin('weak', weak.slice(0, 15));
  },
  quizOption: ({ letter }) => selectOption(letter),
  confidence: ({ level }) => answer(Number(level)),
  quizNext: next,
  exitQuiz: () => {
    const s = STATE.quizSession;
    go(s?.kind === 'module' || (!s?.kind && s?.moduleScope) ? `modulo/${s.moduleScope}/quiz` : 'inicio');
  },
});
