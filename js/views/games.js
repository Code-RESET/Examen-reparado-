/* Juegos: práctica rápida con reto. Cada respuesta también alimenta el repaso (Leitner),
   la actividad del día y la racha, así que jugar ES estudiar.
   - Contrarreloj ('ta'): 60 s, opción múltiple. Aciertos seguidos multiplican puntos y suman 1 s; un error resta 3 s.
   - Supervivencia V/F ('vf'): "¿esta respuesta es la correcta?" 3 vidas y 8 s por pregunta.
   Al terminar se muestran tus errores con la respuesta correcta: ahí está lo que más se aprende.
   La partida vive solo en memoria (dura un minuto o dos); si recargas, vuelves al menú.
   URLs: #/juegos · #/juegos/jugar · #/juegos/resultado */
import { $, shuffle, escapeHtml, formatText } from '../util.js';
import { route, questionsByModule, unitTag, onRouteChange } from '../study-routes.js';
import { STATE, saveState, recordAnswer, logDaily } from '../state.js';
import { registerPage, go } from '../router.js';
import { registerActions } from '../actions.js';
import { paginate, showCelebrate } from '../ui.js';
import { addXp, unlockAchievement, checkGlobalAchievements } from '../progress.js';
import { correctOption, displayOptions, weakQuestions } from '../bank.js';

const TA_SECONDS = 60;
const TA_BONUS_MS = 1000;
const TA_PENALTY_MS = 3000;
const VF_SECONDS = 8;
const VF_LIVES = 3;
const POINTS = 10;
const MIN_POOL = 4;

const GAMES = {
  ta: { title: 'Contrarreloj', best: 'taBest' },
  vf: { title: 'Verdadero o falso', best: 'vfBest' },
};

let poolKey = 'all';
let game = null;
let lastResult = null;
let timer = null;
let advanceTimer = null;

onRouteChange(() => { poolKey = 'all'; endTimers(); game = null; lastResult = null; });

/* ---------------- Menú ---------------- */
function pools() {
  const list = [{ key: 'all', label: `Todo el banco (${route.questions.length})`, qs: route.questions }];
  const weak = weakQuestions();
  if (weak.length >= MIN_POOL) list.push({ key: 'weak', label: `🎯 Mis puntos débiles (${weak.length})`, qs: weak });
  route.modules.forEach((m) => {
    const qs = questionsByModule(m.id);
    if (qs.length >= MIN_POOL) list.push({ key: 'm:' + m.id, label: `${m.icon} ${m.title} (${qs.length})`, qs });
  });
  return list;
}
const currentPool = () => pools().find((p) => p.key === poolKey) || pools()[0];

function enterMenu() {
  const list = pools();
  if (!list.some((p) => p.key === poolKey)) poolKey = 'all';
  $('gamePool').innerHTML = list.map((p) =>
    `<option value="${escapeHtml(p.key)}"${p.key === poolKey ? ' selected' : ''}>${escapeHtml(p.label)}</option>`).join('');
  $('bestTa').textContent = `Récord: ${STATE.games.taBest} pts`;
  $('bestVf').textContent = `Récord: ${STATE.games.vfBest} pts`;
}

$('gamePool').addEventListener('change', (e) => { poolKey = e.target.value; });

/* ---------------- Partida ---------------- */
function startGame(type) {
  const pool = currentPool();
  endTimers();
  game = {
    type, poolLabel: pool.label.replace(/\s*\(\d+\)$/, ''), pool: pool.qs, queue: [],
    score: 0, combo: 0, maxCombo: 0, correct: 0, wrong: 0, errors: [], lives: VF_LIVES,
    q: null, locked: false, endAt: 0, deadline: 0, pausedAt: 0,
  };
  if (type === 'ta') game.endAt = Date.now() + TA_SECONDS * 1000;
  go('juegos/jugar');
}

/* Siguiente pregunta sin repetir hasta agotar el mazo (y nunca la misma dos veces seguidas). */
function drawQuestion() {
  if (!game.queue.length) {
    game.queue = shuffle(game.pool.slice());
    if (game.queue.length > 1 && game.queue[game.queue.length - 1] === game.q) game.queue.unshift(game.queue.pop());
  }
  return game.queue.pop();
}

const multiplier = () => Math.min(1 + Math.floor(game.combo / 3), 4);

function enterRun() {
  if (!game) return 'juegos';
  $('gameTitle').textContent = GAMES[game.type].title;
  $('gameSub').textContent = game.poolLabel;
  $('gameOptions').hidden = game.type !== 'ta';
  $('gameVf').hidden = game.type !== 'vf';
  $('gameClaim').hidden = game.type !== 'vf';
  if (!game.q) nextQuestion();
  else resume();
}

/* Al volver a la página a media partida (p.ej. tras un aviso), se retoma donde iba. */
function resume() {
  if (game.pausedAt) return; // está mostrando la corrección; el botón "Continuar" sigue ahí
  startTimer();
}

