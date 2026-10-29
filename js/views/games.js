/* Juegos: Supervivencia (3 vidas contra reloj) y Parejas (relaciona pregunta con respuesta).
   Cada respuesta cuenta para el sistema Leitner igual que en el quiz, así jugar también es estudiar.
   Los récords se guardan en STATE.games. Una partida no se guarda a medias: al salir se pierde. */
import { $, formatText, shuffle, fmtClock } from '../util.js';
import { route, unitTag } from '../study-routes.js';
import { STATE, saveState, recordAnswer } from '../state.js';
import { registerPage, go } from '../router.js';
import { registerActions } from '../actions.js';
import { showToast } from '../ui.js';
import { addXp, touchStreak, checkGlobalAchievements } from '../progress.js';
import { correctOption, displayOptions, dueCardsFor, weakQuestions } from '../bank.js';

const games = () => {
  if (!STATE.games) STATE.games = { survivalBest: 0, pairsBest: null };
  return STATE.games;
};
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* sin vibración */ } };

/* Orden de estudio: primero lo que más fallas, luego lo que toca repasar, al final lo demás. */
function studyOrder(pool) {
  const weak = weakQuestions().filter((q) => pool.includes(q));
  const due = shuffle(dueCardsFor(pool).filter((q) => !weak.includes(q)));
  const rest = shuffle(pool.filter((q) => !weak.includes(q) && !due.includes(q)));
  return [...shuffle(weak.slice()), ...due, ...rest];
}

/* ======================= Centro de juegos ======================= */
function renderHub() {
  const g = games();
  $('gmSurvBest').textContent = g.survivalBest ? `Récord: ${g.survivalBest.toLocaleString('es-MX')} pts` : 'Aún sin récord';
  $('gmPairsBest').textContent = g.pairsBest ? `Récord: ${fmtClock(g.pairsBest)}` : 'Aún sin récord';
}
registerPage('juegos', { view: 'games', nav: 'home', enter: renderHub });

/* ======================= Supervivencia ======================= */
const LIVES = 3;
const LIFE_EVERY = 10; // cada 10 aciertos seguidos recuperas una vida
let sv = null;         // partida en curso
let svTimer = null;

const svSeconds = () => Math.max(8, 20 - Math.floor(sv.correct / 8) * 2); // se acelera conforme avanzas
const svCombo = () => Math.min(5, 1 + Math.floor(sv.streak / 3));

function startSurvival() {
  touchStreak();
  sv = { deck: studyOrder(route.questions), i: 0, lives: LIVES, score: 0, streak: 0, bestStreak: 0, correct: 0, missed: [], locked: false };
  go('juegos/supervivencia');
}

function enterSurvival() {
  if (!sv) return 'juegos';
  if (sv.over) return 'juegos/supervivencia/fin';
  renderSurvival();
}

function renderSurvival() {
  clearInterval(svTimer);
  if (sv.i >= sv.deck.length) sv.deck = sv.deck.concat(studyOrder(route.questions)); // le diste la vuelta al banco
  const q = sv.deck[sv.i];
  sv.locked = false;
  sv.total = svSeconds();
  sv.left = sv.total;
  $('svLives').textContent = '♥'.repeat(sv.lives) + '♡'.repeat(LIVES - sv.lives);
  $('svScore').textContent = sv.score.toLocaleString('es-MX');
  $('svCombo').textContent = 'x' + svCombo();
  $('svCombo').classList.toggle('hot', svCombo() > 1);
  $('svStreak').textContent = sv.streak ? `${sv.streak} seguidas` : '';
  $('svTag').textContent = unitTag(q);
  $('svQuestion').innerHTML = formatText(q.q);
  $('svQuestion').dataset.qid = q.id;
  $('svOptions').innerHTML = displayOptions(q).map((o) => `
    <button class="opt-item" data-action="svOption" data-letter="${o.letter}">
      <span class="opt-letter">${o.letter}</span><span>${formatText(o.text)}</span>
    </button>`).join('');
  $('svFeedback').innerHTML = '';
  $('svNextBtn').hidden = true;
  tickSurvival();
  svTimer = setInterval(() => { sv.left -= 0.1; tickSurvival(); if (sv.left <= 0) svAnswer(null); }, 100);
}

function tickSurvival() {
  const pct = Math.max(0, sv.left / sv.total) * 100;
  const bar = $('svTimeFill');
  bar.style.width = pct + '%';
  bar.classList.toggle('low', sv.left <= 5);
  $('svTime').textContent = Math.ceil(Math.max(0, sv.left)) + ' s';
}

