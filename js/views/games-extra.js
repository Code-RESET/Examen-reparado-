/* Más juegos: Verdadero o Falso (60 s), Ahorcado (escribir la respuesta) y La Escalera (15 preguntas
   con comodines). Igual que Supervivencia y Parejas, cada respuesta alimenta las cajas Leitner.
   Los tres comparten una página de resultados (#/juegos/fin). */
import { $, escapeHtml, formatText, shuffle } from '../util.js';
import { route, unitTag } from '../study-routes.js';
import { STATE, saveState, recordAnswer } from '../state.js';
import { registerPage, go } from '../router.js';
import { registerActions } from '../actions.js';
import { showToast } from '../ui.js';
import { addXp, touchStreak, checkGlobalAchievements } from '../progress.js';
import { correctOption, displayOptions } from '../bank.js';
import { games, buzz, studyOrder, onHubRender } from './games.js';

const fmtPts = (n) => n.toLocaleString('es-MX');
const answerText = (q) => correctOption(q).text.trim();

function countAnswer(id, ok) {
  recordAnswer(id, ok);
  STATE.quiz.answered += 1;
  if (ok) STATE.quiz.correct += 1; else STATE.quiz.wrong += 1;
}

onHubRender((g) => {
  $('gmVfBest').textContent = g.vfBest ? `Récord: ${g.vfBest} aciertos` : 'Aún sin récord';
  $('gmHangBest').textContent = g.hangBest ? `Récord: ${g.hangBest} pts` : 'Aún sin récord';
  $('gmLadderBest').textContent = g.ladderBest ? `Récord: ${fmtPts(g.ladderBest)} pts` : 'Aún sin récord';
});

/* ======================= Resultados compartidos ======================= */
let result = null; // { title, score, label, msg, stats: [[num, label]], list: [q], again }

function finish(r) {
  result = r;
  saveState();
  checkGlobalAchievements();
  go('juegos/fin', { replace: true });
}

function renderEnd() {
  if (!result) return 'juegos';
  $('geTitle').textContent = result.title;
  $('geLabel').textContent = result.label;
  $('geScore').textContent = result.score;
  $('geMsg').textContent = result.msg;
  $('geStats').innerHTML = result.stats.map(([n, l]) =>
    `<div class="result-stat"><div class="rs-num">${escapeHtml(n)}</div><div class="rs-lab">${escapeHtml(l)}</div></div>`).join('');
  $('geStats').className = 'result-grid' + (result.stats.length === 2 ? ' two' : '');
  $('geList').innerHTML = result.list.map((q) => `
    <div class="weak-item"><div class="wq">${formatText(q.q)}</div>
    <div class="wa">✓ ${formatText(answerText(q))}</div></div>`).join('')
    || '<p class="muted">Sin errores. 💪</p>';
  $('geAgain').dataset.action = result.again;
}
registerPage('juegos/fin', { view: 'gameEnd', nav: 'home', enter: renderEnd });

/* ======================= Verdadero o Falso ======================= */
const VF_SECONDS = 60;
let vf = null;
let vfTimer = null;

function startVf() {
  touchStreak();
  vf = { deck: studyOrder(route.questions), i: 0, hits: 0, misses: 0, streak: 0, missed: [], endAt: Date.now() + VF_SECONDS * 1000 };
  go('juegos/vf');
}

function enterVf() {
  if (!vf) return 'juegos';
  renderVf();
  clearInterval(vfTimer);
  vfTimer = setInterval(tickVf, 200);
  tickVf();
}

function tickVf() {
  const left = Math.max(0, (vf.endAt - Date.now()) / 1000);
  $('vfTime').textContent = Math.ceil(left) + ' s';
  const fill = $('vfTimeFill');
  fill.style.width = (left / VF_SECONDS) * 100 + '%';
  fill.classList.toggle('low', left <= 10);
  if (left <= 0) endVf();
}