function nextQuestion() {
  clearTimeout(advanceTimer);
  if (game.pausedAt) { // el reloj no corre mientras lees la corrección
    const paused = Date.now() - game.pausedAt;
    if (game.type === 'ta') game.endAt += paused;
    game.pausedAt = 0;
  }
  game.q = drawQuestion();
  game.locked = false;
  const q = game.q;
  $('gameTag').textContent = unitTag(q);
  $('gameQuestion').innerHTML = formatText(q.q);
  $('gameFeedback').innerHTML = '';
  if (game.type === 'ta') {
    $('gameOptions').innerHTML = displayOptions(q).map((o) => `
      <button class="opt-item" data-action="taAnswer" data-letter="${o.letter}">
        <span class="opt-letter">${o.letter}</span><span>${formatText(o.text)}</span>
      </button>`).join('');
  } else {
    // La mitad de las veces se propone la respuesta correcta; la otra mitad, una incorrecta al azar
    game.truth = Math.random() < 0.5;
    const wrongs = q.options.filter((o) => o.letter !== q.correct);
    game.shown = game.truth ? correctOption(q) : wrongs[Math.floor(Math.random() * wrongs.length)];
    $('gameClaim').innerHTML = `<span class="vf-kicker">¿Es esta la respuesta correcta?</span>${formatText(game.shown.text)}`;
    $('gameVf').querySelectorAll('button').forEach((b) => { b.disabled = false; });
    game.deadline = Date.now() + VF_SECONDS * 1000;
  }
  renderHud();
  startTimer();
}

function startTimer() {
  clearInterval(timer);
  timer = setInterval(tick, 100);
  tick();
}
function endTimers() { clearInterval(timer); clearTimeout(advanceTimer); }

function tick() {
  if (!game) return;
  const now = game.pausedAt || Date.now(); // en pausa el reloj se queda congelado
  if (game.type === 'ta') {
    const left = Math.max(0, game.endAt - now);
    $('gameRight').textContent = '⏱ ' + Math.ceil(left / 1000) + ' s';
    setTimeBar(left / (TA_SECONDS * 1000));
    if (left <= 0 && !game.locked) finishGame();
  } else {
    const left = Math.max(0, game.deadline - now);
    setTimeBar(left / (VF_SECONDS * 1000));
    if (left <= 0 && !game.locked) answerVf(null);
  }
}

function setTimeBar(frac) {
  const fill = $('gameTimeFill');
  fill.style.width = Math.min(100, Math.max(0, frac * 100)) + '%';
  fill.classList.toggle('low', frac < 0.25);
}

function renderHud() {
  $('gameScore').textContent = game.score;
  const m = multiplier();
  $('gameCombo').textContent = game.combo >= 2 ? `🔥 ${game.combo}${m > 1 ? ' · x' + m : ''}` : '';
  $('gameCombo').classList.toggle('hot', m > 1);
  if (game.type === 'vf') {
    $('gameRight').textContent = '❤️'.repeat(game.lives) + '🤍'.repeat(VF_LIVES - game.lives);
  }
}

/* Registra el resultado de una jugada: puntos, combo y efectos. */
function scorePlay(ok) {
  if (ok) {
    game.combo++;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    const pts = POINTS * multiplier();
    game.score += pts;
    game.correct++;
    floatText('+' + pts);
  } else {
    game.combo = 0;
    game.wrong++;
    navigator.vibrate?.(60);
    $('gameCard').classList.remove('shake');
    void $('gameCard').offsetWidth; // reinicia la animación
    $('gameCard').classList.add('shake');
  }
  renderHud();
}

function floatText(text, bad = false) {
  const el = document.createElement('div');
  el.className = 'float-pts' + (bad ? ' bad' : '');
  el.textContent = text;
  $('gameHud').appendChild(el);
  setTimeout(() => el.remove(), 900);
}

/* ---- Contrarreloj ---- */
function answerTa(letter) {
  if (!game || game.locked) return;
  game.locked = true;
  const q = game.q;
  const ok = letter === q.correct;
  recordAnswer(q.id, ok);
  STATE.quiz.answered++;
  if (ok) STATE.quiz.correct++; else STATE.quiz.wrong++;
  saveState();
  document.querySelectorAll('#gameOptions .opt-item').forEach((b) => {
    b.classList.add('disabled');
    if (b.dataset.letter === q.correct) b.classList.add('correct');
    else if (b.dataset.letter === letter) b.classList.add('wrong');
  });
  if (ok) {
    game.endAt += TA_BONUS_MS;
  } else {
    game.endAt -= TA_PENALTY_MS;
    game.errors.push({ q, note: 'Tu respuesta: ' + formatText(q.options.find((o) => o.letter === letter).text) });
    floatText('−3 s', true);
  }
  game.pausedAt = Date.now();
  scorePlay(ok);
  tick(); // muestra de inmediato el tiempo ganado o perdido
  if (game.endAt - game.pausedAt <= 0) { advanceTimer = setTimeout(finishGame, 700); return; }
  // Un error se queda un poco más en pantalla para que veas la correcta (el reloj está en pausa)
  advanceTimer = setTimeout(nextQuestion, ok ? 350 : 1400);
}