function svAnswer(letter) {
  if (!sv || sv.locked) return;
  sv.locked = true;
  clearInterval(svTimer);
  const q = sv.deck[sv.i];
  const ok = letter === q.correct;
  recordAnswer(q.id, ok);
  STATE.quiz.answered += 1;
  if (ok) STATE.quiz.correct += 1; else STATE.quiz.wrong += 1;

  document.querySelectorAll('#svOptions .opt-item').forEach((b) => {
    b.classList.add('disabled');
    if (b.dataset.letter === q.correct) b.classList.add('correct');
    else if (b.dataset.letter === letter) b.classList.add('wrong');
  });

  let msg;
  if (ok) {
    const pts = Math.round((100 + Math.ceil(sv.left) * 10) * svCombo());
    sv.score += pts;
    sv.streak += 1;
    sv.correct += 1;
    sv.bestStreak = Math.max(sv.bestStreak, sv.streak);
    let extra = '';
    if (sv.streak % LIFE_EVERY === 0 && sv.lives < LIVES) { sv.lives += 1; extra = ' · ¡Recuperaste una vida!'; }
    msg = `<div class="feedback-box ok"><b>+${pts} pts</b>${extra}</div>`;
    $('svScore').textContent = sv.score.toLocaleString('es-MX');
    // Acierto: sigue solo tras un instante para mantener el ritmo
    setTimeout(() => { if (sv && sv.locked && !sv.over) nextSurvival(); }, 650);
  } else {
    sv.lives -= 1;
    sv.streak = 0;
    sv.missed.push(q.id);
    buzz(120);
    msg = `<div class="feedback-box bad"><b>${letter ? 'Incorrecto.' : 'Se acabó el tiempo.'}</b>
      La respuesta es <b>${q.correct}) ${formatText(correctOption(q).text)}</b>. Léela bien: va a volver a salir.</div>`;
    $('svNextBtn').hidden = false;
    $('svNextBtn').textContent = sv.lives > 0 ? 'Continuar →' : 'Ver resultado';
  }
  $('svLives').textContent = '♥'.repeat(Math.max(0, sv.lives)) + '♡'.repeat(LIVES - Math.max(0, sv.lives));
  $('svFeedback').innerHTML = msg;
  saveState();
}

function nextSurvival() {
  if (!sv) return;
  if (sv.lives <= 0) { endSurvival(); return; }
  sv.i += 1;
  renderSurvival();
  window.scrollTo(0, 0);
}

function endSurvival() {
  clearInterval(svTimer);
  sv.over = true;
  const g = games();
  sv.newRecord = sv.score > g.survivalBest;
  if (sv.newRecord) g.survivalBest = sv.score;
  saveState();
  addXp(Math.min(80, sv.correct * 3));
  checkGlobalAchievements();
  go('juegos/supervivencia/fin', { replace: true });
}

function renderSurvivalEnd() {
  if (!sv?.over) return 'juegos';
  $('svEndScore').textContent = sv.score.toLocaleString('es-MX');
  $('svEndMsg').textContent = sv.newRecord ? '¡Nuevo récord!' : `Récord: ${games().survivalBest.toLocaleString('es-MX')} pts`;
  $('svEndCorrect').textContent = sv.correct;
  $('svEndStreak').textContent = sv.bestStreak;
  $('svEndMissed').textContent = sv.missed.length;
  const byId = new Map(route.questions.map((q) => [q.id, q]));
  $('svEndList').innerHTML = sv.missed.map((id) => byId.get(id)).filter(Boolean).map((q) => `
    <div class="weak-item"><div class="wq">${formatText(q.q)}</div>
    <div class="wa">✓ ${formatText(correctOption(q).text)}</div></div>`).join('')
    || '<p class="muted">No fallaste ninguna. 💪</p>';
}

registerPage('juegos/supervivencia', { view: 'survival', nav: 'home', enter: enterSurvival, leave: () => clearInterval(svTimer) });
registerPage('juegos/supervivencia/fin', { view: 'survivalEnd', nav: 'home', enter: renderSurvivalEnd });

/* ======================= Parejas ======================= */
const PAIRS_PER_ROUND = 5;
const ROUNDS = 3;
const PENALTY_S = 5;
// Respuestas que no sirven para relacionar porque no dicen nada sin las demás opciones
const GENERIC = /^(todas las|ninguna|la opci|opci[oó]n|opciones|las opciones|las tres|a y b|b y c|si\b|sí\b|no\b|falso|cierto|verdadero)/i;

function pairPool() {
  return route.questions.filter((q) => {
    const a = correctOption(q).text.trim();
    return a.length <= 70 && q.q.length <= 150 && !GENERIC.test(a);
  });
}

let pr = null;
let prTimer = null;

function startPairs() {
  touchStreak();
  const ordered = studyOrder(pairPool());
  const picked = [];
  const seen = new Set();
  for (const q of ordered) {
    const key = correctOption(q).text.trim().toLowerCase();
    if (seen.has(key)) continue; // dos respuestas iguales en el juego serían ambiguas
    seen.add(key);
    picked.push(q);
    if (picked.length === PAIRS_PER_ROUND * ROUNDS) break;
  }
  if (picked.length < PAIRS_PER_ROUND) { showToast('No hay suficientes preguntas para este juego.'); return; }
  const rounds = [];
  for (let i = 0; i < picked.length; i += PAIRS_PER_ROUND) rounds.push(picked.slice(i, i + PAIRS_PER_ROUND));
  pr = { rounds: rounds.filter((r) => r.length === PAIRS_PER_ROUND), round: 0, start: Date.now(), mistakes: 0, failed: new Set(), sel: null, matched: new Set() };
  go('juegos/parejas');
}