function renderVf() {
  if (vf.i >= vf.deck.length) vf.deck = vf.deck.concat(studyOrder(route.questions));
  const q = vf.deck[vf.i];
  // La mitad de las veces se propone la respuesta correcta; si no, una de las incorrectas
  const wrongOpts = q.options.filter((o) => o.letter !== q.correct);
  vf.truth = Math.random() < 0.5 || !wrongOpts.length;
  const shown = vf.truth ? correctOption(q) : wrongOpts[Math.floor(Math.random() * wrongOpts.length)];
  $('vfHits').textContent = vf.hits;
  $('vfStreak').textContent = vf.streak >= 3 ? `🔥 ${vf.streak} seguidas` : '';
  $('vfTag').textContent = unitTag(q);
  $('vfQuestion').innerHTML = formatText(q.q);
  $('vfProposal').innerHTML = formatText(shown.text);
  $('vfCard').dataset.qid = q.id;
  $('vfCard').dataset.truth = vf.truth ? '1' : '0';
}

function answerVf(saysTrue) {
  if (!vf || vf.done) return;
  const q = vf.deck[vf.i];
  const ok = saysTrue === vf.truth;
  countAnswer(q.id, ok);
  const card = $('vfCard');
  card.classList.remove('flash-ok', 'flash-bad');
  void card.offsetWidth;
  card.classList.add(ok ? 'flash-ok' : 'flash-bad');
  if (ok) { vf.hits += 1; vf.streak += 1; $('vfLast').innerHTML = ''; }
  else {
    vf.misses += 1;
    vf.streak = 0;
    if (!vf.missed.includes(q)) vf.missed.push(q);
    buzz(100);
    $('vfLast').innerHTML = `<b>Era ${vf.truth ? 'verdadero' : 'falso'}.</b> Respuesta: ${formatText(answerText(q))}`;
  }
  vf.i += 1;
  renderVf();
}

function endVf() {
  if (!vf || vf.done) return;
  vf.done = true;
  clearInterval(vfTimer);
  const g = games();
  const record = vf.hits > g.vfBest;
  if (record) g.vfBest = vf.hits;
  const total = vf.hits + vf.misses;
  addXp(Math.min(60, vf.hits * 2));
  finish({
    title: 'Verdadero o Falso', label: 'Aciertos en 60 s', score: String(vf.hits),
    msg: record ? '¡Nuevo récord!' : `Récord: ${g.vfBest} aciertos`,
    stats: [[String(total), 'Contestadas'], [String(vf.misses), 'Errores'], [total ? Math.round((vf.hits / total) * 100) + '%' : '—', 'Precisión']],
    list: vf.missed, again: 'startVf',
  });
}

registerPage('juegos/vf', { view: 'vf', nav: 'home', enter: enterVf, leave: () => clearInterval(vfTimer) });

/* ======================= Ahorcado ======================= */
const HANG_WORDS = 5;
const HANG_LIVES = 6;
const KEYS = 'QWERTYUIOPASDFGHJKLÑZXCVBNM1234567890'.split('');
// Respuestas que no se pueden adivinar letra por letra sin ver las opciones
const NOT_GUESSABLE = /^(si|sí|no|falso|cierto|todas|todos|ninguna|la opci|las opci|opci)/i;
// Mayúsculas sin acentos, pero la Ñ se queda como Ñ (es su propia tecla)
const foldCh = (ch) => { const u = ch.toUpperCase(); return u === 'Ñ' ? u : u.normalize('NFD').replace(/[̀-ͯ]/g, ''); };
const fold = (s) => [...s].map(foldCh).join('');
const cleanAnswer = (q) => answerText(q).replace(/[.\-\s]+$/, '').trim();
const isGuessChar = (ch) => /[\p{L}\d]/u.test(ch);

function hangPool() {
  return route.questions.filter((q) => {
    const a = cleanAnswer(q);
    return a.length >= 2 && a.length <= 22 && /^[\p{L}\d .\-/%]+$/u.test(a)
      && (fold(a).match(/[A-Z]/g) || []).length >= 2 && !NOT_GUESSABLE.test(a);
  });
}

let hg = null;