/* ---- Verdadero o falso ---- */
function answerVf(saidTrue) {
  if (!game || game.locked) return;
  game.locked = true;
  const q = game.q;
  const timedOut = saidTrue === null;
  const ok = !timedOut && saidTrue === game.truth;
  // Fallar = no la sabías → la tarjeta regresa a repaso. Reconocer la correcta = la sabes.
  // Descartar bien una incorrecta no prueba que sepas la correcta: solo cuenta como actividad.
  if (!ok) recordAnswer(q.id, false);
  else if (game.truth) recordAnswer(q.id, true);
  else logDaily(true);
  saveState();
  $('gameVf').querySelectorAll('button').forEach((b) => { b.disabled = true; });
  scorePlay(ok);
  game.pausedAt = Date.now();
  if (ok) { advanceTimer = setTimeout(nextQuestion, 450); return; }

  game.lives--;
  const shown = formatText(game.shown.text);
  game.errors.push({ q, note: timedOut ? 'Se acabó el tiempo' : saidTrue ? `Creíste correcta: ${shown}` : `Descartaste la correcta: ${shown}` });
  renderHud();
  const verdict = timedOut ? 'Se acabó el tiempo.' : `Era ${game.truth ? 'VERDADERO' : 'FALSO'}.`;
  const last = game.lives <= 0;
  $('gameFeedback').innerHTML = `<div class="feedback-box bad">
    <b>${verdict}</b> La respuesta correcta es <b>${q.correct}) ${formatText(correctOption(q).text)}</b>.
    <button class="btn btn-primary" style="margin-top:12px;" data-action="${last ? 'finishGame' : 'gameContinue'}">${last ? 'Ver resultados' : 'Continuar →'}</button>
  </div>`;
  $('gameFeedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------------- Fin y resultados ---------------- */
const xpFor = (g) => g.correct * 4 + (g.record ? 20 : 0);

/* Cierra la partida: récord, XP e insignias. Con navigate=false (ya te fuiste a otra página) no te mueve. */
function finishGame(navigate = true) {
  if (!game) return;
  endTimers();
  const g = game;
  game = null;
  const bestKey = GAMES[g.type].best;
  g.record = g.score > 0 && g.score > STATE.games[bestKey];
  g.prevBest = STATE.games[bestKey];
  if (g.record) STATE.games[bestKey] = g.score;
  STATE.games.plays++;
  saveState();
  lastResult = g;
  if (g.correct) addXp(xpFor(g));
  if (g.maxCombo >= 10) unlockAchievement('combo10');
  if (g.type === 'ta' && g.score >= 300) unlockAchievement('ta_300');
  if (g.type === 'vf' && g.correct >= 20) unlockAchievement('vf_20');
  checkGlobalAchievements();
  if (g.record) showCelebrate('🏆', '¡Nuevo récord!', `${GAMES[g.type].title}: ${g.score} puntos.`);
  if (navigate) go('juegos/resultado', { replace: true });
}

function enterResults() {
  const r = lastResult;
  if (!r) return 'juegos';
  const total = r.correct + r.wrong;
  $('grTitle').textContent = GAMES[r.type].title;
  $('grScore').textContent = r.score;
  $('grMsg').textContent = r.record ? `🏆 ¡Nuevo récord! (antes: ${r.prevBest} pts)` : `Tu récord: ${r.prevBest} pts`;
  $('grCorrect').textContent = r.correct;
  $('grWrong').textContent = r.wrong;
  $('grCombo').textContent = r.maxCombo;
  $('grAccuracy').textContent = total ? `Precisión: ${Math.round((r.correct / total) * 100)}% en ${total} preguntas · +${xpFor(r)} XP` : '';
  paginate('grErrors', r.errors, (e) => `
    <div class="weak-item">
      <div class="wq">${formatText(e.q.q)}</div>
      <div class="wu">${e.note}</div>
      <div class="wa">Correcta: ${e.q.correct}) ${formatText(correctOption(e.q).text)}</div>
    </div>`, '<div class="empty-state">¡Sin errores! 🎯</div>');
  $('grReplay').dataset.game = r.type;
}

registerPage('juegos', { view: 'games', nav: 'games', enter: enterMenu });
registerPage('juegos/jugar', {
  view: 'gameRun', nav: 'games', enter: enterRun,
  leave: () => finishGame(false), // salir a otra página termina la partida (lo jugado sí cuenta)
});
registerPage('juegos/resultado', { view: 'gameResults', nav: 'games', enter: enterResults });

registerActions({
  startGame: ({ game: type }) => startGame(type),
  taAnswer: ({ letter }) => answerTa(letter),
  vfAnswer: ({ v }) => answerVf(v === '1'),
  gameContinue: () => { if (game) nextQuestion(); },
  finishGame: () => finishGame(),
});
