/* "Examen a Aplicar": ficha independiente con las preguntas oficiales (solo ruta RSTI).
   Se califica con su propia matriz (correctText). Las opciones se mezclan en cada intento
   y el orden sorteado se guarda en la sesión, para poder reanudar tras recargar.
   URLs: #/aplicar · #/aplicar/curso · #/aplicar/resultados */
import { $, shuffle, escapeHtml } from '../util.js';
import { route } from '../study-routes.js';
import { STATE, saveState } from '../state.js';
import { registerPage, go } from '../router.js';
import { registerActions } from '../actions.js';
import { paginate } from '../ui.js';

const LETTERS = ['A', 'B', 'C', 'D'];

/* Pregunta i con sus opciones en el orden sorteado para este intento. */
function questionAt(i) {
  const src = route.examAplicar[i];
  return {
    id: src.id,
    q: src.q,
    options: STATE.aplicarSession.order[i].map((k, pos) => ({
      letter: LETTERS[pos], text: src.opts[k], isCorrect: src.opts[k] === src.correctText,
    })),
  };
}

function startAplicar() {
  STATE.aplicarSession = {
    order: route.examAplicar.map((q) => shuffle(q.opts.map((_, k) => k))),
    index: 0, score: { correct: 0, wrong: 0 }, wrong: [], answered: null,
  };
  saveState();
  go('aplicar/curso');
}

function enterRun() {
  const s = STATE.aplicarSession;
  if (!route.examAplicar) return 'inicio';
  if (!s) return 'aplicar';
  $('eaHeaderSub').textContent = s.order.length + ' preguntas · examen oficial';
  renderQuestion();
}

function renderQuestion() {
  const s = STATE.aplicarSession;
  const q = questionAt(s.index);
  $('eaProgressLabel').textContent = `Pregunta ${s.index + 1}/${s.order.length}`;
  $('eaProgFill').style.width = Math.round((s.index / s.order.length) * 100) + '%';
  $('eaScoreLabel').textContent = `✔ ${s.score.correct}   ✘ ${s.score.wrong}`;
  $('eaQuestion').textContent = q.q;
  $('eaOptions').innerHTML = q.options.map((o) => `
    <button class="opt-item" data-action="eaOption" data-letter="${o.letter}">
      <span class="opt-letter">${o.letter}</span><span>${escapeHtml(o.text)}</span>
    </button>`).join('');
  $('eaFeedback').innerHTML = '';
  $('eaNextBtn').hidden = true;
  if (s.answered) showAnswer(q, s.answered); // se recargó después de contestar: se muestra tal cual
}

function selectOption(letter) {
  const s = STATE.aplicarSession;
  if (s.answered) return;
  const q = questionAt(s.index);
  const chosen = q.options.find((o) => o.letter === letter);
  s.answered = letter;
  if (chosen.isCorrect) s.score.correct++;
  else { s.score.wrong++; s.wrong.push({ i: s.index, chosen: chosen.text }); }
  saveState();
  showAnswer(q, letter);
}

function showAnswer(q, letter) {
  const s = STATE.aplicarSession;
  const chosen = q.options.find((o) => o.letter === letter);
  const correctOpt = q.options.find((o) => o.isCorrect);
  document.querySelectorAll('#eaOptions .opt-item').forEach((btn) => {
    btn.classList.add('disabled');
    if (btn.dataset.letter === correctOpt.letter) btn.classList.add('correct');
    else if (btn.dataset.letter === letter) btn.classList.add('wrong');
  });
  $('eaScoreLabel').textContent = `✔ ${s.score.correct}   ✘ ${s.score.wrong}`;
  $('eaFeedback').innerHTML = `<div class="feedback-box ${chosen.isCorrect ? 'ok' : 'bad'}">
    ${chosen.isCorrect ? '✅ ¡Correcto!' : '❌ Incorrecto.'} La respuesta correcta es <b>${correctOpt.letter}) ${escapeHtml(correctOpt.text)}</b>.
  </div>`;
  $('eaNextBtn').hidden = false;
  $('eaNextBtn').textContent = s.index < s.order.length - 1 ? 'Siguiente pregunta →' : 'Ver resultados 🏁';
}

function eaNext() {
  const s = STATE.aplicarSession;
  if (!s.answered) return;
  if (s.index < s.order.length - 1) {
    s.index++;
    s.answered = null;
    saveState();
    renderQuestion();
    window.scrollTo(0, 0);
    return;
  }
  STATE.lastAplicarResult = { score: s.score, total: s.order.length, wrong: s.wrong };
  STATE.aplicarSession = null;
  saveState();
  go('aplicar/resultados', { replace: true });
}

function enterResults() {
  const r = STATE.lastAplicarResult;
  if (!route.examAplicar || !r) return 'aplicar';
  const pct = Math.round((r.score.correct / r.total) * 100);
  $('eaResScore').textContent = pct + '%';
  $('eaResCorrect').textContent = r.score.correct;
  $('eaResWrong').textContent = r.score.wrong;
  $('eaResTotal').textContent = r.total;
  $('eaResMsg').textContent = pct >= 80 ? '¡Excelente!' : pct >= 60 ? 'Vas bien, sigue practicando' : 'Sigue practicando';
  paginate('eaResWrongList', r.wrong, (w) => {
    const src = route.examAplicar[w.i];
    return `<div class="content-card">
      <p><b>${escapeHtml(src.q)}</b></p>
      <p style="color:var(--danger);">Tu respuesta: ${escapeHtml(w.chosen)}</p>
      <p style="color:var(--accent);">Correcta: ${escapeHtml(src.correctText)}</p>
    </div>`;
  }, '<p class="muted">¡Ninguna! Respondiste todo correctamente.</p>');
}

registerPage('aplicar', {
  view: 'aplicar', nav: 'home',
  enter: () => {
    if (!route.examAplicar) return 'inicio';
    $('eaIntroSub').textContent = route.examAplicar.length + ' preguntas oficiales';
    document.querySelectorAll('.ea-count').forEach((el) => { el.textContent = route.examAplicar.length; });
  },
});
registerPage('aplicar/curso', { view: 'aplicarRun', nav: 'home', enter: enterRun });
registerPage('aplicar/resultados', { view: 'aplicarResults', nav: 'home', enter: enterResults });

registerActions({
  startAplicar,
  eaOption: ({ letter }) => selectOption(letter),
  eaNext,
  abortAplicar: () => {
    if (!confirm('¿Salir del examen? Se perderá tu avance actual.')) return;
    STATE.aplicarSession = null;
    saveState();
    go('inicio');
  },
});