function startHang() {
  touchStreak();
  const seen = new Set();
  const words = studyOrder(hangPool()).filter((q) => {
    const k = fold(cleanAnswer(q));
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, HANG_WORDS);
  if (!words.length) { showToast('No hay respuestas cortas para este juego.'); return; }
  hg = { words, w: 0, points: 0, solved: 0, missed: [], misses: 0 };
  newWord();
  go('juegos/ahorcado');
}

function newWord() {
  hg.guessed = new Set();
  hg.misses = 0;
  hg.wordDone = false;
}

function enterHang() {
  if (!hg) return 'juegos';
  renderHang();
}

function renderHang() {
  const q = hg.words[hg.w];
  const ans = cleanAnswer(q);
  $('hgRound').textContent = `Palabra ${hg.w + 1}/${hg.words.length} · ${hg.points} pts`;
  $('hgLives').textContent = '●'.repeat(HANG_LIVES - hg.misses) + '○'.repeat(hg.misses);
  $('hgTag').textContent = unitTag(q);
  $('hgQuestion').innerHTML = formatText(q.q);
  $('hgQuestion').dataset.qid = q.id;
  $('hgWord').innerHTML = [...ans].map((ch) => {
    if (ch === ' ') return '<span class="hg-gap"></span>';
    if (!isGuessChar(ch)) return `<span class="hg-ch fixed">${escapeHtml(ch)}</span>`;
    const show = hg.wordDone || hg.guessed.has(fold(ch));
    const cls = show && !hg.guessed.has(fold(ch)) ? ' reveal' : '';
    return `<span class="hg-ch${cls}">${show ? escapeHtml(ch) : ''}</span>`;
  }).join('');
  const letters = new Set([...ans].filter(isGuessChar).map(fold));
  $('hgKeys').innerHTML = KEYS.map((k) => {
    const used = hg.guessed.has(k);
    const cls = used ? (letters.has(k) ? ' hit' : ' miss') : '';
    return `<button class="hg-key${cls}" data-action="hgKey" data-k="${k}" ${used || hg.wordDone ? 'disabled' : ''}>${k}</button>`;
  }).join('');
  $('hgNextBtn').hidden = !hg.wordDone;
  $('hgNextBtn').textContent = hg.w < hg.words.length - 1 ? 'Siguiente palabra →' : 'Ver resultado';
}

function pressKey(k) {
  if (!hg || hg.wordDone || hg.guessed.has(k)) return;
  const q = hg.words[hg.w];
  const letters = new Set([...cleanAnswer(q)].filter(isGuessChar).map(fold));
  hg.guessed.add(k);
  let msg = '';
  if (!letters.has(k)) {
    hg.misses += 1;
    buzz(60);
    if (hg.misses >= HANG_LIVES) {
      hg.wordDone = true;
      hg.missed.push(q);
      countAnswer(q.id, false);
      msg = '<div class="feedback-box bad"><b>Te quedaste sin intentos.</b> Ya puedes ver la respuesta completa.</div>';
    }
  } else if ([...letters].every((l) => hg.guessed.has(l))) {
    hg.wordDone = true;
    const pts = (HANG_LIVES - hg.misses) * 10;
    hg.points += pts;
    hg.solved += 1;
    countAnswer(q.id, hg.misses <= 2); // con muchos errores no cuenta como dominada
    msg = `<div class="feedback-box ok"><b>¡Bien! +${pts} pts</b></div>`;
  }
  $('hgFeedback').innerHTML = msg;
  saveState();
  renderHang();
}

function nextWord() {
  if (!hg?.wordDone) return;
  if (hg.w < hg.words.length - 1) {
    hg.w += 1;
    newWord();
    $('hgFeedback').innerHTML = '';
    renderHang();
    window.scrollTo(0, 0);
    return;
  }
  const g = games();
  const record = hg.points > g.hangBest;
  if (record) g.hangBest = hg.points;
  addXp(hg.solved * 6);
  const res = hg;
  hg = null;
  finish({
    title: 'Ahorcado', label: 'Puntos', score: String(res.points),
    msg: record ? '¡Nuevo récord!' : `Récord: ${g.hangBest} pts`,
    stats: [[`${res.solved}/${res.words.length}`, 'Resueltas'], [String(res.missed.length), 'Sin resolver']],
    list: res.missed, again: 'startHang',
  });
}

// Teclado físico en computadora
document.addEventListener('keydown', (e) => {
  if (!hg || !document.getElementById('view-hang')?.classList.contains('active') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter') { nextWord(); return; }
  const k = e.key.length === 1 ? fold(e.key) : '';
  if (KEYS.includes(k)) pressKey(k);
});

registerPage('juegos/ahorcado', { view: 'hang', nav: 'home', enter: enterHang });

/* ======================= La Escalera ======================= */
const PRIZES = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
const SAFE = new Set([4, 9]); // índices de los peldaños seguros: 1,000 y 32,000
let ld = null;

/* Sube de lo que mejor sabes a lo que más fallas, para que la dificultad crezca de verdad. */
function ladderDeck() {
  const pool = shuffle(route.questions.slice());
  const skill = (q) => { const c = STATE.cards[q.id]; return c ? c.box * 2 + c.correct - c.wrong * 2 : 0; };
  pool.sort((a, b) => skill(b) - skill(a));
  const third = Math.floor(pool.length / 3);
  const pick = (from, to, n) => shuffle(pool.slice(from, to)).slice(0, n);
  const easy = pick(0, third, 5), mid = pick(third, third * 2, 5), hard = pick(third * 2, pool.length, 5);
  const used = new Set([...easy, ...mid, ...hard]);
  return { steps: [...easy, ...mid, ...hard], spare: shuffle(pool.filter((q) => !used.has(q))) };
}

function startLadder() {
  touchStreak();
  const { steps, spare } = ladderDeck();
  ld = { steps, spare, step: 0, fifty: true, swap: true, hidden: new Set(), answered: false, missed: [] };
  go('juegos/escalera');
}

function enterLadder() {
  if (!ld) return 'juegos';
  renderLadder();
}

function renderLadder() {
  const q = ld.steps[ld.step];
  $('ldStep').textContent = `Pregunta ${ld.step + 1}/15 · por ${fmtPts(PRIZES[ld.step])} pts`;
  $('ldBank').textContent = ld.step ? `Llevas ${fmtPts(PRIZES[ld.step - 1])}` : 'Llevas 0';
  $('ldRungs').innerHTML = PRIZES.map((_, i) =>
    `<span class="ld-rung${i < ld.step ? ' done' : ''}${i === ld.step ? ' now' : ''}${SAFE.has(i) ? ' safe' : ''}"></span>`).join('');
  $('ldTag').textContent = unitTag(q);
  $('ldQuestion').innerHTML = formatText(q.q);
  $('ldOptions').innerHTML = displayOptions(q).map((o) => `
    <button class="opt-item${ld.hidden.has(o.letter) ? ' gone' : ''}" data-action="ldOption" data-letter="${o.letter}" ${ld.hidden.has(o.letter) ? 'disabled' : ''}>
      <span class="opt-letter">${o.letter}</span><span>${formatText(o.text)}</span>
    </button>`).join('');
  $('ldCard').dataset.qid = q.id;
  $('ldFifty').disabled = !ld.fifty;
  $('ldSwap').disabled = !ld.swap || !ld.spare.length;
  $('ldQuit').disabled = ld.step === 0;
  $('ldFeedback').innerHTML = '';
  $('ldNextBtn').hidden = true;
  $('ldTools').hidden = false;
}

function useFifty() {
  if (!ld?.fifty || ld.answered) return;
  const q = ld.steps[ld.step];
  ld.fifty = false;
  shuffle(q.options.filter((o) => o.letter !== q.correct)).slice(0, 2).forEach((o) => ld.hidden.add(o.letter));
  renderLadder();
}

function useSwap() {
  if (!ld?.swap || ld.answered || !ld.spare.length) return;
  ld.swap = false;
  ld.steps[ld.step] = ld.spare.shift();
  ld.hidden = new Set();
  renderLadder();
}

function answerLadder(letter) {
  if (!ld || ld.answered) return;
  ld.answered = true;
  const q = ld.steps[ld.step];
  const ok = letter === q.correct;
  countAnswer(q.id, ok);
  saveState();
  document.querySelectorAll('#ldOptions .opt-item').forEach((b) => {
    b.classList.add('disabled');
    if (b.dataset.letter === q.correct) b.classList.add('correct');
    else if (b.dataset.letter === letter) b.classList.add('wrong');
  });
  $('ldTools').hidden = true;
  if (!ok) {
    buzz(150);
    ld.missed.push(q);
    const safeIdx = [...SAFE].filter((i) => i < ld.step).pop();
    ld.prize = safeIdx === undefined ? 0 : PRIZES[safeIdx];
    ld.fell = true;
    $('ldFeedback').innerHTML = `<div class="feedback-box bad"><b>Incorrecto.</b> La respuesta es <b>${q.correct}) ${formatText(answerText(q))}</b>.
      Caes a ${fmtPts(ld.prize)} pts.</div>`;
    $('ldNextBtn').textContent = 'Ver resultado';
  } else if (ld.step === PRIZES.length - 1) {
    ld.prize = PRIZES[ld.step];
    ld.won = true;
    $('ldFeedback').innerHTML = '<div class="feedback-box ok"><b>¡Llegaste a la cima! 1,000,000 pts.</b></div>';
    $('ldNextBtn').textContent = 'Ver resultado';
  } else {
    $('ldFeedback').innerHTML = `<div class="feedback-box ok"><b>¡Correcto!</b> Aseguras ${fmtPts(PRIZES[ld.step])} pts${SAFE.has(ld.step) ? ' (peldaño seguro)' : ''}.</div>`;
    $('ldNextBtn').textContent = 'Siguiente pregunta →';
  }
  $('ldNextBtn').hidden = false;
}

function nextLadder() {
  if (!ld?.answered) return;
  if (ld.fell || ld.won) { endLadder(); return; }
  ld.step += 1;
  ld.answered = false;
  ld.hidden = new Set();
  renderLadder();
  window.scrollTo(0, 0);
}

function quitLadder() {
  if (!ld || ld.answered || ld.step === 0) return;
  ld.prize = PRIZES[ld.step - 1];
  ld.quit = true;
  endLadder();
}

function endLadder() {
  const g = games();
  const record = ld.prize > g.ladderBest;
  if (record) g.ladderBest = ld.prize;
  const reached = ld.step + (ld.won ? 1 : 0);
  addXp(Math.min(80, reached * 5));
  const res = ld;
  ld = null;
  finish({
    title: 'La Escalera', label: 'Puntos ganados', score: fmtPts(res.prize),
    msg: res.won ? '¡Llegaste a la cima!' : record ? '¡Nuevo récord!' : res.quit ? `Te retiraste a tiempo · récord ${fmtPts(g.ladderBest)}` : `Récord: ${fmtPts(g.ladderBest)} pts`,
    stats: [[`${reached}/15`, 'Peldaños'], [res.fifty ? 'No' : 'Sí', '50:50'], [res.swap ? 'No' : 'Sí', 'Cambio']],
    list: res.missed, again: 'startLadder',
  });
}

registerPage('juegos/escalera', { view: 'ladder', nav: 'home', enter: enterLadder });

registerActions({
  startVf,
  vfTrue: () => answerVf(true),
  vfFalse: () => answerVf(false),
  exitVf: () => { clearInterval(vfTimer); vf = null; go('juegos'); },
  startHang,
  hgKey: ({ k }) => pressKey(k),
  hgNext: nextWord,
  exitHang: () => { hg = null; go('juegos'); },
  startLadder,
  ldOption: ({ letter }) => answerLadder(letter),
  ldFifty: useFifty,
  ldSwap: useSwap,
  ldQuit: quitLadder,
  ldNext: nextLadder,
  exitLadder: () => { ld = null; go('juegos'); },
});