function enterPairs() {
  if (!pr) return 'juegos';
  if (pr.over) return 'juegos/parejas/fin';
  renderPairs();
  clearInterval(prTimer);
  prTimer = setInterval(tickPairs, 250);
}

const pairsElapsed = () => (Date.now() - pr.start) / 1000 + pr.mistakes * PENALTY_S;
function tickPairs() { $('prTime').textContent = fmtClock(pairsElapsed()); }

function renderPairs() {
  const qs = pr.rounds[pr.round];
  pr.sel = null;
  pr.matched = new Set();
  pr.answers = pr.answers?.round === pr.round ? pr.answers : { round: pr.round, order: shuffle(qs.slice()) };
  $('prRound').textContent = `Ronda ${pr.round + 1}/${pr.rounds.length}`;
  $('prMistakes').textContent = pr.mistakes ? `${pr.mistakes} error${pr.mistakes > 1 ? 'es' : ''} (+${pr.mistakes * PENALTY_S} s)` : 'Sin errores';
  $('prQuestions').innerHTML = qs.map((q) => `
    <button class="pair-q" data-action="prPickQ" data-id="${q.id}">${formatText(q.q)}</button>`).join('');
  $('prAnswers').innerHTML = pr.answers.order.map((q) => `
    <button class="pair-a" data-action="prPickA" data-id="${q.id}">${formatText(correctOption(q).text)}</button>`).join('');
  tickPairs();
}

function pickQ(id) {
  if (pr.matched.has(id)) return;
  pr.sel = id;
  document.querySelectorAll('.pair-q').forEach((b) => b.classList.toggle('sel', b.dataset.id === id));
}

function pickA(id) {
  if (pr.matched.has(id)) return;
  if (!pr.sel) { showToast('Primero toca una pregunta, luego su respuesta.'); return; }
  const qBtn = document.querySelector(`.pair-q[data-id="${pr.sel}"]`);
  const aBtn = document.querySelector(`.pair-a[data-id="${id}"]`);
  if (id === pr.sel) {
    pr.matched.add(id);
    qBtn.classList.remove('sel');
    qBtn.classList.add('done');
    aBtn.classList.add('done');
    if (!pr.failed.has(id)) recordAnswer(id, true);
    pr.sel = null;
    if (pr.matched.size === pr.rounds[pr.round].length) {
      saveState();
      setTimeout(nextRound, 500);
    }
  } else {
    pr.mistakes += 1;
    if (!pr.failed.has(pr.sel)) { pr.failed.add(pr.sel); recordAnswer(pr.sel, false); }
    buzz(120);
    [qBtn, aBtn].forEach((b) => { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); });
    $('prMistakes').textContent = `${pr.mistakes} error${pr.mistakes > 1 ? 'es' : ''} (+${pr.mistakes * PENALTY_S} s)`;
    tickPairs();
  }
}

function nextRound() {
  if (!pr || pr.over) return;
  if (pr.round < pr.rounds.length - 1) { pr.round += 1; renderPairs(); window.scrollTo(0, 0); return; }
  clearInterval(prTimer);
  pr.over = true;
  pr.final = Math.round(pairsElapsed());
  const g = games();
  pr.newRecord = !g.pairsBest || pr.final < g.pairsBest;
  if (pr.newRecord) g.pairsBest = pr.final;
  const total = pr.rounds.flat().length;
  STATE.quiz.answered += total;
  STATE.quiz.correct += total - pr.failed.size;
  STATE.quiz.wrong += pr.failed.size;
  saveState();
  addXp(total * 2);
  checkGlobalAchievements();
  go('juegos/parejas/fin', { replace: true });
}

function renderPairsEnd() {
  if (!pr?.over) return 'juegos';
  $('prEndTime').textContent = fmtClock(pr.final);
  $('prEndMsg').textContent = pr.newRecord ? '¡Nuevo récord!' : `Récord: ${fmtClock(games().pairsBest)}`;
  $('prEndPairs').textContent = pr.rounds.flat().length;
  $('prEndMistakes').textContent = pr.mistakes;
  const failed = pr.rounds.flat().filter((q) => pr.failed.has(String(q.id)));
  $('prEndList').innerHTML = failed.map((q) => `
    <div class="weak-item"><div class="wq">${formatText(q.q)}</div>
    <div class="wa">✓ ${formatText(correctOption(q).text)}</div></div>`).join('')
    || '<p class="muted">Relacionaste todo sin errores. 💪</p>';
}

registerPage('juegos/parejas', { view: 'pairs', nav: 'home', enter: enterPairs, leave: () => clearInterval(prTimer) });
registerPage('juegos/parejas/fin', { view: 'pairsEnd', nav: 'home', enter: renderPairsEnd });

registerActions({
  startSurvival,
  svOption: ({ letter }) => svAnswer(letter),
  svNext: nextSurvival,
  exitSurvival: () => { clearInterval(svTimer); sv = null; go('juegos'); },
  startPairs,
  prPickQ: ({ id }) => pickQ(id),
  prPickA: ({ id }) => pickA(id),
  exitPairs: () => { clearInterval(prTimer); pr = null; go('juegos'); },
});
